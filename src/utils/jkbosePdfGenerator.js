/**
 * JKBOSE Subject-wise Roll Number Statement Printable PDF / HTML Generator
 * 
 * Generates an official, print-perfect HTML document and triggers the print dialog
 * to Save as PDF or print directly, matching the JKBOSE sub-office circular.
 */

import { cleanCentreNoDisplay } from './jkboseRollSeriesFormatter';

/**
 * Generates the complete HTML string for the JKBOSE statement.
 */
export function generateJkboseHtml(exportData = {}, options = {}) {
  const merged = { ...exportData, ...options };
  const {
    classWiseData = {},
    selectedClass = '12th',
    institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
    examName = 'ANNUAL REGULAR 2026',
    centreNo = '',
    detectedCentreNo = '',
    session = 'Session 2025-26',
  } = merged;

  const classesToRender = selectedClass === 'all'
    ? Object.keys(classWiseData)
    : [selectedClass];

  let pagesHtml = '';

  classesToRender.forEach((clsKey, index) => {
    const classInfo = classWiseData[clsKey];
    if (!classInfo || (!classInfo.subjects.length && classInfo.kpis.totalApproved === 0)) return;

    const subjects = classInfo.subjects || [];
    const totalExaminees = classInfo.kpis.activeExaminees || 0;
    const cleanCentre = cleanCentreNoDisplay(
      classInfo.centreNo || centreNo || detectedCentreNo || exportData.detectedCentreNo || ''
    );

    const rowsHtml = subjects.length === 0
      ? `<tr><td colspan="4" style="text-align: center; padding: 20px; font-style: italic; color: #6b7280;">No approved examinee data found for this class.</td></tr>`
      : subjects.map((sub, idx) => `
        <tr>
          <td style="text-align: center; font-weight: 600; width: 6%;">${idx + 1}</td>
          <td style="font-weight: 700; width: 22%; text-align: left;">${sub.subject}</td>
          <td style="text-align: left; width: 62%; line-height: 1.45; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px;">
            ${sub.rollNumbersSeries.replace(/TO/g, '<strong style="color: #0f172a; text-decoration: underline; font-weight: 900;">TO</strong>')}
          </td>
          <td style="text-align: center; font-weight: 700; width: 10%; font-size: 13px;">${sub.candidateCount}</td>
        </tr>
      `).join('');

    pagesHtml += `
      <div class="jkbose-page ${index > 0 ? 'page-break' : ''}">
        <!-- HEADER -->
        <div class="header-box">
          <div class="inst-title">${institutionName.toUpperCase()}</div>
          <div class="doc-title">SUBJECT-WISE ROLL NUMBER RETURN STATEMENT FOR EXAMINEES</div>
          <div class="exam-subtitle">
            <span><strong>EXAMINATION:</strong> ${classInfo.label.toUpperCase()} — ${examName} (${session})</span>
            <span class="centre-badge"><strong>CENTRE NO:</strong> ${cleanCentre ? cleanCentre.toUpperCase() : 'NIL'}</span>
          </div>
          <div class="notice-meta">
            <span>Official Return Statement as per JKBOSE Guidelines & Circular.</span>
            <span>Continuous series separated by <strong>"TO"</strong> & single Roll Numbers by <strong>Comma</strong>.</span>
          </div>
        </div>

        <!-- TABLE -->
        <table class="statement-table">
          <thead>
            <tr>
              <th style="width: 6%;">S.No</th>
              <th style="width: 22%;">Subject</th>
              <th style="width: 62%;">Roll Numbers ( separate continuous series by "TO" & single Roll No's by "Comma" )</th>
              <th style="width: 10%;">Total Candidates</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="3" style="text-align: right; font-weight: 800; font-size: 12px; padding: 7px 12px;">
                TOTAL UNIQUE EXAMINEES IN RETURN:
              </td>
              <td style="text-align: center; font-weight: 900; font-size: 14px; color: #1e3a8a;">
                ${totalExaminees}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- SIGNATORY FOOTER -->
        <div class="signatory-grid">
          <div class="sign-left">
            <div style="font-weight: 600;">Verified from Institutional Enrollment Register.</div>
            <div style="margin-top: 4px; color: #4b5563;">Date of Return: <strong>${new Date().toLocaleDateString('en-GB')}</strong></div>
          </div>
          <div class="sign-right">
            <div class="sign-title">Principal / Head of Institution</div>
            <div class="sign-inst">${institutionName}</div>
          </div>
        </div>
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>JKBOSE Subject Roll Statement — ${institutionName}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm 12mm 10mm 12mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 0;
          color: #0f172a;
          background: #ffffff;
          font-size: 11.5px;
        }
        .jkbose-page {
          padding: 10px 0;
        }
        .page-break {
          page-break-before: always;
        }
        .header-box {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .inst-title {
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #0f172a;
        }
        .doc-title {
          font-size: 13px;
          font-weight: 800;
          color: #1e293b;
          margin: 3px 0;
          letter-spacing: 0.2px;
        }
        .exam-subtitle {
          font-size: 11.5px;
          color: #334155;
          margin: 4px 0 2px 0;
          display: flex;
          justify-content: center;
          gap: 20px;
        }
        .centre-badge {
          background: #e2e8f0;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #cbd5e1;
        }
        .notice-meta {
          font-size: 9.5px;
          color: #64748b;
          margin-top: 4px;
          display: flex;
          justify-content: space-between;
        }
        .statement-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .statement-table th,
        .statement-table td {
          border: 1px solid #1e293b;
          padding: 6px 8px;
          vertical-align: top;
        }
        .statement-table th {
          background-color: #f1f5f9;
          font-weight: 800;
          font-size: 11px;
          text-align: center;
          text-transform: uppercase;
        }
        .statement-table tbody tr:nth-child(even) {
          background-color: #fafafa;
        }
        .statement-table thead {
          display: table-header-group;
        }
        .total-row {
          background-color: #f8fafc;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .total-row td {
          border-top: 2px solid #0f172a;
          border-bottom: 2px solid #0f172a;
        }
        .signatory-grid {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 36px;
          padding-top: 10px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .sign-left {
          font-size: 11px;
        }
        .sign-right {
          text-align: right;
          font-size: 11.5px;
        }
        .sign-title {
          font-weight: 800;
          font-size: 12.5px;
        }
        .sign-inst {
          font-weight: 600;
          color: #334155;
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
 * Renders the HTML in an offscreen iframe and triggers the native browser print/save-as-pdf dialog.
 */
export function printJkboseStatement(exportData = {}, options = {}) {
  const merged = { ...exportData, ...options };
  const html = generateJkboseHtml(merged);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print trigger note:', e);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 3000);
    }
  }, 400);

  return { success: true };
}
