// =================================================================
// HSS SHANGUS — Official Student Certificate Export Utilities
// Date-to-Words Converter, Built-in Certificate Templates & Export Engines
// =================================================================

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer
} from 'docx';
import { convertHtmlToDocxElements } from './htmlDocxConverter';
import { createQrSvgDataUri } from './qrSvgGenerator';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── NUMBERS & DATES TO ENGLISH WORDS CONVERTER ───
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORDINAL_DAYS = [
  '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth',
  'Twenty-First', 'Twenty-Second', 'Twenty-Third', 'Twenty-Fourth', 'Twenty-Fifth', 'Twenty-Sixth', 'Twenty-Seventh', 'Twenty-Eighth', 'Twenty-Ninth', 'Thirtieth', 'Thirty-First'
];

function numberToWords(n) {
  const num = parseInt(n, 10);
  if (isNaN(num) || num === 0) return 'Zero';
  if (num < 20) return ONES[num];
  if (num < 100) return TENS[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ONES[num % 10] : '');
  if (num < 1000) return ONES[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + numberToWords(num % 100) : '');
  if (num < 1000000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + numberToWords(num % 1000) : '');
  return String(num);
}

function yearToWords(year) {
  const y = parseInt(year, 10);
  if (isNaN(y)) return '';
  if (y >= 2000 && y < 2100) {
    const remainder = y - 2000;
    if (remainder === 0) return 'Two Thousand';
    return 'Two Thousand ' + numberToWords(remainder);
  }
  if (y >= 1900 && y < 2000) {
    const prefix = Math.floor(y / 100);
    const suffix = y % 100;
    return numberToWords(prefix) + ' Hundred' + (suffix !== 0 ? ' ' + numberToWords(suffix) : '');
  }
  return numberToWords(y);
}

/**
 * Converts a DOB string (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) into formal figures and words.
 * Returns: { figures: '15-08-2006', words: 'Fifteenth Day of August, Two Thousand Six', standard: '15/08/2006' }
 */
export function dobToWords(dobRaw) {
  if (!dobRaw || String(dobRaw).trim() === '' || /^(—|none|null|undefined)$/i.test(String(dobRaw).trim())) {
    return { figures: '—', words: '—', standard: '—' };
  }

  const str = String(dobRaw).trim();
  let day = 0, month = 0, year = 0;

  // Try standard YYYY-MM-DD
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/.]/);
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  }
  // Try standard DD/MM/YYYY or DD-MM-YYYY
  else if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(str)) {
    const parts = str.split(/[-/.]/);
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    // Try native Date parse fallback
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      day = d.getDate();
      month = d.getMonth() + 1;
      year = d.getFullYear();
    }
  }

  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2099) {
    return { figures: str, words: str, standard: str };
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const figures = `${dd}-${mm}-${year}`;
  const standard = `${dd}/${mm}/${year}`;

  const dayWord = ORDINAL_DAYS[day] || `${numberToWords(day)}th`;
  const monthWord = MONTHS[month - 1];
  const yearWord = yearToWords(year);

  const words = `${dayWord} Day of ${monthWord}, ${yearWord}`;
  return { figures, words, standard };
}

