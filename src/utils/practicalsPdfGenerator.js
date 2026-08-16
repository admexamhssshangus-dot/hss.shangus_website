/**
 * practicalsPdfGenerator.js — Official Practicals & Awards Print Generator
 * Govt. Higher Secondary School Shangus, Anantnag
 *
 * 1. Individual Award Roll (Screenshot 2 format): 2-column 50-student/page layout with centre numbers & figures-to-words.
 * 2. Consolidated Cover Letter & Award Matrix (Screenshots 3 & 4 format): Page 1 forwarding letter + Page 2+ hash total matrix.
 * 3. Individual Work Sheet (Screenshot 5 format): Practical/Viva/Overall subject record.
 */

import { toTitleCase } from './textFormatting';

export function numberToWordsInr(num) {
  if (!num || num === 'AB' || num === 'A' || String(num).toUpperCase() === 'ABSENT') return '-';
  const n = parseInt(num, 10);
  if (isNaN(n)) return String(num);
  const words = [
    'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
    'Twenty One', 'Twenty Two', 'Twenty Three', 'Twenty Four', 'Twenty Five', 'Twenty Six', 'Twenty Seven', 'Twenty Eight', 'Twenty Nine', 'Thirty',
    'Thirty One', 'Thirty Two', 'Thirty Three', 'Thirty Four', 'Thirty Five', 'Thirty Six', 'Thirty Seven', 'Thirty Eight', 'Thirty Nine', 'Forty'
  ];
  return (words[n] || String(n)) + ' Only';
}

export const PRACTICAL_SUBJECT_DEFS = [
  { code: 'EN', name: 'General English', keywords: ['english', 'gen eng', 'en'] },
  { code: 'PH', name: 'Physics', keywords: ['physics', 'ph'] },
  { code: 'CH', name: 'Chemistry', keywords: ['chemistry', 'ch'] },
  { code: 'BO', name: 'Botany', keywords: ['botany', 'bo', 'biology'] },
  { code: 'ZO', name: 'Zoology', keywords: ['zoology', 'zo', 'biology'] },
  { code: 'BI', name: 'Biology (Botany & Zoology)', keywords: ['biology', 'bi', 'botany', 'zoology'] },
  { code: 'MA', name: 'Mathematics', keywords: ['mathematics', 'math', 'maths', 'ma'] },
  { code: 'UR', name: 'Urdu', keywords: ['urdu', 'ur'] },
  { code: 'ED', name: 'Education', keywords: ['education', 'ed'] },
  { code: 'HT', name: 'History', keywords: ['history', 'ht'] },
  { code: 'PS', name: 'Political Science', keywords: ['political science', 'pol sc', 'ps'] },
  { code: 'EC', name: 'Economics', keywords: ['economics', 'ec'] },
  { code: 'ES', name: 'Environmental Science', keywords: ['environmental science', 'evs', 'es'] },
  { code: 'PD', name: 'Physical Education', keywords: ['physical education', 'phy edu', 'pd'] },
  { code: 'HTC', name: 'Healthcare', keywords: ['healthcare', 'health care', 'htc'] },
  { code: 'ITE', name: 'IT and ITES', keywords: ['it and ites', 'it&ites', 'ite', 'information technology'] }
];

export function getStudentExamRoll(st) {
  if (!st) return '';
  const rollKeys = [
    'examRollNo', 'Exam Roll No.', 'Exam Roll No', 'Exam Roll',
    'Class Roll No', 'Class Roll No.', 'classRollNo', 'Class Roll',
    'rollNo', 'roll_no', 'roll', 'Roll No', 'Roll No.'
  ];
  for (const k of rollKeys) {
    if (st[k] !== undefined && st[k] !== null) {
      const v = String(st[k]).trim();
      if (v && !/^(N\/A|—|-|null|undefined)$/i.test(v)) return v;
    }
  }
  return '';
}

export function getStudentRegNo(st) {
  if (!st) return '';
  const regKeys = [
    'Board Registration Number', 'Registration No.', 'Registration No',
    'Registration Number', 'Reg. No.', 'Reg. No', 'regNo', 'registrationNo',
    'reg_no', 'RegNo', 'Registration'
  ];
  for (const k of regKeys) {
    if (st[k] !== undefined && st[k] !== null) {
      const v = String(st[k]).trim();
      if (v && !/^(N\/A|—|-|null|undefined)$/i.test(v)) return v;
    }
  }
  return '';
}

