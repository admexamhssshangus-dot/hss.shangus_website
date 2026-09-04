import fs from 'fs';
import path from 'path';

const read = relativePath => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('all primary authenticated pages use the shared mobile-first safety layer', () => {
  [
    'src/portal/student/StudentDashboard.jsx',
    'src/portal/student/AdmissionForm.jsx',
    'src/portal/teacher/TeacherDashboard.jsx',
    'src/portal/teacher/AttendancePage.jsx',
    'src/portal/teacher/PracticalsPage.jsx',
    'src/portal/admin/AdminDashboard.jsx',
  ].forEach(file => expect(read(file)).toMatch(/className="[^"]*portal-page/));
});

test('teacher-facing calendar controls do not derive local dates through UTC', () => {
  const teacherDateSources = [
    read('src/portal/teacher/TeacherDashboard.jsx'),
    read('src/portal/teacher/AttendancePage.jsx'),
  ].join('\n');
  expect(teacherDateSources).not.toMatch(/new Date\(\)\.toISOString\(\)\.(?:split|slice)/);
});

test('teacher dashboard has no invented fallback counts or session label', () => {
  const dashboard = read('src/portal/teacher/TeacherDashboard.jsx');
  expect(dashboard).not.toMatch(/totalStudents\s*:\s*205|totalClasses\s*:\s*4|Session 2026/);
});

test('recycle progress is readable, semantic, and uses concise copy', () => {
  const recycle = read('src/portal/admin/RecycleBinModal.jsx');
  expect(recycle).toMatch(/role="progressbar"/);
  expect(recycle).toMatch(/text-slate-950 dark:text-white/);
  expect(recycle).not.toMatch(/deep sanitization|ZERO residual|Authorizing deep clean|Wiping all cloud/i);
});
