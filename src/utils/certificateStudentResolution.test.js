jest.mock('../services/firebase', () => ({ db: {} }));

import {
  inferStreamFromFullSubjects,
  normalizeCertificateSession,
  resolveCertificateStream,
  resolveScopedCertificateResult
} from './certificateStudentResolution';

describe('certificate student resolution', () => {
  test('normalizes equivalent bi-annual session labels', () => {
    expect(normalizeCertificateSession('2026 APR/BIAN')).toBe(
      normalizeCertificateSession('Annual Private / Bi-Annual 2026')
    );
  });

  test('does not promote a pass from a different session', () => {
    const records = [
      { Session: '2025-26', Class: '12th', 'Result (Current)': 'Passed', 'Marks/Reapp (Current)': '380 / 500' },
      { Session: '2026 APR/BIAN', Class: '12th', 'Result (Current)': 'Re-appear', 'Marks/Reapp (Current)': 'PH CH' }
    ];
    const resolved = resolveScopedCertificateResult(records, '2026 APR/BIAN', '12th');
    expect(resolved.resultInfo.isReap).toBe(true);
    expect(resolved.resultInfo.isPassed).toBe(false);
    expect(resolved.resultInfo.reappSubjects).toBe('PH CH');
  });

  test('returns awaiting when only another class or session has a result', () => {
    const records = [
      { Session: '2025-26', Class: '12th', 'Result (Current)': 'Passed' },
      { Session: '2026 APR/BIAN', Class: '11th', 'Result (Current)': 'Passed' }
    ];
    const resolved = resolveScopedCertificateResult(records, '2026 APR/BIAN', '12th');
    expect(resolved.resultInfo.hasResult).toBe(false);
    expect(resolved.resultInfo.resultStatus).toBe('Awaiting Result');
  });

  test('infers streams from complete subjects, not re-appear subsets', () => {
    expect(inferStreamFromFullSubjects('GE PH CH BI ES')).toBe('Science');
    expect(inferStreamFromFullSubjects('GE PS HT ED UR')).toBe('Humanities');
    expect(inferStreamFromFullSubjects('GE AC BS EC')).toBe('Commerce');
  });

  test('uses past full subject history when the current stream is unavailable', () => {
    const current = { Session: '2026 APR/BIAN', Class: '12th', 'Marks/Reapp (Current)': 'PH' };
    const history = [{ Session: '2025-26', Class: '11th', 'Subjects Studied in Class 11th': 'GE, PH, CH, BI, ES' }];
    expect(resolveCertificateStream(current, history, '12th')).toBe('Science');
  });
});
