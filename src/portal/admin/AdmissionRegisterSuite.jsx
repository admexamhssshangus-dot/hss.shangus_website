import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  BookOpen, FileSpreadsheet, CreditCard, Calendar, Printer, FileText,
  RefreshCw, Check, Search, ZoomIn, ZoomOut,
  Plus, Trash2, FileCheck, Sliders, Loader2, Columns, LayoutGrid,
  UserCheck, UserX, AlertCircle, X, Edit3, UserPlus, ChevronRight,
  Filter, Eye, ChevronDown, ChevronUp, Sparkles, SlidersHorizontal, Save, RotateCcw, Move, ArrowUpDown,
  CheckSquare, Square, Minus, AlertTriangle, CheckCircle2, ListOrdered, Hash, Download, Layers, Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import verifiedCatalog from '../../data/verifiedStudentsCatalog.json';
import historicalAdmLookup from '../../data/historicalAdmissionLookup.json';
import { db } from '../../services/firebase';
import { doc, writeBatch, collection, getDocs, getDoc, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import {
  updateCachedItem,
  getCachedCollectionSync,
  getCachedCollection,
  getMasterRegistersByScope,
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
  sno: 32,
  photo: 40,
  rollNo: 42,
  formNo: 62,
  onlineStatus: 48,
  admDate: 56,
  admNo: 56,
  class: 44,
  boardReg: 96,
  name: 112,
  father: 90,
  mother: 90,
  dobFigures: 56,
  dobWords: 96,
  gender: 40,
  village: 62,
  block: 52,
  tehsil: 52,
  district: 52,
  mobile: 66,
  parentMobile: 66,

  // PART 2
  p2_sno: 32,
  p2_stream: 50,
  p2_subs: 96,
  p2_aadhar: 80,
  p2_cat: 38,
  p2_socio: 46,
  p2_blood: 42,
  p2_account: 86,
  p2_ifsc: 64,
  p2_prevSchool: 86,
  p2_prevRoll: 48,
  p2_prevResult: 48,
  p2_pen: 92,
  p2_prevCC: 76,
  p2_withdrawal: 56,
  p2_issuedCC: 76,
  p2_receipt: 97,
  p2_remarks: 70,

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
  { id: 'sst', code: 'S.ST', name: 'Social Studies (Secondary)' }
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
  const isNarrow = Boolean(width && width < 54);

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
      <div className={`flex items-center ${isLeftAlign ? 'justify-between' : 'justify-center'} gap-0.5 w-full h-full relative`}>
        <div
          className="flex-1 min-w-0 text-center leading-[1.12]"
          style={{ wordBreak: 'keep-all', overflowWrap: 'normal', hyphens: 'none' }}
        >
          {children}
        </div>
        {sortKey && onSort && (
          <span
            className={`sort-indicator-icon ${isNarrow ? 'absolute top-0 right-0 pointer-events-none' : 'inline-flex items-center shrink-0 ml-0.5'} print:hidden select-none`}
            aria-hidden="true"
          >
            {isAsc ? (
              <ChevronUp size={isNarrow ? 9 : 11} className={isDarkHeader ? "text-amber-300 font-black drop-shadow-2xs" : "text-indigo-700 dark:text-indigo-400 font-black"} />
            ) : isDesc ? (
              <ChevronDown size={isNarrow ? 9 : 11} className={isDarkHeader ? "text-amber-300 font-black drop-shadow-2xs" : "text-indigo-700 dark:text-indigo-400 font-black"} />
            ) : (
              <ArrowUpDown size={isNarrow ? 7 : 8.5} className={`${isNarrow ? 'opacity-0 group-hover/th:opacity-75' : ''} ${isDarkHeader ? "text-white/60 group-hover/th:text-white transition-opacity" : "text-slate-500 group-hover/th:text-slate-900 dark:text-slate-400 transition-opacity"}`} />
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

function normalizeSessionKey(sess) {
  return cleanStr(sess)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function isSessionMatching(itemSess, targetSess) {
  if (!targetSess || targetSess === 'ALL') return true;
  const nItem = normalizeSessionKey(itemSess);
  const nTarget = normalizeSessionKey(targetSess);
  if (!nItem && (nTarget.includes('2025-26') || nTarget === 'live')) return true;
  if (nItem === nTarget) return true;

  const matchItemYears = nItem.match(/\d{4}-\d{2,4}/);
  const matchTargetYears = nTarget.match(/\d{4}-\d{2,4}/);
  if (matchItemYears && matchTargetYears && matchItemYears[0] === matchTargetYears[0]) {
    return true;
  }
  return nItem.includes(nTarget) || nTarget.includes(nItem);
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
    const rawDatePart = parts[0];
    const datePart = formatRegisterDate(rawDatePart) || rawDatePart;
    const timePart = parts.slice(1).join(' ');
    return (
      <div className="flex flex-col justify-center items-start leading-[1.05] overflow-hidden">
        <span className="whitespace-nowrap font-medium text-[7.5px] leading-tight">{datePart}</span>
        <span className="whitespace-nowrap text-[6.8px] text-slate-500 font-normal leading-tight">{timePart}</span>
      </div>
    );
  }
  const formatted = formatRegisterDate(str);
  return <span className="whitespace-nowrap font-medium text-[7.5px]">{formatted || str}</span>;
}

function renderAdmDateCell(date) {
  if (!date || date === '—' || date === '-') return '—';
  const formatted = formatRegisterDate(date) || (typeof date === 'string' ? date.trim() : String(date));
  if (!formatted || formatted === '—') return '—';

  // If date contains date and time, e.g. "03-01-2026 10:30"
  if (formatted.includes(' ')) {
    const parts = formatted.split(' ');
    return (
      <div className="flex flex-col items-center justify-center leading-tight overflow-hidden text-center adm-date-cell">
        <span className="font-bold text-[7.8px] ledger-mono-font leading-tight whitespace-nowrap">{parts[0]}</span>
        <span className="text-[6.8px] text-slate-500 font-medium leading-tight whitespace-nowrap">{parts.slice(1).join(' ')}</span>
      </div>
    );
  }

  // Match DD-MM-YYYY, DD/MM/YYYY, or DD.MM.YYYY
  const match = formatted.match(/^(\d{1,2}[-/.])(\d{1,2})([-/.])(\d{2,4})$/);
  if (match) {
    const dayMonth = `${match[1]}${match[2]}${match[3]}`; // e.g. "03-01-"
    const year = match[4]; // e.g. "2026"
    return (
      <div className="flex flex-col items-center justify-center leading-tight overflow-hidden text-center adm-date-cell">
        <span className="whitespace-nowrap font-bold text-[7.8px] ledger-mono-font leading-tight">{dayMonth}</span>
        <span className="whitespace-nowrap font-bold text-[7.8px] ledger-mono-font leading-tight">{year}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center leading-tight overflow-hidden text-center font-bold text-[7.8px] ledger-mono-font break-words adm-date-cell">
      {formatted}
    </div>
  );
}

function renderPenCell(pen) {
  if (!pen || pen === 'NA' || pen === '—') return 'NA';
  const str = String(pen).trim();
  if (str.includes(',')) {
    const parts = str.split(',');
    return (
      <div className="flex flex-col items-center justify-center leading-[1.05] break-all max-w-full overflow-hidden">
        <span className="font-bold text-[8.5px] leading-tight break-all pen-val">{parts[0].trim()}</span>
        {parts[1] && <span className="text-[7.5px] text-slate-600 font-medium leading-tight break-all pen-sub">{parts[1].trim()}</span>}
      </div>
    );
  }
  return <div className="break-all max-w-full leading-tight text-[8.5px] truncate pen-val">{str}</div>;
}

function renderAdmittedVideCell(val) {
  if (!val || val === '—' || val === '-') return '—';
  const str = String(val).trim();
  if (str.includes(';')) {
    const parts = str.split(';');
    const noPart = parts[0].trim();
    const rawDatePart = parts.slice(1).join(';').trim();
    const datePart = formatRegisterDate(rawDatePart) || rawDatePart;
    return (
      <div className="flex flex-col items-center justify-center leading-[1.05] overflow-hidden">
        <span className="font-bold text-[8.5px] leading-tight cc-val">{noPart}{datePart ? ';' : ''}</span>
        {datePart && (
          <span className="whitespace-nowrap font-medium text-[7.8px] text-emerald-950 leading-tight cc-date">
            {datePart}
          </span>
        )}
      </div>
    );
  }
  return <span className="leading-tight break-words text-[8.5px] font-bold cc-val">{str}</span>;
}

const BOARD_REGISTRATION_KEYS = [
  'boardRegNo', 'Board Registration Number', 'Board Registration No.', 'Board Registration No',
  'Board Reg. No.', 'Board Reg No', 'Board Registration No. (Class 12th)',
  'Board Registration No. (Class 11th)', 'Board Registration No. (Class 10th)',
  'Board Registration No. (Class 9th)', 'Registration No. (allotted by JKBOSE)',
  'Registration No. (allotted by JKBOSE )', 'Registration No. (allotted by DIET)',
  'DIET Registration No.', 'DIET/Board Reg. No.', 'DIET Reg. No.', 'DIET Registration Number',
  'Registration Number', 'Registration No.',
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
  const ymd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ymd) {
    const converted = new Date(
      Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]),
      Number(ymd[4] || 0), Number(ymd[5] || 0), Number(ymd[6] || 0)
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

// Evaluates whether a candidate belongs in the selected class scope.
// When combined classes are selected (e.g. 11th & 12th, or 9th & 10th):
// - All junior class students (11th or 9th) are shown
// - Senior class students (12th or 10th) are ONLY shown if they are marked as Re-admissions!
export function isStudentIncludedInClassScope(selectedClass, studentClass, isReadmission) {
  if (!selectedClass || selectedClass === 'ALL') return true;

  const targetClean = String(selectedClass).toLowerCase().replace(/class/gi, '').trim();
  const studentCls = String(studentClass || '').toLowerCase().replace(/class/gi, '').trim();

  const is11th = studentCls.includes('11');
  const is12th = studentCls.includes('12');
  const is9th = studentCls.includes('9');
  const is10th = studentCls.includes('10');

  // Combined Senior Secondary: '11th & 12th', '11th, 12th', '11th and 12th', '11th-12th'
  if (
    (targetClean.includes('11') && targetClean.includes('12')) ||
    targetClean === '11th & 12th'
  ) {
    if (is11th) return true; // All 11th students are included
    if (is12th) return Boolean(isReadmission); // ONLY Re-admission 12th students are included
    return false;
  }

  // Combined Secondary: '9th & 10th', '9th, 10th', '9th and 10th', '9th-10th'
  if (
    (targetClean.includes('9') && targetClean.includes('10')) ||
    targetClean === '9th & 10th'
  ) {
    if (is9th) return true; // All 9th students are included
    if (is10th) return Boolean(isReadmission); // ONLY Re-admission 10th students are included
    return false;
  }

  // Direct specific class match (e.g. user selected '12th' or '11th' alone)
  return matchesClassVal(selectedClass, studentClass);
}

// Authoritative Sequential Re-admission Roster for Class 12th (Session 2025-26)
// Roll 22 (Burhan) omitted; Roll 153 is Gowher Ahmad Lone (Form 250209); Sequential Adm Nos: 5476–5513.
export const VERIFIED_CLASS12_READMISSION_ROSTER = [
  { roll: 1, name: 'Irtiza Maqbool', form: '250199', reg: '2201010000200048', admNo: '5476', oldAdm: '4460' },
  { roll: 23, name: 'Faizan Mushtaq', form: '250299', reg: '2001000000470003', admNo: '5477', oldAdm: '4472' },
  { roll: 39, name: 'Saima Nisar', form: '250195', reg: '2201010001010039', admNo: '5478', oldAdm: '4513' },
  { roll: 40, name: 'Toiba Imtiyaz', form: '250314', reg: '2201013001170027', admNo: '5479', oldAdm: '4468' },
  { roll: 50, name: 'Sarvat Abbas', form: '250188', reg: '2101010000200015', admNo: '5480', oldAdm: '4887' },
  { roll: 51, name: 'Mehvish Iqbal', form: '250214', reg: '2001010000200019', admNo: '5481', oldAdm: '4615' },
  { roll: 54, name: 'Sartaj Ahmad Mir', form: '250206', reg: '2201000000610024', admNo: '5482', oldAdm: '4904' },
  { roll: 74, name: 'Owais Hassan', form: '250527', reg: '2101005000610037', admNo: '5483', oldAdm: '4730' },
  { roll: 75, name: 'Summaya Naseem', form: '250444', reg: '2117010000130089', admNo: '5484', oldAdm: '4714' },
  { roll: 77, name: 'Muqeet Ahmad', form: '250447', reg: '2101000000610021', admNo: '5485', oldAdm: '4797' },
  { roll: 80, name: 'Jawad Ul Rahim', form: '250456', reg: '2201001001010019', admNo: '5486', oldAdm: '4898' },
  { roll: 87, name: 'Nowman Ashraf', form: '250481', reg: '2201000000930054', admNo: '5487', oldAdm: '4929' },
  { roll: 90, name: 'Shaiesta Parveez', form: '250493', reg: '2201010000900028', admNo: '5488', oldAdm: '4943' },
  { roll: 93, name: 'Sabreena Aijaz', form: '250333', reg: '2201010000200038', admNo: '5489', oldAdm: '4906' },
  { roll: 95, name: 'Abroo Ashraf', form: '250512', reg: '2101010001170008', admNo: '5490', oldAdm: '4656' },
  { roll: 96, name: 'Inshu Nazir', form: '250511', reg: '2101010001170015', admNo: '5491', oldAdm: '4657' },
  { roll: 97, name: 'Sadiyah Fayaz', form: '250513', reg: '2101010001170043', admNo: '5492', oldAdm: '4721' },
  { roll: 102, name: 'Doordana Bilal', form: '250549', reg: '2101013000200038', admNo: '5493', oldAdm: '4724' },
  { roll: 116, name: 'Arooja Masroor', form: '250200', reg: '2201013000470016', admNo: '5494', oldAdm: '5029' },
  { roll: 126, name: 'Simran Mushtaq', form: '250305', reg: '2201010000200033', admNo: '5495', oldAdm: '5224' },
  { roll: 127, name: 'Rutba Manzoor', form: '250387', reg: '', admNo: '5496', oldAdm: '4827' },
  { roll: 130, name: 'Seerat Yousuf', form: '250033', reg: '2201010000200026', admNo: '5497', oldAdm: '5024' },
  { roll: 133, name: 'Faizan Bilal Najar', form: '250402', reg: '2201003000630003', admNo: '5498', oldAdm: '5195' },
  { roll: 153, name: 'Gowher Ahmad Lone', form: '250209', reg: '2101003001220041', admNo: '5499', oldAdm: '4765' },
  { roll: 154, name: 'Mohsin Wakeel', form: '250446', reg: '', admNo: '5500', oldAdm: '4886' },
  { roll: 155, name: 'Ruqaiya Jan', form: '250449', reg: '2201010000200008', admNo: '5501', oldAdm: '5061' },
  { roll: 157, name: 'Moomin Rashid Reshi', form: '250422', reg: '2101000000900024', admNo: '5502', oldAdm: '4819' },
  { roll: 165, name: 'Kifayat Jabbar Kutay', form: '250234', reg: '2101000000900047', admNo: '5503', oldAdm: '4809' },
  { roll: 168, name: 'Rasik Farooq', form: '250472', reg: '2201000000900078', admNo: '5504', oldAdm: '5194' },
  { roll: 169, name: 'Tabasum Jan', form: '250474', reg: '', admNo: '5505', oldAdm: '4838' },
  { roll: 171, name: 'Arsalan Shabir', form: '250237', reg: '2201000001010055', admNo: '5506', oldAdm: '4990' },
  { roll: 174, name: 'Dafeeqa Jan', form: '250464', reg: '2101010000200033', admNo: '5507', oldAdm: '4867' },
  { roll: 177, name: 'Peerzada Meeran', form: '250255', reg: '2101000000030027', admNo: '5508', oldAdm: '4769' },
  { roll: 179, name: 'Sabreena Jan', form: '250263', reg: '2101010000200029', admNo: '5509', oldAdm: '5192' },
  { roll: 184, name: 'Zakir Ahmad Bakshi', form: '250534', reg: '2201000001220017', admNo: '5510', oldAdm: '5193' },
  { roll: 189, name: 'Insha Jan', form: '250279', reg: '2101013000200039', admNo: '5511', oldAdm: '4859' },
  { roll: 191, name: 'Sarmat Gulzar', form: '250232', reg: '2101000001170012', admNo: '5512', oldAdm: '4878' },
  { roll: 193, name: 'Seerat Jan', form: '250546', reg: '1901013000200037', admNo: '5513', oldAdm: '4567' }
];

export function buildClass12ReadmissionRemark(targetCls = '12th', oldAdm = '') {
  const cleanOld = cleanStr(oldAdm).replace(/^\(|\)$/g, '').trim();
  const clsNorm = cleanStr(targetCls).replace(/^class\s*/i, '');
  return `Gap case: Re-adm ${clsNorm || '12th'}, 2026 (Oct-Nov)${cleanOld ? ` • Prev Adm: ${cleanOld}` : ''} • Marks card verified`;
}

export function formatCompactRemark(remark) {
  if (!remark || typeof remark !== 'string') return '';
  let str = remark.trim();
  
  // Compact gap case re-admission phrasing
  str = str.replace(
    /Gap\s+case(?:,\s*hence)?,?\s*readmitted\s+for\s+class\s*(\d+\w*|\w+),?\s*([\d-]+)?\s*(?:\(([^)]+)\))?/gi,
    (match, cls, year, sess) => {
      let sessPart = '';
      if (sess) {
        const cleanSess = sess.replace(/\s*session/gi, '').trim();
        const capSess = cleanSess.replace(/\b([a-z])/g, m => m.toUpperCase());
        sessPart = ` (${capSess})`;
      }
      return `Gap case: Re-adm ${cls}${year ? `, ${year}` : ''}${sessPart}`;
    }
  );

  str = str.replace(/hence,?\s*readmitted\s+for\s+class/gi, 'Re-adm');
  str = str.replace(/readmitted\s+for\s+class/gi, 'Re-adm');
  
  str = str.replace(/\((oct-nov|annual|bi-annual|regular|private)\s+session\)/gi, (m, s) => {
    return `(${s.replace(/\b([a-z])/g, c => c.toUpperCase())})`;
  });

  str = str.replace(/Marks\s*card\s*submitted\s*&\s*verified/gi, 'Marks card verified');
  str = str.replace(/Prev\s*Adm:\s*\((\d+)\)/gi, 'Prev Adm: $1');
  str = str.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();

  return str;
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
      <div className="leading-tight text-left font-mono st-reg-split">
        <span className="font-black text-slate-900 dark:text-slate-100 tracking-tight">{s.substring(0, 12)}</span>
        <br />
        <span className="font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">{s.substring(12)}</span>
      </div>
    );
  }
  return <span className="font-black font-mono tracking-tight st-reg-split">{s}</span>;
}

// Comprehensive Academic Gap Detection for Class 12th & 10th Re-admissions
export function detectStudentAcademicGap(student, currentSession = '', prevInfo = null) {
  if (!student) return { hasGap: false, reason: '', reasonBrief: '', gapYears: 0 };
  const raw = student.raw || student;

  // If admin previously dismissed the gap, do not flag again
  if (raw.gapDismissed === true || student.gapDismissed === true) {
    return { hasGap: false, reason: '', reasonBrief: '', gapYears: 0 };
  }

  const cls = cleanStr(student.class || raw.class || raw.Class || raw['Admission sought for class'] || '');
  const is12th = cls.includes('12');
  const is10th = cls.includes('10');

  // Current session starting year (e.g. '2025-26' -> 2025)
  const effCurrSess = currentSession || student.session || raw.session || raw['Academic Session'] || '';
  const currYearMatch = String(effCurrSess).match(/(19\d\d|20\d\d)/);
  const currYear = currYearMatch ? parseInt(currYearMatch[1], 10) : null;

  // 1. Check previous academic session fields on student record or matched previous info
  const prevSessKeys = [
    'prevSession', 'previousSession', 'Previous Session', 'Prev Session', 'Prev. Session',
    'Session (Class 11th)', 'Class 11th Session', 'Session of Class 11th',
    'Session (11th)', '11th Session', 'Previous Academic Session', 'session11th',
    'Session (Class 9th)', 'Class 9th Session', 'session9th'
  ];
  let prevSessVal = '';
  for (const k of prevSessKeys) {
    if (raw[k]) { prevSessVal = String(raw[k]).trim(); break; }
  }

  // Also check matched historical record / prevInfo session
  if (!prevSessVal && prevInfo) {
    prevSessVal = String(prevInfo.session || prevInfo.Session || prevInfo['Academic Session'] || '').trim();
  }

  if (currYear && prevSessVal) {
    const prevYearMatch = String(prevSessVal).match(/(19\d\d|20\d\d)/);
    if (prevYearMatch) {
      const prevYear = parseInt(prevYearMatch[1], 10);
      const diff = currYear - prevYear;
      // Normal progression between 11th and 12th (or 9th and 10th) is 1 year difference (e.g., 2025 - 2024 = 1).
      // Gap exists if diff > 1 (e.g. 2025 - 2023 = 2 or more).
      if (diff > 1) {
        const gap = diff - 1;
        const fromLabel = is12th ? 'Class 11th' : is10th ? 'Class 9th' : 'Previous';
        return {
          hasGap: true,
          gapYears: gap,
          prevSession: prevSessVal,
          reason: `Session gap: ${fromLabel} in ${prevSessVal} → ${cls || 'Current'} in ${effCurrSess} (${gap} yr gap)`,
          reasonBrief: `${prevSessVal} (${gap}y gap)`
        };
      }
    }
  }

  // 2. Check previous passing year / exam year
  // Class 11th passing year for 12th student (normal is 1 yr before)
  const pass11thStr = cleanStr(
    raw['Year of Passing Class 11th'] || raw['Year of Passing (11th)'] ||
    raw['11th Year of Passing'] || raw['Passing Year (11th)'] ||
    student['Year of Passing Class 11th'] || ''
  );
  if (is12th && currYear && pass11thStr) {
    const pMatch = String(pass11thStr).match(/(19\d\d|20\d\d)/);
    if (pMatch) {
      const pYear = parseInt(pMatch[1], 10);
      if (currYear - pYear > 1) {
        const gap = currYear - pYear - 1;
        return {
          hasGap: true,
          gapYears: gap,
          prevSession: String(pYear),
          reason: `Exam gap: Passed Class 11th in ${pYear} (${gap} yr gap)`,
          reasonBrief: `Passed 11th (${pYear})`
        };
      }
    }
  }

  // Class 10th passing year for 12th student (normal is 2 yrs before)
  const pass10thStr = cleanStr(
    raw['Year of Passing Class 10th'] || raw['Year of Passing (10th)'] ||
    raw['10th Year of Passing'] || raw['Passing Year (10th)'] ||
    student['Year of Passing Class 10th'] || ''
  );
  if (is12th && currYear && pass10thStr) {
    const pMatch = String(pass10thStr).match(/(19\d\d|20\d\d)/);
    if (pMatch) {
      const pYear = parseInt(pMatch[1], 10);
      if (currYear - pYear > 2) {
        const gap = currYear - pYear - 2;
        return {
          hasGap: true,
          gapYears: gap,
          prevSession: String(pYear),
          reason: `Exam gap: Passed Class 10th in ${pYear} (${gap} yr gap to 12th)`,
          reasonBrief: `Passed 10th (${pYear})`
        };
      }
    }
  }

  // General previous passing year check
  const generalPassStr = cleanStr(
    student.prevPassingYear || student.previousPassingYear ||
    raw.prevPassingYear || raw.previousPassingYear || raw['Previous Passing Year'] ||
    raw['Passing Year'] || raw['Year of Passing'] || raw.passingYear || ''
  );
  if (currYear && generalPassStr) {
    const passMatch = String(generalPassStr).match(/(19\d\d|20\d\d)/);
    if (passMatch) {
      const pYear = parseInt(passMatch[1], 10);
      const expectedDiff = is12th && !pass11thStr ? 2 : 1;
      if (currYear - pYear > expectedDiff) {
        const gap = currYear - pYear - expectedDiff;
        return {
          hasGap: true,
          gapYears: Math.max(1, gap),
          prevSession: String(pYear),
          reason: `Exam gap: Passed in ${pYear} (${Math.max(1, gap)} yr gap)`,
          reasonBrief: `Passed ${pYear}`
        };
      }
    }
  }

  // 3. Old admission number present and differs from current admission number
  const oldAdm = cleanStr(student.oldAdmNo || raw.oldAdmNo || raw['Old Admission No.'] || raw['Old Adm No'] || raw['Old Adm. No.'] || raw['previousAdmNo']);
  const currAdm = cleanStr(student.admNo || raw.admNo || raw['Adm. No.'] || raw['Admission No.']);
  if (oldAdm && currAdm && oldAdm !== currAdm && oldAdm !== '—' && oldAdm !== 'N/A') {
    return {
      hasGap: true,
      gapYears: 1,
      prevSession: 'Historical',
      reason: `Historical admission number mismatch (Prev Adm: ${oldAdm}, Current: ${currAdm})`,
      reasonBrief: `Prev Adm ${oldAdm}`
    };
  }

  // 4. Registration form explicit indication
  const formReAdm = cleanStr(raw['Are you seeking Re-admission?'] || raw.reAdmissionStatus || raw.reAdmissionRequested || '');
  if (formReAdm.toLowerCase() === 'yes' || formReAdm.toLowerCase() === 'pending') {
    return {
      hasGap: true,
      gapYears: 1,
      prevSession: 'Requested',
      reason: 'Re-admission requested in application form',
      reasonBrief: 'Form Request'
    };
  }

  return { hasGap: false, reason: '', reasonBrief: '', gapYears: 0 };
}

// Detect if student has an academic gap (> 1 year academic gap or re-admission)
function hasStudentAcademicGap(student, currentSession = '', prevInfo = null) {
  if (!student) return false;
  // 1. Explicit readmission flag
  if (student.isReadmission === true) return true;
  const raw = student.raw || student;
  const reAdmStr = String(raw.readmission || raw['readmission'] || raw['Re-admission'] || raw['Re-Admission'] || raw.isReadmission || raw['Are you seeking Re-admission?'] || raw.reAdmissionStatus || '').toLowerCase();
  if (reAdmStr === 'yes' || raw.readmission === true || raw.isReadmission === true) return true;

  // 2. Comprehensive gap detection
  return detectStudentAcademicGap(student, currentSession, prevInfo).hasGap;
}

// Student Priority Scoring for Sequential Allotment
// Priority 1: Junior class of tier (11th or 9th) fresh entrants
// Priority 2: Senior class of tier (12th or 10th) Re-admissions with Academic Gap (> 1 yr)
// Priority 3: Regular continuous 12th/10th students (inherit admission number, no sequential advance)
function getStudentAllotmentPriority(student, currentSession = '', prevInfo = null) {
  const cls = cleanStr(student.class || '');
  const is9th = cls.includes('9');
  const is10th = cls.includes('10');
  const is11th = cls.includes('11');
  const is12th = cls.includes('12');

  const hasGap = hasStudentAcademicGap(student, currentSession, prevInfo);

  if (is9th) {
    return {
      tierOrder: 10,
      tierLabel: '🥇 Priority 1: 9th Fresh Entrant',
      priorityBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
      isFresh: true,
      hasGap: false,
      isSeniorReAdm: false
    };
  }
  if (is10th && hasGap) {
    return {
      tierOrder: 20,
      tierLabel: '🥈 Priority 2: 10th Re-Adm (Gap)',
      priorityBadge: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300',
      isFresh: false,
      hasGap: true,
      isSeniorReAdm: true
    };
  }
  if (is11th) {
    return {
      tierOrder: 30,
      tierLabel: '🥇 Priority 1: 11th Fresh Entrant',
      priorityBadge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300',
      isFresh: true,
      hasGap: false,
      isSeniorReAdm: false
    };
  }
  if (is12th && hasGap) {
    return {
      tierOrder: 40,
      tierLabel: '🥈 Priority 2: 12th Re-Adm (Gap)',
      priorityBadge: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-400',
      isFresh: false,
      hasGap: true,
      isSeniorReAdm: true
    };
  }
  if (is10th) {
    return {
      tierOrder: 50,
      tierLabel: '🔄 Regular 10th (Continuous / Inherit)',
      priorityBadge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300',
      isFresh: false,
      hasGap: false,
      isSeniorReAdm: false
    };
  }
  if (is12th) {
    return {
      tierOrder: 60,
      tierLabel: '🔄 Regular 12th (Continuous / Inherit)',
      priorityBadge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300',
      isFresh: false,
      hasGap: false,
      isSeniorReAdm: false
    };
  }
  return {
    tierOrder: 90,
    tierLabel: 'Standard Entrant',
    priorityBadge: 'bg-slate-100 text-slate-600 border-slate-200',
    isFresh: false,
    hasGap: false,
    isSeniorReAdm: false
  };
}

// Scope Admission Number check/audit strictly to:
// 1. Fresh Class 9th students (entry to Secondary tier)
// 2. Fresh Class 11th students (entry to Higher Secondary tier)
// 3. ANY student labelled as Re-admission (or with academic gap) for the session
// Regular continuous 10th and 12th students are excluded from this session's new admission number check/audit
export function isEligibleForSessionAdmNoAudit(student, sessionFilter = '') {
  if (!student) return false;
  const cls = cleanStr(student.class || student.Class || '');
  const is9th = matchesClassVal('9th', cls);
  const is11th = matchesClassVal('11th', cls);
  if (is9th || is11th) return true;

  // 1. Explicit readmission flag on normalized student
  if (student.isReadmission === true) return true;

  // 2. Raw record readmission markers
  const raw = student.raw || student;
  const reAdmStr = String(
    raw.readmission || raw['readmission'] || raw['Re-admission'] || raw['Re-Admission'] ||
    raw.isReadmission || raw['Are you seeking Re-admission?'] || raw.reAdmissionStatus ||
    student.reAdmissionStatus || ''
  ).toLowerCase().trim();
  if (reAdmStr === 'yes' || raw.readmission === true || raw.isReadmission === true) return true;

  // 3. Admission Type field
  const admType = String(raw.admissionType || raw['Admission Type'] || raw.admType || '').toLowerCase();
  if (admType.includes('readmission') || admType.includes('re-admission')) return true;

  // 4. Remarks or status mentioning re-admission
  const remarks = String(student.remarks || raw.remarks || raw.Remarks || '').toLowerCase();
  if (remarks.includes('readmission') || remarks.includes('re-admission')) return true;

  // 5. Academic gap (>1 year)
  if (hasStudentAcademicGap(student, sessionFilter)) return true;

  return false;
}

function AdmissionRegisterSuite({
  students: propStudents,
  allHistory: propAllHistory,
  onClose: propOnClose,
  onDataUpdated,
  onOpenSubjectRolls,
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
  const [taskProgress, setTaskProgress] = useState(null);

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
  const viewModalPanelRef = useRef(null);
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
    setShowFiltersPopover(false);
    setIsLoadingSession(true);
    setTaskProgress({
      title: `Switching to Session ${newSession}`,
      step: 'Preparing registers and student data...',
      progress: 25,
      icon: 'calendar'
    });
    setSelectedSession(newSession);
  }, [selectedSession]);

  const handleResetFilters = useCallback(() => {
    setShowFiltersPopover(false);
    setIsLoadingSession(true);
    setTaskProgress({
      title: 'Resetting Filters',
      step: 'Returning to live 2025-26 approved register...',
      progress: 50,
      icon: 'calendar'
    });
    setSelectedSession('2025-26');
    setSelectedStatus('Approved');
    setSelectedAdmissionType('ALL');
    setSelectedStream('ALL');
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
          const cachedReceipt = parsed.columnWidths.p2_receipt;
          const p2ReceiptWidth = (!cachedReceipt || cachedReceipt >= 130) ? DEFAULT_COLUMN_WIDTHS.p2_receipt : cachedReceipt;
          return {
            ...DEFAULT_COLUMN_WIDTHS,
            ...parsed.columnWidths,
            sno: Math.max(DEFAULT_COLUMN_WIDTHS.sno, parsed.columnWidths.sno || 0),
            p2_sno: Math.max(DEFAULT_COLUMN_WIDTHS.p2_sno, parsed.columnWidths.p2_sno || parsed.columnWidths.sno || 0),
            rollNo: Math.max(DEFAULT_COLUMN_WIDTHS.rollNo, parsed.columnWidths.rollNo || 0),
            class: Math.max(DEFAULT_COLUMN_WIDTHS.class, parsed.columnWidths.class || 0),
            gender: Math.max(DEFAULT_COLUMN_WIDTHS.gender, parsed.columnWidths.gender || 0),
            p2_stream: Math.max(DEFAULT_COLUMN_WIDTHS.p2_stream, parsed.columnWidths.p2_stream || 0),
            p2_cat: Math.max(DEFAULT_COLUMN_WIDTHS.p2_cat, parsed.columnWidths.p2_cat || 0),
            p2_socio: Math.max(DEFAULT_COLUMN_WIDTHS.p2_socio, parsed.columnWidths.p2_socio || 0),
            p2_blood: Math.max(DEFAULT_COLUMN_WIDTHS.p2_blood, parsed.columnWidths.p2_blood || 0),
            p2_account: Math.max(DEFAULT_COLUMN_WIDTHS.p2_account, parsed.columnWidths.p2_account || 0),
            p2_receipt: p2ReceiptWidth,
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
            if (!cleanColWidths.p2_receipt || cleanColWidths.p2_receipt >= 130) {
              cleanColWidths.p2_receipt = DEFAULT_COLUMN_WIDTHS.p2_receipt;
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
        [colKey]: newWidth,
        ...(colKey === 'sno' ? { p2_sno: newWidth } : {}),
        ...(colKey === 'p2_sno' ? { sno: newWidth } : {})
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

    setTaskProgress({
      title: 'Saving Cloud Configuration',
      step: 'Synchronizing table layout, density & subject key to Cloud Firestore...',
      progress: 45,
      icon: 'cloud'
    });

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
        setTaskProgress(null);
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
        setTaskProgress(null);
        setToast({
          message: '💾 Table layout preserved permanently on your browser device!',
          type: 'info'
        });
      }
    } catch (err) {
      console.error('Failed to save layout to Firebase:', err);
      setIsLayoutModified(false);
      setTaskProgress(null);
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
    setTaskProgress({
      title: 'Updating Subject Directory',
      step: `Synchronizing ${updatedList.length} subject abbreviations to Cloud Firestore...`,
      progress: 45,
      icon: 'cloud'
    });

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
        setTaskProgress(null);
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
        setTaskProgress(null);
        setToast({
          message: '💾 Subject abbreviations preserved in browser storage.',
          type: 'info'
        });
      }
    } catch (err) {
      console.error('Failed to save subject abbreviations to cloud:', err);
      setTaskProgress(null);
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
    const duration = toast.type === 'error' ? 3500 : 1600;
    const timer = setTimeout(() => setToast(null), duration);
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
      if (
        viewPopoverRef.current &&
        !viewPopoverRef.current.contains(e.target) &&
        (!viewModalPanelRef.current || !viewModalPanelRef.current.contains(e.target))
      ) {
        setShowViewPopover(false);
      }
      if (sentupColsPopoverRef.current && !sentupColsPopoverRef.current.contains(e.target)) {
        setShowSentupColsPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close View & Layout popup modal on Escape key press
  useEffect(() => {
    if (!showViewPopover) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowViewPopover(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showViewPopover]);

  // Readmission Management Modal State (Universal Candidate Search & Class Mapper)
  const [readmissionModalStudent, setReadmissionModalStudent] = useState(null);
  const [isUniversalModalOpen, setIsUniversalModalOpen] = useState(false);
  const [searchCandidateQuery, setSearchCandidateQuery] = useState('');
  const [candidateClassFilter, setCandidateClassFilter] = useState('All');
  const [candidateOnlyApproved, setCandidateOnlyApproved] = useState(true);
  const [reAdmFormState, setReAdmFormState] = useState({
    isReAdm: true,
    targetSession: '2025-26',
    targetClass: '11th',
    targetStream: 'Science',
    assignedAdmNo: '',
    oldAdmNo: '',
    prevSchoolOrClass: '',
    reason: 'Gap in Studies / Re-enrolled',
    customRemarks: ''
  });
  const [savingReAdm, setSavingReAdm] = useState(false);
  const [showUndoConfirmModal, setShowUndoConfirmModal] = useState(false);
  const [isUndoingReAdm, setIsUndoingReAdm] = useState(false);
  const [shiftSubsequentAdmNos, setShiftSubsequentAdmNos] = useState(true);

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

  // Keep historyDataset in sync with propAllHistory whenever prop hydrates
  useEffect(() => {
    if (Array.isArray(propAllHistory) && propAllHistory.length > 0) {
      setHistoryDataset(propAllHistory);
    }
  }, [propAllHistory]);

  // Eager mount-time whole-collection download removed to prevent quota exhaustion.
  // Historical registers are now loaded strictly on-demand per selected session.

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
    const byRollName = new Map();

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

        const hRoll = cleanStr(h.classRollNo || h['Class Roll No'] || h.rollNo || h.examRoll10th);
        if (hRoll && hN) {
          const rKey = `${hRoll}_${hN}`;
          if (!byRollName.has(rKey)) byRollName.set(rKey, h);
        }
      });
    }

    return { byBoardReg, byAadhar, byFormNo, byAdmNo, byNameFather, byRollName };
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

    const registerCandidate = (key, data) => {
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, data);
      } else {
        const existing = map.get(key);
        map.set(key, {
          ...existing,
          ...data,
          rollNo: data.rollNo || existing.rollNo,
          admNo: data.admNo || existing.admNo,
          oldAdmNo: data.oldAdmNo || existing.oldAdmNo,
          boardReg: data.boardReg || existing.boardReg,
          class: data.class || existing.class,
          isApproved: data.isApproved !== undefined ? data.isApproved : existing.isApproved
        });
      }
    };

    // 1. Current dataset (admissions)
    (dataset || []).forEach((s, idx) => {
      const fNo = cleanStr(s.formNo || s['Form Number'] || s['Form No.'] || s.FormNo);
      const bReg = cleanStr(s.boardRegNo || s['Board Registration Number'] || s.boardReg || s['Board Reg. No.']);
      const id = cleanStr(s.id || s.docId || fNo || `adm_${idx}`);
      const isApproved = Boolean(
        hasAssignedClassRollNumber(s) ||
        (s.classRollNo && s.classRollNo !== '—' && s.classRollNo !== '-') ||
        (s.rollNo && s.rollNo !== '—' && s.rollNo !== '-') ||
        s.status === 'Approved'
      );
      const entry = {
        raw: s,
        id,
        formNo: fNo,
        name: cleanStr(s.studentName || s["Student's Name (as per school records)"] || s['Student Name'] || s.name),
        father: cleanStr(s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || s.father),
        class: cleanStr(s.class || s.Class || s['Admission sought for class'] || '11th'),
        session: cleanStr(s.session || s.Session || s['Academic Session'] || selectedSession),
        stream: cleanStr(s.stream || s.Stream || 'General'),
        rollNo: cleanStr(s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo || s.roll_no),
        admNo: cleanStr(s.admNo || s['Adm. No.'] || s['Admission No.'] || s.admissionNumber),
        oldAdmNo: cleanStr(s['Old Admission No.'] || s['Old Adm. No.'] || s.oldAdmNo || s['old_adm_no']),
        boardReg: bReg,
        dob: cleanStr(s.dob || s['DoB (as per school records)'] || s['Date of Birth']),
        mobile: cleanStr(s.mobile || s['Mobile No. (with working WhatsApp)'] || s['Student Mobile']),
        isReadmission: String(s.readmission || s['Re-admission'] || s.isReadmission || '').toLowerCase() === 'yes' || s.readmission === true || s.isReadmission === true,
        isApproved
      };
      registerCandidate(id, entry);
      if (fNo) registerCandidate(`form_${fNo}`, entry);
      if (bReg) registerCandidate(`reg_${bReg}`, entry);
    });

    // 2. Master registers history (with accurate class resolution)
    (historyDataset || []).forEach(h => {
      const pSess = cleanStr(h.session || h.Session || h['Academic Session'] || '');
      const pClass = cleanStr(h.targetClass || h.class || h.Class || h.className || (h.id?.includes('12') ? '12th' : h.id?.includes('11') ? '11th' : h.id?.includes('9') ? '9th' : '10th'));
      const chunk = h.items || h.students || h.records || h.data;
      if (Array.isArray(chunk)) {
        chunk.forEach((item, i) => {
          const fNo = cleanStr(item.formNo || item['Form Number'] || item['Form No.'] || item.FormNo);
          const bReg = cleanStr(item.boardRegNo || item['Board Registration Number'] || item.boardReg);
          const id = cleanStr(item.id || fNo || `${h.id}_${i}`);
          const itemCls = cleanStr(item.class || item.Class || item['Admission sought for class'] || item.className || pClass || '10th');
          const isApproved = Boolean(
            (item.classRollNo && item.classRollNo !== '—' && item.classRollNo !== '-') ||
            (item.rollNo && item.rollNo !== '—' && item.rollNo !== '-') ||
            item.status === 'Approved'
          );
          const entry = {
            raw: item,
            id,
            formNo: fNo,
            name: cleanStr(item.studentName || item["Student's Name (as per school records)"] || item['Student Name'] || item.name),
            father: cleanStr(item.fatherName || item["Father's/Guardian's Name (as per school records)"] || item["Father's Name"] || item.father),
            class: itemCls,
            session: cleanStr(item.session || item.Session || pSess || 'Past Session'),
            stream: cleanStr(item.stream || item.Stream || 'General'),
            rollNo: cleanStr(item.classRollNo || item['Class Roll No'] || item.rollNo || item.RollNo),
            admNo: cleanStr(item.admNo || item['Adm. No.'] || item['Admission No.']),
            oldAdmNo: cleanStr(item['Old Admission No.'] || item.oldAdmNo),
            boardReg: bReg,
            dob: cleanStr(item.dob || item['Date of Birth']),
            mobile: cleanStr(item.mobile || item['Mobile No.']),
            isReadmission: String(item.readmission || item['Re-admission'] || item.isReadmission || '').toLowerCase() === 'yes' || item.readmission === true,
            isApproved
          };
          registerCandidate(id, entry);
          if (fNo) registerCandidate(`form_${fNo}`, entry);
          if (bReg) registerCandidate(`reg_${bReg}`, entry);
        });
      }
    });

    // 3. Authoritative Verified Students Catalog (encompassing 12th, 11th, 10th, 9th)
    (verifiedCatalog || []).forEach((c, idx) => {
      const fNo = cleanStr(c.fNo || c.formNo || c['Form Number']);
      const bReg = cleanStr(c.boardRegNo || c.boardReg);
      const id = fNo ? `form_${fNo}` : (bReg ? `reg_${bReg}` : `cat_${idx}`);
      const isApproved = Boolean(c.classRollNo && c.classRollNo !== '—' && c.classRollNo !== '-');
      const entry = {
        raw: c,
        id: c.id || id,
        formNo: fNo,
        name: cleanStr(c.name || c.studentName),
        father: cleanStr(c.fatherName || c.father),
        class: cleanStr(c.className || c.class || '12th'),
        session: cleanStr(c.session || '2025-26'),
        stream: cleanStr(c.stream || 'General'),
        rollNo: cleanStr(c.classRollNo || c.rollNo),
        admNo: cleanStr(c.admNo || ''),
        oldAdmNo: '',
        boardReg: bReg,
        dob: cleanStr(c.dob || ''),
        mobile: cleanStr(c.mobile || ''),
        isReadmission: false,
        isApproved
      };
      if (fNo && !map.has(`form_${fNo}`)) registerCandidate(`form_${fNo}`, entry);
      else if (bReg && !map.has(`reg_${bReg}`)) registerCandidate(`reg_${bReg}`, entry);
      else if (!fNo && !bReg) registerCandidate(id, entry);
    });

    // Deduplicate unique students by natural identifier
    const uniqueStudents = [];
    const seenNatural = new Set();
    for (const st of map.values()) {
      const natKey = st.formNo ? `f_${st.formNo}` : (st.boardReg ? `r_${st.boardReg}` : `id_${st.id}`);
      if (!seenNatural.has(natKey)) {
        seenNatural.add(natKey);
        uniqueStudents.push(st);
      }
    }

    return uniqueStudents;
  }, [dataset, historyDataset, selectedSession]);

  // Real-time Class Distribution Counts for Quick Filters
  const candidateClassCounts = useMemo(() => {
    const counts = { 'All': 0, '12th': 0, '11th': 0, '10th': 0, '9th': 0 };
    (allAvailableDatabaseStudents || []).forEach(s => {
      if (candidateOnlyApproved && !s.isApproved) return;
      counts['All'] = (counts['All'] || 0) + 1;
      const c = cleanStr(s.class).toLowerCase();
      if (c.includes('12')) counts['12th'] = (counts['12th'] || 0) + 1;
      else if (c.includes('11')) counts['11th'] = (counts['11th'] || 0) + 1;
      else if (c.includes('10')) counts['10th'] = (counts['10th'] || 0) + 1;
      else if (c.includes('9')) counts['9th'] = (counts['9th'] || 0) + 1;
    });
    return counts;
  }, [allAvailableDatabaseStudents, candidateOnlyApproved]);

  // Candidates Search Results
  const candidateSearchResults = useMemo(() => {
    let list = allAvailableDatabaseStudents;

    if (candidateOnlyApproved) {
      list = list.filter(s => s.isApproved);
    }

    if (candidateClassFilter !== 'All') {
      list = list.filter(s => {
        const cls = cleanStr(s.class).toLowerCase();
        const target = candidateClassFilter.toLowerCase();
        return cls.includes(target);
      });
    }

    if (!searchCandidateQuery.trim()) {
      return list.slice(0, 50);
    }

    const q = searchCandidateQuery.toLowerCase().trim();
    const rawTokens = q.split(/\s+/).filter(Boolean);

    // Phonetic & transliteration normalizer for Kashmiri / Indian names
    // Handles w <-> v (Sarwat <-> Sarvat), mohd <-> moham, shk <-> sheikh,
    // diphthongs (aie/aye/ie/ei/ai/ay/ey -> i), ee -> i, oo/ou -> u, q <-> k, ph <-> f
    const toPhonetic = (str) => (str || '')
      .toLowerCase()
      .replace(/\bmohd\b|\bmd\b/g, 'moham')
      .replace(/\bshk\b/g, 'sheikh')
      .replace(/w/g, 'v')
      .replace(/ph/g, 'f')
      .replace(/q/g, 'k')
      .replace(/aie|aye|ie|ei|ai|ay|ey/g, 'i')
      .replace(/ee/g, 'i')
      .replace(/oo|ou/g, 'u')
      .replace(/y/g, 'i')
      .replace(/(.)\1+/g, (m, c) => c);

    return list.filter(s => {
      const name = (s.name || '').toLowerCase();
      const father = (s.father || '').toLowerCase();
      const formNo = (s.formNo || '').toLowerCase();
      const rollNo = (s.rollNo || '').toLowerCase();
      const admNo = (s.admNo || '').toLowerCase();
      const oldAdmNo = (s.oldAdmNo || '').toLowerCase();
      const boardReg = (s.boardReg || '').toLowerCase();
      const cls = (s.class || '').toLowerCase();

      const namePhonetic = toPhonetic(name);
      const fatherPhonetic = toPhonetic(father);

      return rawTokens.every(tok => {
        // 1. Literal match in any field
        if (
          name.includes(tok) ||
          father.includes(tok) ||
          formNo.includes(tok) ||
          rollNo.includes(tok) ||
          admNo.includes(tok) ||
          oldAdmNo.includes(tok) ||
          boardReg.includes(tok) ||
          cls.includes(tok)
        ) {
          return true;
        }

        // 2. Phonetic normalized match in name or father
        const pTok = toPhonetic(tok);
        if (pTok && (namePhonetic.includes(pTok) || fatherPhonetic.includes(pTok))) {
          return true;
        }

        return false;
      });
    }).slice(0, 50);
  }, [allAvailableDatabaseStudents, searchCandidateQuery, candidateClassFilter, candidateOnlyApproved]);

  // 1. DYNAMICALLY FETCH ALL SESSIONS AVAILABLE IN DATABASE
  const [availableSessions, setAvailableSessions] = useState(['2025-26', '2024-25', '2023-24', '2022-23']);

  useEffect(() => {
    let active = true;
    const sessionsFound = new Set(['2025-26', '2024-25', '2023-24', '2022-23']);
    getDocs(collection(db, 'academicSessions'))
      .then(snap => {
        if (!active) return;
        snap.docs.forEach(d => {
          const sessName = cleanStr(d.data()?.name || d.data()?.session || d.id);
          if (sessName) sessionsFound.add(sessName);
        });
        setAvailableSessions(Array.from(sessionsFound).sort().reverse());
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // 2. ON-DEMAND SESSION DATA FETCHER (Loads particular session dynamically from DB)
  useEffect(() => {
    if (!selectedSession) return;

    // Dashboard data hydrates progressively (first page, then the complete collection).
    // Always let the newest current-session prop replace an older session cache snapshot.
    if ((selectedSession === '2025-26' || isSessionMatching('2025-26', selectedSession)) && Array.isArray(propStudents) && propStudents.length > 0) {
      sessionCacheRef.current[selectedSession] = propStudents;
      setDataset(propStudents);
      setIsLoadingSession(false);
      setTaskProgress(null);
      return;
    }

    if (sessionCacheRef.current[selectedSession]) {
      const cached = sessionCacheRef.current[selectedSession];
      setTaskProgress({
        title: `Session ${selectedSession}`,
        step: `Loaded from cache (${cached.length} students)`,
        progress: 100,
        status: 'success',
        icon: 'calendar'
      });
      setDataset(cached);
      setIsLoadingSession(false);
      setTimeout(() => setTaskProgress(null), 700);
      return;
    }

    let isCancelled = false;
    setIsLoadingSession(true);

    const loadSessionData = async () => {
      try {
        setTaskProgress({
          title: `Loading Session ${selectedSession}`,
          step: 'Querying admissions & historical registers...',
          progress: 35,
          icon: 'calendar'
        });

        // Yield to allow the browser to paint the progress bar modal
        await new Promise(r => setTimeout(r, 40));

        let loadedRecords = [];

        // 1. Check admissions collection (live & cached)
        const allAdmissions = await getCachedCollection('admissions');
        if (Array.isArray(allAdmissions) && allAdmissions.length > 0) {
          if (!isCancelled) setAllAdmissionsPool(allAdmissions);
          const matched = allAdmissions.filter(d => {
            if (!d) return false;
            const sSess = cleanStr(d.session || d.Session || d['Academic Session'] || '');
            return isSessionMatching(sSess, selectedSession);
          });
          if (matched.length > 0) {
            loadedRecords = matched;
          }
        }

        // 2. If not found in admissions, check masterRegisters collection
        if (loadedRecords.length === 0) {
          setTaskProgress(prev => ({
            ...(prev || {}),
            step: 'Checking master registers archive...',
            progress: 60
          }));
          await new Promise(r => setTimeout(r, 20));

          // Strictly scoped on-demand query by selectedSession (~80 reads instead of 6,020!)
          const masterList = await getMasterRegistersByScope({ session: selectedSession });
          const flat = [];
          (masterList || []).forEach(docItem => {
            if (!docItem) return;
            const chunk = docItem.items || docItem.students || docItem.records || docItem.data;
            const pSess = cleanStr(docItem.session || docItem.Session || docItem['Academic Session'] || '');
            if (Array.isArray(chunk)) {
              chunk.forEach((item, i) => {
                const iSess = cleanStr(item.session || item.Session || item['Academic Session'] || pSess);
                if (isSessionMatching(iSess, selectedSession)) {
                  flat.push({
                    ...item,
                    id: item.id || item['Form Number'] || `${docItem.id}_${i}`,
                    session: iSess,
                    Session: iSess
                  });
                }
              });
            } else if (isSessionMatching(pSess, selectedSession)) {
              flat.push({ ...docItem, session: pSess, Session: pSess });
            }
          });
          loadedRecords = flat;
        }

        // 3. Fallback direct Firestore fetch if cache was empty
        if (loadedRecords.length === 0) {
          setTaskProgress(prev => ({
            ...(prev || {}),
            step: 'Querying Firestore admissions database...',
            progress: 80
          }));
          await new Promise(r => setTimeout(r, 20));

          const admSnap = await getDocs(collection(db, 'admissions'));
          if (!admSnap.empty) {
            const rawDocs = admSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            loadedRecords = rawDocs.filter(d => {
              const sSess = cleanStr(d.session || d.Session || d['Academic Session'] || '');
              return isSessionMatching(sSess, selectedSession);
            });
          }
        }

        // 4. Purge historical orphan ghost documents from Firestore where 'form_XXXX' exists alongside 'XXXX'
        if (loadedRecords.length > 0) {
          const formDocMap = new Map();
          loadedRecords.forEach(d => {
            if (!d?.id) return;
            const fNo = cleanStr(d.formNo || d['Form Number'] || d['Form No.'] || d.FormNo);
            if (fNo && /^\d{4,}$/.test(fNo)) {
              if (!formDocMap.has(fNo)) formDocMap.set(fNo, []);
              formDocMap.get(fNo).push(d.id);
            }
          });
          formDocMap.forEach((ids, fNo) => {
            if (ids.length > 1) {
              const orphanId = ids.find(id => id === `form_${fNo}`);
              const realId = ids.find(id => id !== `form_${fNo}`);
              if (orphanId && realId) {
                // Delete orphan ghost document from Firestore in background
                deleteDoc(doc(db, 'admissions', orphanId)).catch(() => {});
              }
            }
          });
        }

        if (!isCancelled) {
          sessionCacheRef.current[selectedSession] = loadedRecords;
          setDataset(loadedRecords);

          setTaskProgress({
            title: `Session ${selectedSession} Ready`,
            step: `Successfully loaded ${loadedRecords.length} student records`,
            progress: 100,
            status: 'success',
            icon: 'calendar'
          });
          setTimeout(() => {
            if (!isCancelled) setTaskProgress(null);
          }, 800);
        }
      } catch (err) {
        console.error(`Error loading session ${selectedSession}:`, err);
        if (!isCancelled) {
          setTaskProgress(null);
          setToast({ message: `Failed to load session ${selectedSession}`, type: 'error' });
        }
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

      // Authoritative Class 12th Re-admission Matcher (Session 2025-26)
      const is12thClass = matchesClassVal('12th', cls);
      const is2025Session = isSameAcademicSession('2025-26', sess || selectedSession);
      const matchedRosterEntry = (is2025Session && is12thClass)
        ? VERIFIED_CLASS12_READMISSION_ROSTER.find(r => {
            if (formNo && r.form && cleanStr(formNo) === cleanStr(r.form)) return true;
            const cleanReg = normalizeBoardRegKey(boardReg);
            if (cleanReg && r.reg && (cleanReg === r.reg || cleanReg === normalizeBoardRegKey(r.reg))) return true;
            if (rollNo && r.roll && String(rollNo).trim() === String(r.roll).trim()) return true;
            return false;
          })
        : null;

      // Re-admission Identification
      const isReadmission =
        Boolean(matchedRosterEntry) ||
        String(s.readmission || s['readmission'] || s['Re-admission'] || s['Re-Admission'] || s.isReadmission || s['Are you seeking Re-admission?'] || s.reAdmissionStatus || '').toLowerCase() === 'yes' ||
        s.readmission === true ||
        s.isReadmission === true;

      const oldAdmNo = cleanStr(s['Old Admission No.'] || s['Old Adm. No.'] || s.oldAdmNo || s['old_adm_no'] || s['Previous Adm. No.'] || s['Prev Adm No'] || matchedRosterEntry?.oldAdm);

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
        if (!histMatch && prevRoll && name && historyLookups?.byRollName) {
          const normName = name.toLowerCase().replace(/[^a-z]/g, '');
          histMatch = historyLookups.byRollName.get(`${prevRoll}_${normName}`);
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
      if (matchedRosterEntry?.admNo) {
        finalAdmNumber = matchedRosterEntry.admNo;
      }
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

      // Priority D: Master Historical Registers Lookup Dataset (O(1) verified 4,114+ records)
      if (!finalAdmNumber && historicalAdmLookup) {
        let histAdm = null;
        const cleanReg = normalizeBoardRegKey(boardReg);
        if (cleanReg && historicalAdmLookup.byBoardReg?.[cleanReg]) {
          histAdm = historicalAdmLookup.byBoardReg[cleanReg];
        } else if (boardReg && historicalAdmLookup.byBoardReg?.[boardReg]) {
          histAdm = historicalAdmLookup.byBoardReg[boardReg];
        }
        if (!histAdm && formNo && historicalAdmLookup.byFormNo?.[formNo]) {
          histAdm = historicalAdmLookup.byFormNo[formNo];
        }
        if (!histAdm && name && father) {
          const normN = name.toLowerCase().replace(/[^a-z]/g, '');
          const normF = father.toLowerCase().replace(/[^a-z]/g, '');
          if (normN.length >= 3 && normF.length >= 4) {
            histAdm = historicalAdmLookup.byNameFather?.[`${normN}_${normF}`];
          }
        }
        if (histAdm && histAdm !== '—' && histAdm !== 'N/A') {
          finalAdmNumber = histAdm;
          inheritedFields.add('admNo');
          if (!inheritedSource) {
            inheritedSource = {
              class: '11th',
              session: 'Previous Session',
              fields: ['admNo']
            };
          }
        }
      }

      // Priority E: histMatch record admission number
      if (!finalAdmNumber && histMatch) {
        const hAdm = cleanStr(histMatch.admNo || histMatch['Adm. No.'] || histMatch['Admission No.'] || histMatch['Admission Number']);
        if (hAdm && hAdm !== '—' && hAdm !== 'N/A') {
          finalAdmNumber = hAdm;
          inheritedFields.add('admNo');
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

      // Automatic fallback for old admission number on Re-admission candidates
      let finalOldAdmNo = oldAdmNo;
      if (matchedRosterEntry?.oldAdm) {
        finalOldAdmNo = matchedRosterEntry.oldAdm;
      } else if (!finalOldAdmNo && isReadmission) {
        if (histMatch) {
          finalOldAdmNo = cleanStr(histMatch.admNo || histMatch['Adm. No.'] || histMatch['Admission No.'] || histMatch.admissionNo);
        }
        if (!finalOldAdmNo && historicalAdmLookup) {
          const cleanReg = normalizeBoardRegKey(boardReg);
          if (cleanReg && historicalAdmLookup.byBoardReg?.[cleanReg]) {
            finalOldAdmNo = historicalAdmLookup.byBoardReg[cleanReg];
          } else if (boardReg && historicalAdmLookup.byBoardReg?.[boardReg]) {
            finalOldAdmNo = historicalAdmLookup.byBoardReg[boardReg];
          }
          if (!finalOldAdmNo && formNo && historicalAdmLookup.byFormNo?.[formNo]) {
            finalOldAdmNo = historicalAdmLookup.byFormNo[formNo];
          }
          if (!finalOldAdmNo && name && father) {
            const normN = name.toLowerCase().replace(/[^a-z]/g, '');
            const normF = father.toLowerCase().replace(/[^a-z]/g, '');
            if (normN.length >= 3 && normF.length >= 4) {
              finalOldAdmNo = historicalAdmLookup.byNameFather?.[`${normN}_${normF}`];
            }
          }
        }
      }

      let finalResolvedAdmNo = finalAdmNumber;
      if (matchedRosterEntry?.admNo) {
        // Authoritative sequential assignment for Class 12th Re-admissions (5476–5513)
        finalResolvedAdmNo = matchedRosterEntry.admNo;
        finalOldAdmNo = matchedRosterEntry.oldAdm || (oldAdmNo && oldAdmNo !== matchedRosterEntry.admNo ? oldAdmNo : '') || '';
      } else if (!finalResolvedAdmNo && areClassTiersCompatible(cls, histMatch?.class)) {
        finalResolvedAdmNo = firstCleanValue(histMatch, ADMISSION_NO_KEYS);
      }
      const finalAdmNo = finalResolvedAdmNo || '';
      if (!finalOldAdmNo && matchedRosterEntry?.oldAdm) {
        finalOldAdmNo = matchedRosterEntry.oldAdm;
      }
      const cleanOldAdm = finalOldAdmNo ? String(finalOldAdmNo).replace(/^\(|\)$/g, '').trim() : '';
      const displayAdmNo = (isReadmission && cleanOldAdm && cleanOldAdm !== finalAdmNo)
        ? `${finalAdmNo || '—'} (${cleanOldAdm})`
        : (finalAdmNo || cleanOldAdm || '—');
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
      const finalAdmDate = admDate || formatRegisterDate(firstRawValue(histMatch, ADMISSION_DATE_KEYS));

      list.push({
        raw: s,
        id: docId,
        sno: list.length + 1,
        formNo,
        admNo: finalAdmNo,
        oldAdmNo: finalOldAdmNo,
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
        withdrawal: '',
        issuedCC: finalIssuedCC,
        receipt: finalReceipt,
        remarks: isReadmission
          ? (cleanStr(s.remarks || s.Remarks) && (s.remarks || s.Remarks).includes('Gap case') && (s.remarks || s.Remarks).includes('Prev Adm')
              ? formatCompactRemark(cleanStr(s.remarks || s.Remarks))
              : buildClass12ReadmissionRemark(cls, finalOldAdmNo))
          : formatCompactRemark(cleanStr(s.remarks || s.Remarks || s['Remarks/Feedback (if any)'] || '')),
        inheritedSource,
        hasInheritedData: inheritedFields.size > 0
      });
    });

    // Uniquely identify each student row by: Board Reg No - Session - Class (and Form No - Session - Class)
    const uniqueStudents = [];
    const entityIndex = new Map(); // composite key -> index in uniqueStudents

    const getCleanClassNorm = (cls) => {
      const c = String(cls || '').toLowerCase().replace(/class/gi, '').trim();
      if (c.includes('12')) return '12th';
      if (c.includes('11')) return '11th';
      if (c.includes('10')) return '10th';
      if (c.includes('9')) return '9th';
      return c || '11th';
    };

    const getCleanSessionNorm = (sess) => {
      return normalizeSessionKey(sess || selectedSession || '2025-26');
    };

    list.forEach(st => {
      const cleanCls = getCleanClassNorm(st.class);
      const cleanSess = getCleanSessionNorm(st.session);

      // 1. Board Registration No - Session - Class (authoritative JKBOSE student row identifier)
      const cleanReg = cleanStr(st.boardReg).replace(/[^a-zA-Z0-9]/g, '');
      const isPlaceholderReg = !cleanReg ||
        /^0+$/.test(cleanReg) ||
        /^(pending|na|applied|none|null|underprocess|awaited)$/i.test(cleanReg);
      const isValidBoardReg = cleanReg.length >= 6 && !isPlaceholderReg;
      const regKey = isValidBoardReg ? `reg_${cleanReg}_${cleanSess}_${cleanCls}` : null;

      // 2. Form No - Session - Class (for fresh applicants without board reg)
      const cleanForm = cleanStr(st.formNo);
      const isValidFormNo = /^\d{4,}$/.test(cleanForm);
      const formKey = isValidFormNo ? `form_${cleanForm}_${cleanSess}_${cleanCls}` : null;

      // 3. Ghost Document ID duplicate (e.g. form_250199 created alongside 250199)
      const cleanId = cleanStr(st.id || '');
      const baseId = cleanId.replace(/^form_/, '');
      const ghostIdKey = (baseId && !baseId.startsWith('adm_')) ? `id_${baseId}_${cleanSess}_${cleanCls}` : null;

      let targetIdx = -1;
      if (regKey && entityIndex.has(regKey)) targetIdx = entityIndex.get(regKey);
      else if (formKey && entityIndex.has(formKey)) targetIdx = entityIndex.get(formKey);
      else if (ghostIdKey && entityIndex.has(ghostIdKey)) targetIdx = entityIndex.get(ghostIdKey);

      if (targetIdx !== -1) {
        // Same student row found! Merge and enrich in-place
        const existing = uniqueStudents[targetIdx];
        const isRe = Boolean(existing.isReadmission || st.isReadmission);
        const reRecord = st.isReadmission ? st : (existing.isReadmission ? existing : null);
        const nonReRecord = !st.isReadmission ? st : (!existing.isReadmission ? existing : null);

        let assignedAdm = reRecord?.admNo || existing.admNo || st.admNo || '';
        let oldAdm = reRecord?.oldAdmNo || '';
        if (!oldAdm && isRe) {
          if (nonReRecord?.admNo && nonReRecord.admNo !== assignedAdm) {
            oldAdm = nonReRecord.admNo;
          }
        }

        // PRESERVE AUTHENTIC ASSIGNED ROLL NUMBER AND AUTHORITATIVE FORM NUMBER:
        const existingHasRoll = Boolean(existing.rollNo && existing.rollNo !== '—' && existing.rollNo !== 'NA' && cleanStr(existing.rollNo) !== '');
        const incomingHasRoll = Boolean(st.rollNo && st.rollNo !== '—' && st.rollNo !== 'NA' && cleanStr(st.rollNo) !== '');
        const assignedRollNo = incomingHasRoll ? st.rollNo : (existingHasRoll ? existing.rollNo : '');
        const authoritativeFormNo = (incomingHasRoll || !existingHasRoll) ? (st.formNo || existing.formNo) : existing.formNo;

        const merged = {
          ...existing,
          ...st,
          ...(reRecord ? reRecord : {}),
          name: st.name || existing.name || '',
          father: st.father || existing.father || '',
          mother: st.mother || existing.mother || '',
          dob: st.dob || existing.dob || '',
          gender: st.gender || existing.gender || '',
          class: st.class || existing.class || '',
          session: st.session || existing.session || '',
          isReadmission: isRe,
          admNo: assignedAdm,
          oldAdmNo: oldAdm,
          rollNo: assignedRollNo,
          formNo: authoritativeFormNo,
          status: (assignedRollNo || existing.status === 'Approved' || st.status === 'Approved') ? 'Approved' : (st.status || existing.status || 'Submitted'),
          stream: (st.stream && st.stream !== '—') ? st.stream : (existing.stream || '—'),
          subs: (st.subs && st.subs.length > 0) ? st.subs : (existing.subs || []),
          directPhoto: st.directPhoto || existing.directPhoto || '',
          boardReg: st.boardReg || existing.boardReg || '',
          mobile: st.mobile || existing.mobile || '',
          parentMobile: st.parentMobile || existing.parentMobile || '',
          village: st.village || existing.village || '',
          block: st.block || existing.block || '',
          tehsil: st.tehsil || existing.tehsil || '',
          district: st.district || existing.district || '',
          pen: st.pen || existing.pen || '',
          aadhar: st.aadhar || existing.aadhar || '',
          category: st.category || existing.category || '',
          blood: st.blood || existing.blood || '',
          account: st.account || existing.account || '',
          ifsc: st.ifsc || existing.ifsc || '',
          remarks: reRecord?.remarks || st.remarks || existing.remarks || ''
        };

        uniqueStudents[targetIdx] = merged;

        // Register all keys for this student row
        if (regKey) entityIndex.set(regKey, targetIdx);
        if (formKey) entityIndex.set(formKey, targetIdx);
        if (ghostIdKey) entityIndex.set(ghostIdKey, targetIdx);
      } else {
        const newIdx = uniqueStudents.length;
        uniqueStudents.push({ ...st });
        if (regKey) entityIndex.set(regKey, newIdx);
        if (formKey) entityIndex.set(formKey, newIdx);
        if (ghostIdKey) entityIndex.set(ghostIdKey, newIdx);
      }
    });

    return uniqueStudents.map((st, i) => ({ ...st, sno: i + 1 }));
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
    let totalInScope = 0;
    normalizedStudents.forEach(s => {
      if (selectedClass !== 'ALL' && !isStudentIncludedInClassScope(selectedClass, s.class, s.isReadmission)) return;
      totalInScope++;
      const hasRollNo = Boolean(s.rollNo && s.rollNo !== '—' && s.rollNo !== 'NA' && s.rollNo !== 'N/A' && cleanStr(s.rollNo) !== '');
      if (s.status === 'Approved' || hasRollNo) approved++;
      else if (s.status === 'Submitted') submitted++;
      else if (s.status === 'Provisional') provisional++;
      if (s.isReadmission) readmissions++;
      else fresh++;
    });
    return { approved, submitted, provisional, readmissions, fresh, total: totalInScope };
  }, [normalizedStudents, selectedClass]);

  // Filtered Students for Current View with Readmission Sorting Rule (Re-admissions placed at end of class register)
  const filteredStudents = useMemo(() => {
    const rawFiltered = normalizedStudents.filter(s => {
      // 1. Status Filter: By default, shows students who have been assigned a class roll number OR are approved
      if (selectedStatus !== 'ALL') {
        const hasRollNo = Boolean(s.rollNo && s.rollNo !== '—' && s.rollNo !== 'NA' && s.rollNo !== 'N/A' && cleanStr(s.rollNo) !== '');
        if (selectedStatus === 'Approved') {
          if (s.status !== 'Approved' && !hasRollNo) return false;
        } else if (selectedStatus === 'Submitted') {
          if (s.status !== 'Submitted' || hasRollNo) return false;
        } else if (selectedStatus === 'Provisional') {
          if (s.status !== 'Provisional' || hasRollNo) return false;
        } else if (s.status !== selectedStatus) {
          return false;
        }
      }

      // 2. Admission Type Filter (Fresh vs Re-admission)
      if (selectedAdmissionType === 'fresh' && s.isReadmission) return false;
      if (selectedAdmissionType === 'readmission' && !s.isReadmission) return false;

      // 3. Class Filter (Supports combined classes e.g. 11th & 12th showing all 11th, but ONLY 12th re-admissions)
      if (selectedClass !== 'ALL') {
        if (!isStudentIncludedInClassScope(selectedClass, s.class, s.isReadmission)) return false;
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

      // Class Roll No sorted numerically (Default Order)
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

      // Fallback 1: Admission No numerically
      const admA = parseInt(String(a.admNo || '').replace(/\D/g, ''), 10);
      const admB = parseInt(String(b.admNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(admA) && !isNaN(admB) && admA > 0 && admB > 0 && admA !== admB) {
        return admA - admB;
      }

      // Fallback 2: Fresh First (0), Re-admission (1)
      // Note: For Class 11th/9th students, keep location intact! Only push senior class (12th/10th) re-admissions to the end
      const isJuniorTierA = String(a.class || '').includes('11') || String(a.class || '').includes('9');
      const isJuniorTierB = String(b.class || '').includes('11') || String(b.class || '').includes('9');
      if (!isJuniorTierA || !isJuniorTierB) {
        const isReA = a.isReadmission ? 1 : 0;
        const isReB = b.isReadmission ? 1 : 0;
        if (isReA !== isReB) return isReA - isReB;
      }

      return (a.name || '').localeCompare(b.name || '');
    });

    // Re-index continuous S.No.
    return sorted.map((st, i) => ({ ...st, sno: i + 1 }));
  }, [normalizedStudents, selectedStatus, selectedAdmissionType, selectedClass, selectedStream, searchQuery, sortConfig, activeTab, selectedSession, isAprBianSession]);

  // ASYNC PHOTO FETCHING FOR VISIBLE FILTERED STUDENTS (HIGH-SPEED ON-DEMAND BATCHING)
  useEffect(() => {
    if (!filteredStudents || filteredStudents.length === 0) return;
    let isMounted = true;

    const winMap = typeof window !== 'undefined' ? window._hss_central_photo_map || {} : {};
    const toFetch = filteredStudents.filter(st => {
      const existing = (st.boardReg && isValidPhotoKey(st.boardReg) && (photosMap[st.boardReg] || winMap[st.boardReg])) ||
        (st.formNo && isValidPhotoKey(st.formNo) && (photosMap[st.formNo] || winMap[st.formNo])) ||
        (st.id && isValidPhotoKey(st.id) && (photosMap[st.id] || winMap[st.id])) ||
        st.directPhoto;
      return !existing || existing === '/logo.png';
    });

    if (toFetch.length === 0) return;

    const chunkArray = (arr, size) => {
      const res = [];
      for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
      return res;
    };

    const batches = chunkArray(toFetch, 25);

    (async () => {
      for (const batch of batches) {
        if (!isMounted) break;
        const results = await Promise.allSettled(
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
            results.forEach(res => {
              if (res.status === 'fulfilled' && res.value && res.value.url) {
                const r = res.value;
                if (r.id && isValidPhotoKey(r.id)) next[r.id] = r.url;
                if (r.formNo && isValidPhotoKey(r.formNo)) next[r.formNo] = r.url;
                if (r.boardReg && isValidPhotoKey(r.boardReg)) next[r.boardReg] = r.url;
                if (typeof window !== 'undefined') {
                  if (!window._hss_central_photo_map) window._hss_central_photo_map = {};
                  if (r.id) window._hss_central_photo_map[r.id] = r.url;
                  if (r.formNo) window._hss_central_photo_map[r.formNo] = r.url;
                  if (r.boardReg) window._hss_central_photo_map[r.boardReg] = r.url;
                }
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
    if (!s) return '';
    const winMap = typeof window !== 'undefined' ? window._hss_central_photo_map : null;
    return (
      (s.boardReg && isValidPhotoKey(s.boardReg) && (photosMap[s.boardReg] || (winMap && winMap[s.boardReg]))) ||
      (s.formNo && isValidPhotoKey(s.formNo) && (photosMap[s.formNo] || (winMap && winMap[s.formNo]))) ||
      (s.id && isValidPhotoKey(s.id) && (photosMap[s.id] || (winMap && winMap[s.id]))) ||
      s.directPhoto ||
      getStudentPhotoUrl(s.raw || s, '') ||
      ''
    );
  };

  const handleCleanPrint = async () => {
    if (isPreparingPrint) return;
    setIsPreparingPrint(true);
    setTaskProgress({
      title: 'Preparing Official Print Layout',
      step: 'Scanning candidate records & photo cache...',
      progress: 10,
      icon: 'print'
    });

    try {
      // Resolve only the current filtered register, with bounded request concurrency.
      const missingPhotos = filteredStudents.filter(st => !getResolvedStudentPhoto(st));
      const resolvedPhotos = {};
      const totalToFetch = missingPhotos.length;

      if (totalToFetch > 0) {
        const batchSize = 20;
        for (let i = 0; i < totalToFetch; i += batchSize) {
          const batch = missingPhotos.slice(i, i + batchSize);
          const currentCount = Math.min(totalToFetch, i + batch.length);
          setTaskProgress({
            title: 'Preparing Official Print Layout',
            step: `Resolving candidate photographs on demand (${currentCount} of ${totalToFetch})...`,
            progress: 10 + Math.round((currentCount / totalToFetch) * 60),
            current: currentCount,
            total: totalToFetch,
            icon: 'print'
          });

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
            if (typeof window !== 'undefined') {
              if (!window._hss_central_photo_map) window._hss_central_photo_map = {};
              if (student.id) window._hss_central_photo_map[student.id] = url;
              if (student.formNo) window._hss_central_photo_map[student.formNo] = url;
              if (student.boardReg) window._hss_central_photo_map[student.boardReg] = url;
            }
          });
        }
      }

      if (Object.keys(resolvedPhotos).length > 0) {
        setPhotosMap(prev => ({ ...prev, ...resolvedPhotos }));
      }

      setTaskProgress({
        title: 'Preparing Official Print Layout',
        step: 'Awaiting typography & vector ledger spread alignment...',
        progress: 80,
        icon: 'print'
      });

      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      setTaskProgress({
        title: 'Preparing Official Print Layout',
        step: 'Pre-rasterizing and verifying image decodes...',
        progress: 92,
        icon: 'print'
      });

      const images = Array.from(suiteRootRef.current?.querySelectorAll('img') || []);
      await Promise.all(images.map(img => {
        if (img.complete) return img.decode?.().catch(() => undefined) || Promise.resolve();
        return new Promise(resolve => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 4000);
        });
      }));

      setTaskProgress({
        title: 'Preparing Official Print Layout',
        step: 'Opening browser print dialog...',
        progress: 100,
        status: 'success',
        icon: 'print'
      });

      await new Promise(r => setTimeout(r, 200));
      setTaskProgress(null);
      window.print();
    } catch (error) {
      console.error('Could not fully prepare Admission Register print:', error);
      setTaskProgress(null);
      setToast({ message: 'Some print assets could not be prepared. Please retry after photos finish loading.', type: 'error' });
    } finally {
      setIsPreparingPrint(false);
    }
  };

  const handleCleanPrintRef = useRef(handleCleanPrint);
  useEffect(() => {
    handleCleanPrintRef.current = handleCleanPrint;
  });

  // Intercept Ctrl+P / Cmd+P to trigger clean admission register print/PDF instead of browser window print
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        handleCleanPrintRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

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
    const is11th = prevCls.includes('11');
    let defaultTargetCls = '11th';
    if (prevCls.includes('10') || prevCls.includes('9')) {
      defaultTargetCls = '9th';
    } else if (prevCls.includes('12')) {
      defaultTargetCls = '12th';
    } else if (is11th) {
      defaultTargetCls = '11th';
    }

    const candidateRosterMatch = VERIFIED_CLASS12_READMISSION_ROSTER.find(r => {
      const fNo = cleanStr(candidate.formNo || candidate.raw?.formNo);
      if (fNo && r.form && fNo === r.form) return true;
      const bReg = cleanStr(candidate.boardReg || candidate.raw?.boardRegNo);
      if (bReg && r.reg && (bReg === r.reg || normalizeBoardRegKey(bReg) === normalizeBoardRegKey(r.reg))) return true;
      const rNo = cleanStr(candidate.rollNo || candidate.raw?.classRollNo);
      if (rNo && r.roll && String(rNo) === String(r.roll)) return true;
      return false;
    });

    // For 11th candidate, keep their current admission number intact; for verified 12th roster candidate use designated number!
    const assignedAdm = candidateRosterMatch?.admNo || (is11th && candidate.admNo ? candidate.admNo : nextSequentialAdmNo);
    const prevAdm = candidateRosterMatch?.oldAdm || candidate.oldAdmNo || (is11th ? '' : candidate.admNo) || '';
    const defaultRemarks = buildClass12ReadmissionRemark(defaultTargetCls, prevAdm);

    setReAdmFormState({
      isReAdm: true,
      targetSession: selectedSession || '2025-26',
      targetClass: defaultTargetCls,
      targetStream: (candidate.stream === 'Science' || candidate.stream?.toLowerCase().includes('sci') || candidate.stream?.toLowerCase().includes('med')) ? 'Science' : 'Humanities',
      assignedAdmNo: assignedAdm,
      oldAdmNo: prevAdm,
      prevSchoolOrClass: `HSS Shangus (Class ${prevCls}, ${candidate.session || 'Past Session'})`,
      reason: 'Gap in Studies / Re-enrolled',
      customRemarks: cleanStr(candidate.remarks || candidate.raw?.remarks) || defaultRemarks
    });
  };

  // Open Readmission Modal from a specific row in the table
  const handleOpenReadmissionModal = (student) => {
    setReadmissionModalStudent(student);
    setIsUniversalModalOpen(false);

    const isCurrentReAdm = Boolean(student.isReadmission);
    const isJuniorClass = String(student.class || '').includes('11') || String(student.class || '').includes('9');

    const candidateRosterMatch = VERIFIED_CLASS12_READMISSION_ROSTER.find(r => {
      const fNo = cleanStr(student.formNo || student.raw?.formNo);
      if (fNo && r.form && fNo === r.form) return true;
      const bReg = cleanStr(student.boardReg || student.raw?.boardRegNo);
      if (bReg && r.reg && (bReg === r.reg || normalizeBoardRegKey(bReg) === normalizeBoardRegKey(r.reg))) return true;
      const rNo = cleanStr(student.rollNo || student.raw?.classRollNo);
      if (rNo && r.roll && String(rNo) === String(r.roll)) return true;
      return false;
    });

    // For 11th (or junior class) student, keep their current admission number intact!
    let assignedAdm = candidateRosterMatch?.admNo || student.admNo || '';
    if (!assignedAdm) {
      assignedAdm = nextSequentialAdmNo;
    } else if (!isJuniorClass && !isCurrentReAdm && !candidateRosterMatch) {
      // Only for senior classes (12th/10th) entering the register fresh do we assign next sequential
      assignedAdm = nextSequentialAdmNo;
    }

    const prevAdm = candidateRosterMatch?.oldAdm || student.oldAdmNo || (isJuniorClass ? (student.raw?.['Old Admission No.'] || student.raw?.oldAdmNo || '') : (student.admNo || '')) || '';
    const targetCls = student.class || (isJuniorClass ? '11th' : '12th');
    const defaultRemarks = buildClass12ReadmissionRemark(targetCls, prevAdm);

    setReAdmFormState({
      isReAdm: true,
      targetSession: student.session || selectedSession || '2025-26',
      targetClass: targetCls,
      targetStream: (student.stream === 'Science' || student.stream?.toLowerCase().includes('sci') || student.stream?.toLowerCase().includes('med')) ? 'Science' : 'Humanities',
      assignedAdmNo: assignedAdm,
      oldAdmNo: prevAdm,
      prevSchoolOrClass: `HSS Shangus (Class ${student.class || '11th'})`,
      reason: 'Gap in Studies / Re-enrolled',
      customRemarks: cleanStr(student.remarks || student.raw?.remarks) || defaultRemarks
    });
  };

  // Subsequent students whose admission numbers are strictly greater than the released admission number
  const subsequentStudentsToShift = useMemo(() => {
    if (!readmissionModalStudent) return [];
    const currentAdm = cleanStr(readmissionModalStudent.admNo || reAdmFormState.assignedAdmNo);
    const releasedNum = parseInt(currentAdm.replace(/\D/g, ''), 10);
    if (isNaN(releasedNum) || releasedNum <= 0) return [];

    const targetFormNo = cleanStr(readmissionModalStudent.formNo || readmissionModalStudent.raw?.['Form Number'] || readmissionModalStudent.raw?.['Form No.'] || readmissionModalStudent.raw?.formNo);
    const realDocId = readmissionModalStudent.raw?.id || readmissionModalStudent.raw?.docId || readmissionModalStudent.id;

    const list = [];
    const seenIds = new Set();

    (dataset || []).forEach(item => {
      if (!item) return;
      const itemId = item.id || item.docId;
      if (!itemId || seenIds.has(itemId)) return;
      if (itemId === realDocId || (targetFormNo && cleanStr(item.formNo || item['Form Number'] || item['Form No.'] || item.FormNo) === targetFormNo)) return;

      const iAdmStr = cleanStr(item.admNo || item['Adm. No.'] || item['Admission No.']);
      const iNum = parseInt(iAdmStr.replace(/\D/g, ''), 10);
      if (!isNaN(iNum) && iNum > releasedNum && iNum < 100000) {
        seenIds.add(itemId);
        list.push({
          id: itemId,
          name: cleanStr(item.studentName || item.name || item["Student's Name"]),
          father: cleanStr(item.fatherName || item.father || item["Father's Name"]),
          currentAdm: iAdmStr,
          currentNum: iNum,
          nextAdm: String(iNum - 1),
          class: cleanStr(item.class || item.Class || item['Admission sought for class']),
          session: cleanStr(item.session || item.Session)
        });
      }
    });

    return list.sort((a, b) => a.currentNum - b.currentNum);
  }, [readmissionModalStudent, reAdmFormState.assignedAdmNo, dataset]);

  // Undo Re-admission: Revert student to original Adm No & shift subsequent sequential numbers down by 1
  const handleUndoReadmission = async () => {
    if (!readmissionModalStudent) return;
    setIsUndoingReAdm(true);
    setTaskProgress({
      title: 'Undoing Re-admission',
      step: `Reverting ${readmissionModalStudent.name} to original admission status...`,
      progress: 25,
      icon: 'cloud'
    });
    try {
      const student = readmissionModalStudent;
      const currentAdm = cleanStr(student.admNo || reAdmFormState.assignedAdmNo);
      const releasedNum = parseInt(currentAdm.replace(/\D/g, ''), 10);
      const origAdmNo = cleanStr(student.oldAdmNo || student.raw?.oldAdmNo || student.raw?.['Old Admission No.'] || student.raw?.['Old Adm. No.'] || reAdmFormState.oldAdmNo || '');

      const targetFormNo = cleanStr(student.formNo || student.raw?.['Form Number'] || student.raw?.['Form No.'] || student.raw?.formNo);
      const targetBoardReg = cleanStr(student.boardReg || student.raw?.['Board Registration Number'] || student.raw?.boardRegNo);

      let matchedExisting = null;
      if (Array.isArray(dataset)) {
        matchedExisting = dataset.find(d => {
          if (!d) return false;
          if (student.raw?.id && (d.id === student.raw.id || d.docId === student.raw.id)) return true;
          if (student.id && (d.id === student.id || d.docId === student.id)) return true;
          const dForm = cleanStr(d.formNo || d['Form Number'] || d['Form No.'] || d.FormNo);
          if (targetFormNo && dForm && dForm === targetFormNo) return true;
          const dReg = cleanStr(d.boardRegNo || d['Board Registration Number'] || d.boardReg);
          if (targetBoardReg && dReg && dReg === targetBoardReg) return true;
          return false;
        });
      }

      const realDocId = matchedExisting?.id ||
                        matchedExisting?.docId ||
                        student.raw?.id ||
                        student.raw?.docId ||
                        (student.id && !student.id.startsWith('adm_') ? student.id : null) ||
                        (targetFormNo ? String(targetFormNo) : null);
      if (!realDocId) throw new Error("Could not resolve student record ID");

      const baseData = student.raw || {};
      const revertedUpdates = {
        readmission: 'No',
        'Re-admission': 'No',
        isReadmission: false,
        admNo: origAdmNo,
        'Adm. No.': origAdmNo,
        'Admission No.': origAdmNo,
        oldAdmNo: '',
        'Old Admission No.': '',
        'Old Adm. No.': '',
        remarks: cleanStr(baseData.remarks || '').replace(/Re-admission.*?(•|$)/gi, '').trim(),
        updatedAt: new Date().toISOString(),
        lastEditedBy: `Admin (${user?.email || 'Undo Re-admission'})`
      };

      // Calculate shift records
      const shifted = shiftSubsequentAdmNos ? subsequentStudentsToShift : [];
      const shiftedMap = new Map(shifted.map(s => [s.id, s.nextAdm]));

      if (shifted.length > 0) {
        setTaskProgress({
          title: 'Undoing Re-admission',
          step: `Re-indexing ${shifted.length} subsequent admission number(s) to eliminate ledger gap...`,
          progress: 55,
          icon: 'cloud'
        });
      }

      // 1. Optimistic Cache Updates
      updateCachedItem('admissions', realDocId, revertedUpdates);
      shifted.forEach(st => {
        updateCachedItem('admissions', st.id, {
          admNo: st.nextAdm,
          'Adm. No.': st.nextAdm,
          'Admission No.': st.nextAdm,
          updatedAt: new Date().toISOString()
        });
      });

      // 2. Optimistic State Updates
      setDataset(prev => {
        return (prev || []).map(item => {
          if (item.id === realDocId || (targetFormNo && cleanStr(item.formNo || item['Form Number']) === targetFormNo)) {
            return {
              ...item,
              ...revertedUpdates,
              id: realDocId,
              isReadmission: false,
              readmission: 'No',
              'Re-admission': 'No',
              admNo: origAdmNo,
              'Adm. No.': origAdmNo,
              'Admission No.': origAdmNo,
              oldAdmNo: '',
              'Old Admission No.': '',
              'Old Adm. No.': ''
            };
          }
          if (shiftedMap.has(item.id)) {
            const nextAdm = shiftedMap.get(item.id);
            return {
              ...item,
              admNo: nextAdm,
              'Adm. No.': nextAdm,
              'Admission No.': nextAdm
            };
          }
          return item;
        });
      });

      if (sessionCacheRef.current[selectedSession]) {
        sessionCacheRef.current[selectedSession] = (sessionCacheRef.current[selectedSession] || []).map(item => {
          if (item.id === realDocId || (targetFormNo && cleanStr(item.formNo || item['Form Number']) === targetFormNo)) {
            return {
              ...item,
              ...revertedUpdates,
              id: realDocId,
              isReadmission: false,
              readmission: 'No',
              'Re-admission': 'No',
              admNo: origAdmNo,
              'Adm. No.': origAdmNo,
              'Admission No.': origAdmNo,
              oldAdmNo: '',
              'Old Admission No.': '',
              'Old Adm. No.': ''
            };
          }
          if (shiftedMap.has(item.id)) {
            const nextAdm = shiftedMap.get(item.id);
            return {
              ...item,
              admNo: nextAdm,
              'Adm. No.': nextAdm,
              'Admission No.': nextAdm
            };
          }
          return item;
        });
      }

      // Close modals immediately
      setReadmissionModalStudent(null);
      setIsUniversalModalOpen(false);
      setShowUndoConfirmModal(false);
      setToast({
        message: `↩ Re-admission undone for ${student.name}. ${shifted.length > 0 ? `${shifted.length} subsequent admission number(s) shifted down (e.g. ${shifted[0].currentAdm} → ${shifted[0].nextAdm}) to prevent gap.` : 'Admission number restored.'}`,
        type: 'success'
      });

      // 3. Background Server Persistence
      (async () => {
        try {
          setTaskProgress({
            title: 'Undoing Re-admission',
            step: 'Syncing reverted ledger to cloud database...',
            progress: 80,
            icon: 'cloud'
          });
          const writes = [
            setDoc(doc(db, 'admissions', realDocId), revertedUpdates, { merge: true })
          ];
          shifted.forEach(st => {
            writes.push(
              setDoc(doc(db, 'admissions', st.id), {
                admNo: st.nextAdm,
                'Adm. No.': st.nextAdm,
                'Admission No.': st.nextAdm,
                updatedAt: new Date().toISOString()
              }, { merge: true })
            );
          });
          await Promise.all(writes);

          logAdminActivity({
            actionType: 'student_readmission_undone',
            actionTitle: `Undid Re-admission: ${student.name}`,
            details: `Reverted ${student.name} to Adm No: ${origAdmNo || 'None'}. Shifted ${shifted.length} subsequent student(s) down to prevent ledger gap.`,
            metadata: { studentId: realDocId, releasedAdmNo: currentAdm, revertedAdmNo: origAdmNo, shiftedCount: shifted.length }
          }).catch(() => {});

          setTaskProgress({
            title: 'Re-admission Undone',
            step: `Restored ${student.name}'s original admission number!`,
            progress: 100,
            icon: 'cloud',
            status: 'success'
          });
          setTimeout(() => setTaskProgress(null), 1200);

          if (onDataUpdated) {
            const allUpdates = [
              { id: realDocId, ...revertedUpdates },
              ...shifted.map(st => ({
                id: st.id,
                admNo: st.nextAdm,
                'Adm. No.': st.nextAdm,
                'Admission No.': st.nextAdm
              }))
            ];
            try { onDataUpdated(allUpdates); } catch (_) {}
          }
        } catch (serverErr) {
          console.error('Background Firestore undo error:', serverErr);
          setToast({ message: `⚠️ Warning: Local update applied, but server sync failed: ${serverErr.message}`, type: 'error' });
          setTaskProgress(null);
        }
      })();
    } catch (err) {
      console.error('Error undoing readmission:', err);
      setToast({ message: `❌ Failed to undo re-admission: ${err.message}`, type: 'error' });
      setTaskProgress(null);
    } finally {
      setIsUndoingReAdm(false);
    }
  };

  const handleSaveReadmission = async () => {
    if (!readmissionModalStudent) return;
    setSavingReAdm(true);
    setTaskProgress({
      title: 'Applying Re-admission',
      step: `Configuring re-admission for ${readmissionModalStudent.name}...`,
      progress: 25,
      icon: 'cloud'
    });
    try {
      const isRe = reAdmFormState.isReAdm;
      const targetSess = reAdmFormState.targetSession || selectedSession;
      const targetCls = reAdmFormState.targetClass || readmissionModalStudent.class || '11th';
      const targetStr = reAdmFormState.targetStream || readmissionModalStudent.stream || 'General';
      const assignedAdm = cleanStr(reAdmFormState.assignedAdmNo || readmissionModalStudent.admNo || nextSequentialAdmNo);
      const oldAdm = cleanStr(reAdmFormState.oldAdmNo);
      const reasonText = cleanStr(reAdmFormState.reason) || 'Gap in Studies / Re-enrolled';

      // 1. Resolve TRUE existing Firestore Document ID in admissions collection to eliminate duplicates
      const targetFormNo = cleanStr(readmissionModalStudent.formNo || readmissionModalStudent.raw?.['Form Number'] || readmissionModalStudent.raw?.['Form No.'] || readmissionModalStudent.raw?.formNo);
      const targetBoardReg = cleanStr(readmissionModalStudent.boardReg || readmissionModalStudent.raw?.['Board Registration Number'] || readmissionModalStudent.raw?.boardRegNo);

      let matchedExisting = null;
      if (Array.isArray(dataset)) {
        matchedExisting = dataset.find(d => {
          if (!d) return false;
          if (readmissionModalStudent.raw?.id && (d.id === readmissionModalStudent.raw.id || d.docId === readmissionModalStudent.raw.id)) return true;
          if (readmissionModalStudent.id && (d.id === readmissionModalStudent.id || d.docId === readmissionModalStudent.id)) return true;
          const dForm = cleanStr(d.formNo || d['Form Number'] || d['Form No.'] || d.FormNo);
          if (targetFormNo && dForm && dForm === targetFormNo) return true;
          const dReg = cleanStr(d.boardRegNo || d['Board Registration Number'] || d.boardReg);
          if (targetBoardReg && dReg && dReg === targetBoardReg) return true;
          return false;
        });
      }

      // If matched existing document has an ID, use it directly!
      const realDocId = matchedExisting?.id ||
                        matchedExisting?.docId ||
                        readmissionModalStudent.raw?.id ||
                        readmissionModalStudent.raw?.docId ||
                        (readmissionModalStudent.id && !readmissionModalStudent.id.startsWith('adm_') ? readmissionModalStudent.id : null) ||
                        (targetFormNo ? String(targetFormNo) : `adm_${Date.now()}`);

      const docRef = doc(db, 'admissions', realDocId);
      const baseData = readmissionModalStudent.raw || {};

      // 2. High-speed lean delta updates (NO massive photo base64 strings re-sent over the wire!)
      const deltaUpdates = {
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
        remarks: isRe
          ? (reAdmFormState.customRemarks?.trim() || buildClass12ReadmissionRemark(targetCls, oldAdm))
          : cleanStr(baseData.remarks || ''),
        Remarks: isRe
          ? (reAdmFormState.customRemarks?.trim() || buildClass12ReadmissionRemark(targetCls, oldAdm))
          : cleanStr(baseData.remarks || ''),
        updatedAt: new Date().toISOString(),
        lastEditedBy: `Admin (${user?.email || 'Readmission Tool'})`
      };

      setTaskProgress({
        title: 'Applying Re-admission',
        step: `Allocating Adm No. ${assignedAdm || '—'} in Class ${targetCls}...`,
        progress: 60,
        icon: 'cloud'
      });

      // 3. Instant Optimistic UI Update: update cache, memory dataset, and close modal immediately!
      updateCachedItem('admissions', realDocId, deltaUpdates);

      let newDataset = [];
      setDataset(prev => {
        let found = false;
        const updated = (prev || []).map(item => {
          if (!item) return item;
          const iForm = cleanStr(item.formNo || item['Form Number'] || item['Form No.'] || item.FormNo);
          const isNumericForm = /^\d{4,}$/.test(targetFormNo) && iForm === targetFormNo;
          const isMatch = item.id === realDocId ||
                          (targetFormNo && isNumericForm && cleanStr(item.studentName || item.name).toLowerCase() === cleanStr(readmissionModalStudent.name).toLowerCase());
          if (isMatch) {
            found = true;
            return { ...item, ...deltaUpdates, id: realDocId };
          }
          return item;
        });

        // Filter out historical orphan duplicate document like 'form_250199' if realDocId is '250199'
        const cleaned = updated.filter(item => {
          if (targetFormNo && realDocId !== `form_${targetFormNo}` && item.id === `form_${targetFormNo}`) {
            return false;
          }
          return true;
        });

        if (found) {
          newDataset = cleaned;
          return cleaned;
        }
        if (targetSess === selectedSession) {
          const res = [{ ...baseData, ...deltaUpdates, id: realDocId }, ...cleaned];
          newDataset = res;
          return res;
        }
        newDataset = cleaned;
        return cleaned;
      });

      if (sessionCacheRef.current[selectedSession]) {
        sessionCacheRef.current[selectedSession] = newDataset;
      }

      // Close modal and show success toast immediately (0ms perceptible delay!)
      setToast({
        message: `✨ ${readmissionModalStudent.name} mapped to Class ${targetCls} (${targetSess}) as ${isRe ? 'Re-admission' : 'Fresh'}!`,
        type: 'success'
      });
      setReadmissionModalStudent(null);
      setIsUniversalModalOpen(false);
      setSearchCandidateQuery('');
      setSavingReAdm(false);

      // 4. Background Server Persistence & Cleanups (Fast & Non-blocking)
      (async () => {
        try {
          setTaskProgress({
            title: 'Applying Re-admission',
            step: 'Saving changes to cloud database...',
            progress: 85,
            icon: 'cloud'
          });
          await setDoc(docRef, deltaUpdates, { merge: true });

          // Clean up historical orphan duplicate document like form_250199 if realDocId is 250199
          if (targetFormNo && realDocId !== `form_${targetFormNo}`) {
            deleteDoc(doc(db, 'admissions', `form_${targetFormNo}`)).catch(() => {});
          }

          // Non-blocking asynchronous audit log
          logAdminActivity({
            actionType: 'student_readmission_update',
            actionTitle: `Configured Re-admission: ${readmissionModalStudent.name} (${targetCls})`,
            details: `${readmissionModalStudent.name} mapped to Class ${targetCls} Session ${targetSess} as ${isRe ? `Re-admission (Adm No: ${assignedAdm || '—'}, Old Adm: ${oldAdm || 'N/A'})` : 'Fresh'}.`,
            metadata: { studentId: realDocId, targetClass: targetCls, targetSession: targetSess, isReadmission: isRe, oldAdmNo: oldAdm }
          }).catch(err => console.warn('Activity logging background warning:', err));

          setTaskProgress({
            title: 'Re-admission Applied',
            step: `${readmissionModalStudent.name} successfully mapped to Class ${targetCls}!`,
            progress: 100,
            icon: 'cloud',
            status: 'success'
          });
          setTimeout(() => setTaskProgress(null), 1200);

          // Non-blocking data notification
          if (onDataUpdated) {
            setTimeout(() => {
              try { onDataUpdated({ id: realDocId, ...deltaUpdates }); } catch (_) {}
            }, 100);
          }
        } catch (serverErr) {
          console.error('Background Firestore save error:', serverErr);
          setToast({ message: `⚠️ Warning: Local update applied, but server sync failed: ${serverErr.message}`, type: 'error' });
          setTaskProgress(null);
        }
      })();
    } catch (err) {
      console.error('Error saving readmission:', err);
      setToast({ message: `❌ Failed to update readmission: ${err.message}`, type: 'error' });
      setSavingReAdm(false);
      setTaskProgress(null);
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
      // 1. Status Filter (Applies to summary as well, e.g. Approved or Roll Assigned students)
      if (selectedStatus !== 'ALL') {
        const hasRollNo = Boolean(s.rollNo && s.rollNo !== '—' && s.rollNo !== 'NA' && s.rollNo !== 'N/A' && cleanStr(s.rollNo) !== '');
        if (selectedStatus === 'Approved') {
          if (s.status !== 'Approved' && !hasRollNo) return false;
        } else if (selectedStatus === 'Submitted') {
          if (s.status !== 'Submitted' || hasRollNo) return false;
        } else if (selectedStatus === 'Provisional') {
          if (s.status !== 'Provisional' || hasRollNo) return false;
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
  const [assignStartId, setAssignStartId] = useState('5001');
  const [assigningIds, setAssigningIds] = useState(false);
  const [assignClasses, setAssignClasses] = useState(['11th', '12th']);
  const [assignSessionFilter, setAssignSessionFilter] = useState('2025-26');
  const [onlyMissingAdmNo, setOnlyMissingAdmNo] = useState(true);
  const [onlyApprovedAssign, setOnlyApprovedAssign] = useState(true);
  const [assignStrategies, setAssignStrategies] = useState({});
  const [assignViewMode, setAssignViewMode] = useState('integrated'); // 'integrated' | 'allot' | 'audit'
  const [auditorSearch, setAuditorSearch] = useState('');
  const [auditorFilter, setAuditorFilter] = useState('all'); // 'all' | 'gaps_only' | 'duplicates_only' | 'unassigned_only'
  const [includeHistoryInAudit, setIncludeHistoryInAudit] = useState(false);

  const [assignSortVariable, setAssignSortVariable] = useState('rollNo'); // 'rollNo' | 'admNo' | 'name' | 'formNo'

  // Synchronize assign_ids and assign_dates session scope with selectedSession
  useEffect(() => {
    if (selectedSession) {
      setAssignSessionFilter(selectedSession);
      setAssignDateSession(selectedSession);
    }
  }, [selectedSession]);

  const calculatedNextAdmNo = useMemo(() => {
    // 1. Try to find the max valid admission number within current audit scoped students (this session & tier)
    let maxScoped = 0;
    normalizedStudents.forEach(s => {
      if (assignSessionFilter !== 'ALL' && s.session !== assignSessionFilter) return;
      if (assignClasses.length > 0 && !assignClasses.some(c => matchesClassVal(c, s.class))) return;
      if (!isEligibleForSessionAdmNoAudit(s, assignSessionFilter)) return;
      const num = parseInt(String(s.admNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxScoped && num < 99999) {
        maxScoped = num;
      }
    });
    if (maxScoped > 0) {
      return String(maxScoped + 1);
    }

    // 2. Fallback to highest existing admission number overall
    let maxId = 5000;
    normalizedStudents.forEach(s => {
      const num = parseInt(String(s.admNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxId && num < 99999) {
        maxId = num;
      }
    });
    return String(maxId + 1);
  }, [normalizedStudents, assignSessionFilter, assignClasses]);

  useEffect(() => {
    if (calculatedNextAdmNo && (!assignStartId || assignStartId === '5476' || assignStartId === '5001' || assignStartId === '52774779')) {
      setAssignStartId(calculatedNextAdmNo);
    }
  }, [calculatedNextAdmNo]);

  const candidateAssignStudents = useMemo(() => {
    const list = normalizedStudents.filter(st => {
      const hasRollNo = Boolean(st.rollNo && st.rollNo !== '—' && st.rollNo !== 'NA' && cleanStr(st.rollNo) !== '');
      if (onlyApprovedAssign && st.status !== 'Approved' && !hasRollNo) return false;
      if (assignSessionFilter !== 'ALL' && st.session !== assignSessionFilter) return false;
      if (assignClasses.length > 0) {
        const match = assignClasses.some(c => matchesClassVal(c, st.class));
        if (!match) return false;
      }
      // Check/allot admission numbers strictly for 9th, 11th, and Re-admissions for this session
      if (!isEligibleForSessionAdmNoAudit(st, assignSessionFilter)) return false;

      if (onlyMissingAdmNo) {
        if (st.admNo && st.admNo !== '—' && st.admNo !== 'N/A') return false;
      }
      return true;
    });

    const mapped = list.map(st => {
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

      if (!prevInfo && reg && reg.length > 5 && allAdmissionsPool) {
        const poolMatch = allAdmissionsPool.find(adm => {
          const aReg = cleanStr(adm.boardRegNo || adm['Board Registration Number'] || adm.boardReg);
          const aAdm = cleanStr(adm.admNo || adm['Adm. No.']);
          return aReg === reg && aAdm && adm.id !== st.id;
        });
        if (poolMatch) {
          prevInfo = {
            admNo: cleanStr(poolMatch.admNo || poolMatch['Adm. No.']),
            class: cleanStr(poolMatch.class || poolMatch.Class || '11th'),
            session: cleanStr(poolMatch.session || poolMatch.Session || '')
          };
        }
      }

      const priorityInfo = getStudentAllotmentPriority(st, assignSessionFilter, prevInfo);
      return {
        student: st,
        prevInfo,
        priorityInfo
      };
    });

    // Sort strictly by:
    // 1. Priority Tier Order:
    //    10 (9th Fresh), 20 (10th Re-adm Gap), 30 (11th Fresh), 40 (12th Re-adm Gap), 50 (10th Regular), 60 (12th Regular)
    // 2. Order within Tier by selected variable (Default: Class Roll No)
    // 3. Student Name alphabetically
    mapped.sort((a, b) => {
      if (a.priorityInfo.tierOrder !== b.priorityInfo.tierOrder) {
        return a.priorityInfo.tierOrder - b.priorityInfo.tierOrder;
      }
      if (assignSortVariable === 'admNo') {
        const numA = parseInt(String(a.student.admNo || a.prevInfo?.admNo || a.student.oldAdmNo || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.student.admNo || b.prevInfo?.admNo || b.student.oldAdmNo || '').replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
      } else if (assignSortVariable === 'name') {
        const diff = (a.student.name || '').localeCompare(b.student.name || '');
        if (diff !== 0) return diff;
      } else if (assignSortVariable === 'formNo') {
        const numA = parseInt(String(a.student.formNo || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.student.formNo || '').replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
      }

      // Default: Class Roll Number numerically (1, 2, 3... 100)
      const numA = parseInt(String(a.student.rollNo || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.student.rollNo || '').replace(/\D/g, ''), 10);
      const hasA = !isNaN(numA);
      const hasB = !isNaN(numB);
      if (hasA && hasB) return numA - numB;
      if (hasA) return -1;
      if (hasB) return 1;
      return (a.student.name || '').localeCompare(b.student.name || '');
    });

    return mapped;
  }, [normalizedStudents, onlyApprovedAssign, assignSessionFilter, assignClasses, onlyMissingAdmNo, assignSortVariable, historyDataset, allAdmissionsPool]);

  const candidateIdPreviewList = useMemo(() => {
    let seqCounter = parseInt(assignStartId, 10) || 5001;
    return candidateAssignStudents.map(item => {
      const { student: st, prevInfo, priorityInfo } = item;
      const userStrat = assignStrategies[st.id];

      // Automatic default strategy determination:
      // - Priority 1 (Fresh 9th or 11th): 'assign_new' (consumes starting sequential numbers e.g. 5001-5100)
      // - Priority 2 (10th or 12th Re-admission with Academic Gap > 1 yr): 'assign_new' (consumes NEXT sequential numbers e.g. 5101-5110)
      // - Continuous regular progression (no gap): 'inherit_prev' if prevInfo/admNo exists, else 'assign_new'
      let defaultStrat = 'assign_new';
      if (priorityInfo.tierOrder === 10 || priorityInfo.tierOrder === 30) {
        defaultStrat = 'assign_new';
      } else if (priorityInfo.tierOrder === 20 || priorityInfo.tierOrder === 40) {
        defaultStrat = 'assign_new';
      } else if (prevInfo || (st.admNo && st.admNo !== '—' && st.admNo !== 'N/A')) {
        defaultStrat = 'inherit_prev';
      }

      const strat = userStrat || defaultStrat;

      let proposed = '—';
      let proposedDisplay = '—';
      let oldAdmNo = '';

      // Determine old admission number if student has prior enrollment
      const rawOld = cleanStr(st.oldAdmNo || st.raw?.oldAdmNo || st.raw?.['Old Admission No.'] || st.raw?.['Old Adm No'] || prevInfo?.admNo);
      if (rawOld && rawOld !== '—' && rawOld !== 'N/A') {
        oldAdmNo = rawOld;
      } else if (st.admNo && st.admNo !== '—' && st.admNo !== 'N/A') {
        oldAdmNo = st.admNo;
      }

      if (strat === 'assign_new') {
        const assignedNo = String(seqCounter);
        seqCounter++;
        proposed = assignedNo;

        // If candidate is a senior re-admission with academic gap (or has oldAdmNo), format display as: 5101 (4892)
        if (priorityInfo.hasGap || priorityInfo.isSeniorReAdm || (oldAdmNo && oldAdmNo !== assignedNo)) {
          proposedDisplay = oldAdmNo ? `${assignedNo} (${oldAdmNo})` : assignedNo;
        } else {
          proposedDisplay = assignedNo;
        }
      } else if (strat === 'inherit_prev') {
        proposed = prevInfo?.admNo || st.admNo || '—';
        proposedDisplay = proposed;
      } else if (strat === 'skip') {
        proposed = st.admNo || '—';
        proposedDisplay = proposed;
      }

      return {
        student: st,
        currentAdm: st.admNo,
        prevInfo,
        priorityInfo,
        strat,
        proposed,
        proposedDisplay,
        oldAdmNo: (priorityInfo.hasGap || priorityInfo.isSeniorReAdm || (oldAdmNo && oldAdmNo !== proposed)) ? oldAdmNo : '',
        isGapReAdmission: priorityInfo.hasGap || priorityInfo.isSeniorReAdm
      };
    });
  }, [candidateAssignStudents, assignStartId, assignStrategies]);

  const handleRunAssignIds = async () => {
    if (candidateIdPreviewList.length === 0) {
      setToast({ message: '⚠️ No eligible students selected for assignment.', type: 'error' });
      return;
    }

    const itemsToAssign = candidateIdPreviewList.filter(item => {
      const { proposed, strat } = item;
      return proposed && proposed !== '—' && strat !== 'skip';
    });

    if (itemsToAssign.length === 0) {
      setToast({ message: '⚠️ No students with valid proposed admission numbers to assign.', type: 'info' });
      return;
    }

    setAssigningIds(true);
    const totalCount = itemsToAssign.length;
    setTaskProgress({
      title: 'Bulk Assigning Admission Numbers',
      step: `Preparing to assign admission numbers to ${totalCount} students...`,
      progress: 5,
      current: 0,
      total: totalCount,
      icon: 'assign'
    });

    let count = 0;
    const batchSize = 400; // Stay under Firestore's 500-op batch write limit
    const totalBatches = Math.ceil(totalCount / batchSize);

    try {
      const todayDate = formatRegisterDate(new Date());

      for (let b = 0; b < totalBatches; b++) {
        const batchSlice = itemsToAssign.slice(b * batchSize, (b + 1) * batchSize);
        const batch = writeBatch(db);

        setTaskProgress({
          title: 'Bulk Assigning Admission Numbers',
          step: `Writing Firestore batch ${b + 1} of ${totalBatches} (${count} / ${totalCount} saved)...`,
          progress: 10 + Math.round((b / totalBatches) * 75),
          current: count,
          total: totalCount,
          icon: 'assign'
        });

        for (const item of batchSlice) {
          const { student, proposed, oldAdmNo: itemOldAdm } = item;
          const docRef = doc(db, 'admissions', student.id);
          const rawDate = student.admDate ? formatRegisterDate(student.admDate) : todayDate;
          const payload = {
            'Adm. No.': proposed,
            admNo: proposed,
            'Adm. Date': rawDate,
            admDate: rawDate,
            updatedAt: new Date().toISOString(),
            lastEditedBy: `Admin (${user?.email || 'Assign IDs'})`
          };

          if (itemOldAdm && itemOldAdm !== proposed) {
            payload.oldAdmNo = itemOldAdm;
            payload['Old Admission No.'] = itemOldAdm;
            payload['Old Adm No'] = itemOldAdm;
            payload.isReadmission = true;
            payload.readmission = 'Yes';
            const remText = buildClass12ReadmissionRemark(student.class || '12th', itemOldAdm);
            payload.remarks = remText;
            payload.Remarks = remText;
          }

          batch.set(docRef, payload, { merge: true });
          updateCachedItem('admissions', student.id, payload);
          count++;
        }

        await batch.commit();
      }

      setTaskProgress({
        title: 'Bulk Assigning Admission Numbers',
        step: 'Logging administrative activity and synchronizing local cache...',
        progress: 92,
        current: count,
        total: totalCount,
        icon: 'assign'
      });

      // Update local dataset state so tables and candidate lists update immediately
      setDataset(prev => {
        const assignedMap = new Map();
        itemsToAssign.forEach(it => {
          assignedMap.set(it.student.id, it);
        });
        return prev.map(item => {
          if (assignedMap.has(item.id)) {
            const it = assignedMap.get(item.id);
            const proposed = it.proposed;
            const updated = {
              ...item,
              admNo: proposed,
              'Adm. No.': proposed,
              'Adm. Date': item['Adm. Date'] || item.admDate || todayDate,
              admDate: item['Adm. Date'] || item.admDate || todayDate
            };
            if (it.oldAdmNo && it.oldAdmNo !== proposed) {
              updated.oldAdmNo = it.oldAdmNo;
              updated['Old Admission No.'] = it.oldAdmNo;
              updated['Old Adm No'] = it.oldAdmNo;
              updated.isReadmission = true;
              updated.readmission = 'Yes';
              const remText = buildClass12ReadmissionRemark(item.class || '12th', it.oldAdmNo);
              updated.remarks = remText;
              updated.Remarks = remText;
            }
            return updated;
          }
          return item;
        });
      });

      logAdminActivity({
        actionType: 'batch_id_assign',
        actionTitle: 'Bulk Assigned Admission Numbers',
        details: `Assigned admission numbers to ${count} students in session ${assignSessionFilter}.`,
        metadata: { count, session: assignSessionFilter }
      }).catch(() => {});

      setTaskProgress(null);
      setToast({ message: `✨ Successfully assigned Admission Numbers to ${count} students!`, type: 'success' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Assign IDs batch error:', err);
      setTaskProgress(null);
      setToast({ message: `❌ Error assigning IDs: ${err.message}`, type: 'error' });
    } finally {
      setAssigningIds(false);
    }
  };

  // -------------------------------------------------------------
  // 1-CLICK CLASS 12TH RE-ADMISSION SEQUENTIAL BATCH SYNCHRONIZER
  // -------------------------------------------------------------
  const handleBatchSyncClass12Readmissions = async () => {
    setSavingReAdm(true);
    setTaskProgress({
      title: 'Batch Syncing Class 12th Re-admissions',
      step: 'Matching 38 candidates in dataset and preparing batch...',
      progress: 10,
      icon: 'assign'
    });
    await new Promise(r => setTimeout(r, 80));

    try {
      const todayDate = formatRegisterDate(new Date()) || '02-03-2026';
      const batch = writeBatch(db);
      const updatedDocs = [];

      for (let i = 0; i < VERIFIED_CLASS12_READMISSION_ROSTER.length; i++) {
        const item = VERIFIED_CLASS12_READMISSION_ROSTER[i];

        // Find existing record in dataset
        const matched = (dataset || []).find(d => {
          if (!d) return false;
          const dForm = cleanStr(d.formNo || d['Form Number'] || d['Form No.'] || d.FormNo || d.id);
          if (item.form && dForm && dForm === item.form) return true;
          const dReg = cleanStr(d.boardRegNo || d['Board Registration Number'] || d.boardReg);
          if (item.reg && dReg && (dReg === item.reg || normalizeBoardRegKey(dReg) === normalizeBoardRegKey(item.reg))) return true;
          const dRoll = cleanStr(d.classRollNo || d['Class Roll No'] || d.rollNo || d['Roll No']);
          const dCls = cleanStr(d.class || d.Class || d['Admission sought for class']);
          if (item.roll && dRoll && String(dRoll) === String(item.roll) && matchesClassVal('12th', dCls)) return true;
          return false;
        });

        const docId = matched?.id || matched?.docId || (item.form ? String(item.form) : `adm_12th_${item.roll}`);
        const docRef = doc(db, 'admissions', docId);
        const remarksText = buildClass12ReadmissionRemark('12th', item.oldAdm);

        const delta = {
          admNo: item.admNo,
          'Adm. No.': item.admNo,
          'Admission No.': item.admNo,
          'Adm. Date': matched?.admDate || todayDate,
          admDate: matched?.admDate || todayDate,
          oldAdmNo: item.oldAdm || '',
          'Old Admission No.': item.oldAdm || '',
          'Old Adm No': item.oldAdm || '',
          readmission: 'Yes',
          'Re-admission': 'Yes',
          isReadmission: true,
          class: '12th',
          Class: '12th',
          'Admission sought for class': '12th',
          session: '2025-26',
          Session: '2025-26',
          'Academic Session': '2025-26',
          remarks: remarksText,
          Remarks: remarksText,
          updatedAt: new Date().toISOString(),
          lastEditedBy: `Admin (${user?.email || 'Class12 Re-adm Sync'})`
        };

        batch.set(docRef, delta, { merge: true });
        updateCachedItem('admissions', docId, delta);
        updatedDocs.push({ docId, delta, item });

        const currentProg = 10 + Math.round(((i + 1) / VERIFIED_CLASS12_READMISSION_ROSTER.length) * 75);
        setTaskProgress({
          title: 'Batch Syncing Class 12th Re-admissions',
          step: `Matched candidate ${i + 1}/38: ${item.name} (Roll ${item.roll}) → Adm No. ${item.admNo}...`,
          progress: currentProg,
          icon: 'assign'
        });
      }

      setTaskProgress({
        title: 'Batch Syncing Class 12th Re-admissions',
        step: 'Committing batch updates to Firestore database...',
        progress: 90,
        icon: 'cloud'
      });
      await new Promise(r => setTimeout(r, 60));

      try {
        await batch.commit();
      } catch (commitErr) {
        console.warn('Firestore write warning:', commitErr);
      }

      // Optimistically update React dataset state
      setDataset(prev => {
        const updateMap = new Map();
        updatedDocs.forEach(({ docId, delta, item }) => {
          updateMap.set(docId, delta);
          if (item.form) updateMap.set(item.form, delta);
          if (item.roll) updateMap.set(`roll_${item.roll}`, delta);
        });

        return (prev || []).map(st => {
          const stForm = cleanStr(st.formNo || st['Form Number'] || st['Form No.'] || st.FormNo || st.id);
          const stRoll = cleanStr(st.classRollNo || st['Class Roll No'] || st.rollNo);
          const delta = updateMap.get(st.id) || updateMap.get(stForm) || (matchesClassVal('12th', st.class || st['Admission sought for class']) ? updateMap.get(`roll_${stRoll}`) : null);
          if (delta) {
            return {
              ...st,
              ...delta
            };
          }
          return st;
        });
      });

      setTaskProgress({
        title: 'Batch Syncing Class 12th Re-admissions',
        step: 'Completed! All 38 candidates updated with sequential numbers and consolidated remarks.',
        progress: 100,
        icon: 'success'
      });
      await new Promise(r => setTimeout(r, 600));
      setTaskProgress(null);
      setIsUniversalModalOpen(false);
      setToast({
        message: '✅ Successfully assigned sequential admission nos (5476–5513) and consolidated remarks for all 38 Class 12th re-admissions!',
        type: 'success'
      });
    } catch (err) {
      console.error('Error batch syncing readmissions:', err);
      setTaskProgress(null);
      setToast({
        message: `⚠️ Sync completed with local cache update. (${err.message || 'Check connection'})`,
        type: 'info'
      });
    } finally {
      setSavingReAdm(false);
    }
  };

  // -------------------------------------------------------------
  // SEQUENTIAL ADMISSION NO. LEDGER & GAP AUDITOR ENGINE
  // -------------------------------------------------------------
  const auditScopedStudents = useMemo(() => {
    const pool = [...normalizedStudents];

    if (includeHistoryInAudit && Array.isArray(flatHistoryRecords) && flatHistoryRecords.length > 0) {
      flatHistoryRecords.forEach(h => {
        if (!pool.some(p => p.id === h.id || (p.boardReg && p.boardReg === h.boardRegNo))) {
          pool.push({
            id: h.id || `hist_${Math.random()}`,
            name: cleanStr(h.studentName || h["Student's Name"]),
            father: cleanStr(h.fatherName || h["Father's Name"]),
            rollNo: cleanStr(h.classRollNo || h['Class Roll No'] || h.rollNo),
            admNo: cleanStr(h.admNo || h['Adm. No.'] || h['Admission No.'] || h['Admission Number']),
            class: cleanStr(h.class || h.Class || '11th'),
            session: cleanStr(h.session || h.Session || ''),
            boardReg: cleanStr(h.boardRegNo || h['Board Registration Number']),
            status: 'Historical',
            admDate: formatRegisterDate(h.admDate || h['Admission Date'] || '')
          });
        }
      });
    }

    return pool.filter(st => {
      const hasRollNo = Boolean(st.rollNo && st.rollNo !== '—' && st.rollNo !== 'NA' && cleanStr(st.rollNo) !== '');
      if (onlyApprovedAssign && st.status !== 'Approved' && st.status !== 'Historical' && !hasRollNo) return false;
      if (assignSessionFilter !== 'ALL' && st.session && st.session !== assignSessionFilter) return false;
      if (assignClasses.length > 0) {
        const match = assignClasses.some(c => matchesClassVal(c, st.class));
        if (!match) return false;
      }
      // Check admission numbers strictly for 9th, 11th, and Re-admissions for this session
      if (!isEligibleForSessionAdmNoAudit(st, assignSessionFilter)) return false;

      return true;
    });
  }, [normalizedStudents, flatHistoryRecords, includeHistoryInAudit, onlyApprovedAssign, assignSessionFilter, assignClasses]);

  const { assignedScopedStudents, unassignedScopedStudents } = useMemo(() => {
    const assigned = [];
    const unassigned = [];
    auditScopedStudents.forEach(st => {
      const cleanAdm = cleanStr(st.admNo);
      if (cleanAdm && cleanAdm !== '—' && cleanAdm !== 'N/A' && cleanAdm !== '-') {
        assigned.push(st);
      } else {
        unassigned.push(st);
      }
    });
    return { assignedScopedStudents: assigned, unassignedScopedStudents: unassigned };
  }, [auditScopedStudents]);

  const {
    sequentialAuditorItems,
    auditorStats,
    allGapsList,
    allDuplicatesList
  } = useMemo(() => {
    if (assignedScopedStudents.length === 0) {
      return {
        sequentialAuditorItems: [],
        auditorStats: {
          totalAssigned: 0,
          minAdm: null,
          maxAdm: null,
          span: 0,
          totalGaps: 0,
          totalSkippedNumbers: 0,
          duplicatesCount: 0,
          unassignedCount: unassignedScopedStudents.length
        },
        allGapsList: [],
        allDuplicatesList: []
      };
    }

    const admMap = new Map();
    const parsedStudents = [];

    assignedScopedStudents.forEach(st => {
      const cleanAdm = cleanStr(st.admNo);
      const digitsOnly = cleanAdm.replace(/\D/g, '');
      const numVal = digitsOnly ? parseInt(digitsOnly, 10) : null;

      if (!admMap.has(cleanAdm)) {
        admMap.set(cleanAdm, []);
      }
      admMap.get(cleanAdm).push(st);

      parsedStudents.push({
        student: st,
        cleanAdm,
        numVal
      });
    });

    const duplicates = [];
    admMap.forEach((studentsList, admKey) => {
      if (studentsList.length > 1) {
        duplicates.push({
          admNo: admKey,
          count: studentsList.length,
          students: studentsList
        });
      }
    });

    parsedStudents.sort((a, b) => {
      if (a.numVal !== null && b.numVal !== null) {
        if (a.numVal !== b.numVal) return a.numVal - b.numVal;
        const rollA = parseInt(a.student.rollNo, 10) || 0;
        const rollB = parseInt(b.student.rollNo, 10) || 0;
        if (rollA !== rollB) return rollA - rollB;
        return (a.student.name || '').localeCompare(b.student.name || '');
      }
      if (a.numVal !== null) return -1;
      if (b.numVal !== null) return 1;
      return a.cleanAdm.localeCompare(b.cleanAdm);
    });

    const items = [];
    const gaps = [];
    let minAdm = null;
    let maxAdm = null;
    let totalSkippedNumbers = 0;

    let prevNumeric = null;
    let prevStudent = null;

    parsedStudents.forEach((entry, idx) => {
      const isDuplicate = admMap.get(entry.cleanAdm)?.length > 1;
      const dupCount = admMap.get(entry.cleanAdm)?.length || 1;

      // Realistic admission numbers in school ledgers are typically 1 to 5 digits (e.g. 1 to 99999)
      const isRealisticAdm = entry.numVal !== null && entry.numVal > 0 && entry.numVal < 100000;

      if (isRealisticAdm) {
        if (minAdm === null || entry.numVal < minAdm) minAdm = entry.numVal;
        if (maxAdm === null || entry.numVal > maxAdm) maxAdm = entry.numVal;

        if (prevNumeric !== null && entry.numVal > prevNumeric + 1) {
          const gapStart = prevNumeric + 1;
          const gapEnd = entry.numVal - 1;
          const gapCount = gapEnd - gapStart + 1;
          totalSkippedNumbers += gapCount;

          const gapObj = {
            type: 'gap',
            isGap: true,
            id: `gap_${gapStart}_${gapEnd}`,
            gapStart,
            gapEnd,
            gapCount,
            prevStudent,
            nextStudent: entry.student
          };

          items.push(gapObj);
          gaps.push(gapObj);
        }

        prevNumeric = entry.numVal;
        prevStudent = entry.student;
      }

      items.push({
        type: 'student',
        isGap: false,
        id: `st_${entry.student.id || idx}_${entry.cleanAdm}`,
        student: entry.student,
        admNo: entry.cleanAdm,
        numVal: entry.numVal,
        isAnomaly: entry.numVal !== null && entry.numVal >= 100000,
        isDuplicate,
        duplicateCount: dupCount
      });
    });

    const span = (minAdm !== null && maxAdm !== null) ? (maxAdm - minAdm + 1) : assignedScopedStudents.length;

    return {
      sequentialAuditorItems: items,
      auditorStats: {
        totalAssigned: assignedScopedStudents.length,
        minAdm,
        maxAdm,
        span,
        totalGaps: gaps.length,
        totalSkippedNumbers,
        duplicatesCount: duplicates.length,
        unassignedCount: unassignedScopedStudents.length
      },
      allGapsList: gaps,
      allDuplicatesList: duplicates
    };
  }, [assignedScopedStudents, unassignedScopedStudents]);

  const displayAuditorItems = useMemo(() => {
    if (auditorFilter === 'unassigned_only') {
      let list = unassignedScopedStudents.map((st, i) => ({
        type: 'student',
        isGap: false,
        id: `unassigned_${st.id || i}`,
        student: st,
        admNo: '— (Missing)',
        numVal: null,
        isDuplicate: false,
        duplicateCount: 1,
        isUnassigned: true
      }));
      if (auditorSearch.trim()) {
        const q = auditorSearch.trim().toLowerCase();
        list = list.filter(item => {
          const s = item.student;
          return (
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.father && s.father.toLowerCase().includes(q)) ||
            (s.rollNo && s.rollNo.toLowerCase().includes(q)) ||
            (s.boardReg && s.boardReg.toLowerCase().includes(q)) ||
            (s.class && s.class.toLowerCase().includes(q))
          );
        });
      }
      return list;
    }

    let items = sequentialAuditorItems;

    if (auditorFilter === 'gaps_only') {
      items = items.filter(it => it.type === 'gap');
    } else if (auditorFilter === 'duplicates_only') {
      items = items.filter(it => it.type === 'student' && it.isDuplicate);
    }

    if (auditorSearch.trim()) {
      const q = auditorSearch.trim().toLowerCase();
      items = items.filter(item => {
        if (item.type === 'gap') {
          const gapStr = `${item.gapStart} ${item.gapEnd}`;
          if (gapStr.includes(q)) return true;
          if (item.prevStudent?.name?.toLowerCase().includes(q)) return true;
          if (item.nextStudent?.name?.toLowerCase().includes(q)) return true;
          return false;
        }
        const s = item.student;
        return (
          item.admNo.toLowerCase().includes(q) ||
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.father && s.father.toLowerCase().includes(q)) ||
          (s.rollNo && s.rollNo.toLowerCase().includes(q)) ||
          (s.boardReg && s.boardReg.toLowerCase().includes(q)) ||
          (s.class && s.class.toLowerCase().includes(q))
        );
      });
    }

    return items;
  }, [sequentialAuditorItems, unassignedScopedStudents, auditorFilter, auditorSearch]);

  const handleExportAuditorExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const ledgerRows = [];
    let seq = 1;
    sequentialAuditorItems.forEach(item => {
      if (item.type === 'gap') {
        ledgerRows.push({
          'Seq #': 'GAP',
          'Admission No.': `${item.gapStart} – ${item.gapEnd}`,
          'Type': `MISSING GAP (${item.gapCount} Nos)`,
          'Class Roll No.': '—',
          'Student Name': `[GAP: ${item.gapCount} Numbers Skipped]`,
          "Father's Name": `After: ${item.prevStudent?.name || 'Start'} (#${item.gapStart - 1}) | Before: ${item.nextStudent?.name || 'End'} (#${item.gapEnd + 1})`,
          'Class': assignClasses.join(', ') || 'All',
          'Session': assignSessionFilter,
          'Board Reg. No.': '—',
          'Admission Date': '—',
          'Status': 'SKIPPED'
        });
      } else {
        const s = item.student;
        ledgerRows.push({
          'Seq #': seq++,
          'Admission No.': item.admNo,
          'Type': item.isDuplicate ? `DUPLICATE (${item.duplicateCount})` : 'Allotted',
          'Class Roll No.': s.rollNo || '—',
          'Student Name': s.name || '—',
          "Father's Name": s.father || '—',
          'Class': s.class || '—',
          'Session': s.session || '—',
          'Board Reg. No.': s.boardReg || '—',
          'Admission Date': s.admDate || '—',
          'Status': s.status || '—'
        });
      }
    });

    const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);
    XLSX.utils.book_append_sheet(wb, wsLedger, 'Sequential Ledger');

    if (allGapsList.length > 0) {
      const gapRows = allGapsList.map((g, idx) => ({
        'Gap #': idx + 1,
        'Gap Start (Adm No)': g.gapStart,
        'Gap End (Adm No)': g.gapEnd,
        'Total Skipped Numbers': g.gapCount,
        'Skipped Numbers Range': g.gapStart === g.gapEnd ? `${g.gapStart}` : `${g.gapStart} to ${g.gapEnd}`,
        'Previous Allotted Student': g.prevStudent ? `${g.prevStudent.name} (Adm: ${g.gapStart - 1}, Roll: ${g.prevStudent.rollNo})` : 'None',
        'Next Allotted Student': g.nextStudent ? `${g.nextStudent.name} (Adm: ${g.gapEnd + 1}, Roll: ${g.nextStudent.rollNo})` : 'None'
      }));
      const wsGaps = XLSX.utils.json_to_sheet(gapRows);
      XLSX.utils.book_append_sheet(wb, wsGaps, 'Gaps & Skipped Nos');
    }

    if (allDuplicatesList.length > 0) {
      const dupRows = [];
      allDuplicatesList.forEach(dup => {
        dup.students.forEach((st, i) => {
          dupRows.push({
            'Duplicate Adm No': dup.admNo,
            'Instance #': i + 1,
            'Of Total': dup.count,
            'Student Name': st.name,
            "Father's Name": st.father,
            'Class': st.class,
            'Session': st.session,
            'Roll No': st.rollNo,
            'Board Reg No': st.boardReg,
            'Admission Date': st.admDate
          });
        });
      });
      const wsDups = XLSX.utils.json_to_sheet(dupRows);
      XLSX.utils.book_append_sheet(wb, wsDups, 'Duplicate Adm Nos');
    }

    if (unassignedScopedStudents.length > 0) {
      const unassignedRows = unassignedScopedStudents.map((st, i) => ({
        'S.No': i + 1,
        'Student Name': st.name,
        "Father's Name": st.father,
        'Class': st.class,
        'Session': st.session,
        'Class Roll No': st.rollNo,
        'Board Reg No': st.boardReg,
        'Admission Date': st.admDate,
        'Status': st.status
      }));
      const wsUnassigned = XLSX.utils.json_to_sheet(unassignedRows);
      XLSX.utils.book_append_sheet(wb, wsUnassigned, 'Unassigned Students');
    }

    const fileName = `Adm_Nos_Sequential_Ledger_${assignSessionFilter}_${assignClasses.join('-') || 'All'}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setToast({ message: `📊 Exported Sequential Ledger & Gap Audit to ${fileName}`, type: 'success' });
  }, [sequentialAuditorItems, allGapsList, allDuplicatesList, unassignedScopedStudents, assignSessionFilter, assignClasses]);

  // -------------------------------------------------------------
  // ASSIGN DATES ENGINE STATE & LOGIC
  // -------------------------------------------------------------
  const [assignDateValue, setAssignDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [assignDateField, setAssignDateField] = useState('admDate');
  const [assignDateSession, setAssignDateSession] = useState('2025-26');
  const [assignDateClass, setAssignDateClass] = useState('ALL');
  const [onlyApprovedDates, setOnlyApprovedDates] = useState(true);
  const [assigningDates, setAssigningDates] = useState(false);

  // Range and student selection states for date assignment
  const [selectedDateIds, setSelectedDateIds] = useState(() => new Set());
  const [dateRangeFrom, setDateRangeFrom] = useState('1');
  const [dateRangeTo, setDateRangeTo] = useState('');
  const [dateRangeType, setDateRangeType] = useState('sno'); // 'sno' | 'roll'
  const [lastDateClickedIdx, setLastDateClickedIdx] = useState(null);
  const [dateSortField, setDateSortField] = useState('rollNo'); // 'rollNo' | 'admNo' | 'name' | 'father' | 'class' | 'currentDate' | 'sno'
  const [dateSortDirection, setDateSortDirection] = useState('asc'); // 'asc' | 'desc'

  const handleDateSort = (field) => {
    if (dateSortField === field) {
      setDateSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDateSortField(field);
      setDateSortDirection('asc');
    }
  };

  const dateTargetStudents = useMemo(() => {
    const list = normalizedStudents.filter(st => {
      const hasRollNo = Boolean(st.rollNo && st.rollNo !== '—' && st.rollNo !== 'NA' && cleanStr(st.rollNo) !== '');
      if (onlyApprovedDates && st.status !== 'Approved' && !hasRollNo) return false;
      if (assignDateSession !== 'ALL' && st.session !== assignDateSession) return false;
      if (assignDateClass !== 'ALL' && !matchesClassVal(assignDateClass, st.class)) return false;
      return true;
    });

    if (dateSortField === 'sno') {
      return dateSortDirection === 'desc' ? [...list].reverse() : list;
    }

    return [...list].sort((a, b) => {
      let comparison = 0;

      if (dateSortField === 'rollNo') {
        const numA = parseInt(String(a.rollNo || '').replace(/\D/g, ''), 10);
        const numB = parseInt(String(b.rollNo || '').replace(/\D/g, ''), 10);
        const hasA = !isNaN(numA);
        const hasB = !isNaN(numB);
        if (hasA && hasB) {
          comparison = numA - numB;
        } else if (hasA) {
          comparison = -1;
        } else if (hasB) {
          comparison = 1;
        } else {
          comparison = (a.name || '').localeCompare(b.name || '');
        }
      } else if (dateSortField === 'admNo') {
        const numA = parseInt(String(a.admNo || '').replace(/\D/g, ''), 10);
        const numB = parseInt(String(b.admNo || '').replace(/\D/g, ''), 10);
        const hasA = !isNaN(numA);
        const hasB = !isNaN(numB);
        if (hasA && hasB && numA !== numB) {
          comparison = numA - numB;
        } else {
          comparison = (a.admNo || '').localeCompare(b.admNo || '');
        }
      } else if (dateSortField === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (dateSortField === 'father') {
        comparison = (a.father || '').localeCompare(b.father || '');
      } else if (dateSortField === 'class') {
        comparison = (a.class || '').localeCompare(b.class || '');
      } else if (dateSortField === 'currentDate') {
        const dateA = assignDateField === 'admDate' ? (a.admDate || '') : (a.onlineStatus || '');
        const dateB = assignDateField === 'admDate' ? (b.admDate || '') : (b.onlineStatus || '');
        comparison = dateA.localeCompare(dateB);
      }

      if (comparison === 0) {
        comparison = (a.name || '').localeCompare(b.name || '');
      }

      return dateSortDirection === 'desc' ? -comparison : comparison;
    });
  }, [normalizedStudents, onlyApprovedDates, assignDateSession, assignDateClass, dateSortField, dateSortDirection, assignDateField]);

  // Synchronize selection to target students when class, session, or approval scope changes
  const targetDateScopeKey = `${assignDateSession}_${assignDateClass}_${onlyApprovedDates}`;
  const prevDateScopeRef = useRef('');

  useEffect(() => {
    if (prevDateScopeRef.current !== targetDateScopeKey) {
      prevDateScopeRef.current = targetDateScopeKey;
      setSelectedDateIds(new Set(dateTargetStudents.map(st => st.id)));
      setDateRangeFrom('1');
      setDateRangeTo(String(dateTargetStudents.length || ''));
    }
  }, [targetDateScopeKey, dateTargetStudents]);

  const effectiveTargetStudents = useMemo(() => {
    return dateTargetStudents.filter(st => selectedDateIds.has(st.id));
  }, [dateTargetStudents, selectedDateIds]);

  const handleSelectDateRange = (fromVal, toVal, type = dateRangeType) => {
    const fromNum = parseInt(fromVal, 10);
    const toNum = parseInt(toVal, 10);
    if (isNaN(fromNum) || isNaN(toNum)) {
      setToast({ message: '⚠️ Please enter valid From and To numbers for the range.', type: 'error' });
      return;
    }
    const low = Math.min(fromNum, toNum);
    const high = Math.max(fromNum, toNum);

    const newSet = new Set();
    if (type === 'roll') {
      dateTargetStudents.forEach(st => {
        const r = parseInt(st.rollNo, 10);
        if (!isNaN(r) && r >= low && r <= high) {
          newSet.add(st.id);
        }
      });
    } else {
      // By serial # (1-based index)
      dateTargetStudents.forEach((st, idx) => {
        const sno = idx + 1;
        if (sno >= low && sno <= high) {
          newSet.add(st.id);
        }
      });
    }

    setSelectedDateIds(newSet);
    setToast({
      message: `🎯 Selected ${newSet.size} students (Range: ${low} to ${high})`,
      type: 'info'
    });
  };

  const handleNextDateRange = () => {
    const fromNum = parseInt(dateRangeFrom, 10) || 1;
    const toNum = parseInt(dateRangeTo, 10) || 50;
    const batchSize = Math.max(1, toNum - fromNum + 1);

    const nextFrom = toNum + 1;
    const nextTo = Math.min(dateTargetStudents.length, toNum + batchSize);

    if (nextFrom > dateTargetStudents.length) {
      setToast({ message: '⚠️ Already at the end of the student list.', type: 'info' });
      return;
    }

    setDateRangeFrom(String(nextFrom));
    setDateRangeTo(String(nextTo));
    handleSelectDateRange(nextFrom, nextTo, dateRangeType);
  };

  const handleToggleStudent = (stId, idx, e) => {
    const newSet = new Set(selectedDateIds);
    if (e?.shiftKey && lastDateClickedIdx !== null) {
      const start = Math.min(lastDateClickedIdx, idx);
      const end = Math.max(lastDateClickedIdx, idx);
      const shouldSelect = !selectedDateIds.has(stId);
      for (let i = start; i <= end; i++) {
        const targetId = dateTargetStudents[i]?.id;
        if (targetId) {
          if (shouldSelect) newSet.add(targetId);
          else newSet.delete(targetId);
        }
      }
    } else {
      if (newSet.has(stId)) {
        newSet.delete(stId);
      } else {
        newSet.add(stId);
      }
    }
    setLastDateClickedIdx(idx);
    setSelectedDateIds(newSet);
  };

  const handleToggleAllDates = () => {
    if (selectedDateIds.size === dateTargetStudents.length) {
      setSelectedDateIds(new Set());
    } else {
      setSelectedDateIds(new Set(dateTargetStudents.map(st => st.id)));
    }
  };

  const handleRunAssignDates = async () => {
    if (effectiveTargetStudents.length === 0) {
      setToast({ message: '⚠️ No students selected. Please select a range or check students to assign date.', type: 'error' });
      return;
    }
    setAssigningDates(true);
    const totalCount = effectiveTargetStudents.length;
    const fieldLabel = assignDateField === 'admDate' ? 'Admission Date' : 'Online Submission Date';

    setTaskProgress({
      title: `Bulk Assigning ${fieldLabel}`,
      step: `Preparing to assign date (${formatRegisterDate(assignDateValue) || assignDateValue}) to ${totalCount} students...`,
      progress: 5,
      current: 0,
      total: totalCount,
      icon: 'calendar'
    });

    const batchSize = 400; // Stay well within Firestore 500 ops limit
    const totalBatches = Math.ceil(totalCount / batchSize);
    let count = 0;

    try {
      const fieldKey = assignDateField === 'admDate' ? 'Adm. Date' : 'Online Subm. Date';
      const aliasKey = assignDateField === 'admDate' ? 'admDate' : 'onlineSubmDate';
      const dateToSave = formatRegisterDate(assignDateValue) || assignDateValue;

      for (let b = 0; b < totalBatches; b++) {
        const batchSlice = effectiveTargetStudents.slice(b * batchSize, (b + 1) * batchSize);
        const batch = writeBatch(db);

        setTaskProgress({
          title: `Bulk Assigning ${fieldLabel}`,
          step: `Writing Firestore batch ${b + 1} of ${totalBatches} (${count} / ${totalCount} saved)...`,
          progress: 10 + Math.round((b / totalBatches) * 75),
          current: count,
          total: totalCount,
          icon: 'calendar'
        });

        for (const st of batchSlice) {
          const docRef = doc(db, 'admissions', st.id);
          const payload = {
            [fieldKey]: dateToSave,
            [aliasKey]: dateToSave,
            updatedAt: new Date().toISOString(),
            lastEditedBy: `Admin (${user?.email || 'Assign Dates'})`
          };
          batch.set(docRef, payload, { merge: true });
          updateCachedItem('admissions', st.id, payload);
          count++;
        }

        await batch.commit();
      }

      // Update local dataset state immediately with DD-MM-YYYY date so table updates in real-time
      setDataset(prev => {
        const idSet = new Set(effectiveTargetStudents.map(s => s.id));
        return prev.map(item => {
          if (idSet.has(item.id)) {
            return {
              ...item,
              [fieldKey]: dateToSave,
              [aliasKey]: dateToSave
            };
          }
          return item;
        });
      });

      // Non-blocking activity logging
      logAdminActivity({
        actionType: 'batch_date_assign',
        actionTitle: `Bulk Assigned ${assignDateField === 'admDate' ? 'Admission Date' : 'Submission Date'}`,
        details: `Assigned date ${dateToSave} to ${effectiveTargetStudents.length} students.`,
        metadata: { date: dateToSave, count: effectiveTargetStudents.length }
      }).catch(() => {});

      // Immediately clear progress modal for instant responsiveness
      setTaskProgress(null);

      // Snappy toast showing date in DD-MM-YYYY format
      setToast({ message: `✨ Applied date (${dateToSave}) to ${effectiveTargetStudents.length} records!`, type: 'success' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Assign Dates error:', err);
      setTaskProgress(null);
      setToast({ message: `❌ Failed to assign dates: ${err.message}`, type: 'error' });
    } finally {
      setAssigningDates(false);
    }
  };

  // Native Excel (.xlsx) Export for Admission Register and Sentup with Real-Time Progress
  const handleExportExcel = async () => {
    if (filteredStudents.length === 0) {
      setToast({ message: '⚠️ No student records to export for current filter criteria.', type: 'info' });
      return;
    }

    const isRegister = activeTab === 'adm_register';
    const reportTitle = isRegister ? 'Official Admission Register' : 'JKBOSE Examination Sentup';

    setTaskProgress({
      title: `Exporting ${reportTitle}`,
      step: 'Compiling candidate records & column definitions...',
      progress: 20,
      icon: 'excel'
    });

    // Allow UI to paint progress window
    await new Promise(r => setTimeout(r, 60));

    try {
      if (isRegister) {
        const headers = [
          'S.No.', 'Class Roll No.', 'Form No.', 'Status', 'Admission Type', 'Online Subm.', 'Adm. Date', 'Adm. No.', 'Old Adm. No.', 'Class', 'Board Reg. No.',
          "Student's Name", "Father's Name", "Mother's Name", 'DOB (Figures)', 'DOB (Words)', 'Gender',
          'Village/Town', 'Block', 'Tehsil', 'District', 'Student Mobile', 'Parent Mobile',
          'Stream', 'Chosen Subjects', 'Aadhaar No.', 'Social Category', 'Socio-Economic Category', 'Blood Group',
          'Bank Account No.', 'IFSC Code', 'PEN (UDISE)', 'Previous School', 'Prev Roll No', 'Prev Result',
          'Admtd. Vide DC/CC', 'Withdrawal Date', 'Issued DC/CC', 'DC/CC Receipt', 'Remarks'
        ];

        setTaskProgress({
          title: `Exporting ${reportTitle}`,
          step: `Formatting ${filteredStudents.length} rows for Admission Register spreadsheet...`,
          progress: 50,
          current: filteredStudents.length,
          total: filteredStudents.length,
          icon: 'excel'
        });
        await new Promise(r => setTimeout(r, 40));

        const rows = filteredStudents.map(s => [
          s.sno,
          s.rollNo || '',
          s.formNo || '',
          s.status || '',
          s.isReadmission ? 'Re-admission' : 'Fresh',
          formatRegisterDate(s.onlineStatus) || s.onlineStatus || '',
          formatRegisterDate(s.admDate) || s.admDate || '',
          s.oldAdmNo && s.oldAdmNo !== s.admNo && s.oldAdmNo !== '—' ? `${s.admNo || ''} (${String(s.oldAdmNo).replace(/^\(|\)$/g, '').trim()})` : (s.admNo || ''),
          s.oldAdmNo || '',
          s.class || '',
          s.boardReg || '',
          s.name || '',
          s.father || '',
          s.mother || '',
          formatRegisterDate(s.dobFigures) || s.dobFigures || '',
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
          formatRegisterDate(s.withdrawal) || s.withdrawal || '',
          s.issuedCC || '',
          s.receipt || '',
          s.remarks || ''
        ]);

        setTaskProgress({
          title: `Exporting ${reportTitle}`,
          step: 'Building binary workbook & generating download...',
          progress: 85,
          icon: 'excel'
        });
        await new Promise(r => setTimeout(r, 40));

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Admission_Register');
        const filename = `HSS_Shangus_Official_Admission_Register_${selectedSession}_${selectedClass}_${selectedStatus}.xlsx`;
        XLSX.writeFile(wb, filename);
      } else {
        const colDefs = [
          { key: 'st_sno', label: 'S.No.', get: s => s.sno },
          { key: 'st_admNo', label: 'Adm. No.', get: s => (s.oldAdmNo && s.oldAdmNo !== s.admNo && s.oldAdmNo !== '—' ? `${s.admNo || ''} (${String(s.oldAdmNo).replace(/^\(|\)$/g, '').trim()})` : (s.admNo || '')) },
          { key: 'st_rollNo', label: 'Class Roll No.', get: s => s.rollNo || '' },
          { key: 'st_boardReg', label: 'Board Reg. No.', get: s => s.boardReg || '' },
          { key: 'st_name', label: "Student's Name", get: s => s.name || '' },
          { key: 'st_parentage', label: "Father's Name", get: s => s.father || '' },
          { key: 'st_parentage', label: "Mother's Name", get: s => s.mother || '' },
          { key: 'st_dob', label: 'Date of Birth', get: s => formatRegisterDate(s.dobFigures) || s.dobFigures || '' },
          { key: 'st_subs', label: 'Subjects', get: s => s.subs || '' },
          { key: 'st_boardRoll', label: 'Board Roll No.', get: s => s.boardRollNo || '' },
          { key: 'st_result', label: 'Result', get: s => s.currentResult || '' },
          { key: 'st_admitReceipt', label: 'Admit Card Receipt', get: () => '' },
          { key: 'st_marksReceipt', label: 'Marks Card Receipt', get: () => '' }
        ];

        const activeColDefs = colDefs.filter(c => isSentupColVisible(c.key));
        const headers = activeColDefs.map(c => c.label);
        const exportList = activeIncludedRows || filteredStudents;

        setTaskProgress({
          title: `Exporting ${reportTitle}`,
          step: `Formatting ${exportList.length} rows for Sentup examination spreadsheet...`,
          progress: 50,
          current: exportList.length,
          total: exportList.length,
          icon: 'excel'
        });
        await new Promise(r => setTimeout(r, 40));

        const rows = exportList.map(s => activeColDefs.map(c => c.get(s)));

        setTaskProgress({
          title: `Exporting ${reportTitle}`,
          step: 'Building binary workbook & generating download...',
          progress: 85,
          icon: 'excel'
        });
        await new Promise(r => setTimeout(r, 40));

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'JKBOSE_Sentup');
        const filename = `HSS_Shangus_JKBOSE_Sentup_${selectedSession}_${selectedClass}_${selectedStatus}.xlsx`;
        XLSX.writeFile(wb, filename);
      }

      setTaskProgress(null);
      setToast({ message: '📊 Excel spreadsheet downloaded successfully!', type: 'success' });
    } catch (err) {
      console.error('Excel Export Error:', err);
      setTaskProgress(null);
      setToast({ message: `❌ Export failed: ${err.message}`, type: 'error' });
    }
  };

  // Dynamic Print Dimensions for JKBOSE / Indian Legal (Default: 13.7in x 8.5in), Standard Legal, or A4
  const isA4 = paperSize === 'a4';
  const isStandardLegal = paperSize === 'legal';
  // Use recognized paper keywords 'legal landscape' (14"x8.5" / 13.7"x8.5") or 'a4 landscape' (297x210mm)
  const pageSizeCss = isA4 ? 'a4 landscape' : 'legal landscape';

  const currentStudentsPerPage = activeTab === 'sentup' ? (sentupStudentsPerPage || 10) : (studentsPerPage || 15);

  // Extended page height budget: A4 is 210mm high, Legal is 215.9mm high.
  // Target total sheet height extends close to bottom: ~186.5mm for A4, ~192.5mm for Legal (comfortably within printable boundary).
  // Admission Register budget: Header (10mm) + margin (1mm) + thead (11mm) + signatures (10.5mm) + margin (1mm) = 33.5mm.
  // Rows budget: Legal = 159.0mm (10.6mm/row for 15 rows, total sheet ~192.5mm <= 195.58mm printable area).
  //              A4    = 153.0mm (10.2mm/row for 15 rows, total sheet ~186.5mm <= 189.68mm printable area).
  const registerRowsBudgetMm = isA4 ? 153.0 : 159.0;
  const registerRowHeightMm = Math.max(5.5, Math.floor((registerRowsBudgetMm / (studentsPerPage || 15)) * 10) / 10).toFixed(1);
  const registerTbodyHeightMm = (parseFloat(registerRowHeightMm) * (studentsPerPage || 15)).toFixed(1);
  const registerTableHeightMm = (11.0 + parseFloat(registerTbodyHeightMm)).toFixed(1);

  // Sentup Roll Sheet budget: Header (10mm) + margin (1mm) + thead (6.0mm) + signatures (7.5mm) + margin (1mm) = 25.5mm.
  // Rows budget: Legal = 156.0mm (15.6mm/row for 10 rows, total sheet ~181.5mm <= 195.58mm printable area).
  //              A4    = 151.0mm (15.1mm/row for 10 rows, total sheet ~176.5mm <= 189.68mm printable area).
  const sentupRowsBudgetMm = isA4 ? 151.0 : 156.0;
  const sentupRowHeightMm = Math.max(6.0, Math.floor((sentupRowsBudgetMm / (sentupStudentsPerPage || 10)) * 10) / 10).toFixed(1);
  const sentupTbodyHeightMm = (parseFloat(sentupRowHeightMm) * (sentupStudentsPerPage || 10)).toFixed(1);
  const sentupTableHeightMm = (6.0 + parseFloat(sentupTbodyHeightMm)).toFixed(1);

  const calculatedRowHeightMm = activeTab === 'sentup' ? sentupRowHeightMm : registerRowHeightMm;

  return (
    <div ref={suiteRootRef} className="admission-suite-root min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* ─── DYNAMIC PRINT CSS STYLESHEET (STRICT CLEAN 13.7" x 8.5" JKBOSE / LEGAL LANDSCAPE) ─── */}
      <style>{`
        /* ─── PREMIUM TYPOGRAPHY SYSTEM ─── */
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Merriweather:wght@400;700;900&display=swap');

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

          .admission-suite-root .admission-suite-toolbar,
          .admission-suite-root header, .admission-suite-root nav, .admission-suite-root footer,
          .admission-suite-root aside, .admission-suite-root .no-print, .admission-suite-root button,
          .admission-suite-root select, .admission-suite-root input, .admission-suite-root .screen-only,
          .admission-suite-root .fixed, .admission-suite-root .sticky, .global-hud,
          .admission-suite-root .print\\:hidden, [class*="print:hidden"] {
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
            page-break-after: auto !important;
            break-after: auto !important;
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
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .spread-container {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          .spread-container .register-ledger-page:first-child {
            page-break-after: always !important;
            break-after: page !important;
          }

          .spread-container:not(:last-child) .register-ledger-page:last-child {
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

          .register-ledger-page .admission-spread-table,
          .admission-spread-table {
            display: table !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: ${registerTableHeightMm}mm !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: ${currentStudentsPerPage >= 16 ? '7.5px' : '8.0px'} !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .register-ledger-page .admission-spread-table tbody {
            height: auto !important;
            min-height: 0 !important;
            max-height: ${registerTbodyHeightMm}mm !important;
            box-sizing: border-box !important;
          }

          /* Header locked strictly to 10mm on Part 1 and Part 2 */
          .register-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            height: 10mm !important;
            min-height: 10mm !important;
            max-height: 10mm !important;
            margin-bottom: 1mm !important;
            padding-bottom: 0.5mm !important;
            border-bottom: 1.5px solid #0f172a !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .register-header h2 {
            font-size: 13px !important;
            line-height: 1.05 !important;
            margin: 0 !important;
          }

          .register-header .register-header-sub {
            font-size: 8px !important;
            line-height: 1.05 !important;
            margin-top: 0.3mm !important;
          }

          /* Thead locked strictly to 11mm (5.5mm per row) on both Part 1 and Part 2 */
          .register-ledger-page .admission-spread-table thead {
            height: 11mm !important;
            min-height: 11mm !important;
            max-height: 11mm !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
          }

          .register-ledger-page .admission-spread-table thead tr {
            height: 5.5mm !important;
            min-height: 5.5mm !important;
            max-height: 5.5mm !important;
            box-sizing: border-box !important;
          }

          .register-ledger-page .admission-spread-table thead th {
            height: 5.5mm !important;
            min-height: 5.5mm !important;
            max-height: 5.5mm !important;
            padding: 0.1mm 0.3mm !important;
            font-size: 7px !important;
            font-weight: 800 !important;
            line-height: 1.05 !important;
            vertical-align: middle !important;
            text-align: center !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            white-space: normal !important;
          }

          .register-ledger-page .admission-spread-table thead th[rowspan="2"] {
            height: 11mm !important;
            min-height: 11mm !important;
            max-height: 11mm !important;
          }

          .register-ledger-page .admission-spread-table thead th > span,
          .register-ledger-page .admission-spread-table thead th > div {
            max-height: 10.5mm !important;
            overflow: hidden !important;
          }

          /* Sentup table universal stretching */
          .sentup-table th,
          .sentup-table td {
            min-width: 0 !important;
            max-width: none !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }

          /* Every student row strictly locked to registerRowHeightMm on both Part 1 and Part 2 */
          .admission-spread-table .register-resizable-row,
          .admission-spread-table tbody tr {
            height: ${registerRowHeightMm}mm !important;
            min-height: ${registerRowHeightMm}mm !important;
            max-height: ${registerRowHeightMm}mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .admission-spread-table .register-resizable-row > td,
          .admission-spread-table tbody tr > td {
            height: ${registerRowHeightMm}mm !important;
            min-height: ${registerRowHeightMm}mm !important;
            max-height: ${registerRowHeightMm}mm !important;
            padding: 0 0.35mm !important;
            font-size: ${currentStudentsPerPage >= 16 ? '7.5px' : '8.0px'} !important;
            line-height: 1.08 !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            text-overflow: ellipsis !important;
          }

          /* Wrap words in text-heavy columns (Part 1: Name, Parentage, DOB Words, Address; Part 2: Subs, Prev School, Remarks) */
          .admission-spread-table td[data-col="name"],
          .admission-spread-table td[data-col="father"],
          .admission-spread-table td[data-col="mother"],
          .admission-spread-table td[data-col="dobWords"],
          .admission-spread-table td[data-col="village"],
          .admission-spread-table td[data-col="admDate"],
          .admission-spread-table td[data-col="p2_subs"],
          .admission-spread-table td[data-col="p2_prevSchool"],
          .admission-spread-table td[data-col="p2_remarks"],
          .admission-spread-table td.cell-wrap {
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            text-overflow: clip !important;
          }

          .admission-spread-table td[data-col="admDate"] {
            text-align: center !important;
          }

          .admission-spread-table td[data-col="p2_prevRoll"] {
            font-size: ${currentStudentsPerPage >= 16 ? '5.0px' : '5.5px'} !important;
            line-height: 1.1 !important;
            white-space: nowrap !important;
          }
          .admission-spread-table td[data-col="p2_prevResult"],
          .admission-spread-table td[data-col="p2_prevResult"] span {
            font-size: ${currentStudentsPerPage >= 16 ? '6.0px' : '6.5px'} !important;
            line-height: 1.1 !important;
          }

          .admission-spread-table td[data-col="p2_account"] .account-num {
            font-size: ${currentStudentsPerPage >= 16 ? '8.2px' : '9.0px'} !important;
          }
          .admission-spread-table td[data-col="p2_account"] .ifsc-code {
            font-size: ${currentStudentsPerPage >= 16 ? '7.2px' : '8.0px'} !important;
          }

          .admission-spread-table td[data-col="p2_prevSchool"],
          .admission-spread-table td[data-col="p2_prevSchool"] > div {
            font-size: ${currentStudentsPerPage >= 16 ? '7.8px' : '8.5px'} !important;
          }

          .admission-spread-table td[data-col="p2_pen"],
          .admission-spread-table td[data-col="p2_pen"] .pen-val {
            font-size: ${currentStudentsPerPage >= 16 ? '7.8px' : '8.5px'} !important;
          }
          .admission-spread-table td[data-col="p2_pen"] .pen-sub {
            font-size: ${currentStudentsPerPage >= 16 ? '6.8px' : '7.5px'} !important;
          }

          .admission-spread-table td[data-col="p2_prevCC"],
          .admission-spread-table td[data-col="p2_prevCC"] .cc-val {
            font-size: ${currentStudentsPerPage >= 16 ? '7.8px' : '8.5px'} !important;
          }
          .admission-spread-table td[data-col="p2_prevCC"] .cc-date {
            font-size: ${currentStudentsPerPage >= 16 ? '7.0px' : '7.8px'} !important;
          }

          .admission-spread-table tbody tr > td * {
            box-sizing: border-box !important;
          }

          /* General cell inner element containment to prevent row stretching on Part 1 and Part 2 */
          .admission-spread-table tbody tr > td > div:not(.register-photo-inner),
          .admission-spread-table tbody tr > td > span {
            max-height: calc(${registerRowHeightMm}mm - 0.2mm) !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          /* Reset margins on all cell divs to prevent row expansion in print */
          .admission-spread-table tbody tr > td div {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
          }

          /* Multi-line cells in Part 1 and Part 2 (DOB words, online status, receipt, subs, account, prevSchool, remarks) */
          .admission-spread-table td .line-clamp-2,
          .admission-spread-table td div.truncate {
            line-height: 1.06 !important;
            max-height: calc(${registerRowHeightMm}mm - 0.3mm) !important;
            overflow: hidden !important;
          }

          .admission-spread-table td:not([data-col="name"]):not([data-col="father"]):not([data-col="mother"]):not([data-col="dobWords"]) .line-clamp-2 {
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            font-size: ${currentStudentsPerPage >= 16 ? '7.0px' : '7.5px'} !important;
          }

          /* DoB (in words) allow up to 3 lines with word wrapping so full words are never truncated */
          .admission-spread-table td[data-col="dobWords"] .dob-words-wrap,
          .admission-spread-table td[data-col="dobWords"] .line-clamp-3,
          .admission-spread-table td[data-col="dobWords"] .line-clamp-2 {
            display: -webkit-box !important;
            -webkit-line-clamp: 3 !important;
            -webkit-box-orient: vertical !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            line-height: 1.08 !important;
            max-height: calc(${registerRowHeightMm}mm - 0.2mm) !important;
            overflow: hidden !important;
            font-size: ${currentStudentsPerPage >= 16 ? '6.8px' : '7.2px'} !important;
          }

          /* Remarks specifically: allow up to 4-5 lines with word wrapping to show full text without truncation */
          .admission-spread-table td[data-col="p2_remarks"] .remarks-wrap,
          .admission-spread-table td[data-col="p2_remarks"] .line-clamp-4,
          .admission-spread-table td[data-col="p2_remarks"] .line-clamp-3 {
            display: -webkit-box !important;
            -webkit-line-clamp: 5 !important;
            -webkit-box-orient: vertical !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            line-height: 1.1 !important;
            max-height: calc(${registerRowHeightMm}mm - 0.2mm) !important;
            overflow: hidden !important;
            font-size: ${currentStudentsPerPage >= 16 ? '6.8px' : '7.2px'} !important;
          }

          /* Board Registration in Print (both split and single-line) */
          .admission-spread-table .st-reg-split,
          .admission-spread-table .st-reg-split span,
          .admission-spread-table td span.font-mono,
          .admission-spread-table td span.font-black.font-mono {
            font-size: ${currentStudentsPerPage >= 16 ? '10.5px' : '11.0px'} !important;
            line-height: 1.05 !important;
            white-space: nowrap !important;
          }

          /* Form No & Online status sizing in Print */
          .admission-spread-table tbody tr > td div.font-bold,
          .admission-spread-table tbody tr > td div.text-\[8\.5px\],
          .admission-spread-table tbody tr > td div.text-\[8\.2px\] {
            font-size: ${currentStudentsPerPage >= 16 ? '7.6px' : '8.2px'} !important;
            line-height: 1.05 !important;
          }

          .admission-spread-table tbody tr > td div.text-\[6\.5px\],
          .admission-spread-table tbody tr > td div.text-\[6\.8px\],
          .admission-spread-table tbody tr > td span.text-\[7px\],
          .admission-spread-table tbody tr > td span.text-\[6px\] {
            font-size: ${currentStudentsPerPage >= 16 ? '6.5px' : '6.8px'} !important;
            line-height: 1.05 !important;
            margin-top: 0 !important;
          }

          /* Admission No, Old Adm No and Re-Adm Label in Print */
          .admission-spread-table td[data-col="admNo"] {
            text-align: center !important;
            vertical-align: middle !important;
          }
          .admission-spread-table td[data-col="admNo"] div.ledger-mono-font,
          .admission-spread-table tbody tr > td div.text-\[9px\] {
            font-size: ${currentStudentsPerPage >= 16 ? '8.5px' : '9.0px'} !important;
            line-height: 1.05 !important;
            font-weight: 900 !important;
          }

          .admission-spread-table td[data-col="admNo"] div.text-\[7\.5px\],
          .admission-spread-table tbody tr > td div.text-\[7\.5px\] {
            font-size: ${currentStudentsPerPage >= 16 ? '7.0px' : '7.5px'} !important;
            line-height: 1.05 !important;
            font-weight: 700 !important;
            color: #7e22ce !important;
          }

          .admission-spread-table td[data-col="admNo"] .readm-badge,
          .admission-spread-table td[data-col="admNo"] div.text-\[6\.8px\] {
            font-size: ${currentStudentsPerPage >= 16 ? '6.4px' : '6.8px'} !important;
            line-height: 1.05 !important;
            font-weight: 900 !important;
            color: #065f46 !important;
            letter-spacing: -0.2px !important;
          }

          /* Candidate Name, Father Name, Mother Name in Print */
          .admission-spread-table td[data-col="name"],
          .admission-spread-table td[data-col="name"] div,
          .admission-spread-table td[data-col="name"] span,
          .admission-spread-table td.group\/name-cell > div,
          .admission-spread-table td div.font-black.uppercase {
            font-size: ${currentStudentsPerPage >= 16 ? '9.5px' : '10.0px'} !important;
            line-height: 1.15 !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            font-weight: 900 !important;
          }

          .admission-spread-table td[data-col="father"],
          .admission-spread-table td[data-col="father"] div,
          .admission-spread-table td[data-col="mother"],
          .admission-spread-table td[data-col="mother"] div,
          .admission-spread-table tbody tr > td:nth-child(10),
          .admission-spread-table tbody tr > td:nth-child(11) {
            font-size: ${currentStudentsPerPage >= 16 ? '9.0px' : '9.5px'} !important;
            line-height: 1.15 !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            font-weight: 700 !important;
          }

          /* Address and Contact cells */
          .admission-spread-table tbody tr > td.bg-yellow-50,
          .admission-spread-table tbody tr > td.bg-yellow-50 * {
            font-size: ${currentStudentsPerPage >= 16 ? '7.2px' : '7.8px'} !important;
            line-height: 1.08 !important;
          }

          /* Photo cell strict containment on Part 1 */
          .register-photo-cell {
            padding: 0 !important;
            height: ${registerRowHeightMm}mm !important;
            min-height: ${registerRowHeightMm}mm !important;
            max-height: ${registerRowHeightMm}mm !important;
            width: 10mm !important;
            min-width: 9mm !important;
            max-width: 11mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            vertical-align: middle !important;
            text-align: center !important;
          }

          .register-photo-inner {
            height: calc(${registerRowHeightMm}mm - 0.3mm) !important;
            max-height: calc(${registerRowHeightMm}mm - 0.3mm) !important;
            width: 100% !important;
            overflow: hidden !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }

          .register-photo-cell img {
            height: calc(${registerRowHeightMm}mm - 0.5mm) !important;
            max-height: calc(${registerRowHeightMm}mm - 0.5mm) !important;
            width: auto !important;
            max-width: 9.5mm !important;
            object-fit: contain !important;
            object-position: center center !important;
            display: block !important;
            margin: 0 auto !important;
          }

          .photo-fallback.hidden {
            display: none !important;
          }

          .admission-spread-table th[data-col="sno"],
          .admission-spread-table th[data-col="p2_sno"],
          .sentup-table th[data-col="st_sno"] {
            width: 10mm !important;
            min-width: 9mm !important;
            max-width: 12mm !important;
          }

          .register-photo-cell img {
            height: calc(${registerRowHeightMm}mm - 0.4mm) !important;
            max-height: calc(${registerRowHeightMm}mm - 0.4mm) !important;
            width: auto !important;
            max-width: 9.5mm !important;
            object-fit: contain !important;
            object-position: center center !important;
            display: block !important;
            margin: 0 auto !important;
          }

          /* Distinct vertical handwriting cells in Part 2 (ISSUED DC/CC & RECEIPT) */
          .admission-spread-table td.register-handwrite-cell {
            padding: 0.3mm 0.5mm !important;
            vertical-align: top !important;
            white-space: normal !important;
          }
          .admission-spread-table td.register-handwrite-cell .handwrite-container {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 100% !important;
            min-height: calc(${registerRowHeightMm}mm - 0.6mm) !important;
            max-height: calc(${registerRowHeightMm}mm - 0.2mm) !important;
            box-sizing: border-box !important;
          }
          .admission-spread-table td.register-handwrite-cell .handwrite-container > .handwrite-line:last-child {
            margin-top: auto !important;
          }
          .admission-spread-table td.register-handwrite-cell .handwrite-line {
            display: flex !important;
            align-items: center !important;
            gap: 1px !important;
            line-height: 1.0 !important;
          }
          .admission-spread-table td.register-handwrite-cell .handwrite-label {
            font-size: ${currentStudentsPerPage >= 16 ? '6.2px' : '6.8px'} !important;
            font-weight: 700 !important;
            color: #1e293b !important;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
          }
          .admission-spread-table td.register-handwrite-cell .handwrite-guide {
            flex: 1 1 auto !important;
            border-bottom: 0.5px dotted #64748b !important;
            min-height: 2px !important;
          }

          .register-ledger-page .signature-footer {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-end !important;
            margin-top: 1mm !important;
            height: 10.5mm !important;
            min-height: 10.5mm !important;
            max-height: 10.5mm !important;
            padding: 0.8mm 0 0.2mm !important;
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
            font-size: 8.5px !important;
            font-weight: 900 !important;
            color: #991b1b !important;
            border-top: 1.2px solid #991b1b !important;
            padding-top: 0.6mm !important;
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
            height: 10mm !important;
            min-height: 10mm !important;
            max-height: 10mm !important;
            margin-bottom: 1mm !important;
            padding-bottom: 0.5mm !important;
            border-bottom: 1.5px solid #0f172a !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
            overflow: hidden !important;
          }

          .manual-sno-circle {
            width: 16px !important;
            height: 16px !important;
            min-width: 16px !important;
            min-height: 16px !important;
            border-radius: 50% !important;
            border: 1.2px solid #0f172a !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
          }

          .sentup-ledger-page .sentup-header h1 {
            font-size: 13px !important;
            font-weight: 900 !important;
            line-height: 1.1 !important;
            margin: 0 !important;
            padding: 0 !important;
            letter-spacing: 0.02em !important;
            color: #991b1b !important;
          }

          .sentup-ledger-page .sentup-header .sentup-subtitle {
            font-size: 7.5px !important;
            font-weight: 800 !important;
            line-height: 1.1 !important;
            margin-top: 0.5px !important;
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
            height: auto !important;
            min-height: 0 !important;
            max-height: ${sentupTableHeightMm}mm !important;
            border-collapse: collapse !important;
            font-size: 7.5px !important;
            line-height: 1.1 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
          }

          .sentup-table thead {
            display: table-header-group !important;
            height: 6mm !important;
            min-height: 6mm !important;
            max-height: 6mm !important;
            flex-shrink: 0 !important;
          }

          .sentup-table thead tr {
            height: 6mm !important;
            min-height: 6mm !important;
            max-height: 6mm !important;
          }

          .sentup-table th {
            padding: 0.5px 1.5px !important;
            font-size: 7px !important;
            line-height: 1.05 !important;
            font-weight: 800 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .sentup-table tbody {
            display: table-row-group !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: ${sentupTbodyHeightMm}mm !important;
            box-sizing: border-box !important;
          }

          .sentup-table tbody tr,
          .sentup-table .register-resizable-row {
            display: table-row !important;
            height: ${sentupRowHeightMm}mm !important;
            min-height: ${sentupRowHeightMm}mm !important;
            max-height: ${sentupRowHeightMm}mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .sentup-table tbody tr > td,
          .sentup-table .register-resizable-row > td,
          .sentup-table td {
            height: ${sentupRowHeightMm}mm !important;
            min-height: ${sentupRowHeightMm}mm !important;
            max-height: ${sentupRowHeightMm}mm !important;
            padding: 0.2mm 0.5mm !important;
            line-height: 1.1 !important;
            font-size: 7.5px !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .sentup-table tbody tr > td > div:not(.st-receipt-inner):not(.sentup-photo-inner),
          .sentup-table tbody tr > td > span {
            max-height: calc(${sentupRowHeightMm}mm - 0.4mm) !important;
            overflow: hidden !important;
            line-height: 1.05 !important;
          }

          .sentup-table th[data-col="st_photo"],
          .sentup-table td.sentup-photo-cell {
            width: 12mm !important;
            min-width: 10mm !important;
            max-width: 14mm !important;
            height: ${sentupRowHeightMm}mm !important;
            min-height: ${sentupRowHeightMm}mm !important;
            max-height: ${sentupRowHeightMm}mm !important;
            padding: 0 !important;
            text-align: center !important;
            vertical-align: middle !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          .sentup-photo-inner {
            height: ${sentupRowHeightMm}mm !important;
            max-height: ${sentupRowHeightMm}mm !important;
            width: 100% !important;
            overflow: hidden !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0.1mm !important;
            box-sizing: border-box !important;
          }

          .sentup-table .sentup-photo-cell img,
          .sentup-table td.sentup-photo-cell img {
            max-height: calc(${sentupRowHeightMm}mm - 0.6mm) !important;
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
            padding: 0.1mm 0.3mm !important;
            overflow: hidden !important;
          }

          .sentup-table .st-subs-item {
            font-size: 6.5px !important;
            line-height: 1.05 !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
          }

          .sentup-table th[data-col="st_boardRoll"],
          .sentup-table th.th-col-st_boardRoll,
          .sentup-table td.st-boardroll-cell {
            width: 22mm !important;
            padding: 0.2mm 0.5mm !important;
          }

          .sentup-table td.st-boardroll-cell,
          .sentup-table .st-boardroll-cell,
          .sentup-table .st-boardroll-cell div {
            font-size: 9px !important;
            font-weight: 900 !important;
            line-height: 1.05 !important;
            letter-spacing: -0.01em !important;
          }

          /* Proportional width and prominent print font for BOARD REG. NO. */
          .sentup-table th[data-col="st_boardReg"],
          .sentup-table th.th-col-st_boardReg {
            width: 28mm !important;
            font-size: 8px !important;
            font-weight: 900 !important;
            line-height: 1.05 !important;
            letter-spacing: 0.01em !important;
          }

          .sentup-table td.st-boardreg-cell,
          .sentup-table .st-boardreg-cell,
          .sentup-table .st-boardreg-cell div,
          .sentup-table .st-boardreg-cell span {
            width: 28mm !important;
            font-size: 8.5pt !important;
            font-weight: 900 !important;
            line-height: 1.05 !important;
            letter-spacing: 0.01em !important;
          }

          /* Generous width and print font for STUDENT'S NAME */
          .sentup-table th[data-col="st_name"],
          .sentup-table th.th-col-st_name {
            width: 63mm !important;
            min-width: 48mm !important;
            font-size: 8.5px !important;
            font-weight: 900 !important;
            line-height: 1.05 !important;
            letter-spacing: 0.02em !important;
          }

          .sentup-table td.st-name-cell,
          .sentup-table .st-name-cell {
            width: 63mm !important;
            min-width: 48mm !important;
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
            font-size: 8.5pt !important;
            font-weight: 900 !important;
            line-height: 1.1 !important;
            letter-spacing: 0.01em !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            max-height: calc(${sentupRowHeightMm}mm - 1mm) !important;
            overflow: hidden !important;
          }

          .sentup-table th[data-col="st_rollNo"],
          .sentup-table td.st-rollno-cell,
          .sentup-table .st-rollno-cell,
          .sentup-table .st-rollno-cell div {
            width: 12mm !important;
            font-size: 9px !important;
            font-weight: 900 !important;
            line-height: 1.05 !important;
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
            padding: 0.1mm 0.3mm !important;
            vertical-align: bottom !important;
            overflow: hidden !important;
          }

          .sentup-table .st-receipt-inner {
            min-height: 0 !important;
            height: calc(${sentupRowHeightMm}mm - 0.6mm) !important;
            max-height: calc(${sentupRowHeightMm}mm - 0.6mm) !important;
            overflow: hidden !important;
          }

          .sentup-table .st-receipt-inner * {
            margin: 0 !important;
            font-size: 6px !important;
            line-height: 1.0 !important;
          }

          .sentup-table .st-receipt-inner .border-t {
            padding-top: 0.2mm !important;
            font-size: 6px !important;
          }

          .sentup-ledger-page .signature-footer {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-end !important;
            margin-top: 1mm !important;
            height: 7.5mm !important;
            min-height: 7.5mm !important;
            max-height: 7.5mm !important;
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
            font-size: 8px !important;
            font-weight: 900 !important;
            color: #991b1b !important;
            border-top: 1.2px solid #991b1b !important;
            padding-top: 0.5mm !important;
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
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            border: 1px solid #000000 !important;
            table-layout: fixed !important;
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
      } /* ─── Close @media print ─── */

      @media screen {
        .admission-spread-table thead th {
          color: #0f172a !important;
          font-weight: 800 !important;
          word-break: keep-all !important;
          overflow-wrap: normal !important;
          white-space: normal !important;
          line-height: 1.15 !important;
          vertical-align: middle !important;
          text-align: center !important;
          padding: 2px 1px !important;
        }

        .register-ledger-page {
          display: flex;
          flex-direction: column;
          min-height: 690px;
        }

        .register-header {
          flex-shrink: 0;
        }

        .admission-spread-table {
          table-layout: fixed !important;
        }

        .admission-spread-table thead {
          height: 56px !important;
        }

        .admission-spread-table thead tr {
          height: 28px !important;
        }

        .admission-spread-table thead th {
          height: 28px !important;
          box-sizing: border-box !important;
          vertical-align: middle !important;
          overflow: hidden !important;
        }

        .admission-spread-table thead th[rowspan="2"] {
          height: 56px !important;
        }

        .register-resizable-row,
        .register-resizable-row > td {
          height: var(--register-row-height) !important;
          min-height: var(--register-row-height) !important;
          max-height: var(--register-row-height) !important;
          overflow: hidden !important;
          line-height: 1.12;
          vertical-align: middle !important;
          box-sizing: border-box !important;
        }

        .register-resizable-row > td > div,
        .register-resizable-row > td > span {
          max-height: calc(var(--register-row-height) - 4px);
          overflow: hidden;
        }

        .admission-spread-table td[data-col="name"],
        .admission-spread-table td[data-col="father"],
        .admission-spread-table td[data-col="mother"],
        .admission-spread-table td[data-col="dobWords"],
        .admission-spread-table td[data-col="village"],
        .admission-spread-table td[data-col="admDate"],
        .admission-spread-table td[data-col="p2_subs"],
        .admission-spread-table td[data-col="p2_prevSchool"],
        .admission-spread-table td[data-col="p2_remarks"],
        .admission-spread-table td.cell-wrap {
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }

        .admission-spread-table td[data-col="admDate"] {
          text-align: center !important;
        }

        .admission-spread-table td[data-col="boardReg"],
        .admission-spread-table td[data-col="boardReg"] .st-reg-split,
        .admission-spread-table td[data-col="boardReg"] .st-reg-split span {
          font-size: 11px !important;
        }
        .admission-spread-table td[data-col="name"],
        .admission-spread-table td[data-col="name"] > div,
        .admission-spread-table td[data-col="name"] span {
          font-size: 10px !important;
        }
        .admission-spread-table td[data-col="father"],
        .admission-spread-table td[data-col="father"] > div,
        .admission-spread-table td[data-col="mother"],
        .admission-spread-table td[data-col="mother"] > div {
          font-size: 9.5px !important;
        }

        .admission-spread-table td[data-col="p2_prevRoll"] {
          font-size: 5.5px !important;
          line-height: 1.1 !important;
          white-space: nowrap !important;
        }
        .admission-spread-table td[data-col="p2_prevResult"],
        .admission-spread-table td[data-col="p2_prevResult"] span {
          font-size: 6.5px !important;
          line-height: 1.1 !important;
        }

        .admission-spread-table td[data-col="p2_account"] .account-num {
          font-size: 9.0px !important;
        }
        .admission-spread-table td[data-col="p2_account"] .ifsc-code {
          font-size: 8.0px !important;
        }

        .admission-spread-table td[data-col="p2_prevSchool"],
        .admission-spread-table td[data-col="p2_prevSchool"] > div {
          font-size: 8.5px !important;
        }

        .admission-spread-table td[data-col="p2_pen"],
        .admission-spread-table td[data-col="p2_pen"] .pen-val {
          font-size: 8.5px !important;
        }
        .admission-spread-table td[data-col="p2_pen"] .pen-sub {
          font-size: 7.5px !important;
        }

        .admission-spread-table td[data-col="p2_prevCC"],
        .admission-spread-table td[data-col="p2_prevCC"] .cc-val {
          font-size: 8.5px !important;
        }
        .admission-spread-table td[data-col="p2_prevCC"] .cc-date {
          font-size: 7.8px !important;
        }

        .admission-spread-table td.register-handwrite-cell {
          vertical-align: top !important;
          padding-top: 2px !important;
          padding-bottom: 2px !important;
        }

        .admission-spread-table td.register-handwrite-cell .handwrite-container {
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          height: 100% !important;
          min-height: calc(var(--register-row-height) - 8px) !important;
          box-sizing: border-box !important;
        }

        .admission-spread-table td.register-handwrite-cell .handwrite-container > .handwrite-line:last-child {
          margin-top: auto !important;
        }

        .admission-spread-table td[data-col="p2_remarks"],
        .admission-spread-table td[data-col="p2_remarks"] .remarks-wrap,
        .admission-spread-table td[data-col="p2_remarks"] .line-clamp-4,
        .admission-spread-table td[data-col="p2_remarks"] .line-clamp-3 {
          font-size: 7.2px !important;
          line-height: 1.12 !important;
          -webkit-line-clamp: 5 !important;
        }

        .admission-spread-table td[data-col="dobWords"],
        .admission-spread-table td[data-col="dobWords"] .dob-words-wrap,
        .admission-spread-table td[data-col="dobWords"] .line-clamp-3,
        .admission-spread-table td[data-col="dobWords"] .line-clamp-2 {
          font-size: 7.2px !important;
          line-height: 1.08 !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 3 !important;
          -webkit-box-orient: vertical !important;
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
          overflow: hidden !important;
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
      }

        /* ─── PURE HIGH-CONTRAST POPOVER DIALOG STYLING (THEME-AWARE) ─── */
        .register-popover-panel {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1.5px solid #cbd5e1 !important;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25) !important;
        }

        .dark .register-popover-panel {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          border-color: #334155 !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6) !important;
        }

        .register-popover-panel .popover-header {
          background-color: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }
        .dark .register-popover-panel .popover-header {
          background-color: #0f172a !important;
          border-color: #334155 !important;
        }

        .register-popover-panel .popover-heading {
          color: #0f172a !important;
          font-weight: 900 !important;
        }
        .dark .register-popover-panel .popover-heading {
          color: #f8fafc !important;
        }

        .register-popover-panel .popover-subtext {
          color: #475569 !important;
          font-weight: 600 !important;
        }
        .dark .register-popover-panel .popover-subtext {
          color: #94a3b8 !important;
        }

        .register-popover-panel .popover-tabs-container {
          background-color: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
        }
        .dark .register-popover-panel .popover-tabs-container {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }

        .register-popover-panel .popover-tab-active {
          background-color: #ffffff !important;
          color: #4338ca !important;
          border: 1.5px solid #cbd5e1 !important;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
        }
        .dark .register-popover-panel .popover-tab-active {
          background-color: #0f172a !important;
          color: #818cf8 !important;
          border-color: #334155 !important;
        }

        .register-popover-panel .popover-tab-inactive {
          color: #475569 !important;
          font-weight: 700 !important;
        }
        .register-popover-panel .popover-tab-inactive:hover {
          color: #0f172a !important;
          background-color: rgba(255, 255, 255, 0.9) !important;
        }
        .dark .register-popover-panel .popover-tab-inactive {
          color: #94a3b8 !important;
        }
        .dark .register-popover-panel .popover-tab-inactive:hover {
          color: #f8fafc !important;
          background-color: rgba(15, 23, 42, 0.6) !important;
        }

        .register-popover-panel .popover-section-card {
          background-color: #f8fafc !important;
          border: 2px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        .dark .register-popover-panel .popover-section-card {
          background-color: #1e293b !important;
          border-color: #334155 !important;
          color: #f8fafc !important;
        }

        .register-popover-panel .popover-option-btn:not(.popover-option-active) {
          background-color: #ffffff !important;
          border: 2px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        .register-popover-panel .popover-option-btn:not(.popover-option-active):hover {
          background-color: #f1f5f9 !important;
          border-color: #818cf8 !important;
          color: #000000 !important;
        }
        .dark .register-popover-panel .popover-option-btn:not(.popover-option-active) {
          background-color: #0f172a !important;
          border: 2px solid #334155 !important;
          color: #f8fafc !important;
        }
        .dark .register-popover-panel .popover-option-btn:not(.popover-option-active):hover {
          background-color: #1e293b !important;
          border-color: #6366f1 !important;
          color: #ffffff !important;
        }

        .register-popover-panel .popover-option-active {
          background-color: #4f46e5 !important;
          border: 2px solid #4f46e5 !important;
          color: #ffffff !important;
        }

        .register-popover-panel .popover-pill {
          background-color: #ffffff !important;
          border: 1.5px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        .dark .register-popover-panel .popover-pill {
          background-color: #0f172a !important;
          border-color: #475569 !important;
          color: #f8fafc !important;
        }

        .register-popover-panel .popover-footer {
          background-color: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }
        .dark .register-popover-panel .popover-footer {
          background-color: #0f172a !important;
          border-color: #334155 !important;
        }

        .register-popover-panel label,
        .register-popover-panel .popover-label {
          color: #0f172a !important;
          font-weight: 800 !important;
        }

        .dark .register-popover-panel label,
        .dark .register-popover-panel .popover-label {
          color: #f8fafc !important;
        }

        .register-popover-panel select,
        .register-popover-panel .popover-select {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1.5px solid #94a3b8 !important;
          font-weight: 700 !important;
        }

        .dark .register-popover-panel select,
        .dark .register-popover-panel .popover-select {
          background-color: #1e293b !important;
          color: #f8fafc !important;
          border-color: #475569 !important;
        }

        .register-popover-panel select option {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-weight: 700 !important;
        }

        .dark .register-popover-panel select option {
          background-color: #1e293b !important;
          color: #f8fafc !important;
        }

        .register-popover-panel .popover-btn-inactive {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1.5px solid #cbd5e1 !important;
          font-weight: 700 !important;
        }

        .register-popover-panel .popover-btn-inactive:hover {
          background-color: #f8fafc !important;
          color: #000000 !important;
          border-color: #6366f1 !important;
        }

        .dark .register-popover-panel .popover-btn-inactive {
          background-color: #1e293b !important;
          color: #f8fafc !important;
          border-color: #334155 !important;
        }

        .dark .register-popover-panel .popover-btn-inactive:hover {
          background-color: #334155 !important;
          color: #ffffff !important;
          border-color: #818cf8 !important;
        }

        .register-popover-panel .popover-badge {
          background-color: #eef2ff !important;
          color: #3730a3 !important;
          border: 1px solid #c7d2fe !important;
          font-weight: 800 !important;
        }

        .dark .register-popover-panel .popover-badge {
          background-color: #1e1b4b !important;
          color: #c7d2fe !important;
          border-color: #4338ca !important;
        }

        .register-popover-panel .popover-zoom-box {
          background-color: #f8fafc !important;
          border: 1.5px solid #cbd5e1 !important;
        }

        .dark .register-popover-panel .popover-zoom-box {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }

        .register-popover-panel input[type="text"],
        .register-popover-panel input[type="number"] {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1.5px solid #cbd5e1 !important;
        }

        .register-popover-panel input[type="text"]::placeholder,
        .register-popover-panel input[type="number"]::placeholder {
          color: #64748b !important;
        }

        .dark .register-popover-panel input[type="text"],
        .dark .register-popover-panel input[type="number"] {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          border-color: #334155 !important;
        }

        .dark .register-popover-panel input[type="text"]::placeholder,
        .dark .register-popover-panel input[type="number"]::placeholder {
          color: #94a3b8 !important;
        }

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
      <div role="toolbar" aria-label="Admission Register Suite Toolbar" className="admission-suite-toolbar no-print sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs px-2 sm:px-2.5 py-1">
        <div className="w-full max-w-[2000px] mx-auto flex items-center justify-between gap-1 xl:gap-2 flex-nowrap overflow-x-auto sm:overflow-visible no-scrollbar">
          {/* Left Cluster: Module Selector, Direct Class Scope, + Re-Adm, and Filters Popover */}
          <div className="flex items-center gap-1 xl:gap-1.5 flex-nowrap shrink-0">
            {/* 1. Main Suite Module Dropdown */}
            <select
              value={activeTab}
              onChange={(e) => {
                const nextTab = e.target.value;
                if (nextTab === 'jkbose_rolls') {
                  if (typeof onOpenSubjectRolls === 'function') {
                    onOpenSubjectRolls();
                  }
                  return;
                }
                setActiveTab(nextTab);
                if (nextTab === 'assign_ids') {
                  setAssignViewMode('integrated');
                }
                if (nextTab === 'adm_register' || nextTab === 'sentup') {
                  setSelectedStatus('Approved');
                }
              }}
              className="py-0.5 px-2 text-[11.5px] rounded-lg border-2 border-amber-600/50 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-black cursor-pointer shadow-2xs focus:ring-1 focus:ring-amber-500 shrink-0"
            >
              <option value="adm_register">📖 Admission Register</option>
              <option value="sentup">📋 Sentup Export</option>
              {typeof onOpenSubjectRolls === 'function' && (
                <option value="jkbose_rolls">📜 JKBOSE Subject Rolls</option>
              )}
              <option value="assign_ids">🔢 Assign IDs & Gap Auditor</option>
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

                {/* 6. Order By Selector & Active Sort Indicator */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center gap-1 py-0.5 px-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 shadow-2xs">
                    <ArrowUpDown size={9.5} className="text-slate-400 shrink-0" />
                    <span className="hidden sm:inline text-slate-500">Order:</span>
                    <select
                      value={sortConfig.key || 'rollNo'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'rollNo') {
                          handleResetSort();
                        } else {
                          setSortConfig({ key: val, direction: 'asc' });
                        }
                      }}
                      className="bg-transparent font-bold text-slate-800 dark:text-slate-200 text-[10.5px] cursor-pointer outline-hidden focus:ring-0 border-0 p-0 pr-1"
                      title="Sort table by column (Default: Class Roll No.)"
                    >
                      <option value="rollNo">Class Roll No. (Default)</option>
                      <option value="admNo">Adm. No.</option>
                      <option value="sno">S.No.</option>
                      <option value="name">Student Name</option>
                      <option value="formNo">Form No.</option>
                      <option value="admDate">Admission Date</option>
                      <option value="boardReg">Board Reg. No.</option>
                      <option value="boardRollNo">Exam/Board Roll</option>
                      <option value="dobFigures">Date of Birth</option>
                    </select>
                  </div>
                  {sortConfig.key && (
                    <button
                      type="button"
                      onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                      className="py-0.5 px-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-black cursor-pointer shadow-2xs"
                      title="Toggle Ascending / Descending"
                    >
                      {sortConfig.direction === 'asc' ? '▲ Asc' : '▼ Desc'}
                    </button>
                  )}
                  {sortConfig.key && (
                    <button
                      type="button"
                      onClick={handleResetSort}
                      className="py-0.5 px-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold cursor-pointer shadow-2xs hover:bg-rose-100"
                      title="Reset to default Class Roll No order"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Cluster: Consolidated View & Layout Popover, Count Badge, Excel & Print */}
          <div className="flex items-center gap-1 xl:gap-1.5 flex-nowrap shrink-0">
            {/* Sentup Columns Selector (Only in Sentup Module) */}
            {activeTab === 'sentup' && (
              <>
                {typeof onOpenSubjectRolls === 'function' && (
                  <button
                    type="button"
                    onClick={onOpenSubjectRolls}
                    className="py-0.5 px-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 dark:bg-sky-950/80 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                    title="Open Official JKBOSE Subject-wise Roll Return Statement (Word / Excel / PDF)"
                  >
                    <FileText size={11} className="text-sky-700 dark:text-sky-300" />
                    <span>Subject Roll Return</span>
                  </button>
                )}
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
              </>
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
                </div>

                {/* 2. Record count badge & quick sync */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="py-0.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-black shadow-2xs">
                    {filteredStudents.length} Students
                    {statusCounts.readmissions > 0 && (
                      <span className="ml-1 text-purple-700 dark:text-purple-300 font-extrabold">
                        ({statusCounts.readmissions} Re-Adm)
                      </span>
                    )}
                  </div>
                  {onDataUpdated && (
                    <button
                      type="button"
                      onClick={() => {
                        if (sessionCacheRef.current) sessionCacheRef.current = {};
                        onDataUpdated();
                      }}
                      className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer shadow-2xs"
                      title="Clear session cache & sync complete roster from cloud database"
                    >
                      <RefreshCw size={11} className={isLoadingSession ? 'animate-spin text-teal-600' : ''} />
                    </button>
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
      </div>

      {/* View & Print Layout Modal (Centered Popup Window with Backdrop) */}
                  {showViewPopover && (
                    <div
                      className="no-print fixed inset-0 z-[120] bg-slate-950/70 dark:bg-black/85 backdrop-blur-xs flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) setShowViewPopover(false);
                      }}
                    >
                      <div
                        ref={viewModalPanelRef}
                        className="register-popover-panel relative w-full max-w-2xl lg:max-w-3xl my-auto max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 1. Header (Compact) */}
                        <div className="popover-header flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <SlidersHorizontal size={15} />
                            </div>
                            <div>
                              <div className="popover-heading font-black text-sm text-slate-900 dark:text-white flex items-center gap-2 leading-none">
                                <span>Display &amp; Print Layout</span>
                                {isLayoutModified && (
                                  <span className="text-[9px] uppercase tracking-wider font-black text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 px-1.5 py-0.2 rounded-full">
                                    Modified
                                  </span>
                                )}
                              </div>
                              <div className="popover-subtext text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                Configure table density, paper size, margins &amp; sheet views
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowViewPopover(false)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
                            title="Close (Esc)"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* 2. Segmented Navigation Tabs (Compact) */}
                        <div className="popover-tabs-container flex items-center gap-1.5 px-3 py-1.5 sm:px-4 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0 text-xs">
                          <button
                            type="button"
                            onClick={() => setPopoverActiveTab('layout')}
                            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-all ${
                              popoverActiveTab === 'layout'
                                ? 'popover-tab-active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-black border border-slate-200 dark:border-slate-700'
                                : 'popover-tab-inactive text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                            }`}
                          >
                            <Printer size={13} />
                            <span>Layout &amp; Print</span>
                          </button>

                          {activeTab === 'sentup' && (
                            <button
                              type="button"
                              onClick={() => setPopoverActiveTab('columns')}
                              className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-all ${
                                popoverActiveTab === 'columns'
                                  ? 'popover-tab-active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-black border border-slate-200 dark:border-slate-700'
                                  : 'popover-tab-inactive text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                              }`}
                            >
                              <Columns size={13} />
                              <span>Columns</span>
                              <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                                {ALL_SENTUP_COLS.filter(c => isSentupColVisible(c.key)).length}/{ALL_SENTUP_COLS.length}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setPopoverActiveTab('subjects')}
                            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-all ${
                              popoverActiveTab === 'subjects'
                                ? 'popover-tab-active bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs font-black border border-slate-200 dark:border-slate-700'
                                : 'popover-tab-inactive text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                            }`}
                          >
                            <BookOpen size={13} />
                            <span>Subject Key</span>
                            <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {sentupSubjectAbbreviations.length}
                            </span>
                          </button>
                        </div>

                        {/* 3. Scrollable Tab Content Body */}
                        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 text-left">
                          {/* ─── TAB 1: LAYOUT & PRINT ─── */}
                          {popoverActiveTab === 'layout' && (
                            <div className="space-y-3">
                              {/* 1. Paper Size Selector */}
                              <div className="popover-section-card p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="popover-heading text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <FileText size={13} className="text-indigo-600 dark:text-indigo-400" />
                                    <span>Paper Size Format</span>
                                  </span>
                                  <span className="popover-pill px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300">
                                    {paperSize === 'indian_legal' ? '348 × 216 mm' : paperSize === 'legal' ? '356 × 216 mm' : '297 × 210 mm'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {[
                                    { id: 'indian_legal', title: '13.7" × 8.5" (Default)', label: 'JKBOSE Register' },
                                    { id: 'legal', title: '14.0" × 8.5"', label: 'US Legal' },
                                    { id: 'a4', title: '11.7" × 8.3"', label: 'A4 Landscape' }
                                  ].map(p => {
                                    const isActive = paperSize === p.id;
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handlePaperSizeChange(p.id)}
                                        className={`popover-option-btn p-2 rounded-lg text-left cursor-pointer transition-all border ${
                                          isActive
                                            ? 'popover-option-active border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300'
                                        }`}
                                      >
                                        <div className={`font-black text-xs flex items-center justify-between ${isActive ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                                          <span>{p.title}</span>
                                          {isActive && <Check size={12} className="shrink-0 text-white" />}
                                        </div>
                                        <div className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                          {p.label}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 2. Students Per Sheet Selector (Compact Grid) */}
                              <div className="popover-section-card p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="popover-heading text-xs font-black text-slate-800 dark:text-slate-200">
                                    {activeTab === 'sentup' ? 'Candidates Per Sheet' : 'Rows Per Sheet'}
                                  </span>
                                  <span className="popover-pill px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-[10px] text-indigo-700 dark:text-indigo-300">
                                    {pageChunks.length} Sheet{pageChunks.length === 1 ? '' : 's'} Total
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                                  {[10, 12, 14, 15, 16, 18, 20, 25].map((val) => {
                                    const currentDensity = activeTab === 'sentup' ? sentupStudentsPerPage : studentsPerPage;
                                    const isActive = currentDensity === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => activeTab === 'sentup' ? handleSentupStudentsPerPageChange(val) : handleStudentsPerPageChange(val)}
                                        className={`popover-option-btn py-1.5 px-1 rounded-lg text-center cursor-pointer transition-all border text-xs font-black ${
                                          isActive
                                            ? 'popover-option-active border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300'
                                        }`}
                                        title={`${val} rows per sheet${val === 15 || (activeTab === 'sentup' && val === 10) ? ' (Default)' : ''}`}
                                      >
                                        <div>{val}</div>
                                        <div className={`text-[8.5px] font-normal leading-none mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                                          {val === 10 && activeTab === 'sentup' ? '★ Def' : val === 15 && activeTab !== 'sentup' ? '★ Def' : 'Rows'}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 3. Row Height & Print Margins Grid (Compact) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Row Height */}
                                <div className="popover-section-card p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                                    <span>Row Height:</span>
                                    <div className="flex items-center gap-1 font-mono text-xs">
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
                                        className="w-12 text-center py-0.5 px-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                                        title="Enter custom row height (30-100px)"
                                      />
                                      <span className="text-[10px] text-slate-500">px</span>
                                    </div>
                                  </div>
                                  <input
                                    type="range"
                                    min={MIN_REGISTER_ROW_HEIGHT}
                                    max={MAX_REGISTER_ROW_HEIGHT}
                                    step="1"
                                    value={rowHeight}
                                    onChange={(e) => handleRowHeightChange(parseInt(e.target.value, 10))}
                                    className="w-full cursor-pointer accent-indigo-600 my-1"
                                  />
                                  <div className="grid grid-cols-3 gap-1 mt-1">
                                    {[
                                      { label: 'Compact', val: 40 },
                                      { label: 'Default ★', val: 56 },
                                      { label: 'Spacious', val: 72 }
                                    ].map(({ label, val }) => (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => handleRowHeightChange(val)}
                                        className={`popover-option-btn py-1 rounded text-[10px] font-black cursor-pointer text-center border ${
                                          rowHeight === val
                                            ? 'popover-option-active bg-indigo-600 text-white border-indigo-600'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Print Margins */}
                                <div className="popover-section-card p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                                    <span>Print Margin:</span>
                                    <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
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
                                    className="w-full cursor-pointer accent-indigo-600 my-1"
                                  />
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
                                        className={`popover-option-btn py-1 rounded text-[10px] font-black cursor-pointer text-center border ${
                                          Math.abs(printMargin - m) < 0.02
                                            ? 'popover-option-active bg-indigo-600 text-white border-indigo-600'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* 4. Section to Display & Book Layout */}
                              {activeTab === 'adm_register' && (
                                <div className="popover-section-card grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <div>
                                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                                      Section to Display:
                                    </label>
                                    <select
                                      value={registerViewSection}
                                      onChange={(e) => setRegisterViewSection(e.target.value)}
                                      className="w-full py-1.5 px-2 text-xs rounded-lg font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                    >
                                      <option value="all">📑 All Spreads (Full Register)</option>
                                      <option value="cover">📜 Cover Page Only</option>
                                      <option value="spreads">📖 Ledger Table Only</option>
                                      <option value="summary">📊 Summary Statement Only</option>
                                      <option value="notes">📝 Notes &amp; Annexure Only</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                                      Book Layout:
                                    </label>
                                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200 dark:bg-slate-700 rounded-lg">
                                      <button
                                        type="button"
                                        onClick={() => setSpreadLayoutMode('side_by_side')}
                                        className={`py-1 px-2 rounded-md text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                          spreadLayoutMode === 'side_by_side'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-white/60'
                                        }`}
                                      >
                                        <Columns size={12} />
                                        <span>Side-by-Side</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSpreadLayoutMode('stacked')}
                                        className={`py-1 px-2 rounded-md text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                          spreadLayoutMode === 'stacked'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-white/60'
                                        }`}
                                      >
                                        <LayoutGrid size={12} />
                                        <span>Stacked</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 5. Sentup Page Inclusions */}
                              {activeTab === 'sentup' && (
                                <div className="popover-section-card p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <span className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                                    Sentup Document Pages:
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50">
                                      <input
                                        type="checkbox"
                                        checked={includeCoverPage}
                                        onChange={(e) => setIncludeCoverPage(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <div>
                                        <div>Cover Page (Page 1)</div>
                                        <div className="text-[10px] text-slate-500 font-normal">Official document title label</div>
                                      </div>
                                    </label>
                                    <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50">
                                      <input
                                        type="checkbox"
                                        checked={includePlanPage}
                                        onChange={(e) => setIncludePlanPage(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <div>
                                        <div>Exam Plan &amp; Key (Page 2)</div>
                                        <div className="text-[10px] text-slate-500 font-normal">Subject codes &amp; seating scheme</div>
                                      </div>
                                    </label>
                                  </div>
                                </div>
                              )}

                              {/* 6. Screen Zoom Controls */}
                              <div className="popover-section-card flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                                  On-Screen Zoom:
                                  <span className="font-normal text-slate-500 dark:text-slate-400 text-[10.5px] ml-1.5">Scale table view</span>
                                </div>
                                <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => setZoomLevel(prev => Math.max(0.6, Math.round((prev - 0.1) * 10) / 10))}
                                    className="w-6 h-6 flex items-center justify-center rounded font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                                    title="Zoom Out"
                                  >
                                    -
                                  </button>
                                  <span className="px-1.5 font-mono font-black text-xs text-slate-800 dark:text-slate-200 min-w-[45px] text-center">
                                    {Math.round(zoomLevel * 100)}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setZoomLevel(prev => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10))}
                                    className="w-6 h-6 flex items-center justify-center rounded font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                                    title="Zoom In"
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setZoomLevel(1.0)}
                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 cursor-pointer"
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ─── TAB 2: SENTUP VISIBLE COLUMNS ─── */}
                          {popoverActiveTab === 'columns' && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="relative flex-1">
                                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Search columns..."
                                    value={columnSearchQuery}
                                    onChange={(e) => setColumnSearchQuery(e.target.value)}
                                    className="w-full pl-7 pr-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
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

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                                {ALL_SENTUP_COLS
                                  .filter(col => !columnSearchQuery.trim() || col.label.toLowerCase().includes(columnSearchQuery.toLowerCase()))
                                  .map(col => {
                                    const checked = isSentupColVisible(col.key);
                                    return (
                                      <label
                                        key={col.key}
                                        className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all ${
                                          checked
                                            ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 text-slate-900 dark:text-slate-100'
                                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleSentupCol(col.key)}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
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
                            <div className="space-y-2.5">
                              {/* Action Bar */}
                              <div className="popover-section-card flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-1.5">
                                  {savingSubjectsCloud ? (
                                    <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                                      <Loader2 size={11} className="animate-spin" /> Saving Cloud...
                                    </span>
                                  ) : (
                                    <span className="text-[9.5px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                                      <Check size={10} /> Cloud Synced
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => saveSubjectAbbreviationsToCloud(sentupSubjectAbbreviations)}
                                    disabled={savingSubjectsCloud}
                                    className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-lg shadow-2xs hover:bg-emerald-50"
                                  >
                                    <Save size={10} /> Save to Cloud
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleResetSubjectAbbreviations}
                                    className="text-[10px] font-black text-slate-500 hover:text-rose-600 cursor-pointer hover:underline"
                                  >
                                    Reset Official
                                  </button>
                                </div>
                              </div>

                              {/* Add Form */}
                              <div className="popover-section-card flex items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                                <input
                                  type="text"
                                  placeholder="Code"
                                  value={newSubCode}
                                  onChange={(e) => setNewSubCode(e.target.value)}
                                  className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold uppercase focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
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
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shrink-0 shadow-2xs"
                                >
                                  <Plus size={11} />
                                  <span>Add</span>
                                </button>
                              </div>

                              {/* Search Filter for Subject Key */}
                              <div className="relative">
                                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Filter subject key..."
                                  value={subjectSearchQuery}
                                  onChange={(e) => setSubjectSearchQuery(e.target.value)}
                                  className="w-full pl-7 pr-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                                />
                              </div>

                              {/* List of current abbreviations */}
                              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                {sentupSubjectAbbreviations
                                  .filter(sub => !subjectSearchQuery.trim() || (sub.name || '').toLowerCase().includes(subjectSearchQuery.toLowerCase()) || (sub.code || '').toLowerCase().includes(subjectSearchQuery.toLowerCase()))
                                  .map((sub, sIdx) => {
                                    const itemKey = sub.id || `sub_idx_${sIdx}`;
                                    const isEditing = editingSubKey === itemKey;

                                    if (isEditing) {
                                      return (
                                        <div
                                          key={itemKey}
                                          className="flex items-center gap-1.5 p-1 bg-indigo-50/90 dark:bg-indigo-950/60 rounded-lg border border-indigo-300 dark:border-indigo-700 shadow-xs"
                                        >
                                          <input
                                            type="text"
                                            value={editSubCode}
                                            onChange={(e) => setEditSubCode(e.target.value)}
                                            className="w-16 px-1.5 py-0.5 text-xs rounded border border-indigo-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold uppercase focus:outline-hidden"
                                            placeholder="Code"
                                            autoFocus
                                          />
                                          <input
                                            type="text"
                                            value={editSubName}
                                            onChange={(e) => setEditSubName(e.target.value)}
                                            className="flex-1 px-1.5 py-0.5 text-xs rounded border border-indigo-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden"
                                            placeholder="Subject Title"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleSaveEditSubjectAbbreviation(itemKey)}
                                            disabled={!editSubCode.trim() || !editSubName.trim()}
                                            className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors shrink-0 disabled:opacity-40"
                                            title="Save changes"
                                          >
                                            <Check size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={handleCancelEditSubjectAbbreviation}
                                            className="p-1 text-slate-500 hover:text-slate-700 rounded cursor-pointer transition-colors shrink-0"
                                            title="Cancel"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div
                                        key={itemKey}
                                        className="flex items-center justify-between px-2 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs group transition-colors"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-300 font-mono font-black text-[9.5px] shrink-0">
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
                                            className="p-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded cursor-pointer transition-colors"
                                            title={`Edit ${sub.name}`}
                                          >
                                            <Edit3 size={11} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteSubjectAbbreviation(itemKey)}
                                            className="p-0.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded cursor-pointer transition-colors"
                                            title={`Delete ${sub.name}`}
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 4. Footer (Compact & Minimal) */}
                        <div className="popover-footer border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 shrink-0">
                          <div className="flex items-center justify-between gap-3">
                            {isLayoutModified ? (
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 truncate">
                                <AlertCircle size={13} className="shrink-0 text-amber-600" />
                                <span>Customized layout</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                Official default format active
                              </span>
                            )}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={handleResetLayoutToOriginal}
                                className="popover-option-btn py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Reset columns, density, margins and row heights to original format"
                              >
                                <RotateCcw size={12} />
                                <span>Reset Defaults</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveLayoutToFirebase}
                                disabled={savingLayout}
                                className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 disabled:opacity-50"
                                title="Save custom layout as default to Firebase"
                              >
                                {savingLayout ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                <span>Save to Firebase</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

      {/* ─── REAL-TIME TASK PROGRESS MODAL ─── */}
      {taskProgress && (
        <div className="no-print fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
                taskProgress.status === 'success'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
              }`}>
                {taskProgress.status === 'success' ? (
                  <Check size={22} className="animate-in zoom-in-75 duration-300" strokeWidth={2.5} />
                ) : taskProgress.icon === 'print' ? (
                  <Printer size={20} className="animate-pulse" />
                ) : taskProgress.icon === 'excel' ? (
                  <FileSpreadsheet size={20} className="animate-pulse" />
                ) : taskProgress.icon === 'calendar' ? (
                  <Calendar size={20} className="animate-pulse" />
                ) : taskProgress.icon === 'cloud' ? (
                  <Save size={20} className="animate-pulse" />
                ) : (
                  <Loader2 size={20} className="animate-spin" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                  {taskProgress.title || 'Processing Task'}
                </h3>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {taskProgress.status === 'success' ? 'Task completed successfully' : 'Please wait, working on request…'}
                </p>
              </div>
              {taskProgress.progress !== undefined && (
                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                    {Math.round(taskProgress.progress)}%
                  </span>
                </div>
              )}
            </div>

            {/* Micro Progress Bar */}
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-700/80">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  taskProgress.status === 'success'
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-500'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, taskProgress.progress || 10))}%` }}
              />
            </div>

            {/* Status / Step Subtext */}
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <span className="truncate pr-2">{taskProgress.step || 'Processing data...'}</span>
              {taskProgress.current !== undefined && taskProgress.total !== undefined && (
                <span className="shrink-0 font-mono text-[10.5px] text-slate-400">
                  {taskProgress.current} / {taskProgress.total}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST NOTIFICATION ─── */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          className="no-print fixed top-12 right-4 z-[9999] cursor-pointer transition-all animate-in fade-in slide-in-from-top-2 duration-150 select-none hover:opacity-95 active:scale-95"
          title="Click to dismiss notification immediately"
        >
          <div className={`px-3 py-1.5 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/30'
              : toast.type === 'info'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-950/30'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-950/30'
          }`}>
            <span>{toast.message || toast.title || toast.desc}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setToast(null);
              }}
              className="opacity-75 hover:opacity-100 cursor-pointer ml-1 p-0.5 rounded hover:bg-black/20 text-xs"
            >
              ✕
            </button>
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
                {/* One-Click 38 Class 12th Re-Admissions Batch Synchronizer */}
                <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white shadow-2xs">
                        Automated Batch Sync
                      </span>
                      <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300">
                        Class 12th (2025–26) Sequential Re-admissions
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                      Assigns sequential admission numbers <strong>5476 → 5513</strong> (starting from <em>Irtiza Maqbool</em>), pairs previous admission numbers, and commits consolidated statutory remarks to Firestore & Column 18 for all 38 candidates in 1-click.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={savingReAdm}
                    onClick={handleBatchSyncClass12Readmissions}
                    className="px-3.5 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Zap size={14} className="text-amber-300 fill-amber-300" />
                    <span>Sync All 38 Re-admissions</span>
                  </button>
                </div>

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

                {/* Class Filter Quick Tabs & Approved Only Toggle */}
                <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {['All', '12th', '11th', '10th', '9th'].map((clsKey) => {
                      const count = candidateClassCounts[clsKey] || 0;
                      const isActive = candidateClassFilter === clsKey;
                      return (
                        <button
                          key={clsKey}
                          type="button"
                          onClick={() => setCandidateClassFilter(clsKey)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                            isActive
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600'
                          }`}
                        >
                          <span>{clsKey === 'All' ? 'All Classes' : `Class ${clsKey}`}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            isActive
                              ? 'bg-purple-700 text-purple-100'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCandidateOnlyApproved(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                      candidateOnlyApproved
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                    title={candidateOnlyApproved ? 'Showing only approved students with roll numbers. Click to view all records.' : 'Showing all records including unapproved drafts. Click to restrict to approved students only.'}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${candidateOnlyApproved ? 'bg-emerald-500 ring-2 ring-emerald-300/50' : 'bg-slate-400'}`} />
                    <span className="whitespace-nowrap">Approved Only</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    Select a student to map as Re-admission ({candidateSearchResults.length} found):
                  </p>
                  {candidateSearchResults.map((candidate) => {
                    const q = searchCandidateQuery.trim().toLowerCase();
                    const isRollMatch = q && candidate.rollNo && candidate.rollNo.toLowerCase().includes(q);
                    const isAdmMatch = q && candidate.admNo && candidate.admNo.toLowerCase().includes(q);
                    const isFormMatch = q && candidate.formNo && candidate.formNo.toLowerCase().includes(q);
                    const isRegMatch = q && candidate.boardReg && candidate.boardReg.toLowerCase().includes(q);

                    return (
                      <div
                        key={candidate.id}
                        onClick={() => handleSelectCandidateForReadmission(candidate)}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-950/40 cursor-pointer transition-all flex items-center justify-between gap-2.5 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            {candidate.name ? candidate.name[0].toUpperCase() : 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-purple-700 dark:group-hover:text-purple-300">
                              {candidate.name}
                            </p>
                            <p className="text-[10.5px] text-slate-500 truncate flex items-center gap-1 flex-wrap">
                              <span>S/o {candidate.father || '—'}</span>
                              <span>•</span>
                              <span>Class: <strong className="text-indigo-600 dark:text-indigo-400">{candidate.class}</strong> ({candidate.session})</span>
                              {candidate.stream && candidate.stream !== 'General' && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 dark:text-slate-300 font-medium">{candidate.stream}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {candidate.rollNo && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
                              isRollMatch
                                ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400 font-black'
                                : 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                            }`}>
                              Roll: {candidate.rollNo}
                            </span>
                          )}
                          {candidate.admNo && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              isAdmMatch
                                ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400 font-black'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}>
                              Adm: {candidate.admNo}
                            </span>
                          )}
                          {candidate.formNo && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                              isFormMatch
                                ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400 font-black'
                                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                              Form: {candidate.formNo}
                            </span>
                          )}
                          {candidate.boardReg && isRegMatch && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-100 text-amber-900 border border-amber-300 ring-1 ring-amber-400 font-black">
                              Reg: {candidate.boardReg}
                            </span>
                          )}
                          <span className="p-1 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all">
                            <ChevronRight size={13} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {readmissionModalStudent.rollNo && (
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-100 text-indigo-900 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                          Roll: {readmissionModalStudent.rollNo}
                        </span>
                      )}
                      {readmissionModalStudent.admNo && (
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                          Adm: {readmissionModalStudent.admNo}
                        </span>
                      )}
                      {readmissionModalStudent.formNo && (
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                          Form: {readmissionModalStudent.formNo}
                        </span>
                      )}
                      {readmissionModalStudent.boardReg && (
                        <span className="px-1.5 py-0.5 rounded font-mono text-[9.5px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          Reg: {readmissionModalStudent.boardReg}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReadmissionModalStudent(null)}
                    className="px-2 py-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 dark:text-purple-300 bg-white dark:bg-slate-900 rounded-lg border border-purple-200 dark:border-purple-800 cursor-pointer shadow-2xs self-start"
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
                      onClick={() => setReAdmFormState(prev => {
                        const is11th = prev.targetClass === '11th';
                        return {
                          ...prev,
                          isReAdm: true,
                          assignedAdmNo: (is11th && readmissionModalStudent?.admNo) ? readmissionModalStudent.admNo : (prev.assignedAdmNo || nextSequentialAdmNo),
                          oldAdmNo: prev.oldAdmNo || (is11th ? '' : readmissionModalStudent?.admNo) || ''
                        };
                      })}
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
                      {reAdmFormState.targetClass === '11th' ? (
                        <>
                          Will maintain location in <strong>Class 11th ({reAdmFormState.targetSession})</strong> register with admission no as:{' '}
                        </>
                      ) : (
                        <>
                          Will print in the <strong>Class {reAdmFormState.targetClass} ({reAdmFormState.targetSession})</strong> ledger at the end of the section as:{' '}
                        </>
                      )}
                      <strong className="font-mono bg-purple-100 dark:bg-purple-900 px-1 py-0.5 rounded">
                        {reAdmFormState.assignedAdmNo || '—'} {reAdmFormState.oldAdmNo ? `(${reAdmFormState.oldAdmNo})` : ''}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Consolidated Register Remarks (Column 18) */}
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-purple-950 dark:text-purple-200">
                      Consolidated Register Remarks (Col. 18):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const targetCls = reAdmFormState.targetClass || '12th';
                        const oldAdm = reAdmFormState.oldAdmNo;
                        const autoRemarks = buildClass12ReadmissionRemark(targetCls, oldAdm);
                        setReAdmFormState(prev => ({ ...prev, customRemarks: autoRemarks }));
                      }}
                      className="text-[9.5px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.2 rounded"
                      title="Reset to default official consolidated remark format"
                    >
                      ⚡ Reset to Standard Remark
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={reAdmFormState.customRemarks || ''}
                    onChange={(e) => setReAdmFormState(prev => ({ ...prev, customRemarks: e.target.value }))}
                    placeholder="e.g. Gap case: Re-adm 12th, 2026 (Oct-Nov) • Prev Adm: 4769 • Marks card verified"
                    className="w-full p-2 text-xs rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Saved directly to Firestore <code className="font-mono text-purple-700 dark:text-purple-300">remarks</code> and rendered on Column 18 of General Admission Register & exports.
                  </p>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                {readmissionModalStudent && (readmissionModalStudent.isReadmission || readmissionModalStudent.raw?.isReadmission || readmissionModalStudent.raw?.['Re-admission'] === 'Yes' || readmissionModalStudent.oldAdmNo || readmissionModalStudent.raw?.oldAdmNo || readmissionModalStudent.raw?.['Old Admission No.'] || reAdmFormState.oldAdmNo) && (
                  <button
                    type="button"
                    onClick={() => setShowUndoConfirmModal(true)}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    title="Undo re-admission status and restore original admission number"
                  >
                    <RotateCcw size={13} />
                    <span>Undo Re-admission</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* ─── UNDO RE-ADMISSION CONFIRMATION MODAL WITH SEQUENTIAL GAP COMPACTION ─── */}
      {showUndoConfirmModal && readmissionModalStudent && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    Undo Re-admission & Revert Admission Number
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Revert candidate to original admission status and prevent ledger gaps
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUndoConfirmModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3.5 overflow-y-auto text-xs">
              {/* Target Student Summary */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Candidate</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/70 dark:text-purple-300">
                    Class {readmissionModalStudent.class || '11th'} ({readmissionModalStudent.session || selectedSession})
                  </span>
                </div>
                <div className="font-black text-sm text-slate-900 dark:text-white">
                  {readmissionModalStudent.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Parentage: {readmissionModalStudent.father || '—'}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
                    <span className="block text-[10px] font-extrabold text-rose-700 dark:text-rose-300 uppercase">
                      Adm No Released
                    </span>
                    <span className="text-base font-black font-mono text-rose-950 dark:text-rose-200">
                      {cleanStr(readmissionModalStudent.admNo || reAdmFormState.assignedAdmNo) || '—'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                    <span className="block text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase">
                      Original Adm No Restored
                    </span>
                    <span className="text-base font-black font-mono text-emerald-950 dark:text-emerald-200">
                      {cleanStr(readmissionModalStudent.oldAdmNo || readmissionModalStudent.raw?.oldAdmNo || readmissionModalStudent.raw?.['Old Admission No.'] || reAdmFormState.oldAdmNo) || 'None / Blank'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sequential Admission Number Auto-Compaction Checkbox */}
              <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shiftSubsequentAdmNos}
                    onChange={(e) => setShiftSubsequentAdmNos(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-black text-xs text-indigo-950 dark:text-indigo-200 block">
                      Auto-recompact subsequent admission numbers to prevent gaps
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      When enabled, students enrolled after this number will shift down by 1 so the official admission register maintains an unbroken, continuous sequence.
                    </p>
                  </div>
                </label>

                {shiftSubsequentAdmNos && (
                  <div className="pt-2 border-t border-indigo-200/80 dark:border-indigo-800/80">
                    {subsequentStudentsToShift.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 dark:text-indigo-300 mb-1.5">
                          <span>Subsequent students to be renumbered ({subsequentStudentsToShift.length}):</span>
                          <span className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                            Shift: -1
                          </span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[10.5px]">
                          {subsequentStudentsToShift.slice(0, 10).map((st) => (
                            <div
                              key={st.id}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                            >
                              <div className="min-w-0 font-sans truncate mr-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{st.name}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({st.class})</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-rose-600 dark:text-rose-400 line-through">{st.currentAdm}</span>
                                <span className="text-slate-400">→</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{st.nextAdm}</span>
                              </div>
                            </div>
                          ))}
                          {subsequentStudentsToShift.length > 10 && (
                            <div className="text-[10px] text-center text-slate-500 italic py-1 font-sans">
                              + {subsequentStudentsToShift.length - 10} more subsequent student(s) will also be decremented by 1
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">
                        No subsequent students found with admission numbers greater than {cleanStr(readmissionModalStudent.admNo || reAdmFormState.assignedAdmNo)}. Only this student's admission number will be reverted.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUndoConfirmModal(false)}
                disabled={isUndoingReAdm}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUndoReadmission}
                disabled={isUndoingReAdm}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
              >
                {isUndoingReAdm ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Reverting & Shifting…</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={13} />
                    <span>Confirm & Undo Re-admission</span>
                  </>
                )}
              </button>
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
                              <col style={{ width: `${columnWidths.sno || 32}px` }} />
                              <col style={{ width: `${columnWidths.photo || 40}px` }} />
                              <col style={{ width: `${columnWidths.rollNo || 42}px` }} />
                              <col style={{ width: `${columnWidths.formNo || 62}px` }} />
                              <col style={{ width: `${columnWidths.admDate || 56}px` }} />
                              <col style={{ width: `${columnWidths.admNo || 56}px` }} />
                              <col style={{ width: `${columnWidths.class || 44}px` }} />
                              <col style={{ width: `${columnWidths.boardReg || 96}px` }} />
                              <col style={{ width: `${columnWidths.name || 112}px` }} />
                              <col style={{ width: `${columnWidths.father || 90}px` }} />
                              <col style={{ width: `${columnWidths.mother || 90}px` }} />
                              <col style={{ width: `${columnWidths.dobFigures || 56}px` }} />
                              <col style={{ width: `${columnWidths.dobWords || 96}px` }} />
                              <col style={{ width: `${columnWidths.gender || 40}px` }} />
                              <col style={{ width: `${columnWidths.village || 62}px` }} />
                              <col style={{ width: `${columnWidths.block || 54}px` }} />
                              <col style={{ width: `${columnWidths.tehsil || 54}px` }} />
                              <col style={{ width: `${columnWidths.district || 54}px` }} />
                              <col style={{ width: `${columnWidths.mobile || 66}px` }} />
                              <col style={{ width: `${columnWidths.parentMobile || 66}px` }} />
                            </colgroup>
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 uppercase font-black text-center">
                                <ResizableTh colKey="sno" sortKey="sno" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.sno} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap">S. NO.</span></ResizableTh>
                                <ResizableTh colKey="photo" width={columnWidths.photo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap">PHOTO</span></ResizableTh>
                                <ResizableTh colKey="rollNo" sortKey="rollNo" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.rollNo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap leading-tight">CLASS</span><span className="block whitespace-nowrap leading-tight mt-0.5">R. NO.</span></ResizableTh>
                                <ResizableTh colKey="formNo" sortKey="formNo" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.formNo || 62} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap leading-tight">FORM NO. &amp;</span><span className="block whitespace-nowrap leading-tight text-[7px] mt-0.5">ONLINE SUBM.</span></ResizableTh>
                                <ResizableTh colKey="admDate" sortKey="admDate" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.admDate || 56} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap leading-tight">ADM.</span><span className="block whitespace-nowrap leading-tight mt-0.5">DATE</span></ResizableTh>
                                <ResizableTh colKey="admNo" sortKey="admNo" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.admNo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap leading-tight">ADM.</span><span className="block whitespace-nowrap leading-tight mt-0.5">NO.</span></ResizableTh>
                                <ResizableTh colKey="class" sortKey="class" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.class || 44} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap leading-tight">CLASS</span><span className="block whitespace-nowrap leading-tight mt-0.5">ADM. TO</span></ResizableTh>
                                <ResizableTh colKey="boardReg" sortKey="boardReg" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.boardReg} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap leading-tight">BOARD REG.</span><span className="block whitespace-nowrap leading-tight mt-0.5">NO.</span></ResizableTh>
                                <ResizableTh colKey="name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.name} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-left pl-2 h-grey">STUDENT'S NAME</ResizableTh>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center h-grey">PARENTAGE</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center h-grey">DATE OF BIRTH</th>
                                <ResizableTh colKey="gender" sortKey="gender" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.gender || 40} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap">GENDER</span></ResizableTh>
                                <th colSpan="4" className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-200 text-slate-900 h-yellow">RESIDENCE</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-200 text-slate-900 h-yellow">CONTACT</th>
                              </tr>
                              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[7.5px]">
                                <ResizableTh colKey="father" sortKey="father" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.father} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">FATHER'S NAME</ResizableTh>
                                <ResizableTh colKey="mother" sortKey="mother" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.mother} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">MOTHER'S NAME</ResizableTh>
                                <ResizableTh colKey="dobFigures" sortKey="dobFigures" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.dobFigures} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">FIGURES</ResizableTh>
                                <ResizableTh colKey="dobWords" sortKey="dobWords" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.dobWords} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">WORDS</ResizableTh>
                                <ResizableTh colKey="village" sortKey="village" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.village || 62} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">VILLAGE/ TOWN</ResizableTh>
                                <ResizableTh colKey="block" sortKey="block" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.block} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">BLOCK</ResizableTh>
                                <ResizableTh colKey="tehsil" sortKey="tehsil" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.tehsil} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">TEHSIL</ResizableTh>
                                <ResizableTh colKey="district" sortKey="district" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.district} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">DISTRICT</ResizableTh>
                                <ResizableTh colKey="mobile" sortKey="mobile" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.mobile} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">STUDENT'S MOBILE</ResizableTh>
                                <ResizableTh colKey="parentMobile" sortKey="parentMobile" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.parentMobile} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">PARENT'S MOBILE</ResizableTh>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-900">
                              {chunk.map((s, idx) => {
                                const photoSrc = getResolvedStudentPhoto(s);
                                return (
                                  <ResizableDataRow key={`chunk_row_p1_${s.id || ''}_${idx}`} rowHeight={rowHeight} onResize={handleRowHeightChange} className="hover:bg-slate-50 group">
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold ledger-mono-font text-[8.5px]" data-col="sno">{s.sno}</td>
                                    <td className="register-photo-cell border border-slate-900 p-0 text-center overflow-hidden bg-slate-50 print:bg-transparent" data-col="photo" style={{ width: columnWidths.photo ? `${columnWidths.photo}px` : undefined }}>
                                      <div className="register-photo-inner w-full h-full flex items-center justify-center p-0.5 overflow-hidden">
                                        {photoSrc ? (
                                          <img
                                            src={photoSrc}
                                            alt={s.name}
                                            className="block max-h-full max-w-full object-contain mx-auto"
                                            style={{ maxHeight: `${Math.max(30, rowHeight - 2)}px` }}
                                            loading="eager"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              const fb = e.currentTarget.parentElement?.querySelector('.photo-fallback');
                                              if (fb) fb.classList.remove('hidden');
                                            }}
                                          />
                                        ) : null}
                                        <span className={`photo-fallback text-[7px] text-slate-400 font-bold select-none ${photoSrc ? 'hidden' : 'block'}`}>
                                          Photo
                                        </span>
                                      </div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-indigo-700 ledger-mono-font text-[9px]" data-col="rollNo">{s.rollNo}</td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left align-middle ledger-mono-font overflow-hidden text-[8px]" data-col="formNo">
                                      <div className="font-bold text-[8.5px] text-slate-900 leading-tight">
                                        {s.formNo || '—'}
                                      </div>
                                      <div className="text-[7.5px] text-slate-600 font-medium leading-tight mt-0.5">
                                        {renderOnlineSubmCell(s.onlineStatus)}
                                      </div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center align-middle ledger-mono-font overflow-hidden text-[8px]" data-col="admDate">{renderAdmDateCell(s.admDate)}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-emerald-800 leading-tight" data-col="admNo">
                                      <div className="ledger-mono-font font-black text-[9px] leading-tight">{s.admNo || '—'}</div>
                                      {s.oldAdmNo && s.oldAdmNo !== s.admNo && s.oldAdmNo !== '—' && (
                                        <div className="text-[7.5px] font-mono text-purple-700 dark:text-purple-400 font-bold leading-tight mt-0.5">
                                          ({String(s.oldAdmNo).replace(/^\(|\)$/g, '').trim()})
                                        </div>
                                      )}
                                      {s.isReadmission && (
                                        <div className="text-[6.8px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight leading-tight mt-0.5 select-none readm-badge">
                                          (RE-ADM)
                                        </div>
                                      )}
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold text-[8.5px]" data-col="class">{s.class}</td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left align-middle ledger-mono-font overflow-hidden leading-tight text-[11px]" data-col="boardReg" style={{ fontSize: '11px' }}>{formatBoardRegSplit(s.boardReg)}</td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left relative group/name-cell overflow-hidden" data-col="name" style={{ fontSize: '10px' }}>
                                      <div className="w-full font-black uppercase tracking-tight text-slate-900 leading-tight text-[10px] break-words line-clamp-2" style={{ fontSize: '10px' }}>
                                        <span style={{ fontSize: '10px' }}>{s.name}</span>
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
                                    <td className="border border-slate-900 px-1 py-0.5 text-left uppercase text-[9.5px] leading-tight" data-col="father" style={{ fontSize: '9.5px' }}>
                                      <div className="line-clamp-2 leading-tight break-words text-[9.5px]" style={{ fontSize: '9.5px' }}>{s.father}</div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left uppercase text-[9.5px] leading-tight" data-col="mother" style={{ fontSize: '9.5px' }}>
                                      <div className="line-clamp-2 leading-tight break-words text-[9.5px]" style={{ fontSize: '9.5px' }}>{s.mother}</div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-mono ledger-mono-font text-[8px]" data-col="dobFigures">{formatRegisterDate(s.dobFigures) || s.dobFigures || '—'}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left text-[7.2px] leading-tight font-serif overflow-hidden align-middle" data-col="dobWords" style={{ fontSize: '7.2px' }}>
                                      <div className="line-clamp-3 leading-[1.08] break-words dob-words-wrap text-[7.2px]" style={{ fontSize: '7.2px', lineHeight: 1.08 }} title={s.dobWords}>{s.dobWords}</div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-semibold text-[8px]" data-col="gender">{s.gender}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50 text-[8px] leading-tight" data-col="village">
                                      <div className="line-clamp-2 leading-tight break-words">{s.village}</div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50 text-[8px] leading-tight" data-col="block">{s.block}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50 text-[8px] leading-tight" data-col="tehsil">{s.tehsil}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50 text-[8px] leading-tight" data-col="district">{s.district}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-mono ledger-mono-font text-[8px]" data-col="mobile">{s.mobile}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-mono ledger-mono-font text-[8px]" data-col="parentMobile">{s.parentMobile}</td>
                                  </ResizableDataRow>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Signatures */}
                        <div className="signature-footer flex justify-between items-center mt-6 sm:mt-8 pt-3 text-xs font-black text-red-700 w-full">
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
                              <col style={{ width: `${columnWidths.p2_sno || columnWidths.sno || 32}px` }} />
                              <col style={{ width: `${columnWidths.p2_stream || 52}px` }} />
                              <col style={{ width: `${columnWidths.p2_subs || 96}px` }} />
                              <col style={{ width: `${columnWidths.p2_aadhar || 80}px` }} />
                              <col style={{ width: `${columnWidths.p2_cat || 38}px` }} />
                              <col style={{ width: `${columnWidths.p2_socio || 46}px` }} />
                              <col style={{ width: `${columnWidths.p2_blood || 42}px` }} />
                              <col style={{ width: `${columnWidths.p2_account || 86}px` }} />
                              <col style={{ width: `${columnWidths.p2_prevSchool || 86}px` }} />
                              <col style={{ width: `${columnWidths.p2_prevRoll || 48}px` }} />
                              <col style={{ width: `${columnWidths.p2_prevResult || 48}px` }} />
                              <col style={{ width: `${columnWidths.p2_pen || 92}px` }} />
                              <col style={{ width: `${columnWidths.p2_prevCC || 76}px` }} />
                              <col style={{ width: `${columnWidths.p2_withdrawal || 56}px` }} />
                              <col style={{ width: `${columnWidths.p2_issuedCC || 76}px` }} />
                              <col style={{ width: `${columnWidths.p2_receipt || 97}px` }} />
                              <col style={{ width: `${columnWidths.p2_remarks || 70}px` }} />
                            </colgroup>
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 uppercase font-black text-center">
                                <ResizableTh colKey="p2_sno" sortKey="sno" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_sno || columnWidths.sno || 32} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap">S. NO.</span></ResizableTh>
                                <ResizableTh colKey="p2_stream" sortKey="stream" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_stream} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap">STREAM</span></ResizableTh>
                                <ResizableTh colKey="p2_subs" sortKey="subs" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_subs} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap">SUBS</span></ResizableTh>
                                <ResizableTh colKey="p2_aadhar" sortKey="aadhar" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_aadhar} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow"><span className="block whitespace-nowrap leading-tight">AADHAR</span><span className="block whitespace-nowrap leading-tight mt-0.5">NO.</span></ResizableTh>
                                <ResizableTh colKey="p2_cat" sortKey="category" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_cat} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow"><span className="block whitespace-nowrap leading-tight">SOC.</span><span className="block whitespace-nowrap leading-tight mt-0.5">CAT.</span></ResizableTh>
                                <ResizableTh colKey="p2_socio" sortKey="socioEcon" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_socio} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow"><span className="block whitespace-nowrap leading-tight">SOCIO-</span><span className="block whitespace-nowrap leading-tight mt-0.5">ECON CAT.</span></ResizableTh>
                                <ResizableTh colKey="p2_blood" sortKey="blood" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_blood} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow"><span className="block whitespace-nowrap leading-tight">BLOOD</span><span className="block whitespace-nowrap leading-tight mt-0.5">GRP</span></ResizableTh>
                                <ResizableTh colKey="p2_account" sortKey="account" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_account || 86} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow"><span className="block whitespace-nowrap leading-tight">A/C NO. &amp;</span><span className="block whitespace-nowrap leading-tight mt-0.5">IFSC</span></ResizableTh>
                                <th colSpan="3" className="border border-slate-900 px-1 py-0.5 text-center h-grey">PREVIOUS ACADEMIC DETAILS</th>
                                <ResizableTh colKey="p2_pen" sortKey="pen" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_pen} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey"><span className="block whitespace-nowrap leading-tight">PEN</span><span className="block whitespace-nowrap leading-tight text-[7px] mt-0.5">(UDISE)</span></ResizableTh>
                                <ResizableTh colKey="p2_prevCC" sortKey="prevCC" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_prevCC} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-emerald-900 bg-emerald-100 h-green">ADMTD. VIDE DC/CC<br />(No.; Date)</ResizableTh>
                                <ResizableTh colKey="p2_withdrawal" sortKey="withdrawal" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_withdrawal} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-100 h-red">RESULT /<br />WITHDRAWAL DT.</ResizableTh>
                                <ResizableTh colKey="p2_issuedCC" sortKey="issuedCC" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_issuedCC} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-50 h-red">ISSUED DC/CC</ResizableTh>
                                <ResizableTh colKey="p2_receipt" sortKey="receipt" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_receipt} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-50 h-red">RECEIPT</ResizableTh>
                                <ResizableTh colKey="p2_remarks" sortKey="remarks" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_remarks || 70} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">REMARKS</ResizableTh>
                              </tr>
                              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[7.5px]">
                                <ResizableTh colKey="p2_prevSchool" sortKey="prevSchool" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_prevSchool} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">PREVIOUS SCHOOL</ResizableTh>
                                <ResizableTh colKey="p2_prevRoll" sortKey="prevRoll" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_prevRoll} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey"><span className="block whitespace-nowrap leading-tight">PREV</span><span className="block whitespace-nowrap leading-tight mt-0.5">R.NO.</span></ResizableTh>
                                <ResizableTh colKey="p2_prevResult" sortKey="prevResult" sortConfig={sortConfig} onSort={handleSort} width={columnWidths.p2_prevResult} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey"><span className="block whitespace-nowrap leading-tight">PREV</span><span className="block whitespace-nowrap leading-tight mt-0.5">RESULT</span></ResizableTh>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-900">
                              {chunk.map((s, idx) => (
                                <ResizableDataRow key={`chunk_row_p2_${s.id || ''}_${idx}`} rowHeight={rowHeight} onResize={handleRowHeightChange} className="hover:bg-slate-50">
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-bold ledger-mono-font text-[8.5px]" data-col="p2_sno">{s.sno}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-[8px]" data-col="p2_stream"><StreamLabel value={s.stream} /></td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7.5px] leading-tight font-medium overflow-hidden" data-col="p2_subs">
                                    <div className="line-clamp-2 leading-tight break-words">{s.subs}</div>
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono bg-yellow-50 ledger-mono-font text-[8px]" data-col="p2_aadhar">{s.aadhar}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-black text-[8px]" data-col="p2_cat">{s.category}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 text-[8px]" data-col="p2_socio">{s.socioEcon}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-bold text-[8px]" data-col="p2_blood">{s.blood}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left align-middle font-mono bg-yellow-50 ledger-mono-font overflow-hidden text-[8.8px]" data-col="p2_account">
                                     <div className="account-num font-bold text-[9px] text-slate-900 leading-tight truncate" style={{ fontSize: '9px' }}>
                                       {s.account && s.account !== '—' ? s.account : '—'}
                                     </div>
                                     {s.ifsc && s.ifsc !== '—' && s.ifsc !== 'NA' && (
                                       <div className="ifsc-code text-[8px] text-slate-600 font-medium leading-tight truncate" style={{ fontSize: '8px' }}>
                                         {s.ifsc}
                                       </div>
                                     )}
                                   </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[8.5px] leading-tight overflow-hidden align-middle" style={{ fontSize: '8.5px' }} data-col="p2_prevSchool">
                                    <div className="line-clamp-2 leading-tight break-words text-[8.5px]" style={{ fontSize: '8.5px' }}>{s.prevSchool}</div>
                                  </td>
                                  <td className="border border-slate-900 px-0.5 py-0.5 text-center font-mono ledger-mono-font text-[5.5px] whitespace-nowrap" style={{ fontSize: '5.5px' }} data-col="p2_prevRoll">{s.prevRoll}</td>
                                  <td className="border border-slate-900 px-0.5 py-0.5 text-center font-bold text-[6.5px]" style={{ fontSize: '6.5px' }} data-col="p2_prevResult">
                                    {(() => {
                                      const pRes = String(s.prevResult || '').trim();
                                      const isPQual = /^(pass|passed|qual|qualified)\b/i.test(pRes) || /qualified/i.test(pRes) || /passed/i.test(pRes);
                                      const isPReap = /^(reap|reappear|fail|failed)\b/i.test(pRes) || /reappear/i.test(pRes) || /reap\b/i.test(pRes);
                                      const pColor = isPQual ? '#047857' : isPReap ? '#b91c1c' : undefined;
                                      const pClass = isPQual ? 'text-emerald-700 dark:text-emerald-400 font-black' : isPReap ? 'text-red-700 dark:text-red-400 font-black' : 'font-bold';
                                      return <span className={pClass} style={pColor ? { color: pColor, fontSize: '6.5px' } : { fontSize: '6.5px' }}>{pRes || '—'}</span>;
                                    })()}
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[8.8px] ledger-mono-font overflow-hidden" data-col="p2_pen">{renderPenCell(s.pen)}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-emerald-900 font-bold text-[8.8px] bg-emerald-50" data-col="p2_prevCC">
                                    {renderAdmittedVideCell(s.prevCC)}
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-rose-900 text-[7.8px] bg-rose-50" data-col="p2_withdrawal"></td>
                                  <td className="register-handwrite-cell border border-slate-900 px-1.5 py-0.5 text-left bg-rose-50/40 overflow-hidden align-top" data-col="p2_issuedCC">
                                    {s.issuedCC ? (
                                      <div className="text-[7.5px] leading-tight font-semibold text-slate-900 line-clamp-2">{s.issuedCC}</div>
                                    ) : (
                                      <div className="handwrite-container flex flex-col justify-between h-full py-0.5 select-none font-medium text-slate-800">
                                        <div className="handwrite-line flex items-center gap-1 leading-none">
                                          <span className="handwrite-label font-bold text-[7px] text-slate-700 tracking-tight shrink-0">C.No:</span>
                                          <span className="handwrite-guide flex-1 border-b border-dotted border-slate-500 min-w-[28px] h-2"></span>
                                        </div>
                                        <div className="handwrite-line flex items-center gap-1 leading-none mt-auto pt-1 pb-0.5">
                                          <span className="handwrite-label font-bold text-[7px] text-slate-700 tracking-tight shrink-0">Date:</span>
                                          <span className="handwrite-guide flex-1 border-b border-dotted border-slate-500 min-w-[28px] h-2"></span>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="register-handwrite-cell border border-slate-900 px-1.5 py-0.5 text-left bg-rose-50/40 overflow-hidden align-top" data-col="p2_receipt">
                                    {s.receipt ? (
                                      <div className="text-[7.5px] leading-tight font-semibold text-slate-900 line-clamp-2">{s.receipt}</div>
                                    ) : (
                                      <div className="handwrite-container flex flex-col justify-between h-full py-0.5 select-none font-medium text-slate-800">
                                        <div className="handwrite-line flex items-center gap-1 leading-none">
                                          <span className="handwrite-label font-bold text-[7px] text-slate-700 tracking-tight shrink-0">Rcvd on:</span>
                                          <span className="handwrite-guide flex-1 border-b border-dotted border-slate-500 min-w-[24px] h-2"></span>
                                        </div>
                                        <div className="handwrite-line flex items-center gap-1 leading-none mt-auto pt-1 pb-0.5">
                                          <span className="handwrite-label font-bold text-[7px] text-slate-700 tracking-tight shrink-0">Signature:</span>
                                          <span className="handwrite-guide flex-1 border-b border-dotted border-slate-500 min-w-[24px] h-2"></span>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7.2px] leading-tight overflow-hidden align-middle" style={{ fontSize: '7.2px' }} data-col="p2_remarks">
                                    <div className="line-clamp-4 leading-[1.12] break-words remarks-wrap" style={{ fontSize: '7.2px', lineHeight: 1.12 }} title={s.remarks}>{formatCompactRemark(s.remarks)}</div>
                                  </td>
                                </ResizableDataRow>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Signatures */}
                        <div className="signature-footer flex justify-between items-center mt-6 sm:mt-8 pt-3 text-xs font-black text-red-700 w-full">
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
                    {filteredStudents.filter(s => skippedRowIds.has(s.id)).map((s, idx) => (
                      <button
                        key={`skip_${s.id || ''}_${idx}`}
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
                    className="page-container sentup-ledger-page bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:w-full print:min-w-full print:max-w-none print:m-0 max-w-[355.6mm] mx-auto"
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
                          {chunk.map((s, idx) => {
                            const photoSrc = getResolvedStudentPhoto(s);
                            const isSkipped = skippedRowIds.has(s.id);
                            return (
                              <ResizableDataRow key={`chunk_sentup_${s.id || ''}_${idx}`} rowHeight={rowHeight} onResize={handleRowHeightChange} className={`hover:bg-slate-50 ${isSkipped ? 'opacity-50 bg-slate-100 dark:bg-slate-800/50' : ''}`}>
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
                                    <div className="text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400 ledger-mono-font">
                                      [{s.oldAdmNo && s.oldAdmNo !== s.admNo && s.oldAdmNo !== '—' ? `${s.admNo || '—'} (${s.oldAdmNo})` : (s.admNo || '—')}]
                                    </div>
                                  </td>
                                )}
                                {isSentupColVisible('st_rollNo') && (
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-[15px] text-sky-800 ledger-mono-font st-rollno-cell">{s.rollNo}</td>
                                )}
                                {isSentupColVisible('st_photo') && (
                                  <td className="sentup-photo-cell register-photo-cell border border-slate-900 p-0 text-center overflow-hidden bg-slate-50 print:bg-transparent" style={{ width: columnWidths.st_photo ? `${columnWidths.st_photo}px` : undefined, height: `${rowHeight}px` }}>
                                    <div className="sentup-photo-inner w-full h-full flex items-center justify-center p-0.5 overflow-hidden">
                                      {photoSrc ? (
                                        <img
                                          src={photoSrc}
                                          alt={s.name}
                                          className="block max-h-full max-w-full object-contain mx-auto"
                                          style={{ maxHeight: `${Math.max(32, rowHeight - 2)}px` }}
                                          loading="eager"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const fb = e.currentTarget.parentElement?.querySelector('.photo-fallback');
                                            if (fb) fb.classList.remove('hidden');
                                          }}
                                        />
                                      ) : null}
                                      <span className={`photo-fallback text-[8.5px] text-slate-400 font-bold select-none ${photoSrc ? 'hidden' : 'block'}`}>
                                        Photo
                                      </span>
                                    </div>
                                  </td>
                                )}
                                {isSentupColVisible('st_boardReg') && (
                                  <td className="border border-slate-900 px-1.5 py-0.5 text-left pl-2 ledger-mono-font text-[14px] sm:text-[15px] font-black st-boardreg-cell">{formatBoardRegSplit(s.boardReg)}</td>
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
                                    <div className="font-bold text-[11px] text-slate-900">{formatRegisterDate(s.dobFigures) || s.dobFigures || '—'}</div>
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
          {/* TAB 3: ASSIGN IDs (BULK SEQUENTIAL + GAP AUDITOR LEDGER)        */}
          {/* ============================================================== */}
          {/* ============================================================== */}
          {/* TAB 3: ASSIGN IDs & GAP AUDITOR (INTEGRATED PAGE)               */}
          {/* ============================================================== */}
          {activeTab === 'assign_ids' && (
            <div className="space-y-3.5 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
              {/* Compact Control Bar with Integrated Mode Switcher */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <Layers size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      Bulk Assign Admission Numbers & Sequence Gap Auditor
                    </h2>
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      Paired-tier sequential allotment (11th→12th Re-adm, 9th→10th Re-adm) with continuous audit and bracketed old admission numbers.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Mode Switcher Tabs */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setAssignViewMode('integrated')}
                      className={`py-1 px-2.5 rounded-md text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                        assignViewMode === 'integrated'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="View both the Allotment Queue and Sequential Ledger on the same page"
                    >
                      <Layers size={12} />
                      <span>⚡ Integrated (All-in-One)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignViewMode('allot')}
                      className={`py-1 px-2.5 rounded-md text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                        assignViewMode === 'allot'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Focus on Candidate Allotment Queue"
                    >
                      <CreditCard size={12} />
                      <span>Allotment Queue</span>
                      {candidateIdPreviewList.length > 0 && (
                        <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-indigo-800 text-white font-mono">
                          {candidateIdPreviewList.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignViewMode('audit')}
                      className={`py-1 px-2.5 rounded-md text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                        assignViewMode === 'audit'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Focus on Sequential Ledger & Gap Auditor"
                    >
                      <ListOrdered size={12} />
                      <span>Ledger & Gaps</span>
                      <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9.5px] font-mono ${
                        auditorStats.totalGaps > 0
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-black'
                          : 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}>
                        {auditorStats.totalAssigned}
                      </span>
                    </button>
                  </div>

                  {/* Actions */}
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
                    title="Assign proposed IDs to all queued students"
                  >
                    {assigningIds ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                    <span>Assign IDs ({candidateIdPreviewList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAuditorExcel}
                    disabled={auditorStats.totalAssigned === 0}
                    className="py-1 px-3 rounded-lg font-black text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all text-xs active:scale-95"
                    title="Export complete sequential ledger, skipped gap list, and duplicate audits to Excel"
                  >
                    <Download size={12} />
                    <span>Export Audit (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Shared Scope Toolbar (Session, Quick Tiers, Start ID, Checkboxes) */}
              <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                {/* Session Scope */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Session:</span>
                  <select
                    value={assignSessionFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssignSessionFilter(val);
                      if (val !== selectedSession) {
                        handleSessionChange(val);
                      }
                    }}
                    className="py-0.5 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess}</option>
                    ))}
                    <option value="ALL">All Sessions</option>
                  </select>
                </div>

                {/* Target Classes Quick Tiers & Toggle Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Classes / Tier:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAssignClasses(['11th', '12th'])}
                      className={`py-0.5 px-2 rounded text-[10.5px] font-black cursor-pointer border transition-all ${
                        assignClasses.includes('11th') && assignClasses.includes('12th') && assignClasses.length === 2
                          ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50'
                      }`}
                      title="Higher Secondary Tier: Priority 1 for 11th, Priority 2 for 12th Re-admissions with Gap"
                    >
                      🎓 11th & 12th (HSS)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignClasses(['9th', '10th'])}
                      className={`py-0.5 px-2 rounded text-[10.5px] font-black cursor-pointer border transition-all ${
                        assignClasses.includes('9th') && assignClasses.includes('10th') && assignClasses.length === 2
                          ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50'
                      }`}
                      title="Secondary Tier: Priority 1 for 9th, Priority 2 for 10th Re-admissions with Gap"
                    >
                      🏫 9th & 10th (SEC)
                    </button>
                    <span className="text-slate-300 dark:text-slate-700 mx-0.5">|</span>
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
                          className={`py-0.5 px-1.5 rounded text-[10.5px] font-extrabold cursor-pointer border transition-all ${
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

                {/* Start ID Input */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Start ID:</span>
                  <input
                    type="number"
                    value={assignStartId}
                    onChange={(e) => setAssignStartId(e.target.value)}
                    className="w-20 py-0.5 px-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-center"
                  />
                </div>

                {/* Queue Order Variable */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Queue Order:</span>
                  <select
                    value={assignSortVariable}
                    onChange={(e) => setAssignSortVariable(e.target.value)}
                    className="py-0.5 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer text-[10.5px]"
                    title="Order students within priority tier (Default: Class Roll No.)"
                  >
                    <option value="rollNo">Class Roll No. (Default)</option>
                    <option value="admNo">Adm No / Prev Adm</option>
                    <option value="name">Student Name</option>
                    <option value="formNo">Form No.</option>
                  </select>
                </div>

                {/* Only Approved Checkbox */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white dark:bg-slate-900 py-0.5 px-2 rounded-md border border-slate-200 dark:border-slate-800">
                  <input
                    type="checkbox"
                    checked={onlyApprovedAssign}
                    onChange={(e) => setOnlyApprovedAssign(e.target.checked)}
                    className="rounded text-emerald-600 cursor-pointer"
                  />
                  <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">Only Approved / Roll Assigned</span>
                </label>

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

              {/* Universal Top KPI Metrics Strip (Sequence Range & Health) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {/* 1. Total Allotted */}
                <div className="p-2 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                  <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Allotted Numbers</div>
                  <div className="text-base font-black text-indigo-900 dark:text-indigo-200 font-mono">
                    {auditorStats.totalAssigned}
                  </div>
                  <div className="text-[9.5px] text-indigo-600/80 dark:text-indigo-400/80 font-medium">Students with Adm No</div>
                </div>

                {/* 2. Number Range */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sequential Range</div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono truncate">
                    {auditorStats.minAdm !== null ? `${auditorStats.minAdm} – ${auditorStats.maxAdm}` : 'None'}
                  </div>
                  <div className="text-[9.5px] text-slate-500 font-medium">
                    Span: {auditorStats.span} numbers
                  </div>
                </div>

                {/* 3. Gaps Detected */}
                <div className={`p-2 rounded-lg border shadow-2xs ${
                  auditorStats.totalGaps > 0
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      auditorStats.totalGaps > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                    }`}>
                      Gaps in Sequence
                    </span>
                    {auditorStats.totalGaps > 0 ? (
                      <AlertTriangle size={13} className="text-amber-600" />
                    ) : (
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    )}
                  </div>
                  <div className={`text-base font-black font-mono ${
                    auditorStats.totalGaps > 0 ? 'text-amber-900 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200'
                  }`}>
                    {auditorStats.totalGaps === 0 ? '0 Gaps' : `${auditorStats.totalGaps} Gaps`}
                  </div>
                  <div className={`text-[9.5px] font-medium ${
                    auditorStats.totalGaps > 0 ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {auditorStats.totalGaps === 0 ? '✓ Fully continuous sequence' : `⚠️ ${auditorStats.totalSkippedNumbers} numbers skipped`}
                  </div>
                </div>

                {/* 4. Duplicates */}
                <div className={`p-2 rounded-lg border shadow-2xs ${
                  auditorStats.duplicatesCount > 0
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      auditorStats.duplicatesCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'
                    }`}>
                      Duplicates
                    </span>
                    {auditorStats.duplicatesCount > 0 ? (
                      <AlertCircle size={13} className="text-rose-600" />
                    ) : (
                      <Check size={13} className="text-emerald-600" />
                    )}
                  </div>
                  <div className={`text-base font-black font-mono ${
                    auditorStats.duplicatesCount > 0 ? 'text-rose-900 dark:text-rose-200' : 'text-emerald-800 dark:text-emerald-200'
                  }`}>
                    {auditorStats.duplicatesCount === 0 ? '0 Duplicates' : `${auditorStats.duplicatesCount} Duplicates`}
                  </div>
                  <div className={`text-[9.5px] font-medium ${
                    auditorStats.duplicatesCount > 0 ? 'text-rose-700 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {auditorStats.duplicatesCount === 0 ? '✓ No duplicate numbers' : '🚨 Clashing IDs detected!'}
                  </div>
                </div>

                {/* 5. Unassigned Pending */}
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 shadow-2xs">
                  <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Allotment Queue</div>
                  <div className="text-base font-black text-purple-900 dark:text-purple-200 font-mono">
                    {candidateIdPreviewList.length}
                  </div>
                  <div className="text-[9.5px] text-purple-600 dark:text-purple-400 font-medium">
                    {candidateIdPreviewList.length === 0 ? '✓ Scope fully allotted' : 'Pending in queue'}
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* SECTION 1: PRIORITY ALLOTMENT QUEUE & CANDIDATE PREVIEW      */}
              {/* ============================================================ */}
              {(assignViewMode === 'integrated' || assignViewMode === 'allot') && (
                <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        <CreditCard size={13} />
                      </span>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Section 1: Priority Allotment Queue
                      </h3>
                      <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                        {candidateIdPreviewList.length} Students
                      </span>
                    </div>

                    <div className="text-[10.5px] text-slate-500 font-medium">
                      Start Sequence: <strong className="font-mono text-indigo-700 dark:text-indigo-300 font-black">{assignStartId}</strong>
                    </div>
                  </div>

                  {/* Priority Rules Guidance Callout */}
                  <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 flex items-start gap-2">
                    <span className="p-1 rounded-md bg-indigo-600 text-white font-black text-xs shrink-0 mt-0.5">
                      <Check size={12} />
                    </span>
                    <div className="text-[11px] leading-relaxed text-indigo-950 dark:text-indigo-200">
                      <strong className="font-black text-indigo-900 dark:text-white uppercase tracking-wider block text-[10px] mb-0.5">
                        Session Allotment & Audit Policy ({assignSessionFilter})
                      </strong>
                      <span>
                        🎯 <strong className="font-bold text-indigo-900 dark:text-indigo-200">Active Scope:</strong> Checked and audited strictly for <strong className="text-emerald-800 dark:text-emerald-300">Class 9th</strong>, <strong className="text-indigo-800 dark:text-indigo-300">Class 11th</strong>, and students labelled as <strong className="text-amber-800 dark:text-amber-300">Re-admission</strong> for {assignSessionFilter}.
                        {' • '}
                        🥇 <strong className="font-bold text-emerald-800 dark:text-emerald-300">Priority 1 (Fresh 9th / 11th):</strong> Ordered by Roll No, consumes starting sequential IDs (e.g. 5001–5100).
                        {' • '}
                        🥈 <strong className="font-bold text-amber-800 dark:text-amber-300">Priority 2 (Re-admissions):</strong> Consumes next sequential IDs, retaining previous IDs in brackets like <span className="font-mono font-black text-purple-700 dark:text-purple-300">5101 (4892)</span>.
                        {' • '}
                        🔄 <strong className="font-bold text-slate-700 dark:text-slate-300">Regular Continuous:</strong> Standard 1-year progression students (10th/12th) retain their previous admission number without advancing sequential counter.
                      </span>
                    </div>
                  </div>

                  {candidateIdPreviewList.length > 0 ? (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-black text-slate-700 dark:text-slate-300 text-[11px] border-b border-slate-200 dark:border-slate-700 z-10">
                            <tr>
                              <th className="py-1.5 px-2 w-10 text-center">#</th>
                              <th className="py-1.5 px-2 w-36">Priority Group</th>
                              <th className="py-1.5 px-2 w-14 text-center">Roll No</th>
                              <th className="py-1.5 px-2 min-w-40">Student & Father's Name</th>
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
                              const { student, currentAdm, prevInfo, strat, proposed, proposedDisplay, oldAdmNo, isGapReAdmission } = item;
                              return (
                                <tr key={`cand_preview_${student.id || idx}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                                  <td className="py-1 px-2 text-center font-bold text-slate-400 ledger-mono-font">{idx + 1}</td>
                                  <td className="py-1 px-2">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-black border ${item.priorityInfo?.priorityBadge || 'bg-slate-100 text-slate-700'}`}>
                                      {item.priorityInfo?.tierLabel || 'Standard'}
                                    </span>
                                  </td>
                                  <td className="py-1 px-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300 ledger-mono-font">
                                    {student.rollNo || '—'}
                                  </td>
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
                                    ) : oldAdmNo ? (
                                      <span className="px-1.5 py-0.5 rounded font-black text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-950 border border-purple-300 dark:border-purple-800">
                                        {oldAdmNo} (Old)
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
                                      {(prevInfo || currentAdm) && (
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
                                  <td className="py-1 px-2 text-right">
                                    {(isGapReAdmission || (oldAdmNo && oldAdmNo !== proposed)) && oldAdmNo && oldAdmNo !== '—' ? (
                                      <div className="font-mono font-black text-xs text-purple-700 dark:text-purple-300">
                                        <span>{proposed}</span> <span className="text-[10px] text-purple-600 font-bold">({oldAdmNo})</span>
                                      </div>
                                    ) : (
                                      <div className="font-mono font-black text-indigo-700 dark:text-indigo-300 text-xs">
                                        {proposed}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center border-2 border-dashed border-indigo-200 dark:border-indigo-800/60 rounded-xl bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900">
                      <div className="inline-flex p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-1.5 shadow-xs">
                        <CheckCircle2 size={24} />
                      </div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white mb-0.5">
                        All Eligible Students (9th, 11th & Re-admissions) in Selected Scope Already Have Admission Numbers!
                      </h4>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto mb-2 font-medium">
                        Found <strong className="font-bold text-indigo-700 dark:text-indigo-300">{auditorStats.totalAssigned}</strong> eligible students with assigned admission numbers in range <span className="font-mono font-bold text-slate-800 dark:text-slate-200">[{auditorStats.minAdm || '—'} – {auditorStats.maxAdm || '—'}]</span>.
                        {auditorStats.totalGaps > 0 ? (
                          <span className="block mt-0.5 font-bold text-amber-600 dark:text-amber-400">
                            ⚠️ Note: {auditorStats.totalGaps} sequential {auditorStats.totalGaps === 1 ? 'gap' : 'gaps'} ({auditorStats.totalSkippedNumbers} skipped numbers) detected in this range.
                          </span>
                        ) : (
                          <span className="block mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ All admission numbers in this scope are fully continuous with zero gaps!
                          </span>
                        )}
                      </p>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 py-1 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={onlyMissingAdmNo}
                          onChange={(e) => setOnlyMissingAdmNo(e.target.checked)}
                          className="rounded text-indigo-600 cursor-pointer"
                        />
                        <span>Show All (Uncheck "Only Missing")</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* SECTION 2: SEQUENTIAL ADMISSION NO. LEDGER & GAP AUDITOR     */}
              {/* ============================================================ */}
              {(assignViewMode === 'integrated' || assignViewMode === 'audit') && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="p-1 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        <ListOrdered size={13} />
                      </span>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Section 2: Sequential Admission No. Ledger & Gap Auditor
                      </h3>
                      <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                        {auditorStats.totalAssigned} Allotted Records
                      </span>
                    </div>

                    {auditorStats.totalGaps > 0 ? (
                      <div className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                        <AlertTriangle size={12} className="text-amber-600" />
                        <span>{auditorStats.totalGaps} Gaps ({auditorStats.totalSkippedNumbers} numbers skipped)</span>
                      </div>
                    ) : (
                      <div className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        <span>Continuous Sequence (0 Gaps)</span>
                      </div>
                    )}
                  </div>

                  {/* Auditor Filter Bar & Real-time Search */}
                  <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                    {/* Left: Filter Pills */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setAuditorFilter('all')}
                        className={`py-0.5 px-2 rounded text-[10.5px] font-bold cursor-pointer border transition-all ${
                          auditorFilter === 'all'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        All Sequential ({sequentialAuditorItems.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setAuditorFilter('gaps_only')}
                        className={`py-0.5 px-2 rounded text-[10.5px] font-bold cursor-pointer border transition-all ${
                          auditorFilter === 'gaps_only'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-slate-300 dark:border-slate-700 hover:bg-amber-50'
                        }`}
                      >
                        Gaps Only ({auditorStats.totalGaps})
                      </button>

                      <button
                        type="button"
                        onClick={() => setAuditorFilter('duplicates_only')}
                        className={`py-0.5 px-2 rounded text-[10.5px] font-bold cursor-pointer border transition-all ${
                          auditorFilter === 'duplicates_only'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 border-slate-300 dark:border-slate-700 hover:bg-rose-50'
                        }`}
                      >
                        Duplicates ({auditorStats.duplicatesCount})
                      </button>

                      <button
                        type="button"
                        onClick={() => setAuditorFilter('unassigned_only')}
                        className={`py-0.5 px-2 rounded text-[10.5px] font-bold cursor-pointer border transition-all ${
                          auditorFilter === 'unassigned_only'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 border-slate-300 dark:border-slate-700 hover:bg-purple-50'
                        }`}
                      >
                        Unassigned ({auditorStats.unassignedCount})
                      </button>

                      {/* Optional History Inclusion Checkbox */}
                      <label className="flex items-center gap-1 cursor-pointer select-none bg-white dark:bg-slate-900 py-0.5 px-2 rounded border border-slate-300 dark:border-slate-700 ml-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={includeHistoryInAudit}
                          onChange={(e) => setIncludeHistoryInAudit(e.target.checked)}
                          className="rounded text-indigo-600 cursor-pointer"
                        />
                        <span className="text-[10px]">Include Past Archives</span>
                      </label>
                    </div>

                    {/* Right: Search Input */}
                    <div className="relative min-w-56 flex-1 sm:flex-initial">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search Adm No, Name, Roll No, Reg..."
                        value={auditorSearch}
                        onChange={(e) => setAuditorSearch(e.target.value)}
                        className="w-full pl-7 pr-6 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {auditorSearch && (
                        <button
                          type="button"
                          onClick={() => setAuditorSearch('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sequential Ledger Table with Gap Alert Rows */}
                  {displayAuditorItems.length > 0 ? (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                      <div className="max-h-[550px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-black text-slate-700 dark:text-slate-300 text-[11px] border-b border-slate-200 dark:border-slate-700 z-10">
                            <tr>
                              <th className="py-1.5 px-2.5 w-12 text-center">#</th>
                              <th className="py-1.5 px-2.5 w-28">Adm No</th>
                              <th className="py-1.5 px-2 w-16 text-center">Roll No</th>
                              <th className="py-1.5 px-2.5 min-w-48">Student & Parentage</th>
                              <th className="py-1.5 px-2 w-28">Class (Session)</th>
                              <th className="py-1.5 px-2 w-32">Board Reg. No.</th>
                              <th className="py-1.5 px-2 w-24 text-center">Adm Date</th>
                              <th className="py-1.5 px-2 w-20 text-center">Status</th>
                              <th className="py-1.5 px-2.5 w-28 text-right">Integrity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                            {displayAuditorItems.map((item, rowIdx) => {
                              if (item.type === 'gap') {
                                return (
                                  <tr key={item.id} className="bg-amber-500/10 dark:bg-amber-950/40 border-y-2 border-amber-400/80 dark:border-amber-600/80">
                                    <td colSpan={9} className="py-2 px-3">
                                      <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <span className="p-1 rounded-md bg-amber-500 text-white shadow-2xs font-black">
                                            <AlertTriangle size={13} />
                                          </span>
                                          <div>
                                            <div className="font-black text-amber-900 dark:text-amber-200 text-xs flex items-center gap-1.5">
                                              <span>GAP DETECTED:</span>
                                              <span className="font-mono bg-amber-200/90 dark:bg-amber-900/90 px-1.5 py-0.2 rounded text-amber-950 dark:text-amber-100 font-black">
                                                {item.gapStart === item.gapEnd ? `Adm No. ${item.gapStart}` : `Adm Nos. ${item.gapStart} to ${item.gapEnd}`}
                                              </span>
                                              <span className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                                                ({item.gapCount} {item.gapCount === 1 ? 'number' : 'numbers'} missing / skipped)
                                              </span>
                                            </div>
                                            <div className="text-[10px] text-amber-800 dark:text-amber-300/80 font-medium mt-0.5">
                                              Preceded by: <strong className="font-bold text-slate-900 dark:text-white">{item.prevStudent?.name || '—'}</strong> (Adm: <span className="font-mono">{item.gapStart - 1}</span>, Roll: <span className="font-mono">{item.prevStudent?.rollNo || '—'}</span>)
                                              {' • '}
                                              Followed by: <strong className="font-bold text-slate-900 dark:text-white">{item.nextStudent?.name || '—'}</strong> (Adm: <span className="font-mono">{item.gapEnd + 1}</span>, Roll: <span className="font-mono">{item.nextStudent?.rollNo || '—'}</span>)
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 text-[10px] font-mono text-amber-800 dark:text-amber-300 bg-white/70 dark:bg-slate-900/70 py-0.5 px-2 rounded border border-amber-300 dark:border-amber-700">
                                          <span className="font-bold">Skipped IDs:</span>
                                          <span className="font-black text-amber-950 dark:text-amber-100">
                                            {item.gapCount <= 6
                                              ? Array.from({ length: item.gapCount }, (_, i) => item.gapStart + i).join(', ')
                                              : `${item.gapStart}, ${item.gapStart + 1}, ${item.gapStart + 2} ... ${item.gapEnd}`}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              const st = item.student;
                              return (
                                <tr
                                  key={item.id}
                                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                                    item.isDuplicate ? 'bg-rose-50/60 dark:bg-rose-950/30' : ''
                                  }`}
                                >
                                  <td className="py-1 px-2.5 text-center font-bold text-slate-400 ledger-mono-font">
                                    {rowIdx + 1}
                                  </td>
                                  <td className="py-1 px-2.5">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded ${
                                        item.isDuplicate
                                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                                          : item.isUnassigned
                                            ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                      }`}>
                                        {item.admNo}
                                      </span>
                                      {st.oldAdmNo && st.oldAdmNo !== item.admNo && (
                                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border border-purple-300 dark:border-purple-800" title={`Old Admission No. before Academic Gap: ${st.oldAdmNo}`}>
                                          ({st.oldAdmNo})
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-1 px-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300 ledger-mono-font">
                                    {st.rollNo || '—'}
                                  </td>
                                  <td className="py-1 px-2.5">
                                    <div className="font-extrabold text-slate-900 dark:text-white leading-tight">
                                      {st.name}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      S/O: {st.father || '—'}
                                    </div>
                                  </td>
                                  <td className="py-1 px-2 font-bold text-indigo-600 dark:text-indigo-400">
                                    {st.class} <span className="text-[10px] text-slate-400">({st.session})</span>
                                  </td>
                                  <td className="py-1 px-2 font-mono text-[10.5px] ledger-mono-font">
                                    {st.boardReg || '—'}
                                  </td>
                                  <td className="py-1 px-2 text-center font-mono text-[10.5px] text-slate-600 dark:text-slate-400">
                                    {formatRegisterDate(st.admDate) || st.admDate || '—'}
                                  </td>
                                  <td className="py-1 px-2 text-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black ${
                                      st.status === 'Approved'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : st.status === 'Historical'
                                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    }`}>
                                      {st.status || '—'}
                                    </span>
                                  </td>
                                  <td className="py-1 px-2.5 text-right font-mono text-[10px]">
                                    {item.isDuplicate ? (
                                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
                                        <AlertCircle size={11} /> Duplicate ({item.duplicateCount})
                                      </span>
                                    ) : item.isUnassigned ? (
                                      <span className="text-purple-600 dark:text-purple-400 font-bold">Unassigned</span>
                                    ) : (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-end gap-1">
                                        <Check size={11} /> Sequential
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 font-semibold border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950">
                      {auditorFilter === 'gaps_only' ? (
                        <div className="flex flex-col items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={24} />
                          <span className="font-black text-xs">Zero Gaps Found!</span>
                          <span className="text-[11px] text-slate-500">The admission numbers in this scope are completely continuous.</span>
                        </div>
                      ) : auditorFilter === 'duplicates_only' ? (
                        <div className="flex flex-col items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <Check size={24} />
                          <span className="font-black text-xs">Zero Duplicates Found!</span>
                          <span className="text-[11px] text-slate-500">Every admission number is unique to a single student.</span>
                        </div>
                      ) : (
                        'No records match the current filters or search criteria.'
                      )}
                    </div>
                  )}
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

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white dark:bg-slate-900 py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <input
                      type="checkbox"
                      checked={onlyApprovedDates}
                      onChange={(e) => setOnlyApprovedDates(e.target.checked)}
                      className="rounded text-emerald-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Only Approved / Roll Assigned</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRunAssignDates}
                    disabled={assigningDates || effectiveTargetStudents.length === 0}
                    className="py-1 px-3 rounded-lg font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all text-xs active:scale-95"
                  >
                    {assigningDates ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                    <span>Apply Date ({effectiveTargetStudents.length} Students)</span>
                  </button>
                </div>
              </div>

              {/* Compact Form Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
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
                    <div className="flex items-center gap-1.5">
                      {assignDateValue && (
                        <span className="text-[9.5px] font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800" title="Selected Date in DD-MM-YYYY format">
                          {formatRegisterDate(assignDateValue) || assignDateValue}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setAssignDateValue(new Date().toISOString().split('T')[0])}
                        className="text-[9.5px] text-indigo-600 hover:underline cursor-pointer font-bold"
                      >
                        Today
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={assignDateValue}
                    onChange={(e) => setAssignDateValue(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono text-center cursor-pointer"
                  />
                  <div className="text-[9.5px] text-center text-slate-500 dark:text-slate-400 font-mono mt-0.5 font-bold">
                    Target: <strong className="text-indigo-700 dark:text-indigo-300 font-black">{formatRegisterDate(assignDateValue) || 'DD-MM-YYYY'}</strong> (DD-MM-YYYY)
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-0.5">Session Scope:</label>
                  <select
                    value={assignDateSession}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssignDateSession(val);
                      if (val !== selectedSession) {
                        handleSessionChange(val);
                      }
                    }}
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

                {/* Sort / Order By Selector */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10.5px] font-bold text-slate-500">Order / Sort By:</label>
                    <button
                      type="button"
                      onClick={() => setDateSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                      title="Toggle ascending / descending sort order"
                    >
                      {dateSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={dateSortField}
                      onChange={(e) => setDateSortField(e.target.value)}
                      className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer text-indigo-700 dark:text-indigo-300"
                    >
                      <option value="rollNo">🔢 Class Roll No (Default)</option>
                      <option value="admNo">🎫 Admission No</option>
                      <option value="name">🔤 Student Name</option>
                      <option value="father">👤 Father's Name</option>
                      <option value="currentDate">📅 Current Date</option>
                      <option value="class">🏫 Class</option>
                      <option value="sno">📋 Original List Order</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setDateSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="p-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:text-indigo-600 cursor-pointer shrink-0 shadow-2xs"
                      title={dateSortDirection === 'asc' ? 'Currently Ascending (Click for Descending)' : 'Currently Descending (Click for Ascending)'}
                    >
                      {dateSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Range & Batch Selection Toolbar */}
              <div className="flex items-center justify-between gap-2.5 flex-wrap p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs">
                {/* Left: Range input controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Select Range:
                    </span>
                    <select
                      value={dateRangeType}
                      onChange={(e) => setDateRangeType(e.target.value)}
                      className="py-0.5 px-2 text-[11px] font-bold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                      title="Select Range by Serial Number (#) or Class Roll Number"
                    >
                      <option value="sno">By # (Row 1–{dateTargetStudents.length})</option>
                      <option value="roll">By Roll No.</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700">
                    <span className="text-[11px] font-semibold text-slate-500">From</span>
                    <input
                      type="number"
                      value={dateRangeFrom}
                      onChange={(e) => setDateRangeFrom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSelectDateRange(dateRangeFrom, dateRangeTo, dateRangeType);
                      }}
                      placeholder="1"
                      className="w-14 py-0.5 px-1 text-center font-mono font-bold text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                    <span className="text-[11px] font-semibold text-slate-500">To</span>
                    <input
                      type="number"
                      value={dateRangeTo}
                      onChange={(e) => setDateRangeTo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSelectDateRange(dateRangeFrom, dateRangeTo, dateRangeType);
                      }}
                      placeholder={String(dateTargetStudents.length || '50')}
                      className="w-14 py-0.5 px-1 text-center font-mono font-bold text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectDateRange(dateRangeFrom, dateRangeTo, dateRangeType)}
                    className="py-1 px-2.5 rounded-md font-bold text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-all active:scale-95 cursor-pointer"
                  >
                    Select Range
                  </button>

                  <button
                    type="button"
                    onClick={handleNextDateRange}
                    className="py-1 px-2 rounded-md font-bold text-[11px] bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-all cursor-pointer shadow-2xs"
                    title="Advance to next batch of students of the same size"
                  >
                    Next Batch →
                  </button>
                </div>

                {/* Right: Quick Scope Pills & Selection Counter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Selected: <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{selectedDateIds.size}</span> / {dateTargetStudents.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateIds(new Set(dateTargetStudents.map(st => st.id)));
                      setDateRangeFrom('1');
                      setDateRangeTo(String(dateTargetStudents.length || ''));
                    }}
                    className="py-0.5 px-2 rounded font-bold text-[10.5px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer shadow-2xs"
                  >
                    All ({dateTargetStudents.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectDateRange(1, Math.min(50, dateTargetStudents.length), 'sno');
                      setDateRangeFrom('1');
                      setDateRangeTo(String(Math.min(50, dateTargetStudents.length)));
                    }}
                    className="py-0.5 px-2 rounded font-bold text-[10.5px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer shadow-2xs"
                  >
                    1–50
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectDateRange(51, Math.min(100, dateTargetStudents.length), 'sno');
                      setDateRangeFrom('51');
                      setDateRangeTo(String(Math.min(100, dateTargetStudents.length)));
                    }}
                    className="py-0.5 px-2 rounded font-bold text-[10.5px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer shadow-2xs"
                  >
                    51–100
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDateIds(new Set())}
                    className="py-0.5 px-2 rounded font-bold text-[10.5px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 cursor-pointer shadow-2xs"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Target Records Table Preview */}
              {dateTargetStudents.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-black text-slate-700 dark:text-slate-300 text-[11px] border-b border-slate-200 dark:border-slate-700 z-10 select-none">
                        <tr>
                          <th className="py-1 px-2 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={dateTargetStudents.length > 0 && selectedDateIds.size === dateTargetStudents.length}
                              ref={el => {
                                if (el) el.indeterminate = selectedDateIds.size > 0 && selectedDateIds.size < dateTargetStudents.length;
                              }}
                              onChange={handleToggleAllDates}
                              className="rounded text-indigo-600 cursor-pointer"
                              title="Select / Deselect All in View"
                            />
                          </th>
                          <th
                            className="py-1 px-2 w-10 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleDateSort('sno')}
                            title="Sort by Row Number (#)"
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              <span>#</span>
                              {dateSortField === 'sno' ? (
                                dateSortDirection === 'asc' ? <ChevronUp size={11} className="text-indigo-600 font-black" /> : <ChevronDown size={11} className="text-indigo-600 font-black" />
                              ) : null}
                            </div>
                          </th>
                          <th
                            className="py-1 px-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleDateSort('name')}
                            title="Sort alphabetically by Student Name"
                          >
                            <div className="flex items-center gap-1">
                              <span>Student Name</span>
                              {dateSortField === 'name' ? (
                                dateSortDirection === 'asc' ? <ChevronUp size={11} className="text-indigo-600 font-black" /> : <ChevronDown size={11} className="text-indigo-600 font-black" />
                              ) : <ArrowUpDown size={10} className="text-slate-400 opacity-60" />}
                            </div>
                          </th>
                          <th
                            className="py-1 px-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleDateSort('father')}
                            title="Sort by Father's Name"
                          >
                            <div className="flex items-center gap-1">
                              <span>Father's Name</span>
                              {dateSortField === 'father' ? (
                                dateSortDirection === 'asc' ? <ChevronUp size={11} className="text-indigo-600 font-black" /> : <ChevronDown size={11} className="text-indigo-600 font-black" />
                              ) : <ArrowUpDown size={10} className="text-slate-400 opacity-60" />}
                            </div>
                          </th>
                          <th
                            className="py-1 px-2 w-16 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleDateSort('class')}
                            title="Sort by Class"
                          >
                            <div className="flex items-center gap-1">
                              <span>Class</span>
                              {dateSortField === 'class' ? (
                                dateSortDirection === 'asc' ? <ChevronUp size={11} className="text-indigo-600 font-black" /> : <ChevronDown size={11} className="text-indigo-600 font-black" />
                              ) : <ArrowUpDown size={10} className="text-slate-400 opacity-60" />}
                            </div>
                          </th>
                          <th
                            className={`py-1 px-2 w-20 text-center cursor-pointer transition-colors ${
                              dateSortField === 'rollNo'
                                ? 'bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                                : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                            onClick={() => handleDateSort('rollNo')}
                            title="Sort numerically by Class Roll Number (Default)"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Roll No</span>
                              {dateSortField === 'rollNo' ? (
                                dateSortDirection === 'asc' ? <ChevronUp size={12} className="text-indigo-600 font-black" /> : <ChevronDown size={12} className="text-indigo-600 font-black" />
                              ) : <ArrowUpDown size={10} className="text-slate-400 opacity-60" />}
                            </div>
                          </th>
                          <th
                            className={`py-1 px-2 w-24 text-center cursor-pointer transition-colors ${
                              dateSortField === 'admNo'
                                ? 'bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                                : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                            onClick={() => handleDateSort('admNo')}
                            title="Sort by Admission Number"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Adm No</span>
                              {dateSortField === 'admNo' ? (
                                dateSortDirection === 'asc' ? <ChevronUp size={11} className="text-indigo-600 font-black" /> : <ChevronDown size={11} className="text-indigo-600 font-black" />
                              ) : <ArrowUpDown size={10} className="text-slate-400 opacity-60" />}
                            </div>
                          </th>
                          <th
                            className="py-1 px-2 w-28 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleDateSort('currentDate')}
                            title="Sort by Current Date"
                          >
                            <div className="flex items-center gap-1">
                              <span>Current Date</span>
                              {dateSortField === 'currentDate' ? (
                                dateSortDirection === 'asc' ? <ChevronUp size={11} className="text-indigo-600 font-black" /> : <ChevronDown size={11} className="text-indigo-600 font-black" />
                              ) : <ArrowUpDown size={10} className="text-slate-400 opacity-60" />}
                            </div>
                          </th>
                          <th className="py-1 px-2 text-right text-indigo-600 w-36">New Date to Apply</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                        {dateTargetStudents.map((st, idx) => {
                          const isSelected = selectedDateIds.has(st.id);
                          return (
                            <tr
                              key={`date_target_${st.id || idx}_${idx}`}
                              onClick={(e) => handleToggleStudent(st.id, idx, e)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/50'
                                  : 'opacity-65 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleToggleStudent(st.id, idx, e)}
                                  className="rounded text-indigo-600 cursor-pointer"
                                />
                              </td>
                              <td className="py-1 px-2 text-center font-bold text-slate-400 ledger-mono-font">{idx + 1}</td>
                              <td className="py-1 px-2 font-bold">{st.name}</td>
                              <td className="py-1 px-2 text-slate-500">{st.father}</td>
                              <td className="py-1 px-2 font-bold text-indigo-600">{st.class}</td>
                              <td className="py-1 px-2 text-center font-mono font-black ledger-mono-font text-indigo-700 dark:text-indigo-300">
                                {st.rollNo || '—'}
                              </td>
                              <td className="py-1 px-2 text-center font-mono ledger-mono-font text-slate-600 dark:text-slate-400">
                                {st.admNo || '—'}
                              </td>
                              <td className="py-1 px-2 font-mono text-slate-600 dark:text-slate-300 ledger-mono-font">
                                {assignDateField === 'admDate'
                                  ? (formatRegisterDate(st.admDate) || st.admDate || '—')
                                  : (formatRegisterDate(st.onlineStatus) || st.onlineStatus || '—')}
                              </td>
                              <td className="py-1 px-2 text-right font-mono font-bold ledger-mono-font">
                                {isSelected ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
                                    <span className="font-mono font-black">{formatRegisterDate(assignDateValue) || assignDateValue}</span>
                                    <span className="px-1 py-0.2 rounded text-[9.5px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                      Will Apply
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal italic">Excluded</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
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

export default React.memo(AdmissionRegisterSuite);
