import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, AlertTriangle, CheckSquare, Square, FileSpreadsheet, 
  Upload, Copy, CheckCircle2, User, BookOpen, Award, Hash,
  ArrowRight, Sparkles, RefreshCw, Eye, EyeOff, Plus, Trash2,
  ChevronDown, ChevronUp, Database, Sliders, Download, Search,
  Phone, Landmark, Layers, Check, Terminal, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateCachedItem, getCachedCollectionSync } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { saveCsvImportBatch } from '../../services/csvBatchManager';
import { toTitleCase } from '../../utils/textFormatting';
import { cleanRawSubjectTokens, formatDobToDisplay } from './AdvancedReports';

import ExcelSpreadsheetGrid from './bulkOverwrite/ExcelSpreadsheetGrid';
import ExpressDirectIngestionTab from './bulkOverwrite/ExpressDirectIngestionTab';
import GazetteAndAdmitAiTab from './bulkOverwrite/GazetteAndAdmitAiTab';

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
  onComplete,
  onRecordAdded,
  onIngestSuccess,
  initialMode = 'overwrite', // 'overwrite' | 'express' | 'gazette_ai' | 'admit_ai'
  showToast: externalShowToast
}) {
  // Top-level modal mode tab
  const [modalMode, setModalMode] = useState(initialMode || 'overwrite');

  useEffect(() => {
    if (initialMode) {
      setModalMode(initialMode);
    }
  }, [initialMode, isOpen]);

  // Local toast fallback
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg, type = 'success') => {
    if (externalShowToast) externalShowToast(msg, type);
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─── Bulk Overwrite Sub-State ───
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'executing' | 'completed'
  const [targetClass, setTargetClass] = useState('All');
  const [targetSession, setTargetSession] = useState(currentSession || '2025-26');
  const [targetStream, setTargetStream] = useState('All');

  // Method under Overwrite tab: 'upload' (spreadsheet file) vs 'grid' (Excel tabular clipboard grid)
  const [ingestMethod, setIngestMethod] = useState('upload'); // 'upload' | 'grid'

  // Hide / Unhide field selection matrix
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

  // Raw file & parsed data
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

  // Active selected field objects and labels
  const activeFieldsList = useMemo(() => {
    return allFieldDefinitions.filter(f => selectedFields[f.key]);
  }, [allFieldDefinitions, selectedFields]);

  const activeFieldLabels = useMemo(() => {
    return activeFieldsList.map(f => f.label);
  }, [activeFieldsList]);

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

  // ─── DOWNLOAD EXCEL TEMPLATE WITH CURRENTLY SELECTED FIELDS ───
  // First column is strictly Board Registration Number, followed by selected active fields.
  // Pre-fills existing students from the selected cohort.
  const handleDownloadExcelTemplate = () => {
    const cohortStudents = (allStudents || []).filter(st => {
      const sCls = String(st.selectedClass || st.Class || st.class || '').toLowerCase();
      const sSess = String(st.selectedSession || st.Session || st.session || '').toLowerCase();
      const sStrm = String(st.selectedStream || st.Stream || st.stream || '').toLowerCase();
      
      const matchCls = targetClass === 'All' || sCls.includes(targetClass.toLowerCase());
      const matchSess = targetSession === 'All' || sSess.includes(targetSession.toLowerCase());
      const matchStrm = targetStream === 'All' || sStrm.includes(targetStream.toLowerCase());

      return matchCls && matchSess && matchStrm;
    });

    const headers = ['Board Registration Number', ...activeFieldLabels];
    let rowsData = [];

    if (cohortStudents.length > 0) {
      rowsData = cohortStudents.map(st => {
        const row = {
          'Board Registration Number': st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.'] || ''
        };
        activeFieldsList.forEach(f => {
          let val = '';
          for (const k of f.dbKeys) {
            if (st[k] !== undefined && String(st[k]).trim() !== '') {
              val = String(st[k]).trim();
              break;
            }
          }
          row[f.label] = val;
        });
        return row;
      });
    } else {
      // Provide sample row
      const sampleRow = {
        'Board Registration Number': '2161234-2024-0001'
      };
      activeFieldsList.forEach(f => {
        sampleRow[f.label] = f.key === 'studentName' ? 'SAMPLE STUDENT' : f.key === 'dob' ? '15/03/2007' : 'SAMPLE DATA';
      });
      rowsData = [sampleRow];
    }

    const ws = XLSX.utils.json_to_sheet(rowsData, { header: headers });
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Board_Overwrite_Template');
    const safeCls = targetClass.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSess = targetSession.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `HSS_Shangus_Sync_Template_${safeCls}_${safeSess}.xlsx`);

    showToast(`📥 Downloaded Excel template with ${rowsData.length} student record(s)!`, 'success');
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

  // ─── STRICT 3-POINT STUDENT MATCHING ENGINE ───
  // First column is strictly parsed as Registration Number.
  // Code strictly looks up exact student by regNo + session + class before generating preview.
  const processIncomingRows = (rows, sourceTitle = 'Spreadsheet') => {
    setRawParsedRows(rows);
    setErrorMsg(null);

    // Build database lookup maps from allStudents
    const studentBy3Point = new Map();
    const studentBySessReg = new Map();
    const studentByClsReg = new Map();
    const studentByReg = new Map();
    const studentByAdm = new Map();
    const studentByForm = new Map();

    allStudents.forEach(st => {
      const reg = cleanKey(st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.']);
      const adm = cleanKey(st.admNo || st['Admission No.'] || st['Adm. No.']);
      const form = cleanKey(st.formNo || st['Form Number'] || st['Form No.'] || st.id);
      const sess = cleanKey(st.selectedSession || st.Session || st.session || st['Academic Session']);
      const cls = cleanKey(st.selectedClass || st.Class || st.class || st['Admission sought for class']);

      if (reg && reg.length > 5 && !reg.endsWith('00000000')) {
        studentBy3Point.set(`${reg}|${sess}|${cls}`, st);
        studentBySessReg.set(`${reg}|${sess}`, st);
        studentByClsReg.set(`${reg}|${cls}`, st);
        studentByReg.set(reg, st);
      }
      if (adm && adm !== '—') studentByAdm.set(adm, st);
      if (form && form !== '—') studentByForm.set(form, st);
    });

    const targetSessClean = cleanKey(targetSession);
    const targetClsClean = cleanKey(targetClass);

    const correlated = [];
    const initialSelectedIds = new Set();

    rows.forEach((row, idx) => {
      // Normalize row keys
      const normalizedRow = {};
      Object.entries(row).forEach(([k, v]) => {
        normalizedRow[cleanKey(k)] = typeof v === 'string' ? v.trim() : String(v || '');
      });

      // Find first column / Registration No
      const rawReg = row['Board Registration Number'] || row['Registration No.'] || row['Registration No'] || 
                     normalizedRow['boardregistrationnumber'] || normalizedRow['registrationno'] || 
                     normalizedRow['regno'] || normalizedRow['boardregno'] || normalizedRow['registrationnumber'] || '';
      const rawAdm = normalizedRow['admissionno'] || normalizedRow['admno'] || normalizedRow['admissionnumber'] || '';
      const rawForm = normalizedRow['formno'] || normalizedRow['formnumber'] || normalizedRow['fno'] || '';

      const cleanReg = cleanKey(rawReg);
      const cleanAdm = cleanKey(rawAdm);
      const cleanForm = cleanKey(rawForm);

      let matchedStudent = null;

      // 3-Point Strict Matching: regNo + session + class
      if (cleanReg) {
        if (targetClass !== 'All' && targetSession !== 'All') {
          matchedStudent = studentBy3Point.get(`${cleanReg}|${targetSessClean}|${targetClsClean}`);
          if (!matchedStudent) matchedStudent = studentBySessReg.get(`${cleanReg}|${targetSessClean}`);
        } else if (targetSession !== 'All') {
          matchedStudent = studentBySessReg.get(`${cleanReg}|${targetSessClean}`);
        } else if (targetClass !== 'All') {
          matchedStudent = studentByClsReg.get(`${cleanReg}|${targetClsClean}`);
        }
        if (!matchedStudent) {
          matchedStudent = studentByReg.get(cleanReg);
        }
      }

      // Secondary fallback
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
          if (!selectedFields[f.key]) return;
          const incVal = incomingFields[f.key];
          if (!incVal) return;

          let currVal = '';
          for (const k of f.dbKeys) {
            if (matchedStudent[k] !== undefined && String(matchedStudent[k]).trim() !== '') {
              currVal = String(matchedStudent[k]).trim();
              break;
            }
          }

          if (cleanKey(currVal) !== cleanKey(incVal)) {
            diffs[f.key] = {
              fieldLabel: f.label,
              currentValue: currVal || '—',
              incomingValue: incVal
            };
            hasChanges = true;
          }
        });
      }

      const rowId = `row_${idx}_${cleanReg || cleanAdm || cleanForm || idx}`;
      if (hasChanges) {
        initialSelectedIds.add(rowId);
      }

      correlated.push({
        id: rowId,
        rowIndex: idx + 1,
        matchedStudent,
        rawReg: rawReg || '—',
        rawAdm: rawAdm || '—',
        rawForm: rawForm || '—',
        incomingFields,
        diffs,
        hasChanges,
        isUnmatched: !matchedStudent
      });
    });

    setPreviewData(correlated);
    setSelectedRowIds(initialSelectedIds);
    setFileName(sourceTitle);
    setStep('preview');
  };

  // Preview stats
  const stats = useMemo(() => {
    let changed = 0;
    let unmatched = 0;
    let identical = 0;

    previewData.forEach(r => {
      if (r.isUnmatched) unmatched++;
      else if (r.hasChanges) changed++;
      else identical++;
    });

    return { total: previewData.length, changed, unmatched, identical };
  }, [previewData]);

  // Filtered preview data
  const filteredPreview = useMemo(() => {
    return previewData.filter(r => {
      if (previewFilter === 'changed') return r.hasChanges;
      if (previewFilter === 'unmatched') return r.isUnmatched;
      if (previewFilter === 'identical') return !r.hasChanges && !r.isUnmatched;
      return true;
    });
  }, [previewData, previewFilter]);

  // Selection handlers
  const handleToggleRow = (rowId) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const handleSelectAllFiltered = (selectAll) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      filteredPreview.forEach(r => {
        if (selectAll && (r.hasChanges || r.isUnmatched)) next.add(r.id);
        else next.delete(r.id);
      });
      return next;
    });
  };

  // Execute Overwrite into Firestore & dbCache
  const executeOverwrite = async () => {
    const rowsToExecute = previewData.filter(r => selectedRowIds.has(r.id) && r.matchedStudent);
    if (rowsToExecute.length === 0) {
      setErrorMsg('No matched student records are selected for overwrite.');
      return;
    }

    setStep('executing');
    setProgressPercent(10);
    setProgressStage('Initializing Board Database Transaction...');
    setErrorMsg(null);

    try {
      const updatedSnapshots = [];
      let updatedCount = 0;

      for (let i = 0; i < rowsToExecute.length; i++) {
        const item = rowsToExecute[i];
        const st = item.matchedStudent;
        const inc = item.incomingFields;

        const payload = {};
        allFieldDefinitions.forEach(f => {
          if (!selectedFields[f.key]) return;
          const incVal = inc[f.key];
          if (!incVal) return;

          f.dbKeys.forEach(k => {
            payload[k] = incVal;
          });
        });

        payload.updatedAt = serverTimestamp();
        payload.lastBoardSyncAt = serverTimestamp();
        payload.boardSyncSource = fileName || 'Bulk Overwrite';

        const isHistorical = Boolean(st.isHistoricalMasterRegister || st.sourceRegisterYear || st.sourceSheet);
        const docId = String(st.docId || st.id);

        if (!isHistorical) {
          const docRef = doc(db, 'admissions', docId);
          await setDoc(docRef, payload, { merge: true });
          updateCachedItem('admissions', docId, payload);
        } else {
          const parentDocId = st.parentDocId || st.docId;
          const arrayKey = st.arrayKey || 'students';
          if (parentDocId && arrayKey) {
            const parentRef = doc(db, 'masterRegisters', String(parentDocId));
            const pSnap = await getDoc(parentRef);
            if (pSnap.exists()) {
              const currentArray = pSnap.data()[arrayKey] || [];
              const normalized = (val) => String(val || '').toLowerCase().trim();
              const updatedArray = currentArray.map(r => {
                const rForm = normalized(r.formNo || r['Form Number']);
                const rReg = normalized(r.regNo || r['Board Registration Number']);
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
        }).catch(e => console.warn('Rollback note:', e));
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
        
        {/* Master Modal Header */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-white to-blue-50/70 dark:from-emerald-950/20 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <Database size={17} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>⚡ Master Student Data & Board Ingestion Hub</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Unified Central Hub
                </span>
              </h2>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Single unified terminal for Board Overwrites, Express Direct Entry, and Multimodal Gazette/Admit Card AI OCR
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

        {/* Master Mode Tabs Bar */}
        <div className="px-5 py-2 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setModalMode('overwrite')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                modalMode === 'overwrite'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>📊 Bulk Overwrite & Board Sync</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('express')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                modalMode === 'express'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus size={13} />
              <span>➕ Express Direct Entry</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('gazette_ai')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                modalMode === 'gazette_ai'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles size={13} />
              <span>📰 Gazette AI Vision OCR</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('admit_ai')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                modalMode === 'admit_ai'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={13} />
              <span>🪪 Admit Card AI Extractor</span>
            </button>
          </div>

          {toastMessage && (
            <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 animate-fadeIn">
              {toastMessage.msg}
            </div>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4 text-xs">
          
          {/* ═════════ TAB 2: EXPRESS DIRECT INGESTION (SINGLE RECORD) ═════════ */}
          {modalMode === 'express' && (
            <ExpressDirectIngestionTab
              onRecordAdded={(record) => {
                if (onRecordAdded) onRecordAdded(record);
                if (onComplete) onComplete(record);
              }}
              onClose={onClose}
              allStudents={allStudents}
              currentSession={currentSession}
              showToast={showToast}
            />
          )}

          {/* ═════════ TAB 3 & 4: GAZETTE AI OCR & ADMIT CARD AI ═════════ */}
          {(modalMode === 'gazette_ai' || modalMode === 'admit_ai') && (
            <GazetteAndAdmitAiTab
              mode={modalMode}
              allStudents={allStudents}
              targetClass={targetClass !== 'All' ? targetClass : '12th'}
              targetSession={targetSession}
              onIngestSuccess={(res) => {
                if (onIngestSuccess) onIngestSuccess(res);
                if (onComplete) onComplete(res);
              }}
              showToast={showToast}
            />
          )}

          {/* ═════════ TAB 1: BULK OVERWRITE & BOARD SYNC ═════════ */}
          {modalMode === 'overwrite' && (
            <>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* STEP 1: UPLOAD & FIELD SELECTION */}
              {step === 'upload' && (
                <div className="space-y-4">
                  {/* Cohort Filters Bar */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Target Class Scope
                        </label>
                        <select
                          value={targetClass}
                          onChange={(e) => setTargetClass(e.target.value)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                          <option value="All">All Classes (Institution-wide)</option>
                          <option value="12th">Class 12th Only</option>
                          <option value="11th">Class 11th Only</option>
                          <option value="10th">Class 10th Only</option>
                          <option value="9th">Class 9th Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Target Session
                        </label>
                        <select
                          value={targetSession}
                          onChange={(e) => setTargetSession(e.target.value)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                          <option value="2026 APR/BIAN">2026 APR/BIAN</option>
                          <option value="2025-26">2025-26</option>
                          <option value="2025 APR/BIAN">2025 APR/BIAN</option>
                          <option value="2024-25">2024-25</option>
                          <option value="2023-24">2023-24</option>
                          <option value="All">All Sessions</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Stream Filter
                        </label>
                        <select
                          value={targetStream}
                          onChange={(e) => setTargetStream(e.target.value)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                        >
                          <option value="All">All Streams</option>
                          <option value="Science">Science</option>
                          <option value="Arts">Arts</option>
                          <option value="Commerce">Commerce</option>
                          <option value="Medical">Medical</option>
                          <option value="Non-Medical">Non-Medical</option>
                        </select>
                      </div>
                    </div>

                    {/* Download Excel Template Button */}
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-800 to-teal-800 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                      title="Download Excel spreadsheet pre-filled with currently selected fields and cohort student records"
                    >
                      <Download size={14} />
                      <span>Download Excel Template with Current Fields</span>
                    </button>
                  </div>

                  {/* Field Selection Matrix Header & Hide/Unhide Toggle */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-emerald-600" />
                        <span className="font-black text-xs text-slate-900 dark:text-white">
                          Select Fields to Overwrite From Spreadsheet
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {activeFieldsList.length} Active
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('board_bio')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            Board Bio
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('exam_results')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            Exam Results
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('bio_and_ids')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            Bio & IDs
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('all')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 cursor-pointer font-black"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('none')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 cursor-pointer"
                          >
                            None
                          </button>
                        </div>

                        {/* Hide / Unhide Toggle */}
                        <button
                          type="button"
                          onClick={() => setShowFieldMatrix(!showFieldMatrix)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          {showFieldMatrix ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span>{showFieldMatrix ? 'Hide Fields' : 'Unhide Fields'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Compact Selected Summary Strip */}
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="font-black text-slate-500 uppercase tracking-wider shrink-0">
                        Mapped Overwrites ({activeFieldsList.length}):
                      </span>
                      {activeFieldsList.length > 0 ? (
                        activeFieldsList.map(f => (
                          <span 
                            key={f.key} 
                            className="px-2 py-0.5 rounded-md font-bold bg-emerald-100/70 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800"
                          >
                            {f.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          ⚠️ No fields selected. Check at least one field below.
                        </span>
                      )}
                    </div>

                    {/* Expandable Field Matrix */}
                    {showFieldMatrix && (
                      <div className="space-y-3 pt-1 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          {dynamicDatabaseCategories.map(cat => (
                            <div 
                              key={cat.id} 
                              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2 flex flex-col"
                            >
                              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                                <span className="font-black text-[11px] text-slate-800 dark:text-slate-200">
                                  {cat.title}
                                </span>
                                <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full border ${cat.badgeClass}`}>
                                  {cat.badge}
                                </span>
                              </div>

                              <div className="space-y-1 overflow-y-auto max-h-48 custom-scrollbar">
                                {cat.fields.map(field => {
                                  const isChecked = Boolean(selectedFields[field.key]);
                                  return (
                                    <label
                                      key={field.key}
                                      className="flex items-center gap-2 p-1 rounded hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleField(field.key)}
                                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <span className={isChecked ? 'font-bold text-slate-900 dark:text-white' : 'font-medium'}>
                                        {field.label}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add Custom Field Tool */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            value={customFieldInput}
                            onChange={(e) => setCustomFieldInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomField(); }}
                            placeholder="Add custom database schema field name..."
                            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none flex-1 max-w-sm"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomField}
                            className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>Add Field</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* INGESTION METHOD SELECTOR */}
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setIngestMethod('upload')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                        ingestMethod === 'upload'
                          ? 'bg-emerald-700 text-white font-black shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <Upload size={14} />
                      <span>📂 Upload Spreadsheet (.xlsx / .csv)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIngestMethod('grid')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                        ingestMethod === 'grid'
                          ? 'bg-emerald-700 text-white font-black shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <Copy size={14} />
                      <span>📋 Direct Copy-Paste (Excel Tabular Grid)</span>
                    </button>
                  </div>

                  {/* METHOD A: SPREADSHEET FILE UPLOAD */}
                  {ingestMethod === 'upload' && (
                    <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-center space-y-3 animate-fadeIn">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-xs">
                        <Upload size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-xs text-slate-900 dark:text-white">
                          Select or Drop Official Board Excel Spreadsheet
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Column 1 must be <strong>Board Registration Number</strong>. Our 3-point matching engine correlates each student with their exact cohort.
                        </p>
                      </div>
                      <label className="inline-block px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-md cursor-pointer transition-all active:scale-98">
                        <span>Browse Excel / CSV File</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {/* METHOD B: EXCEL TABULAR SPREADSHEET GRID */}
                  {ingestMethod === 'grid' && (
                    <div className="animate-fadeIn">
                      <ExcelSpreadsheetGrid
                        activeFields={activeFieldsList}
                        onParseData={processIncomingRows}
                        allStudents={allStudents}
                        targetClass={targetClass}
                        targetSession={targetSession}
                        showToast={showToast}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: SIDE-BY-SIDE PREVIEW & FIELD DIFF TABLE */}
              {step === 'preview' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Stats Toolbar */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900 dark:text-white">
                        Correlated Preview:
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                        {stats.total} Total Records
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {stats.changed} Ready for Overwrite
                      </span>
                      {stats.unmatched > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                          {stats.unmatched} Unmatched
                        </span>
                      )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('changed')}
                        className={`px-2 py-0.5 rounded cursor-pointer ${previewFilter === 'changed' ? 'bg-white dark:bg-slate-900 text-emerald-700 font-black' : 'text-slate-600'}`}
                      >
                        Changes Only ({stats.changed})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('all')}
                        className={`px-2 py-0.5 rounded cursor-pointer ${previewFilter === 'all' ? 'bg-white dark:bg-slate-900 text-blue-700 font-black' : 'text-slate-600'}`}
                      >
                        All ({stats.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('unmatched')}
                        className={`px-2 py-0.5 rounded cursor-pointer ${previewFilter === 'unmatched' ? 'bg-white dark:bg-slate-900 text-rose-700 font-black' : 'text-slate-600'}`}
                      >
                        Unmatched ({stats.unmatched})
                      </button>
                    </div>
                  </div>

                  {/* Diff Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-[420px] custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10">
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="p-2 text-center w-8">
                            <button
                              type="button"
                              onClick={() => handleSelectAllFiltered(selectedRowIds.size === 0)}
                              className="cursor-pointer text-slate-600"
                            >
                              {selectedRowIds.size > 0 ? <CheckSquare size={13} /> : <Square size={13} />}
                            </button>
                          </th>
                          <th className="p-2">Reg No (Col 1)</th>
                          <th className="p-2">Database Matched Student</th>
                          <th className="p-2">Field Modifications (Old ➔ New)</th>
                          <th className="p-2 text-center w-16">Inspect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredPreview.map(r => {
                          const isSelected = selectedRowIds.has(r.id);
                          const diffKeys = Object.keys(r.diffs);

                          return (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleRow(r.id)}
                                  disabled={r.isUnmatched}
                                  className="cursor-pointer text-emerald-600 disabled:opacity-30"
                                >
                                  {isSelected ? <CheckSquare size={13} /> : <Square size={13} className="text-slate-400" />}
                                </button>
                              </td>
                              <td className="p-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {r.rawReg}
                              </td>
                              <td className="p-2">
                                {r.matchedStudent ? (
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {r.matchedStudent.studentName || r.matchedStudent["Student's Name"]}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Class: {r.matchedStudent.selectedClass || r.matchedStudent.Class || '—'} • Form: {r.matchedStudent.formNo || '—'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-rose-500 font-bold text-[11px]">
                                    ⚠️ Not Found in Database
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                {diffKeys.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 max-w-lg">
                                    {diffKeys.map(k => {
                                      const d = r.diffs[k];
                                      return (
                                        <div key={k} className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] border border-slate-200 dark:border-slate-700">
                                          <span className="font-black text-slate-500 mr-1">{d.fieldLabel}:</span>
                                          <span className="line-through text-rose-500 mr-1">{d.currentValue}</span>
                                          <span className="text-slate-400 mr-1">➔</span>
                                          <span className="font-black text-emerald-600 dark:text-emerald-400">{d.incomingValue}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px] font-medium">
                                    Identical values (No changes needed)
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setInspectStudent(r)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 cursor-pointer"
                                  title="Inspect student diff"
                                >
                                  <Eye size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setStep('upload')}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100"
                    >
                      Back to Settings
                    </button>

                    <button
                      type="button"
                      onClick={executeOverwrite}
                      disabled={selectedRowIds.size === 0}
                      className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <CheckCircle2 size={14} />
                      <span>Execute Verified Overwrite ({selectedRowIds.size} Records)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: EXECUTING OVERWRITE */}
              {step === 'executing' && (
                <div className="p-10 text-center space-y-4 animate-fadeIn">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center mx-auto animate-spin">
                    <RefreshCw size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Synchronizing Verified Board Fields into Database
                    </h3>
                    <p className="text-xs text-slate-500">{progressStage}</p>
                  </div>
                  <div className="w-full max-w-md mx-auto bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: COMPLETED */}
              {step === 'completed' && (
                <div className="p-10 text-center space-y-4 animate-fadeIn">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg">
                    <Check size={26} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Synchronization Complete!
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Successfully updated {executionStats?.updatedCount || 0} student record(s) in Firebase Firestore and created a 30-day rollback point.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-md cursor-pointer"
                  >
                    Done & Close Hub
                  </button>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer for Overwrite Mode */}
        {modalMode === 'overwrite' && step === 'upload' && (
          <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
            <div className="text-[11px] text-slate-500 font-bold">
              Target: <strong>{targetClass}</strong> • Session <strong>{targetSession}</strong>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

      </div>

      {/* Inspect Student Profile Diff Modal */}
      {inspectStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white">
                  Student Field Diff (Old vs New)
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {inspectStudent.rawReg} • {inspectStudent.matchedStudent?.studentName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectStudent(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 text-xs">
              {allFieldDefinitions.filter(f => selectedFields[f.key]).map(f => {
                const diff = inspectStudent.diffs[f.key];
                const incVal = inspectStudent.incomingFields[f.key];
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
                  <div key={f.key} className={`p-2 rounded-xl border grid grid-cols-2 gap-2 ${hasDiff ? 'bg-emerald-50/40 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:border-slate-800'}`}>
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-400">{f.label} (Current)</div>
                      <div className={`font-bold ${hasDiff ? 'line-through text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>{currentVal || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-400">Incoming Board</div>
                      <div className={`font-bold ${hasDiff ? 'text-emerald-700 dark:text-emerald-400 font-black' : 'text-slate-500'}`}>{incVal || '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-2 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setInspectStudent(null)}
                className="px-4 py-1 rounded-xl bg-slate-800 text-white font-bold text-xs cursor-pointer"
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
