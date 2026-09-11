'use strict';
const { isStudentAdmissionApproved } = require('./admissionStatus');
const key = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const sessionKey = value => {
  const text = String(value || ''); const match = text.match(/(20\d{2})\s*[-/]\s*(\d{2,4})/);
  return match ? `${match[1]}-${match[2].slice(-2)}` : /^20\d{2}$/.test(text) ? `${Number(text) - 1}-${text.slice(-2)}` : text;
};
const classKey = value => String(value || '').match(/\d+/)?.[0] || '';
const studentSession = record => sessionKey(record.sessionCanonical || record.Session || record.session || record['Academic Session']);
const studentClass = record => classKey(record.classCanonical || record['Admission sought for class'] || record.Class || record.className || record.class);
const studentForm = record => key(record.formNo || record['Form Number'] || record['Form No.']);
const studentReg = record => key(record.regNo || record.boardRegNo || record['Board Registration Number'] || record['Board Reg. No.']);
const isApproved = record => !record._deleted && !record._purged && isStudentAdmissionApproved(record);
async function loadCohort(reader, db, session, className) {
  const records = new Map();
  for (const collection of ['admissions', 'masterRegisters']) {
    for (const field of ['sessionCanonical', 'Session', 'session', 'Academic Session']) {
      const query = db.collection(collection).where(field, '==', session).limit(2000);
      const snapshot = await reader.get(query);
      if (snapshot.size === 2000) throw new Error('This cohort requires pagination/index maintenance before submitting.');
      for (const snap of snapshot.docs) {
        const data = snap.data();
        const rows = ['items', 'students', 'records', 'data'].map(k => data[k]).find(Array.isArray);
        for (const [index, raw] of (rows || [data]).entries()) {
          const record = { Session: data.Session || data.session, Class: data.Class || data.class, ...raw };
          if (studentSession(record) === session && studentClass(record) === classKey(className) &&
              (collection === 'masterRegisters' ? !record._deleted : isApproved(record))) {
            records.set(`${collection}/${snap.id}/${index}`, record);
          }
        }
      }
    }
  }
  return [...records.values()];
}
module.exports = { key, sessionKey, classKey, studentForm, studentReg, loadCohort };
