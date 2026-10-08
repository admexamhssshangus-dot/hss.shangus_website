// =================================================================
// HSS SHANGUS — Custom Student Roster Print, PDF, Excel & CSV Utilities
// =================================================================

import * as XLSX from 'xlsx';

/**
 * Resolves the primary roll column to display for 2-column examination attendance sheets.
 * Respects user's activeColumns order:
 * - If only examRollNo is present -> 'Exam R.No.' (isExam: true)
 * - If only classRollNo is present -> 'R.No.' (isExam: false)
 * - If BOTH are present -> whichever appears FIRST in columns takes priority!
 * - Default -> 'R.No.' (isExam: false)
 */
export function resolveAttendanceRollCol(columns = []) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return { key: 'classRollNo', label: 'R.No.', isExam: false };
  }

  const classIdx = columns.findIndex(c => c.key === 'classRollNo');
  const examIdx = columns.findIndex(c => c.key === 'examRollNo');

  if (examIdx !== -1 && classIdx === -1) {
    const colDef = columns[examIdx];
    const label = colDef?.label?.includes('Exam') ? 'Exam R.No.' : (colDef?.label || 'Exam R.No.');
    return { key: 'examRollNo', label, isExam: true };
  }

  if (classIdx !== -1 && examIdx === -1) {
    const colDef = columns[classIdx];
    const label = colDef?.label || 'R.No.';
    return { key: 'classRollNo', label, isExam: false };
  }

  if (classIdx !== -1 && examIdx !== -1) {
    // Both active: respect column order
    if (classIdx < examIdx) {
      const colDef = columns[classIdx];
      return { key: 'classRollNo', label: colDef?.label || 'R.No.', isExam: false };
    } else {
      const colDef = columns[examIdx];
      const label = colDef?.label?.includes('Exam') ? 'Exam R.No.' : (colDef?.label || 'Exam R.No.');
      return { key: 'examRollNo', label, isExam: true };
    }
  }

  return { key: 'classRollNo', label: 'R.No.', isExam: false };
}

/**
 * Extracts the appropriate roll value for a candidate row based on rollColInfo.
 */
export function getAttendanceStudentRoll(student, rollColInfo, fallbackIdx = 1) {
  if (!student) return '';
  const isExam = rollColInfo?.isExam;
  const raw = student._rawStudent || student;

  if (isExam) {
    const examVal = student.examRollNo || raw.examRollNo || raw.currExamRollNo;
    if (examVal && examVal !== '—' && examVal !== '-') return String(examVal).trim();
    const classVal = student.classRollNo || raw.classRollNo || raw.rollNo;
    if (classVal && classVal !== '—' && classVal !== '-') return String(classVal).trim();
    return student.sno ? String(student.sno) : String(fallbackIdx);
  } else {
    const classVal = student.classRollNo || raw.classRollNo || raw.rollNo;
    if (classVal && classVal !== '—' && classVal !== '-') return String(classVal).trim();
    const examVal = student.examRollNo || raw.examRollNo || raw.currExamRollNo;
    if (examVal && examVal !== '—' && examVal !== '-') return String(examVal).trim();
    return student.sno ? String(student.sno) : String(fallbackIdx);
  }
}

/**
 * Print or Save PDF via Browser Print Engine with official institution letterhead,
 * clean repeating headers, configurable row heights, and signatory blocks.
 */
