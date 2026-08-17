// =================================================================
// HSS SHANGUS — JKBOSE Exam Result Ingestion & Template Manager
// Supports Excel/CSV Template Export, File Parsing, Gemini AI PDF
// Gazette Analysis, Fuzzy Database Matching, and Firestore Sync.
// =================================================================

import * as XLSX from 'xlsx';
import { db } from '../services/firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { updateCachedItem } from '../services/dbCache';
import { fetchCloudGeminiKeys, getPreferredGeminiModel } from '../services/geminiLetterService';

/**
 * Standard JKBOSE Subject Code Definitions
 */
export const JKBOSE_SUBJECT_CODES = [
  { code: 'GN', name: 'General English', category: 'Language' },
  { code: 'PH', name: 'Physics', category: 'Science' },
  { code: 'CH', name: 'Chemistry', category: 'Science' },
  { code: 'BI', name: 'Biology', category: 'Science' },
  { code: 'MA', name: 'Mathematics', category: 'Science/General' },
  { code: 'UR', name: 'Urdu', category: 'Language' },
  { code: 'AR', name: 'Arabic', category: 'Language' },
  { code: 'PS', name: 'Political Science', category: 'Arts/Humanities' },
  { code: 'HS', name: 'History', category: 'Arts/Humanities' },
  { code: 'EC', name: 'Economics', category: 'Arts/Commerce' },
  { code: 'SO', name: 'Sociology', category: 'Arts/Humanities' },
  { code: 'ED', name: 'Education', category: 'Arts/Humanities' },
  { code: 'GG', name: 'Geography', category: 'Arts/Humanities' },
  { code: 'ES', name: 'Environmental Science', category: 'Compulsory' },
  { code: 'AC', name: 'Accountancy', category: 'Commerce' },
  { code: 'BS', name: 'Business Studies', category: 'Commerce' },
  { code: 'PD', name: 'Public Administration', category: 'Arts/Humanities' },
  { code: 'HE', name: 'Home Science', category: 'Arts/Humanities' },
  { code: 'ITE', name: 'IT & ITeS', category: 'Vocational' },
  { code: 'RET', name: 'Retail', category: 'Vocational' },
  { code: 'TH', name: 'Tourism & Hospitality', category: 'Vocational' },
  { code: 'AG', name: 'Agriculture', category: 'Vocational' },
  { code: 'AP', name: 'Automotive', category: 'Vocational' },
  { code: 'BW', name: 'Beauty & Wellness', category: 'Vocational' }
];

/**
 * Calculate percentage & division from marks obtained and max marks.
 */
export function calculateDivision(marksObt, maxMarks = 500) {
  const obt = parseFloat(marksObt);
  const max = parseFloat(maxMarks) || 500;
  if (isNaN(obt) || obt <= 0 || max <= 0) {
    return { pct: 0, division: '—', pctStr: '—' };
  }
  const pct = Math.round((obt / max) * 1000) / 10;
  let division = '3rd Division';
  if (pct >= 75) division = 'Distinction';
  else if (pct >= 60) division = '1st Division';
  else if (pct >= 45) division = '2nd Division';

  return { pct, division, pctStr: `${pct}%` };
}

/**
 * Normalize Result string into standard standard taxonomy: 'Passed' | 'Reap' | 'Failed' | 'Discharged'
 */
export function normalizeResultStatus(raw) {
  if (!raw) return 'Passed';
  const s = String(raw).trim().toLowerCase();
  if (s.includes('pass') || s.includes('qualif')) return 'Passed';
  if (s.includes('reap') || s.includes('re-appear') || s.includes('compartment')) return 'Reap';
  if (s.includes('fail') || s.includes('not qualif')) return 'Failed';
  if (s.includes('discharg') || s.includes('withdraw') || s.includes('transfer')) return 'Discharged';
  return 'Passed';
}

/**
 * Download a file in the browser.
 */
