import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import PublicResultLookup from './PublicResultLookup';
import { publicLookup } from '../services/backendEndpoint';
jest.mock('../services/backendEndpoint', () => ({ publicLookup: jest.fn() }));
jest.mock('react-router-dom', () => ({ Link: 'a', useSearchParams: () => [new URLSearchParams()] }));
jest.mock('../components/SEO', () => () => null);
import {
  getSubjectPerformanceDescriptor,
  getOverallResultDescriptor,
  isSubjectCompatibleWithStream,
  isSubjectEnrolledByStudent,
  normalizeMarksToScale,
  computeScorecardSubjects
} from './PublicResultLookup';

test('unavailable configuration is explained and cannot submit an empty evaluation', async () => {
  publicLookup.mockRejectedValue(new Error('Assessment service unavailable.'));
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  render(<PublicResultLookup />);
  expect(await screen.findByText('Assessment service unavailable.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Search Result' })).toBeDisabled();
  warning.mockRestore();
});

test('subject performance descriptor uses encouraging and progressive labels instead of Fail/Re-appear', () => {
  // Low score (3/50): Needs Improvement, not Fail or Re-appear
  const low = getSubjectPerformanceDescriptor(3, 50, 18, false);
  expect(low.status).toBe('Needs Improvement');
  expect(low.isPass).toBe(false);

  // Passing grades
  const pass = getSubjectPerformanceDescriptor(20, 50, 18, false);
  expect(pass.status).toBe('Satisfactory');
  expect(pass.isPass).toBe(true);

  const good = getSubjectPerformanceDescriptor(30, 50, 18, false);
  expect(good.status).toBe('Good');

  const veryGood = getSubjectPerformanceDescriptor(38, 50, 18, false);
  expect(veryGood.status).toBe('Very Good');

  const excellent = getSubjectPerformanceDescriptor(45, 50, 18, false);
  expect(excellent.status).toBe('Excellent');
});

test('overall result descriptor handles partial evaluation as In Progress without premature Re-appear', () => {
  // Only 1 of 6 subjects tabulated with low score (Mozim Ahmad Allie case)
  const partial = getOverallResultDescriptor(1, 6, 3, 50, true, false);
  expect(partial.resultStatus).toBe('IN PROGRESS');
  expect(partial.division).toContain('In Progress');
  expect(partial.division).not.toContain('Re-Appear');

  // Fully tabulated with a subject needing improvement
  const completeFail = getOverallResultDescriptor(6, 6, 150, 300, true, false);
  expect(completeFail.resultStatus).toBe('NEEDS IMPROVEMENT');
  expect(completeFail.division).toBe('Scope for Improvement');
  expect(completeFail.resultStatus).not.toBe('RE-APPEAR');
  expect(completeFail.resultStatus).not.toBe('FAIL');
});

test('verified student catalog stores exact registered subjects and DOB for students', () => {
  const verifiedCatalog = require('../data/verifiedStudentsCatalog.json');
  const sujan = verifiedCatalog.find(s => s.fNo === '250574');
  expect(sujan).toBeDefined();
  expect(sujan.name).toBe('Sujan Ahmad Bhat');
  expect(sujan.className).toBe('11th');
  expect(sujan.classRollNo).toBe('183');
  expect(sujan.dob).toBe('2010-03-08');
  expect(Array.isArray(sujan.subjects)).toBe(true);
  expect(sujan.subjects.length).toBe(5);
  const codes = sujan.subjects.map(s => s.code);
  expect(codes).toContain('EN');
  expect(codes).toContain('ED');
  expect(codes).toContain('HT');
  expect(codes).toContain('PS');
  expect(codes).toContain('ITE');
  expect(codes).not.toContain('UR'); // Did not take Urdu
  expect(codes).not.toContain('ES'); // Did not take EVS
});

