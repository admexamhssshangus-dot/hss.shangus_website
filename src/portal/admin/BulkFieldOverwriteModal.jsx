import React, { useState, useMemo } from 'react';
import { 
  X, AlertTriangle, CheckSquare, Square, FileSpreadsheet, 
  Upload, Copy, CheckCircle2, User, BookOpen, Award, Hash,
  ArrowRight, Sparkles, RefreshCw, Eye, EyeOff, Plus, Trash2,
  ChevronDown, ChevronUp, Database, Sliders
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateCachedItem, getCachedCollectionSync } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { saveCsvImportBatch } from '../../services/csvBatchManager';
import { toTitleCase } from '../../utils/textFormatting';
import { cleanRawSubjectTokens, formatDobToDisplay } from './AdvancedReports';

// ─── Standard Database Fields Grouped by Functional Categories ───
export const STANDARD_DB_CATEGORIES = [
  {
    id: 'core_bio',
    title: 'Core Board Identity & Bio',
    badge: 'Authoritative',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    color: 'emerald',
    icon: User,
    fields: [
      { key: 'studentName', label: "Student's Name", defaultChecked: true, dbKeys: ["Student's Name (as per school records)", "Student's Name", 'Student Name', 'studentName', 'name'], excelKeys: ['studentname', 'name', 'candidatename', 'nameofstudent', 'candidate'] },
      { key: 'fatherName', label: "Father's Name", defaultChecked: true, dbKeys: ["Father's/Guardian's Name (as per school records)", "Father's Name", 'Father Name', 'fatherName', "Parent's Name", 'parentName', 'parentage'], excelKeys: ['fathername', 'fathersname', 'parentname', 'parentage'] },
      { key: 'motherName', label: "Mother's Name", defaultChecked: true, dbKeys: ["Mother's Name (as per school records)", "Mother's Name", 'Mother Name', 'motherName'], excelKeys: ['mothername', 'mothersname'] },
      { key: 'dob', label: "Date of Birth (DoB)", defaultChecked: true, dbKeys: ['DoB (figures)', 'DoB (as per school records)', 'dob', 'DoB', 'dateOfBirth'], excelKeys: ['dob', 'dateofbirth', 'dobfigures', 'birthdate'] },
      { key: 'dobWords', label: "DoB (in words)", defaultChecked: false, dbKeys: ['DoB (words)', 'dobWords', 'dateOfBirthInWords'], excelKeys: ['dobwords', 'dateofbirthinwords'] },
      { key: 'gender', label: "Gender", defaultChecked: true, dbKeys: ['Gender', 'gender', 'Sex', 'sex'], excelKeys: ['gender', 'sex'] },
      { key: 'bloodGroup', label: "Blood Group", defaultChecked: false, dbKeys: ['Blood Group', 'bloodGroup', 'blood_group'], excelKeys: ['bloodgroup', 'blood'] },
      { key: 'religion', label: "Religion", defaultChecked: false, dbKeys: ['Religion', 'religion'], excelKeys: ['religion'] },
    ]
  },
  {
    id: 'academics',
    title: 'Academic Details & Curriculum',
    badge: 'Curriculum',
    badgeClass: 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    color: 'blue',
    icon: BookOpen,
    fields: [
      { key: 'stream', label: "Stream", defaultChecked: true, dbKeys: ['Stream', 'stream', 'Stream for Class 11th', 'Stream opted in Class 11th', 'Stream & Subjects for Class 12th', 'faculty'], excelKeys: ['stream', 'faculty'] },
      { key: 'subjects', label: "Subjects (Auto-Expand)", defaultChecked: true, dbKeys: ['Subjects', 'subjects', 'selectedSubjects', 'Subjects to be taken in Class 12th', 'Subjects to be taken in Class 11th', 'subs', 'Subs', 'Subjects Offered'], excelKeys: ['subjects', 'subs', 'subjectsoffered', 'subjectcomb', 'subjectcombination'] },
      { key: 'classRollNo', label: "Class Roll No.", defaultChecked: false, dbKeys: ['Class Roll No', 'Class Roll No.', 'rollNo', 'classRollNo', 'RL. NO.', 'RL. NO', 'Class R.No.', 'Class R.No'], excelKeys: ['classrollno', 'classroll', 'rno'] },
      { key: 'className', label: "Class", defaultChecked: false, dbKeys: ['Admission sought for class', 'Class', 'class', 'className'], excelKeys: ['class', 'classname', 'admissionsoughtforclass'] },
      { key: 'session', label: "Session", defaultChecked: false, dbKeys: ['Session', 'session'], excelKeys: ['session', 'academicsession'] },
      { key: 'admissionType', label: "Admission Type", defaultChecked: false, dbKeys: ['Admission Type', 'admissionType', 'Type of Admission'], excelKeys: ['admissiontype', 'typeofadmission'] },
      { key: 'prevSchool', label: "Previous School", defaultChecked: false, dbKeys: ['Previous School', 'prevSchool', 'Name of the Institution last attended', 'Name of the institution last attended', 'School last attended'], excelKeys: ['previousschool', 'prevschool', 'lastschool'] },
      { key: 'prevExamRollNo', label: "10th Exam Roll No.", defaultChecked: false, dbKeys: ['Exam R.No. (Prev.)', 'Roll No. (Class 10th)', 'prevExamRollNo', 'examRollPrev', 'Exam R.no. (Prev.)'], excelKeys: ['prevexamrollno', '10thexamrollno', 'rollnoclass10th', 'prevrollno'] },
      { key: 'prevMarks', label: "10th Marks Obtained", defaultChecked: false, dbKeys: ['10th/11th Marks', 'Marks Obt. (Prev.)', 'Marks Obtained (Class 10th)', 'prevMarks', 'Marks obtained in previous examination'], excelKeys: ['prevmarks', '10thmarks', 'marks10th', 'previousmarks', 'marksobtprev'] },
      { key: 'prevMaxMarks', label: "10th Max Marks", defaultChecked: false, dbKeys: ['Max. Marks (Prev.)', 'Max Marks (Class 10th)', 'prevMaxMarks'], excelKeys: ['prevmaxmarks', '10thmaxmarks', 'maxmarksprev'] },
      { key: 'prevPercentage', label: "10th Percentage (%)", defaultChecked: false, dbKeys: ['%age (Prev.)', 'Percentage (Class 10th)', 'prevPercentage'], excelKeys: ['prevpercentage', '10thpercentage', 'prevpercent'] },
      { key: 'prevDivision', label: "10th Division / Grade", defaultChecked: false, dbKeys: ['Div/Distinc (Prev.)', 'prevDivision'], excelKeys: ['prevdivision', '10thdivision', 'prevgrade'] },
    ]
  },
  {
    id: 'results',
    title: 'Board Exam & Results (Bulk Sync)',
    badge: 'Gazette & Board',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    color: 'amber',
    icon: Award,
    fields: [
      { key: 'boardRollNo', label: "Exam Roll No. (Board)", defaultChecked: false, dbKeys: ['Exam R.No. (Current)', 'Board Roll Number', 'Board Roll No.', 'Board Roll No', 'boardRollNo', 'examRollNo', 'currExamRollNo', 'Roll No.', 'Roll No', 'Exam R.No.'], excelKeys: ['boardrollno', 'examrollno', 'boardrollnumber', 'boardroll', 'rollnumber', 'rollno', 'examroll'] },
      { key: 'result', label: "Board Result Status", defaultChecked: false, dbKeys: ['Board Result', 'Result (Current)', 'Result', 'result', 'boardResult', 'currResult', 'statusResult'], excelKeys: ['boardresult', 'result', 'resultstatus', 'examresult', 'status'] },
      { key: 'marks', label: "Marks Obtained", defaultChecked: false, dbKeys: ['Marks/Reapp (Current)', 'Marks Obtained', 'Marks', 'marks', 'totalMarks', 'marksObtained', 'currMarksReapp'], excelKeys: ['marksobtained', 'marks', 'totalmarks', 'securedmarks', 'obtmarks'] },
      { key: 'maxMarks', label: "Max Marks", defaultChecked: false, dbKeys: ['Max Marks', 'Maximum Marks', 'maxMarks', 'totalMaxMarks'], excelKeys: ['maxmarks', 'maximummarks', 'totalmax', 'outof'] },
      { key: 'percentage', label: "Percentage (%)", defaultChecked: false, dbKeys: ['Percentage', 'percentage', 'percent', 'pct'], excelKeys: ['percentage', 'percent', 'pct', 'markspercentage'] },
      { key: 'grade', label: "Grade / Division", defaultChecked: false, dbKeys: ['Grade', 'Division', 'grade', 'division'], excelKeys: ['grade', 'division', 'gradeawarded'] },
    ]
  },
  {
    id: 'ids_demographics',
    title: 'Official IDs, Contact & Demographics',
    badge: 'Registry',
    badgeClass: 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    color: 'purple',
    icon: Hash,
    fields: [
      { key: 'category', label: "Social Category", defaultChecked: false, dbKeys: ['Cat._JKBOSE', 'Category', 'Social Category', 'Social category', 'category'], excelKeys: ['category', 'socialcategory', 'catjkbose', 'caste'] },
      { key: 'boardRegNo', label: "Board Reg. No.", defaultChecked: false, dbKeys: ['Board Registration Number', 'Board Registration No. (Class 11th)', 'Board Registration No. (Class 10th)', 'Board Reg. No.', 'boardRegNo', 'regNo', 'Registration No. (allotted by JKBOSE)', 'REG. NO.'], excelKeys: ['registrationno', 'regno', 'boardregno', 'boardregistrationno'] },
      { key: 'admNo', label: "Admission No.", defaultChecked: false, dbKeys: ['Admission No.', 'Adm. No.', 'admNo', 'admissionNo'], excelKeys: ['admissionno', 'admno', 'admissionnumber'] },
      { key: 'apaarId', label: "APAAR ID (12-Digit)", defaultChecked: false, dbKeys: ['APAAR ID', 'apaarId', 'apaar', 'apaarNumber'], excelKeys: ['apaarid', 'apaar', 'apaarnumber'] },
      { key: 'penNo', label: "Student PEN No.", defaultChecked: false, dbKeys: ['Permanent Education Number (PEN)', 'PEN No', 'PEN No.', 'pen', 'penNo'], excelKeys: ['penno', 'pen', 'pennumber', 'studentpen'] },
      { key: 'aadhaarNo', label: "Aadhaar Card No.", defaultChecked: false, dbKeys: ['Aadhaar Number (12 Digits)', 'Aadhaar Number', 'Aadhaar No', 'aadhaarNo', 'aadhaar', 'aadhar', 'Aadhar No.'], excelKeys: ['aadhaarno', 'aadhaar', 'aadharnumber', 'uid', 'aadhar'] },
      { key: 'fatherAadhar', label: "Father's Aadhaar No.", defaultChecked: false, dbKeys: ["Father's Aadhar No.", "Father's Aadhaar No.", 'fatherAadhar'], excelKeys: ['fatheraadhar', 'fatheraadhaar', 'fatheraadharno'] },
      { key: 'phone', label: "Mobile No.", defaultChecked: false, dbKeys: ['Mobile No. (with working WhatsApp)', 'Mobile No.', 'Mobile Number', 'phone', 'mobileNo', 'contactNo', 'mobile'], excelKeys: ['mobileno', 'mobilenumber', 'phone', 'contactno', 'mobile'] },
      { key: 'parentMobile', label: "Parent's Mobile", defaultChecked: false, dbKeys: ["Parent's Contact", "Parent's Mobile No. (must be working)", "Parent's Mobile No.", "Father's Mobile No.", 'parentMobile', 'parentContact'], excelKeys: ['parentmobile', 'parentscontact', 'fathermobile'] },
      { key: 'email', label: "Email Address", defaultChecked: false, dbKeys: ['Email', 'Email Address', 'email', 'email1'], excelKeys: ['email', 'emailaddress'] },
      { key: 'address', label: "Village / Address", defaultChecked: false, dbKeys: ['Name of your village', 'Permanent Address', 'Village / Town', 'Village/Town', 'village', 'address', 'Residence (Village, District)'], excelKeys: ['village', 'nameofyourvillage', 'town', 'address', 'locality'] },
      { key: 'block', label: "Block", defaultChecked: false, dbKeys: ['Block', 'block'], excelKeys: ['block'] },
      { key: 'tehsil', label: "Tehsil", defaultChecked: false, dbKeys: ['Tehsil', 'tehsil'], excelKeys: ['tehsil'] },
      { key: 'district', label: "District", defaultChecked: false, dbKeys: ['District', 'district'], excelKeys: ['district'] },
      { key: 'pinCode', label: "PIN Code", defaultChecked: false, dbKeys: ['PIN code', 'Pin Code', 'pinCode'], excelKeys: ['pincode', 'pin'] },
      { key: 'state', label: "State / UT", defaultChecked: false, dbKeys: ['State/UT', 'State', 'state'], excelKeys: ['state', 'stateut'] },
      { key: 'bankAccount', label: "Bank Account No.", defaultChecked: false, dbKeys: ['Bank Account Number', 'Bank Account No.', 'bankAccount', 'bankAccountNo', 'bank'], excelKeys: ['bankaccount', 'bankaccountno', 'accountno', 'accno'] },
      { key: 'bankName', label: "Bank Name", defaultChecked: false, dbKeys: ['Name of the Bank', 'Name of Bank', 'Bank Name', 'bankName'], excelKeys: ['bankname', 'bank'] },
      { key: 'ifsc', label: "IFSC Code", defaultChecked: false, dbKeys: ['IFSC Code of the Bank Branch', 'IFSC Code', 'IFSC code', 'ifsc', 'ifscCode'], excelKeys: ['ifsc', 'ifsccode'] },
      { key: 'disability', label: "Disability Status", defaultChecked: false, dbKeys: ['Whether specially-abled (PwD)', 'Disability Status', 'disability', 'pwd'], excelKeys: ['disability', 'pwd', 'speciallyabled'] },
      { key: 'remarks', label: "Remarks", defaultChecked: false, dbKeys: ['Remarks', 'remarks'], excelKeys: ['remarks', 'remark'] },
    ]
  }
];

