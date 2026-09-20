// =================================================================
// HSS SHANGUS — Google Contacts Bulk CSV Exporter Utility
// =================================================================
// Ports the authentic legacy portal logic from login/form,prac,attend/code.gs.txt
// Generates standard 38-column Google Contacts CSV with customized display names:
// Format: "[RollNo. ]StudentName[-FatherName],student (Class_Session)GenderCode[,Stream_AbbrSubjects]"
// Example: "12. Aamir Ahmad-Mohd Yousuf,student (12th_2025-26)M,Science_PH,CH,BI"
// =================================================================

export const SUBJECT_ABBREVIATIONS = Object.freeze({
  // Academic Subjects
  'General English': 'GE',
  'English Literature': 'EL',
  'Functional English': 'FE',
  'English': 'GE',
  'GN': 'GE',
  'EN': 'GE',
  'Hindi': 'HI',
  'Dogri': 'DG',
  'Sanskrit': 'SA',
  'Punjabi': 'PU',
  'Bhoti': 'BO',
  'Arabic': 'AR',
  'Persian': 'PE',
  'Kashmiri': 'KA',
  'Urdu': 'UR',
  'UD': 'UR',
  'History': 'HT',
  'Economics': 'EC',
  'Geography': 'GG',
  'Philosophy': 'PL',
  'Education': 'ED',
  'Psychology': 'PY',
  'Sociology': 'SO',
  'Political Science': 'PS',
  'Home Science': 'HS',
  'Home Science (Elective)': 'HS',
  'Statistics': 'SS',
  'Mathematics': 'MA',
  'Maths': 'MA',
  'Islamic Studies': 'IS',
  'Vedic Studies': 'VS',
  'Computer Science': 'CS',
  'Information Practices': 'IP',
  'Environmental Science': 'ES',
  'Physics': 'PH',
  'Chemistry': 'CH',
  'Biology': 'BI',
  'Botany': 'BI',
  'Zoology': 'BI',
  'Electronics': 'ET',
  'Biotechnology': 'BT',
  'Bio-chemistry': 'BC',
  'Music': 'MU',
  'Family Health Care & Prevention': 'FH',
  'Food Science': 'FS',
  'Management of Resources': 'MR',
  'Business Studies': 'BS',
  'Travel, Tourism & Hotel Management': 'TT',
  'Accountancy': 'AY',
  'Entrepreneurship': 'EP',
  'Public Administration': 'PA',
  'Typewriting and Shorthand': 'TS',
  'Business Mathematics': 'BM',
  'Geology': 'GO',
  'Buddhist Studies': 'BU',
  'Physical Education': 'PD',
  'Clothing for the Family': 'CT',
  'Applied Mathematics': 'AM',
  'Microbiology': 'MB',
  'Extension Education': 'EE',
  'Human Development': 'HD',

  // Vocational Subjects
  'IT and ITeS': 'ITE',
  'IT and ITES': 'ITE',
  'Retail': 'RET',
  'Healthcare': 'HTC',
  'Tourism': 'TOU',
  'Security': 'SEC',
  'Agriculture': 'AGR',
  'Telecommunication': 'TLC',
  'Media and Entertainment': 'MDE',
  'Beauty and Wellness': 'BTW',
  'Physical Education & Sports': 'PES'
});

/**
 * Clean phone numbers to standard numeric strings
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  // If multiple numbers separated by slash, comma, or semicolon, evaluate first valid one
  const tokens = String(phone).split(/[/,;\n]+/);
  for (const token of tokens) {
    let digits = token.replace(/[^\d]/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
  }
  const fallback = String(phone).replace(/[^\d]/g, '');
  return fallback.length >= 10 ? fallback.slice(-10) : fallback;
}

/**
 * Abbreviate a comma/plus separated subject string using official board abbreviations
 * Handles both strings and arrays of subjects
 */
export function abbreviateSubjects(subjInput) {
  if (!subjInput) return '';
  const rawParts = Array.isArray(subjInput)
    ? subjInput.flatMap(item => String(item).split(/[,+/]/))
    : String(subjInput).split(/[,+/]/);

  return rawParts
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      return SUBJECT_ABBREVIATIONS[trimmed] || trimmed;
    })
    .filter(Boolean)
    .join(',');
}

/**
 * Helper to parse comma/space/newline separated form numbers and ranges (e.g. 101-125, 250001..250020)
 */
