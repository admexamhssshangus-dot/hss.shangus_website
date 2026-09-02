// =================================================================
// HSS SHANGUS — Custom Student List & Document Builder Suite
// =================================================================
// A high-density split-screen administrative workspace:
// Left Side (Compact, single-screen fit): Document setup, 5-col cohort filters, 3-col column matrix
// Right Side (Dedicated scrollable canvas): Sticky live letterhead preview & 1-click exports
// =================================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Printer, FileText, FileSpreadsheet, Download, Plus, Minus, Trash2,
  Sliders, CheckSquare, Square, Eye, Layers, Sparkles,
  Settings2, RefreshCw, X, UserCheck, BookOpen, User,
  ChevronDown, ChevronUp, ArrowLeft, ArrowRight, GripVertical,
  ArrowUpDown, ArrowUp, ArrowDown, Edit3, Save, RotateCcw, Check, Bookmark, Award,
  Calculator, IndianRupee, FlaskConical, CheckCircle2, Cloud, Info, Zap
} from 'lucide-react';
import { generateCustomRosterDocx } from '../../utils/customRosterDocxGenerator';
import {
  printCustomRosterTable,
  exportCustomRosterExcel,
  exportCustomRosterCsv
} from '../../utils/customRosterExportUtils';
import { getStudentPhotoUrl, formatPhotoDisplayUrl } from '../../utils/imageCompressor';
import { getCachedCollection, getCachedCollectionSync, getPhotoUrlFromCache, resolveStudentPhoto, fetchStudentPhotoOnDemand } from '../../services/dbCache';
import { getStudentRegIndex, lookupStudentByRegSync } from '../../services/studentIndexService';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toTitleCase } from '../../utils/textFormatting';
import {
  getAssignedClassRollNumber,
  resolveStudentAdmissionStatus
} from '../../utils/studentApprovalStatus';
import TabLoadingOverlay from '../../components/TabLoadingOverlay';
import { scheduleIdleWork } from '../../utils/scheduleIdleWork';

// Standard Database Columns Grouped by Category (Primary core fields vs Advanced extended fields)
const DB_COLUMN_GROUPS = [
  {
    category: 'Core Identity',
    icon: UserCheck,
    columns: [
      { key: 'sno', label: 'S.No.', defaultSelected: true, defaultWidthPct: 5, align: 'center', isPrimary: true },
      { key: 'studentPhoto', label: 'Photo', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: true },
      { key: 'classRollNo', label: 'R.No.', defaultSelected: true, defaultWidthPct: 7, align: 'center', isPrimary: true },
      { key: 'boardRegNo', label: 'Reg. No.', defaultSelected: true, defaultWidthPct: 13, align: 'left', isPrimary: true },
      { key: 'studentName', label: "Student's Name", defaultSelected: true, defaultWidthPct: 18, align: 'left', isPrimary: true },
      { key: 'parentage', label: 'Parentage (F/M)', defaultSelected: false, defaultWidthPct: 18, align: 'left', isPrimary: true },
      { key: 'fatherName', label: "Father's Name", defaultSelected: true, defaultWidthPct: 16, align: 'left', isPrimary: true },
      { key: 'motherName', label: "Mother's Name", defaultSelected: false, defaultWidthPct: 16, align: 'left', isPrimary: true },
      { key: 'admNo', label: 'Adm. No.', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: false },
      { key: 'formNo', label: 'Form No.', defaultSelected: false, defaultWidthPct: 9, align: 'center', isPrimary: false },
      { key: 'gender', label: 'Gender', defaultSelected: false, defaultWidthPct: 6, align: 'center', isPrimary: false },
      { key: 'dob', label: 'DOB', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'bloodGroup', label: 'Blood Group', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: false },
      { key: 'religion', label: 'Religion', defaultSelected: false, defaultWidthPct: 9, align: 'center', isPrimary: false },
    ]
  },
  {
    category: 'Academic Details',
    icon: BookOpen,
    columns: [
      { key: 'className', label: 'Class', defaultSelected: false, defaultWidthPct: 7, align: 'center', isPrimary: true },
      { key: 'session', label: 'Session', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: true },
      { key: 'stream', label: 'Stream', defaultSelected: true, defaultWidthPct: 12, align: 'center', isPrimary: true },
      { key: 'subjects', label: 'Stream & Subjects', defaultSelected: true, defaultWidthPct: 24, align: 'left', isPrimary: true },
      { key: 'status', label: 'Status', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: false },
      { key: 'admissionType', label: 'Admission Type', defaultSelected: false, defaultWidthPct: 10, align: 'left', isPrimary: false },
      { key: 'prevSchool', label: 'Previous School', defaultSelected: false, defaultWidthPct: 18, align: 'left', isPrimary: false },
      { key: 'prevMarks', label: '10th/11th Marks', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'prevRollNo', label: 'Previous Roll No.', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'prevYear', label: 'Passing Year', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: false },
    ]
  },
  {
    category: 'Contact & IDs',
    icon: User,
    columns: [
      { key: 'mobile', label: 'Mobile No.', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: true },
      { key: 'parentMobile', label: "Parent's Mobile", defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'email', label: 'Email', defaultSelected: false, defaultWidthPct: 14, align: 'left', isPrimary: false },
      { key: 'village', label: 'Village / Address', defaultSelected: false, defaultWidthPct: 14, align: 'left', isPrimary: true },
      { key: 'tehsil', label: 'Tehsil', defaultSelected: false, defaultWidthPct: 10, align: 'left', isPrimary: false },
      { key: 'district', label: 'District', defaultSelected: false, defaultWidthPct: 10, align: 'left', isPrimary: false },
      { key: 'pincode', label: 'PIN Code', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: false },
      { key: 'aadhaarNo', label: 'Aadhaar No.', defaultSelected: false, defaultWidthPct: 12, align: 'center', isPrimary: true },
      { key: 'pen', label: 'PEN No.', defaultSelected: false, defaultWidthPct: 12, align: 'center', isPrimary: false },
      { key: 'category', label: 'Category', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: true },
      { key: 'socioCategory', label: 'Socio Category', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'disability', label: 'Disability Status', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'bankAccount', label: 'Bank Acc No.', defaultSelected: false, defaultWidthPct: 14, align: 'center', isPrimary: false },
      { key: 'bankName', label: 'Bank Name', defaultSelected: false, defaultWidthPct: 14, align: 'left', isPrimary: false },
      { key: 'ifsc', label: 'IFSC Code', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
    ]
  }
];

// Flat lookup of all registered standard database columns
export const ALL_REGISTERED_COLUMNS = DB_COLUMN_GROUPS.flatMap(g => g.columns);
export const ALL_DB_COLUMNS = ALL_REGISTERED_COLUMNS;

// Default HSS Shangus Practical / Lab Chargeable Subjects
export const DEFAULT_CHARGEABLE_SUBJECTS = [
  'Physics',
  'Chemistry',
  'Biology',
  'Environmental Science',
  'Physical Education',
  'IT and ITES',
  'Healthcare',
  'Computer Science',
  'Geography',
  'Tourism'
];

// Pure Evaluator for Dynamic and Fixed Custom Column Values
export function evaluateCustomColumnValue(col, st) {
  if (!col || !col.isCustom) return '';

  const calcType = col.calcType || 'fixed';

  if (calcType === 'fixed') {
    return col.defaultValue !== undefined ? col.defaultValue : '';
  }

  const sClass = extractClass(st);
  const sStream = extractStream(st);
  const sStatus = resolveStudentStatus(st);

  // 1. Dynamic Value by Class
  if (calcType === 'class_map') {
    const rules = col.classRules || {};
    const norm = sClass.toLowerCase();
    for (const [k, v] of Object.entries(rules)) {
      if (norm.includes(k.toLowerCase()) && v !== undefined && String(v).trim() !== '') {
        return col.prefixCurrency !== false ? `₹${v}` : String(v);
      }
    }
    return col.defaultValue ? (col.prefixCurrency !== false && !String(col.defaultValue).startsWith('₹') ? `₹${col.defaultValue}` : col.defaultValue) : '';
  }

  // 2. Dynamic Value by Stream
  if (calcType === 'stream_map') {
    const rules = col.streamRules || {};
    const norm = sStream.toLowerCase();
    for (const [k, v] of Object.entries(rules)) {
      if (norm.includes(k.toLowerCase()) && v !== undefined && String(v).trim() !== '') {
        return col.prefixCurrency !== false ? `₹${v}` : String(v);
      }
    }
    return col.defaultValue ? (col.prefixCurrency !== false && !String(col.defaultValue).startsWith('₹') ? `₹${col.defaultValue}` : col.defaultValue) : '';
  }

  // 3. Dynamic Value by Status
  if (calcType === 'status_map') {
    const rules = col.statusRules || {};
    const norm = sStatus.toLowerCase();
    for (const [k, v] of Object.entries(rules)) {
      if (norm.includes(k.toLowerCase()) && v !== undefined && String(v).trim() !== '') {
        return col.prefixCurrency !== false ? `₹${v}` : String(v);
      }
    }
    return col.defaultValue ? (col.prefixCurrency !== false && !String(col.defaultValue).startsWith('₹') ? `₹${col.defaultValue}` : col.defaultValue) : '';
  }

  // 4. Special Dynamic Fee with Subject Surcharges (Base Fee + ₹100 per Lab/Practical Subject)
  if (calcType === 'fee_with_subject_surcharge') {
    // Detect student's exact subject count (5 vs 6 subjects)
    const studentSubjs = extractSubjects(st, false);
    const subList = studentSubjs && studentSubjs !== '—'
      ? studentSubjs.split(/[,+;]/).map(s => s.trim()).filter(Boolean)
      : [];
    const is6Subjects = subList.length >= 6;

    // Determine Base Fee (by class if configured, with distinct 5-subject vs 6-subject rates)
    let base = Number(col.baseFee || 0);
    const targetClassBaseFees = (is6Subjects && col.classBaseFees6Subs && typeof col.classBaseFees6Subs === 'object')
      ? col.classBaseFees6Subs
      : (col.classBaseFees && typeof col.classBaseFees === 'object' ? col.classBaseFees : null);

    if (targetClassBaseFees) {
      const normClass = sClass.toLowerCase();
      for (const [k, v] of Object.entries(targetClassBaseFees)) {
        if (normClass.includes(k.toLowerCase()) && !isNaN(Number(v)) && String(v).trim() !== '') {
          base = Number(v);
          break;
        }
      }
    } else if (col.classBaseFees && typeof col.classBaseFees === 'object') {
      const normClass = sClass.toLowerCase();
      for (const [k, v] of Object.entries(col.classBaseFees)) {
        if (normClass.includes(k.toLowerCase()) && !isNaN(Number(v)) && String(v).trim() !== '') {
          base = Number(v);
          break;
        }
      }
    }

    // Count Chargeable / Practical Surcharge Subjects
    const surchargeRate = Number(col.subjectSurcharge !== undefined ? col.subjectSurcharge : 100);
    const surchargeList = Array.isArray(col.chargeableSubjects) && col.chargeableSubjects.length > 0
      ? col.chargeableSubjects
      : DEFAULT_CHARGEABLE_SUBJECTS;

    const rawSubjStr = extractSubjects(st, false).toLowerCase();
    let matchingCount = 0;

    surchargeList.forEach(subName => {
      const normSub = String(subName).trim().toLowerCase();
      if (!normSub) return;

      let isMatch = false;
      if (normSub.includes('physics') && rawSubjStr.includes('physics')) isMatch = true;
      else if (normSub.includes('chemistry') && rawSubjStr.includes('chemistry')) isMatch = true;
      else if (normSub.includes('biology') && rawSubjStr.includes('biology')) isMatch = true;
      else if ((normSub.includes('environmental') || normSub === 'evs' || normSub === 'es') && (rawSubjStr.includes('environmental') || rawSubjStr.includes('evs'))) isMatch = true;
      else if ((normSub.includes('physical') || normSub.includes('ped') || normSub.includes('pes')) && (rawSubjStr.includes('physical education') || rawSubjStr.includes('sports') || rawSubjStr.includes('ped'))) isMatch = true;
      else if ((normSub.includes('it') || normSub.includes('ites')) && (rawSubjStr.includes('it and ites') || rawSubjStr.includes('information technology') || rawSubjStr.includes('ites') || rawSubjStr.includes('it & ites'))) isMatch = true;
      else if (normSub.includes('healthcare') && rawSubjStr.includes('healthcare')) isMatch = true;
      else if (normSub.includes('computer') && (rawSubjStr.includes('computer') || rawSubjStr.includes('c.s') || rawSubjStr.includes('ip'))) isMatch = true;
      else if (normSub.includes('geography') && rawSubjStr.includes('geography')) isMatch = true;
      else if (normSub.includes('tourism') && rawSubjStr.includes('tourism')) isMatch = true;
      else if (rawSubjStr.includes(normSub)) isMatch = true;

      if (isMatch) {
        matchingCount += 1;
      }
    });

    const totalFee = base + (matchingCount * surchargeRate);
    const symbol = col.prefixCurrency !== false ? '₹' : '';

    if (col.showBreakdown && matchingCount > 0) {
      return `${symbol}${totalFee} (${base}+${matchingCount * surchargeRate})`;
    }

    return `${symbol}${totalFee}`;
  }

  return col.defaultValue || '';
}

// Quick Custom Column Templates
const QUICK_CUSTOM_TEMPLATES = [
  {
    name: 'RR & Exam Fee',
    calcType: 'fee_with_subject_surcharge',
    baseFee: 1550,
    classBaseFees: { '11th': 1520, '12th': 1560, '10th': 1550, '9th': 1550 },
    classBaseFees6Subs: { '11th': 1760, '12th': 1800, '10th': 1850, '9th': 1850 },
    subjectSurcharge: 100,
    chargeableSubjects: ['Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Physical Education'],
    prefixCurrency: true,
    widthPct: 12,
    align: 'center'
  },
  {
    name: 'Lab / Practical Fee',
    calcType: 'fee_with_subject_surcharge',
    baseFee: 0,
    subjectSurcharge: 100,
    chargeableSubjects: ['Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Physical Education', 'IT and ITES', 'Healthcare'],
    prefixCurrency: true,
    widthPct: 11,
    align: 'center'
  },
  {
    name: 'Admission Fee (Class-Wise)',
    calcType: 'class_map',
    classRules: { '11th': '1750', '12th': '1900', '10th': '1200', '9th': '800' },
    defaultValue: '1500',
    prefixCurrency: true,
    widthPct: 11,
    align: 'center'
  },
  {
    name: 'Stream Fee',
    calcType: 'stream_map',
    streamRules: { 'Science': '500', 'Humanities': '300', 'Commerce': '300', 'General': '200' },
    defaultValue: '300',
    prefixCurrency: true,
    widthPct: 10,
    align: 'center'
  },
  {
    name: 'Student Signature',
    calcType: 'fixed',
    defaultValue: '',
    widthPct: 15,
    align: 'center'
  },
  {
    name: 'Parent Signature',
    calcType: 'fixed',
    defaultValue: '',
    widthPct: 15,
    align: 'center'
  },
  {
    name: 'Receipt No.',
    calcType: 'fixed',
    defaultValue: '',
    widthPct: 10,
    align: 'center'
  },
  {
    name: 'Remarks',
    calcType: 'fixed',
    defaultValue: '',
    widthPct: 12,
    align: 'left'
  }
];

// Row Height Presets
const ROW_HEIGHT_PRESETS = [
  { label: 'Compact (26px)', px: 26, dxa: 300, desc: 'Max rows' },
  { label: 'Standard (36px)', px: 36, dxa: 450, desc: 'Balanced' },
  { label: 'Signature (52px)', px: 52, dxa: 650, desc: 'Pen signatures & notes' },
  { label: 'Spacious (68px)', px: 68, dxa: 850, desc: 'Extra handwriting space' }
];

// ─── Global Helper to extract authentic Class Roll No across all database keys ───
export function getStudentRollNumber(st) {
  return getAssignedClassRollNumber(st);
}

// ─── Global Helper to resolve canonical student status (Assigned Roll = Approved) ───
export function resolveStudentStatus(st) {
  return resolveStudentAdmissionStatus(st);
}

// ─── Extractors for Raw Database Documents ───
export function extractStudentName(st) {
  if (!st) return '—';
  const keys = [
    "Student's Name (as per school records)", "Student's Name", "Student Name",
    "Candidate Name", "Name of the Student", "Full Name", "studentName", "name",
    "Account Name", "Applicant Name"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return toTitleCase(String(st[k]).trim());
    }
  }
  return '—';
}