export default function BulkFieldOverwriteModal({
  isOpen,
  onClose,
  allStudents = [],
  currentSession = '2025-26',
  onComplete
}) {
  // Step navigation
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'executing' | 'completed'
  const [targetClass, setTargetClass] = useState('All');
  const [targetSession, setTargetSession] = useState(currentSession || '2025-26');
  const [matchIdentifier, setMatchIdentifier] = useState('regNo'); // 'regNo' | 'admNo' | 'formNo'

  // Hide / Unhide field selection matrix (defaults to true; can be hidden/unhidden at any time)
  const [showFieldMatrix, setShowFieldMatrix] = useState(true);

  // Custom fields added dynamically by user
  const [customFields, setCustomFields] = useState([]);
  const [customFieldInput, setCustomFieldInput] = useState('');

  // Selected fields to overwrite
  const [selectedFields, setSelectedFields] = useState(() => {
    const initial = {};
    STANDARD_DB_CATEGORIES.forEach(cat => {
      cat.fields.forEach(f => {
        initial[f.key] = Boolean(f.defaultChecked);
      });
    });
    return initial;
  });

  // Raw file & pasted data
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [, setRawParsedRows] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [previewFilter, setPreviewFilter] = useState('changed'); // 'changed' | 'all' | 'unmatched' | 'identical'
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [inspectStudent, setInspectStudent] = useState(null);

  // Execution Progress
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [executionStats, setExecutionStats] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Helper to normalize alphanumeric keys
  const cleanKey = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

  // Dynamic discovery of any additional fields present in actual database records
  const dynamicDatabaseCategories = useMemo(() => {
    const knownDbKeysSet = new Set();
    STANDARD_DB_CATEGORIES.forEach(cat => {
      cat.fields.forEach(f => {
        f.dbKeys.forEach(k => knownDbKeysSet.add(cleanKey(k)));
        knownDbKeysSet.add(cleanKey(f.key));
        knownDbKeysSet.add(cleanKey(f.label));
      });
    });

    const discoveredFields = [];
    const discoveredKeysSeen = new Set();

    // Scan all loaded student records to detect any custom or institutional keys
    const sampleStudents = Array.isArray(allStudents) ? allStudents : [];
    sampleStudents.forEach(st => {
      if (!st || typeof st !== 'object') return;
      Object.keys(st).forEach(rawK => {
        if (
          rawK.startsWith('_') || 
          rawK.startsWith('$') || 
          rawK === 'id' || 
          rawK === 'docId' || 
          rawK === 'createdAt' || 
          rawK === 'updatedAt' || 
          rawK === 'ownerUid' || 
          rawK === 'photo_id' || 
          rawK === 'photoUrl' ||
          rawK === 'photoId' ||
          rawK === 'Student Photo' || 
          rawK === 'studentPhoto' ||
          rawK === 'pdfUrl' ||
          rawK === 'PDF_URL' ||
          rawK === 'sno' ||
          rawK === 'hasMismatch' ||
          rawK === 'hasStreamMismatch' ||
          rawK === 'hasSubsMismatch' ||
          rawK === 'streamMismatchNotice' ||
          rawK === 'subsMismatchNotice' ||
          rawK === 'stream11th' ||
          rawK === 'subs11th' ||
          rawK === 'optedStream12th' ||
          rawK === 'optedSubs12th'
        ) {
          return;
        }
        const cKey = cleanKey(rawK);
        if (!cKey || knownDbKeysSet.has(cKey) || discoveredKeysSeen.has(cKey)) return;

        discoveredKeysSeen.add(cKey);
        discoveredFields.push({
          key: cKey,
          label: rawK,
          defaultChecked: false,
          dbKeys: [rawK, cKey],
          excelKeys: [cKey]
        });
      });
    });

    if (discoveredFields.length === 0) {
      return STANDARD_DB_CATEGORIES;
    }

    return [
      ...STANDARD_DB_CATEGORIES,
      {
        id: 'discovered_db',
        title: `Discovered in Database (${discoveredFields.length})`,
        badge: 'Live Database',
        badgeClass: 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800',
        color: 'teal',
        icon: Database,
        fields: discoveredFields
      }
    ];
  }, [allStudents]);

  // All active field definitions (standard + discovered + custom)
  const allFieldDefinitions = useMemo(() => {
    const std = [];
    dynamicDatabaseCategories.forEach(cat => {
      std.push(...cat.fields);
    });
    return [...std, ...customFields];
  }, [dynamicDatabaseCategories, customFields]);

  // Active selected field labels for the compact summary pill
  const activeFieldLabels = useMemo(() => {
    return allFieldDefinitions
      .filter(f => selectedFields[f.key])
      .map(f => f.label);
  }, [allFieldDefinitions, selectedFields]);

  const selectedCount = activeFieldLabels.length;

  // Toggle field selection
  const handleToggleField = (fieldKey) => {
    setSelectedFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  // Preset selectors
  const handleSelectPreset = (presetType) => {
    const next = {};
    allFieldDefinitions.forEach(f => {
      if (presetType === 'board_bio') {
        const bioKeys = ['studentName', 'fatherName', 'motherName', 'dob', 'gender', 'stream', 'subjects'];
        next[f.key] = bioKeys.includes(f.key);
      } else if (presetType === 'exam_results') {
        const resKeys = ['boardRollNo', 'result', 'marks', 'maxMarks', 'percentage', 'grade'];
        next[f.key] = resKeys.includes(f.key);
      } else if (presetType === 'bio_and_ids') {
        const idKeys = ['studentName', 'fatherName', 'motherName', 'dob', 'gender', 'stream', 'subjects', 'category', 'boardRegNo', 'admNo', 'apaarId', 'penNo', 'aadhaarNo'];
        next[f.key] = idKeys.includes(f.key);
      } else if (presetType === 'all') {
        next[f.key] = true;
      } else if (presetType === 'none') {
        next[f.key] = false;
      }
    });
    setSelectedFields(next);
  };

  // Add custom database field
  const handleAddCustomField = () => {
    const clean = customFieldInput.trim();
    if (!clean) return;
    const cleanK = cleanKey(clean);
    if (!cleanK) return;

    if (allFieldDefinitions.some(f => f.key === cleanK || cleanKey(f.label) === cleanK)) {
      setErrorMsg(`Field "${clean}" already exists in the database schema.`);
      return;
    }

    const newFieldDef = {
      key: cleanK,
      label: clean,
      defaultChecked: true,
      dbKeys: [clean, cleanK],
      excelKeys: [cleanK]
    };

    setCustomFields(prev => [...prev, newFieldDef]);
    setSelectedFields(prev => ({ ...prev, [cleanK]: true }));
    setCustomFieldInput('');
    setErrorMsg(null);
  };

  const handleRemoveCustomField = (keyToRemove) => {
    setCustomFields(prev => prev.filter(f => f.key !== keyToRemove));
    setSelectedFields(prev => {
      const next = { ...prev };
      delete next[keyToRemove];
      return next;
    });
  };

  // Parse Excel file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (!rows || rows.length === 0) {
          setErrorMsg('The uploaded spreadsheet contains no readable rows.');
          return;
        }
        processIncomingRows(rows, file.name);
      } catch (err) {
        console.error('Spreadsheet read error:', err);
        setErrorMsg('Failed to parse spreadsheet: ' + (err.message || 'Invalid format'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Parse direct paste text
  const handlePasteProcess = () => {
    if (!pasteText.trim()) {
      setErrorMsg('Please paste spreadsheet table rows first.');
      return;
    }
    setErrorMsg(null);
    try {
      const wb = XLSX.read(pasteText, { type: 'string', raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      if (!rows || rows.length === 0) {
        setErrorMsg('Could not parse any rows from the pasted text.');
        return;
      }
      setFileName('Pasted Clipboard Data');
      processIncomingRows(rows, 'Pasted Clipboard Data');
    } catch (err) {
      console.error('Paste parse error:', err);
      setErrorMsg('Failed to parse pasted data: ' + err.message);
    }
  };

  // Core processor: Map columns & correlate with existing database records
  const processIncomingRows = (rows, sourceTitle) => {
    setRawParsedRows(rows);

    // Build database lookup maps from allStudents
    const studentByReg = new Map();
    const studentByAdm = new Map();
    const studentByForm = new Map();

    allStudents.forEach(st => {
      const reg = cleanKey(st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.']);
      const adm = cleanKey(st.admNo || st['Admission No.'] || st['Adm. No.']);
      const form = cleanKey(st.formNo || st['Form Number'] || st['Form No.'] || st.id);

      if (reg && reg.length > 5 && !reg.endsWith('00000000')) studentByReg.set(reg, st);
      if (adm && adm !== '—') studentByAdm.set(adm, st);
      if (form && form !== '—') studentByForm.set(form, st);
    });

    const correlated = [];
    const initialSelectedIds = new Set();

    rows.forEach((row, idx) => {
      // Normalize row keys
      const normalizedRow = {};
      Object.entries(row).forEach(([k, v]) => {
        normalizedRow[cleanKey(k)] = typeof v === 'string' ? v.trim() : String(v || '');
      });

      // Find match key from row
      const rawReg = normalizedRow['registrationno'] || normalizedRow['regno'] || normalizedRow['boardregno'] || normalizedRow['registrationnumber'] || normalizedRow['boardregistrationno'] || normalizedRow['boardregn'] || '';
      const rawAdm = normalizedRow['admissionno'] || normalizedRow['admno'] || normalizedRow['admissionnumber'] || '';
      const rawForm = normalizedRow['formno'] || normalizedRow['formnumber'] || normalizedRow['fno'] || '';

      const cleanReg = cleanKey(rawReg);
      const cleanAdm = cleanKey(rawAdm);
      const cleanForm = cleanKey(rawForm);

      let matchedStudent = null;
      if (matchIdentifier === 'regNo' && cleanReg) matchedStudent = studentByReg.get(cleanReg);
      else if (matchIdentifier === 'admNo' && cleanAdm) matchedStudent = studentByAdm.get(cleanAdm);
      else if (matchIdentifier === 'formNo' && cleanForm) matchedStudent = studentByForm.get(cleanForm);

      // Fallback cross-matching if primary didn't hit
      if (!matchedStudent && cleanReg) matchedStudent = studentByReg.get(cleanReg);
      if (!matchedStudent && cleanAdm) matchedStudent = studentByAdm.get(cleanAdm);
      if (!matchedStudent && cleanForm) matchedStudent = studentByForm.get(cleanForm);

      // Extract all incoming fields dynamically
      const incomingFields = {};
      allFieldDefinitions.forEach(f => {
        let extracted = '';
        for (const ek of f.excelKeys) {
          const val = normalizedRow[ek];
          if (val !== undefined && val !== '') {
            extracted = val;
            break;
          }
        }

        // Field specific cleanups
        if (f.key === 'studentName' || f.key === 'fatherName' || f.key === 'motherName' || f.key === 'gender' || f.key === 'stream' || f.key === 'category' || f.key === 'address') {
          extracted = toTitleCase(extracted);
        } else if (f.key === 'dob' && extracted) {
          extracted = formatDobToDisplay(extracted);
        } else if (f.key === 'subjects' && extracted) {
          extracted = cleanRawSubjectTokens(extracted).join(', ');
        }
        incomingFields[f.key] = extracted;
      });

      // Compute diff against matched student
      const diffs = {};
      let hasChanges = false;

      if (matchedStudent) {
        allFieldDefinitions.forEach(f => {
          if (!selectedFields[f.key]) return; // Only diff fields admin checked
          const incVal = incomingFields[f.key];
          if (!incVal) return; // If board excel didn't provide this field for this row, skip

          // Find current value in matched student
          let currVal = '';
          for (const k of f.dbKeys) {
            if (matchedStudent[k] !== undefined && String(matchedStudent[k]).trim() !== '' && matchedStudent[k] !== '—') {
              currVal = String(matchedStudent[k]).trim();
              break;
            }
          }

          if (f.key === 'subjects') {
            currVal = cleanRawSubjectTokens(currVal).join(', ');
          }

          const isDiff = currVal.toLowerCase() !== incVal.toLowerCase();
          if (isDiff) {
            diffs[f.key] = { 
              label: f.label,
              current: currVal || '—', 
              incoming: incVal 
            };
            hasChanges = true;
          }
        });
      }

      const rowId = `row_${idx}_${cleanReg || cleanAdm || cleanForm || idx}`;
      if (matchedStudent && hasChanges) {
        initialSelectedIds.add(rowId);
      }

      correlated.push({
        rowId,
        rowIndex: idx + 1,
        rawReg: rawReg || '—',
        rawAdm: rawAdm || '—',
        rawForm: rawForm || '—',
        incomingFields,
        matchedStudent,
        diffs,
        hasChanges,
        isMatched: Boolean(matchedStudent)
      });
    });

    setPreviewData(correlated);
    setSelectedRowIds(initialSelectedIds);
    setStep('preview');
  };

  // Filtered preview rows
  const filteredPreviewRows = useMemo(() => {
    return previewData.filter(r => {
      if (previewFilter === 'changed') return r.isMatched && r.hasChanges;
      if (previewFilter === 'identical') return r.isMatched && !r.hasChanges;
      if (previewFilter === 'unmatched') return !r.isMatched;
      return true; // 'all'
    });
  }, [previewData, previewFilter]);

  // Counts
  const stats = useMemo(() => {
    const total = previewData.length;
    const matched = previewData.filter(r => r.isMatched).length;
    const changed = previewData.filter(r => r.isMatched && r.hasChanges).length;
    const identical = matched - changed;
    const unmatched = total - matched;
    const selected = selectedRowIds.size;
    return { total, matched, changed, identical, unmatched, selected };
  }, [previewData, selectedRowIds]);

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === stats.changed && stats.changed > 0) {
      setSelectedRowIds(new Set());
    } else {
      const allChanged = new Set(previewData.filter(r => r.isMatched && r.hasChanges).map(r => r.rowId));
      setSelectedRowIds(allChanged);
    }
  };

  const handleToggleRow = (rowId) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  // ─── Execute Overwrite Pipeline ───
  const executeOverwrite = async () => {
    const rowsToExecute = previewData.filter(r => selectedRowIds.has(r.rowId) && r.matchedStudent);
    if (rowsToExecute.length === 0) {
      setErrorMsg('No students selected for overwrite.');
      return;
    }

    setStep('executing');
    setProgressPercent(5);
    setProgressStage('Initializing Board Data Overwrite...');
    setErrorMsg(null);

    try {
      const activeFieldsToUpdate = allFieldDefinitions.filter(f => selectedFields[f.key]);
      const timestamp = new Date().toISOString();
      const updatedSnapshots = [];
      let updatedCount = 0;

      for (let i = 0; i < rowsToExecute.length; i++) {
        const item = rowsToExecute[i];
        const st = item.matchedStudent;
        const inc = item.incomingFields;

        // Build updates payload based on checked fields
        const payload = {
          updatedAt: timestamp,
          lastEditedBy: 'Admin (Board Data Sync Overwriter)'
        };

        activeFieldsToUpdate.forEach(fieldDef => {
          const newVal = inc[fieldDef.key];
          if (!newVal) return;

          // Set all database keys registered for this field
          fieldDef.dbKeys.forEach(dbk => {
            payload[dbk] = newVal;
          });
          payload[fieldDef.key] = newVal;

          // Special subject slots formatting
          if (fieldDef.key === 'subjects') {
            const cleanedSubs = cleanRawSubjectTokens(newVal);
            payload['selectedSubjects'] = cleanedSubs;
            payload['Subjects'] = cleanedSubs.join(', ');
            payload['subjects'] = cleanedSubs.join(', ');
            payload['Subs'] = cleanedSubs.join(', ');
            payload['subs'] = cleanedSubs.join(', ');
            cleanedSubs.forEach((subName, sIdx) => {
              if (sIdx < 6) {
                payload[`Subjects${sIdx + 1}`] = subName;
                payload[`subject${sIdx + 1}`] = subName;
              }
            });
          }
        });

        // Destination collection: active session -> admissions; historical -> masterRegisters chunk
        const isHistorical = Boolean(st._isHistorical || st._source === 'masterRegisters');
        const docId = String(st._docId || st.docId || st.id || st.formNo).trim();

        if (!isHistorical) {
          // Write to admissions
          await setDoc(doc(db, 'admissions', docId), payload, { merge: true });
          updateCachedItem('admissions', docId, payload);
        } else {
          // Historical Master Register Chunk update
          const normalized = (val) => String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const masterCache = getCachedCollectionSync('masterRegisters') || [];
          let parentDocId = null;
          let arrayKey = null;

          for (const chunkDoc of masterCache) {
            if (!chunkDoc) continue;
            for (const k of ['students', 'items', 'records', 'data']) {
              if (Array.isArray(chunkDoc[k])) {
                const found = chunkDoc[k].some(r => {
                  const rForm = normalized(r.formNo || r['Form Number'] || r['Form No.'] || r.id);
                  const rReg = normalized(r.boardRegNo || r.regNo || r['Board Registration Number']);
                  const rName = normalized(r.studentName || r["Student's Name"]);
                  return (item.rawForm && rForm === normalized(item.rawForm)) ||
                         (item.rawReg && rReg === normalized(item.rawReg)) ||
                         (st.studentName && rName === normalized(st.studentName));
                });
                if (found) {
                  parentDocId = chunkDoc.id || chunkDoc._docId;
                  arrayKey = k;
                  break;
                }
              }
            }
            if (parentDocId) break;
          }

          if (parentDocId && arrayKey) {
            const parentRef = doc(db, 'masterRegisters', String(parentDocId));
            const parentSnap = await getDoc(parentRef);
            if (parentSnap.exists()) {
              const currentArray = parentSnap.data()?.[arrayKey] || [];
              const updatedArray = currentArray.map(r => {
                const rForm = normalized(r.formNo || r['Form Number'] || r['Form No.'] || r.id);
                const rReg = normalized(r.boardRegNo || r.regNo || r['Board Registration Number']);
                const rName = normalized(r.studentName || r["Student's Name"]);
                const matches = (item.rawForm && rForm === normalized(item.rawForm)) ||
                                (item.rawReg && rReg === normalized(item.rawReg)) ||
                                (st.studentName && rName === normalized(st.studentName));
                if (!matches) return r;
                return { ...r, ...payload };
              });
              await setDoc(parentRef, { [arrayKey]: updatedArray, updatedAt: serverTimestamp() }, { merge: true });
              updateCachedItem('masterRegisters', String(parentDocId), { [arrayKey]: updatedArray });
            }
          } else {
            // Fallback direct document update
            await setDoc(doc(db, 'masterRegisters', docId), payload, { merge: true });
            updateCachedItem('masterRegisters', docId, payload);
          }
        }

        updatedSnapshots.push({
          docId,
          collection: isHistorical ? 'masterRegisters' : 'admissions',
          studentName: inc.studentName || st.studentName,
          formNo: st.formNo || item.rawForm,
          regNo: item.rawReg,
          appliedFields: payload
        });

        updatedCount++;
        const pct = 10 + Math.round(((i + 1) / rowsToExecute.length) * 80);
        setProgressPercent(pct);
        setProgressStage(`Overwriting records (${i + 1}/${rowsToExecute.length})...`);
      }

      // Save to 30-Day Batch Rollback Manager
      if (updatedSnapshots.length > 0) {
        setProgressStage('Saving 30-Day Rollback Snapshot...');
        await saveCsvImportBatch({
          fileName: `Board Data Overwrite: ${fileName || 'JKBOSE Sync'} (${updatedCount} students)`,
          importedRecords: updatedSnapshots,
          reasonCategory: 'Board Data Sync & Field Overwrite',
          customReason: `Synchronized ${updatedCount} students with Board data for session ${targetSession}`
        }).catch(e => console.warn('Rollback snapshot note:', e));
      }

      // Log Admin Activity
      await logAdminActivity({
        actionType: 'bulk_field_overwrite',
        actionTitle: 'Board Data Bulk Field Overwrite',
        details: `Successfully synchronized and overwritten verified Board fields for ${updatedCount} students (${targetClass}, ${targetSession}) from ${fileName || 'Excel Sheet'}`,
        reasonCategory: 'Board Data Sync & Record Verification',
        metadata: {
          count: updatedCount,
          fields: Object.keys(selectedFields).filter(k => selectedFields[k]),
          session: targetSession,
          class: targetClass
        }
      });

      // Trigger global event notifications
      window.dispatchEvent(new CustomEvent('hss-results-updated'));
      window.dispatchEvent(new CustomEvent('hss-master-register-updated'));

      setProgressPercent(100);
      setProgressStage('All fields successfully overwritten and synchronized!');
      setExecutionStats({ updatedCount });
      setStep('completed');

      if (onComplete) onComplete({ updatedCount });
    } catch (err) {
      console.error('Execution error during bulk field overwrite:', err);
      setErrorMsg('Failed during overwrite execution: ' + err.message);
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-white to-blue-50/70 dark:from-emerald-950/20 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Board Data Sync & Bulk Overwriter</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Database Schema Grounded
                </span>
              </h2>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Bulk overwrite student records, exam roll numbers, and board results with official spreadsheet data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4 text-xs">

          {/* ──────── STEP 1: UPLOAD & CATEGORIZED FIELD SELECTION ──────── */}
          {step === 'upload' && (
            <div className="space-y-4">
              
              {/* Target Scope & Matching Identifier */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Target Academic Session
                  </label>
                  <select
                    value={targetSession}
                    onChange={(e) => setTargetSession(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="2025-26">2025–26 (Active Intake)</option>
                    <option value="2024-25">2024–25 (Previous Session)</option>
                    <option value="2023-24">2023–24 (Historical Archive)</option>
                    <option value="2022-23">2022–23 (Historical Archive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Target Class Scope
                  </label>
                  <select
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="All">All Classes (Auto-Detect)</option>
                    <option value="12th">Class 12th</option>
                    <option value="11th">Class 11th</option>
                    <option value="10th">Class 10th</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Primary Match Key
                  </label>
                  <select
                    value={matchIdentifier}
                    onChange={(e) => setMatchIdentifier(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="regNo">Board Registration Number (Recommended)</option>
                    <option value="admNo">School Admission Number</option>
                    <option value="formNo">Application Form Number</option>
                  </select>
                </div>
              </div>

              {/* Collapsible Database Fields Selector (Hide / Unhide Matrix) */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div 
                    onClick={() => setShowFieldMatrix(prev => !prev)}
                    className="flex items-center gap-2 cursor-pointer select-none"
                    title={showFieldMatrix ? "Click to hide field selection" : "Click to unhide field selection"}
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Database size={13} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Select Fields to Overwrite From Spreadsheet
                        </h3>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {selectedCount} Active
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500">
                        Based on database fields • Only checked fields will be overwritten; all other student records remain untouched
                      </p>
                    </div>
                  </div>

                  {/* Preset Buttons + Hide/Unhide Toggle Button */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('board_bio')}
                      className="px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles size={11} />
                      <span>Board Bio (Default)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('exam_results')}
                      className="px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-amber-600 hover:bg-amber-500 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Award size={11} />
                      <span>Exam & Results Only</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('bio_and_ids')}
                      className="px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Hash size={11} />
                      <span>Bio + All IDs</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset('none')}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-bold text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      Clear All
                    </button>

                    {/* Dedicated Hide / Unhide Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowFieldMatrix(prev => !prev)}
                      className={`px-3 py-1 rounded-lg text-[10.5px] font-black border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                        showFieldMatrix
                          ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-slate-800 dark:border-slate-200 hover:bg-slate-700'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                      }`}
                      title={showFieldMatrix ? 'Collapse and hide the field matrix' : 'Unhide and customize individual database fields'}
                    >
                      {showFieldMatrix ? (
                        <>
                          <EyeOff size={12} />
                          <span>Hide Fields</span>
                          <ChevronUp size={13} />
                        </>
                      ) : (
                        <>
                          <Eye size={12} />
                          <span>Unhide Fields ({selectedCount})</span>
                          <ChevronDown size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Compact Summary Strip when Collapsed */}
                {!showFieldMatrix && (
                  <div 
                    onClick={() => setShowFieldMatrix(true)}
                    className="p-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] animate-fadeIn cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="font-black text-slate-500 uppercase text-[9.5px] shrink-0 flex items-center gap-1">
                        <CheckSquare size={11} className="text-emerald-600" />
                        <span>Selected Database Columns ({selectedCount}):</span>
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-xl">
                        {activeFieldLabels.join(', ') || 'None selected'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowFieldMatrix(true); }}
                      className="text-xs font-black text-indigo-600 group-hover:text-indigo-800 dark:text-indigo-400 shrink-0 cursor-pointer flex items-center gap-0.5"
                    >
                      <Sliders size={12} />
                      <span>Unhide & Edit Selection ▾</span>
                    </button>
                  </div>
                )}

                {/* Full Categorized Database Fields Matrix (When Unhidden/Expanded) */}
                {showFieldMatrix && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {dynamicDatabaseCategories.map(category => {
                        const CatIcon = category.icon;
                        return (
                          <div 
                            key={category.id} 
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shadow-2xs space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shadow-2xs">
                                  <CatIcon size={12} />
                                </div>
                                <span className="font-black text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                  {category.title}
                                </span>
                              </div>
                              <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-black border ${category.badgeClass}`}>
                                {category.badge}
                              </span>
                            </div>

                            {/* Field checkboxes */}
                            <div className="flex flex-wrap gap-1.5">
                              {category.fields.map(f => {
                                const isChecked = Boolean(selectedFields[f.key]);
                                return (
                                  <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => handleToggleField(f.key)}
                                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                      isChecked
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-xs'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                    }`}
                                  >
                                    {isChecked ? (
                                      <CheckSquare size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    ) : (
                                      <Square size={13} className="text-slate-400 shrink-0" />
                                    )}
                                    <span>{f.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Database Column Adder & Active Chips */}
                    <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <span className="text-[10.5px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                          <Plus size={12} className="text-indigo-600" />
                          <span>Custom Database Column:</span>
                        </span>
                        <div className="flex-1 w-full flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Type any column (e.g. migrationNo, scholarship, remarks, etc.)..."
                            value={customFieldInput}
                            onChange={(e) => setCustomFieldInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomField(); }}
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomField}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-xs cursor-pointer transition-colors"
                          >
                            Add Column
                          </button>
                        </div>
                      </div>

                      {customFields.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Active Custom Columns:</span>
                          {customFields.map(cf => (
                            <span 
                              key={cf.key} 
                              className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 text-[10.5px] font-bold flex items-center gap-1.5"
                            >
                              <span>{cf.label}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomField(cf.key)}
                                className="text-indigo-500 hover:text-rose-600 cursor-pointer"
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Hide Matrix Button for convenience */}
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => setShowFieldMatrix(false)}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors py-1 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <EyeOff size={12} />
                        <span>Hide Field Matrix</span>
                        <ChevronUp size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Ingestion: Excel Upload & Direct Paste Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                
                {/* Method A: Upload Excel File */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center space-y-2 hover:border-emerald-500/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Upload size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-slate-200">Upload Excel / CSV File</h4>
                    <p className="text-[10.5px] text-slate-400">Supports .xlsx, .xls, and .csv files from JKBOSE or school records</p>
                  </div>
                  <label className="mt-1 px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-black text-[11px] shadow-sm cursor-pointer transition-colors">
                    <span>Browse Spreadsheet</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Method B: Direct Paste from Excel */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Copy size={13} className="text-blue-600" />
                      <span>Or Paste Direct from Excel</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Ctrl+V from Excel</span>
                  </div>
                  <textarea
                    rows={3}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Copy tabular rows directly from Excel or gazette and paste here..."
                    className="w-full p-2 text-[10px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 resize-none focus:outline-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handlePasteProcess}
                    className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] shadow-sm cursor-pointer transition-colors"
                  >
                    Parse Pasted Rows
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ──────── STEP 2: PREVIEW & ULTRA-CLEAR OLD/NEW VISUAL DIFF ──────── */}
          {step === 'preview' && (
            <div className="space-y-3">
              
              {/* Summary Stats Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                    Source: <strong className="text-slate-900 dark:text-white font-black">{fileName}</strong>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-black">
                      Total: {stats.total}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black border border-emerald-300 dark:border-emerald-800">
                      With Updates: {stats.changed}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-black">
                      Identical: {stats.identical}
                    </span>
                    {stats.unmatched > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-black">
                        Unmatched: {stats.unmatched}
                      </span>
                    )}
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('changed')}
                    className={`px-2.5 py-1 rounded-lg font-black text-[10.5px] cursor-pointer transition-all ${
                      previewFilter === 'changed'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    Updates ({stats.changed})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-black text-[10.5px] cursor-pointer transition-all ${
                      previewFilter === 'all'
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('identical')}
                    className={`px-2.5 py-1 rounded-lg font-black text-[10.5px] cursor-pointer transition-all ${
                      previewFilter === 'identical'
                        ? 'bg-blue-700 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    Identical ({stats.identical})
                  </button>
                  {stats.unmatched > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('unmatched')}
                      className={`px-2.5 py-1 rounded-lg font-black text-[10.5px] cursor-pointer transition-all ${
                        previewFilter === 'unmatched'
                          ? 'bg-rose-700 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      Unmatched ({stats.unmatched})
                    </button>
                  )}
                </div>
              </div>

              {/* Table of Differences */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[52vh] overflow-y-auto custom-scrollbar shadow-xs">
                <table className="w-full text-left border-collapse text-[10.5px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 text-slate-700 dark:text-slate-300 font-black uppercase text-[9px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5 w-9 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          title={selectedRowIds.size === stats.changed ? 'Deselect all changed' : 'Select all changed'}
                          className="cursor-pointer"
                        >
                          {selectedRowIds.size === stats.changed && stats.changed > 0 ? (
                            <CheckSquare size={14} className="text-emerald-600" />
                          ) : (
                            <Square size={14} className="text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5 w-44">Match Identifier</th>
                      <th className="p-2.5 w-48">Student (Database)</th>
                      <th className="p-2.5">Field-by-Field Diff (Old ➔ New)</th>
                      <th className="p-2.5 text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-sans">
                    {filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                          No student records found matching this filter view.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map((row) => {
                        const isChecked = selectedRowIds.has(row.rowId);
                        const diffEntries = Object.entries(row.diffs);

                        return (
                          <tr
                            key={row.rowId}
                            className={`transition-colors ${
                              isChecked 
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20' 
                                : !row.isMatched 
                                  ? 'bg-rose-50/30 dark:bg-rose-950/20' 
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-2.5 text-center">
                              {row.isMatched && row.hasChanges && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRow(row.rowId)}
                                  className="cursor-pointer"
                                >
                                  {isChecked ? (
                                    <CheckSquare size={14} className="text-emerald-600" />
                                  ) : (
                                    <Square size={14} className="text-slate-400" />
                                  )}
                                </button>
                              )}
                            </td>

                            {/* Row Index */}
                            <td className="p-2.5 text-center text-slate-400 font-bold">
                              {row.rowIndex}
                            </td>

                            {/* Match Key */}
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                              <div className="font-mono text-xs text-indigo-700 dark:text-indigo-400 font-black">
                                {row.rawReg !== '—' ? row.rawReg : row.rawAdm}
                              </div>
                              {row.rawForm !== '—' && (
                                <div className="text-[9px] text-slate-400 font-mono">Form: {row.rawForm}</div>
                              )}
                            </td>

                            {/* Matched Database Student */}
                            <td className="p-2.5 text-slate-700 dark:text-slate-300">
                              {row.matchedStudent ? (
                                <div>
                                  <div className="font-black text-slate-900 dark:text-white text-xs">
                                    {row.matchedStudent.studentName || row.matchedStudent["Student's Name"]}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                                    F: {row.matchedStudent.fatherName || row.matchedStudent["Father's Name"]}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-mono">
                                    {row.matchedStudent.class || '11th/12th'} • {row.matchedStudent.stream || 'General'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-rose-500 dark:text-rose-400 font-bold italic text-[11px]">
                                  Not found in database
                                </span>
                              )}
                            </td>

                            {/* Field Diffs (Clear Old ➔ New Badges) */}
                            <td className="p-2.5">
                              {row.isMatched ? (
                                diffEntries.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {diffEntries.map(([fKey, d]) => (
                                      <div 
                                        key={fKey} 
                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-1.5 text-[10.5px]"
                                      >
                                        <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                                          {d.label || fKey}
                                        </span>
                                        
                                        {/* Old Database Value */}
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 line-through">
                                          {d.current}
                                        </span>

                                        <ArrowRight size={11} className="text-emerald-600 shrink-0" />

                                        {/* New Board Value */}
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                          {d.incoming}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500 font-semibold text-[10.5px]">
                                    <CheckCircle2 size={12} className="text-blue-500" />
                                    <span>All selected fields match current database values</span>
                                  </span>
                                )
                              ) : (
                                <div className="text-[10px] text-slate-500">
                                  Incoming board row: <strong className="text-slate-800 dark:text-slate-200">{row.incomingFields.studentName}</strong> (Father: {row.incomingFields.fatherName})
                                </div>
                              )}
                            </td>

                            {/* Status & Quick Inspect */}
                            <td className="p-2.5 text-center">
                              {row.isMatched ? (
                                row.hasChanges ? (
                                  <div className="space-y-1">
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                      {diffEntries.length} Update{diffEntries.length > 1 ? 's' : ''} Ready
                                    </span>
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => setInspectStudent(row)}
                                        className="text-[9.5px] font-black text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-0.5 mx-auto"
                                      >
                                        <Eye size={10} />
                                        <span>Full Diff</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Identical
                                  </span>
                                )
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  No DB Match
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ──────── STEP 3: EXECUTING ──────── */}
          {step === 'executing' && (
            <div className="py-12 px-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-spin">
                <RefreshCw size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Overwriting Database Fields...
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  {progressStage}
                </p>
              </div>
              <div className="w-full max-w-md mx-auto bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* ──────── STEP 4: COMPLETED ──────── */}
          {step === 'completed' && (
            <div className="py-10 px-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Board Data Synchronized Successfully!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                  Updated <strong className="text-emerald-600 dark:text-emerald-400">{executionStats?.updatedCount || 0} student records</strong> with verified board information.
                </p>
                <p className="text-[11px] text-slate-400">
                  A 30-day batch rollback snapshot was saved in CSV Batch Manager. You can undo this update anytime from Admin Tools.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="text-[11px] text-slate-500 font-bold">
            {step === 'upload' && (
              <span>Targeting <strong>{targetClass}</strong> • Session <strong>{targetSession}</strong></span>
            )}
            {step === 'preview' && (
              <span>Selected <strong>{selectedRowIds.size} of {stats.changed}</strong> changed student records</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step === 'preview' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Back to Settings
                </button>
                <button
                  type="button"
                  onClick={executeOverwrite}
                  disabled={selectedRowIds.size === 0}
                  className="px-5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-xs cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={14} />
                  <span>Execute Overwrite ({selectedRowIds.size})</span>
                </button>
              </>
            )}

            {step === 'completed' && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-xs cursor-pointer"
              >
                Close & Refresh Reports
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Full Student Profile Diff Inspect Modal */}
      {inspectStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Student Field Comparison (Old vs New)
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {inspectStudent.rawReg !== '—' ? inspectStudent.rawReg : inspectStudent.rawAdm} • {inspectStudent.matchedStudent?.studentName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-800">
                <div>Current Database Record</div>
                <div>Incoming Board Value</div>
              </div>

              {allFieldDefinitions.filter(f => selectedFields[f.key]).map(f => {
                const diff = inspectStudent.diffs[f.key];
                const incomingVal = inspectStudent.incomingFields[f.key];
                
                let currentVal = '';
                if (inspectStudent.matchedStudent) {
                  for (const k of f.dbKeys) {
                    if (inspectStudent.matchedStudent[k] !== undefined && String(inspectStudent.matchedStudent[k]).trim() !== '') {
                      currentVal = String(inspectStudent.matchedStudent[k]).trim();
                      break;
                    }
                  }
                }

                const hasDiff = Boolean(diff);

                return (
                  <div 
                    key={f.key}
                    className={`p-2.5 rounded-xl border grid grid-cols-2 gap-2 items-center text-xs ${
                      hasDiff 
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' 
                        : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-400 mb-0.5">{f.label}</div>
                      <div className={`font-bold ${hasDiff ? 'line-through text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {currentVal || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Incoming Board</div>
                      <div className={`font-bold ${hasDiff ? 'text-emerald-700 dark:text-emerald-300 font-black' : 'text-slate-500'}`}>
                        {incomingVal || '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setInspectStudent(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-black text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
