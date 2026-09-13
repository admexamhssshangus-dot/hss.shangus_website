import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  BookOpen, FileSpreadsheet, CreditCard, Calendar, Printer, FileText,
  RefreshCw, Check, Search, ZoomIn, ZoomOut,
  Plus, Trash2, FileCheck, Sliders, Loader2, Columns, LayoutGrid,
  UserCheck, UserX, AlertCircle, X, Edit3, UserPlus, ChevronRight,
  Filter, Eye, ChevronDown, ChevronUp, Sparkles, SlidersHorizontal, Save, RotateCcw, Move, ArrowUpDown,
  CheckSquare, Square, Minus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, writeBatch, collection, getDocs, getDoc, query, where, setDoc } from 'firebase/firestore';
import {
  updateCachedItem,
  getCachedCollectionSync,
  getCachedCollection,
  fetchStudentPhotoOnDemand,
  isValidPhotoKey
} from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { getStudentPhotoUrl } from '../../utils/imageCompressor';
import {
  hasAssignedClassRollNumber,
  resolveStudentAdmissionStatus
} from '../../utils/studentApprovalStatus';
import { formatResultMarksString, getClassTier, areClassTiersCompatible, isSecondaryOnlySubjectList, areNamesCompatible, extractReappearCodes } from '../../utils/certificateStudentResolution';

const SCHOOL_NAME = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS';
const SCHOOL_SUBTITLE = 'Nurturing Minds, Shaping Futures • District Anantnag';

export const DEFAULT_ROW_HEIGHT = 56; // Standard row height in px
const MIN_REGISTER_ROW_HEIGHT = 30;
const MAX_REGISTER_ROW_HEIGHT = 100; // Allows up to 100px custom row height
export const LAYOUT_STORAGE_KEY = 'hss_admission_register_layout_v2';

export const DEFAULT_COLUMN_WIDTHS = {
  // PART 1
  sno: 26,
  photo: 40,
  rollNo: 34,
  formNo: 48,
  onlineStatus: 48,
  admDate: 48,
  admNo: 56,
  class: 32,
  boardReg: 96,
  name: 112,
  father: 90,
  mother: 90,
  dobFigures: 56,
  dobWords: 96,
  gender: 36,
  village: 64,
  block: 54,
  tehsil: 54,
  district: 54,
  mobile: 66,
  parentMobile: 66,

  // PART 2
  p2_stream: 48,
  p2_subs: 96,
  p2_aadhar: 80,
  p2_cat: 32,
  p2_socio: 32,
  p2_blood: 32,
  p2_account: 80,
  p2_ifsc: 64,
  p2_prevSchool: 86,
  p2_prevRoll: 48,
  p2_prevResult: 48,
  p2_pen: 92,
  p2_prevCC: 76,
  p2_withdrawal: 56,
  p2_issuedCC: 76,
  p2_receipt: 140,
  p2_remarks: 80,

  // SENTUP
  st_sno: 38,
  st_rollNo: 46,
  st_photo: 44,
  st_boardReg: 88,
  st_name: 195,
  st_parentage: 140,
  st_dob: 70,
  st_subs: 40,
  st_boardRoll: 70,
  st_result: 75,
  st_admitReceipt: 65,
  st_marksReceipt: 140
};

// Official Govt Higher Secondary School Shangus Subject Abbreviation Directory for Examination & Sent-up Roll Sheets
const DEFAULT_SENTUP_SUBJECT_DIRECTORY = [
  { id: 'en', code: 'EN / GE', name: 'General English' },
  { id: 'ph', code: 'PH', name: 'Physics' },
  { id: 'ch', code: 'CH', name: 'Chemistry' },
  { id: 'bi', code: 'BI / BIO', name: 'Biology (Botany & Zoology)' },
  { id: 'ma', code: 'MA / MTH', name: 'Mathematics' },
  { id: 'es', code: 'ES / EVS', name: 'Environmental Science' },
  { id: 'pd', code: 'PD / PE', name: 'Physical Education' },
  { id: 'ed', code: 'ED / EDU', name: 'Education' },
  { id: 'ps', code: 'PS / POL', name: 'Political Science' },
  { id: 'ec', code: 'EC / ECO', name: 'Economics' },
  { id: 'hy', code: 'HY / HIST', name: 'History' },
  { id: 'ur', code: 'UR / UD', name: 'Urdu' },
  { id: 'ar', code: 'AR', name: 'Arabic' },
  { id: 'ka', code: 'KA / KS', name: 'Kashmiri' },
  { id: 'hn', code: 'HN / HND', name: 'Hindi' },
  { id: 'htc', code: 'HTC', name: 'Health Care' },
  { id: 'ite', code: 'ITE / IT', name: 'IT and ITES' },
  { id: 'ay', code: 'AY / ACC', name: 'Accountancy' },
  { id: 'bs', code: 'BS / BST', name: 'Business Studies' },
  { id: 'ep', code: 'EP', name: 'Entrepreneurship' },
  { id: 'sci', code: 'SCI', name: 'General Science (Secondary)' },
  { id: 'sst', code: 'S.ST', name: 'Social Science (Secondary)' }
];

