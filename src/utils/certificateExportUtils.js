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
    date = new Date().toLocaleDateString('en-GB')
  } = { ...studentData, ...options };

  const isFemale = String(gender).toUpperCase().startsWith('F') || String(gender).toUpperCase() === 'FEMALE';
  const genderTitle = isFemale ? 'Ms.' : 'Mr.';
  const pronounSonDaughter = isFemale ? 'daughter' : 'son';
  const pronounHeSheCap = isFemale ? 'She' : 'He';
  const pronounHisHerCap = isFemale ? 'Her' : 'His';
  const pronounHimHer = isFemale ? 'her' : 'him';

  let result = templateHtml;
  result = result.replace(/\{STUDENT_NAME\}/g, studentName || '—');
  result = result.replace(/\{FATHER_NAME\}/g, fatherName || '—');
  result = result.replace(/\{MOTHER_NAME\}/g, motherName || '—');
  result = result.replace(/\{CLASS\}/g, className || '—');
  result = result.replace(/\{STREAM\}/g, stream || '—');
  result = result.replace(/\{ROLL_NO\}/g, rollNo || '—');
  result = result.replace(/\{REG_NO\}/g, regNo || '—');
  result = result.replace(/\{DOB_FIGURES\}/g, dobFigures || '—');
  result = result.replace(/\{DOB_WORDS\}/g, dobWords || '—');
  result = result.replace(/\{SESSION\}/g, session || '—');
  result = result.replace(/\{ADDRESS\}/g, address || '—');
  result = result.replace(/\{GENDER_TITLE\}/g, genderTitle);
  result = result.replace(/\{PRONOUN_SON_DAUGHTER\}/g, pronounSonDaughter);
  result = result.replace(/\{PRONOUN_HE_SHE\}/g, pronounHeSheCap);
  result = result.replace(/\{PRONOUN_HIS_HER\}/g, pronounHisHerCap);
  result = result.replace(/\{PRONOUN_HIM_HER\}/g, pronounHimHer);
  result = result.replace(/\{REF_NO\}/g, refNo || '—');
  result = result.replace(/\{DATE\}/g, date || '—');

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

  return result;
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
  showPhoto = true,
  watermark = true,
  signatories = ['Incharge Admissions & Exam', 'Principal']
}) {
  const logoSrc = '/logo192.png';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${certificateTitle} — ${refNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,400;1,600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Inter:wght@400;500;600;700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 0.5in;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: 'Merriweather', Georgia, serif;
      color: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .a4-sheet {
      width: 210mm;
      min-height: 297mm;
      background-color: #ffffff;
      padding: 4mm 6mm;
      margin: 0 auto;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 3px double #800000;
      outline: 1px solid #c5a059;
      outline-offset: -5px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    }

    /* Watermark */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80mm;
      height: 80mm;
      opacity: 0.055;
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
      justify-content: space-between;
    }

    /* Top Letterhead Header Banner */
    .header-box {
      background-color: #f0f8ff !important;
      border-bottom: 2.5px solid #800000;
      padding: 10px 14px 8px 14px;
      text-align: center;
      margin: -4mm -6mm 8px -6mm;
    }

    .header-logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
      margin: 0 auto 4px auto;
      display: block;
    }

    .office-title {
      font-size: 11px;
      font-weight: 800;
      color: #800000;
      letter-spacing: 1.5px;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .school-title {
      font-size: 17px;
      font-weight: 900;
      color: #0a192f;
      letter-spacing: 0.5px;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      font-family: Georgia, serif, -apple-system, sans-serif;
    }

    .school-subtitle {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 9.5px;
      font-weight: 600;
      color: #475569;
      margin: 0;
      letter-spacing: 0.3px;
    }

    .maroon-divider {
      height: 2px;
      background: linear-gradient(to right, transparent, #800000 20%, #800000 80%, transparent);
      margin: 6px 0;
    }

    /* Ref & Date Bar */
    .ref-date-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Inter', sans-serif;
      font-size: 9pt;
      font-weight: 700;
      color: #1e293b;
      padding: 4px 6px;
      border-bottom: 1.5px solid #cbd5e1;
      margin-bottom: 12px;
    }

    /* Certificate Banner Badge */
    .certificate-banner {
      text-align: center;
      margin: 12px 0 16px 0;
    }

    .certificate-banner-title {
      display: inline-block;
      font-family: 'Cinzel', 'Playfair Display', serif;
      font-size: 14pt;
      font-weight: 900;
      color: #800000;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 4px 18px;
      border-top: 2px solid #800000;
      border-bottom: 2px solid #800000;
      background-color: #fff9f5;
    }

    /* Body & Photo Layout */
    .body-wrapper {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .body-text-col {
      flex: 1;
      font-size: 10.5pt;
      line-height: 1.85;
      text-align: justify;
      color: #1e293b;
    }

    .body-text-col p {
      margin: 0 0 12px 0;
      text-indent: 20px;
    }

    .body-text-col p:first-of-type {
      text-indent: 0;
    }

    .body-text-col strong {
      color: #0f172a;
      font-weight: 700;
    }

    .body-text-col em {
      font-style: italic;
      color: #1e3a8a;
    }

    /* Photo Frame Box */
    .student-photo-frame {
      width: 33mm;
      height: 40mm;
      border: 1.5px solid #800000;
      padding: 2px;
      background: white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .student-photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .student-photo-placeholder {
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      padding: 6px;
    }

    /* Verification Stamp Seal & Signatures */
    .footer-section {
      margin-top: auto;
      padding-top: 20px;
    }

    .stamp-seal-note {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 24px;
    }

    .seal-box {
      width: 80px;
      height: 80px;
      border: 1.5px dashed #94a3b8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-family: 'Inter', sans-serif;
      font-size: 6.5pt;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      padding: 4px;
    }

    .signatories-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 10px;
    }

    .sign-col {
      text-align: center;
      width: 60mm;
    }

    .sign-line {
      border-bottom: 1.5px solid #334155;
      margin-bottom: 4px;
    }

    .sign-title {
      font-family: 'Inter', sans-serif;
      font-size: 9pt;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .sign-sub {
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 600;
      color: #64748b;
    }

    @media print {
      body {
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .a4-sheet {
        box-shadow: none !important;
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="a4-sheet">
    ${watermark ? '<div class="watermark"></div>' : ''}
    
    <div class="content-layer">
      
      <!-- Top Letterhead Box -->
      <div>
        <div class="header-box">
          <img src="${logoSrc}" alt="HSS Shangus Logo" class="header-logo" />
          <h2 class="office-title">${officeTitle}</h2>
          <h1 class="school-title">${institutionName}</h1>
          <p class="school-subtitle">${institutionAddress}</p>
        </div>

        <div class="maroon-divider"></div>

        <!-- Ref & Date -->
        <div class="ref-date-bar">
          <div>Ref No: <strong>${refNo || '—'}</strong></div>
          <div>Date: <strong>${dateStr || '—'}</strong></div>
        </div>

        <!-- Certificate Title Banner -->
        <div class="certificate-banner">
          <div class="certificate-banner-title">${certificateTitle}</div>
        </div>
      </div>

      <!-- Main Body + Optional Photo -->
      <div class="body-wrapper">
        <div class="body-text-col">
          ${bodyHtml}
        </div>

        ${showPhoto ? `
          <div class="student-photo-frame">
            ${studentPhotoUrl ? `
              <img src="${studentPhotoUrl}" alt="Student Photo" class="student-photo-img" />
            ` : `
              <div class="student-photo-placeholder">Affix Student Photo</div>
            `}
          </div>
        ` : ''}
      </div>

      <!-- Verification Footer & Signatories -->
      <div class="footer-section">
        <div class="stamp-seal-note">
          <div style="font-family: 'Inter', sans-serif; font-size: 7.5pt; color: #64748b; font-style: italic;">
            Valid only with institutional seal and official signatures
          </div>
        </div>

        <div class="signatories-row">
          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">${signatories[0] || 'Incharge Admissions & Exam'}</div>
            <div class="sign-sub">Govt. HSS Shangus</div>
          </div>

          <div class="sign-col">
            <div class="sign-line"></div>
            <div class="sign-title">${signatories[1] || 'Principal'}</div>
            <div class="sign-sub">Govt. HSS Shangus</div>
          </div>
        </div>
      </div>

    </div>
  </div>
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

// ─── WORD DOCUMENT (.DOCX) GENERATOR ───
export async function generateStudentCertificateDocx({
  officeTitle = 'OFFICE OF THE PRINCIPAL',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'District Anantnag, Kashmir — 192201 (J&K)',
  certificateTitle = 'BONAFIDE CERTIFICATE',
  refNo = 'HSS/SHG/Bonafide/2026/01',
  dateStr = new Date().toLocaleDateString('en-GB'),
  bodyHtml = '',
  signatories = ['Incharge Admissions & Exam', 'Principal']
}) {
  // Strip HTML tags into clean paragraph lines
  const cleanLines = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: [
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
            spacing: { after: 200 },
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
            spacing: { before: 300, after: 300 },
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

          // Certificate Body Paragraphs
          ...cleanLines.map(line =>
            new Paragraph({
              spacing: { before: 120, after: 120, line: 360 },
              alignment: AlignmentType.JUSTIFIED,
              children: [
                new TextRun({
                  text: line,
                  size: 22,
                  font: 'Georgia',
                  color: '0F172A'
                })
              ]
            })
          ),

          // Spacing before Signatures
          new Paragraph({ spacing: { before: 600 } }),

          // Signatories Table
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
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: '_______________________________', bold: true }),
                          new TextRun({ text: `\n${signatories[0] || 'Incharge Admissions & Exam'}`, bold: true, size: 20, font: 'Calibri' }),
                          new TextRun({ text: '\nGovt. HSS Shangus', size: 16, font: 'Calibri', color: '64748B' })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: '_______________________________', bold: true }),
                          new TextRun({ text: `\n${signatories[1] || 'Principal'}`, bold: true, size: 20, font: 'Calibri' }),
                          new TextRun({ text: '\nGovt. HSS Shangus', size: 16, font: 'Calibri', color: '64748B' })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = (certificateTitle || 'Certificate').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadBlob(blob, `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.docx`);
}
