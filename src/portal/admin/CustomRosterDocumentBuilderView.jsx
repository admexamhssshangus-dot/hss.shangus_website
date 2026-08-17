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
import { getStudentPhotoUrl } from '../../utils/imageCompressor';
import { getCachedCollection, getCachedCollectionSync } from '../../services/dbCache';
import { getStudentRegIndex, lookupStudentByRegSync } from '../../services/studentIndexService';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
      { key: 'session', label: 'Session', defaultSelected: false, defaultWidthPct: 9, align: 'center', isPrimary: true },
      { key: 'stream', label: 'Stream', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'subjects', label: 'Stream & Subjects', defaultSelected: true, defaultWidthPct: 22, align: 'left', isPrimary: true },
      { key: 'status', label: 'Status', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: false },
      { key: 'admissionType', label: 'Adm. Type', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'prevSchool', label: 'Prev. School', defaultSelected: false, defaultWidthPct: 16, align: 'left', isPrimary: false },
      { key: 'prevMarks', label: 'Prev. Marks', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'prevRollNo', label: 'Prev. Roll No.', defaultSelected: false, defaultWidthPct: 11, align: 'center', isPrimary: false },
      { key: 'prevYear', label: 'Passing Year', defaultSelected: false, defaultWidthPct: 9, align: 'center', isPrimary: false },
    ]
  },
  {
    category: 'Contact & IDs',
    icon: User,
    columns: [
      { key: 'mobile', label: 'Mobile No.', defaultSelected: false, defaultWidthPct: 12, align: 'center', isPrimary: true },
      { key: 'village', label: 'Village / Address', defaultSelected: false, defaultWidthPct: 12, align: 'left', isPrimary: true },
      { key: 'aadhaarNo', label: 'Aadhaar No.', defaultSelected: false, defaultWidthPct: 12, align: 'center', isPrimary: true },
      { key: 'category', label: 'Category', defaultSelected: false, defaultWidthPct: 9, align: 'center', isPrimary: true },
      { key: 'parentMobile', label: 'Parent Mobile', defaultSelected: false, defaultWidthPct: 12, align: 'center', isPrimary: false },
      { key: 'email', label: 'Email Address', defaultSelected: false, defaultWidthPct: 16, align: 'left', isPrimary: false },
      { key: 'tehsil', label: 'Tehsil / Block', defaultSelected: false, defaultWidthPct: 10, align: 'left', isPrimary: false },
      { key: 'district', label: 'District', defaultSelected: false, defaultWidthPct: 10, align: 'left', isPrimary: false },
      { key: 'pincode', label: 'PIN Code', defaultSelected: false, defaultWidthPct: 8, align: 'center', isPrimary: false },
    ]
  },
  {
    category: 'IDs, Welfare & Banking',
    icon: Layers,
    columns: [
      { key: 'pen', label: 'PEN / APAAR ID', defaultSelected: false, defaultWidthPct: 12, align: 'center', isPrimary: false },
      { key: 'socioCategory', label: 'Socio-Economic (Ration)', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'disability', label: 'Disability (CWSN)', defaultSelected: false, defaultWidthPct: 10, align: 'center', isPrimary: false },
      { key: 'bankAccount', label: 'Bank Account No.', defaultSelected: false, defaultWidthPct: 14, align: 'center', isPrimary: false },
      { key: 'bankName', label: 'Bank Name', defaultSelected: false, defaultWidthPct: 12, align: 'left', isPrimary: false },
      { key: 'ifsc', label: 'IFSC Code', defaultSelected: false, defaultWidthPct: 11, align: 'center', isPrimary: false },
    ]
  }
];

// Flat list of all DB columns for quick lookup
const ALL_DB_COLUMNS = DB_COLUMN_GROUPS.flatMap(g => g.columns);

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
    // Determine Base Fee (by class if configured, otherwise flat baseFee)
    let base = Number(col.baseFee || 0);
    if (col.classBaseFees && typeof col.classBaseFees === 'object') {
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
    baseFee: 1750,
    classBaseFees: { '11th': 1750, '12th': 1750, '10th': 1200, '9th': 800 },
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
  if (!st) return '';
  const keys = [
    'classRollNo', 'rollNo', 'Class Roll No', 'Class Roll No.',
    'RL. NO.', 'RL. NO', 'Class R.No.', 'Class R.No', 'Class R. No.',
    'Class R. No', 'Roll No.', 'Roll No', 'roll', 'assignedRollNo',
    'assignedRoll', 'class_roll_no', 'Class_Roll_No'
  ];
  for (const k of keys) {
    if (st[k] !== undefined && st[k] !== null) {
      const val = String(st[k]).trim();
      if (val && !/^(N\/A|—|-|null|undefined)$/i.test(val)) {
        return val;
      }
    }
  }
  return '';
}

