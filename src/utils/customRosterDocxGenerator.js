// =================================================================
// HSS SHANGUS — Custom Student Roster Word (.docx) Document Generator
// =================================================================
// Generates professional Microsoft Word (.docx) files using the `docx`
// library, complete with official school header, document metadata,
// formatted data table with custom widths and row heights, and signatory blocks.
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
  HeightRule,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  PageOrientation,
  ImageRun
} from 'docx';

/**
 * Helper to safely convert data URLs or fetch image URLs to Uint8Array for docx ImageRun.
 */
async function getPhotoBuffer(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  try {
    if (photoUrl.startsWith('data:image/')) {
      const base64Data = photoUrl.split(',')[1];
      if (!base64Data) return null;
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else if (photoUrl.startsWith('http') || photoUrl.startsWith('/')) {
      const res = await fetch(photoUrl);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
  } catch (e) {
    console.warn('Could not load photo for docx export:', e);
  }
  return null;
}

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
 * Generate and download a formatted Microsoft Word (.docx) document.
 * 
 * @param {object} params
 * @param {string} params.title - Document Title (e.g. "STUDENT EXAM FEE COLLECTION LIST")
 * @param {string} params.subtitle - Optional Subtitle/Note
 * @param {Array<string>} params.metaBadges - Array of metadata strings (e.g. ["Class: 12th", "Session: 2025-26"])
 * @param {Array<object>} params.columns - Column definitions ({ key, label, widthPct, isCustom })
 * @param {Array<object>} params.rows - Array of student row objects
 * @param {string} params.orientation - 'portrait' | 'landscape'
 * @param {number} params.rowHeightDxa - Row height in dxa (e.g., 600 for signature, 360 for standard)
 * @param {Array<string>} params.signatories - Array of signatory titles (e.g. ["Class Incharge", "Dealing Assistant", "Principal"])
 */
export async function generateCustomRosterDocx({
  title = 'STUDENT ROSTER & RECORD SHEET',
  subtitle = '',
  metaBadges = [],
  columns = [],
  rows = [],
  orientation = 'portrait',
  rowHeightDxa = 450,
  signatories = ['Incharge Admissions & Exam', 'Principal']
}) {
  const isLandscape = orientation === 'landscape';

  // Define standard cell border
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '888888' }
  };

  const headerCellBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: '333333' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '666666' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '666666' }
  };

  // 1. Build Header Row
  const headerCells = columns.map((col) => {
    return new TableCell({
      width: {
        size: col.widthPct || Math.floor(100 / (columns.length || 1)),
        type: WidthType.PERCENTAGE
      },
      shading: { fill: 'EAEAEA' },
      borders: headerCellBorder,
      margins: { top: 120, bottom: 120, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: col.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text: col.label || col.key,
              bold: true,
              size: 18, // 9pt
              font: 'Calibri',
              color: '111111'
            })
          ]
        })
      ]
    });
  });

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    height: { value: 360, rule: HeightRule.ATLEAST },
    children: headerCells
  });

  // 2. Build Data Rows
  const tableDataRows = await Promise.all(rows.map(async (row, rowIdx) => {
    const cells = await Promise.all(columns.map(async (col) => {
      let cellParagraphs = [];
      if (col.key === 'studentPhoto' || col.key === 'photo') {
        const photoSrc = row.studentPhoto || row[col.key];
        const photoBuffer = await getPhotoBuffer(photoSrc);
        if (photoBuffer) {
          cellParagraphs = [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: photoBuffer,
                  transformation: {
                    width: 30,
                    height: 36
                  }
                })
              ]
            })
          ];
        } else {
          cellParagraphs = [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: '—',
                  size: 16,
                  font: 'Calibri',
                  color: '888888'
                })
              ]
            })
          ];
        }
      } else if (col.key === 'parentage' && row.fatherName && row.fatherName !== '—' && row.motherName && row.motherName !== '—') {
        cellParagraphs = [
          new Paragraph({
            alignment: col.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: `${row.fatherName} (F)`,
                bold: true,
                size: 16, // 8pt
                font: 'Calibri',
                color: '222222'
              })
            ]
          }),
          new Paragraph({
            alignment: col.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: `${row.motherName} (M)`,
                size: 15, // 7.5pt
                font: 'Calibri',
                color: '555555'
              })
            ]
          })
        ];
      } else {
        let cellText = '';
        if (col.key === 'sno') {
          cellText = String(rowIdx + 1);
        } else if (col.isCustom) {
          cellText = row[col.key] !== undefined ? String(row[col.key]) : (col.defaultValue || '');
        } else {
          cellText = row[col.key] !== undefined ? String(row[col.key]) : '—';
        }

        cellParagraphs = [
          new Paragraph({
            alignment: col.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: cellText,
                size: 17, // 8.5pt
                font: 'Calibri',
                color: '222222'
              })
            ]
          })
        ];
      }

      return new TableCell({
        width: {
          size: col.widthPct || Math.floor(100 / (columns.length || 1)),
          type: WidthType.PERCENTAGE
        },
        borders: cellBorder,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: cellParagraphs
      });
    }));

    return new TableRow({
      height: { value: rowHeightDxa, rule: HeightRule.ATLEAST },
      children: cells
    });
  }));

  // 3. Build Full Table
  const rosterTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows]
  });

  // 4. Build Metadata / Sub-Header Line
  const metaText = metaBadges.length > 0 ? metaBadges.join('   |   ') : `Generated on: ${new Date().toLocaleDateString('en-GB')}`;

  // 5. Build Signatory Blocks
  const signatoryCells = signatories.map((sig) => {
    return new TableCell({
      width: { size: Math.floor(100 / signatories.length), type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 500, after: 60 },
          children: [
            new TextRun({
              text: '___________________________',
              color: '777777',
              size: 18
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: sig,
              bold: true,
              size: 18,
              font: 'Calibri',
              color: '333333'
            })
          ]
        })
      ]
    });
  });

  const signatoryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: signatoryCells
      })
    ]
  });

  // 6. Build Document Instance
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            margin: {
              top: 227, // 0.4 cm
              bottom: 227,
              left: 227,
              right: 227
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'HSS Shangus Official Record',
                    size: 14,
                    color: '888888',
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Page ', size: 16, color: '666666' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '666666' }),
                  new TextRun({ text: ' of ', size: 16, color: '666666' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '666666' })
                ]
              })
            ]
          })
        },
        children: [
          // Institution Header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: 'GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS',
                bold: true,
                size: 26, // 13pt
                font: 'Calibri',
                color: '800000'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'District Anantnag, Kashmir — 192201 | Official Institutional Record',
                size: 16, // 8pt
                color: '555555',
                font: 'Calibri'
              })
            ]
          }),

          // Document Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: title.toUpperCase(),
                bold: true,
                size: 22, // 11pt
                font: 'Calibri',
                underline: { type: 'single', color: '333333' },
                color: '111111'
              })
            ]
          }),

          // Subtitle / Note (Optional)
          ...(subtitle ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: subtitle,
                  italics: true,
                  size: 17,
                  color: '444444'
                })
              ]
            })
          ] : []),

          // Meta badges info line
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: metaText,
                bold: true,
                size: 16,
                color: '444444'
              })
            ]
          }),

          // Data Table
          rosterTable,

          // Space before signatories
          new Paragraph({ spacing: { before: 200 }, children: [] }),

          // Signatories Table
          signatoryTable
        ]
      }
    ]
  });

  // 7. Pack and Download
  const blob = await Packer.toBlob(doc);
  const sanitizedFilename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
  downloadBlob(blob, sanitizedFilename);
  return true;
}

const customRosterDocxGenerator = {
  generateCustomRosterDocx
};

export default customRosterDocxGenerator;
