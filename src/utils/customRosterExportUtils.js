// =================================================================
// HSS SHANGUS — Custom Student Roster Print, PDF, Excel & CSV Utilities
// =================================================================

import * as XLSX from 'xlsx';

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
  signatories = ['Incharge Admissions & Exam', 'Principal']
}) {
  const isLandscape = orientation === 'landscape';

  const metaHtml = metaBadges.length > 0
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
          font-size: 8.5px;
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
          font-size: 9px;
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
      <div class="header-container">
        <div class="inst-title">GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS</div>
        <div class="inst-sub">District Anantnag, Kashmir — 192201 | Official Institutional Record</div>
        <div class="doc-title">${title}</div>
        ${subtitle ? `<div class="doc-sub">${subtitle}</div>` : ''}
        ${metaHtml}
      </div>

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

  // Use a hidden iframe for seamless direct printing without popup tabs or lingering blank windows
  let iframe = document.getElementById('custom-roster-print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'custom-roster-print-frame';
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
  }, 300);
}

/**
 * Export customized student roster data to Excel (.xlsx).
 */
export function exportCustomRosterExcel({
  title = 'Student_Roster',
  columns = [],
  rows = []
}) {
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
 */
export function exportCustomRosterCsv({
  title = 'Student_Roster',
  columns = [],
  rows = []
}) {
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
