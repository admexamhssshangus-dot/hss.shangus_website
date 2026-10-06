import {
  isStudentExamDropped,
  getStudentExamDropDetails,
  checkStudentApprovalState,
  isStudentApprovedForPracticals,
  getAssignedClassRollNumber
} from './studentApprovalStatus';
import verifiedCatalog from '../data/verifiedStudentsCatalog.json';

describe('studentApprovalStatus unit & cohort invariant tests', () => {
  describe('isStudentExamDropped', () => {
    test('identifies dropped students by flag and status strings', () => {
      expect(isStudentExamDropped({ isExamDropped: true })).toBe(true);
      expect(isStudentExamDropped({ status: 'dropped' })).toBe(true);
      expect(isStudentExamDropped({ examStatus: 'exam dropped' })).toBe(true);
      expect(isStudentExamDropped({ Status: 'Discharged' })).toBe(true);
      expect(isStudentExamDropped({ status: 'Active' })).toBe(false);
    });

    test('strictly identifies Class 11th official dropped students (Roll 72 Seher Un Nisa & Roll 186 Wanhar Ahmad Malik)', () => {
      // Roll 72 Seher Un Nisa
      expect(isStudentExamDropped({
        className: '11th',
        name: 'Seher Un Nisa',
        classRollNo: '72'
      })).toBe(true);

      // Roll 186 Wanhar Ahmad Malik
      expect(isStudentExamDropped({
        className: 'Class 11th',
        name: 'Wanhar Ahmad Malik',
        rollNo: '186'
      })).toBe(true);

      // Other 11th students should NOT be dropped
      expect(isStudentExamDropped({
        className: '11th',
        name: 'Normal Student',
        classRollNo: '73'
      })).toBe(false);

      // Roll 72 in Class 12th or 10th should NOT be dropped unless named
      expect(isStudentExamDropped({
        className: '12th',
        name: 'Another Student',
        classRollNo: '72'
      })).toBe(false);
    });
  });

  describe('getStudentExamDropDetails', () => {
    test('returns null for non-dropped students', () => {
      expect(getStudentExamDropDetails(null)).toBeNull();
      expect(getStudentExamDropDetails({ status: 'Approved', className: '10th', classRollNo: '12' })).toBeNull();
    });

    test('extracts comprehensive drop details and reasons for Class 10th and 11th dropped examinees', () => {
      const drop10 = getStudentExamDropDetails({
        className: '10th',
        name: 'Suhaib Yousuf',
        classRollNo: '46',
        formNo: '251297',
        boardRegNo: '2501000000610046'
      });
      expect(drop10).not.toBeNull();
      expect(drop10.isDropped).toBe(true);
      expect(drop10.classRollNo).toBe('46');
      expect(drop10.studentName).toBe('Suhaib Yousuf');
      expect(drop10.reason).toContain('Dropped from regular JKBOSE Class 10th Annual Regular Examination');

      const drop11 = getStudentExamDropDetails({
        className: '11th',
        name: 'Seher Un Nisa',
        classRollNo: '72',
        formNo: '250459'
      });
      expect(drop11).not.toBeNull();
      expect(drop11.isDropped).toBe(true);
      expect(drop11.reason).toContain('Dropped from regular JKBOSE Class 11th Examination');
    });
  });

  describe('checkStudentApprovalState', () => {
    test('never treats a generic official exam roll as a class roll', () => {
      expect(getAssignedClassRollNumber({ classRollNo: '27', rollNo: '301234567' })).toBe('27');
      expect(getAssignedClassRollNumber({ rollNo: '301234567' })).toBe('');
      expect(getAssignedClassRollNumber({ rollNo: '27' })).toBe('27');
    });

    test('enforces that Session 2025-26 examinees require an assigned Class Roll Number', () => {
      const studentWithRoll = {
        session: '2025-26',
        className: '11th',
        classRollNo: '15',
        name: 'Student A'
      };
      const res1 = checkStudentApprovalState(studentWithRoll);
      expect(res1.isApproved).toBe(true);
      expect(res1.isDropped).toBe(false);
      expect(res1.hasRoll).toBe(true);

      // Draft / pending admission without roll
      const draftStudent = {
        session: '2025-26',
        className: '11th',
        classRollNo: '',
        status: 'Submitted',
        name: 'Applicant B'
      };
      const res2 = checkStudentApprovalState(draftStudent);
      expect(res2.isApproved).toBe(false);
      expect(res2.isPending).toBe(true);
      expect(res2.hasRoll).toBe(false);
    });

    test('excludes dropped examinees from approved practicals list', () => {
      const dropped11thStudent = {
        session: '2025-26',
        className: '11th',
        classRollNo: '72',
        name: 'Seher Un Nisa'
      };
      const res = checkStudentApprovalState(dropped11thStudent);
      expect(res.isApproved).toBe(false);
      expect(res.isDropped).toBe(true);
      expect(isStudentApprovedForPracticals(dropped11thStudent)).toBe(false);
    });
  });

  describe('Verified Institutional Catalog Cohort Invariants (Session 2025-26)', () => {
    test('Class 10th has exactly 60 enrolled students with valid assigned rolls, exactly 1 dropped (Suhaib Yousuf), leaving 59 active examinees', () => {
      const class10Enrolled = verifiedCatalog.filter(st => {
        const cls = String(st.className || st.class || '').toLowerCase();
        return cls.includes('10') && Boolean(getAssignedClassRollNumber(st));
      });
      expect(class10Enrolled.length).toBe(60);

      const dropped10 = class10Enrolled.filter(st => isStudentExamDropped(st));
      expect(dropped10.length).toBe(1);
      expect(getAssignedClassRollNumber(dropped10[0])).toBe('46');
      expect(dropped10[0].name).toBe('Suhaib Yousuf');

      const approved10 = class10Enrolled.filter(st => checkStudentApprovalState(st).isApproved);
      expect(approved10.length).toBe(59);

      const rolls = class10Enrolled.map(st => parseInt(getAssignedClassRollNumber(st), 10)).filter(Boolean);
      expect(rolls.length).toBe(60);
      expect(Math.min(...rolls)).toBe(1);
      expect(Math.max(...rolls)).toBe(60);
    });

    test('Class 11th has exactly 198 enrolled students with rolls, exactly 2 dropped, leaving 196 active examinees', () => {
      const class11Enrolled = verifiedCatalog.filter(st => {
        const cls = String(st.className || st.class || '').toLowerCase();
        return cls.includes('11') && Boolean(getAssignedClassRollNumber(st));
      });
      expect(class11Enrolled.length).toBe(198);

      const dropped11 = class11Enrolled.filter(st => isStudentExamDropped(st));
      expect(dropped11.length).toBe(2);

      const droppedRolls = dropped11.map(st => getAssignedClassRollNumber(st)).sort();
      expect(droppedRolls).toEqual(['186', '72']);

      const approved11 = class11Enrolled.filter(st => checkStudentApprovalState(st).isApproved);
      expect(approved11.length).toBe(196);
    });

    test('Class 12th has exactly 203 enrolled students with rolls 1 to 203, all approved', () => {
      const class12Enrolled = verifiedCatalog.filter(st => {
        const cls = String(st.className || st.class || '').toLowerCase();
        return cls.includes('12') && Boolean(getAssignedClassRollNumber(st));
      });
      expect(class12Enrolled.length).toBe(203);

      const approved12 = class12Enrolled.filter(st => checkStudentApprovalState(st).isApproved);
      expect(approved12.length).toBe(203);

      const rolls = class12Enrolled.map(st => parseInt(getAssignedClassRollNumber(st), 10)).filter(Boolean);
      expect(rolls.length).toBe(203);
      expect(Math.min(...rolls)).toBe(1);
      expect(Math.max(...rolls)).toBe(203);

      // Verify no duplicate rolls in Class 12th
      const uniqueRolls = new Set(rolls);
      expect(uniqueRolls.size).toBe(203);
    });
  });
});