export function printCustomRosterTable({
  title = 'STUDENT ROSTER & RECORD SHEET',
  subtitle = '',
  metaBadges = [],
  columns = [],
  rows = [],
  orientation = 'portrait',
  rowHeightPx = 36,
  signatories = ['Incharge Admissions & Exam', 'Principal'],
  layoutMode = 'standard',
  examDetails = {},
  rowsPerColumn = 25,
  institutionName = 'GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS',
  institutionSubtitle = 'District Anantnag, Kashmir — 192201 | Official Institutional Record',
  showHeader = true,
  showMetaBadges = true,
  tableFontSize = '9px'
}) {
  if (layoutMode === 'two_column_attendance') {
    const rollColInfo = resolveAttendanceRollCol(columns);
    const attHtml = buildTwoColumnAttendanceHtml({
      title,
      examDetails,
      rows,
      rowHeightPx,
      signatories,
      rowsPerColumn,
      rollColInfo,
      tableFontSize
    });
    return executePrintIframe(attHtml, title);
  }

  const isLandscape = orientation === 'landscape';

  const metaHtml = (showMetaBadges && metaBadges.length > 0)
    ? `<div class="meta-bar">${metaBadges.map(b => `<span>${b}</span>`).join('<span class="meta-sep">|</span>')}</div>`
    : '';

  const totalPct = columns.reduce((acc, c) => acc + (Number(c.widthPct) || 10), 0);
  const tableHeaders = columns.map(col => {
    const w = totalPct > 0 ? ((Number(col.widthPct) || 10) / totalPct) * 100 : (100 / columns.length);
    return `<th style="width: ${w.toFixed(2)}%; text-align: ${col.align || 'left'};">${col.label || col.key}</th>`;
  }).join('');

  const tableRows = rows.map((row, idx) => {
    const cells = columns.map(col => {
      let val = '';
      if (col.key === 'sno') {
        val = idx + 1;
      } else if (col.key === 'studentPhoto' || col.key === 'photo') {
        const photoSrc = row.studentPhoto || row[col.key];
        if (photoSrc && typeof photoSrc === 'string' && photoSrc.trim() && photoSrc !== '—' && photoSrc !== 'N/A') {
          val = `<div style="display:flex; align-items:center; justify-content:center; padding:1px 0;">
            <img src="${photoSrc}" alt="Photo" style="width:28px; height:34px; object-fit:cover; border-radius:2px; border:1px solid #9ca3af; display:block;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
            <div style="display:none; width:28px; height:34px; border:1px dashed #cbd5e1; border-radius:2px; align-items:center; justify-content:center; font-size:6pt; color:#9ca3af;">Photo</div>
          </div>`;
        } else {
          val = `<div style="width:28px; height:34px; border:1px dashed #cbd5e1; border-radius:2px; margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:6pt; color:#9ca3af;">Photo</div>`;
        }
      } else if (col.key === 'parentage' && row.fatherName && row.fatherName !== '—' && row.motherName && row.motherName !== '—') {
        val = `<div style="line-height:1.15; padding:1px 0;"><div style="font-weight:600;">${row.fatherName} <span style="font-size:7pt; color:#6b7280;">(F)</span></div><div style="font-size:7.5pt; color:#4b5563;">${row.motherName} <span style="font-size:7pt; color:#6b7280;">(M)</span></div></div>`;
      } else if (col.isCustom) {
        val = row[col.key] !== undefined ? row[col.key] : (col.defaultValue || '');
      } else {
        val = row[col.key] !== undefined ? row[col.key] : '—';
      }
      return `<td style="height: ${rowHeightPx}px; text-align: ${col.align || 'left'};">${val}</td>`;
    }).join('');

    return `<tr>${cells}</tr>`;
  }).join('');

  const signatoryHtml = signatories.map(sig => {
    return `
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-title">${sig}</div>
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - HSS Shangus</title>
      <style>
        @page {
          size: A4 ${isLandscape ? 'landscape' : 'portrait'};
          margin: 0.5in;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #111827;
          background: #ffffff;
          margin: 0;
          padding: 0;
          width: 100%;
          max-width: 100%;
          font-size: 10px;
        }
        .header-container {
          text-align: center;
          border-bottom: 2px solid #800000;
          padding-bottom: 4px;
          margin-bottom: 5px;
          width: 100%;
        }
        .inst-title {
          font-size: 14.5px;
          font-weight: 900;
          color: #800000;
          letter-spacing: 0.3px;
          margin: 0;
        }
        .inst-sub {
          font-size: 9px;
          color: #4b5563;
          margin: 1px 0 4px 0;
        }
        .doc-title {
          font-size: 11.5px;
          font-weight: 800;
          text-transform: uppercase;
          color: #111827;
          text-decoration: underline;
          margin: 3px 0 1px 0;
        }
        .doc-sub {
          font-size: 9px;
          color: #6b7280;
          font-style: italic;
          margin-bottom: 3px;
        }
        .meta-bar {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          font-size: 9.5px;
          font-weight: 700;
          color: #374151;
          margin: 3px 0 1px 0;
        }
        .meta-sep {
          color: #9ca3af;
        }
        table {
          width: 100%;
          max-width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          margin-top: 4px;
          page-break-inside: auto;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        thead {
          display: table-header-group;
        }
        th {
          background-color: #f3f4f6 !important;
          color: #111827;
          font-weight: 900;
          font-size: ${tableFontSize ? `calc(${tableFontSize} - 0.5px)` : '8.5px'};
          text-transform: uppercase;
          border: 1px solid #374151;
          padding: 4px 2.5px;
          letter-spacing: 0.1px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          word-break: break-word;
          overflow: hidden;
        }
        td {
          border: 1px solid #6b7280;
          padding: 2.5px 3.5px;
          font-size: ${tableFontSize || '9px'};
          vertical-align: middle;
          word-wrap: break-word;
          overflow-wrap: break-word;
          word-break: break-word;
          overflow: hidden;
          line-height: 1.2;
        }
        .signatories-container {
          display: flex;
          justify-content: space-between;
          margin-top: 28px;
          page-break-inside: avoid;
          padding: 0 15px;
          width: 100%;
        }
        .sig-box {
          text-align: center;
          width: 160px;
        }
        .sig-line {
          border-bottom: 1.5px solid #4b5563;
          margin-bottom: 4px;
        }
        .sig-title {
          font-weight: 800;
          font-size: 9.5px;
          color: #111827;
          text-transform: uppercase;
        }
        @media print {
          html, body {
            padding: 0;
            margin: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      ${showHeader !== false ? `
      <div class="header-container">
        <div class="inst-title">${institutionName || 'GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS'}</div>
        <div class="inst-sub">${institutionSubtitle || 'District Anantnag, Kashmir — 192201 | Official Institutional Record'}</div>
        <div class="doc-title">${title}</div>
        ${subtitle ? `<div class="doc-sub">${subtitle}</div>` : ''}
        ${metaHtml}
      </div>` : `
      <div class="header-container" style="border-bottom: 1.5px solid #111827; padding-bottom: 4px; margin-bottom: 8px;">
        <div class="doc-title">${title}</div>
        ${subtitle ? `<div class="doc-sub">${subtitle}</div>` : ''}
        ${metaHtml}
      </div>`}

      <table>
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="signatories-container">
        ${signatoryHtml}
      </div>
    </body>
    </html>
  `;

  return executePrintIframe(html, title);
}

/**
 * Reusable helper to send HTML to an offscreen iframe and trigger browser print.
 */
function executePrintIframe(html, title = 'Document') {
  const isMobile = typeof navigator !== 'undefined' && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768);

  // On mobile browsers, hidden iframes cannot open the native print dialog.
  // We use window.open directly for seamless mobile printing.
  if (isMobile) {
    try {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          try {
            printWin.print();
          } catch (e) {
            console.warn('Mobile print window invocation note:', e);
          }
        }, 500);
        return;
      }
    } catch (popupErr) {
      console.warn('Mobile print window popup blocked, falling back to iframe print:', popupErr);
    }
  }

  // Remove existing iframe to prevent stale state or listeners
  const existingFrame = document.getElementById('custom-roster-print-frame');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'custom-roster-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '1024px';
  iframe.style.height = '768px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.warn('Iframe print failed, falling back to popup window:', err);
      try {
        const fallbackWin = window.open('', '_blank');
        if (fallbackWin) {
          fallbackWin.document.open();
          fallbackWin.document.write(html);
          fallbackWin.document.close();
          fallbackWin.focus();
          setTimeout(() => {
            try { fallbackWin.print(); } catch (_) {}
          }, 350);
        }
      } catch (_) {}
    }
  };

  const images = Array.from(doc.images || []);
  if (images.length === 0) {
    setTimeout(triggerPrint, 250);
  } else {
    const imagePromises = images.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });

    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));
    Promise.race([Promise.all(imagePromises), timeoutPromise]).then(() => {
      setTimeout(triggerPrint, 200);
    });
  }
}

