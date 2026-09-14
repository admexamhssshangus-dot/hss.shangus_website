import { getEvaluationTypesForTeacher } from '../../utils/practicalsSettingsManager';

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
});