function downloadFileBlob(blob, filename) {
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
 * Generate and download an Excel / CSV pre-populated template for a class/session.
 */
export function generateResultImportTemplate(studentsList = [], className = '12th', session = '2025-26', format = 'xlsx') {
  const rows = (studentsList || []).map((s, idx) => {
    const raw = s.raw || s;
    return {
      'S.No.': idx + 1,
      'Form No.': s.formNo || raw['Form No.'] || raw.formNo || '',
      'Class R.No.': s.classRollNo || raw['Class R.No.'] || raw.rollNo || '',
      'Board Reg. No.': s.regNo || raw['Board Reg. No.'] || raw.regNo || '',
      "Student's Name": s.name || raw["Student's Name"] || raw.name || '',
      "Father's Name": s.fatherName || raw["Father's Name"] || raw.fatherName || '',
      'Class': s.selectedClass || raw['Class'] || className || '',
      'Stream': s.selectedStream || raw['Stream'] || '',
      'Session': s.selectedSession || raw['Session'] || session || '',
      'Exam Mode (Current)': raw['Exam Mode (Current)'] || raw.currExamMode || 'Annual Regular 2025 (Oct.-Nov.)',
      'Exam R.No. (Current)': raw['Exam R.No. (Current)'] || raw.currExamRoll || '',
      'Result (Current)': raw['Result (Current)'] || raw.currResult || 'Passed',
      'Marks/Reapp (Current)': raw['Marks/Reapp (Current)'] || raw.currMarksReapp || '',
      'Div/Distinc (Current)': raw['Div/Distinc (Current)'] || raw.currDiv || '',
      'Date of withdrawl': raw['Date of withdrawl'] || raw.withdrawalDate || '',
      'No. & Date of CC/DC Issued (This Institution)': raw['No. & Date of CC/DC Issued (This Institution)'] || raw.ccDcNo || '',
      'Remarks': raw['Remarks'] || ''
    };
  });

  // If no students in list, create a sample template row
  if (rows.length === 0) {
    rows.push({
      'S.No.': 1,
      'Form No.': '4923',
      'Class R.No.': '101',
      'Board Reg. No.': '2201000001160003',
      "Student's Name": 'Zaidan Wani',
      "Father's Name": 'Bilal Ahmad Wani',
      'Class': className,
      'Stream': 'Science',
      'Session': session,
      'Exam Mode (Current)': 'Annual Regular 2025 (Oct.-Nov.)',
      'Exam R.No. (Current)': '301003053',
      'Result (Current)': 'Passed',
      'Marks/Reapp (Current)': '488 / 500',
      'Div/Distinc (Current)': 'Distinction',
      'Date of withdrawl': '14-01-2026',
      'No. & Date of CC/DC Issued (This Institution)': '1276 dated 14-01-2026',
      'Remarks': 'Sample entry'
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column width styling
  ws['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 10 }, // Form No
    { wch: 12 }, // Class R.No
    { wch: 20 }, // Board Reg No
    { wch: 24 }, // Student Name
    { wch: 24 }, // Father Name
    { wch: 8 },  // Class
    { wch: 14 }, // Stream
    { wch: 12 }, // Session
    { wch: 30 }, // Exam Mode
    { wch: 16 }, // Exam Roll No
    { wch: 16 }, // Result
    { wch: 22 }, // Marks / Reapp
    { wch: 18 }, // Div / Distinc
    { wch: 16 }, // Withdrawal Date
    { wch: 30 }, // CC/DC No
    { wch: 20 }  // Remarks
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'JKBOSE_Results');

  const cleanClass = String(className).replace(/[^a-zA-Z0-9]/g, '');
  const cleanSession = String(session).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `JKBOSE_Result_Template_Class_${cleanClass}_${cleanSession}.${format === 'csv' ? 'csv' : 'xlsx'}`;

  if (format === 'csv') {
    const csvStr = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    downloadFileBlob(blob, filename);
  } else {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadFileBlob(blob, filename);
  }
}

/**
 * Match a raw record against the existing students list using multi-attribute lookup.
 */
export function matchStudentInDatabase(record, existingStudents = []) {
  if (!existingStudents || existingStudents.length === 0) return null;

  const targetForm = String(record.formNo || record['Form No.'] || '').trim().toLowerCase();
  const targetReg = String(record.regNo || record['Board Reg. No.'] || '').trim().toLowerCase();
  const targetExamRoll = String(record.examRollNo || record['Exam R.No. (Current)'] || '').trim().toLowerCase();
  const targetName = String(record.studentName || record["Student's Name"] || '').trim().toLowerCase();
  const targetFather = String(record.fatherName || record["Father's Name"] || '').trim().toLowerCase();

  // 1. Exact Form No Match
  if (targetForm) {
    const found = existingStudents.find(s => {
      const f = String(s.formNo || s.raw?.['Form No.'] || s.raw?.formNo || '').trim().toLowerCase();
      return f && f === targetForm;
    });
    if (found) return { student: found, matchType: 'Form No Match', confidence: 100 };
  }

  // 2. Exact Registration No Match
  if (targetReg && targetReg.length > 5) {
    const found = existingStudents.find(s => {
      const r = String(s.regNo || s.raw?.['Board Reg. No.'] || s.raw?.regNo || '').trim().toLowerCase();
      return r && r === targetReg;
    });
    if (found) return { student: found, matchType: 'Board Reg No Match', confidence: 95 };
  }

  // 3. Exact Exam Roll No Match
  if (targetExamRoll && targetExamRoll.length > 5) {
    const found = existingStudents.find(s => {
      const e = String(s.raw?.['Exam R.No. (Current)'] || s.currExamRoll || '').trim().toLowerCase();
      return e && e === targetExamRoll;
    });
    if (found) return { student: found, matchType: 'Exam Roll Match', confidence: 90 };
  }

  // 4. Name + Father Name Match
  if (targetName && targetName.length > 3) {
    const found = existingStudents.find(s => {
      const n = String(s.name || s.raw?.["Student's Name"] || '').trim().toLowerCase();
      const f = String(s.fatherName || s.raw?.["Father's Name"] || '').trim().toLowerCase();
      if (!n) return false;
      const nameMatches = n === targetName || n.includes(targetName) || targetName.includes(n);
      if (targetFather && f) {
        return nameMatches && (f === targetFather || f.includes(targetFather) || targetFather.includes(f));
      }
      return nameMatches;
    });
    if (found) return { student: found, matchType: 'Name & Father Match', confidence: 80 };
  }

  return null;
}

/**
 * Parse and validate an uploaded Excel / CSV file against guardrails.
 */
export function parseAndValidateResultFile(fileData, existingStudents = []) {
  try {
    const wb = XLSX.read(fileData, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      throw new Error('The uploaded file is empty or could not be read.');
    }

    const processed = [];
    let passedCount = 0;
    let reapCount = 0;
    let failedCount = 0;
    let matchedCount = 0;

    rawRows.forEach((r, idx) => {
      const formNo = String(r['Form No.'] || r['formNo'] || r['Form_No'] || '').trim();
      const regNo = String(r['Board Reg. No.'] || r['regNo'] || r['Registration No'] || '').trim();
      const studentName = String(r["Student's Name"] || r['studentName'] || r['Name'] || '').trim();
      const fatherName = String(r["Father's Name"] || r['fatherName'] || '').trim();
      const className = String(r['Class'] || r['class'] || '').trim();
      const stream = String(r['Stream'] || r['stream'] || '').trim();
      const examMode = String(r['Exam Mode (Current)'] || r['examMode'] || 'Annual Regular 2025 (Oct.-Nov.)').trim();
      const examRollNo = String(r['Exam R.No. (Current)'] || r['examRoll'] || r['Roll No'] || '').trim();
      
      const rawResult = String(r['Result (Current)'] || r['result'] || 'Passed').trim();
      const resultStatus = normalizeResultStatus(rawResult);

      let marksReapp = String(r['Marks/Reapp (Current)'] || r['marksReapp'] || r['Marks'] || '').trim();
      let divDistinc = String(r['Div/Distinc (Current)'] || r['division'] || '').trim();

      // Guardrail Auto-calculation for marks & division
      if (resultStatus === 'Passed') {
        passedCount++;
        // If marks provided like "488" or "488 / 500"
        const numMatch = marksReapp.match(/(\d+)(?:\s*\/\s*(\d+))?/);
        if (numMatch) {
          const obt = parseInt(numMatch[1], 10);
          const max = numMatch[2] ? parseInt(numMatch[2], 10) : 500;
          marksReapp = `${obt} / ${max}`;
          if (!divDistinc || divDistinc === '—') {
            const { division } = calculateDivision(obt, max);
            divDistinc = division;
          }
        }
      } else if (resultStatus === 'Reap') {
        reapCount++;
        divDistinc = 'Re-appear';
      } else if (resultStatus === 'Failed') {
        failedCount++;
        divDistinc = 'Failed';
      }

      const withdrawalDate = String(r['Date of withdrawl'] || r['withdrawalDate'] || '').trim();
      const ccDcNo = String(r['No. & Date of CC/DC Issued (This Institution)'] || r['ccDcNo'] || '').trim();
      const remarks = String(r['Remarks'] || r['remarks'] || '').trim();

      // Database Match
      const matchResult = matchStudentInDatabase({
        formNo, regNo, examRollNo, studentName, fatherName
      }, existingStudents);

      if (matchResult) matchedCount++;

      processed.push({
        id: formNo || `row_${idx + 1}`,
        sNo: idx + 1,
        formNo: formNo || (matchResult ? matchResult.student.formNo : ''),
        regNo: regNo || (matchResult ? matchResult.student.regNo : ''),
        studentName: studentName || (matchResult ? matchResult.student.name : '—'),
        fatherName: fatherName || (matchResult ? matchResult.student.fatherName : '—'),
        className: className || (matchResult ? matchResult.student.selectedClass : ''),
        stream: stream || (matchResult ? matchResult.student.selectedStream : ''),
        examMode,
        examRollNo,
        resultStatus,
        marksReapp,
        divDistinc,
        withdrawalDate,
        ccDcNo,
        remarks,
        matchedStudent: matchResult ? matchResult.student : null,
        matchType: matchResult ? matchResult.matchType : 'Unmatched (New)',
        matchConfidence: matchResult ? matchResult.confidence : 0,
        selectedForImport: true
      });
    });

    return {
      success: true,
      rows: processed,
      stats: {
        total: processed.length,
        matched: matchedCount,
        unmatched: processed.length - matchedCount,
        passed: passedCount,
        reap: reapCount,
        failed: failedCount
      }
    };
  } catch (err) {
    console.error('Error parsing result file:', err);
    return {
      success: false,
      error: err.message || 'Failed to parse file'
    };
  }
}

/**
 * Analyze raw JKBOSE Result Gazette (PDF or Scanned Image) via Gemini AI Multimodal Vision.
 */
export async function analyzeGazetteWithGemini(fileBase64, mimeType, existingStudents = [], progressCallback = null) {
  try {
    if (progressCallback) progressCallback('Fetching Gemini AI API credentials...');
    const keys = await fetchCloudGeminiKeys();
    if (!keys || keys.length === 0) {
      throw new Error('No Gemini API keys found. Please configure a valid Google Gemini API Key in the settings.');
    }

    const preferredModel = getPreferredGeminiModel() || 'gemini-3.7-flash';

    if (progressCallback) progressCallback(`Processing document with ${preferredModel}...`);

    const prompt = `You are a high-precision JKBOSE (Jammu & Kashmir Board of School Education) Result Gazette and Examination Result Parser.
Analyze this attached examination result gazette / document image and extract all student result rows.

For each student found in the gazette, extract:
1. "examRollNo": Examination roll number (e.g. "301003053", "101060027")
2. "regNo": JKBOSE Registration number if visible (e.g. "2201000001160003")
3. "studentName": Full name of the candidate
4. "fatherName": Father's name if present
5. "result": Result status strictly as one of: "Passed", "Reap", "Failed"
6. "marksObtained": Numeric marks obtained if passed (e.g. 488, 392). null if not passed.
7. "maxMarks": Total maximum marks (e.g. 500).
8. "reappSubjects": If result is "Reap", list the subject abbreviations separated by space (e.g. "PH CH BI", "GN PH CH MH ITE"). null if passed.
9. "division": Division or distinction if passed (e.g. "Distinction", "1st Division", "2nd Division", "3rd Division").
10. "examMode": Examination session title if present (e.g. "Annual Regular 2025 (Oct.-Nov.)").

CRITICAL FORMAT REQUIREMENT:
Respond ONLY with a valid JSON array of objects. Do not include markdown commentary, markdown fences, or extra text.
Example:
[
  {
    "examRollNo": "301003053",
    "regNo": "2201000001160003",
    "studentName": "ZAIDAN WANI",
    "fatherName": "BILAL AHMAD WANI",
    "result": "Passed",
    "marksObtained": 488,
    "maxMarks": 500,
    "reappSubjects": null,
    "division": "Distinction",
    "examMode": "Annual Regular 2025 (Oct.-Nov.)"
  }
]`;

    let lastError = null;
    let jsonText = '';

    // Key rotation pool
    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${preferredModel}:generateContent?key=${apiKey}`;
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'application/pdf',
                      data: fileBase64.replace(/^data:[^;]+;base64,/, '')
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (jsonText) break;
      } catch (e) {
        console.warn(`Gemini key index ${i} failed:`, e);
        lastError = e;
      }
    }

    if (!jsonText) {
      throw lastError || new Error('Gemini AI could not extract content from the document.');
    }

    if (progressCallback) progressCallback('Matching AI extracted records against school database...');

    // Clean JSON response
    const cleanJson = jsonText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const rawParsed = JSON.parse(cleanJson);
    const list = Array.isArray(rawParsed) ? rawParsed : (rawParsed.results || rawParsed.students || []);

    const processed = [];
    let passedCount = 0;
    let reapCount = 0;
    let failedCount = 0;
    let matchedCount = 0;

    list.forEach((item, idx) => {
      const examRollNo = String(item.examRollNo || '').trim();
      const regNo = String(item.regNo || '').trim();
      const studentName = String(item.studentName || '').trim();
      const fatherName = String(item.fatherName || '').trim();
      const resultStatus = normalizeResultStatus(item.result);
      const examMode = String(item.examMode || 'Annual Regular 2025 (Oct.-Nov.)').trim();

      let marksReapp = '';
      let divDistinc = item.division || '';

      if (resultStatus === 'Passed') {
        passedCount++;
        const obt = item.marksObtained || '';
        const max = item.maxMarks || 500;
        marksReapp = obt ? `${obt} / ${max}` : '';
        if (obt && (!divDistinc || divDistinc === '—')) {
          const { division } = calculateDivision(obt, max);
          divDistinc = division;
        }
      } else if (resultStatus === 'Reap') {
        reapCount++;
        marksReapp = item.reappSubjects || 'Re-appear';
        divDistinc = 'Re-appear';
      } else {
        failedCount++;
        divDistinc = 'Failed';
      }

      // Match with database
      const matchResult = matchStudentInDatabase({
        regNo, examRollNo, studentName, fatherName
      }, existingStudents);

      if (matchResult) matchedCount++;

      processed.push({
        id: matchResult ? matchResult.student.formNo : `ai_row_${idx + 1}`,
        sNo: idx + 1,
        formNo: matchResult ? matchResult.student.formNo : '',
        regNo: regNo || (matchResult ? matchResult.student.regNo : ''),
        studentName: studentName || (matchResult ? matchResult.student.name : '—'),
        fatherName: fatherName || (matchResult ? matchResult.student.fatherName : '—'),
        className: matchResult ? matchResult.student.selectedClass : '12th',
        stream: matchResult ? matchResult.student.selectedStream : '',
        examMode,
        examRollNo,
        resultStatus,
        marksReapp,
        divDistinc,
        withdrawalDate: '',
        ccDcNo: '',
        remarks: 'Extracted via Gemini AI',
        matchedStudent: matchResult ? matchResult.student : null,
        matchType: matchResult ? matchResult.matchType : 'Unmatched (New)',
        matchConfidence: matchResult ? matchResult.confidence : 0,
        selectedForImport: true
      });
    });

    return {
      success: true,
      rows: processed,
      stats: {
        total: processed.length,
        matched: matchedCount,
        unmatched: processed.length - matchedCount,
        passed: passedCount,
        reap: reapCount,
        failed: failedCount
      }
    };

  } catch (err) {
    console.error('Gemini Gazette Analysis Error:', err);
    return {
      success: false,
      error: err.message || 'Gemini AI Gazette analysis failed'
    };
  }
}

/**
 * Batch update student results in Firebase Firestore & update local memory cache.
 */
export async function batchUpdateStudentResults(recordsToUpdate = []) {
  if (!recordsToUpdate || recordsToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  const batch = writeBatch(db);
  let updatedCount = 0;

  for (const item of recordsToUpdate) {
    const formNo = String(item.formNo || item.id || '').trim();
    if (!formNo) continue;

    const patch = {
      'Exam Mode (Current)': item.examMode || '',
      'Exam R.No. (Current)': item.examRollNo || '',
      'Result (Current)': item.resultStatus || 'Passed',
      'Marks/Reapp (Current)': item.marksReapp || '',
      'Div/Distinc (Current)': item.divDistinc || '',
      currExamMode: item.examMode || '',
      currExamRoll: item.examRollNo || '',
      currResult: item.resultStatus || 'Passed',
      currMarksReapp: item.marksReapp || '',
      currDiv: item.divDistinc || '',
      updatedAt: serverTimestamp()
    };

    if (item.withdrawalDate) {
      patch['Date of withdrawl'] = item.withdrawalDate;
      patch.withdrawalDate = item.withdrawalDate;
    }
    if (item.ccDcNo) {
      patch['No. & Date of CC/DC Issued (This Institution)'] = item.ccDcNo;
      patch.ccDcNo = item.ccDcNo;
    }
    if (item.remarks) {
      patch['Remarks'] = item.remarks;
    }

    const studentRef = doc(db, 'admissions', formNo);
    batch.set(studentRef, patch, { merge: true });

    // Sync localStorage / in-memory cache instantly
    updateCachedItem('admissions', formNo, patch);
    updatedCount++;
  }

  await batch.commit();

  return { success: true, count: updatedCount };
}