// ─── OFFICIAL BUILT-IN CERTIFICATE TEMPLATES ───
export const BUILTIN_CERTIFICATE_TEMPLATES = [
  {
    id: 'bonafide_dob',
    name: 'Bonafide Certificate (with DOB in Figures & Words)',
    category: 'Bonafide & Age Certificates',
    certificateTitle: 'BONAFIDE CERTIFICATE',
    refPrefix: 'HSS/SHG/Bonafide',
    showPhoto: false,
    watermark: true,
    bodyHtml: `<p>This is to certify that <strong>{GENDER_TITLE} {STUDENT_NAME}</strong>, {PRONOUN_SON_DAUGHTER} of <strong>Mr. {FATHER_NAME}</strong> and <strong>Mrs. {MOTHER_NAME}</strong>, residing at <strong>{ADDRESS}</strong>, is a bonafide student of this institution studying in <strong>Class {CLASS}</strong> (Stream: <strong>{STREAM}</strong>) under Class Roll No: <strong>{ROLL_NO}</strong> and Registration No: <strong>{REG_NO}</strong> during the academic session <strong>{SESSION}</strong>.</p>
<p>As per the official school records and master admission register, {PRONOUN_HIS_HER} verified Date of Birth is <strong>{DOB_FIGURES}</strong> (in words: <strong><em>{DOB_WORDS}</em></strong>).</p>
<p>To the best of my knowledge and belief, {PRONOUN_HE_SHE} bears a good moral character and has shown sincere dedication towards academic and extracurricular activities. This certificate is issued on the request of the student/parent for official purposes.</p>`
  },
  {
    id: 'character_present',
    name: 'Character Certificate (Present Student)',
    category: 'Character & Conduct Certificates',
    certificateTitle: 'CHARACTER & CONDUCT CERTIFICATE',
    refPrefix: 'HSS/SHG/Char-Pres',
    showPhoto: false,
    watermark: true,
    bodyHtml: `<p>This is to certify that <strong>{GENDER_TITLE} {STUDENT_NAME}</strong>, {PRONOUN_SON_DAUGHTER} of <strong>Mr. {FATHER_NAME}</strong> and <strong>Mrs. {MOTHER_NAME}</strong>, resident of <strong>{ADDRESS}</strong>, is a regular student of this institution reading in <strong>Class {CLASS}</strong> (Stream: <strong>{STREAM}</strong>) bearing Class Roll No: <strong>{ROLL_NO}</strong> and Registration No: <strong>{REG_NO}</strong> in academic session <strong>{SESSION}</strong>.</p>
<p>During {PRONOUN_HIS_HER} stay in this institution, {PRONOUN_HIS_HER} conduct and moral character have been found to be <strong>EXEMPLARY & SATISFACTORY</strong>. {PRONOUN_HE_SHE} has neither displayed any misconduct nor taken part in any subversive or undisciplined activities.</p>
<p>{PRONOUN_HE_SHE} maintains high standards of discipline and regular attendance. I wish {PRONOUN_HIM_HER} all success in all future academic endeavors and pursuits.</p>`
  },
  {
    id: 'character_past',
    name: 'Character Certificate (Ex-Student / Past Student)',
    category: 'Character & Conduct Certificates',
    certificateTitle: 'CHARACTER CERTIFICATE (EX-STUDENT)',
    refPrefix: 'HSS/SHG/Char-Past',
    showPhoto: false,
    watermark: true,
    bodyHtml: `<p>This is to certify that <strong>{GENDER_TITLE} {STUDENT_NAME}</strong>, {PRONOUN_SON_DAUGHTER} of <strong>Mr. {FATHER_NAME}</strong> and <strong>Mrs. {MOTHER_NAME}</strong>, resident of <strong>{ADDRESS}</strong>, was a bonafide student of this institution and has successfully completed {PRONOUN_HIS_HER} studies in <strong>Class {CLASS}</strong> (Stream: <strong>{STREAM}</strong>) under Registration No: <strong>{REG_NO}</strong> and Roll No: <strong>{ROLL_NO}</strong> during the academic session <strong>{SESSION}</strong>.</p>
<p>As per the official record file, {PRONOUN_HIS_HER} Date of Birth recorded in the institutional register is <strong>{DOB_FIGURES}</strong> (in words: <strong><em>{DOB_WORDS}</em></strong>).</p>
<p>During {PRONOUN_HIS_HER} academic tenure at Govt. Higher Secondary School Shangus, {PRONOUN_HE_SHE} bore a <strong>GOOD MORAL CHARACTER</strong> and exhibited commendable discipline and cordial behavior towards teachers and fellow students. I wish {PRONOUN_HIM_HER} bright success in all future prospects.</p>`
  },
  {
    id: 'provisional_admission',
    name: 'Provisional Admission Bonafide Certificate',
    category: 'Admission & Enrollment',
    certificateTitle: 'PROVISIONAL ADMISSION CERTIFICATE',
    refPrefix: 'HSS/SHG/Prov-Adm',
    showPhoto: false,
    watermark: true,
    bodyHtml: `<p>This is to certify that <strong>{GENDER_TITLE} {STUDENT_NAME}</strong>, {PRONOUN_SON_DAUGHTER} of <strong>Mr. {FATHER_NAME}</strong>, resident of <strong>{ADDRESS}</strong>, has been provisionally admitted to <strong>Class {CLASS}</strong> (Stream: <strong>{STREAM}</strong>) at Govt. Higher Secondary School Shangus for the academic session <strong>{SESSION}</strong>.</p>
<p>The student has been allotted Class Roll No: <strong>{ROLL_NO}</strong> and is attending regular classroom lectures and practical laboratory assignments. {PRONOUN_HIS_HER} admission is subject to final confirmation and verification of eligibility documents by JKBOSE / Department of School Education.</p>
<p>This provisional bonafide certificate is issued upon request to enable the student to apply for scholarship / transport concession / government welfare schemes.</p>`
  },
  {
    id: 'noc_transfer',
    name: 'No Objection Certificate (NOC) / Transfer Bonafide',
    category: 'Transfer & Migration',
    certificateTitle: 'NO OBJECTION CERTIFICATE (NOC)',
    refPrefix: 'HSS/SHG/NOC',
    showPhoto: false,
    watermark: true,
    bodyHtml: `<p>This is to certify that <strong>{GENDER_TITLE} {STUDENT_NAME}</strong>, {PRONOUN_SON_DAUGHTER} of <strong>Mr. {FATHER_NAME}</strong>, resident of <strong>{ADDRESS}</strong>, was enrolled in <strong>Class {CLASS}</strong> (Stream: <strong>{STREAM}</strong>) under Registration No: <strong>{REG_NO}</strong> and Roll No: <strong>{ROLL_NO}</strong> in this institution.</p>
<p>This institution has <strong>NO OBJECTION</strong> whatsoever to {PRONOUN_HIS_HER} seeking admission / migration / transfer to any other recognized higher educational institution or Board for further studies.</p>
<p>All institutional dues, library books, and laboratory equipment in {PRONOUN_HIS_HER} name have been cleared in full, and there are no outstanding liabilities against the candidate.</p>`
  },
  {
    id: 'fee_clearance_bonafide',
    name: 'Fee Clearance & Regular Enrollment Certificate',
    category: 'Bonafide & Age Certificates',
    certificateTitle: 'ENROLLMENT & FEE CLEARANCE CERTIFICATE',
    refPrefix: 'HSS/SHG/Fee-Bonafide',
    showPhoto: false,
    watermark: true,
    bodyHtml: `<p>This is to certify that <strong>{GENDER_TITLE} {STUDENT_NAME}</strong>, {PRONOUN_SON_DAUGHTER} of <strong>Mr. {FATHER_NAME}</strong>, resident of <strong>{ADDRESS}</strong>, is a regular bonafide student of <strong>Class {CLASS}</strong> (Stream: <strong>{STREAM}</strong>), Roll No: <strong>{ROLL_NO}</strong>, Session <strong>{SESSION}</strong> in Govt. Higher Secondary School Shangus.</p>
<p>It is further certified that the student has paid all prescribed institutional tuition, examination, laboratory, and development fees up to date and has no pending dues against {PRONOUN_HIM_HER} as of <strong>{DATE}</strong>.</p>
<p>This certificate is issued to facilitate the student's application for post-matric scholarship / fee reimbursement from the competent social welfare authorities.</p>`
  },
  {
    id: 'tc_dc_qualified',
    name: 'Discharge / Transfer cum Character Certificate (Qualified / Passed)',
    category: 'Transfer & Character Certificates (TC/DC)',
    certificateTitle: 'Discharge/Transfer cum Character Certificate',
    refPrefix: 'HSS/SHG/TC-DC',
    showPhoto: false,
    watermark: true,
    isTcDc: true,
    resultType: 'Passed',
    bodyHtml: `<p>This is certified that <strong>{STUDENT_NAME}</strong> {PRONOUN_SO_DO} <strong>{FATHER_NAME}</strong> Mother's Name <strong>{MOTHER_NAME}</strong> R/o <strong>{VILLAGE}</strong> tehsil <strong>{TEHSIL}</strong> district <strong>{DISTRICT}</strong>, who appeared in <strong>{EXAM_NAME}</strong> conducted by the J&K Board of School Education (JKBOSE), Srinagar, through this school during the session <strong>{EXAM_SESSION}</strong> under examination roll number <strong>{EXAM_ROLL_NO}</strong>, has been declared <strong>{RESULT_STATUS}</strong> with <strong>{DIVISION_DISTINCTION}</strong> in the said examination, securing <strong>{MARKS_OBTAINED} / {MAX_MARKS}</strong> marks as per the preliminary result records of the JKBOSE.</p>
<p><strong>{PRONOUN_HIS_HER_CAP}</strong> date of birth (DoB) as per the records of this school is <strong>{DOB_FIGURES}</strong> (<em>{DOB_WORDS}</em>).</p>
<p>There are no outstanding dues against the student in this institution, and <strong>{PRONOUN_HIS_HER_LOW}</strong> behaviour and conduct remained <strong>{CONDUCT_STATUS}</strong> during <strong>{PRONOUN_HIS_HER_LOW}</strong> stay in the school.</p>
<p class="cert-footer-dates-row" style="margin-top: 24px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; font-weight: normal;"><span>Withdrawal or Result Date: <strong>{WITHDRAWAL_DATE}</strong></span><span>Date of issue: <strong>{DATE}</strong></span></p>`
  },
  {
    id: 'tc_dc_reappear',
    name: 'Discharge / Transfer cum Character Certificate (Re-appear / Not Qualified / Transfer)',
    category: 'Transfer & Character Certificates (TC/DC)',
    certificateTitle: 'Discharge/Transfer cum Character Certificate',
    refPrefix: 'HSS/SHG/TC-DC',
    showPhoto: false,
    watermark: true,
    isTcDc: true,
    resultType: 'Reap',
    bodyHtml: `<p>This is certified that <strong>{STUDENT_NAME}</strong> {PRONOUN_SO_DO} <strong>{FATHER_NAME}</strong> Mother's Name <strong>{MOTHER_NAME}</strong> R/o <strong>{VILLAGE}</strong> tehsil <strong>{TEHSIL}</strong> district <strong>{DISTRICT}</strong>, who appeared in <strong>{EXAM_NAME}</strong> conducted by the J&K Board of School Education (JKBOSE), Srinagar, through this school during the session <strong>{EXAM_SESSION}</strong> under examination roll number <strong>{EXAM_ROLL_NO}</strong>, has been placed under <strong>{RESULT_STATUS}</strong> in subject(s) (<strong>{REAPP_SUBJECTS}</strong>) in the said examination as per the preliminary result records of the JKBOSE.</p>
<p><strong>{PRONOUN_HIS_HER_CAP}</strong> date of birth (DoB) as per the records of this school is <strong>{DOB_FIGURES}</strong> (<em>{DOB_WORDS}</em>).</p>
<p>There are no outstanding dues against the student in this institution, and <strong>{PRONOUN_HIS_HER_LOW}</strong> behaviour and conduct remained <strong>{CONDUCT_STATUS}</strong> during <strong>{PRONOUN_HIS_HER_LOW}</strong> stay in the school.</p>
<p class="cert-footer-dates-row" style="margin-top: 24px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; font-weight: normal;"><span>Withdrawal or Result Date: <strong>{WITHDRAWAL_DATE}</strong></span><span>Date of issue: <strong>{DATE}</strong></span></p>`
  }
];

