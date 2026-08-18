import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, PlusCircle, CheckCircle2, ShieldCheck, User, BookOpen, Phone, Landmark, Image as ImageIcon, RefreshCw, Download, FileSpreadsheet, History, Info, Upload, Trash2, Edit3, Eye, RotateCcw, CheckSquare, Square, Camera, FolderUp, Layers, AlertTriangle, Sparkles, ListChecks, Bot, Wand2, FileText, UploadCloud, Copy, Check, Cpu } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, setDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { updateCachedItem, getCachedCollectionSync } from '../../services/dbCache';
import { compressImageFile } from '../../utils/imageCompressor';
import ConfirmDialogModal from '../components/ConfirmDialogModal';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { deleteStudentDocument } from './AdvancedReports';
import { saveCsvImportBatch, getCsvImportBatches, undoCsvImportBatch } from '../../services/csvBatchManager';
import { getNextAvailableFormNumber, consumeFormNumber } from '../../services/formNumberService';
import { fetchCloudGeminiKeys, getPreferredGeminiModel } from '../../services/geminiLetterService';

const JUNIOR_CLASS_SUBJECTS = [
  'English',
  'Mathematics',
  'Science',
  'Social Science',
  'Urdu',
  'Hindi',
  'Kashmiri',
  'IT & ITES',
  'Healthcare',
  'Physical Education',
  'Environmental Studies'
];

const SENIOR_CLASS_SUBJECTS = [
  'General English',
  'Physics',
  'Chemistry',
  'Biology',
  'Mathematics',
  'Environmental Science',
  'Information Practices',
  'Computer Science',
  'Physical Education',
  'Urdu',
  'Political Science',
  'Economics',
  'Education',
  'History',
  'Sociology',
  'Psychology',
  'Public Administration',
  'Healthcare',
  'IT and ITES',
  'Accountancy',
  'Business Studies'
];

/**
 * DirectIngestionModal — Express Admin Ingestion & CSV Workflow Component
 * Grants admins special privileges to insert new student records directly into the database
 * with ZERO mandatory field requirements, bulk CSV import, workflow preview modal, photo correlation, and CSV template download.
 */
