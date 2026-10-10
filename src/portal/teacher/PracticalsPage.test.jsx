jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ search: '' }),
  useOutletContext: () => ({ user: {} })
}));
jest.mock('../../services/firebase', () => ({
  db: {},
  auth: { currentUser: null }
}));

import { 
  getEvaluationTypesForTeacher,
  getTeacherAssignedSubjectsForClass,
  getTeacherClassSubjectPermissions,
  normalizeTeacherClasses,
  isTeacherSubjectMatch,
  isEvaluationClassMatch
} from '../../utils/practicalsSettingsManager';
import {
  extractRawSubjectsString,
  getAbbreviatedSubjects,
  getExamRoll,
  isSubjectOrStreamMatch,
  mapCatalogStudentToRecord,
  hasAssignedClassRoll
} from './PracticalsPage';
import { 
  getAbbreviatedSubjects as getPdfAbbreviatedSubjects,
  isStudentEnrolledInPracticalSubject,
  getCurrentOfficialExamRoll,
  isValidExamRollForClass,
  getStudentCentreNo
} from '../../utils/practicalsPdfGenerator';

describe('Practicals Dynamic Configuration and Roster Logic', () => {
  describe('Dynamic Subject Overrides from Edit School Assessment', () => {
    test('resolves custom maxMarks for Botany (BO) and Zoology (ZO) from evalConfig.subjectOverrides', () => {
      const customSettings = {
        customEvaluations: [
          {
            id: 'eval-midterm',
            title: 'Midterm Examination',
            evalType: 'Midterm Test',
            session: '2025-26',
            classes: ['11th', '12th'],
            maxMarks: 50,
            subjectOverrides: {
              BO: { code: 'BO', name: 'Botany', maxMarks: 30, minMarks: 11 },
              ZO: { code: 'ZO', name: 'Zoology', maxMarks: 30, minMarks: 11 }
            }
          }
        ]
      };

      const evalTypes = getEvaluationTypesForTeacher(customSettings, '12th', '2025-26');
      const midtermOption = evalTypes.find(e => e.value === 'Midterm Test');
      expect(midtermOption).toBeDefined();

      const boOverride = midtermOption.evalConfig.subjectOverrides?.['BO'];
      const zoOverride = midtermOption.evalConfig.subjectOverrides?.['ZO'];

      expect(boOverride.maxMarks).toBe(30);
      expect(zoOverride.maxMarks).toBe(30);
    });

    test('falls back to general evalConfig.maxMarks when subjectOverrides is not defined', () => {
      const customSettings = {
        customEvaluations: [
          {
            id: 'eval-unit-test',
            title: 'Unit Test',
            evalType: 'Unit Test',
            session: '2025-26',
            classes: ['12th'],
            maxMarks: 40,
            subjectOverrides: {}
          }
        ]
      };

      const evalTypes = getEvaluationTypesForTeacher(customSettings, '12th', '2025-26');
      const unitTestOption = evalTypes.find(e => e.value === 'Unit Test');
      expect(unitTestOption).toBeDefined();

      const boOverride = unitTestOption.evalConfig.subjectOverrides?.['BO'];
      expect(boOverride).toBeUndefined();
      expect(unitTestOption.evalConfig.maxMarks).toBe(40);
    });

    test('makes Pre-Board Test available for Class 10th and Class 9th in 2025-26', () => {
      const evalTypes10th = getEvaluationTypesForTeacher(null, '10th', '2025-26');
      const preBoard10th = evalTypes10th.find(e => e.value === 'Pre-Board Test');
      expect(preBoard10th).toBeDefined();
      expect(preBoard10th.evalConfig?.title).toContain('Pre-Board');

      const evalTypes9th = getEvaluationTypesForTeacher(null, '9th', '2025-26');
      const preBoard9th = evalTypes9th.find(e => e.value === 'Pre-Board Test');
      expect(preBoard9th).toBeDefined();
    });

    test('isEvaluationClassMatch accurately matches various class string formats', () => {
      expect(isEvaluationClassMatch('10th', '10th')).toBe(true);
      expect(isEvaluationClassMatch('10', '10th')).toBe(true);
      expect(isEvaluationClassMatch('Class 10th', '10th')).toBe(true);
      expect(isEvaluationClassMatch('Class 9th', '9th')).toBe(true);
      expect(isEvaluationClassMatch('9', 'Class 9th')).toBe(true);
      expect(isEvaluationClassMatch('10th', '9th')).toBe(false);
      expect(isEvaluationClassMatch('11th', '12th')).toBe(false);
    });
  });

  describe('Draft Saving & Final Submission Record Transformation', () => {
    // Helper replicating the draft record mapping in handleSaveDraft
    const transformDraftRecords = (studentList, subjectMaxMarks = 50) => {
      return studentList.map((s) => {
        const pRaw = String(s.practicalMarks !== undefined && s.practicalMarks !== null ? s.practicalMarks : '').trim().toUpperCase();
        const vRaw = String(s.vivaMarks !== undefined && s.vivaMarks !== null ? s.vivaMarks : '').trim().toUpperCase();

        const pIsAbsent = pRaw === 'A' || pRaw === 'AB';
        const vIsAbsent = vRaw === 'A' || vRaw === 'AB';

        let pMarks = '';
        let vMarks = '';
        let totalMarks = '';

        if (pIsAbsent || vIsAbsent) {
          pMarks = 'AB';
          vMarks = 'AB';
          totalMarks = 'AB';
        } else if (pRaw !== '' || vRaw !== '') {
          const pVal = pRaw !== '' ? (parseFloat(pRaw) || 0) : 0;
          const vVal = vRaw !== '' ? (parseFloat(vRaw) || 0) : 0;
          pMarks = pRaw;
          vMarks = vRaw;
          totalMarks = Math.min(subjectMaxMarks, pVal + vVal);
        }

        return {
          rollNo: String(s.rollNo || '').trim(),
          name: String(s.name || '').trim(),
          practicalMarks: pMarks,
          vivaMarks: vMarks,
          totalMarks: totalMarks,
          marksInWords: totalMarks === '' ? '' : (totalMarks === 'AB' ? 'Absent' : String(totalMarks))
        };
      });
    };

    // Helper replicating final submission transformation in executeFinalSubmit
    const transformFinalSubmitRecords = (studentList, subjectMaxMarks = 50) => {
      return studentList.map((s) => {
        let pMarks = String(s.practicalMarks !== undefined && s.practicalMarks !== null ? s.practicalMarks : '').trim().toUpperCase();
        let vMarks = String(s.vivaMarks !== undefined && s.vivaMarks !== null ? s.vivaMarks : '').trim().toUpperCase();

        // On final submission, any unfilled student MUST be treated as Absent (AB)
        if (pMarks === '' && vMarks === '') {
          pMarks = 'AB';
          vMarks = 'AB';
        }

        const isAbsent = pMarks === 'A' || vMarks === 'A' || pMarks === 'AB' || vMarks === 'AB';
        const pVal = isAbsent ? 0 : (parseFloat(pMarks) || 0);
        const vVal = isAbsent ? 0 : (parseFloat(vMarks) || 0);
        const total = isAbsent ? 'AB' : Math.min(subjectMaxMarks, pVal + vVal);

        return {
          rollNo: String(s.rollNo || '').trim(),
          name: String(s.name || '').trim(),
          practicalMarks: isAbsent ? 'AB' : pMarks,
          vivaMarks: isAbsent ? 'AB' : vMarks,
          totalMarks: total,
          marksInWords: isAbsent ? 'Absent' : String(total)
        };
      });
    };

    test('draft records keep unentered students empty and preserve entered marks and absent', () => {
      const roster = [
        { rollNo: '1', name: 'Student One', practicalMarks: '20', vivaMarks: '' },
        { rollNo: '2', name: 'Student Two', practicalMarks: 'AB', vivaMarks: '' },
        { rollNo: '3', name: 'Student Three', practicalMarks: '', vivaMarks: '' },
        { rollNo: '4', name: 'Student Four', practicalMarks: '18', vivaMarks: '5' }
      ];

      const draftResult = transformDraftRecords(roster, 30);

      // Student 1: entered practical marks
      expect(draftResult[0].practicalMarks).toBe('20');
      expect(draftResult[0].totalMarks).toBe(20);

      // Student 2: marked absent
      expect(draftResult[1].practicalMarks).toBe('AB');
      expect(draftResult[1].totalMarks).toBe('AB');
      expect(draftResult[1].marksInWords).toBe('Absent');

      // Student 3: unfilled - MUST remain blank empty strings
      expect(draftResult[2].practicalMarks).toBe('');
      expect(draftResult[2].vivaMarks).toBe('');
      expect(draftResult[2].totalMarks).toBe('');
      expect(draftResult[2].marksInWords).toBe('');

      // Student 4: entered practical + viva
      expect(draftResult[3].practicalMarks).toBe('18');
      expect(draftResult[3].vivaMarks).toBe('5');
      expect(draftResult[3].totalMarks).toBe(23);
    });

    test('final submission automatically treats unfilled students as Absent (AB)', () => {
      const roster = [
        { rollNo: '1', name: 'Student One', practicalMarks: '22', vivaMarks: '' },
        { rollNo: '2', name: 'Student Two', practicalMarks: '', vivaMarks: '' },
        { rollNo: '3', name: 'Student Three', practicalMarks: 'A', vivaMarks: '' }
      ];

      const finalResult = transformFinalSubmitRecords(roster, 25);

      // Student 1: entered
      expect(finalResult[0].practicalMarks).toBe('22');
      expect(finalResult[0].totalMarks).toBe(22);

      // Student 2: unfilled - automatically treated as AB on final submission
      expect(finalResult[1].practicalMarks).toBe('AB');
      expect(finalResult[1].vivaMarks).toBe('AB');
      expect(finalResult[1].totalMarks).toBe('AB');
      expect(finalResult[1].marksInWords).toBe('Absent');

      // Student 3: absent
      expect(finalResult[2].practicalMarks).toBe('AB');
      expect(finalResult[2].totalMarks).toBe('AB');
      expect(finalResult[2].marksInWords).toBe('Absent');
    });

    test('preloading overlay preserves saved values and keeps empty draft entries blank', () => {
      const savedMarksMap = {
        '1': { practicalMarks: '24', vivaMarks: '' },
        '2': { practicalMarks: '', vivaMarks: '' },
        '3': { practicalMarks: 'AB', vivaMarks: 'AB' }
      };

      const students = [
        { rollNo: '1', name: 'Student One' },
        { rollNo: '2', name: 'Student Two' },
        { rollNo: '3', name: 'Student Three' }
      ];

      const formatted = students.map(st => {
        const saved = savedMarksMap[st.rollNo] || {};
        return {
          rollNo: st.rollNo,
          practicalMarks: saved.practicalMarks !== undefined ? saved.practicalMarks : '',
          vivaMarks: saved.vivaMarks !== undefined ? saved.vivaMarks : ''
        };
      });

      expect(formatted[0].practicalMarks).toBe('24');
      expect(formatted[1].practicalMarks).toBe(''); // Blank student stays blank
      expect(formatted[2].practicalMarks).toBe('AB');
    });
  });

  describe('Class-Aware Teacher Subject Permissions & Cross-Subject Prevention', () => {
    const zahoorSir = {
      name: 'Zahoor Ahmad Ganie',
      email: 'zahoorganie1234@gmail.com',
      assignedClasses: ['11th,12th', '11th', '12th', '10th', '9th'],
      assignedSubjects: ['Science', 'Environmental Science'],
      tierSubjects: {
        '9th-10th': ['Science'],
        '11th-12th': ['Environmental Science']
      },
      classSubjectMap: {
        '9th': ['Science'],
        '10th': ['Science'],
        '11th': ['Environmental Science'],
        '12th': ['Environmental Science']
      }
    };

    test('normalizes composite and duplicate classes cleanly', () => {
      const normalized = normalizeTeacherClasses(zahoorSir.assignedClasses);
      expect(normalized).toEqual(['9th', '10th', '11th', '12th']);
    });

    test('resolves structured class-subject permissions grouped per class/tier', () => {
      const permissions = getTeacherClassSubjectPermissions(zahoorSir);
      expect(permissions).toHaveLength(2);

      const sciencePerm = permissions.find(p => p.subject === 'Science');
      expect(sciencePerm).toBeDefined();
      expect(sciencePerm.classes).toEqual(['9th', '10th']);
      expect(sciencePerm.classText).toBe('Class 9th, 10th');

      const evsPerm = permissions.find(p => p.subject === 'Environmental Science');
      expect(evsPerm).toBeDefined();
      expect(evsPerm.classes).toEqual(['11th', '12th']);
      expect(evsPerm.classText).toBe('Class 11th, 12th');
    });

    test('retrieves correct assigned subjects for each specific class', () => {
      expect(getTeacherAssignedSubjectsForClass(zahoorSir, '10th')).toEqual(['Science']);
      expect(getTeacherAssignedSubjectsForClass(zahoorSir, '9th')).toEqual(['Science']);
      expect(getTeacherAssignedSubjectsForClass(zahoorSir, '11th')).toEqual(['Environmental Science']);
      expect(getTeacherAssignedSubjectsForClass(zahoorSir, '12th')).toEqual(['Environmental Science']);
    });

    test('ensures evaluating Science in Class 10th does NOT trigger cross-subject status', () => {
      const selectedClass = '10th';
      const selectedSubject = 'Science';

      const classAssigned = getTeacherAssignedSubjectsForClass(zahoorSir, selectedClass);
      const allAssigned = zahoorSir.assignedSubjects;

      const isClassMatch = classAssigned.some(s => isTeacherSubjectMatch(s, selectedSubject));
      const isAnyMatch = allAssigned.some(s => isTeacherSubjectMatch(s, selectedSubject));

      const isCrossSubject = !(isClassMatch || isAnyMatch);
      expect(isCrossSubject).toBe(false);
    });

    test('ensures evaluating an unassigned subject like Urdu triggers cross-subject status', () => {
      const selectedClass = '10th';
      const selectedSubject = 'Urdu';

      const classAssigned = getTeacherAssignedSubjectsForClass(zahoorSir, selectedClass);
      const allAssigned = zahoorSir.assignedSubjects;

      const isClassMatch = classAssigned.some(s => isTeacherSubjectMatch(s, selectedSubject));
      const isAnyMatch = allAssigned.some(s => isTeacherSubjectMatch(s, selectedSubject));

      const isCrossSubject = !(isClassMatch || isAnyMatch);
      expect(isCrossSubject).toBe(true);
    });

    test('falls back gracefully to curriculum tier matching when classSubjectMap is absent', () => {
      const legacyTeacher = {
        name: 'Zahoor Ahmad Ganie',
        assignedClasses: ['9th', '10th', '11th', '12th'],
        assignedSubjects: ['Science', 'Environmental Science']
      };

      expect(getTeacherAssignedSubjectsForClass(legacyTeacher, '10th')).toEqual(['Science']);
      expect(getTeacherAssignedSubjectsForClass(legacyTeacher, '12th')).toEqual(['Environmental Science']);
    });
  });

  describe('Secondary Class Subject Normalization & Stream Suppression', () => {
    test('bulk-imported Class 10th student with 4 core subjects includes Urdu (UR) and suppresses stream code (S)', () => {
      const student10th = {
        name: 'Andleeb Reyaz',
        class: '10th',
        stream: 'Science', // Often set by default bulk ingestion
        'Subjects to be taken in Class 10th': 'English, Social Studies, Science, MA'
      };

      const raw = extractRawSubjectsString(student10th, '10th');
      expect(raw).toContain('Urdu');

      const abbr = getAbbreviatedSubjects(student10th, '10th');
      expect(abbr).toBe('EN, MA, SC, SS, UR');
      expect(abbr).not.toContain('(S)');
      expect(abbr).not.toContain('(H)');
      expect(abbr).not.toContain('(G)');

      // PDF generator parity
      const pdfAbbr = getPdfAbbreviatedSubjects(student10th, '10th');
      expect(pdfAbbr).toContain('UR');
      expect(pdfAbbr).toContain('EN');
      expect(pdfAbbr).toContain('SC');
      expect(pdfAbbr).toContain('SS');
      expect(pdfAbbr).toContain('MA');
    });

    test('Class 9th student with no explicit subjects defaults to all 5 core secondary subjects', () => {
      const student9th = {
        name: 'Atoofa Khurshid',
        class: '9th'
      };

      const raw = extractRawSubjectsString(student9th, '9th');
      expect(raw).toBe('English, Mathematics, Science, Social Studies, Urdu');

      const abbr = getAbbreviatedSubjects(student9th, '9th');
      expect(abbr).toBe('EN, MA, SC, SS, UR');
    });

    test('Class 10th student with vocational subject retains both Urdu and vocational code', () => {
      const studentVoc = {
        name: 'Zuhaq Rafiq Bhat',
        class: '10th',
        'Subjects to be taken in Class 10th': 'English, Social Studies, Science, Mathematics, IT and ITES'
      };

      const raw = extractRawSubjectsString(studentVoc, '10th');
      expect(raw).toContain('Urdu');
      expect(raw).toContain('IT and ITES');

      const abbr = getAbbreviatedSubjects(studentVoc, '10th');
      expect(abbr).toBe('EN, MA, SC, SS, UR, ITE');
    });

    test('Higher Secondary (11th & 12th) preserves stream codes', () => {
      const student12th = {
        name: 'Senior Student',
        class: '12th',
        stream: 'Science',
        'Subjects to be taken in Class 12th': 'General English, Physics, Chemistry, Biology'
      };

      const abbr = getAbbreviatedSubjects(student12th, '12th');
      expect(abbr).toBe('EN, PH, CH, BI (S)');
    });

    test('Science student with Physical Education does NOT receive Arts subject ED (Education)', () => {
      const studentSciPd = {
        name: 'Irtiza Maqbool',
        class: '12th',
        stream: 'Science',
        'Subjects to be taken in Class 12th': 'General English, Physics, Chemistry, Biology, Physical Education'
      };

      // PracticalsPage abbreviation
      const pageAbbr = getAbbreviatedSubjects(studentSciPd, '12th');
      expect(pageAbbr).toContain('PD');
      expect(pageAbbr).not.toContain('ED');

      // PDF generator abbreviation
      const pdfAbbr = getPdfAbbreviatedSubjects(studentSciPd, '12th');
      expect(pdfAbbr).toContain('PD');
      expect(pdfAbbr).not.toContain('ED');

      // Enrollment checks
      expect(isStudentEnrolledInPracticalSubject(studentSciPd, 'PD', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(studentSciPd, 'ED', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(studentSciPd, 'BI', '12th')).toBe(true);
    });

    test('Class 12th student with "Same as in Class 11th" resolves authentic subjects from 11th records', () => {
      const studentWith11Placeholder = {
        name: 'Aaqib Ahmad',
        class: '12th',
        stream: 'Science',
        'Subjects to be taken in Class 12th': 'Same as in Class 11th',
        'Subjects Studied in Class 11th': 'General English, Physics, Chemistry, Mathematics, Physical Education'
      };

      const raw = extractRawSubjectsString(studentWith11Placeholder, '12th');
      expect(raw).toContain('Physics');
      expect(raw).toContain('Mathematics');
      expect(raw).not.toContain('Same as in Class 11th');

      const pdfAbbr = getPdfAbbreviatedSubjects(studentWith11Placeholder, '12th');
      expect(pdfAbbr).toBe('EN, PH, CH, MA, PD');
      expect(pdfAbbr).not.toContain('ED');

      expect(isStudentEnrolledInPracticalSubject(studentWith11Placeholder, 'MA', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(studentWith11Placeholder, 'PD', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(studentWith11Placeholder, 'ED', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(studentWith11Placeholder, 'PH', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(studentWith11Placeholder, 'CH', '12th')).toBe(true);
    });

    test('Class 12th Medical student with elective-only subjects is automatically enrolled in compulsory Physics and Chemistry', () => {
      const medicalElectivesOnly = {
        name: 'Zahoor Ahmad',
        class: '12th',
        stream: 'Science',
        'Subjects to be taken in Class 12th': 'Botany, Zoology, Environmental Science'
      };

      // Guaranteed inclusion in foundation science subjects
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'PH', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'CH', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'BO', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'ZO', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'EN', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'ES', '12th')).toBe(true);

      // Strict exclusion from Arts and Non-Med electives
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'ED', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'HT', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(medicalElectivesOnly, 'MA', '12th')).toBe(false);
    });

    test('Class 12th Arts student is never enrolled in Science subjects', () => {
      const artsStudent = {
        name: 'Shabir Ahmad',
        class: '12th',
        stream: 'Humanities',
        'Subjects to be taken in Class 12th': 'General English, Urdu, Education, Political Science, Economics'
      };

      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'EN', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'ED', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'PS', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'UR', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'EC', '12th')).toBe(true);

      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'PH', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'CH', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'BO', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(artsStudent, 'ZO', '12th')).toBe(false);
    });
  });

  describe('Official Exam Roll Resolution & Centre Code Derivation', () => {
    test('strictly validates JKBOSE exam roll prefix per class', () => {
      // 10th must start with 1 (Centre 101061)
      expect(isValidExamRollForClass('101061058', '10th')).toBe(true);
      expect(isValidExamRollForClass('201003029', '10th')).toBe(false);
      expect(isValidExamRollForClass('301004100', '10th')).toBe(false);

      // 11th must start with 2 (Centres 201003, 201004)
      expect(isValidExamRollForClass('201003029', '11th')).toBe(true);
      expect(isValidExamRollForClass('201004043', '11th')).toBe(true);
      expect(isValidExamRollForClass('101061058', '11th')).toBe(false);
      expect(isValidExamRollForClass('301004100', '11th')).toBe(false);

      // 12th must start with 3 (Centres 301003, 301004)
      expect(isValidExamRollForClass('301003051', '12th')).toBe(true);
      expect(isValidExamRollForClass('301004100', '12th')).toBe(true);
      expect(isValidExamRollForClass('201000224', '12th')).toBe(false); // Old redundant roll
      expect(isValidExamRollForClass('201003080', '12th')).toBe(false); // 11th roll
      expect(isValidExamRollForClass('101057000', '12th')).toBe(false); // 10th roll
    });

    test('resolves current official 12th exam roll and rejects old redundant rolls', () => {
      const rohitStudentRecord = {
        name: 'Rohit Chidanand Raina',
        class: '12th',
        currExamRollNo: '301004100',
        boardRollNo: '301004100',
        'Exam Roll Number of Class 11th': '201003080',
        'Exam Roll Number of Class 10th': '101057000',
        examRollNo: '201000224' // Old redundant placeholder
      };

      const resolved = getCurrentOfficialExamRoll(rohitStudentRecord, '12th');
      expect(resolved).toBe('301004100');

      const teacherPageRoll = getExamRoll(rohitStudentRecord, '12th');
      expect(teacherPageRoll).toBe('301004100');

      // Centre derivation correctly extracts 301004
      const centre = getStudentCentreNo(rohitStudentRecord, '', '12th');
      expect(centre).toBe('301004');
    });

    test('correctly extracts official centres: 1 centre for 10th and 2 centres for 11th and 12th', () => {
      // 10th: 1 Centre (101061)
      const st10 = { class: '10th', currExamRollNo: '101061058' };
      expect(getStudentCentreNo(st10, '', '10th')).toBe('101061');

      // 11th: 2 Centres (201003 and 201004)
      const st11A = { class: '11th', currExamRollNo: '201003029' };
      const st11B = { class: '11th', currExamRollNo: '201004043' };
      expect(getStudentCentreNo(st11A, '', '11th')).toBe('201003');
      expect(getStudentCentreNo(st11B, '', '11th')).toBe('201004');

      // 12th: 2 Centres (301003 and 301004)
      const st12A = { class: '12th', currExamRollNo: '301003051' };
      const st12B = { class: '12th', currExamRollNo: '301004100' };
      expect(getStudentCentreNo(st12A, '', '12th')).toBe('301003');
      expect(getStudentCentreNo(st12B, '', '12th')).toBe('301004');
    });
  });

  describe('Class-Specific Subject Isolation & Switch Handling', () => {
    test('student who switched from Physical Education in 11th to Environmental Science in 12th matches only ES in 12th and PD in 11th', () => {
      const malikaTariq = {
        name: 'Malika Tariq',
        class: '12th',
        className: '12th',
        stream: 'Science',
        'Subs': 'General English, Physics, Chemistry, Biology, Physical Education', // legacy 11th Subs
        'Subjects to be taken in Class 11th': 'General English, Physics, Chemistry, Biology, Physical Education',
        'Subjects to be taken in Class 12th': 'General English, Physics, Chemistry, Biology, Environmental Science'
      };

      // In Class 12th evaluation:
      expect(isSubjectOrStreamMatch(malikaTariq, 'PD', 'Physical Education', '12th')).toBe(false);
      expect(isSubjectOrStreamMatch(malikaTariq, 'ES', 'Environmental Science', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(malikaTariq, 'PD', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(malikaTariq, 'ES', '12th')).toBe(true);

      const abbr12 = getAbbreviatedSubjects(malikaTariq, '12th');
      expect(abbr12).toContain('ES');
      expect(abbr12).not.toContain('PD');

      // In Class 11th evaluation:
      expect(isSubjectOrStreamMatch(malikaTariq, 'PD', 'Physical Education', '11th')).toBe(true);
      expect(isSubjectOrStreamMatch(malikaTariq, 'ES', 'Environmental Science', '11th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(malikaTariq, 'PD', '11th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(malikaTariq, 'ES', '11th')).toBe(false);
    });

    test('student who has Environmental Science in both classes matches ES and never PD in both 11th and 12th', () => {
      const malikaBothClasses = {
        name: 'Malika Tariq',
        class: '12th',
        className: '12th',
        stream: 'Science',
        'Subs': 'General English, Physics, Chemistry, Biology, Environmental Science',
        'Subjects Studied in Class 11th': 'General English, Physics, Chemistry, Biology, Environmental Science',
        'Subjects to be taken in Class 11th': 'General English, Physics, Chemistry, Biology, Environmental Science',
        'Subjects to be taken in Class 12th': 'General English, Physics, Chemistry, Biology, Environmental Science',
        'Subjects5': 'Environmental Science',
        'subjects': 'GE, PH, CH, BI, ES'
      };

      // In Class 12th evaluation:
      expect(isSubjectOrStreamMatch(malikaBothClasses, 'PD', 'Physical Education', '12th')).toBe(false);
      expect(isSubjectOrStreamMatch(malikaBothClasses, 'ES', 'Environmental Science', '12th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(malikaBothClasses, 'PD', '12th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(malikaBothClasses, 'ES', '12th')).toBe(true);
      expect(getAbbreviatedSubjects(malikaBothClasses, '12th')).toContain('ES');
      expect(getAbbreviatedSubjects(malikaBothClasses, '12th')).not.toContain('PD');

      // In Class 11th evaluation:
      expect(isSubjectOrStreamMatch(malikaBothClasses, 'PD', 'Physical Education', '11th')).toBe(false);
      expect(isSubjectOrStreamMatch(malikaBothClasses, 'ES', 'Environmental Science', '11th')).toBe(true);
      expect(isStudentEnrolledInPracticalSubject(malikaBothClasses, 'PD', '11th')).toBe(false);
      expect(isStudentEnrolledInPracticalSubject(malikaBothClasses, 'ES', '11th')).toBe(true);
      expect(getAbbreviatedSubjects(malikaBothClasses, '11th')).toContain('ES');
      expect(getAbbreviatedSubjects(malikaBothClasses, '11th')).not.toContain('PD');
    });

    test('secondary students never match higher secondary subjects and vocational electives require actual enrollment', () => {
      const secondaryCoreStudent = {
        name: 'Mohammad Shahid',
        class: '10th',
        'Subjects to be taken in Class 10th': 'English, Mathematics, Science, Social Studies, Urdu'
      };

      // Core subjects match
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'SC', 'Science', '10th')).toBe(true);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'SS', 'Social Science', '10th')).toBe(true);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'MA', 'Mathematics', '10th')).toBe(true);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'EN', 'General English', '10th')).toBe(true);

      // Higher secondary subjects MUST NOT match
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'PD', 'Physical Education', '10th')).toBe(false);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'BO', 'Botany', '10th')).toBe(false);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'ZO', 'Zoology', '10th')).toBe(false);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'CH', 'Chemistry', '10th')).toBe(false);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'PH', 'Physics', '10th')).toBe(false);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'PS', 'Political Science', '10th')).toBe(false);

      // Vocational subjects require enrollment
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'ITE', 'IT and ITES', '10th')).toBe(false);
      expect(isSubjectOrStreamMatch(secondaryCoreStudent, 'HTC', 'Healthcare', '10th')).toBe(false);

      const secondaryVocStudent = {
        name: 'Zahida Bano',
        class: '10th',
        'Subjects to be taken in Class 10th': 'English, Mathematics, Science, Social Studies, Urdu, IT and ITES',
        vocationalSubject: 'IT and ITES'
      };

      expect(isSubjectOrStreamMatch(secondaryVocStudent, 'ITE', 'IT and ITES', '10th')).toBe(true);
      expect(isSubjectOrStreamMatch(secondaryVocStudent, 'HTC', 'Healthcare', '10th')).toBe(false);
      expect(isSubjectOrStreamMatch(secondaryVocStudent, 'PD', 'Physical Education', '10th')).toBe(false);
    });
  });

  describe('Catalog Fallback and 11th Botany Examination Roster Resolution', () => {
    test('mapCatalogStudentToRecord accurately converts verified catalog students and resolves Botany for 11th', () => {
      const catalogEntry = {
        name: 'Aaqib Ahmad',
        fatherName: 'Ghulam Mohammad',
        classRollNo: '101',
        className: '11th',
        session: '2025-26',
        stream: 'Science',
        subjects: [
          { code: 'GE', name: 'General English' },
          { code: 'PH', name: 'Physics' },
          { code: 'CH', name: 'Chemistry' },
          { code: 'BI', name: 'Biology' },
          { code: 'ES', name: 'Environmental Science' }
        ]
      };

      const candidate = mapCatalogStudentToRecord(catalogEntry, '11th');
      expect(candidate).toBeTruthy();
      expect(candidate.classRollNo).toBe('101');
      expect(candidate.studentName).toBe('Aaqib Ahmad');
      expect(candidate.Subjects4).toBe('Biology');
      expect(hasAssignedClassRoll(candidate)).toBe(true);
      expect(isSubjectOrStreamMatch(candidate, 'BO', 'Botany', '11th')).toBe(true);
      expect(isSubjectOrStreamMatch(candidate, 'ZO', 'Zoology', '11th')).toBe(true);
      expect(isSubjectOrStreamMatch(candidate, 'CH', 'Chemistry', '11th')).toBe(true);
      expect(isSubjectOrStreamMatch(candidate, 'MA', 'Mathematics', '11th')).toBe(false);
    });
  });
});