export function findStudentMarkRecord(subDoc, student) {
  if (!subDoc || !subDoc.records || !Array.isArray(subDoc.records) || !student) return null;

  // STRICT SESSION ISOLATION: A practical submission for 2024-25 must NEVER map to a 2025-26 student!
  const subSess = String(subDoc.sessionText || subDoc.SessionText || subDoc.session || subDoc.Session || '').toLowerCase();
  const stSess = String(student.Session || student.session || (student._source === 'masterRegisters' ? '2024-25 (Oct-Nov)' : '2025-26')).toLowerCase();

  // If student is in current 2025-26 session, reject historical 2024-25 / 2023-24 submissions
  if (stSess.includes('2025') && !stSess.includes('2024-25')) {
    if (subSess.includes('2024') || subSess.includes('2023')) return null;
  }
  // If student is from historical 2024-25 session, reject 2025-26 submissions
  if (stSess.includes('2024') && (subSess.includes('2025-26') || subSess.includes('2026'))) {
    return null;
  }

  const stBoardReg = String(
    student['Board Reg. No.'] || student['Board Registration Number'] || student.boardRegNo ||
    student['Board Registration No. (Class 11th)'] || student['Board Registration No. (Class 10th)'] || ''
  ).trim().toUpperCase();
  const stExam = String(student['Exam R.No. (Current)'] || student.examRollNo || student['Exam Roll No'] || student['Exam Roll No.'] || '').trim().toUpperCase();
  const stClassRoll = String(
    student['Class R.No.'] || student['Class Roll No'] || student['Class Roll No.'] || student.classRollNo || student.rollNo || ''
  ).trim();
  const stName = String(
    student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || student.name || ''
  ).trim().toLowerCase();

  return subDoc.records.find(r => {
    const rBoardReg = String(r.boardRegNo || r['Board Reg. No.'] || r.regNo || r['Registration No.'] || '').trim().toUpperCase();
    const rExam     = String(r.examRollNo || '').trim().toUpperCase();
    const rClassRoll = String(r.classRollNo || r.classRoll || r['Class Roll No'] || r.sNo || '').trim();
    const rName = String(r.name || r.studentName || '').trim().toLowerCase();

    // 1. Board Registration No (Global unique key)
    if (stBoardReg && rBoardReg && stBoardReg === rBoardReg) return true;

    // 2. Exam Roll No (Session-unique key)
    if (stExam && rExam && stExam === rExam) return true;

    // 3. Class Roll No + Name verification
    if (stClassRoll && rClassRoll && stClassRoll === rClassRoll) {
      if (stName && rName) {
        return stName === rName || stName.includes(rName) || rName.includes(stName);
      }
      if (student._source === 'masterRegisters' || stSess.includes('2024')) return true;
    }

    // 4. Exact full name match
    if (stName && rName && stName.length > 4 && stName === rName) return true;

    return false;
  });
}

