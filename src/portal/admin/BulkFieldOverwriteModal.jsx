import { uniqueStudentMatch, sameCohort } from '../../utils/recordIdentity';
import { beginMutationJob, applyRecordPatch, completeMutationJob } from '../../services/recordMutationService';
import { 
  resolveCertificateStream, 
  streamMatches, 
  normalizeStreamName, 
  normalizeRegistrationKey 
} from '../../utils/certificateStudentResolution';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  X, AlertTriangle, CheckSquare, Square, FileSpreadsheet, 
  Upload, Copy, CheckCircle2, User, BookOpen, Award, Hash,
  ArrowRight, Sparkles, RefreshCw, Eye, EyeOff, Plus, Trash2,
  ChevronDown, ChevronUp, Database, Sliders, Download, Search,
  Phone, Landmark, Layers, Check, Terminal, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
import { updateCachedItem, getCachedCollectionSync, getCachedCollection } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { saveCsvImportBatch } from '../../services/csvBatchManager';
import { toTitleCase } from '../../utils/textFormatting';
import { cleanRawSubjectTokens, formatDobToDisplay } from './AdvancedReports';

import ExcelSpreadsheetGrid from './bulkOverwrite/ExcelSpreadsheetGrid';
import ExpressDirectIngestionTab from './bulkOverwrite/ExpressDirectIngestionTab';
import GazetteAndAdmitAiTab from './bulkOverwrite/GazetteAndAdmitAiTab';

