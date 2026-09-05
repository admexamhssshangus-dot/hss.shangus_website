import { loadAdmissionWorkspace, saveAdmissionDraft, submitAdmission, withdrawAdmission } from './admissionWorkflowApi';

jest.mock('./firebase', () => ({ auth: { currentUser: { getIdToken: jest.fn().mockResolvedValue('test-token') } } }));
jest.mock('./firebaseAppCheck', () => ({ getFirebaseAppCheck: () => null }));
jest.mock('firebase/app-check', () => ({ getToken: jest.fn() }));

const reply = body => ({ ok: true, status: 200, json: async () => body });
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); });

test('load, save draft, submit, reload and withdraw use confirmed server results', async () => {
  fetch.mockResolvedValueOnce(reply({ applications: [], activeSession: '2026-27' }));
  expect((await loadAdmissionWorkspace()).applications).toEqual([]);
  fetch.mockResolvedValueOnce(reply({ success: true, applicationId: 'app-1' }));
  await saveAdmissionDraft({ formData: { Name: 'Test', 'Aadhar No.': 'private', 'Student Photo': 'private' }, force: true });
  const draft = JSON.parse(fetch.mock.calls[1][1].body);
  expect(draft.formData).toEqual({ Name: 'Test' });
  fetch.mockResolvedValueOnce(reply({ success: true, applicationId: 'app-1', formNumber: '1001' }));
  expect((await submitAdmission({ formData: { Name: 'Test' }, applicationId: 'app-1', submissionKey: 'retry-key' })).formNumber).toBe('1001');
  expect(JSON.parse(fetch.mock.calls[2][1].body).submissionKey).toBe('retry-key');
  fetch.mockResolvedValueOnce(reply({ applications: [{ docId: 'app-1', status: 'Submitted' }] }));
  expect((await loadAdmissionWorkspace()).applications[0].status).toBe('Submitted');
  fetch.mockResolvedValueOnce(reply({ success: true, applicationId: 'app-1', status: 'Withdrawn' }));
  expect((await withdrawAdmission('app-1')).status).toBe('Withdrawn');
});

test.each([{}, [], null, { success: true }, { success: true, applicationId: 'app-1' }])('rejects incomplete submission confirmation: %j', async body => {
  fetch.mockResolvedValue(reply(body));
  await expect(submitAdmission({ formData: {} })).rejects.toMatchObject({ status: 502 });
});

test('rejects HTML or malformed JSON without exposing parser errors', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } });
  await expect(submitAdmission({ formData: {} })).rejects.toThrow('invalid response');
});

test('preserves server field errors for inline validation', async () => {
  fetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: 'Check fields', fieldErrors: { Name: 'Required' } }) });
  await expect(submitAdmission({ formData: {} })).rejects.toMatchObject({ status: 422, fieldErrors: { Name: 'Required' } });
});

test('does not display raw server exceptions', async () => {
  fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Expected double-quoted property name in JSON' }) });
  await expect(submitAdmission({ formData: {} })).rejects.toThrow('temporarily unavailable');
});