// ─── REPLACES PLACEHOLDERS IN HTML TEMPLATES ───
export function interpolateCertificateTemplate(templateHtml, studentData = {}, options = {}) {
  if (!templateHtml) return '';

  const {
    studentName = '—',
    fatherName = '—',
    motherName = '—',
    className = '11th',
    stream = 'Medical',
    rollNo = '—',
    regNo = '—',
    dobFigures = '—',
    dobWords = '—',
    session = '2026-27',
    address = 'Shangus, Anantnag',
    gender = 'M',
    refNo = 'HSS/SHG/Bonafide/2026/01',
    date = new Date().toLocaleDateString('en-GB'),
    includeSalutations = true, // Hide/unhide Mr./Mrs./Ms.
    studentTitle = null,
    fatherTitle = null,
    motherTitle = null,
    // TC / DC Specific tokens
    examName = 'Class 12th Examination',
    examRollNo = '—',
    examSession = 'Annual Regular 2025 (Oct.-Nov.)',
    resultStatus = 'Pass',
    divisionDistinction = 'Distinction',
    marksObtained = '—',
    maxMarks = '500',
    reappSubjects = '—',
    admissionDate = '—',
    admissionNo = '—',
    withdrawalDate = '—',
    conductStatus = 'Satisfactory',
    village = '—',
    tehsil = '—',
    district = 'Anantnag',
    certificateNo = '—'
  } = { ...studentData, ...options };

  const isFemale = String(gender).toUpperCase().startsWith('F') || String(gender).toUpperCase() === 'FEMALE';
  
  // Salutation / Title logic
  const genderTitle = includeSalutations ? (studentTitle !== null ? studentTitle : (isFemale ? 'Ms.' : 'Mr.')) : '';
  const genderTitleYoung = includeSalutations ? (isFemale ? 'Miss' : 'Master') : '';
  const effFatherTitle = includeSalutations ? (fatherTitle !== null ? fatherTitle : 'Mr.') : '';
  const effMotherTitle = includeSalutations ? (motherTitle !== null ? motherTitle : 'Mrs.') : '';

  const pronounSonDaughter = isFemale ? 'daughter' : 'son';
  const pronounSonDaughterCap = isFemale ? 'Daughter' : 'Son';
  const pronounSoDo = isFemale ? 'D/o' : 'S/o';
  const pronounSonOfDaughterOf = isFemale ? 'daughter of' : 'son of';
  const pronounSonOfDaughterOfCap = isFemale ? 'Daughter of' : 'Son of';
  const pronounHeSheCap = isFemale ? 'She' : 'He';
  const pronounHeSheLow = isFemale ? 'she' : 'he';
  const pronounHisHerCap = isFemale ? 'Her' : 'His';
  const pronounHisHerLow = isFemale ? 'her' : 'his';
  const pronounHimHer = isFemale ? 'her' : 'him';
  const pronounHimHerCap = isFemale ? 'Her' : 'Him';
  const pronounHimselfHerself = isFemale ? 'herself' : 'himself';
  const pronounHimselfHerselfCap = isFemale ? 'Herself' : 'Himself';
  const genderFull = isFemale ? 'Female' : 'Male';

  const cleanSalutation = (nameStr) => {
    if (!nameStr) return nameStr;
    return String(nameStr).replace(/^(?:Mr\.|Mrs\.|Ms\.|Miss|Master|Smt\.|Shri)\s+/i, '').trim();
  };

  const effStudentName = includeSalutations ? (studentName || '—') : cleanSalutation(studentName || '—');
  const effFatherName = includeSalutations ? (fatherName || '—') : cleanSalutation(fatherName || '—');
  const effMotherName = includeSalutations ? (motherName || '—') : cleanSalutation(motherName || '—');

  let result = templateHtml;

  // If salutations are hidden, strip any hardcoded "Mr." / "Mrs." / "Ms." prefixes before tokens or names
  if (!includeSalutations) {
    result = result.replace(/(?:Mr\.|Mrs\.|Ms\.|Miss|Master|Smt\.|Shri)\s*\{FATHER_NAME\}/gi, '{FATHER_NAME}');
    result = result.replace(/(?:Mr\.|Mrs\.|Ms\.|Miss|Master|Smt\.|Shri)\s*\{MOTHER_NAME\}/gi, '{MOTHER_NAME}');
    result = result.replace(/(?:Mr\.|Ms\.|Miss|Master)\s*\{STUDENT_NAME\}/gi, '{STUDENT_NAME}');
    result = result.replace(/\{GENDER_TITLE\}\s*/gi, '');
    result = result.replace(/\{TITLE\}\s*/gi, '');
    result = result.replace(/\{TITLE_YOUNG\}\s*/gi, '');
    result = result.replace(/\{FATHER_TITLE\}\s*/gi, '');
    result = result.replace(/\{MOTHER_TITLE\}\s*/gi, '');
  } else {
    result = result.replace(/\{FATHER_TITLE\}/gi, effFatherTitle);
    result = result.replace(/\{MOTHER_TITLE\}/gi, effMotherTitle);
  }

  result = result.replace(/\{STUDENT_NAME\}/gi, effStudentName);
  result = result.replace(/\{FATHER_NAME\}/gi, effFatherName);
  result = result.replace(/\{MOTHER_NAME\}/gi, effMotherName);
  result = result.replace(/\{CLASS\}/gi, className || '—');
  result = result.replace(/\{STREAM\}/gi, stream || '—');
  result = result.replace(/\{ROLL_NO\}/gi, rollNo || '—');
  result = result.replace(/\{REG_NO\}/gi, regNo || '—');
  result = result.replace(/\{DOB_FIGURES\}/gi, dobFigures || '—');
  result = result.replace(/\{DOB_WORDS\}/gi, dobWords || '—');
  result = result.replace(/\{SESSION\}/gi, session || '—');
  result = result.replace(/\{ADDRESS\}/gi, address || '—');
  result = result.replace(/\{REF_NO\}/gi, refNo || '—');
  result = result.replace(/\{DATE\}/gi, date || '—');

  // TC / DC Token Replacements
  result = result.replace(/\{EXAM_NAME\}/gi, examName || 'Class 12th Examination');
  result = result.replace(/\{EXAM_ROLL_NO\}/gi, examRollNo || rollNo || '—');
  result = result.replace(/\{EXAM_SESSION\}/gi, examSession || session || '—');
  result = result.replace(/\{RESULT_STATUS\}/gi, resultStatus || 'Pass');
  result = result.replace(/\{(?:DIVISION_DISTINCTION|DIVISION|DISTINCTION)\}/gi, divisionDistinction || 'Distinction');
  result = result.replace(/\{MARKS_OBTAINED\}/gi, marksObtained || '—');
  result = result.replace(/\{MAX_MARKS\}/gi, maxMarks || '500');
  result = result.replace(/\{REAPP_SUBJECTS\}/gi, reappSubjects || '—');
  result = result.replace(/\{ADMISSION_DATE\}/gi, admissionDate || '—');
  result = result.replace(/\{ADMISSION_NO\}/gi, admissionNo || '—');
  result = result.replace(/\{(?:WITHDRAWAL_DATE|RESULT_DATE)\}/gi, withdrawalDate || '—');
  result = result.replace(/\{CONDUCT_STATUS\}/gi, conductStatus || 'Satisfactory');
  result = result.replace(/\{VILLAGE\}/gi, village || address || '—');
  result = result.replace(/\{TEHSIL\}/gi, tehsil || 'Anantnag');
  result = result.replace(/\{DISTRICT\}/gi, district || 'Anantnag');
  result = result.replace(/\{(?:CERTIFICATE_NO|TC_DC_NO|CERT_NO)\}/gi, certificateNo || refNo || '—');

  // If salutations are disabled, also clean any literal salutations residing inside tags (e.g. <strong>Mr. ...</strong>)
  if (!includeSalutations) {
    result = result.replace(/<(strong|b|em|span)([^>]*)>\s*(?:Mr\.|Mrs\.|Ms\.|Miss|Master|Smt\.|Shri)\s+/gi, '<$1$2>');
    result = result.replace(/\b(?:Mr\.|Mrs\.|Ms\.|Miss|Master|Smt\.|Shri)\s+([A-Z])/g, '$1');
  }

  // Helper to determine if a placeholder at `offset` is at the start of a sentence or within a sentence
  const isStartOfSentence = (htmlStr, offset) => {
    if (offset <= 0) return true;
    const preceding = htmlStr.slice(0, offset);
    const clean = preceding.replace(/<[^>]*>/g, '').trimEnd();
    if (clean.length === 0) return true;
    const lastChar = clean[clean.length - 1];

    if (lastChar === '.' || lastChar === '!' || lastChar === '?' || lastChar === '—' || lastChar === '\n' || lastChar === ':') {
      if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Shri|Smt)\.$/i.test(clean)) {
        return false;
      }
      return true;
    }
    if (/<(?:p|h[1-6]|li|div|br)\s*\/?>\s*$/i.test(preceding)) {
      return true;
    }
    return false;
  };

  // Smart context-aware pronoun replacer
  const replacePronounSmart = (htmlStr, regex, capVal, lowVal) => {
    return htmlStr.replace(regex, (match, offset, fullStr) => {
      const isStart = isStartOfSentence(fullStr, offset);
      return isStart ? capVal : lowVal;
    });
  };

  // Gender & Pronoun Tokens with Smart Sentence-Boundary Recognition
  result = result.replace(/\{(?:GENDER_TITLE|TITLE)\}/gi, genderTitle);
  result = result.replace(/\{TITLE_YOUNG\}/gi, genderTitleYoung);
  result = result.replace(/\{GENDER\}/gi, genderFull);
  result = result.replace(/\{FATHER_TITLE\}/gi, effFatherTitle);
  result = result.replace(/\{MOTHER_TITLE\}/gi, effMotherTitle);

  // Explicit Capitalized / Lowercase Pronoun replacements
  result = result.replace(/\{(?:PRONOUN_HIS_HER_CAP|HIS_HER_CAP|PRONOUN_His_Her)\}/gi, pronounHisHerCap);
  result = result.replace(/\{(?:PRONOUN_HIS_HER_LOW|HIS_HER_LOW|PRONOUN_his_her|his_her)\}/gi, pronounHisHerLow);
  result = result.replace(/\{(?:PRONOUN_HE_SHE_CAP|HE_SHE_CAP|PRONOUN_He_She)\}/gi, pronounHeSheCap);
  result = result.replace(/\{(?:PRONOUN_HE_SHE_LOW|HE_SHE_LOW|PRONOUN_he_she|he_she)\}/gi, pronounHeSheLow);
  result = result.replace(/\{(?:PRONOUN_SON_DAUGHTER_CAP|SON_DAUGHTER_CAP)\}/gi, pronounSonDaughterCap);
  result = result.replace(/\{(?:PRONOUN_SON_DAUGHTER_LOW|SON_DAUGHTER_LOW)\}/gi, pronounSonDaughter);
  result = result.replace(/\{(?:PRONOUN_HIM_HER_CAP|HIM_HER_CAP)\}/gi, pronounHimHerCap);
  result = result.replace(/\{(?:PRONOUN_HIM_HER_LOW|HIM_HER_LOW)\}/gi, pronounHimHer);
  result = result.replace(/\{(?:PRONOUN_SO_DO|SO_DO|S_O_D_O)\}/gi, pronounSoDo);

  // 1. Son / Daughter
  result = replacePronounSmart(result, /\{(?:PRONOUN_SON_DAUGHTER|SON_DAUGHTER|PRONOUN_Son_Daughter|Son_Daughter)\}/gi, pronounSonDaughterCap, pronounSonDaughter);
  result = replacePronounSmart(result, /\{(?:PRONOUN_SON_OF_DAUGHTER_OF|SON_OF_DAUGHTER_OF|PRONOUN_Son_Of_Daughter_Of|Son_Of_Daughter_Of)\}/gi, pronounSonOfDaughterOfCap, pronounSonOfDaughterOf);

  // 2. He / She
  result = replacePronounSmart(result, /\{(?:PRONOUN_HE_SHE|HE_SHE|PRONOUN_he_she|he_she)\}/gi, pronounHeSheCap, pronounHeSheLow);

  // 3. His / Her
  result = replacePronounSmart(result, /\{(?:PRONOUN_HIS_HER|HIS_HER|PRONOUN_his_her|his_her)\}/gi, pronounHisHerCap, pronounHisHerLow);

  // 4. Him / Her
  result = replacePronounSmart(result, /\{(?:PRONOUN_HIM_HER|HIM_HER|PRONOUN_him_her|him_her)\}/gi, pronounHimHerCap, pronounHimHer);

  // 5. Himself / Herself
  result = replacePronounSmart(result, /\{(?:PRONOUN_HIMSELF_HERSELF|HIMSELF_HERSELF|PRONOUN_himself_herself|himself_herself)\}/gi, pronounHimselfHerselfCap, pronounHimselfHerself);

  // Custom dynamic fields interpolation
  if (options && Array.isArray(options.customFields)) {
    options.customFields.forEach(f => {
      if (f.label && f.value !== undefined) {
        const safeToken = f.label.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const regex = new RegExp(`\\{${safeToken}\\}`, 'g');
        result = result.replace(regex, f.value || '—');
      }
    });
  }

  // Cleanup: clean any double spaces or leading spaces in strong tags
  result = result.replace(/<strong>\s+/g, '<strong>');
  result = result.replace(/\s+<\/strong>/g, '</strong>');

  return result;
}

