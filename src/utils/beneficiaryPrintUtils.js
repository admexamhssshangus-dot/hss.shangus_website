// =================================================================
// HSS SHANGUS — Mutual Benefit Fund & Sanction Orders Print Engine
// Produces clean, isolated print outputs matching Official Letterhead
// Writer & Student Bonafides suites, without browser clutter or controls
// =================================================================

/**
 * Print or Save as PDF via dedicated offscreen iframe with official letterhead.
 */
export function printBeneficiarySanctionOrder({
  orientation = 'landscape',
  officeTitle = 'OFFICE OF THE PRINCIPAL',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'Anantnag, Kashmir — 192201 (J&K)',
  contactLine = 'UDISE: 01061400618 | Email: ghssshangus74@gmail.com',
  refNo = 'HSS/SHG/MBF/2025-26/01',
  dateStr = '',
  documentTitle = 'List of Beneficiaries for Mutual Benefit Fund, 2025-26',
  showPreamble = false,
  preambleText = '',
  activeColumns = [],
  beneficiaries = [],
  totalAmount = '0',
  showCertification = true,
  certificationText = '',
  signaturesMode = 'committee',
  committeeMemberCount = 5,
  committeeHeader = 'Signatures of committee members',
  principalTitle = 'Principal',
  principalSubtitle = 'Govt. Hr. Sec. School Shangus',
  fontFamily = "'Times New Roman', Times, serif",
  tableFontSize = '9.5pt',
  rowPaddingPreset = 'compact'
}) {
  const finalDate = dateStr || new Date().toLocaleDateString('en-GB');
  const isLandscape = orientation === 'landscape';

  const cellPadding =
    rowPaddingPreset === 'compact'
      ? '3px 4px'
      : rowPaddingPreset === 'spacious'
      ? '6px 7px'
      : '4px 5px';

  // Format currency with commas
  const formattedTotal = String(totalAmount).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${documentTitle || 'Mutual Benefit Fund Sanction Order'}</title>
      <style>
        @page {
          size: A4 ${isLandscape ? 'landscape' : 'portrait'};
          margin: 0.32in 0.38in;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          font-family: ${fontFamily || "'Times New Roman', Times, serif"};
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          width: 100%;
          font-size: ${tableFontSize || '9.5pt'};
          line-height: 1.4;
        }
        .sheet-container {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
        }
        /* Top Official Letterhead Banner — Exact match with Official Letterhead Writer */
        .letterhead-banner {
          background-color: #f0f8ff !important;
          border-bottom: 3px solid #800000;
          padding: 10px 14px 8px 14px;
          text-align: center;
          margin-bottom: 8px;
          border-top-left-radius: 4px;
          border-top-right-radius: 4px;
        }
        .school-logo {
          width: 48px;
          height: 48px;
          max-width: 48px;
          max-height: 48px;
          object-fit: contain;
          display: block;
          margin: 0 auto 4px auto;
        }
        .office-title {
          font-size: 11px;
          font-weight: 800;
          color: #800000;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0 0 2px 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .inst-title {
          font-size: 17px;
          font-weight: 900;
          color: #0a192f;
          letter-spacing: 0.4px;
          margin: 0 0 2px 0;
          text-transform: uppercase;
          font-family: Georgia, serif, -apple-system, sans-serif;
        }
        .inst-address {
          font-size: 10.5px;
          color: #334155;
          font-weight: 600;
          margin: 0;
        }
        .inst-contact {
          font-size: 9.5px;
          color: #0369a1;
          font-weight: 700;
          margin-top: 2px;
        }
        /* Ref & Date Bar */
        .ref-date-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          margin: 8px 0 10px 0;
          font-weight: 600;
          padding: 0 2px 4px 2px;
          border-bottom: 1px solid #cbd5e1;
        }
        .ref-label {
          color: #800000;
          font-weight: 800;
          text-transform: uppercase;
          margin-right: 4px;
        }
        .date-label {
          color: #800000;
          font-weight: 800;
          text-transform: uppercase;
          margin-right: 4px;
        }
        /* Bank Debit Directive Preamble */
        .preamble-box {
          font-size: 11px;
          font-weight: 600;
          margin: 6px 0 10px 0;
          line-height: 1.5;
          color: #1e293b;
          text-align: justify;
        }
        /* Document Subtitle / Banner */
        .doc-title-banner {
          text-align: center;
          margin: 8px 0;
          font-weight: 800;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .doc-title-banner span {
          display: inline-block;
          border-bottom: 2px solid #0f172a;
          padding: 0 8px 3px 8px;
        }
        /* Table */
        table.beneficiary-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
          font-size: ${tableFontSize || '9.5pt'};
        }
        table.beneficiary-table th, table.beneficiary-table td {
          border: 1px solid #1e293b;
          padding: ${cellPadding};
          line-height: 1.35;
        }
        table.beneficiary-table th {
          background-color: #f1f5f9 !important;
          color: #0f172a;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 10px;
        }
        table.beneficiary-table tbody tr:nth-child(even) td {
          background-color: #fafbfc !important;
        }
        .total-row {
          background-color: #f1f5f9 !important;
          font-weight: 900;
          border-top: 2px solid #0f172a !important;
        }
        /* Certification Note */
        .cert-box {
          font-size: 10.5px;
          text-align: justify;
          line-height: 1.55;
          margin: 10px 0;
          color: #1e293b;
        }
        .cert-box p {
          margin: 0 0 6px 0;
        }
        .cert-box p:last-child {
          margin-bottom: 0;
        }
        /* Committee Signatures */
        .committee-box {
          margin-top: 14px;
          page-break-inside: avoid;
        }
        .committee-header {
          font-weight: 800;
          font-size: 11.5px;
          text-align: center;
          margin-bottom: 12px;
        }
        .committee-grid {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .committee-slot {
          flex: 1;
          text-align: center;
        }
        .committee-line {
          border-top: 1.5px solid #1e293b;
          padding-top: 3px;
          font-weight: 800;
          font-size: 10.5px;
          width: 80%;
          margin: 0 auto;
        }
        /* Principal Signature */
        .principal-box {
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
          page-break-inside: avoid;
        }
        .principal-inner {
          text-align: right;
          min-width: 150px;
        }
        .principal-gap {
          height: 36px;
        }
        .principal-line {
          border-top: 1.5px solid #1e293b;
          padding-top: 4px;
          font-weight: 800;
          font-size: 12px;
        }
        .principal-sub {
          font-size: 10px;
          color: #475569;
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
      <div class="sheet-container">
        <!-- Official Letterhead Banner -->
        <div class="letterhead-banner">
          <img src="/logo192.png" alt="School Seal" class="school-logo" onerror="this.src='/logo.png'; this.onerror=null;" />
          <div class="office-title">${officeTitle || 'OFFICE OF THE PRINCIPAL'}</div>
          <div class="inst-title">${institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}</div>
          <div class="inst-address">${institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)'}</div>
          <div class="inst-contact">${contactLine || 'UDISE: 01061400618 | Email: ghssshangus74@gmail.com'}</div>
        </div>

        <!-- Ref & Date Bar -->
        <div class="ref-date-bar">
          <div><span class="ref-label">Ref. No:</span> ${refNo || '—'}</div>
          <div><span class="date-label">Date:</span> ${finalDate}</div>
        </div>

        <!-- Bank Debit Directive Preamble (if active) -->
        ${showPreamble && preambleText ? `
          <div class="preamble-box">
            ${preambleText}
          </div>
        ` : ''}

        <!-- Document Subtitle / Banner -->
        <div class="doc-title-banner">
          <span>${documentTitle}</span>
        </div>

        <!-- Main Beneficiaries Table -->
        <table class="beneficiary-table">
          <thead>
            <tr>
              ${activeColumns.map(c => `
                <th style="width: ${c.widthPct}%; text-align: ${c.align};">${c.label}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${beneficiaries.map((row, rIdx) => `
              <tr>
                ${activeColumns.map(c => {
                  const isSno = c.key === 'sno';
                  const isAmount = c.key === 'amount';
                  const cellVal = isSno ? (rIdx + 1) : (row[c.key] || '');
                  const displayVal = isAmount ? (cellVal ? `₹ ${cellVal}` : '—') : (cellVal || '—');
                  return `<td style="text-align: ${c.align}; font-weight: ${isSno ? '700' : 'normal'};">${displayVal}</td>`;
                }).join('')}
              </tr>
            `).join('')}
            ${(() => {
              const amountIdx = activeColumns.findIndex(c => c.key === 'amount');
              if (amountIdx !== -1) {
                const beforeCols = activeColumns.slice(0, amountIdx);
                const afterCols = activeColumns.slice(amountIdx + 1);
                return `
                  <tr class="total-row">
                    <td colspan="${beforeCols.length}" style="text-align: right; font-weight: 800; text-transform: uppercase;">Total Amount Sanctioned :</td>
                    <td style="text-align: right; font-weight: 900; white-space: nowrap;">₹ ${formattedTotal}</td>
                    ${afterCols.map(() => `<td></td>`).join('')}
                  </tr>
                `;
              }
              return `
                <tr class="total-row">
                  <td colspan="${activeColumns.length}" style="text-align: right; font-weight: 900;">Total : ₹ ${formattedTotal}</td>
                </tr>
              `;
            })()}
          </tbody>
        </table>

        <!-- Certification Paragraph (if active) -->
        ${showCertification && certificationText ? `
          <div class="cert-box">
            ${certificationText.includes('<p>') || certificationText.includes('<div>')
              ? certificationText
              : certificationText.split('\n\n').map(p => `<p>${p}</p>`).join('')}
          </div>
        ` : ''}

        <!-- Committee Signatures (if active) -->
        ${(signaturesMode === 'committee' || signaturesMode === 'both') ? `
          <div class="committee-box">
            <div class="committee-header">${committeeHeader}</div>
            <div class="committee-grid">
              ${Array.from({ length: committeeMemberCount }).map((_, i) => `
                <div class="committee-slot">
                  <div class="committee-line">${i + 1}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Principal Signature (if active) -->
        ${(signaturesMode === 'principal' || signaturesMode === 'both') ? `
          <div class="principal-box">
            <div class="principal-inner">
              <div class="principal-gap"></div>
              <div class="principal-line">${principalTitle}</div>
              ${principalSubtitle ? `<div class="principal-sub">${principalSubtitle}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;

  // Hidden offscreen iframe for direct isolated print dialog
  let iframe = document.getElementById('beneficiary-print-frame');
  if (iframe && iframe.parentNode) {
    iframe.parentNode.removeChild(iframe);
  }

  iframe = document.createElement('iframe');
  iframe.id = 'beneficiary-print-frame';
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

  let hasPrinted = false;
  let fallbackTimer = null;
  const triggerPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.warn('Iframe print note:', err);
      window.print();
    }
  };

  const logoImg = iframe.contentWindow.document.querySelector('.school-logo');
  if (logoImg && !logoImg.complete) {
    logoImg.onload = () => setTimeout(triggerPrint, 150);
    logoImg.onerror = () => setTimeout(triggerPrint, 150);
    fallbackTimer = setTimeout(triggerPrint, 500);
  } else {
    setTimeout(triggerPrint, 150);
  }
}
