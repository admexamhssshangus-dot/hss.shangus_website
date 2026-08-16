'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const rules = read('firestore.rules');
const storage = read('storage.rules');
const login = read('src/portal/LoginPage.jsx');
const settings = JSON.parse(read('public/slides/settings.json'));
const admissionWorkflow = read('netlify/functions/admission-workflow.js');
const admissionClient = read('src/services/admissionWorkflowApi.js');
const cache = read('src/services/dbCache.js');

assert(!/allow\s+(read|write|create|update|delete)(?:\s*,\s*\w+)*\s*:\s*if\s+true\b/.test(rules), 'Firestore contains unconditional access');
assert(/match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/.test(rules), 'Firestore default deny is missing');
assert(/request\.auth\.token\.(admin|role)/.test(rules), 'Firestore RBAC does not use signed token claims');
assert(/validContactMessage\(request\.resource\.data\)/.test(rules), 'Public message validation is missing');
assert(/allow read, write: if false;/.test(storage), 'Storage default deny is missing');
assert(/request\.resource\.size/.test(storage) && /contentType/.test(storage), 'Storage upload validation is missing');
assert(!/PasswordPlain|passwordPlain|createUserWithEmailAndPassword|firestoreUserData/.test(login), 'Legacy client password fallback returned');
assert(!/REACT_APP_SAVE_SECRET/.test(read('src/pages/AdminPortal.jsx')), 'Browser-exposed save secret returned');
assert(!settings.paymentGatewayConfig?.cashfree?.secretKey, 'Cashfree secret is present in public settings');
assert(!settings.paymentGatewayConfig?.razorpay?.keySecret, 'Razorpay secret is present in public settings');
assert(/verifyIdToken\(header\.slice\(7\), true\)/.test(admissionWorkflow), 'Admission endpoint does not verify a non-revoked Firebase token');
assert(/profileRole[\s\S]*\['student', 'user'\]/.test(admissionWorkflow), 'Registered-student fallback is missing');
assert(!/profileRole[\s\S]{0,300}(admin|teacher)/.test(admissionWorkflow), 'Profile fallback may grant a privileged role');
assert(/runTransaction\(async tx/.test(admissionWorkflow), 'Admission submission is not transactional');
assert(/admissionSubmissionKeys/.test(admissionWorkflow), 'Admission submission is not idempotent');
assert(/globalAdmissionsClosed/.test(admissionWorkflow) && /admissionsClosed/.test(admissionWorkflow), 'Admission closure flags are not enforced server-side');
assert(/A valid Aadhaar|validAadhaar/.test(admissionWorkflow), 'Admission server lacks Aadhaar validation');
assert(/Student writes go through the authenticated admission-workflow server/.test(rules), 'Direct student admission writes are not disabled');
assert(/MEMORY_ONLY_COLLECTIONS/.test(cache) && /'admissions'/.test(cache), 'Private admission caches are still persistent');
assert(/validatedPhoto/.test(admissionWorkflow) && /100 \* 1024/.test(admissionWorkflow), 'Firestore photo validation or size limit is missing');
assert(/photo_id/.test(admissionClient) && /canonicalizePhoto/.test(admissionClient) && !/uploadBytes/.test(admissionClient), 'Admission photos are not stored once under the canonical Firestore field');

console.log('Security regression checks passed.');
