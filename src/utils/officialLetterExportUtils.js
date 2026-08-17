// =================================================================
// HSS SHANGUS — Official Letterhead Print, PDF & Word (.docx) Generator
// =================================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle
} from 'docx';
import { convertHtmlToDocxElements } from './htmlDocxConverter';

/**
 * Trigger browser file download from Blob.
 */
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

/**
 * Print or Save as PDF via Browser Print Engine with official letterhead.
 */
export function printOfficialLetter({
  officeTitle = 'OFFICE OF THE PRINCIPAL',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'Anantnag, Kashmir — 192201 (J&K)',
  refNo = 'HSS/SHG/',
  dateStr = '',
  bodyHtml = '',
  signatoryName = '',
  signatoryDesignation = 'Principal',
  signatoryInstitution = 'Govt. Hr Sec. School Shangus',
  secondarySignatory = null,
  copyToText = '',
  pageMargin = '0.5in',
  headerLayout = 'logo_right'
}) {
  const finalDate = dateStr || new Date().toLocaleDateString('en-GB');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Official Letter - ${refNo || 'HSS Shangus'}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: ${pageMargin || '0.5in'};
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          width: 100%;
          font-size: 12px;
          line-height: 1.5;
        }
        .letter-container {
          width: 100%;
          max-width: 100%;
          /* Top Official Letterhead Banner */
        .letterhead-banner {
          background-color: #f0f8ff !important;
          border-bottom: 3px solid #800000;
          padding: 12px 14px 10px 14px;
          text-align: center;
          margin: -8px -12px 10px -12px;
          border-top-left-radius: 4px;
          border-top-right-radius: 4px;
        }
        .school-logo {
          width: 50px;
          height: 50px;
          max-width: 50px;
          max-height: 50px;
          object-fit: contain;
          display: block;
          margin: 0 auto 5px auto;
        }
        .office-title {
          font-size: 11px;
          font-weight: 800;
          color: #800000;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0 0 3px 0;
        }
        .inst-title {
          font-size: 17px;
          font-weight: 900;
          color: #0a192f;
          letter-spacing: 0.4px;
          margin: 0 0 3px 0;
          text-transform: uppercase;
          font-family: Georgia, serif, -apple-system, sans-serif;
        }
        .inst-address {
          font-size: 10.5px;
          color: #334155;
          font-weight: 600;
          margin: 0;
        }
        /* Ref & Date Bar */
        .ref-date-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11.5px;
          margin-bottom: 16px;
          font-weight: 600;
          padding: 0 2px;
        }
        .ref-label {
          color: #800000;
          font-weight: 800;
        }
        .date-label {
          color: #800000;
          font-weight: 800;
        }
        /* Main Body Content */
        .letter-body {
          font-size: 12.5px;
          color: #0f172a;
          line-height: 1.6;
          min-height: 140px;
          text-align: justify;
        }
        .letter-body p {
          margin: 0 0 10px 0;
        }
        .letter-body h1, .letter-body h2, .letter-body h3 {
          margin: 12px 0 6px 0;
          color: #0a192f;
        }
        .letter-body ul, .letter-body ol {
          margin: 6px 0 10px 24px;
          padding: 0;
        }
        .letter-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        .letter-body table, .letter-body th, .letter-body td {
          border: 1px solid #475569;
        }
        .letter-body th {
          background-color: #f1f5f9;
          padding: 5px;
          font-weight: bold;
          text-align: left;
        }
        .letter-body td {
          padding: 4px 6px;
        }
        /* Signatories */
        .signatories-block {
          display: flex;
          justify-content: ${secondarySignatory ? 'space-between' : 'flex-end'};
          align-items: flex-end;
          margin-top: 24px;
          page-break-inside: avoid;
        }
        .sig-box {
          text-align: center;
          min-width: 180px;
        }
        .sig-name {
          font-size: 11.5px;
          font-weight: 700;
          color: #0f172a;
        }
        .sig-desig {
          font-size: 12px;
          font-weight: 900;
          color: #0a192f;
        }
        .sig-inst {
          font-size: 10.5px;
          font-weight: 600;
          color: #334155;
        }
        /* Copy to block */
        .copy-to-block {
          margin-top: 24px;
          font-size: 10px;
          color: #475569;
          page-break-inside: avoid;
          border-top: 1px dashed #cbd5e1;
          padding-top: 8px;
        }
        .copy-to-title {
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 2px;
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
      <div class="letter-container">
        
        <!-- Official Letterhead Header Banner (Soft Ice-Blue Background) -->
        <div class="letterhead-banner">
          <img src="/logo192.png" alt="School Seal" class="school-logo" onerror="this.src='/logo.png'; this.onerror=null;" />
          <div class="office-title">${officeTitle || 'OFFICE OF THE PRINCIPAL'}</div>
          <div class="inst-title">${institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}</div>
          <div class="inst-address">${institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)'}</div>
        </div>

        <!-- Ref & Date -->
        <div class="ref-date-bar">
          <div><span class="ref-label">Ref. No.:</span> ${refNo || '—'}</div>
          <div><span class="date-label">Date:</span> ${finalDate}</div>
        </div>

        <!-- Body -->
        <div class="letter-body">
          ${bodyHtml}
        </div>

        <!-- Signatories -->
        <div class="signatories-block">
          ${secondarySignatory ? `
            <div class="sig-box" style="text-align: left;">
              ${secondarySignatory.name ? `<div class="sig-name">${secondarySignatory.name}</div>` : ''}
              <div class="sig-desig">${secondarySignatory.designation || 'Dealing Assistant'}</div>
              <div class="sig-inst">${secondarySignatory.institution || institutionName}</div>
            </div>
          ` : ''}

          <div class="sig-box" style="text-align: right;">
            ${signatoryName ? `<div class="sig-name">${signatoryName}</div>` : ''}
            <div class="sig-desig">${signatoryDesignation || 'Principal'}</div>
            <div class="sig-inst">${signatoryInstitution || institutionName}</div>
          </div>
        </div>

        <!-- Copy To -->
        ${copyToText ? `
          <div class="copy-to-block">
            <div class="copy-to-title">Copy to the:</div>
            <div>${copyToText.replace(/\n/g, '<br/>')}</div>
          </div>
        ` : ''}

      </div>
    </body>
    </html>
  `;

  // Use a hidden iframe for seamless direct printing without popup tabs or lingering blank windows
  let iframe = document.getElementById('official-letter-print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'official-letter-print-frame';
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

/**
 * Generate and download a formatted Microsoft Word (.docx) document.
 * Fully parses HTML tables, paragraphs, lists, bold, italics, alignments, and fonts.
 */
export async function generateOfficialLetterDocx({
  officeTitle = 'OFFICE OF THE PRINCIPAL',
  institutionName = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
  institutionAddress = 'Anantnag, Kashmir — 192201 (J&K)',
  refNo = 'HSS/SHG/',
  dateStr = '',
  bodyText = '',
  bodyHtml = '',
  signatoryDesignation = 'Principal',
  signatoryInstitution = 'Govt. Hr Sec. School Shangus',
  copyToText = ''
}) {
  const finalDate = dateStr || new Date().toLocaleDateString('en-GB');

  // Convert HTML or plain text into native docx elements (Tables, Paragraphs, TextRuns)
  const contentToConvert = bodyHtml || (bodyText ? `<p>${bodyText.replace(/\n/g, '<br/>')}</p>` : '');
  const bodyDocxElements = convertHtmlToDocxElements(contentToConvert, {
    defaultFont: 'Calibri',
    defaultSize: 24, // 12pt
    defaultAlign: 'left',
    lineSpacing: 280
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720, // 0.5 inch (720 twips)
            bottom: 720,
            left: 720,
            right: 720
          }
        }
      },
      children: [
        // Office Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: officeTitle,
              bold: true,
              size: 20, // 10pt
              color: '800000',
              font: 'Calibri'
            })
          ]
        }),
        // Institution Name
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: institutionName,
              bold: true,
              size: 30, // 15pt
              color: '0A192F',
              font: 'Calibri'
            })
          ]
        }),
        // Address
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          children: [
            new TextRun({
              text: institutionAddress,
              size: 19,
              color: '334155',
              font: 'Calibri'
            })
          ]
        }),

        // Ref No & Date Row Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 12, color: '800000' },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      spacing: { before: 80, after: 180 },
                      children: [
                        new TextRun({ text: 'Ref. No.: ', bold: true, color: '800000', size: 21, font: 'Calibri' }),
                        new TextRun({ text: refNo || '—', size: 21, font: 'Calibri' })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      spacing: { before: 80, after: 180 },
                      children: [
                        new TextRun({ text: 'Date: ', bold: true, color: '800000', size: 21, font: 'Calibri' }),
                        new TextRun({ text: finalDate, size: 21, font: 'Calibri' })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),

        // Body Content (Full HTML with native tables, paragraphs, text styles, lists)
        ...bodyDocxElements,

        // Signature Spacing & Block
        new Paragraph({ spacing: { before: 400, after: 40 } }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: signatoryDesignation,
              bold: true,
              size: 23,
              color: '0A192F',
              font: 'Calibri'
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: signatoryInstitution,
              size: 20,
              color: '334155',
              font: 'Calibri'
            })
          ]
        }),

        // Copy To if present
        ...(copyToText ? [
          new Paragraph({
            spacing: { before: 200, after: 40 },
            children: [
              new TextRun({ text: 'Copy to the:', bold: true, size: 19, color: '0F172A', font: 'Calibri' })
            ]
          }),
          ...copyToText.split('\n').map(line => 
            new Paragraph({
              spacing: { after: 20 },
              children: [
                new TextRun({ text: line, size: 19, color: '475569', font: 'Calibri' })
              ]
            })
          )
        ] : [])
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const safeFilename = `Official_Letter_${(refNo || 'Letter').replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
  downloadBlob(blob, safeFilename);
}
