'use strict';
const { requireStaff } = require('./access');
const { loadCohort, studentForm, studentReg } = require('./academicData');
const { DEFAULT_RATES } = require('./defaultFundRates');
module.exports = ({ functions, admin, requireAppCheck }) => functions.https.onCall(async (data, context) => {
  requireAppCheck(context);
  try {
    const db = admin.firestore();
    const staff = await requireStaff(db, { ...context.auth?.token, uid: context.auth?.uid }, { adminOnly: true, module: 'funds' });
    const action = data?.action, row = data?.record || {}, id = String(data?.id || row.id || '');
    if (!['create', 'update', 'delete'].includes(action) || !/^[a-zA-Z0-9_-]{8,120}$/.test(id)) throw new Error('A valid distribution ID and action are required.');
    return await db.runTransaction(async tx => {
      const ref = db.collection('fund_distributions').doc(id);
      const prior = await tx.get(ref);
      if (action === 'create' && prior.exists) {
        if (prior.data().requestUid === staff.uid) return { success: true, record: prior.data() };
        throw new Error('This distribution ID is already in use.');
      }
      if (action !== 'create' && !prior.exists) throw new Error('The distribution no longer exists.');
      const session = action === 'delete' ? prior.data().academicSession : row.academicSession;
      const cls = action === 'delete' ? prior.data().class : row.class;
      if (!/^20\d{2}-\d{2}$/.test(session || '') || !['9th', '10th', '11th', '12th'].includes(cls)) throw new Error('Choose a valid class and session.');
      if (prior.exists && (prior.data().academicSession !== session || prior.data().class !== cls)) throw new Error('A saved distribution cannot move between cohorts.');
      const balanceRef = db.collection('fundAllocationLocks').doc(`${session}_${cls}`);
      const [balance, config, rateSnapshot, ledger] = await Promise.all([
        tx.get(balanceRef), tx.get(db.collection('fund_config').doc('subsidiary_accounts')),
        tx.get(db.collection('fund_rates').doc(cls)), tx.get(db.collection('fund_distributions').where('academicSession', '==', session).limit(1000))
      ]);
      if (ledger.size === 1000) throw new Error('The session ledger needs pagination maintenance.');
      if (action === 'delete') {
        tx.create(db.collection('fundDistributionHistory').doc(), { sourceId: id, before: prior.data(), action, actorUid: staff.uid, at: admin.firestore.FieldValue.serverTimestamp() });
        tx.delete(ref);
        tx.set(balanceRef, { revision: (balance.data()?.revision || 0) + 1 });
        return { success: true };
      }
      const paid = Number(row.paidStudents), science = Number(row.scienceStudents);
      if (!Number.isInteger(paid) || paid < 1 || paid > 5000 || !Number.isInteger(science) || science < 0 || science > paid || !/^20\d{2}-\d{2}-\d{2}$/.test(row.date || '')) throw new Error('Invalid student counts or report date.');
      const roster = await loadCohort(tx, db, session, cls);
      const students = new Map();
      for (const student of roster) {
        const key = studentReg(student) || studentForm(student);
        if (!key) throw new Error('The cohort contains a student without a unique identifier.');
        if (students.has(key)) throw new Error('Duplicate cohort students need review before allocating funds.');
        students.set(key, student);
      }
      const capacity = students.size;
      const scienceCapacity = ['9th', '10th'].includes(cls) ? capacity : [...students.values()].filter(student => {
        const stream = String(student.stream || student.Stream || student['Stream for Class 11th'] || student['Stream for Class 12th'] || '').trim().toLowerCase();
        return /^(science|medical|non[ -]?medical)$/.test(stream);
      }).length;
      const used = ledger.docs.filter(snap => snap.id !== id && snap.data().class === cls).reduce((total, snap) => {
        const item = snap.data();
        if (!Number.isInteger(item.paidStudents) || !Number.isInteger(item.scienceStudents)) throw new Error('A legacy distribution has invalid counts. Review it before continuing.');
        return { paid: total.paid + item.paidStudents, science: total.science + item.scienceStudents };
      }, { paid: 0, science: 0 });
      if (!capacity || paid + used.paid > capacity || science + used.science > scienceCapacity) throw new Error('Available enrollment changed or is insufficient. Refresh the distribution balance.');
      const rates = { ...DEFAULT_RATES[cls], ...(rateSnapshot.data() || {}) };
      const accounts = config.data()?.accounts;
      if (!Array.isArray(accounts) || !accounts.length || accounts.length > 50) throw new Error('Save the subsidiary account configuration before generating distributions.');
      const amounts = {}; let totalAmount = 0;
      for (const account of accounts) {
        const rate = Number(rates[account.key]);
        if (!/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(account.key || '') || !Number.isFinite(rate) || rate < 0 || rate > 100000) throw new Error('A subsidiary fund rate is invalid.');
        const amount = Math.round(rate * (account.isScienceOnly ? science : paid) * 100) / 100;
        amounts[account.key] = amount; totalAmount += amount;
      }
      const date = new Date(`${row.date}T12:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== row.date) throw new Error('The report date is invalid.');
      const record = { ...amounts, id, class: cls, academicSession: session, session, date: row.date,
        month: date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }), calendarYear: String(date.getUTCFullYear()),
        year: `${date.getUTCFullYear()} (${session})`, generatedDate: date.toLocaleDateString('en-GB', { timeZone: 'UTC' }),
        paidStudents: paid, onRoll: paid, scienceStudents: science, totalAmount: Math.round(totalAmount * 100) / 100,
        timestamp: prior.data()?.timestamp || new Date().toISOString(), updatedAt: new Date().toISOString(), requestUid: staff.uid };
      if (prior.exists) tx.create(db.collection('fundDistributionHistory').doc(), { sourceId: id, before: prior.data(), action, actorUid: staff.uid, at: admin.firestore.FieldValue.serverTimestamp() });
      tx.set(ref, record);
      // Shared lock makes concurrent allocations retry even if both initially
      // observe the same query result and capacity.
      tx.set(balanceRef, { revision: (balance.data()?.revision || 0) + 1 });
      return { success: true, record };
    });
  } catch (error) { throw new functions.https.HttpsError(error.status === 403 ? 'permission-denied' : 'failed-precondition', error.message); }
});
