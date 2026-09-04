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
requireMatch(
  'src/portal/admin/StudentIdCardManager.jsx',
  /Promise\.all\(Array\.from\(\{ length: Math\.min\(4, total\) \}/,
  'ID Card Studio must retain bounded concurrent photo preparation.'
);
requireMatch(
  'src/portal/admin/StudentIdCardManager.jsx',
  /selectIdCardStudents\(filteredStudents, selectedStudentIds, hasManuallySelected/,
  'ID Card Studio must preserve intentional manual selections, including an empty selection.'
);
requireMatch(
  'src/utils/idCardRenderer.js',
  /studentSession\.toLowerCase\(\) !== String\(session\)\.trim\(\)\.toLowerCase\(\)/,
  'ID Card Studio session filtering must remain exact.'
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
requireMatch(
  'src/portal/admin/StudentCertificateStudioView.jsx',
  /fetchAndResolveStudentPhoto\(st, \{ requestId, allowNetwork: false \}\)/,
  'Certificate Studio live preview must resolve photos locally without Firestore reads.'
);
requireMatch(
  'src/portal/admin/StudentCertificateStudioView.jsx',
  /const recentResultByIdentity = useMemo/,
  'Certificate Studio must index ingested results instead of repeatedly scanning them for every student.'
);
requireMatch(
  'src/portal/admin/StudentCertificateStudioView.jsx',
  /const ResultIngestionModal = React\.lazy/,
  'Certificate Studio heavy result-ingestion tools must remain lazy-loaded.'
);
requireMatch(
  'src/portal/admin/StudentCertificateStudioView.jsx',
  /\{showBulkGeneratorModal && \(\s*<BulkCertificateGeneratorModal/,
  'Certificate Studio bulk generation code must load only when its modal is opened.'
);
forbidMatch(
  'src/portal/admin/StudentCertificateStudioView.jsx',
  /unifiedStudentDirectory\.filter\(s => s\.cls\.includes/,
  'Certificate Studio cohort counts must not rescan the full directory during every render.'
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
forbidMatch(
  'src/portal/admin/AdvancedReports.jsx',
  /getRecycleBinItems/,
  'Student Records must not enumerate the recycle bin just to render its toolbar.'
);
requireMatch(
  'src/portal/admin/AdvancedReports.jsx',
  /filteredStudents\.slice\(0, bulkFormsRenderLimit\)/,
  'Bulk Forms must render records in bounded batches.'
);
requireMatch(
  'src/portal/admin/AdvancedReports.jsx',
  /\['photo_export', 'photo_manager'\]\.includes\(activeToolsTab\)/,
  'Photo-cache preparation must run only inside photo tools.'
);
requireMatch(
  'src/portal/teacher/AttendancePage.jsx',
  /if \(hasRunMissedAudit\) auditMissedDates\(\)/,
  'Missed-attendance auditing must be explicitly activated before it reads history.'
);
requireMatch(
  'src/portal/teacher/TeacherDashboard.jsx',
  /getCountFromServer\(collection\(db, 'practicalsData'\)\)/,
  'Teacher dashboard must count practical records server-side instead of downloading them.'
);
forbidMatch(
  'src/portal/admin/FundDistribution.jsx',
  /getDocs\(collection\(db, 'fund_distributions'\)\)/,
  'Funds must not duplicate the fund-distribution read already supplied by onSnapshot.'
);

if (failures.length > 0) {
  console.error('Admin performance regression check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Admin performance regression check passed.');