// Helper to unpack chunked or flat masterRegisters documents into standard candidate records
export function flattenMasterRegisters(rawList = []) {
  if (!Array.isArray(rawList)) return [];
  const flat = [];
  rawList.forEach((docItem, docIdx) => {
    if (!docItem || typeof docItem !== 'object') return;
    const chunk = docItem.items || docItem.students || docItem.records || docItem.data;
    const parentSession = docItem.Session || docItem.session || docItem['Academic Session'] || docItem.groupKey?.split('_')[0] || docItem.id?.split('_')[0] || '';
    const parentClass = docItem.class || docItem.Class || docItem.className || docItem['Class'] || docItem.groupKey?.split('_')[1] || '';
    const parentStream = docItem.stream || docItem.Stream || docItem['Stream'] || docItem.groupKey?.split('_')[2] || '';

    if (Array.isArray(chunk) && chunk.length > 0) {
      chunk.forEach((item, itemIdx) => {
        if (item && typeof item === 'object') {
          if (item.Status === 'Deleted' || item.status === 'Deleted' || item._deleted === true) return;
          const iSess = item.Session || item.session || item['Academic Session'] || parentSession;
          const iCls = item.Class || item.class || item['Class'] || parentClass;
          const defaultStream = (String(iCls).includes('9') || String(iCls).includes('10')) ? 'General' : '';
          flat.push({
            ...item,
            id: item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'] || `${docItem.id}_${itemIdx}`,
            Session: iSess,
            session: iSess,
            Class: iCls,
            class: iCls,
            Stream: item.Stream || item.stream || item['Stream'] || parentStream || item.faculty || defaultStream,
            stream: item.stream || item.Stream || item['Stream'] || parentStream || item.faculty || defaultStream,
            status: item.status || item.Status || item.admissionStatus || 'Approved',
            Status: item.Status || item.status || item.admissionStatus || 'Approved',
            _source: 'masterRegisters',
            _srcCollection: 'masterRegisters',
            _parentDocId: docItem._docId || docItem.id,
            _arrayKey: ['items', 'students', 'records', 'data'].find(key => Array.isArray(docItem[key])) || 'items',
            _arrayIndex: itemIdx,
            _isHistorical: true
          });
        }
      });
    } else {
      if (docItem.Status === 'Deleted' || docItem.status === 'Deleted' || docItem._deleted === true) return;
      const docSess = docItem.Session || docItem.session || docItem['Academic Session'] || parentSession;
      const docCls = docItem.Class || docItem.class || docItem['Class'] || parentClass;
      const defaultDocStream = (String(docCls).includes('9') || String(docCls).includes('10')) ? 'General' : '';
      flat.push({
        ...docItem,
        id: docItem.id || docItem['Form Number'] || `${docItem.id || 'doc'}_${docIdx}`,
        Session: docSess,
        session: docSess,
        Class: docCls,
        class: docCls,
        Stream: docItem.Stream || docItem.stream || docItem['Stream'] || parentStream || docItem.faculty || defaultDocStream,
        stream: docItem.stream || docItem.Stream || docItem['Stream'] || parentStream || docItem.faculty || defaultDocStream,
        status: docItem.status || docItem.Status || docItem.admissionStatus || 'Approved',
        Status: docItem.Status || docItem.status || docItem.admissionStatus || 'Approved',
        _source: 'masterRegisters',
        _srcCollection: 'masterRegisters',
        _isHistorical: true
      });
    }
  });
  return flat;
}

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
      { key: 'boardRollNo', label: "Exam Roll No. (Board)", defaultChecked: false, dbKeys: ['Exam R.No. (Current)', 'Exam R. No. (Current)', 'boardRollNo', 'currExamRollNo', 'examRollNo', 'currExamRoll', 'Board Roll Number', 'Board Roll No.', 'Board Roll No', 'Exam R.No.', 'Exam R. No.'], excelKeys: ['boardrollno', 'examrollno', 'boardrollnumber', 'boardroll', 'examroll'] },
      { key: 'result', label: "Board Result Status", defaultChecked: false, dbKeys: ['Result (Current)', 'Board Result', 'Result', 'result', 'boardResult', 'currResult', 'statusResult'], excelKeys: ['boardresult', 'result', 'resultstatus', 'examresult', 'status'] },
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

  // Read recently viewed session & class from browser storage if available
  const [targetClass, setTargetClass] = useState(() => {
    try {
      const saved = sessionStorage.getItem('hss_last_selected_class');
      if (saved && saved !== 'ALL') return saved;
    } catch (_) {}
    return '11th';
  });

  const [targetSession, setTargetSession] = useState(() => {
    if (currentSession && currentSession !== '2025-26') return currentSession;
    try {
      const saved = sessionStorage.getItem('hss_last_selected_session');
      if (saved && saved !== 'ALL') return saved;
    } catch (_) {}
    return currentSession || '2026 APR/BIAN';
  });

  const [targetStream, setTargetStream] = useState('All');
  const [targetStatus, setTargetStatus] = useState('All');

  // Preview Diff Table Sorting State (Default: natural numeric Class Roll No)
  const [previewSortColumn, setPreviewSortColumn] = useState('rollNo'); // 'rollNo' | 'regNo' | 'name' | 'diffs'
  const [previewSortDirection, setPreviewSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Method under Overwrite tab: 'upload' (spreadsheet file) vs 'grid' (Excel tabular clipboard grid)
  const [ingestMethod, setIngestMethod] = useState('upload'); // 'upload' | 'grid'

  // Hide / Unhide field selection matrix (collapsed by default for clean minimal view)
  const [showFieldMatrix, setShowFieldMatrix] = useState(false);

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

  // ─── UNIVERSAL DATABASE POOL (ADMISSIONS + MASTER REGISTERS) ───
  // Unifies active admissions with full historical / masterRegisters so all 33 candidates for 2026 APR/BIAN are accessible
  const [universalStudents, setUniversalStudents] = useState(() => {
    const list = [];
    const seen = new Set();
    const add = (s) => {
      if (!s || typeof s !== 'object') return;
      const id = s.id || s.formNo || s['Form Number'] || s['Board Registration Number'];
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      list.push(s);
    };

    if (Array.isArray(allStudents)) allStudents.forEach(add);
    const cachedAdm = getCachedCollectionSync('admissions') || [];
    cachedAdm.forEach(add);
    const cachedMaster = getCachedCollectionSync('masterRegisters') || [];
    flattenMasterRegisters(cachedMaster).forEach(add);

    return list;
  });

  // Asynchronous background hydration of full database collections
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const hydrateUniversalPool = async () => {
      try {
        const [admissionsList, masterList] = await Promise.all([
          getCachedCollection('admissions').catch(() => []),
          getCachedCollection('masterRegisters').catch(() => [])
        ]);

        if (isCancelled) return;

        const flatMaster = flattenMasterRegisters(masterList || []);
        const validAdmissions = Array.isArray(admissionsList) ? admissionsList : [];

        // Direct Firestore fallback for masterRegisters if empty
        let directMaster = [];
        if (flatMaster.length === 0) {
          try {
            const masterSnap = await getDocs(collection(db, 'masterRegisters'));
            if (!masterSnap.empty) {
              const rawDocs = masterSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              directMaster = flattenMasterRegisters(rawDocs);
            }
          } catch (_) {}
        }

        // Direct Firestore fallback for admissions if empty
        let directAdmissions = [];
        if (validAdmissions.length === 0) {
          try {
            const admSnap = await getDocs(collection(db, 'admissions'));
            if (!admSnap.empty) {
              directAdmissions = admSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
          } catch (_) {}
        }

        const combined = [];
        const seen = new Set();
        const add = (s) => {
          if (!s || typeof s !== 'object') return;
          const id = s.id || s.formNo || s['Form Number'] || s['Board Registration Number'];
          if (id && seen.has(id)) return;
          if (id) seen.add(id);
          combined.push(s);
        };

        if (Array.isArray(allStudents)) allStudents.forEach(add);
        validAdmissions.forEach(add);
        directAdmissions.forEach(add);
        flatMaster.forEach(add);
        directMaster.forEach(add);

        if (!isCancelled && combined.length > 0) {
          setUniversalStudents(combined);
        }
      } catch (err) {
        console.warn('Error loading universal students in BulkFieldOverwriteModal:', err);
      }
    };

    hydrateUniversalPool();
    return () => { isCancelled = true; };
  }, [isOpen, allStudents]);

  // Dynamic discovery of sessions, classes, streams, and statuses from active database
  const availableClasses = useMemo(() => {
    const classSet = new Set(['12th', '11th', '10th', '9th']);
    (universalStudents || []).forEach(st => {
      const cls = String(st.selectedClass || st.className || st.Class || st.class || st['Admission sought for class'] || '').trim();
      if (cls && cls !== '—' && cls !== 'undefined' && cls !== 'null') {
        const normalized = cls.match(/\d+/)?.[0] ? `${cls.match(/\d+/)[0]}th` : cls;
        classSet.add(normalized);
      }
    });

    const classOrder = { '12th': 1, '11th': 2, '10th': 3, '9th': 4 };
    return Array.from(classSet).sort((a, b) => {
      const orderA = classOrder[a] || 99;
      const orderB = classOrder[b] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [universalStudents]);

  const availableSessions = useMemo(() => {
    const sessionSet = new Set(['2026 APR/BIAN', '2025-26', '2025 APR/BIAN', '2024-25', '2023-24']);
    (universalStudents || []).forEach(st => {
      const sess = String(st.selectedSession || st.Session || st.session || st.academicSession || '').trim();
      if (sess && sess !== '—' && sess !== 'undefined' && sess !== 'null') {
        sessionSet.add(sess);
      }
    });

    return Array.from(sessionSet).sort((a, b) => {
      const aIsBian = /bian|bi-annual|apr/i.test(a);
      const bIsBian = /bian|bi-annual|apr/i.test(b);
      if (aIsBian && !bIsBian) return -1;
      if (!aIsBian && bIsBian) return 1;
      return b.localeCompare(a, undefined, { numeric: true });
    });
  }, [universalStudents]);

  // Index universal student pool by normalized Board Registration Number for instant historical cross-referencing
  const studentsByRegMap = useMemo(() => {
    const map = new Map();
    (universalStudents || []).forEach(st => {
      const reg = normalizeRegistrationKey(
        st.boardRegNo || st.regNo || st.boardReg || st['Board Registration Number'] || st['Board Reg. No.'] || st['Registration No. (allotted by JKBOSE)']
      );
      if (reg) {
        if (!map.has(reg)) map.set(reg, []);
        map.get(reg).push(st);
      }
    });
    return map;
  }, [universalStudents]);

  // Robust stream resolver: checks current subjects, and if not sufficient, checks prior records for that reg no
  const getStudentProperStream = useCallback((st) => {
    if (!st) return '';
    const reg = normalizeRegistrationKey(
      st.boardRegNo || st.regNo || st.boardReg || st['Board Registration Number'] || st['Board Reg. No.'] || st['Registration No. (allotted by JKBOSE)']
    );
    const history = reg ? (studentsByRegMap.get(reg) || []) : [];
    const cls = st.selectedClass || st.className || st.Class || st.class || targetClass;
    return resolveCertificateStream(st, history, cls);
  }, [studentsByRegMap, targetClass]);

  const availableStreams = useMemo(() => {
    const isSeniorSec = /11|12/i.test(targetClass);
    const isSec = /9|10/i.test(targetClass);
    if (isSec) return ['General'];

    const streamSet = new Set();
    (universalStudents || []).forEach(st => {
      if (sameCohort(st, targetSession, targetClass)) {
        const properStrm = getStudentProperStream(st);
        if (properStrm && properStrm !== 'Unknown' && properStrm !== 'General') {
          streamSet.add(properStrm);
        }
      }
    });

    if (streamSet.size === 0) {
      return isSeniorSec ? ['Humanities', 'Science', 'Commerce'] : ['Science', 'Humanities', 'Commerce', 'General'];
    }

    const canonicalOrder = ['Humanities', 'Science', 'Commerce', 'Medical', 'Non-Medical'];
    return Array.from(streamSet).sort((a, b) => {
      const idxA = canonicalOrder.indexOf(a);
      const idxB = canonicalOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [universalStudents, targetSession, targetClass, getStudentProperStream]);

  const availableStatuses = useMemo(() => {
    const statusSet = new Set(['Approved', 'Confirmed', 'Draft', 'Submitted', 'Provisional']);
    (universalStudents || []).forEach(st => {
      const stat = String(st.status || st.Status || st.admissionStatus || '').trim();
      if (stat && stat !== '—' && stat !== 'undefined' && stat !== 'null') {
        statusSet.add(stat);
      }
    });

    return Array.from(statusSet).sort((a, b) => a.localeCompare(b));
  }, [universalStudents]);

  // Candidates currently matching the selected cohort scope
  const matchingCohortStudents = useMemo(() => {
    return (universalStudents || []).filter(st => {
      const matchCohort = sameCohort(st, targetSession, targetClass);
      if (!matchCohort) return false;

      const resolvedStrm = getStudentProperStream(st);
      const matchStrm = streamMatches(resolvedStrm, targetStream);
      const sStat = String(st.status || st.Status || st.admissionStatus || '').toLowerCase();
      const matchStat = targetStatus === 'All' || sStat === targetStatus.toLowerCase();

      return matchStrm && matchStat;
    });
  }, [universalStudents, targetSession, targetClass, targetStream, targetStatus, getStudentProperStream]);

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
    const sampleStudents = Array.isArray(universalStudents) ? universalStudents : [];
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
  }, [universalStudents]);

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
  // Pre-fills existing students from the selected cohort, sorted natural numeric by Class Roll No.
  const handleDownloadExcelTemplate = () => {
    const cohortStudents = [...matchingCohortStudents];

    // Default sort cohort students by Class Roll No in natural numeric ascending order
    cohortStudents.sort((a, b) => {
      const getRollNum = (st) => {
        const rollVal = String(
          st.classRollNo || 
          st['Class Roll No'] || 
          st['Class Roll No.'] || 
          st.rollNo || 
          st['RL. NO.'] || 
          st['Class R.No.'] || 
          ''
        ).trim();
        const match = rollVal.match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };

      const diff = getRollNum(a) - getRollNum(b);
      if (diff !== 0) return diff;
      const nameA = String(a.studentName || a["Student's Name"] || '');
      const nameB = String(b.studentName || b["Student's Name"] || '');
      return nameA.localeCompare(nameB);
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
          if (f.key === 'stream') {
            val = getStudentProperStream(st);
          } else if (f.key === 'subjects') {
            const currentSubs = st.subjects || st.subs || st.selectedSubjects || st['Subjects'] || '';
            if (currentSubs && currentSubs.trim() && currentSubs.trim().length > 5 && !/^(—|-|n\/?a)$/i.test(currentSubs.trim())) {
              val = currentSubs.trim();
            } else {
              const reg = normalizeRegistrationKey(st.boardRegNo || st.regNo || st['Board Registration Number'] || st['Board Reg. No.']);
              const history = reg ? (studentsByRegMap.get(reg) || []) : [];
              let historySubs = '';
              for (const h of history) {
                const hSubs = h.subjects || h.subs || h.selectedSubjects || h['Subjects to be taken in Class 11th'] || h['Subjects to be taken in Class 12th'] || h['Subjects Studied in Class 11th'] || h['Subjects Offered'] || h['Subjects'] || '';
                if (hSubs && String(hSubs).trim() && String(hSubs).trim().length > 5) {
                  historySubs = String(hSubs).trim();
                  break;
                }
              }
              val = historySubs || currentSubs || '';
            }
          } else {
            for (const k of f.dbKeys) {
              if (st[k] !== undefined && String(st[k]).trim() !== '') {
                val = String(st[k]).trim();
                break;
              }
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

    const correlated = [];
    const initialSelectedIds = new Set();

    rows.forEach((row, idx) => {
      // Normalize row keys
      const normalizedRow = {};
      Object.entries(row).forEach(([k, v]) => {
        normalizedRow[cleanKey(k)] = typeof v === 'string' ? v.trim() : String(v || '');
      });

      // Find first column / Registration No with complete alias coverage
      let rawReg = row['Board Registration Number'] || row['Registration No.'] || row['Registration No'] || 
                     row['Board Reg. No.'] || row['Board Reg No'] || row['Board Reg. No'] ||
                     row['Registration Number'] || row['Reg. No.'] || row['Reg No'] || row['REG. NO.'] ||
                     normalizedRow['boardregistrationnumber'] || normalizedRow['registrationno'] || 
                     normalizedRow['regno'] || normalizedRow['boardregno'] || normalizedRow['boardregistrationno'] || 
                     normalizedRow['registrationnumber'] || '';
      
      if (!rawReg) {
        const firstColVal = String(Object.values(row)[0] || '').trim();
        if (firstColVal && (firstColVal.length >= 10 || /^\d{16}$/i.test(firstColVal) || /\d{4,}/.test(firstColVal))) {
          rawReg = firstColVal;
        }
      }

      const rawAdm = normalizedRow['admissionno'] || normalizedRow['admno'] || normalizedRow['admissionnumber'] || '';
      const rawForm = normalizedRow['formno'] || normalizedRow['formnumber'] || normalizedRow['fno'] || '';
      const rawRoll = row['Class Roll No.'] || row['Class Roll No'] || row['Roll No.'] || row['Roll No'] ||
                      normalizedRow['classrollno'] || normalizedRow['classroll'] || normalizedRow['rollno'] || normalizedRow['rollnumber'] || '';

      const cleanReg = cleanKey(rawReg);
      const cleanAdm = cleanKey(rawAdm);
      const cleanForm = cleanKey(rawForm);
      const cleanRoll = cleanKey(rawRoll);

      const matchedStudent = uniqueStudentMatch(universalStudents,
        { reg: rawReg, adm: rawAdm, form: rawForm, roll: rawRoll }, targetSession, targetClass);

      // Extract all incoming fields dynamically
      const incomingFields = {};
      allFieldDefinitions.forEach(f => {
        let extracted = '';
        for (const ek of [...new Set([cleanKey(f.label), cleanKey(f.key), ...f.excelKeys])]) {
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
        } else if (f.key === 'boardRollNo' && extracted) {
          extracted = String(extracted).replace(/\.0+$/, '').trim();
        } else if (f.key === 'marks' && extracted) {
          extracted = String(extracted).replace(/\.0+$/, '').trim();
        } else if (f.key === 'result' && extracted) {
          const resUpper = String(extracted).trim().toUpperCase();
          if (resUpper === 'PASS' || resUpper === 'PASSED' || resUpper === 'QUAL' || resUpper === 'QUALIFIED') {
            extracted = 'Qualified';
          } else if (resUpper === 'REAP' || resUpper === 'RE-APPEAR' || resUpper === 'REAPPEAR') {
            extracted = 'Reappear';
          }
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

  // Sort toggle handler for Preview Diff Table
  const handleTogglePreviewSort = (colKey) => {
    if (previewSortColumn === colKey) {
      setPreviewSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPreviewSortColumn(colKey);
      setPreviewSortDirection('asc');
    }
  };

  // Filtered and Sorted preview data (Default: natural numeric Class Roll No ascending)
  const filteredPreview = useMemo(() => {
    const list = previewData.filter(r => {
      if (previewFilter === 'changed') return r.hasChanges;
      if (previewFilter === 'unmatched') return r.isUnmatched;
      if (previewFilter === 'identical') return !r.hasChanges && !r.isUnmatched;
      return true;
    });

    list.sort((a, b) => {
      if (previewSortColumn === 'rollNo') {
        const getRollNum = (item) => {
          if (!item.matchedStudent) return 999999;
          const st = item.matchedStudent;
          const rollVal = String(
            st.classRollNo || 
            st['Class Roll No'] || 
            st['Class Roll No.'] || 
            st.rollNo || 
            st['RL. NO.'] || 
            st['Class R.No.'] || 
            ''
          ).trim();
          const match = rollVal.match(/\d+/);
          return match ? parseInt(match[0], 10) : 999999;
        };
        const numA = getRollNum(a);
        const numB = getRollNum(b);
        if (numA !== numB) {
          return previewSortDirection === 'asc' ? numA - numB : numB - numA;
        }
        const nameA = String(a.matchedStudent?.studentName || a.matchedStudent?.["Student's Name"] || '');
        const nameB = String(b.matchedStudent?.studentName || b.matchedStudent?.["Student's Name"] || '');
        return nameA.localeCompare(nameB);
      }

      if (previewSortColumn === 'regNo') {
        const comp = String(a.rawReg || '').localeCompare(String(b.rawReg || ''), undefined, { numeric: true, sensitivity: 'base' });
        return previewSortDirection === 'asc' ? comp : -comp;
      }

      if (previewSortColumn === 'name') {
        const nameA = String(a.matchedStudent?.studentName || a.matchedStudent?.["Student's Name"] || '');
        const nameB = String(b.matchedStudent?.studentName || b.matchedStudent?.["Student's Name"] || '');
        const comp = nameA.localeCompare(nameB);
        return previewSortDirection === 'asc' ? comp : -comp;
      }

      if (previewSortColumn === 'diffs') {
        const diffA = Object.keys(a.diffs || {}).length;
        const diffB = Object.keys(b.diffs || {}).length;
        return previewSortDirection === 'asc' ? diffA - diffB : diffB - diffA;
      }

      return 0;
    });

    return list;
  }, [previewData, previewFilter, previewSortColumn, previewSortDirection]);

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
      const jobId = await beginMutationJob(`Board Data Overwrite: ${fileName || 'JKBOSE Sync'}`, rowsToExecute.length, 'Board Data Sync & Field Overwrite');
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

        // Auto-calculate Percentage if marks and maxMarks are available and percentage not supplied
        const finalMarks = payload['Marks Obtained'] || payload['marks'] || st.marks || st['Marks Obtained'];
        const finalMax = payload['Max Marks'] || payload['maxMarks'] || st.maxMarks || st['Max Marks'] || '500';
        if (finalMarks && !payload['Percentage'] && !isNaN(Number(finalMarks)) && !isNaN(Number(finalMax)) && Number(finalMax) > 0) {
          const calculatedPct = ((Number(finalMarks) / Number(finalMax)) * 100).toFixed(1) + '%';
          payload['Percentage'] = calculatedPct;
          payload['percentage'] = calculatedPct;
        }

        payload.updatedAt = new Date().toISOString();
        payload.lastBoardSyncAt = new Date().toISOString();
        payload.boardSyncSource = fileName || 'Bulk Overwrite';

        await applyRecordPatch(st, payload, { jobId, entryId: String(i) });

        updatedCount++;
        const pct = 10 + Math.round(((i + 1) / rowsToExecute.length) * 80);
        setProgressPercent(pct);
        setProgressStage(`Overwriting records (${i + 1}/${rowsToExecute.length})...`);
      }

      await completeMutationJob(jobId);

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
      window.dispatchEvent(new CustomEvent('hss-admissions-updated'));

      setProgressPercent(100);
      setProgressStage('All fields successfully overwritten and synchronized!');
      setExecutionStats({ updatedCount });
      setStep('completed');

      if (onComplete) onComplete({ updatedCount });
      if (onIngestSuccess) onIngestSuccess({ updatedCount });
    } catch (err) {
      console.error('Execution error during bulk field overwrite:', err);
      setErrorMsg('Failed during overwrite execution: ' + err.message);
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-1 sm:p-3 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[96vh] sm:h-auto max-h-[96vh] sm:max-h-[92vh]">
        
        {/* Master Modal Header - Minimal & Slim */}
        <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-700 text-white flex items-center justify-center shadow-2xs flex-shrink-0">
              <Database size={13} />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Student Data & Board Ingestion Hub</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  Master Hub
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Master Mode Tabs Bar - Sleek Compact Pills */}
        <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => setModalMode('overwrite')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all ${
                modalMode === 'overwrite'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet size={12} />
              <span>Bulk Overwrite</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('express')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all ${
                modalMode === 'express'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus size={12} />
              <span>Express Entry</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('gazette_ai')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all ${
                modalMode === 'gazette_ai'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles size={12} />
              <span>Gazette AI</span>
            </button>

            <button
              type="button"
              onClick={() => setModalMode('admit_ai')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all ${
                modalMode === 'admit_ai'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={12} />
              <span>Admit AI</span>
            </button>
          </div>

          {toastMessage && (
            <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 animate-fadeIn">
              {toastMessage.msg}
            </div>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="p-2 sm:p-4 overflow-y-auto flex-1 custom-scrollbar space-y-3 text-xs max-h-[calc(98vh-115px)] sm:max-h-[calc(94vh-130px)]">
          
          {/* ═════════ TAB 2: EXPRESS DIRECT INGESTION (SINGLE RECORD) ═════════ */}
          {modalMode === 'express' && (
            <ExpressDirectIngestionTab
              onRecordAdded={(record) => {
                if (onRecordAdded) onRecordAdded(record);
                if (onComplete) onComplete(record);
              }}
              onClose={onClose}
              allStudents={universalStudents}
              currentSession={currentSession}
              showToast={showToast}
            />
          )}

          {/* ═════════ TAB 3 & 4: GAZETTE AI OCR & ADMIT CARD AI ═════════ */}
          {(modalMode === 'gazette_ai' || modalMode === 'admit_ai') && (
            <GazetteAndAdmitAiTab
              mode={modalMode}
              allStudents={universalStudents}
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
                <div className="space-y-3">
                  {/* Compact Cohort Filters Toolbar */}
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-0.5">Cohort:</span>
                      <select
                        value={targetClass}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTargetClass(val);
                          try { sessionStorage.setItem('hss_last_selected_class', val); } catch (_) {}
                        }}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                      >
                        <option value="All">All Classes ({availableClasses.length})</option>
                        {availableClasses.map(cls => (
                          <option key={cls} value={cls}>Class {cls}</option>
                        ))}
                      </select>

                      <select
                        value={targetSession}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTargetSession(val);
                          try { sessionStorage.setItem('hss_last_selected_session', val); } catch (_) {}
                        }}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                      >
                        <option value="All">All Sessions ({availableSessions.length})</option>
                        {availableSessions.map(sess => (
                          <option key={sess} value={sess}>{sess}</option>
                        ))}
                      </select>

                      <select
                        value={targetStream}
                        onChange={(e) => setTargetStream(e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                      >
                        <option value="All">All Streams ({availableStreams.length})</option>
                        {availableStreams.map(strm => (
                          <option key={strm} value={strm}>{strm}</option>
                        ))}
                      </select>

                      <select
                        value={targetStatus}
                        onChange={(e) => setTargetStatus(e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                      >
                        <option value="All">All Statuses ({availableStatuses.length})</option>
                        {availableStatuses.map(stat => (
                          <option key={stat} value={stat}>{stat}</option>
                        ))}
                      </select>

                      {/* Live Cohort Candidates Counter Badge */}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {matchingCohortStudents.length} Students
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                      title="Download pre-filled Excel spreadsheet for this cohort"
                    >
                      <Download size={12} />
                      <span>Download Template ({matchingCohortStudents.length > 0 ? matchingCohortStudents.length : '.xlsx'})</span>
                    </button>
                  </div>

                  {/* Minimal Field Selection & Presets Bar */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <Sliders size={13} className="text-emerald-600" />
                        <span className="font-extrabold text-[11px] text-slate-900 dark:text-white">
                          Fields to Overwrite
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {activeFieldsList.length} active
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Quick Presets */}
                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('exam_results')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 cursor-pointer font-black"
                            title="Select Board Roll No, Result Status, Marks, and Division"
                          >
                            Exam Results
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('board_bio')}
                            className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            Board Bio
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
                            className="px-1.5 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 cursor-pointer font-bold"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('none')}
                            className="px-1.5 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>

                        {/* Toggle Detailed Matrix */}
                        <button
                          type="button"
                          onClick={() => setShowFieldMatrix(!showFieldMatrix)}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {showFieldMatrix ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>{showFieldMatrix ? 'Hide Checkboxes' : 'Customize Checkboxes'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Compact Selected Summary Tags */}
                    <div className="flex items-center gap-1 flex-wrap text-[10px]">
                      {activeFieldsList.length > 0 ? (
                        activeFieldsList.map(f => (
                          <span 
                            key={f.key} 
                            className="px-1.5 py-0.2 rounded font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[9.5px]"
                          >
                            {f.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                          ⚠️ No fields selected. Click a preset above (e.g. Exam Results).
                        </span>
                      )}
                    </div>

                    {/* Expandable Field Matrix (Compact) */}
                    {showFieldMatrix && (
                      <div className="space-y-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {dynamicDatabaseCategories.map(cat => (
                            <div 
                              key={cat.id} 
                              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col"
                            >
                              <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200 dark:border-slate-800">
                                <span className="font-bold text-[10px] text-slate-800 dark:text-slate-200 truncate">
                                  {cat.title}
                                </span>
                                <span className={`text-[7.5px] font-black px-1 py-0.2 rounded border ${cat.badgeClass}`}>
                                  {cat.badge}
                                </span>
                              </div>

                              <div className="space-y-0.5 overflow-y-auto max-h-32 custom-scrollbar">
                                {cat.fields.map(field => {
                                  const isChecked = Boolean(selectedFields[field.key]);
                                  return (
                                    <label
                                      key={field.key}
                                      className="flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-[10px] text-slate-700 dark:text-slate-300"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleField(field.key)}
                                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer scale-90"
                                      />
                                      <span className={isChecked ? 'font-bold text-slate-900 dark:text-white' : 'font-normal text-slate-600'}>
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
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={customFieldInput}
                            onChange={(e) => setCustomFieldInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomField(); }}
                            placeholder="Add custom database field name..."
                            className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-900 dark:text-white outline-none flex-1 max-w-xs"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomField}
                            className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={11} />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* INGESTION METHOD SELECTOR & DROPZONE */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIngestMethod('upload')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          ingestMethod === 'upload'
                            ? 'bg-emerald-700 text-white font-black shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <Upload size={12} />
                        <span>Upload Spreadsheet (.xlsx / .csv)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIngestMethod('grid')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          ingestMethod === 'grid'
                            ? 'bg-emerald-700 text-white font-black shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <Copy size={12} />
                        <span>Direct Copy-Paste Grid</span>
                      </button>
                    </div>

                    {/* METHOD A: SPREADSHEET FILE UPLOAD */}
                    {ingestMethod === 'upload' && (
                      <div className="p-4 rounded-xl border border-dashed border-emerald-400/80 dark:border-emerald-700/80 bg-emerald-50/40 dark:bg-emerald-950/20 text-center space-y-2 animate-fadeIn">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-2xs">
                          <Upload size={16} />
                        </div>
                        <div>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white">
                            Drop Updated Board Spreadsheet Here (.xlsx / .csv)
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Column 1 must be <strong>Board Registration Number</strong> for 100% authoritative matching.
                          </p>
                        </div>
                        <label className="inline-block px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-2xs cursor-pointer transition-all active:scale-98">
                          <span>Browse Spreadsheet File</span>
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
                          allStudents={universalStudents}
                          targetClass={targetClass}
                          targetSession={targetSession}
                          targetStream={targetStream}
                          targetStatus={targetStatus}
                          showToast={showToast}
                        />
                      </div>
                    )}
                  </div>
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
                          <th 
                            onClick={() => handleTogglePreviewSort('regNo')}
                            className="p-2 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Click to sort by Registration No"
                          >
                            <div className="flex items-center gap-1">
                              <span>Reg No (Col 1)</span>
                              {previewSortColumn === 'regNo' ? (
                                previewSortDirection === 'asc' ? <ChevronUp size={13} className="text-blue-600" /> : <ChevronDown size={13} className="text-blue-600" />
                              ) : (
                                <ChevronDown size={12} className="text-slate-400 opacity-40 hover:opacity-100" />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleTogglePreviewSort('rollNo')}
                            className="p-2 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Click to toggle sorting by Class Roll No / Student Name"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span>Database Matched Student</span>
                                {previewSortColumn === 'rollNo' ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                                    Roll No {previewSortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                ) : previewSortColumn === 'name' ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                                    Name {previewSortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-normal">
                                    (Sorted by Roll No)
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePreviewSort('name');
                                }}
                                className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${previewSortColumn === 'name' ? 'bg-blue-600 text-white font-bold' : 'text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                                title="Sort alphabetically by Student Name"
                              >
                                By Name
                              </button>
                            </div>
                          </th>
                          <th 
                            onClick={() => handleTogglePreviewSort('diffs')}
                            className="p-2 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Click to sort by number of modified fields"
                          >
                            <div className="flex items-center gap-1">
                              <span>Field Modifications (Old ➔ New)</span>
                              {previewSortColumn === 'diffs' ? (
                                previewSortDirection === 'asc' ? <ChevronUp size={13} className="text-blue-600" /> : <ChevronDown size={13} className="text-blue-600" />
                              ) : (
                                <ChevronDown size={12} className="text-slate-400 opacity-40 hover:opacity-100" />
                              )}
                            </div>
                          </th>
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

        {/* Modal Footer for Overwrite Mode - Slim & Minimal */}
        {modalMode === 'overwrite' && step === 'upload' && (
          <div className="px-3.5 py-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50 text-[11px] flex-shrink-0">
            <div className="text-slate-500 font-medium">
              Target: <strong className="text-slate-800 dark:text-slate-200">{targetClass}</strong> • Session <strong className="text-slate-800 dark:text-slate-200">{targetSession}</strong> • <strong className="text-emerald-600 dark:text-emerald-400">{matchingCohortStudents.length} candidate(s) loaded</strong>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-[11px] cursor-pointer transition-colors"
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