const PRINT_ENGINE_CSS = `
  @media print {
    @page { size: A4 portrait; margin: 6mm 6mm 6mm 6mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; margin: 0; padding: 0; font-size: 11pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-after: always; break-after: page; }
    .no-print { display: none !important; }
  }
  body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; margin: 0; padding: 0; }
  .award-page { width: 100%; max-width: 210mm; margin: 0 auto; box-sizing: border-box; padding: 10px; background: #fff; }
  
  /* 2-Column Award Roll Layout (Screenshot 2) */
  .two-col-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; align-items: start; }
  .award-col-box { width: 100%; box-sizing: border-box; }
  .award-header-block { font-size: 10.5pt; text-align: center; margin-bottom: 6px; line-height: 1.25; border-bottom: 1.5px solid #000; padding-bottom: 4px; }
  .award-header-block h2 { font-size: 12pt; font-weight: bold; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.5px; }
  .award-info-line { display: flex; justify-content: space-between; font-size: 9.5pt; font-weight: bold; margin-bottom: 3px; }
  
  table.award-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9.5pt; text-align: center; }
  table.award-table th, table.award-table td { border: 1.2px solid #000; padding: 3.5px 4px; }
  table.award-table th { background: #e2e8f0 !important; font-weight: bold; font-size: 8.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .centre-num-row { background: #fff; color: #cc0000; font-weight: bold; font-size: 10pt; text-align: center; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  .absent-text { color: #cc0000; font-weight: bold; }
  
  .award-footer { font-size: 8.5pt; font-weight: bold; line-height: 1.6; margin-top: 6px; border-top: 1.5px solid #000; padding-top: 4px; }
  .sig-row { display: flex; justify-content: space-between; margin-top: 12px; font-size: 8.5pt; font-weight: bold; }

  /* Consolidated Cover Letter & Table Matrix Layout (Screenshots 3 & 4) */
  .letter-container { font-size: 11pt; line-height: 1.6; padding: 25px 30px; font-family: 'Times New Roman', Times, serif; }
  .letter-header { font-weight: bold; margin-bottom: 25px; font-size: 12pt; }
  .letter-subj { font-weight: bold; text-decoration: underline; margin: 20px 0; font-size: 11.5pt; }
  .letter-body { text-align: justify; margin-bottom: 16px; text-indent: 25px; }
  .gist-table { width: 85%; margin: 20px auto; border-collapse: collapse; font-size: 9.5pt; }
  .gist-table th, .gist-table td { border: 1.2px solid #000; padding: 5px 10px; text-align: left; }
  .gist-table th { background: #e2e8f0 !important; text-align: center; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .gist-table td.num { text-align: center; font-weight: bold; }
  
  /* Matrix Table (Screenshot 3) */
  .matrix-title-block { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 6px; }
  .matrix-title-block h1 { font-size: 14pt; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
  .matrix-title-block h2 { font-size: 11pt; font-weight: bold; margin: 4px 0; }
  .matrix-title-block p { font-size: 9.5pt; margin: 2px 0; font-weight: bold; }
  
  table.matrix-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; text-align: center; }
  table.matrix-table th, table.matrix-table td { border: 1.2px solid #000; padding: 3px 2px; }
  table.matrix-table th { background: #dbeafe !important; font-weight: bold; font-size: 8pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.matrix-table td.mark-val { font-weight: bold; color: #1e3a8a; }
  table.matrix-table td.no-sub { color: #64748b; font-weight: normal; }
  table.matrix-table td.hash-tot { font-weight: bold; background: #f8fafc !important; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

function triggerPrintWindow(htmlContent) {
  const pwin = window.open('', '_blank');
  pwin.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Official Practical Award Roll — Govt HSS Shangus</title>
        <style>${PRINT_ENGINE_CSS}</style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  pwin.document.close();
}

/**
 * 1. Print Individual Subject Award Roll (Screenshot 2 Format)
 * 2-column side-by-side layout (50 students per page) with centre numbers & figures-to-words.
 */
export function printIndividualAwardRoll({
  subjectCode = 'BO',
  subjectName = 'Botany',
  className = '11th',
  session = 'Annual Regular 2025',
  records = [],
  isExternal = true,
  maxMarks = 10,
  minMarks = 4,
  centreNo = '201006'
}) {
  if (!records || records.length === 0) return false;

  const examType = isExternal ? 'External Practical' : 'Internal Practical';
  const totalRecs = records.length;
  const pageSize = 50; // 25 left + 25 right per A4 page
  const totalPages = Math.ceil(totalRecs / pageSize);

  let fullHtml = '';

  for (let p = 0; p < totalPages; p++) {
    const pageRecords = records.slice(p * pageSize, (p + 1) * pageSize);
    const leftChunk = pageRecords.slice(0, 25);
    const rightChunk = pageRecords.slice(25, 50);

    const leftPageNo = p * 2 + 1;
    const rightPageNo = p * 2 + 2;

    const renderColumn = (colChunk, startSno, pageNo) => {
      let colHtml = `
        <div class="award-col-box">
          <div class="award-header-block">
            <h2>${isExternal ? 'EXTERNAL' : 'INTERNAL'} PRACTICAL AWARD ROLL</h2>
            <div class="award-info-line">
              <span>Examination: <strong>${examType}</strong></span>
              <span>Page No.: <strong>${pageNo}</strong></span>
            </div>
            <div class="award-info-line">
              <span>Subject: <strong>${subjectName} (${subjectCode})</strong></span>
              <span>Max.: <strong>${maxMarks}</strong>; Min.: <strong>${minMarks}</strong></span>
            </div>
            <div class="award-info-line">
              <span>Session: <strong>${session}</strong></span>
            </div>
          </div>

          <table class="award-table">
            <thead>
              <tr>
                <th style="width: 12%;">S.No.</th>
                <th style="width: 28%;">Exam R.No.</th>
                <th style="width: 28%;">Marks<br>(Figures)</th>
                <th style="width: 32%;">Marks<br>(Words)</th>
              </tr>
            </thead>
            <tbody>
      `;

      let currentCentre = '';

      colChunk.forEach((r, idx) => {
        const sno = startSno + idx;
        const rollNo = r.rollNo || r.examRollNo || r['Exam Roll No.'] || r['Class Roll No'] || '—';
        const rawMark = String(r.totalMarks ?? r.practicalMarks ?? r.marks ?? '').trim();
        const isAbs = rawMark.toUpperCase() === 'AB' || rawMark.toUpperCase() === 'A' || rawMark.toUpperCase() === 'ABSENT';

        // Check centre number change
        const rCentre = r.centreNo || r['Centre No.'] || r['Centre'] || centreNo;
        if (rCentre && rCentre !== currentCentre) {
          currentCentre = rCentre;
          colHtml += `
            <tr>
              <td colspan="4" class="centre-num-row">centre no. ${currentCentre}</td>
            </tr>
          `;
        }

        colHtml += `
          <tr>
            <td>${sno}</td>
            <td><strong>${rollNo}</strong></td>
            <td>${isAbs ? '<span class="absent-text">Absent</span>' : `<strong>${rawMark || '—'}</strong>`}</td>
            <td>${isAbs ? '-' : numberToWordsInr(rawMark)}</td>
          </tr>
        `;
      });

      // Pad remaining empty rows to maintain 25 rows per column layout
      for (let pad = colChunk.length; pad < 25; pad++) {
        colHtml += `
          <tr>
            <td>${startSno + pad}</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        `;
      }

      colHtml += `
            </tbody>
          </table>

          <div class="award-footer">
            <div>No. of Candidates Present: __________ Absent: __________</div>
            <div>No. of Candidates Passed: __________ Failed: __________</div>
            <div class="sig-row">
              <div>Signature of Examiner: __________________</div>
            </div>
            <div style="margin-top: 4px;">Date of Submission of Awards: _______________</div>
            <div style="margin-top: 6px; text-align: right;">Signature of Head of Institution: __________________</div>
          </div>
        </div>
      `;
      return colHtml;
    };

    fullHtml += `
      <div class="award-page ${p < totalPages - 1 ? 'page-break' : ''}">
        <div class="two-col-grid">
          ${renderColumn(leftChunk, p * pageSize + 1, leftPageNo)}
          ${renderColumn(rightChunk, p * pageSize + 26, rightPageNo)}
        </div>
      </div>
    `;
  }

  triggerPrintWindow(fullHtml);
  return true;
}

/**
 * 2. Print Individual Work Sheet / Subject Marks Record (Screenshot 5 Format)
 */
export function printIndividualWorkSheet({
  subjectCode = 'BO',
  subjectName = 'Botany',
  className = '11th',
  session = 'Annual Regular 2025',
  records = []
}) {
  if (!records || records.length === 0) return false;

  let html = `
    <div class="award-page">
      <div style="text-align: center; margin-bottom: 12px; border-b: 2px solid #000; padding-bottom: 8px;">
        <h1 style="font-size: 14pt; font-weight: bold; margin: 0;">Govt. Higher Secondary School Shangus</h1>
        <h2 style="font-size: 11pt; font-weight: bold; margin: 4px 0;">Marks Record (Practicals/Assignments) - HSE-${className === '11th' ? 'I (Class 11th)' : 'II (Class 12th)'} - ${subjectName}</h2>
        <p style="font-size: 9.5pt; font-weight: bold; margin: 2px 0;">Session & Year: <strong>${session}</strong></p>
        <div style="display: flex; justify-content: space-between; font-size: 9pt; font-weight: bold; margin-top: 8px;">
          <span>No.: ____________________</span>
          <span>Date: ____________________</span>
        </div>
      </div>

      <table class="award-table" style="font-size: 9.5pt;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="width: 8%;">S.No.</th>
            <th style="width: 12%;">Class R.No.</th>
            <th style="width: 18%;">Exam R.No.</th>
            <th style="width: 32%; text-align: left; padding-left: 8px;">Student Name</th>
            <th style="width: 10%;">Prac./Assn.</th>
            <th style="width: 10%;">Viva-voce</th>
            <th style="width: 10%; background: #e2e8f0;">Overall</th>
          </tr>
        </thead>
        <tbody>
  `;

  records.forEach((r, idx) => {
    const isAbs = String(r.totalMarks ?? r.practicalMarks ?? '').toUpperCase() === 'AB';
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${r.classRollNo || r.rollNo || '—'}</td>
        <td><strong>${r.examRollNo || r.rollNo || '—'}</strong></td>
        <td style="text-align: left; padding-left: 8px;"><strong>${toTitleCase(r.name || r.studentName || '—')}</strong></td>
        <td>${r.pracMarks ?? r.practicalMarks ?? '—'}</td>
        <td>${r.vivaMarks ?? '—'}</td>
        <td style="background: #f8fafc;">${isAbs ? '<span class="absent-text">AB</span>' : `<strong>${r.totalMarks ?? r.practicalMarks ?? '—'}</strong>`}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <div class="sig-row" style="margin-top: 30px; font-size: 10pt;">
        <div>Subject Teacher Signature: __________________</div>
        <div>Principal Signature: __________________</div>
      </div>
    </div>
  `;

  triggerPrintWindow(html);
  return true;
}

