import {
  normalizeRegistrationKey,
  areNamesCompatible,
  resolveCcDcVal,
  extractReappearCodes
} from './certificateStudentResolution';

jest.mock('../services/firebase', () => ({ db: {} }));

describe('Student Resolution & Reports Validation', () => {
  describe('normalizeRegistrationKey', () => {
    test('returns clean lowercase registration number for valid values', () => {
      expect(normalizeRegistrationKey('2161230000000001')).toBe('2161230000000001');
      expect(normalizeRegistrationKey('20-ANG-12345')).toBe('20ang12345');
      expect(normalizeRegistrationKey('N2024-1234567')).toBe('n20241234567');
    });

    test('rejects placeholder or invalid registration values', () => {
      expect(normalizeRegistrationKey('0')).toBe('');
      expect(normalizeRegistrationKey('N/A')).toBe('');
      expect(normalizeRegistrationKey('na')).toBe('');
      expect(normalizeRegistrationKey('nil')).toBe('');
      expect(normalizeRegistrationKey('—')).toBe('');
      expect(normalizeRegistrationKey('-')).toBe('');
      expect(normalizeRegistrationKey('')).toBe('');
      expect(normalizeRegistrationKey(null)).toBe('');
      expect(normalizeRegistrationKey(undefined)).toBe('');
    });

    test('rejects dummy zero-padded registration numbers', () => {
      // Numbers with 5+ trailing zeros or 75%+ zeros
      expect(normalizeRegistrationKey('2301000000000000')).toBe('');
      expect(normalizeRegistrationKey('000000000000')).toBe('');
    });
  });

  describe('areNamesCompatible', () => {
    test('matches identical or subset student names', () => {
      expect(areNamesCompatible('Mohammad Iqbal', 'Mohammad Iqbal')).toBe(true);
      expect(areNamesCompatible('Mohd Iqbal', 'Mohd Iqbal Shah')).toBe(true);
      expect(areNamesCompatible('Sahil Ahmad Bhat', 'Sahil Ahmad')).toBe(true);
    });

    test('rejects completely different student names', () => {
      expect(areNamesCompatible('Mohammad Iqbal', 'Sahil Ahmad')).toBe(false);
      expect(areNamesCompatible('Irfan Yousuf', 'Farooq Ahmad')).toBe(false);
    });

    test('permits placeholder names gracefully', () => {
      expect(areNamesCompatible('Student', 'Mohammad Iqbal')).toBe(true);
      expect(areNamesCompatible('—', 'Sahil Ahmad')).toBe(true);
    });
  });

  describe('resolveCcDcVal', () => {
    test('resolves primary No. & Date of CC/DC Issued (This Institution)', () => {
      const rec = { 'No. & Date of CC/DC Issued (This Institution)': '1350 (12/04/2024)' };
      expect(resolveCcDcVal(rec)).toBe('1350 (12/04/2024)');
    });

    test('resolves alias keys like No. & Date of CC/DC Issued or CC/DC No. & Date', () => {
      expect(resolveCcDcVal({ 'No. & Date of CC/DC Issued': '1351 (15/05/2024)' })).toBe('1351 (15/05/2024)');
      expect(resolveCcDcVal({ 'CC/DC No. & Date': '1352' })).toBe('1352');
    });

    test('formats bare certificate serial with available discharge or withdrawal date', () => {
      const rec = { ccDcNo: '1365', dischargeIssueDate: '2024-06-18' };
      expect(resolveCcDcVal(rec)).toBe('1365 (2024-06-18)');
    });

    test('returns — when no certificate was issued', () => {
      expect(resolveCcDcVal({})).toBe('—');
      expect(resolveCcDcVal({ ccDcNo: '—' })).toBe('—');
      expect(resolveCcDcVal({ currCcDc: 'N/A' })).toBe('—');
      expect(resolveCcDcVal(null)).toBe('—');
    });
  });

  describe('extractReappearCodes', () => {
    test('returns empty set if candidate is passed / qualified', () => {
      const passedSt = {
        currResult: 'Passed',
        currMarksReapp: '380 / 500',
        subs: 'English, Physics, Chemistry, Biology, Environmental Science'
      };
      const codes = extractReappearCodes(passedSt);
      expect(codes.size).toBe(0);
    });

    test('extracts single reappear subject code properly', () => {
      const reapSt = {
        currResult: 'Reappear',
        currMarksReapp: 'CH',
        subs: 'English, Physics, Chemistry, Biology, Environmental Science'
      };
      const codes = extractReappearCodes(reapSt);
      expect(codes.has('CH')).toBe(true);
      expect(codes.size).toBe(1);
    });

    test('extracts multiple reappear subject codes properly', () => {
      const reapSt = {
        currResult: 'Re-appear',
        currMarksReapp: 'GE, ED, HT, ES',
        subs: 'General English, Education, History, Environmental Science, Urdu'
      };
      const codes = extractReappearCodes(reapSt);
      expect(codes.has('GE')).toBe(true);
      expect(codes.has('ED')).toBe(true);
      expect(codes.has('HT')).toBe(true);
      expect(codes.has('ES')).toBe(true);
      expect(codes.has('UR')).toBe(false);
    });

    test('normalizes GN to GE and UD to UR', () => {
      const reapSt = {
        currResult: 'Reap',
        currMarksReapp: 'GN UD',
        subs: 'General English, Urdu, History, Education, Sociology'
      };
      const codes = extractReappearCodes(reapSt);
      expect(codes.has('GE')).toBe(true);
      expect(codes.has('UR')).toBe(true);
    });
  });
});
