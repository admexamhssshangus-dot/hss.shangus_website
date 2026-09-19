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
  computeScorecardSubjects,
  filterAndDeduplicateSections
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

    // 28 out of 35 -> 40 out of 50
    const scaled35 = normalizeMarksToScale(28, 35, 50);
    expect(scaled35.normalizedMarks).toBe(40);
    expect(scaled35.rawScore).toBe('28/35');

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

  test('computeScorecardSubjects honors evalConfig.subjectOverrides for custom paper scales (e.g. Physics 35M)', () => {
    const student = {
      name: 'Iqra Rashid',
      className: '11th',
      stream: 'Science',
      subjects: ['General English', 'Physics', 'Chemistry', 'Botany', 'Zoology']
    };

    const sections = [
      {
        id: 'sec-ph',
        subjectCode: 'PH',
        subjectName: 'Physics',
        records: [
          { regNo: '2501010000610099', name: 'Iqra Rashid', totalMarks: 28 } // 28/35
        ]
      }
    ];

    const matchRecord = (rec) => rec.name === 'Iqra Rashid';

    const evalConfig = {
      subjectOverrides: {
        'PH': { code: 'PH', name: 'Physics', maxMarks: 35, minMarks: 13 },
        'BO': { code: 'BO', name: 'Botany', maxMarks: 25, minMarks: 9 }
      }
    };

    const result = computeScorecardSubjects({
      matchedStudent: student,
      streamName: 'Science',
      matchingSections: sections,
      matchRecord,
      biologyDisplayMode: 'combined',
      evalConfig
    });

    const phSubject = result.subjects.find(s => s.subjectCode === 'PH');
    expect(phSubject).toBeDefined();
    expect(phSubject.maxMarks).toBe(50);
    expect(phSubject.rawMax).toBe(35); // Correctly resolved from evalConfig.subjectOverrides
    expect(phSubject.marksObtained).toBe(40); // (28/35)*50 = 40
    expect(phSubject.componentNote).toContain('Raw Paper: 28/35');
  });

  test('computeScorecardSubjects renders standard Class 10th subjects including vocational and excludes 11th/12th subjects like EVS or Education', () => {
    const student10th = {
      name: 'Mohmad Zia Wani',
      className: '10th',
      boardRegNo: '250100000610055',
      stream: 'General'
      // No explicit subjects array
    };

    const result = computeScorecardSubjects({
      matchedStudent: student10th,
      streamName: 'General',
      matchingSections: [],
      matchRecord: () => false,
      biologyDisplayMode: 'combined'
    });

    const codes = result.subjects.map(s => s.subjectCode);
    expect(codes).toEqual(['EN', 'MA', 'UR', 'SC', 'SS', 'ITE']);
    expect(result.subjects.length).toBe(6);
    expect(codes).not.toContain('ES');
    expect(codes).not.toContain('ED');
    expect(codes).not.toContain('HT');
    expect(codes).not.toContain('PS');
  });

  test('computeScorecardSubjects honors 6-subject enrolled roster for Class 10th with vocational ITE', () => {
    const student10thVoc = {
      name: 'Mohmad Zia Wani',
      className: '10th',
      boardRegNo: '250100000610055',
      subjects: [
        { code: 'EN', name: 'General English' },
        { code: 'MA', name: 'Mathematics' },
        { code: 'SC', name: 'Science' },
        { code: 'SS', name: 'Social Science' },
        { code: 'UR', name: 'Urdu' },
        { code: 'ITE', name: 'IT & ITeS' }
      ]
    };

    const result = computeScorecardSubjects({
      matchedStudent: student10thVoc,
      streamName: 'General',
      matchingSections: [],
      matchRecord: () => false,
      biologyDisplayMode: 'combined'
    });

    const codes = result.subjects.map(s => s.subjectCode);
    expect(codes).toEqual(['EN', 'MA', 'UR', 'SC', 'SS', 'ITE']);
    expect(result.subjects.length).toBe(6);
  });

  test('computeScorecardSubjects automatically injects vocational subject when Class 10th only has 5 core subjects', () => {
    const student10th5Subs = {
      name: 'Mohmad Zia Wani',
      className: '10th',
      boardRegNo: '250100000610055',
      subjects: [
        { code: 'EN', name: 'General English' },
        { code: 'MA', name: 'Mathematics' },
        { code: 'UR', name: 'Urdu' },
        { code: 'SC', name: 'Science' },
        { code: 'SS', name: 'Social Science' }
      ]
    };

    const result = computeScorecardSubjects({
      matchedStudent: student10th5Subs,
      streamName: 'General',
      matchingSections: [],
      matchRecord: () => false,
      biologyDisplayMode: 'combined'
    });

    const codes = result.subjects.map(s => s.subjectCode);
    expect(codes).toEqual(['EN', 'MA', 'UR', 'SC', 'SS', 'ITE']);
    expect(result.subjects.length).toBe(6);
  });

  test('computeScorecardSubjects reflects live teacher submissions including Chemistry marks and Biology combination', () => {
    const studentScience = {
      name: 'Umais Manzoor',
      className: '11th',
      boardRegNo: '2401003000470030',
      formNo: '250176',
      classRollNo: '1',
      stream: 'Science',
      subjects: [
        { code: 'EN', name: 'General English' },
        { code: 'PH', name: 'Physics' },
        { code: 'CH', name: 'Chemistry' },
        { code: 'BI', name: 'Biology' },
        { code: 'ES', name: 'Environmental Science' }
      ]
    };

    const liveSections = [
      {
        id: 'pending_11th_Chemistry_Pre-Board Test_2025-26',
        subjectCode: 'CH',
        subjectName: 'Chemistry',
        maxMarks: 50,
        minMarks: 18,
        records: [
          { formNo: '250176', regNo: '2401003000470030', rollNo: '1', name: 'Umais Manzoor', totalMarks: 6 }
        ]
      },
      {
        id: 'pending_11th_Botany_Pre-Board Test_2025-26',
        subjectCode: 'BO',
        subjectName: 'Botany',
        maxMarks: 25,
        minMarks: 9,
        records: [
          { formNo: '250176', regNo: '2401003000470030', rollNo: '1', name: 'Umais Manzoor', totalMarks: 16 }
        ]
      },
      {
        id: 'pending_11th_Zoology_Pre-Board Test_2025-26',
        subjectCode: 'ZO',
        subjectName: 'Zoology',
        maxMarks: 25,
        minMarks: 9,
        records: [
          { formNo: '250176', regNo: '2401003000470030', rollNo: '1', name: 'Umais Manzoor', totalMarks: 17 }
        ]
      }
    ];

    const matchRecord = (rec) => rec.formNo === '250176' || rec.regNo === '2401003000470030';

    const result = computeScorecardSubjects({
      matchedStudent: studentScience,
      streamName: 'Science',
      matchingSections: liveSections,
      matchRecord,
      biologyDisplayMode: 'combined'
    });

    const chem = result.subjects.find(s => s.subjectCode === 'CH');
    expect(chem).toBeDefined();
    expect(chem.marksObtained).toBe(6);
    expect(chem.maxMarks).toBe(50);
    expect(chem.isPass).toBe(false);
    expect(chem.status).toBe('Needs Improvement');

    const bio = result.subjects.find(s => s.subjectCode === 'BI');
    expect(bio).toBeDefined();
    expect(bio.marksObtained).toBe(33);
    expect(bio.maxMarks).toBe(50);
    expect(bio.isPass).toBe(true);
    expect(bio.componentNote).toContain('BO: 16/25');
    expect(bio.componentNote).toContain('ZO: 17/25');
  });

  test('filterAndDeduplicateSections correctly filters by class, session, and deduplicates prioritizing pending_ submissions', () => {
    const rawDocs = [
      {
        id: '11th_ch_old',
        className: '11th',
        session: '2025-26',
        practicalType: 'Pre-Board Test',
        subjectCode: 'CH',
        subjectName: 'Chemistry',
        records: [{ rollNo: '1', totalMarks: 5 }]
      },
      {
        id: 'pending_11th_ch_latest',
        className: '11th',
        session: '2025-26',
        practicalType: 'Pre-Board Test',
        subjectCode: 'CH',
        subjectName: 'Chemistry',
        records: [{ rollNo: '1', totalMarks: 6 }]
      },
      {
        id: '12th_ch',
        className: '12th',
        session: '2025-26',
        practicalType: 'Pre-Board Test',
        subjectCode: 'CH',
        records: [{ rollNo: '1', totalMarks: 40 }]
      },
      {
        id: 'draft_doc',
        className: '11th',
        session: '2025-26',
        isDraft: true,
        subjectCode: 'PH',
        records: [{ rollNo: '1', totalMarks: 30 }]
      }
    ];

    const deduplicated = filterAndDeduplicateSections(rawDocs, '11th', '2025-26', 'Pre-Board Test');
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].id).toBe('pending_11th_ch_latest');
    expect(deduplicated[0].records[0].totalMarks).toBe(6);
  });

  test('computeScorecardSubjects gracefully handles partial Biology evaluation (Botany 15/25 evaluated, Zoology awaiting)', () => {
    const studentScience = {
      name: 'Saira Jan',
      className: '11th',
      classRollNo: '4',
      formNo: '250083',
      boardRegNo: '2401010000200021',
      stream: 'Science',
      subjects: [
        { code: 'EN', name: 'General English' },
        { code: 'PH', name: 'Physics' },
        { code: 'CH', name: 'Chemistry' },
        { code: 'BO', name: 'Botany' },
        { code: 'ZO', name: 'Zoology' }
      ]
    };

    const sections = [
      {
        id: '11th_Botany_Pre-Board Test_2025-26',
        subjectCode: 'BO',
        subjectName: 'Botany',
        maxMarks: 25,
        minMarks: 9,
        records: [
          { rollNo: '4', formNo: '250083', totalMarks: 15 }
        ]
      }
    ];

    const matchRecord = (rec) => rec.formNo === '250083' || rec.rollNo === '4';

    const result = computeScorecardSubjects({
      matchedStudent: studentScience,
      streamName: 'Science',
      matchingSections: sections,
      matchRecord,
      biologyDisplayMode: 'combined'
    });

    const bio = result.subjects.find(s => s.subjectCode === 'BI');
    expect(bio).toBeDefined();
    expect(bio.marksObtained).toBe(15);
    expect(bio.maxMarks).toBe(25);
    expect(bio.minMarks).toBe(9);
    expect(bio.isPass).toBe(true);
    expect(bio.status).toBe('Good (ZO Awaiting)');
    expect(bio.componentNote).toBe('BO: 15/25 • ZO: Awaiting');
    expect(result.hasMarks).toBe(true);
    expect(result.resultStatus).toBe('IN PROGRESS');
  });

  test('filterAndDeduplicateSections matches composite class strings like 11th,12th for 11th', () => {
    const rawDocs = [
      {
        id: '11th,12th_Botany_Pre-Board Test_2025-26',
        className: '11th,12th',
        session: '2025-26',
        practicalType: 'Pre-Board Test',
        subjectCode: 'BO',
        subjectName: 'Botany',
        records: [{ rollNo: '4', totalMarks: 15 }]
      }
    ];

    const deduplicated = filterAndDeduplicateSections(rawDocs, '11th', '2025-26', 'Pre-Board Test');
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].subjectCode).toBe('BO');
  });

  test('computeScorecardSubjects deduplicates GE and EN into a single General English row', () => {
    const studentWithGE = {
      name: 'Rutba Jan',
      className: '12th',
      classRollNo: '101',
      formNo: '250291',
      boardRegNo: '2301010001010059',
      stream: 'Science',
      subjects: [
        { code: 'GE', name: 'General English' },
        { code: 'PH', name: 'Physics' },
        { code: 'CH', name: 'Chemistry' },
        { code: 'BI', name: 'Biology (Botany & Zoology)' },
        { code: 'ES', name: 'Environmental Science' }
      ]
    };

    const sections = [
      {
        id: '12th_General English_Pre-Board Test_2025-26',
        subjectCode: 'EN',
        subjectName: 'General English',
        maxMarks: 50,
        minMarks: 18,
        records: [
          { rollNo: '101', formNo: '250291', totalMarks: 32 }
        ]
      },
      {
        id: '12th_Chemistry_Pre-Board Test_2025-26',
        subjectCode: 'CH',
        subjectName: 'Chemistry',
        maxMarks: 50,
        minMarks: 18,
        records: [
          { rollNo: '101', formNo: '250291', totalMarks: 27 }
        ]
      }
    ];

    const matchRecord = (rec) => rec.formNo === '250291' || rec.rollNo === '101';

    const result = computeScorecardSubjects({
      matchedStudent: studentWithGE,
      streamName: 'Science',
      matchingSections: sections,
      matchRecord,
      biologyDisplayMode: 'combined'
    });

    // Check subjects count and verify no duplicate GE
    const englishSubjects = result.subjects.filter(s => s.subjectCode === 'EN' || s.subjectCode === 'GE');
    expect(englishSubjects.length).toBe(1);
    expect(englishSubjects[0].subjectCode).toBe('EN');
    expect(englishSubjects[0].subjectName).toBe('General English');
    expect(englishSubjects[0].marksObtained).toBe(32);
    expect(englishSubjects[0].status).toBe('Good');

    // Total subjects must be exactly 5 (EN, PH, CH, BI, ES)
    expect(result.totalCount).toBe(5);
    const codes = result.subjects.map(s => s.subjectCode);
    expect(codes).toEqual(['EN', 'PH', 'CH', 'BI', 'ES']);
  });

  test('computeScorecardSubjects correctly reflects Political Science award for Tamana Manzoor', () => {
    const tamana = {
      name: 'Tamana Manzoor',
      className: '11th',
      classRollNo: '141',
      formNo: '250085',
      boardRegNo: '2401010000200028',
      stream: 'Humanities',
      subjects: [
        { code: 'EN', name: 'General English' },
        { code: 'ED', name: 'Education' },
        { code: 'HT', name: 'History' },
        { code: 'PS', name: 'Political Science' },
        { code: 'ITE', name: 'IT & ITeS' }
      ]
    };

    // Political Science document with both Mehreen Hussain (sharing 6-digit suffix 200028) and Tamana
    const sections = [
      {
        id: '11th_Political Science_Pre-Board Test_2025-26',
        subjectCode: 'PS',
        subjectName: 'Political Science',
        maxMarks: 50,
        minMarks: 18,
        records: [
          { rollNo: '110', formNo: '250268', name: 'MEHREEN HUSSAIN', regNo: '2301013000200028', totalMarks: '' },
          { rollNo: '141', formNo: '250085', name: 'Tamana Manzoor', regNo: '2401010000200028', totalMarks: 21 }
        ]
      }
    ];

    // Authoritative matching function from PublicResultLookup
    const matchRecord = (rec) => {
      if (!rec) return false;
      const rReg = rec.regNo || rec.boardRegNo;
      const sReg = tamana.boardRegNo;
      if (rReg && sReg) {
        const isFullReg = rReg.length >= 10 && sReg.length >= 10;
        if (isFullReg ? rReg === sReg : (rReg === sReg || rReg.endsWith(sReg) || sReg.endsWith(rReg))) return true;
      }
      const rForm = rec.formNo;
      const sForm = tamana.formNo;
      if (rForm && sForm && rForm === sForm) return true;
      const rRoll = rec.rollNo;
      const sRoll = tamana.classRollNo;
      if (rRoll && sRoll && rRoll === sRoll) return true;
      return false;
    };

    const result = computeScorecardSubjects({
      matchedStudent: tamana,
      streamName: 'Humanities',
      matchingSections: sections,
      matchRecord,
      biologyDisplayMode: 'combined'
    });

    const ps = result.subjects.find(s => s.subjectCode === 'PS');
    expect(ps).toBeDefined();
    expect(ps.marksObtained).toBe(21);
    expect(ps.isEvaluated).toBe(true);
    expect(ps.isPass).toBe(true);
    expect(ps.status).toBe('Satisfactory');
    expect(result.hasMarks).toBe(true);
    expect(result.totalObtained).toBe(21);
    expect(result.evaluatedCount).toBe(1);
    expect(result.totalCount).toBe(5);
    expect(result.resultStatus).toBe('IN PROGRESS');
  });
});