// ─── Global Helper to resolve canonical student status (Assigned Roll = Approved) ───
export function resolveStudentStatus(st) {
  if (!st) return 'Submitted';
  const roll = getStudentRollNumber(st);
  const rawStatus = String(st.status || st.Status || '').trim().toLowerCase();

  // If student has an assigned class roll number or explicit approved status
  if (roll && roll !== '—' && roll !== 'N/A') {
    return 'Approved';
  }
  if (rawStatus.includes('appr') || st.isApproved === true) {
    return 'Approved';
  }
  if (rawStatus.includes('draft') || rawStatus.includes('dft')) {
    return 'Draft';
  }
  if (rawStatus.includes('prov')) {
    return 'Provisional';
  }
  if (rawStatus.includes('rejt') || rawStatus.includes('reject')) {
    return 'Rejected';
  }
  return 'Submitted';
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
      return String(st[k]).trim();
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
      return String(st[k]).trim();
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
      return String(st[k]).trim();
    }
  }
  return '—';
}

export const cleanRegNoVal = (val) => {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (!s || /^(N\/A|#N\/A|—|-|null|undefined)$/i.test(s)) return '';

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

export function extractSession(st) {
  if (!st) return '';
  const keys = ["Session", "session", "Academic Session", "academicSession"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
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
  
  let rawList = [];

  // Array or string subjects
  const keys = [
    "Subjects to be taken in Class 11th", "Subjects to be taken in Class 12th",
    "Subjects Studied in Class 11th", "Stream & Subjects for Class 12th",
    "selectedSubjects", "Subjects", "subjects", "Subs", "subs",
    "streamDisplay", "subjectsShort"
  ];

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
  const subjs = extractSubjects(st, useAbbr);
  const stmAbbr = extractStreamAbbr(st);
  if (!subjs || subjs === '—') {
    return stmAbbr ? `(${stmAbbr})` : '—';
  }
  return stmAbbr ? `${subjs} (${stmAbbr})` : subjs;
}

export function extractGender(st) {
  if (!st) return '—';
  const keys = [
    "Gender", "gender", "Sex", "sex", "GENDER", "SEX",
    "Student's Gender", "Student Gender", "Applicant Gender", "studentGender"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      const g = String(st[k]).trim();
      if (g.toLowerCase().startsWith('f') || g.toLowerCase() === 'female' || g.toLowerCase() === 'girl') return 'Female (F)';
      if (g.toLowerCase().startsWith('m') || g.toLowerCase() === 'male' || g.toLowerCase() === 'boy') return 'Male (M)';
      return g;
    }
  }
  if (st.raw) {
    return extractGender(st.raw);
  }
  return '—';
}

export function extractDob(st) {
  if (!st) return '—';
  const keys = [
    "DoB (as per school records)", "DoB (figures)", "Date of Birth", "DOB", "dob",
    "dobFigures", "Birth Date"
  ];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
    }
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
      return String(st[k]).trim();
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
      return String(st[k]).trim();
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
      return String(st[k]).trim();
    }
  }
  return '—';
}