test('stream and subject compatibility prevents Science subjects like Botany in Humanities students', () => {
  // Humanities stream must reject Science subjects
  expect(isSubjectCompatibleWithStream('BO', 'Botany', 'Humanities')).toBe(false);
  expect(isSubjectCompatibleWithStream('ZO', 'Zoology', 'Humanities')).toBe(false);
  expect(isSubjectCompatibleWithStream('PH', 'Physics', 'Humanities')).toBe(false);
  expect(isSubjectCompatibleWithStream('CH', 'Chemistry', 'Humanities')).toBe(false);

  // Humanities stream allows Humanities subjects and common electives
  expect(isSubjectCompatibleWithStream('ED', 'Education', 'Humanities')).toBe(true);
  expect(isSubjectCompatibleWithStream('HT', 'History', 'Humanities')).toBe(true);
  expect(isSubjectCompatibleWithStream('PS', 'Political Science', 'Humanities')).toBe(true);
  expect(isSubjectCompatibleWithStream('PD', 'Physical Education', 'Humanities')).toBe(true);
  expect(isSubjectCompatibleWithStream('EN', 'General English', 'Humanities')).toBe(true);

  // Science stream rejects Humanities subjects
  expect(isSubjectCompatibleWithStream('HT', 'History', 'Science')).toBe(false);
  expect(isSubjectCompatibleWithStream('PS', 'Political Science', 'Science')).toBe(false);
  expect(isSubjectCompatibleWithStream('ED', 'Education', 'Science')).toBe(false);

  // Farhaan Rashid Wani (Class 12th Humanities student) check
  const verifiedCatalog = require('../data/verifiedStudentsCatalog.json');
  const farhaan = verifiedCatalog.find(s => s.fNo === '250323');
  expect(farhaan).toBeDefined();
  expect(farhaan.name.toLowerCase()).toContain('farhaan');
  expect(farhaan.classRollNo).toBe('202');

  // Botany cannot be enrolled by Farhaan
  expect(isSubjectEnrolledByStudent('BO', 'Botany', farhaan)).toBe(false);
  expect(isSubjectEnrolledByStudent('ZO', 'Zoology', farhaan)).toBe(false);
  expect(isSubjectEnrolledByStudent('PH', 'Physics', farhaan)).toBe(false);

  // Farhaan's actual subjects are verified
  expect(isSubjectEnrolledByStudent('GE', 'GE', farhaan)).toBe(true);
  expect(isSubjectEnrolledByStudent('ED', 'Education', farhaan)).toBe(true);
  expect(isSubjectEnrolledByStudent('HT', 'History', farhaan)).toBe(true);
  expect(isSubjectEnrolledByStudent('PS', 'Political Science', farhaan)).toBe(true);
  expect(isSubjectEnrolledByStudent('PD', 'Physical Education', farhaan)).toBe(true);
});

test('verified catalog correctly resolves 16-digit registration numbers like Salma Jan (2301010000900050)', () => {
  const verifiedCatalog = require('../data/verifiedStudentsCatalog.json');
  const salma = verifiedCatalog.find(s => s.boardRegNo === '2301010000900050');
  expect(salma).toBeDefined();
  expect(salma.name).toBe('Salma Jan');
  expect(salma.className).toBe('12th');
  expect(salma.stream).toBe('Humanities');
  expect(salma.classRollNo).toBe('199');

  // No scientific notation artifact in catalog
  const anyScientific = verifiedCatalog.some(s => String(s.boardRegNo || '').includes('E+') || String(s.boardRegNo || '').includes('e+'));
  expect(anyScientific).toBe(false);

  // Subject integrity: Botany & Chemistry are not enrolled by Salma Jan
  expect(isSubjectEnrolledByStudent('BO', 'Botany', salma)).toBe(false);
  expect(isSubjectEnrolledByStudent('CH', 'Chemistry', salma)).toBe(false);
  expect(isSubjectCompatibleWithStream('BO', 'Botany', salma.stream)).toBe(false);

  // Humanities subjects are enrolled
  expect(isSubjectEnrolledByStudent('HT', 'History', salma)).toBe(true);
  expect(isSubjectEnrolledByStudent('PS', 'Political Science', salma)).toBe(true);
});

