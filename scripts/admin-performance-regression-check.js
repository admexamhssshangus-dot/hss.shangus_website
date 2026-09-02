const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];

function requireMatch(relativePath, pattern, message) {
  if (!pattern.test(read(relativePath))) failures.push(message);
}

function forbidMatch(relativePath, pattern, message) {
  if (pattern.test(read(relativePath))) failures.push(message);
}

requireMatch(
  'src/portal/admin/AdminDashboard.jsx',
  /const AdvancedReports = React\.lazy/,
  'AdvancedReports must remain lazy-loaded.'
);
requireMatch(
  'src/portal/admin/AdminDashboard.jsx',
  /const ApplicationReviewModal = React\.lazy/,
  'Application review code must load only when a record is opened.'
);
requireMatch(
  'src/portal/admin/AdminDashboard.jsx',
  /if \(!ADMISSIONS_DATA_TABS\.has\(activeTab\)\)/,
  'Admin modules must opt in before admissions are loaded.'
);
forbidMatch(
  'src/portal/admin/AdminDashboard.jsx',
  /preloadStudentPhotosCache/,
  'AdminDashboard must not rebuild the full photo cache on mount.'
);
forbidMatch(
  'src/portal/admin/StudentIdCardManager.jsx',
  /getDocs\(collection\(db,\s*['"](?:studentPhotos|admissions|masterRegisters)['"]\)\)/,
  'ID Card Studio must fetch photos by exact student key, not full collections.'
);
forbidMatch(
  'src/portal/admin/CustomRosterDocumentBuilderView.jsx',
  /preloadStudentPhotosCache/,
  'Roster Studio must not scan all photos during initial render.'
);
forbidMatch(
  'src/portal/admin/StudentCertificateStudioView.jsx',
  /preloadCentralStudentPhotos/,
  'Certificate Studio must not scan all photos during initial render.'
);
forbidMatch(
  'src/portal/admin/AdmissionRegisterSuite.jsx',
  /preloadStudentPhotosCache/,
  'Admission Register must resolve photos by selected student instead of scanning all records.'
);
requireMatch(
  'src/portal/admin/AdminGkTestManager.jsx',
  /getCachedCollection\(\s*['"]omr_registrations['"]/,
  'Competitive Exam Manager must deduplicate repeated registration reads.'
);
requireMatch(
  'src/services/docTemplateService.js',
  /where\(['"]type['"],\s*['"]==['"],\s*type\)/,
  'Document templates must be filtered by Firestore instead of in the browser.'
);
requireMatch(
  'src/services/dbCache.js',
  /snapshot\.docChanges\(\)/,
  'Realtime collection updates must process document deltas.'
);
forbidMatch(
  'src/portal/admin/AutomationsPage.jsx',
  /subscribeToCollection|getCachedCollection\(/,
  'Automations must reuse the route-level admissions stream.'
);

if (failures.length > 0) {
  console.error('Admin performance regression check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Admin performance regression check passed.');
