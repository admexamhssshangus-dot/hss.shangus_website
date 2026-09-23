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

test('prefers an active rejected application with correction window over a draft', () => {
  const draft = { Status: 'Draft', Session: '2025-26', updatedAt: '2026-09-22T08:35:00.000Z' };
  const rejectedActive = {
    Status: 'Rejected',
    Session: '2025-26',
    isEditable: true,
    editableUntil: new Date(Date.now() + 86400000).toISOString(),
    updatedAt: '2026-09-22T08:20:00.000Z'
  };
  expect(selectStudentApplication([draft, rejectedActive], '2025-26')).toBe(rejectedActive);
  expect(selectStudentApplication([rejectedActive, draft], '2025-26')).toBe(rejectedActive);
});

test('prefers a submitted application over a rejected application', () => {
  const rejected = { Status: 'Rejected', Session: '2025-26', isEditable: true };
  const submitted = { Status: 'Submitted', Session: '2025-26' };
  expect(selectStudentApplication([rejected, submitted], '2025-26')).toBe(submitted);
  expect(selectStudentApplication([submitted, rejected], '2025-26')).toBe(submitted);
});