// ─── UNIQUE CODE-128 MACHINE-READABLE BARCODE GENERATOR ───
export function generateStudentBarcodeSvg(payload = 'HSS-SHG-2026') {
  const cleanStr = String(payload || 'HSS-SHG-2026').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  let hash = 0;
  for (let i = 0; i < cleanStr.length; i++) {
    hash = (hash << 5) - hash + cleanStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) || 1234567;
  
  let bars = [];
  let currentX = 10;
  const barHeight = 28;
  
  // Guard start bar
  bars.push(`<rect x="${currentX}" y="0" width="2" height="${barHeight}" fill="#0f172a" />`);
  currentX += 4;
  bars.push(`<rect x="${currentX}" y="0" width="2" height="${barHeight}" fill="#0f172a" />`);
  currentX += 4;

  for (let i = 0; i < cleanStr.length; i++) {
    const code = cleanStr.charCodeAt(i);
    const pattern = [
      ((code + i + seed) % 3) + 1,
      (((code >> 1) + i) % 2) + 1,
      (((code >> 2) + i + 1) % 3) + 1,
      ((code + seed) % 2) + 1
    ];
    
    for (let p = 0; p < pattern.length; p++) {
      const width = pattern[p];
      const isBar = p % 2 === 0;
      if (isBar) {
        bars.push(`<rect x="${currentX}" y="0" width="${width * 1.25}" height="${barHeight}" fill="#0f172a" />`);
      }
      currentX += width * 1.25 + 1.2;
    }
  }

  // Guard stop bar
  currentX += 2;
  bars.push(`<rect x="${currentX}" y="0" width="2" height="${barHeight}" fill="#0f172a" />`);
  currentX += 4;
  bars.push(`<rect x="${currentX}" y="0" width="3" height="${barHeight}" fill="#0f172a" />`);
  currentX += 10;

  return `<svg viewBox="0 0 ${currentX} ${barHeight}" preserveAspectRatio="none" style="width: 100%; max-width: 260px; height: 22px; display: block; margin: 0 auto;">
    ${bars.join('')}
  </svg>`;
}