/**
 * 3. Print Consolidated Practical Award Roll (Screenshots 3 & 4 Format)
 * Page 1: Official Forwarding Cover Letter addressed to Assistant Secretary, Sub Office Anantnag.
 * Page 2+: Subject-wise Hash Total Matrix Table.
 */
export function printConsolidatedAwardRoll({
  className = '11th',
  session = 'Annual Regular 2025',
  students = [],
  submissions = [],
  isExternal = false,
  selectedSubjectCodes = null,
  printDetails = null
}) {
  if (!students || students.length === 0) return false;

  const hseText = className === '11th' ? 'HSE-I (Class 11th)' : 'HSE-II (Class 12th)';
  
  // Filter subjects based on admin's subject checklist selection
  const activeSubs = PRACTICAL_SUBJECT_DEFS.filter(s => {
    if (!selectedSubjectCodes || !Array.isArray(selectedSubjectCodes) || selectedSubjectCodes.length === 0) return true;
    return selectedSubjectCodes.includes(s.code);
  });

  // Build subject gist count for Page 1 Forwarding Cover Letter (Screenshot 4)
  const gistList = activeSubs.map((sub, idx) => {
    let count = 0;

    if (sub.code === 'EN') {
      // General English is compulsory for ALL examinees in the class!
      count = students.length;
    } else {
      students.forEach(st => {
        const clsName = String(className).toLowerCase();
        const stStream = String(st.stream || st.Stream || st['Stream'] || '').toLowerCase();
        const stSubs = String(
          (clsName.includes('12') ? st['Subjects to be taken in Class 12th'] : st['Subjects to be taken in Class 11th']) || 
          st['Subjects'] || 
          st['Subject Combination'] || 
          st['streamSubjects'] || 
          st.subjects || 
          ''
        ).toLowerCase();

        let hasSub = false;

        // Physics & Chemistry are compulsory for ALL Science students!
        if (sub.code === 'PH' || sub.code === 'CH') {
          if (stStream.includes('science') || stSubs.includes('physics') || stSubs.includes('chemistry') || /\b(ph|ch)\b/i.test(stSubs)) {
            hasSub = true;
          }
        } else if (sub.code === 'BO' || sub.code === 'ZO') {
          if (stSubs.includes('botany') || stSubs.includes('zoology') || stSubs.includes('biology') || /\b(bo|zo|bi)\b/i.test(stSubs)) {
            hasSub = true;
          }
        } else {
          hasSub = sub.keywords.some(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'i');
            return regex.test(stSubs) || stSubs.includes(kw);
          });
        }

        if (hasSub) count++;
      });

      // Fallback count from submissions strictly FOR THIS CLASS if student subject string is empty
      if (count === 0 && submissions && submissions.length > 0) {
        const clsTarget = String(className).toLowerCase().includes('12') ? '12' : '11';
        const subDoc = submissions.find(s => {
          const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
          if (!matchClass) return false;
          const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
          return codeStr === sub.code || codeStr.includes(sub.code);
        });
        if (subDoc && subDoc.records) {
          count = subDoc.records.length;
        }
      }
    }

    return {
      sno: idx + 1,
      code: sub.code,
      name: sub.name,
      count
    };
  }).filter(g => g.count > 0);

  // ──────── PAGE 1: FORWARDING COVER LETTER (Screenshot 4) ────────
  let letterHtml = `
    <div class="award-page page-break">
      <div class="letter-container">
        <div class="letter-header">
          <strong>The Assistant Secretary,</strong><br>
          Sub Office Anantnag.
        </div>

        <div class="letter-subj">
          Subject: Submission of ${isExternal ? 'External' : 'Internal'} Practical Awards of ${hseText} Session ${session}.
        </div>

        <div className="letter-body">
          Sir,
        </div>

        <div class="letter-body">
          Apropos to the subject captioned above kindly find enclosed herewith the ${isExternal ? 'external' : 'internal'} practical awards (in triplicate) pertaining to <strong>${hseText} Examination, session ${session}</strong>, for the favour of further necessary action at your end please.
        </div>

        <div class="letter-body">
          Furthermore, this is <strong>certified</strong> that the ${isExternal ? 'external' : 'internal'} tests/examinations for all the examinees of the institution, who are going to appear in the said examination, had been conducted by the institution and <strong>none among the on-roll candidates have been skipped</strong> during the preparation of award rolls. The summary of the examinees with subject wise gist is as follows:
        </div>

        <table class="gist-table">
          <thead>
            <tr>
              <th style="width: 15%;">S.No.</th>
              <th style="width: 55%; text-align: left; padding-left: 10px;">Subject</th>
              <th style="width: 30%;">No. of Students</th>
            </tr>
          </thead>
          <tbody>
  `;

  gistList.forEach(g => {
    letterHtml += `
      <tr>
        <td style="text-align: center;">${g.sno}</td>
        <td style="padding-left: 10px;">${g.name} (${g.code})</td>
        <td class="num">${g.count}</td>
      </tr>
    `;
  });

  letterHtml += `
          </tbody>
        </table>

        <div style="margin-top: 40px; text-align: right; font-weight: bold; font-size: 11pt; padding-right: 20px;">
          Principal
        </div>
      </div>
    </div>
  `;

  // ──────── PAGE 2+: CONSOLIDATED MARKS GRID MATRIX (Screenshot 3) ────────
  let matrixHtml = `
    <div class="award-page">
      <div class="matrix-title-block">
        <h1>Govt. Higher Secondary School Shangus, Anantnag</h1>
        <h2>Record of ${isExternal ? 'External' : 'Internal Assessment'} Practical Awards Roll for the ${hseText} Examination</h2>
        <p>Session & Year: <strong>${session}</strong> &nbsp;|&nbsp; Institution Contact: <strong>9682641216</strong></p>
        <div style="display: flex; justify-content: space-between; font-size: 9pt; font-weight: bold; margin-top: 6px;">
          <span>No.: ____________________</span>
          <span>Date: ____________________</span>
        </div>
      </div>

      <table class="matrix-table">
        <thead>
          <tr>
            <th style="width: 4%;">S.No.</th>
            <th style="width: 14%;">Exam Roll No.</th>
            <th colspan="${activeSubs.length}">SUBJECTS</th>
            <th style="width: 10%;">Hash Total</th>
          </tr>
          <tr>
            <th></th>
            <th></th>
            ${activeSubs.map(s => `<th>${s.code}</th>`).join('')}
            <th></th>
          </tr>
        </thead>
        <tbody>
  `;

  // Build rows for each student
  const isClass12 = String(className).toLowerCase().includes('12');
  const clsTarget = isClass12 ? '12' : '11';

  students.forEach((st, idx) => {
    const rollNo = String(st['Class Roll No'] || st.rollNo || st.classRollNo || st['Class R.No.'] || (idx + 1)).trim();
    const stSubsStr = String(
      st['Subs'] ||
      st['subs'] ||
      (isClass12 ? st['Subjects to be taken in Class 12th'] : st['Subjects to be taken in Class 11th']) ||
      st['Subjects'] ||
      st['Subject Combination'] ||
      st.subjects ||
      ''
    ).toLowerCase();
    const stStream = String(
      st['Stream'] ||
      st['stream'] ||
      (isClass12 ? st['Stream for Class 12th'] : st['Stream for Class 11th']) ||
      ''
    ).toLowerCase();

    let rowHashTotal = 0;

    const cellHtmls = activeSubs.map(sub => {
      let isEnrolled = false;
      if (sub.code === 'EN') isEnrolled = true;
      else if (sub.code === 'PH' || sub.code === 'CH') {
        isEnrolled = stStream.includes('science') || stSubsStr.includes('physics') || stSubsStr.includes('chemistry') || /\b(ph|ch)\b/i.test(stSubsStr);
      } else if (sub.code === 'BO' || sub.code === 'ZO') {
        isEnrolled = stSubsStr.includes('botany') || stSubsStr.includes('zoology') || stSubsStr.includes('biology') || /\b(bo|zo|bi)\b/i.test(stSubsStr);
      } else {
        isEnrolled = sub.keywords.some(kw => {
          if (kw.length <= 3) return new RegExp(`\\b${kw}\\b`, 'i').test(stSubsStr);
          return stSubsStr.includes(kw);
        });
      }

      // Find mark from teacher submission strictly matching this class, subject & evaluation type (internal vs external)
      if (sub.code === 'BI') {
        const boDoc = submissions.find(s => {
          const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
          if (!matchClass) return false;
          const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
          if (sType !== (isExternal ? 'external' : 'internal')) return false;
          const codeStr = String(s.subjectCode || s.subject || '').toUpperCase();
          return codeStr === 'BO' || codeStr.includes('BO');
        });
        const zoDoc = submissions.find(s => {
          const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
          if (!matchClass) return false;
          const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
          if (sType !== (isExternal ? 'external' : 'internal')) return false;
          const codeStr = String(s.subjectCode || s.subject || '').toUpperCase();
          return codeStr === 'ZO' || codeStr.includes('ZO');
        });
        const boRec = findStudentMarkRecord(boDoc, st);
        const zoRec = findStudentMarkRecord(zoDoc, st);
        const boVal = parseInt(boRec?.totalMarks ?? boRec?.practicalMarks ?? '', 10);
        const zoVal = parseInt(zoRec?.totalMarks ?? zoRec?.practicalMarks ?? '', 10);
        if (!isNaN(boVal) || !isNaN(zoVal)) {
          const biTot = (isNaN(boVal) ? 0 : boVal) + (isNaN(zoVal) ? 0 : zoVal);
          rowHashTotal += biTot;
          return `<td class="mark-val">${biTot}</td>`;
        }
      }

      const subDoc = submissions.find(s => {
        const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
        if (!matchClass) return false;

        const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
        const targetType = isExternal ? 'external' : 'internal';
        if (sType !== targetType) return false;

        const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
        return codeStr === sub.code || codeStr.includes(sub.code);
      });

      const rec = findStudentMarkRecord(subDoc, st);

      if (rec) {
        const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim();
        const numVal = parseInt(rawMark, 10);
        if (!isNaN(numVal)) {
          rowHashTotal += numVal;
          return `<td class="mark-val">${numVal}</td>`;
        } else if (rawMark.toUpperCase() === 'AB') {
          return `<td style="color: #cc0000; font-weight: bold;">AB</td>`;
        }
      }

      if (isEnrolled) {
        return `<td class="mark-val">—</td>`;
      }

      return `<td class="no-sub">x</td>`;
    }).join('');

    matrixHtml += `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${rollNo}</strong></td>
        ${cellHtmls}
        <td class="hash-tot">${rowHashTotal > 0 ? rowHashTotal : '—'}</td>
      </tr>
    `;
  });

  const inchargeName = printDetails?.inchargeName || (className === '12th' ? 'Mr. Bilal Ahmad Khandy' : 'Mr. Majid Hassan Najar');
  const inchargeCpis = printDetails?.inchargeCpis || (className === '12th' ? 'KGLEDU00120015' : 'SHGEDU00220017');
  const inchargeMobile = printDetails?.inchargeMobile || (className === '12th' ? '9596165142' : '7006537425');

  const partText = className === '11th' ? 'Part-I (class 11th)' : 'Part-II (class 12th)';
  const testType = isExternal ? 'Practical Examination' : 'Internal Assessment';

  matrixHtml += `
        </tbody>
      </table>

      <div class="matrix-footer" style="margin-top: 24px; font-size: 10pt; font-family: 'Times New Roman', Times, serif; line-height: 1.4;">
        <div style="text-align: center; font-weight: bold; font-size: 11.5pt; margin-bottom: 6px;">Certificate</div>
        <p style="text-align: justify; margin: 0 0 16px 0; font-size: 10pt;">
          "Certified that the relevant data of ${testType} in respect of the above candidates who are appearing in Higher Secondary Examination ${partText} from this Institution is correct in all respects to the best of my knowledge and no further amendment or modifications in the above data shall be indicated or requested by the undersigned affecting the declared result of any candidate whatsoever"
        </p>

        <div style="margin-bottom: 20px; font-size: 10pt; font-weight: bold;">
          <div>Signature of Incharge ____________________</div>
          <div style="margin-top: 4px; font-weight: normal;">Name: <strong>${inchargeName}</strong></div>
          <div style="font-weight: normal;">CPIS: <strong>${inchargeCpis}</strong></div>
          <div style="font-weight: normal;">Mobile: <strong>${inchargeMobile}</strong></div>
        </div>

        <div style="font-weight: bold; margin-bottom: 10px; font-size: 10pt;">Signature of Examiner/s</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); row-gap: 14px; column-gap: 12px; font-size: 9.5pt; margin-bottom: 35px;">
          <div>1. ....................................</div>
          <div>2. ....................................</div>
          <div>3. ....................................</div>
          <div>4. ....................................</div>
          <div>5. ....................................</div>
          <div>6. ....................................</div>
          <div>7. ....................................</div>
          <div>8. ....................................</div>
          <div>9. ....................................</div>
          <div>10. ...................................</div>
          <div>11. ...................................</div>
          <div>12. ...................................</div>
        </div>

        <div style="text-align: right; font-weight: bold; font-size: 11.5pt; padding-right: 30px; margin-top: 20px;">
          Principal
        </div>
      </div>
    </div>
  `;

  triggerPrintWindow(letterHtml + matrixHtml);
  return true;
}

