import { isStudentAdmissionApproved } from './studentApprovalStatus';
import { getSubjectMarksConfig } from './practicalsSettingsManager';
const backendApproval = require('../../functions/admissionStatus');
const backendMarks = require('../../functions/marksPolicy');
jest.mock('../services/firebase', () => ({ db: {} }));
jest.mock('../services/dbCache', () => ({ getCachedCollection: jest.fn() }));
test('client and backend agree on class-roll approval and rejection precedence', () => {
  for (const item of [{ Status: 'Approved' }, { Status: 'Submitted', classRollNo: '21' }, { Status: 'Rejected', classRollNo: '21' }, { Status: 'Draft' }, { 'Class Roll No.': '22' }]) {
    expect(backendApproval.isStudentAdmissionApproved(item)).toBe(isStudentAdmissionApproved(item));
  }
});
test('marks and deployed subject definitions agree between client and server', () => {
  expect(require('../../functions/subjectDefinitions.json')).toEqual(require('../shared/subjectDefinitions.json'));
  for (const cls of ['9th', '10th', '11th', '12th']) for (const type of ['internal', 'external']) for (const code of ['PH', 'CH', 'EN', 'HSC', 'ITE']) {
    expect(backendMarks.getSubjectMarksConfig({}, cls, type, code)).toEqual(getSubjectMarksConfig({}, cls, type, code));
  }
});
