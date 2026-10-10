'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const academicRecords = require('./academicRecords');
const { normalizeStaffClasses, isStaffSubjectMatch, checkTeacherAssignment } = academicRecords;

test('normalizeStaffClasses normalizes strings, arrays, and composite class tokens', () => {
  assert.deepEqual(normalizeStaffClasses('11th, 12th'), ['11th', '12th']);
  assert.deepEqual(normalizeStaffClasses(['11th', '12th']), ['11th', '12th']);
  assert.deepEqual(normalizeStaffClasses(['11th,12th', '10th']), ['11th', '12th', '10th']);
  assert.deepEqual(normalizeStaffClasses(['class 9', 'class 10th']), ['9th', '10th']);
});

test('isStaffSubjectMatch accurately handles codes, full names, and aliases', () => {
  // Physical Education
  assert.equal(isStaffSubjectMatch('Physical Education', 'Physical Education', 'PD'), true);
  assert.equal(isStaffSubjectMatch('PD', 'Physical Education', 'PD'), true);
  assert.equal(isStaffSubjectMatch('PHE', 'Physical Education', 'PD'), true);

  // Environmental Science
  assert.equal(isStaffSubjectMatch('Environmental Science', 'Environmental Science', 'ES'), true);
  assert.equal(isStaffSubjectMatch('EVS', 'Environmental Science', 'ES'), true);
  assert.equal(isStaffSubjectMatch('ES', 'Environmental Science', 'ES'), true);

  // IT & ITES
  assert.equal(isStaffSubjectMatch('IT and ITES', 'IT and ITES', 'ITE'), true);
  assert.equal(isStaffSubjectMatch('IT & ITES', 'IT and ITES', 'ITE'), true);
  assert.equal(isStaffSubjectMatch('ITE', 'IT and ITES', 'ITE'), true);

  // Science & Social Science
  assert.equal(isStaffSubjectMatch('Science', 'Science', 'SC'), true);
  assert.equal(isStaffSubjectMatch('SC', 'Science', 'SC'), true);
  assert.equal(isStaffSubjectMatch('Social Science', 'Social Science', 'SS'), true);
  assert.equal(isStaffSubjectMatch('SST', 'Social Science', 'SS'), true);

  // Biology, Botany, Zoology
  assert.equal(isStaffSubjectMatch('Biology', 'Botany', 'BO'), true);
  assert.equal(isStaffSubjectMatch('Biology', 'Zoology', 'ZO'), true);
  assert.equal(isStaffSubjectMatch('Botany', 'Biology', 'BI'), true);

  // Mismatches
  assert.equal(isStaffSubjectMatch('Physics', 'Chemistry', 'CH'), false);
  assert.equal(isStaffSubjectMatch('Urdu', 'English', 'EN'), false);
});

test('checkTeacherAssignment permits teachers with multiple assigned subjects and classes', () => {
  const teacher = {
    email: 'zahoor@example.com',
    assignedClasses: ['11th,12th'],
    assignedSubjects: ['Science', 'Environmental Science']
  };

  const payloadEvs12 = {
    className: '12th',
    subject: 'Environmental Science',
    subjectCode: 'ES'
  };

  assert.equal(checkTeacherAssignment(teacher, payloadEvs12, {}), true);

  const payloadPhysics12 = {
    className: '12th',
    subject: 'Physics',
    subjectCode: 'PH'
  };

  assert.equal(checkTeacherAssignment(teacher, payloadPhysics12, {}), false);
});
