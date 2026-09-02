const SUPPORTED_FUND_CLASSES = new Set(['9th', '10th', '11th', '12th']);

function toWholeNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export function validateFundDistributionEntry({
  className,
  paidStudents,
  scienceStudents,
  academicSession,
  date,
  remainingTotal,
  remainingScience,
  enforceRemaining = true,
}) {
  const paid = toWholeNumber(paidStudents);
  const science = toWholeNumber(scienceStudents) ?? 0;
  const errors = [];

  if (!SUPPORTED_FUND_CLASSES.has(className)) errors.push('Select a supported class.');
  if (!/^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(String(date || ''))) errors.push('Enter a valid statement date.');
  if (!/^\d{4}\s*[-/]\s*\d{2,4}$/.test(String(academicSession || '').trim())) errors.push('Use an academic session such as 2026-27.');
  if (paid === null || paid <= 0) errors.push('Paid students must be a positive whole number.');
  if (science < 0) errors.push('Science students cannot be negative.');
  if (paid !== null && science > paid) errors.push('Science students cannot exceed paid students.');
  if ((className === '9th' || className === '10th') && paid !== null && science !== paid) {
    errors.push(`For Class ${className}, the science-fund count must equal the paid-student count.`);
  }

  if (enforceRemaining && paid !== null && Number(remainingTotal) >= 0 && paid > Number(remainingTotal)) {
    errors.push(`Paid students exceed the ${remainingTotal} students remaining for reconciliation.`);
  }
  if (
    enforceRemaining &&
    science > 0 &&
    Number(remainingScience) >= 0 &&
    science > Number(remainingScience)
  ) {
    errors.push(`Science students exceed the ${remainingScience} science students remaining for reconciliation.`);
  }

  return { isValid: errors.length === 0, errors, paid, science };
}

export function validateFundAccountsConfig(accounts, rates) {
  const errors = [];
  const list = Array.isArray(accounts) ? accounts : [];
  if (list.length === 0) errors.push('At least one subsidiary account is required.');

  const keys = new Set();
  const names = new Set();
  list.forEach((account, index) => {
    const key = String(account?.key || '').trim().toLowerCase();
    const name = String(account?.name || '').trim().toLowerCase();
    if (!key || !name) errors.push(`Account ${index + 1} needs both a key and a name.`);
    if (key && keys.has(key)) errors.push(`Duplicate account key: ${account.key}.`);
    if (name && names.has(name)) errors.push(`Duplicate account name: ${account.name}.`);
    keys.add(key);
    names.add(name);
  });

  SUPPORTED_FUND_CLASSES.forEach(className => {
    const classRates = rates?.[className] || {};
    list.forEach(account => {
      const value = Number(classRates[account.key]);
      if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        errors.push(`Class ${className} rate for ${account.name || account.key} must be a non-negative whole number.`);
      }
    });
  });

  return { isValid: errors.length === 0, errors };
}
