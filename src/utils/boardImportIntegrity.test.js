import { matchStudentInDatabase, batchUpdateStudentResults } from './jkboseResultManager';
import { applyRecordPatch, beginMutationJob, completeMutationJob } from '../services/recordMutationService';
jest.mock('../services/firebase', () => ({ db: {} }));
jest.mock('../services/dbCache', () => ({ updateCachedItem: jest.fn() }));
jest.mock('../services/geminiLetterService', () => ({ generateStructuredWithGemini: jest.fn(), getPreferredGeminiModel: jest.fn() }));
jest.mock('../services/recordMutationService', () => ({ beginMutationJob: jest.fn(), applyRecordPatch: jest.fn(), createRecordWithRollback: jest.fn(), completeMutationJob: jest.fn() }));
const student = { _docId: 'physical-document', formNo: 'FORM1', boardRegNo: 'REG1', Class: '12th', Session: '2025-26', currResult: 'PASS', currMarksReapp: '450' };
test('matching retains physical ID and rejects duplicate or off-cohort identity', () => {
  expect(matchStudentInDatabase({ regNo: 'REG1' }, [student], '12th', '2025-26').student).toBe(student);
  expect(matchStudentInDatabase({ regNo: 'REG1' }, [student, { ...student, _docId: 'other' }], '12th', '2025-26')).toBeNull();
  expect(matchStudentInDatabase({ regNo: 'REG1' }, [student], '11th', '2025-26')).toBeNull();
  expect(matchStudentInDatabase({ regNo: 'REG1', formNo: 'OTHER' }, [student], '12th', '2025-26')).toBeNull();
});
test('admit cards update exam data without erasing a final result', async () => {
  beginMutationJob.mockResolvedValue('job');
  await batchUpdateStudentResults([{ matchedStudent: student, formNo: 'FORM1', regNo: 'REG1', className: '12th', session: '2025-26', isAdmitCard: true, examRollNo: 'EXAM1', resultStatus: 'Awaiting Result' }], { overwriteExamRoll: true });
  const [target, patch] = applyRecordPatch.mock.calls.at(-1);
  expect(target._docId).toBe('physical-document');
  expect(patch.examRollNo).toBe('EXAM1');
  expect(patch).not.toHaveProperty('currResult');
  expect(patch).not.toHaveProperty('Result (Current)');
  expect(completeMutationJob).toHaveBeenCalledWith('job');
});
