import {
  normalizeRegistrationKey,
  areNamesCompatible,
  resolveCcDcVal,
  extractReappearCodes,
  formatResultMarksString,
  getClassTier,
  areClassTiersCompatible,
  isSecondaryOnlySubjectList,
  resolveCertificateStream
} from './certificateStudentResolution';
import { formatStudentSubjects } from '../portal/admin/AdvancedReports';

jest.mock('../services/firebase', () => ({ db: {} }));
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('./pdfGenerator', () => ({}));
jest.mock('../portal/admin/ApplicationReviewModal', () => () => null);

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

  describe('formatResultMarksString', () => {
    test('formats pure numeric marks with default / 500 denominator', () => {
      expect(formatResultMarksString('440')).toBe('440 / 500');
      expect(formatResultMarksString(385)).toBe('385 / 500');
    });

    test('normalizes slash spacing for marks already containing denominator', () => {
      expect(formatResultMarksString('440/500')).toBe('440 / 500');
      expect(formatResultMarksString('440 / 500')).toBe('440 / 500');
    });

    test('de-duplicates repeated paste entries with extra remarks', () => {
      expect(formatResultMarksString('492492 / 500; MH 81')).toBe('492 / 500; MH 81');
      expect(formatResultMarksString('440440 / 500')).toBe('440 / 500');
    });

    test('preserves reappear codes and custom marks strings', () => {
      expect(formatResultMarksString('CH')).toBe('CH');
      expect(formatResultMarksString('GE, ED')).toBe('GE, ED');
    });

    test('returns empty string for missing or placeholder inputs', () => {
      expect(formatResultMarksString('')).toBe('');
      expect(formatResultMarksString(null)).toBe('');
      expect(formatResultMarksString(undefined)).toBe('');
      expect(formatResultMarksString('—')).toBe('');
      expect(formatResultMarksString('-')).toBe('');
    });
  });

  describe('Academic Tier Resolution & Compatibility', () => {
    test('getClassTier identifies secondary (9th/10th) vs higher secondary (11th/12th)', () => {
      expect(getClassTier('9th')).toBe('secondary');
      expect(getClassTier('10th')).toBe('secondary');
      expect(getClassTier('9')).toBe('secondary');
      expect(getClassTier('10')).toBe('secondary');
      expect(getClassTier('Class 10th')).toBe('secondary');
      expect(getClassTier('11th')).toBe('higher');
      expect(getClassTier('12th')).toBe('higher');
      expect(getClassTier('11')).toBe('higher');
      expect(getClassTier('12')).toBe('higher');
      expect(getClassTier('Class 11th')).toBe('higher');
    });

    test('areClassTiersCompatible permits intra-tier and blocks cross-tier sharing', () => {
      // 9th and 10th share the same general curriculum
      expect(areClassTiersCompatible('9th', '10th')).toBe(true);
      expect(areClassTiersCompatible('10th', '9th')).toBe(true);
      expect(areClassTiersCompatible('10th', '10th')).toBe(true);

      // 11th and 12th share the same stream curriculum
      expect(areClassTiersCompatible('11th', '12th')).toBe(true);
      expect(areClassTiersCompatible('12th', '11th')).toBe(true);
      expect(areClassTiersCompatible('11th', '11th')).toBe(true);

      // Cross-tier is strictly prohibited
      expect(areClassTiersCompatible('10th', '11th')).toBe(false);
      expect(areClassTiersCompatible('10th', '12th')).toBe(false);
      expect(areClassTiersCompatible('9th', '11th')).toBe(false);
      expect(areClassTiersCompatible('9th', '12th')).toBe(false);
    });

    test('isSecondaryOnlySubjectList identifies secondary-only subjects (SST, SCI)', () => {
      expect(isSecondaryOnlySubjectList('(GE), SST, SCI, MA, UR, ITE (H)')).toBe(true);
      expect(isSecondaryOnlySubjectList('English, Social Studies, Science, Mathematics, Urdu')).toBe(true);
      expect(isSecondaryOnlySubjectList('SST, SCI, MA')).toBe(true);
      expect(isSecondaryOnlySubjectList('Social Science, Mathematics')).toBe(true);

      // Higher secondary subjects are NOT secondary-only
      expect(isSecondaryOnlySubjectList('General English, Physics, Chemistry, Biology, Environmental Science')).toBe(false);
      expect(isSecondaryOnlySubjectList('GE, PH, CH, BI, ES')).toBe(false);
      expect(isSecondaryOnlySubjectList('General English, Education, History, Political Science, Environmental Science')).toBe(false);
      expect(isSecondaryOnlySubjectList('GE, ED, HT, PS, ES')).toBe(false);
      expect(isSecondaryOnlySubjectList('Computer Science, Mathematics, Physics')).toBe(false);
      expect(isSecondaryOnlySubjectList('Environmental Science, Urdu, History')).toBe(false);
    });

    test('formatStudentSubjects strictly isolates 10th subjects from 11th/12th students', () => {
      // An 11th grade student record that accidentally has 10th fields (e.g. from previous qualification)
      const student11th = {
        class: '11th',
        'Subjects Studied in Class 10th': 'English, Social Studies, Science, Mathematics, Urdu',
        'Subjects to be taken in Class 10th': 'English, Science, SST, Math, Urdu',
        'Marks Obt. (Prev.)': '350 / 500'
      };
      // Must NOT return 10th subjects for an 11th student!
      expect(formatStudentSubjects(student11th, '11th')).toBe('—');

      // If the 11th record has authentic 11th subjects:
      student11th['Subjects to be taken in Class 11th'] = 'General English, Education, History, Political Science, Environmental Science';
      expect(formatStudentSubjects(student11th, '11th')).toContain('General English');
      expect(formatStudentSubjects(student11th, '11th')).toContain('History');
      expect(formatStudentSubjects(student11th, '11th')).not.toContain('Social Studies');

      // A 10th grade student record must NOT pick up 11th subjects:
      const student10th = {
        class: '10th',
        'Subjects to be taken in Class 11th': 'Physics, Chemistry, Biology',
        'Subjects to be taken in Class 10th': 'English, Mathematics, Science, Social Studies, Urdu'
      };
      expect(formatStudentSubjects(student10th, '10th')).toContain('Social Studies');
      expect(formatStudentSubjects(student10th, '10th')).not.toContain('Physics');
    });

    test('resolveCertificateStream never uses 10th records to infer 11th/12th stream', () => {
      const student11th = { class: '11th', regNo: '210100000610015' };
      const historyWith10th = [
        {
          class: '10th',
          subs: 'English, Social Studies, Science, Mathematics, Urdu',
          Stream: 'General'
        }
      ];
      // Must not infer General stream for 11th from 10th record!
      const stream = resolveCertificateStream(student11th, historyWith10th, '11th');
      expect(stream).not.toBe('General');
      expect(stream).toBe('Humanities');
    });
  });
});
