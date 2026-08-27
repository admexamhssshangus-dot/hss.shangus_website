export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

// Aadhaar uses the Verhoeff checksum. Keeping this check in the browser avoids
// a confusing final-submit rejection; the server repeats it authoritatively.
export function isValidAadhaar(value) {
  const number = digitsOnly(value);
  if (!/^[2-9]\d{11}$/.test(number)) return false;

  const multiplication = [
    [0,1,2,3,4,5,6,7,8,9], [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6], [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8], [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2], [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4], [9,8,7,6,5,4,3,2,1,0],
  ];
  const permutation = [
    [0,1,2,3,4,5,6,7,8,9], [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2], [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0], [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5], [7,0,4,6,9,1,3,2,5,8],
  ];

  let checksum = 0;
  [...number].reverse().forEach((digit, index) => {
    checksum = multiplication[checksum][permutation[index % 8][Number(digit)]];
  });
  return checksum === 0;
}

export function areAadhaarsDistinct(studentAadhaar, fatherAadhaar) {
  const s = digitsOnly(studentAadhaar);
  const f = digitsOnly(fatherAadhaar);
  if (s.length !== 12 || f.length !== 12) return true;
  return s !== f;
}

export function normalizeDobToIso(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value.toDate === 'function') {
    return normalizeDobToIso(value.toDate());
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return normalizeDobToIso(new Date(value.seconds * 1000));
  }

  const str = String(value).trim();
  if (!str) return '';

  // If already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // If ISO YYYY-M-D or YYYY-3_Mar-DD
  const isoMatch = str.match(/^(\d{4})[-/](?:\d{1,2}_)?([a-zA-Z0-9]+)[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, mStr, d] = isoMatch;
    const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const mNum = monthMap[mStr.toLowerCase()] || String(parseInt(mStr, 10) || '01').padStart(2, '0');
    return `${y}-${mNum.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // If DD-MM-YYYY or D-M-YYYY or DD-3_Mar-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](?:\d{1,2}_)?([a-zA-Z0-9]+)[-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, mStr, y] = dmyMatch;
    const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const mNum = monthMap[mStr.toLowerCase()] || String(parseInt(mStr, 10) || '01').padStart(2, '0');
    return `${y}-${mNum.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try standard Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

export function isStrictIsoDate(value) {
  const norm = normalizeDobToIso(value);
  const match = String(norm || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const MIN_ADMISSION_AGE = {
  '9th': 13,
  '10th': 14,
  '11th': 15,
  '12th': 16,
};

export function calculateAgeInYears(dobIso, targetDate = new Date()) {
  const norm = normalizeDobToIso(dobIso);
  if (!isStrictIsoDate(norm)) return null;
  const [y, m, d] = norm.split('-').map(Number);
  const target = new Date(targetDate);
  let yrs = target.getFullYear() - y;
  let mos = target.getMonth() - (m - 1);
  if (mos < 0 || (mos === 0 && target.getDate() < d)) {
    yrs--;
  }
  return yrs;
}

export function validateMinimumAge(dobIso, targetClass, targetDate = new Date()) {
  const norm = normalizeDobToIso(dobIso);
  if (!targetClass || !MIN_ADMISSION_AGE[targetClass]) return { valid: true };
  const minRequired = MIN_ADMISSION_AGE[targetClass];
  const age = calculateAgeInYears(norm, targetDate);
  if (age === null) return { valid: true };
  if (age < minRequired) {
    return {
      valid: false,
      age,
      minRequired,
      error: `Minimum age for Class ${targetClass} admission is ${minRequired} years (Applicant's age is ${age} yrs). Underage applicant.`
    };
  }
  return { valid: true, age, minRequired };
}

/**
 * Checks if a given field name represents an individual person's name
 * (e.g. Student's Name, Father's Name, Mother's Name, Guardian's Name, Candidate Name).
 */
export function isPersonNameField(name = '') {
  if (!name || typeof name !== 'string') return false;
  const clean = name.toLowerCase().trim();
  // Exclude non-person entities that have "name" in them
  if (
    clean.includes('school') ||
    clean.includes('bank') ||
    clean.includes('subject') ||
    clean.includes('board') ||
    clean.includes('complex') ||
    clean.includes('village') ||
    clean.includes('tehsil') ||
    clean.includes('district') ||
    clean.includes('occupation') ||
    clean.includes('mark') ||
    clean.includes('tongue') ||
    clean.includes('stream') ||
    clean.includes('fee') ||
    clean.includes('file') ||
    clean.includes('photo')
  ) {
    return false;
  }
  return (
    clean.includes("student's name") ||
    clean.includes("father's/guardian's name") ||
    clean.includes("father's name") ||
    clean.includes("mother's name") ||
    clean.includes("guardian's name") ||
    clean.includes("candidate's name") ||
    clean.includes("student name") ||
    clean.includes("father name") ||
    clean.includes("mother name") ||
    clean.includes("guardian name") ||
    clean.includes("candidate name") ||
    clean.includes("full name") ||
    clean === 'name' ||
    clean === 'studentname' ||
    clean === 'fathername' ||
    clean === 'mothername'
  );
}

/**
 * Sanitizes a person's name by stripping numbers, strange characters, and symbols.
 * Only allows English alphabets, spaces, dots (for abbreviations/initials), hyphens, and apostrophes.
 */
export function sanitizePersonName(value = '') {
  if (typeof value !== 'string') return '';
  // 1. Remove all characters except English letters, spaces, dots, hyphens, apostrophes
  let cleaned = value.replace(/[^a-zA-Z\s.'-]/g, '');
  // 2. Remove leading dots, hyphens, apostrophes, or spaces
  cleaned = cleaned.replace(/^[.'-\s]+/, '');
  // 3. Collapse multiple consecutive spaces into a single space
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  // 4. Collapse multiple consecutive dots into a single dot
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  return cleaned;
}

/**
 * Validates a person's name string.
 * Returns { valid: boolean, error?: string }
 */
export function validatePersonName(value = '', fieldLabel = 'Name') {
  const str = String(value || '').trim();
  if (!str) {
    return { valid: false, error: `${fieldLabel} is required` };
  }
  if (/\d/.test(str)) {
    return { valid: false, error: `Numbers are not allowed in ${fieldLabel.toLowerCase()}. Please use letters only.` };
  }
  if (!/^[a-zA-Z\s.'-]+$/.test(str)) {
    return { valid: false, error: `${fieldLabel} contains invalid characters. Only letters, spaces, and dots are permitted.` };
  }
  if (str.replace(/[^a-zA-Z]/g, '').length < 2) {
    return { valid: false, error: `${fieldLabel} must contain at least 2 alphabetic letters.` };
  }
  return { valid: true };
}