export function extractFatherName(st) {
  if (!st) return '—';
  const keys = [
    "Father's/Guardian's Name (as per school records)", "Father's Name", "Father Name",
    "Father's / Guardian's Name", "fatherName", "parentName", "Guardian Name"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return toTitleCase(String(st[k]).trim());
    }
  }
  return '—';
}

export function extractMotherName(st) {
  if (!st) return '—';
  const keys = [
    "Mother's Name (as per school records)", "Mother's Name", "Mother Name",
    "motherName"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return toTitleCase(String(st[k]).trim());
    }
  }
  return '—';
}

export const isPlaceholderRegNo = (val) => {
  if (val === null || val === undefined) return true;
  const s = String(val).trim();
  if (!s) return true;
  return /^(0|na|n\/a|#n\/a|nil|null|undefined|—|-|none|not receive yet|not received|not received yet|home exam)$/i.test(s);
};

export const cleanRegNoVal = (val) => {
  if (isPlaceholderRegNo(val)) return '';
  let s = String(val).trim();

  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
    try {
      const num = Number(s);
      if (!isNaN(num) && num > 0 && typeof window !== 'undefined' && typeof window.BigInt === 'function') {
        s = window.BigInt(Math.round(num)).toString();
      } else {
        const match = s.match(/^([+-]?\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
        if (match) {
          let intPart = match[1];
          let decPart = match[2] || '';
          let exponent = parseInt(match[3], 10);
          if (exponent > 0) {
            s = decPart.length <= exponent ? intPart + decPart + '0'.repeat(exponent - decPart.length) : intPart + decPart.slice(0, exponent) + '.' + decPart.slice(exponent);
          }
        }
      }
    } catch (_) { }
  }

  return s.replace(/\.0+$/, '');
};

export function extractBoardRegNo(st) {
  if (!st) return '—';
  const explicitKeys = [
    "Board Registration No. (Class 10th)",
    "Board Registration No. (Class 11th)",
    "Board Registration No. (Class 12th)",
    "Registration No. (allotted by JKBOSE)",
    "Board Registration Number",
    "Board Registration No.",
    "Board Registration No",
    "Board Reg. No.",
    "Board Reg No",
    "Registration Number",
    "Registration No.",
    "Registration No",
    "Reg. No.",
    "Reg. No",
    "Reg No.",
    "Reg No",
    "REG. NO.",
    "REG NO",
    "DIET Registration No.",
    "DIET/Board Reg. No.",
    "DIET Reg. No.",
    "boardRegNo",
    "regNo",
    "registrationNo",
    "Reg_No",
    "registration_no"
  ];

  for (const k of explicitKeys) {
    if (st[k] !== undefined && st[k] !== null) {
      const cleaned = cleanRegNoVal(st[k]);
      if (cleaned && cleaned !== '—') {
        return cleaned;
      }
    }
  }

  // Dynamic fallback scan for any field containing registration info
  for (const [k, v] of Object.entries(st)) {
    if (v !== undefined && v !== null) {
      const lowerKey = k.toLowerCase();
      if ((lowerKey.includes('reg') && lowerKey.includes('no')) || lowerKey.includes('registration')) {
        const cleaned = cleanRegNoVal(v);
        if (cleaned && cleaned !== '—') {
          return cleaned;
        }
      }
    }
  }

  return '—';
}

export function extractAdmNo(st) {
  if (!st) return '—';
  const keys = [
    "Admission Number", "Adm. No.", "Adm No.", "Adm No", "Admission No.", "Admission No",
    "admNo", "admissionNo", "Adm_No"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractClass(st) {
  if (!st) return '';
  const keys = [
    "Admission sought for class", "Class", "class", "className", "Class Name",
    "admittedClass", "enrolledClass"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      let val = String(st[k]).trim();
      const lower = val.toLowerCase();
      if (lower.includes('12') || lower.includes('xii')) return '12th';
      if (lower.includes('11') || lower.includes('xi')) return '11th';
      if (lower.includes('10') || lower.includes('x')) return '10th';
      if (lower.includes('9') || lower.includes('ix')) return '9th';
      return val;
    }
  }
  return '';
}

/**
 * Standardize and flatten student records from masterRegisters chunk/group documents into standard student objects.
 * Handles chunk_001..chunk_123, groupKey documents, and individual student documents.
 * @param {Array<object>} masterDocs - Raw documents from Firestore masterRegisters collection
 * @returns {Array<object>} Flat array of normalized student records
 */
export function unpackMasterRegisterStudents(masterDocs = []) {
  const flatList = [];
  if (!Array.isArray(masterDocs)) return flatList;

  masterDocs.forEach(m => {
    if (!m) return;
    const chunkItems = m.items || m.students || m.records || m.data;
    const docId = m.id || '';
    const groupKey = m.groupKey || '';
    
    // Extract document-level fallback session, class, stream metadata
    let docSession = m.Session || m.session || m['Academic Session'] || m['academicSession'] || '';
    if (!docSession) {
      if (groupKey) docSession = groupKey.split('_')[0];
      else if (docId.startsWith('part_')) {
        const parts = docId.replace(/^part_/, '').split('_');
        docSession = parts[0];
      }
    }
    const docClass = m.class || m.Class || m.className || m['Class'] || (groupKey ? groupKey.split('_')[1] : '') || '';
    const docStream = m.stream || m.Stream || m['Stream'] || (groupKey ? groupKey.split('_')[2] : '') || '';

    if (Array.isArray(chunkItems) && chunkItems.length > 0) {
      chunkItems.forEach((item, itemIdx) => {
        if (item && typeof item === 'object') {
          const itemSession = item.Session || item.session || item['Academic Session'] || item['academicSession'] || item['Session / Batch'] || item['Batch'] || docSession || '';
          const itemClass = item.Class || item.class || item['Class'] || item['Admission sought for class'] || docClass || '';
          const itemStream = item.Stream || item.stream || item['Stream'] || docStream || '';
          const itemId = item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'] || `${docId}_${itemIdx}`;

          flatList.push({
            ...item,
            id: itemId,
            Session: itemSession,
            session: itemSession,
            Class: itemClass,
            class: itemClass,
            Stream: itemStream,
            stream: itemStream,
            _source: 'masterRegisters',
            _srcCollection: 'masterRegisters',
            _parentDocId: docId
          });
        }
      });
    } else if (typeof m === 'object' && !chunkItems) {
      // Individual student document in masterRegisters
      const itemSession = m.Session || m.session || m['Academic Session'] || docSession || '';
      flatList.push({
        ...m,
        id: m.id || m['Form Number'] || m.formNo,
        Session: itemSession,
        session: itemSession,
        Class: docClass || m.Class || m.class,
        class: docClass || m.class || m.Class,
        Stream: docStream || m.Stream || m.stream,
        stream: docStream || m.stream || m.Stream,
        _source: 'masterRegisters',
        _srcCollection: 'masterRegisters'
      });
    }
  });

  return flatList;
}

export function extractSession(st) {
  if (!st) return '';
  const raw = st.raw || st;
  const keys = [
    "Session", "session", "Academic Session", "academicSession", "academic_session",
    "Session / Batch", "sessionBatch", "Batch", "batch",
    "Passing Year", "passingYear", "Year", "year", "sessionTag", "academic_year"
  ];
  for (const k of keys) {
    const valObj = raw[k] || st[k];
    if (valObj && String(valObj).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(valObj).trim())) {
      let val = String(valObj).trim();

      if (/^20\d{2}\s*[-/]\s*20\d{2}$/.test(val)) {
        const parts = val.split(/[-/]/).map(p => p.trim());
        val = `${parts[0]}-${parts[1].slice(-2)}`;
      }
      return val;
    }
  }

  // Check parentDocId or document ID or groupKey e.g. "2024-25_11th_Science" or "session_2024_25"
  const docRef = String(st.groupKey || st._parentDocId || st.id || '').toLowerCase();
  const yearMatch = docRef.match(/(202[0-9])[-_](202[0-9]|[0-9]{2})/);
  if (yearMatch) {
    const end = yearMatch[2].length === 4 ? yearMatch[2].slice(-2) : yearMatch[2];
    return `${yearMatch[1]}-${end}`;
  }

  // Fallback for masterRegisters records without explicit session field
  if (st._source === 'masterRegisters' || st._srcCollection === 'masterRegisters') {
    return '2024-25';
  }
  return '';
}

// ─── Comprehensive HSS Shangus Subject Abbreviation Dictionary ───
export function abbreviateSubjectName(subj) {
  if (!subj) return '';
  let s = String(subj).trim();
  if (!s || s === '—') return '';

  const clean = s.toLowerCase();

  // Vocational & Specialized School Subjects (Checked first to avoid partial word collisions)
  if (clean.includes('physical education & sports') || clean.includes('physical education and sports')) return 'PES';
  if (clean.includes('physical education') || clean.includes('physical edu') || clean === 'pd' || clean === 'phe' || clean === 'ped') return 'PD';
  if (clean.includes('it and ites') || clean.includes('it & ites') || clean.includes('it & ite') || clean.includes('it and ite') || clean.includes('information tech') || clean.includes('ites') || clean === 'ite') return 'ITE';
  if (clean.includes('information practice') || clean === 'ip') return 'IP';
  if (clean.includes('computer science') || clean === 'cs') return 'CS';
  if (clean.includes('healthcare') || clean.includes('health care') || clean.includes('health')) return 'HTC';
  if (clean.includes('tourism and hospitality') || clean.includes('travel, tourism') || clean.includes('tourism')) return 'TOU';
  if (clean.includes('retail')) return 'RET';
  if (clean.includes('security')) return 'SEC';
  if (clean.includes('agriculture')) return 'AGR';
  if (clean.includes('media and entertainment')) return 'MDE';
  if (clean.includes('beauty and wellness')) return 'BTW';
  if (clean.includes('telecommunication')) return 'TLC';

  // Core Academic Subjects
  if (clean.includes('general english') || clean.includes('functional english') || clean === 'english' || clean === 'eng' || clean === 'en') return 'GE';
  if (clean.includes('environmental science') || clean.includes('environmental education') || clean === 'evs' || clean === 'es') return 'ES';
  if (clean.includes('physics') || clean === 'phy') return 'PH';
  if (clean.includes('chemistry') || clean === 'chem') return 'CH';
  if (clean.includes('biology') || clean.includes('botany') || clean.includes('zoology') || clean === 'bio') return 'BI';
  if (clean.includes('mathematics') || clean.includes('maths') || clean === 'math') return 'MA';
  if (clean.includes('applied math')) return 'AM';
  if (clean.includes('business math')) return 'BM';
  if (clean.includes('political science') || clean.includes('political') || clean === 'pol sci' || clean === 'ps') return 'PS';
  if (clean.includes('history') || clean === 'hist' || clean === 'ht') return 'HT';
  if (clean.includes('education') || clean === 'edu' || clean === 'ed') return 'ED';
  if (clean.includes('sociology') || clean === 'socio' || clean === 'so') return 'SO';
  if (clean.includes('economics') || clean === 'eco' || clean === 'ec') return 'EC';
  if (clean.includes('urdu') || clean === 'ur') return 'UR';
  if (clean.includes('kashmiri') || clean === 'ka') return 'KA';
  if (clean.includes('arabic') || clean === 'ar') return 'AR';
  if (clean.includes('persian') || clean === 'pe') return 'PE';
  if (clean.includes('hindi') || clean === 'hi') return 'HI';
  if (clean.includes('punjabi') || clean === 'pu') return 'PU';
  if (clean.includes('geography') || clean === 'geog' || clean === 'gg') return 'GG';
  if (clean.includes('psychology') || clean === 'psych' || clean === 'py') return 'PY';
  if (clean.includes('philosophy') || clean === 'phil' || clean === 'pl') return 'PL';
  if (clean.includes('islamic studies') || clean.includes('islamic') || clean === 'is') return 'IS';
  if (clean.includes('vedic studies') || clean === 'vs') return 'VS';
  if (clean.includes('buddhist studies') || clean === 'bu') return 'BU';
  if (clean.includes('public administration') || clean === 'pub ad' || clean === 'pa') return 'PA';
  if (clean.includes('statistics') || clean === 'stats' || clean === 'ss') return 'SS';
  if (clean.includes('accountancy') || clean.includes('accounting') || clean === 'acc' || clean === 'ay') return 'AY';
  if (clean.includes('business studies') || clean === 'bst' || clean === 'bs') return 'BS';
  if (clean.includes('entrepreneurship') || clean === 'ep') return 'EP';
  if (clean.includes('geology') || clean === 'go') return 'GO';
  if (clean.includes('biotechnology') || clean === 'bt') return 'BT';
  if (clean.includes('bio-chemistry') || clean.includes('biochemistry') || clean === 'bc') return 'BC';
  if (clean.includes('microbiology') || clean === 'mb') return 'MB';
  if (clean.includes('electronics') || clean === 'et') return 'ET';
  if (clean.includes('home science') || clean === 'hs') return 'HS';
  if (clean.includes('social science') || clean.includes('social studies') || clean === 'sst') return 'SST';
  if (clean === 'science' || clean === 'sci') return 'SCI';

  return s;
}

export function extractStream(st) {
  if (!st) return 'General';
  
  const cls = extractClass(st);
  if (cls === '9th' || cls === '10th') {
    return 'General';
  }

  const rawKeys = [
    "Stream", "stream", "Stream for Class 11th", "Stream opted in Class 11th",
    "Stream & Subjects for Class 12th", "Stream / Faculty", "Faculty"
  ];

  let raw = '';
  for (const k of rawKeys) {
    if (st[k] && typeof st[k] === 'string' && st[k].trim() && !/^(—|N\/A|null|undefined)$/i.test(st[k].trim())) {
      const val = st[k].trim();
      if (!val.toLowerCase().includes('same as')) {
        raw = val;
        break;
      }
    }
  }

  const rawLower = (raw || '').toLowerCase();
  if (rawLower.includes('sci') || rawLower.includes('med')) return 'Science';
  if (rawLower.includes('hum') || rawLower.includes('art')) return 'Humanities';
  if (rawLower.includes('com')) return 'Commerce';
  if (rawLower.includes('gen')) return 'General';

  // If "Same as in class 11th" or empty, infer canonically from subjects
  const subjs = extractSubjects(st, false).toLowerCase();
  
  // Science subjects
  if (
    subjs.includes('physics') || subjs.includes('chemistry') || subjs.includes('biology') ||
    subjs.includes('botany') || subjs.includes('zoology') || subjs.includes('mathematics') ||
    subjs.includes('computer') || subjs.includes('information tech') || subjs.includes('biotech') ||
    subjs.includes('environmental science') || subjs.includes('evs')
  ) {
    return 'Science';
  }

  // Humanities subjects
  if (
    subjs.includes('political') || subjs.includes('history') || subjs.includes('education') ||
    subjs.includes('sociology') || subjs.includes('economics') || subjs.includes('urdu') ||
    subjs.includes('kashmiri') || subjs.includes('arabic') || subjs.includes('geography') ||
    subjs.includes('islamic') || subjs.includes('philosophy') || subjs.includes('psychology')
  ) {
    return 'Humanities';
  }

  if (cls === '11th' || cls === '12th') {
    return 'Humanities';
  }

  return 'General';
}

export function extractSubjects(st, useAbbr = true) {
  if (!st) return '—';
  
  const cls = extractClass(st);
  let rawList = [];

  // Determine class-specific subject keys strictly in order
  let keys = [];
  if (cls === '12th') {
    keys = [
      "Subjects to be taken in Class 12th",
      "Stream & Subjects for Class 12th",
      "Subjects Studied in Class 11th",
      "Subjects to be taken in Class 11th",
      "selectedSubjects", "Subjects", "subjects", "Subs", "subs",
      "streamDisplay", "subjectsShort"
    ];
  } else if (cls === '11th') {
    keys = [
      "Subjects to be taken in Class 11th",
      "Subjects Studied in Class 11th",
      "Stream & Subjects for Class 12th",
      "selectedSubjects", "Subjects", "subjects", "Subs", "subs",
      "streamDisplay", "subjectsShort"
    ];
  } else if (cls === '10th') {
    keys = [
      "Subjects to be taken in Class 10th",
      "Subjects in Class 10th",
      "Subjects Studied in Class 10th",
      "selectedSubjects_10th",
      "selectedSubjects", "Subjects", "subjects", "Subs", "subs",
      "streamDisplay", "subjectsShort"
    ];
  } else if (cls === '9th') {
    keys = [
      "Subjects to be taken in Class 9th",
      "Subjects in Class 9th",
      "Subjects Studied in Class 9th",
      "selectedSubjects_9th",
      "selectedSubjects", "Subjects", "subjects", "Subs", "subs",
      "streamDisplay", "subjectsShort"
    ];
  } else {
    keys = [
      "Subjects to be taken in Class 11th",
      "Subjects to be taken in Class 12th",
      "Stream & Subjects for Class 12th",
      "Subjects to be taken in Class 10th",
      "Subjects to be taken in Class 9th",
      "selectedSubjects", "Subjects", "subjects", "Subs", "subs",
      "streamDisplay", "subjectsShort"
    ];
  }

  for (const k of keys) {
    const val = st[k];
    if (Array.isArray(val) && val.length > 0) {
      const cleaned = val.filter(s => s && String(s).trim() !== '—').map(s => String(s).trim());
      if (cleaned.length > 0) {
        rawList = cleaned;
        break;
      }
    }
    if (typeof val === 'string' && val.trim() && !/^(—|N\/A|null|undefined)$/i.test(val.trim())) {
      if (!val.toLowerCase().includes('same as')) {
        rawList = val.split(/[,+;]/).map(s => s.trim()).filter(Boolean);
        break;
      }
    }
  }

  // Subjects1..6 individual keys fallback
  if (rawList.length === 0) {
    const subjKeys = [
      'Subjects1', 'Subjects2', 'Subjects3', 'Subjects4', 'Subjects5', 'Subjects6', 'Subject6',
      'subject1', 'subject2', 'subject3', 'subject4', 'subject5', 'subject6'
    ];
    subjKeys.forEach(k => {
      const val = st[k];
      if (val && typeof val === 'string' && val.trim() && val.trim() !== '—' && !rawList.includes(val.trim())) {
        rawList.push(val.trim());
      }
    });
  }

  // Check additional/vocational 6th subject keys
  const extraKeys = [
    "Vocational Subject", "Vocational / Additional Subject", "Additional Subject", "6th Subject",
    "Vocational", "vocationalSubject", "additionalSubject", "6thSubject", "Optional Subject"
  ];
  let extraSubj = '';
  for (const ek of extraKeys) {
    const v = st[ek];
    if (v && typeof v === 'string' && v.trim() && !/^(—|N\/A|null|undefined|none|no)$/i.test(v.trim())) {
      extraSubj = v.trim();
      break;
    }
  }

  // Special handling strictly for Class 9th & 10th
  if (cls === '9th' || cls === '10th') {
    // 1. Determine Language Subject (Urdu or Hindi or Kashmiri or Arabic)
    let lang = 'Urdu';
    const langStr = String(
      st['Language Subject'] || st['1st Language'] || st['First Language'] || st['Language'] || st['Mother Tongue'] || ''
    ).toLowerCase();
    if (langStr.includes('hindi') || rawList.some(s => s.toLowerCase().includes('hindi'))) {
      lang = 'Hindi';
    } else if (langStr.includes('kashmiri') || rawList.some(s => s.toLowerCase().includes('kashmiri'))) {
      lang = 'Kashmiri';
    } else if (langStr.includes('arabic') || rawList.some(s => s.toLowerCase().includes('arabic'))) {
      lang = 'Arabic';
    }

    // 2. Identify if student has a 6th / Vocational / Additional subject
    const vocMatch = rawList.find(s => {
      const l = s.toLowerCase();
      if (l.includes('english') || l.includes('urdu') || l.includes('hindi') || l.includes('kashmiri') ||
          l.includes('arabic') || l.includes('math') || l.includes('science') || l.includes('social')) {
        return false;
      }
      return l.includes('it') || l.includes('physical') || l.includes('retail') || l.includes('tour') ||
             l.includes('health') || l.includes('agri') || l.includes('sec') || l.includes('beauty') ||
             l.includes('auto') || l.includes('comp') || l.includes('plumb') || l.includes('voc');
    });

    const active6th = extraSubj || vocMatch || '';

    // 3. For 9th & 10th, the 5 compulsory core subjects MUST ALWAYS BE:
    // General English, Urdu (or Hindi), Mathematics, Science, Social Science
    const canonicalList = [
      'General English',
      lang,
      'Mathematics',
      'Science',
      'Social Science'
    ];

    // 4. If student has opted for a 6th / Vocational subject, append it (Result = 6 subjects)
    if (active6th) {
      canonicalList.push(active6th);
    }

    // 5. Append any other non-core distinct subject from rawList if present
    rawList.forEach(s => {
      const l = s.toLowerCase();
      const isCore = l.includes('english') || l.includes('urdu') || l.includes('hindi') ||
                    l.includes('kashmiri') || l.includes('arabic') || l.includes('math') ||
                    l.includes('social') || (l === 'science' || l === 'sci' || l === 'gen science');
      if (!isCore && !canonicalList.some(c => c.toLowerCase() === l)) {
        canonicalList.push(s);
      }
    });

    rawList = canonicalList;
  } else {
    // For Class 11th, 12th: if extra 6th subject is opted separately and not in rawList, append it
    if (extraSubj && !rawList.some(s => s.toLowerCase() === extraSubj.toLowerCase())) {
      rawList.push(extraSubj);
    }
  }

  if (rawList.length === 0) return '—';

  // Clean and deduplicate preserving order
  const uniqueSubjs = [];
  rawList.forEach(s => {
    const clean = s.trim();
    if (clean && !uniqueSubjs.includes(clean)) {
      uniqueSubjs.push(clean);
    }
  });

  if (uniqueSubjs.length === 0) return '—';

  if (useAbbr) {
    const abbrList = [];
    uniqueSubjs.forEach(s => {
      const abbr = abbreviateSubjectName(s);
      if (abbr && !abbrList.includes(abbr)) {
        abbrList.push(abbr);
      }
    });
    return abbrList.join(', ');
  }

  return uniqueSubjs.join(', ');
}

export function extractStreamAbbr(st) {
  const s = extractStream(st);
  if (!s || s === '—') return '';
  const lower = s.toLowerCase();
  if (lower.includes('sci') || lower.includes('med')) return 'S';
  if (lower.includes('hum') || lower.includes('art')) return 'H';
  if (lower.includes('com')) return 'C';
  if (lower.includes('gen')) return 'G';
  return s.charAt(0).toUpperCase();
}

export function extractSubjectsWithStream(st, useAbbr = true) {
  const cls = extractClass(st);
  const subjs = extractSubjects(st, useAbbr);
  
  // For 9th and 10th, do not append (G) stream tag
  if (cls === '9th' || cls === '10th') {
    return subjs;
  }

  const stmAbbr = extractStreamAbbr(st);
  if (!subjs || subjs === '—') {
    return stmAbbr ? `(${stmAbbr})` : '—';
  }
  return stmAbbr ? `${subjs} (${stmAbbr})` : subjs;
}

/**
 * Check if candidate name contains female identity markers
 */
export function isFemaleCandidateName(nameStr) {
  if (!nameStr) return false;
  const lower = String(nameStr).toLowerCase().trim();
  const words = lower.split(/[\s,._-]+/).filter(Boolean);

  const femaleTokens = new Set([
    'jan', 'khatoon', 'bano', 'akhter', 'akhtar', 'kousar', 'kausar', 'parveen', 'zehra', 'zahra',
    'fatima', 'muskan', 'suhaiba', 'sabreena', 'sabrina', 'ruqaiya', 'ruqaya', 'ruqia',
    'iqra', 'sadiya', 'sadia', 'tahira', 'shahida', 'aafreen', 'afreen', 'arjumand', 'aiman', 'shaista',
    'shafia', 'mehvis', 'mehvish', 'dania', 'rasia', 'yasmeen', 'yasmin', 'shabnum', 'shabnam', 'sumiya',
    'sumaya', 'sumaira', 'suraya', 'suraiya', 'aneesa', 'anisa', 'fiza', 'asma', 'ayesha', 'aisha',
    'mariyam', 'maryam', 'nusrat', 'nuzhat', 'shazia', 'bisma', 'insha', 'simran', 'snober', 'seerat',
    'misbah', 'tabasum', 'tabassum', 'urfi', 'uzma', 'soliha', 'saleeha', 'saliha', 'nargis', 'rozy',
    'safia', 'safiya', 'bazila', 'khushboo', 'khushbu', 'mehak', 'mahima', 'tanzeela', 'afroza', 'fareeda',
    'farida', 'kulsum', 'kulsoom', 'shamima', 'saleema', 'salima', 'shakeela', 'shakila', 'muntaha',
    'maheen', 'mahnoor', 'areeba', 'aliza', 'hoor', 'huria', 'shabana', 'samina', 'rehana', 'rukhsana',
    'rubina', 'razia', 'munaza', 'muneera', 'fahmeeda', 'fehmeeda', 'haleema', 'rashida', 'waheeda',
    'hamida', 'jameela', 'naseema', 'khalida', 'amina', 'safeena', 'sumera', 'zubaida', 'zahida',
    'nighat', 'fozia', 'fauzia', 'riffat', 'shahnaza', 'shahnaz', 'ishrat', 'shahzada', 'dilshada',
    'masrat', 'musarat', 'suriya', 'samreena', 'kounsar', 'arifa', 'shumaila', 'zahida', 'bilkees',
    'bilqees', 'lubna', 'asma', 'shafiqa', 'shagufta', 'hina', 'saba', 'sania', 'sheema', 'tasleema',
    'jabeen', 'aaliya', 'aliya', 'aalia', 'alia'
  ]);

  return words.some(w => femaleTokens.has(w));
}

export function extractGender(st) {
  if (!st) return '—';
  const raw = st?.raw || st || {};
  const keys = [
    "Gender", "gender", "Sex", "sex", "GENDER", "SEX",
    "Student's Gender", "Student Gender", "Applicant Gender", "studentGender",
    "gen", "Gen", "candidateGender", "applicant_gender", "title", "genderTitle"
  ];
  for (const k of keys) {
    const val = raw[k] || st[k];
    if (val && String(val).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(val).trim())) {
      const g = String(val).trim().toLowerCase();
      if (g.startsWith('f') || g === 'female' || g === 'girl' || g === 'ms.' || g === 'miss') return 'Female (F)';
      if (g.startsWith('m') || g === 'male' || g === 'boy' || g === 'mr.' || g === 'master') return 'Male (M)';
      return String(val).trim();
    }
  }

  // Imported spreadsheets frequently vary punctuation/case in the heading.
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!['gender', 'sex', 'studentgender', 'applicantgender', 'candidategender'].includes(normalizedKey)) continue;
    if (!value || /^(—|-|n\/?a|null|undefined)$/i.test(String(value).trim())) continue;
    const normalizedValue = String(value).trim().toLowerCase();
    if (normalizedValue.startsWith('f') || normalizedValue === 'girl') return 'Female (F)';
    if (normalizedValue.startsWith('m') || normalizedValue === 'boy') return 'Male (M)';
  }

  // If gender field is not explicitly present in record, detect from candidate name
  const studentName = raw.name || raw.studentName || raw["Student's Name"] || raw['Name'] || st.name || st.studentName || '';
  if (studentName && isFemaleCandidateName(studentName)) {
    return 'Female (F)';
  }

  if (st.raw && st.raw !== st) {
    return extractGender(st.raw);
  }
  // Unknown is intentionally not treated as male. Certificate screens can
  // request an explicit choice while their name heuristic remains available.
  return '—';
}

