'use strict';
const { requireStaff } = require('./access');
module.exports = ({ functions, admin, requireAppCheck }) => functions.https.onCall(async (data, context) => {
  requireAppCheck(context);
  const db = admin.firestore();
  try {
    await requireStaff(db, { ...context.auth?.token, uid: context.auth?.uid }, { adminOnly: true, module: 'practicals' });
    if (data?.action === 'phone') {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(data.uid || '') || !/^(\d{10})?$/.test(data.phone || '')) throw new Error('Valid staff ID and mobile number are required.');
      const ref = db.collection('users').doc(data.uid); const profile = await ref.get();
      if (!profile.exists || !['Teacher', 'Admin', 'SuperAdmin'].includes(profile.data().role)) throw new Error('Staff profile not found.');
      await ref.update({ mobile: data.phone, phone: data.phone, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { success: true };
    }
    const snapshot = await db.collection('users').where('role', 'in', ['Teacher', 'Admin', 'SuperAdmin']).limit(500).get();
    return { users: snapshot.docs.filter(snap => snap.data().active !== false && snap.id === snap.data().uid).map(snap => {
      const profile = snap.data();
      return { id: snap.id, uid: snap.id, name: profile.name || '', email: profile.email || '', role: profile.role,
        subject: profile.subject || '', mobile: profile.mobile || profile.phone || '' };
    }) };
  } catch (error) { throw new functions.https.HttpsError(error.status === 403 ? 'permission-denied' : 'failed-precondition', error.message); }
});
