import {
  validateFundAccountsConfig,
  validateFundDistributionEntry,
} from './fundDistributionValidation';

describe('fund distribution validation', () => {
  const validEntry = {
    className: '11th',
    paidStudents: '12',
    scienceStudents: '5',
    academicSession: '2026-27',
    date: '2026-09-02',
    remainingTotal: 12,
    remainingScience: 5,
  };

  test('accepts a reconciled entry', () => {
    expect(validateFundDistributionEntry(validEntry)).toMatchObject({ isValid: true, paid: 12, science: 5 });
  });

  test('blocks over-distribution and invalid science counts', () => {
    const result = validateFundDistributionEntry({ ...validEntry, paidStudents: 13, scienceStudents: 14 });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/exceed/);
  });

  test('keeps science fund universal for classes 9 and 10', () => {
    const result = validateFundDistributionEntry({ ...validEntry, className: '9th', scienceStudents: '4' });
    expect(result.errors.join(' ')).toMatch(/must equal/);
  });

  test('rejects duplicate account names and invalid rates', () => {
    const accounts = [
      { key: 'a', name: 'Account A' },
      { key: 'b', name: 'Account A' },
    ];
    const rates = Object.fromEntries(['9th', '10th', '11th', '12th'].map(cls => [cls, { a: 10, b: -1 }]));
    const result = validateFundAccountsConfig(accounts, rates);
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Duplicate account name/);
    expect(result.errors.join(' ')).toMatch(/non-negative/);
  });
});