export function extractDob(st) {
  if (!st) return '—';
  const keys = [
    "DoB (as per school records)", "DoB (figures)", "Date of Birth", "DOB", "dob",
    "dobFigures", "Birth Date", "DOB (DD-MM-YYYY)", "DOB (DD/MM/YYYY)",
    "Date Of Birth (DD-MM-YYYY)", "Student DOB"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  for (const [key, value] of Object.entries(st?.raw || st || {})) {
    const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!['dob', 'dateofbirth', 'studentdob', 'candidatedob'].includes(normalizedKey)) continue;
    if (value && !/^(—|-|n\/?a|null|undefined)$/i.test(String(value).trim())) return String(value).trim();
  }
  return '—';
}

export function extractMobile(st) {
  if (!st) return '—';
  const keys = [
    "Mobile No. (with working WhatsApp)", "Student's Contact", "Account Mobile",
    "Mobile No.", "Mobile", "mobile", "studentMobile", "parentContact", "Contact No."
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractAadhaar(st) {
  if (!st) return '—';
  const keys = [
    "Aadhar No.", "Aadhaar No.", "PEN No.", "Aadhar", "Aadhaar", "PEN", "penNo", "aadhar", "aadhaarNo"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractVillage(st) {
  if (!st) return '—';
  const keys = [
    "Name of your village", "Village/Town", "Village", "village", "town", "Address", "address"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return toTitleCase(String(st[k]).trim());
    }
  }
  return '—';
}

export function extractCategory(st) {
  if (!st) return '—';
  const keys = [
    "Social category", "Cat._JKBOSE", "Category", "Social Category", "category", "socialCategory"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractFormNo(st) {
  if (!st) return '—';
  const keys = ["Form Number", "formNo", "formNumber", "Application ID", "appId", "Form No.", "id"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractBloodGroup(st) {
  if (!st) return '—';
  const keys = ["Blood Group", "bloodGroup", "BloodGroup", "blood_group"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractReligion(st) {
  if (!st) return '—';
  const keys = ["Religion", "religion"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractAdmissionType(st) {
  if (!st) return '—';
  const keys = ["Admission Type (Class 11th)", "Admission Type (Class 12th)", "Admission Type", "admissionType"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractPrevSchool(st) {
  if (!st) return '—';
  const keys = [
    "Name of Previous School (Class 10th)", "Name of Previous School (Class 11th)",
    "Name of Previous School (Class 8th)", "Previous School Attended", "previousSchool", "prevSchool"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return toTitleCase(String(st[k]).trim());
    }
  }
  return '—';
}

export function extractPrevMarks(st) {
  if (!st) return '—';
  const obtKeys = ["Total Marks Obtained in Class 10th", "Total Marks Obtained in Class 11th", "Total Marks Obtained in Class 8th", "prevMarks", "Marks Obtained"];
  const maxKeys = ["Total Max. Marks in Class 10th", "Total Max. Marks in Class 11th", "Total Max. Marks in Class 8th", "maxMarks", "Total Marks"];
  
  let obt = '';
  let max = '500';
  for (const k of obtKeys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      obt = String(st[k]).trim();
      break;
    }
  }
  for (const k of maxKeys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      max = String(st[k]).trim();
      break;
    }
  }
  if (obt) {
    return `${obt}/${max}`;
  }
  return '—';
}

export function extractPrevRollNo(st) {
  if (!st) return '—';
  const keys = [
    "Exam Roll Number of Class 10th", "Exam Roll Number of Class 11th", "Previous Exam Roll No.", "prevRollNo", "10th Roll No."
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractPrevYear(st) {
  if (!st) return '—';
  const keys = [
    "Year of Passing Class 10th", "Year of Passing Class 11th", "Year of Passing Class 8th", "Year of Passing", "passingYear"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractParentMobile(st) {
  if (!st) return '—';
  const keys = [
    "Parent's Mobile No. (must be working)", "Parent Mobile", "parentMobile", "Father's Mobile", "parentContact"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractEmail(st) {
  if (!st) return '—';
  const keys = ["Email Address", "Email", "email", "emailId", "Email ID"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractTehsil(st) {
  if (!st) return '—';
  const keys = ["Tehsil", "tehsil", "Block", "block"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return toTitleCase(String(st[k]).trim());
    }
  }
  return '—';
}

export function extractDistrict(st) {
  if (!st) return '—';
  const keys = ["District", "district"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return toTitleCase(String(st[k]).trim());
    }
  }
  return '—';
}

export function extractPincode(st) {
  if (!st) return '—';
  const keys = ["PIN code", "PIN Code", "Pincode", "pincode", "pin", "PIN"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractPen(st) {
  if (!st) return '—';
  const keys = [
    "PEN number (given by UDISE portal)", "PEN number", "PEN No.", "PEN", "APAAR ID", "apaarId", "penNumber"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractSocioCategory(st) {
  if (!st) return '—';
  const keys = ["Socio-economic category", "Ration Card Type", "socioEconomicCategory", "rationCardType"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractDisability(st) {
  if (!st) return '—';
  const keys = ["Whether Any Disability", "Type of Disability", "disability", "cwsn"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractBankAccount(st) {
  if (!st) return '—';
  const keys = ["Bank Account No.", "Account No.", "accountNo", "bankAccount", "Account Number"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractBankName(st) {
  if (!st) return '—';
  const keys = ["Name of Bank", "Bank Name", "bankName", "Bank"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractIfsc(st) {
  if (!st) return '—';
  const keys = ["IFSC code", "IFSC Code", "IFSC", "ifsc"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
  }
  return '—';
}

// ─── High-Performance Self-Resolving Student Photo Cell ───
function RosterStudentPhotoCell({ student, studentName, initialPhoto }) {
  const photoSrc = useMemo(() => {
    const direct = initialPhoto || resolveStudentPhoto(student) || getStudentPhotoUrl(student);
    return direct && direct !== '/logo.png' && direct !== '—' ? (formatPhotoDisplayUrl(direct) || direct) : '';
  }, [student, initialPhoto]);
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [photoSrc]);
  const hasPhoto = photoSrc && !imgError && photoSrc !== '—' && photoSrc !== '/logo.png';

  return (
    <div className="flex items-center justify-center p-0.5 min-h-[32px]">
      {hasPhoto ? (
        <img
          src={photoSrc}
          alt={studentName || 'Student Photo'}
          loading="lazy"
          className="w-7 h-9 sm:w-8 sm:h-10 object-cover rounded border border-slate-300 shadow-2xs mx-auto bg-slate-100 block"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-7 h-9 sm:w-8 sm:h-10 border border-dashed border-slate-300 rounded bg-slate-50 flex flex-col items-center justify-center text-[7px] text-slate-400 font-bold mx-auto select-none">
          <User size={11} className="text-slate-300 mb-0.5" />
          <span>Photo</span>
        </div>
      )}
    </div>
  );
}

export default function CustomRosterDocumentBuilderView({
  allStudents = [],
  onClose,
  activeSubTab,
  onSwitchSubTab,
  onSwitchToLetterWriter,
  globalSession,
  onSelectGlobalSession
}) {
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    getStudentRegIndex().catch(() => {});
  }, []);

  const [masterRegistersList, setMasterRegistersList] = useState(() => {
    const cached = getCachedCollectionSync('masterRegisters');
    return Array.isArray(cached) && cached.length > 0 ? unpackMasterRegisterStudents(cached) : [];
  });

  useEffect(() => {
    let isMounted = true;
    const cancelIdleWork = scheduleIdleWork(() => {
      getCachedCollection('masterRegisters', false, 30 * 60 * 1000).then((docs) => {
        if (!isMounted || !Array.isArray(docs)) return;
        const flat = unpackMasterRegisterStudents(docs);
        if (flat.length > 0) {
          React.startTransition(() => setMasterRegistersList(flat));
        }
      }).catch(() => {});
    });
    return () => {
      isMounted = false;
      cancelIdleWork();
    };
  }, []);

  // Combine live intake with historical registers seamlessly with thorough deduplication
  const combinedRawStudents = useMemo(() => {
    const list = Array.isArray(allStudents) ? [...allStudents] : [];
    if (Array.isArray(masterRegistersList) && masterRegistersList.length > 0) {
      const seenKeys = new Set();
      list.forEach(s => {
        const id = String(s.id || s.docId || '').trim().toLowerCase();
        const fNo = String(s.formNo || s['Form Number'] || s['Form No.'] || '').trim().toLowerCase();
        const reg = String(s.boardRegNo || s['Board Registration Number'] || s['Board Reg. No.'] || s.regNo || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const name = String(s.studentName || s['Student Name'] || s.name || '').trim().toLowerCase();
        const father = String(s.fatherName || s["Father's Name"] || s.parentName || '').trim().toLowerCase();
        const sess = String(s.session || s.Session || '').trim().toLowerCase();
        const cls = String(s.className || s.class || s.Class || '').trim().toLowerCase();

        if (id) seenKeys.add(`id:${id}`);
        if (fNo) seenKeys.add(`fno:${fNo}`);
        if (reg && reg !== '—') seenKeys.add(`reg:${reg}`);
        if (name && father && cls) seenKeys.add(`name:${sess}:${cls}:${name}:${father}`);
      });

      masterRegistersList.forEach(m => {
        const id = String(m.id || m.docId || '').trim().toLowerCase();
        const fNo = String(m.formNo || m['Form Number'] || m['Form No.'] || '').trim().toLowerCase();
        const reg = String(m.boardRegNo || m['Board Registration Number'] || m['Board Reg. No.'] || m.regNo || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const name = String(m.studentName || m['Student Name'] || m.name || '').trim().toLowerCase();
        const father = String(m.fatherName || m["Father's Name"] || m.parentName || '').trim().toLowerCase();
        const sess = String(m.session || m.Session || '').trim().toLowerCase();
        const cls = String(m.className || m.class || m.Class || '').trim().toLowerCase();

        const isDuplicate = 
          (id && seenKeys.has(`id:${id}`)) ||
          (fNo && seenKeys.has(`fno:${fNo}`)) ||
          (reg && reg !== '—' && seenKeys.has(`reg:${reg}`)) ||
          (name && father && cls && seenKeys.has(`name:${sess}:${cls}:${name}:${father}`));

        if (!isDuplicate) {
          list.push(m);
          if (id) seenKeys.add(`id:${id}`);
          if (fNo) seenKeys.add(`fno:${fNo}`);
          if (reg && reg !== '—') seenKeys.add(`reg:${reg}`);
          if (name && father && cls) seenKeys.add(`name:${sess}:${cls}:${name}:${father}`);
        }
      });
    }
    return list;
  }, [allStudents, masterRegistersList]);

  // ─── Direct High-Performance Pre-Indexed Student Pool (Runs Extraction Only Once) ───
  const unifiedStudentPool = useMemo(() => {
    if (!Array.isArray(combinedRawStudents) || combinedRawStudents.length === 0) return [];
    const poolMap = new Map();

    combinedRawStudents.forEach((rawSt, idx) => {
      const st = rawSt || {};
      const session = extractSession(st) || '—';
      const className = extractClass(st) || '—';
      const stream = extractStream(st) || '—';
      const gender = extractGender(st) || '—';
      const status = resolveStudentStatus(st) || 'Submitted';
      const studentName = extractStudentName(st);
      const fName = extractFatherName(st);
      const mName = extractMotherName(st);
      const classRollNo = getStudentRollNumber(st) || '—';
      const boardRegNo = extractBoardRegNo(st);
      const admNo = extractAdmNo(st);
      const formNo = extractFormNo(st);
      const dob = extractDob(st);
      const bloodGroup = extractBloodGroup(st);
      const religion = extractReligion(st);
      const admissionType = extractAdmissionType(st);
      const prevSchool = extractPrevSchool(st);
      const prevMarks = extractPrevMarks(st);
      const prevRollNo = extractPrevRollNo(st);
      const prevYear = extractPrevYear(st);
      const mobile = extractMobile(st);
      const parentMobile = extractParentMobile(st);
      const email = extractEmail(st);
      const village = extractVillage(st);
      const tehsil = extractTehsil(st);
      const district = extractDistrict(st);
      const pincode = extractPincode(st);
      const aadhaarNo = extractAadhaar(st);
      const pen = extractPen(st);
      const category = extractCategory(st);
      const socioCategory = extractSocioCategory(st);
      const disability = extractDisability(st);
      const bankAccount = extractBankAccount(st);
      const bankName = extractBankName(st);
      const ifsc = extractIfsc(st);
      const rawSubjects = extractSubjects(st, false);
      const rawSubjectsWithStreamAbbr = extractSubjectsWithStream(st, true);
      const rawSubjectsWithStreamFull = extractSubjectsWithStream(st, false);

      let parentage = '—';
      if (fName !== '—' && mName !== '—') parentage = `${fName} / ${mName}`;
      else if (fName !== '—') parentage = fName;
      else if (mName !== '—') parentage = mName;

      const studentRecord = {
        _originalIdx: idx + 1,
        _rawStudent: st,
        docId: st.docId || st.id || '',
        session,
        className,
        stream,
        gender,
        status,
        studentName,
        fatherName: fName,
        motherName: mName,
        parentage,
        classRollNo,
        boardRegNo,
        admNo,
        formNo,
        dob,
        bloodGroup,
        religion,
        admissionType,
        prevSchool,
        prevMarks,
        prevRollNo,
        prevYear,
        mobile,
        parentMobile,
        email,
        village,
        tehsil,
        district,
        pincode,
        aadhaarNo,
        pen,
        category,
        socioCategory,
        disability,
        bankAccount,
        bankName,
        ifsc,
        rawSubjects,
        rawSubjectsWithStreamAbbr,
        rawSubjectsWithStreamFull
      };

      // Create unique deduplication key for student pool
      const regKey = boardRegNo && boardRegNo !== '—' ? boardRegNo.replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
      const fNoKey = formNo && formNo !== '—' ? formNo.toLowerCase() : '';
      const nameKey = (studentName !== '—' && fName !== '—') ? `${session}_${className}_${studentName}_${fName}`.toLowerCase() : '';
      
      const dedupKey = regKey ? `reg_${regKey}` : (fNoKey ? `form_${fNoKey}` : (nameKey ? `name_${nameKey}` : `doc_${st.docId || st.id || idx}`));

      if (!poolMap.has(dedupKey)) {
        poolMap.set(dedupKey, studentRecord);
      } else {
        const existing = poolMap.get(dedupKey);
        // Prefer the record that has an assigned class roll number or richer information
        if (existing.classRollNo === '—' && classRollNo !== '—') {
          poolMap.set(dedupKey, { ...existing, ...studentRecord });
        }
      }
    });

    return Array.from(poolMap.values()).map((r, i) => ({ ...r, _originalIdx: i + 1 }));
  }, [combinedRawStudents, isReady]);

  // ─── Real Distinct Subjects Extracted Dynamically from Database Students ───
  const dynamicStudentSubjects = useMemo(() => {
    const map = new Map();

    unifiedStudentPool.forEach(st => {
      const raw = extractSubjects(st, false);
      if (!raw || raw === '—') return;
      const parts = raw.split(/[,+;]/).map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        const clean = p.replace(/\s+/g, ' ');
        if (clean && clean.length > 1 && !/^(—|none|null|undefined)$/i.test(clean)) {
          const key = clean.toLowerCase();
          if (!map.has(key)) {
            map.set(key, { name: clean, count: 1 });
          } else {
            map.get(key).count += 1;
          }
        }
      });
    });

    // Ensure default subjects are also available even before students are loaded
    DEFAULT_CHARGEABLE_SUBJECTS.forEach(defSub => {
      const key = defSub.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: defSub, count: 0 });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [unifiedStudentPool]);

  // ─── Detect Default Active / Current Academic Session (e.g. '2025-26') ───
  const defaultCurrentSession = useMemo(() => {
    if (globalSession && globalSession !== 'ALL') {
      return String(globalSession).replace(/^(active_|master_)/, '');
    }
    if (Array.isArray(allStudents) && allStudents.length > 0) {
      const counts = {};
      for (const st of allStudents) {
        const s = extractSession(st);
        if (s && s !== '—') counts[s] = (counts[s] || 0) + 1;
      }
      const sorted = Object.entries(counts).sort((a, b) => {
        const yearA = parseInt(a[0].match(/\d{4}/)?.[0] || '0', 10);
        const yearB = parseInt(b[0].match(/\d{4}/)?.[0] || '0', 10);
        if (yearB !== yearA) return yearB - yearA;
        return b[1] - a[1];
      });
      if (sorted.length > 0 && sorted[0][0]) return sorted[0][0];
    }
    return '2025-26';
  }, [globalSession, allStudents]);

  // ─── Filter States (Session, Class, Stream, Gender, Status) ───
  const [selectedSession, setSelectedSession] = useState(() => defaultCurrentSession);

  // Synchronize when globalSession or defaultCurrentSession updates
  useEffect(() => {
    if (globalSession && globalSession !== 'ALL') {
      setSelectedSession(String(globalSession).replace(/^(active_|master_)/, ''));
    } else if (globalSession === 'ALL') {
      setSelectedSession('ALL');
    }
  }, [globalSession]);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [selectedGender, setSelectedGender] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [useAbbreviatedSubjects, setUseAbbreviatedSubjects] = useState(true);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // ─── Document Layout & Header States ───
  const [docTitle, setDocTitle] = useState('STUDENT RECORD & SIGNATURE SHEET');
  const [docSubtitle, setDocSubtitle] = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const [selectedRowHeightIdx, setSelectedRowHeightIdx] = useState(2); // Default: Signature (52px)
  const [signatories] = useState(['Incharge Admissions & Exam', 'Principal']);

  // ─── Draggable Dual-Pane Splitter State (Left Palette % vs Right Preview %) ───
  const [leftSplitPct, setLeftSplitPct] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_roster_split_pct');
      return saved ? Math.max(22, Math.min(75, Number(saved))) : 42;
    } catch {
      return 42;
    }
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSplitterMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    const container = e.currentTarget.closest('.split-pane-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvt) => {
      moveEvt.preventDefault();
      const mouseX = moveEvt.clientX - rect.left;
      const pct = Math.max(22, Math.min(75, (mouseX / rect.width) * 100));
      const rounded = Math.round(pct * 10) / 10;
      setLeftSplitPct(rounded);
      try {
        localStorage.setItem('hss_roster_split_pct', String(rounded));
      } catch {}
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // ─── Default System Column Configuration ───
  const getDefaultSystemColumns = () => {
    const defaultDb = ALL_DB_COLUMNS.filter(c => c.defaultSelected).map(c => ({
      key: c.key,
      label: c.label,
      widthPct: c.defaultWidthPct,
      align: c.align,
      isCustom: false
    }));
    const defaultCustom = [
      {
        key: 'custom_rr_exam_fee',
        label: 'RR & Exam Fee',
        calcType: 'fee_with_subject_surcharge',
        baseFee: 1550,
        classBaseFees: { '11th': '1520', '12th': '1560', '10th': '1550', '9th': '1550' },
        classBaseFees6Subs: { '11th': '1760', '12th': '1800', '10th': '1850', '9th': '1850' },
        subjectSurcharge: 100,
        chargeableSubjects: ['Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Physical Education'],
        prefixCurrency: true,
        showBreakdown: false,
        widthPct: 11,
        align: 'center',
        isCustom: true
      },
      {
        key: 'custom_signature',
        label: 'Student Signature',
        calcType: 'fixed',
        defaultValue: '',
        widthPct: 15,
        align: 'center',
        isCustom: true
      }
    ];
    return [...defaultDb, ...defaultCustom];
  };

  // ─── Column Configuration with Saved Default Persistence ───
  const [hasSavedDefault, setHasSavedDefault] = useState(() => {
    try {
      return !!localStorage.getItem('hss_custom_roster_default_columns');
    } catch {
      return false;
    }
  });

  const [activeColumns, setActiveColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_custom_roster_default_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return getDefaultSystemColumns();
  });

  const [saveDefaultToast, setSaveDefaultToast] = useState(false);
  const [isSavingCustomToCloud, setIsSavingCustomToCloud] = useState(false);
  const [cloudFeeSaveToast, setCloudFeeSaveToast] = useState(false);
  // Preload and sync custom fee rules and column defaults from Firebase Cloud
  useEffect(() => {
    let isMounted = true;
    const fetchCloudFeeRules = async () => {
      try {
        const snap = await getDoc(doc(db, 'systemSettings', 'rosterFeeRules'));
        if (snap.exists() && isMounted) {
          const data = snap.data();
          if (data && (data.classBaseFees || data.customColumns)) {
            setActiveColumns(prev => {
              const updated = prev.map(c => {
                if (c.calcType === 'fee_with_subject_surcharge') {
                  return {
                    ...c,
                    baseFee: data.baseFee !== undefined ? Number(data.baseFee) : c.baseFee,
                    classBaseFees: data.classBaseFees || c.classBaseFees,
                    classBaseFees6Subs: data.classBaseFees6Subs || c.classBaseFees6Subs,
                    subjectSurcharge: data.subjectSurcharge !== undefined ? Number(data.subjectSurcharge) : c.subjectSurcharge,
                    chargeableSubjects: Array.isArray(data.chargeableSubjects) ? data.chargeableSubjects : c.chargeableSubjects,
                    showBreakdown: data.showBreakdown !== undefined ? data.showBreakdown : c.showBreakdown
                  };
                }
                return c;
              });
              try {
                localStorage.setItem('hss_custom_roster_default_columns', JSON.stringify(updated));
              } catch (_) {}
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn('Cloud fee rules load note:', err);
      }
    };
    fetchCloudFeeRules();
    return () => { isMounted = false; };
  }, []);

  // Save current activeColumns as default
  const handleSaveAsDefaultColumns = async () => {
    try {
      localStorage.setItem('hss_custom_roster_default_columns', JSON.stringify(activeColumns));
      setHasSavedDefault(true);
      setSaveDefaultToast(true);
      setTimeout(() => setSaveDefaultToast(false), 3000);

      // Also persist to Firebase Cloud
      await setDoc(doc(db, 'systemSettings', 'rosterFeeRules'), {
        allColumnsConfig: activeColumns,
        customColumns: activeColumns.filter(c => c.isCustom),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error(e);
      alert('Failed to save default column order: ' + e.message);
    }
  };

  // Reset to initial system default columns
  const handleResetToSystemDefault = () => {
    try {
      localStorage.removeItem('hss_custom_roster_default_columns');
      setHasSavedDefault(false);
      setActiveColumns(getDefaultSystemColumns());
    } catch (e) {
      console.error(e);
    }
  };

  // Modal States for Dynamic & Fixed Custom Columns
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [editingColKey, setEditingColKey] = useState(null);
  const [modalColLabel, setModalColLabel] = useState('');
  const [modalCalcType, setModalCalcType] = useState('fee_with_subject_surcharge');
  const [modalBaseFee, setModalBaseFee] = useState(1550);
  const [modalClassBaseFees, setModalClassBaseFees] = useState({ '11th': '1520', '12th': '1560', '10th': '1550', '9th': '1550' });
  const [modalClassBaseFees6Subs, setModalClassBaseFees6Subs] = useState({ '11th': '1760', '12th': '1800', '10th': '1850', '9th': '1850' });
  const [modalSubjectSurcharge, setModalSubjectSurcharge] = useState(100);
  const [modalChargeableSubjects, setModalChargeableSubjects] = useState(['Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Physical Education']);
  const [modalNewSubjectInput, setModalNewSubjectInput] = useState('');
  const [modalClassRules, setModalClassRules] = useState({ '11th': '', '12th': '', '10th': '', '9th': '' });
  const [modalStreamRules, setModalStreamRules] = useState({ 'Science': '', 'Humanities': '', 'Commerce': '', 'General': '' });
  const [modalStatusRules, setModalStatusRules] = useState({ 'Approved': '', 'Submitted': '', 'Draft': '', 'Provisional': '' });
  const [modalFixedVal, setModalFixedVal] = useState('');
  const [modalPrefixCurrency, setModalPrefixCurrency] = useState(true);
  const [modalShowBreakdown, setModalShowBreakdown] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [showAllPreviewRows, setShowAllPreviewRows] = useState(false);
  const [draggedColIdx, setDraggedColIdx] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'classRollNo', direction: 'asc' });

  // Open Add Modal
  const handleOpenAddModal = (preset = null) => {
    setEditingColKey(null);
    if (preset) {
      setModalColLabel(preset.name || '');
      setModalCalcType(preset.calcType || 'fixed');
      setModalBaseFee(preset.baseFee !== undefined ? preset.baseFee : 1550);
      setModalClassBaseFees(preset.classBaseFees || { '11th': '1520', '12th': '1560', '10th': '1550', '9th': '1550' });
      setModalClassBaseFees6Subs(preset.classBaseFees6Subs || { '11th': '1760', '12th': '1800', '10th': '1850', '9th': '1850' });
      setModalSubjectSurcharge(preset.subjectSurcharge !== undefined ? preset.subjectSurcharge : 100);
      setModalChargeableSubjects(preset.chargeableSubjects || ['Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Physical Education']);
      setModalClassRules(preset.classRules || { '11th': '', '12th': '', '10th': '', '9th': '' });
      setModalStreamRules(preset.streamRules || { 'Science': '', 'Humanities': '', 'Commerce': '', 'General': '' });
      setModalStatusRules(preset.statusRules || { 'Approved': '', 'Submitted': '', 'Draft': '', 'Provisional': '' });
      setModalFixedVal(preset.defaultValue || '');
      setModalPrefixCurrency(preset.prefixCurrency !== undefined ? preset.prefixCurrency : true);
      setModalShowBreakdown(preset.showBreakdown || false);
    } else {
      setModalColLabel('');
      setModalCalcType('fee_with_subject_surcharge');
      setModalBaseFee(1550);
      setModalClassBaseFees({ '11th': '1520', '12th': '1560', '10th': '1550', '9th': '1550' });
      setModalClassBaseFees6Subs({ '11th': '1760', '12th': '1800', '10th': '1850', '9th': '1850' });
      setModalSubjectSurcharge(100);
      setModalChargeableSubjects(['Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Physical Education']);
      setModalClassRules({ '11th': '', '12th': '', '10th': '', '9th': '' });
      setModalStreamRules({ 'Science': '', 'Humanities': '', 'Commerce': '', 'General': '' });
      setModalStatusRules({ 'Approved': '', 'Submitted': '', 'Draft': '', 'Provisional': '' });
      setModalFixedVal('');
      setModalPrefixCurrency(true);
      setModalShowBreakdown(false);
    }
    setModalNewSubjectInput('');
    setShowAddCustomModal(true);
  };

  // Open Edit Modal for Existing Custom Column
  const handleOpenEditModal = (col) => {
    setEditingColKey(col.key);
    setModalColLabel(col.label || '');
    setModalCalcType(col.calcType || 'fixed');
    setModalBaseFee(col.baseFee !== undefined ? col.baseFee : 1550);
    setModalClassBaseFees(col.classBaseFees || { '11th': '1520', '12th': '1560', '10th': '1550', '9th': '1550' });
    setModalClassBaseFees6Subs(col.classBaseFees6Subs || { '11th': '1760', '12th': '1800', '10th': '1850', '9th': '1850' });
    setModalSubjectSurcharge(col.subjectSurcharge !== undefined ? col.subjectSurcharge : 100);
    setModalChargeableSubjects(col.chargeableSubjects || ['Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Physical Education']);
    setModalClassRules(col.classRules || { '11th': '', '12th': '', '10th': '', '9th': '' });
    setModalStreamRules(col.streamRules || { 'Science': '', 'Humanities': '', 'Commerce': '', 'General': '' });
    setModalStatusRules(col.statusRules || { 'Approved': '', 'Submitted': '', 'Draft': '', 'Provisional': '' });
    setModalFixedVal(col.defaultValue || '');
    setModalPrefixCurrency(col.prefixCurrency !== undefined ? col.prefixCurrency : true);
    setModalShowBreakdown(col.showBreakdown || false);
    setModalNewSubjectInput('');
    setShowAddCustomModal(true);
  };

  // Save Custom Column (New or Edited) + Save to Firebase Cloud
  const handleSaveCustomColumn = async () => {
    if (!modalColLabel.trim()) return;

    setIsSavingCustomToCloud(true);
    const colData = {
      label: modalColLabel.trim(),
      calcType: modalCalcType,
      baseFee: Number(modalBaseFee || 0),
      classBaseFees: modalClassBaseFees,
      classBaseFees6Subs: modalClassBaseFees6Subs,
      subjectSurcharge: Number(modalSubjectSurcharge !== undefined ? modalSubjectSurcharge : 100),
      chargeableSubjects: modalChargeableSubjects,
      classRules: modalClassRules,
      streamRules: modalStreamRules,
      statusRules: modalStatusRules,
      defaultValue: modalFixedVal,
      prefixCurrency: modalPrefixCurrency,
      showBreakdown: modalShowBreakdown,
      widthPct: 11,
      align: modalCalcType === 'fixed' && !modalFixedVal ? 'center' : 'center',
      isCustom: true
    };

    let nextCols = [];
    if (editingColKey) {
      nextCols = activeColumns.map(c => c.key === editingColKey ? { ...c, ...colData } : c);
    } else {
      const key = `custom_${Date.now()}_${modalColLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      nextCols = [...activeColumns, { ...colData, key }];
    }

    setActiveColumns(nextCols);
    try {
      localStorage.setItem('hss_custom_roster_default_columns', JSON.stringify(nextCols));
      setHasSavedDefault(true);
    } catch (_) {}

    // Persist directly to Cloud Firestore collection 'systemSettings' doc 'rosterFeeRules'
    try {
      await setDoc(doc(db, 'systemSettings', 'rosterFeeRules'), {
        baseFee: Number(modalBaseFee || 0),
        classBaseFees: modalClassBaseFees,
        classBaseFees6Subs: modalClassBaseFees6Subs,
        subjectSurcharge: Number(modalSubjectSurcharge !== undefined ? modalSubjectSurcharge : 100),
        chargeableSubjects: modalChargeableSubjects,
        showBreakdown: modalShowBreakdown,
        lastUpdatedColumnLabel: modalColLabel.trim(),
        lastUpdatedCalcType: modalCalcType,
        customColumns: nextCols.filter(c => c.isCustom),
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin'
      }, { merge: true });

      setCloudFeeSaveToast(true);
      setTimeout(() => setCloudFeeSaveToast(false), 3500);
    } catch (err) {
      console.error('Firebase fee rules save error:', err);
      alert('Updated locally. Note: Cloud sync had a network note: ' + err.message);
    } finally {
      setIsSavingCustomToCloud(false);
      setShowAddCustomModal(false);
      setEditingColKey(null);
    }
  };

  // Sort rows by column key
  const handleSort = (columnKey) => {
    setSortConfig(prev => {
      if (prev.key === columnKey) {
        if (prev.direction === 'asc') return { key: columnKey, direction: 'desc' };
        return { key: 'classRollNo', direction: 'asc' }; // cycle back to default order by class roll no
      }
      return { key: columnKey, direction: 'asc' };
    });
  };

  // Quick 1-Click Column Width Adjustment (+1.5% / -1.5%)
  const adjustColumnWidth = (colIdx, deltaPct, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setActiveColumns(prev => {
      const next = [...prev];
      if (!next[colIdx]) return prev;
      const current = Number(next[colIdx].widthPct) || 10;
      const newWidth = Math.max(2, Math.min(65, Math.round((current + deltaPct * 1.5) * 10) / 10));
      next[colIdx] = { ...next[colIdx], widthPct: newWidth };
      return next;
    });
  };

  // Column Width Drag Resizing Handler (Reliable mouse drag with live column updating)
  const handleResizeStart = (e, colIdx) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const initialWidthPct = Number(activeColumns[colIdx]?.widthPct) || 10;
    const tableEl = e.currentTarget.closest('table');
    const tableWidth = tableEl ? tableEl.offsetWidth : 800;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaPct = (deltaX / tableWidth) * 100;
      const newWidth = Math.max(2, Math.min(65, Math.round((initialWidthPct + deltaPct) * 10) / 10));

      setActiveColumns(prev => {
        const next = [...prev];
        if (next[colIdx]) {
          next[colIdx] = { ...next[colIdx], widthPct: newWidth };
        }
        return next;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Reorder column by arrow
  const moveColumn = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= activeColumns.length) return;
    const next = [...activeColumns];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setActiveColumns(next);
  };

  // Drag-and-Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedColIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedColIdx === null || draggedColIdx === targetIndex) return;
    const next = [...activeColumns];
    const [moved] = next.splice(draggedColIdx, 1);
    next.splice(targetIndex, 0, moved);
    setActiveColumns(next);
    setDraggedColIdx(null);
  };

  // ─── Dynamic Sessions & Classes Derived from Cohort Students (Ultra-Fast O(N)) ───
  const dynamicSessions = useMemo(() => {
    const counts = {};
    unifiedStudentPool.forEach(st => {
      const sess = st.session;
      if (sess && sess !== '—') counts[sess] = (counts[sess] || 0) + 1;
    });
    const list = Object.keys(counts).sort((a, b) => {
      const yearA = parseInt(a.match(/\d{4}/)?.[0] || '0', 10);
      const yearB = parseInt(b.match(/\d{4}/)?.[0] || '0', 10);
      if (yearB !== yearA) return yearB - yearA;
      return b.localeCompare(a, undefined, { numeric: true });
    });
    return list.map(sess => ({ value: sess, label: `Session ${sess} (${counts[sess]})`, count: counts[sess] }));
  }, [unifiedStudentPool]);

  const sessionStudents = useMemo(() => {
    if (selectedSession === 'ALL') return unifiedStudentPool;
    const norm = selectedSession.toLowerCase().trim();
    return unifiedStudentPool.filter(st => {
      const s = (st.session || '').toLowerCase().trim();
      return s === norm || s.includes(norm) || norm.includes(s);
    });
  }, [unifiedStudentPool, selectedSession]);

  const dynamicClasses = useMemo(() => {
    const counts = {};
    sessionStudents.forEach(st => {
      const cls = st.className;
      if (cls && cls !== '—') counts[cls] = (counts[cls] || 0) + 1;
    });
    const order = ['9th', '10th', '11th', '12th'];
    const list = Object.keys(counts).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
    return list.map(cls => ({ value: cls, label: `Class ${cls} (${counts[cls]})` }));
  }, [sessionStudents]);

  const sessionClassStudents = useMemo(() => {
    return selectedClass === 'ALL'
      ? sessionStudents
      : sessionStudents.filter(st => st.className.toLowerCase().includes(selectedClass.toLowerCase()));
  }, [sessionStudents, selectedClass]);

  const dynamicStreams = useMemo(() => {
    const counts = {};
    sessionClassStudents.forEach(st => {
      const stm = st.stream;
      if (stm && stm !== '—') counts[stm] = (counts[stm] || 0) + 1;
    });
    const order = ['Science', 'Humanities', 'General', 'Commerce'];
    const list = Object.keys(counts).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
    return list.map(stm => ({ value: stm, label: `${stm} (${counts[stm]})` }));
  }, [sessionClassStudents]);

  const sessionClassStreamStudents = useMemo(() => {
    return selectedStream === 'ALL'
      ? sessionClassStudents
      : sessionClassStudents.filter(st => st.stream.toLowerCase().includes(selectedStream.toLowerCase()));
  }, [sessionClassStudents, selectedStream]);

  const dynamicStatuses = useMemo(() => {
    const counts = {};
    sessionClassStreamStudents.forEach(st => {
      const stat = st.status;
      counts[stat] = (counts[stat] || 0) + 1;
    });
    const order = ['Approved', 'Submitted', 'Draft', 'Provisional', 'Rejected'];
    const list = Object.keys(counts).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
    return list.map(stat => ({
      value: stat,
      label: stat === 'Approved'
        ? `Approved (${counts[stat]})`
        : `${stat} (${counts[stat]})`
    }));
  }, [sessionClassStreamStudents]);

  // ─── Filter Students (Ultra-Fast 0ms Lookup) ───
  const filteredStudents = useMemo(() => {
    if (!Array.isArray(unifiedStudentPool)) return [];

    const normSession = selectedSession !== 'ALL' ? selectedSession.toLowerCase() : null;
    const normClass = selectedClass !== 'ALL' ? selectedClass.toLowerCase() : null;
    const normStream = selectedStream !== 'ALL' ? selectedStream.toLowerCase() : null;
    const normStatus = selectedStatus !== 'ALL' ? selectedStatus.toLowerCase() : null;

    return unifiedStudentPool.filter(st => {
      if (!st) return false;
      if (normSession && !st.session.toLowerCase().includes(normSession)) return false;
      if (normClass && !st.className.toLowerCase().includes(normClass)) return false;
      if (normStream && !st.stream.toLowerCase().includes(normStream)) return false;
      if (selectedGender !== 'ALL') {
        const g = st.gender.toLowerCase();
        if (selectedGender === 'M' && !g.startsWith('m')) return false;
        if (selectedGender === 'F' && !g.startsWith('f')) return false;
      }
      if (normStatus && st.status.toLowerCase() !== normStatus) return false;
      return true;
    });
  }, [unifiedStudentPool, selectedSession, selectedClass, selectedStream, selectedGender, selectedStatus]);

  // Active Columns for Table
  const activeTableColumns = activeColumns;

  // Normalized total percentage of active columns
  const totalColPct = useMemo(() => {
    return activeTableColumns.reduce((acc, c) => acc + (Number(c.widthPct) || 10), 0);
  }, [activeTableColumns]);

  const hasPhotoColumn = useMemo(() => {
    return activeColumns.some(c => c.key === 'studentPhoto' || c.key === 'photo');
  }, [activeColumns]);

  // Normalize Student Data for Table View & Exports with Column Sorting (Instant < 2ms)
  const processedRows = useMemo(() => {
    const rawRows = filteredStudents.map((st, idx) => {
      const row = { ...st };
      row.sno = idx + 1;
      row.subjects = useAbbreviatedSubjects ? st.rawSubjectsWithStreamAbbr : st.rawSubjectsWithStreamFull;

      const photoSrc = hasPhotoColumn ? (resolveStudentPhoto(st._rawStudent) || getStudentPhotoUrl(st._rawStudent) || '') : '';
      row.studentPhoto = photoSrc;

      activeColumns.forEach(c => {
        if (c.isCustom) {
          row[c.key] = evaluateCustomColumnValue(c, st._rawStudent);
        }
      });

      return row;
    });

    if (!sortConfig.key) return rawRows;

    const sorted = [...rawRows].sort((a, b) => {
      const sortKey = sortConfig.key || 'classRollNo';
      const va = a[sortKey];
      const vb = b[sortKey];

      const isBlankA = va === '—' || va === '' || va === undefined || va === null || /^(—|-|NA|N\/A|Nill|null|undefined)$/i.test(String(va).trim());
      const isBlankB = vb === '—' || vb === '' || vb === undefined || vb === null || /^(—|-|NA|N\/A|Nill|null|undefined)$/i.test(String(vb).trim());

      if (isBlankA && isBlankB) return a._originalIdx - b._originalIdx;
      if (isBlankA) return 1;
      if (isBlankB) return -1;

      // Numeric comparison
      const numA = Number(String(va).replace(/[^0-9.-]/g, ''));
      const numB = Number(String(vb).replace(/[^0-9.-]/g, ''));

      const isAValidNum = !isNaN(numA) && String(va).trim() !== '' && /^\d+$/.test(String(va).replace(/[^0-9]/g, ''));
      const isBValidNum = !isNaN(numB) && String(vb).trim() !== '' && /^\d+$/.test(String(vb).replace(/[^0-9]/g, ''));

      if (isAValidNum && isBValidNum && (sortKey === 'classRollNo' || sortKey === 'sno' || sortKey === '_originalIdx' || sortKey === 'admNo' || !isNaN(Number(va)))) {
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }

      // String comparison
      const strA = String(va).trim().toLowerCase();
      const strB = String(vb).trim().toLowerCase();

      return sortConfig.direction === 'asc'
        ? strA.localeCompare(strB, undefined, { numeric: true })
        : strB.localeCompare(strA, undefined, { numeric: true });
    });

    // Re-index S.No. sequentially (1, 2, 3...) according to sorted order
    return sorted.map((r, i) => ({
      ...r,
      sno: i + 1
    }));
  }, [filteredStudents, useAbbreviatedSubjects, activeColumns, sortConfig, hasPhotoColumn]);

  // Metadata Badges for Header
  const cleanGlobalSession = String(globalSession || '').replace(/^(active_|master_)/, '');
  const displaySession = selectedSession !== 'ALL'
    ? `Session: ${selectedSession}`
    : (cleanGlobalSession && globalSession !== 'ALL' ? `Session: ${cleanGlobalSession}` : 'All Sessions');

  const metaBadges = [
    selectedClass !== 'ALL' ? `Class: ${selectedClass}` : 'All Classes',
    displaySession,
    selectedStream !== 'ALL' ? `Stream: ${selectedStream}` : null,
    `Total Students: ${filteredStudents.length}`,
    `Date: ${new Date().toLocaleDateString('en-GB')}`
  ].filter(Boolean);

  // Toggle Standard Column Selection
  const toggleDbColumn = (colDef) => {
    const exists = activeColumns.some(c => c.key === colDef.key);
    if (exists) {
      if (activeColumns.length <= 1) return;
      setActiveColumns(activeColumns.filter(c => c.key !== colDef.key));
    } else {
      setActiveColumns([...activeColumns, {
        key: colDef.key,
        label: colDef.label,
        widthPct: colDef.defaultWidthPct,
        align: colDef.align,
        isCustom: false
      }]);
    }
  };

  // Remove Column
  const handleRemoveColumn = (key) => {
    if (activeColumns.length <= 1) return;
    setActiveColumns(activeColumns.filter(c => c.key !== key));
  };

  // Export to Word (.docx)
  const handleExportDocx = async () => {
    setIsExporting(true);
    try {
      await generateCustomRosterDocx({
        title: docTitle || 'STUDENT ROSTER',
        subtitle: docSubtitle,
        metaBadges,
        columns: activeTableColumns,
        rows: processedRows,
        orientation,
        rowHeightDxa: ROW_HEIGHT_PRESETS[selectedRowHeightIdx].dxa,
        signatories
      });
    } catch (err) {
      console.error('Word export error:', err);
      alert('Failed to generate Word document.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Print / PDF
  const handlePrint = async () => {
    setIsExporting(true);
    try {
      const printableRows = await Promise.all(processedRows.map(async (row) => {
        const student = row._rawStudent || row;
        const resolvedPhoto = await fetchStudentPhotoOnDemand(student).catch(() => '');
        return {
          ...row,
          studentPhoto: resolvedPhoto && resolvedPhoto !== '/logo.png' && resolvedPhoto !== '—'
            ? (formatPhotoDisplayUrl(resolvedPhoto) || resolvedPhoto)
            : ''
        };
      }));

      printCustomRosterTable({
      title: docTitle || 'STUDENT ROSTER',
      subtitle: docSubtitle,
      metaBadges,
      columns: activeTableColumns,
      rows: printableRows,
      orientation,
      rowHeightPx: ROW_HEIGHT_PRESETS[selectedRowHeightIdx].px,
      signatories
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    exportCustomRosterExcel({
      title: docTitle || 'Student_Roster',
      columns: activeTableColumns,
      rows: processedRows
    });
  };

  // Export to CSV
  const handleExportCsv = () => {
    exportCustomRosterCsv({
      title: docTitle || 'Student_Roster',
      columns: activeTableColumns,
      rows: processedRows
    });
  };

  const currentRowHeightPx = ROW_HEIGHT_PRESETS[selectedRowHeightIdx].px;

  if (!isReady) {
    return (
      <TabLoadingOverlay
        moduleKey="customRoster"
        message="Preparing student cohort roster & records matrix..."
      />
    );
  }

  return (
    <div className="space-y-2 animate-fadeIn text-slate-900 dark:text-slate-100">
      
      {/* ── SLEEK CONTROL BAR WITH EXPORT ACTIONS & DOCUMENT SETTINGS ── */}
      <div 
        className="px-1.5 py-1 rounded-xl border shadow-2xs space-y-1 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-1.5 text-xs font-extrabold"
        style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}
      >
        {/* Left Side: Document Title & Quick Config */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          <div className="flex-1 min-w-[180px] max-w-[340px]">
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="DOCUMENT TITLE (PRINTED ON REGISTER)"
              className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-[10.5px] uppercase shadow-2xs text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Orientation Toggle */}
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 text-[9.5px] font-black">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                orientation === 'portrait'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                orientation === 'landscape'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Landscape
            </button>
          </div>

          {/* Row Height Preset */}
          <select
            value={selectedRowHeightIdx}
            onChange={(e) => setSelectedRowHeightIdx(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-extrabold text-[10px] text-slate-800 dark:text-slate-200"
          >
            {ROW_HEIGHT_PRESETS.map((p, idx) => (
              <option key={p.label} value={idx}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Right Side: Export Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap shrink-0 justify-end">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={processedRows.length === 0}
            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-[10.5px] flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50 transition-all"
            title="Export Roster table to Microsoft Excel spreadsheet"
          >
            <FileSpreadsheet size={12} />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportDocx}
            disabled={processedRows.length === 0 || isExporting}
            className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-black text-[10.5px] flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50 transition-all"
            title="Export Roster table to Microsoft Word document"
          >
            {isExporting ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={12} />}
            <span>Word (.docx)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={processedRows.length === 0}
            className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-[10.5px] flex items-center gap-1 shadow-md cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            title="Print Official Institutional Register / Save PDF"
          >
            <Printer size={12} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* ── 2-COLUMN DRAG-RESIZABLE SPLIT-SCREEN LAYOUT ── */}
      <div className="split-pane-container flex flex-col lg:flex-row gap-0 items-start w-full relative">
        
        {/* ════════ LEFT HALF: COMPACT UNIFIED CONTROL PALETTE ════════ */}
        <div
          style={{ width: isDesktop ? `${leftSplitPct}%` : '100%' }}
          className="w-full lg:w-auto shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-2.5 space-y-2 text-xs overflow-hidden"
        >
          {/* COHORT & DEMOGRAPHIC FILTERS */}
          <div className="space-y-1 pb-1.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[9px] uppercase font-black tracking-wider text-slate-500">
              <span className="flex items-center gap-1">
                <Sliders size={10} className="text-amber-600 dark:text-amber-400" />
                <span>Cohort Filters</span>
              </span>
              <span className="font-mono font-black text-[9px] text-emerald-600 dark:text-emerald-400">
                {filteredStudents.length} of {unifiedStudentPool.length} Matched
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
              {/* Session */}
              <div>
                <label className="block text-[8.5px] font-extrabold text-slate-400 uppercase tracking-tight">Session</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10px]"
                >
                  <option value="ALL">All Sessions ({unifiedStudentPool.length})</option>
                  {dynamicSessions.map((sess) => (
                    <option key={sess.value} value={sess.value}>{sess.label}</option>
                  ))}
                </select>
              </div>

              {/* Class */}
              <div>
                <label className="block text-[8.5px] font-extrabold text-slate-400 uppercase tracking-tight">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10px]"
                >
                  <option value="ALL">All Classes ({sessionStudents.length})</option>
                  {dynamicClasses.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Stream */}
              <div>
                <label className="block text-[8.5px] font-extrabold text-slate-400 uppercase tracking-tight">Stream</label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10px]"
                >
                  <option value="ALL">All Streams ({sessionClassStudents.length})</option>
                  {dynamicStreams.map((stm) => (
                    <option key={stm.value} value={stm.value}>{stm.label}</option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-[8.5px] font-extrabold text-slate-400 uppercase tracking-tight">Gender</label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="w-full px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10px]"
                >
                  <option value="ALL">All ({sessionClassStreamStudents.length})</option>
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                </select>
              </div>

              {/* Form Status */}
              <div>
                <label className="block text-[8.5px] font-extrabold text-slate-400 uppercase tracking-tight">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10px]"
                >
                  <option value="ALL">All ({sessionClassStreamStudents.length})</option>
                  {dynamicStatuses.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* COLUMN CONFIGURATION MATRIX */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] uppercase font-black tracking-wider text-slate-500">
              <span className="flex items-center gap-1 shrink-0">
                <Layers size={10} className="text-indigo-600 dark:text-indigo-400" />
                <span>Columns ({activeTableColumns.length} Active)</span>
              </span>

              <div className="flex flex-wrap items-center gap-1">
                <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 text-[8.5px] font-extrabold">
                  <button
                    type="button"
                    onClick={() => setUseAbbreviatedSubjects(true)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                      useAbbreviatedSubjects
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Abbreviate subjects to standard codes (GE, PH, CH, BI, MA, PD, ITE, HTC...)"
                  >
                    ⚡ Abbr (GE, PH)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseAbbreviatedSubjects(false)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                      !useAbbreviatedSubjects
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Display full subject names (General English, Physics, Chemistry...)"
                  >
                    📝 Full Names
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMoreFields(prev => !prev)}
                  className={`px-1.5 py-0.5 rounded font-black text-[9px] flex items-center gap-0.5 cursor-pointer transition-all border ${
                    showMoreFields
                      ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                      : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                  }`}
                  title="Toggle all 33 database fields"
                >
                  <ChevronDown size={9} className={`transition-transform duration-200 ${showMoreFields ? 'rotate-180' : ''}`} />
                  <span>{showMoreFields ? 'Less' : '+ More'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAddModal()}
                  className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-black text-[9px] flex items-center gap-0.5 cursor-pointer shadow-xs"
                >
                  <Plus size={9} />
                  <span>+ Custom</span>
                </button>

                {/* Save Current Columns Order as Default */}
                <button
                  type="button"
                  onClick={handleSaveAsDefaultColumns}
                  className={`px-1.5 py-0.5 rounded font-black text-[9px] flex items-center gap-0.5 cursor-pointer transition-all border shadow-2xs ${
                    saveDefaultToast
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                  }`}
                  title="Save current column order, widths and custom formulas as your default layout"
                >
                  {saveDefaultToast ? <Check size={9} /> : <Save size={9} className="text-emerald-600 dark:text-emerald-400" />}
                  <span>{saveDefaultToast ? 'Saved!' : 'Save Default'}</span>
                </button>

                {hasSavedDefault && (
                  <button
                    type="button"
                    onClick={handleResetToSystemDefault}
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 font-bold text-[8.5px] border border-slate-300 dark:border-slate-700 cursor-pointer"
                    title="Reset to system default column order"
                  >
                    <RotateCcw size={8.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Categorized Database Field Matrix (Curated Primary vs Full 33 Fields) */}
            <div className={`grid gap-1.5 ${showMoreFields ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
              {DB_COLUMN_GROUPS.map((grp) => {
                const visibleCols = showMoreFields
                  ? grp.columns
                  : grp.columns.filter(c => c.isPrimary || activeColumns.some(ac => ac.key === c.key));

                if (visibleCols.length === 0) return null;

                return (
                  <div key={grp.category} className="p-1.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-[8.5px] uppercase font-black text-slate-400 tracking-wider">
                      {grp.category}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {visibleCols.map((col) => {
                        const isSelected = activeColumns.some(c => c.key === col.key);
                        return (
                          <button
                            key={col.key}
                            type="button"
                            onClick={() => toggleDbColumn(col)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            {isSelected ? <CheckSquare size={10} /> : <Square size={10} className="opacity-30" />}
                            <span>{col.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

          {/* Custom Field Tags (Minimal) */}
          {activeColumns.some(c => c.isCustom) && (
            <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
              <span className="text-[8.5px] font-bold text-amber-700 dark:text-amber-400 uppercase">Custom:</span>
              {activeColumns.filter(c => c.isCustom).map((c) => (
                <span
                  key={c.key}
                  className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-[9.5px] font-bold inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <span
                    onClick={() => handleOpenEditModal(c)}
                    title="Click to edit formula and rates"
                    className="cursor-pointer hover:underline flex items-center gap-1"
                  >
                    {c.calcType === 'fee_with_subject_surcharge' && (
                      <span className="text-[8.5px] font-black text-amber-700 dark:text-amber-300 bg-amber-200/80 dark:bg-amber-900/60 px-1 py-0.2 rounded">⚡ Fee+Lab</span>
                    )}
                    <span>{c.label}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(c)}
                    title="Edit Column Formula & Rates"
                    className="text-amber-700 hover:text-amber-950 dark:text-amber-300 dark:hover:text-white cursor-pointer"
                  >
                    <Edit3 size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveColumn(c.key)}
                    title="Remove Custom Column"
                    className="text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

        {/* ── DRAGGABLE VERTICAL SPLITTER HANDLE ── */}
        <div
          onMouseDown={handleSplitterMouseDown}
          title="Drag horizontally to adjust split width (Double-click to reset)"
          onDoubleClick={() => {
            setLeftSplitPct(42);
            try { localStorage.setItem('hss_roster_split_pct', '42'); } catch {}
          }}
          className="hidden lg:flex flex-col items-center justify-center w-3.5 self-stretch cursor-col-resize hover:bg-indigo-400/20 active:bg-indigo-600/30 group transition-colors z-20 shrink-0 mx-0.5"
        >
          <div className={`w-1 rounded-full transition-all group-hover:w-1.5 group-hover:bg-indigo-600 ${isDraggingSplitter ? 'bg-indigo-600 w-1.5 h-full shadow-md' : 'bg-slate-300 dark:bg-slate-700 h-24'}`} />
        </div>

        {/* ════════ RIGHT HALF: STICKY LIVE DOCUMENT PREVIEW ════════ */}
        <div
          style={{ width: isDesktop ? `${100 - leftSplitPct}%` : '100%' }}
          className="w-full lg:flex-1 sticky top-3 self-start pl-0 lg:pl-1 min-w-0"
        >
          {/* Paper Sheet Preview Container (Independent Scrollable Window) */}
          <div className="bg-white text-slate-900 border border-slate-300 rounded-xl p-3 sm:p-5 shadow-sm overflow-x-auto max-h-[calc(100vh-100px)] overflow-y-auto">
            
            {/* Institution Official Letterhead Header */}
            <div className="text-center border-b-2 border-[#800000] pb-2 mb-2.5">
              <h2 className="text-sm sm:text-base font-black text-[#800000] tracking-wide m-0">
                GOVERNMENT HIGHER SECONDARY SCHOOL SHANGUS
              </h2>
              <p className="text-[9.5px] text-slate-600 font-semibold m-0 mt-0.5">
                District Anantnag, Kashmir — 192201 | Official Institutional Record
              </p>
              <h3 className="text-xs sm:text-xs font-extrabold uppercase underline tracking-wider text-slate-900 mt-1.5">
                {docTitle || 'STUDENT ROSTER & RECORD SHEET'}
              </h3>
              {docSubtitle && (
                <p className="text-[9px] text-slate-500 italic mt-0.5">{docSubtitle}</p>
              )}
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 text-[9px] font-bold text-slate-700 mt-1 flex-wrap">
                {metaBadges.map((b, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span>{b}</span>
                    {i < metaBadges.length - 1 && <span className="text-slate-400 font-normal">|</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Column Order Helper & Save Default Badge */}
            <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold mb-1 px-0.5">
              <span className="flex items-center gap-1">
                <span>💡 Drag headers or use ◀ ▶ arrows to reorder columns.</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveAsDefaultColumns}
                  className="text-emerald-700 hover:text-emerald-900 font-black flex items-center gap-0.5 hover:underline cursor-pointer"
                  title="Save this column sequence as your default order"
                >
                  {saveDefaultToast ? <Check size={10} /> : <Save size={10} />}
                  <span>{saveDefaultToast ? '✓ Saved as Default!' : '💾 Save as Default Order'}</span>
                </button>
              </div>
            </div>

            {/* Formatted Data Table with Draggable & Arrow-Reorderable Headers */}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse border border-slate-400 text-xs">
                <colgroup>
                  {activeTableColumns.map((col) => {
                    const pct = totalColPct > 0 ? ((Number(col.widthPct) || 10) / totalColPct) * 100 : (100 / activeTableColumns.length);
                    return <col key={col.key} style={{ width: `${pct.toFixed(2)}%` }} />;
                  })}
                </colgroup>
                <thead>
                  <tr className="bg-slate-100 text-slate-900 select-none">
                    {activeTableColumns.map((col, colIdx) => {
                      const pct = totalColPct > 0 ? ((Number(col.widthPct) || 10) / totalColPct) * 100 : (100 / activeTableColumns.length);
                      return (
                        <th
                          key={col.key}
                          style={{ textAlign: col.align || 'left', width: `${pct.toFixed(2)}%` }}
                          className={`border border-slate-400 px-1 py-1 font-black uppercase text-[9px] tracking-tight group transition-colors relative select-none overflow-hidden ${
                            sortConfig.key === col.key ? 'bg-indigo-100/90 text-indigo-950' : 'hover:bg-indigo-50/90'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-0.5">
                            
                            {/* Left Controls: Shift Left + Drag Handle */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                title="Shift Column Left"
                                disabled={colIdx === 0}
                                onClick={(e) => { e.stopPropagation(); moveColumn(colIdx, -1); }}
                                className="p-0.5 text-slate-400 hover:text-indigo-700 hover:bg-indigo-200 rounded disabled:opacity-0 cursor-pointer"
                              >
                                <ArrowLeft size={8.5} />
                              </button>

                              <span
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, colIdx)}
                                onDragOver={(e) => handleDragOver(e, colIdx)}
                                onDrop={(e) => handleDrop(e, colIdx)}
                                title="Drag grip to reorder column"
                                className="p-0.5 text-slate-300 hover:text-indigo-600 rounded cursor-grab active:cursor-grabbing hover:bg-indigo-100"
                              >
                                <GripVertical size={9} />
                              </span>
                            </div>

                            {/* Sortable Header Label */}
                            <button
                              type="button"
                              onClick={() => handleSort(col.key)}
                              className="truncate flex-1 text-center font-black flex items-center justify-center gap-0.5 cursor-pointer hover:text-indigo-700 transition-colors px-0.5"
                              title={`Sort rows by ${col.label}`}
                            >
                              <span className="truncate">{col.label}</span>
                              {sortConfig.key === col.key ? (
                                sortConfig.direction === 'asc' ? (
                                  <ArrowUp size={9} className="text-indigo-700 shrink-0 stroke-[2.5]" />
                                ) : (
                                  <ArrowDown size={9} className="text-indigo-700 shrink-0 stroke-[2.5]" />
                                )
                              ) : (
                                <ArrowUpDown size={7.5} className="text-slate-400 group-hover:text-indigo-600 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>

                            {/* Right Controls: Width - / +, Edit, Shift Right */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              
                              {/* Width - Button */}
                              <button
                                type="button"
                                title={`Decrease width (${col.widthPct || 10}%)`}
                                onClick={(e) => adjustColumnWidth(colIdx, -1, e)}
                                className="p-0.5 text-slate-400 hover:text-red-700 hover:bg-red-100 rounded cursor-pointer opacity-70 hover:opacity-100"
                              >
                                <Minus size={8} />
                              </button>

                              {/* Width + Button */}
                              <button
                                type="button"
                                title={`Increase width (${col.widthPct || 10}%)`}
                                onClick={(e) => adjustColumnWidth(colIdx, 1, e)}
                                className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer opacity-70 hover:opacity-100"
                              >
                                <Plus size={8} />
                              </button>

                              {/* Quick Edit for Custom Columns */}
                              {col.isCustom && (
                                <button
                                  type="button"
                                  title="Edit Custom Column Formula & Rates"
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditModal(col); }}
                                  className="p-0.5 text-amber-700 hover:text-amber-900 hover:bg-amber-200 rounded cursor-pointer"
                                >
                                  <Edit3 size={8.5} />
                                </button>
                              )}

                              {/* Shift Right */}
                              <button
                                type="button"
                                title="Shift Column Right"
                                disabled={colIdx === activeTableColumns.length - 1}
                                onClick={(e) => { e.stopPropagation(); moveColumn(colIdx, 1); }}
                                className="p-0.5 text-slate-400 hover:text-indigo-700 hover:bg-indigo-200 rounded disabled:opacity-0 cursor-pointer"
                              >
                                <ArrowRight size={8.5} />
                              </button>
                            </div>
                          </div>

                          {/* Drag Corner / Right Edge to Resize Width */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, colIdx)}
                            onClick={(e) => e.stopPropagation()}
                            title="Drag right edge to resize column width"
                            className="absolute -right-1 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center hover:bg-indigo-600 active:bg-indigo-800 bg-transparent transition-colors z-30 group-hover:bg-indigo-400/50"
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {processedRows.length === 0 ? (
                    <tr>
                      <td colSpan={activeTableColumns.length} className="text-center py-6 text-slate-400 font-bold text-xs">
                        No student records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    (showAllPreviewRows ? processedRows : processedRows.slice(0, 35)).map((row, rIdx) => (
                      <tr
                        key={`${selectedClass}-${row.boardRegNo || 'no-reg'}-${row.formNo || row._rawStudent?.docId || rIdx}`}
                        className={rIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                      >
                        {activeTableColumns.map((col) => (
                          <td
                            key={col.key}
                            style={{
                              textAlign: col.align || 'left',
                              minHeight: `${currentRowHeightPx}px`
                            }}
                            className="border border-slate-300 px-1.5 py-1 text-[10px] font-medium leading-snug align-middle break-words whitespace-normal overflow-visible"
                          >
                            {col.key === 'studentPhoto' || col.key === 'photo' ? (
                              <RosterStudentPhotoCell
                                key={`${selectedClass}-${row.boardRegNo || 'no-reg'}-${row.formNo || row._rawStudent?.docId || rIdx}`}
                                student={row._rawStudent || row}
                                studentName={row.studentName}
                                initialPhoto={row.studentPhoto}
                              />
                            ) : col.key === 'subjects' ? (
                              <span className="font-mono text-[9px] leading-tight block break-words whitespace-normal">
                                {row[col.key]}
                              </span>
                            ) : col.key === 'sno' ? (
                              <span className="font-bold text-slate-800 block text-center">{row[col.key]}</span>
                            ) : (
                              <span className="block break-words whitespace-normal">{row[col.key] !== undefined ? row[col.key] : '—'}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination / Expand Sheet Preview Note */}
            {processedRows.length > 35 && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllPreviewRows(!showAllPreviewRows)}
                  className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10.5px] border border-indigo-200 cursor-pointer"
                >
                  {showAllPreviewRows ? (
                    <span>▲ Collapse Preview to 35 Rows</span>
                  ) : (
                    <span>▼ Show All {processedRows.length} Rows on Preview Sheet (Export & Print will always include all {processedRows.length} rows)</span>
                  )}
                </button>
              </div>
            )}

            {/* Signatories Block (Incharge Admissions & Exam and Principal) */}
            <div className="flex items-center justify-between pt-6 px-4 text-center mt-3">
              {signatories.map((sig, idx) => (
                <div key={idx} className="w-36 sm:w-48">
                  <div className="border-b-2 border-slate-700 mb-1.5"></div>
                  <div className="font-black text-[10px] text-slate-900 uppercase tracking-tight">{sig}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── Real-Time Cloud Fee Rules Notification ── */}
      {cloudFeeSaveToast && (
        <div className="p-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-black text-xs text-center shadow-lg animate-fadeIn flex items-center justify-center gap-2 border border-emerald-400/40">
          <CheckCircle2 size={16} className="text-emerald-200 shrink-0" />
          <span>✓ Fee Formula & Rates successfully updated and saved in Firebase Cloud! (Active across all admin sessions)</span>
        </div>
      )}

      {/* ── Sub-Modal: Add / Edit Dynamic Custom Column (Ultra-Modern & Compact) ── */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 max-h-[95vh] overflow-y-auto">
            
            {/* Modal Header (Compact) */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Calculator size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-slate-900 dark:text-white tracking-tight">
                      {editingColKey ? 'Edit Custom Column Formula & Rates' : 'Create Custom Column'}
                    </h3>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[8.5px] flex items-center gap-0.5 border border-emerald-200 dark:border-emerald-800">
                      <Cloud size={9} />
                      <span>Cloud Sync</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Configure base fees, 5 vs 6 subject rates, and lab surcharges.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddCustomModal(false); setEditingColKey(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Templates (Only when adding new) */}
            {!editingColKey && (
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                  <Sparkles size={10} className="text-amber-500" />
                  <span>Presets:</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {QUICK_CUSTOM_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleOpenAddModal(tpl)}
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 text-slate-800 dark:text-slate-200 text-[9.5px] font-bold border border-slate-300 dark:border-slate-700 cursor-pointer shadow-2xs hover:border-amber-400 transition-all"
                    >
                      + {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Column Label & Mode Selector (Compact Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-6">
                <label className="block text-[10.5px] font-black text-slate-800 dark:text-slate-200 mb-1">
                  Column Title: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalColLabel}
                  onChange={(e) => setModalColLabel(e.target.value)}
                  placeholder="e.g. Exam Fee, RR Fee"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500 shadow-2xs"
                />
              </div>

              {/* Segmented Mode Selector Pills */}
              <div className="sm:col-span-6">
                <label className="block text-[10.5px] font-black text-slate-800 dark:text-slate-200 mb-1">
                  Calculation Engine:
                </label>
                <div className="grid grid-cols-2 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setModalCalcType('fee_with_subject_surcharge')}
                    className={`py-1 px-2 rounded-lg text-[10.5px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      modalCalcType === 'fee_with_subject_surcharge'
                        ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Zap size={11} className="text-amber-500" />
                    <span>Fee + Labs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalCalcType('fixed')}
                    className={`py-1 px-2 rounded-lg text-[10.5px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      modalCalcType === 'fixed'
                        ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 size={11} className="text-purple-500" />
                    <span>Fixed / Box</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── MODE 1: DYNAMIC FEE + PRACTICAL/LAB SUBJECT SURCHARGE (ULTRA-COMPACT MATRIX) ── */}
            {modalCalcType === 'fee_with_subject_surcharge' && (
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                
                {/* Table Header with Inline Surcharge Rate */}
                <div className="flex items-center justify-between flex-wrap gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                    Base Fee Matrix (Auto-Applied by Class & Subjects)
                  </span>
                  
                  {/* Compact Inline Surcharge Input */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <FlaskConical size={11} className="text-amber-600" />
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-slate-300">Lab Surcharge:</span>
                    <div className="relative w-14">
                      <span className="absolute left-1.5 top-0 text-[10px] font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        value={modalSubjectSurcharge}
                        onChange={(e) => setModalSubjectSurcharge(Number(e.target.value) || 0)}
                        className="w-full pl-3.5 pr-1 py-0 rounded border-0 bg-transparent text-[11px] font-black text-slate-900 dark:text-white text-center focus:ring-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Compact Rates Matrix Table */}
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/60 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-1 px-2.5">Class</th>
                        <th className="py-1 px-2.5 text-center">5 Subjects (Standard)</th>
                        <th className="py-1 px-2.5 text-center">6 Subjects (+Voc / Add)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {[
                        { key: '11th', label: 'Class 11th', def5: '1520', def6: '1760' },
                        { key: '12th', label: 'Class 12th', def5: '1560', def6: '1800' },
                        { key: '10th', label: 'Class 10th', def5: '1300', def6: '1550' },
                        { key: '9th',  label: 'Class 9th',  def5: '1550', def6: '1850' }
                      ].map(({ key, label, def5, def6 }) => (
                        <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-1 px-2.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                            {label}
                          </td>
                          <td className="py-1 px-2.5">
                            <div className="relative max-w-[120px] mx-auto">
                              <span className="absolute left-2 top-0.5 text-[10px] font-bold text-slate-400">₹</span>
                              <input
                                type="number"
                                value={modalClassBaseFees[key] !== undefined ? modalClassBaseFees[key] : (modalBaseFee || def5)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setModalClassBaseFees({ ...modalClassBaseFees, [key]: val });
                                  if (key === '11th') setModalBaseFee(Number(val) || 0);
                                }}
                                placeholder={def5}
                                className="w-full pl-5 pr-1 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-black text-slate-900 dark:text-white text-center focus:bg-white focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          </td>
                          <td className="py-1 px-2.5">
                            <div className="relative max-w-[120px] mx-auto">
                              <span className="absolute left-2 top-0.5 text-[10px] font-bold text-amber-500">₹</span>
                              <input
                                type="number"
                                value={modalClassBaseFees6Subs[key] !== undefined ? modalClassBaseFees6Subs[key] : def6}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setModalClassBaseFees6Subs({ ...modalClassBaseFees6Subs, [key]: val });
                                }}
                                placeholder={def6}
                                className="w-full pl-5 pr-1 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20 text-[11px] font-black text-amber-950 dark:text-amber-200 text-center focus:bg-white focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Compact Practical Subjects Checklist */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-[9.5px] font-black text-slate-700 dark:text-slate-300 flex-wrap gap-1">
                    <span>Chargeable Lab Subjects (+₹{modalSubjectSurcharge}):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 text-[8.5px] font-black">
                        {modalChargeableSubjects.length} Selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalChargeableSubjects(DEFAULT_CHARGEABLE_SUBJECTS)}
                        className="text-[8.5px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Default Labs
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalChargeableSubjects(dynamicStudentSubjects.map(s => s.name))}
                        className="text-[8.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalChargeableSubjects([])}
                        className="text-[8.5px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 max-h-[90px] overflow-y-auto p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    {dynamicStudentSubjects.map((subItem) => {
                      const sub = subItem.name;
                      const isIncluded = modalChargeableSubjects.some(
                        s => s.toLowerCase().trim() === sub.toLowerCase().trim()
                      );
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => {
                            if (isIncluded) {
                              setModalChargeableSubjects(
                                modalChargeableSubjects.filter(s => s.toLowerCase().trim() !== sub.toLowerCase().trim())
                              );
                            } else {
                              setModalChargeableSubjects([...modalChargeableSubjects, sub]);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
                            isIncluded
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          {isIncluded ? <CheckSquare size={9} className="text-amber-400 dark:text-amber-600" /> : <Square size={9} className="text-slate-300" />}
                          <span>{sub}</span>
                          {subItem.count > 0 && (
                            <span className={`text-[8px] px-1 rounded-full ${isIncluded ? 'bg-slate-800 text-slate-200 dark:bg-slate-300 dark:text-slate-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              {subItem.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Subject Input */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <input
                      type="text"
                      value={modalNewSubjectInput}
                      onChange={(e) => setModalNewSubjectInput(e.target.value)}
                      placeholder="Add custom subject name..."
                      className="flex-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10.5px] font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (modalNewSubjectInput.trim()) {
                          if (!modalChargeableSubjects.includes(modalNewSubjectInput.trim())) {
                            setModalChargeableSubjects([...modalChargeableSubjects, modalNewSubjectInput.trim()]);
                          }
                          setModalNewSubjectInput('');
                        }
                      }}
                      disabled={!modalNewSubjectInput.trim()}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-[10.5px] font-bold cursor-pointer disabled:opacity-40"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Compact Breakdown Option */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalShowBreakdown}
                      onChange={(e) => setModalShowBreakdown(e.target.checked)}
                      className="w-3 h-3 rounded text-amber-600 accent-amber-600 cursor-pointer"
                    />
                    <span>Show formula breakdown in table (e.g. ₹2150 (1750+400))</span>
                  </label>
                </div>
              </div>
            )}

            {/* ── MODE 2: CLASS / STREAM MAP ── */}
            {modalCalcType === 'class_map' && (
              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 space-y-2">
                <label className="block text-[10.5px] font-black text-indigo-950 dark:text-indigo-200">
                  Set Value per Class:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['11th', '12th', '10th', '9th'].map((clsKey) => (
                    <div key={clsKey} className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-center">
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Class {clsKey}</label>
                      <div className="relative">
                        <span className="absolute left-1.5 top-1 text-[10px] font-bold text-slate-400">₹</span>
                        <input
                          type="text"
                          value={modalClassRules[clsKey] || ''}
                          onChange={(e) => setModalClassRules({ ...modalClassRules, [clsKey]: e.target.value })}
                          placeholder="1750"
                          className="w-full pl-4 pr-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-center"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── MODE 3: FIXED VALUE / SIGNATURE BOX ── */}
            {modalCalcType === 'fixed' && (
              <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 space-y-1.5">
                <label className="block text-[10.5px] font-black text-purple-950 dark:text-purple-200">
                  Default Value / Placeholder:
                </label>
                <input
                  type="text"
                  value={modalFixedVal}
                  onChange={(e) => setModalFixedVal(e.target.value)}
                  placeholder="e.g. ₹500, Paid, or leave empty for physical pen signature"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-bold text-xs text-slate-900 dark:text-white"
                />
                <p className="text-[9.5px] text-slate-500">
                  Leave completely blank for an empty box where students or teachers physically sign.
                </p>
              </div>
            )}

            {/* Modal Actions (Compact Footer) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[9.5px] text-slate-400 flex items-center gap-1">
                <Cloud size={11} className="text-emerald-600" />
                <span>Auto-saves to Firebase</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddCustomModal(false); setEditingColKey(null); }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!modalColLabel.trim() || isSavingCustomToCloud}
                  onClick={handleSaveCustomColumn}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-black text-xs disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                >
                  {isSavingCustomToCloud ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={12} />
                      <span>{editingColKey ? 'Save Changes' : 'Add Column'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