export default function DirectIngestionModal({ isOpen, onClose, onRecordAdded }) {
  const [formData, setFormData] = useState({
    formNo: '',
    classRollNo: '',
    admNo: '',
    boardRegNo: '',
    studentName: '',
    fatherName: '',
    motherName: '',
    dob: '',
    gender: 'Male',
    category: 'General',
    religion: 'Islam',
    class: '11th',
    stream: 'Science',
    subs: 'English, Physics, Chemistry, Biology',
    session: '2025-26',
    mobile: '',
    village: '',
    residence: '',
    block: '',
    tehsil: '',
    district: 'Anantnag',
    pinCode: '',
    state: 'Jammu & Kashmir',
    aadhar: '',
    fatherAadhar: '',
    apaarId: '',
    penNo: '',
    bankAccount: '',
    bankName: '',
    ifsc: '',
    boardName: 'JKBOSE',
    prevSchool: '',
    remarks: 'Direct Ingestion (Admin Express)',
    status: 'Approved',
    photoUrl: ''
  });

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'academic' | 'contact' | 'bank' | 'other' | 'csv' | 'ai' | 'history'
  const [successToast, setSuccessToast] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);
  const [csvBatches, setCsvBatches] = useState([]);
  const [selectedBatchPreview, setSelectedBatchPreview] = useState(null);
  const [undoingBatchId, setUndoingBatchId] = useState(null);

  // Workflow State for Excel/CSV/AI & Photo Combined Ingestion
  const [csvFile, setCsvFile] = useState(null);
  const [bulkPhotoFiles, setBulkPhotoFiles] = useState([]);
  const [parsedWorkflowRows, setParsedWorkflowRows] = useState([]);
  const [showWorkflowPreviewModal, setShowWorkflowPreviewModal] = useState(false);
  const [ingestingWorkflow, setIngestingWorkflow] = useState(false);
  const [overwriteWarningNotice, setOverwriteWarningNotice] = useState(null);
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');
  const [sourceTypeLabel, setSourceTypeLabel] = useState('Spreadsheet File');

  // AI Extraction State
  const [aiInputMode, setAiInputMode] = useState('pdf'); // 'pdf' | 'text'
  const [aiDocFile, setAiDocFile] = useState(null);
  const [aiRawText, setAiRawText] = useState('');
  const [aiClass, setAiClass] = useState('11th');
  const [aiStream, setAiStream] = useState('Science');
  const [aiSession, setAiSession] = useState('2025-26');
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const aiAbortControllerRef = useRef(null);

  // State for Post-Import Bulk Photo Sync by Group / Batch
  const [selectedBatchForPhotos, setSelectedBatchForPhotos] = useState('');
  const [batchPhotoMatches, setBatchPhotoMatches] = useState([]);
  const [syncingBatchPhotos, setSyncingBatchPhotos] = useState(false);

  // Dynamic Database-Driven Filter Options (Classes, Streams, Sessions)
  const dynamicDatabaseOptions = useMemo(() => {
    const activeAdmissions = getCachedCollectionSync('admissions') || [];
    const masterList = getCachedCollectionSync('masterRegisters') || [];

    const classSet = new Set();
    const globalStreamSet = new Set();
    const sessionSet = new Set();
    const classToStreamsMap = {};

    // Standard institutional classes
    ['9th', '10th', '11th', '12th'].forEach(c => {
      classSet.add(c);
      classToStreamsMap[c] = new Set();
    });

    // Default institutional stream templates
    const seniorDefaultStreams = ['Science', 'Medical', 'Non-Medical', 'Arts', 'Commerce', 'Humanities'];
    ['11th', '12th'].forEach(c => {
      seniorDefaultStreams.forEach(s => classToStreamsMap[c].add(s));
    });
    ['9th', '10th'].forEach(c => {
      classToStreamsMap[c].add('General');
    });

    ['2025-26', '2024-25', '2023-24'].forEach(ses => sessionSet.add(ses));

    // Live extraction from database cache
    [...activeAdmissions, ...masterList].forEach(item => {
      const rec = item.items || item;
      const recs = Array.isArray(rec) ? rec : [rec];
      recs.forEach(r => {
        if (r && r.Status !== 'Deleted' && !r._deleted) {
          const rawCls = r.class || r['Class'] || r['Admission sought for class'] || r['className'];
          const rawStrm = r.stream || r['Stream'] || r['Stream for Class 11th'] || r['Stream opted in Class 11th'] || r['faculty'];
          const rawSes = r.session || r['Session'] || r['Academic Session'] || r['academicSession'];

          let canonicalCls = '';
          if (rawCls && typeof rawCls === 'string' && rawCls.trim() && !/^(—|N\/A|null|undefined)$/i.test(rawCls.trim())) {
            const clLower = rawCls.toLowerCase().trim();
            if (clLower.includes('12') || clLower.includes('xii')) canonicalCls = '12th';
            else if (clLower.includes('11') || clLower.includes('xi')) canonicalCls = '11th';
            else if (clLower.includes('10') || clLower.includes('x')) canonicalCls = '10th';
            else if (clLower.includes('9') || clLower.includes('ix')) canonicalCls = '9th';
            else canonicalCls = rawCls.trim();

            classSet.add(canonicalCls);
            if (!classToStreamsMap[canonicalCls]) {
              classToStreamsMap[canonicalCls] = new Set();
            }
          }

          if (rawStrm && typeof rawStrm === 'string' && rawStrm.trim() && !/^(—|N\/A|null|undefined)$/i.test(rawStrm.trim())) {
            const sVal = rawStrm.trim();
            globalStreamSet.add(sVal);
            if (canonicalCls && classToStreamsMap[canonicalCls]) {
              classToStreamsMap[canonicalCls].add(sVal);
            }
          }

          if (rawSes && typeof rawSes === 'string' && rawSes.trim() && !/^(—|N\/A|null|undefined)$/i.test(rawSes.trim())) {
            sessionSet.add(rawSes.trim());
          }
        }
      });
    });

    const classOrder = { '9th': 1, '10th': 2, '11th': 3, '12th': 4 };
    const sortedClasses = Array.from(classSet).sort((a, b) => {
      const ordA = classOrder[a.toLowerCase()] || 99;
      const ordB = classOrder[b.toLowerCase()] || 99;
      if (ordA !== ordB) return ordA - ordB;
      return a.localeCompare(b);
    });

    const sortedSessions = Array.from(sessionSet).sort((a, b) => b.localeCompare(a));

    const getStreamsForClass = (targetClass) => {
      const clsStr = String(targetClass || '').toLowerCase().trim();
      const isJunior = clsStr.includes('9') || clsStr.includes('10') || clsStr.includes('ninth') || clsStr.includes('tenth');
      
      const foundStreams = classToStreamsMap[targetClass] ? Array.from(classToStreamsMap[targetClass]) : [];
      if (isJunior) {
        // For Class 9th and 10th, secondary education in Kashmir / JKBOSE has General stream only
        const filtered = foundStreams.filter(s => s === 'General' || !seniorDefaultStreams.includes(s));
        return filtered.length > 0 ? filtered : ['General'];
      }
      // For Class 11th and 12th
      const seniorStreams = (foundStreams.length > 0 ? foundStreams : seniorDefaultStreams)
        .filter(s => s !== 'General')
        .sort((a, b) => a.localeCompare(b));
      return seniorStreams.length > 0 ? seniorStreams : ['Science', 'Humanities', 'Commerce'];
    };

    return {
      classes: sortedClasses,
      sessions: sortedSessions,
      getStreamsForClass
    };
  }, [isOpen]);

  // Dynamic Class-Specific Subject Pool Evaluation
  const isJuniorClass = useMemo(() => {
    const cls = String(formData.class || '').toLowerCase();
    return cls.includes('9') || cls.includes('10') || cls.includes('ninth') || cls.includes('tenth');
  }, [formData.class]);

  const activeSubjectPool = useMemo(() => {
    return isJuniorClass ? JUNIOR_CLASS_SUBJECTS : SENIOR_CLASS_SUBJECTS;
  }, [isJuniorClass]);

  // Subject Selection Calculation Helpers
  const selectedSubjectList = useMemo(() => {
    if (!formData.subs) return [];
    return formData.subs.split(',').map(s => s.trim()).filter(Boolean);
  }, [formData.subs]);

  const isSubjectSelected = (sub) => {
    return selectedSubjectList.some(s => s.toLowerCase() === sub.toLowerCase());
  };

  const toggleSubjectSelection = (sub) => {
    let current = [...selectedSubjectList];
    if (isSubjectSelected(sub)) {
      current = current.filter(s => s.toLowerCase() !== sub.toLowerCase());
    } else {
      current.push(sub);
    }
    setFormData(prev => ({ ...prev, subs: current.join(', ') }));
  };

  const applySubjectPreset = (presetList) => {
    setFormData(prev => ({ ...prev, subs: presetList.join(', ') }));
  };

  const fetchCsvBatches = async () => {
    try {
      const list = await getCsvImportBatches();
      setCsvBatches(list || []);
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchCsvBatches();
      // Auto-populate next sequential form number if not manually typed
      if (!formData.formNo) {
        getNextAvailableFormNumber().then(nextFNo => {
          if (nextFNo) {
            setFormData(prev => ({ ...prev, formNo: String(nextFNo) }));
          }
        }).catch(e => console.warn('Next form number auto-fetch note:', e));
      }
    }
  }, [isOpen]);

  const handleUndoBatch = async (batch) => {
    if (!batch || !batch.batchId) return;
    if (!window.confirm(`🔥 Are you sure you want to UNDO & PURGE all ${batch.totalCount} records imported from file "${batch.fileName}"?\n\nThis will permanently delete all ${batch.totalCount} student documents from database registers.`)) {
      return;
    }

    try {
      setUndoingBatchId(batch.batchId);
      await undoCsvImportBatch(batch.batchId);
      setSuccessToast(`🗑️ Undid CSV Import Batch "${batch.fileName}" (${batch.totalCount} Records Purged).`);
      setTimeout(() => setSuccessToast(null), 3500);
      await fetchCsvBatches();
    } catch (err) {
      console.error('Undo batch error:', err);
      alert(`Failed to undo batch: ${err.message}`);
    } finally {
      setUndoingBatchId(null);
    }
  };

  const [historyList, setHistoryList] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_admin_direct_ingestion_history_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmModalConfig({
      isOpen: true,
      type: 'info',
      title: 'Student Photo Import',
      message: `Upload and compress photo "${file.name}" for ${formData.studentName || 'Student'}?`,
      consequence: 'The image will be auto-compressed to < 20KB before attaching to the record.',
      confirmText: '📷 Confirm & Upload Photo',
      cancelText: 'Cancel',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        setConfirmModalConfig(null);
        try {
          const compressed = await compressImageFile(file, 250, 300, 0.7);
          setFormData(prev => ({ ...prev, photoUrl: compressed }));
          setPhotoPreview(compressed);

          await logAdminActivity({
            actionType: 'photo_upload',
            actionTitle: 'Uploaded Student Photo',
            details: `Uploaded and compressed photo for "${formData.studentName || 'Student'}"`,
            reasonCategory,
            customReason,
            metadata: { filename: file.name }
          });
        } catch (err) {
          console.warn('Photo compression fallback:', err);
          const reader = new FileReader();
          reader.onload = async (event) => {
            setFormData(prev => ({ ...prev, photoUrl: event.target.result }));
            setPhotoPreview(event.target.result);

            await logAdminActivity({
              actionType: 'photo_upload',
              actionTitle: 'Uploaded Student Photo',
              details: `Uploaded photo for "${formData.studentName || 'Student'}"`,
              reasonCategory,
              customReason,
              metadata: { filename: file.name }
            });
          };
          reader.readAsDataURL(file);
        }
      }
    });
  };

  const TEMPLATE_HEADERS = [
    'Form Number',
    'Class Roll No',
    'Adm. No.',
    'Board Registration Number',
    'Student Name',
    'Father Name',
    'Mother Name',
    'DoB (YYYY-MM-DD)',
    'Gender',
    'Class',
    'Stream',
    'Subjects',
    'Session',
    'Mobile No.',
    'Category',
    'Village',
    'District',
    'PIN Code',
    'Aadhaar No.',
    "Father's Aadhaar No.",
    'Bank Account No.',
    'Name of Bank',
    'IFSC Code',
    'Status'
  ];

  const SAMPLE_ROW_DATA = [
    '250571',
    '501',
    '5480',
    '23901002001',
    'Shahid Mushtaq Padder',
    'Mushtaq Ahmad Padder',
    'Raja Begum',
    '2007-04-12',
    'Male',
    '11th',
    'Medical',
    'English, Physics, Chemistry, Biology',
    '2025-26',
    '9876543210',
    'General',
    'Shangus',
    'Anantnag',
    '192201',
    '123456789012',
    '987654321098',
    '0123040100099',
    'J&K Bank',
    'JAKA0SHANGU',
    'Approved'
  ];

  const handleDownloadExcelTemplate = () => {
    try {
      const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, SAMPLE_ROW_DATA]);
      ws['!cols'] = TEMPLATE_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Student_Import');
      XLSX.writeFile(wb, 'HSS_Direct_Student_Import_Template.xlsx');
      setSuccessToast('📊 Downloaded Excel Template (.xlsx) successfully!');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (e) {
      console.error('Error generating Excel template:', e);
      handleDownloadCsvTemplate();
    }
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = [TEMPLATE_HEADERS.join(','), SAMPLE_ROW_DATA.map(val => `"${val}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'HSS_Direct_Student_Import_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
    setSuccessToast('📄 Downloaded CSV Template (.csv) successfully!');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  /**
   * Photo Correlator Engine
   * Matches an array of File objects against a list of student records/rows.
   * Priority:
   * 1. Sequential S.No: '1.jpg', '01.png', '1.jpeg' matches row S.No 1
   * 2. Form Number: '250571.jpg', 'FORM_250571.png' matches Form No '250571'
   * 3. Board Reg Number: '240100080009.jpg' matches boardRegNo '240100080009'
   * 4. Student Name: 'Aahil_Sheeraz_Shah.jpg' matches studentName
   */
  const correlatePhotos = async (rows, photoFiles) => {
    if (!photoFiles || photoFiles.length === 0) return rows;

    const updatedRows = [...rows];
    const fileMapByName = new Map();

    for (const f of photoFiles) {
      const rawName = f.name.toLowerCase();
      const nameWithoutExt = rawName.substring(0, rawName.lastIndexOf('.')) || rawName;
      const cleanKey = nameWithoutExt.replace(/[^a-z0-9]/g, '');
      fileMapByName.set(cleanKey, f);
      fileMapByName.set(rawName, f);
    }

    for (let i = 0; i < updatedRows.length; i++) {
      const r = updatedRows[i];
      const snoKey = String(r.sno || (i + 1));
      const snoKeyPadded = String(r.sno || (i + 1)).padStart(2, '0');
      const formNoKey = String(r.formNo || r['Form Number'] || r['Form No.'] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
      const regNoKey = String(r.boardRegNo || r['Board Registration Number'] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
      const nameKey = String(r.studentName || r["Student's Name (as per school records)"] || '').replace(/[^a-z0-9]/g, '').toLowerCase();

      let matchedFile = null;
      let matchType = '';

      if (fileMapByName.has(snoKey)) {
        matchedFile = fileMapByName.get(snoKey);
        matchType = `S.No #${snoKey} (${matchedFile.name})`;
      } else if (fileMapByName.has(snoKeyPadded)) {
        matchedFile = fileMapByName.get(snoKeyPadded);
        matchType = `S.No #${snoKeyPadded} (${matchedFile.name})`;
      } else if (formNoKey && fileMapByName.has(formNoKey)) {
        matchedFile = fileMapByName.get(formNoKey);
        matchType = `Form #${r.formNo} (${matchedFile.name})`;
      } else if (regNoKey && fileMapByName.has(regNoKey)) {
        matchedFile = fileMapByName.get(regNoKey);
        matchType = `Reg #${r.boardRegNo} (${matchedFile.name})`;
      } else if (nameKey && fileMapByName.has(nameKey)) {
        matchedFile = fileMapByName.get(nameKey);
        matchType = `Name (${matchedFile.name})`;
      }

      if (matchedFile) {
        try {
          const previewUrl = URL.createObjectURL(matchedFile);
          updatedRows[i] = {
            ...r,
            photoFile: matchedFile,
            photoPreviewUrl: previewUrl,
            photoMatchLabel: matchType
          };
        } catch (e) {
          updatedRows[i] = { ...r, photoFile: matchedFile, photoMatchLabel: matchType };
        }
      }
    }

    return updatedRows;
  };

  /**
   * Universal Spreadsheet Selection Handler (Excel .xlsx, .xls, and .csv)
   */
  const handleSelectSpreadsheetFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setSourceTypeLabel(`Spreadsheet: ${file.name}`);

    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      let rawRows = [];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      } else {
        const text = await file.text();
        const wb = XLSX.read(text, { type: 'string', raw: false });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      }

      if (!rawRows || rawRows.length === 0) {
        alert('Spreadsheet is empty or could not read data rows.');
        return;
      }

      await processRawStudentRowsIntoPreview(rawRows, `Spreadsheet (${file.name})`);
    } catch (err) {
      console.error('Error parsing spreadsheet:', err);
      alert(`Error reading spreadsheet: ${err.message}`);
    }
  };

  /**
   * Process raw extracted/parsed objects into workflow preview with tri-key duplicate checking
   */
  const processRawStudentRowsIntoPreview = async (rawRows, sourceDesc = '') => {
    const startFNo = Number(await getNextAvailableFormNumber()) || 250571;

    // Fetch all cached students across admissions & masterRegisters for duplicate resolution
    const activeAdmissions = getCachedCollectionSync('admissions') || [];
    const masterList = getCachedCollectionSync('masterRegisters') || [];
    const allExistingStudents = [];

    [...activeAdmissions, ...masterList].forEach(item => {
      const rec = item.items || item;
      const recs = Array.isArray(rec) ? rec : [rec];
      recs.forEach(r => {
        if (r && r.Status !== 'Deleted' && !r._deleted) {
          allExistingStudents.push(r);
        }
      });
    });

    const parsedRows = [];
    let formNoCounter = startFNo;

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      // Normalize object keys to lowercase alphanumeric
      const rowObj = {};
      Object.keys(raw).forEach(k => {
        const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
        rowObj[cleanK] = typeof raw[k] === 'string' ? raw[k].trim() : String(raw[k] || '');
      });

      const explicitFormNo = rowObj['formnumber'] || rowObj['formno'] || rowObj['formnumberoptional'] || rowObj['fno'];
      let formNo = explicitFormNo;
      if (!formNo) {
        formNo = String(formNoCounter);
        formNoCounter++;
      }

      const studentName = rowObj['studentname'] || rowObj['name'] || rowObj['candidatename'] || raw.studentName || raw.name || `Student ${i + 1}`;
      const boardRegNo = rowObj['boardregistrationnumber'] || rowObj['boardregno'] || rowObj['regno'] || rowObj['registrationnumber'] || raw.boardRegNo || raw.regNo || '';
      const rowClass = rowObj['class'] || raw.class || '11th';
      const rowSession = rowObj['session'] || raw.session || '2025-26';
      const fatherAadhar = rowObj['fatheraadharno'] || rowObj['fathersaadharno'] || rowObj['fatheraadhar'] || rowObj['fathersaadhar'] || rowObj['father_aadhar'] || '';

      // Tri-Key Duplicate Check: Registration Number (or Form Number) + Class + Session
      const cleanReg = String(boardRegNo).replace(/[^a-z0-9]/g, '').toLowerCase();
      const cleanFNo = String(formNo).trim().toLowerCase();
      const cleanCls = String(rowClass).trim().toLowerCase();
      const cleanSes = String(rowSession).trim().toLowerCase();

      let existingMatch = null;
      for (const ex of allExistingStudents) {
        const exReg = String(ex.boardRegNo || ex['Board Registration Number'] || ex['Board Reg. No.'] || ex['Board Reg No'] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
        const exFNo = String(ex.formNo || ex['Form Number'] || ex['Form No.'] || ex['Form No'] || '').trim().toLowerCase();
        const exCls = String(ex.class || ex['Class'] || ex['Admission sought for class'] || '').trim().toLowerCase();
        const exSes = String(ex.session || ex['Session'] || '').trim().toLowerCase();

        const isClassMatch = !cleanCls || !exCls || cleanCls === exCls;
        const isSessionMatch = !cleanSes || !exSes || cleanSes === exSes;

        if (cleanReg && exReg && cleanReg === exReg && isClassMatch && isSessionMatch) {
          existingMatch = ex;
          break;
        }
        if (!cleanReg && cleanFNo && exFNo && cleanFNo === exFNo && isClassMatch && isSessionMatch) {
          existingMatch = ex;
          break;
        }
      }

      const isDuplicate = Boolean(existingMatch);

      parsedRows.push({
        sno: i + 1,
        selected: !isDuplicate, // Unchecked by default if already in database
        isDuplicate: isDuplicate,
        matchedRecord: existingMatch,
        formNo: formNo,
        classRollNo: rowObj['classrollno'] || rowObj['rollno'] || raw.classRollNo || raw.rollNo || '',
        admNo: rowObj['admno'] || rowObj['admissionno'] || raw.admNo || '',
        boardRegNo: boardRegNo,
        studentName: studentName,
        fatherName: rowObj['fathername'] || raw.fatherName || '',
        motherName: rowObj['mothername'] || raw.motherName || '',
        dob: rowObj['dob'] || rowObj['dateofbirth'] || raw.dob || '',
        gender: rowObj['gender'] || raw.gender || 'Male',
        class: rowClass,
        stream: rowObj['stream'] || raw.stream || 'Science',
        subs: rowObj['subjects'] || rowObj['subs'] || raw.subs || 'English, Physics, Chemistry, Biology',
        session: rowSession,
        mobile: rowObj['mobileno'] || rowObj['mobile'] || raw.mobile || '',
        category: rowObj['category'] || raw.category || 'General',
        village: rowObj['village'] || raw.village || '',
        district: rowObj['district'] || raw.district || 'Anantnag',
        pinCode: rowObj['pincode'] || raw.pinCode || '',
        aadhar: rowObj['aadharno'] || rowObj['aadhar'] || raw.aadhar || '',
        fatherAadhar: fatherAadhar,
        bankAccount: rowObj['bankaccountno'] || rowObj['bankaccount'] || raw.bankAccount || '',
        bankName: rowObj['nameofbank'] || rowObj['bankname'] || raw.bankName || '',
        ifsc: rowObj['ifsccode'] || rowObj['ifsc'] || raw.ifsc || '',
        status: rowObj['status'] || raw.status || 'Approved',
        photoFile: null,
        photoPreviewUrl: null,
        photoMatchLabel: ''
      });
    }

    const correlated = await correlatePhotos(parsedRows, bulkPhotoFiles);
    setParsedWorkflowRows(correlated);
    setOverwriteWarningNotice(null);
    setShowWorkflowPreviewModal(true);
    if (sourceDesc) setSourceTypeLabel(sourceDesc);
  };

  /**
   * AI Smart Extractor (PDF Document or Raw Pasted Text) via Gemini Multimodal
   * Automatically uses Gemini API keys stored in Cloud Firestore / Official Documents Studio.
   * Supports immediate user abort / cancellation.
   */
  const handleStopAiExtraction = () => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setAiExtracting(false);
    setAiStatusMessage('AI extraction stopped by user.');
  };

  const handleRunAiExtraction = async () => {
    if (aiInputMode === 'pdf' && !aiDocFile) {
      alert('Please select a PDF document or scanned image first.');
      return;
    }
    if (aiInputMode === 'text' && !aiRawText.trim()) {
      alert('Please paste some text containing student information.');
      return;
    }

    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    setAiExtracting(true);
    setAiStatusMessage('Connecting to Google Gemini AI API...');

    try {
      const keys = await fetchCloudGeminiKeys();
      if (!keys || keys.length === 0) {
        throw new Error('No Gemini API key found. Please configure Gemini API Keys in Official Documents Studio or Cloud Firestore system settings.');
      }

      if (controller.signal.aborted) return;

      const preferredModel = getPreferredGeminiModel() || 'gemini-3.7-flash';
      setAiStatusMessage(`Extracting student records using ${preferredModel} (${keys.length} cloud key${keys.length > 1 ? 's' : ''} pooled)...`);

      const prompt = `You are a high-accuracy Institutional Student Data Extraction AI for Govt. Higher Secondary School Shangus.
Analyze the provided document (PDF/Image) or text and extract all student admission / registration / enrollment records into a structured JSON array.
Target Scope: Class ${aiClass || '11th'} | Session: ${aiSession || '2025-26'} | Default Stream: ${aiStream || 'Science'}.

Target Fields for each student object:
- "studentName": Full name of student
- "fatherName": Father's / Guardian's name
- "motherName": Mother's name (if found, else "")
- "dob": Date of birth in YYYY-MM-DD or DD-MM-YYYY format (if found, else "")
- "gender": "Male" or "Female" or "Other" (infer if obvious, default "Male")
- "category": "General", "RBA", "SC", "ST", "OBC", "EWS", etc. (default "General")
- "class": "${aiClass || '11th'}" (or detected class)
- "stream": "${aiStream || 'Science'}" (or detected stream)
- "subs": Combination of subjects separated by comma (e.g. "English, Physics, Chemistry, Biology")
- "session": "${aiSession || '2025-26'}"
- "mobile": 10-digit mobile number if found (else "")
- "village": Village / Town (e.g. "Shangus", "Nowgam", etc.)
- "district": "Anantnag"
- "pinCode": "192201"
- "aadhar": 12-digit student Aadhaar (else "")
- "fatherAadhar": 12-digit father's Aadhaar (else "")
- "classRollNo": Class roll number (else "")
- "admNo": Admission number / Folio number (else "")
- "boardRegNo": 12-16 digit JKBOSE / Board Registration number (e.g. "23901002001", "240100080009") (else "")
- "status": "Approved"

CRITICAL INSTRUCTIONS:
1. Extract EVERY student found without skipping or truncating any rows.
2. Return ONLY a valid raw JSON array of objects without markdown fences.`;

      const contentsParts = [{ text: prompt }];

      if (aiInputMode === 'pdf' && aiDocFile) {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(aiDocFile);
        });
        const base64Data = await base64Promise;
        if (controller.signal.aborted) return;
        const mime = aiDocFile.type || 'application/pdf';

        contentsParts.push({
          inline_data: {
            mime_type: mime,
            data: base64Data.split(',')[1] || base64Data
          }
        });
      }

      if (aiInputMode === 'text' && aiRawText.trim()) {
        contentsParts.push({
          text: `RAW INPUT TEXT TO PARSE:\n${aiRawText.trim()}`
        });
      }

      let lastError = null;
      let jsonText = '';

      // Key rotation pool with abort signal
      for (let i = 0; i < keys.length; i++) {
        if (controller.signal.aborted) return;
        const apiKey = keys[i];
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${preferredModel}:generateContent?key=${apiKey}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: contentsParts }],
              generationConfig: {
                temperature: 0.1,
                topP: 0.95,
                maxOutputTokens: 8192
              }
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
          }

          const data = await response.json();
          jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (jsonText) break;
        } catch (err) {
          if (err.name === 'AbortError' || controller.signal.aborted) {
            console.log('AI Extraction aborted by user.');
            return;
          }
          lastError = err;
          console.warn(`Gemini Key #${i + 1} failed:`, err.message);
        }
      }

      if (controller.signal.aborted) return;

      if (!jsonText) {
        throw new Error(`AI analysis failed: ${lastError?.message || 'Empty response from Gemini'}`);
      }

      const cleanJson = jsonText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const extractedStudents = JSON.parse(cleanJson);
      if (!Array.isArray(extractedStudents) || extractedStudents.length === 0) {
        throw new Error('AI did not return any student records from the provided document/text.');
      }

      const sourceDesc = aiInputMode === 'pdf'
        ? `AI Document Extraction (${aiDocFile?.name || 'PDF'})`
        : `AI Raw Text Extraction (${extractedStudents.length} Students)`;

      await processRawStudentRowsIntoPreview(extractedStudents, sourceDesc);
      setSuccessToast(`🤖 AI successfully extracted ${extractedStudents.length} student records!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      if (err.name === 'AbortError' || aiAbortControllerRef.current?.signal?.aborted) {
        console.log('AI extraction cancelled.');
        return;
      }
      console.error('AI Extraction Error:', err);
      alert(`AI Extraction Error: ${err.message}`);
    } finally {
      setAiExtracting(false);
      setAiStatusMessage('');
      aiAbortControllerRef.current = null;
    }
  };

  /**
   * Handle Bulk Photos Selection (Upload Folder or Multi-File)
   */
  const handleSelectBulkPhotoFolder = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f.name));
    if (imageFiles.length === 0) {
      alert('No valid image files found in the selected folder.');
      return;
    }

    setBulkPhotoFiles(imageFiles);

    if (parsedWorkflowRows.length > 0) {
      const correlated = await correlatePhotos(parsedWorkflowRows, imageFiles);
      setParsedWorkflowRows(correlated);
      setSuccessToast(`📷 Correlated ${imageFiles.length} Photos with CSV Rows (1.jpg, 2.jpg...)!`);
      setTimeout(() => setSuccessToast(null), 3500);
    } else if (selectedBatchForPhotos) {
      await processBatchPhotoCorrelations(selectedBatchForPhotos, imageFiles);
    } else {
      // Disallow standalone photo upload without CSV or Batch selection
      alert('⚠️ Standalone photo folder upload is not allowed without a target CSV or selecting student applications to match against.\n\nPlease upload a CSV file first, or select a CSV Batch/Group below to correlate your photos.');
    }
  };

  /**
   * Execute Workflow Ingestion to Cloud Firestore Admissions ONLY
   */
  const handleConfirmWorkflowIngestion = async () => {
    const selectedRows = parsedWorkflowRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      alert('Please select at least 1 student row to ingest.');
      return;
    }

    setIngestingWorkflow(true);
    setSuccessToast(null);

    try {
      let count = 0;
      const importedPayloads = [];

      for (const r of selectedRows) {
        const docId = String(r.formNo).replace(/[\/\s]/g, '_').toLowerCase();
        const timestamp = new Date().toISOString();

        let photoDataUrl = '';
        if (r.photoFile) {
          try {
            photoDataUrl = await compressImageFile(r.photoFile, 250, 300, 0.7);
          } catch (e) {
            console.warn('Photo compression note:', e);
          }
        }

        const payload = {
          id: docId,
          _isCurrentScope: true,
          _isDirectIngested: true,
          formNo: String(r.formNo),
          'Form Number': String(r.formNo),
          'Form No.': String(r.formNo),
          status: r.status || 'Approved',
          'Status': r.status || 'Approved',
          classRollNo: r.classRollNo || '',
          'Class Roll No': r.classRollNo || '',
          admNo: r.admNo || '',
          'Adm. No.': r.admNo || '',
          class: r.class || '11th',
          'Class': r.class || '11th',
          session: r.session || '2025-26',
          'Session': r.session || '2025-26',
          boardRegNo: r.boardRegNo || '',
          'Board Registration Number': r.boardRegNo || '',
          studentName: r.studentName,
          "Student's Name (as per school records)": r.studentName,
          fatherName: r.fatherName || '',
          "Father's/Guardian's Name (as per school records)": r.fatherName || '',
          motherName: r.motherName || '',
          "Mother's Name (as per school records)": r.motherName || '',
          dob: r.dob || '',
          'DoB (as per school records)': r.dob || '',
          gender: r.gender || 'Male',
          'Gender': r.gender || 'Male',
          stream: r.stream || 'Science',
          'Stream': r.stream || 'Science',
          subs: r.subs || '',
          'Subjects (Stream)': r.subs || '',
          mobile: r.mobile || '',
          'Mobile No. (with working WhatsApp)': r.mobile || '',
          category: r.category || 'General',
          'Cat._JKBOSE': r.category || 'General',
          village: r.village || '',
          'Name of your village': r.village || '',
          district: r.district || 'Anantnag',
          'District': r.district || 'Anantnag',
          pinCode: r.pinCode || '',
          'PIN code': r.pinCode || '',
          aadhar: r.aadhar || '',
          'Aadhaar No.': r.aadhar || '',
          'Aadhar No.': r.aadhar || '',
          fatherAadhar: r.fatherAadhar || '',
          'Father\'s Aadhar No.': r.fatherAadhar || '',
          'Father\'s Aadhaar No.': r.fatherAadhar || '',
          bankAccount: r.bankAccount || '',
          'Bank Account No.': r.bankAccount || '',
          bankName: r.bankName || '',
          'Name of Bank': r.bankName || '',
          ifsc: r.ifsc || '',
          'IFSC code': r.ifsc || '',
          photoUrl: photoDataUrl || '',
          'Photo': photoDataUrl || '',
          onlineSubmDate: timestamp.split('T')[0],
          'Online Subm. Date': timestamp.split('T')[0],
          admDate: timestamp.split('T')[0],
          'Adm. Date': timestamp.split('T')[0],
          createdAt: timestamp,
          updatedAt: timestamp,
          lastEditedBy: 'Admin (CSV Workflow Ingestion)'
        };

        // 1. Commit STRICTLY to admissions collection ONLY (NOT masterRegisters)
        await setDoc(doc(db, 'admissions', docId), payload, { merge: true });

        // 2. Consume form number in counter service
        await consumeFormNumber(r.formNo).catch(e => console.warn('consumeFormNumber note:', e));

        // 3. Update local SWR dbCache
        updateCachedItem('admissions', docId, payload);
        if (onRecordAdded) onRecordAdded(payload);

        importedPayloads.push(payload);
        count++;
      }

      if (importedPayloads.length > 0) {
        await saveCsvImportBatch({
          fileName: csvFile?.name || 'workflow_imported_students.csv',
          importedRecords: importedPayloads,
          reasonCategory: 'CSV Workflow Ingestion',
          customReason: `Ingested ${count} student records with photo correlation.`
        });
      }

      await logAdminActivity({
        actionType: 'bulk_import',
        actionTitle: 'CSV Workflow Student Ingestion',
        details: `Ingested ${count} student records (Photos matched: ${selectedRows.filter(r => r.photoFile).length}) from CSV "${csvFile?.name || 'Import'}"`,
        reasonCategory: 'CSV Workflow Ingestion',
        metadata: { count, filename: csvFile?.name }
      });

      setShowWorkflowPreviewModal(false);
      setParsedWorkflowRows([]);
      setCsvFile(null);
      setBulkPhotoFiles([]);
      await fetchCsvBatches();

      setSuccessToast(`🎉 Successfully Ingested ${count} Student Records to Admissions! (Photos attached: ${selectedRows.filter(r => r.photoFile).length})`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Workflow ingestion error:', err);
      alert(`❌ Failed to ingest CSV records: ${err.message}`);
    } finally {
      setIngestingWorkflow(false);
    }
  };

  /**
   * Process Post-Import Bulk Photo Sync by Group / CSV Batch
   */
  const processBatchPhotoCorrelations = async (batchId, photoFiles) => {
    const targetBatch = csvBatches.find(b => b.batchId === batchId);
    if (!targetBatch) return;

    const records = targetBatch.importedRecords || targetBatch.summaryRecords || [];
    const rows = records.map((r, idx) => ({
      sno: idx + 1,
      id: r.id || r.docId,
      formNo: r.formNo || r['Form Number'] || r['Form No.'] || '',
      boardRegNo: r.boardRegNo || r['Board Registration Number'] || '',
      studentName: r.studentName || r["Student's Name (as per school records)"] || '',
      class: r.class || r['Class'] || '',
      originalRecord: r
    }));

    const correlated = await correlatePhotos(rows, photoFiles);
    setBatchPhotoMatches(correlated);
  };

  /**
   * Apply & Attach Photos for Post-Import Bulk Photo Sync
   */
  const handleApplyBatchPhotosSync = async () => {
    const matched = batchPhotoMatches.filter(m => m.photoFile);
    if (matched.length === 0) {
      alert('No matched photos found to sync.');
      return;
    }

    setSyncingBatchPhotos(true);
    try {
      let updatedCount = 0;
      for (const m of matched) {
        const docId = m.id || String(m.formNo).replace(/[\/\s]/g, '_').toLowerCase();
        const compressed = await compressImageFile(m.photoFile, 250, 300, 0.7);

        const updatePayload = {
          photo_id: compressed,
          photoUrl: deleteField(),
          Photo: deleteField(),
          'Student Photo': deleteField(),
          updatedAt: new Date().toISOString(),
          lastEditedBy: 'Admin (Post-Import Bulk Photo Sync)'
        };

        // Update ONLY admissions collection
        await setDoc(doc(db, 'admissions', docId), updatePayload, { merge: true });
        updateCachedItem('admissions', docId, { photo_id: compressed, updatedAt: updatePayload.updatedAt });
        updatedCount++;
      }

      await logAdminActivity({
        actionType: 'photo_upload',
        actionTitle: 'Post-Import Bulk Photo Sync',
        details: `Synced ${updatedCount} photos for CSV Import Batch "${selectedBatchForPhotos}"`,
        reasonCategory: 'Bulk Photo Correlation'
      });

      setBatchPhotoMatches([]);
      setSelectedBatchForPhotos('');
      setSuccessToast(`📷 Successfully Synced ${updatedCount} Student Photos to Admissions Database!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Photo sync error:', err);
      alert(`❌ Photo sync failed: ${err.message}`);
    } finally {
      setSyncingBatchPhotos(false);
    }
  };

  const handleCsvFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmModalConfig({
      isOpen: true,
      type: 'warning',
      title: 'Bulk CSV Student Import',
      message: `Are you sure you want to bulk import student records from file "${file.name}"?`,
      consequence: 'Parsed student rows will be committed directly to database registers and table view.',
      confirmText: '📄 Confirm & Process CSV Import',
      cancelText: 'Cancel',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        setConfirmModalConfig(null);
        setCsvImporting(true);
        setSuccessToast(null);

        try {
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

          if (lines.length < 2) {
            alert('CSV file is empty or missing data rows.');
            return;
          }

          // Simple CSV row parser handling quotes
          const parseCsvLine = (line) => {
            const result = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
              } else {
                cur += char;
              }
            }
            result.push(cur.trim());
            return result;
          };

          const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
          let importedCount = 0;
          const importedPayloads = [];

          for (let i = 1; i < lines.length; i++) {
            const row = parseCsvLine(lines[i]);
            if (!row.length || row.every(val => val === '')) continue;

            const rowObj = {};
            headers.forEach((h, idx) => {
              rowObj[h] = row[idx] ? row[idx].replace(/^"|"$/g, '') : '';
            });

            const studentName = rowObj['studentname'] || rowObj['name'] || `Student ${i}`;
            const formNo = rowObj['formnumber'] || rowObj['formno'] || `HSS/ADM/CSV_${Date.now()}_${i}`;
            const docId = formNo.replace(/[\/\s]/g, '_').toLowerCase();

            const payload = {
              id: docId,
              _isCurrentScope: true,
              _isDirectIngested: true,
              formNo: formNo,
              'Form Number': formNo,
              status: rowObj['status'] || 'Approved',
              'Status': rowObj['status'] || 'Approved',
              classRollNo: rowObj['classrollno'] || rowObj['rollno'] || '',
              'Class Roll No': rowObj['classrollno'] || rowObj['rollno'] || '',
              admNo: rowObj['admno'] || rowObj['admissionno'] || '',
              'Adm. No.': rowObj['admno'] || rowObj['admissionno'] || '',
              class: rowObj['class'] || '11th',
              'Class': rowObj['class'] || '11th',
              session: rowObj['session'] || '2025-26',
              'Session': rowObj['session'] || '2025-26',
              boardRegNo: rowObj['boardregistrationnumber'] || rowObj['boardregno'] || '',
              'Board Registration Number': rowObj['boardregistrationnumber'] || rowObj['boardregno'] || '',
              studentName: studentName,
              "Student's Name (as per school records)": studentName,
              fatherName: rowObj['fathername'] || '',
              "Father's/Guardian's Name (as per school records)": rowObj['fathername'] || '',
              motherName: rowObj['mothername'] || '',
              "Mother's Name (as per school records)": rowObj['mothername'] || '',
              dob: rowObj['dob'] || rowObj['dateofbirth'] || '',
              'DoB (as per school records)': rowObj['dob'] || rowObj['dateofbirth'] || '',
              gender: rowObj['gender'] || 'Male',
              'Gender': rowObj['gender'] || 'Male',
              stream: rowObj['stream'] || 'Science',
              'Stream': rowObj['stream'] || 'Science',
              subs: rowObj['subjects'] || rowObj['subs'] || '',
              'Subjects (Stream)': rowObj['subjects'] || rowObj['subs'] || '',
              mobile: rowObj['mobileno'] || rowObj['mobile'] || '',
              'Mobile No. (with working WhatsApp)': rowObj['mobileno'] || rowObj['mobile'] || '',
              category: rowObj['category'] || 'General',
              'Cat._JKBOSE': rowObj['category'] || 'General',
              village: rowObj['village'] || '',
              'Name of your village': rowObj['village'] || '',
              district: rowObj['district'] || 'Anantnag',
              'District': rowObj['district'] || 'Anantnag',
              pinCode: rowObj['pincode'] || '',
              'PIN code': rowObj['pincode'] || '',
              onlineSubmDate: new Date().toISOString().split('T')[0],
              'Online Subm. Date': new Date().toISOString().split('T')[0],
              admDate: new Date().toISOString().split('T')[0],
              'Adm. Date': new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastEditedBy: 'Admin (CSV Bulk Import)'
            };

            await setDoc(doc(db, 'admissions', docId), payload, { merge: true });
            // masterRegisters is populated ONLY during session-close — not on import

            updateCachedItem('admissions', docId, payload);
            if (onRecordAdded) onRecordAdded(payload);
            importedPayloads.push(payload);
            importedCount++;
          }

          if (importedPayloads.length > 0) {
            await saveCsvImportBatch({
              fileName: file.name,
              importedRecords: importedPayloads,
              reasonCategory,
              customReason
            });
          }

          await logAdminActivity({
            actionType: 'bulk_import',
            actionTitle: 'Bulk CSV Student Ingestion',
            details: `Bulk imported ${importedCount} student records from file "${file.name}"`,
            reasonCategory,
            customReason,
            metadata: { count: importedCount, filename: file.name }
          });

          setSuccessToast(`🎉 Bulk Imported ${importedCount} Student Records from CSV! Saved to 30-Day Batch Memory.`);
        } catch (err) {
          console.error('CSV import error:', err);
          alert(`Error reading CSV: ${err.message}`);
        } finally {
          setCsvImporting(false);
        }
      }
    });
  };

  // Smart Existing Student Resolution Engine
  const findExistingStudentMatch = (formValues) => {
    const activeList = getCachedCollectionSync('admissions') || [];
    const masterList = getCachedCollectionSync('masterRegisters') || [];

    const fNoTarget = String(formValues.formNo || formValues['Form Number'] || formValues['Form No.'] || '').trim().toLowerCase();
    const regTarget = String(formValues.boardRegNo || formValues['Board Registration Number'] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
    const nameTarget = String(formValues.studentName || formValues["Student's Name (as per school records)"] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
    const fatherTarget = String(formValues.fatherName || formValues["Father's/Guardian's Name (as per school records)"] || '').replace(/[^a-z0-9]/g, '').toLowerCase();

    // 1. Search active admissions first
    for (const item of activeList) {
      const rec = item.items || item;
      const recs = Array.isArray(rec) ? rec : [rec];
      for (const r of recs) {
        if (!r || r.Status === 'Deleted' || r._deleted) continue;
        const fNo = String(r.formNo || r['Form Number'] || r['Form No.'] || r['Form No'] || '').trim().toLowerCase();
        const reg = String(r.boardRegNo || r['Board Registration Number'] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
        const name = String(r.studentName || r["Student's Name (as per school records)"] || r["Student's Name"] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
        const father = String(r.fatherName || r["Father's/Guardian's Name (as per school records)"] || r["Father's Name"] || '').replace(/[^a-z0-9]/g, '').toLowerCase();

        if (fNoTarget && fNo && fNoTarget === fNo) return { collection: 'admissions', record: r };
        if (regTarget && reg && regTarget === reg) return { collection: 'admissions', record: r };
        if (nameTarget && nameTarget.length > 2 && nameTarget === name) {
          if (!fatherTarget || !father || fatherTarget === father) return { collection: 'admissions', record: r };
        }
      }
    }

    // 2. Search masterRegisters second
    for (const item of masterList) {
      const rec = item.items || item;
      const recs = Array.isArray(rec) ? rec : [rec];
      for (const r of recs) {
        if (!r || r.Status === 'Deleted' || r._deleted) continue;
        const fNo = String(r.formNo || r['Form Number'] || r['Form No.'] || r['Form No'] || '').trim().toLowerCase();
        const reg = String(r.boardRegNo || r['Board Registration Number'] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
        const name = String(r.studentName || r["Student's Name (as per school records)"] || r["Student's Name"] || '').replace(/[^a-z0-9]/g, '').toLowerCase();
        const father = String(r.fatherName || r["Father's/Guardian's Name (as per school records)"] || r["Father's Name"] || '').replace(/[^a-z0-9]/g, '').toLowerCase();

        if (fNoTarget && fNo && fNoTarget === fNo) return { collection: 'masterRegisters', record: r };
        if (regTarget && reg && regTarget === reg) return { collection: 'masterRegisters', record: r };
        if (nameTarget && nameTarget.length > 2 && nameTarget === name) {
          if (!fatherTarget || !father || fatherTarget === father) return { collection: 'masterRegisters', record: r };
        }
      }
    }

    return null;
  };

  const handleSubmit = async (addAnother = false) => {
    setSaving(true);
    setSuccessToast(null);

    try {
      // Perform smart existing student resolution
      const existingMatch = findExistingStudentMatch(formData);
      
      let targetCollection = 'admissions';
      let targetDocId = '';
      let generatedFormNo = formData.formNo.trim();

      if (existingMatch) {
        // Record ALREADY EXISTS! Update in place!
        targetCollection = existingMatch.collection || 'admissions';
        const r = existingMatch.record;
        targetDocId = r.docId || r._docId || r.id || String(r['Form Number'] || r['Form No.'] || r.formNo || '').replace(/[\/\s]/g, '_').toLowerCase();
        generatedFormNo = r.formNo || r['Form Number'] || r['Form No.'] || generatedFormNo || '250571';
      } else {
        // Genuinely NEW Student Application
        if (!generatedFormNo) {
          generatedFormNo = String(await getNextAvailableFormNumber());
        }
        targetDocId = generatedFormNo.replace(/[\/\s]/g, '_').toLowerCase();
      }

      const studentNameDisplay = formData.studentName.trim() || 'Direct Ingested Student';
      const timestamp = new Date().toISOString();

      const payload = {
        id: targetDocId,
        docId: targetDocId,
        _isCurrentScope: true,
        _isDirectIngested: true,
        formNo: generatedFormNo,
        'Form Number': generatedFormNo,
        'Form No.': generatedFormNo,
        'Form No': generatedFormNo,
        'FormNo': generatedFormNo,
        'formNumber': generatedFormNo,
        status: formData.status || 'Approved',
        'Status': formData.status || 'Approved',
        classRollNo: formData.classRollNo,
        'Class Roll No': formData.classRollNo,
        'Class Roll No.': formData.classRollNo,
        admNo: formData.admNo,
        'Adm. No.': formData.admNo,
        class: formData.class || '11th',
        'Class': formData.class || '11th',
        'Admission sought for class': formData.class || '11th',
        session: formData.session || '2025-26',
        'Session': formData.session || '2025-26',
        boardRegNo: formData.boardRegNo,
        'Board Registration Number': formData.boardRegNo,
        studentName: studentNameDisplay,
        "Student's Name (as per school records)": studentNameDisplay,
        "Student's Name": studentNameDisplay,
        fatherName: formData.fatherName,
        "Father's/Guardian's Name (as per school records)": formData.fatherName,
        "Father's Name": formData.fatherName,
        motherName: formData.motherName,
        "Mother's Name (as per school records)": formData.motherName,
        dob: formData.dob,
        'DoB (as per school records)': formData.dob,
        gender: formData.gender,
        'Gender': formData.gender,
        stream: formData.stream,
        'Stream': formData.stream,
        subs: formData.subs,
        'Subjects (Stream)': formData.subs,
        mobile: formData.mobile,
        'Mobile No. (with working WhatsApp)': formData.mobile,
        category: formData.category,
        'Cat._JKBOSE': formData.category,
        village: formData.village,
        'Name of your village': formData.village,
        residence: formData.residence,
        'Residence (Village, District)': formData.residence,
        block: formData.block,
        'Block': formData.block,
        tehsil: formData.tehsil,
        'Tehsil': formData.tehsil,
        district: formData.district,
        'District': formData.district,
        pinCode: formData.pinCode,
        'PIN code': formData.pinCode,
        state: formData.state,
        'State/UT': formData.state,
        aadhar: formData.aadhar,
        'Aadhar No.': formData.aadhar,
        'Aadhaar No.': formData.aadhar,
        fatherAadhar: formData.fatherAadhar,
        'Father\'s Aadhar No.': formData.fatherAadhar,
        'Father\'s Aadhaar No.': formData.fatherAadhar,
        apaarId: formData.apaarId,
        'APAAR ID': formData.apaarId,
        penNo: formData.penNo,
        'PEN No.': formData.penNo,
        bankAccount: formData.bankAccount,
        'Bank Account No.': formData.bankAccount,
        bankName: formData.bankName,
        'Name of Bank': formData.bankName,
        ifsc: formData.ifsc,
        'IFSC code': formData.ifsc,
        boardName: formData.boardName,
        'Board Name': formData.boardName,
        prevSchool: formData.prevSchool,
        'Previous School': formData.prevSchool,
        remarks: formData.remarks,
        'Remarks': formData.remarks,
        photo_id: formData.photoUrl || photoPreview || '',
        photoUrl: deleteField(),
        Photo: deleteField(),
        'Student Photo': deleteField(),
        updatedAt: timestamp,
        lastEditedBy: 'Admin (Direct Express Ingestion)'
      };

      if (!existingMatch) {
        payload.createdAt = timestamp;
        payload.onlineSubmDate = timestamp.split('T')[0];
        payload['Online Subm. Date'] = timestamp.split('T')[0];
        payload['Adm. Date'] = timestamp.split('T')[0];
      }

      // ALWAYS write new/updated records to 'admissions' collection only.
      // masterRegisters is populated ONLY at session-close archival — never during data entry.
      const writeCollection = 'admissions';
      await setDoc(doc(db, writeCollection, targetDocId), payload, { merge: true });

      // Also update cache for masterRegisters if the original match was there
      if (existingMatch && existingMatch.collection === 'masterRegisters') {
        updateCachedItem('masterRegisters', targetDocId, payload);
      }

      // If NEW student, consume form number
      if (!existingMatch) {
        await consumeFormNumber(generatedFormNo).catch(e => console.warn('consumeFormNumber note:', e));
      }

      // Update local cache
      updateCachedItem(writeCollection, targetDocId, payload);
      if (onRecordAdded) onRecordAdded(payload);

      // Audit logger
      await logAdminActivity({
        actionType: existingMatch ? 'update' : 'direct_ingestion',
        actionTitle: existingMatch ? `Updated Student: ${studentNameDisplay}` : `Direct Ingestion: ${studentNameDisplay}`,
        details: existingMatch
          ? `Updated existing record (${generatedFormNo}) in ${targetCollection}`
          : `Created new student application (${generatedFormNo}) directly into admissions database`,
        reasonCategory: formData._reasonCategory || (existingMatch ? 'Student Record Correction' : 'Express Direct Ingestion'),
        customReason: formData._customReason || '',
        metadata: { formNo: generatedFormNo, studentName: studentNameDisplay, collection: targetCollection }
      }).catch(e => console.warn('Audit logger note:', e));

      if (existingMatch) {
        setSuccessToast(`🎉 Successfully Updated Existing Record for "${studentNameDisplay}" (Form #${generatedFormNo}) in ${targetCollection}!`);
      } else {
        setSuccessToast(`⚡ Direct Record Created for "${studentNameDisplay}" (${generatedFormNo})!`);
      }

      // Update history log
      const historyItem = {
        id: targetDocId,
        studentName: studentNameDisplay,
        formNo: generatedFormNo,
        class: formData.class,
        date: new Date().toLocaleString()
      };
      const updatedHistory = [historyItem, ...historyList.filter(h => h.id !== targetDocId)].slice(0, 50);
      setHistoryList(updatedHistory);
      try { localStorage.setItem('hss_admin_direct_ingestion_history_v1', JSON.stringify(updatedHistory)); } catch (e) {}

      if (addAnother) {
        const nextFNo = String(await getNextAvailableFormNumber());
        setFormData(prev => ({
          ...prev,
          formNo: nextFNo,
          classRollNo: '',
          boardRegNo: '',
          studentName: '',
          fatherName: '',
          motherName: '',
          aadhar: '',
          fatherAadhar: '',
          apaarId: '',
          penNo: '',
          photoUrl: ''
        }));
        setPhotoPreview(null);
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Direct Ingestion error:', err);
      alert(`❌ Failed to process record: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-3 bg-slate-950/75 backdrop-blur-md animate-fadeIn" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
      <div className="w-full max-w-4xl rounded-2xl border border-amber-500/40 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Clean Minimal Header Bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-black shadow-2xs flex-shrink-0">
              <PlusCircle size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
                  Express Direct Ingestion
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                Directly insert or update student records into School Database. Zero mandatory restrictions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close Express Ingestion Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Alert Banner */}
        {successToast && (
          <div className="mx-4 mt-2.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-black text-xs flex items-center justify-between gap-2 shadow-2xs animate-fadeIn">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
              <span>{successToast}</span>
            </span>
          </div>
        )}

        {/* Clean Minimal Tab Navigation */}
        <div className="px-4 pt-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto text-xs font-bold flex-shrink-0 bg-white dark:bg-slate-900">
          {[
            { id: 'personal', label: '👤 Personal' },
            { id: 'academic', label: '📚 Academic' },
            { id: 'contact', label: '📞 Contact' },
            { id: 'bank', label: '🏛️ Bank & ID' },
            { id: 'other', label: '📷 Photo & Status' },
            { id: 'csv', label: '📊 Excel & CSV Import' },
            { id: 'ai', label: '🤖 AI Smart Extract (PDF/Text)' },
            { id: 'history', label: '📜 Entry History' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-xs ${
                activeTab === tab.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-bold'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs font-bold">
          
          {/* TAB 1: PERSONAL */}
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Student's Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shahid Mushtaq Padder"
                  value={formData.studentName}
                  onChange={(e) => handleChange('studentName', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Father's Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mushtaq Ahmad Padder"
                  value={formData.fatherName}
                  onChange={(e) => handleChange('fatherName', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Mother's Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Raja Begum"
                  value={formData.motherName}
                  onChange={(e) => handleChange('motherName', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Date of Birth (DoB)
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  <option value="General">General</option>
                  <option value="RBA">RBA</option>
                  <option value="ST">ST</option>
                  <option value="SC">SC</option>
                  <option value="EWS">EWS</option>
                  <option value="OBC">OBC</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Religion
                </label>
                <input
                  type="text"
                  placeholder="Islam"
                  value={formData.religion}
                  onChange={(e) => handleChange('religion', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ACADEMIC */}
          {activeTab === 'academic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Class
                </label>
                <select
                  value={formData.class}
                  onChange={(e) => {
                    const newClass = e.target.value;
                    const isNewJunior = String(newClass).toLowerCase().includes('9') || String(newClass).toLowerCase().includes('10');
                    const defaultSubs = isNewJunior
                      ? 'English, Mathematics, Science, Social Science, Urdu'
                      : 'General English, Physics, Chemistry, Biology, Environmental Science';
                    const availableStreams = dynamicDatabaseOptions.getStreamsForClass(newClass);
                    const newStream = availableStreams.includes(formData.stream) ? formData.stream : availableStreams[0];
                    setFormData(prev => ({ ...prev, class: newClass, stream: newStream, subs: defaultSubs }));
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  {dynamicDatabaseOptions.classes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Stream
                </label>
                <select
                  value={formData.stream}
                  onChange={(e) => handleChange('stream', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  {dynamicDatabaseOptions.getStreamsForClass(formData.class).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Session
                </label>
                <select
                  value={formData.session}
                  onChange={(e) => handleChange('session', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  {dynamicDatabaseOptions.sessions.map(ses => (
                    <option key={ses} value={ses}>{ses}</option>
                  ))}
                </select>
              </div>

              {/* Class-Specific Checkbox Subject Multi-Select Component */}
              <div className="sm:col-span-2 lg:col-span-3 space-y-2 p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-200">
                    <BookOpen size={14} className="text-amber-600 dark:text-amber-400" />
                    <span>Subjects Combination ({isJuniorClass ? 'Class 9th/10th Secondary' : 'Class 11th/12th Higher Secondary'})</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                      {selectedSubjectList.length} Selected
                    </span>
                  </div>

                  {/* Class-Specific Quick Stream Presets */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px] font-black">
                    <span className="text-slate-400 mr-0.5">Quick Presets:</span>
                    {isJuniorClass ? (
                      <>
                        <button
                          type="button"
                          onClick={() => applySubjectPreset(['English', 'Mathematics', 'Science', 'Social Science', 'Urdu'])}
                          className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors cursor-pointer"
                        >
                          📚 Standard Core 5
                        </button>
                        <button
                          type="button"
                          onClick={() => applySubjectPreset(['English', 'Mathematics', 'Science', 'Social Science', 'Urdu', 'IT & ITES'])}
                          className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 hover:bg-sky-200 transition-colors cursor-pointer"
                        >
                          💻 IT Vocational
                        </button>
                        <button
                          type="button"
                          onClick={() => applySubjectPreset(['English', 'Mathematics', 'Science', 'Social Science', 'Urdu', 'Healthcare'])}
                          className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 hover:bg-purple-200 transition-colors cursor-pointer"
                        >
                          🏥 Healthcare
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => applySubjectPreset(['General English', 'Physics', 'Chemistry', 'Biology', 'Environmental Science'])}
                          className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors cursor-pointer"
                        >
                          🔬 Medical
                        </button>
                        <button
                          type="button"
                          onClick={() => applySubjectPreset(['General English', 'Physics', 'Chemistry', 'Mathematics', 'Environmental Science'])}
                          className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 hover:bg-sky-200 transition-colors cursor-pointer"
                        >
                          📐 Non-Medical
                        </button>
                        <button
                          type="button"
                          onClick={() => applySubjectPreset(['General English', 'Political Science', 'Education', 'History', 'Environmental Science'])}
                          className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 hover:bg-purple-200 transition-colors cursor-pointer"
                        >
                          📜 Arts
                        </button>
                        <button
                          type="button"
                          onClick={() => applySubjectPreset(['General English', 'Economics', 'Accountancy', 'Business Studies', 'Mathematics'])}
                          className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                        >
                          💼 Commerce
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => applySubjectPreset([])}
                      className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 hover:bg-rose-200 transition-colors cursor-pointer"
                    >
                      🧹 Clear
                    </button>
                  </div>
                </div>

                {/* Grid of Class-Specific Subject Checkboxes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar pt-1">
                  {activeSubjectPool.map((sub) => {
                    const checked = isSubjectSelected(sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleSubjectSelection(sub)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer border text-left truncate ${
                          checked
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-900 dark:text-amber-200 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        ) : (
                          <Square size={13} className="text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{sub}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Live Form Value Input */}
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <span className="text-[10px] font-black text-slate-500 shrink-0">Selected String:</span>
                  <input
                    type="text"
                    value={formData.subs}
                    onChange={(e) => handleChange('subs', e.target.value)}
                    placeholder="Selected subjects combination string..."
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[11px] text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5 flex items-center justify-between">
                  <span>Form Number</span>
                  <span className="text-[9.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-700/60">
                    ⚡ Auto-Assigned ({formData.formNo || '250571'})
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Auto-assigned sequential (e.g. 250571) — Edit only to override for paper form"
                  value={formData.formNo}
                  onChange={(e) => handleChange('formNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Class Roll No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. 504"
                  value={formData.classRollNo}
                  onChange={(e) => handleChange('classRollNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Admission No. (Adm. No.)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5480"
                  value={formData.admNo}
                  onChange={(e) => handleChange('admNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Board Registration No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2568409384"
                  value={formData.boardRegNo}
                  onChange={(e) => handleChange('boardRegNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Previous School
                </label>
                <input
                  type="text"
                  placeholder="e.g. High School Shangus"
                  value={formData.prevSchool}
                  onChange={(e) => handleChange('prevSchool', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 3: CONTACT */}
          {activeTab === 'contact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Mobile No. (WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={formData.mobile}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Village / Town
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shangus"
                  value={formData.village}
                  onChange={(e) => handleChange('village', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Block
                </label>
                <input
                  type="text"
                  placeholder="Shangus"
                  value={formData.block}
                  onChange={(e) => handleChange('block', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Tehsil
                </label>
                <input
                  type="text"
                  placeholder="Shangus"
                  value={formData.tehsil}
                  onChange={(e) => handleChange('tehsil', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  District
                </label>
                <input
                  type="text"
                  placeholder="Anantnag"
                  value={formData.district}
                  onChange={(e) => handleChange('district', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  PIN Code
                </label>
                <input
                  type="text"
                  placeholder="192201"
                  value={formData.pinCode}
                  onChange={(e) => handleChange('pinCode', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 4: BANK & IDENTIFIERS */}
          {activeTab === 'bank' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Student's Aadhaar No.
                </label>
                <input
                  type="text"
                  placeholder="12-digit Aadhaar"
                  value={formData.aadhar}
                  onChange={(e) => handleChange('aadhar', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Father's Aadhaar No.
                </label>
                <input
                  type="text"
                  placeholder="12-digit Father's Aadhaar"
                  value={formData.fatherAadhar}
                  onChange={(e) => handleChange('fatherAadhar', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  APAAR ID
                </label>
                <input
                  type="text"
                  placeholder="APAAR ID"
                  value={formData.apaarId}
                  onChange={(e) => handleChange('apaarId', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  PEN No.
                </label>
                <input
                  type="text"
                  placeholder="PEN No."
                  value={formData.penNo}
                  onChange={(e) => handleChange('penNo', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Bank Account No.
                </label>
                <input
                  type="text"
                  placeholder="Account Number"
                  value={formData.bankAccount}
                  onChange={(e) => handleChange('bankAccount', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  Name of Bank
                </label>
                <input
                  type="text"
                  placeholder="J&K Bank / SBI"
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                  IFSC Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. JAKA0SHANGU"
                  value={formData.ifsc}
                  onChange={(e) => handleChange('ifsc', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 5: PHOTO & STATUS WITH POST-IMPORT BULK PHOTO SYNC */}
          {activeTab === 'other' && (
            <div className="space-y-4">
              {/* Photo Import Guidance Banner */}
              <div className="p-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-black text-sky-700 dark:text-sky-300">
                  <Info size={15} />
                  <span>📷 Photo Guidance & Automatic Max 20KB Compression</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 font-bold text-[11px] text-sky-800 dark:text-sky-300/90">
                  <li><strong>Sequential S.No Matching:</strong> Name photos as <code>1.jpg</code>, <code>2.png</code>, <code>3.jpg</code> corresponding to CSV row numbers.</li>
                  <li><strong>Form & Reg No Matching:</strong> Photos can also be named as <code>[FormNo].jpg</code> (e.g. <code>250571.jpg</code>) or <code>[BoardRegNo].jpg</code>.</li>
                  <li><strong>Auto-Compression & Target:</strong> All uploaded photos are compressed to &lt;20KB JPEG and saved strictly to <strong>admissions</strong> collection.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                    Admission Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                  >
                    <option value="Approved">Approved (Active Record)</option>
                    <option value="Submitted">Submitted (Under Review)</option>
                    <option value="Provisionally Approved">Provisionally Approved</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                    Remarks / Internal Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Class 9 student uploaded by Admin due to offline request"
                    value={formData.remarks}
                    onChange={(e) => handleChange('remarks', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-20 h-24 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Student Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 text-center px-1">No Photo</span>
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      Upload Single Student Passport Photo (Auto-compressed &lt; 20KB)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* POST-IMPORT BULK PHOTO SYNC BY GROUP / BATCH */}
              <div className="p-3.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderUp size={18} className="text-amber-600 dark:text-amber-400" />
                    <div>
                      <h4 className="font-black text-xs text-slate-900 dark:text-white">
                        Post-Import Bulk Photo Sync by CSV Batch / Group
                      </h4>
                      <p className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                        Attach bulk photos to previously imported CSV student applications using sequential S.No (1.jpg, 2.jpg...) or Form Number.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10.5px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                      1. Select Target CSV Batch / Group
                    </label>
                    <select
                      value={selectedBatchForPhotos}
                      onChange={(e) => {
                        setSelectedBatchForPhotos(e.target.value);
                        if (e.target.value && bulkPhotoFiles.length > 0) {
                          processBatchPhotoCorrelations(e.target.value, bulkPhotoFiles);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-xs cursor-pointer"
                    >
                      <option value="">-- Choose CSV Import Batch --</option>
                      {csvBatches.map((b) => (
                        <option key={b.batchId} value={b.batchId}>
                          {b.fileName} ({b.totalCount} Students) — {new Date(b.timestamp).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-black text-slate-700 dark:text-slate-300 mb-0.5">
                      2. Select Bulk Photos Folder / Images
                    </label>
                    <label className="w-full py-1.5 px-3 rounded-xl font-black text-xs text-amber-900 dark:text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center">
                      <Camera size={13} />
                      <span>{bulkPhotoFiles.length > 0 ? `${bulkPhotoFiles.length} Photos Loaded` : 'Choose Photo Folder / Images'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleSelectBulkPhotoFolder}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Batch Photo Correlations Live Preview Table */}
                {batchPhotoMatches.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-amber-500/20">
                    <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200">
                      <span>Matched Photos Preview ({batchPhotoMatches.filter(m => m.photoFile).length} of {batchPhotoMatches.length} Matched)</span>
                      <button
                        type="button"
                        disabled={syncingBatchPhotos || batchPhotoMatches.filter(m => m.photoFile).length === 0}
                        onClick={handleApplyBatchPhotosSync}
                        className="px-3 py-1 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-500 shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        {syncingBatchPhotos ? <RefreshCw size={12} className="animate-spin" /> : <Camera size={12} />}
                        <span>Sync {batchPhotoMatches.filter(m => m.photoFile).length} Photos to Admissions</span>
                      </button>
                    </div>

                    <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-950 font-black border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-1.5">S.No</th>
                            <th className="p-1.5">Form No.</th>
                            <th className="p-1.5">Student Name</th>
                            <th className="p-1.5">Correlated Image</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                          {batchPhotoMatches.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-950">
                              <td className="p-1.5 font-mono text-slate-400">#{m.sno}</td>
                              <td className="p-1.5 font-mono text-indigo-600">{m.formNo}</td>
                              <td className="p-1.5 font-black text-slate-900 dark:text-white">{m.studentName}</td>
                              <td className="p-1.5">
                                {m.photoFile ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1 w-fit">
                                    📷 {m.photoMatchLabel}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">No photo match (1.jpg, 2.jpg...)</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: EXCEL & CSV BULK SPREADSHEET INGESTION */}
          {activeTab === 'csv' && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black shadow-2xs">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      Excel (.xlsx) & CSV Ingestion
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Import structured spreadsheets, auto-correlate student photos, and preview before saving.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Download Standard Templates */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 flex flex-col justify-between shadow-2xs">
                  <div>
                    <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Download size={13} className="text-emerald-600" /> 1. Templates
                    </h4>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 font-medium leading-normal">
                      Download official spreadsheet template with pre-configured headers.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="w-full py-1.5 px-2 rounded-lg font-black text-[10.5px] text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Download formatted Excel (.xlsx) template"
                    >
                      <FileSpreadsheet size={12} />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCsvTemplate}
                      className="w-full py-1.5 px-2 rounded-lg font-black text-[10.5px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Download CSV (.csv) template"
                    >
                      <Download size={12} />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* 2. Upload Spreadsheet (Excel or CSV) */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 flex flex-col justify-between shadow-2xs">
                  <div>
                    <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Upload size={13} className="text-amber-600" /> 2. Upload File
                    </h4>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 font-medium leading-normal">
                      Select filled <strong>.xlsx</strong> or <strong>.csv</strong> spreadsheet to launch preview.
                    </p>
                  </div>
                  <label className="w-full py-1.5 px-2 rounded-lg font-black text-xs text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center shadow-2xs">
                    <Upload size={12} />
                    <span className="truncate">{csvFile ? csvFile.name : 'Choose File'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleSelectSpreadsheetFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* 3. Attach Bulk Photos Folder (Optional) */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 flex flex-col justify-between shadow-2xs">
                  <div>
                    <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Camera size={13} className="text-sky-600" /> 3. Attach Photos
                    </h4>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 font-medium leading-normal">
                      Select folder. Images named <code>1.jpg</code> auto-correlate by row S.No!
                    </p>
                  </div>
                  <label className="w-full py-1.5 px-2 rounded-lg font-black text-xs text-sky-900 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer text-center">
                    <Camera size={12} />
                    <span className="truncate">{bulkPhotoFiles.length > 0 ? `${bulkPhotoFiles.length} Photos` : 'Select Folder'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleSelectBulkPhotoFolder}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Workflow Status Banner */}
              {parsedWorkflowRows.length > 0 && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-emerald-600" />
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        Workflow Ready: {parsedWorkflowRows.length} Rows ({parsedWorkflowRows.filter(r => r.photoFile).length} Photos Matched)
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Source: {sourceTypeLabel}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowWorkflowPreviewModal(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                  >
                    <Eye size={13} />
                    <span>Open Preview Modal</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: 🤖 AI SMART EXTRACTION (PDF / SCANNED DOCUMENT / PASTED TEXT) */}
          {activeTab === 'ai' && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-black shadow-2xs">
                    <Bot size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                        AI Student Roster Extraction
                      </h3>
                      <span className="px-2 py-0.2 rounded text-[9px] font-black bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                        Gemini Multimodal
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Extract structured student records directly from PDF documents, images, or raw pasted tables.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-mode Segmented Switch */}
              <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAiInputMode('pdf')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    aiInputMode === 'pdf'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText size={13} />
                  <span>Document (PDF / Image)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiInputMode('text')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    aiInputMode === 'text'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Copy size={13} />
                  <span>Pasted Text / Roster</span>
                </button>
              </div>

              {/* Database-Driven Target Defaults & Scope Configuration */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Target Class (DB)
                  </label>
                  <select
                    value={aiClass}
                    onChange={(e) => {
                      const newCls = e.target.value;
                      setAiClass(newCls);
                      const avail = dynamicDatabaseOptions.getStreamsForClass(newCls);
                      if (!avail.includes(aiStream)) {
                        setAiStream(avail[0]);
                      }
                    }}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-slate-100 cursor-pointer focus:ring-1 focus:ring-slate-400"
                  >
                    {dynamicDatabaseOptions.classes.map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Default Stream (DB)
                  </label>
                  <select
                    value={aiStream}
                    onChange={(e) => setAiStream(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-slate-100 cursor-pointer focus:ring-1 focus:ring-slate-400"
                  >
                    {dynamicDatabaseOptions.getStreamsForClass(aiClass).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Session (DB)
                  </label>
                  <select
                    value={aiSession}
                    onChange={(e) => setAiSession(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-slate-100 cursor-pointer focus:ring-1 focus:ring-slate-400"
                  >
                    {dynamicDatabaseOptions.sessions.map(ses => (
                      <option key={ses} value={ses}>{ses}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Correlate Photos
                  </label>
                  <label className="w-full py-1.5 px-2 rounded-lg font-black text-[11px] text-sky-900 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer truncate">
                    <Camera size={12} />
                    <span className="truncate">{bulkPhotoFiles.length > 0 ? `${bulkPhotoFiles.length} Photos` : 'Attach Folder'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleSelectBulkPhotoFolder}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Mode 1: PDF / Document File Picker */}
              {aiInputMode === 'pdf' && (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-xs text-slate-900 dark:text-white">
                      Upload PDF Document or Image
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Supports PDF, PNG, JPG files containing student admission or registration tables.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer shadow-2xs transition-colors">
                    <FileText size={13} />
                    <span>{aiDocFile ? `${aiDocFile.name} (${(aiDocFile.size / 1024).toFixed(1)} KB)` : 'Choose File'}</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setAiDocFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Mode 2: Raw Textarea Paste Area */}
              {aiInputMode === 'text' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Copy size={12} className="text-slate-500" />
                      <span>Paste Raw Student Text / Copied Table</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {aiRawText.length} Characters
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={aiRawText}
                    onChange={(e) => setAiRawText(e.target.value)}
                    placeholder="Paste unformatted student text here... e.g.:&#10;1. Shahid Mushtaq Padder, S/o Mushtaq Ahmad, DoB: 12-04-2007, Reg No: 23901002001, Shangus, Class 11th Science&#10;2. Aahil Sheeraz Shah, S/o Sheeraz Ahmad, DoB: 05-08-2008, Reg No: 23901002002, Nowgam..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-slate-400 custom-scrollbar leading-relaxed"
                  />
                </div>
              )}

              {/* Trigger Extraction Button & Live Progress & Stop Control */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 min-w-0 flex-1">
                  {aiExtracting ? (
                    <RefreshCw size={13} className="animate-spin text-indigo-600 shrink-0" />
                  ) : (
                    <Sparkles size={13} className="text-emerald-600 shrink-0" />
                  )}
                  <span className="truncate">{aiStatusMessage || 'Connected to Cloud Firebase Gemini API pool.'}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {aiExtracting ? (
                    <button
                      type="button"
                      onClick={handleStopAiExtraction}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 shadow-xs cursor-pointer transition-colors flex items-center gap-1.5 animate-pulse"
                      title="Immediately stop/abort the ongoing Gemini AI extraction request"
                    >
                      <X size={13} />
                      <span>⏹ Stop Extraction</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={(aiInputMode === 'pdf' && !aiDocFile) || (aiInputMode === 'text' && !aiRawText.trim())}
                      onClick={handleRunAiExtraction}
                      className="px-4 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-xs cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Wand2 size={13} />
                      <span>⚡ Extract & Preview</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: DIRECT INGESTION HISTORY LOG WITH REACTIVE DASHBOARD SYNC */}
          {activeTab === 'history' && (
            <div className="space-y-3" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-admin-sans, "Plus Jakarta Sans", sans-serif)' }}>
                  <History size={15} className="text-amber-600" /> Audit Log of Recent Direct Ingestions (Synced with Dashboard)
                </h3>
                {historyList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModalConfig({
                        isOpen: true,
                        type: 'warning',
                        title: 'Clear History Audit Log',
                        message: 'Are you sure you want to clear all history items from local log?',
                        consequence: 'This clears your local history log view. Actual database records remain unaffected.',
                        confirmText: '🧹 Confirm & Clear Log',
                        cancelText: 'Cancel',
                        onConfirm: () => {
                          setConfirmModalConfig(null);
                          setHistoryList([]);
                          localStorage.removeItem('hss_admin_direct_ingestion_history_v1');
                        }
                      });
                    }}
                    className="text-[10px] font-black text-rose-600 hover:underline cursor-pointer"
                  >
                    Clear History Log
                  </button>
                )}
              </div>

              {historyList.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 font-bold text-xs bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No recent direct express ingestion records recorded in this session.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {historyList.map((item, idx) => (
                    <div
                      key={item.id + idx}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs font-bold hover:border-amber-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          ⚡ Express
                        </span>
                        <div>
                          <div className="font-black text-slate-900 dark:text-white text-xs">{item.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Form: {item.formNo} | Class: {item.class}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">{item.date}</span>
                        
                        {/* Delete Record Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModalConfig({
                              isOpen: true,
                              type: 'danger',
                              title: 'Permanent Record Removal',
                              message: `Are you sure you want to permanently delete the entry for "${item.studentName}"?`,
                              consequence: 'This student record will be permanently deleted from database registers and history logs. This action cannot be undone.',
                              confirmText: '🔥 Confirm & Delete Entry',
                              cancelText: 'Cancel',
                              onConfirm: async ({ reasonCategory, customReason } = {}) => {
                                setConfirmModalConfig(null);
                                try {
                                  await deleteStudentDocument(item);
                                  
                                  // Log admin activity audit to Firestore
                                  await logAdminActivity({
                                    actionType: 'delete',
                                    actionTitle: `Deleted Express Record: ${item.studentName || 'Student'}`,
                                    details: `Permanently deleted record (Form: ${item.formNo || 'N/A'}) from history and database.`,
                                    reasonCategory: reasonCategory || 'Duplicate / Invalid Entry Removal',
                                    customReason: customReason || '',
                                    metadata: { docId: item.id, formNo: item.formNo, studentName: item.studentName }
                                  }).catch(e => console.warn('Audit logger note:', e));

                                  const updated = historyList.filter(h => h.id !== item.id && h.formNo !== item.formNo);
                                  setHistoryList(updated);
                                  try { localStorage.setItem('hss_admin_direct_ingestion_history_v1', JSON.stringify(updated)); } catch (e) {}
                                  setSuccessToast(`🗑️ Permanently deleted record "${item.studentName}"`);
                                  setTimeout(() => setSuccessToast(null), 3000);
                                } catch (err) {
                                  console.error('Delete error:', err);
                                }
                              }
                            });
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-black text-rose-700 dark:text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1"
                          title="Permanently Delete Student Record from Database"
                        >
                          <Trash2 size={11} />
                          <span>Delete Record</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 30-Day CSV Import Batches & Undo Section */}
              <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-200">
                    <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Import Batches (30-Day Auto Memory & Rollback)</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    {csvBatches.length} Batches Active
                  </span>
                </div>

                {csvBatches.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-xs font-bold bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    No spreadsheet import batches recorded in the last 30 days.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {csvBatches.map((batch) => (
                      <div
                        key={batch.batchId}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs font-bold hover:border-emerald-500/40 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-black text-slate-900 dark:text-white text-xs truncate">{batch.fileName}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                              {batch.totalCount} Students
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            Imported: {new Date(batch.timestamp).toLocaleString()} • Retained for 30 Days
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedBatchPreview(batch)}
                            className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 cursor-pointer flex items-center gap-1"
                          >
                            <Eye size={11} /> Preview
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUndoBatch(batch)}
                            disabled={undoingBatchId === batch.batchId}
                            className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                          >
                            {undoingBatchId === batch.batchId ? (
                              <RefreshCw size={11} className="animate-spin" />
                            ) : (
                              <RotateCcw size={11} />
                            )}
                            <span>Undo Import</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-black">
            <ShieldCheck size={15} />
            <span className="text-[11px]">Admin Privileged Ingestion Mode</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 sm:py-1.5 rounded-xl font-extrabold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const nameDisplay = formData.studentName.trim() || 'Direct Ingested Student';
                setConfirmModalConfig({
                  isOpen: true,
                  type: 'warning',
                  title: 'Express Direct Record Entry',
                  message: `Commit new student record for "${nameDisplay}" directly into School Database?`,
                  consequence: 'This record will be written to the official School Database with Approved status and will instantly appear at the top of the Admin table.',
                  confirmText: '⚡ Confirm & Save Record',
                  cancelText: 'Cancel',
                  onConfirm: async ({ reasonCategory, customReason } = {}) => {
                    setConfirmModalConfig(null);
                    setFormData(prev => ({ ...prev, _reasonCategory: reasonCategory, _customReason: customReason }));
                    await handleSubmit(true);
                  }
                });
              }}
              className="px-3.5 py-2 sm:py-1.5 rounded-xl font-extrabold text-xs text-amber-900 dark:text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 cursor-pointer transition-all flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <PlusCircle size={13} />}
              <span>Save & Add Another</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const nameDisplay = formData.studentName.trim() || 'Direct Ingested Student';
                setConfirmModalConfig({
                  isOpen: true,
                  type: 'warning',
                  title: 'Express Direct Record Entry',
                  message: `Commit new student record for "${nameDisplay}" directly into School Database?`,
                  consequence: 'This record will be authorized and committed to master registers and active table views.',
                  confirmText: '⚡ Confirm & Save Record',
                  cancelText: 'Cancel',
                  onConfirm: async ({ reasonCategory, customReason } = {}) => {
                    setConfirmModalConfig(null);
                    setFormData(prev => ({ ...prev, _reasonCategory: reasonCategory, _customReason: customReason }));
                    await handleSubmit(false);
                  }
                });
              }}
              className="px-4 py-2 sm:py-1.5 rounded-xl font-black text-xs text-white bg-amber-700 hover:bg-amber-600 shadow-md cursor-pointer transition-all flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save & Close</span>
            </button>
          </div>
        </div>

        {/* Reusable Custom Confirmation Modal inside Ingestion Modal */}
        {confirmModalConfig && (
          <ConfirmDialogModal
            {...confirmModalConfig}
            onClose={() => setConfirmModalConfig(null)}
          />
        )}

        {/* Spreadsheet Batch Preview Modal */}
        {selectedBatchPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-4xl w-full max-h-[85vh] flex flex-col space-y-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      Spreadsheet Import Preview: {selectedBatchPreview.fileName}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      {selectedBatchPreview.totalCount} Imported Student Records • {new Date(selectedBatchPreview.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBatchPreview(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-black sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Form No.</th>
                      <th className="p-2.5">Class Roll</th>
                      <th className="p-2.5">Student Name</th>
                      <th className="p-2.5">Father Name</th>
                      <th className="p-2.5">Class</th>
                      <th className="p-2.5">Stream</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-bold">
                    {(selectedBatchPreview.importedRecords || []).map((st, i) => (
                      <tr key={st.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-950">
                        <td className="p-2.5 font-mono text-slate-400">{i + 1}</td>
                        <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400">{st.formNo || st['Form No.'] || '—'}</td>
                        <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">{st.classRollNo || st['Class Roll No'] || '—'}</td>
                        <td className="p-2.5 font-black text-slate-900 dark:text-white">{st.studentName || st["Student's Name (as per school records)"] || '—'}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{st.fatherName || st["Father's/Guardian's Name (as per school records)"] || '—'}</td>
                        <td className="p-2.5">{st.class || st['Class'] || '—'}</td>
                        <td className="p-2.5">{st.stream || st['Stream'] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const b = selectedBatchPreview;
                    setSelectedBatchPreview(null);
                    handleUndoBatch(b);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Undo & Rollback Entire Import ({selectedBatchPreview.totalCount} Records)
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedBatchPreview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 100% INTERACTIVE WORKFLOW PREVIEW & EDIT MODAL ════════ */}
        {showWorkflowPreviewModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-emerald-500/50 rounded-3xl p-4 sm:p-6 max-w-6xl w-full max-h-[92vh] flex flex-col space-y-3.5 shadow-2xl">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-black shadow-xs">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                      Interactive Workflow Preview & Edit Table
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                        Target DB: admissions
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                      Source: <strong>{sourceTypeLabel}</strong> • {parsedWorkflowRows.length} Total Extracted Records • {parsedWorkflowRows.filter(r => r.photoFile).length} Photos Correlated
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWorkflowPreviewModal(false)}
                  className="p-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-xs transition-transform hover:scale-110 cursor-pointer"
                >
                  <X size={18} strokeWidth={3} />
                </button>
              </div>

              {/* Overwrite Warning Banner */}
              {overwriteWarningNotice && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-black flex items-center justify-between gap-2 shadow-2xs animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    <span>{overwriteWarningNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOverwriteWarningNotice(null)}
                    className="p-1 hover:bg-amber-500/20 rounded cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Action Toolbar with Search Filter */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const hasDuplicates = parsedWorkflowRows.some(r => r.isDuplicate);
                      if (hasDuplicates) {
                        setOverwriteWarningNotice('⚠️ Notice: Selecting all rows includes existing students in the database. Their earlier records will be overwritten.');
                      }
                      setParsedWorkflowRows(prev => prev.map(r => ({ ...r, selected: true })));
                    }}
                    className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 text-[10.5px] font-black cursor-pointer shadow-2xs"
                  >
                    Select All ({parsedWorkflowRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedWorkflowRows(prev => prev.map(r => ({ ...r, selected: false })));
                      setOverwriteWarningNotice(null);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 hover:bg-rose-200 text-[10.5px] font-black cursor-pointer shadow-2xs"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedWorkflowRows(prev => prev.map(r => ({ ...r, selected: !r.isDuplicate })));
                      setOverwriteWarningNotice(null);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 hover:bg-sky-200 text-[10.5px] font-black cursor-pointer shadow-2xs"
                    title="Select only genuine new students"
                  >
                    Select New Only ({parsedWorkflowRows.filter(r => !r.isDuplicate).length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={previewSearchQuery}
                    onChange={(e) => setPreviewSearchQuery(e.target.value)}
                    placeholder="Search candidate name, reg no, form no..."
                    className="px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold w-48 sm:w-64 focus:ring-1 focus:ring-emerald-500"
                  />
                  <label className="px-3 py-1 rounded-xl text-[10.5px] font-black text-sky-900 dark:text-sky-200 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 cursor-pointer flex items-center gap-1">
                    <Camera size={12} />
                    <span>{bulkPhotoFiles.length > 0 ? `${bulkPhotoFiles.length} Photos` : 'Attach Photos'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleSelectBulkPhotoFolder}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Parsed Rows Editable Data Table */}
              <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 max-h-[55vh]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-black sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                    <tr>
                      <th className="p-2 w-10 text-center">Inc</th>
                      <th className="p-2 w-12">S.No</th>
                      <th className="p-2">Form No. / Reg No.</th>
                      <th className="p-2">Student Name (Editable)</th>
                      <th className="p-2">Father Name (Editable)</th>
                      <th className="p-2">Class / Stream</th>
                      <th className="p-2">Database Match Status</th>
                      <th className="p-2">Photo</th>
                      <th className="p-2 w-10 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-bold">
                    {parsedWorkflowRows
                      .map((r, actualIdx) => ({ ...r, _actualIdx: actualIdx }))
                      .filter(r => {
                        if (!previewSearchQuery.trim()) return true;
                        const q = previewSearchQuery.toLowerCase();
                        return (
                          String(r.studentName || '').toLowerCase().includes(q) ||
                          String(r.fatherName || '').toLowerCase().includes(q) ||
                          String(r.formNo || '').toLowerCase().includes(q) ||
                          String(r.boardRegNo || '').toLowerCase().includes(q) ||
                          String(r.class || '').toLowerCase().includes(q)
                        );
                      })
                      .map((r) => (
                        <tr
                          key={r._actualIdx}
                          className={`transition-colors ${
                            r.selected
                              ? r.isDuplicate ? 'bg-amber-500/10 dark:bg-amber-950/30 hover:bg-amber-500/15' : 'bg-emerald-500/5 dark:bg-emerald-950/20 hover:bg-emerald-500/10'
                              : 'bg-slate-50/50 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const willBeSelected = !r.selected;
                                if (willBeSelected && r.isDuplicate) {
                                  setOverwriteWarningNotice(`⚠️ Warning: Student "${r.studentName}" (Reg: ${r.boardRegNo || r.formNo}, Class: ${r.class}, Session: ${r.session}) already exists in the database. Earlier data will be OVERWRITTEN.`);
                                }
                                setParsedWorkflowRows(prev => prev.map((item, i) => i === r._actualIdx ? { ...item, selected: willBeSelected } : item));
                              }}
                              className="cursor-pointer text-emerald-600"
                            >
                              {r.selected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-400" />}
                            </button>
                          </td>
                          <td className="p-2 font-mono text-slate-400">#{r.sno}</td>
                          <td className="p-2 font-mono">
                            <div className="font-black text-indigo-600 dark:text-indigo-400">{r.formNo}</div>
                            <input
                              type="text"
                              value={r.boardRegNo || ''}
                              placeholder="Reg No..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedWorkflowRows(prev => prev.map((item, i) => i === r._actualIdx ? { ...item, boardRegNo: val } : item));
                              }}
                              className="text-[10px] text-slate-700 dark:text-slate-300 font-mono px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-transparent w-28 focus:bg-white"
                            />
                          </td>
                          <td className="p-2 font-black text-slate-900 dark:text-white">
                            <input
                              type="text"
                              value={r.studentName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedWorkflowRows(prev => prev.map((item, i) => i === r._actualIdx ? { ...item, studentName: val } : item));
                              }}
                              className="w-full px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-transparent font-black text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800"
                            />
                            {r.fatherAadhar && <div className="text-[10px] text-slate-400 font-mono font-normal">Father Aadhaar: {r.fatherAadhar}</div>}
                          </td>
                          <td className="p-2 text-slate-600 dark:text-slate-400">
                            <input
                              type="text"
                              value={r.fatherName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setParsedWorkflowRows(prev => prev.map((item, i) => i === r._actualIdx ? { ...item, fatherName: val } : item));
                              }}
                              className="w-full px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-800"
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {r.class}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                {r.stream}
                              </span>
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-mono mt-0.5">{r.session}</div>
                          </td>
                          <td className="p-2">
                            {r.isDuplicate ? (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                <AlertTriangle size={10} /> In Database (Update)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                                <Sparkles size={10} /> ⚡ New Admission
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {r.photoFile ? (
                              <div className="flex items-center gap-1.5">
                                {r.photoPreviewUrl && (
                                  <img src={r.photoPreviewUrl} alt="Thumb" className="w-6 h-7 rounded object-cover border border-slate-300 shrink-0" />
                                )}
                                <span className="px-1 py-0.5 rounded text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 truncate max-w-[130px]">
                                  📷 {r.photoMatchLabel}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-normal">No photo</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setParsedWorkflowRows(prev => prev.filter((_, i) => i !== r._actualIdx));
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                              title="Remove row from preview"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Confirmation Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck size={16} />
                  <span>Target Database: Cloud Firestore <code>admissions</code> collection • 30-Day Auto Rollback Support</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowWorkflowPreviewModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={ingestingWorkflow || parsedWorkflowRows.filter(r => r.selected).length === 0}
                    onClick={handleConfirmWorkflowIngestion}
                    className="px-5 py-2 rounded-xl text-xs font-black text-white bg-emerald-700 hover:bg-emerald-600 shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {ingestingWorkflow ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>Confirm & Ingest {parsedWorkflowRows.filter(r => r.selected).length} Records to Admissions</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