/**
 * 4. Print Attendance Sheet for Selected Students
 */
export function printAttendanceSheet({ className = '11th', session = 'Annual Regular 2025', students = [], isExternal = false }) {
  if (!students || students.length === 0) return false;
  const hseText = className === '11th' ? 'HSE-I (Class 11th)' : 'HSE-II (Class 12th)';
  const examType = isExternal ? 'EXTERNAL PRACTICAL' : 'INTERNAL ASSESSMENT';

  let html = `
    <div class="award-page">
      <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px;">
        <h1 style="font-size: 14pt; font-weight: bold; margin: 0;">Govt. Higher Secondary School Shangus</h1>
        <h2 style="font-size: 11pt; font-weight: bold; margin: 4px 0;">${examType} ATTENDANCE SHEET — ${hseText}</h2>
        <p style="font-size: 9.5pt; font-weight: bold; margin: 2px 0;">Session & Year: <strong>${session}</strong></p>
      </div>

      <table class="award-table" style="font-size: 9.5pt;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="width: 8%;">S.No.</th>
            <th style="width: 14%;">Exam Roll No.</th>
            <th style="width: 38%; text-align: left; padding-left: 8px;">Student Name</th>
            <th style="width: 20%;">Stream</th>
            <th style="width: 20%;">Candidate Signature</th>
          </tr>
        </thead>
        <tbody>
  `;

  students.forEach((st, idx) => {
    const rollNo = st['Class Roll No'] || st.rollNo || st.examRollNo || st['Exam Roll No.'] || `20100${2000 + idx}`;
    const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
    const stream = st['Stream for Class 11th'] || st['Stream'] || st.stream || 'Humanities';

    html += `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${rollNo}</strong></td>
        <td style="text-align: left; padding-left: 8px;"><strong>${name}</strong></td>
        <td>${stream}</td>
        <td>&nbsp;</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <div class="sig-row" style="margin-top: 30px; font-size: 10pt;">
        <div>Superintendent Signature: __________________</div>
        <div>Principal Signature: __________________</div>
      </div>
    </div>
  `;

  triggerPrintWindow(html);
  return true;
}

/**
 * 5. Print Fail / Absent Student List
 */
export function printFailList({ className = '11th', session = 'Annual Regular 2025', students = [], submissions = [], selectedSubjectCodes = null, isExternal = false }) {
  if (!students || students.length === 0) return false;
  const hseText = className === '11th' ? 'HSE-I (Class 11th)' : 'HSE-II (Class 12th)';
  const examType = isExternal ? 'External Practical' : 'Internal Assessment';

  const activeSubs = PRACTICAL_SUBJECT_DEFS.filter(s => {
    if (!selectedSubjectCodes || !Array.isArray(selectedSubjectCodes) || selectedSubjectCodes.length === 0) return true;
    return selectedSubjectCodes.includes(s.code);
  });

  let failRecords = [];

  students.forEach((st) => {
    const rollNo = st['Class Roll No'] || st.rollNo || st.examRollNo || st['Exam Roll No.'] || '—';
    const name = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';

    activeSubs.forEach(sub => {
      const subDoc = submissions.find(s => {
        const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(className.toLowerCase().replace(/[^0-9]/g, ''));
        if (!matchClass) return false;

        const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
        const targetType = isExternal ? 'external' : 'internal';
        if (sType !== targetType) return false;

        const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
        return codeStr === sub.code || codeStr.includes(sub.code);
      });
      const rec = findStudentMarkRecord(subDoc, st);
      if (rec) {
        const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim().toUpperCase();
        if (rawMark === 'AB' || rawMark === 'A' || rawMark === 'ABSENT' || rawMark === 'FAIL') {
          failRecords.push({ rollNo, name, subject: `${sub.name} (${sub.code})`, status: 'ABSENT / FAIL' });
        }
      }
    });
  });

  let html = `
    <div class="award-page">
      <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #cc0000; padding-bottom: 8px;">
        <h1 style="font-size: 14pt; font-weight: bold; margin: 0; color: #cc0000;">Govt. Higher Secondary School Shangus</h1>
        <h2 style="font-size: 11pt; font-weight: bold; margin: 4px 0;">ABSENTEE / FAIL STUDENTS LIST (${examType}) — ${hseText}</h2>
        <p style="font-size: 9.5pt; font-weight: bold; margin: 2px 0;">Session & Year: <strong>${session}</strong></p>
      </div>

      <table class="award-table" style="font-size: 9.5pt;">
        <thead>
          <tr style="background: #fee2e2;">
            <th style="width: 10%;">S.No.</th>
            <th style="width: 20%;">Exam Roll No.</th>
            <th style="width: 35%; text-align: left; padding-left: 8px;">Student Name</th>
            <th style="width: 20%;">Subject</th>
            <th style="width: 15%;">Remarks</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (failRecords.length === 0) {
    html += `<tr><td colspan="5" style="padding: 20px; text-align: center; font-weight: bold; color: green;">All examinees passed. Zero absentees/fails found.</td></tr>`;
  } else {
    failRecords.forEach((f, idx) => {
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${f.rollNo}</strong></td>
          <td style="text-align: left; padding-left: 8px;"><strong>${f.name}</strong></td>
          <td>${f.subject}</td>
          <td style="color: #cc0000; font-weight: bold;">${f.status}</td>
        </tr>
      `;
    });
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  triggerPrintWindow(html);
  return true;
}
