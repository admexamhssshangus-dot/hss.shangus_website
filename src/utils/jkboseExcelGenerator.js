/**
 * JKBOSE Subject-wise Roll Number Statement Excel (.xlsx) Generator
 * 
 * Generates official Excel workbooks matching the JKBOSE circular specification,
 * supporting single class returns or multi-sheet class-wise workbooks.
 */

import * as XLSX from 'xlsx';
import { cleanCentreNoDisplay } from './jkboseRollSeriesFormatter';

/**
 * Generates and triggers download of the official JKBOSE Subject Roll Return in Excel format.
 */
export function generateJkboseExcel(exportData = {}, options = {}) {
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

  const wb = XLSX.utils.book_new();
  let sheetsAdded = 0;

  classesToRender.forEach((clsKey) => {
    const classInfo = classWiseData[clsKey];
    if (!classInfo || (!classInfo.subjects.length && classInfo.kpis.totalApproved === 0)) return;

    const subjects = classInfo.subjects || [];
    const totalExaminees = classInfo.kpis.activeExaminees || 0;
    const cleanCentre = cleanCentreNoDisplay(
      classInfo.centreNo || centreNo || detectedCentreNo || exportData.detectedCentreNo || ''
    );

    const aoa = [
      [institutionName.toUpperCase()],
      ['SUBJECT-WISE ROLL NUMBER RETURN STATEMENT FOR EXAMINEES'],
      [`${classInfo.label.toUpperCase()} — ${examName.toUpperCase()} (${session})`, '', '', `CENTRE NO: ${cleanCentre ? cleanCentre.toUpperCase() : 'NIL'}`],
      ['Statement of Candidates appearing under examination centre. Continuous series separated by "TO" & single Roll Numbers by Comma.'],
      [],
      ['S.No', 'Subject', 'Roll Numbers ( separate continuous series by "TO" & single Roll No\'s by "Comma" )', 'Total Candidates'],
    ];

    if (subjects.length === 0) {
      aoa.push(['-', 'No approved examinee data found', 'NIL', 0]);
    } else {
      subjects.forEach((sub, idx) => {
        aoa.push([
          idx + 1,
          sub.subject,
          sub.rollNumbersSeries || 'NIL',
          sub.candidateCount,
        ]);
      });
    }

    aoa.push([]);
    aoa.push(['', 'TOTAL UNIQUE EXAMINEES IN RETURN:', '', totalExaminees]);
    aoa.push([]);
    aoa.push(['Verified from Enrollment Register: ____________________', '', 'Principal / Head of Institution: ____________________']);
    aoa.push([`Date of Submission: ${new Date().toLocaleDateString('en-GB')}`, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set Column Widths (characters)
    ws['!cols'] = [
      { wch: 8 },   // S.No
      { wch: 28 },  // Subject
      { wch: 80 },  // Roll Numbers Series
      { wch: 18 },  // Total Candidates
    ];

    const sheetName = `Class_${clsKey}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    sheetsAdded++;
  });

  if (sheetsAdded === 0) {
    throw new Error('No approved examinee records available for export.');
  }

  const cleanCls = selectedClass === 'all' ? 'All_Classes' : `Class_${selectedClass}`;
  const filename = `JKBOSE_Subject_Roll_Return_${cleanCls}_${Date.now()}.xlsx`;

  XLSX.writeFile(wb, filename);

  return { success: true, filename };
}
