import {
  isMatchingSubjectCode,
  normalizeSubjectIdentity,
  isTeacherSubjectMatch
} from './practicalsSettingsManager';

describe('Subject Matching & Healthcare vs History Strict Isolation', () => {
  describe('isMatchingSubjectCode', () => {
    test('History (HT) strictly isolates from Healthcare', () => {
      // Healthcare identifiers must NEVER match History
      expect(isMatchingSubjectCode('HTC', 'HT')).toBe(false);
      expect(isMatchingSubjectCode('HC', 'HT')).toBe(false);
      expect(isMatchingSubjectCode('Healthcare', 'HT')).toBe(false);
      expect(isMatchingSubjectCode('Health Care', 'HT')).toBe(false);
      expect(isMatchingSubjectCode('11th_Healthcare_Internal Assessment', 'HT')).toBe(false);
      expect(isMatchingSubjectCode('12th_HTC_External', 'HT')).toBe(false);

      // Legitimate History identifiers must match
      expect(isMatchingSubjectCode('HT', 'HT')).toBe(true);
      expect(isMatchingSubjectCode('History', 'HT')).toBe(true);
      expect(isMatchingSubjectCode('HIST', 'HT')).toBe(true);
      expect(isMatchingSubjectCode('11th_History_Internal Assessment', 'HT')).toBe(true);
      expect(isMatchingSubjectCode('12th_HT_External', 'HT')).toBe(true);
    });

    test('Healthcare (HTC) strictly isolates from History', () => {
      // History identifiers must NEVER match Healthcare
      expect(isMatchingSubjectCode('HT', 'HTC')).toBe(false);
      expect(isMatchingSubjectCode('History', 'HTC')).toBe(false);
      expect(isMatchingSubjectCode('HIST', 'HTC')).toBe(false);
      expect(isMatchingSubjectCode('11th_History_Internal Assessment', 'HTC')).toBe(false);

      // Legitimate Healthcare identifiers must match
      expect(isMatchingSubjectCode('HTC', 'HTC')).toBe(true);
      expect(isMatchingSubjectCode('HC', 'HTC')).toBe(true);
      expect(isMatchingSubjectCode('Healthcare', 'HTC')).toBe(true);
      expect(isMatchingSubjectCode('Health Care', 'HTC')).toBe(true);
      expect(isMatchingSubjectCode('11th_Healthcare_Internal Assessment', 'HTC')).toBe(true);
    });

    test('Education (ED) strictly isolates from Physical Education (PD)', () => {
      expect(isMatchingSubjectCode('PD', 'ED')).toBe(false);
      expect(isMatchingSubjectCode('PED', 'ED')).toBe(false);
      expect(isMatchingSubjectCode('Physical Education', 'ED')).toBe(false);
      expect(isMatchingSubjectCode('11th_Physical Education_Internal Assessment', 'ED')).toBe(false);

      expect(isMatchingSubjectCode('ED', 'ED')).toBe(true);
      expect(isMatchingSubjectCode('Education', 'ED')).toBe(true);
      expect(isMatchingSubjectCode('11th_Education_Internal Assessment', 'ED')).toBe(true);
    });

    test('Biology (BI) matches Botany and Zoology', () => {
      expect(isMatchingSubjectCode('BI', 'BI')).toBe(true);
      expect(isMatchingSubjectCode('BO', 'BI')).toBe(true);
      expect(isMatchingSubjectCode('ZO', 'BI')).toBe(true);
      expect(isMatchingSubjectCode('Botany', 'BI')).toBe(true);
      expect(isMatchingSubjectCode('Zoology', 'BI')).toBe(true);
      expect(isMatchingSubjectCode('Physics', 'BI')).toBe(false);
    });

    test('IT and ITES (ITE) matches IT, ITES, IT & ITES, and doc IDs', () => {
      expect(isMatchingSubjectCode('ITE', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('IT', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('ITES', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('IT & ITES', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('IT and ITES', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('IT&ITES', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('Information Technology', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('12th_26_IT_internal', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('12th_26_ITE_internal', 'ITE')).toBe(true);
      expect(isMatchingSubjectCode('12th_IT & ITES_internal_2025-26', 'ITE')).toBe(true);

      // Must never match Computer Science or other subjects
      expect(isMatchingSubjectCode('CS', 'ITE')).toBe(false);
      expect(isMatchingSubjectCode('Computer Science', 'ITE')).toBe(false);
      expect(isMatchingSubjectCode('Physics', 'ITE')).toBe(false);
    });
  });

  describe('normalizeSubjectIdentity', () => {
    test('correctly identifies Healthcare variants', () => {
      expect(normalizeSubjectIdentity('HTC')?.code).toBe('HTC');
      expect(normalizeSubjectIdentity('Healthcare')?.code).toBe('HTC');
      expect(normalizeSubjectIdentity('Health Care')?.code).toBe('HTC');
      expect(normalizeSubjectIdentity('HC')?.code).toBe('HTC');
    });

    test('correctly identifies History variants', () => {
      expect(normalizeSubjectIdentity('HT')?.code).toBe('HT');
      expect(normalizeSubjectIdentity('History')?.code).toBe('HT');
    });

    test('correctly identifies IT and ITES variants', () => {
      expect(normalizeSubjectIdentity('ITE')?.code).toBe('ITE');
      expect(normalizeSubjectIdentity('IT')?.code).toBe('ITE');
      expect(normalizeSubjectIdentity('ITES')?.code).toBe('ITE');
      expect(normalizeSubjectIdentity('IT & ITES')?.code).toBe('ITE');
      expect(normalizeSubjectIdentity('IT and ITES')?.code).toBe('ITE');
      expect(normalizeSubjectIdentity('Information Technology')?.code).toBe('ITE');
    });
  });

  describe('isTeacherSubjectMatch', () => {
    test('Healthcare teacher never matches History and vice versa', () => {
      expect(isTeacherSubjectMatch('Healthcare', 'History')).toBe(false);
      expect(isTeacherSubjectMatch('History', 'Healthcare')).toBe(false);
      expect(isTeacherSubjectMatch('HTC', 'HT')).toBe(false);
      expect(isTeacherSubjectMatch('HT', 'HTC')).toBe(false);
      expect(isTeacherSubjectMatch('Healthcare', 'HTC')).toBe(true);
      expect(isTeacherSubjectMatch('History', 'HT')).toBe(true);
    });

    test('IT teacher correctly matches ITE and variants', () => {
      expect(isTeacherSubjectMatch('IT', 'ITE')).toBe(true);
      expect(isTeacherSubjectMatch('IT & ITES', 'ITE')).toBe(true);
      expect(isTeacherSubjectMatch('ITE', 'IT & ITES')).toBe(true);
      expect(isTeacherSubjectMatch('IT', 'Computer Science')).toBe(false);
    });
  });
});