// ─── HIGH-PRECISION PRINT & SAVE PDF ENGINE ───
export function printStudentCertificate({
  officeTitle = 'OFFICE OF THE PRINCIPAL',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'District Anantnag, Kashmir — 192201 (J&K)',
  certificateTitle = 'BONAFIDE CERTIFICATE',
  refNo = 'HSS/SHG/Bonafide/2026/01',
  dateStr = new Date().toLocaleDateString('en-GB'),
  bodyHtml = '',
  studentPhotoUrl = null,
  showPhoto = false,
  watermark = true,
  signatories = ['Incharge Admissions & Exam', 'Checked By', 'Principal'],
  isDualCopy = true,
  metaDetails = {}
}) {
  const logoSrc = '/logo192.png';
  const qrPayload = [
    `INSTITUTION: Govt Higher Secondary School Shangus`,
    `DOCUMENT: ${certificateTitle}`,
    `CERT NO: ${metaDetails.certificateNo || refNo || '—'}`,
    `REG NO: ${metaDetails.regNo || '—'}`,
    `ADM NO: ${metaDetails.admissionNo || '—'}`,
    `ADM DATE: ${metaDetails.admissionDate || '—'}`,
    `ISSUE DATE: ${dateStr || ''}`,
    `STATUS: Official Validated Institutional Record (Govt HSS Shangus)`
  ].join('\n');
  const qrDataUri = createQrSvgDataUri(qrPayload, 160);

  const renderSingleCopyPage = (isOfficeCopy = false) => `
    <div class="cert-page ${isOfficeCopy ? 'office-copy-page' : 'student-copy-page'}">
      
      <!-- Watermark Background -->
      ${watermark ? `<div class="watermark"></div>` : ''}
      ${isOfficeCopy ? '<div class="diagonal-office-stamp">OFFICE COPY</div>' : ''}

      <div class="content-layer">
        
        <!-- Header Top Meta Bar: Issue Tag (Left) & Prestige Copy Badge (Right) -->
        <div class="header-top-meta-row">
          <div class="copy-security-tag">
            <span class="security-shield-icon">✦</span>
            <span>${isOfficeCopy ? 'Institutional Record / Archive' : 'Original Certificate'}</span>
          </div>
          <div class="copy-pill-badge ${isOfficeCopy ? 'badge-office' : 'badge-student'}">
            <span class="badge-dot"></span>
            <span>${isOfficeCopy ? 'OFFICE COPY' : 'STUDENT COPY'}</span>
          </div>
        </div>

        <!-- Standard School Header with Logo on Separate Top Line -->
        <div class="school-header-standard-box">
          <div class="school-seal-center-wrap">
            <img src="${logoSrc}" class="school-seal-img" alt="School Emblem" />
          </div>
          <div class="school-header-top-sub">${officeTitle || 'OFFICE OF THE PRINCIPAL'}</div>
          <div class="school-header-title">${institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}</div>
          <div class="school-header-loc">${institutionAddress || 'District Anantnag, Kashmir — 192201 (J&K)'}</div>
        </div>

        <!-- Certificate Title Banner -->
        <div class="cert-title-badge-wrap">
          <div class="cert-title-badge">${certificateTitle}</div>
        </div>

        <!-- Meta Details (Left) & Scannable QR Security Box (Right) -->
        <div class="meta-and-qr-row">
          <div class="meta-four-lines-box">
            <div class="meta-single-line">
              <span class="meta-single-label">Certificate No.:</span>
              <span class="meta-single-val val-red">${metaDetails.certificateNo || refNo || '1276'}</span>
            </div>
            <div class="meta-single-line">
              <span class="meta-single-label">Registration No.:</span>
              <span class="meta-single-val val-blue">${metaDetails.regNo || '—'}</span>
            </div>
            <div class="meta-single-line">
              <span class="meta-single-label">Admission No.:</span>
              <span class="meta-single-val val-blue">${metaDetails.admissionNo || '—'}</span>
            </div>
            <div class="meta-single-line">
              <span class="meta-single-label">Date of Admission:</span>
              <span class="meta-single-val val-blue">${metaDetails.admissionDate || '—'}</span>
            </div>
          </div>

          <div class="cert-qr-security-box">
            <img src="${qrDataUri}" class="cert-qr-img" alt="Official Verification QR" />
            <div class="cert-qr-caption">SCAN TO VERIFY</div>
          </div>
        </div>

        <!-- Body & Photo Layout -->
        <div class="body-wrapper">
          <div class="body-text-col">
            ${bodyHtml}
          </div>

          ${showPhoto && studentPhotoUrl ? `
            <div class="student-photo-frame">
              <img src="${studentPhotoUrl}" class="student-photo-img" alt="Student Photo" />
            </div>
          ` : ''}
        </div>

        <!-- Bottom Signatures & Optional Receipt Slip -->
        <div class="footer-block">
          <div class="signatures-dotted-row">
            <div class="sig-col">
              <div class="sig-dot-line"></div>
              <div class="sig-title-red">${signatories[0] || 'Incharge Admissions & Exam'}</div>
            </div>

            <div class="sig-col">
              <div class="sig-dot-line"></div>
              <div class="sig-title-dark">${signatories[1] || 'Checked By'}</div>
            </div>

            <div class="sig-col">
              <div class="sig-dot-line"></div>
              <div class="sig-title-red">${signatories[2] || 'Principal'}</div>
            </div>
          </div>

          <!-- Office Copy Student Receipt Acknowledgment Box -->
          ${isOfficeCopy ? `
            <div class="student-receipt-wrapper">
              <div class="receipt-floating-pill">
                <span>Receipt by Student</span>
              </div>
              <div class="student-receipt-inner-card">
                <div class="receipt-statement-text">
                  Received ‘<strong>Discharge cum Character Certificate</strong>’ in Original
                </div>
                <div class="receipt-writing-row">
                  <div class="receipt-field-item">
                    <span class="field-prefix">today on</span>
                    <span class="field-underline date-underline"></span>
                  </div>
                  <div class="receipt-field-item sig-field-item">
                    <span class="field-prefix">Signature</span>
                    <span class="field-underline sig-underline"></span>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

      </div>
    </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${certificateTitle} — ${refNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600;700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 0.3in;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      font-family: 'Merriweather', Georgia, serif;
      color: #0f172a;
    }

    .cert-page {
      width: 100%;
      min-height: 272mm;
      max-height: 285mm;
      background: #ffffff;
      border: 2.5px solid #800000;
      outline: 1px dotted #800000;
      outline-offset: -5px;
      padding: 6mm 10mm 8mm 10mm;
      margin: 0 auto 20px auto;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .cert-page:last-child {
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 0;
    }

    .header-top-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: -2px 0 6px 0;
      padding-bottom: 4px;
      border-bottom: 1px dashed #e2e8f0;
    }

    .copy-security-tag {
      font-family: 'Inter', sans-serif;
      font-size: 6.8pt;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .security-shield-icon {
      color: #800000;
      font-size: 8pt;
    }

    .copy-pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 10px;
      border-radius: 9999px;
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 900;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .badge-student {
      color: #15803d;
      background: #f0fdf4;
      border: 1.2px solid #86efac;
      box-shadow: 0 1px 2px rgba(22, 163, 74, 0.08);
    }

    .badge-office {
      color: #b91c1c;
      background: #fef2f2;
      border: 1.2px solid #fca5a5;
      box-shadow: 0 1px 2px rgba(220, 38, 38, 0.08);
    }

    .badge-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }

    .badge-student .badge-dot {
      background-color: #16a34a;
    }

    .badge-office .badge-dot {
      background-color: #dc2626;
    }

    .diagonal-office-stamp {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-family: 'Inter', sans-serif;
      font-size: 52pt;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.08);
      letter-spacing: 12px;
      pointer-events: none;
      z-index: 2;
      white-space: nowrap;
      user-select: none;
    }

    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 75mm;
      height: 75mm;
      opacity: 0.045;
      pointer-events: none;
      z-index: 1;
      background-image: url('${logoSrc}');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    }

    .content-layer {
      position: relative;
      z-index: 5;
      display: flex;
      flex-direction: column;
      flex: 1;
      justify-content: flex-start;
    }

    .school-header-standard-box {
      text-align: center;
      margin-bottom: 8px;
      padding-bottom: 2px;
    }

    .school-seal-center-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 4px;
    }

    .school-seal-img {
      width: 44px;
      height: 44px;
      object-fit: contain;
    }

    .school-header-top-sub {
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      font-weight: 800;
      color: #800000;
      letter-spacing: 0.8px;
      text-align: center;
      margin-bottom: 3px;
      text-transform: uppercase;
    }

    .school-header-title {
      font-family: 'Cinzel', 'Playfair Display', Georgia, serif;
      font-size: 14pt;
      font-weight: 900;
      color: #0a192f;
      letter-spacing: 0.6px;
      line-height: 1.2;
      text-align: center;
    }

    .school-header-loc {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: #475569;
      margin-top: 2px;
      text-align: center;
    }

    .cert-title-badge-wrap {
      text-align: center;
      margin: 8px 0 10px 0;
    }

    .cert-title-badge {
      display: inline-block;
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      font-weight: 900;
      color: #ffffff;
      background-color: #0284c7;
      padding: 3px 24px;
      border-radius: 4px;
      border: 1px solid #0369a1;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .meta-and-qr-row {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 12px;
      margin: 8px 0 14px 0;
      width: 100%;
    }

    .meta-four-lines-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3.5px;
      padding: 6px 14px;
      margin: 0;
      border-top: 1px dashed #cbd5e1;
      border-bottom: 1.5px solid #800000;
      border-left: 2px solid #800000;
      background: #f8fafc;
      border-radius: 4px;
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
    }

    .meta-single-line {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .meta-single-label {
      font-weight: 700;
      color: #334155;
      min-width: 135px;
    }

    .meta-single-val {
      font-weight: 800;
      font-family: 'Inter', monospace;
    }

    .val-red {
      color: #dc2626;
    }

    .val-blue {
      color: #1d4ed8;
    }

    .cert-qr-security-box {
      width: 84px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 5px;
      background: #ffffff;
      border: 1.5px solid #800000;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      shrink-0;
    }

    .cert-qr-img {
      width: 66px;
      height: 66px;
      display: block;
    }

    .cert-qr-caption {
      font-family: 'Inter', sans-serif;
      font-size: 5.5pt;
      font-weight: 900;
      color: #800000;
      letter-spacing: 0.5px;
      text-align: center;
      margin-top: 2px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .body-wrapper {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin: 10px 0 16px 0;
    }

    .body-text-col {
      flex: 1;
      font-size: 10pt;
      line-height: 1.85;
      text-align: justify;
      color: #1e293b;
    }

    .body-text-col p {
      margin: 0 0 10px 0;
    }

    .body-text-col p:last-child {
      margin-bottom: 0;
    }

    .cert-footer-dates-row {
      margin-top: 24px !important;
      margin-bottom: 6px !important;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
      color: #1e293b;
      font-size: 9.5pt;
    }

    .body-text-col strong {
      color: #0a192f;
      font-weight: 800;
    }

    .student-photo-frame {
      width: 28mm;
      height: 34mm;
      border: 1.5px solid #800000;
      padding: 2px;
      background: white;
      shrink-0;
    }

    .student-photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .footer-block {
      margin-top: 48px;
      padding-top: 0px;
    }

    .signatures-dotted-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding: 0 10px;
      margin-top: 0px;
    }

    .sig-col {
      text-align: center;
      width: 31%;
    }

    .sig-dot-line {
      border-bottom: 1.5px dotted #800000;
      height: 38px;
      margin-bottom: 6px;
      width: 140px;
      margin-left: auto;
      margin-right: auto;
    }

    .sig-title-red {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 900;
      color: #991b1b;
    }

    .sig-title-dark {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 800;
      color: #0f172a;
    }

    .student-receipt-wrapper {
      position: relative;
      margin-top: 36px;
      padding-top: 8px;
      page-break-inside: avoid;
    }

    .receipt-floating-pill {
      position: absolute;
      top: 0px;
      left: 20px;
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      color: #dc2626;
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.3px;
      padding: 1.5px 10px;
      border-radius: 9999px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      z-index: 2;
    }

    .student-receipt-inner-card {
      background: #fff8f0;
      border: 1.5px solid #d97706;
      border-radius: 10px;
      padding: 12px 18px 14px 18px;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 1px 3px rgba(217, 119, 6, 0.06);
    }

    .receipt-statement-text {
      font-size: 8.5pt;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.4;
    }

    .receipt-statement-text strong {
      color: #0f172a;
      font-weight: 900;
    }

    .receipt-writing-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      margin-top: 24px;
    }

    .receipt-field-item {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      flex: 1;
    }

    .sig-field-item {
      flex: 1.4;
    }

    .field-prefix {
      font-size: 8pt;
      font-weight: 700;
      color: #334155;
      white-space: nowrap;
    }

    .field-underline {
      flex: 1;
      border-bottom: 1.5px solid #475569;
      height: 1px;
      min-width: 100px;
    }

    .sig-underline {
      min-width: 160px;
    }

    @media print {
      body {
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .cert-page {
        margin: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 270mm !important;
      }
    }
  </style>
</head>
<body>
  ${isDualCopy ? `
    ${renderSingleCopyPage(false)}
    ${renderSingleCopyPage(true)}
  ` : `
    ${renderSingleCopyPage(false)}
  `}
</body>
</html>`;

  // Use a hidden iframe for seamless direct printing without popup tabs or lingering blank windows
  let iframe = document.getElementById('student-certificate-print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'student-certificate-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Trigger print cleanly once iframe content is ready
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.warn('Silent print fallback:', err);
    }
  }, 350);
}

// ─── BATCH STUDENT CERTIFICATES PRINT ENGINE (2 PAGES PER STUDENT SEQUENTIALLY) ───
export function printBatchStudentCertificates(studentsList = [], commonOptions = {}) {
  if (!Array.isArray(studentsList) || studentsList.length === 0) return;

  const logoSrc = '/logo192.png';
  const {
    officeTitle = 'OFFICE OF THE PRINCIPAL',
    institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
    institutionAddress = 'District Anantnag, Kashmir — 192201 (J&K)',
    certificateTitle = 'Discharge/Transfer cum Character Certificate',
    dateStr = new Date().toLocaleDateString('en-GB'),
    signatories = ['Incharge Admissions & Exam', 'Checked By', 'Principal'],
    watermark = true,
    showPhoto = false
  } = commonOptions;

  const allPagesHtml = studentsList.map((item, idx) => {
    const { student, bodyHtml, metaDetails = {} } = item;
    const qrPayload = [
      `INSTITUTION: Govt Higher Secondary School Shangus`,
      `DOCUMENT: ${certificateTitle}`,
      `STUDENT: ${student?.name || '—'}`,
      `CERT NO: ${metaDetails.certificateNo || '—'}`,
      `REG NO: ${metaDetails.regNo || '—'}`,
      `ADM NO: ${metaDetails.admissionNo || '—'}`,
      `ADM DATE: ${metaDetails.admissionDate || '—'}`,
      `STATUS: Official Validated Institutional Record (Govt HSS Shangus)`
    ].join('\n');
    const qrDataUri = createQrSvgDataUri(qrPayload, 160);
    const photoUrl = showPhoto ? (student?.photo || null) : null;

    const renderBatchPage = (isOfficeCopy = false) => `
      <div class="cert-page ${isOfficeCopy ? 'office-copy-page' : 'student-copy-page'}">
        
        ${watermark ? `<div class="watermark"></div>` : ''}
        ${isOfficeCopy ? '<div class="diagonal-office-stamp">OFFICE COPY</div>' : ''}

        <div class="content-layer">
          <!-- Header Top Meta Bar: Issue Tag (Left) & Prestige Copy Badge (Right) -->
          <div class="header-top-meta-row">
            <div class="copy-security-tag">
              <span class="security-shield-icon">✦</span>
              <span>${isOfficeCopy ? 'Institutional Record / Archive' : 'Original Certificate'}</span>
            </div>
            <div class="copy-pill-badge ${isOfficeCopy ? 'badge-office' : 'badge-student'}">
              <span class="badge-dot"></span>
              <span>${isOfficeCopy ? 'OFFICE COPY' : 'STUDENT COPY'}</span>
            </div>
          </div>

          <div class="school-header-standard-box">
            <div class="school-seal-center-wrap">
              <img src="${logoSrc}" class="school-seal-img" alt="School Emblem" />
            </div>
            <div class="school-header-top-sub">${officeTitle || 'OFFICE OF THE PRINCIPAL'}</div>
            <div class="school-header-title">${institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}</div>
            <div class="school-header-loc">${institutionAddress || 'District Anantnag, Kashmir — 192201 (J&K)'}</div>
          </div>

          <div class="cert-title-badge-wrap">
            <div class="cert-title-badge">${certificateTitle}</div>
          </div>

          <!-- Meta Details (Left) & Scannable QR Security Box (Right) -->
          <div class="meta-and-qr-row">
            <div class="meta-four-lines-box">
              <div class="meta-single-line">
                <span class="meta-single-label">Certificate No.:</span>
                <span class="meta-single-val val-red">${metaDetails.certificateNo || '—'}</span>
              </div>
              <div class="meta-single-line">
                <span class="meta-single-label">Registration No.:</span>
                <span class="meta-single-val val-blue">${metaDetails.regNo || '—'}</span>
              </div>
              <div class="meta-single-line">
                <span class="meta-single-label">Admission No.:</span>
                <span class="meta-single-val val-blue">${metaDetails.admissionNo || '—'}</span>
              </div>
              <div class="meta-single-line">
                <span class="meta-single-label">Date of Admission:</span>
                <span class="meta-single-val val-blue">${metaDetails.admissionDate || '—'}</span>
              </div>
            </div>

            <div class="cert-qr-security-box">
              <img src="${qrDataUri}" class="cert-qr-img" alt="Official Verification QR" />
              <div class="cert-qr-caption">SCAN TO VERIFY</div>
            </div>
          </div>

          <div class="body-wrapper">
            <div class="body-text-col">
              ${bodyHtml}
            </div>

            ${photoUrl ? `
              <div class="student-photo-frame">
                <img src="${photoUrl}" class="student-photo-img" alt="Student Photo" />
              </div>
            ` : ''}
          </div>

          <div class="footer-block">
            <div class="signatures-dotted-row">
              <div class="sig-col">
                <div class="sig-dot-line"></div>
                <div class="sig-title-red">${signatories[0] || 'Incharge Admissions & Exam'}</div>
              </div>

              <div class="sig-col">
                <div class="sig-dot-line"></div>
                <div class="sig-title-dark">${signatories[1] || 'Checked By'}</div>
              </div>

              <div class="sig-col">
                <div class="sig-dot-line"></div>
                <div class="sig-title-red">${signatories[2] || 'Principal'}</div>
              </div>
            </div>

            ${isOfficeCopy ? `
              <div class="student-receipt-wrapper">
                <div class="receipt-floating-pill">
                  <span>Receipt by Student</span>
                </div>
                <div class="student-receipt-inner-card">
                  <div class="receipt-statement-text">
                    Received ‘<strong>Discharge cum Character Certificate</strong>’ in Original
                  </div>
                  <div class="receipt-writing-row">
                    <div class="receipt-field-item">
                      <span class="field-prefix">today on</span>
                      <span class="field-underline date-underline"></span>
                    </div>
                    <div class="receipt-field-item sig-field-item">
                      <span class="field-prefix">Signature</span>
                      <span class="field-underline sig-underline"></span>
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    return `
      ${renderBatchPage(false)}
      ${renderBatchPage(true)}
    `;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Batch Certificates (${studentsList.length} Students) — HSS Shangus</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600;700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 0.3in;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      font-family: 'Merriweather', Georgia, serif;
      color: #0f172a;
    }

    .cert-page {
      width: 100%;
      min-height: 272mm;
      max-height: 285mm;
      background: #ffffff;
      border: 2.5px solid #800000;
      outline: 1px dotted #800000;
      outline-offset: -5px;
      padding: 6mm 10mm 8mm 10mm;
      margin: 0 auto 20px auto;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .cert-page:last-child {
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 0;
    }

    .header-top-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: -2px 0 6px 0;
      padding-bottom: 4px;
      border-bottom: 1px dashed #e2e8f0;
    }

    .copy-security-tag {
      font-family: 'Inter', sans-serif;
      font-size: 6.8pt;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .security-shield-icon {
      color: #800000;
      font-size: 8pt;
    }

    .copy-pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 10px;
      border-radius: 9999px;
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 900;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .badge-student {
      color: #15803d;
      background: #f0fdf4;
      border: 1.2px solid #86efac;
      box-shadow: 0 1px 2px rgba(22, 163, 74, 0.08);
    }

    .badge-office {
      color: #b91c1c;
      background: #fef2f2;
      border: 1.2px solid #fca5a5;
      box-shadow: 0 1px 2px rgba(220, 38, 38, 0.08);
    }

    .badge-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }

    .badge-student .badge-dot {
      background-color: #16a34a;
    }

    .badge-office .badge-dot {
      background-color: #dc2626;
    }

    .diagonal-office-stamp {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-family: 'Inter', sans-serif;
      font-size: 52pt;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.08);
      letter-spacing: 12px;
      pointer-events: none;
      z-index: 2;
      white-space: nowrap;
      user-select: none;
    }

    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 75mm;
      height: 75mm;
      opacity: 0.045;
      pointer-events: none;
      z-index: 1;
      background-image: url('${logoSrc}');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    }

    .content-layer {
      position: relative;
      z-index: 5;
      display: flex;
      flex-direction: column;
      flex: 1;
      justify-content: flex-start;
    }

    .school-header-standard-box {
      text-align: center;
      margin-bottom: 8px;
      padding-bottom: 2px;
    }

    .school-seal-center-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 4px;
    }

    .school-seal-img {
      width: 44px;
      height: 44px;
      object-fit: contain;
    }

    .school-header-top-sub {
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      font-weight: 800;
      color: #800000;
      letter-spacing: 0.8px;
      text-align: center;
      margin-bottom: 3px;
      text-transform: uppercase;
    }

    .school-header-title {
      font-family: 'Cinzel', 'Playfair Display', Georgia, serif;
      font-size: 14pt;
      font-weight: 900;
      color: #0a192f;
      letter-spacing: 0.6px;
      line-height: 1.2;
      text-align: center;
    }

    .school-header-loc {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: #475569;
      margin-top: 2px;
      text-align: center;
    }

    .cert-title-badge-wrap {
      text-align: center;
      margin: 8px 0 10px 0;
    }

    .cert-title-badge {
      display: inline-block;
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      font-weight: 900;
      color: #ffffff;
      background-color: #0284c7;
      padding: 3px 24px;
      border-radius: 4px;
      border: 1px solid #0369a1;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .meta-and-qr-row {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 12px;
      margin: 8px 0 14px 0;
      width: 100%;
    }

    .meta-four-lines-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3.5px;
      padding: 6px 14px;
      margin: 0;
      border-top: 1px dashed #cbd5e1;
      border-bottom: 1.5px solid #800000;
      border-left: 2px solid #800000;
      background: #f8fafc;
      border-radius: 4px;
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
    }

    .meta-single-line {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .meta-single-label {
      font-weight: 700;
      color: #334155;
      min-width: 135px;
    }

    .meta-single-val {
      font-weight: 800;
      font-family: 'Inter', monospace;
    }

    .val-red {
      color: #dc2626;
    }

    .val-blue {
      color: #1d4ed8;
    }

    .cert-qr-security-box {
      width: 84px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 5px;
      background: #ffffff;
      border: 1.5px solid #800000;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      shrink-0;
    }

    .cert-qr-img {
      width: 66px;
      height: 66px;
      display: block;
    }

    .cert-qr-caption {
      font-family: 'Inter', sans-serif;
      font-size: 5.5pt;
      font-weight: 900;
      color: #800000;
      letter-spacing: 0.5px;
      text-align: center;
      margin-top: 2px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .body-wrapper {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin: 10px 0 16px 0;
    }

    .body-text-col {
      flex: 1;
      font-size: 10pt;
      line-height: 1.85;
      text-align: justify;
      color: #1e293b;
    }

    .body-text-col p {
      margin: 0 0 10px 0;
    }

    .body-text-col p:last-child {
      margin-bottom: 0;
    }

    .cert-footer-dates-row {
      margin-top: 24px !important;
      margin-bottom: 6px !important;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
      color: #1e293b;
      font-size: 9.5pt;
    }

    .body-text-col strong {
      color: #0a192f;
      font-weight: 800;
    }

    .student-photo-frame {
      width: 28mm;
      height: 34mm;
      border: 1.5px solid #800000;
      padding: 2px;
      background: white;
      shrink-0;
    }

    .student-photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .footer-block {
      margin-top: 48px;
      padding-top: 0px;
    }

    .signatures-dotted-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding: 0 10px;
      margin-top: 0px;
    }

    .sig-col {
      text-align: center;
      width: 31%;
    }

    .sig-dot-line {
      border-bottom: 1.5px dotted #800000;
      height: 38px;
      margin-bottom: 6px;
      width: 140px;
      margin-left: auto;
      margin-right: auto;
    }

    .sig-title-red {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 900;
      color: #991b1b;
    }

    .sig-title-dark {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 800;
      color: #0f172a;
    }

    .student-receipt-wrapper {
      position: relative;
      margin-top: 36px;
      padding-top: 8px;
      page-break-inside: avoid;
    }

    .receipt-floating-pill {
      position: absolute;
      top: 0px;
      left: 20px;
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      color: #dc2626;
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.3px;
      padding: 1.5px 10px;
      border-radius: 9999px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      z-index: 2;
    }

    .student-receipt-inner-card {
      background: #fff8f0;
      border: 1.5px solid #d97706;
      border-radius: 10px;
      padding: 12px 18px 14px 18px;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 1px 3px rgba(217, 119, 6, 0.06);
    }

    .receipt-statement-text {
      font-size: 8.5pt;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.4;
    }

    .receipt-statement-text strong {
      color: #0f172a;
      font-weight: 900;
    }

    .receipt-writing-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      margin-top: 24px;
    }

    .receipt-field-item {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      flex: 1;
    }

    .sig-field-item {
      flex: 1.4;
    }

    .field-prefix {
      font-size: 8pt;
      font-weight: 700;
      color: #334155;
      white-space: nowrap;
    }

    .field-underline {
      flex: 1;
      border-bottom: 1.5px solid #475569;
      height: 1px;
      min-width: 100px;
    }

    .sig-underline {
      min-width: 160px;
    }

    @media print {
      body {
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .cert-page {
        margin: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 270mm !important;
      }
    }
  </style>
</head>
<body>
  ${allPagesHtml}
</body>
</html>`;

  let iframe = document.getElementById('student-certificate-batch-print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'student-certificate-batch-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.warn('Batch silent print fallback:', err);
    }
  }, 400);
}

