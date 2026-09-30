/**
 * JKBOSE Subject-wise Roll Number Statement Word (.docx) Generator
 * 
 * Generates an official Microsoft Word (.docx) document formatted to match
 * the Jammu & Kashmir Board of School Education (JKBOSE) circular format.
 */

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
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  PageOrientation
} from 'docx';
import { cleanCentreNoDisplay } from './jkboseRollSeriesFormatter';

const BORDER_STYLE = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '222222',
};

const CELL_BORDERS = {
  top: BORDER_STYLE,
  bottom: BORDER_STYLE,
  left: BORDER_STYLE,
  right: BORDER_STYLE,
};

/**
 * Generates and triggers download of the official JKBOSE Subject Roll Return document in Word (.docx) format.
 */
export async function generateJkboseDocx(exportData = {}, options = {}) {
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

  const sections = [];

  classesToRender.forEach((clsKey) => {
    const classInfo = classWiseData[clsKey];
    if (!classInfo || (!classInfo.subjects.length && classInfo.kpis.totalApproved === 0)) return;

    const subjects = classInfo.subjects || [];
    const totalExaminees = classInfo.kpis.activeExaminees || 0;
    const cleanCentre = cleanCentreNoDisplay(
      classInfo.centreNo || centreNo || detectedCentreNo || exportData.detectedCentreNo || ''
    );

    const children = [];

    // 1. Institution Header Block
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 60 },
        children: [
          new TextRun({
            text: institutionName.toUpperCase(),
            bold: true,
            size: 28, // 14pt
            font: 'Arial',
            color: '111827',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({
            text: 'SUBJECT-WISE ROLL NUMBER RETURN STATEMENT FOR EXAMINEES',
            bold: true,
            size: 24, // 12pt
            font: 'Arial',
            color: '1F2937',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 140 },
        children: [
          new TextRun({
            text: `${classInfo.label.toUpperCase()} — ${examName} (${session})`,
            bold: true,
            size: 20, // 10pt
            font: 'Arial',
            color: '374151',
          }),
          new TextRun({
            text: `   |   CENTRE NO: ${cleanCentre ? cleanCentre.toUpperCase() : 'NIL'}`,
            bold: true,
            size: 20,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 120 },
        children: [
          new TextRun({
            text: `Statement of Candidates appearing in ${classInfo.label} under ${centreNo}. Continuous series are separated by "TO" and single Roll Numbers by Comma.`,
            italics: true,
            size: 18, // 9pt
            font: 'Arial',
            color: '4B5563',
          }),
        ],
      })
    );

    // 2. Data Table
    const tableRows = [];

    // Header Row
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 800, type: WidthType.DXA }, // ~8%
            borders: CELL_BORDERS,
            shading: { fill: 'E5E7EB' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'S.No', bold: true, size: 19, font: 'Arial' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 2500, type: WidthType.DXA }, // ~23%
            borders: CELL_BORDERS,
            shading: { fill: 'E5E7EB' },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'Subject', bold: true, size: 19, font: 'Arial' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 6300, type: WidthType.DXA }, // ~58%
            borders: CELL_BORDERS,
            shading: { fill: 'E5E7EB' },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: 'Roll Numbers ( separate continuous series by "TO" & single Roll No\'s by "Comma" )',
                    bold: true,
                    size: 19,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1200, type: WidthType.DXA }, // ~11%
            borders: CELL_BORDERS,
            shading: { fill: 'E5E7EB' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Total Candidates', bold: true, size: 19, font: 'Arial' })],
              }),
            ],
          }),
        ],
      })
    );

    // Data Rows
    if (subjects.length === 0) {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 4,
              borders: CELL_BORDERS,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 120, after: 120 },
                  children: [new TextRun({ text: 'No approved examinee data found for this class.', italics: true, size: 20 })],
                }),
              ],
            }),
          ],
        })
      );
    } else {
      subjects.forEach((sub, idx) => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 800, type: WidthType.DXA },
                borders: CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(idx + 1), size: 19, font: 'Arial' })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 2500, type: WidthType.DXA },
                borders: CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ text: sub.subject, bold: true, size: 19, font: 'Arial' })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 6300, type: WidthType.DXA },
                borders: CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: sub.rollNumbersSeries || 'NIL',
                        size: 18,
                        font: 'Arial',
                        bold: sub.rollNumbersSeries.includes('TO'),
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 1200, type: WidthType.DXA },
                borders: CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(sub.candidateCount), bold: true, size: 19, font: 'Arial' })],
                  }),
                ],
              }),
            ],
          })
        );
      });
    }

    // Summary Total Row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            borders: CELL_BORDERS,
            shading: { fill: 'F3F4F6' },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'TOTAL UNIQUE EXAMINEES IN RETURN:', bold: true, size: 19, font: 'Arial' })],
              }),
            ],
          }),
          new TableCell({
            borders: CELL_BORDERS,
            shading: { fill: 'F3F4F6' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(totalExaminees), bold: true, size: 20, font: 'Arial', color: '1E3A8A' })],
              }),
            ],
          }),
        ],
      })
    );

    children.push(
      new Table({
        width: { size: 10800, type: WidthType.DXA },
        rows: tableRows,
      })
    );

    // 3. Signatory Block
    children.push(
      new Paragraph({ spacing: { before: 360, after: 120 }, children: [] }),
      new Table({
        width: { size: 10800, type: WidthType.DXA },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 5400, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({ text: 'Verified from Institutional Enrollment Register.', size: 18, font: 'Arial', italics: true }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-GB')}`, size: 18, font: 'Arial' }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 5400, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: 'Head of Institution / Principal', bold: true, size: 20, font: 'Arial' }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: institutionName, size: 18, font: 'Arial' }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    sections.push({
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
          },
          margin: {
            top: 720,    // 0.5 inch
            bottom: 720,
            left: 720,
            right: 720,
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: 'JKBOSE Official Return Statement', size: 16, color: '9CA3AF' }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ', size: 16, color: '666666' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '666666' }),
                new TextRun({ text: ' of ', size: 16, color: '666666' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '666666' }),
              ],
            }),
          ],
        }),
      },
      children,
    });
  });

  if (sections.length === 0) {
    throw new Error('No approved examinee data available to generate document.');
  }

  const doc = new Document({
    sections,
  });

  const blob = await Packer.toBlob(doc);
  const cleanCls = selectedClass === 'all' ? 'All_Classes' : `Class_${selectedClass}`;
  const filename = `JKBOSE_Subject_Roll_Return_${cleanCls}_${Date.now()}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, filename };
}
