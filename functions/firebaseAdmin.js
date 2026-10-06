'use strict';
// The Admin SDK v14 exposes modular services. Keep the injected service
// interface in one place for production functions and emulator tests.
const { initializeApp, deleteApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp, FieldPath } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
module.exports = { initializeApp, deleteApp, getApps, getApp, cert,
  firestore: Object.assign(getFirestore, { FieldValue, Timestamp, FieldPath }), auth: getAuth };