// ─── WORD DOCUMENT (.DOCX) GENERATOR ───
export async function generateStudentCertificateDocx({
  officeTitle = 'OFFICE OF THE PRINCIPAL',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'District Anantnag, Kashmir — 192201 (J&K)',
  certificateTitle = 'BONAFIDE CERTIFICATE',
  refNo = 'HSS/SHG/Bonafide/2026/01',
  dateStr = new Date().toLocaleDateString('en-GB'),
  bodyHtml = '',
  signatories = ['Incharge Admissions & Exam', 'Principal'],
  isDualCopy = false,
  metaDetails = {}
}) {
  // Convert HTML content into native Word (docx) elements (Tables, Paragraphs, Lists, TextRuns)
  const bodyDocxElements = convertHtmlToDocxElements(bodyHtml, {
    defaultFont: 'Georgia',
    defaultSize: 24, // 12pt
    defaultAlign: 'justify',
    lineSpacing: 340
  });

  const createSectionChildren = (isOfficeCopy = false) => [
    // Top Copy Pill Badge
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `( ${isOfficeCopy ? 'OFFICE COPY' : 'STUDENT COPY'} )`,
          bold: true,
          size: 18,
          color: isOfficeCopy ? 'B91C1C' : '15803D',
          font: 'Calibri'
        })
      ]
    }),

    // Office Header
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: officeTitle,
          bold: true,
          size: 26,
          color: '800000',
          font: 'Georgia'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: institutionName,
          bold: true,
          size: 30,
          color: '1E3A8A',
          font: 'Georgia'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: institutionAddress,
          size: 18,
          color: '475569',
          font: 'Calibri'
        })
      ]
    }),

    // Ref & Date Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '800000' }
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Ref No: ', bold: true, size: 20, font: 'Calibri' }),
                    new TextRun({ text: refNo, size: 20, font: 'Calibri' })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: 'Date: ', bold: true, size: 20, font: 'Calibri' }),
                    new TextRun({ text: dateStr, size: 20, font: 'Calibri' })
                  ]
                })
              ]
            })
          ]
        })
      ]
    }),

    // Certificate Title Banner
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
      children: [
        new TextRun({
          text: certificateTitle,
          bold: true,
          underline: true,
          size: 26,
          color: '800000',
          font: 'Georgia'
        })
      ]
    }),

    // Certificate Body Paragraphs & Tables
    ...bodyDocxElements,

    // Spacing before Signatures
    new Paragraph({ spacing: { before: 360 } }),

    // Signatories Table (Left, Center, Right)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE }
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60, after: 40 },
                  children: [
                    new TextRun({
                      text: '_________________________',
                      color: '94A3B8',
                      bold: true,
                      size: 16,
                      font: 'Calibri'
                    })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 10 },
                  children: [
                    new TextRun({
                      text: signatories[0] || 'Incharge Admissions',
                      bold: true,
                      size: 18,
                      font: 'Georgia',
                      color: '0F172A'
                    })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: institutionName || 'Govt. HSS Shangus',
                      size: 14,
                      font: 'Calibri',
                      color: '64748B'
                    })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60, after: 40 },
                  children: [
                    new TextRun({
                      text: '_________________________',
                      color: '94A3B8',
                      bold: true,
                      size: 16,
                      font: 'Calibri'
                    })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 10 },
                  children: [
                    new TextRun({
                      text: 'Checked By',
                      bold: true,
                      size: 18,
                      font: 'Georgia',
                      color: '0F172A'
                    })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Office Verification',
                      size: 14,
                      font: 'Calibri',
                      color: '64748B'
                    })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60, after: 40 },
                  children: [
                    new TextRun({
                      text: '_________________________',
                      color: '94A3B8',
                      bold: true,
                      size: 16,
                      font: 'Calibri'
                    })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 10 },
                  children: [
                    new TextRun({
                      text: signatories[1] || 'Principal',
                      bold: true,
                      size: 18,
                      font: 'Georgia',
                      color: '0F172A'
                    })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: institutionName || 'Govt. HSS Shangus',
                      size: 14,
                      font: 'Calibri',
                      color: '64748B'
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    }),

    // Optional Student Receipt Acknowledgment Box for Office Copy
    ...(isOfficeCopy ? [
      new Paragraph({ spacing: { before: 200 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.DASHED, size: 4, color: 'EA580C' },
          left: { style: BorderStyle.DASHED, size: 4, color: 'EA580C' },
          right: { style: BorderStyle.DASHED, size: 4, color: 'EA580C' },
          bottom: { style: BorderStyle.DASHED, size: 4, color: 'EA580C' }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Receipt by Student / Candidate (Office Record):',
                        bold: true,
                        size: 18,
                        color: 'C2410C',
                        font: 'Calibri'
                      })
                    ]
                  }),
                  new Paragraph({
                    spacing: { before: 40 },
                    children: [
                      new TextRun({
                        text: "Received 'Discharge / Transfer cum Character Certificate' in Original today on __________________ Signature of Student/Parent __________________",
                        size: 18,
                        color: '431407',
                        font: 'Calibri'
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    ] : [])
  ];

  const sections = [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }
        }
      },
      children: createSectionChildren(false)
    }
  ];

  if (isDualCopy) {
    sections.push({
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }
        }
      },
      children: createSectionChildren(true)
    });
  }

  const doc = new Document({ sections });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = (certificateTitle || 'Certificate').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadBlob(blob, `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.docx`);
}
