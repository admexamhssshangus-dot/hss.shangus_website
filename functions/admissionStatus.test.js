'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getAssignedClassRollNumber } = require('./admissionStatus');

test('server class-roll resolver preserves an explicit class roll over an exam roll', () => {
  assert.equal(getAssignedClassRollNumber({ classRollNo: '27', rollNo: '301234567' }), '27');
});

test('server class-roll resolver rejects a generic official exam roll', () => {
  assert.equal(getAssignedClassRollNumber({ rollNo: '301234567' }), '');
  assert.equal(getAssignedClassRollNumber({ rollNo: '27' }), '27');
});