// Draggable Table Column Header Component
function ResizableTh({
  colKey,
  sortKey,
  sortConfig,
  onSort,
  width,
  onResize,
  rowSpan,
  colSpan,
  className = '',
  children,
  minWidth = 15,
  ...rest
}) {
  const onMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width || 60;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(minWidth, Math.round(startW + delta));
      if (onResize && colKey) {
        onResize(colKey, newWidth);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const styleObj = width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : undefined;
  const isSorted = Boolean(sortConfig && sortKey && sortConfig.key === sortKey);
  const isAsc = isSorted && sortConfig.direction === 'asc';
  const isDesc = isSorted && sortConfig.direction === 'desc';
  const isLeftAlign = className.includes('text-left');

  const isDarkHeader = className.includes('text-white') || (colKey && colKey.startsWith('st_'));

  const handleClick = (e) => {
    if (sortKey && onSort) {
      onSort(sortKey);
    }
    if (rest.onClick) {
      rest.onClick(e);
    }
  };

  return (
    <th
      data-col={colKey}
      rowSpan={rowSpan}
      colSpan={colSpan}
      style={styleObj}
      className={`relative group/th select-none ${colKey ? `th-col-${colKey}` : ''} ${sortKey && onSort ? 'cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all' : ''} ${className}`}
      onClick={handleClick}
      title={sortKey && onSort ? `Click to sort by this column (${isSorted ? (isAsc ? 'ascending → descending' : 'descending → default') : 'ascending'})` : undefined}
      {...rest}
    >
      <div className={`flex items-center ${isLeftAlign ? 'justify-between' : 'justify-center'} gap-0.5 w-full h-full`}>
        <div className="flex-1 min-w-0">{children}</div>
        {sortKey && onSort && (
          <span className="sort-indicator-icon inline-flex items-center shrink-0 print:hidden select-none ml-0.5" aria-hidden="true">
            {isAsc ? (
              <ChevronUp size={11} className={isDarkHeader ? "text-amber-300 font-black drop-shadow-2xs" : "text-indigo-700 dark:text-indigo-400 font-black"} />
            ) : isDesc ? (
              <ChevronDown size={11} className={isDarkHeader ? "text-amber-300 font-black drop-shadow-2xs" : "text-indigo-700 dark:text-indigo-400 font-black"} />
            ) : (
              <ArrowUpDown size={8.5} className={isDarkHeader ? "text-white/60 group-hover/th:text-white transition-opacity" : "text-slate-500 group-hover/th:text-slate-900 dark:text-slate-400 transition-opacity"} />
            )}
          </span>
        )}
      </div>
      {colKey && onResize && (
        <div
          onMouseDown={onMouseDown}
          onClick={(e) => e.stopPropagation()}
          className="no-print absolute top-0 right-0 w-2.5 h-full cursor-col-resize opacity-0 group-hover/th:opacity-100 hover:opacity-100 hover:bg-amber-500 bg-indigo-400/40 transition-all z-30 flex items-center justify-center"
          title="Click & Drag to resize column width"
        >
          <div className="w-[1.5px] h-3 bg-white rounded-full opacity-80" />
        </div>
      )}
    </th>
  );
}

function ResizableDataRow({ rowHeight, onResize, className = '', children, ...rest }) {
  const isNearBottomEdge = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return rect.bottom - event.clientY <= 7;
  };

  const handleMouseMove = (event) => {
    event.currentTarget.style.cursor = isNearBottomEdge(event) ? 'row-resize' : '';
  };

  const handleMouseDown = (event) => {
    if (!isNearBottomEdge(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startHeight = rowHeight;

    const onMouseMove = (moveEvent) => {
      const nextHeight = Math.min(MAX_REGISTER_ROW_HEIGHT, Math.max(MIN_REGISTER_ROW_HEIGHT, Math.round(startHeight + moveEvent.clientY - startY)));
      onResize(nextHeight);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <tr
      {...rest}
      className={`register-resizable-row ${className}`}
      style={{ height: `${rowHeight}px`, '--register-row-height': `${rowHeight}px` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={(event) => { event.currentTarget.style.cursor = ''; }}
      onMouseDown={handleMouseDown}
      title="Drag the lower edge to resize every row on both register pages"
    >
      {children}
    </tr>
  );
}

// Convert date (DD-MM-YYYY or YYYY-MM-DD) to formal English words
export function formatDateToWords(dateStr) {
  if (!dateStr) return '—';
  try {
    let clean = String(dateStr).trim();
    let day = 0, month = 0, year = 0;
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
    } else if (clean.includes('/')) {
      const parts = clean.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
    if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) return clean;

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = months[month - 1] || '';

    const ones = [
      "", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
      "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
      "Twenty-First", "Twenty-Second", "Twenty-Third", "Twenty-Fourth", "Twenty-Fifth", "Twenty-Sixth", "Twenty-Seventh", "Twenty-Eighth", "Twenty-Ninth", "Thirtieth", "Thirty-First"
    ];

    const yOnes = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const yTens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function yearToWords(y) {
      if (y >= 2000 && y <= 2099) {
        const rem = y % 2000;
        if (rem === 0) return "Two Thousand";
        if (rem < 20) return "Two Thousand " + yOnes[rem];
        return "Two Thousand " + yTens[Math.floor(rem / 10)] + (rem % 10 > 0 ? " " + yOnes[rem % 10] : "");
      }
      if (y >= 1900 && y <= 1999) {
        const rem = y % 1900;
        let w = "Nineteen Hundred";
        if (rem > 0) {
          if (rem < 20) w += " " + yOnes[rem];
          else w += " " + yTens[Math.floor(rem / 10)] + (rem % 10 > 0 ? " " + yOnes[rem % 10] : "");
        }
        return w;
      }
      return String(y);
    }

    const dayWord = ones[day] || String(day);
    const yWord = yearToWords(year);
    return `${dayWord} of ${monthName} ${yWord}`;
  } catch (e) {
    return String(dateStr);
  }
}

// Clean helper values
function cleanStr(val) {
  if (!val || val === '—' || val === 'N/A' || val === 'undefined' || val === 'null' || val === '-') return '';
  return String(val).trim();
}

function firstCleanValue(record, keys) {
  if (!record) return '';
  for (const key of keys) {
    const value = cleanStr(record[key]);
    if (value) return value;
  }
  return '';
}

function firstRawValue(record, keys) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function renderOnlineSubmCell(status) {
  if (!status) return '—';
  const str = String(status).trim();
  const parts = str.split(' ');
  if (parts.length >= 2) {
    const datePart = parts[0];
    const timePart = parts.slice(1).join(' ');
    return (
      <div className="flex flex-col justify-center items-start leading-tight">
        <span className="whitespace-nowrap font-medium text-[7.5px]">{datePart}</span>
        <span className="whitespace-nowrap text-[6.5px] text-slate-500 font-normal">{timePart}</span>
      </div>
    );
  }
  return <span className="whitespace-nowrap font-medium text-[7.5px]">{str}</span>;
}

function renderAdmDateCell(date) {
  if (!date || date === '—') return '—';
  return <span className="whitespace-nowrap font-bold text-[8px] ledger-mono-font">{date}</span>;
}

function renderPenCell(pen) {
  if (!pen || pen === 'NA' || pen === '—') return 'NA';
  const str = String(pen).trim();
  if (str.includes(',')) {
    const parts = str.split(',');
    return (
      <div className="flex flex-col items-center justify-center leading-tight break-all max-w-full">
        <span className="font-bold text-[7px] break-all">{parts[0].trim()}</span>
        {parts[1] && <span className="text-[6px] text-slate-600 font-medium break-all">{parts[1].trim()}</span>}
      </div>
    );
  }
  return <div className="break-all max-w-full leading-tight text-[7px]">{str}</div>;
}

function renderAdmittedVideCell(val) {
  if (!val || val === '—' || val === '-') return '—';
  const str = String(val).trim();
  if (str.includes(';')) {
    const parts = str.split(';');
    const noPart = parts[0].trim();
    const datePart = parts.slice(1).join(';').trim();
    return (
      <div className="flex flex-col items-center justify-center leading-tight">
        <span className="font-bold text-[7.5px] leading-none">{noPart}{datePart ? ';' : ''}</span>
        {datePart && (
          <span className="whitespace-nowrap font-medium text-[7px] text-emerald-950 mt-0.5 leading-none">
            {datePart}
          </span>
        )}
      </div>
    );
  }
  return <span className="leading-tight break-words">{str}</span>;
}

const BOARD_REGISTRATION_KEYS = [
  'boardRegNo', 'Board Registration Number', 'Board Registration No.', 'Board Registration No',
  'Board Reg. No.', 'Board Reg No', 'Board Registration No. (Class 12th)',
  'Board Registration No. (Class 11th)', 'Board Registration No. (Class 10th)',
  'Board Registration No. (Class 9th)', 'Registration No. (allotted by JKBOSE)',
  'Registration No. (allotted by JKBOSE )', 'Registration Number', 'Registration No.',
  'Registration No', 'Reg. No.', 'Reg No', 'boardReg', 'regNo'
];

const BOARD_ROLL_KEYS = [
  'Exam R.No. (Current)', 'Exam R. No. (Current)', 'Exam R.No.(Current)', 'Exam R. No.(Current)',
  'currExamRollNo', 'currExamRoll', 'exam_r_no_current', 'examRollNoCurrent',
  'examRollNo', 'examRoll', 'boardRollNo', 'boardRoll', 'board_roll_no',
  'Board Roll No.', 'Board Roll No', 'Board Roll Number', 'Exam Roll No.',
  'Exam Roll No', 'Exam Roll Number', 'Roll No. (Current Examination)', 'Roll No. (Current Exam)',
  'Board Examination Roll No.', 'Board Exam Roll No.', 'Exam R.No.', 'Exam R. No.',
  'Exam R.No', 'Exam R. No'
];

const CURRENT_RESULT_KEYS = [
  'Result (Current)', 'result_current', 'currResult', 'currentResult',
  'boardResult', 'Board Result', 'Result', 'result', 'Result Status', 'resultStatus',
  'Current Result', 'Result (Current Examination)', 'Result (Current Exam)',
  'examResult', 'Exam Result'
];

const CURRENT_MARKS_KEYS = [
  'Marks/Reapp (Current)', 'currMarksReapp', 'marks_reapp_current',
  'Marks Obtained (Current)', 'Marks Obtained', 'Marks Obt.', 'Total Marks Obtained',
  'marksObt', 'currMarks', 'marks', 'Marks', 'marksReapp', 'reappSubjects', 'Reappear Subjects',
  'Subjects to Reappear (Class 11th)', 'Subjects to Reappear (Class 10th)',
  'Marks/Reapp', 'marks_reapp', 'Marks/Reapp (Prev.)', 'Marks Obt. (Prev.)'
];

export { formatResultMarksString };

export const ALL_SENTUP_COLS = [
  { key: 'st_sno', label: 'S.No. [Adm No.]' },
  { key: 'st_rollNo', label: 'Class Roll No.' },
  { key: 'st_photo', label: 'Photo' },
  { key: 'st_boardReg', label: 'Board Reg. No.' },
  { key: 'st_name', label: "Student's Name" },
  { key: 'st_parentage', label: 'Parentage' },
  { key: 'st_dob', label: 'Date of Birth' },
  { key: 'st_subs', label: 'Subjects' },
  { key: 'st_boardRoll', label: 'Board Roll No.' },
  { key: 'st_result', label: 'Result' },
  { key: 'st_admitReceipt', label: 'Admit Card Receipt' },
  { key: 'st_marksReceipt', label: 'Marks Card Receipt' }
];

const ADMISSION_NO_KEYS = [
  'admNo', 'admissionNo', 'admissionNumber', 'Admission Number', 'Admission No.', 'Admission No',
  'Adm. No.', 'Adm No.', 'Adm No', 'Adm_No', 'adm_no', 'adm_number', 'admission_no',
  'admn_no', 'assignedAdmNo', 'assignedAdmissionNo', 'admission_register_no', 'registerAdmNo'
];

const ADMISSION_DATE_KEYS = [
  'admDate', 'admissionDate', 'Date of Admission', 'Admission Date', 'Adm. Date', 'Adm Date',
  'adm_date', 'admission_date', 'dateOfAdmission', 'admittedDate', 'admission_date_time',
  'onlineSubmDate', 'Online Submission Date', 'submittedAt', 'createdAt', 'updatedAt'
];

const IFSC_KEYS = [
  'ifsc', 'ifscCode', 'IFSC', 'IFSC code', 'IFSC Code', 'Bank IFSC', 'Branch IFSC',
  'ifsc_code', 'ifsc_Code', 'branchIfsc', 'bankIfsc', 'Ifsc', 'Bank IFSC Code'
];

const BANK_ACCOUNT_KEYS = [
  'bankAccount', 'bank_account', 'Bank Account No.', 'Bank Account Number',
  'Account Number', 'A/C No.', 'accountNo', 'account', 'accNo', 'account_no',
  'Account No.', 'Account No', 'Bank A/C No'
];

const ADMITTED_VIDE_KEYS = [
  'prevCcDc', 'prevCC',
  'CC/DC No. & Date (Prev. insitution)',
  'CC/DC No. & Date (Prev. institution)',
  'CC/DC No. & Date (Previous Institution)',
  'Admitted Vide DC/CC', 'Admtd. Vide DC/CC',
  'Admitted vide CC/DC', 'Admission Vide DC/CC', 'DC/CC Details',
  'dcNo', 'ccNo', 'slcNo', 'transferCertificate', 'prev_cc_dc',
  'admittedVide', 'admitted_vide'
];

const WITHDRAWAL_DATE_KEYS = [
  'withdrawalDate', 'Date of withdrawl/result', 'Date of withdrawl',
  'Date of withdrawal', 'Result Date', 'Withdrawal Date', 'Date withdrawl'
];

const ISSUED_CC_KEYS = [
  'currCcDc', 'No. & Date of CC/DC Issued (This Institution)',
  'No. & Date of CC/DC Issued', 'CC/DC No. & Date', 'ccDcNo',
  'Certf. No.', 'cc/dc s.no.', 'Certf No'
];

const CC_RECEIPT_KEYS = [
  'ccDcReceipt', 'CC/DC Receipt', 'Certificate Receipt',
  'receivedCcDc', 'Received CC/DC'
];

function formatBloodGroup(value) {
  const normalized = cleanStr(value);
  return !normalized || /^(unknown|not known|na|n\/a|nil|none)$/i.test(normalized)
    ? '-'
    : normalized;
}

function StreamLabel({ value }) {
  const text = cleanStr(value) || 'Humanities';
  return <span className="font-bold">{text}</span>;
}

function getBoardRegistration(record, classValue) {
  const numericClass = parseInt(cleanStr(classValue || record?.class || record?.Class || record?.['Admission sought for class']), 10);
  const preferredKey = numericClass === 12
    ? 'Board Registration No. (Class 11th)'
    : numericClass === 11
      ? 'Board Registration No. (Class 10th)'
      : numericClass === 10
        ? 'Board Registration No. (Class 9th)'
        : numericClass === 9
          ? 'DIET Registration No.'
          : '';
  return firstCleanValue(record, preferredKey ? [preferredKey, ...BOARD_REGISTRATION_KEYS] : BOARD_REGISTRATION_KEYS);
}

export function normalizeBoardRegKey(reg) {
  if (!reg) return '';
  const cleaned = String(reg).trim().toUpperCase().replace(/[\s\-_/]/g, '');
  if (/^(—|-|#?N\/A|NA|NILL|NIL|NULL|UNDEFINED|NONE|0|ST|STUDENT)$/i.test(cleaned)) return '';
  if (cleaned.length < 5) return '';
  return cleaned;
}

function getPreviousClassLabel(classValue) {
  const numericClass = parseInt(cleanStr(classValue), 10);
  if (numericClass === 12) return '11th';
  if (numericClass === 11) return '10th';
  // The current admission form stores junior-school history against Class 8th.
  if (numericClass === 10 || numericClass === 9) return '8th';
  return '';
}

function getPreviousAcademicValue(record, classValue, fieldPrefix, fallbackKeys = []) {
  const previousClass = getPreviousClassLabel(classValue);
  const keys = previousClass
    ? [`${fieldPrefix} (${previousClass})`, `${fieldPrefix} ${previousClass}`, ...fallbackKeys]
    : fallbackKeys;
  return firstCleanValue(record, keys);
}

function valueAsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  if (typeof value === 'object' && Number.isFinite(value.seconds)) {
    const converted = new Date(value.seconds * 1000);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const text = cleanStr(value);
  if (!text) return null;
  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const converted = new Date(
      Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]),
      Number(dmy[4] || 0), Number(dmy[5] || 0), Number(dmy[6] || 0)
    );
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const converted = new Date(text);
  return Number.isNaN(converted.getTime()) ? null : converted;
}

function formatRegisterDate(value, includeTime = false) {
  const date = valueAsDate(value);
  if (!date) return cleanStr(value);
  const datePart = [date.getDate(), date.getMonth() + 1, date.getFullYear()]
    .map((part, index) => index < 2 ? String(part).padStart(2, '0') : String(part))
    .join('-');
  if (!includeTime) return datePart;
  const timePart = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(part => String(part).padStart(2, '0'))
    .join(':');
  return `${datePart} ${timePart}`;
}

// Robust Subject Extractor across all Firebase form variations & array types
export function extractStudentSubjects(s, targetClass = '') {
  if (!s) return '—';

  const cls = targetClass || s.class || s.Class || s['Admission sought for class'] || '';
  const tier = getClassTier(cls);

  // 1. Array or string candidates restricted by academic tier
  let candidates = [];
  if (tier === 'higher') {
    candidates = [
      s['Subjects to be taken in Class 12th'],
      s['Subjects to be taken in Class 11th'],
      s['Stream & Subjects for Class 12th'],
      s['Stream & Subjects for Class 11th'],
      s['Subjects Studied in Class 11th'],
      s['selectedSubjects'],
      s['Subjects Chosen'],
      s['Chosen Subjects'],
      s['Subjects'],
      s['subjects'],
      s['Subs'],
      s['subs']
    ];
  } else if (tier === 'secondary') {
    candidates = [
      s['Subjects to be taken in Class 10th'],
      s['Subjects to be taken in Class 9th'],
      s['Subjects Studied in Class 10th'],
      s['Subjects Studied in Class 9th'],
      s['selectedSubjects'],
      s['Subjects Chosen'],
      s['Chosen Subjects'],
      s['Subjects'],
      s['subjects'],
      s['Subs'],
      s['subs']
    ];
  } else {
    candidates = [
      s['Subjects to be taken in Class 12th'],
      s['Subjects to be taken in Class 11th'],
      s['Subjects to be taken in Class 10th'],
      s['Subjects to be taken in Class 9th'],
      s['Subjects Studied in Class 11th'],
      s['selectedSubjects'],
      s['Subjects Chosen'],
      s['Chosen Subjects'],
      s['Subjects'],
      s['subjects'],
      s['Subs'],
      s['subs']
    ];
  }

  for (const item of candidates) {
    if (!item) continue;
    if (Array.isArray(item) && item.length > 0) {
      const cleaned = item.filter(sub => sub && String(sub).trim() !== '—' && !String(sub).toLowerCase().includes('same as')).map(sub => String(sub).trim());
      if (cleaned.length > 0) {
        const joined = cleaned.join(', ');
        if (tier === 'higher' && isSecondaryOnlySubjectList(joined)) continue;
        return joined;
      }
    } else if (typeof item === 'string' && item.trim() && item.trim() !== '—' && !item.toLowerCase().includes('same as')) {
      if (tier === 'higher' && isSecondaryOnlySubjectList(item.trim())) continue;
      return item.trim();
    }
  }

  // 2. Individual subjects1..6 fields
  const subjList = [];
  const subjKeys = [
    'Subjects1', 'Subjects2', 'Subjects3', 'Subjects4', 'Subjects5', 'Subjects6', 'Subject6',
    'subject1', 'subject2', 'subject3', 'subject4', 'subject5', 'subject6'
  ];
  subjKeys.forEach(k => {
    const val = s[k];
    if (val && typeof val === 'string' && val.trim() && val.trim() !== '—' && !subjList.includes(val.trim())) {
      subjList.push(val.trim());
    }
  });

  if (subjList.length > 0) {
    const joined = subjList.join(', ');
    if (!(tier === 'higher' && isSecondaryOnlySubjectList(joined))) {
      return joined;
    }
  }

  return '—';
}

// Robust Subject Abbreviation Formatter (converts full subject names to standard register abbreviations)
export function abbreviateSubjects(str) {
  if (!str || str === '—' || str === '-') return '—';
  const parts = String(str).split(/[,/&]+/).map(s => s.trim()).filter(Boolean);
  const map = {
    'General English': 'EN',
    'English': 'EN',
    'GE': 'EN',
    'GN': 'EN',
    'EN': 'EN',
    'Physics': 'PH',
    'PH': 'PH',
    'Chemistry': 'CH',
    'CH': 'CH',
    'Biology': 'BI',
    'BIO': 'BI',
    'Botany': 'BI',
    'Zoology': 'BI',
    'BI': 'BI',
    'Mathematics': 'MA',
    'Maths': 'MA',
    'Math': 'MA',
    'MA': 'MA',
    'Environmental Science': 'ES',
    'EVS': 'ES',
    'ES': 'ES',
    'Physical Education': 'PD',
    'Physical Education & Sports': 'PD',
    'PES': 'PD',
    'PD': 'PD',
    'Health Care': 'HTC',
    'Healthcare': 'HTC',
    'HTC': 'HTC',
    'IT & ITES': 'ITE',
    'IT and ITES': 'ITE',
    'ITE': 'ITE',
    'History': 'HT',
    'HT': 'HT',
    'Political Science': 'PS',
    'PS': 'PS',
    'Economics': 'EC',
    'EC': 'EC',
    'Education': 'ED',
    'ED': 'ED',
    'Urdu': 'UR',
    'UD': 'UR',
    'UR': 'UR',
    'Sociology': 'SO',
    'SO': 'SO',
    'Public Administration': 'PA',
    'PUB': 'PA',
    'PA': 'PA',
    'Arabic': 'AR',
    'AR': 'AR',
    'Kashmiri': 'KA',
    'KA': 'KA',
    'Hindi': 'HI',
    'HI': 'HI',
    'Geography': 'GEO',
    'Accountancy': 'ACC',
    'Business Studies': 'BST',
    'Retail': 'RET',
    'Tourism': 'TOU'
  };

  const abbrParts = parts.map(part => {
    if (map[part]) return map[part];
    const foundKey = Object.keys(map).find(k => k.toLowerCase() === part.toLowerCase());
    if (foundKey) return map[foundKey];

    if (/general english|functional english|english/i.test(part)) return 'EN';
    if (/math/i.test(part)) return 'MA';
    if (/physics/i.test(part)) return 'PH';
    if (/chemistry/i.test(part)) return 'CH';
    if (/biology|botany|zoology/i.test(part)) return 'BI';
    if (/environmental|evs/i.test(part)) return 'ES';
    if (/health/i.test(part)) return 'HTC';
    if (/it and ites|it & ites|information tech|ites/i.test(part)) return 'ITE';
    if (/physical education/i.test(part)) return 'PD';
    if (/history/i.test(part)) return 'HT';
    if (/political/i.test(part)) return 'PS';
    if (/sociology/i.test(part)) return 'SO';
    if (/economics/i.test(part)) return 'EC';
    if (/education/i.test(part)) return 'ED';
    if (/urdu/i.test(part)) return 'UR';
    if (/arabic/i.test(part)) return 'AR';
    if (/kashmiri/i.test(part)) return 'KA';
    if (/hindi/i.test(part)) return 'HI';
    if (/geography/i.test(part)) return 'GEO';
    if (/account/i.test(part)) return 'ACC';
    if (/business/i.test(part)) return 'BST';

    if (part.length > 4) {
      return part.slice(0, 3).toUpperCase();
    }
    return part.toUpperCase();
  });

  return abbrParts.join(', ');
}

// Robust Standard Stream Extractor & Normalizer (Strictly Science or Humanities for 11th & 12th)
export function extractStudentStream(s, subs = '') {
  if (!s) return 'General';
  const cls = cleanStr(s.class || s.Class || s['Admission sought for class'] || '');
  if (cls.includes('9') || cls.includes('10')) return 'General';

  let rawStream = cleanStr(
    s['Stream / Subject combination chosen'] ||
    s['Stream chosen'] ||
    s['Stream & Subjects for Class 11th'] ||
    s['Stream & Subjects for Class 12th'] ||
    s['Stream'] ||
    s.stream ||
    s.Stream ||
    ''
  );

  // If raw stream is invalid placeholder like "Same as in class 11th" or dashes, clean it
  if (/same as/i.test(rawStream) || rawStream === '—' || rawStream === '-') {
    rawStream = '';
  }

  // Check subjects for accurate determination
  const subText = (typeof subs === 'string' ? subs : JSON.stringify(subs)).toUpperCase();
  const hasScience = /\b(BI|BIO|BIOLOGY|BOTANY|ZOOLOGY|PH|PHYSICS|CH|CHEMISTRY|MA|MATH|MATHS|MATHEMATICS)\b/i.test(subText);
  const hasHumanities = /\b(HT|PS|UR|ED|SO|AR|KA|HI|GEO|HISTORY|POLITICAL|EDUCATION|URDU|SOCIOLOGY|ARABIC|KASHMIRI|ARTS|HUMANITIES)\b/i.test(subText);

  if (hasScience && !hasHumanities) {
    return 'Science';
  }
  if (hasHumanities && !hasScience) {
    return 'Humanities';
  }
  if (hasScience) {
    return 'Science';
  }

  // Normalize rawStream string if present
  if (rawStream) {
    const low = rawStream.toLowerCase();
    if (low.includes('sci') || low.includes('med') || low.includes('bio') || low.includes('non')) return 'Science';
    if (low.includes('art') || low.includes('human') || low.includes('soc')) return 'Humanities';
    if (low.includes('comm')) return 'Commerce';
  }

  return 'Humanities'; // Standard fallback for 11th/12th
}

// Check if student has been assigned a Class Roll Number
export function hasAssignedClassRollNo(s) {
  return hasAssignedClassRollNumber(s);
}

// Business status evaluation: Approved strictly means those assigned a Class Roll Number
function resolveEffectiveStatus(s) {
  return resolveStudentAdmissionStatus(s);
}

function matchesClassVal(selectedClasses, classVal) {
  if (!selectedClasses || selectedClasses === 'ALL') return true;
  const strVal = String(classVal ?? '').trim().toLowerCase();
  const cleanVal = strVal.replace(/class/gi, '').trim();
  const targetClean = String(selectedClasses).toLowerCase().replace(/class/gi, '').trim();
  if (cleanVal === targetClean) return true;

  // Handle paired combinations like '11th & 12th', '9th & 10th', '11th, 12th', '11th-12th', '11th and 12th'
  if (targetClean.includes('&') || targetClean.includes(',') || targetClean.includes('-') || targetClean.includes('and')) {
    const targetDigits = targetClean.match(/\d+/g) || [];
    const valDigit = cleanVal.match(/\d+/)?.[0];
    if (valDigit && targetDigits.includes(valDigit)) return true;
  }

  const d1 = targetClean.match(/\d+/)?.[0];
  const d2 = cleanVal.match(/\d+/)?.[0];
  return !!(d1 && d2 && d1 === d2);
}

// Strict session equality matcher (prevents past session data leaking into current examination fields)
function isSameAcademicSession(sessA, sessB) {
  const sA = cleanStr(sessA).toLowerCase();
  const sB = cleanStr(sessB).toLowerCase();
  if (!sA || !sB) return false;
  if (sA === sB) return true;
  const cleanA = sA.replace(/[^a-z0-9]/g, '');
  const cleanB = sB.replace(/[^a-z0-9]/g, '');
  if (cleanA === cleanB) return true;
  const yearA = sA.match(/\d{4}/)?.[0];
  const yearB = sB.match(/\d{4}/)?.[0];
  if (yearA && yearB && yearA !== yearB) return false;
  return cleanA.includes(cleanB) || cleanB.includes(cleanA);
}

function formatBoardRegSplit(val) {
  const s = cleanStr(val);
  if (!s) return '—';
  if (s.length > 12) {
    return (
      <div className="leading-tight text-left font-mono text-[13px] st-reg-split">
        <span className="font-black text-slate-900 dark:text-slate-100 tracking-tight">{s.substring(0, 12)}</span>
        <br />
        <span className="font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">{s.substring(12)}</span>
      </div>
    );
  }
  return <span className="font-black font-mono text-[13px] tracking-tight">{s}</span>;
}

export default function AdmissionRegisterSuite({
  students: propStudents,
  allHistory: propAllHistory,
  onClose: propOnClose,
  onDataUpdated,
  user: propUser,
  initialTab = 'adm_register'
}) {
  const navigate = useNavigate();
  const suiteRootRef = useRef(null);
  const outletCtx = useOutletContext?.() || {};
  const user = propUser || outletCtx?.user;
  const onClose = propOnClose || (() => navigate('/portal/admin'));

  // Main Suite Tab: 'adm_register' | 'sentup' | 'assign_ids' | 'assign_dates'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sub-view Tab for Admission Register: 'all' | 'cover' | 'spreads' | 'summary' | 'notes'
  const [registerViewSection, setRegisterViewSection] = useState('all');

  // Spread Layout Mode on Screen: 'side_by_side' (Book View) | 'stacked'
  const [spreadLayoutMode, setSpreadLayoutMode] = useState('side_by_side');

  // Print & Layout Configuration (DEFAULT: 0.3 INCH DYNAMIC MARGINS ON LEGAL LANDSCAPE)
  const [printMargin, setPrintMargin] = useState(() => {
    try {
      const cached = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.printMargin === 'number') {
          return Math.min(0.8, Math.max(0.05, parsed.printMargin));
        }
      }
    } catch (_) {}
    return 0.3;
  });
  const [showMarginControls, setShowMarginControls] = useState(false);

  // Global Filter States
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedStatus, setSelectedStatus] = useState('Approved'); // 'Approved' (Default) | 'Submitted' | 'Provisional' | 'ALL'
  const [selectedAdmissionType, setSelectedAdmissionType] = useState('ALL'); // 'ALL' | 'fresh' | 'readmission'
  const [selectedClass, setSelectedClass] = useState('11th'); // DEFAULT: Class 11th
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [toast, setToast] = useState(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  // Detect whether currently selected session is APR/BIAN (Bi-annual / Private cohort)
  const isAprBianSession = useMemo(() => {
    return /\b(apr|bian|biannual|bi-annual|private|pvt)\b/i.test(selectedSession || '');
  }, [selectedSession]);

  // Dynamic Column Sorting State: { key: null | string, direction: 'asc' | 'desc' }
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = useCallback((key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        }
        return { key: null, direction: 'asc' }; // Reset to default on 3rd click
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const handleResetSort = useCallback(() => {
    setSortConfig({ key: null, direction: 'asc' });
  }, []);

  const getSortColumnLabel = useCallback((key) => {
    const map = {
      rollNo: 'Class Roll No.',
      boardRollNo: 'Board Roll No.',
      admNo: 'Adm. No.',
      sno: 'S.No.',
      name: "Student's Name",
      father: "Parentage / Father",
      mother: "Mother's Name",
      class: 'Class',
      boardReg: 'Board Reg. No.',
      dobFigures: 'Date of Birth',
      dobWords: 'DoB (Words)',
      gender: 'Gender',
      village: 'Village',
      block: 'Block',
      tehsil: 'Tehsil',
      district: 'District',
      mobile: 'Student Mobile',
      parentMobile: 'Parent Mobile',
      stream: 'Stream',
      subs: 'Subjects',
      aadhar: 'Aadhar No.',
      category: 'Category',
      socioEcon: 'Socio-Econ',
      blood: 'Blood Group',
      account: 'Bank Account',
      prevSchool: 'Previous School',
      prevRoll: 'Prev. Roll No.',
      prevResult: 'Prev. Result',
      pen: 'PEN No.',
      prevCC: 'Admitted Vide',
      withdrawal: 'Withdrawal / Result Date',
      issuedCC: 'Issued CC',
      receipt: 'Receipt',
      remarks: 'Remarks',
      currentResult: 'Result',
      admitReceipt: 'Admit Card Receipt',
      marksReceipt: 'Marks Card Receipt',
      formNo: 'Form No.',
      admDate: 'Admission Date'
    };
    return map[key] || key;
  }, []);

  // Sync selected session and class to sessionStorage for seamless cohort continuity
  useEffect(() => {
    if (selectedSession && selectedSession !== 'ALL') {
      try { sessionStorage.setItem('hss_last_selected_session', selectedSession); } catch (_) {}
    }
  }, [selectedSession]);

  useEffect(() => {
    if (selectedClass && selectedClass !== 'ALL') {
      try { sessionStorage.setItem('hss_last_selected_class', selectedClass); } catch (_) {}
    }
  }, [selectedClass]);

  // Popover Dropdown States for Consolidated Toolbar
  const [showFiltersPopover, setShowFiltersPopover] = useState(false);
  const [showViewPopover, setShowViewPopover] = useState(false);
  const [showSentupColsPopover, setShowSentupColsPopover] = useState(false);
  const filtersPopoverRef = useRef(null);
  const viewPopoverRef = useRef(null);
  const sentupColsPopoverRef = useRef(null);

  // Sentup Table Column Visibility State (Persisted in Local Storage)
  const [sentupHiddenCols, setSentupHiddenCols] = useState(() => {
    try {
      const cached = localStorage.getItem('hss_sentup_hidden_cols');
      if (cached) return new Set(JSON.parse(cached));
    } catch (_) {}
    return new Set();
  });

  const [sentupExplicitCols, setSentupExplicitCols] = useState(() => {
    try {
      const cached = localStorage.getItem('hss_sentup_explicit_cols');
      if (cached) return new Set(JSON.parse(cached));
    } catch (_) {}
    return new Set();
  });

  const isSentupColVisible = useCallback((colKey) => {
    if (sentupHiddenCols.has(colKey)) return false;
    // MANDATORY USER RULE: do not show class roll no column by default in APR/BIAN sentups
    if (colKey === 'st_rollNo' && isAprBianSession && !sentupExplicitCols.has('st_rollNo')) {
      return false;
    }
    return true;
  }, [sentupHiddenCols, isAprBianSession, sentupExplicitCols]);

  const toggleSentupCol = useCallback((colKey) => {
    const currentlyVisible = isSentupColVisible(colKey);
    setSentupHiddenCols(prev => {
      const next = new Set(prev);
      if (currentlyVisible) {
        next.add(colKey);
      } else {
        next.delete(colKey);
      }
      try {
        localStorage.setItem('hss_sentup_hidden_cols', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });

    setSentupExplicitCols(prev => {
      const next = new Set(prev);
      if (!currentlyVisible) {
        next.add(colKey);
      } else {
        next.delete(colKey);
      }
      try {
        localStorage.setItem('hss_sentup_explicit_cols', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });
    setIsLayoutModified(true);
  }, [isSentupColVisible]);

  const resetSentupCols = useCallback(() => {
    setSentupHiddenCols(new Set());
    setSentupExplicitCols(new Set());
    try {
      localStorage.removeItem('hss_sentup_hidden_cols');
      localStorage.removeItem('hss_sentup_explicit_cols');
    } catch (_) {}
    setIsLayoutModified(true);
    setToast({ message: '✨ Sentup table columns reset to default layout!', type: 'success' });
  }, []);

  const handleSessionChange = useCallback((newSession) => {
    if (newSession === selectedSession) return;
    setIsLoadingSession(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        setSelectedSession(newSession);
        setIsLoadingSession(false);
      }, 40);
    });
  }, [selectedSession]);

  const handleResetFilters = useCallback(() => {
    setIsLoadingSession(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        setSelectedSession('2025-26');
        setSelectedStatus('Approved');
        setSelectedAdmissionType('ALL');
        setSelectedStream('ALL');
        setIsLoadingSession(false);
      }, 40);
    });
  }, []);

  // ─── DYNAMIC COLUMN WIDTHS & ROW HEIGHT STATE (FIREBASE + LOCAL STORAGE PRESERVED) ───
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const cached = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.columnWidths && typeof parsed.columnWidths === 'object') {
          const cachedReg = parsed.columnWidths.st_boardReg;
          const regWidth = (!cachedReg || cachedReg >= 130) ? DEFAULT_COLUMN_WIDTHS.st_boardReg : cachedReg;
          return {
            ...DEFAULT_COLUMN_WIDTHS,
            ...parsed.columnWidths,
            st_boardReg: regWidth,
            st_name: Math.max(DEFAULT_COLUMN_WIDTHS.st_name, parsed.columnWidths.st_name || 0),
            st_subs: Math.min(DEFAULT_COLUMN_WIDTHS.st_subs, parsed.columnWidths.st_subs || DEFAULT_COLUMN_WIDTHS.st_subs),
            st_boardRoll: Math.min(DEFAULT_COLUMN_WIDTHS.st_boardRoll, parsed.columnWidths.st_boardRoll || DEFAULT_COLUMN_WIDTHS.st_boardRoll),
            st_parentage: Math.max(DEFAULT_COLUMN_WIDTHS.st_parentage, parsed.columnWidths.st_parentage || 0)
          };
        }
      }
    } catch (_) {}
    return DEFAULT_COLUMN_WIDTHS;
  });

  const [rowHeight, setRowHeight] = useState(() => {
    try {
      const cached = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.rowHeight === 'number') {
          return Math.min(MAX_REGISTER_ROW_HEIGHT, Math.max(MIN_REGISTER_ROW_HEIGHT, parsed.rowHeight));
        }
      }
    } catch (_) {}
    return DEFAULT_ROW_HEIGHT;
  });

  const [rowHeightInput, setRowHeightInput] = useState(() => String(rowHeight));

  useEffect(() => {
    setRowHeightInput(String(rowHeight));
  }, [rowHeight]);

  // Paper Size ('indian_legal' [13.7in x 8.5in Default] | 'legal' [14in x 8.5in] | 'a4' [11.7in x 8.3in])
  const [paperSize, setPaperSize] = useState(() => {
    try {
      const cached = localStorage.getItem('hss_register_paper_size');
      if (cached && ['indian_legal', 'legal', 'a4'].includes(cached)) return cached;
    } catch (_) {}
    return 'indian_legal'; // MANDATORY USER DEFAULT: 13.7" x 8.5" JKBOSE / Indian Legal Register Paper
  });

  const handlePaperSizeChange = useCallback((size) => {
    const valid = ['indian_legal', 'legal', 'a4'].includes(size) ? size : 'indian_legal';
    setPaperSize(valid);
    try {
      localStorage.setItem('hss_register_paper_size', valid);
      const layoutCached = localStorage.getItem(LAYOUT_STORAGE_KEY);
      const existing = layoutCached ? JSON.parse(layoutCached) : {};
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
        ...existing,
        paperSize: valid,
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
    setIsLayoutModified(true);
  }, []);

  // Candidates / Students per sheet for Admission Register print layout
  const [studentsPerPage, setStudentsPerPage] = useState(() => {
    try {
      const cached = localStorage.getItem('hss_register_students_per_page');
      if (cached) {
        const val = parseInt(cached, 10);
        if (!isNaN(val) && val >= 5 && val <= 30) return val;
      }
      const layoutCached = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (layoutCached) {
        const parsed = JSON.parse(layoutCached);
        if (typeof parsed.studentsPerPage === 'number') return parsed.studentsPerPage;
      }
    } catch (_) {}
    return 15;
  });

  // Candidates / Students per sheet for Sentup Export print layout (DEFAULT: 10, allows 12, 14, 15, 16, 18, 20, 25, or custom)
  const [sentupStudentsPerPage, setSentupStudentsPerPage] = useState(() => {
    try {
      const cached = localStorage.getItem('hss_sentup_students_per_page');
      if (cached) {
        const val = parseInt(cached, 10);
        if (!isNaN(val) && val >= 5 && val <= 30) return val;
      }
      const layoutCached = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (layoutCached) {
        const parsed = JSON.parse(layoutCached);
        if (typeof parsed.sentupStudentsPerPage === 'number') return parsed.sentupStudentsPerPage;
      }
    } catch (_) {}
    return 10; // Default 10 candidates per sheet in Sentup
  });

  const handleSentupStudentsPerPageChange = useCallback((val) => {
    const num = Math.max(5, Math.min(30, parseInt(val, 10) || 10));
    setSentupStudentsPerPage(num);
    try {
      localStorage.setItem('hss_sentup_students_per_page', String(num));
      const layoutCached = localStorage.getItem(LAYOUT_STORAGE_KEY);
      const existing = layoutCached ? JSON.parse(layoutCached) : {};
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
        ...existing,
        sentupStudentsPerPage: num,
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
    setIsLayoutModified(true);
  }, []);

  const [isLayoutModified, setIsLayoutModified] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  // Popover internal tab state & search queries
  const [popoverActiveTab, setPopoverActiveTab] = useState('layout'); // 'layout' | 'columns' | 'subjects'
  const [columnSearchQuery, setColumnSearchQuery] = useState('');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');

  const handlePrintMarginChange = useCallback((newMargin) => {
    const clamped = Math.min(0.8, Math.max(0.05, Math.round(parseFloat(newMargin) * 100) / 100 || 0.3));
    setPrintMargin(clamped);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
        columnWidths,
        rowHeight,
        printMargin: clamped,
        paperSize,
        studentsPerPage,
        sentupStudentsPerPage,
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
    setIsLayoutModified(true);
  }, [columnWidths, rowHeight, paperSize, studentsPerPage, sentupStudentsPerPage]);

  const handleStudentsPerPageChange = useCallback((val) => {
    const num = Math.max(5, Math.min(30, parseInt(val, 10) || 15));
    setStudentsPerPage(num);
    try {
      localStorage.setItem('hss_register_students_per_page', String(num));
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
        columnWidths,
        rowHeight,
        printMargin,
        paperSize,
        studentsPerPage: num,
        sentupStudentsPerPage,
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
    setIsLayoutModified(true);
  }, [columnWidths, rowHeight, printMargin, paperSize, sentupStudentsPerPage]);

  // Helper to detect outdated generic lists with non-school subjects
  const isOldGenericSubjectList = (list) => {
    if (!Array.isArray(list) || list.length === 0) return false;
    return list.some(item => ['pe', 'hsc', 'is', 'pa', 'cs', 'geo', 'so', 'bo', 'zo', 'am'].includes(item?.id) || item?.name === 'Persian' || item?.name === 'Home Science' || item?.name === 'Sociology');
  };

  // Sentup Subject Abbreviations Directory (Configurable in View & Layout, Persisted to Cloud and LocalStorage)
  const [sentupSubjectAbbreviations, setSentupSubjectAbbreviations] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_sentup_subject_abbreviations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && !isOldGenericSubjectList(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load custom subject abbreviations', e);
    }
    return DEFAULT_SENTUP_SUBJECT_DIRECTORY;
  });
  const [savingSubjectsCloud, setSavingSubjectsCloud] = useState(false);

  // Load layout and subject abbreviations from Firebase on mount
  useEffect(() => {
    const loadFirebaseLayout = async () => {
      try {
        let snap = await getDoc(doc(db, 'systemSettings', 'admission_register_layout'));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'system_settings', 'admission_register_layout'));
        }
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'adminSettings', 'admission_register_layout'));
        }
        if (snap.exists()) {
          const data = snap.data();
          if (data.columnWidths && typeof data.columnWidths === 'object') {
            const cleanColWidths = { ...data.columnWidths };
            if (!cleanColWidths.st_boardReg || cleanColWidths.st_boardReg >= 130) {
              cleanColWidths.st_boardReg = DEFAULT_COLUMN_WIDTHS.st_boardReg;
            }
            setColumnWidths(prev => ({ ...prev, ...cleanColWidths }));
          }
          if (data.rowHeight && typeof data.rowHeight === 'number') {
            setRowHeight(Math.min(MAX_REGISTER_ROW_HEIGHT, Math.max(MIN_REGISTER_ROW_HEIGHT, data.rowHeight)));
          }
          if (data.printMargin && typeof data.printMargin === 'number') {
            setPrintMargin(data.printMargin);
          }
          if (data.paperSize && ['indian_legal', 'legal', 'a4'].includes(data.paperSize)) {
            setPaperSize(data.paperSize);
          }
          if (data.studentsPerPage && typeof data.studentsPerPage === 'number') {
            setStudentsPerPage(data.studentsPerPage);
          }
          if (data.sentupStudentsPerPage && typeof data.sentupStudentsPerPage === 'number') {
            setSentupStudentsPerPage(data.sentupStudentsPerPage);
          }
          if (Array.isArray(data.sentupSubjectAbbreviations) && data.sentupSubjectAbbreviations.length > 0) {
            const cleanList = isOldGenericSubjectList(data.sentupSubjectAbbreviations)
              ? DEFAULT_SENTUP_SUBJECT_DIRECTORY
              : data.sentupSubjectAbbreviations;
            setSentupSubjectAbbreviations(cleanList);
            try {
              localStorage.setItem('hss_sentup_subject_abbreviations', JSON.stringify(cleanList));
            } catch (_) {}
          }
          try {
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(data));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Could not load saved register layout from Firebase (using local settings):', err);
      }
    };
    loadFirebaseLayout();
  }, []);

  const handleColumnResize = (colKey, newWidth) => {
    setColumnWidths(prev => {
      const updated = {
        ...prev,
        [colKey]: newWidth
      };
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
          columnWidths: updated,
          rowHeight,
          printMargin,
          paperSize,
          studentsPerPage,
          sentupStudentsPerPage,
          updatedAt: new Date().toISOString()
        }));
      } catch (_) {}
      return updated;
    });
    setIsLayoutModified(true);
  };

  const handleRowHeightChange = (newHeight) => {
    const clamped = Math.min(MAX_REGISTER_ROW_HEIGHT, Math.max(MIN_REGISTER_ROW_HEIGHT, newHeight));
    setRowHeight(clamped);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
        columnWidths,
        rowHeight: clamped,
        printMargin,
        paperSize,
        studentsPerPage,
        sentupStudentsPerPage,
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
    setIsLayoutModified(true);
  };

  const handleSaveLayoutToFirebase = async () => {
    const layoutPayload = {
      columnWidths,
      rowHeight,
      printMargin,
      paperSize,
      studentsPerPage: studentsPerPage || 15,
      sentupStudentsPerPage: sentupStudentsPerPage || 10,
      sentupSubjectAbbreviations,
      updatedAt: new Date().toISOString()
    };

    // 1. Immediately preserve in LocalStorage so settings are NEVER lost
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutPayload));
      localStorage.setItem('hss_sentup_subject_abbreviations', JSON.stringify(sentupSubjectAbbreviations));
      localStorage.setItem('hss_register_students_per_page', String(studentsPerPage || 15));
      localStorage.setItem('hss_sentup_students_per_page', String(sentupStudentsPerPage || 10));
      localStorage.setItem('hss_register_paper_size', paperSize);
    } catch (_) {}

    try {
      setSavingLayout(true);
      let firebaseSaved = false;
      try {
        await setDoc(doc(db, 'systemSettings', 'admission_register_layout'), layoutPayload, { merge: true });
        firebaseSaved = true;
      } catch (err1) {
        try {
          await setDoc(doc(db, 'system_settings', 'admission_register_layout'), layoutPayload, { merge: true });
          firebaseSaved = true;
        } catch (err2) {
          try {
            await setDoc(doc(db, 'adminSettings', 'admission_register_layout'), layoutPayload, { merge: true });
            firebaseSaved = true;
          } catch (_) {}
        }
      }

      setIsLayoutModified(false);
      if (firebaseSaved) {
        setToast({
          message: '✅ Table layout & subject key saved to Cloud and browser storage!',
          type: 'success'
        });
        try {
          logAdminActivity({
            actionType: 'update_register_layout',
            actionTitle: 'Saved Register Layout & Subject Key to Cloud',
            details: `Saved custom register column widths, row height (${rowHeight}px), margin (${printMargin}in), ${studentsPerPage} per sheet, and ${sentupSubjectAbbreviations.length} subject abbreviations to Cloud settings.`,
            metadata: { rowHeight, studentsPerPage, printMargin, subjectCount: sentupSubjectAbbreviations.length }
          });
        } catch (_) {}
      } else {
        setToast({
          message: '💾 Table layout preserved permanently on your browser device!',
          type: 'info'
        });
      }
    } catch (err) {
      console.error('Failed to save layout to Firebase:', err);
      setIsLayoutModified(false);
      setToast({
        message: '💾 Layout preserved locally in browser storage!',
        type: 'info'
      });
    } finally {
      setSavingLayout(false);
    }
  };

  // Dedicated direct cloud-sync function for Subject Abbreviations (Subject Key)
  const saveSubjectAbbreviationsToCloud = useCallback(async (updatedList) => {
    // 1. Immediately update LocalStorage
    try {
      localStorage.setItem('hss_sentup_subject_abbreviations', JSON.stringify(updatedList));
    } catch (_) {}

    // 2. Persist to Cloud Firestore
    setSavingSubjectsCloud(true);
    try {
      const payload = {
        sentupSubjectAbbreviations: updatedList,
        columnWidths,
        rowHeight,
        printMargin,
        studentsPerPage,
        updatedAt: new Date().toISOString()
      };

      let cloudSaved = false;
      try {
        await setDoc(doc(db, 'systemSettings', 'admission_register_layout'), payload, { merge: true });
        cloudSaved = true;
      } catch (err1) {
        try {
          await setDoc(doc(db, 'system_settings', 'admission_register_layout'), payload, { merge: true });
          cloudSaved = true;
        } catch (err2) {
          try {
            await setDoc(doc(db, 'adminSettings', 'admission_register_layout'), payload, { merge: true });
            cloudSaved = true;
          } catch (_) {}
        }
      }

      if (cloudSaved) {
        setToast({
          message: '☁️ Subject abbreviations saved to cloud!',
          type: 'success'
        });
        try {
          logAdminActivity({
            actionType: 'update_sentup_subject_abbreviations',
            actionTitle: 'Updated Sentup Subject Key Directory in Cloud',
            details: `Saved ${updatedList.length} subject abbreviations to cloud system settings.`,
            metadata: { count: updatedList.length }
          });
        } catch (_) {}
      } else {
        setToast({
          message: '💾 Subject abbreviations preserved in browser storage.',
          type: 'info'
        });
      }
    } catch (err) {
      console.error('Failed to save subject abbreviations to cloud:', err);
      setToast({
        message: '💾 Subject abbreviations preserved in browser storage.',
        type: 'info'
      });
    } finally {
      setSavingSubjectsCloud(false);
    }
  }, [columnWidths, rowHeight, printMargin, studentsPerPage]);

  const handleResetLayoutToOriginal = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    setRowHeight(DEFAULT_ROW_HEIGHT);
    setPrintMargin(0.3);
    setStudentsPerPage(15);
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
      localStorage.removeItem('hss_register_students_per_page');
    } catch (_) {}
    setIsLayoutModified(true);
    setToast({
      message: '🔄 Column widths, row heights, print margins, and page density restored to factory defaults.',
      type: 'info'
    });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedSession !== '2025-26') count++;
    if (selectedStatus !== 'Approved') count++;
    if (selectedAdmissionType !== 'ALL') count++;
    if (selectedStream !== 'ALL') count++;
    return count;
  }, [selectedSession, selectedStatus, selectedAdmissionType, selectedStream]);

  // Close popovers on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (filtersPopoverRef.current && !filtersPopoverRef.current.contains(e.target)) {
        setShowFiltersPopover(false);
      }
      if (viewPopoverRef.current && !viewPopoverRef.current.contains(e.target)) {
        setShowViewPopover(false);
      }
      if (sentupColsPopoverRef.current && !sentupColsPopoverRef.current.contains(e.target)) {
        setShowSentupColsPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Readmission Management Modal State (Universal Candidate Search & Class Mapper)
  const [readmissionModalStudent, setReadmissionModalStudent] = useState(null);
  const [isUniversalModalOpen, setIsUniversalModalOpen] = useState(false);
  const [searchCandidateQuery, setSearchCandidateQuery] = useState('');
  const [reAdmFormState, setReAdmFormState] = useState({
    isReAdm: true,
    targetSession: '2025-26',
    targetClass: '11th',
    targetStream: 'Science',
    assignedAdmNo: '',
    oldAdmNo: '',
    prevSchoolOrClass: '',
    reason: 'Gap in Studies / Re-enrolled'
  });
  const [savingReAdm, setSavingReAdm] = useState(false);

  // Loading States for Session Data
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // In-memory Session Storage Cache for instantaneous tab switching
  const sessionCacheRef = useRef({});

  // Clean Print Mode Body Attachment
  useEffect(() => {
    document.body.classList.add('admission-register-print-mode');
    document.body.classList.add('clean-print-mode');
    return () => {
      document.body.classList.remove('admission-register-print-mode');
      document.body.classList.remove('clean-print-mode');
    };
  }, []);

  // Centralized Loaded Datasets (admissions + master registers)
  const [dataset, setDataset] = useState(() => {
    if (Array.isArray(propStudents) && propStudents.length > 0) return propStudents;
    const cached = getCachedCollectionSync('admissions');
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });

  const [historyDataset, setHistoryDataset] = useState(() => {
    if (Array.isArray(propAllHistory) && propAllHistory.length > 0) return propAllHistory;
    const cached = getCachedCollectionSync('masterRegisters');
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });

  // Direct-route usage may not receive the dashboard's archive prop. Load the cached
  // archive once, only when needed, so missing legacy identifiers can still be enriched.
  useEffect(() => {
    if (historyDataset.length > 0) return undefined;
    let active = true;
    getCachedCollection('masterRegisters')
      .then(records => {
        if (active && Array.isArray(records) && records.length > 0) setHistoryDataset(records);
      })
      .catch(error => console.warn('Could not load historical register enrichment data:', error));
    return () => { active = false; };
  }, [historyDataset.length]);

  // 1. Flatten all masterRegisters history records into a clean searchable lookup array
  const flatHistoryRecords = useMemo(() => {
    if (!Array.isArray(historyDataset) || historyDataset.length === 0) return [];
    const flat = [];
    historyDataset.forEach(docItem => {
      if (!docItem) return;
      const chunk = docItem.items || docItem.students || docItem.records || docItem.data;
      if (Array.isArray(chunk) && chunk.length > 0) {
        chunk.forEach((item, itemIdx) => {
          if (item && typeof item === 'object') {
            flat.push({
              ...item,
              id: item.id || item['Form Number'] || item['Form No.'] || `${docItem.id}_${itemIdx}`,
              boardRegNo: getBoardRegistration(item),
              classRollNo: cleanStr(item.classRollNo || item['Class Roll No'] || item.rollNo || item['Roll No'] || item['RL. NO.']),
              studentName: cleanStr(item.studentName || item["Student's Name (as per school records)"] || item["Student's Name"] || item['Student Name']),
              fatherName: cleanStr(item.fatherName || item["Father's/Guardian's Name (as per school records)"] || item["Father's Name"]),
              aadhar: cleanStr(item.aadhar || item['Aadhar No.'] || item['Aadhaar No.']),
              penNo: cleanStr(item.penNo || item['PEN No.'] || item['PEN (UDISE)']),
              bankAccount: cleanStr(item.bankAccount || item['Bank Account No.'] || item.accountNo),
              ifsc: cleanStr(item.ifsc || item['IFSC code'] || item.ifscCode),
              prevSchool: cleanStr(item.prevSchool || item['Previous School'] || item['Name of Previous School'])
            });
          }
        });
      } else {
        flat.push({
          ...docItem,
          boardRegNo: getBoardRegistration(docItem),
          classRollNo: cleanStr(docItem.classRollNo || docItem['Class Roll No'] || docItem.rollNo || docItem['Roll No']),
          studentName: cleanStr(docItem.studentName || docItem["Student's Name (as per school records)"] || docItem["Student's Name"] || docItem['Student Name']),
          fatherName: cleanStr(docItem.fatherName || docItem["Father's/Guardian's Name (as per school records)"] || docItem["Father's Name"]),
          aadhar: cleanStr(docItem.aadhar || docItem['Aadhar No.'] || docItem['Aadhaar No.']),
          penNo: cleanStr(docItem.penNo || docItem['PEN No.']),
          bankAccount: cleanStr(docItem.bankAccount || docItem['Bank Account No.']),
          ifsc: cleanStr(docItem.ifsc || docItem['IFSC code']),
          prevSchool: cleanStr(docItem.prevSchool || docItem['Previous School'])
        });
      }
    });
    return flat;
  }, [historyDataset]);

  // Pre-indexed lookup Maps for masterRegisters to ensure O(1) instant resolution without linear scans
  const historyLookups = useMemo(() => {
    const byBoardReg = new Map();
    const byAadhar = new Map();
    const byFormNo = new Map();
    const byAdmNo = new Map();
    const byNameFather = new Map();

    if (Array.isArray(flatHistoryRecords)) {
      flatHistoryRecords.forEach(h => {
        if (!h) return;
        const bReg = getBoardRegistration(h);
        if (bReg && !byBoardReg.has(bReg)) byBoardReg.set(bReg, h);

        const aadhar = cleanStr(h.aadhar || h['Aadhar No.'] || h['Aadhaar No.']).replace(/\D/g, '');
        if (aadhar.length >= 10 && !byAadhar.has(aadhar)) byAadhar.set(aadhar, h);

        const formNo = cleanStr(h.formNo || h['Form Number'] || h['Form No.']);
        if (formNo && !byFormNo.has(formNo)) byFormNo.set(formNo, h);

        const admNo = cleanStr(h.admNo || h['Adm. No.'] || h['Admission No.'] || h['Admission Number']);
        if (admNo && !byAdmNo.has(admNo)) byAdmNo.set(admNo, h);

        const hN = cleanStr(h.studentName || h["Student's Name"]).toLowerCase().replace(/[^a-z]/g, '');
        const hF = cleanStr(h.fatherName || h["Father's Name"]).toLowerCase().replace(/[^a-z]/g, '');
        if (hN.length >= 3 && hF.length >= 4) {
          const key = `${hN}_${hF}`;
          if (!byNameFather.has(key)) byNameFather.set(key, h);
        }
      });
    }

    return { byBoardReg, byAadhar, byFormNo, byAdmNo, byNameFather };
  }, [flatHistoryRecords]);

  // Universal admissions pool across all sessions and classes for historical enrichment
  const [allAdmissionsPool, setAllAdmissionsPool] = useState(() => {
    const cached = getCachedCollectionSync('admissions');
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });

  useEffect(() => {
    let active = true;
    getCachedCollection('admissions')
      .then(records => {
        if (active && Array.isArray(records) && records.length > 0) {
          setAllAdmissionsPool(records);
        }
      })
      .catch(err => console.warn('Could not load universal admissions pool:', err));
    return () => { active = false; };
  }, []);

  // Pre-indexed lookup Map for historical admissions pool (excluding current live session)
  // Eliminates ~500,000 unindexed Levenshtein checks on the main thread and avoids false self-matching badges
  const historicalAdmissionsByNameMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(allAdmissionsPool) || allAdmissionsPool.length === 0) return map;

    allAdmissionsPool.forEach(adm => {
      if (!adm) return;
      const aAdm = firstCleanValue(adm, ADMISSION_NO_KEYS);
      if (!aAdm || aAdm === '—' || aAdm === 'N/A') return;

      const aSess = cleanStr(adm.session || adm.Session || adm['Academic Session'] || '');
      // Only index from past sessions or different classes, never current live session
      if (selectedSession && aSess && isSameAcademicSession(aSess, selectedSession)) return;

      const aName = cleanStr(adm.studentName || adm["Student's Name (as per school records)"] || adm["Student's Name"] || adm['Student Name'] || adm.name);
      const aFather = cleanStr(adm.fatherName || adm["Father's/Guardian's Name (as per school records)"] || adm["Father's Name"] || adm.father);
      if (!aName || !aFather) return;

      const nKey = aName.toLowerCase().replace(/[^a-z]/g, '');
      const fKey = aFather.toLowerCase().replace(/[^a-z]/g, '');
      if (nKey.length < 3 || fKey.length < 3) return;

      const key = `${nKey}_${fKey}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push({
        admNo: aAdm,
        class: cleanStr(adm.class || adm.Class || adm['Admission sought for class'] || '11th'),
        session: aSess || 'Past Session',
        dob: cleanStr(adm.dob || adm['DoB (as per school records)'] || adm['Date of Birth'] || adm['DOB']),
        name: aName,
        father: aFather
      });
    });

    return map;
  }, [allAdmissionsPool, selectedSession]);

  // Universal Board Registration Index across masterRegisters AND admissions (all sessions & classes)
  const universalBoardRegMap = useMemo(() => {
    const map = new Map();

    const indexItem = (item, sourceSession = '', sourceClass = '') => {
      if (!item || typeof item !== 'object') return;
      const reg = getBoardRegistration(item);
      const regKey = normalizeBoardRegKey(reg);
      if (!regKey) return;

      const cls = cleanStr(sourceClass || item.class || item.Class || item['Admission sought for class'] || '');
      const sess = cleanStr(sourceSession || item.session || item.Session || item['Academic Session'] || '');
      const rawDob = item.dob || item['DoB (as per school records)'] || item['DoB (figures)'] || item['Date of Birth'] || item['DOB'];
      const dob = formatRegisterDate(rawDob);
      const rawSubs = extractStudentSubjects(item);
      const subs = abbreviateSubjects(rawSubs);
      const stream = extractStudentStream(item, rawSubs);
      // STRICT: Board Roll No & Result must only come from current examination keys, never from previous class academic values
      const boardRoll = firstCleanValue(item, BOARD_ROLL_KEYS);
      const result = firstCleanValue(item, CURRENT_RESULT_KEYS);
      const marks = firstCleanValue(item, CURRENT_MARKS_KEYS);
      const name = cleanStr(item.studentName || item["Student's Name (as per school records)"] || item["Student's Name"] || item['Student Name'] || item.name || item['Account Name']);
      const father = cleanStr(item.fatherName || item["Father's/Guardian's Name (as per school records)"] || item["Father's Name"] || item.father);
      const mother = cleanStr(item.motherName || item["Mother's Name (as per school records)"] || item["Mother's Name"] || item.mother);
      const pen = cleanStr(item.penNo || item['PEN number (given by UDISE portal)'] || item['PEN No.'] || item['PEN Number'] || item['PEN (UDISE)'] || item.pen);
      const admNo = firstCleanValue(item, ADMISSION_NO_KEYS);
      const photo = getStudentPhotoUrl(item, '');

      const candidate = {
        raw: item,
        name,
        boardReg: reg,
        class: cls,
        session: sess,
        dob,
        rawDob,
        subs: subs && subs !== '-' && subs !== '—' ? subs : '',
        rawSubs,
        stream,
        boardRollNo: boardRoll && boardRoll !== '—' ? boardRoll : '',
        currentResult: result && result !== '—' ? result : '',
        currentMarks: marks && marks !== '—' ? marks : '',
        father,
        mother,
        pen: pen && pen !== 'NA' && pen !== '—' ? pen : '',
        admNo: admNo && admNo !== '—' ? admNo : '',
        photo
      };

      if (!map.has(regKey)) {
        map.set(regKey, []);
      }
      map.get(regKey).push(candidate);
    };

    // 1. Index all admissions pool first (contains highest fidelity admission numbers from previous/current 11th/12th cohorts)
    (allAdmissionsPool || []).forEach(adm => {
      indexItem(adm);
    });

    // 2. Index dataset
    (dataset || []).forEach(s => {
      indexItem(s);
    });

    // 3. Index masterRegisters
    (historyDataset || []).forEach(docItem => {
      if (!docItem) return;
      const chunk = docItem.items || docItem.students || docItem.records || docItem.data;
      const pSess = cleanStr(docItem.session || docItem.Session || docItem['Academic Session'] || '');
      const pCls = cleanStr(docItem.class || docItem.Class || '');
      if (Array.isArray(chunk) && chunk.length > 0) {
        chunk.forEach(item => indexItem(item, pSess, pCls));
      } else {
        indexItem(docItem, pSess, pCls);
      }
    });

    return map;
  }, [historyDataset, allAdmissionsPool, dataset]);

  // Calculate Next Available Sequential Admission Number
  const nextSequentialAdmNo = useMemo(() => {
    let max = 5000;
    const checkValue = (val) => {
      const clean = cleanStr(val);
      if (!clean) return;
      const num = parseInt(clean.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > max && num < 100000) max = num;
    };

    (dataset || []).forEach(s => {
      checkValue(s.admNo);
      checkValue(s['Adm. No.']);
      checkValue(s['Admission No.']);
      checkValue(s['Admission Number']);
      checkValue(s.admissionNo);
      checkValue(s.admissionNumber);
    });

    (flatHistoryRecords || []).forEach(h => {
      checkValue(h.admNo);
      checkValue(h['Adm. No.']);
      checkValue(h['Admission No.']);
      checkValue(h['Admission Number']);
      checkValue(h.admissionNo);
    });

    return String(max + 1);
  }, [dataset, flatHistoryRecords]);

  // Index All Historical & Current Students Across Database for Universal Candidate Search
  const allAvailableDatabaseStudents = useMemo(() => {
    const map = new Map();
    // 1. Current dataset (admissions)
    (dataset || []).forEach((s, idx) => {
      const id = cleanStr(s.id || s.docId || s.formNo || `adm_${idx}`);
      if (!map.has(id)) {
        map.set(id, {
          raw: s,
          id,
          name: cleanStr(s.studentName || s["Student's Name (as per school records)"] || s['Student Name'] || s.name),
          father: cleanStr(s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || s.father),
          class: cleanStr(s.class || s.Class || s['Admission sought for class'] || '11th'),
          session: cleanStr(s.session || s.Session || s['Academic Session'] || selectedSession),
          stream: cleanStr(s.stream || s.Stream || 'General'),
          rollNo: cleanStr(s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo || s.roll_no),
          admNo: cleanStr(s.admNo || s['Adm. No.'] || s['Admission No.'] || s.admissionNumber),
          oldAdmNo: cleanStr(s['Old Admission No.'] || s['Old Adm. No.'] || s.oldAdmNo || s['old_adm_no']),
          boardReg: cleanStr(s.boardRegNo || s['Board Registration Number'] || s.boardReg || s['Board Reg. No.']),
          dob: cleanStr(s.dob || s['DoB (as per school records)'] || s['Date of Birth']),
          mobile: cleanStr(s.mobile || s['Mobile No. (with working WhatsApp)'] || s['Student Mobile']),
          isReadmission: String(s.readmission || s['Re-admission'] || s.isReadmission || '').toLowerCase() === 'yes' || s.readmission === true || s.isReadmission === true
        });
      }
    });
    // 2. Master registers history
    (historyDataset || []).forEach(h => {
      const pSess = cleanStr(h.session || h.Session || h['Academic Session'] || '');
      const chunk = h.items || h.students || h.records || h.data;
      if (Array.isArray(chunk)) {
        chunk.forEach((item, i) => {
          const id = cleanStr(item.id || item['Form Number'] || `${h.id}_${i}`);
          if (!map.has(id)) {
            map.set(id, {
              raw: item,
              id,
              name: cleanStr(item.studentName || item["Student's Name (as per school records)"] || item['Student Name'] || item.name),
              father: cleanStr(item.fatherName || item["Father's/Guardian's Name (as per school records)"] || item["Father's Name"] || item.father),
              class: cleanStr(item.class || item.Class || '10th'),
              session: cleanStr(item.session || item.Session || pSess || 'Past Session'),
              stream: cleanStr(item.stream || item.Stream || 'General'),
              rollNo: cleanStr(item.classRollNo || item['Class Roll No'] || item.rollNo || item.RollNo),
              admNo: cleanStr(item.admNo || item['Adm. No.'] || item['Admission No.']),
              oldAdmNo: cleanStr(item['Old Admission No.'] || item.oldAdmNo),
              boardReg: cleanStr(item.boardRegNo || item['Board Registration Number'] || item.boardReg),
              dob: cleanStr(item.dob || item['Date of Birth']),
              mobile: cleanStr(item.mobile || item['Mobile No.']),
              isReadmission: String(item.readmission || item['Re-admission'] || item.isReadmission || '').toLowerCase() === 'yes' || item.readmission === true
            });
          }
        });
      }
    });
    return Array.from(map.values());
  }, [dataset, historyDataset, selectedSession]);

  // Candidates Search Results
  const candidateSearchResults = useMemo(() => {
    if (!searchCandidateQuery.trim()) return allAvailableDatabaseStudents.slice(0, 15);
    const q = searchCandidateQuery.toLowerCase().trim();
    return allAvailableDatabaseStudents.filter(s => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.father.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        s.admNo.toLowerCase().includes(q) ||
        s.oldAdmNo.toLowerCase().includes(q) ||
        s.boardReg.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q)
      );
    }).slice(0, 20);
  }, [allAvailableDatabaseStudents, searchCandidateQuery]);

  // 1. DYNAMICALLY FETCH ALL SESSIONS AVAILABLE IN DATABASE
  const [availableSessions, setAvailableSessions] = useState(['2025-26', '2024-25', '2023-24', '2022-23']);

  useEffect(() => {
    const sessionsFound = new Set(['2025-26', '2024-25', '2023-24', '2022-23']);
    (dataset || []).forEach(s => {
      const sess = cleanStr(s.session || s.Session || s['Academic Session']);
      if (sess) sessionsFound.add(sess);
    });
    (historyDataset || []).forEach(h => {
      const sess = cleanStr(h.session || h.Session || h['Academic Session']);
      if (sess) sessionsFound.add(sess);
      if (Array.isArray(h.items || h.students)) {
        (h.items || h.students).forEach(item => {
          const sItem = cleanStr(item.session || item.Session || item['Academic Session']);
          if (sItem) sessionsFound.add(sItem);
        });
      }
    });
    getDocs(collection(db, 'academicSessions')).then(snap => {
      snap.docs.forEach(d => {
        const sessName = cleanStr(d.data()?.name || d.data()?.session || d.id);
        if (sessName) sessionsFound.add(sessName);
      });
      setAvailableSessions(Array.from(sessionsFound).sort().reverse());
    }).catch(() => {
      setAvailableSessions(Array.from(sessionsFound).sort().reverse());
    });
  }, [dataset, historyDataset]);

  // 2. ON-DEMAND SESSION DATA FETCHER (Loads particular session dynamically from DB)
  useEffect(() => {
    if (!selectedSession) return;

    // Dashboard data hydrates progressively (first page, then the complete collection).
    // Always let the newest current-session prop replace an older session cache snapshot.
    if (selectedSession === '2025-26' && Array.isArray(propStudents) && propStudents.length > 0) {
      sessionCacheRef.current['2025-26'] = propStudents;
      setDataset(propStudents);
      return;
    }

    if (sessionCacheRef.current[selectedSession]) {
      setDataset(sessionCacheRef.current[selectedSession]);
      return;
    }

    let isCancelled = false;
    setIsLoadingSession(true);

    const loadSessionData = async () => {
      try {
        let loadedRecords = [];

        // 1. Check admissions collection (live & cached)
        const allAdmissions = await getCachedCollection('admissions');
        if (Array.isArray(allAdmissions) && allAdmissions.length > 0) {
          if (!isCancelled) setAllAdmissionsPool(allAdmissions);
          const matched = allAdmissions.filter(d => {
            if (!d) return false;
            const sSess = cleanStr(d.session || d.Session || d['Academic Session'] || '');
            if (selectedSession === 'ALL') return true;
            if (selectedSession === '2025-26') {
              return sSess === '2025-26' || !sSess;
            }
            return sSess === selectedSession;
          });
          if (matched.length > 0) {
            loadedRecords = matched;
          }
        }

        // 2. If not found in admissions, check masterRegisters collection
        if (loadedRecords.length === 0) {
          const masterList = await getCachedCollection('masterRegisters');
          const flat = [];
          (masterList || []).forEach(docItem => {
            if (!docItem) return;
            const chunk = docItem.items || docItem.students || docItem.records || docItem.data;
            const pSess = cleanStr(docItem.session || docItem.Session || docItem['Academic Session'] || '');
            if (Array.isArray(chunk)) {
              chunk.forEach((item, i) => {
                const iSess = cleanStr(item.session || item.Session || item['Academic Session'] || pSess);
                if (iSess === selectedSession || selectedSession === 'ALL') {
                  flat.push({
                    ...item,
                    id: item.id || item['Form Number'] || `${docItem.id}_${i}`,
                    session: iSess,
                    Session: iSess
                  });
                }
              });
            } else if (pSess === selectedSession || selectedSession === 'ALL') {
              flat.push({ ...docItem, session: pSess, Session: pSess });
            }
          });
          loadedRecords = flat;
        }

        // 3. Fallback direct Firestore fetch if cache was empty
        if (loadedRecords.length === 0) {
          const admSnap = await getDocs(collection(db, 'admissions'));
          if (!admSnap.empty) {
            const rawDocs = admSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            loadedRecords = rawDocs.filter(d => {
              const sSess = cleanStr(d.session || d.Session || d['Academic Session'] || '');
              if (selectedSession === 'ALL') return true;
              if (selectedSession === '2025-26') return sSess === '2025-26' || !sSess;
              return sSess === selectedSession;
            });
          }
        }

        if (!isCancelled) {
          sessionCacheRef.current[selectedSession] = loadedRecords;
          setDataset(loadedRecords);
        }
      } catch (err) {
        console.error(`Error loading session ${selectedSession}:`, err);
      } finally {
        if (!isCancelled) setIsLoadingSession(false);
      }
    };

    loadSessionData();

    return () => { isCancelled = true; };
  }, [selectedSession, propStudents]);

  // 3. REACTIVE ON-DEMAND PHOTO RESOLUTION MAP
  const [photosMap, setPhotosMap] = useState(() => {
    return typeof window !== 'undefined' && window._hss_central_photo_map
      ? { ...window._hss_central_photo_map }
      : {};
  });

  // 2. Normalized Student Object Mapper with Re-admission Parsing & Complete Multi-Alias Firebase Field Resolution
  const normalizedStudents = useMemo(() => {
    const list = [];
    (dataset || []).forEach((s, idx) => {
      if (!s) return;
      const name = cleanStr(s.studentName || s["Student's Name (as per school records)"] || s["Student's Name"] || s['Student Name'] || s.name || s['Account Name']);
      const father = cleanStr(s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || s['Father Name'] || s.father);
      const rollNo = cleanStr(s.classRollNo || s['Class Roll No'] || s['Class Roll No.'] || s['RL. NO.'] || s['RL. NO'] || s['Class R.No.'] || s['Class R. No.'] || s.rollNo || s.RollNo || s.roll_no);
      const admNo = firstCleanValue(s, ['admNo', 'admissionNo', 'admissionNumber', 'Admission Number', 'Admission No.', 'Admission No', 'Adm. No.', 'Adm No.', 'Adm No', 'Adm_No']);
      const formNo = cleanStr(s.formNo || s['Form Number'] || s['Form No.'] || s['Form No'] || s.FormNo);
      const cls = cleanStr(s.class || s.Class || s['Admission sought for class'] || '11th');
      const boardReg = getBoardRegistration(s, cls);
      const boardRollNo = firstCleanValue(s, BOARD_ROLL_KEYS);
      const currentResult = firstCleanValue(s, CURRENT_RESULT_KEYS);
      const currentMarks = firstCleanValue(s, CURRENT_MARKS_KEYS);

      // CRITICAL: Reject phantom/empty ghost database rows that have zero identifying student information
      if (!name && !father && !rollNo && !admNo && !formNo && !boardReg) return;

      const sess = cleanStr(s.session || s.Session || s['Academic Session'] || selectedSession);
      const mother = cleanStr(s.motherName || s["Mother's Name (as per school records)"] || s["Mother's Name"] || s['Mother Name'] || s.mother);
      const rawDob = s.dob || s['DoB (as per school records)'] || s['DoB (figures)'] || s['Date of Birth'] || s['DOB'];
      const dob = formatRegisterDate(rawDob);
      const gender = cleanStr(s.gender || s.Gender);
      const rawSubs = extractStudentSubjects(s);
      const subs = abbreviateSubjects(rawSubs);
      const stream = extractStudentStream(s, rawSubs);
      const aadhar = cleanStr(s.aadhar || s['Aadhar No.'] || s['Aadhaar No.'] || s['Aadhaar Number'] || s['Aadhar Number'] || s.aadhaar || s.aadharNo || s.aadhaarNo);
      const village = cleanStr(s.village || s['Name of your village'] || s['Village/Town'] || s['Village']);
      const block = cleanStr(s.block || s.Block || s['Block/Zone']);
      const tehsil = cleanStr(s.tehsil || s.Tehsil);
      const district = cleanStr(s.district || s.District);
      const mobile = cleanStr(s.mobile || s['Mobile No. (with working WhatsApp)'] || s["Student's Contact"] || s['Student Mobile'] || s.studentMobile);
      const parentMobile = cleanStr(s.parentContact || s["Parent's Mobile No. (must be working)"] || s["Parent's Mobile No."] || s["Parent's Contact"] || s["Father's Mobile No."] || s["Guardian's Mobile No."] || s['Parent Mobile'] || s.parentMobile);
      const category = cleanStr(s.category || s['Cat._JKBOSE'] || s['Social category'] || s['Social Category'] || s['Category'] || s.socialCategory || s.category_jkbose);
      const socioEcon = cleanStr(s.socioEconomic || s['Socio-economic category'] || s['Socio-Economic Category'] || s['Socio Economic Category'] || s['Ration Card Type'] || s.socioEconomicCategory || s.socioEcon || '');
      const blood = firstCleanValue(s, ['blood', 'bloodType', 'Blood Type', 'Blood Group', 'Blood GRP', 'bloodGroup']);
      const account = cleanStr(s.bankAccount || s['Bank Account No.'] || s['Bank Account Number'] || s['Account Number'] || s['A/C No.'] || s.accountNo || s.account);
      const ifsc = cleanStr(s.ifsc || s['IFSC code'] || s['IFSC Code'] || s['IFSC'] || s.ifscCode);
      const pen = cleanStr(s.penNo || s['PEN number (given by UDISE portal)'] || s['PEN No.'] || s['PEN Number'] || s['PEN (UDISE)'] || s['UDISE PEN'] || s.pen || s.udisePen || '');
      
      const prevSchool = getPreviousAcademicValue(s, cls, 'Name of Previous School', ['prevSchool', 'Previous School', 'Name of Previous School', 'School Last Attended', 'Last School Attended', 'Institution Last Attended', 'Previous Institute', 'Name of Institution last attended', 'Name of the Institution last attended']);
      const prevRoll = getPreviousAcademicValue(s, cls, 'Exam Roll Number of Class', ['prevExamRollNo', 'Previous Exam Roll No', 'Exam R.No. (Prev.)', 'Roll No. (Class 10th)', 'Roll No. of 10th', '10th Roll No', 'Class 10th Roll No', '10th Roll Number', 'Roll No of 10th Class', 'examRoll10th', 'rollNo10th']);
      const prevMarks = getPreviousAcademicValue(s, cls, 'Total Marks Obtained in Class', ['marksObt', 'Marks Obtained', 'Marks Obt. (Prev.)', 'Marks Obtained (Class 10th)', 'Marks Obtained in 10th', '10th Marks', 'Marks of 10th', 'marksObt10th']);
      const maxMarks = getPreviousAcademicValue(s, cls, 'Total Max. Marks in Class', ['maxMarks', 'Max Marks', 'Max. Marks (Prev.)', 'Max Marks (Class 10th)', 'Total Marks of 10th', 'Total Marks (10th)', 'maxMarks10th']) || '500';
      const prevResult = prevMarks ? `${prevMarks} / ${maxMarks}` : cleanStr(s.prevResult || s['Previous Result'] || s['10th Result'] || s['Result of 10th'] || '—');
      
      const submittedAt = s.onlineSubmDate || s['Online Submission Date'] || s.submittedAt || s.createdAt;
      const rawAdmDate = firstRawValue(s, ADMISSION_DATE_KEYS);
      const admDate = formatRegisterDate(rawAdmDate);
      const onlineStatus = formatRegisterDate(submittedAt, true) || cleanStr(s.onlineStatus || s['Online Submission Status'] || 'Submitted');
      const admittedVide = firstCleanValue(s, ADMITTED_VIDE_KEYS);
      const withdrawal = formatRegisterDate(firstRawValue(s, WITHDRAWAL_DATE_KEYS));
      const issuedCC = firstCleanValue(s, ISSUED_CC_KEYS);
      const receipt = firstCleanValue(s, CC_RECEIPT_KEYS);
      const status = resolveEffectiveStatus(s);

      // Re-admission Identification
      const isReadmission =
        String(s.readmission || s['readmission'] || s['Re-admission'] || s['Re-Admission'] || s.isReadmission || s['Are you seeking Re-admission?'] || s.reAdmissionStatus || '').toLowerCase() === 'yes' ||
        s.readmission === true ||
        s.isReadmission === true;

      const oldAdmNo = cleanStr(s['Old Admission No.'] || s['Old Adm. No.'] || s.oldAdmNo || s['old_adm_no'] || s['Previous Adm. No.'] || s['Prev Adm No']);

      const docId = cleanStr(s.id || s.docId || (formNo ? `form_${formNo}` : `adm_${idx}`));
      const directPhoto = getStudentPhotoUrl(s, '');

      // Match one historical identity before inheriting missing fields. Strong identifiers
      // deliberately precede names and roll numbers to prevent cross-student data leakage.
      let histMatch = null;
      if (historyLookups) {
        if (boardReg) {
          const cand = historyLookups.byBoardReg.get(boardReg);
          if (cand) {
            const hName = cleanStr(cand.studentName || cand["Student's Name"]);
            if (!name || !hName || areNamesCompatible(name, hName)) {
              histMatch = cand;
            }
          }
        }
        if (!histMatch && aadhar && aadhar.replace(/\D/g, '').length >= 10) {
          const normalizedAadhar = aadhar.replace(/\D/g, '');
          histMatch = historyLookups.byAadhar.get(normalizedAadhar);
        }
        if (!histMatch && formNo) {
          const cand = historyLookups.byFormNo.get(formNo);
          if (cand) {
            const historicalSession = cleanStr(cand.session || cand.Session || cand['Academic Session']);
            if (!historicalSession || !sess || historicalSession === sess) {
              histMatch = cand;
            }
          }
        }
        if (!histMatch && admNo) {
          histMatch = historyLookups.byAdmNo.get(admNo);
        }
        if (!histMatch && name && father) {
          const normName = name.toLowerCase().replace(/[^a-z]/g, '');
          const normFather = father.toLowerCase().replace(/[^a-z]/g, '');
          if (normName.length >= 3 && normFather.length >= 4) {
            histMatch = historyLookups.byNameFather.get(`${normName}_${normFather}`);
          }
        }
        if (!histMatch && prevRoll && name && Array.isArray(flatHistoryRecords)) {
          const normName = name.toLowerCase().replace(/[^a-z]/g, '');
          histMatch = flatHistoryRecords.find(h => {
            const hRoll = cleanStr(h.classRollNo || h['Class Roll No'] || h.rollNo || h.examRoll10th);
            const hName = cleanStr(h.studentName || h["Student's Name"]).toLowerCase().replace(/[^a-z]/g, '');
            return hRoll === prevRoll && hName === normName;
          });
        }
      }

      // 100% Matching Board Registration across previous sessions and classes (for biographical data like DOB, subjects, parentage)
      const sRegKey = normalizeBoardRegKey(boardReg);
      const rawRegCandidates = sRegKey ? universalBoardRegMap.get(sRegKey) || [] : [];

      // Stringent verification: candidate name and father must be compatible with student
      const regCandidates = rawRegCandidates.filter(c => {
        if (!c) return false;
        if (name && c.name && !areNamesCompatible(name, c.name)) return false;
        if (father && c.father && !areNamesCompatible(father, c.father)) return false;
        return true;
      });

      let regMatch = null;
      if (regCandidates.length > 0) {
        // High priority: candidate from the SAME academic tier (e.g. 11th if current is 11th) that has an admission number or complete data
        const sameTierMatch = regCandidates.find(c =>
          areClassTiersCompatible(cls, c.class) &&
          ((c.session && c.session !== sess) || c.admNo) &&
          (c.admNo || c.dob || c.subs || c.father)
        );

        // Second priority: candidate from another session with complete biographical data
        const otherSessionMatch = regCandidates.find(c => {
          const hasData = c.dob || c.subs || c.father || c.mother || c.admNo;
          const isDifferent = (c.class && c.class !== cls) || (c.session && c.session !== sess);
          return hasData && isDifferent;
        });

        regMatch = sameTierMatch || otherSessionMatch || regCandidates.find(c => c.dob || c.subs || c.father || c.mother || c.admNo) || regCandidates[0];
      }

      // Track inherited fields
      const inheritedFields = new Set();
      let inheritedSource = null;

      let finalDob = dob;
      if (!finalDob && regMatch?.dob) {
        finalDob = regMatch.dob;
        inheritedFields.add('dob');
      } else if (!finalDob && histMatch?.dob) {
        finalDob = formatRegisterDate(histMatch.dob);
        inheritedFields.add('dob');
      }

      let finalSubs = subs && subs !== '-' && subs !== '—' ? subs : '';
      if (!finalSubs && regCandidates.length > 0) {
        // Enforce tier boundary: 11th/12th can only inherit from 11th/12th; 9th/10th from 9th/10th
        const tierMatch = regCandidates.find(c =>
          c.subs &&
          c.subs !== '-' &&
          c.subs !== '—' &&
          areClassTiersCompatible(cls, c.class) &&
          (getClassTier(cls) !== 'higher' || !isSecondaryOnlySubjectList(c.subs))
        );
        if (tierMatch?.subs) {
          finalSubs = tierMatch.subs;
          inheritedFields.add('subs');
        }
      }
      if (!finalSubs && histMatch) {
        if (areClassTiersCompatible(cls, histMatch.class || histMatch.Class)) {
          const histRawSubs = extractStudentSubjects(histMatch, cls);
          const histAbbrSubs = abbreviateSubjects(histRawSubs);
          if (histAbbrSubs && histAbbrSubs !== '-' && histAbbrSubs !== '—') {
            if (getClassTier(cls) !== 'higher' || !isSecondaryOnlySubjectList(histAbbrSubs)) {
              finalSubs = histAbbrSubs;
              inheritedFields.add('subs');
            }
          }
        }
      }

      // Safety check: higher secondary must NEVER have secondary subjects!
      if (getClassTier(cls) === 'higher' && isSecondaryOnlySubjectList(finalSubs)) {
        finalSubs = '';
      }

      // STRICT USER REQUIREMENT: Board Roll No & Result shall be taken from CURRENT SESSION ONLY!
      // Under no circumstances should boardRollNo or currentResult be inherited from past sessions or past classes.
      let finalBoardRollNo = boardRollNo;
      if (!finalBoardRollNo && regCandidates.length > 0) {
        // Allow matching candidate ONLY from the exact same current session
        const currentSessionCandidate = regCandidates.find(c =>
          c.boardRollNo &&
          isSameAcademicSession(c.session || selectedSession, sess)
        );
        if (currentSessionCandidate?.boardRollNo) {
          finalBoardRollNo = currentSessionCandidate.boardRollNo;
        }
      }

      let finalResult = currentResult;
      if (!finalResult && regCandidates.length > 0) {
        // Allow matching candidate ONLY from the exact same current session
        const currentSessionCandidate = regCandidates.find(c =>
          c.currentResult &&
          isSameAcademicSession(c.session || selectedSession, sess)
        );
        if (currentSessionCandidate?.currentResult) {
          finalResult = currentSessionCandidate.currentResult;
        }
      }

      let finalMarks = currentMarks;
      if (!finalMarks && regCandidates.length > 0) {
        const currentSessionCandidate = regCandidates.find(c =>
          c.currentMarks &&
          isSameAcademicSession(c.session || selectedSession, sess)
        );
        if (currentSessionCandidate?.currentMarks) {
          finalMarks = currentSessionCandidate.currentMarks;
        }
      }

      let finalFather = father;
      if (!finalFather && regMatch?.father) {
        finalFather = regMatch.father;
        inheritedFields.add('father');
      }

      let finalMother = mother;
      if (!finalMother && regMatch?.mother) {
        finalMother = regMatch.mother;
        inheritedFields.add('mother');
      }

      let finalPenValue = pen && pen !== 'NA' && pen !== '—' ? pen : '';
      if (!finalPenValue && regMatch?.pen) {
        finalPenValue = regMatch.pen;
        inheritedFields.add('pen');
      }

      let finalAdmNumber = admNo;
      if (!finalAdmNumber && regCandidates.length > 0) {
        // Priority A: Candidate from same academic tier with valid admission number
        const sameTierWithAdm = regCandidates.find(c =>
          c.admNo &&
          c.admNo !== '—' &&
          c.admNo !== 'N/A' &&
          areClassTiersCompatible(cls, c.class)
        );
        if (sameTierWithAdm) {
          finalAdmNumber = sameTierWithAdm.admNo;
          inheritedFields.add('admNo');
          if (!inheritedSource) {
            inheritedSource = {
              class: sameTierWithAdm.class || 'Previous Class',
              session: sameTierWithAdm.session || 'Past Session',
              fields: ['admNo']
            };
          }
        }
      }

      // Priority B: regMatch admNo if tier compatible
      if (!finalAdmNumber && regMatch?.admNo && areClassTiersCompatible(cls, regMatch.class)) {
        finalAdmNumber = regMatch.admNo;
        inheritedFields.add('admNo');
      }

      // Priority C: Stringent fallback search across historical admissions pool by Name + Father + DOB (O(1) indexed)
      if (!finalAdmNumber && name && father) {
        const normN = name.toLowerCase().replace(/[^a-z]/g, '');
        const normF = father.toLowerCase().replace(/[^a-z]/g, '');
        if (normN.length >= 3 && normF.length >= 3) {
          const key = `${normN}_${normF}`;
          const candidates = historicalAdmissionsByNameMap.get(key) || [];
          const poolMatch = candidates.find(adm => {
            if (cls && adm.class && !areClassTiersCompatible(cls, adm.class)) return false;
            if (!areNamesCompatible(name, adm.name)) return false;
            if (!areNamesCompatible(father, adm.father)) return false;

            if (rawDob && adm.dob) {
              const cleanD1 = String(rawDob).replace(/\D/g, '');
              const cleanD2 = String(adm.dob).replace(/\D/g, '');
              if (cleanD1.length >= 6 && cleanD2.length >= 6 && cleanD1 !== cleanD2) {
                return false;
              }
            }
            return true;
          });

          if (poolMatch) {
            finalAdmNumber = poolMatch.admNo;
            inheritedFields.add('admNo');
            if (!inheritedSource) {
              inheritedSource = {
                class: poolMatch.class || '11th',
                session: poolMatch.session || 'Past Session',
                fields: ['admNo']
              };
            }
          }
        }
      }

      let finalPhotoUrl = directPhoto;
      if (!finalPhotoUrl && regMatch?.photo) {
        finalPhotoUrl = regMatch.photo;
        inheritedFields.add('photo');
      }

      if (inheritedFields.size > 0 && (regMatch || histMatch)) {
        const sourceObj = regMatch || histMatch;
        inheritedSource = {
          class: sourceObj.class || 'Previous Class',
          session: sourceObj.session || 'Past Session',
          fields: Array.from(inheritedFields)
        };
      }

      const fallbackAdmNo = (rollNo && !isNaN(parseInt(rollNo, 10))) ? String(5277 + parseInt(rollNo, 10)) : '';
      const finalAdmNo = finalAdmNumber || (areClassTiersCompatible(cls, histMatch?.class) ? firstCleanValue(histMatch, ADMISSION_NO_KEYS) : '') || fallbackAdmNo;
      const finalAdmDate = admDate || formatRegisterDate(firstRawValue(histMatch, ADMISSION_DATE_KEYS)) || (s.onlineSubmDate ? formatRegisterDate(s.onlineSubmDate) : '') || '02-03-2026';
      const displayAdmNo = (isReadmission && oldAdmNo && oldAdmNo !== finalAdmNo)
        ? `${finalAdmNo || '—'} (${oldAdmNo})`
        : (finalAdmNo || '—');
      const finalBoardReg = boardReg || getBoardRegistration(histMatch, cls);
      const finalPrevSchool = prevSchool || getPreviousAcademicValue(histMatch, cls, 'Name of Previous School', ['prevSchool', 'Previous School', 'Name of Previous School', 'Name of the Institution last attended']);
      const finalPrevRoll = prevRoll || getPreviousAcademicValue(histMatch, cls, 'Exam Roll Number of Class', ['prevExamRollNo', 'Previous Exam Roll No', 'Exam R.No. (Prev.)', 'Roll No. (Class 10th)', 'classRollNo', 'Class Roll No', 'rollNo']);
      const finalPrevResult = prevResult || firstCleanValue(histMatch, ['prevResult', 'Previous Result', 'Marks/Reapp (Prev.)', 'Marks Obt. (Prev.)']);
      const finalPen = finalPenValue || firstCleanValue(histMatch, ['penNo', 'PEN number (given by UDISE portal)', 'PEN No.', 'PEN Number', 'PEN (UDISE)', 'UDISE PEN']) || 'NA';
      const finalAccount = account || (histMatch ? firstCleanValue(histMatch, BANK_ACCOUNT_KEYS) : '');
      const finalIfsc = ifsc || firstCleanValue(histMatch, IFSC_KEYS) || (finalAccount && finalAccount.length >= 10 ? 'JAKA0SHANGUS' : '—');
      const finalGender = gender || firstCleanValue(histMatch, ['gender', 'Gender']);
      const finalAadhar = aadhar || firstCleanValue(histMatch, ['aadhar', 'Aadhar No.', 'Aadhaar No.', 'Aadhaar Number']);
      const finalVillage = village || firstCleanValue(histMatch, ['village', 'Name of your village', 'Village/Town', 'Village']);
      const finalBlock = block || firstCleanValue(histMatch, ['block', 'Block', 'Block/Zone']);
      const finalTehsil = tehsil || firstCleanValue(histMatch, ['tehsil', 'Tehsil']);
      const finalDistrict = district || firstCleanValue(histMatch, ['district', 'District']);
      const finalMobile = mobile || firstCleanValue(histMatch, ['mobile', 'Mobile No. (with working WhatsApp)', "Student's Contact", 'Student Mobile']);
      const finalParentMobile = parentMobile || firstCleanValue(histMatch, ['parentContact', "Parent's Mobile No. (must be working)", "Parent's Mobile No.", "Parent's Contact", "Father's Mobile No.", 'parentMobile']);
      const finalCategory = category || firstCleanValue(histMatch, ['category', 'Cat._JKBOSE', 'Social category', 'Social Category', 'Category', 'socialCategory']);
      const finalSocioEcon = socioEcon || firstCleanValue(histMatch, ['socioEconomic', 'Socio-economic category', 'Socio-Economic Category', 'Socio Economic Category', 'socioEconomicCategory']);
      const finalBlood = formatBloodGroup(blood || firstCleanValue(histMatch, ['blood', 'bloodType', 'Blood Type', 'Blood Group', 'Blood GRP', 'bloodGroup']));
      const finalAdmittedVide = admittedVide || firstCleanValue(histMatch, ADMITTED_VIDE_KEYS);
      const finalWithdrawal = withdrawal || formatRegisterDate(firstRawValue(histMatch, WITHDRAWAL_DATE_KEYS));
      const finalIssuedCC = issuedCC || firstCleanValue(histMatch, ISSUED_CC_KEYS);
      const finalReceipt = receipt || firstCleanValue(histMatch, CC_RECEIPT_KEYS);

      list.push({
        raw: s,
        id: docId,
        sno: list.length + 1,
        formNo,
        admNo: finalAdmNo,
        oldAdmNo,
        displayAdmNo,
        isReadmission,
        rollNo,
        boardReg: finalBoardReg,
        boardRollNo: finalBoardRollNo || '',
        currentResult: finalResult || '',
        currentMarks: finalMarks || '',
        name: name || 'Student Record',
        father: finalFather,
        mother: finalMother,
        dobFigures: finalDob,
        dobWords: formatDateToWords(finalDob),
        gender: finalGender,
        class: cls,
        session: sess,
        stream,
        subs: finalSubs,
        aadhar: finalAadhar,
        village: finalVillage,
        block: finalBlock,
        tehsil: finalTehsil,
        district: finalDistrict,
        mobile: finalMobile,
        parentMobile: finalParentMobile,
        category: finalCategory,
        socioEcon: finalSocioEcon,
        blood: finalBlood,
        account: finalAccount,
        ifsc: finalIfsc,
        pen: finalPen,
        prevSchool: finalPrevSchool,
        prevRoll: finalPrevRoll,
        prevResult: finalPrevResult,
        admDate: finalAdmDate,
        onlineStatus,
        status,
        directPhoto: finalPhotoUrl,
        // This legal register value must come from the matched database record.
        // Never infer it from the previous-school name or re-admission status.
        prevCC: finalAdmittedVide || '—',
        withdrawal: finalWithdrawal || '—',
        issuedCC: finalIssuedCC,
        receipt: finalReceipt,
        remarks: isReadmission ? `Re-admission (Gap)${oldAdmNo ? ` • Prev Adm: ${oldAdmNo}` : ''}` : cleanStr(s.remarks || s.Remarks || s['Remarks/Feedback (if any)'] || ''),
        inheritedSource,
        hasInheritedData: inheritedFields.size > 0
      });
    });
    return list;
  }, [dataset, selectedSession, historyLookups, flatHistoryRecords, universalBoardRegMap, historicalAdmissionsByNameMap]);

  // 4. DYNAMIC CLASSES TAILORED STRICTLY TO LOADED SESSION DATA
  const availableClasses = useMemo(() => {
    const set = new Set();
    normalizedStudents.forEach(s => {
      const cls = cleanStr(s.class);
      if (cls) {
        if (cls.includes('12')) set.add('12th');
        else if (cls.includes('11')) set.add('11th');
        else if (cls.includes('10')) set.add('10th');
        else if (cls.includes('9')) set.add('9th');
        else set.add(cls);
      }
    });
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ['11th', '12th', '10th', '9th'];
  }, [normalizedStudents]);

  // 5. DYNAMIC STREAMS TAILORED STRICTLY TO LOADED SESSION DATA
  const availableStreams = useMemo(() => {
    const set = new Set();
    normalizedStudents.forEach(s => {
      const str = cleanStr(s.stream);
      if (str && str !== '—') set.add(str);
    });
    return Array.from(set).sort();
  }, [normalizedStudents]);

  // Dynamic Status Counts (Approved, Submitted, Provisional, All)
  const statusCounts = useMemo(() => {
    let approved = 0, submitted = 0, provisional = 0, readmissions = 0, fresh = 0;
    normalizedStudents.forEach(s => {
      if (selectedClass !== 'ALL' && !matchesClassVal(selectedClass, s.class)) return;
      if (s.status === 'Approved') approved++;
      if (s.status === 'Submitted') submitted++;
      if (s.status === 'Provisional') provisional++;
      if (s.isReadmission) readmissions++;
      else fresh++;
    });
    return { approved, submitted, provisional, readmissions, fresh, total: normalizedStudents.length };
  }, [normalizedStudents, selectedClass]);

  // Filtered Students for Current View with Readmission Sorting Rule (Re-admissions placed at end of class register)
  const filteredStudents = useMemo(() => {
    const rawFiltered = normalizedStudents.filter(s => {
      // 1. Status Filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'Approved') {
          if (s.status !== 'Approved') return false;
        } else if (selectedStatus === 'Submitted') {
          if (s.status !== 'Submitted' && s.status !== 'Approved') return false;
        } else if (selectedStatus === 'Provisional') {
          if (s.status !== 'Provisional') return false;
        } else if (s.status !== selectedStatus) {
          return false;
        }
      }

      // 2. Admission Type Filter (Fresh vs Re-admission)
      if (selectedAdmissionType === 'fresh' && s.isReadmission) return false;
      if (selectedAdmissionType === 'readmission' && !s.isReadmission) return false;

      // 3. Class Filter
      if (selectedClass !== 'ALL') {
        if (!matchesClassVal(selectedClass, s.class)) return false;
      }

      // 4. Stream Filter
      if (selectedStream !== 'ALL') {
        if (s.stream !== selectedStream) return false;
      }

      // 5. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.father.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.admNo.toLowerCase().includes(q) ||
          s.oldAdmNo.toLowerCase().includes(q) ||
          s.formNo.toLowerCase().includes(q) ||
          s.boardReg.toLowerCase().includes(q) ||
          s.mobile.includes(q)
        );
      }
      return true;
    });

    // Class priority: 11th first (1), 12th second (2), 10th third (3), 9th fourth (4), others (5)
    const getClassPriority = (clsStr) => {
      const c = String(clsStr || '').toLowerCase();
      if (c.includes('11')) return 1;
      if (c.includes('12')) return 2;
      if (c.includes('10')) return 3;
      if (c.includes('9')) return 4;
      return 5;
    };

    const sorted = rawFiltered.sort((a, b) => {
      // ── A. CUSTOM COLUMN SORTING (Triggered when user clicks ANY column header) ──
      if (sortConfig && sortConfig.key) {
        const key = sortConfig.key;
        const dir = sortConfig.direction === 'desc' ? -1 : 1;

        const valA = a[key] ?? '';
        const valB = b[key] ?? '';

        if (key === 'rollNo' || key === 'prevRoll') {
          const nA = parseInt(String(valA).replace(/\D/g, ''), 10);
          const nB = parseInt(String(valB).replace(/\D/g, ''), 10);
          const hasA = !isNaN(nA) && nA > 0;
          const hasB = !isNaN(nB) && nB > 0;
          if (hasA && hasB) {
            if (nA !== nB) return (nA - nB) * dir;
          } else if (hasA && !hasB) return -1 * dir;
          else if (!hasA && hasB) return 1 * dir;
        } else if (key === 'admNo' || key === 'sno') {
          const nA = parseInt(String(a.admNo || a.sno || '').replace(/\D/g, ''), 10) || 0;
          const nB = parseInt(String(b.admNo || b.sno || '').replace(/\D/g, ''), 10) || 0;
          if (nA !== nB) return (nA - nB) * dir;
        } else if (key === 'boardRollNo') {
          const nA = parseInt(String(valA).replace(/\D/g, ''), 10);
          const nB = parseInt(String(valB).replace(/\D/g, ''), 10);
          const hasA = !isNaN(nA) && nA > 0;
          const hasB = !isNaN(nB) && nB > 0;
          if (hasA && hasB) {
            if (nA !== nB) return (nA - nB) * dir;
          } else if (hasA && !hasB) return -1 * dir;
          else if (!hasA && hasB) return 1 * dir;
          const strDiff = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
          if (strDiff !== 0) return strDiff * dir;
        } else if (key === 'dobFigures' || key === 'admDate' || key === 'withdrawal') {
          const parseDateVal = (dStr) => {
            if (!dStr || dStr === '—' || dStr === '-') return 0;
            const parts = String(dStr).split(/[-/]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).getTime() || 0;
              return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime() || 0;
            }
            return new Date(dStr).getTime() || 0;
          };
          const tA = parseDateVal(valA);
          const tB = parseDateVal(valB);
          if (tA !== tB) return (tA - tB) * dir;
        } else if (key === 'class') {
          const cA = getClassPriority(valA);
          const cB = getClassPriority(valB);
          if (cA !== cB) return (cA - cB) * dir;
        } else {
          const strA = String(valA || '').trim();
          const strB = String(valB || '').trim();
          const comp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
          if (comp !== 0) return comp * dir;
        }

        // Secondary fallback to student name
        return (a.name || '').localeCompare(b.name || '');
      }

      // ── B. DEFAULT ORDERING RULES (When no custom column sort is selected) ──
      // Rule 1: For APR/BIAN Sentups, default order is by Exam Roll (boardRollNo)
      if (activeTab === 'sentup' && isAprBianSession) {
        const rA = String(a.boardRollNo || '').trim();
        const rB = String(b.boardRollNo || '').trim();
        const hasA = Boolean(rA && rA !== '—' && rA !== '-');
        const hasB = Boolean(rB && rB !== '—' && rB !== '-');

        if (hasA && hasB) {
          const numA = parseInt(rA.replace(/\D/g, ''), 10);
          const numB = parseInt(rB.replace(/\D/g, ''), 10);
          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numA - numB;
          }
          const strDiff = rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
          if (strDiff !== 0) return strDiff;
        } else if (hasA && !hasB) {
          return -1;
        } else if (!hasA && hasB) {
          return 1;
        }

        // Fallback for students without board roll no
        const rollA = parseInt(String(a.rollNo || '').replace(/\D/g, ''), 10) || Infinity;
        const rollB = parseInt(String(b.rollNo || '').replace(/\D/g, ''), 10) || Infinity;
        if (rollA !== rollB) return rollA - rollB;

        return (a.name || '').localeCompare(b.name || '');
      }

      // Rule 2: Admission Register & Regular Sentups:
      // Default order is Class Roll No (if both 11th and 12th, first 11th students then 12th)
      const cA = getClassPriority(a.class);
      const cB = getClassPriority(b.class);
      if (cA !== cB) return cA - cB;

      // Fresh First (0), Re-admission at end of each class register (1)
      const isReA = a.isReadmission ? 1 : 0;
      const isReB = b.isReadmission ? 1 : 0;
      if (isReA !== isReB) return isReA - isReB;

      // Class Roll No sorted numerically
      const rA = parseInt(String(a.rollNo || '').replace(/\D/g, ''), 10);
      const rB = parseInt(String(b.rollNo || '').replace(/\D/g, ''), 10);
      const hasRollA = !isNaN(rA) && rA > 0;
      const hasRollB = !isNaN(rB) && rB > 0;

      if (hasRollA && hasRollB) {
        if (rA !== rB) return rA - rB;
      } else if (hasRollA && !hasRollB) {
        return -1;
      } else if (!hasRollA && hasRollB) {
        return 1;
      }

      // Fallback: Admission No numerically
      const admA = parseInt(String(a.admNo || '').replace(/\D/g, ''), 10);
      const admB = parseInt(String(b.admNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(admA) && !isNaN(admB) && admA > 0 && admB > 0 && admA !== admB) {
        return admA - admB;
      }

      return (a.name || '').localeCompare(b.name || '');
    });

    // Re-index continuous S.No.
    return sorted.map((st, i) => ({ ...st, sno: i + 1 }));
  }, [normalizedStudents, selectedStatus, selectedAdmissionType, selectedClass, selectedStream, searchQuery, sortConfig, activeTab, selectedSession, isAprBianSession]);

  // ASYNC PHOTO FETCHING FOR VISIBLE FILTERED STUDENTS
  useEffect(() => {
    if (!filteredStudents || filteredStudents.length === 0) return;
    let isMounted = true;

    const toFetch = filteredStudents.filter(st => {
      const existing = (st.boardReg && isValidPhotoKey(st.boardReg) && photosMap[st.boardReg]) ||
        (st.formNo && isValidPhotoKey(st.formNo) && photosMap[st.formNo]) ||
        (st.id && isValidPhotoKey(st.id) && photosMap[st.id]) ||
        st.directPhoto;
      return !existing || existing === '/logo.png';
    });

    if (toFetch.length === 0) return;

    const chunkArray = (arr, size) => {
      const res = [];
      for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
      return res;
    };

    const batches = chunkArray(toFetch, 15);

    (async () => {
      for (const batch of batches) {
        if (!isMounted) break;
        const results = await Promise.all(
          batch.map(async (st) => {
            try {
              const url = await fetchStudentPhotoOnDemand(st.raw || st);
              return { id: st.id, formNo: st.formNo, boardReg: st.boardReg, url };
            } catch (_) {
              return null;
            }
          })
        );

        if (isMounted) {
          setPhotosMap(prev => {
            const next = { ...prev };
            results.forEach(r => {
              if (r && r.url) {
                if (r.id && isValidPhotoKey(r.id)) next[r.id] = r.url;
                if (r.formNo && isValidPhotoKey(r.formNo)) next[r.formNo] = r.url;
                if (r.boardReg && isValidPhotoKey(r.boardReg)) next[r.boardReg] = r.url;
              }
            });
            return next;
          });
        }
      }
    })();

    return () => { isMounted = false; };
  }, [filteredStudents]);

  const getResolvedStudentPhoto = (s) => {
    return (
      (s.boardReg && isValidPhotoKey(s.boardReg) && photosMap[s.boardReg]) ||
      (s.formNo && isValidPhotoKey(s.formNo) && photosMap[s.formNo]) ||
      (s.id && isValidPhotoKey(s.id) && photosMap[s.id]) ||
      s.directPhoto ||
      getStudentPhotoUrl(s.raw || s, '') ||
      ''
    );
  };

  const handleCleanPrint = async () => {
    if (isPreparingPrint) return;
    setIsPreparingPrint(true);

    try {
      // Resolve only the current filtered register, with bounded request concurrency.
      const missingPhotos = filteredStudents.filter(st => !getResolvedStudentPhoto(st));
      const resolvedPhotos = {};
      for (let i = 0; i < missingPhotos.length; i += 12) {
        const batch = missingPhotos.slice(i, i + 12);
        const results = await Promise.allSettled(batch.map(async (st) => ({
          student: st,
          url: await fetchStudentPhotoOnDemand(st.raw || st)
        })));
        results.forEach(result => {
          if (result.status !== 'fulfilled' || !result.value.url) return;
          const { student, url } = result.value;
          if (student.id) resolvedPhotos[student.id] = url;
          if (student.formNo) resolvedPhotos[student.formNo] = url;
          if (student.boardReg) resolvedPhotos[student.boardReg] = url;
        });
      }

      if (Object.keys(resolvedPhotos).length > 0) {
        setPhotosMap(prev => ({ ...prev, ...resolvedPhotos }));
      }

      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const images = Array.from(suiteRootRef.current?.querySelectorAll('img') || []);
      await Promise.all(images.map(img => {
        if (img.complete) return img.decode?.().catch(() => undefined) || Promise.resolve();
        return new Promise(resolve => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 5000);
        });
      }));

      window.print();
    } catch (error) {
      console.error('Could not fully prepare Admission Register print:', error);
      setToast({ message: 'Some print assets could not be prepared. Please retry after photos finish loading.', type: 'error' });
    } finally {
      setIsPreparingPrint(false);
    }
  };

  // Open Universal Readmission Modal (Candidate Search Mode)
  const handleOpenUniversalReadmissionModal = () => {
    setReadmissionModalStudent(null);
    setIsUniversalModalOpen(true);
    setSearchCandidateQuery('');
    setReAdmFormState({
      isReAdm: true,
      targetSession: selectedSession || '2025-26',
      targetClass: selectedClass !== 'ALL' ? selectedClass : '11th',
      targetStream: selectedStream !== 'ALL' ? selectedStream : 'General',
      assignedAdmNo: nextSequentialAdmNo,
      oldAdmNo: '',
      prevSchoolOrClass: '',
      reason: 'Gap in Studies / Re-enrolled'
    });
  };

  // Select Candidate for Readmission from Search Results
  const handleSelectCandidateForReadmission = (candidate) => {
    setReadmissionModalStudent(candidate);
    setIsUniversalModalOpen(false);

    const prevCls = candidate.class || '10th';
    let defaultTargetCls = '11th';
    if (prevCls.includes('10') || prevCls.includes('9')) {
      defaultTargetCls = '9th';
    } else if (prevCls.includes('12') || prevCls.includes('11')) {
      defaultTargetCls = '11th';
    }

    const prevAdm = candidate.oldAdmNo || candidate.admNo || '';
    const newAssignedAdm = nextSequentialAdmNo;

    setReAdmFormState({
      isReAdm: true,
      targetSession: selectedSession || '2025-26',
      targetClass: defaultTargetCls,
      targetStream: (candidate.stream === 'Science' || candidate.stream?.toLowerCase().includes('sci') || candidate.stream?.toLowerCase().includes('med')) ? 'Science' : 'Humanities',
      assignedAdmNo: newAssignedAdm,
      oldAdmNo: prevAdm,
      prevSchoolOrClass: `HSS Shangus (Class ${prevCls}, ${candidate.session || 'Past Session'})`,
      reason: 'Gap in Studies / Re-enrolled'
    });
  };

  // Open Readmission Modal from a specific row in the table
  const handleOpenReadmissionModal = (student) => {
    setReadmissionModalStudent(student);
    setIsUniversalModalOpen(false);

    const isCurrentReAdm = student.isReadmission;
    const prevAdm = student.oldAdmNo || (isCurrentReAdm ? '' : student.admNo) || '';
    const assignedAdm = isCurrentReAdm && student.admNo ? student.admNo : nextSequentialAdmNo;

    setReAdmFormState({
      isReAdm: true,
      targetSession: student.session || selectedSession || '2025-26',
      targetClass: student.class || '11th',
      targetStream: (student.stream === 'Science' || student.stream?.toLowerCase().includes('sci') || student.stream?.toLowerCase().includes('med')) ? 'Science' : 'Humanities',
      assignedAdmNo: assignedAdm,
      oldAdmNo: prevAdm,
      prevSchoolOrClass: `HSS Shangus (Class ${student.class || '11th'})`,
      reason: 'Gap in Studies / Re-enrolled'
    });
  };

  // Save Readmission Status to Firestore & Local Cache
  const handleSaveReadmission = async () => {
    if (!readmissionModalStudent) return;
    setSavingReAdm(true);
    try {
      const isRe = reAdmFormState.isReAdm;
      const targetSess = reAdmFormState.targetSession || selectedSession;
      const targetCls = reAdmFormState.targetClass || readmissionModalStudent.class || '11th';
      const targetStr = reAdmFormState.targetStream || readmissionModalStudent.stream || 'General';
      const assignedAdm = cleanStr(reAdmFormState.assignedAdmNo || readmissionModalStudent.admNo || nextSequentialAdmNo);
      const oldAdm = cleanStr(reAdmFormState.oldAdmNo);
      const reasonText = cleanStr(reAdmFormState.reason) || 'Gap in Studies / Re-enrolled';

      // Doc ID determination
      const docId = readmissionModalStudent.id && !readmissionModalStudent.id.startsWith('adm_') && !readmissionModalStudent.id.includes('_')
        ? readmissionModalStudent.id
        : (readmissionModalStudent.formNo ? `form_${readmissionModalStudent.formNo}` : `adm_${Date.now()}`);

      const docRef = doc(db, 'admissions', docId);
      const baseData = readmissionModalStudent.raw || {};

      const updates = {
        ...baseData,
        id: docId,
        studentName: readmissionModalStudent.name || baseData.studentName || '',
        fatherName: readmissionModalStudent.father || baseData.fatherName || '',
        session: targetSess,
        Session: targetSess,
        'Academic Session': targetSess,
        class: targetCls,
        Class: targetCls,
        'Admission sought for class': targetCls,
        stream: targetStr,
        Stream: targetStr,
        admNo: assignedAdm,
        'Adm. No.': assignedAdm,
        'Admission No.': assignedAdm,
        readmission: isRe ? 'Yes' : 'No',
        'Re-admission': isRe ? 'Yes' : 'No',
        isReadmission: isRe,
        oldAdmNo: isRe ? oldAdm : '',
        'Old Admission No.': isRe ? oldAdm : '',
        remarks: isRe ? `Re-admission (${reasonText})${oldAdm ? ` • Prev Adm: ${oldAdm}` : ''}` : cleanStr(baseData.remarks || ''),
        updatedAt: new Date().toISOString(),
        lastEditedBy: `Admin (${user?.email || 'Readmission Tool'})`
      };

      await setDoc(docRef, updates, { merge: true });
      updateCachedItem('admissions', docId, updates);

      // Update local dataset state
      setDataset(prev => {
        const exists = prev.some(item => item.id === docId || (readmissionModalStudent.formNo && item.formNo === readmissionModalStudent.formNo));
        if (exists) {
          return prev.map(item => (item.id === docId || (readmissionModalStudent.formNo && item.formNo === readmissionModalStudent.formNo)) ? { ...item, ...updates } : item);
        }
        if (targetSess === selectedSession) {
          return [updates, ...prev];
        }
        return prev;
      });

      await logAdminActivity({
        actionType: 'student_readmission_update',
        actionTitle: `Configured Re-admission: ${readmissionModalStudent.name} (${targetCls})`,
        details: `${readmissionModalStudent.name} mapped to Class ${targetCls} Session ${targetSess} as ${isRe ? `Re-admission (Adm No: ${assignedAdm || '—'}, Old Adm: ${oldAdm || 'N/A'})` : 'Fresh'}.`,
        metadata: { studentId: docId, targetClass: targetCls, targetSession: targetSess, isReadmission: isRe, oldAdmNo: oldAdm }
      });

      setToast({
        message: `✨ ${readmissionModalStudent.name} mapped to Class ${targetCls} (${targetSess}) as ${isRe ? 'Re-admission' : 'Fresh'}!`,
        type: 'success'
      });
      setReadmissionModalStudent(null);
      setIsUniversalModalOpen(false);
      setSearchCandidateQuery('');
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Error saving readmission:', err);
      setToast({ message: `❌ Failed to update readmission: ${err.message}`, type: 'error' });
    } finally {
      setSavingReAdm(false);
    }
  };

  // ─── Row-Level Inclusion/Exclusion (Skipping Specific Rows) ───
  const [skippedRowIds, setSkippedRowIds] = useState(() => new Set());
  const [showSkippedTray, setShowSkippedTray] = useState(false);

  const toggleRowSkip = useCallback((rowId) => {
    setSkippedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const toggleSelectAllRows = useCallback(() => {
    if (skippedRowIds.size === 0) {
      const allIds = new Set(filteredStudents.map(s => s.id));
      setSkippedRowIds(allIds);
    } else {
      setSkippedRowIds(new Set());
    }
  }, [filteredStudents, skippedRowIds.size]);

  const resetSkippedRows = useCallback(() => {
    setSkippedRowIds(new Set());
  }, []);

  // Active Included Rows (Dynamically Omits Skipped Rows & Recalculates Sequential S.No.)
  const activeIncludedRows = useMemo(() => {
    const included = filteredStudents.filter(s => !skippedRowIds.has(s.id));
    return included.map((s, idx) => ({
      ...s,
      sno: idx + 1
    }));
  }, [filteredStudents, skippedRowIds]);

  const skippedCount = skippedRowIds.size;
  const isAllRowsIncluded = skippedCount === 0 && filteredStudents.length > 0;
  const isSomeRowsSkipped = skippedCount > 0 && skippedCount < filteredStudents.length;

  // pageChunks uses studentsPerPage declared in top layout state

  const pageChunks = useMemo(() => {
    const isSentup = activeTab === 'sentup';
    const targetList = isSentup ? activeIncludedRows : filteredStudents;
    const perPage = isSentup ? (sentupStudentsPerPage || 10) : (studentsPerPage || 15);
    const chunks = [];
    for (let i = 0; i < targetList.length; i += perPage) {
      chunks.push(targetList.slice(i, i + perPage));
    }
    return chunks;
  }, [activeTab, activeIncludedRows, filteredStudents, studentsPerPage, sentupStudentsPerPage]);

  // ─── Sentup Multi-Page Structure (Page 1: Title/Cover, Page 2: Plan & Subject Key, Page 3+: Actual Roll Sheet) ───
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [includePlanPage, setIncludePlanPage] = useState(true);

  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [editingSubKey, setEditingSubKey] = useState(null);
  const [editSubCode, setEditSubCode] = useState('');
  const [editSubName, setEditSubName] = useState('');

  const handleStartEditSubjectAbbreviation = useCallback((sub, key) => {
    setEditingSubKey(key);
    setEditSubCode(sub.code || '');
    setEditSubName(sub.name || '');
  }, []);

  const handleCancelEditSubjectAbbreviation = useCallback(() => {
    setEditingSubKey(null);
    setEditSubCode('');
    setEditSubName('');
  }, []);

  const handleSaveEditSubjectAbbreviation = useCallback((key) => {
    if (!editSubCode.trim() || !editSubName.trim()) return;
    const updated = sentupSubjectAbbreviations.map((item, idx) => {
      const itemKey = item.id || `sub_idx_${idx}`;
      if (itemKey === key) {
        return {
          ...item,
          code: editSubCode.trim().toUpperCase(),
          name: editSubName.trim()
        };
      }
      return item;
    });
    setSentupSubjectAbbreviations(updated);
    setEditingSubKey(null);
    setEditSubCode('');
    setEditSubName('');
    saveSubjectAbbreviationsToCloud(updated);
  }, [editSubCode, editSubName, sentupSubjectAbbreviations, saveSubjectAbbreviationsToCloud]);

  const handleAddSubjectAbbreviation = useCallback(() => {
    if (!newSubCode.trim() || !newSubName.trim()) return;
    const newEntry = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      code: newSubCode.trim().toUpperCase(),
      name: newSubName.trim()
    };
    const updated = [...sentupSubjectAbbreviations, newEntry];
    setSentupSubjectAbbreviations(updated);
    setNewSubCode('');
    setNewSubName('');
    saveSubjectAbbreviationsToCloud(updated);
  }, [newSubCode, newSubName, sentupSubjectAbbreviations, saveSubjectAbbreviationsToCloud]);

  const handleDeleteSubjectAbbreviation = useCallback((targetKey) => {
    const updated = sentupSubjectAbbreviations.filter((item, idx) => {
      const itemKey = item.id || `sub_idx_${idx}`;
      return itemKey !== targetKey;
    });
    setSentupSubjectAbbreviations(updated);
    setEditingSubKey(prev => prev === targetKey ? null : prev);
    saveSubjectAbbreviationsToCloud(updated);
  }, [sentupSubjectAbbreviations, saveSubjectAbbreviationsToCloud]);

  const handleResetSubjectAbbreviations = useCallback(() => {
    const updated = DEFAULT_SENTUP_SUBJECT_DIRECTORY;
    setSentupSubjectAbbreviations(updated);
    saveSubjectAbbreviationsToCloud(updated);
  }, [saveSubjectAbbreviationsToCloud]);

  // Scope filter for Page 2 Subject Key: 'school' (All School Subjects) vs 'cohort' (Only Subjects in this Roll Sheet)
  const [subjectKeyScope, setSubjectKeyScope] = useState('school');

  // Dynamically extract all unique subject codes present in the currently included students
  const activeCohortSubjectCodes = useMemo(() => {
    const codes = new Set();
    activeIncludedRows.forEach(s => {
      const subsStr = s.subs || '';
      if (!subsStr || subsStr === '—' || subsStr === '-') return;
      const parts = subsStr.split(',').map(p => p.trim()).filter(Boolean);
      parts.forEach(p => {
        codes.add(p.toUpperCase());
      });
    });
    return codes;
  }, [activeIncludedRows]);

  // Active Subject List for Page 2
  const displayedSubjectDirectory = useMemo(() => {
    if (subjectKeyScope === 'cohort' && activeCohortSubjectCodes.size > 0) {
      const filtered = sentupSubjectAbbreviations.filter(sub => {
        const subCodes = String(sub.code || '').split(/[/,]+/).map(c => c.trim().toUpperCase());
        return subCodes.some(c => activeCohortSubjectCodes.has(c));
      });
      if (filtered.length > 0) return filtered;
    }
    return sentupSubjectAbbreviations;
  }, [subjectKeyScope, activeCohortSubjectCodes, sentupSubjectAbbreviations]);

  // Split subject abbreviations into two balanced columns for compact 2-column display on Page 2
  const { leftSubjects, rightSubjects } = useMemo(() => {
    const list = displayedSubjectDirectory || [];
    const mid = Math.ceil(list.length / 2);
    return {
      leftSubjects: list.slice(0, mid),
      rightSubjects: list.slice(mid)
    };
  }, [displayedSubjectDirectory]);

  // Sentup Candidate Census Statistics (Rendered on Cover & Plan Pages)
  const sentupCensus = useMemo(() => {
    const total = activeIncludedRows.length;
    let boys = 0;
    let girls = 0;
    let science = 0;
    let humanities = 0;
    let commerce = 0;
    let general = 0;
    const rollNos = [];

    activeIncludedRows.forEach(s => {
      const g = String(s.gender || '').toLowerCase();
      if (g.startsWith('m')) boys++;
      else if (g.startsWith('f')) girls++;

      const st = extractStudentStream(s, s.subs || '');
      if (st === 'Science') science++;
      else if (st === 'Humanities') humanities++;
      else if (st === 'Commerce') commerce++;
      else general++;

      if (s.rollNo) {
        rollNos.push(String(s.rollNo).trim());
      }
    });

    let rollRange = '—';
    if (rollNos.length === 1) {
      rollRange = `Roll No. ${rollNos[0]}`;
    } else if (rollNos.length > 1) {
      rollRange = `Roll No. ${rollNos[0]} to ${rollNos[rollNos.length - 1]}`;
    }

    return {
      total,
      boys,
      girls,
      science,
      humanities,
      commerce,
      general,
      rollRange,
      firstRoll: rollNos[0] || '—',
      lastRoll: rollNos[rollNos.length - 1] || '—'
    };
  }, [activeIncludedRows]);

  const sentupTotalPages = (includeCoverPage ? 1 : 0) + (includePlanPage ? 1 : 0) + pageChunks.length;

  // Summary Target Students: strictly aggregates the paired classes (e.g. 11th & 12th or 9th & 10th)
  // so the roll statement on the Consolidated Summary page always presents both classes together!
  const summaryTargetStudents = useMemo(() => {
    const targetClasses = [];
    const is11or12 = selectedClass.includes('11') || selectedClass.includes('12');
    const is9or10 = selectedClass.includes('9') || selectedClass.includes('10');

    if (is11or12) {
      targetClasses.push('11th', '12th');
    } else if (is9or10) {
      targetClasses.push('9th', '10th');
    } else {
      // ALL
      availableClasses.forEach(c => targetClasses.push(c));
    }

    return normalizedStudents.filter(s => {
      // 1. Status Filter (Applies to summary as well, e.g. Approved students)
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'Approved') {
          if (s.status !== 'Approved') return false;
        } else if (selectedStatus === 'Submitted') {
          if (s.status !== 'Submitted' && s.status !== 'Approved') return false;
        } else if (selectedStatus === 'Provisional') {
          if (s.status !== 'Provisional') return false;
        } else if (s.status !== selectedStatus) {
          return false;
        }
      }

      // 2. Admission Type Filter
      if (selectedAdmissionType === 'fresh' && s.isReadmission) return false;
      if (selectedAdmissionType === 'readmission' && !s.isReadmission) return false;

      // 3. Class Filter: Match paired classes
      const sCls = String(s.class || '').toLowerCase();
      const matchCls = targetClasses.some(tc => matchesClassVal(tc, sCls));
      if (!matchCls) return false;

      // 4. Stream Filter
      if (selectedStream !== 'ALL') {
        if (s.stream !== selectedStream) return false;
      }

      return true;
    });
  }, [normalizedStudents, selectedClass, selectedStatus, selectedAdmissionType, selectedStream, availableClasses]);

  // Consolidated Summary Breakdown Stats
  const summaryStats = useMemo(() => {
    const map = {};
    summaryTargetStudents.forEach(s => {
      let c = cleanStr(s.class) || '11th';
      if (!c.endsWith('th')) c = `${c}th`;
      if (c.includes('11')) c = '11th';
      else if (c.includes('12')) c = '12th';
      else if (c.includes('10')) c = '10th';
      else if (c.includes('9')) c = '9th';

      const str = s.stream || 'General';
      if (!map[c]) map[c] = {};
      if (!map[c][str]) map[c][str] = { male: 0, female: 0, total: 0, reAdm: 0 };
      const isFemale = s.gender.toLowerCase().startsWith('f');
      if (isFemale) map[c][str].female++;
      else map[c][str].male++;
      if (s.isReadmission) map[c][str].reAdm++;
      map[c][str].total++;
    });
    return map;
  }, [summaryTargetStudents]);

  const sortedSummaryClasses = useMemo(() => {
    const order = ['9th', '10th', '11th', '12th'];
    return Object.keys(summaryStats).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      const numA = parseInt(a, 10) || 0;
      const numB = parseInt(b, 10) || 0;
      return numA - numB;
    });
  }, [summaryStats]);

  // Total Counts for the Consolidated Summary
  const overallSummaryTotals = useMemo(() => {
    let m = 0, f = 0, tot = 0, re = 0;
    summaryTargetStudents.forEach(s => {
      const isFemale = s.gender.toLowerCase().startsWith('f');
      if (isFemale) f++;
      else m++;
      if (s.isReadmission) re++;
      tot++;
    });
    return { male: m, female: f, grandTotal: tot, totalReAdm: re };
  }, [summaryTargetStudents]);

  // Editable Register Notes Page State
  const [registerNotes, setRegisterNotes] = useState([
    {
      id: 1,
      text: "Details of columns with Yellow background in their header have been copied/adapted from students' response (Online Admission Form); remaining details have been verified."
    },
    {
      id: 2,
      text: "The students with the comment 'internal student of HSS Shangus' under the 'Admtd. Vide DC/CC' column are those who studied their Class 10th at Govt Hr Sec School Shangus (010061). They appeared in the Class 10th annual regular examination 2025 (march session), conducted by JKBOSE, through this same school. Their admission to Class 11th was granted based on the mark sheets provided by the school. For further verification, please refer to the Class 9th/10th admission records."
    },
    {
      id: 3,
      text: "Abbreviations of Subjects used: BI (Biology), CH (Chemistry), EC (Economics), ED (Education), EN (General English), ES (Environmental Science), HT (History), HTC (Healthcare), ITE (IT & ITES), MA (Mathematics), PD (Physical Education), PH (Physics), PS (Political Science), and UR (Urdu)."
    },
    {
      id: 4,
      text: "Fresh admission numbers have been assigned to students re-joining after an academic gap or those readmitted due to non-appearance in prior exams. To facilitate historical tracking, the student's previous admission number is recorded in brackets immediately below the new number in the 'Adm. No.' column [e.g., 5265 (5071)]."
    }
  ]);

  const handleAddNote = () => {
    const newId = registerNotes.length > 0 ? Math.max(...registerNotes.map(n => n.id)) + 1 : 1;
    setRegisterNotes([...registerNotes, { id: newId, text: 'New verification note or institutional remark...' }]);
  };

  const handleRemoveNote = (id) => {
    setRegisterNotes(registerNotes.filter(n => n.id !== id));
  };

  const handleUpdateNote = (id, newText) => {
    setRegisterNotes(registerNotes.map(n => n.id === id ? { ...n, text: newText } : n));
  };

  // -------------------------------------------------------------
  // ASSIGN IDs ENGINE STATE & LOGIC
  // -------------------------------------------------------------
  const [assignStartId, setAssignStartId] = useState('5476');
  const [assigningIds, setAssigningIds] = useState(false);
  const [assignClasses, setAssignClasses] = useState(['9th', '11th']);
  const [assignSessionFilter, setAssignSessionFilter] = useState('2025-26');
  const [onlyMissingAdmNo, setOnlyMissingAdmNo] = useState(true);
  const [assignStrategies, setAssignStrategies] = useState({});

  const calculatedNextAdmNo = useMemo(() => {
    let maxId = 5000;
    normalizedStudents.forEach(s => {
      const num = parseInt(s.admNo, 10);
      if (!isNaN(num) && num > maxId && num < 99999) {
        maxId = num;
      }
    });
    return String(maxId + 1);
  }, [normalizedStudents]);

  useEffect(() => {
    if (calculatedNextAdmNo && (!assignStartId || assignStartId === '5476')) {
      setAssignStartId(calculatedNextAdmNo);
    }
  }, [calculatedNextAdmNo]);

  const candidateAssignStudents = useMemo(() => {
    return normalizedStudents.filter(st => {
      if (assignSessionFilter !== 'ALL' && st.session !== assignSessionFilter) return false;
      if (assignClasses.length > 0) {
        const match = assignClasses.some(c => matchesClassVal(c, st.class));
        if (!match) return false;
      }
      if (onlyMissingAdmNo) {
        if (st.admNo && st.admNo !== '—' && st.admNo !== 'N/A') return false;
      }
      return true;
    });
  }, [normalizedStudents, assignSessionFilter, assignClasses, onlyMissingAdmNo]);

  const candidateIdPreviewList = useMemo(() => {
    let seqCounter = parseInt(assignStartId, 10) || 5476;
    return candidateAssignStudents.map(st => {
      const reg = st.boardReg;
      let prevInfo = null;
      if (reg && reg.length > 5) {
        const histMatch = (historyDataset || []).find(h => {
          const hReg = cleanStr(h.boardRegNo || h['Board Registration Number']);
          const hAdm = cleanStr(h.admNo || h['Adm. No.']);
          return hReg === reg && hAdm && h.id !== st.id;
        });
        if (histMatch) {
          prevInfo = {
            admNo: cleanStr(histMatch.admNo || histMatch['Adm. No.']),
            class: cleanStr(histMatch.class || histMatch.Class || '10th'),
            session: cleanStr(histMatch.session || histMatch.Session || '')
          };
        }
      }

      const userStrat = assignStrategies[st.id];
      const strat = userStrat || (prevInfo ? 'inherit_prev' : 'assign_new');

      let proposed = '—';
      if (strat === 'assign_new') {
        proposed = String(seqCounter);
        seqCounter++;
      } else if (strat === 'inherit_prev' && prevInfo) {
        proposed = prevInfo.admNo;
      } else if (strat === 'skip') {
        proposed = st.admNo || '—';
      }

      return {
        student: st,
        currentAdm: st.admNo,
        prevInfo,
        strat,
        proposed
      };
    });
  }, [candidateAssignStudents, assignStartId, assignStrategies, historyDataset]);

  const handleRunAssignIds = async () => {
    if (candidateIdPreviewList.length === 0) {
      setToast({ message: '⚠️ No eligible students selected for assignment.', type: 'error' });
      return;
    }

    setAssigningIds(true);
    let count = 0;
    try {
      const batch = writeBatch(db);
      const todayDate = new Date().toISOString().split('T')[0];

      for (const item of candidateIdPreviewList) {
        const { student, proposed, strat } = item;
        if (!proposed || proposed === '—' || strat === 'skip') continue;

        const docRef = doc(db, 'admissions', student.id);
        const payload = {
          'Adm. No.': proposed,
          admNo: proposed,
          'Adm. Date': student.admDate || todayDate,
          updatedAt: new Date().toISOString(),
          lastEditedBy: `Admin (${user?.email || 'Assign IDs'})`
        };
        batch.set(docRef, payload, { merge: true });
        updateCachedItem('admissions', student.id, payload);
        count++;
      }

      await batch.commit();

      await logAdminActivity({
        actionType: 'batch_id_assign',
        actionTitle: 'Bulk Assigned Admission Numbers',
        details: `Assigned admission numbers to ${count} students in session ${assignSessionFilter}.`,
        metadata: { count, session: assignSessionFilter }
      });

      setToast({ message: `✨ Successfully assigned Admission Numbers to ${count} students!`, type: 'success' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Assign IDs batch error:', err);
      setToast({ message: `❌ Error assigning IDs: ${err.message}`, type: 'error' });
    } finally {
      setAssigningIds(false);
    }
  };

  // -------------------------------------------------------------
  // ASSIGN DATES ENGINE STATE & LOGIC
  // -------------------------------------------------------------
  const [assignDateValue, setAssignDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [assignDateField, setAssignDateField] = useState('admDate');
  const [assignDateSession, setAssignDateSession] = useState('2025-26');
  const [assignDateClass, setAssignDateClass] = useState('ALL');
  const [assigningDates, setAssigningDates] = useState(false);

  const dateTargetStudents = useMemo(() => {
    return normalizedStudents.filter(st => {
      if (assignDateSession !== 'ALL' && st.session !== assignDateSession) return false;
      if (assignDateClass !== 'ALL' && !matchesClassVal(assignDateClass, st.class)) return false;
      return true;
    });
  }, [normalizedStudents, assignDateSession, assignDateClass]);

  const handleRunAssignDates = async () => {
    if (dateTargetStudents.length === 0) {
      setToast({ message: '⚠️ No students match the selected session and class scope.', type: 'error' });
      return;
    }
    setAssigningDates(true);
    try {
      const batch = writeBatch(db);
      const fieldKey = assignDateField === 'admDate' ? 'Adm. Date' : 'Online Subm. Date';
      const aliasKey = assignDateField === 'admDate' ? 'admDate' : 'onlineSubmDate';

      for (const st of dateTargetStudents) {
        const docRef = doc(db, 'admissions', st.id);
        const payload = {
          [fieldKey]: assignDateValue,
          [aliasKey]: assignDateValue,
          updatedAt: new Date().toISOString(),
          lastEditedBy: `Admin (${user?.email || 'Assign Dates'})`
        };
        batch.set(docRef, payload, { merge: true });
        updateCachedItem('admissions', st.id, payload);
      }

      await batch.commit();

      await logAdminActivity({
        actionType: 'batch_date_assign',
        actionTitle: `Bulk Assigned ${assignDateField === 'admDate' ? 'Admission Date' : 'Submission Date'}`,
        details: `Assigned date ${assignDateValue} to ${dateTargetStudents.length} students.`,
        metadata: { date: assignDateValue, count: dateTargetStudents.length }
      });

      setToast({ message: `✨ Applied date (${assignDateValue}) to ${dateTargetStudents.length} records!`, type: 'success' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Assign Dates error:', err);
      setToast({ message: `❌ Failed to assign dates: ${err.message}`, type: 'error' });
    } finally {
      setAssigningDates(false);
    }
  };

  // Native Excel (.xlsx) Export for Admission Register and Sentup
  const handleExportExcel = () => {
    if (filteredStudents.length === 0) return;

    if (activeTab === 'adm_register') {
      const headers = [
        'S.No.', 'Class Roll No.', 'Form No.', 'Status', 'Admission Type', 'Online Subm.', 'Adm. Date', 'Adm. No.', 'Old Adm. No.', 'Class', 'Board Reg. No.',
        "Student's Name", "Father's Name", "Mother's Name", 'DOB (Figures)', 'DOB (Words)', 'Gender',
        'Village/Town', 'Block', 'Tehsil', 'District', 'Student Mobile', 'Parent Mobile',
        'Stream', 'Chosen Subjects', 'Aadhaar No.', 'Social Category', 'Socio-Economic Category', 'Blood Group',
        'Bank Account No.', 'IFSC Code', 'PEN (UDISE)', 'Previous School', 'Prev Roll No', 'Prev Result',
        'Admtd. Vide DC/CC', 'Withdrawal Date', 'Issued DC/CC', 'DC/CC Receipt', 'Remarks'
      ];

      const rows = filteredStudents.map(s => [
        s.sno,
        s.rollNo || '',
        s.formNo || '',
        s.status || '',
        s.isReadmission ? 'Re-admission' : 'Fresh',
        s.onlineStatus || '',
        s.admDate || '',
        s.admNo || '',
        s.oldAdmNo || '',
        s.class || '',
        s.boardReg || '',
        s.name || '',
        s.father || '',
        s.mother || '',
        s.dobFigures || '',
        s.dobWords || '',
        s.gender || '',
        s.village || '',
        s.block || '',
        s.tehsil || '',
        s.district || '',
        s.mobile || '',
        s.parentMobile || '',
        s.stream || '',
        s.subs || '',
        s.aadhar || '',
        s.category || '',
        s.socioEcon || '',
        s.blood || '',
        s.account || '',
        s.ifsc || '',
        s.pen || '',
        s.prevSchool || '',
        s.prevRoll || '',
        s.prevResult || '',
        s.prevCC || '',
        s.withdrawal || '',
        s.issuedCC || '',
        s.receipt || '',
        s.remarks || ''
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Admission_Register');
      const filename = `HSS_Shangus_Official_Admission_Register_${selectedSession}_${selectedClass}_${selectedStatus}.xlsx`;
      XLSX.writeFile(wb, filename);
    } else {
      const colDefs = [
        { key: 'st_sno', label: 'S.No.', get: s => s.sno },
        { key: 'st_sno', label: 'Adm. No.', get: s => s.admNo || '' },
        { key: 'st_rollNo', label: 'Class Roll No.', get: s => s.rollNo || '' },
        { key: 'st_boardReg', label: 'Board Reg. No.', get: s => s.boardReg || '' },
        { key: 'st_name', label: "Student's Name", get: s => s.name || '' },
        { key: 'st_parentage', label: "Father's Name", get: s => s.father || '' },
        { key: 'st_parentage', label: "Mother's Name", get: s => s.mother || '' },
        { key: 'st_dob', label: 'Date of Birth', get: s => s.dobFigures || '' },
        { key: 'st_subs', label: 'Subjects', get: s => s.subs || '' },
        { key: 'st_boardRoll', label: 'Board Roll No.', get: s => s.boardRollNo || '' },
        { key: 'st_result', label: 'Result', get: s => s.currentResult || '' },
        { key: 'st_admitReceipt', label: 'Admit Card Receipt', get: () => '' },
        { key: 'st_marksReceipt', label: 'Marks Card Receipt', get: () => '' }
      ];

      const activeColDefs = colDefs.filter(c => isSentupColVisible(c.key));
      const headers = activeColDefs.map(c => c.label);
      const exportList = activeTab === 'sentup' ? activeIncludedRows : filteredStudents;
      const rows = exportList.map(s => activeColDefs.map(c => c.get(s)));

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'JKBOSE_Sentup');
      const filename = `HSS_Shangus_JKBOSE_Sentup_${selectedSession}_${selectedClass}_${selectedStatus}.xlsx`;
      XLSX.writeFile(wb, filename);
    }
  };

  // Dynamic Print Dimensions for JKBOSE / Indian Legal (Default: 13.7in x 8.5in), Standard Legal, or A4
  const isA4 = paperSize === 'a4';
  const isStandardLegal = paperSize === 'legal';
  // Default is 'indian_legal': 13.7in x 8.5in (347.98mm x 215.9mm) - Standard JKBOSE Admission Register & Sentup Sheet
  const paperHeightMm = isA4 ? 210 : 215.9;
  const paperWidthMm = isA4 ? 297 : (isStandardLegal ? 355.6 : 347.98);
  const pageSizeCss = isA4 ? 'a4 landscape' : (isStandardLegal ? 'legal landscape' : '13.7in 8.5in');

  const printMarginMm = Math.max(2.5, Math.min(20, printMargin * 25.4));
  const printableHeightMm = Math.max(140, paperHeightMm - (printMarginMm * 2) - 1.0);

  const currentStudentsPerPage = activeTab === 'sentup' ? (sentupStudentsPerPage || 10) : (studentsPerPage || 15);
  // Allowance for top school header, thead, and signature footer:
  // Sentup: sentup-header (12mm) + margin (1.2mm) + thead (6.5mm) + signature-footer (8.5mm) + margin (1.5mm) + borders (2mm) = 31.7mm -> safe allowance 34mm
  // Register: register-header (12mm) + margin (1.5mm) + thead (14mm) + signature-footer (13.5mm) + margin (1.5mm) + borders (2mm) = 44.5mm
  const headerFooterAllowanceMm = activeTab === 'sentup' ? 34 : 44.5;
  const maxFittingRowMm = (printableHeightMm - headerFooterAllowanceMm) / currentStudentsPerPage;
  // Floor to 1 decimal place with 0.2mm safety buffer to guarantee zero page overflow in Blink:
  const calculatedRowHeightMm = Math.max(6.0, Math.floor((maxFittingRowMm - 0.2) * 10) / 10).toFixed(1);

  return (
    <div ref={suiteRootRef} className="admission-suite-root min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* ─── DYNAMIC PRINT CSS STYLESHEET (STRICT CLEAN 13.7" x 8.5" JKBOSE / LEGAL LANDSCAPE) ─── */}
      <style>{`
        @page {
          size: ${pageSizeCss};
          margin: ${printMargin}in;
        }
        @media print {
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif !important;
          }
          
          /* Suppress ALL injected header/footer watermarks and accessibility skip buttons */
          body::before, body::after, html::before, html::after, .ui-skip-link {
            display: none !important;
            content: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Strictly isolate the register without retaining hidden portal layout space. */
          body.admission-register-print-mode * {
            visibility: hidden !important;
          }

          body.admission-register-print-mode .admission-suite-root,
          body.admission-register-print-mode .admission-suite-root * {
            visibility: visible !important;
          }

          body.admission-register-print-mode .admission-suite-root {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            display: block !important;
            background: #ffffff !important;
          }

          .admission-suite-root header, .admission-suite-root nav, .admission-suite-root footer,
          .admission-suite-root aside, .admission-suite-root .no-print, .admission-suite-root button,
          .admission-suite-root select, .admission-suite-root input, .admission-suite-root .screen-only,
          .admission-suite-root .fixed, .admission-suite-root .sticky, .global-hud {
            display: none !important;
          }

          .admission-suite-root .print-only { display: block !important; }

          /* Ensure parent themes don't apply backgrounds or borders during print */
          .admin-dashboard-theme, .workspace-card, .admin-dashboard-theme > div {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .admission-suite-root, .admission-suite-root main, .admission-suite-root .page-container,
          .admission-suite-root .spread-container, .admission-suite-root .overflow-x-auto {
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            box-shadow: none !important;
          }

          * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }

          ::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }

          .space-y-6, .space-y-4, .space-y-3 {
            display: block !important;
            gap: 0 !important;
            margin: 0 !important;
            transform: none !important;
          }

          .spread-container {
            display: block !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          .page-container {
            display: block !important;
            position: relative !important;
            box-sizing: border-box !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            outline: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          /* ─── DUAL-PART ADMISSION REGISTER (PART 1 & PART 2 IDENTICAL SUB-MILLIMETER ROW ALIGNMENT) ─── */
          .register-ledger-page {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            box-sizing: border-box !important;
            padding: 0 !important;
            margin: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .spread-container .register-ledger-page:first-child {
            page-break-after: always !important;
            break-after: page !important;
          }

          .spread-container .register-ledger-page:last-child {
            page-break-after: always !important;
            break-after: page !important;
          }

          .spread-container:last-child .register-ledger-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .register-ledger-page .overflow-x-auto {
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .register-ledger-page .admission-spread-table {
            display: table !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          .register-ledger-page .admission-spread-table tbody {
            height: auto !important;
          }

          /* Header locked strictly to 12mm on Part 1 and Part 2 */
          .register-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            height: 12mm !important;
            min-height: 12mm !important;
            max-height: 12mm !important;
            margin-bottom: 1.5mm !important;
            padding-bottom: 1mm !important;
            border-bottom: 1.5px solid #0f172a !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
          }

          .register-header h2 {
            font-size: 15px !important;
            line-height: 1.1 !important;
            margin: 0 !important;
          }

          .register-header .register-header-sub {
            font-size: 9px !important;
            line-height: 1.1 !important;
            margin-top: 0.5mm !important;
          }

          /* Thead locked strictly to 14mm (7mm per row) on both Part 1 and Part 2 */
          .admission-spread-table {
            display: table !important;
            table-layout: fixed !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            font-size: ${currentStudentsPerPage >= 16 ? '7px' : '7.8px'} !important;
            box-sizing: border-box !important;
          }

          .admission-spread-table thead {
            height: 14mm !important;
            min-height: 14mm !important;
            max-height: 14mm !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
          }

          .admission-spread-table thead tr {
            height: 7mm !important;
            min-height: 7mm !important;
            max-height: 7mm !important;
            box-sizing: border-box !important;
          }

          .admission-spread-table thead th {
            height: 7mm !important;
            min-height: 7mm !important;
            max-height: 7mm !important;
            padding: 0.5px 1px !important;
            font-size: 6.8px !important;
            font-weight: 800 !important;
            line-height: 1.05 !important;
            vertical-align: middle !important;
            text-align: center !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .admission-spread-table thead th[rowspan="2"] {
            height: 14mm !important;
            min-height: 14mm !important;
            max-height: 14mm !important;
          }

          /* Universal column stretching without rigid max-width caps */
          .admission-spread-table th,
          .admission-spread-table td,
          .sentup-table th,
          .sentup-table td {
            min-width: 0 !important;
            max-width: none !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }

          /* Every student row locked to EXACT calculatedRowHeightMm on both Part 1 and Part 2 */
          .register-resizable-row,
          .admission-spread-table tbody tr {
            height: ${calculatedRowHeightMm}mm !important;
            min-height: ${calculatedRowHeightMm}mm !important;
            max-height: ${calculatedRowHeightMm}mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .register-resizable-row > td,
          .admission-spread-table tbody tr > td {
            height: ${calculatedRowHeightMm}mm !important;
            min-height: ${calculatedRowHeightMm}mm !important;
            max-height: ${calculatedRowHeightMm}mm !important;
            padding: 0.3mm 0.8mm !important;
            font-size: ${currentStudentsPerPage >= 16 ? '7px' : '7.8px'} !important;
            line-height: 1.15 !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .admission-spread-table tbody tr > td > div,
          .admission-spread-table tbody tr > td > span {
            max-height: calc(${calculatedRowHeightMm}mm - 0.6mm) !important;
            overflow: hidden !important;
          }

          .register-photo-cell,
          .sentup-table .sentup-photo-cell,
          .sentup-table td.sentup-photo-cell {
            padding: 0.3mm !important;
            height: ${calculatedRowHeightMm}mm !important;
            min-height: ${calculatedRowHeightMm}mm !important;
            max-height: ${calculatedRowHeightMm}mm !important;
            width: 11mm !important;
            min-width: 11mm !important;
            max-width: 13mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            vertical-align: middle !important;
            text-align: center !important;
          }

          .admission-spread-table th[data-col="sno"],
          .sentup-table th[data-col="st_sno"] {
            width: 10mm !important;
            min-width: 9mm !important;
            max-width: 12mm !important;
          }

          .register-photo-cell img {
            width: auto !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: calc(${calculatedRowHeightMm}mm - 0.8mm) !important;
            object-fit: contain !important;
            object-position: center center !important;
            display: block !important;
            margin: 0 auto !important;
          }

          .register-ledger-page .signature-footer {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-end !important;
            margin-top: 1.5mm !important;
            height: 13.5mm !important;
            min-height: 13.5mm !important;
            max-height: 13.5mm !important;
            padding: 1.5mm 0 0.5mm !important;
            box-sizing: border-box !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            flex-shrink: 0 !important;
          }

          .register-ledger-page .signature-footer > .signature-block {
            width: 42mm !important;
            flex: 0 0 42mm !important;
            text-align: center !important;
            font-size: 9.5px !important;
            font-weight: 900 !important;
            color: #991b1b !important;
            border-top: 1.5px solid #991b1b !important;
            padding-top: 1mm !important;
            box-sizing: border-box !important;
          }

          /* ─── SENTUP ROLL SHEET PAGES & PAGINATION (ZERO OVERFLOW, RELIABLE BLINK RENDERING) ─── */
          .sentup-cover-page {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            box-sizing: border-box !important;
            padding: 3mm 5mm !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .sentup-plan-page {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            box-sizing: border-box !important;
            padding: 2mm 3.5mm !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .sentup-plan-page .grid {
            width: 100% !important;
          }

          .sentup-plan-page .subject-key-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 7px !important;
            line-height: 1.1 !important;
          }

          .sentup-plan-page .subject-key-table th {
            background-color: #0f172a !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            padding: 1px 2.5px !important;
            font-size: 7px !important;
          }

          .sentup-plan-page .subject-key-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 0.8px 2px !important;
            font-size: 7px !important;
          }

          .sentup-ledger-page {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            box-sizing: border-box !important;
            padding: 0 !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .sentup-ledger-page:last-child,
          .sentup-cover-page:last-child,
          .sentup-plan-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .sentup-cover-page .cover-title-box {
            border: 3px double #991b1b !important;
            background: #fffafa !important;
            padding: 3mm 5mm !important;
            border-radius: 3mm !important;
            text-align: center !important;
          }

          .sentup-cover-page .cover-school-title {
            font-size: 19pt !important;
            font-weight: 900 !important;
            line-height: 1.15 !important;
            letter-spacing: 0.03em !important;
            color: #991b1b !important;
          }

          .sentup-cover-page .cover-doc-title {
            font-size: 17pt !important;
            font-weight: 900 !important;
            line-height: 1.15 !important;
            letter-spacing: 0.02em !important;
            color: #0f172a !important;
          }

          .sentup-ledger-page .sentup-header {
            display: block !important;
            position: relative !important;
            height: 12mm !important;
            min-height: 12mm !important;
            max-height: 12mm !important;
            margin-bottom: 1.2mm !important;
            padding-bottom: 0.8mm !important;
            border-bottom: 1.5px solid #0f172a !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
            overflow: hidden !important;
          }

          .manual-sno-circle {
            width: 20px !important;
            height: 20px !important;
            min-width: 20px !important;
            min-height: 20px !important;
            border-radius: 50% !important;
            border: 1.5px solid #0f172a !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
          }

          .sentup-ledger-page .sentup-header h1 {
            font-size: 15px !important;
            font-weight: 900 !important;
            line-height: 1.15 !important;
            margin: 0 !important;
            padding: 0 !important;
            letter-spacing: 0.03em !important;
            color: #991b1b !important;
          }

          .sentup-ledger-page .sentup-header .sentup-subtitle {
            font-size: 8.5px !important;
            font-weight: 800 !important;
            line-height: 1.15 !important;
            margin-top: 1px !important;
          }

          .sentup-ledger-page .overflow-x-auto {
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .sentup-table,
          .sentup-ledger-page .sentup-table {
            display: table !important;
            table-layout: fixed !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            font-size: ${currentStudentsPerPage >= 18 ? '7px' : currentStudentsPerPage >= 15 ? '7.5px' : '8.5px'} !important;
            line-height: 1.15 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
          }

          .sentup-table thead {
            display: table-header-group !important;
            flex-shrink: 0 !important;
          }

          .sentup-table thead tr {
            height: 6.5mm !important;
            max-height: 6.5mm !important;
          }

          .sentup-table th {
            padding: 1px 2px !important;
            font-size: ${currentStudentsPerPage >= 18 ? '7px' : '7.8px'} !important;
            line-height: 1.1 !important;
            font-weight: 800 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .sentup-table tbody {
            display: table-row-group !important;
            height: auto !important;
          }

          .sentup-table tbody tr {
            display: table-row !important;
            height: ${calculatedRowHeightMm}mm !important;
            min-height: ${calculatedRowHeightMm}mm !important;
            max-height: ${calculatedRowHeightMm}mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .sentup-table td {
            height: ${calculatedRowHeightMm}mm !important;
            min-height: ${calculatedRowHeightMm}mm !important;
            max-height: ${calculatedRowHeightMm}mm !important;
            padding: 0.3mm 0.8mm !important;
            line-height: 1.15 !important;
            font-size: ${currentStudentsPerPage >= 18 ? '7px' : currentStudentsPerPage >= 15 ? '7.5px' : '8.5px'} !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .sentup-table .sentup-photo-cell img,
          .sentup-table td.sentup-photo-cell img {
            max-height: calc(${calculatedRowHeightMm}mm - 0.8mm) !important;
            max-width: 100% !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            object-position: center center !important;
            display: block !important;
            margin: 0 auto !important;
          }

          /* Proportional column widths for edge-to-edge Sentup print */
          .sentup-table th[data-col="st_subs"],
          .sentup-table td.st-subs-cell {
            width: ${currentStudentsPerPage >= 18 ? '14mm' : '12mm'} !important;
            padding: 0.2mm 0.5mm !important;
            overflow: hidden !important;
          }

          .sentup-table .st-subs-item {
            font-size: ${currentStudentsPerPage >= 18 ? '6px' : currentStudentsPerPage >= 15 ? '6.8px' : '7.5px'} !important;
            line-height: 1.05 !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
          }

          .sentup-table th[data-col="st_boardRoll"],
          .sentup-table th.th-col-st_boardRoll,
          .sentup-table td.st-boardroll-cell {
            width: 22mm !important;
            padding: 0.3mm 0.8mm !important;
          }

          .sentup-table td.st-boardroll-cell,
          .sentup-table .st-boardroll-cell {
            font-size: ${currentStudentsPerPage >= 18 ? '9.5px' : '10.5px'} !important;
            font-weight: 900 !important;
            line-height: 1.1 !important;
            letter-spacing: -0.01em !important;
          }

          .sentup-table .st-boardroll-cell div {
            font-size: ${currentStudentsPerPage >= 18 ? '9.5px' : '10.5px'} !important;
            font-weight: 900 !important;
          }

          /* Snug proportional width and crisp print font for BOARD REG. NO. */
          .sentup-table th[data-col="st_boardReg"],
          .sentup-table th.th-col-st_boardReg {
            width: 26mm !important;
            font-size: 8.5px !important;
            font-weight: 900 !important;
            line-height: 1.1 !important;
            letter-spacing: 0.01em !important;
          }

          .sentup-table td.st-boardreg-cell,
          .sentup-table .st-boardreg-cell {
            width: 26mm !important;
            font-size: ${currentStudentsPerPage >= 18 ? '9px' : '10px'} !important;
            font-weight: 900 !important;
            line-height: 1.15 !important;
          }

          .sentup-table .st-boardreg-cell div,
          .sentup-table .st-boardreg-cell span {
            font-size: ${currentStudentsPerPage >= 18 ? '9px' : '10px'} !important;
            font-weight: 900 !important;
            line-height: 1.15 !important;
            letter-spacing: -0.01em !important;
          }

          /* Generous width and larger print font for STUDENT'S NAME */
          .sentup-table th[data-col="st_name"],
          .sentup-table th.th-col-st_name {
            width: 65mm !important;
            min-width: 50mm !important;
            font-size: 9.5px !important;
            font-weight: 900 !important;
            line-height: 1.1 !important;
            letter-spacing: 0.02em !important;
          }

          .sentup-table td.st-name-cell,
          .sentup-table .st-name-cell {
            width: 65mm !important;
            min-width: 50mm !important;
            overflow: hidden !important;
          }

          .sentup-table th[data-col="st_parentage"],
          .sentup-table th.th-col-st_parentage,
          .sentup-table td[data-col="st_parentage"] {
            width: 48mm !important;
            min-width: 35mm !important;
          }

          .sentup-table th[data-col="st_dob"],
          .sentup-table td[data-col="st_dob"] {
            width: 20mm !important;
          }

          .sentup-table th[data-col="st_result"],
          .sentup-table td[data-col="st_result"] {
            width: 24mm !important;
          }

          .sentup-table .st-name-cell span {
            font-size: ${currentStudentsPerPage >= 18 ? '9.5px' : currentStudentsPerPage >= 15 ? '11px' : '13px'} !important;
            font-weight: 900 !important;
            line-height: 1.15 !important;
            letter-spacing: 0.01em !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
          }

          .sentup-table td.st-rollno-cell,
          .sentup-table .st-rollno-cell {
            width: 12mm !important;
            font-size: ${currentStudentsPerPage >= 18 ? '10px' : '11px'} !important;
            font-weight: 900 !important;
            line-height: 1.1 !important;
            letter-spacing: 0.02em !important;
          }

          .sentup-table .st-rollno-cell div {
            font-size: ${currentStudentsPerPage >= 18 ? '10px' : '11px'} !important;
            font-weight: 900 !important;
          }

          .sentup-table th[data-col="st_admitReceipt"],
          .sentup-table td.st-admitReceipt-cell {
            width: 24mm !important;
            min-width: 18mm !important;
          }

          .sentup-table th[data-col="st_marksReceipt"],
          .sentup-table td.st-marksReceipt-cell {
            width: 50mm !important;
            min-width: 36mm !important;
          }

          .sentup-table td.st-receipt-cell {
            padding: 0.2mm 0.5mm !important;
            vertical-align: bottom !important;
            overflow: hidden !important;
          }

          .sentup-table .st-receipt-inner {
            min-height: 0 !important;
            height: calc(${calculatedRowHeightMm}mm - 0.8mm) !important;
            max-height: calc(${calculatedRowHeightMm}mm - 0.8mm) !important;
            overflow: hidden !important;
          }

          .sentup-table .st-receipt-inner .border-t {
            padding-top: 0.3mm !important;
            font-size: ${currentStudentsPerPage >= 18 ? '6.5px' : '7.5px'} !important;
          }

          .sentup-ledger-page .signature-footer {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-end !important;
            margin-top: 1.5mm !important;
            height: 8.5mm !important;
            min-height: 8.5mm !important;
            max-height: 9mm !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            flex-shrink: 0 !important;
          }

          .sentup-ledger-page .signature-footer > .signature-block {
            width: 36mm !important;
            flex: 0 0 36mm !important;
            text-align: center !important;
            font-size: 9px !important;
            font-weight: 900 !important;
            color: #991b1b !important;
            border-top: 1.5px solid #991b1b !important;
            padding-top: 0.8mm !important;
            box-sizing: border-box !important;
          }

          .admission-suite-root .page-container:last-child,
          .admission-suite-root .register-ledger-page:last-child,
          .admission-suite-root .sentup-ledger-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .admission-suite-root main .space-y-6 > .page-container:last-child,
          .admission-suite-root .space-y-4 > .sentup-ledger-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .cover-page {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            max-height: 185mm !important;
            padding: 8mm 10mm !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          /* Clean single 1px black borders without thick or duplicate outlines */
          table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            border: 1px solid #000000 !important;
            table-layout: fixed !important;
          }

          .sentup-ledger-page table,
          .sentup-table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th, td {
            border: 1px solid #000000 !important;
            padding: 1.5px 2.5px !important;
            overflow-wrap: anywhere !important;
            box-sizing: border-box !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          img {
            object-fit: cover !important;
            max-width: 100% !important;
          }

          .h-yellow, th.h-yellow, td.bg-yellow-50, td.bg-yellow-100, th.bg-yellow-200 { 
            background-color: #fef08a !important; 
          }
          .h-grey, th.h-grey, tr.bg-slate-200, tr.bg-slate-100, th.bg-slate-200, th.bg-slate-100 { 
            background-color: #e2e8f0 !important; 
          }
          .h-green, th.h-green, td.bg-emerald-50, th.bg-emerald-100 { 
            background-color: #dcfce7 !important; 
            color: #14532d !important; 
          }
          .h-red, th.h-red, td.bg-rose-50, th.bg-rose-100 { 
            background-color: #fee2e2 !important; 
            color: #991b1b !important; 
          }
        }

        .print-only { display: none; }

        /* ── High-Contrast Table Headers (Screen & Print) ── */
        .sentup-table thead tr,
        .sentup-table thead th {
          color: #ffffff !important;
          font-weight: 900 !important;
          -webkit-font-smoothing: antialiased;
        }

        .sentup-table thead th .th-subtext,
        .sentup-table thead th span:not(.sort-indicator-icon):not(.sort-indicator-icon *) {
          color: #e0f2fe !important;
          opacity: 1 !important;
        }

        .sentup-table thead tr.bg-rose-900 th .th-subtext,
        .sentup-table thead tr.bg-rose-900 th span:not(.sort-indicator-icon):not(.sort-indicator-icon *) {
          color: #ffe4e6 !important;
          opacity: 1 !important;
        }

        .admission-spread-table thead th {
          color: #0f172a !important;
          font-weight: 900 !important;
        }

        .register-ledger-page {
          display: flex;
          flex-direction: column;
          min-height: 690px;
        }

        .register-header {
          flex-shrink: 0;
        }

        .admission-spread-table thead {
          height: 58px;
        }

        .admission-spread-table thead tr {
          height: 29px;
        }

        .admission-spread-table thead th[rowspan="2"] {
          height: 58px;
        }

        .register-resizable-row,
        .register-resizable-row > td {
          height: var(--register-row-height);
          max-height: var(--register-row-height);
          overflow: hidden;
          line-height: 1.12;
          vertical-align: middle;
        }

        .register-resizable-row:hover > td {
          border-bottom-color: #f59e0b !important;
        }

        .register-photo-cell,
        .register-photo-cell img {
          min-height: 0 !important;
          overflow: hidden !important;
        }

        .register-ledger-page > .signature-footer {
          margin-top: auto;
          flex-shrink: 0;
        }

        /* ─── PURE HIGH-CONTRAST POPOVER DIALOG STYLING (OVERRIDES ANY THEME CASCADE) ─── */
        .register-popover-panel {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
        }

        .register-popover-panel label,
        .register-popover-panel .popover-label {
          color: #0f172a !important;
          font-weight: 800 !important;
        }

        .register-popover-panel select,
        .register-popover-panel .popover-select {
          background-color: #f8fafc !important;
          color: #0f172a !important;
          border: 1.5px solid #94a3b8 !important;
          font-weight: 700 !important;
        }

        .register-popover-panel select option {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-weight: 700 !important;
        }

        .register-popover-panel .popover-btn-inactive {
          background-color: #f1f5f9 !important;
          color: #1e293b !important;
          border: 1px solid #cbd5e1 !important;
          font-weight: 700 !important;
        }

        .register-popover-panel .popover-btn-inactive:hover {
          background-color: #e2e8f0 !important;
          color: #0f172a !important;
        }

        .register-popover-panel .popover-badge {
          background-color: #eef2ff !important;
          color: #3730a3 !important;
          border: 1px solid #c7d2fe !important;
          font-weight: 800 !important;
        }

        .register-popover-panel .popover-zoom-box {
          background-color: #f1f5f9 !important;
          border: 1px solid #cbd5e1 !important;
        }

        /* ─── PREMIUM TYPOGRAPHY SYSTEM ─── */
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Merriweather:wght@400;700;900&display=swap');

        .school-header-font {
          font-family: 'Cinzel', 'Merriweather', serif !important;
          letter-spacing: 0.04em;
        }

        .ledger-data-font {
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif !important;
        }

        .ledger-mono-font {
          font-family: 'JetBrains Mono', monospace !important;
        }
      `}</style>

      {/* ─── ULTRA-COMPACT CONSOLIDATED 1-ROW TOOLBAR (MOBILE-FIRST & RESPONSIVE) ─── */}
      <header className="no-print sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs px-2 sm:px-2.5 py-1">
        <div className="w-full max-w-[2000px] mx-auto flex items-center justify-between gap-1 xl:gap-2 flex-nowrap overflow-x-auto sm:overflow-visible no-scrollbar">
          {/* Left Cluster: Module Selector, Direct Class Scope, + Re-Adm, and Filters Popover */}
          <div className="flex items-center gap-1 xl:gap-1.5 flex-nowrap shrink-0">
            {/* 1. Main Suite Module Dropdown */}
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="py-0.5 px-2 text-[11.5px] rounded-lg border-2 border-amber-600/50 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-black cursor-pointer shadow-2xs focus:ring-1 focus:ring-amber-500 shrink-0"
            >
              <option value="adm_register">📖 Admission Register</option>
              <option value="sentup">📋 Sentup Export</option>
              <option value="assign_ids">🔢 Assign IDs</option>
              <option value="assign_dates">📅 Assign Dates</option>
            </select>

            {(activeTab === 'adm_register' || activeTab === 'sentup') && (
              <>
                {/* 2. Direct Class Scope Selector with Paired Class Options */}
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="py-0.5 px-2 text-[11px] rounded-lg border-2 border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-black shadow-2xs cursor-pointer shrink-0"
                  title="Select Register Class Scope"
                >
                  <option value="11th & 12th">Classes 11th & 12th</option>
                  <option value="11th">Class 11th</option>
                  <option value="12th">Class 12th</option>
                  <option value="9th & 10th">Classes 9th & 10th</option>
                  <option value="10th">Class 10th</option>
                  <option value="9th">Class 9th</option>
                  <option value="ALL">All Classes</option>
                </select>

                {/* 3. Universal Add / Tag Re-admission Button (Kept prominent) */}
                <button
                  type="button"
                  onClick={handleOpenUniversalReadmissionModal}
                  className="py-0.5 px-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-800 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                  title="Tag / Map any student (from 10th, 12th, or past sessions) as a Re-admission into 9th or 11th register"
                >
                  <UserPlus size={11} className="text-purple-700 dark:text-purple-300" />
                  <span>+ Re-Adm</span>
                </button>

                {/* 4. Grouped Filters Dropdown Popover (Session, Status, Admission Type, Stream) */}
                <div className="relative shrink-0" ref={filtersPopoverRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFiltersPopover(prev => !prev);
                      setShowViewPopover(false);
                    }}
                    className={`py-0.5 px-2 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs ${
                      activeFiltersCount > 0
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                    title="Configure Database Filters (Session, Status, Admission Type, Stream)"
                  >
                    <Filter size={11} className={activeFiltersCount > 0 ? 'text-amber-700' : 'text-slate-500'} />
                    <span>Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-black flex items-center justify-center">
                        {activeFiltersCount}
                      </span>
                    )}
                    <ChevronDown size={10} className="text-slate-400" />
                  </button>

                  {/* Filter Popover Dropdown Panel */}
                  {showFiltersPopover && (
                    <div className="register-popover-panel absolute left-0 top-full mt-1.5 w-72 p-4 rounded-2xl shadow-2xl z-[100] space-y-3 whitespace-normal animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                          <Filter size={13} className="text-amber-600" /> Filter Register
                        </span>
                        {activeFiltersCount > 0 && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="text-[11px] font-black text-rose-600 hover:underline cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        )}
                      </div>

                      {/* Session */}
                      <div>
                        <label className="block text-[11px] font-black text-slate-800 mb-1">Academic Session:</label>
                        <select
                          value={selectedSession}
                          onChange={(e) => handleSessionChange(e.target.value)}
                          className="w-full py-1.5 px-2.5 text-xs rounded-xl font-bold bg-white text-slate-900 border border-slate-300 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          {availableSessions.map(sess => (
                            <option key={sess} value={sess} className="bg-white text-slate-900 font-bold">
                              {sess} {sess === '2025-26' ? '(Live)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-[11px] font-black text-slate-800 mb-1">Admission Status:</label>
                        <select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="w-full py-1.5 px-2.5 text-xs rounded-xl font-bold bg-white text-slate-900 border border-slate-300 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="Approved" className="bg-white text-slate-900 font-bold">Approved · Roll assigned ({statusCounts.approved})</option>
                          <option value="Submitted" className="bg-white text-slate-900 font-bold">Submitted ({statusCounts.submitted})</option>
                          <option value="Provisional" className="bg-white text-slate-900 font-bold">Provisional ({statusCounts.provisional})</option>
                          <option value="ALL" className="bg-white text-slate-900 font-bold">All ({statusCounts.total})</option>
                        </select>
                      </div>

                      {/* Admission Type */}
                      <div>
                        <label className="block text-[11px] font-black text-slate-800 mb-1">Admission Type:</label>
                        <select
                          value={selectedAdmissionType}
                          onChange={(e) => setSelectedAdmissionType(e.target.value)}
                          className="w-full py-1.5 px-2.5 text-xs rounded-xl font-bold bg-white text-slate-900 border border-slate-300 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="ALL" className="bg-white text-slate-900 font-bold">All Types</option>
                          <option value="fresh" className="bg-white text-slate-900 font-bold">Fresh Only ({statusCounts.fresh})</option>
                          <option value="readmission" className="bg-white text-slate-900 font-bold">Re-admission Only ({statusCounts.readmissions})</option>
                        </select>
                      </div>

                      {/* Stream */}
                      {availableStreams.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-black text-slate-800 mb-1">Stream Scope:</label>
                          <select
                            value={selectedStream}
                            onChange={(e) => setSelectedStream(e.target.value)}
                            className="w-full py-1.5 px-2.5 text-xs rounded-xl font-bold bg-white text-slate-900 border border-slate-300 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="ALL" className="bg-white text-slate-900 font-bold">All Streams</option>
                            {availableStreams.map(str => (
                              <option key={str} value={str} className="bg-white text-slate-900 font-bold">{str}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Quick Search */}
                <div className="relative shrink-0">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-5 pr-1.5 py-0.5 text-[11px] rounded-lg border border-slate-300 bg-white text-slate-900 w-24 xl:w-28 shadow-2xs"
                  />
                </div>

                {/* 6. Active Sort Indicator & Quick Reset */}
                {sortConfig.key ? (
                  <button
                    type="button"
                    onClick={handleResetSort}
                    className="py-0.5 px-2 rounded-lg bg-indigo-100 hover:bg-rose-100 text-indigo-900 hover:text-rose-900 dark:bg-indigo-950/80 dark:text-indigo-200 dark:hover:bg-rose-950/80 dark:hover:text-rose-200 border border-indigo-300 dark:border-indigo-700 hover:border-rose-400 font-bold text-[10.5px] flex items-center gap-1 shadow-2xs cursor-pointer transition-colors shrink-0"
                    title="Click to reset to default register order"
                  >
                    <ArrowUpDown size={10} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Sorted: {getSortColumnLabel(sortConfig.key)} ({sortConfig.direction === 'asc' ? '▲ Asc' : '▼ Desc'})</span>
                    <X size={10} className="text-slate-500 hover:text-rose-600 ml-0.5" />
                  </button>
                ) : (
                  <div
                    className="hidden xl:flex items-center gap-1 py-0.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 shrink-0 select-none"
                    title="Click any column header to sort by that column"
                  >
                    <ArrowUpDown size={9.5} className="text-slate-400" />
                    <span>Order: {activeTab === 'sentup' && isAprBianSession ? 'Exam Roll (Default)' : 'Class Roll (Default)'}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Cluster: Consolidated View & Layout Popover, Count Badge, Excel & Print */}
          <div className="flex items-center gap-1 xl:gap-1.5 flex-nowrap shrink-0">
            {/* Sentup Columns Selector (Only in Sentup Module) */}
            {activeTab === 'sentup' && (
              <div className="relative shrink-0" ref={sentupColsPopoverRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSentupColsPopover(prev => !prev);
                    setShowViewPopover(false);
                    setShowFiltersPopover(false);
                  }}
                  className={`py-0.5 px-2 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-all ${
                    ALL_SENTUP_COLS.some(col => !isSentupColVisible(col.key))
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                  title="Toggle Sentup Columns (Skip / Add Columns)"
                >
                  <Columns size={11} className={ALL_SENTUP_COLS.some(col => !isSentupColVisible(col.key)) ? 'text-amber-700' : 'text-slate-500'} />
                  <span>Columns ({ALL_SENTUP_COLS.filter(col => isSentupColVisible(col.key)).length}/{ALL_SENTUP_COLS.length})</span>
                  <ChevronDown size={10} className="text-slate-400" />
                </button>

                {showSentupColsPopover && (
                  <div className="register-popover-panel absolute right-0 top-full mt-1.5 w-64 p-3 rounded-2xl shadow-2xl z-[100] whitespace-normal animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                      <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                        <Columns size={12} className="text-indigo-600" /> Sentup Columns
                      </span>
                      <button
                        type="button"
                        onClick={resetSentupCols}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-2">
                      Uncheck to skip or check to add columns:
                    </p>
                    <div className="space-y-1.5">
                      {ALL_SENTUP_COLS.map(col => {
                        const checked = isSentupColVisible(col.key);
                        return (
                          <label
                            key={col.key}
                            className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSentupCol(col.key)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>{col.label}</span>
                            {col.key === 'st_rollNo' && isAprBianSession && !sentupExplicitCols.has('st_rollNo') && (
                              <span className="text-[9px] text-amber-600 font-bold ml-auto">(Default off for APR)</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(activeTab === 'adm_register' || activeTab === 'sentup') && (
              <>
                {/* 1. Grouped View & Layout Popover (Section, Book View, Margins, Row Height, Zoom, Firebase Presets) */}
                <div className="relative shrink-0" ref={viewPopoverRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowViewPopover(prev => !prev);
                      setShowFiltersPopover(false);
                    }}
                    className={`py-0.5 px-2 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-all ${
                      isLayoutModified
                        ? 'border-amber-400 bg-amber-50/90 text-amber-900 font-black ring-1 ring-amber-400'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    title="View Section, Book Layout, Margins, Row Height & Zoom Settings"
                  >
                    <Eye size={11} className={isLayoutModified ? "text-amber-600" : "text-indigo-600"} />
                    <span>View & Layout</span>
                    {isLayoutModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    )}
                    <ChevronDown size={10} className="text-slate-400" />
                  </button>

                  {/* View Popover Dropdown Panel */}
                  {showViewPopover && (
                    <div className="register-popover-panel absolute right-0 top-full mt-2 w-[540px] sm:w-[600px] max-w-[95vw] max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 text-slate-900 dark:text-slate-100">
                      {/* 1. Header (Sticky Top) */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 backdrop-blur-sm shrink-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                            <SlidersHorizontal size={15} />
                          </div>
                          <div>
                            <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2 leading-none">
                              Display & Print Layout
                              {isLayoutModified && (
                                <span className="text-[9.5px] uppercase tracking-wider font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-full">
                                  Modified
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                              Customise table density, margins & printing options
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowViewPopover(false)}
                          className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
                          title="Close"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* 2. Segmented Navigation Tabs */}
                      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 shrink-0 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setPopoverActiveTab('layout')}
                          className={`flex-1 py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                            popoverActiveTab === 'layout'
                              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-black border border-slate-200/80 dark:border-slate-700'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-900/40'
                          }`}
                        >
                          <Printer size={13} />
                          <span>Layout & Print</span>
                        </button>

                        {activeTab === 'sentup' && (
                          <button
                            type="button"
                            onClick={() => setPopoverActiveTab('columns')}
                            className={`flex-1 py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                              popoverActiveTab === 'columns'
                                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-black border border-slate-200/80 dark:border-slate-700'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-900/40'
                            }`}
                          >
                            <Columns size={13} />
                            <span>Columns</span>
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                              {ALL_SENTUP_COLS.filter(c => isSentupColVisible(c.key)).length}/{ALL_SENTUP_COLS.length}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setPopoverActiveTab('subjects')}
                          className={`flex-1 py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                            popoverActiveTab === 'subjects'
                              ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-black border border-slate-200/80 dark:border-slate-700'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-900/40'
                          }`}
                        >
                          <BookOpen size={13} />
                          <span>Subject Key</span>
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {sentupSubjectAbbreviations.length}
                          </span>
                        </button>
                      </div>

                      {/* 3. Scrollable Tab Content Body */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
                        {/* ─── TAB 1: LAYOUT & PRINT ─── */}
                        {popoverActiveTab === 'layout' && (
                          <div className="space-y-4">
                            {/* 1. Paper Size Selector (JKBOSE 13.7"x8.5" Default, Legal 14"x8.5", A4) */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <FileText size={13} className="text-indigo-600 dark:text-indigo-400" />
                                    <span>Paper Size & Physical Ledger Format</span>
                                  </span>
                                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                    Matches actual physical register & roll sheet paper used for printing
                                  </p>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono font-bold text-[10.5px] text-slate-700 dark:text-slate-300">
                                  {paperSize === 'indian_legal' ? '348 × 216 mm' : paperSize === 'legal' ? '356 × 216 mm' : '297 × 210 mm'}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                  {
                                    id: 'indian_legal',
                                    title: '13.7" × 8.5" (Default)',
                                    subtitle: 'JKBOSE Register Sheet',
                                    note: 'Standard School Register & Sentup Paper',
                                    star: true
                                  },
                                  {
                                    id: 'legal',
                                    title: '14.0" × 8.5"',
                                    subtitle: 'US / Standard Legal',
                                    note: 'Standard Legal landscape size'
                                  },
                                  {
                                    id: 'a4',
                                    title: '11.7" × 8.3" (A4)',
                                    subtitle: 'A4 Landscape',
                                    note: 'Standard office printer paper'
                                  }
                                ].map(p => {
                                  const isActive = paperSize === p.id;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handlePaperSizeChange(p.id)}
                                      className={`p-2 rounded-xl text-left cursor-pointer transition-all border ${
                                        isActive
                                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750'
                                      }`}
                                    >
                                      <div className="font-black text-xs flex items-center justify-between">
                                        <span>{p.title}</span>
                                        {isActive && <Check size={12} className="shrink-0" />}
                                      </div>
                                      <div className={`text-[10px] font-bold ${isActive ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {p.subtitle}
                                      </div>
                                      <div className={`text-[9px] mt-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {p.note}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 2. Students Per Sheet Selector (Tab-Aware: Sentup vs Register) */}
                            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                              <div className="flex items-center justify-between mb-1.5">
                                <div>
                                  <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                                    {activeTab === 'sentup' ? 'Sentup Candidates Per Sheet (Page Density)' : 'Admission Register Rows Per Sheet (Page Density)'}
                                  </span>
                                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                    {activeTab === 'sentup'
                                      ? 'Default is 10 candidates per sheet. Allows higher densities without page overflow.'
                                      : 'Rows dynamically stretch to fill page height without bottom gaps.'}
                                  </p>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 font-mono font-black text-[11px] text-indigo-700 dark:text-indigo-300">
                                  {pageChunks.length} Sheet{pageChunks.length === 1 ? '' : 's'} Total
                                </span>
                              </div>
                              {activeTab === 'sentup' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
                                  {[
                                    { val: 10, label: '10 Rows', note: 'Standard ★ (Default)' },
                                    { val: 12, label: '12 Rows', note: 'Comfortable' },
                                    { val: 14, label: '14 Rows', note: 'Balanced' },
                                    { val: 15, label: '15 Rows', note: 'Compact' },
                                    { val: 16, label: '16 Rows', note: 'Dense' },
                                    { val: 18, label: '18 Rows', note: 'High Density' },
                                    { val: 20, label: '20 Rows', note: 'Ultra Dense' },
                                    { val: 25, label: '25 Rows', note: 'Maximum Fit' }
                                  ].map(({ val, label, note }) => {
                                    const isActive = sentupStudentsPerPage === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => handleSentupStudentsPerPageChange(val)}
                                        className={`p-2 rounded-xl text-left cursor-pointer transition-all border ${
                                          isActive
                                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                                        }`}
                                      >
                                        <div className="font-black text-xs flex items-center justify-between">
                                          <span>{label}</span>
                                          {isActive && <Check size={12} className="shrink-0" />}
                                        </div>
                                        <div className={`text-[9.5px] font-semibold ${isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                          {note}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
                                  {[
                                    { val: 10, label: '10 Rows', note: 'Spacious / Large' },
                                    { val: 12, label: '12 Rows', note: 'Balanced' },
                                    { val: 14, label: '14 Rows', note: 'Compact' },
                                    { val: 15, label: '15 Rows', note: 'Standard ★ (Default)' },
                                    { val: 16, label: '16 Rows', note: 'Dense' },
                                    { val: 18, label: '18 Rows', note: 'High Density' },
                                    { val: 20, label: '20 Rows', note: 'Ultra Dense' },
                                    { val: 25, label: '25 Rows', note: 'Maximum Fit' }
                                  ].map(({ val, label, note }) => {
                                    const isActive = studentsPerPage === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => handleStudentsPerPageChange(val)}
                                        className={`p-2 rounded-xl text-left cursor-pointer transition-all border ${
                                          isActive
                                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                                        }`}
                                      >
                                        <div className="font-black text-xs flex items-center justify-between">
                                          <span>{label}</span>
                                          {isActive && <Check size={12} className="shrink-0" />}
                                        </div>
                                        <div className={`text-[9.5px] font-semibold ${isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                          {note}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Row Height & Print Margins Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* Row Height */}
                              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
                                    <span>Row Height:</span>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={MIN_REGISTER_ROW_HEIGHT}
                                        max={MAX_REGISTER_ROW_HEIGHT}
                                        value={rowHeightInput}
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          setRowHeightInput(raw);
                                          const val = parseInt(raw, 10);
                                          if (!isNaN(val) && val >= MIN_REGISTER_ROW_HEIGHT && val <= MAX_REGISTER_ROW_HEIGHT) {
                                            handleRowHeightChange(val);
                                          }
                                        }}
                                        onBlur={() => {
                                          const val = parseInt(rowHeightInput, 10);
                                          if (isNaN(val) || val < MIN_REGISTER_ROW_HEIGHT) {
                                            handleRowHeightChange(MIN_REGISTER_ROW_HEIGHT);
                                            setRowHeightInput(String(MIN_REGISTER_ROW_HEIGHT));
                                          } else if (val > MAX_REGISTER_ROW_HEIGHT) {
                                            handleRowHeightChange(MAX_REGISTER_ROW_HEIGHT);
                                            setRowHeightInput(String(MAX_REGISTER_ROW_HEIGHT));
                                          } else {
                                            handleRowHeightChange(val);
                                            setRowHeightInput(String(val));
                                          }
                                        }}
                                        className="w-12 text-center py-0.5 px-1 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono font-black text-[11px] text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                                        title="Enter custom row height (30-100px)"
                                      />
                                      <span className="text-[10px] font-bold text-slate-500">px</span>
                                    </div>
                                  </div>
                                  <input
                                    type="range"
                                    min={MIN_REGISTER_ROW_HEIGHT}
                                    max={MAX_REGISTER_ROW_HEIGHT}
                                    step="1"
                                    value={rowHeight}
                                    onChange={(e) => handleRowHeightChange(parseInt(e.target.value, 10))}
                                    className="w-full cursor-pointer accent-indigo-600 my-1.5"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-1 mt-1">
                                  {[
                                    { label: 'Compact', val: 40 },
                                    { label: 'Default', val: 56, star: true },
                                    { label: 'Spacious', val: 72 }
                                  ].map(({ label, val, star }) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => handleRowHeightChange(val)}
                                      className={`py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all text-center border ${
                                        rowHeight === val
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      {label} {star ? '★' : ''}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Print Margins */}
                              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
                                    <span>Print Margin:</span>
                                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono font-black text-[11px] text-slate-800 dark:text-slate-200">
                                      {printMargin}" ({Math.round(printMargin * 25.4)}mm)
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0.1"
                                    max="0.6"
                                    step="0.05"
                                    value={printMargin}
                                    onChange={(e) => handlePrintMarginChange(parseFloat(e.target.value))}
                                    className="w-full cursor-pointer accent-indigo-600 my-1.5"
                                  />
                                </div>
                                <div className="grid grid-cols-4 gap-1 mt-1">
                                  {[
                                    { m: 0.2, label: '0.2"' },
                                    { m: 0.3, label: '0.3" ★' },
                                    { m: 0.4, label: '0.4"' },
                                    { m: 0.5, label: '0.5"' }
                                  ].map(({ m, label }) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => handlePrintMarginChange(m)}
                                      className={`py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all text-center border ${
                                        Math.abs(printMargin - m) < 0.02
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Section to Display & View Layout */}
                            {activeTab === 'adm_register' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div>
                                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                                    Section to Display:
                                  </label>
                                  <select
                                    value={registerViewSection}
                                    onChange={(e) => setRegisterViewSection(e.target.value)}
                                    className="w-full py-1.5 px-2.5 text-xs rounded-xl font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                  >
                                    <option value="all">📑 All Spreads (Full Register)</option>
                                    <option value="cover">📜 Cover Page Only</option>
                                    <option value="spreads">📖 Ledger Table Only</option>
                                    <option value="summary">📊 Summary Statement Only</option>
                                    <option value="notes">📝 Notes & Annexure Only</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                                    Book Layout:
                                  </label>
                                  <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-200 dark:bg-slate-700 rounded-xl">
                                    <button
                                      type="button"
                                      onClick={() => setSpreadLayoutMode('side_by_side')}
                                      className={`py-1.5 px-2 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                        spreadLayoutMode === 'side_by_side'
                                          ? 'bg-indigo-600 text-white shadow-xs'
                                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      <Columns size={12} />
                                      <span>Side-by-Side</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSpreadLayoutMode('stacked')}
                                      className={`py-1.5 px-2 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                        spreadLayoutMode === 'stacked'
                                          ? 'bg-indigo-600 text-white shadow-xs'
                                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      <LayoutGrid size={12} />
                                      <span>Stacked</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Sentup Page Inclusions */}
                            {activeTab === 'sentup' && (
                              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <span className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                                  Sentup Document Pages:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <label className="flex items-center gap-2.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <input
                                      type="checkbox"
                                      checked={includeCoverPage}
                                      onChange={(e) => setIncludeCoverPage(e.target.checked)}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                                    />
                                    <div>
                                      <div>Cover Page (Page 1)</div>
                                      <div className="text-[10px] text-slate-500 font-normal">Official red document title label</div>
                                    </div>
                                  </label>
                                  <label className="flex items-center gap-2.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <input
                                      type="checkbox"
                                      checked={includePlanPage}
                                      onChange={(e) => setIncludePlanPage(e.target.checked)}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                                    />
                                    <div>
                                      <div>Exam Plan & Key (Page 2)</div>
                                      <div className="text-[10px] text-slate-500 font-normal">Subject codes & seat scheme</div>
                                    </div>
                                  </label>
                                </div>
                              </div>
                            )}

                            {/* Screen Zoom Controls */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                              <div>
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                  On-Screen Zoom:
                                </span>
                                <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                  Scales ledger display on current screen
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                <button
                                  type="button"
                                  onClick={() => setZoomLevel(prev => Math.max(0.6, Math.round((prev - 0.1) * 10) / 10))}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 cursor-pointer shadow-2xs"
                                  title="Zoom Out"
                                >
                                  -
                                </button>
                                <span className="px-2 font-mono font-black text-xs text-slate-800 dark:text-slate-200 min-w-[50px] text-center">
                                  {Math.round(zoomLevel * 100)}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setZoomLevel(prev => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10))}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 cursor-pointer shadow-2xs"
                                  title="Zoom In"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setZoomLevel(1.0)}
                                  className="text-[10.5px] font-black text-indigo-600 dark:text-indigo-400 hover:underline px-1.5 cursor-pointer"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ─── TAB 2: SENTUP VISIBLE COLUMNS ─── */}
                        {popoverActiveTab === 'columns' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="relative flex-1">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Search columns..."
                                  value={columnSearchQuery}
                                  onChange={(e) => setColumnSearchQuery(e.target.value)}
                                  className="w-full pl-7 pr-2 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={resetSentupCols}
                                className="text-[10.5px] font-black text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60"
                              >
                                Reset Defaults
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                              {ALL_SENTUP_COLS
                                .filter(col => !columnSearchQuery.trim() || col.label.toLowerCase().includes(columnSearchQuery.toLowerCase()))
                                .map(col => {
                                  const checked = isSentupColVisible(col.key);
                                  return (
                                    <label
                                      key={col.key}
                                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                                        checked
                                          ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 text-slate-900 dark:text-slate-100'
                                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSentupCol(col.key)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                                      />
                                      <span className="text-xs font-bold truncate">{col.label}</span>
                                      {col.key === 'st_rollNo' && isAprBianSession && !sentupExplicitCols.has('st_rollNo') && (
                                        <span className="text-[9px] text-amber-600 font-bold ml-auto shrink-0">(APR off)</span>
                                      )}
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* ─── TAB 3: SUBJECT KEY (PAGE 2) ─── */}
                        {popoverActiveTab === 'subjects' && (
                          <div className="space-y-3">
                            {/* Action Bar */}
                            <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center gap-1.5">
                                {savingSubjectsCloud ? (
                                  <span className="text-[10.5px] font-bold text-indigo-600 flex items-center gap-1">
                                    <Loader2 size={11} className="animate-spin" /> Saving Cloud...
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Check size={10} /> Cloud Synced
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveSubjectAbbreviationsToCloud(sentupSubjectAbbreviations)}
                                  disabled={savingSubjectsCloud}
                                  className="text-[10.5px] font-black text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 px-2 py-1 rounded-lg shadow-2xs hover:bg-emerald-50"
                                >
                                  <Save size={11} /> Save to Cloud
                                </button>
                                <button
                                  type="button"
                                  onClick={handleResetSubjectAbbreviations}
                                  className="text-[10.5px] font-black text-slate-500 hover:text-rose-600 cursor-pointer hover:underline"
                                >
                                  Reset Official
                                </button>
                              </div>
                            </div>

                            {/* Add Form */}
                            <div className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                              <input
                                type="text"
                                placeholder="Code (e.g. BIO)"
                                value={newSubCode}
                                onChange={(e) => setNewSubCode(e.target.value)}
                                className="w-24 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold uppercase focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                              />
                              <input
                                type="text"
                                placeholder="Subject Title (e.g. Biology)"
                                value={newSubName}
                                onChange={(e) => setNewSubName(e.target.value)}
                                className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSubjectAbbreviation();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleAddSubjectAbbreviation}
                                disabled={!newSubCode.trim() || !newSubName.trim()}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shrink-0 shadow-2xs"
                              >
                                <Plus size={12} />
                                <span>Add</span>
                              </button>
                            </div>

                            {/* Search Filter for Subject Key */}
                            <div className="relative">
                              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Filter subject key..."
                                value={subjectSearchQuery}
                                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-2 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                              />
                            </div>

                            {/* List of current abbreviations */}
                            <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                              {sentupSubjectAbbreviations
                                .filter(sub => !subjectSearchQuery.trim() || (sub.name || '').toLowerCase().includes(subjectSearchQuery.toLowerCase()) || (sub.code || '').toLowerCase().includes(subjectSearchQuery.toLowerCase()))
                                .map((sub, sIdx) => {
                                  const itemKey = sub.id || `sub_idx_${sIdx}`;
                                  const isEditing = editingSubKey === itemKey;

                                  if (isEditing) {
                                    return (
                                      <div
                                        key={itemKey}
                                        className="flex items-center gap-1.5 p-1.5 bg-indigo-50/90 dark:bg-indigo-950/60 rounded-xl border border-indigo-300 dark:border-indigo-700 shadow-xs"
                                      >
                                        <input
                                          type="text"
                                          value={editSubCode}
                                          onChange={(e) => setEditSubCode(e.target.value)}
                                          className="w-20 px-2 py-1 text-xs rounded border border-indigo-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold uppercase focus:outline-hidden"
                                          placeholder="Code"
                                          autoFocus
                                        />
                                        <input
                                          type="text"
                                          value={editSubName}
                                          onChange={(e) => setEditSubName(e.target.value)}
                                          className="flex-1 px-2 py-1 text-xs rounded border border-indigo-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden"
                                          placeholder="Subject Title"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveEditSubjectAbbreviation(itemKey)}
                                          disabled={!editSubCode.trim() || !editSubName.trim()}
                                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors shrink-0 disabled:opacity-40"
                                          title="Save changes"
                                        >
                                          <Check size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleCancelEditSubjectAbbreviation}
                                          className="p-1 text-slate-500 hover:text-slate-700 rounded cursor-pointer transition-colors shrink-0"
                                          title="Cancel"
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={itemKey}
                                      className="flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs group transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 pr-2">
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-300 font-mono font-black text-[10px] shrink-0">
                                          {sub.code}
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate">
                                          {sub.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditSubjectAbbreviation(sub, itemKey)}
                                          className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded cursor-pointer transition-colors"
                                          title={`Edit ${sub.name}`}
                                        >
                                          <Edit3 size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSubjectAbbreviation(itemKey)}
                                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded cursor-pointer transition-colors"
                                          title={`Delete ${sub.name}`}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. Sticky Footer Actions (Always Accessible) */}
                      <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-xs space-y-2 shrink-0">
                        {isLayoutModified && (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-bold">
                            <span className="flex items-center gap-1.5">
                              <AlertCircle size={12} className="text-amber-600 shrink-0" />
                              <span>Layout customized. Save to update cloud defaults.</span>
                            </span>
                            <span className="text-[9.5px] uppercase tracking-wider font-black text-amber-700 dark:text-amber-300 bg-amber-200/80 dark:bg-amber-900/80 px-1.5 py-0.5 rounded">
                              Modified
                            </span>
                          </div>
                        )}
                        <div className="grid grid-cols-5 gap-2">
                          <button
                            type="button"
                            onClick={handleSaveLayoutToFirebase}
                            disabled={savingLayout}
                            className="col-span-3 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                            title="Save custom column widths, row height, margin and candidates per sheet to Firebase"
                          >
                            {savingLayout ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            <span className="truncate">Set as Default (Firebase)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleResetLayoutToOriginal}
                            className="col-span-2 py-2 px-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                            title="Reset columns, density, margins and row heights to original factory format"
                          >
                            <RotateCcw size={13} />
                            <span>Reset Defaults</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Record count badge */}
                <div className="py-0.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-black shrink-0 shadow-2xs">
                  {filteredStudents.length} Students
                  {statusCounts.readmissions > 0 && (
                    <span className="ml-1 text-purple-700 dark:text-purple-300 font-extrabold">
                      ({statusCounts.readmissions} Re-Adm)
                    </span>
                  )}
                </div>

                {/* 3. Excel Export */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="py-0.5 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11.5px] shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                  title="Export Official Ledger to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={11} />
                  <span>Excel</span>
                </button>

                {/* 4. Print */}
                <button
                  type="button"
                  onClick={handleCleanPrint}
                  disabled={isPreparingPrint}
                  className="py-0.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11.5px] shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0 disabled:opacity-70 disabled:cursor-wait"
                  title="Prepare visible records and photos, then open the clean print dialog"
                >
                  {isPreparingPrint ? <Loader2 size={11} className="animate-spin" /> : <Printer size={11} />}
                  <span>{isPreparingPrint ? 'Preparing…' : 'Print'}</span>
                </button>
              </>
            )}

            {/* Universal Exit / Close Suite Button */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-0.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11.5px] shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                title="Exit Admission Register Suite and return to Master Register"
              >
                <X size={12} strokeWidth={2.5} />
                <span>Close</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── TOAST NOTIFICATION ─── */}
      {toast && (
        <div className="no-print fixed top-12 right-4 z-[9999] animate-bounce">
          <div className={`px-3.5 py-2 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toast.type === 'info'
              ? 'bg-indigo-600 text-white border-indigo-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}>
            <span>{toast.message || toast.title || toast.desc}</span>
            <button type="button" onClick={() => setToast(null)} className="opacity-80 hover:opacity-100 cursor-pointer ml-1">✕</button>
          </div>
        </div>
      )}

      {/* ─── UNIVERSAL READMISSION MANAGER MODAL ─── */}
      {(readmissionModalStudent || isUniversalModalOpen) && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center shadow-xs">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {readmissionModalStudent ? 'Assign Re-admission / Register Mapping' : 'Universal Re-admission Student Finder'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {readmissionModalStudent
                      ? `Configuring ${readmissionModalStudent.name} for Admission Register`
                      : 'Search any student across all classes (10th/12th/9th/11th) and past sessions'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReadmissionModalStudent(null);
                  setIsUniversalModalOpen(false);
                  setSearchCandidateQuery('');
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* View 1: Search & Select Student if no student is selected */}
            {!readmissionModalStudent ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search candidate by name, father, roll no, board reg, class (10th/12th)..."
                    value={searchCandidateQuery}
                    onChange={(e) => setSearchCandidateQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    Select a student to map as Re-admission ({candidateSearchResults.length} found):
                  </p>
                  {candidateSearchResults.map((candidate) => (
                    <div
                      key={candidate.id}
                      onClick={() => handleSelectCandidateForReadmission(candidate)}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-950/40 cursor-pointer transition-all flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs flex items-center justify-center shrink-0 border">
                          {candidate.name ? candidate.name[0].toUpperCase() : 'S'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-purple-700 dark:group-hover:text-purple-300">
                            {candidate.name}
                          </p>
                          <p className="text-[10.5px] text-slate-500 truncate">
                            S/o {candidate.father || '—'} • Class: <span className="font-bold text-indigo-600 dark:text-indigo-400">{candidate.class}</span> ({candidate.session})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {candidate.admNo && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                            Adm: {candidate.admNo}
                          </span>
                        )}
                        <span className="p-1 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all">
                          <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  ))}
                  {candidateSearchResults.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                      No matching student found for "{searchCandidateQuery}".
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* View 2: Configure Re-admission & Target Class Mapping */
              <div className="space-y-3.5 text-xs">
                {/* Selected Student Information Banner */}
                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Candidate Selected</span>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">{readmissionModalStudent.name}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      S/o {readmissionModalStudent.father || '—'} • Original Record: Class {readmissionModalStudent.class} ({readmissionModalStudent.session || 'Past'})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReadmissionModalStudent(null)}
                    className="px-2 py-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 dark:text-purple-300 bg-white dark:bg-slate-900 rounded-lg border border-purple-200 dark:border-purple-800 cursor-pointer shadow-2xs"
                  >
                    Change
                  </button>
                </div>

                {/* Admission Category Selector */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Admission Category:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReAdmFormState(prev => ({
                        ...prev,
                        isReAdm: false,
                        assignedAdmNo: prev.assignedAdmNo || nextSequentialAdmNo,
                        oldAdmNo: ''
                      }))}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        !reAdmFormState.isReAdm
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <UserCheck size={13} />
                      <span>Fresh Admission</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReAdmFormState(prev => ({
                        ...prev,
                        isReAdm: true,
                        assignedAdmNo: nextSequentialAdmNo,
                        oldAdmNo: prev.oldAdmNo || readmissionModalStudent?.admNo || ''
                      }))}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        reAdmFormState.isReAdm
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <RefreshCw size={13} />
                      <span>Re-admission (Gap)</span>
                    </button>
                  </div>
                </div>

                {/* Target Session & Class Mapping Fields */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Academic Session:</label>
                    <select
                      value={reAdmFormState.targetSession}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, targetSession: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-indigo-700 dark:text-indigo-300"
                    >
                      {availableSessions.map(sess => (
                        <option key={sess} value={sess}>{sess} {sess === '2025-26' ? '(Live)' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Admission Register Class:</label>
                    <select
                      value={reAdmFormState.targetClass}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, targetClass: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100"
                    >
                      <option value="11th">Class 11th Register</option>
                      <option value="9th">Class 9th Register</option>
                      <option value="12th">Class 12th</option>
                      <option value="10th">Class 10th</option>
                    </select>
                  </div>
                </div>

                {/* Stream and Reason */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Academic Stream:</label>
                    <select
                      value={reAdmFormState.targetStream}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, targetStream: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                    >
                      <option value="Science">Science</option>
                      <option value="Humanities">Humanities</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Re-admission Reason:</label>
                    <select
                      value={reAdmFormState.reason}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, reason: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="Gap in Studies / Re-enrolled">Gap in Studies</option>
                      <option value="Failed in Previous Examination">Failed / Repeat</option>
                      <option value="Non-Appearance in Board Exam">Board Exam Non-Appearance</option>
                      <option value="Medical / Domestic Leave">Medical / Personal Gap</option>
                    </select>
                  </div>
                </div>

                {/* Admission Numbers (New & Historical Audit) */}
                <div className="grid grid-cols-2 gap-2.5 p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-purple-950 dark:text-purple-200">
                        Assigned Admission No:
                      </label>
                      <button
                        type="button"
                        onClick={() => setReAdmFormState(prev => ({ ...prev, assignedAdmNo: nextSequentialAdmNo }))}
                        className="text-[9.5px] font-extrabold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.2 rounded flex items-center gap-0.5"
                        title="Auto-assign next available sequential admission number"
                      >
                        ⚡ Auto Next: {nextSequentialAdmNo}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder={`e.g. ${nextSequentialAdmNo}`}
                      value={reAdmFormState.assignedAdmNo}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, assignedAdmNo: e.target.value }))}
                      className="w-full p-1.5 text-xs rounded-lg border border-purple-300 dark:border-purple-700 font-mono font-bold bg-white dark:bg-slate-900 text-purple-950 dark:text-purple-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-950 dark:text-purple-200 mb-1">
                      Previous Admission No (Audit):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4312"
                      value={reAdmFormState.oldAdmNo}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, oldAdmNo: e.target.value }))}
                      className="w-full p-1.5 text-xs rounded-lg border border-purple-300 dark:border-purple-700 font-mono font-bold bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="col-span-2 text-[10.5px] text-purple-800 dark:text-purple-300 flex items-start gap-1.5 pt-1">
                    <AlertCircle size={13} className="shrink-0 mt-0.5 text-purple-600" />
                    <span>
                      Will print in the <strong>Class {reAdmFormState.targetClass} ({reAdmFormState.targetSession})</strong> ledger at the end of the section as:{' '}
                      <strong className="font-mono bg-purple-100 dark:bg-purple-900 px-1 py-0.5 rounded">
                        {reAdmFormState.assignedAdmNo || '5480'} ({reAdmFormState.oldAdmNo || '4312'})
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setReadmissionModalStudent(null);
                  setIsUniversalModalOpen(false);
                  setSearchCandidateQuery('');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              {readmissionModalStudent && (
                <button
                  type="button"
                  onClick={handleSaveReadmission}
                  disabled={savingReAdm}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingReAdm ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>Save Re-admission Mapping</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN PREVIEW CONTAINER ─── */}
      <main className="flex-1 p-2 sm:p-5 overflow-x-auto relative">
        {isLoadingSession && (
          <div className="absolute inset-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 shadow-xl">
              <Loader2 className="w-9 h-9 animate-spin text-amber-600 dark:text-amber-400" />
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Loading {selectedSession} Records…
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Resolving registers, historical admissions & sentup rosters
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-full mx-auto">
          {/* ============================================================== */}
          {/* TAB 1: ADMISSION REGISTER (PRINT-READY DUAL SPREAD)            */}
          {/* ============================================================== */}
          {activeTab === 'adm_register' && (
            <div className="space-y-6" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
              {/* 1. COVER PAGE */}
              {(registerViewSection === 'all' || registerViewSection === 'cover') && (
                <div
                  className="page-container cover-page bg-white rounded-xl border border-slate-300 shadow-sm text-center flex flex-col items-center justify-center max-w-[355.6mm] mx-auto page-break-after print:w-full print:min-w-full print:max-w-none print:m-0 print:p-0"
                  style={{ padding: `${printMargin}in` }}
                >
                  <div className="flex flex-col items-center justify-center w-full my-auto py-6 sm:py-8">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-red-700 uppercase tracking-tight font-sans mb-2">
                      ADMISSION REGISTER
                    </h1>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-red-700 uppercase tracking-tight font-sans mb-3">
                      {selectedClass === 'ALL'
                        ? 'OF CLASSES 11th AND 12th'
                        : (selectedClass.includes('&') || selectedClass.includes('and'))
                        ? `OF CLASSES ${selectedClass.replace('&', 'AND').toUpperCase()}`
                        : `OF CLASS ${selectedClass.toUpperCase()}`}
                    </h2>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-emerald-700 font-sans mb-4 sm:mb-6">
                      Session {selectedSession}
                    </h3>

                    <div className="w-4/5 max-w-3xl border-b-2 border-slate-900 my-3 sm:my-4"></div>

                    <h4 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 font-sans mt-2">
                      {SCHOOL_NAME}
                    </h4>
                  </div>
                </div>
              )}

              {/* 2. DUAL-SPREAD REGISTER PAGES */}
              {(registerViewSection === 'all' || registerViewSection === 'spreads') && (
                pageChunks.map((chunk, chunkIdx) => {
                  const pageNum = chunkIdx + 1;
                  return (
                    <div
                      key={pageNum}
                      className={`spread-container print:min-w-0 print:w-full print:max-w-none print:block print:m-0 print:p-0 ${
                        spreadLayoutMode === 'side_by_side'
                          ? 'flex flex-row gap-3 min-w-[1500px] max-w-full mx-auto items-stretch'
                          : 'flex flex-col gap-4 max-w-[355.6mm] mx-auto'
                      }`}
                    >
                      {/* LEFT PAGE: PART 1 (Personal & Contact Details) */}
                      <div
                        className={`page-container register-ledger-page bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:min-w-full print:max-w-none print:m-0 print:p-0 ${
                          spreadLayoutMode === 'side_by_side' ? 'flex-1 min-w-0' : 'w-full'
                        }`}
                        style={{ padding: `${printMargin}in` }}
                      >
                        <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-1.5 register-header">
                          <div className="text-xs font-black text-slate-900">{pageNum} (part1)</div>
                          <div className="text-center">
                            <h2 className="text-lg sm:text-xl font-black text-red-700 uppercase leading-none font-sans tracking-wide">{SCHOOL_NAME}</h2>
                            <div className="register-header-sub text-[10.5px] font-bold text-emerald-700 mt-0.5">
                              Admission Register of {selectedClass === 'ALL' ? 'classes 11th and 12th' : (selectedClass.includes('&') || selectedClass.includes('and')) ? `classes ${selectedClass.replace('&', 'and')}` : `class ${selectedClass}`}, session {selectedSession}
                            </div>
                          </div>
                          {/* Blank circle for manual hand-stamping of serial number */}
                          <div
                            className="w-6 h-6 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-mono text-transparent select-none"
                            title="Manual Serial / Page Number Stamp Area"
                          >
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="admission-spread-table w-full text-left text-[8.5px] border-collapse border border-slate-900 ledger-data-font">
                            <colgroup>
                              <col style={{ width: `${columnWidths.sno || 26}px` }} />
                              <col style={{ width: `${columnWidths.photo || 40}px` }} />
                              <col style={{ width: `${columnWidths.rollNo || 34}px` }} />
                              <col style={{ width: `${columnWidths.formNo || 62}px` }} />
                              <col style={{ width: `${columnWidths.admDate || 48}px` }} />
                              <col style={{ width: `${columnWidths.admNo || 56}px` }} />
                              <col style={{ width: `${columnWidths.class || 32}px` }} />
                              <col style={{ width: `${columnWidths.boardReg || 96}px` }} />
                              <col style={{ width: `${columnWidths.name || 112}px` }} />
                              <col style={{ width: `${columnWidths.father || 90}px` }} />
                              <col style={{ width: `${columnWidths.mother || 90}px` }} />
                              <col style={{ width: `${columnWidths.dobFigures || 56}px` }} />
                              <col style={{ width: `${columnWidths.dobWords || 96}px` }} />
                              <col style={{ width: `${columnWidths.gender || 36}px` }} />
                              <col style={{ width: `${columnWidths.village || 64}px` }} />
                              <col style={{ width: `${columnWidths.block || 54}px` }} />
                              <col style={{ width: `${columnWidths.tehsil || 54}px` }} />
                              <col style={{ width: `${columnWidths.district || 54}px` }} />
                              <col style={{ width: `${columnWidths.mobile || 66}px` }} />
                              <col style={{ width: `${columnWidths.parentMobile || 66}px` }} />
                            </colgroup>
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 uppercase font-black text-center">
                                <ResizableTh colKey="sno" sortKey="sno" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.sno} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">S.NO.</ResizableTh>
                                <ResizableTh colKey="photo" width={columnWidths.photo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">PHOTO</ResizableTh>
                                <ResizableTh colKey="rollNo" sortKey="rollNo" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.rollNo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">CLASS R.NO.</ResizableTh>
                                <ResizableTh colKey="formNo" sortKey="formNo" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.formNo || 62} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">FORM NO. & ONLINE SUBM.</ResizableTh>
                                <ResizableTh colKey="admDate" sortKey="admDate" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.admDate} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">ADM. DATE</ResizableTh>
                                <ResizableTh colKey="admNo" sortKey="admNo" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.admNo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">ADM. NO.</ResizableTh>
                                <ResizableTh colKey="class" sortKey="class" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.class} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">CLASS ADM. TO</ResizableTh>
                                <ResizableTh colKey="boardReg" sortKey="boardReg" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.boardReg} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">BOARD REG. NO.</ResizableTh>
                                <ResizableTh colKey="name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.name} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-left pl-2 h-grey">STUDENT'S NAME</ResizableTh>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center h-grey">PARENTAGE</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center h-grey">DATE OF BIRTH</th>
                                <ResizableTh colKey="gender" sortKey="gender" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.gender} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">GENDER</ResizableTh>
                                <th colSpan="4" className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-200 text-slate-900 h-yellow">RESIDENCE</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-200 text-slate-900 h-yellow">CONTACT</th>
                              </tr>
                              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[7.5px]">
                                <ResizableTh colKey="father" sortKey="father" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.father} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">FATHER'S NAME</ResizableTh>
                                <ResizableTh colKey="mother" sortKey="mother" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.mother} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">MOTHER'S NAME</ResizableTh>
                                <ResizableTh colKey="dobFigures" sortKey="dobFigures" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.dobFigures} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">FIGURES</ResizableTh>
                                <ResizableTh colKey="dobWords" sortKey="dobWords" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.dobWords} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">WORDS</ResizableTh>
                                <ResizableTh colKey="village" sortKey="village" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.village} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">VILLAGE/ TOWN</ResizableTh>
                                <ResizableTh colKey="block" sortKey="block" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.block} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">BLOCK</ResizableTh>
                                <ResizableTh colKey="tehsil" sortKey="tehsil" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.tehsil} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">TEHSIL</ResizableTh>
                                <ResizableTh colKey="district" sortKey="district" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.district} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">DISTRICT</ResizableTh>
                                <ResizableTh colKey="mobile" sortKey="mobile" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.mobile} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">STUDENT'S MOBILE</ResizableTh>
                                <ResizableTh colKey="parentMobile" sortKey="parentMobile" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.parentMobile} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">PARENT'S MOBILE</ResizableTh>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-900">
                              {chunk.map((s) => {
                                const photoSrc = getResolvedStudentPhoto(s);
                                return (
                                  <ResizableDataRow key={s.id} rowHeight={rowHeight} onResize={handleRowHeightChange} className="hover:bg-slate-50 group">
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold ledger-mono-font">{s.sno}</td>
                                    <td className="register-photo-cell border border-slate-900 p-0 text-center overflow-hidden bg-slate-50 print:bg-transparent" style={{ width: columnWidths.photo ? `${columnWidths.photo}px` : undefined, height: `${rowHeight}px` }}>
                                      {photoSrc ? (
                                        <div className="w-full h-full flex items-center justify-center p-0.5">
                                          <img
                                            src={photoSrc}
                                            alt={s.name}
                                            className="block max-h-full max-w-full object-contain mx-auto"
                                            style={{ maxHeight: `${Math.max(30, rowHeight - 2)}px` }}
                                            loading="eager"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              if (e.currentTarget.parentElement && e.currentTarget.parentElement.nextElementSibling) {
                                                e.currentTarget.parentElement.nextElementSibling.style.display = 'flex';
                                              }
                                            }}
                                          />
                                        </div>
                                      ) : null}
                                      <div className={`w-full h-full items-center justify-center text-[7px] text-slate-400 font-bold ${photoSrc ? 'hidden' : 'flex'}`}>
                                        Photo
                                      </div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-indigo-700 ledger-mono-font">{s.rollNo}</td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left align-middle ledger-mono-font overflow-hidden">
                                      <div className="font-bold text-[8.5px] text-slate-900 leading-tight">
                                        {s.formNo || '—'}
                                      </div>
                                      <div className="text-[6.5px] text-slate-600 font-medium leading-tight mt-0.5">
                                        {renderOnlineSubmCell(s.onlineStatus)}
                                      </div>
                                    </td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left align-middle ledger-mono-font overflow-hidden">{renderAdmDateCell(s.admDate)}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-emerald-800 text-[9px] leading-tight">
                                      <div className="ledger-mono-font font-black">{s.admNo || '—'}</div>
                                      {s.isReadmission && s.oldAdmNo && s.oldAdmNo !== s.admNo && (
                                        <div className="text-[7.5px] font-mono text-purple-700 font-bold">({s.oldAdmNo})</div>
                                      )}
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.class}</td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left align-middle ledger-mono-font overflow-hidden leading-tight">{formatBoardRegSplit(s.boardReg)}</td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left relative group/name-cell overflow-hidden">
                                      <div className="w-full font-black uppercase tracking-tight text-slate-900 leading-tight">
                                        <span>{s.name}</span>
                                        {s.isReadmission && (
                                          <span className="ml-1 inline-flex items-center px-1 py-0.2 rounded bg-purple-100 text-purple-800 text-[6.5px] font-black border border-purple-300 print:inline-block select-none" title={`Re-admission (Previous Adm: ${s.oldAdmNo || 'Historical'})`}>
                                            (Re-Adm)
                                          </span>
                                        )}
                                      </div>
                                      {/* Prominent floating hover toggle button without squeezing name width */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReadmissionModal(s)}
                                        className={`no-print absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded shadow-md text-[7px] font-black cursor-pointer transition-all z-20 ${
                                          s.isReadmission
                                            ? 'bg-purple-700 text-white hover:bg-purple-800 border border-purple-800 opacity-0 group-hover/name-cell:opacity-100'
                                            : 'opacity-0 group-hover/name-cell:opacity-100 bg-white text-purple-700 hover:bg-purple-50 border border-purple-400'
                                        }`}
                                        title="Click to configure Re-admission / Fresh admission status"
                                      >
                                        {s.isReadmission ? '⚙ Edit Re-Adm' : '+ Set Re-Adm'}
                                      </button>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left uppercase text-[8px]">{s.father}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left uppercase text-[8px]">{s.mother}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-mono ledger-mono-font">{s.dobFigures}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px] leading-tight font-serif overflow-hidden">
                                      <div className="line-clamp-2 leading-tight">{s.dobWords}</div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-semibold">{s.gender}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.village}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.block}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.tehsil}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.district}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-mono ledger-mono-font">{s.mobile}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-mono ledger-mono-font">{s.parentMobile}</td>
                                  </ResizableDataRow>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Signatures */}
                        <div className="signature-footer flex justify-between items-center mt-6 sm:mt-8 pt-3 text-xs font-black text-red-700">
                          <div className="signature-block text-center w-36 sm:w-40 border-t-2 border-red-700 pt-1">Incharge Admissions</div>
                          <div className="signature-block text-center w-36 sm:w-40 border-t-2 border-red-700 pt-1">Checked By</div>
                          <div className="signature-block text-center w-36 sm:w-40 border-t-2 border-red-700 pt-1">Principal</div>
                        </div>
                      </div>

                      {/* RIGHT PAGE: PART 2 (Academic, Category & Receipt Ledger) */}
                      <div
                        className={`page-container register-ledger-page bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:min-w-full print:max-w-none print:m-0 print:p-0 ${
                          spreadLayoutMode === 'side_by_side' ? 'flex-1 min-w-0' : 'w-full'
                        }`}
                        style={{ padding: `${printMargin}in` }}
                      >
                        <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-1.5 register-header">
                          <div className="text-xs font-black text-slate-900">{pageNum} (part2)</div>
                          <div className="text-center">
                            <h2 className="text-lg sm:text-xl font-black text-red-700 uppercase leading-none font-sans tracking-wide">{SCHOOL_NAME}</h2>
                            <div className="register-header-sub text-[10.5px] font-bold text-emerald-700 mt-0.5">
                              Admission Register of {selectedClass === 'ALL' ? 'classes 11th and 12th' : (selectedClass.includes('&') || selectedClass.includes('and')) ? `classes ${selectedClass.replace('&', 'and')}` : `class ${selectedClass}`}, session {selectedSession}
                            </div>
                          </div>
                          {/* Blank circle for manual hand-stamping of serial number */}
                          <div
                            className="w-6 h-6 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-mono text-transparent select-none"
                            title="Manual Serial / Page Number Stamp Area"
                          >
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="admission-spread-table w-full text-left text-[8.5px] border-collapse border border-slate-900 ledger-data-font">
                            <colgroup>
                              <col style={{ width: `${columnWidths.p2_stream || 48}px` }} />
                              <col style={{ width: `${columnWidths.p2_subs || 96}px` }} />
                              <col style={{ width: `${columnWidths.p2_aadhar || 80}px` }} />
                              <col style={{ width: `${columnWidths.p2_cat || 32}px` }} />
                              <col style={{ width: `${columnWidths.p2_socio || 32}px` }} />
                              <col style={{ width: `${columnWidths.p2_blood || 32}px` }} />
                              <col style={{ width: `${columnWidths.p2_account || 86}px` }} />
                              <col style={{ width: `${columnWidths.p2_prevSchool || 86}px` }} />
                              <col style={{ width: `${columnWidths.p2_prevRoll || 48}px` }} />
                              <col style={{ width: `${columnWidths.p2_prevResult || 48}px` }} />
                              <col style={{ width: `${columnWidths.p2_pen || 92}px` }} />
                              <col style={{ width: `${columnWidths.p2_prevCC || 76}px` }} />
                              <col style={{ width: `${columnWidths.p2_withdrawal || 56}px` }} />
                              <col style={{ width: `${columnWidths.p2_issuedCC || 76}px` }} />
                              <col style={{ width: `${columnWidths.p2_receipt || 140}px` }} />
                              <col style={{ width: `${columnWidths.p2_remarks || 80}px` }} />
                            </colgroup>
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 uppercase font-black text-center">
                                <ResizableTh colKey="p2_stream" sortKey="stream" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_stream} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">STREAM</ResizableTh>
                                <ResizableTh colKey="p2_subs" sortKey="subs" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_subs} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">SUBS</ResizableTh>
                                <ResizableTh colKey="p2_aadhar" sortKey="aadhar" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_aadhar} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">AADHAR NO.</ResizableTh>
                                <ResizableTh colKey="p2_cat" sortKey="category" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_cat} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">SOC. CAT.</ResizableTh>
                                <ResizableTh colKey="p2_socio" sortKey="socioEcon" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_socio} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">SOCIO-ECON CAT.</ResizableTh>
                                <ResizableTh colKey="p2_blood" sortKey="blood" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_blood} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">BLOOD GRP</ResizableTh>
                                <ResizableTh colKey="p2_account" sortKey="account" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_account || 86} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">A/C NO. & IFSC</ResizableTh>
                                <th colSpan="3" className="border border-slate-900 px-1 py-0.5 text-center h-grey">PREVIOUS ACADEMIC DETAILS</th>
                                <ResizableTh colKey="p2_pen" sortKey="pen" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_pen} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">PEN (UDISE)</ResizableTh>
                                <ResizableTh colKey="p2_prevCC" sortKey="prevCC" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_prevCC} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-emerald-900 bg-emerald-100 h-green">ADMTD. VIDE DC/CC<br />(No.; Date)</ResizableTh>
                                <ResizableTh colKey="p2_withdrawal" sortKey="withdrawal" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_withdrawal} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-100 h-red">RESULT /<br />WITHDRAWAL DT.</ResizableTh>
                                <ResizableTh colKey="p2_issuedCC" sortKey="issuedCC" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_issuedCC} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-50 h-red">ISSUED DC/CC</ResizableTh>
                                <ResizableTh colKey="p2_receipt" sortKey="receipt" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_receipt} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-50 h-red">RECEIPT</ResizableTh>
                                <ResizableTh colKey="p2_remarks" sortKey="remarks" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_remarks} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">REMARKS</ResizableTh>
                              </tr>
                              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[7.5px]">
                                <ResizableTh colKey="p2_prevSchool" sortKey="prevSchool" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_prevSchool} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">PREVIOUS SCHOOL</ResizableTh>
                                <ResizableTh colKey="p2_prevRoll" sortKey="prevRoll" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_prevRoll} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">PREV R.NO.</ResizableTh>
                                <ResizableTh colKey="p2_prevResult" sortKey="prevResult" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_prevResult} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">PREV RESULT</ResizableTh>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-900">
                              {chunk.map((s) => (
                                <ResizableDataRow key={s.id} rowHeight={rowHeight} onResize={handleRowHeightChange} className="hover:bg-slate-50">
                                  <td className="border border-slate-900 px-1 py-0.5 text-center"><StreamLabel value={s.stream} /></td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px] leading-tight font-medium overflow-hidden">
                                    <div className="line-clamp-2 leading-tight">{s.subs}</div>
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono bg-yellow-50 ledger-mono-font">{s.aadhar}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-black">{s.category}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50">{s.socioEcon}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-bold">{s.blood}</td>
                                  <td className="border border-slate-900 px-1.5 py-0.5 text-left align-middle font-mono bg-yellow-50 ledger-mono-font overflow-hidden">
                                     <div className="font-bold text-[7.5px] text-slate-900 leading-tight">
                                       {s.account && s.account !== '—' ? s.account : '—'}
                                     </div>
                                     {s.ifsc && s.ifsc !== '—' && s.ifsc !== 'NA' && (
                                       <div className="text-[6.5px] text-slate-600 font-medium leading-tight mt-0.5">
                                         {s.ifsc}
                                       </div>
                                     )}
                                   </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7.5px] leading-tight overflow-hidden">
                                    <div className="line-clamp-2 leading-tight">{s.prevSchool}</div>
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono ledger-mono-font">{s.prevRoll}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">
                                    {(() => {
                                      const pRes = String(s.prevResult || '').trim();
                                      const isPQual = /^(pass|passed|qual|qualified)\b/i.test(pRes) || /qualified/i.test(pRes) || /passed/i.test(pRes);
                                      const isPReap = /^(reap|reappear|fail|failed)\b/i.test(pRes) || /reappear/i.test(pRes) || /reap\b/i.test(pRes);
                                      const pColor = isPQual ? '#047857' : isPReap ? '#b91c1c' : undefined;
                                      const pClass = isPQual ? 'text-emerald-700 dark:text-emerald-400 font-black' : isPReap ? 'text-red-700 dark:text-red-400 font-black' : 'font-bold';
                                      return <span className={pClass} style={pColor ? { color: pColor } : undefined}>{pRes || '—'}</span>;
                                    })()}
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[7px] ledger-mono-font overflow-hidden">{renderPenCell(s.pen)}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-emerald-900 font-bold text-[7px] bg-emerald-50">
                                    {renderAdmittedVideCell(s.prevCC)}
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-rose-900 text-[7.5px] bg-rose-50">{s.withdrawal}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[6.5px] bg-rose-50/50 overflow-hidden" style={{ verticalAlign: 'middle', height: `${rowHeight}px` }}>
                                    {s.issuedCC ? (
                                      <div className="text-[7px] leading-tight font-medium line-clamp-2">{s.issuedCC}</div>
                                    ) : (
                                      <div className="h-full flex flex-col justify-between text-[6.5px] leading-none py-1 select-none font-medium text-slate-800" style={{ maxHeight: `${Math.max(26, rowHeight - 4)}px` }}>
                                        <div className="leading-tight">C.No. _________</div>
                                        <div className="leading-tight">Dt. _________</div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[6.5px] leading-tight bg-rose-50/50 overflow-hidden" style={{ verticalAlign: 'middle', height: `${rowHeight}px` }}>
                                    {s.receipt ? (
                                      <div className="text-[7px] leading-tight font-medium line-clamp-2">{s.receipt}</div>
                                    ) : (
                                      <div className="h-full flex flex-col justify-between text-[6.5px] leading-none py-1 select-none font-medium text-slate-800" style={{ maxHeight: `${Math.max(26, rowHeight - 4)}px` }}>
                                        <div className="leading-tight truncate">rcvd DC/CC C.No. _____</div>
                                        <div className="leading-tight">on ______ Sig. _______</div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px] leading-tight overflow-hidden">
                                    <div className="line-clamp-2 leading-tight">{s.remarks}</div>
                                  </td>
                                </ResizableDataRow>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Signatures */}
                        <div className="signature-footer flex justify-between items-center mt-6 sm:mt-8 pt-3 text-xs font-black text-red-700">
                          <div className="signature-block text-center w-36 sm:w-40 border-t-2 border-red-700 pt-1">Incharge Admissions</div>
                          <div className="signature-block text-center w-36 sm:w-40 border-t-2 border-red-700 pt-1">Checked By</div>
                          <div className="signature-block text-center w-36 sm:w-40 border-t-2 border-red-700 pt-1">Principal</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* 3. CONSOLIDATED SUMMARY PAGE */}
              {(registerViewSection === 'all' || registerViewSection === 'summary') && (
                <div
                  className="page-container bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:min-w-full print:max-w-none print:m-0 max-w-[355.6mm] mx-auto page-break-after"
                  style={{ padding: `${printMargin}in` }}
                >
                  <div className="text-center border-b-2 border-red-700 pb-2 mb-3">
                    <h1 className="text-2xl font-black text-red-700 uppercase tracking-wide font-sans">
                      CONSOLIDATED ADMISSION STATEMENT
                    </h1>
                    <h2 className="text-xs font-bold text-emerald-700 font-sans mt-0.5">
                      Roll statement for Session {selectedSession}
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse border-2 border-red-700 text-xs ledger-data-font">
                      <thead>
                        <tr className="bg-red-50 text-slate-900 font-black">
                          <th className="border-2 border-red-700 p-2">CLASS</th>
                          <th className="border-2 border-red-700 p-2 text-left pl-4">STREAM</th>
                          <th className="border-2 border-red-700 p-2 w-24">MALE</th>
                          <th className="border-2 border-red-700 p-2 w-24">FEMALE</th>
                          <th className="border-2 border-red-700 p-2 w-24">TOTAL</th>
                          <th className="border-2 border-red-700 p-2 w-32">GRAND TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-red-700 font-bold text-slate-900">
                        {sortedSummaryClasses.map(cls => {
                          const streams = Object.keys(summaryStats[cls] || {}).sort();
                          const clsTotal = Object.values(summaryStats[cls] || {}).reduce((acc, curr) => acc + curr.total, 0);
                          return streams.map((st, idx) => {
                            const item = summaryStats[cls][st];
                            return (
                              <tr key={`${cls}_${st}`} className="hover:bg-red-50/40">
                                {idx === 0 && (
                                  <td rowSpan={streams.length} className="border-2 border-red-700 p-2 font-black text-base bg-white">
                                    {cls}
                                  </td>
                                )}
                                <td className="border-2 border-red-700 p-2 text-left pl-4 font-semibold">{st}</td>
                                <td className="border-2 border-red-700 p-2 ledger-mono-font">{item.male}</td>
                                <td className="border-2 border-red-700 p-2 ledger-mono-font">{item.female}</td>
                                <td className="border-2 border-red-700 p-2 font-bold ledger-mono-font">{item.total}</td>
                                {idx === 0 && (
                                  <td rowSpan={streams.length} className="border-2 border-red-700 p-2 font-black text-lg italic text-red-700 bg-white ledger-mono-font">
                                    {clsTotal}
                                  </td>
                                )}
                              </tr>
                            );
                          });
                        })}
                        <tr className="bg-white text-slate-900 font-black text-sm">
                          <td colSpan="2" className="border-2 border-red-700 p-2 text-right pr-4 font-black">Overall Grand Total</td>
                          <td className="border-2 border-red-700 p-2 ledger-mono-font font-black">{overallSummaryTotals.male}</td>
                          <td className="border-2 border-red-700 p-2 ledger-mono-font font-black">{overallSummaryTotals.female}</td>
                          <td className="border-2 border-red-700 p-2 font-black text-base ledger-mono-font bg-white"></td>
                          <td className="border-2 border-red-700 p-2 font-black text-lg ledger-mono-font text-slate-900">{overallSummaryTotals.grandTotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Institutional Certification Paragraph */}
                  <div className="mt-4 p-2.5 text-xs font-serif leading-relaxed text-slate-800">
                    <p className="font-bold mb-1">Certification:</p>
                    <p>
                      Certified that the above mentioned <strong>{overallSummaryTotals.grandTotal}</strong> students have been admitted to <strong>{SCHOOL_NAME}</strong> for the academic session <strong>{selectedSession}</strong>. Their particulars as entered in this register have been verified from the original documents and found correct.
                    </p>
                  </div>

                  {/* Footer Signatures */}
                  <div className="signature-footer flex justify-between items-center mt-6 pt-1 text-xs font-black text-red-700">
                    <div className="signature-block text-center w-36 border-t-2 border-red-700 pt-0.5">Incharge Admissions</div>
                    <div className="signature-block text-center w-36 border-t-2 border-red-700 pt-0.5">Checked By</div>
                    <div className="signature-block text-center w-36 border-t-2 border-red-700 pt-0.5">Principal</div>
                  </div>
                </div>
              )}

              {/* 4. EDITABLE OFFICIAL NOTES PAGE */}
              {(registerViewSection === 'all' || registerViewSection === 'notes') && (
                <div
                  className="page-container bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:min-w-full print:max-w-none print:m-0 max-w-[355.6mm] mx-auto"
                  style={{ padding: `${printMargin}in` }}
                >
                  <div className="flex items-center justify-between pb-1 mb-2">
                    <h1 className="text-base font-black text-red-700 uppercase font-sans">
                      Please, Note:
                    </h1>
                    <button
                      type="button"
                      onClick={handleAddNote}
                      className="no-print px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Add Note</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-800 text-[11px] ledger-data-font">
                      <tbody className="divide-y divide-slate-800 text-slate-900">
                        {registerNotes.map((note, idx) => (
                          <tr key={note.id}>
                            <td className="border border-slate-800 p-2 w-10 text-center font-black bg-white ledger-mono-font align-top">{idx + 1}</td>
                            <td className="border border-slate-800 p-2 font-medium leading-relaxed">
                              <textarea
                                value={note.text}
                                onChange={(e) => handleUpdateNote(note.id, e.target.value)}
                                rows={note.text.length > 200 ? 3 : 2}
                                className="screen-only w-full p-1 border border-transparent hover:border-slate-300 focus:border-amber-500 rounded bg-transparent text-[11px] font-medium resize-y focus:bg-white leading-relaxed"
                              />
                              <div className="print-only whitespace-pre-wrap text-[10px] leading-relaxed">{note.text}</div>
                            </td>
                            <td className="no-print border border-slate-800 p-1.5 w-10 text-center align-top">
                              <button
                                type="button"
                                onClick={() => handleRemoveNote(note.id)}
                                className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                                title="Delete Note"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Signatures */}
                  <div className="signature-footer flex justify-between items-center mt-8 pt-1 text-xs font-black text-red-700">
                    <div className="signature-block text-center w-36 border-t-2 border-red-700 pt-0.5">Incharge Admissions</div>
                    <div className="signature-block text-center w-36 border-t-2 border-red-700 pt-0.5">Checked By</div>
                    <div className="signature-block text-center w-36 border-t-2 border-red-700 pt-0.5">Principal</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: SENTUP EXPORT (JKBOSE THEMED CANDIDATE ROLL SHEET)       */}
          {/* ============================================================== */}
          {activeTab === 'sentup' && (
            <div className="space-y-4" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
              {/* Row Inclusion / Skip Selection Status Bar (Matches Roster & Registers Studio) */}
              <div className="print:hidden max-w-[355.6mm] mx-auto px-3 py-1.5 bg-slate-50 dark:bg-slate-800/90 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs select-none shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={toggleSelectAllRows}
                    className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 hover:text-red-800 font-extrabold cursor-pointer transition-colors"
                    title={isAllRowsIncluded ? "Deselect / skip all rows" : "Select / include all rows"}
                  >
                    {isAllRowsIncluded ? (
                      <CheckSquare size={14} className="text-emerald-600" />
                    ) : isSomeRowsSkipped ? (
                      <Minus size={14} className="text-amber-600" />
                    ) : (
                      <Square size={14} className="text-slate-400" />
                    )}
                    <span className="text-[11px]">
                      <strong className="text-red-900 dark:text-red-400 font-black">{activeIncludedRows.length}</strong> of {filteredStudents.length} Students Included
                    </span>
                  </button>

                  {skippedCount > 0 && (
                    <span className="text-[9.5px] font-black text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                      {skippedCount} skipped from print
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggles for Cover Page and Plan Page */}
                  <div className="flex items-center gap-3 border-r border-slate-300 dark:border-slate-600 pr-3 mr-1">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-red-800 transition-colors" title="Include Page 1 Document Label & Title Cover Page">
                      <input
                        type="checkbox"
                        checked={includeCoverPage}
                        onChange={(e) => setIncludeCoverPage(e.target.checked)}
                        className="rounded border-slate-300 text-red-800 focus:ring-red-800 cursor-pointer"
                      />
                      <span>Cover (Pg 1)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-red-800 transition-colors" title="Include Page 2 Examination Plan & Subject Key">
                      <input
                        type="checkbox"
                        checked={includePlanPage}
                        onChange={(e) => setIncludePlanPage(e.target.checked)}
                        className="rounded border-slate-300 text-red-800 focus:ring-red-800 cursor-pointer"
                      />
                      <span>Plan & Key (Pg 2)</span>
                    </label>
                  </div>

                  {/* Quick Sentup Students Per Sheet Selector */}
                  <div className="flex items-center gap-1.5 border-r border-slate-300 dark:border-slate-600 pr-3 mr-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Students/Page:
                    </span>
                    <select
                      value={sentupStudentsPerPage}
                      onChange={(e) => handleSentupStudentsPerPageChange(e.target.value)}
                      className="py-0.5 px-2 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black text-[11px] text-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs focus:ring-1 focus:ring-red-800"
                      title="Select number of students to print per sheet (Default: 10). Automatically budgets row heights."
                    >
                      <option value="10">10 (Default)</option>
                      <option value="12">12 Rows</option>
                      <option value="14">14 Rows</option>
                      <option value="15">15 Rows</option>
                      <option value="16">16 Rows</option>
                      <option value="18">18 Rows</option>
                      <option value="20">20 Rows</option>
                      <option value="25">25 Rows</option>
                    </select>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-mono">
                      ({pageChunks.length} Sheet{pageChunks.length === 1 ? '' : 's'})
                    </span>
                  </div>

                  {skippedCount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={resetSkippedRows}
                        className="px-2.5 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[10px] cursor-pointer transition-colors shadow-2xs"
                        title="Include all students in print & exports"
                      >
                        Include All
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowSkippedTray(prev => !prev)}
                        className="px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold text-[10px] cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <Eye size={11} />
                        <span>{showSkippedTray ? 'Hide Skipped List' : `View Skipped (${skippedCount})`}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Collapsible Skipped Students Quick Tray */}
              {skippedCount > 0 && showSkippedTray && (
                <div className="print:hidden max-w-[355.6mm] mx-auto p-2.5 bg-amber-50/90 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800 text-xs">
                  <div className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-300 mb-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>Skipped Candidates (Omitted from Print Pages & Excel Export) — Click to Re-Include:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredStudents.filter(s => skippedRowIds.has(s.id)).map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleRowSkip(s.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[10px] font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 transition-colors cursor-pointer shadow-2xs"
                        title="Click to re-include this student"
                      >
                        <Plus size={10} className="text-emerald-600" />
                        <span>{s.name} [{s.rollNo || s.boardReg || '—'}]</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* PAGE 1: OFFICIAL DOCUMENT LABEL & TITLE COVER PAGE             */}
              {/* ============================================================== */}
              {includeCoverPage && (
                <div
                  key="sentup-cover-page"
                  className={`page-container sentup-cover-page bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:min-w-full print:max-w-none print:m-0 max-w-[355.6mm] mx-auto flex flex-col justify-between p-6 ${includePlanPage || pageChunks.length > 0 ? 'page-break-after' : ''}`}
                  style={{ padding: `${printMargin}in` }}
                >
                  {/* Institutional Header Banner */}
                  <div className="text-center border-b-2 border-red-900 pb-2 relative">
                    <div className="flex items-center justify-between px-2">
                      <div className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        Govt. of Jammu & Kashmir • School Education Department
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="text-[10px] font-black uppercase tracking-wider text-red-900 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded">
                          Page 1 of {sentupTotalPages}
                        </div>
                        {/* Circle for manual hand-stamped S.No on top right */}
                        <div
                          className="w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] font-mono text-transparent select-none shrink-0"
                          title="Manual Serial Number / Stamp Area"
                        >
                        </div>
                      </div>
                    </div>
                    <h1 className="cover-school-title text-2xl sm:text-3xl lg:text-4xl font-black text-red-900 uppercase tracking-wide school-header-font mt-1">
                      {SCHOOL_NAME}
                    </h1>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-wide mt-0.5">
                      Zone: Shangus • District: Anantnag • UT of Jammu & Kashmir (192201)
                    </div>
                    <div className="text-[10.5px] font-bold text-slate-600 tracking-wider mt-0.5">
                      UDISE CODE: 01061400618 • SCHOOL / BOARD CODE: 010061 • AFFILIATED WITH JKBOSE
                    </div>
                  </div>

                  {/* Center Document Label Card */}
                  <div className="my-auto py-4">
                    <div className="cover-title-box border-2 border-slate-800 bg-white p-6 rounded-xl text-center shadow-xs mx-auto max-w-4xl">
                      <h2 className="cover-doc-title text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight leading-snug">
                        Candidate Sent-up Roll Sheet
                      </h2>

                      <div className="mt-2 text-sm sm:text-base font-bold text-slate-700">
                        Class: {selectedClass} • Session: {selectedSession}
                      </div>

                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-200 text-left">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] font-bold uppercase text-slate-500">Class</div>
                          <div className="text-base font-black text-red-900 mt-0.5">Class {selectedClass}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] font-bold uppercase text-slate-500">Session</div>
                          <div className="text-base font-black text-slate-900 mt-0.5">{selectedSession}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] font-bold uppercase text-slate-500">Total Candidates</div>
                          <div className="text-base font-black text-emerald-800 mt-0.5">
                            {sentupCensus.total}
                          </div>
                          <div className="text-[9.5px] text-slate-600 font-semibold mt-0.5">
                            {sentupCensus.boys} Boys • {sentupCensus.girls} Girls
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-[10px] font-bold uppercase text-slate-500">Roll No. Range</div>
                          <div className="text-base font-black text-indigo-900 mt-0.5 font-mono">
                            {sentupCensus.rollRange}
                          </div>
                        </div>
                      </div>

                      {/* Signature Row */}
                      <div className="grid grid-cols-3 gap-6 text-center pt-8 mt-6 border-t border-slate-200">
                        <div>
                          <div className="h-10"></div>
                          <div className="border-t border-slate-400 pt-1 text-xs font-bold text-slate-700">Incharge Examination</div>
                        </div>
                        <div>
                          <div className="h-10"></div>
                          <div className="border-t border-slate-400 pt-1 text-xs font-bold text-slate-700">Checked By</div>
                        </div>
                        <div>
                          <div className="h-10"></div>
                          <div className="border-t border-slate-400 pt-1 text-xs font-bold text-slate-700">Principal</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Institutional Bottom Bar */}
                  <div className="border-t border-slate-300 pt-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Government Higher Secondary School Shangus
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* PAGE 2: CANDIDATE SUMMARY & SUBJECT KEY                        */}
              {/* ============================================================== */}
              {includePlanPage && (
                <div
                  key="sentup-plan-page"
                  className={`page-container sentup-plan-page bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:min-w-full print:max-w-none print:m-0 max-w-[355.6mm] mx-auto flex flex-col justify-between p-4 ${pageChunks.length > 0 ? 'page-break-after' : ''}`}
                  style={{ padding: `${printMargin}in` }}
                >
                  {/* Page Header */}
                  <div className="border-b border-slate-900 pb-1 mb-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[9.5px] font-black uppercase text-red-800 tracking-wider">
                          {SCHOOL_NAME}
                        </div>
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900">
                          Candidate Summary & Subject Key
                        </h2>
                        <div className="text-[9.5px] font-bold text-slate-700">
                          Class: {selectedClass} • Session: {selectedSession} • Total Candidates: {sentupCensus.total}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2.5">
                        <div>
                          <div className="text-[9.5px] font-black uppercase tracking-wider text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                            Page {includeCoverPage ? 2 : 1} of {sentupTotalPages}
                          </div>
                          <div className="text-[8.5px] text-slate-500 font-bold mt-0.5">
                            Summary & Key
                          </div>
                        </div>
                        {/* Circle for manual hand-stamped S.No on top right */}
                        <div
                          className="w-8 h-8 rounded-full border border-slate-400 flex items-center justify-center text-[9px] font-mono text-transparent select-none shrink-0 print:border-slate-400"
                          title="Manual Serial Number / Stamp Area"
                        >
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Grid: Left = Summary & Certificate, Right = Subject Key */}
                  <div className="grid grid-cols-12 gap-2.5 my-auto flex-1">
                    {/* Left Column: Candidate & Stream Summary + Certificate (4 cols) */}
                    <div className="col-span-4 flex flex-col justify-between gap-2">
                      {/* Summary Table */}
                      <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/60">
                        <div className="text-[10px] font-black uppercase text-red-900 border-b border-red-200 pb-0.5 mb-1 flex items-center justify-between">
                          <span>Candidate & Stream Summary</span>
                          <span className="text-[9px] text-slate-600 font-bold font-mono">Class {selectedClass}</span>
                        </div>
                        <table className="w-full text-left text-[9.5px] border-collapse">
                          <tbody>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 font-bold text-slate-700">Total Enrolled</td>
                              <td className="py-0.5 text-right font-black text-slate-900 font-mono">{filteredStudents.length}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 font-bold text-slate-700">Total Sent-up</td>
                              <td className="py-0.5 text-right font-black text-emerald-800 font-mono">{sentupCensus.total}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 font-bold text-slate-700">Boys / Girls</td>
                              <td className="py-0.5 text-right font-bold text-slate-900 font-mono">
                                {sentupCensus.boys} / {sentupCensus.girls}
                              </td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 font-bold text-slate-700">Science Stream</td>
                              <td className="py-0.5 text-right font-black text-sky-800 font-mono">{sentupCensus.science}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="py-0.5 font-bold text-slate-700">Humanities Stream</td>
                              <td className="py-0.5 text-right font-black text-amber-800 font-mono">{sentupCensus.humanities}</td>
                            </tr>
                            {sentupCensus.commerce > 0 && (
                              <tr className="border-b border-slate-200">
                                <td className="py-0.5 font-bold text-slate-700">Commerce Stream</td>
                                <td className="py-0.5 text-right font-black text-indigo-800 font-mono">{sentupCensus.commerce}</td>
                              </tr>
                            )}
                            <tr>
                              <td className="py-0.5 font-bold text-slate-700">Roll No. Range</td>
                              <td className="py-0.5 text-right font-black text-slate-900 font-mono">{sentupCensus.rollRange}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Certificate */}
                      <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/60 text-[9px] leading-relaxed text-slate-700">
                        <div className="text-[9.5px] font-black uppercase text-red-900 border-b border-red-200 pb-0.5 mb-1.5">
                          Certificate
                        </div>
                        <p>
                          Certified that candidate particulars and subject combinations in this roll sheet have been verified from official school records for Class {selectedClass} ({selectedSession}).
                        </p>
                      </div>
                    </div>

                    {/* Right Column: Subject Key (8 cols) */}
                    <div className="col-span-8 flex flex-col justify-between border border-slate-300 rounded-lg p-2 bg-white">
                      <div>
                        <div className="text-[10px] font-black uppercase text-red-900 border-b border-red-200 pb-1 mb-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>Subject Key</span>
                            <span className="text-[8.5px] font-bold text-slate-500">
                              ({displayedSubjectDirectory.length} Subjects · HSS Shangus)
                            </span>
                            {savingSubjectsCloud ? (
                              <span className="text-[8px] font-bold text-indigo-600 flex items-center gap-1 print:hidden">
                                <Loader2 size={9} className="animate-spin" /> Saving...
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded flex items-center gap-0.5 print:hidden">
                                <Check size={8} /> Cloud Synced
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 print:hidden">
                            {/* Scope Selector Toggle */}
                            <div className="flex items-center rounded bg-slate-100 border border-slate-300 p-0.5 text-[8.5px] font-bold">
                              <button
                                type="button"
                                onClick={() => setSubjectKeyScope('school')}
                                className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${subjectKeyScope === 'school' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}
                                title="Show all official subjects offered at HSS Shangus"
                              >
                                All School Subjects ({sentupSubjectAbbreviations.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubjectKeyScope('cohort')}
                                className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${subjectKeyScope === 'cohort' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}
                                title="Show only subjects taken by candidates in this roll sheet"
                              >
                                Roll Sheet Subjects ({activeCohortSubjectCodes.size})
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowViewPopover(true)}
                              className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shadow-2xs"
                              title="Add, edit, or remove subject abbreviations in View & Layout popover"
                            >
                              <Edit3 size={10} />
                              <span>Edit</span>
                            </button>
                          </div>
                        </div>

                        {/* 2-Column Split Tables for Clean Single-Page Density */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Column 1 Table */}
                          <table className="subject-key-table w-full text-left text-[8.5px] border-collapse border border-slate-300">
                            <thead>
                              <tr className="bg-slate-900 text-white uppercase text-[8px] font-black">
                                <th className="border border-slate-300 px-1.5 py-0.5 w-20 text-center">Code</th>
                                <th className="border border-slate-300 px-2 py-0.5">Subject Name</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-800">
                              {leftSubjects.map((sub, sIdx) => (
                                <tr key={sub.id || sIdx} className={sIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                  <td className="border border-slate-200 px-1.5 py-0.5 text-center font-mono font-black text-indigo-900 bg-indigo-50/50">
                                    {sub.code}
                                  </td>
                                  <td className="border border-slate-200 px-2 py-0.5 font-bold text-slate-900">
                                    {sub.name}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Column 2 Table */}
                          <table className="subject-key-table w-full text-left text-[8.5px] border-collapse border border-slate-300">
                            <thead>
                              <tr className="bg-slate-900 text-white uppercase text-[8px] font-black">
                                <th className="border border-slate-300 px-1.5 py-0.5 w-20 text-center">Code</th>
                                <th className="border border-slate-300 px-2 py-0.5">Subject Name</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-800">
                              {rightSubjects.map((sub, sIdx) => (
                                <tr key={sub.id || sIdx} className={sIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                  <td className="border border-slate-200 px-1.5 py-0.5 text-center font-mono font-black text-indigo-900 bg-indigo-50/50">
                                    {sub.code}
                                  </td>
                                  <td className="border border-slate-200 px-2 py-0.5 font-bold text-slate-900">
                                    {sub.name}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Institutional Bottom Bar */}
                  <div className="border-t border-slate-300 pt-1 text-center text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Government Higher Secondary School Shangus
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* PAGE 3 ONWARDS: ACTUAL CANDIDATE ROLL SHEET CHUNKS             */}
              {/* ============================================================== */}
              {pageChunks.map((chunk, idx) => {
                const pageOffset = (includeCoverPage ? 1 : 0) + (includePlanPage ? 1 : 0);
                const overallPageNum = pageOffset + idx + 1;
                const pageHas12th = chunk.some(s => String(s.class || '').includes('12'));
                const is12th = selectedClass === '12th' || (selectedClass.includes('12') && !selectedClass.includes('11')) || pageHas12th;
                const themeHeaderBg = is12th ? 'bg-rose-900 text-white' : 'bg-sky-800 text-white';

                return (
                  <div
                    key={overallPageNum}
                    className={`page-container sentup-ledger-page bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:min-w-full print:max-w-none print:m-0 max-w-[355.6mm] mx-auto ${idx < pageChunks.length - 1 ? 'page-break-after' : ''}`}
                    style={{ padding: `${printMargin}in` }}
                  >
                    {/* Header */}
                    <div className="sentup-header text-center border-b border-slate-900 pb-1 mb-2 relative">
                      <div className="absolute left-0 top-0 text-[10px] font-bold text-slate-500 print:hidden">Candidate Roll Sheet</div>
                      <h1 className="text-xl sm:text-2xl font-black text-red-800 uppercase tracking-wider school-header-font">{SCHOOL_NAME}</h1>
                      <div className="sentup-subtitle text-[10px] sm:text-[11px] font-extrabold text-slate-800 mt-0.5">
                        JKBOSE Sentup Roll Sheet • Class {selectedClass} • Session {selectedSession} • {selectedStatus} Candidates
                      </div>
                      <div className="absolute right-0 top-0 flex items-center gap-3">
                        <div className="text-[10px] font-black text-red-900 uppercase tracking-wider">
                          Page {overallPageNum} of {sentupTotalPages} <span className="font-bold text-slate-500 text-[8.5px] print:inline">(Sheet {idx + 1})</span>
                        </div>
                        {/* Circle for manual hand-stamped S.No on top right */}
                        <div
                          className="w-8 h-8 rounded-full border border-slate-400 flex items-center justify-center text-[9px] font-mono text-transparent select-none shrink-0 print:border-slate-400"
                          title="Manual Serial Number / Stamp Area"
                        >
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto print:overflow-visible">
                      <table className="sentup-table w-full text-left text-[11px] border-collapse border border-slate-900 ledger-data-font">
                        <thead>
                          <tr className={`${themeHeaderBg} uppercase font-black text-center text-[10px] tracking-tight`}>
                            <th className="border border-slate-900 px-1 py-1 text-center w-7 select-none shrink-0 print:hidden text-white" title="Select / deselect all rows">
                              <button type="button" onClick={toggleSelectAllRows} className="cursor-pointer text-white flex items-center justify-center mx-auto">
                                {isAllRowsIncluded ? <CheckSquare size={13} className="text-white" /> : isSomeRowsSkipped ? <Minus size={13} className="text-white" /> : <Square size={13} className="text-white opacity-70" />}
                              </button>
                            </th>
                            {isSentupColVisible('st_sno') && (
                              <ResizableTh colKey="st_sno" sortKey="sno" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_sno} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">S.No.<br /><span className="th-subtext text-[8px] text-sky-100 opacity-90">[Adm No.]</span></ResizableTh>
                            )}
                            {isSentupColVisible('st_rollNo') && (
                              <ResizableTh colKey="st_rollNo" sortKey="rollNo" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_rollNo} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">Class<br />Roll No.</ResizableTh>
                            )}
                            {isSentupColVisible('st_photo') && (
                              <ResizableTh colKey="st_photo" width={columnWidths.st_photo} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">Photo</ResizableTh>
                            )}
                            {isSentupColVisible('st_boardReg') && (
                              <ResizableTh colKey="st_boardReg" sortKey="boardReg" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_boardReg} onResize={handleColumnResize} className="border border-slate-900 px-1.5 py-1 text-left pl-2 text-white">Board<br />Reg. No.</ResizableTh>
                            )}
                            {isSentupColVisible('st_name') && (
                              <ResizableTh colKey="st_name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_name} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-left pl-2 text-white">Student's Name</ResizableTh>
                            )}
                            {isSentupColVisible('st_parentage') && (
                              <ResizableTh colKey="st_parentage" sortKey="father" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_parentage} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-left pl-2 text-white">Parentage<br /><span className="th-subtext text-[8px] text-sky-100 opacity-90">(Father / Mother)</span></ResizableTh>
                            )}
                            {isSentupColVisible('st_dob') && (
                              <ResizableTh colKey="st_dob" sortKey="dobFigures" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_dob} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">Date of Birth</ResizableTh>
                            )}
                            {isSentupColVisible('st_subs') && (
                              <ResizableTh colKey="st_subs" sortKey="subs" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_subs} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">Subjects</ResizableTh>
                            )}
                            {isSentupColVisible('st_boardRoll') && (
                              <ResizableTh colKey="st_boardRoll" sortKey="boardRollNo" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_boardRoll} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">Board<br />Roll No.</ResizableTh>
                            )}
                            {isSentupColVisible('st_result') && (
                              <ResizableTh colKey="st_result" sortKey="currentResult" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.st_result} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">Result</ResizableTh>
                            )}
                            {isSentupColVisible('st_admitReceipt') && (
                              <ResizableTh colKey="st_admitReceipt" width={columnWidths.st_admitReceipt} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">Admit Card<br />Receipt</ResizableTh>
                            )}
                            {isSentupColVisible('st_marksReceipt') && (
                              <ResizableTh colKey="st_marksReceipt" width={!is12th && columnWidths.st_marksReceipt === 144 ? 80 : (columnWidths.st_marksReceipt || (is12th ? 144 : 80))} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-white">
                                {is12th ? 'Marks Card / Certificate Receipt' : 'Marks Card Receipt'}
                              </ResizableTh>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 text-slate-900">
                          {chunk.map((s) => {
                            const photoSrc = getResolvedStudentPhoto(s);
                            const isSkipped = skippedRowIds.has(s.id);
                            return (
                              <ResizableDataRow key={s.id} rowHeight={rowHeight} onResize={handleRowHeightChange} className={`hover:bg-slate-50 ${isSkipped ? 'opacity-50 bg-slate-100 dark:bg-slate-800/50' : ''}`}>
                                <td className="border border-slate-900 px-0.5 py-0.5 text-center select-none w-7 print:hidden">
                                  <button
                                    type="button"
                                    onClick={() => toggleRowSkip(s.id)}
                                    className="p-1 cursor-pointer flex items-center justify-center mx-auto text-slate-700 hover:text-red-700 transition-colors"
                                    title={isSkipped ? "Click to include this student in print & exports" : "Click to skip this student from print & exports"}
                                  >
                                    {!isSkipped ? (
                                      <CheckSquare size={13} className="text-emerald-700" />
                                    ) : (
                                      <Square size={13} className="text-slate-400" />
                                    )}
                                  </button>
                                </td>
                                {isSentupColVisible('st_sno') && (
                                  <td className="border border-slate-900 px-1 py-0.5 text-center">
                                    <div className={`font-black text-[13px] leading-tight ledger-mono-font ${isSkipped ? 'line-through text-slate-400' : ''}`}>{s.sno}</div>
                                    <div className="text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400 ledger-mono-font">[{s.admNo || '—'}]</div>
                                  </td>
                                )}
                                {isSentupColVisible('st_rollNo') && (
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-[15px] text-sky-800 ledger-mono-font st-rollno-cell">{s.rollNo}</td>
                                )}
                                {isSentupColVisible('st_photo') && (
                                  <td className="sentup-photo-cell register-photo-cell border border-slate-900 p-0 text-center overflow-hidden bg-slate-50 print:bg-transparent" style={{ width: columnWidths.st_photo ? `${columnWidths.st_photo}px` : undefined, height: `${rowHeight}px` }}>
                                    {photoSrc ? (
                                      <div className="w-full h-full flex items-center justify-center p-0.5">
                                        <img
                                          src={photoSrc}
                                          alt={s.name}
                                          className="block max-h-full max-w-full object-contain mx-auto"
                                          style={{ maxHeight: `${Math.max(32, rowHeight - 2)}px` }}
                                          loading="eager"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            if (e.currentTarget.parentElement && e.currentTarget.parentElement.nextElementSibling) {
                                              e.currentTarget.parentElement.nextElementSibling.style.display = 'flex';
                                            }
                                          }}
                                        />
                                      </div>
                                    ) : null}
                                    <div className={`w-full h-full items-center justify-center text-[8.5px] text-slate-400 font-bold ${photoSrc ? 'hidden' : 'flex'}`}>
                                      Photo
                                    </div>
                                  </td>
                                )}
                                {isSentupColVisible('st_boardReg') && (
                                  <td className="border border-slate-900 px-1.5 py-0.5 text-left pl-2 ledger-mono-font text-[13px] font-black st-boardreg-cell">{formatBoardRegSplit(s.boardReg)}</td>
                                )}
                                {isSentupColVisible('st_name') && (
                                  <td className="border border-slate-900 px-2 py-0.5 text-left font-black uppercase text-[14px] st-name-cell">
                                    <div className="flex flex-col items-start justify-center gap-0.5 min-w-0">
                                      {(s.hasInheritedData || s.isReadmission) && (
                                        <div className="flex items-center gap-1 print:hidden shrink-0 leading-none">
                                          {s.isReadmission && (
                                            <span className="text-[7.5px] font-black px-1 py-0.2 rounded bg-purple-100 text-purple-800 leading-tight">
                                              Re-Adm
                                            </span>
                                          )}
                                          {s.hasInheritedData && (
                                            <span
                                              className="inline-flex items-center gap-0.5 text-[7.5px] font-black px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs leading-tight whitespace-nowrap"
                                              title={`Data inherited from ${s.inheritedSource?.class || 'Previous Class'} (${s.inheritedSource?.session || 'Past Session'}): ${(s.inheritedSource?.fields || []).join(', ')}`}
                                            >
                                              <Sparkles size={8} className="text-amber-600 shrink-0" />
                                              <span>From {s.inheritedSource?.class || 'Prev'} ({s.inheritedSource?.session || 'Past'})</span>
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <span className="tracking-tight whitespace-normal break-words leading-tight font-black text-[14px]">{s.name}</span>
                                    </div>
                                  </td>
                                )}
                                {isSentupColVisible('st_parentage') && (
                                  <td className="border border-slate-900 px-2 py-0.5 text-left uppercase leading-tight">
                                    <div className="font-extrabold text-[11px] text-slate-900 border-b border-slate-200 pb-0.5">{s.father}</div>
                                    <div className="text-slate-600 dark:text-slate-400 text-[9.5px] font-semibold pt-0.5">{s.mother}</div>
                                  </td>
                                )}
                                {isSentupColVisible('st_dob') && (
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono ledger-mono-font">
                                    <div className="font-bold text-[11px] text-slate-900">{s.dobFigures || '—'}</div>
                                    {s.inheritedSource?.fields?.includes('dob') && (
                                      <div className="text-[7.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 rounded px-0.5 leading-tight print:hidden">
                                        From {s.inheritedSource.class || 'Prev'}
                                      </div>
                                    )}
                                  </td>
                                )}
                                {isSentupColVisible('st_subs') && (
                                  <td className="border border-slate-900 px-1 py-0.5 text-center leading-tight font-black st-subs-cell">
                                    {s.subs ? s.subs.split(',').map((sub, i) => (
                                      <div key={i} className="text-[10px] text-slate-900 leading-tight st-subs-item">
                                        {sub.trim()}
                                      </div>
                                    )) : <span className="text-[10px] font-bold text-slate-400">—</span>}
                                    {s.inheritedSource?.fields?.includes('subs') && (
                                      <div className="text-[7.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 rounded px-0.5 mt-0.5 leading-tight print:hidden">
                                        From {s.inheritedSource.class || 'Prev'}
                                      </div>
                                    )}
                                  </td>
                                )}
                                {isSentupColVisible('st_boardRoll') && (
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono font-black text-[15px] text-slate-900 ledger-mono-font st-boardroll-cell">
                                    <div className="tracking-tight">{s.boardRollNo || '—'}</div>
                                  </td>
                                )}
                                {isSentupColVisible('st_result') && (
                                  <td className="border border-slate-900 px-1 py-0.5 text-center leading-tight">
                                    {(() => {
                                      const resRaw = String(s.currentResult || '').trim();
                                      const isQualified = /^(pass|passed|qual|qualified)\b/i.test(resRaw) || /qualified/i.test(resRaw) || /passed/i.test(resRaw);
                                      const isReappear = /^(reap|reappear|fail|failed)\b/i.test(resRaw) || /reappear/i.test(resRaw) || /reap\b/i.test(resRaw);
                                      const resultColor = isQualified ? '#047857' : isReappear ? '#b91c1c' : undefined;
                                      const resultClass = isQualified
                                        ? 'text-emerald-700 dark:text-emerald-400 font-black'
                                        : isReappear
                                          ? 'text-red-700 dark:text-red-400 font-black'
                                          : 'text-slate-900 dark:text-slate-100 font-bold';

                                      // Resolve sub-detail: either marks obtained or subjects to reappear
                                      let subDetail = formatResultMarksString(s.currentMarks);

                                      // For Reappear status, resolve reappear subjects if not already present or if numeric marks absent
                                      if (isReappear) {
                                        const hasNumericMarks = subDetail && /\d{2,3}/.test(subDetail);
                                        if (!hasNumericMarks) {
                                          const reapCodeSet = extractReappearCodes(s);
                                          if (reapCodeSet && reapCodeSet.size > 0) {
                                            subDetail = Array.from(reapCodeSet).join(', ');
                                          } else if (s.currentMarks && typeof s.currentMarks === 'string' && s.currentMarks.trim() && s.currentMarks !== '—') {
                                            subDetail = abbreviateSubjects(s.currentMarks);
                                          } else if (isAprBianSession && s.subs && s.subs !== '—' && s.subs !== '-') {
                                            subDetail = s.subs;
                                          }
                                        }

                                        // Clean any residual REAP/REAPPEAR tokens from subDetail
                                        if (subDetail) {
                                          subDetail = subDetail
                                            .replace(/\b(reap|reappear|fail|failed|result)\b/gi, '')
                                            .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
                                            .replace(/,\s*,/g, ', ')
                                            .trim();
                                        }
                                      }

                                      const showDetail = Boolean(
                                        subDetail &&
                                        subDetail !== '—' &&
                                        subDetail !== '-' &&
                                        (!resRaw || !resRaw.toLowerCase().includes(subDetail.toLowerCase()))
                                      );

                                      return (
                                        <>
                                          <div
                                            className={`${resultClass} text-[11.5px] uppercase tracking-wide leading-tight`}
                                            style={resultColor ? { color: resultColor } : undefined}
                                          >
                                            {resRaw || '—'}
                                          </div>
                                          {showDetail && (
                                            <div
                                              className={`text-[9.5px] font-mono font-bold mt-0.5 leading-none whitespace-nowrap ${isReappear ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}
                                              style={isReappear ? { color: '#b91c1c' } : undefined}
                                            >
                                              ({subDetail})
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </td>
                                )}
                                {isSentupColVisible('st_admitReceipt') && (
                                  <td className="border border-slate-900 p-1 text-center align-bottom text-[9px] st-receipt-cell">
                                    <div className="h-full flex flex-col justify-end st-receipt-inner" style={{ minHeight: `${Math.max(34, rowHeight - 8)}px` }}>
                                      <div className="border-t border-slate-900 pt-0.5 font-bold text-[9px] text-slate-800 select-none">
                                        Signature
                                      </div>
                                    </div>
                                  </td>
                                )}
                                {isSentupColVisible('st_marksReceipt') && (
                                  <td className="border border-slate-900 p-1 text-[8.5px] leading-tight align-bottom st-receipt-cell">
                                    {is12th ? (
                                      <div className="flex justify-between gap-1 h-full st-receipt-inner" style={{ minHeight: `${Math.max(34, rowHeight - 8)}px` }}>
                                        <div className="flex-1 border-r border-dashed border-slate-300 pr-1 flex flex-col justify-between h-full">
                                          <div className="font-extrabold text-[8.5px] text-slate-900 text-center leading-tight">Marks Card Received</div>
                                          <div className="mt-auto border-t border-slate-900 pt-0.5 text-center text-[8.5px] font-bold text-slate-800 select-none">
                                            Signature
                                          </div>
                                        </div>
                                        <div className="flex-1 pl-1 flex flex-col justify-between h-full">
                                          <div className="font-extrabold text-[8.5px] text-slate-900 text-center leading-tight">Qual. Certificate</div>
                                          {String(s.class || '').includes('11') ? (
                                            <div className="mt-auto text-center text-[8px] text-slate-400 font-bold py-0.5 select-none">
                                              — (11th N/A)
                                            </div>
                                          ) : (
                                            <div className="mt-auto border-t border-slate-900 pt-0.5 text-center text-[8.5px] font-bold text-slate-800 select-none">
                                              Signature
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col justify-between h-full w-full st-receipt-inner" style={{ minHeight: `${Math.max(34, rowHeight - 8)}px` }}>
                                        <div className="font-extrabold text-[8.5px] text-slate-900 text-center leading-tight">Marks Card Received</div>
                                        <div className="mt-auto border-t border-slate-900 pt-0.5 text-center text-[8.5px] font-bold text-slate-800 select-none">
                                          Signature
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                )}
                              </ResizableDataRow>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Signatures */}
                    <div className="signature-footer flex justify-between items-center mt-1 pt-0.5 text-[11px] font-black text-red-800">
                      <div className="signature-block text-center w-32 border-t-2 border-red-800 pt-0.5">Incharge</div>
                      <div className="signature-block text-center w-32 border-t-2 border-red-800 pt-0.5">Checked By</div>
                      <div className="signature-block text-center w-32 border-t-2 border-red-800 pt-0.5">Principal</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: ASSIGN IDs (BULK SEQUENTIAL + INHERITANCE ENGINE)        */}
          {/* ============================================================== */}
          {activeTab === 'assign_ids' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
              {/* Compact Control Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <CreditCard size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      Bulk Assign Admission Numbers
                    </h2>
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      Auto-numbering & Board Reg No inheritance with direct Firestore sync.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAssignStartId(calculatedNextAdmNo)}
                    className="py-1 px-2 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
                    title="Auto-calculate next available Admission Number from database"
                  >
                    <RefreshCw size={11} />
                    <span>Auto-Next ({calculatedNextAdmNo})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRunAssignIds}
                    disabled={assigningIds || candidateIdPreviewList.length === 0}
                    className="py-1 px-3 rounded-lg font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all text-xs active:scale-95"
                  >
                    {assigningIds ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                    <span>Assign IDs ({candidateIdPreviewList.length})</span>
                  </button>
                </div>
              </div>

              {/* Compact Filter Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                {/* Session */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Session:</span>
                  <select
                    value={assignSessionFilter}
                    onChange={(e) => setAssignSessionFilter(e.target.value)}
                    className="py-0.5 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess}</option>
                    ))}
                    <option value="ALL">All Sessions</option>
                  </select>
                </div>

                {/* Target Classes Toggle Pills */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Classes:</span>
                  <div className="flex items-center gap-0.5">
                    {availableClasses.map(cls => {
                      const checked = assignClasses.includes(cls);
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => {
                            if (checked) setAssignClasses(prev => prev.filter(c => c !== cls));
                            else setAssignClasses(prev => [...prev, cls]);
                          }}
                          className={`py-0.5 px-2 rounded text-[10.5px] font-extrabold cursor-pointer border transition-all ${
                            checked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start From ID */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Start ID:</span>
                  <input
                    type="number"
                    value={assignStartId}
                    onChange={(e) => setAssignStartId(e.target.value)}
                    className="w-20 py-0.5 px-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-center"
                  />
                </div>

                {/* Only Missing Checkbox */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white dark:bg-slate-900 py-0.5 px-2 rounded-md border border-slate-200 dark:border-slate-800">
                  <input
                    type="checkbox"
                    checked={onlyMissingAdmNo}
                    onChange={(e) => setOnlyMissingAdmNo(e.target.checked)}
                    className="rounded text-indigo-600 cursor-pointer"
                  />
                  <span className="text-[10.5px]">Only Missing Adm No</span>
                  <span className="ml-1 px-1 py-0.2 rounded font-mono font-black text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950">
                    {candidateIdPreviewList.length}
                  </span>
                </label>
              </div>

              {/* High Density Candidate Preview Table */}
              {candidateIdPreviewList.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-black text-slate-700 dark:text-slate-300 text-[11px] border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-1.5 px-2 w-10 text-center">#</th>
                          <th className="py-1.5 px-2 min-w-44">Student & Father's Name</th>
                          <th className="py-1.5 px-2">Class (Session)</th>
                          <th className="py-1.5 px-2">Board Reg. No.</th>
                          <th className="py-1.5 px-2">Previous Adm. No.</th>
                          <th className="py-1.5 px-2 text-center">Current Adm No</th>
                          <th className="py-1.5 px-2 text-center">Strategy</th>
                          <th className="py-1.5 px-2 text-right">Proposed ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                        {candidateIdPreviewList.map((item, idx) => {
                          const { student, currentAdm, prevInfo, strat, proposed } = item;
                          return (
                            <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="py-1 px-2 text-center font-bold text-slate-400 ledger-mono-font">{idx + 1}</td>
                              <td className="py-1 px-2">
                                <div className="font-extrabold text-slate-900 dark:text-white leading-tight">{student.name}</div>
                                <div className="text-[10px] text-slate-500">S/O: {student.father || '—'}</div>
                              </td>
                              <td className="py-1 px-2 font-bold text-indigo-600 dark:text-indigo-400">
                                {student.class} <span className="text-[10px] text-slate-400">({student.session})</span>
                              </td>
                              <td className="py-1 px-2 font-mono text-[10.5px] ledger-mono-font">{student.boardReg || '—'}</td>
                              <td className="py-1 px-2 font-mono text-[10.5px]">
                                {prevInfo ? (
                                  <span className="px-1.5 py-0.5 rounded font-black text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800">
                                    {prevInfo.admNo} ({prevInfo.class})
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-1 px-2 text-center font-mono ledger-mono-font text-slate-600 dark:text-slate-400">{currentAdm || '—'}</td>
                              <td className="py-1 px-2 text-center">
                                <div className="inline-flex rounded-md p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'assign_new' }))}
                                    className={`px-1.5 py-0.5 text-[9.5px] font-black rounded cursor-pointer transition-all ${
                                      strat === 'assign_new' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    Sequential
                                  </button>
                                  {prevInfo && (
                                    <button
                                      type="button"
                                      onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'inherit_prev' }))}
                                      className={`px-1.5 py-0.5 text-[9.5px] font-black rounded cursor-pointer transition-all ${
                                        strat === 'inherit_prev' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      Inherit
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'skip' }))}
                                    className={`px-1.5 py-0.5 text-[9.5px] font-black rounded cursor-pointer transition-all ${
                                      strat === 'skip' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    Skip
                                  </button>
                                </div>
                              </td>
                              <td className="py-1 px-2 text-right font-mono font-black text-indigo-700 dark:text-indigo-300 text-xs">
                                {proposed}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 font-semibold border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950">
                  No students match the selected class scope and missing admission number filter.
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: ASSIGN DATES (BULK ADM & SUBMISSION DATE ASSIGNER)       */}
          {/* ============================================================== */}
          {activeTab === 'assign_dates' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
              {/* Compact Control Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <Calendar size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      Bulk Assign Admission & Submission Dates
                    </h2>
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      Apply uniform Admission Date or Online Submission Date across target classes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRunAssignDates}
                  disabled={assigningDates || dateTargetStudents.length === 0}
                  className="py-1 px-3 rounded-lg font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all text-xs active:scale-95"
                >
                  {assigningDates ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                  <span>Apply Date ({dateTargetStudents.length} Students)</span>
                </button>
              </div>

              {/* Compact Form Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-0.5">Target Field:</label>
                  <select
                    value={assignDateField}
                    onChange={(e) => setAssignDateField(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer"
                  >
                    <option value="admDate">Admission Date (Adm. Date)</option>
                    <option value="onlineSubmDate">Online Submission Date</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10.5px] font-bold text-slate-500">Select Date:</label>
                    <button
                      type="button"
                      onClick={() => setAssignDateValue(new Date().toISOString().split('T')[0])}
                      className="text-[9.5px] text-indigo-600 hover:underline cursor-pointer font-bold"
                    >
                      Today
                    </button>
                  </div>
                  <input
                    type="date"
                    value={assignDateValue}
                    onChange={(e) => setAssignDateValue(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-0.5">Session Scope:</label>
                  <select
                    value={assignDateSession}
                    onChange={(e) => setAssignDateSession(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer text-indigo-700 dark:text-indigo-300"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess}</option>
                    ))}
                    <option value="ALL">All Sessions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-0.5">Class Scope:</label>
                  <select
                    value={assignDateClass}
                    onChange={(e) => setAssignDateClass(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer"
                  >
                    <option value="ALL">All Classes</option>
                    {availableClasses.map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Records Table Preview */}
              {dateTargetStudents.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-black text-slate-700 dark:text-slate-300 text-[11px] border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-1 px-2 w-10 text-center">#</th>
                          <th className="py-1 px-2">Student Name</th>
                          <th className="py-1 px-2">Father's Name</th>
                          <th className="py-1 px-2">Class</th>
                          <th className="py-1 px-2">Roll No.</th>
                          <th className="py-1 px-2">Current Date</th>
                          <th className="py-1 px-2 text-right text-indigo-600">New Date to Apply</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                        {dateTargetStudents.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="py-1 px-2 text-center font-bold text-slate-400 ledger-mono-font">{idx + 1}</td>
                            <td className="py-1 px-2 font-bold">{st.name}</td>
                            <td className="py-1 px-2 text-slate-500">{st.father}</td>
                            <td className="py-1 px-2 font-bold text-indigo-600">{st.class}</td>
                            <td className="py-1 px-2 font-mono ledger-mono-font">{st.rollNo || '—'}</td>
                            <td className="py-1 px-2 font-mono text-slate-500 ledger-mono-font">
                              {assignDateField === 'admDate' ? (st.admDate || '—') : (st.onlineStatus || '—')}
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 ledger-mono-font">
                              {assignDateValue}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center text-slate-500 font-semibold border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950">
                  No students match the selected session and class scope.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