export function extractDistrict(st) {
  if (!st) return '—';
  const keys = ["District", "district"];
  for (const k of keys) {
    if (st[k] && String(st[k]).trim() && !/^(—|N\/A|null|undefined)$/i.test(String(st[k]).trim())) {
      return String(st[k]).trim();
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

export default function CustomRosterDocumentBuilderView({
  allStudents = [],
  onClose,
  onSwitchSubTab,
  onSwitchToLetterWriter
}) {
  // ─── Dynamic Filter Options Derived from Database ───
  const dynamicSessions = useMemo(() => {
    const counts = {};
    allStudents.forEach(st => {
      const s = extractSession(st);
      if (s && s !== '—') counts[s] = (counts[s] || 0) + 1;
    });
    const list = Object.keys(counts).sort().reverse();
    return list.map(sess => ({ value: sess, label: `${sess} (${counts[sess]})` }));
  }, [allStudents]);

  // ─── Real Distinct Subjects Extracted Dynamically from Database Students ───
  const dynamicStudentSubjects = useMemo(() => {
    const map = new Map();

    allStudents.forEach(st => {
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
  }, [allStudents]);

  // ─── Filter States (Default to Current Session '2025-26') ───
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [selectedGender, setSelectedGender] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [useAbbreviatedSubjects, setUseAbbreviatedSubjects] = useState(true);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Auto-sync session to current active session when data loads
  useEffect(() => {
    if (dynamicSessions.length > 0) {
      const hasCurrent = dynamicSessions.some(s => s.value === selectedSession);
      if (!hasCurrent && selectedSession !== 'ALL') {
        const found = dynamicSessions.find(s => s.value.includes('2025-26')) || dynamicSessions[0];
        if (found) setSelectedSession(found.value);
      }
    }
  }, [dynamicSessions, selectedSession]);

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
        baseFee: 1750,
        classBaseFees: { '11th': 1750, '12th': 1750, '10th': 1200, '9th': 800 },
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
  const [modalBaseFee, setModalBaseFee] = useState(1750);
  const [modalClassBaseFees, setModalClassBaseFees] = useState({ '11th': '1750', '12th': '1750', '10th': '1200', '9th': '800' });
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
      setModalBaseFee(preset.baseFee !== undefined ? preset.baseFee : 1750);
      setModalClassBaseFees(preset.classBaseFees || { '11th': '1750', '12th': '1750', '10th': '1200', '9th': '800' });
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
      setModalBaseFee(1750);
      setModalClassBaseFees({ '11th': '1750', '12th': '1750', '10th': '1200', '9th': '800' });
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
    setModalBaseFee(col.baseFee !== undefined ? col.baseFee : 1750);
    setModalClassBaseFees(col.classBaseFees || { '11th': '1750', '12th': '1750', '10th': '1200', '9th': '800' });
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

  // ─── Base pool of students matching selected session ───
  const sessionStudents = useMemo(() => {
    if (!Array.isArray(allStudents)) return [];
    if (selectedSession === 'ALL') return allStudents;
    const norm = selectedSession.toLowerCase();
    return allStudents.filter(st => {
      const sess = extractSession(st).toLowerCase();
      return sess.includes(norm);
    });
  }, [allStudents, selectedSession]);

  const dynamicClasses = useMemo(() => {
    const counts = {};
    sessionStudents.forEach(st => {
      const cls = extractClass(st);
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

  const dynamicStreams = useMemo(() => {
    const pool = selectedClass === 'ALL'
      ? sessionStudents
      : sessionStudents.filter(st => extractClass(st).toLowerCase().includes(selectedClass.toLowerCase()));

    const counts = {};
    pool.forEach(st => {
      const stm = extractStream(st);
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
  }, [sessionStudents, selectedClass]);

  const sessionClassStudents = useMemo(() => {
    return selectedClass === 'ALL'
      ? sessionStudents
      : sessionStudents.filter(st => extractClass(st).toLowerCase().includes(selectedClass.toLowerCase()));
  }, [sessionStudents, selectedClass]);

  const sessionClassStreamStudents = useMemo(() => {
    return selectedStream === 'ALL'
      ? sessionClassStudents
      : sessionClassStudents.filter(st => extractStream(st).toLowerCase().includes(selectedStream.toLowerCase()));
  }, [sessionClassStudents, selectedStream]);

  const dynamicStatuses = useMemo(() => {
    const counts = {};
    sessionClassStreamStudents.forEach(st => {
      const stat = resolveStudentStatus(st);
      counts[stat] = (counts[stat] || 0) + 1;
    });
    const order = ['Approved', 'Submitted', 'Draft', 'Provisional', 'Rejected'];
    const list = Object.keys(counts).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
    return list.map(stat => ({ value: stat, label: `${stat} (${counts[stat]})` }));
  }, [sessionClassStreamStudents]);

  // ─── Filter Students ───
  const filteredStudents = useMemo(() => {
    if (!Array.isArray(allStudents)) return [];

    return allStudents.filter(st => {
      if (!st) return false;

      // Session
      if (selectedSession !== 'ALL') {
        const sess = extractSession(st).toLowerCase();
        if (!sess.includes(selectedSession.toLowerCase())) return false;
      }

      // Class
      if (selectedClass !== 'ALL') {
        const cls = extractClass(st).toLowerCase();
        const normSelected = selectedClass.toLowerCase();
        if (!cls.includes(normSelected)) return false;
      }

      // Stream
      if (selectedStream !== 'ALL') {
        const stm = extractStream(st).toLowerCase();
        if (!stm.includes(selectedStream.toLowerCase())) return false;
      }

      // Gender
      if (selectedGender !== 'ALL') {
        const g = extractGender(st).toLowerCase();
        if (selectedGender === 'M' && !g.startsWith('m')) return false;
        if (selectedGender === 'F' && !g.startsWith('f')) return false;
      }

      // Status
      if (selectedStatus !== 'ALL') {
        const resolvedStat = resolveStudentStatus(st);
        if (resolvedStat.toLowerCase() !== selectedStatus.toLowerCase()) return false;
      }

      return true;
    });
  }, [allStudents, selectedSession, selectedClass, selectedStream, selectedGender, selectedStatus]);

  // Active Columns for Table
  const activeTableColumns = activeColumns;

  // Normalized total percentage of active columns
  const totalColPct = useMemo(() => {
    return activeTableColumns.reduce((acc, c) => acc + (Number(c.widthPct) || 10), 0);
  }, [activeTableColumns]);

  // Master registers cache for resolving genuine Board Reg Nos, authentic photos, and Adm Nos
  const [masterRecords, setMasterRecords] = useState(() => {
    return getCachedCollectionSync('masterRegisters') || (typeof window !== 'undefined' ? window._hssMasterRegistersCache : null) || [];
  });

  useEffect(() => {
    getCachedCollection('masterRegisters').then(list => {
      if (list && Array.isArray(list) && list.length > 0) {
        setMasterRecords(list);
      }
    }).catch(() => {});
    getStudentRegIndex().catch(() => {});
  }, []);

  // Map master identity keys (Form No, Name+Father, valid Reg)
  const masterMatchMap = useMemo(() => {
    const map = new Map();
    if (!masterRecords || masterRecords.length === 0) return map;

    masterRecords.forEach(m => {
      const fNo = extractFormNo(m);
      const reg = extractBoardRegNo(m);
      const sName = extractStudentName(m).toLowerCase().trim();
      const fName = extractFatherName(m).toLowerCase().trim();

      if (fNo && fNo !== '—') map.set(`form_${fNo.toLowerCase()}`, m);
      if (reg && reg !== '—' && !/0{5,}$/.test(reg)) map.set(`reg_${reg.toLowerCase()}`, m);
      if (sName && sName !== 'student' && fName && fName !== '—') {
        map.set(`name_${sName}_${fName.slice(0, 8)}`, m);
      }
    });

    return map;
  }, [masterRecords]);

  // Reconcile raw student with master records
  const resolveStudentMaster = useCallback((st) => {
    if (!st) return st;
    const fNo = extractFormNo(st);
    const sName = extractStudentName(st).toLowerCase().trim();
    const fName = extractFatherName(st).toLowerCase().trim();
    const rawReg = extractBoardRegNo(st);

    let match = null;
    // 1. Try form number
    if (fNo && fNo !== '—') {
      match = masterMatchMap.get(`form_${fNo.toLowerCase()}`);
    }
    // 2. Try Name + Father combination
    if (!match && sName && sName !== 'student' && fName && fName !== '—') {
      match = masterMatchMap.get(`name_${sName}_${fName.slice(0, 8)}`);
    }
    // 3. Try Reg No (only if candidate student name is compatible)
    if (!match && rawReg && rawReg !== '—' && !/0{5,}$/.test(rawReg)) {
      const cand = masterMatchMap.get(`reg_${rawReg.toLowerCase()}`);
      if (cand) {
        const candName = extractStudentName(cand).toLowerCase().trim();
        if (candName.includes(sName) || sName.includes(candName)) {
          match = cand;
        }
      }
    }

    if (match) {
      const matchReg = extractBoardRegNo(match);
      const matchAdm = extractAdmNo(match);
      return {
        ...match,
        ...st,
        boardRegNo: (matchReg && matchReg !== '—') ? matchReg : (rawReg || '—'),
        admNo: (matchAdm && matchAdm !== '—') ? matchAdm : extractAdmNo(st)
      };
    }

    return st;
  }, [masterMatchMap]);

  // Normalize Student Data for Table View & Exports with Column Sorting
  const processedRows = useMemo(() => {
    const rawRows = filteredStudents.map((rawSt, idx) => {
      const st = resolveStudentMaster(rawSt);
      const row = {};
      const fName = extractFatherName(st);
      const mName = extractMotherName(st);

      row._originalIdx = idx + 1;
      row['sno'] = idx + 1;
      row['studentPhoto'] = getStudentPhotoUrl(st);
      row['classRollNo'] = getStudentRollNumber(st) || '—';
      row['boardRegNo'] = extractBoardRegNo(st);
      row['admNo'] = extractAdmNo(st);
      row['formNo'] = extractFormNo(st);
      row['studentName'] = extractStudentName(st);
      row['fatherName'] = fName;
      row['motherName'] = mName;
      if (fName !== '—' && mName !== '—') {
        row['parentage'] = `${fName} / ${mName}`;
      } else if (fName !== '—') {
        row['parentage'] = fName;
      } else if (mName !== '—') {
        row['parentage'] = mName;
      } else {
        row['parentage'] = '—';
      }
      row['gender'] = extractGender(st);
      row['dob'] = extractDob(st);
      row['bloodGroup'] = extractBloodGroup(st);
      row['religion'] = extractReligion(st);
      row['className'] = extractClass(st) || '—';
      row['session'] = extractSession(st) || '—';
      row['stream'] = extractStream(st);
      row['subjects'] = extractSubjectsWithStream(st, useAbbreviatedSubjects);
      row['status'] = resolveStudentStatus(st);
      row['admissionType'] = extractAdmissionType(st);
      row['prevSchool'] = extractPrevSchool(st);
      row['prevMarks'] = extractPrevMarks(st);
      row['prevRollNo'] = extractPrevRollNo(st);
      row['prevYear'] = extractPrevYear(st);
      row['mobile'] = extractMobile(st);
      row['parentMobile'] = extractParentMobile(st);
      row['email'] = extractEmail(st);
      row['village'] = extractVillage(st);
      row['tehsil'] = extractTehsil(st);
      row['district'] = extractDistrict(st);
      row['pincode'] = extractPincode(st);
      row['aadhaarNo'] = extractAadhaar(st);
      row['pen'] = extractPen(st);
      row['category'] = extractCategory(st);
      row['socioCategory'] = extractSocioCategory(st);
      row['disability'] = extractDisability(st);
      row['bankAccount'] = extractBankAccount(st);
      row['bankName'] = extractBankName(st);
      row['ifsc'] = extractIfsc(st);

      activeColumns.forEach(c => {
        if (c.isCustom) {
          row[c.key] = evaluateCustomColumnValue(c, st);
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
  }, [filteredStudents, useAbbreviatedSubjects, activeColumns, sortConfig, resolveStudentMaster]);

  // Metadata Badges for Header
  const metaBadges = [
    selectedClass !== 'ALL' ? `Class: ${selectedClass}` : 'All Classes',
    selectedSession !== 'ALL' ? `Session: ${selectedSession}` : 'All Sessions',
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
  const handlePrint = () => {
    printCustomRosterTable({
      title: docTitle || 'STUDENT ROSTER',
      subtitle: docSubtitle,
      metaBadges,
      columns: activeTableColumns,
      rows: processedRows,
      orientation,
      rowHeightPx: ROW_HEIGHT_PRESETS[selectedRowHeightIdx].px,
      signatories
    });
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

  return (
    <div className="space-y-2 animate-fadeIn text-slate-900 dark:text-slate-100">
      
      {/* ── UNIFIED MASTER ACTION & SUB-TAB TOOLBAR (ALL ON 1 ROW) ── */}
      <div className="bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        
        {/* Left Side: Active Tool Title & Student Count Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <FileSpreadsheet size={14} className="text-amber-600" />
            <span>Student Roster & Registers Studio</span>
          </span>

          <span className="font-mono font-black text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            {filteredStudents.length} Students Matched
          </span>
        </div>

        {/* Right Side: 1-Click Export Actions Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={processedRows.length === 0}
            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-[10.5px] flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet size={12} />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportDocx}
            disabled={processedRows.length === 0 || isExporting}
            className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-black text-[10.5px] flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={12} />}
            <span>Word (.docx)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={processedRows.length === 0}
            className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-[10.5px] flex items-center gap-1 shadow-md cursor-pointer disabled:opacity-50"
          >
            <Printer size={12} />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* ── 2-COLUMN DRAG-RESIZABLE SPLIT-SCREEN LAYOUT ── */}
      <div className="split-pane-container flex flex-col lg:flex-row gap-0 items-start w-full relative">
        
        {/* ════════ LEFT HALF: COMPACT UNIFIED CONTROL PALETTE ════════ */}
        <div
          style={{ width: isDesktop ? `${leftSplitPct}%` : '100%' }}
          className="w-full lg:w-auto shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-3 space-y-2 text-xs overflow-hidden"
        >
          
          {/* SECTION 1: DOCUMENT CONFIG IN A SINGLE MULTI-COLUMN ROW */}
          <div className="space-y-1 pb-1.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[9.5px] uppercase font-black tracking-wider text-slate-500">
              <span className="flex items-center gap-1">
                <Settings2 size={11} className="text-teal-600 dark:text-teal-400" />
                <span>1. Document Setup</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
              {/* Title */}
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="DOCUMENT TITLE (PRINTED ON LETTERHEAD)"
                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-[10px] uppercase shadow-2xs"
                />
              </div>

              {/* Orientation Toggle */}
              <div className="sm:col-span-3 grid grid-cols-2 gap-0.5">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`py-1 rounded-lg font-black text-[9.5px] border cursor-pointer ${
                    orientation === 'portrait'
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`py-1 rounded-lg font-black text-[9.5px] border cursor-pointer ${
                    orientation === 'landscape'
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Landscape
                </button>
              </div>

              {/* Row Height Select */}
              <div className="sm:col-span-3">
                <select
                  value={selectedRowHeightIdx}
                  onChange={(e) => setSelectedRowHeightIdx(Number(e.target.value))}
                  className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[9.5px]"
                >
                  {ROW_HEIGHT_PRESETS.map((p, idx) => (
                    <option key={p.label} value={idx}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: COMPACT 5-COLUMN COHORT & DEMOGRAPHIC FILTERS */}
          <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-wider text-slate-500">
              <span className="flex items-center gap-1">
                <Sliders size={11} className="text-amber-600 dark:text-amber-400" />
                <span>2. Cohort & Demographic Filters</span>
              </span>
              <span className="font-mono font-black text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                {filteredStudents.length} Matched
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {/* Session */}
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-tight mb-0.5">Session</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10.5px]"
                >
                  <option value="ALL">All ({allStudents.length})</option>
                  {dynamicSessions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Class */}
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-tight mb-0.5">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10.5px]"
                >
                  <option value="ALL">All ({sessionStudents.length})</option>
                  {dynamicClasses.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Stream */}
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-tight mb-0.5">Stream</label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10.5px]"
                >
                  <option value="ALL">All ({sessionClassStudents.length})</option>
                  {dynamicStreams.map((stm) => (
                    <option key={stm.value} value={stm.value}>{stm.label}</option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-tight mb-0.5">Gender</label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10.5px]"
                >
                  <option value="ALL">All ({sessionClassStreamStudents.length})</option>
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                </select>
              </div>

              {/* Form Status */}
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-tight mb-0.5">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[10.5px]"
                >
                  <option value="ALL">All ({sessionClassStreamStudents.length})</option>
                  {dynamicStatuses.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: 3-COLUMN COMPACT DATABASE COLUMN MATRIX */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-wider text-slate-500">
              <span className="flex items-center gap-1">
                <Layers size={11} className="text-indigo-600 dark:text-indigo-400" />
                <span>3. Columns ({activeTableColumns.length} Active)</span>
              </span>

              <div className="flex items-center gap-1.5">
                <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 text-[9px] font-extrabold">
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
                  className={`px-2 py-0.5 rounded font-black text-[9.5px] flex items-center gap-1 cursor-pointer transition-all border ${
                    showMoreFields
                      ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                      : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                  }`}
                  title="Toggle all 33 database fields"
                >
                  <ChevronDown size={11} className={`transition-transform duration-200 ${showMoreFields ? 'rotate-180' : ''}`} />
                  <span>{showMoreFields ? 'Less Fields' : '+ More Fields'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAddModal()}
                  className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-black text-[9.5px] flex items-center gap-0.5 cursor-pointer shadow-xs"
                >
                  <Plus size={10} />
                  <span>+ Custom</span>
                </button>

                {/* Save Current Columns Order as Default */}
                <button
                  type="button"
                  onClick={handleSaveAsDefaultColumns}
                  className={`px-2 py-0.5 rounded font-black text-[9.5px] flex items-center gap-1 cursor-pointer transition-all border shadow-2xs ${
                    saveDefaultToast
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                  }`}
                  title="Save current column order, widths and custom formulas as your default layout"
                >
                  {saveDefaultToast ? <Check size={10} /> : <Save size={10} className="text-emerald-600 dark:text-emerald-400" />}
                  <span>{saveDefaultToast ? 'Saved!' : 'Save Default'}</span>
                </button>

                {hasSavedDefault && (
                  <button
                    type="button"
                    onClick={handleResetToSystemDefault}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 font-bold text-[9px] border border-slate-300 dark:border-slate-700 cursor-pointer"
                    title="Reset to system default column order"
                  >
                    <RotateCcw size={9} />
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
                      <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
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
                              <div className="flex items-center justify-center p-0.5 min-h-[32px]">
                                {row.studentPhoto ? (
                                  <img
                                    src={row.studentPhoto}
                                    alt={row.studentName || 'Student Photo'}
                                    className="w-7 h-9 sm:w-8 sm:h-10 object-cover rounded border border-slate-300 shadow-2xs mx-auto bg-slate-100 block"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.style.display = 'none';
                                      if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`w-7 h-9 sm:w-8 sm:h-10 border border-dashed border-slate-300 rounded bg-slate-50 flex-col items-center justify-center text-[7px] text-slate-400 font-bold mx-auto select-none ${
                                    row.studentPhoto ? 'hidden' : 'flex'
                                  }`}
                                >
                                  <User size={11} className="text-slate-300 mb-0.5" />
                                  <span>Photo</span>
                                </div>
                              </div>
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

      {/* ── Sub-Modal: Add / Edit Dynamic Custom Column (Refined & Modern) ── */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-amber-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-inner">
                  <Calculator size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-slate-900 dark:text-white tracking-tight">
                      {editingColKey ? 'Edit Custom Column Formula & Rates' : 'Create Custom Roster Column'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-[9.5px] flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                      <Cloud size={10} />
                      <span>Firebase Cloud</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Configure dynamic fee rules (Base fee + ₹100 per practical subject), custom rates, and table columns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddCustomModal(false); setEditingColKey(null); }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Templates (Only when adding new) */}
            {!editingColKey && (
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <label className="block text-[9.5px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-500" />
                  <span>1-Click Preset Templates:</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CUSTOM_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleOpenAddModal(tpl)}
                      className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-slate-800 dark:text-slate-200 text-[10.5px] font-black border border-slate-300 dark:border-slate-700 cursor-pointer shadow-2xs hover:border-amber-400 transition-all active:scale-95"
                    >
                      + {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Column Label */}
            <div>
              <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-1 flex items-center justify-between">
                <span>Column Header Title: <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-slate-400 font-normal">Displayed at top of printed/exported table</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={modalColLabel}
                  onChange={(e) => setModalColLabel(e.target.value)}
                  placeholder="e.g. RR & Exam Fee, Practical Fee, Student Signature, Remarks"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs transition-all"
                />
              </div>
            </div>

            {/* Calculation Mode Selector */}
            <div>
              <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-1.5">
                Value & Calculation Engine:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalCalcType('fee_with_subject_surcharge')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all relative ${
                    modalCalcType === 'fee_with_subject_surcharge'
                      ? 'border-amber-500 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/25 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-black text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <Zap size={14} className="text-amber-600" />
                      <span>Fee & Lab Surcharges</span>
                    </div>
                    {modalCalcType === 'fee_with_subject_surcharge' && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-600 text-white font-black text-[8.5px]">
                        ✓ Selected
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug font-medium">
                    Class-wise base fee + surcharge for practical / lab subjects.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setModalCalcType('fixed')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all relative ${
                    modalCalcType === 'fixed'
                      ? 'border-purple-500 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent dark:from-purple-950/40 dark:via-purple-950/20 text-purple-950 dark:text-purple-200 ring-2 ring-purple-500/25 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-black text-xs flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                      <Edit3 size={14} className="text-purple-600" />
                      <span>Fixed Value / Blank Box</span>
                    </div>
                    {modalCalcType === 'fixed' && (
                      <span className="px-1.5 py-0.5 rounded-md bg-purple-600 text-white font-black text-[8.5px]">
                        ✓ Selected
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug font-medium">
                    Static value, notes, or empty box for physical pen signatures.
                  </div>
                </button>
              </div>
            </div>

            {/* ── MODE 1: DYNAMIC FEE + PRACTICAL/LAB SUBJECT SURCHARGE (REFINED) ── */}
            {modalCalcType === 'fee_with_subject_surcharge' && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-orange-50/30 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-amber-950/30 border border-amber-200/90 dark:border-amber-900/60 space-y-3.5 shadow-xs">
                
                {/* Unified Class Base Rates & Surcharge Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  
                  {/* Per-Class Base Rates (Auto-applied by Student Class) */}
                  <div className="md:col-span-8 space-y-1.5">
                    <label className="block text-[10px] font-black uppercase text-amber-950 dark:text-amber-200 tracking-wider">
                      Base Fee by Class (Auto-applied by Student Class):
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {['11th', '12th', '10th', '9th'].map((clsKey) => (
                        <div key={clsKey} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-amber-300/80 dark:border-amber-700/60 shadow-2xs">
                          <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1 text-center">
                            Class {clsKey}
                          </label>
                          <div className="relative">
                            <span className="absolute left-1.5 top-1 font-black text-[10px] text-slate-400">₹</span>
                            <input
                              type="number"
                              value={modalClassBaseFees[clsKey] !== undefined ? modalClassBaseFees[clsKey] : modalBaseFee}
                              onChange={(e) => {
                                const val = e.target.value;
                                setModalClassBaseFees({ ...modalClassBaseFees, [clsKey]: val });
                                if (clsKey === '11th') setModalBaseFee(Number(val) || 0);
                              }}
                              className="w-full pl-4 pr-1 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-black text-center text-slate-900 dark:text-white focus:bg-white focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Surcharge per Practical Subject */}
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="block text-[10px] font-black uppercase text-amber-950 dark:text-amber-200 tracking-wider flex items-center gap-1">
                      <FlaskConical size={12} className="text-amber-600" />
                      <span>Per Practical Surcharge:</span>
                    </label>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-amber-300/80 dark:border-amber-700/60 shadow-2xs">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs font-black text-slate-400">₹</span>
                        <input
                          type="number"
                          value={modalSubjectSurcharge}
                          onChange={(e) => setModalSubjectSurcharge(Number(e.target.value) || 0)}
                          placeholder="100"
                          className="w-full pl-6 pr-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-black text-xs text-slate-900 dark:text-white focus:bg-white focus:ring-1 focus:ring-amber-500 text-center"
                        />
                      </div>
                      <div className="text-[8.5px] font-bold text-slate-400 text-center mt-1">Per practical / lab subject</div>
                    </div>
                  </div>

                </div>

                {/* Chargeable Subjects Checklist & Add Custom */}
                <div className="pt-2 border-t border-amber-200/80 dark:border-amber-900/40 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-800 dark:text-slate-200 flex-wrap gap-1">
                    <span>Chargeable Practical Subjects (+₹{modalSubjectSurcharge} each if student has subject):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[9px] font-black shadow-2xs">
                        {modalChargeableSubjects.length} Selected
                      </span>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setModalChargeableSubjects(DEFAULT_CHARGEABLE_SUBJECTS)}
                        className="text-[9px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Default Labs
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalChargeableSubjects(dynamicStudentSubjects.map(s => s.name))}
                        className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalChargeableSubjects([])}
                        className="text-[9px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-0.5 p-1 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-amber-200/50 dark:border-slate-800">
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
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1.5 border cursor-pointer transition-all active:scale-95 ${
                            isIncluded
                              ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/50'
                          }`}
                        >
                          {isIncluded ? <CheckSquare size={10} className="text-amber-100" /> : <Square size={10} className="text-slate-300" />}
                          <span>{sub}</span>
                          {subItem.count > 0 && (
                            <span className={`text-[8.5px] font-bold px-1 rounded-full ${isIncluded ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                              {subItem.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Subject to Checklist */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={modalNewSubjectInput}
                      onChange={(e) => setModalNewSubjectInput(e.target.value)}
                      placeholder="Add custom chargeable subject name..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500"
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
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black cursor-pointer disabled:opacity-40 shadow-xs transition-all"
                    >
                      + Add Subject
                    </button>
                  </div>
                </div>

                {/* Live Formula Preview Card */}
                <div className="p-3 rounded-2xl bg-amber-100/80 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800/80 text-xs space-y-1">
                  <div className="font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-600" />
                    <span>💡 Live Calculation Preview & Simulation:</span>
                  </div>
                  <div className="text-amber-900 dark:text-amber-300 text-[11px] font-medium leading-relaxed">
                    • 11th Science Student (4 lab subjects: Physics, Chemistry, Biology, Physical Education):
                    <br />
                    <span className="font-mono font-black text-amber-950 dark:text-amber-100 text-xs mt-0.5 block">
                      Total = ₹{Number(modalClassBaseFees['11th'] || modalBaseFee)} (Base) + (4 × ₹{modalSubjectSurcharge}) = ₹{Number(modalClassBaseFees['11th'] || modalBaseFee) + (4 * modalSubjectSurcharge)}
                    </span>
                  </div>
                </div>

                {/* Breakdown Option */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalShowBreakdown}
                      onChange={(e) => setModalShowBreakdown(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600 cursor-pointer"
                    />
                    <span>Display formula breakdown in table cell (e.g. ₹2150 (1750+400))</span>
                  </label>
                </div>
              </div>
            )}

            {/* ── MODE 2: CLASS / STREAM MAP ── */}
            {modalCalcType === 'class_map' && (
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 space-y-2">
                <label className="block text-[11px] font-black text-indigo-950 dark:text-indigo-200 mb-1">
                  Set Value per Class:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['11th', '12th', '10th', '9th'].map((clsKey) => (
                    <div key={clsKey} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      <label className="block text-[9.5px] font-black text-slate-500 mb-0.5 text-center">Class {clsKey}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="text"
                          value={modalClassRules[clsKey] || ''}
                          onChange={(e) => setModalClassRules({ ...modalClassRules, [clsKey]: e.target.value })}
                          placeholder="e.g. 1750"
                          className="w-full pl-5 pr-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs text-center"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── MODE 3: FIXED VALUE / SIGNATURE BOX ── */}
            {modalCalcType === 'fixed' && (
              <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 space-y-2">
                <label className="block text-[11px] font-black text-purple-950 dark:text-purple-200 mb-0.5">
                  Default Value / Placeholder:
                </label>
                <input
                  type="text"
                  value={modalFixedVal}
                  onChange={(e) => setModalFixedVal(e.target.value)}
                  placeholder="e.g. ₹500, Paid, or leave empty for handwritten pen signature"
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-bold text-xs text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Leave completely blank for an empty signature box where students or teachers can physically sign.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Cloud size={12} className="text-emerald-600" />
                <span>Auto-saves to Firebase Firestore</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddCustomModal(false); setEditingColKey(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!modalColLabel.trim() || isSavingCustomToCloud}
                  onClick={handleSaveCustomColumn}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-black text-xs disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                >
                  {isSavingCustomToCloud ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving to Firebase...</span>
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      <span>{editingColKey ? 'Update & Save to Cloud' : 'Add Column to Roster'}</span>
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
