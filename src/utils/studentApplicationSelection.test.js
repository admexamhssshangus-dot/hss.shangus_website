import { selectStudentApplication } from './studentApplicationSelection';
test('prefers a submitted application over an earlier draft in the same session', () => {
  const draft = { Status: 'Draft', Session: '2026-27' };
  const submitted = { Status: 'Submitted', sessionCanonical: '2026-27' };
  expect(selectStudentApplication([draft, submitted], '2026-27')).toBe(submitted);
});
test('uses the server session, canonical session fields and dash normalization', () => {
  const previous = { Status: 'Approved', Session: '2025-26' };
  const current = { status: 'Submitted', sessionCanonical: '2026-27' };
  expect(selectStudentApplication([previous, current], '2026–27')).toBe(current);
});
test('does not discard an existing application when the session does not match', () => {
  const submitted = { Status: 'Submitted', Session: '2025-26' };
  expect(selectStudentApplication([submitted], '2026-27')).toBe(submitted);
  expect(selectStudentApplication([], '2026-27')).toBeNull();
});

test('prefers a submitted application over a withdrawn application', () => {
  const withdrawn = { formNo: '251314', Status: 'Withdrawn', Session: '2025-26' };
  const submitted = { formNo: '251315', Status: 'Submitted', Session: '2025-26' };
  expect(selectStudentApplication([withdrawn, submitted], '2025-26')).toBe(submitted);
  expect(selectStudentApplication([submitted, withdrawn], '2025-26')).toBe(submitted);
});

test('prefers a provisional application over a withdrawn application', () => {
  const withdrawn = { formNo: '251314', Status: 'Withdrawn', Session: '2025-26' };
  const provisional = { formNo: '251315', Status: 'Provisional', Session: '2025-26' };
  expect(selectStudentApplication([withdrawn, provisional], '2025-26')).toBe(provisional);
});