describe('Score Normalization and Flexible Biology Display', () => {
  test('normalizeMarksToScale correctly scales 20/25, 70/100, and absent to 50M base', () => {
    // 20 out of 25 -> 40 out of 50
    const scaled25 = normalizeMarksToScale(20, 25, 50);
    expect(scaled25.normalizedMarks).toBe(40);
    expect(scaled25.rawScore).toBe('20/25');
    expect(scaled25.isAbsent).toBe(false);
    expect(scaled25.isEvaluated).toBe(true);

    // 70 out of 100 -> 35 out of 50
    const scaled100 = normalizeMarksToScale(70, 100, 50);
    expect(scaled100.normalizedMarks).toBe(35);
    expect(scaled100.rawScore).toBe('70/100');

    // 45 out of 50 -> remains 45 normalized, rawScore is '45/50'
    const scaled50 = normalizeMarksToScale(45, 50, 50);
    expect(scaled50.normalizedMarks).toBe(45);
    expect(scaled50.rawScore).toBe('45/50');

    // Absent
    const absent = normalizeMarksToScale('AB', 25, 50);
    expect(absent.normalizedMarks).toBe('AB');
    expect(absent.isAbsent).toBe(true);

    // Unrecorded / pending
    const pending = normalizeMarksToScale(null, 50, 50);
    expect(pending.normalizedMarks).toBe('—');
    expect(pending.isEvaluated).toBe(false);
  });

  test('computeScorecardSubjects in combined mode merges Botany (20/25) and Zoology (22/25) into single 50M Biology', () => {
    const student = {
      name: 'Sahil Ahmad Bhat',
      className: '11th',
      stream: 'Science',
      boardRegNo: '2501010000610001'
    };

    const sections = [
      {
        id: 'sec-bo',
        subjectCode: 'BO',
        subjectName: 'Botany',
        maxMarks: 25,
        records: [
          { regNo: '2501010000610001', name: 'Sahil Ahmad Bhat', totalMarks: 20 }
        ]
      },
      {
        id: 'sec-zo',
        subjectCode: 'ZO',
        subjectName: 'Zoology',
        maxMarks: 25,
        records: [
          { regNo: '2501010000610001', name: 'Sahil Ahmad Bhat', totalMarks: 22 }
        ]
      }
    ];

    const matchRecord = (rec) => rec.regNo === '2501010000610001';

    const result = computeScorecardSubjects({
      matchedStudent: student,
      streamName: 'Science',
      matchingSections: sections,
      matchRecord,
      biologyDisplayMode: 'combined'
    });

    expect(result.hasBiologySubjects).toBe(true);

    const bioSubject = result.subjects.find(s => s.subjectCode === 'BI');
    expect(bioSubject).toBeDefined();
    expect(bioSubject.subjectName).toContain('Biology');
    expect(bioSubject.maxMarks).toBe(50);
    expect(bioSubject.marksObtained).toBe(42); // 20 + 22 = 42/50
    expect(bioSubject.isPass).toBe(true);
    expect(bioSubject.componentNote).toBe('BO: 20/25 • ZO: 22/25');

    // Individual BO and ZO rows should NOT exist in combined mode
    expect(result.subjects.some(s => s.subjectCode === 'BO')).toBe(false);
    expect(result.subjects.some(s => s.subjectCode === 'ZO')).toBe(false);
  });

  test('computeScorecardSubjects in separate mode presents Botany and Zoology as individual 50M normalized subjects', () => {
    const student = {
      name: 'Sahil Ahmad Bhat',
      className: '11th',
      stream: 'Science',
      boardRegNo: '2501010000610001'
    };

    const sections = [
      {
        id: 'sec-bo',
        subjectCode: 'BO',
        subjectName: 'Botany',
        maxMarks: 25,
        records: [
          { regNo: '2501010000610001', name: 'Sahil Ahmad Bhat', totalMarks: 20 }
        ]
      },
      {
        id: 'sec-zo',
        subjectCode: 'ZO',
        subjectName: 'Zoology',
        maxMarks: 25,
        records: [
          { regNo: '2501010000610001', name: 'Sahil Ahmad Bhat', totalMarks: 22 }
        ]
      }
    ];

    const matchRecord = (rec) => rec.regNo === '2501010000610001';

    const result = computeScorecardSubjects({
      matchedStudent: student,
      streamName: 'Science',
      matchingSections: sections,
      matchRecord,
      biologyDisplayMode: 'separate'
    });

    expect(result.hasBiologySubjects).toBe(true);

    // Combined BI should NOT exist
    expect(result.subjects.some(s => s.subjectCode === 'BI')).toBe(false);

    const boSubject = result.subjects.find(s => s.subjectCode === 'BO');
    expect(boSubject).toBeDefined();
    expect(boSubject.maxMarks).toBe(50);
    expect(boSubject.marksObtained).toBe(40); // (20/25)*50 = 40
    expect(boSubject.componentNote).toContain('Raw Paper: 20/25');

    const zoSubject = result.subjects.find(s => s.subjectCode === 'ZO');
    expect(zoSubject).toBeDefined();
    expect(zoSubject.maxMarks).toBe(50);
    expect(zoSubject.marksObtained).toBe(44); // (22/25)*50 = 44
    expect(zoSubject.componentNote).toContain('Raw Paper: 22/25');
  });
});


