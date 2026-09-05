import { portalArea } from './portalRole';
test.each([
  ['Student', 'student'], ['User', 'student'], ['Teacher', 'teacher'],
  ['Faculty', 'teacher'], ['Staff', 'teacher'], ['Admin', 'admin'],
  ['SuperAdmin', 'admin'], ['Super Admin', 'admin'], [' ADMIN ', 'admin'],
  ['notadmin', null], ['student-admin', null], ['', null], [null, null],
])('routes role %s only to its allowed portal', (role, expected) => {
  expect(portalArea(role)).toBe(expected);
});