export function parseFormNumberRange(inputStr) {
  if (!inputStr || !inputStr.trim()) return null;
  const rawTokens = inputStr.split(/[\s,;\n\t]+/).map(t => t.trim()).filter(Boolean);
  const formSet = new Set();

  rawTokens.forEach(token => {
    const rangeMatch = token.match(/^(?:#?(\d+))\s*(?:-|–|—|\.\.|to)\s*(?:#?(\d+))$/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        const cappedMax = Math.min(max, min + 5000);
        for (let i = min; i <= cappedMax; i++) {
          formSet.add(String(i).toLowerCase());
        }
      }
    } else {
      const clean = token.replace(/^#/, '').trim().toLowerCase();
      if (clean) {
        formSet.add(clean);
        const numOnly = clean.replace(/[^0-9]/g, '');
        if (numOnly) formSet.add(numOnly);
      }
    }
  });

  return formSet.size > 0 ? formSet : null;
}

/**
 * Extract roll number value cleanly
 */
export function extractRollVal(student) {
  if (!student) return '';
  const keys = [
    'classRollNo', 'Class Roll No', 'Class Roll No.', 'RL. NO.', 'RL. NO',
    'Class R.No.', 'Class R.No', 'rollNo', 'Roll No.', 'Roll No', 'roll'
  ];
  for (const k of keys) {
    if (student[k] !== undefined && student[k] !== null) {
      const val = String(student[k]).trim();
      if (val && !/^(N\/A|—|-|null|undefined)$/i.test(val)) {
        return val;
      }
    }
  }
  return '';
}

/**
 * Extract registration number value
 */
export function extractRegVal(student) {
  if (!student) return '';
  const keys = [
    'boardRegNo', 'regNo', 'Reg No', 'Reg. No.', 'Board Registration No.',
    'Board Registration No. (Class 10th)', 'Board Registration No. (Class 11th)',
    'DIET Registration No.'
  ];
  for (const k of keys) {
    if (student[k] !== undefined && student[k] !== null) {
      const val = String(student[k]).trim();
      if (val && !/^(N\/A|—|-|null|undefined)$/i.test(val)) {
        return val;
      }
    }
  }
  return '';
}

/**
 * Extract class name cleanly
 */
export function extractClassVal(student) {
  if (!student) return '';
  const val = student.class || student['Class to which admission is sought'] || student['Admission sought for class'] || '';
  return String(val).trim();
}

/**
 * Extract session value cleanly
 */
export function extractSessionVal(student, fallbackSession = '2025-26') {
  if (!student) return fallbackSession;
  const val = student.session || student['Session'] || fallbackSession;
  return String(val).trim() || fallbackSession;
}

/**
 * Resolve student stream and subjects faithfully matching legacy portal code.gs.txt logic:
 * - 9th & 10th classes are always 'General'
 * - 11th & 12th auto-detect Science (if Physics & Chemistry both present) or Humanities if stream field is blank
 * - Handles split ' - ' strings for 12th subjects
 */
export function resolveStreamAndSubjects(student) {
  if (!student) return { stream: '', subjects: '' };

  const studentClass = extractClassVal(student);
  let stream = String(
    student.stream || 
    student['Stream'] || 
    student['Stream for Class 11th'] || 
    student['Stream opted in Class 11th'] || 
    student['Stream/Faculty'] || 
    ''
  ).trim();

  const rawSubs = student.subs || 
    student.subjects || 
    student.selectedSubjects ||
    student['Subjects to be taken in Class 11th'] || 
    student['Subjects Studied in Class 11th'] || 
    student['Stream & Subjects for Class 12th'] || 
    student['Stream & Subjects'] || 
    student['Subjects to be taken in Class 10th'] || 
    student['Subjects to be taken in Class 9th'] || 
    student['Subjects'] || 
    '';
  let subjects = (Array.isArray(rawSubs) ? rawSubs.join(', ') : String(rawSubs || '')).trim();

  // Class 9th and 10th are always 'General' stream
  if (studentClass.includes('9') || studentClass.includes('10')) {
    stream = stream || 'General';
  } else if (studentClass.includes('11') || studentClass.includes('12')) {
    // If stream is empty or placeholder, auto-detect from subjects (Legacy code.gs.txt lines 592-623)
    if (!stream || stream === '—' || stream === '-' || stream.toLowerCase() === 'same as' || stream.toLowerCase().includes('11th')) {
      const subUpper = subjects.toUpperCase();
      const hasPhysics = subUpper.includes('PHYSICS') || subUpper.includes(' PH ') || subUpper.includes('(PH)') || subUpper.includes(',PH');
      const hasChem = subUpper.includes('CHEMISTRY') || subUpper.includes(' CH ') || subUpper.includes('(CH)') || subUpper.includes(',CH');
      if (hasPhysics && hasChem) {
        stream = 'Science';
      } else if (subjects) {
        stream = 'Humanities';
      }
    }
  }

  // If 12th stream & subjects contains " - " (e.g. "Science - Physics, Chemistry...")
  if (subjects && subjects.includes(' - ') && (!stream || stream === '—' || stream === '-')) {
    const parts = subjects.split(' - ');
    stream = parts[0].trim();
    subjects = parts.slice(1).join(' - ').trim();
  }

  return { stream, subjects };
}

/**
 * Build the exact standardized Google Contact Display Name
 * Format: "[RollNo. ]StudentName[-FatherName],student (Class_Session)GenderCode[,Stream_AbbrSubjects]"
 */
export function buildGoogleContactDisplayName(student, defaultSession = '2025-26') {
  if (!student) return '';

  const contactName = String(student.studentName || student["Student's Name (as per school records)"] || student.name || '').trim();
  const fatherName = String(student.fatherName || student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || '').trim();
  const rollNo = extractRollVal(student);
  const studentClass = extractClassVal(student);
  const session = extractSessionVal(student, defaultSession);
  const gender = String(student.gender || student['Gender'] || '').trim();
  
  const { stream, subjects } = resolveStreamAndSubjects(student);

  // Name Part: roll no. name-father
  let namePart = rollNo ? `${rollNo}. ${contactName}` : contactName;
  if (fatherName) {
    namePart += `-${fatherName}`;
  }

  // Suffix: ,student (Class_Session)GenderCode
  let suffix = `,student (${studentClass || 'Student'}_${session})`;
  if (gender) {
    const g = gender.toLowerCase();
    if (g.startsWith('f')) {
      suffix += 'F';
    } else if (g.startsWith('m')) {
      suffix += 'M';
    }
  }

  // Details: ,Stream_AbbrSubjects
  let details = '';
  if (stream) {
    details += `,${stream}`;
    if (subjects) {
      const abbr = abbreviateSubjects(subjects);
      if (abbr) details += `_${abbr}`;
    }
  } else if (subjects) {
    const abbr = abbreviateSubjects(subjects);
    if (abbr) details += `,${abbr}`;
  }

  return `${namePart}${suffix}${details}`;
}

/**
 * Build multi-line student notes for Google Contacts profile
 */
export function buildGoogleContactNotes(student) {
  if (!student) return '';

  const formNum = student.formNo || student['Form Number'] || '';
  const regNo = extractRegVal(student);
  const studentClass = extractClassVal(student);
  const rollNo = extractRollVal(student);
  const fatherName = student.fatherName || student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || '';
  const motherName = student.motherName || student["Mother's Name (as per school records)"] || student["Mother's Name"] || '';
  const { stream, subjects } = resolveStreamAndSubjects(student);
  const dob = student.dob || student['DoB (as per school records)'] || '';
  const village = student.village || student['Name of your village'] || '';

  const lines = [
    'HSS Shangus Student',
    `Form Number: ${formNum || 'N/A'}`
  ];

  if (regNo) lines.push(`Reg No: ${regNo}`);
  if (studentClass) lines.push(`Class: ${studentClass}`);
  if (rollNo) lines.push(`Roll No: ${rollNo}`);
  if (fatherName) lines.push(`Father: ${fatherName}`);
  if (motherName) lines.push(`Mother: ${motherName}`);
  if (stream) lines.push(`Stream: ${stream}`);
  if (subjects) lines.push(`Subjects: ${subjects}`);
  if (dob) lines.push(`DOB: ${dob}`);
  if (village) lines.push(`Village: ${village}`);

  lines.push(`Added on: ${new Date().toLocaleDateString()}`);
  lines.push('Added via: HSS Shangus Contact Exporter');

  return lines.join('\n');
}

/**
 * Generate Google Contacts standard CSV string from student records
 */
export function generateGoogleContactsCsv(students = [], options = {}) {
  const {
    session = '2025-26',
    groupName = '* My Contacts'
  } = options;

  // Google Contacts Standard 38 Headers
  const headers = [
    'Name', 'Given Name', 'Additional Name', 'Family Name',
    'Yomi Name', 'Given Name Yomi', 'Additional Name Yomi', 'Family Name Yomi',
    'Name Prefix', 'Name Suffix', 'Initials', 'Nickname', 'Short Name', 'Maiden Name',
    'Birthday', 'Gender', 'Location', 'Billing Information', 'Directory Server', 'Mileage',
    'Occupation', 'Hobby', 'Sensitivity', 'Priority', 'Subject',
    'Notes', 'Language', 'Photo', 'Group Membership',
    'Phone 1 - Type', 'Phone 1 - Value',
    'Phone 2 - Type', 'Phone 2 - Value',
    'Email 1 - Type', 'Email 1 - Value',
    'Organization 1 - Name', 'Organization 1 - Title', 'Organization 1 - Department'
  ];

  const escapeCsv = (val) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [];
  const errors = [];
  let exportedCount = 0;

  students.forEach((student, index) => {
    try {
      const contactName = String(student.studentName || student["Student's Name (as per school records)"] || student.name || '').trim();
      const mobile = cleanPhoneNumber(student.mobile || student['Mobile No. (with working WhatsApp)'] || student['Mobile No.'] || '');
      const parentMobile = cleanPhoneNumber(student.parentContact || student["Parent's Mobile No. (must be working)"] || student["Parent's Mobile No."] || '');
      const email = String(student.email || student['Email Address (Gmail Preferred - for updates)'] || student['Email Address'] || '').trim();
      const formNum = student.formNo || student['Form Number'] || `REC_${index + 1}`;
      const regNo = extractRegVal(student);
      const studentClass = extractClassVal(student);
      const gender = String(student.gender || student['Gender'] || '').trim();
      const { stream } = resolveStreamAndSubjects(student);

      if (!contactName) {
        errors.push(`Form ${formNum}: Missing student name`);
        return;
      }
      if (!mobile || mobile.length < 10) {
        errors.push(`Form ${formNum} (${contactName}): Invalid or missing mobile number`);
        return;
      }

      const displayName = buildGoogleContactDisplayName(student, session);
      const notes = buildGoogleContactNotes(student);

      // Organization: formNum_regNo
      let orgName = `${formNum}`;
      if (regNo) orgName += `_${regNo}`;

      const row = [
        escapeCsv(displayName), // Name
        escapeCsv(displayName), // Given Name
        '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', '""', // Additional to Birthday
        escapeCsv(gender),      // Gender
        '""', '""', '""', '""', // Location to Mileage
        escapeCsv(studentClass ? `${studentClass} Student` : 'Student'), // Occupation
        '""', '""', '""', '""', // Hobby to Subject
        escapeCsv(notes),       // Notes
        '""', '""',             // Language, Photo
        escapeCsv(groupName),   // Group Membership
        escapeCsv('Mobile'),    // Phone 1 - Type
        escapeCsv(mobile),      // Phone 1 - Value
        parentMobile ? escapeCsv('Home') : '""', // Phone 2 - Type
        parentMobile ? escapeCsv(parentMobile) : '""', // Phone 2 - Value
        email && email.includes('@') ? escapeCsv('Work') : '""', // Email 1 - Type
        email && email.includes('@') ? escapeCsv(email) : '""', // Email 1 - Value
        escapeCsv(orgName),     // Organization 1 - Name
        '""',                   // Organization 1 - Title
        stream ? escapeCsv(stream) : '""' // Organization 1 - Department
      ];

      csvRows.push(row.join(','));
      exportedCount++;
    } catch (err) {
      errors.push(`Row ${index + 1}: ${err.message}`);
    }
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...csvRows].join('\n');
  return {
    csvContent,
    exportedCount,
    errors,
    totalInput: students.length
  };
}

/**
 * Triggers browser download of Google Contacts CSV file
 */
export function downloadGoogleContactsCsv(students = [], options = {}) {
  const result = generateGoogleContactsCsv(students, options);
  
  if (result.exportedCount === 0) {
    return result;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `HSS_Students_Google_Contacts_${dateStr}.csv`;

  const blob = new Blob([result.csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return result;
}
