import { getStudentStream } from './studentDataFetcher';

describe('getStudentStream', () => {
  test('Class 10th is always General, even if Urdu or subjects are present', () => {
    const student10th = {
      rollNo: '101',
      name: 'Class 10 Student',
      Class: '10th',
      subjects: ['General English', 'Mathematics', 'Science', 'Social Science', 'Urdu']
    };
    expect(getStudentStream(student10th)).toBe('General');
  });

  test('Class 10th with admission sought key is General', () => {
    const student10th = {
      rollNo: '102',
      name: 'Class 10 Student 2',
      'Admission sought for class': '10th',
      subjects: ['General English', 'Science', 'Urdu']
    };
    expect(getStudentStream(student10th)).toBe('General');
  });

  test('Class 9th is always General', () => {
    const student9th = {
      rollNo: '901',
      Class: '9th',
      subjects: ['Urdu', 'English']
    };
    expect(getStudentStream(student9th)).toBe('General');
  });

  test('Class 12th Arts/Humanities is Humanities', () => {
    const student12thArts = {
      rollNo: '1201',
      Class: '12th',
      subjects: ['General English', 'Political Science', 'History', 'Urdu']
    };
    expect(getStudentStream(student12thArts)).toBe('Humanities');
  });

  test('Class 12th Science is Science', () => {
    const student12thSci = {
      rollNo: '1202',
      Class: '12th',
      subjects: ['General English', 'Physics', 'Chemistry', 'Biology']
    };
    expect(getStudentStream(student12thSci)).toBe('Science');
  });
});