/**
 * Render official Two-Column Daily Attendance Sheet HTML matching institution examination standards.
 */
function buildTwoColumnAttendanceHtml({
  title = 'DAILY ATTENDANCE SHEET',
  examDetails = {},
  rows = [],
  rowHeightPx = 36,
  signatories = ['Sig. of the Asstt. Supdt.', 'Sig. of the Centre Supdt.'],
  rowsPerColumn = 25,
  hasExamRollCol = false,
  rollColInfo = null,
  tableFontSize = '9px'
}) {
  const activeRollCol = rollColInfo || (hasExamRollCol ? { key: 'examRollNo', label: 'Exam R.No.', isExam: true } : { key: 'classRollNo', label: 'R.No.', isExam: false });
  const isExam = activeRollCol.isExam;
  const rollLabel = activeRollCol.label || (isExam ? 'Exam R.No.' : 'R.No.');
  const studentsPerCol = Math.max(10, Math.min(60, Number(rowsPerColumn) || 25));
  const studentsPerPage = studentsPerCol * 2;

  // Chunk students into pages
  const pages = [];
  if (rows.length <= studentsPerPage) {
    const half = Math.ceil(rows.length / 2);
    pages.push({
      left: rows.slice(0, half),
      right: rows.slice(half)
    });
  } else {
    for (let p = 0; p < rows.length; p += studentsPerPage) {
      const pageSlice = rows.slice(p, p + studentsPerPage);
      const half = Math.ceil(pageSlice.length / 2);
      pages.push({
        left: pageSlice.slice(0, half),
        right: pageSlice.slice(half)
      });
    }
  }

  const examNameText = examDetails.examName ? `<b>${examDetails.examName}</b>` : '...........................................................................';
  const examYearText = examDetails.examYear ? `<b>${examDetails.examYear}</b>` : '.....................................';
  const classText = examDetails.className ? `<b>${examDetails.className}</b>` : '..................................';
  const dateText = examDetails.examDate ? `<b>${examDetails.examDate}</b>` : '..................................';
  const subjectText = examDetails.subjectName ? `<b>${examDetails.subjectName}</b>` : '..................................';
  const paperText = examDetails.paper ? `<b>${examDetails.paper}</b>` : '..................................';

  const renderTableRows = (studentList, startIdx = 0) => {
    return studentList.map((st, i) => {
      const roll = getAttendanceStudentRoll(st, activeRollCol, startIdx + i + 1);
      const name = st.studentName || st.name || '—';
      return `
        <tr style="height: ${rowHeightPx}px;">
          <td class="rno-cell">${roll}</td>
          <td class="name-cell">${name}</td>
          <td class="sig-cell"></td>
        </tr>
      `;
    }).join('');
  };

  const pagesHtml = pages.map((pg, pageIdx) => {
    const leftStart = pageIdx * studentsPerPage;
    const rightStart = leftStart + pg.left.length;
    const bannerBgStyle = examDetails.bannerBg === 'white'
      ? 'background: #ffffff; color: #020617; border-color: #020617;'
      : examDetails.bannerBg === 'amber'
      ? 'background: #fef3c7; color: #78350f; border-color: #92400e;'
      : examDetails.bannerBg === 'indigo'
      ? 'background: #e0e7ff; color: #1e1b4b; border-color: #312e81;'
      : 'background: #cbd5e1; color: #020617; border-color: #1e293b;';

    const showBanner = examDetails.showInstBanner !== false;
    const bannerText = examDetails.instBanner || 'Govt. Higher Secondary School Shangus, Anantnag';
    const isUnderline = examDetails.titleUnderline !== false;
    const examNameLabel = examDetails.examNameLabel || 'Name of the Examination';
    const examYearLabel = examDetails.examYearLabel || 'Year';
    const classLabel = examDetails.classLabel || 'Class';
    const dateLabel = examDetails.dateLabel || 'Date';
    const subjectLabel = examDetails.subjectLabel || 'Subject';
    const paperLabel = examDetails.paperLabel || 'Paper';
    const centreText = examDetails.centre ? `<b>${examDetails.centre}</b>` : '';
    const centreLabel = examDetails.centreLabel || 'Centre No.';
    const leftSigTitle = examDetails.sigLeft || signatories[0] || 'Sig. of the Asstt. Supdt.';
    const rightSigTitle = examDetails.sigRight || signatories[1] || 'Sig. of the Centre Supdt.';

    return `
      <div class="attendance-page">
        ${showBanner ? `
        <div class="inst-banner-box" style="${bannerBgStyle}">
          ${bannerText}
        </div>` : ''}
        <div class="attendance-title" style="${isUnderline ? 'text-decoration: underline;' : 'text-decoration: none;'}">${title || 'DAILY ATTENDANCE SHEET'}</div>
        
        <div class="exam-info-container">
          <div class="exam-info-row">
            <div class="exam-field" style="flex: 2.2;">
              ${examNameLabel} <span class="dots">${examNameText}</span>
            </div>
            <div class="exam-field" style="flex: 1; text-align: right;">
              ${examYearLabel} <span class="dots">${examYearText}</span>
            </div>
          </div>
          <div class="exam-info-row" style="margin-top: 5px;">
            <div class="exam-field" style="flex: 1.1;">
              ${classLabel} <span class="dots">${classText}</span>
            </div>
            <div class="exam-field" style="flex: 1.1;">
              ${dateLabel} <span class="dots">${dateText}</span>
            </div>
            <div class="exam-field" style="flex: 1.4;">
              ${subjectLabel} <span class="dots">${subjectText}</span>
            </div>
            <div class="exam-field" style="flex: 1.1; text-align: right;">
              ${paperLabel} <span class="dots">${paperText}</span>
            </div>
            ${centreText ? `
            <div class="exam-field" style="flex: 1.1; text-align: right;">
              ${centreLabel} <span class="dots">${centreText}</span>
            </div>` : ''}
          </div>
        </div>

        <div class="two-col-grid">
          <div class="half-col">
            <table class="att-table">
              <thead>
                <tr>
                  <th style="width: ${isExam ? '17%' : '14%'};">${rollLabel}</th>
                  <th style="width: ${isExam ? '51%' : '54%'};">Name of the Candidate</th>
                  <th style="width: 32%;">Sig. of the Candidate</th>
                </tr>
              </thead>
              <tbody>
                ${renderTableRows(pg.left, leftStart)}
              </tbody>
            </table>
          </div>
          <div class="col-divider"></div>
          <div class="half-col">
            <table class="att-table">
              <thead>
                <tr>
                  <th style="width: ${isExam ? '17%' : '14%'};">${rollLabel}</th>
                  <th style="width: ${isExam ? '51%' : '54%'};">Name of the Candidate</th>
                  <th style="width: 32%;">Sig. of the Candidate</th>
                </tr>
              </thead>
              <tbody>
                ${renderTableRows(pg.right, rightStart)}
              </tbody>
            </table>
          </div>
        </div>

        <div class="att-signatories">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-title">${leftSigTitle}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-title">${rightSigTitle}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - HSS Shangus</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 0.35in 0.45in;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #111827;
          background: #ffffff;
          margin: 0;
          padding: 0;
          width: 100%;
          font-size: 9.5px;
        }
        .attendance-page {
          page-break-after: always;
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }
        .attendance-page:last-child {
          page-break-after: avoid;
        }
        .inst-banner-box {
          background: #cbd5e1 !important;
          border: 1.5px solid #334155;
          color: #0f172a;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.2px;
          text-align: center;
          padding: 3.5px 6px;
          border-radius: 2px;
          font-family: "Segoe UI", Arial, sans-serif;
        }
        .attendance-title {
          font-size: 13.5px;
          font-weight: 900;
          text-align: center;
          text-transform: uppercase;
          text-decoration: underline;
          margin: 6px 0 5px 0;
          letter-spacing: 0.5px;
          color: #000000;
        }
        .exam-info-container {
          margin: 2px 0 6px 0;
          font-size: 9.5px;
          font-weight: 600;
          color: #111827;
        }
        .exam-info-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
        }
        .dots {
          letter-spacing: 1px;
          color: #374151;
          font-weight: 700;
        }
        .two-col-grid {
          display: flex;
          gap: 8px;
          flex: 1;
          align-items: flex-start;
          width: 100%;
        }
        .half-col {
          flex: 1;
          min-width: 0;
        }
        .col-divider {
          width: 1.5px;
          background-color: transparent;
        }
        .att-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .att-table th {
          background: #f1f5f9 !important;
          color: #0f172a;
          font-weight: 900;
          font-size: ${tableFontSize ? `calc(${tableFontSize} - 0.5px)` : '8.5px'};
          border: 1.5px solid #1e293b;
          padding: 3.5px 2px;
          text-align: left;
          letter-spacing: 0.1px;
        }
        .att-table th:first-child {
          text-align: center;
        }
        .att-table th:last-child {
          text-align: center;
        }
        .att-table td {
          border: 1.2px solid #475569;
          padding: 2px 3.5px;
          font-size: ${tableFontSize || '9px'};
          vertical-align: middle;
        }
        .rno-cell {
          text-align: center;
          font-weight: 700;
          color: #0f172a;
        }
        .name-cell {
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #111827;
        }
        .sig-cell {
          background: #ffffff;
        }
        .att-signatories {
          display: flex;
          justify-content: space-between;
          margin-top: 18px;
          padding: 0 25px 5px 25px;
          page-break-inside: avoid;
        }
        .sig-box {
          text-align: center;
          width: 180px;
        }
        .sig-line {
          border-bottom: 1.5px solid #334155;
          margin-bottom: 4px;
        }
        .sig-title {
          font-weight: 800;
          font-size: 9px;
          color: #0f172a;
          text-transform: uppercase;
        }
        @media print {
          html, body {
            margin: 0;
            padding: 0;
          }
          .attendance-page {
            height: 100%;
          }
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;
}

/**
 * Export customized student roster data to Excel (.xlsx).
 * Supports both standard 1-column table and 2-column examination attendance structure.
 */
export function exportCustomRosterExcel({
  title = 'Student_Roster',
  columns = [],
  rows = [],
  layoutMode = 'standard',
  examDetails = {}
}) {
  if (layoutMode === 'two_column_attendance') {
    const rollColInfo = resolveAttendanceRollCol(columns);
    const half = Math.ceil(rows.length / 2);
    const examName = examDetails.examName || '...........................................';
    const examYear = examDetails.examYear || '.............................';
    const className = examDetails.className || '..................';
    const examDate = examDetails.examDate || '..................';
    const subjectName = examDetails.subjectName || '..................';
    const paper = examDetails.paper || '..................';

    const bannerText = examDetails.instBanner || 'Govt. Higher Secondary School Shangus, Anantnag';
    const examNameLabel = examDetails.examNameLabel || 'Name of the Examination';
    const examYearLabel = examDetails.examYearLabel || 'Year';
    const classLabel = examDetails.classLabel || 'Class';
    const dateLabel = examDetails.dateLabel || 'Date';
    const subjectLabel = examDetails.subjectLabel || 'Subject';
    const paperLabel = examDetails.paperLabel || 'Paper';
    const centreStr = examDetails.centre ? ` | ${examDetails.centreLabel || 'Centre No.'}: ${examDetails.centre}` : '';

    const wsData = [
      ...(examDetails.showInstBanner !== false ? [[bannerText]] : []),
      [title || 'DAILY ATTENDANCE SHEET'],
      [`${examNameLabel}: ${examName}`, '', '', '', `${examYearLabel}: ${examYear}`],
      [`${classLabel}: ${className}`, `${dateLabel}: ${examDate}`, `${subjectLabel}: ${subjectName}`, '', `${paperLabel}: ${paper}${centreStr}`],
      [],
      [rollColInfo.label, 'Name of the Candidate', 'Sig. of the Candidate', '', rollColInfo.label, 'Name of the Candidate', 'Sig. of the Candidate']
    ];

    for (let i = 0; i < half; i++) {
      const left = rows[i];
      const right = rows[half + i];
      const leftRoll = left ? getAttendanceStudentRoll(left, rollColInfo, i + 1) : '';
      const leftName = left ? (left.studentName || left.name || '') : '';
      const rightRoll = right ? getAttendanceStudentRoll(right, rollColInfo, half + i + 1) : '';
      const rightName = right ? (right.studentName || right.name || '') : '';

      wsData.push([leftRoll, leftName, '', '', rightRoll, rightName, '']);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 9 },  // A: Left R.No.
      { wch: 30 }, // B: Left Name
      { wch: 22 }, // C: Left Signature
      { wch: 3 },  // D: Gap
      { wch: 9 },  // E: Right R.No.
      { wch: 30 }, // F: Right Name
      { wch: 22 }  // G: Right Signature
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    const filename = `${(title || 'Attendance_Sheet').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    return;
  }

  const headers = columns.map(c => c.label || c.key);
  const data = rows.map((r, idx) => {
    return columns.map(c => {
      if (c.key === 'sno') return idx + 1;
      if (c.isCustom) return r[c.key] !== undefined ? r[c.key] : (c.defaultValue || '');
      return r[c.key] !== undefined ? r[c.key] : '';
    });
  });

  const wsData = [headers, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-fit column widths
  const colWidths = columns.map((col, i) => {
    let maxLen = (col.label || col.key).length;
    data.forEach(row => {
      const cellLen = String(row[i] || '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Roster');

  const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Export customized student roster data to CSV.
 * Supports both standard 1-column table and 2-column examination attendance structure.
 */
export function exportCustomRosterCsv({
  title = 'Student_Roster',
  columns = [],
  rows = [],
  layoutMode = 'standard'
}) {
  if (layoutMode === 'two_column_attendance') {
    const rollColInfo = resolveAttendanceRollCol(columns);
    const half = Math.ceil(rows.length / 2);
    const csvLines = [
      `"${rollColInfo.label}","Name of the Candidate","Sig. of the Candidate","","${rollColInfo.label}","Name of the Candidate","Sig. of the Candidate"`
    ];

    for (let i = 0; i < half; i++) {
      const left = rows[i];
      const right = rows[half + i];
      const leftRoll = left ? getAttendanceStudentRoll(left, rollColInfo, i + 1) : '';
      const leftName = left ? (left.studentName || left.name || '') : '';
      const rightRoll = right ? getAttendanceStudentRoll(right, rollColInfo, half + i + 1) : '';
      const rightName = right ? (right.studentName || right.name || '') : '';

      csvLines.push(`"${leftRoll}","${leftName.replace(/"/g, '""')}","","","${rightRoll}","${rightName.replace(/"/g, '""')}",""`);
    }

    const csvContent = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'Attendance_Sheet').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const headers = columns.map(c => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(',');
  const csvRows = rows.map((r, idx) => {
    return columns.map(c => {
      let val = '';
      if (c.key === 'sno') val = String(idx + 1);
      else if (c.isCustom) val = r[c.key] !== undefined ? String(r[c.key]) : (c.defaultValue || '');
      else val = r[c.key] !== undefined ? String(r[c.key]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headers, ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const customRosterExportUtils = {
  printCustomRosterTable,
  exportCustomRosterExcel,
  exportCustomRosterCsv
};

export default customRosterExportUtils;
