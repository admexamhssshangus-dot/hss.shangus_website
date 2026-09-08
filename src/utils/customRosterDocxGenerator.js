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
  signatories = ['Incharge Admissions & Exam', 'Principal'],
  layoutMode = 'standard',
  examDetails = {}
}) {
  if (layoutMode === 'two_column_attendance') {
    return generateTwoColumnAttendanceDocx({
      title,
      examDetails,
      rows,
      rowHeightDxa,
      signatories
    });
  }

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

/**
 * Generate and download a Two-Column Examination Attendance Sheet in Word (.docx) format.
 */
async function generateTwoColumnAttendanceDocx({
  title = 'DAILY ATTENDANCE SHEET',
  examDetails = {},
  rows = [],
  rowHeightDxa = 500,
  signatories = ['Sig. of the Asstt. Supdt.', 'Sig. of the Centre Supdt.']
}) {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '666666' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '666666' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '666666' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '666666' }
  };

  const headerCellBorder = {
    top: { style: BorderStyle.SINGLE, size: 8, color: '222222' },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: '222222' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '444444' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '444444' }
  };

  const gapCellBorder = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE }
  };

  const headerCells = [
    new TableCell({
      width: { size: 9, type: WidthType.PERCENTAGE },
      shading: { fill: 'F1F5F9' },
      borders: headerCellBorder,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'R.No.', bold: true, size: 17, font: 'Calibri' })]
        })
      ]
    }),
    new TableCell({
      width: { size: 27, type: WidthType.PERCENTAGE },
      shading: { fill: 'F1F5F9' },
      borders: headerCellBorder,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: 'Name of the Candidate', bold: true, size: 17, font: 'Calibri' })]
        })
      ]
    }),
    new TableCell({
      width: { size: 13, type: WidthType.PERCENTAGE },
      shading: { fill: 'F1F5F9' },
      borders: headerCellBorder,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Sig. of the Candidate', bold: true, size: 16, font: 'Calibri' })]
        })
      ]
    }),
    new TableCell({
      width: { size: 2, type: WidthType.PERCENTAGE },
      borders: gapCellBorder,
      children: [new Paragraph({ children: [] })]
    }),
    new TableCell({
      width: { size: 9, type: WidthType.PERCENTAGE },
      shading: { fill: 'F1F5F9' },
      borders: headerCellBorder,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'R.No.', bold: true, size: 17, font: 'Calibri' })]
        })
      ]
    }),
    new TableCell({
      width: { size: 27, type: WidthType.PERCENTAGE },
      shading: { fill: 'F1F5F9' },
      borders: headerCellBorder,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: 'Name of the Candidate', bold: true, size: 17, font: 'Calibri' })]
        })
      ]
    }),
    new TableCell({
      width: { size: 13, type: WidthType.PERCENTAGE },
      shading: { fill: 'F1F5F9' },
      borders: headerCellBorder,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Sig. of the Candidate', bold: true, size: 16, font: 'Calibri' })]
        })
      ]
    })
  ];

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    height: { value: 340, rule: HeightRule.ATLEAST },
    children: headerCells
  });

  const half = Math.ceil(rows.length / 2);
  const dataRows = [];

  for (let i = 0; i < half; i++) {
    const left = rows[i];
    const right = rows[half + i];

    const leftRoll = left ? ((left.classRollNo && left.classRollNo !== '—' && left.classRollNo !== '-') ? left.classRollNo : (left.sno || i + 1)) : '';
    const leftName = left ? (left.studentName || left.name || '') : '';
    const rightRoll = right ? ((right.classRollNo && right.classRollNo !== '—' && right.classRollNo !== '-') ? right.classRollNo : (right.sno || half + i + 1)) : '';
    const rightName = right ? (right.studentName || right.name || '') : '';

    const cells = [
      new TableCell({
        width: { size: 9, type: WidthType.PERCENTAGE },
        borders: cellBorder,
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: String(leftRoll), bold: true, size: 17, font: 'Calibri' })]
          })
        ]
      }),
      new TableCell({
        width: { size: 27, type: WidthType.PERCENTAGE },
        borders: cellBorder,
        margins: { top: 60, bottom: 60, left: 60, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: leftName, size: 17, font: 'Calibri' })]
          })
        ]
      }),
      new TableCell({
        width: { size: 13, type: WidthType.PERCENTAGE },
        borders: cellBorder,
        children: [new Paragraph({ children: [] })]
      }),
      new TableCell({
        width: { size: 2, type: WidthType.PERCENTAGE },
        borders: gapCellBorder,
        children: [new Paragraph({ children: [] })]
      }),
      new TableCell({
        width: { size: 9, type: WidthType.PERCENTAGE },
        borders: right ? cellBorder : gapCellBorder,
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: String(rightRoll), bold: true, size: 17, font: 'Calibri' })]
          })
        ]
      }),
      new TableCell({
        width: { size: 27, type: WidthType.PERCENTAGE },
        borders: right ? cellBorder : gapCellBorder,
        margins: { top: 60, bottom: 60, left: 60, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: rightName, size: 17, font: 'Calibri' })]
          })
        ]
      }),
      new TableCell({
        width: { size: 13, type: WidthType.PERCENTAGE },
        borders: right ? cellBorder : gapCellBorder,
        children: [new Paragraph({ children: [] })]
      })
    ];

    dataRows.push(new TableRow({
      height: { value: Math.max(Number(rowHeightDxa) || 450, 480), rule: HeightRule.ATLEAST },
      children: cells
    }));
  }

  const attendanceTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...dataRows]
  });

  const examNameText = examDetails.examName || '...........................................................................';
  const examYearText = examDetails.examYear || '.....................................';
  const classText = examDetails.className || '..................................';
  const dateText = examDetails.examDate || '..................................';
  const subjectText = examDetails.subjectName || '..................................';
  const paperText = examDetails.paper || '..................................';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            orientation: PageOrientation.PORTRAIT,
            margin: { top: 400, bottom: 400, left: 500, right: 500 }
          }
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            shading: { fill: 'CBD5E1' },
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: 'GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG',
                bold: true,
                size: 23,
                font: 'Calibri',
                color: '0F172A'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: (title || 'DAILY ATTENDANCE SHEET').toUpperCase(),
                bold: true,
                size: 24,
                font: 'Calibri',
                underline: { type: 'single', color: '111111' },
                color: '111111'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 40 },
            children: [
              new TextRun({ text: 'Name of the Examination: ', bold: true, size: 17, font: 'Calibri' }),
              new TextRun({ text: `${examNameText}          `, size: 17, font: 'Calibri' }),
              new TextRun({ text: 'Year: ', bold: true, size: 17, font: 'Calibri' }),
              new TextRun({ text: examYearText, size: 17, font: 'Calibri' })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 140 },
            children: [
              new TextRun({ text: 'Class: ', bold: true, size: 17, font: 'Calibri' }),
              new TextRun({ text: `${classText}      `, size: 17, font: 'Calibri' }),
              new TextRun({ text: 'Date: ', bold: true, size: 17, font: 'Calibri' }),
              new TextRun({ text: `${dateText}      `, size: 17, font: 'Calibri' }),
              new TextRun({ text: 'Subject: ', bold: true, size: 17, font: 'Calibri' }),
              new TextRun({ text: `${subjectText}      `, size: 17, font: 'Calibri' }),
              new TextRun({ text: 'Paper: ', bold: true, size: 17, font: 'Calibri' }),
              new TextRun({ text: paperText, size: 17, font: 'Calibri' })
            ]
          }),
          attendanceTable,
          new Paragraph({ spacing: { before: 280 }, children: [] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: gapCellBorder,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: '_______________________________', color: '666666', size: 16 })]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: (signatories && signatories[0]) || 'Sig. of the Asstt. Supdt.', bold: true, size: 17, font: 'Calibri' })]
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: gapCellBorder,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: '_______________________________', color: '666666', size: 16 })]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: (signatories && signatories[1]) || 'Sig. of the Centre Supdt.', bold: true, size: 17, font: 'Calibri' })]
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
  const sanitizedFilename = `${(title || 'Attendance_Sheet').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
  downloadBlob(blob, sanitizedFilename);
  return true;
}

const customRosterDocxGenerator = {
  generateCustomRosterDocx
};

export default customRosterDocxGenerator;
