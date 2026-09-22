import { 
  getEvaluationTypesForTeacher,
  getTeacherAssignedSubjectsForClass,
  getTeacherClassSubjectPermissions,
  normalizeTeacherClasses,
  isTeacherSubjectMatch,
  isEvaluationClassMatch
} from '../../utils/practicalsSettingsManager';

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
});
