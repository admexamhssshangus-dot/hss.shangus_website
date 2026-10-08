import { registerIssuedDocument } from '../../services/issuedDocumentService';
// =================================================================
// HSS SHANGUS — Student Bonafides & Official Certificates Studio
// Dynamic Student Auto-Complete, DOB-to-Words Engine, Template Builder & Multi-Format Exports
// =================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import {
  Award, FileSpreadsheet, FileText, Printer, Download, Save,
  Search, Check, Sparkles, UserCheck, Sliders, RefreshCw, X,
  Plus, PlusCircle, ChevronDown, Edit3, Trash2, BookmarkPlus, Eye, EyeOff, Image as ImageIcon,
  User, CheckCircle2, History, RotateCcw, AlertCircle, Info, AlertTriangle,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Table as TableIcon, Undo, Redo, RemoveFormatting, Palette, Minus,
  Bot, Key, Wand2, Shield, ExternalLink, Calendar, Scissors, Copy, Unlock,
  Pin, PinOff, Zap
} from 'lucide-react';
import {
  BUILTIN_CERTIFICATE_TEMPLATES,
  dobToWords,
  interpolateCertificateTemplate,
  retokenizeCertificateBody,
  sanitizeTemplateObject,
  resolveStudentLocality,
  printStudentCertificate,
  generateStudentCertificateDocx
} from '../../utils/certificateExportUtils';
import { buildCertificateVerificationUrl, createQrSvgDataUri } from '../../utils/qrSvgGenerator';
import { getStudentRollVal } from '../../utils/idCardRenderer';
import ConfirmModal from '../components/ConfirmModal';
import {
  fetchLastIssuedCertificateNumber,
  extractCertificateSerial,
  commitIssuedCertificateBatch,
  revokeCertificateNumberBatch,
  fetchLastGeneralCertificateRef,
  commitGeneralCertificateRef,
  parseGeneralRefNo,
  formatGeneralRefNo,
  DEFAULT_INITIAL_GENERAL_REF_SERIAL
} from '../../services/certificateRegistryService';
import {
  normalizeResultStatus,
  calculateDivision,
  extractStudentResultMarks,
  extractStudentAdmissionNumber,
  extractStudentAdmissionDate,
  extractStudentCertificateNumber,
  extractFullAddress
} from '../../utils/jkboseResultManager';
import {
  getCachedCollectionSync,
  getCachedCollection,
  getPhotoUrlFromCache,
  resolveStudentPhoto,
  fetchStudentPhotoOnDemand,
  fetchAllMatchingStudentPhotos,
  getAdmissionsBySession,
  getMasterRegistersScoped,
  getCurrentAcademicSession
} from '../../services/dbCache';
import { showToast } from '../../components/common/GlobalToast';
import {
  AVAILABLE_GEMINI_MODELS,
  getStoredGeminiKeys,
  saveGeminiKeys,
  fetchCloudGeminiKeys,
  saveCloudGeminiKeys,
  getPreferredGeminiModel,
  savePreferredGeminiModel,
  generateCertificateWithGemini
} from '../../services/geminiLetterService';
import DOMPurify from 'dompurify';
import { sanitizeRichHtml } from '../../utils/sanitizeRichHtml';
import { toLocalDateKey } from '../../utils/localDate';
import {
  normalizeRegistrationKey,
  areNamesCompatible,
  resolveCertificateStream,
  resolveScopedCertificateResult,
  isExactCertificateScope
} from '../../utils/certificateStudentResolution';
import {
  extractStudentName,
  extractFatherName,
  extractMotherName,
  extractClass,
  extractSession,
  extractDob,
  extractGender,
  extractBoardRegNo,
  getStudentRollNumber,
  extractAdmNo,
  extractFormNo,
  extractVillage,
  extractMobile,
  unpackMasterRegisterStudents,
  CANONICAL_ACADEMIC_SESSIONS,
  fetchHistoricalSessionData
} from './CustomRosterDocumentBuilderView';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import {
  fetchCloudDocTemplates,
  saveCloudDocTemplate,
  setCloudDefaultTemplate,
  deleteCloudDocTemplate
} from '../../services/docTemplateService';
import { saveGeneratedDocToHistory } from '../../services/docHistoryService';
import { recordApplicationPrint } from '../../services/printTrackerService';
import { logAdminActivity } from '../../services/adminActivityLogger';
import TabLoadingOverlay from '../../components/TabLoadingOverlay';
import ModuleErrorBoundary from '../../components/ModuleErrorBoundary';
import { lazyWithChunkRecovery } from '../../utils/lazyWithChunkRecovery';
import { scheduleIdleWork } from '../../utils/scheduleIdleWork';

const StudentResultEditorModal = lazyWithChunkRecovery(() => import('./StudentResultEditorModal'), 'student-result-editor');
const ResultIngestionModal = lazyWithChunkRecovery(() => import('./BulkFieldOverwriteModal'), 'result-ingestion-modal');
const BulkCertificateGeneratorModal = lazyWithChunkRecovery(() => import('./BulkCertificateGeneratorModal'), 'bulk-certificate-gen');
const DocumentHistoryModal = lazyWithChunkRecovery(() => import('./DocumentHistoryModal'), 'document-history');

const StudioModalFallback = ({ text = 'Loading module...' }) => (
  <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
      <RefreshCw size={18} className="animate-spin text-indigo-600 dark:text-indigo-400" />
      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{text}</span>
    </div>
  </div>
);

export const sanitizeCertificateHtml = (rawHtml) => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
      'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tfoot',
      'tr', 'th', 'td', 'span', 'div', 'hr', 'sub', 'sup',
      'font', 'center'
    ],
    ALLOWED_ATTR: [
      'class', 'style', 'colspan', 'rowspan', 'scope', 'align',
      'valign', 'border', 'cellpadding', 'cellspacing', 'width',
      'height', 'color', 'face', 'size'
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math', 'link', 'meta', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'formaction', 'src', 'href', 'data'],
    ALLOW_DATA_ATTR: false,
  });
};

const cleanStudentIdentity = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

const getCertificateStudentKey = (student) => {
  if (!student) return '';
  return [
    student.id,
    student.regNo,
    student.rollNo,
    student.formNo,
    student.session,
    student.cls,
    student.sourceType,
    student.name,
    student.father
  ].map(cleanStudentIdentity).join('|');
};

const getCertificateStudentNameKey = (student) => cleanStudentIdentity(
  student?.name || student?.studentName || student?.raw?.["Student's Name"]
);

const getStudentIdentityValues = (student) => {
  const raw = student?.raw || student || {};
  return [
    student?.id,
    student?.formNo,
    student?.regNo,
    student?.examRollNo,
    raw.id,
    raw.formNo,
    raw['Form No.'],
    raw['Form Number'],
    raw.regNo,
    raw.boardRegNo,
    raw['Board Reg. No.'],
    raw['Board Registration Number'],
    raw['Board Registration No. (Class 9th)'],
    raw['DIET Registration No.'],
    raw['DIET/Board Reg. No.'],
    raw['DIET Reg. No.'],
    raw.currExamRoll,
    raw['Exam R.No. (Current)']
  ].map(cleanStudentIdentity).filter(Boolean);
};

const ingestionRowMatchesStudent = (row, student) => {
  if (!row || !student) return false;
  const studentIds = new Set(getStudentIdentityValues(student));
  const rowIds = getStudentIdentityValues({
    ...row,
    id: row.formNo || row.id,
    formNo: row.formNo,
    regNo: row.regNo,
    examRollNo: row.examRollNo,
    raw: row.matchedStudent || row
  });
  if (rowIds.some(value => studentIds.has(value))) return true;

  const studentNameValue = cleanStudentIdentity(student.name || student.studentName || student.raw?.["Student's Name"]);
  const rowNameValue = cleanStudentIdentity(row.studentName);
  const studentFatherValue = cleanStudentIdentity(student.father || student.fatherName || student.raw?.["Father's Name"]);
  const rowFatherValue = cleanStudentIdentity(row.fatherName);
  return Boolean(studentNameValue && studentNameValue === rowNameValue &&
    (!studentFatherValue || !rowFatherValue || studentFatherValue === rowFatherValue));
};

const mergeIngestedResultIntoStudent = (student, row, overwriteExamRoll = false) => {
  if (!student || !row) return student;
  const raw = student.raw || student;
  const existingResult = extractStudentResultMarks(raw);
  const patch = {
    'Result (Current)': row.resultStatus || 'Awaiting Result',
    'Marks/Reapp (Current)': row.marksReapp || '',
    'Div/Distinc (Current)': row.divDistinc || '',
    currResult: row.resultStatus || 'Awaiting Result',
    currMarksReapp: row.marksReapp || '',
    currDiv: row.divDistinc || ''
  };

  if (row.examMode) {
    patch['Exam Mode (Current)'] = row.examMode;
    patch.currExamMode = row.examMode;
  }

  if (row.examRollNo && (overwriteExamRoll || !existingResult.examRoll)) {
    patch['Exam R.No. (Current)'] = row.examRollNo;
    patch.currExamRoll = row.examRollNo;
    patch.examRollNo = row.examRollNo;
  }
  if (row.subs) {
    patch.Subjects = row.subs;
    patch.subs = row.subs;
  }
  if (row.withdrawalDate) {
    patch['Date of withdrawl'] = row.withdrawalDate;
    patch.withdrawalDate = row.withdrawalDate;
  }

  return { ...student, ...patch, raw: { ...raw, ...patch } };
};

const certificateIdentityRichness = (record) => [
  extractStudentAdmissionNumber(record),
  extractStudentAdmissionDate(record),
  extractDob(record) !== '—' ? extractDob(record) : '',
  extractGender(record) !== '—' ? extractGender(record) : '',
  extractStudentCertificateNumber(record)
].filter(Boolean).length;

const enrichCertificateIdentityFields = (primaryRaw, linkedRecords = []) => {
  const candidates = (Array.isArray(linkedRecords) ? linkedRecords : [linkedRecords])
    .filter(Boolean)
    .sort((a, b) => certificateIdentityRichness(b) - certificateIdentityRichness(a));
  if (candidates.length === 0) return primaryRaw;
  const enriched = { ...(primaryRaw || {}) };

  const firstLinked = (extractor, empty = '') => {
    for (const record of candidates) {
      const value = extractor(record);
      if (value && value !== '—') return value;
    }
    return empty;
  };
  const admissionNo = extractStudentAdmissionNumber(enriched) || firstLinked(extractStudentAdmissionNumber);
  const admissionDate = extractStudentAdmissionDate(enriched) || firstLinked(extractStudentAdmissionDate);
  const dob = extractDob(enriched) !== '—' ? extractDob(enriched) : firstLinked(extractDob);
  // A result-only row can carry a stale/default gender. Prefer the richer
  // admission/master identity row when one is available for the same reg no.
  const authoritativeIdentity = candidates.find(record =>
    extractStudentAdmissionNumber(record) || extractStudentAdmissionDate(record) || extractDob(record) !== '—'
  );
  const linkedGender = authoritativeIdentity ? extractGender(authoritativeIdentity) : firstLinked(extractGender);
  const genderValue = linkedGender && linkedGender !== '—' ? linkedGender : extractGender(enriched);
  const certificateNo = extractStudentCertificateNumber(enriched);

  if (admissionNo && !extractStudentAdmissionNumber(enriched)) {
    enriched['Admission Number'] = admissionNo;
    enriched.admissionNo = admissionNo;
  }
  if (admissionDate && !extractStudentAdmissionDate(enriched)) {
    enriched['Date of Admission'] = admissionDate;
    enriched.admissionDate = admissionDate;
  }
  if (dob && dob !== '—' && extractDob(enriched) === '—') {
    enriched['Date of Birth'] = dob;
    enriched.dob = dob;
  }
  if (genderValue && genderValue !== '—') {
    enriched.Gender = genderValue;
    enriched.gender = genderValue;
  }

  // Enrich Village / Town and Address from authoritative linked records
  const extractVillageFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const keys = ['Village/Town', 'Name of your village', 'Village', 'village', 'town', 'Permanent Address', 'address', 'residence', 'Residence (Village, District)'];
    for (const k of keys) {
      const val = raw[k] ?? rec?.[k];
      if (val && String(val).trim() && !/^(—|-|n\/?a|null|undefined)$/i.test(String(val).trim())) {
        return String(val).trim();
      }
    }
    return '';
  };
  const currentVillage = extractVillageFromRecord(enriched);
  const linkedVillage = firstLinked(extractVillageFromRecord);
  if (linkedVillage && !currentVillage) {
    enriched['Village/Town'] = linkedVillage;
    enriched.village = linkedVillage;
  }

  const extractTehsilFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const t = raw.Tehsil || raw.tehsil || rec?.Tehsil || rec?.tehsil || '';
    return (t && !/^(—|-|n\/?a|null|undefined)$/i.test(String(t).trim())) ? String(t).trim() : '';
  };
  const linkedTehsil = firstLinked(extractTehsilFromRecord);
  if (linkedTehsil && !extractTehsilFromRecord(enriched)) {
    enriched.Tehsil = linkedTehsil;
    enriched.tehsil = linkedTehsil;
  }

  const extractDistrictFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const d = raw.District || raw.district || rec?.District || rec?.district || '';
    return (d && !/^(—|-|n\/?a|null|undefined)$/i.test(String(d).trim())) ? String(d).trim() : '';
  };
  const linkedDistrict = firstLinked(extractDistrictFromRecord);
  if (linkedDistrict && !extractDistrictFromRecord(enriched)) {
    enriched.District = linkedDistrict;
    enriched.district = linkedDistrict;
  }

  // Enrich Pincode
  const extractPincodeFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const p = raw.pincode || raw.pinCode || raw.pin || raw.Pin || rec?.pincode || rec?.pinCode || '';
    return (p && !/^(—|-|n\/?a|null|undefined)$/i.test(String(p).trim())) ? String(p).trim() : '';
  };
  const linkedPincode = firstLinked(extractPincodeFromRecord);
  if (linkedPincode && !extractPincodeFromRecord(enriched)) {
    enriched.pincode = linkedPincode;
    enriched.pinCode = linkedPincode;
  }

  // Enrich Demographics (Aadhaar, Category, Mobile, Parent Mobile, Blood Group, PEN, Prev School)
  const extractAadhaarFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const a = raw.aadhar || raw.aadhaar || raw.aadhaar_no || raw.adhaar || rec?.aadhar || rec?.aadhaar || '';
    return (a && !/^(—|-|n\/?a|null|undefined)$/i.test(String(a).trim())) ? String(a).trim() : '';
  };
  const linkedAadhaar = firstLinked(extractAadhaarFromRecord);
  if (linkedAadhaar && !extractAadhaarFromRecord(enriched)) {
    enriched.aadhar = linkedAadhaar;
    enriched.aadhaar = linkedAadhaar;
  }

  const extractCategoryFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const c = raw.category || raw.social_category || raw.Category || rec?.category || '';
    return (c && !/^(—|-|n\/?a|null|undefined)$/i.test(String(c).trim())) ? String(c).trim() : '';
  };
  const linkedCategory = firstLinked(extractCategoryFromRecord);
  if (linkedCategory && !extractCategoryFromRecord(enriched)) {
    enriched.category = linkedCategory;
  }

  const extractMobileFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const m = raw.mobile || raw.mobile_no || raw.Phone || raw.phone || rec?.mobile || '';
    return (m && !/^(—|-|n\/?a|null|undefined)$/i.test(String(m).trim())) ? String(m).trim() : '';
  };
  const linkedMobile = firstLinked(extractMobileFromRecord);
  if (linkedMobile && !extractMobileFromRecord(enriched)) {
    enriched.mobile = linkedMobile;
  }

  const extractParentMobileFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const pm = raw.parent_mobile || raw.guardian_mobile || raw.father_mobile || rec?.parent_mobile || '';
    return (pm && !/^(—|-|n\/?a|null|undefined)$/i.test(String(pm).trim())) ? String(pm).trim() : '';
  };
  const linkedParentMobile = firstLinked(extractParentMobileFromRecord);
  if (linkedParentMobile && !extractParentMobileFromRecord(enriched)) {
    enriched.parent_mobile = linkedParentMobile;
  }

  const extractBloodGroupFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const bg = raw.blood_group || raw.bloodGroup || raw.BloodGroup || rec?.blood_group || '';
    return (bg && !/^(—|-|n\/?a|null|undefined)$/i.test(String(bg).trim())) ? String(bg).trim() : '';
  };
  const linkedBloodGroup = firstLinked(extractBloodGroupFromRecord);
  if (linkedBloodGroup && !extractBloodGroupFromRecord(enriched)) {
    enriched.blood_group = linkedBloodGroup;
    enriched.bloodGroup = linkedBloodGroup;
  }

  const extractPenFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const pen = raw.pen || raw.pen_no || raw.PEN || rec?.pen || '';
    return (pen && !/^(—|-|n\/?a|null|undefined)$/i.test(String(pen).trim())) ? String(pen).trim() : '';
  };
  const linkedPen = firstLinked(extractPenFromRecord);
  if (linkedPen && !extractPenFromRecord(enriched)) {
    enriched.pen = linkedPen;
    enriched.pen_no = linkedPen;
  }

  const extractPrevSchoolFromRecord = rec => {
    const raw = rec?.raw || rec || {};
    const ps = raw.prev_school || raw.previous_school || raw['Previous School'] || rec?.prev_school || '';
    return (ps && !/^(—|-|n\/?a|null|undefined)$/i.test(String(ps).trim())) ? String(ps).trim() : '';
  };
  const linkedPrevSchool = firstLinked(extractPrevSchoolFromRecord);
  if (linkedPrevSchool && !extractPrevSchoolFromRecord(enriched)) {
    enriched.prev_school = linkedPrevSchool;
    enriched.previous_school = linkedPrevSchool;
  }

  return enriched;
};

/**
 * On-demand single-student admission fetch (1 read target instead of 800+ full collection reads).
 * Checks memory cache first (0 reads), then direct document lookup (1 read), then registration query (1 read).
 */
async function fetchStudentAdmissionRecordOnDemand(st, targetReg, normStudentName, normFatherName) {
  // 1. In-memory check (0 reads)
  const cachedAdmissions = getCachedCollectionSync('admissions');
  if (Array.isArray(cachedAdmissions) && cachedAdmissions.length > 0) {
    const admMatches = cachedAdmissions.filter(record =>
      (targetReg && normalizeRegistrationKey(extractBoardRegNo(record)) === targetReg && areNamesCompatible(extractStudentName(record), normStudentName)) ||
      (normStudentName && areNamesCompatible(extractStudentName(record), normStudentName) && (!normFatherName || areNamesCompatible(extractFatherName(record), normFatherName)))
    );
    if (admMatches.length > 0) return admMatches;
  }

  // 2. Direct document ID lookup if this record originated from admissions (1 read)
  const directDocId = st?.docId || st?.raw?.id || st?.id;
  if (directDocId && typeof directDocId === 'string' && !directDocId.startsWith('mr_') && !directDocId.startsWith('chunk_') && !directDocId.includes('_')) {
    try {
      const snap = await getDoc(doc(db, 'admissions', directDocId));
      if (snap.exists()) {
        return [{ id: snap.id, ...snap.data() }];
      }
    } catch (_) {}
  }

  // 3. Query admissions by registrationNo or boardRegNo (1 read)
  if (targetReg) {
    try {
      const q = query(collection(db, 'admissions'), where('registrationNo', '==', targetReg), limit(2));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (_) {}
    try {
      const q = query(collection(db, 'admissions'), where('boardRegNo', '==', targetReg), limit(2));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (_) {}
  }

  // 4. Targeted query by student name (1-3 reads)
  const rawName = extractStudentName(st?.raw || st);
  if (rawName && rawName.length >= 3) {
    try {
      const q = query(collection(db, 'admissions'), where('studentName', '==', rawName), limit(3));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const matched = docs.filter(record =>
          areNamesCompatible(extractStudentName(record), normStudentName) &&
          (!normFatherName || areNamesCompatible(extractFatherName(record), normFatherName))
        );
        if (matched.length > 0) return matched;
      }
    } catch (_) {}
  }

  return [];
}

// ─── Compact Checkbox-Style Multi-Select Dropdown for Class & Session Filters ───
function StudioMultiSelectDropdown({
  label,
  options = [],
  selected = [],
  onChange,
  align = 'left'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isAll = selected.length === 0;
  const isNone = selected.includes('__NONE__');

  const toggleOption = (val) => {
    let next;
    if (isNone) {
      next = [val];
    } else if (isAll) {
      next = [val];
    } else if (selected.includes(val)) {
      next = selected.filter(v => v !== val);
    } else {
      next = [...selected, val];
    }

    if (next.length === 0) {
      next = ['__NONE__'];
    } else if (next.length === options.length) {
      next = [];
    }
    onChange(next);
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const handleDeselectAll = () => {
    onChange(['__NONE__']);
  };

  const visibleOptions = searchFilter
    ? options.filter(o => o.label.toLowerCase().includes(searchFilter.toLowerCase()) || o.value.toLowerCase().includes(searchFilter.toLowerCase()))
    : options;

  const displayText = isAll
    ? `All ${label}`
    : isNone
      ? `No ${label}`
      : selected.length === 1
        ? (options.find(o => o.value === selected[0])?.label || selected[0])
        : `${label} (${selected.length})`;

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`compact-btn w-full px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between gap-1 transition-all cursor-pointer shadow-2xs !min-h-0 ${
          !isAll
            ? 'bg-teal-700 text-white border border-teal-800'
            : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-teal-500'
        }`}
        style={{ minHeight: 'unset', height: '28px' }}
      >
        <span className="truncate flex-1 min-w-0 text-left">{displayText}</span>
        <ChevronDown size={11} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 w-56 max-w-[calc(100vw-32px)] rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xl z-[100000] p-2 space-y-1.5 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100`}
        >
          <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black gap-1">
            <span className="text-[9px] text-teal-700 dark:text-teal-400 uppercase tracking-wider font-extrabold truncate flex-1 min-w-0">
              {label} ({options.length})
            </span>
            <div className="flex items-center gap-1.5 shrink-0 text-[9px]">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-teal-600 dark:text-teal-400 hover:underline font-bold cursor-pointer"
              >
                All
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-rose-600 hover:underline font-bold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {options.length > 5 && (
            <div className="px-0.5">
              <input
                type="text"
                placeholder={`Search ${label}...`}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[9.5px] font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
            {visibleOptions.map((opt) => {
              const checked = isAll || selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-[10px] font-semibold transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(opt.value)}
                      className="w-3.5 h-3.5 rounded text-teal-600 accent-teal-600 cursor-pointer shrink-0"
                    />
                    <span className="truncate text-slate-800 dark:text-slate-200">{opt.label}</span>
                  </div>
                  {opt.isLoading ? (
                    <span className="flex items-center gap-1 text-[8px] font-bold text-teal-600 dark:text-teal-400 shrink-0 ml-1">
                      <RefreshCw size={8} className="animate-spin shrink-0" />
                      <span>Loading...</span>
                    </span>
                  ) : opt.count !== undefined ? (
                    <span className="text-[8.5px] font-mono font-bold text-slate-400 shrink-0 ml-1">
                      {opt.count}
                    </span>
                  ) : (
                    <span className="text-[7.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-tight shrink-0 ml-1">
                      Load
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentCertificateStudioView({
  allStudents = [],
  identityStudents = [],
  onClose,
  activeSubTab = 'certStudio',
  onSwitchSubTab,
  onSwitchToRoster,
  onSwitchToLetter,
  showSettingsDrawerProp,
  onToggleSettingsDrawer
}) {
  const [isReady] = useState(true);

  // ─── Data Sources: Fed Directly & Instantaneously from Parent Global Session + Firestore Hydration ───
  const [masterRegistersList, setMasterRegistersList] = useState(() => {
    const cached = getCachedCollectionSync('masterRegisters');
    return Array.isArray(cached) && cached.length > 0 ? unpackMasterRegisterStudents(cached) : [];
  });

  // On-demand historical session records loaded dynamically when requested by admin
  const [extraSessionStudents, setExtraSessionStudents] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(() => new Set());
  const [customDbSessions, setCustomDbSessions] = useState([]);
  const loadedSessionsRef = useRef(new Set());
  const inFlightSessionsRef = useRef(new Set());
  const isLoadingStudents = loadingSessions.size > 0;

  // Real-time discovery of custom sessions defined in Firestore academicSessions
  useEffect(() => {
    let active = true;
    getDocs(collection(db, 'academicSessions'))
      .then(snap => {
        if (!active) return;
        const custom = [];
        snap.docs.forEach(d => {
          const name = d.data()?.name || d.data()?.session || d.id;
          if (name && typeof name === 'string' && name.trim()) custom.push(name.trim());
        });
        if (custom.length > 0) setCustomDbSessions(custom);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Eager whole-collection download removed to prevent quota exhaustion.
  // Master register records are resolved from synchronous memory cache or on-demand by student identifier.

  const combinedStudentPool = useMemo(() => {
    const primary = Array.isArray(allStudents) && allStudents.length > 0 ? allStudents : (Array.isArray(identityStudents) ? identityStudents : []);
    const list = [...primary].filter(s => s && !Array.isArray(s.items) && !Array.isArray(s.students) && !Array.isArray(s.records));
    if (Array.isArray(masterRegistersList) && masterRegistersList.length > 0) {
      const seenIds = new Set(list.map(s => {
        const sess = extractSession(s);
        const cls = extractClass(s);
        const k = String(s.formNo || s['Form Number'] || s['Form No.'] || s.boardRegNo || s.id || '').trim();
        return `${sess}_${cls}_${k}`;
      }).filter(Boolean));
      masterRegistersList.forEach(m => {
        const sess = extractSession(m);
        const cls = extractClass(m);
        const k = String(m.formNo || m['Form Number'] || m['Form No.'] || m.boardRegNo || m.id || '').trim();
        const key = `${sess}_${cls}_${k}`;
        if (!key || !seenIds.has(key)) {
          list.push(m);
          if (key) seenIds.add(key);
        }
      });
    }
    if (Array.isArray(extraSessionStudents) && extraSessionStudents.length > 0) {
      const seenIds = new Set(list.map(s => {
        const sess = extractSession(s);
        const cls = extractClass(s);
        const k = String(s.formNo || s['Form Number'] || s['Form No.'] || s.boardRegNo || s.id || '').trim();
        return `${sess}_${cls}_${k}`;
      }).filter(Boolean));
      extraSessionStudents.forEach(m => {
        const sess = extractSession(m);
        const cls = extractClass(m);
        const k = String(m.formNo || m['Form Number'] || m['Form No.'] || m.boardRegNo || m.id || '').trim();
        const key = `${sess}_${cls}_${k}`;
        if (!key || !seenIds.has(key)) {
          list.push(m);
          if (key) seenIds.add(key);
        }
      });
    }
    return list;
  }, [allStudents, identityStudents, masterRegistersList, extraSessionStudents]);

  const defaultActiveSession = useMemo(() => {
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
  }, [allStudents]);

  const [selectedClasses, setSelectedClasses] = useState([]); // [] means ALL classes
  const [selectedSessions, setSelectedSessions] = useState(() => (defaultActiveSession && defaultActiveSession !== 'ALL' ? [defaultActiveSession] : []));
  const [recentIngestedResults, setRecentIngestedResults] = useState([]);

  // Synchronize initial session filter once students are loaded if nothing selected yet
  useEffect(() => {
    if (defaultActiveSession && defaultActiveSession !== 'ALL') {
      setSelectedSessions(prev => {
        if (!prev || prev.length === 0 || (prev.length === 1 && prev[0] === '2025-26' && defaultActiveSession !== '2025-26')) {
          return [defaultActiveSession];
        }
        return prev;
      });
      setSession(prev => {
        if (!prev || prev === '2025-26') return defaultActiveSession;
        return prev;
      });
    }
  }, [defaultActiveSession]);

  const registrationHistoryByReg = useMemo(() => {
    const map = new Map();
    (combinedStudentPool || []).forEach(record => {
      const key = normalizeRegistrationKey(extractBoardRegNo(record));
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(record);
    });
    return map;
  }, [combinedStudentPool]);

  const recentResultByIdentity = useMemo(() => {
    const byIdentity = new Map();
    const byName = new Map();
    (recentIngestedResults || []).forEach(row => {
      getStudentIdentityValues({
        ...row,
        id: row.formNo || row.id,
        raw: row.matchedStudent || row
      }).forEach(identity => byIdentity.set(identity, row));
      const nameKey = getCertificateStudentNameKey(row);
      if (nameKey) {
        if (!byName.has(nameKey)) byName.set(nameKey, []);
        byName.get(nameKey).push(row);
      }
    });
    return { byIdentity, byName };
  }, [recentIngestedResults]);

  // Combined searchable student directory with fast canonical single-pass mapping
  const unifiedStudentDirectory = useMemo(() => {
    if (!isReady) return [];
    const list = [];
    const seenKeys = new Set();

    (combinedStudentPool || []).forEach(st => {
      if (!st) return;
      const latestResult = getStudentIdentityValues(st)
        .map(identity => recentResultByIdentity.byIdentity.get(identity))
        .find(Boolean) || (recentResultByIdentity.byName.get(getCertificateStudentNameKey(st)) || [])
          .find(row => ingestionRowMatchesStudent(row, st));
      const effectiveStudent = latestResult
        ? mergeIngestedResultIntoStudent(st, latestResult, latestResult.overwriteExamRoll)
        : st;
      const name = extractStudentName(effectiveStudent);
      if (!name || name === '—' || /^(null|undefined|—)$/i.test(name)) return;

      const father = extractFatherName(effectiveStudent);
      const mother = extractMotherName(effectiveStudent);
      const cls = extractClass(effectiveStudent) || '11th';
      const regNo = extractBoardRegNo(effectiveStudent) || '';
      const regKey = normalizeRegistrationKey(regNo);
      const registrationHistory = regKey ? (registrationHistoryByReg.get(regKey) || []) : [];
      const stream = resolveCertificateStream(effectiveStudent, registrationHistory, cls);
      const rollNo = getStudentRollNumber(effectiveStudent) || extractAdmNo(effectiveStudent) || '';
      const formNo = extractFormNo(effectiveStudent) || effectiveStudent.id || '';
      const session = extractSession(effectiveStudent) || '2025-26';
      const dob = extractDob(effectiveStudent) || '';
      const rawGender = extractGender(effectiveStudent);
      const gender = String(rawGender || '').toUpperCase().startsWith('F')
        ? 'F'
        : (String(rawGender || '').toUpperCase().startsWith('M') ? 'M' : '');
      const rawVillage = extractVillage(effectiveStudent);
      const hasVillage = rawVillage && rawVillage !== '—' && rawVillage !== '-' && !/^(null|undefined|n\/a)$/i.test(rawVillage);
      const rawAddress = effectiveStudent.address || effectiveStudent.residence || effectiveStudent['Permanent Address'] || '';
      const hasAddress = rawAddress && rawAddress !== '—' && rawAddress !== '-' && !/^(null|undefined|n\/a)$/i.test(rawAddress);
      let address = '';
      if (hasAddress) {
        address = rawAddress;
      } else if (hasVillage) {
        address = /shangus/i.test(rawVillage) ? `${rawVillage}, Anantnag (J&K)` : `${rawVillage}, Shangus, Anantnag (J&K)`;
      } else if (registrationHistory.length > 0) {
        for (const rh of registrationHistory) {
          const rhV = extractVillage(rh);
          if (rhV && rhV !== '—' && rhV !== '-' && !/^(null|undefined|n\/a)$/i.test(rhV)) {
            address = /shangus/i.test(rhV) ? `${rhV}, Anantnag (J&K)` : `${rhV}, Shangus, Anantnag (J&K)`;
            break;
          }
          const rhAddr = rh.address || rh.residence || rh['Permanent Address'] || rh['Residence (Village, District)'] || '';
          if (rhAddr && rhAddr !== '—' && rhAddr !== '-' && !/^(null|undefined|n\/a)$/i.test(rhAddr)) {
            address = rhAddr;
            break;
          }
        }
      }
      const mobile = extractMobile(effectiveStudent);
      const directPhoto = effectiveStudent.photo_id || effectiveStudent.photoId || effectiveStudent.photoUrl || effectiveStudent.photo || effectiveStudent['passport_photo'] || effectiveStudent['Student Photo'] || effectiveStudent['Photo'] || null;

      const sessionLower = (session || '').toLowerCase();
      const isPast = effectiveStudent._srcCollection === 'masterRegisters' ||
        sessionLower.includes('legacy') ||
        sessionLower.includes('arch') ||
        sessionLower.includes('2024') ||
        sessionLower.includes('2023') ||
        sessionLower.includes('2022') ||
        sessionLower.includes('2021') ||
        sessionLower.includes('2020') ||
        sessionLower.includes('2019') ||
        sessionLower.includes('2018') ||
        sessionLower.includes('ex-') ||
        sessionLower.includes('past');

      const dedupeKey = `${(regNo && regNo !== '—' ? regNo : '')}_${(rollNo && rollNo !== '—' ? rollNo : '')}_${(formNo && formNo !== '—' ? formNo : '')}_${session}_${cls}_${name.toLowerCase()}`;
      
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        const searchToken = `${name} ${father} ${mother} ${rollNo} ${regNo} ${formNo} ${mobile} ${cls} ${stream} ${address} ${session}`.toLowerCase();
        list.push({
          sourceType: isPast ? 'past' : 'present',
          sourceBadge: isPast ? 'Master Register' : 'Present Student',
          id: formNo || dedupeKey,
          name,
          father: father !== '—' ? father : '',
          mother: mother !== '—' ? mother : '',
          cls,
          stream,
          rollNo: rollNo !== '—' ? rollNo : '',
          regNo: regNo !== '—' ? regNo : '',
          formNo: formNo !== '—' ? formNo : '',
          session,
          dob: dob !== '—' ? dob : '',
          gender,
          address,
          mobile: mobile !== '—' ? mobile : '',
          photo: directPhoto,
          raw: effectiveStudent.raw || effectiveStudent,
          searchToken
        });
      }
    });

    return list;
  }, [combinedStudentPool, recentResultByIdentity, isReady, registrationHistoryByReg]);

  // ─── Dynamic Sessions Derived from Indexed Directory (Reverse Chronological Order) ───
  const dynamicSessions = useMemo(() => {
    const counts = {};
    unifiedStudentDirectory.forEach(st => {
      const sess = st.session;
      if (sess && sess !== '—') {
        counts[sess] = (counts[sess] || 0) + 1;
      }
    });

    const sessionSet = new Set(CANONICAL_ACADEMIC_SESSIONS);
    Object.keys(counts).forEach(s => sessionSet.add(s));
    if (customDbSessions.length > 0) {
      customDbSessions.forEach(s => sessionSet.add(s));
    }

    const sorted = Array.from(sessionSet).sort((a, b) => {
      const numA = parseInt(String(a).match(/\d{4}/)?.[0] || '0', 10);
      const numB = parseInt(String(b).match(/\d{4}/)?.[0] || '0', 10);
      if (numA !== numB) return numB - numA;
      if (/oct|nov/i.test(a) && /mar|apr/i.test(b)) return -1;
      if (/mar|apr/i.test(a) && /oct|nov/i.test(b)) return 1;
      return b.localeCompare(a, undefined, { numeric: true });
    });

    return sorted.map(k => {
      const count = counts[k];
      const isLoaded = count !== undefined;
      const isLoading = loadingSessions.has(k);
      return {
        value: k,
        label: `Session ${k}`,
        count: isLoaded ? count : null,
        isLoaded,
        isLoading
      };
    });
  }, [unifiedStudentDirectory, customDbSessions, loadingSessions]);

  const cohortCounts = useMemo(() => {
    const counts = { all: unifiedStudentDirectory.length, '12th': 0, '11th': 0, '10th': 0, '9th': 0, past: 0 };
    unifiedStudentDirectory.forEach(student => {
      const className = String(student.cls || '');
      if (className.includes('12')) counts['12th'] += 1;
      else if (className.includes('11')) counts['11th'] += 1;
      else if (className.includes('10')) counts['10th'] += 1;
      else if (className.includes('9')) counts['9th'] += 1;
      if (student.sourceType === 'past') counts.past += 1;
    });
    return counts;
  }, [unifiedStudentDirectory]);

  const classOptions = useMemo(() => [
    { value: '12th', label: 'Class 12th', count: cohortCounts['12th'] },
    { value: '11th', label: 'Class 11th', count: cohortCounts['11th'] },
    { value: '10th', label: 'Class 10th', count: cohortCounts['10th'] },
    { value: '9th', label: 'Class 9th', count: cohortCounts['9th'] },
    { value: 'past', label: 'Historical (Past)', count: cohortCounts.past }
  ], [cohortCounts]);

  const sessionOptions = useMemo(() => {
    return dynamicSessions.map(s => ({
      value: s.value,
      label: s.label,
      count: s.isLoaded ? s.count : undefined,
      isLoaded: s.isLoaded,
      isLoading: s.isLoading
    }));
  }, [dynamicSessions]);

  // Gracefully auto-adjust if the selected session does not exist in any catalog
  useEffect(() => {
    if (dynamicSessions.length > 0 && selectedSessions.length === 1) {
      const activeSess = (selectedSessions[0] || '').toLowerCase().trim();
      const match = dynamicSessions.find(d => (d.value || '').toLowerCase().trim() === activeSess);
      if (!match) {
        setSelectedSessions([dynamicSessions[0].value]);
        setSession(dynamicSessions[0].value);
      }
    }
  }, [dynamicSessions, selectedSessions]);

  // On-demand loader: fetches historical session records from Firestore whenever an unhydrated session is selected
  useEffect(() => {
    if (!selectedSessions || selectedSessions.length === 0) return;

    const pendingSessions = selectedSessions.filter(sess => {
      if (!sess || sess === '__NONE__' || sess === 'ALL') return false;
      const clean = sess.trim().toLowerCase();
      const isAlreadyInDir = unifiedStudentDirectory.some(st => {
        const s = (st.session || '').trim().toLowerCase();
        return s === clean || s.includes(clean) || clean.includes(s);
      });
      return !isAlreadyInDir && !loadedSessionsRef.current.has(clean) && !inFlightSessionsRef.current.has(clean);
    });

    if (pendingSessions.length === 0) return;

    let isCancelled = false;

    pendingSessions.forEach(async (targetSession) => {
      const clean = targetSession.trim().toLowerCase();
      inFlightSessionsRef.current.add(clean);
      setLoadingSessions(prev => new Set([...prev, targetSession]));

      try {
        const { admissions, masterRegisters: rawMaster } = await fetchHistoricalSessionData(targetSession);
        if (isCancelled) return;

        loadedSessionsRef.current.add(clean);
        const unpacked = unpackMasterRegisterStudents(rawMaster);
        const combined = [...admissions, ...unpacked];

        if (combined.length > 0) {
          setExtraSessionStudents(prev => {
            const existingIds = new Set(prev.map(p => String(p.id || p._docId || '')));
            const newItems = combined.filter(c => {
              const id = String(c.id || c._docId || '');
              return id && !existingIds.has(id);
            });
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
          showToast(`Loaded ${combined.length} records for Session ${targetSession}`, 'success');
        } else {
          showToast(`No student records found in database for Session ${targetSession}`, 'info');
        }
      } catch (err) {
        console.warn(`[StudentCertStudio] Error loading session ${targetSession}:`, err);
        showToast(`Failed to load records for Session ${targetSession}`, 'error');
      } finally {
        inFlightSessionsRef.current.delete(clean);
        if (!isCancelled) {
          setLoadingSessions(prev => {
            const next = new Set(prev);
            next.delete(targetSession);
            return next;
          });
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedSessions, unifiedStudentDirectory]);

  // ─── Student Search & Selection State ───
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [debouncedStudentQuery, setDebouncedStudentQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isLivePreviewEnabled, setIsLivePreviewEnabled] = useState(true);
  const [isDropdownPinned, setIsDropdownPinned] = useState(false);
  const [previewedStudentId, setPreviewedStudentId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showMobileOptionsModal, setShowMobileOptionsModal] = useState(false);
  const [showMobileFormatToolbar, setShowMobileFormatToolbar] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(null);
  const [showRefDateModal, setShowRefDateModal] = useState(false);
  const listContainerRef = useRef(null);
  const livePreviewTimeoutRef = useRef(null);
  const scrollPreviewTimeoutRef = useRef(null);
  const selectionRequestRef = useRef(0);
  const handleSelectStudentRef = useRef(null);
  const lastIssuedCertificateRef = useRef(null);
  const photoLookupAttemptsRef = useRef(new Set());

  useEffect(() => () => {
    selectionRequestRef.current += 1;
    if (livePreviewTimeoutRef.current) clearTimeout(livePreviewTimeoutRef.current);
    if (scrollPreviewTimeoutRef.current) clearTimeout(scrollPreviewTimeoutRef.current);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStudentQuery(studentSearchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [studentSearchQuery]);

  const deferredStudentQuery = useDeferredValue(debouncedStudentQuery);

  // Filtered search list strictly scoped to selected classes and sessions (Ultra-fast, zero lag)
  const filteredStudents = useMemo(() => {
    let pool = unifiedStudentDirectory;

    // Apply Active Cohort / Class Multi-Select Filters
    if (selectedClasses.length > 0 && !selectedClasses.includes('__NONE__')) {
      const classSet = new Set(selectedClasses);
      pool = pool.filter(st => {
        const cls = (st.cls || '').toLowerCase();
        if (classSet.has('12th') && cls.includes('12')) return true;
        if (classSet.has('11th') && cls.includes('11')) return true;
        if (classSet.has('10th') && cls.includes('10')) return true;
        if (classSet.has('9th') && cls.includes('9')) return true;
        if (classSet.has('past') && st.sourceType === 'past') return true;
        return false;
      });
    } else if (selectedClasses.includes('__NONE__')) {
      return [];
    }

    // Apply Active Session Multi-Select Filters
    if (selectedSessions.length > 0 && !selectedSessions.includes('__NONE__')) {
      const sessionList = selectedSessions.map(s => s.toLowerCase().trim());
      pool = pool.filter(st => {
        const sess = (st.session || '').toLowerCase().trim();
        for (const s of sessionList) {
          if (sess === s || sess.includes(s) || s.includes(sess)) return true;
        }
        return false;
      });
    } else if (selectedSessions.includes('__NONE__')) {
      return [];
    }

    const q = deferredStudentQuery.trim().toLowerCase();
    const hasFilter = selectedClasses.length > 0 || selectedSessions.length > 0;
    const limit = hasFilter ? 160 : 80;
    if (!q) return pool.slice(0, limit);

    return pool.filter(st => (st.searchToken || '').includes(q)).slice(0, limit);
  }, [unifiedStudentDirectory, deferredStudentQuery, selectedClasses, selectedSessions]);

  // ─── Active Certificate Form State (Auto-filled + Manual Overrides) ───
  const [studentName, setStudentName] = useState('MOHAMMAD TAHIR WANI');
  const [fatherName, setFatherName] = useState('GHULAM NABI WANI');
  const [motherName, setMotherName] = useState('FAHMEEDA AKHTER');
  const [className, setClassName] = useState('11th');
  const [stream, setStream] = useState('Medical');
  const [rollNo, setRollNo] = useState('1101');
  const [regNo, setRegNo] = useState('24SHG1101');
  const [dobRaw, setDobRaw] = useState('2007-08-15');
  const [session, setSession] = useState(() => (defaultActiveSession && defaultActiveSession !== 'ALL' ? defaultActiveSession : '2025-26'));
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('M');
  const [withdrawalDate, setWithdrawalDate] = useState(() => toLocalDateKey());
  const [studentPhotoUrl, setStudentPhotoUrl] = useState(null);
  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);

  // ─── TC / DC Result & Marks Override States ───
  const [tcMarksObtained, setTcMarksObtained] = useState('');
  const [tcMaxMarks, setTcMaxMarks] = useState('500');
  const [tcDivision, setTcDivision] = useState('Distinction');
  const [tcExamRoll, setTcExamRoll] = useState('');
  const [tcExamMode, setTcExamMode] = useState('Annual Regular 2025 (Oct.-Nov.)');
  const [tcResultStatus, setTcResultStatus] = useState('Passed');
  const [tcReappSubjects, setTcReappSubjects] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [admissionDate, setAdmissionDate] = useState('');

  // ─── Custom Dynamic Fields (Add/Remove/Edit values on the fly) ───
  const [customFields, setCustomFields] = useState([]);
  const [showFieldManagerModal, setShowFieldManagerModal] = useState(false);
  const [newCustomFieldName, setNewCustomFieldName] = useState('');
  const [newCustomFieldValue, setNewCustomFieldValue] = useState('');

  // Derived DOB in figures & words
  const parsedDob = useMemo(() => {
    try {
      if (typeof dobToWords === 'function') {
        const res = dobToWords(dobRaw);
        if (res) return { ...res, formatted: res.figures, inWords: res.words };
      }
    } catch (e) {
      console.warn('dobToWords execution error:', e);
    }
    return { figures: dobRaw || '—', words: '—', standard: dobRaw || '—', formatted: dobRaw || '—', inWords: '—' };
  }, [dobRaw]);

  // Certificate Header & Options State
  const [officeTitle, setOfficeTitle] = useState('OFFICE OF THE PRINCIPAL');
  const [institutionName, setInstitutionName] = useState('GOVT. HIGHER SECONDARY SCHOOL SHANGUS');
  const [institutionAddress, setInstitutionAddress] = useState('District Anantnag, Kashmir — 192201 (J&K)');
  const [certificateTitle, setCertificateTitle] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_certificate_studio_title');
      return (saved && saved !== 'CERTIFICATE') ? saved : 'BONAFIDE CERTIFICATE';
    } catch {
      return 'BONAFIDE CERTIFICATE';
    }
  });
  const [isSavingCertTitle, setIsSavingCertTitle] = useState(false);
  const [certTitleSavedStatus, setCertTitleSavedStatus] = useState(false);
  const [refNo, setRefNo] = useState(() => `HSS/1454/${String(new Date().getFullYear()).slice(-2)}`);
  const [generalRefSerial, setGeneralRefSerial] = useState(DEFAULT_INITIAL_GENERAL_REF_SERIAL);
  const [generalRefPrefix, setGeneralRefPrefix] = useState('HSS');
  const [generalRefYear, setGeneralRefYear] = useState(() => String(new Date().getFullYear()).slice(-2));
  const [dateStr, setDateStr] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [showPhoto, setShowPhoto] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [includeSalutations, setIncludeSalutations] = useState(false); // Default: unchecked / without Mr./Mrs./Ms.
  const [showLeftSignatory, setShowLeftSignatory] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_certificate_show_left_signatory');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [signatoryLeft, setSignatoryLeft] = useState('Incharge Admissions & Exam');
  const [signatoryCenter, setSignatoryCenter] = useState('Checked By');
  const [signatoryRight, setSignatoryRight] = useState('Principal');
  const [signatorySubtext, setSignatorySubtext] = useState(() => {
    try {
      return localStorage.getItem('hss_certificate_signatory_subtext') || 'Govt. HSS Shangus';
    } catch {
      return 'Govt. HSS Shangus';
    }
  });
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // ─── Templates State (Built-in + Custom) ───
  const [defaultTemplateId, setDefaultTemplateId] = useState(() => {
    try {
      return localStorage.getItem('hss_default_cert_template_id') || 'bonafide_dob';
    } catch {
      return 'bonafide_dob';
    }
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    try {
      return localStorage.getItem('hss_default_cert_template_id') || 'bonafide_dob';
    } catch {
      return 'bonafide_dob';
    }
  });
  const [templateBody, setTemplateBody] = useState(() => {
    try {
      const defId = localStorage.getItem('hss_default_cert_template_id') || 'bonafide_dob';
      const found = BUILTIN_CERTIFICATE_TEMPLATES.find(t => t.id === defId);
      return retokenizeCertificateBody(found ? found.bodyHtml : BUILTIN_CERTIFICATE_TEMPLATES[0].bodyHtml);
    } catch {
      return retokenizeCertificateBody(BUILTIN_CERTIFICATE_TEMPLATES[0].bodyHtml);
    }
  });
  const [customCanvasHtml, setCustomCanvasHtml] = useState(null);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_custom_certificate_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map(sanitizeTemplateObject);
          try {
            localStorage.setItem('hss_custom_certificate_templates', JSON.stringify(sanitized));
          } catch (_) {}
          return sanitized;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [templateFilterTab, setTemplateFilterTab] = useState('all'); // 'all' | 'builtin' | 'custom'
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateSaveMode, setTemplateSaveMode] = useState('update'); // 'update' | 'new'
  const [makeTemplateDefault, setMakeTemplateDefault] = useState(true);
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] = useState('Bonafide & Age Certificates');

  // ─── JKBOSE Result Hub & TC/DC Dual Copy State ───
  const [showResultEditorModal, setShowResultEditorModal] = useState(false);
  const [showResultIngestionModal, setShowResultIngestionModal] = useState(false);
  const [showBulkGeneratorModal, setShowBulkGeneratorModal] = useState(false);
  const [isDualCopy, setIsDualCopy] = useState(true);
  const [pageMargin, setPageMargin] = useState(0.3);
  const [headerGap, setHeaderGap] = useState(0.50); // Default 0.5 inch vertical space between Section 1 & Section 2
  const [titleMetaGap, setTitleMetaGap] = useState(0); // Tightly coupled Title and Cert No.
  const [metaBodyGap, setMetaBodyGap] = useState(0.50); // Default 0.5 inch vertical space between Section 2 & Section 3
  const [paraSpacing, setParaSpacing] = useState(8);
  const [bodyLineHeight, setBodyLineHeight] = useState(1.85);
  const [bodyDateGap, setBodyDateGap] = useState(12);
  const [dateSigGap, setDateSigGap] = useState(1.0); // Fixed 1 inch vertical space between Section 3 (body/dates) & Section 4 (signatories)
  const [sigReceiptGap, setSigReceiptGap] = useState(12);
  const [baseFontSize, setBaseFontSize] = useState(() => {
    try {
      return localStorage.getItem('hss_cert_base_font_size') || '12.5px';
    } catch {
      return '12.5px';
    }
  });

  // Initialize general certificate reference sequence from Cloud/localStorage (1454 -> 1455 -> 1456...)
  useEffect(() => {
    let isMounted = true;
    const initGeneralRef = async () => {
      try {
        const genRef = await fetchLastGeneralCertificateRef();
        if (isMounted && genRef) {
          setGeneralRefSerial(genRef.serial);
          setGeneralRefPrefix(genRef.prefix);
          setGeneralRefYear(genRef.year);
          setRefNo(prev => {
            if (!prev || prev.includes('Bonafide/2026/01') || prev.includes('1454') || prev.includes('HSS/SHG')) {
              return genRef.fullRef || formatGeneralRefNo(genRef.prefix, genRef.serial, genRef.year);
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Could not initialize general certificate reference:', err);
      }
    };
    initGeneralRef();
    return () => { isMounted = false; };
  }, []);

  // Cloud Persistence for Certificate Title Banner on Firebase (guarded against generic 'CERTIFICATE')
  useEffect(() => {
    let isMounted = true;
    const loadCertificateBannerFromCloud = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'systemSettings', 'certificateRegistry'));
        if (docSnap.exists() && isMounted) {
          const data = docSnap.data();
          const cloudBanner = data.defaultCertificateTitle || data.certificateTitle;
          if (cloudBanner && typeof cloudBanner === 'string' && cloudBanner.trim() && cloudBanner.trim() !== 'CERTIFICATE') {
            setCertificateTitle(cloudBanner.trim());
            try { localStorage.setItem('hss_certificate_studio_title', cloudBanner.trim()); } catch {}
          }
        }
      } catch (err) {
        console.warn('Could not sync cloud certificate banner:', err);
      }
    };
    loadCertificateBannerFromCloud();
    return () => { isMounted = false; };
  }, []);

  const saveCertificateTitleToCloud = useCallback(async (newTitle) => {
    const clean = (newTitle || '').trim();
    if (!clean) return;
    setIsSavingCertTitle(true);
    try {
      try { localStorage.setItem('hss_certificate_studio_title', clean); } catch {}
      await setDoc(doc(db, 'systemSettings', 'certificateRegistry'), {
        defaultCertificateTitle: clean,
        certificateTitle: clean,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setCertTitleSavedStatus(true);
      setTimeout(() => setCertTitleSavedStatus(false), 2500);
    } catch (err) {
      console.warn('Failed to save certificate banner to cloud:', err);
    } finally {
      setIsSavingCertTitle(false);
    }
  }, []);

  // Debounced cloud sync when certificateTitle changes
  useEffect(() => {
    if (!certificateTitle || !certificateTitle.trim()) return;
    const timer = setTimeout(() => {
      saveCertificateTitleToCloud(certificateTitle);
    }, 1200);
    return () => clearTimeout(timer);
  }, [certificateTitle, saveCertificateTitleToCloud]);

  // Advance sequential reference number for general certificates (1454 -> 1455 -> ...)
  const advanceGeneralRefNumber = useCallback(async (currentRef = null) => {
    const targetRef = currentRef || refNo;
    const parsed = parseGeneralRefNo(targetRef);
    const nextSerial = (parsed.serial || generalRefSerial || DEFAULT_INITIAL_GENERAL_REF_SERIAL) + 1;
    const nextYear = String(parsed.year || generalRefYear || new Date().getFullYear()).slice(-2);
    const nextPrefix = (parsed.prefix || generalRefPrefix || 'HSS').replace(/^HSS\/SHG(\/|$)/i, 'HSS$1');
    const nextFormatted = formatGeneralRefNo(nextPrefix, nextSerial, nextYear);

    setGeneralRefSerial(nextSerial);
    setGeneralRefPrefix(nextPrefix);
    setGeneralRefYear(nextYear);
    setRefNo(nextFormatted);

    await commitGeneralCertificateRef({
      serial: nextSerial,
      prefix: nextPrefix,
      year: nextYear,
      fullRef: nextFormatted
    });

    return { nextSerial, nextFormatted };
  }, [refNo, generalRefSerial, generalRefPrefix, generalRefYear]);

  const handleIncrementGeneralRef = async () => {
    try {
      const { nextSerial, nextFormatted } = await advanceGeneralRefNumber();
      showToast(`Reference number advanced to #${nextSerial} (${nextFormatted})`, 'success');
    } catch (err) {
      showToast('Could not advance reference number: ' + err.message, 'error');
    }
  };

  const handleGeneralRefChange = (newVal) => {
    setRefNo(newVal);
    if (!selectedTemplateId?.startsWith('tc_dc')) {
      const parsed = parseGeneralRefNo(newVal);
      if (parsed.serial && parsed.serial > 0) {
        setGeneralRefSerial(parsed.serial);
        setGeneralRefPrefix(parsed.prefix);
        setGeneralRefYear(parsed.year);
      }
    }
  };

  const handleGeneralRefBlur = async () => {
    if (!refNo) return;
    const parsed = parseGeneralRefNo(refNo);
    if (parsed.serial && parsed.serial > 0) {
      setGeneralRefSerial(parsed.serial);
      setGeneralRefPrefix(parsed.prefix);
      setGeneralRefYear(parsed.year);
      await commitGeneralCertificateRef({
        serial: parsed.serial,
        prefix: parsed.prefix,
        year: parsed.year,
        fullRef: refNo
      }).catch(() => {});
    }
  };

  // Debounced auto-save manual general ref edits to Cloud & localStorage
  useEffect(() => {
    if (!refNo || selectedTemplateId?.startsWith('tc_dc')) return;
    const timer = setTimeout(() => {
      const parsed = parseGeneralRefNo(refNo);
      if (parsed.serial && parsed.serial > 0) {
        commitGeneralCertificateRef({
          serial: parsed.serial,
          prefix: parsed.prefix,
          year: parsed.year,
          fullRef: refNo
        }).catch(() => {});
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [refNo, selectedTemplateId]);

  // Sync external Setup toggle from Top Sub-Nav bar
  useEffect(() => {
    if (showSettingsDrawerProp !== undefined) {
      setShowSettingsDrawer(showSettingsDrawerProp);
    }
  }, [showSettingsDrawerProp]);

  useEffect(() => {
    const handleToggle = (e) => {
      if (e?.detail?.targetModule && e.detail.targetModule !== 'certStudio' && e.detail.targetModule !== 'certificate') {
        return;
      }
      if (typeof e?.detail?.open === 'boolean') {
        setShowSettingsDrawer(e.detail.open);
      } else {
        setShowSettingsDrawer(prev => !prev);
      }
    };
    window.addEventListener('hss-toggle-studio-setup', handleToggle);
    return () => window.removeEventListener('hss-toggle-studio-setup', handleToggle);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettingsDrawer(false);
    if (onToggleSettingsDrawer) onToggleSettingsDrawer(false);
  }, [onToggleSettingsDrawer]);

  // TC/DC Active check: Only show Result Hub and Bulk TC Generator when TC/DC is selected
  const isTcDcActive = useMemo(() => {
    if (selectedTemplateId?.startsWith('tc_dc')) return true;
    const currentTpl = [...customTemplates, ...BUILTIN_CERTIFICATE_TEMPLATES].find(t => t.id === selectedTemplateId);
    return Boolean(currentTpl?.isTcDc || currentTpl?.category === 'Transfer & Character Certificates (TC/DC)' || currentTpl?.category?.includes('TC/DC'));
  }, [selectedTemplateId, customTemplates]);

  const signatories = useMemo(() => {
    if (isTcDcActive) {
      if (!showLeftSignatory) {
        return [signatoryCenter || 'Checked By', signatoryRight || 'Principal'].filter(Boolean);
      }
      return [signatoryLeft || 'I/c Admissions', signatoryCenter || 'Checked By', signatoryRight || 'Principal'];
    }
    if (!showLeftSignatory) {
      return [signatoryRight || 'Principal'].filter(Boolean);
    }
    return [signatoryLeft || 'Incharge Admissions & Exam', signatoryRight || 'Principal'].filter(Boolean);
  }, [isTcDcActive, showLeftSignatory, signatoryLeft, signatoryCenter, signatoryRight]);

  const handleToggleLeftSignatory = (val) => {
    const next = typeof val === 'boolean' ? val : !showLeftSignatory;
    setShowLeftSignatory(next);
    try {
      localStorage.setItem('hss_certificate_show_left_signatory', String(next));
    } catch {}
  };

  const handleSignatorySubtextChange = (val) => {
    setSignatorySubtext(val);
    try {
      localStorage.setItem('hss_certificate_signatory_subtext', val);
    } catch {}
  };

  // Live Scannable Canvas QR Code URL & Data URI (Direct screen scan testable)
  const canvasVerifyUrl = useMemo(() => {
    return buildCertificateVerificationUrl({
      reg: regNo || '',
      roll: rollNo || '',
      fNo: selectedStudent ? extractFormNo(selectedStudent.raw || selectedStudent) : '',
      cert: refNo || '',
      doc: certificateTitle || '',
      name: studentName || '',
      father: fatherName || '',
      className: className || '',
      session: session || '',
      stream: stream || ''
    });
  }, [regNo, rollNo, selectedStudent, refNo, certificateTitle, studentName, fatherName, className, session, stream]);

  const canvasQrUri = useMemo(() => {
    return createQrSvgDataUri(canvasVerifyUrl, 140);
  }, [canvasVerifyUrl]);

  const [toast, setToast] = useState(null); // { message: string, type: 'success' | 'error' | 'info' | 'warning' }
  const toastTimeoutRef = useRef(null);
  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  }, []);

  // Current numeric figure (isolated from prefix and year)
  const currentFigure = useMemo(() => {
    if (isTcDcActive) {
      const parsed = parseInt(extractCertificateSerial(refNo) || refNo, 10);
      return !isNaN(parsed) && parsed > 0 ? parsed : (lastIssuedCertificateRef.current || 1368);
    }
    const parsed = parseGeneralRefNo(refNo);
    return parsed.serial || generalRefSerial || DEFAULT_INITIAL_GENERAL_REF_SERIAL;
  }, [isTcDcActive, refNo, generalRefSerial]);

  // Manually update the numeric figure (admin typing directly into figure box)
  const handleUpdateFigure = useCallback(async (newVal) => {
    const num = parseInt(newVal, 10);
    if (isNaN(num) || num <= 0) return;

    if (isTcDcActive) {
      setRefNo(String(num));
      lastIssuedCertificateRef.current = num;
      return;
    }

    const currentParsed = parseGeneralRefNo(refNo);
    const prefix = (currentParsed.prefix || generalRefPrefix || 'HSS').replace(/^HSS\/SHG(\/|$)/i, 'HSS$1');
    const year = String(currentParsed.year || generalRefYear || new Date().getFullYear()).slice(-2);
    const formatted = formatGeneralRefNo(prefix, num, year);

    setGeneralRefSerial(num);
    setGeneralRefPrefix(prefix);
    setGeneralRefYear(year);
    setRefNo(formatted);

    await commitGeneralCertificateRef({
      serial: num,
      prefix,
      year,
      fullRef: formatted
    }).catch(() => {});
  }, [isTcDcActive, refNo, generalRefPrefix, generalRefYear]);

  // Step numeric figure sequentially (+1 or -1)
  const handleStepFigure = useCallback(async (delta) => {
    const nextNum = Math.max(1, currentFigure + delta);
    if (isTcDcActive) {
      setRefNo(String(nextNum));
      lastIssuedCertificateRef.current = nextNum;
      showToast(`TC/DC certificate number set to #${nextNum}`, 'info');
      return;
    }

    const currentParsed = parseGeneralRefNo(refNo);
    const prefix = (currentParsed.prefix || generalRefPrefix || 'HSS').replace(/^HSS\/SHG(\/|$)/i, 'HSS$1');
    const year = String(currentParsed.year || generalRefYear || new Date().getFullYear()).slice(-2);
    const formatted = formatGeneralRefNo(prefix, nextNum, year);

    setGeneralRefSerial(nextNum);
    setGeneralRefPrefix(prefix);
    setGeneralRefYear(year);
    setRefNo(formatted);

    try {
      await commitGeneralCertificateRef({
        serial: nextNum,
        prefix,
        year,
        fullRef: formatted
      });
      showToast(`Figure set to #${nextNum} (${formatted})`, 'success');
    } catch (err) {
      showToast('Could not update figure: ' + err.message, 'error');
    }
  }, [isTcDcActive, currentFigure, refNo, generalRefPrefix, generalRefYear, showToast]);

  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isIssuingTcDc, setIsIssuingTcDc] = useState(false);
  const [dockSide, setDockSide] = useState(() => {
    try {
      return localStorage.getItem('hss_cert_dock_side') || 'right';
    } catch {
      return 'right';
    }
  });

  // ─── Gemini AI Assistant State ───
  const [activeRightTab, setActiveRightTab] = useState('templates'); // 'templates' | 'ai'
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAskGeminiMenu, setShowAskGeminiMenu] = useState(false);
  const [aiMode, setAiMode] = useState('draft'); // 'draft' | 'humanize' | 'formalize' | 'shorten'
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('Formal School');
  const [aiModel, setAiModel] = useState(() => getPreferredGeminiModel());
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedHtml, setAiGeneratedHtml] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiSuccessKeyIndex, setAiSuccessKeyIndex] = useState(null);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  const [showKeysConfig, setShowKeysConfig] = useState(false);
  const [keysInputText, setKeysInputText] = useState('');
  const [aiInsertedToast, setAiInsertedToast] = useState(false);
  const askGeminiMenuRef = useRef(null);

  // Sync Gemini keys from cloud database on startup
  useEffect(() => {
    fetchCloudGeminiKeys().then(keys => {
      if (Array.isArray(keys) && keys.length > 0) {
        setGeminiKeys(keys);
        setKeysInputText(keys.join('\n'));
      }
    });
  }, []);

  // Click outside to close Ask Gemini menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (askGeminiMenuRef.current && !askGeminiMenuRef.current.contains(e.target)) {
        setShowAskGeminiMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Combined and deduplicated templates list (Cloud custom overrides take priority over built-ins, with built-in templates canonical identity protected)
  const allTemplatesList = useMemo(() => {
    const map = new Map();
    BUILTIN_CERTIFICATE_TEMPLATES.forEach(t => map.set(t.id, t));
    customTemplates.forEach(t => {
      const sanitized = sanitizeTemplateObject(t);
      map.set(sanitized.id, sanitized);
    });
    return Array.from(map.values());
  }, [customTemplates]);

  const displayedTemplates = useMemo(() => {
    if (templateFilterTab === 'custom') return customTemplates;
    if (templateFilterTab === 'builtin') return BUILTIN_CERTIFICATE_TEMPLATES;
    return allTemplatesList;
  }, [templateFilterTab, customTemplates, allTemplatesList]);

  // Initialize Certificate Templates from Firebase Cloud
  useEffect(() => {
    let isMounted = true;
    const initCloudCertTemplates = async () => {
      try {
        const { templates, defaultTemplateId: cloudDefaultId } = await fetchCloudDocTemplates('certificate');
        if (!isMounted) return;

        if (templates && templates.length > 0) {
          const sanitized = templates.map(sanitizeTemplateObject);
          setCustomTemplates(sanitized);
        }

        const activeDefId = cloudDefaultId || defaultTemplateId || 'bonafide_dob';
        if (cloudDefaultId) setDefaultTemplateId(cloudDefaultId);

        const allTpls = [
          ...(templates || []).map(t => ({ ...t, bodyHtml: retokenizeCertificateBody(t.bodyHtml) })),
          ...BUILTIN_CERTIFICATE_TEMPLATES
        ];
        const found = allTpls.find(t => t.id === activeDefId) || BUILTIN_CERTIFICATE_TEMPLATES[0];
        if (found) {
          setSelectedTemplateId(found.id);
          setTemplateBody(retokenizeCertificateBody(found.bodyHtml));
          if (found.certificateTitle) setCertificateTitle(found.certificateTitle);
          if (found.officeTitle) setOfficeTitle(found.officeTitle);
          if (found.institutionName) setInstitutionName(found.institutionName);
          if (found.institutionAddress) setInstitutionAddress(found.institutionAddress);
          if (found.signatoryLeft !== undefined) setSignatoryLeft(found.signatoryLeft);
          if (found.signatoryRight !== undefined) setSignatoryRight(found.signatoryRight);
          if (found.showLeftSignatory !== undefined) setShowLeftSignatory(found.showLeftSignatory);
          if (found.signatorySubtext !== undefined) setSignatorySubtext(found.signatorySubtext);
          if (found.watermark !== undefined) setWatermark(found.watermark);
          if (found.isCustom && found.includeSalutations !== undefined) setIncludeSalutations(found.includeSalutations);
          if (found.showPhoto !== undefined) setShowPhoto(found.showPhoto);
          if (found.refPrefix) {
            setRefNo(`${found.refPrefix}/${rollNo || regNo || '01'}/${new Date().getFullYear()}`);
          } else if (found.refNo) {
            setRefNo(found.refNo);
          }
        }
      } catch (err) {
        console.warn('Note: Could not sync cloud certificate templates:', err);
      }
    };

    initCloudCertTemplates();
    return () => { isMounted = false; };
  }, []);

  // ─── Draggable Dual-Pane Splitter State ───
  const [leftSplitPct, setLeftSplitPct] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_cert_preview_split_pct');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 35 && val <= 80) return val;
      }
    } catch {}
    return 67;
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
    const container = e.currentTarget.closest('.cert-split-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvt) => {
      moveEvt.preventDefault();
      const mouseX = moveEvt.clientX - rect.left;
      const pct = Math.max(35, Math.min(80, (mouseX / rect.width) * 100));
      const rounded = Math.round(pct * 10) / 10;
      setLeftSplitPct(rounded);
      try {
        localStorage.setItem('hss_cert_preview_split_pct', String(rounded));
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

  // ─── Real-time Database Photo Resolution Engine ───
  const fetchAndResolveStudentPhoto = useCallback(async (
    targetStudent = null,
    { requestId = null, allowNetwork = true } = {}
  ) => {
    const st = targetStudent || selectedStudent || {
      name: studentName,
      father: fatherName,
      regNo,
      rollNo,
      cls: className,
      session,
      raw: selectedStudent?.raw || null
    };

    if (!st) return null;

    const isCurrentRequest = () => requestId === null || selectionRequestRef.current === requestId;
    const applyPhoto = (photo) => {
      if (isCurrentRequest()) setStudentPhotoUrl(photo);
      return photo;
    };

    if (isCurrentRequest()) setIsFetchingPhoto(allowNetwork);

    try {
      // 1. Instant check in memory / localStorage photo cache
      const fastPhoto = resolveStudentPhoto(st.raw || st) || getPhotoUrlFromCache(st.regNo || regNo || st.rollNo || rollNo) || st.photo;
      if (fastPhoto && typeof fastPhoto === 'string' && fastPhoto.length > 20 && fastPhoto !== '/logo.png') {
        if (isCurrentRequest()) setIsFetchingPhoto(false);
        return applyPhoto(fastPhoto);
      }

      // Hover and scroll previews must remain local-only. Network photo lookup
      // is reserved for an intentional click/keyboard selection.
      if (!allowNetwork) {
        if (isCurrentRequest()) {
          setStudentPhotoUrl(null);
          setIsFetchingPhoto(false);
        }
        return null;
      }

      // 2. Fetch on-demand from centralized Firestore studentPhotos cache
      const onDemandPhoto = await fetchStudentPhotoOnDemand(st.raw || st);
      if (onDemandPhoto && typeof onDemandPhoto === 'string' && onDemandPhoto.length > 20 && onDemandPhoto !== '/logo.png') {
        if (isCurrentRequest()) setIsFetchingPhoto(false);
        return applyPhoto(onDemandPhoto);
      }

      // 3. Fallback to comprehensive cross-session matching
      const allMatches = await fetchAllMatchingStudentPhotos(st.raw || st);
      if (allMatches && allMatches.length > 0 && allMatches[0].url) {
        if (isCurrentRequest()) setIsFetchingPhoto(false);
        return applyPhoto(allMatches[0].url);
      }

      // 4. Query Firestore studentPhotos directly for key permutations
      const rawReg = (st.regNo || regNo || '').replace(/[^a-zA-Z0-9]/g, '');
      const rawRoll = (st.rollNo || rollNo || '').replace(/[^a-zA-Z0-9]/g, '');
      const validReg = rawReg && rawReg.length >= 6 && !/^(0000|null|undefined)/i.test(rawReg) ? rawReg : '';
      const candidateKeys = [
        validReg ? `photo_${validReg}` : null,
        validReg || null
      ].filter(Boolean);

      for (const cKey of candidateKeys) {
        try {
          const snap = await getDoc(doc(db, 'studentPhotos', cKey));
          if (snap.exists()) {
            const data = snap.data();
            const p = (data.photo_id || data.photoData || data.photo || data.photoUrl || '').trim();
            if (p && p.length > 20 && p !== '/logo.png') {
              applyPhoto(p);
              if (typeof window !== 'undefined') {
                window._hss_central_photo_map = window._hss_central_photo_map || {};
                window._hss_central_photo_map[cKey] = p;
                if (validReg) window._hss_central_photo_map[validReg] = p;
              }
              if (isCurrentRequest()) setIsFetchingPhoto(false);
              return p;
            }
          }
        } catch (_) {}
      }

      // 5. Cross-reference student in memory unified directory for attached photo
      const cleanTargetName = String(st.name || studentName || '').trim().toLowerCase();
      const cleanTargetFather = String(st.father || fatherName || '').trim().toLowerCase();
      if (cleanTargetName && Array.isArray(unifiedStudentDirectory)) {
        const candidateInPool = unifiedStudentDirectory.find(s => {
          const nm = String(s.name || '').trim().toLowerCase();
          const fn = String(s.father || '').trim().toLowerCase();
          return (nm === cleanTargetName && (!cleanTargetFather || fn.includes(cleanTargetFather) || cleanTargetFather.includes(fn))) ||
            (rawReg && String(s.regNo || '').replace(/[^a-zA-Z0-9]/g, '') === rawReg) ||
            (rawRoll && String(s.rollNo || '').trim() === rawRoll);
        });

        if (candidateInPool) {
          const p = resolveStudentPhoto(candidateInPool.raw || candidateInPool) || candidateInPool.photo;
          if (p && p.length > 20 && p !== '/logo.png') {
            if (isCurrentRequest()) setIsFetchingPhoto(false);
            return applyPhoto(p);
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching student photo from database:', err);
    } finally {
      if (isCurrentRequest()) setIsFetchingPhoto(false);
    }
    return null;
  }, [selectedStudent, studentName, fatherName, regNo, rollNo, className, session, unifiedStudentDirectory]);

  // ─── Toggle Student Photo with Instant Database Fetch ───
  const handleTogglePhoto = async (forcedVal = null) => {
    const nextVal = forcedVal !== null ? forcedVal : !showPhoto;
    setShowPhoto(nextVal);
    if (nextVal) {
      // Immediately fetch this student's photo from database!
      const studentKey = getCertificateStudentKey(selectedStudent);
      if (studentKey) photoLookupAttemptsRef.current.add(studentKey);
      await fetchAndResolveStudentPhoto(selectedStudent, {
        requestId: selectionRequestRef.current,
        allowNetwork: true
      });
    }
  };

  // ─── Synchronize Active Session & Class Filters to Active Certificate State ───
  const handleSessionFilterChange = useCallback((newSessions) => {
    setSelectedSessions(newSessions);
    if (newSessions.length === 1 && newSessions[0] !== '__NONE__') {
      const targetSession = newSessions[0];
      setSession(targetSession);
      if (selectedStudent) {
        setCustomCanvasHtml(null);
      }
    }
  }, [selectedStudent]);

  const handleClassFilterChange = useCallback((newClasses) => {
    setSelectedClasses(newClasses);
    if (newClasses.length === 1 && newClasses[0] !== '__NONE__' && newClasses[0] !== 'past') {
      const targetClass = newClasses[0];
      setClassName(targetClass);
      if (selectedStudent) {
        setCustomCanvasHtml(null);
      }
    }
  }, [selectedStudent]);

  // ─── Select Student Handler (Auto-Fills Fields & Instantly Resolves DB Photo) ───
  const handleSelectStudent = async (st, { keepOpen = false, isPreviewOnly = false } = {}) => {
    if (!st) return;
    const requestId = ++selectionRequestRef.current;
    const studentKey = getCertificateStudentKey(st);
    setPreviewedStudentId(studentKey);
    setSelectedStudent(st);
    if (!keepOpen && !isDropdownPinned && !isPreviewOnly) {
      setIsSearchDropdownOpen(false);
      setStudentSearchQuery(`${st.name} (${st.rollNo || st.regNo || st.cls})`);
      if (!isDesktop) {
        setShowMobileOptionsModal(false);
      }
    }

    // Reset canvas override so the new student data is cleanly interpolated from template tokens
    setCustomCanvasHtml(null);

    // ─── 1. SYNCHRONOUS IMMEDIATE POPULATION OF STUDENT CORE IDENTITY ───
    const primaryRaw = st.raw || st;
    const activeSingleSession = (selectedSessions.length === 1 && selectedSessions[0] !== '__NONE__') ? selectedSessions[0] : null;
    const activeSingleClass = (selectedClasses.length === 1 && selectedClasses[0] !== '__NONE__' && selectedClasses[0] !== 'past') ? selectedClasses[0] : null;
    const effectiveSession = activeSingleSession || st.session || '2025-26';
    const effectiveClass = activeSingleClass || st.cls || '11th';

    setStudentName(st.name || '');
    setFatherName(st.father || '');
    setMotherName(st.mother || '');
    setClassName(effectiveClass);
    setStream(st.stream || resolveCertificateStream(st, [], effectiveClass || extractClass(st)));
    setRollNo(st.rollNo || '—');
    setRegNo(st.regNo || '—');
    const resolvedDob = extractDob(primaryRaw);
    const effDob = resolvedDob && resolvedDob !== '—' ? resolvedDob : (st.dob || '');
    setDobRaw(effDob);
    setSession(effectiveSession);
    let effectiveAddr = extractFullAddress(primaryRaw) || st.address || '';
    const targetRegInit = normalizeRegistrationKey(extractBoardRegNo(primaryRaw) || st.regNo);
    if (!effectiveAddr && targetRegInit) {
      const synRh = registrationHistoryByReg.get(targetRegInit) || [];
      for (const rh of synRh) {
        const fullRh = extractFullAddress(rh);
        if (fullRh) {
          effectiveAddr = fullRh;
          break;
        }
        const rhV = extractVillage(rh);
        if (rhV && rhV !== '—' && rhV !== '-' && !/^(null|undefined|n\/a)$/i.test(rhV)) {
          effectiveAddr = /shangus/i.test(rhV) ? `${rhV}, Anantnag (J&K)` : `${rhV}, Shangus, Anantnag (J&K)`;
          break;
        }
        const rhA = rh.address || rh.residence || rh['Permanent Address'] || '';
        if (rhA && rhA !== '—' && rhA !== '-' && !/^(null|undefined|n\/a)$/i.test(rhA)) {
          effectiveAddr = rhA;
          break;
        }
      }
    }
    setAddress(effectiveAddr);
    const rawGender = extractGender(primaryRaw);
    const effGender = String(rawGender || '').toUpperCase().startsWith('F')
      ? 'F'
      : (String(rawGender || '').toUpperCase().startsWith('M') ? 'M' : (st.gender || ''));
    setGender(effGender);
    
    const rawWd = primaryRaw['Date of withdrawl'] || primaryRaw.withdrawalDate || primaryRaw['Result Date'] || primaryRaw.resultDate || toLocalDateKey();
    setWithdrawalDate(rawWd);

    const admNoResolved = extractStudentAdmissionNumber(primaryRaw);
    const admDateResolved = extractStudentAdmissionDate(primaryRaw);
    setAdmissionNo(admNoResolved);
    setAdmissionDate(admDateResolved);

    // Synchronously resolve active template and sanitize its body tokens
    let activeTpl = sanitizeTemplateObject(allTemplatesList.find(t => t.id === selectedTemplateId) || BUILTIN_CERTIFICATE_TEMPLATES[0]);
    const cleanTplBody = retokenizeCertificateBody(activeTpl.bodyHtml);
    setTemplateBody(cleanTplBody);
    const isTcDcTemplate = Boolean(activeTpl.isTcDc || activeTpl.id?.startsWith('tc_dc_'));
    if (isTcDcTemplate) {
      setCertificateTitle('Discharge/Transfer cum Character Certificate');
    } else {
      const canonicalTplTitle = (activeTpl.certificateTitle && activeTpl.certificateTitle !== 'CERTIFICATE')
        ? activeTpl.certificateTitle
        : (activeTpl.name || 'BONAFIDE CERTIFICATE');
      setCertificateTitle(canonicalTplTitle);
    }

    // Auto-update Ref No immediately: TC/DC uses existing/next serial, general certs use sequential dispatch figure
    const existingCertNo = extractStudentCertificateNumber(primaryRaw);
    let immediateRef = '';
    if (isTcDcTemplate) {
      if (existingCertNo && !/^(—|-|n\/?a|null|undefined)$/i.test(String(existingCertNo).trim())) {
        immediateRef = extractCertificateSerial(existingCertNo) || String(existingCertNo).trim();
      }
    } else {
      const cleanPrefix = (activeTpl.refPrefix || generalRefPrefix || 'HSS').replace(/^HSS\/SHG(\/|$)/i, 'HSS$1');
      const figure = generalRefSerial || DEFAULT_INITIAL_GENERAL_REF_SERIAL;
      const year = String(generalRefYear || new Date().getFullYear()).slice(-2);
      immediateRef = formatGeneralRefNo(cleanPrefix, figure, year);
    }
    setRefNo(immediateRef);

    // Force-sync WYSIWYG editor DOM synchronously with interpolated preview for immediate zero-delay display
    const immediateLocality = resolveStudentLocality(st, primaryRaw, effectiveAddr);
    if (editorRef.current) {
      const immediateHtml = interpolateCertificateTemplate(cleanTplBody, {
        studentName: st.name || '',
        fatherName: st.father || '',
        motherName: st.mother || '',
        className: effectiveClass,
        stream: st.stream || resolveCertificateStream(st, [], effectiveClass || extractClass(st)),
        rollNo: st.rollNo || '—',
        regNo: st.regNo || '—',
        dobFigures: effDob,
        dobWords: (typeof dobToWords === 'function' ? dobToWords(effDob).words : '—'),
        session: effectiveSession,
        address: effectiveAddr,
        gender: effGender,
        refNo: immediateRef,
        date: dateStr,
        includeSalutations,
        customFields,
        // TC/DC tokens
        examName: `Class ${effectiveClass || '12th'} Examination`,
        examRollNo: primaryRaw['Exam Roll No'] || primaryRaw.examRoll || primaryRaw.currExamRoll || st.rollNo || '',
        examSession: primaryRaw['Exam Session'] || primaryRaw.examSession || primaryRaw.currExamMode || effectiveSession || '',
        resultStatus: primaryRaw['Result Status'] || primaryRaw.resultStatus || 'Awaiting Result',
        divisionDistinction: primaryRaw['Division'] || primaryRaw.division || '—',
        marksObtained: primaryRaw['Marks Obtained'] || primaryRaw.marksObtained || '',
        maxMarks: primaryRaw['Max Marks'] || primaryRaw.maxMarks || '500',
        reappSubjects: primaryRaw['Reappear Subjects'] || primaryRaw.reappSubjects || '—',
        admissionDate: admDateResolved || '',
        admissionNo: admNoResolved || '',
        withdrawalDate: rawWd || '',
        conductStatus: 'Satisfactory',
        village: immediateLocality.village,
        tehsil: immediateLocality.tehsil,
        district: immediateLocality.district,
        certificateNo: immediateRef,
        raw: primaryRaw
      });
      editorRef.current.innerHTML = sanitizeCertificateHtml(immediateHtml);
      pushSnapshot();
    }

    // ─── 2. ASYNCHRONOUS BACKGROUND ENRICHMENT (REGISTRATION / ADMISSIONS / TC-DC / PHOTO) ───
    const targetReg = normalizeRegistrationKey(extractBoardRegNo(primaryRaw) || st.regNo);
    let registrationMatches = targetReg ? [...(registrationHistoryByReg.get(targetReg) || [])] : [];
    const normStudentName = extractStudentName(st);
    const normFatherName = extractFatherName(st);

    try {
      if (targetReg) {
        const identityMatches = (identityStudents || []).filter(record =>
          normalizeRegistrationKey(extractBoardRegNo(record)) === targetReg &&
          areNamesCompatible(extractStudentName(record), normStudentName)
        );
        registrationMatches = [...registrationMatches, ...identityMatches];
      }
      if (registrationMatches.length === 0 && normStudentName) {
        const nameMatches = (identityStudents || []).filter(record =>
          areNamesCompatible(extractStudentName(record), normStudentName) &&
          (!normFatherName || areNamesCompatible(extractFatherName(record), normFatherName))
        );
        registrationMatches = [...registrationMatches, ...nameMatches];
      }

      const hasAuthoritativeIdentity = registrationMatches.some(record =>
        extractStudentAdmissionNumber(record) || extractStudentAdmissionDate(record) || extractDob(record) !== '—'
      );
      if (!hasAuthoritativeIdentity && !isPreviewOnly) {
        const admMatches = await fetchStudentAdmissionRecordOnDemand(st, targetReg, normStudentName, normFatherName);
        if (selectionRequestRef.current !== requestId) return;
        registrationMatches = [...registrationMatches, ...admMatches];
      }

      if (registrationMatches.length > 0) {
        let enrichedRaw = enrichCertificateIdentityFields(primaryRaw, registrationMatches);
        const priorCertificateRecord = registrationMatches.find(record =>
          isExactCertificateScope(record, effectiveSession, effectiveClass) &&
          areNamesCompatible(extractStudentName(record), normStudentName) &&
          Boolean(extractStudentCertificateNumber(record))
        );
        const priorCertificate = extractStudentCertificateNumber(priorCertificateRecord);
        if (priorCertificate && !extractStudentCertificateNumber(enrichedRaw)) {
          enrichedRaw = {
            ...enrichedRaw,
            ccDcNo: priorCertificate,
            certificateNo: priorCertificate,
            _certificateSourceRecord: priorCertificateRecord?.raw || priorCertificateRecord
          };
        }
        st = { ...st, raw: enrichedRaw };
        if (selectionRequestRef.current !== requestId) return;
        setSelectedStudent(st);
        setStream(resolveCertificateStream(st, registrationMatches, effectiveClass || extractClass(st)));
        const enrichedAdmNo = extractStudentAdmissionNumber(enrichedRaw);
        const enrichedAdmDate = extractStudentAdmissionDate(enrichedRaw);
        if (enrichedAdmNo) setAdmissionNo(enrichedAdmNo);
        if (enrichedAdmDate) setAdmissionDate(enrichedAdmDate);
        const enrichedAddr = extractFullAddress(enrichedRaw) || effectiveAddr;
        if (enrichedAddr) {
          setAddress(enrichedAddr);
          st.address = enrichedAddr;
        }

        // Immediately update editor DOM with enriched student details so admission no, date, and address are filled
        if (editorRef.current && (enrichedAdmNo || enrichedAdmDate || enrichedAddr)) {
          const enrichedLocality = resolveStudentLocality(st, enrichedRaw, enrichedAddr);
          const reinterpolatedHtml = interpolateCertificateTemplate(cleanTplBody, {
            studentName: st.name || '',
            fatherName: st.father || '',
            motherName: st.mother || '',
            className: effectiveClass,
            stream: st.stream || resolveCertificateStream(st, registrationMatches, effectiveClass || extractClass(st)),
            rollNo: st.rollNo || '—',
            regNo: st.regNo || '—',
            dobFigures: effDob,
            dobWords: (typeof dobToWords === 'function' ? dobToWords(effDob).words : '—'),
            session: effectiveSession,
            address: enrichedAddr,
            gender: effGender,
            refNo: immediateRef,
            date: dateStr,
            includeSalutations,
            customFields,
            admissionDate: enrichedAdmDate || admDateResolved || '',
            admissionNo: enrichedAdmNo || admNoResolved || '',
            withdrawalDate: rawWd || '',
            conductStatus: 'Satisfactory',
            village: enrichedLocality.village,
            tehsil: enrichedLocality.tehsil,
            district: enrichedLocality.district,
            certificateNo: immediateRef,
            raw: enrichedRaw
          });
          editorRef.current.innerHTML = sanitizeCertificateHtml(reinterpolatedHtml);
        }
      }
    } catch (error) {
      console.warn('Certificate registration enrichment note:', error);
    }

    if (selectionRequestRef.current !== requestId) return;

    const raw = st.raw || st;
    const scopedResult = resolveScopedCertificateResult(
      [st, ...registrationMatches],
      effectiveSession,
      effectiveClass
    );
    const resInfo = scopedResult.resultInfo;
    const isPassed = resInfo.isPassed;

    setTcMarksObtained(resInfo.marksObtained);
    setTcMaxMarks(resInfo.maxMarks);
    setTcDivision(resInfo.division);
    setTcExamRoll(resInfo.examRoll || '');
    setTcExamMode(resInfo.examMode);
    setTcResultStatus(resInfo.resultStatus);
    setTcReappSubjects(resInfo.reappSubjects);

    // If a TC/DC template is active, automatically select the Qualified or Re-appear template variant
    if (activeTpl.isTcDc || selectedTemplateId.startsWith('tc_dc_')) {
      const targetId = isPassed ? 'tc_dc_qualified' : ((resInfo.isReap || resInfo.isFailed) ? 'tc_dc_reappear' : 'tc_dc_awaiting');
      const foundTarget = BUILTIN_CERTIFICATE_TEMPLATES.find(t => t.id === targetId) || activeTpl;
      setSelectedTemplateId(foundTarget.id);
      activeTpl = foundTarget;
      setTemplateBody(retokenizeCertificateBody(foundTarget.bodyHtml));
      if (foundTarget.certificateTitle) setCertificateTitle(foundTarget.certificateTitle);
    }

    // Resolve student photo from database (non-blocking for smooth live preview)
    if (isPreviewOnly || !showPhoto) {
      fetchAndResolveStudentPhoto(st, { requestId, allowNetwork: false }).catch(() => {});
    } else {
      photoLookupAttemptsRef.current.add(getCertificateStudentKey(st));
      await fetchAndResolveStudentPhoto(st, { requestId, allowNetwork: true });
      if (selectionRequestRef.current !== requestId) return;
    }

    // Auto-update Ref No / Certificate No cleanly without 16-digit Reg No or Form No
    const finalExistingCertNo = extractStudentCertificateNumber(raw);
    const finalIsTcDc = Boolean(activeTpl.isTcDc || activeTpl.id?.startsWith('tc_dc_'));
    let finalAssignedRef = immediateRef;
    
    if (finalIsTcDc) {
      if (finalExistingCertNo && !/^(—|-|n\/?a|null|undefined)$/i.test(String(finalExistingCertNo).trim())) {
        finalAssignedRef = extractCertificateSerial(finalExistingCertNo) || String(finalExistingCertNo).trim();
        setRefNo(finalAssignedRef);
      } else if (!isPreviewOnly) {
        let lastNo = 1367;
        try {
          lastNo = await fetchLastIssuedCertificateNumber();
        } catch (_) {}
        if (selectionRequestRef.current !== requestId) return;
        lastIssuedCertificateRef.current = lastNo;
        const nextNo = lastNo + 1;
        finalAssignedRef = String(nextNo);
        setRefNo(finalAssignedRef);
      }
    } else {
      // General certificates (Character, Bonafide, NOC, etc.) use the active sequential general dispatch figure
      const rawPrefix = activeTpl.refPrefix || generalRefPrefix || 'HSS';
      const cleanPrefix = rawPrefix.replace(/^HSS\/SHG(\/|$)/i, 'HSS$1');
      const curFigure = generalRefSerial || DEFAULT_INITIAL_GENERAL_REF_SERIAL;
      const curYear = String(generalRefYear || new Date().getFullYear()).slice(-2);
      finalAssignedRef = formatGeneralRefNo(cleanPrefix, curFigure, curYear);
      setRefNo(finalAssignedRef);
    }

    // Retokenize active template body and update editor DOM with resolved scoped results and locality
    const resolvedLocality = resolveStudentLocality(st, raw, st.address || effectiveAddr);
    const resolvedExamRoll = resInfo.examRoll || raw['Exam Roll No'] || raw.examRoll || raw.currExamRoll || raw.examRollNo || st.rollNo || '';
    const resolvedExamSession = resInfo.examMode || raw['Exam Session'] || raw.examSession || raw.currExamMode || effectiveSession || session || '';
    const resolvedResultStatus = resInfo.resultStatus || (isPassed ? 'Qualified' : (resInfo.isReap ? 'Re-appear' : (resInfo.hasResult ? 'Did Not Qualify' : 'Awaiting Result')));
    const resolvedDiv = resInfo.division || (resInfo.marksObtained ? calculateDivision(resInfo.marksObtained, resInfo.maxMarks || 500).division : '—');
    const resolvedMarksObt = resInfo.marksObtained || '';
    const resolvedMaxMarks = resInfo.maxMarks || '500';
    const resolvedReappSubs = resInfo.reappSubjects || '—';

    if (editorRef.current) {
      const finalResolvedHtml = interpolateCertificateTemplate(activeTpl.bodyHtml, {
        studentName: st.name || '',
        fatherName: st.father || '',
        motherName: st.mother || '',
        className: effectiveClass,
        stream: st.stream || resolveCertificateStream(st, registrationMatches, effectiveClass || extractClass(st)),
        rollNo: st.rollNo || '—',
        regNo: st.regNo || '—',
        dobFigures: effDob,
        dobWords: (typeof dobToWords === 'function' ? dobToWords(effDob).words : '—'),
        session: effectiveSession,
        address: st.address || effectiveAddr,
        gender: effGender,
        refNo: finalAssignedRef,
        date: dateStr,
        includeSalutations,
        customFields,
        // TC/DC & Database tokens
        examName: `Class ${effectiveClass || '12th'} Examination`,
        examRollNo: resolvedExamRoll,
        examSession: resolvedExamSession,
        resultStatus: resolvedResultStatus,
        divisionDistinction: resolvedDiv,
        marksObtained: resolvedMarksObt,
        maxMarks: resolvedMaxMarks,
        reappSubjects: resolvedReappSubs,
        admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '',
        admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '',
        withdrawalDate: rawWd || '',
        conductStatus: 'Satisfactory',
        village: resolvedLocality.village,
        tehsil: resolvedLocality.tehsil,
        district: resolvedLocality.district,
        certificateNo: finalAssignedRef,
        raw
      });
      editorRef.current.innerHTML = sanitizeCertificateHtml(finalResolvedHtml);
      pushSnapshot();
    }
  };

  // Keep debounced preview callbacks connected to the latest render state.
  handleSelectStudentRef.current = handleSelectStudent;

  // Ultra-fast debounced realtime hover / scroll preview
  const handleLivePreview = useCallback((st) => {
    if (!st || !isLivePreviewEnabled) return;
    setPreviewedStudentId(getCertificateStudentKey(st));
    if (livePreviewTimeoutRef.current) clearTimeout(livePreviewTimeoutRef.current);
    livePreviewTimeoutRef.current = setTimeout(() => {
      handleSelectStudentRef.current?.(st, { keepOpen: true, isPreviewOnly: true });
    }, 120);
  }, [isLivePreviewEnabled]);

  // Realtime scroll detector: as user scrolls list, auto-previews student in view
  const handleListScroll = useCallback(() => {
    if (!isLivePreviewEnabled || !listContainerRef.current || !filteredStudents.length) return;
    if (scrollPreviewTimeoutRef.current) clearTimeout(scrollPreviewTimeoutRef.current);
    scrollPreviewTimeoutRef.current = setTimeout(() => {
      const container = listContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const targetY = rect.top + Math.min(60, rect.height / 3);
      const elements = container.querySelectorAll('[data-student-index]');
      for (const el of elements) {
        const elRect = el.getBoundingClientRect();
        if (elRect.top <= targetY && elRect.bottom >= targetY) {
          const index = parseInt(el.getAttribute('data-student-index'), 10);
          if (!isNaN(index) && filteredStudents[index]) {
            handleLivePreview(filteredStudents[index]);
          }
          break;
        }
      }
    }, 120);
  }, [isLivePreviewEnabled, filteredStudents, handleLivePreview]);

  // Keyboard navigation on search input: ArrowUp / ArrowDown flips preview in real-time
  const handleKeyDownOnSearch = (e) => {
    if (!filteredStudents.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSearchDropdownOpen(true);
      const currentIndex = filteredStudents.findIndex(s => getCertificateStudentKey(s) === (previewedStudentId || getCertificateStudentKey(selectedStudent)));
      const nextIndex = currentIndex < filteredStudents.length - 1 ? currentIndex + 1 : 0;
      const nextStudent = filteredStudents[nextIndex];
      handleLivePreview(nextStudent);
      const el = listContainerRef.current?.querySelector(`[data-student-index="${nextIndex}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsSearchDropdownOpen(true);
      const currentIndex = filteredStudents.findIndex(s => getCertificateStudentKey(s) === (previewedStudentId || getCertificateStudentKey(selectedStudent)));
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredStudents.length - 1;
      const prevStudent = filteredStudents[prevIndex];
      handleLivePreview(prevStudent);
      const el = listContainerRef.current?.querySelector(`[data-student-index="${prevIndex}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (e.key === 'Enter') {
      const active = filteredStudents.find(s => getCertificateStudentKey(s) === (previewedStudentId || getCertificateStudentKey(selectedStudent))) || filteredStudents[0];
      if (active) {
        handleSelectStudent(active, { keepOpen: isDropdownPinned });
      }
    } else if (e.key === 'Escape') {
      if (!isDropdownPinned) setIsSearchDropdownOpen(false);
    }
  };

  const [isRevokingSingleCert, setIsRevokingSingleCert] = useState(false);
  const [revokeConfirmConfig, setRevokeConfirmConfig] = useState(null);

  const executeRevokeStudentCertificateNumber = async () => {
    if (!selectedStudent) return;
    const raw = selectedStudent.raw || selectedStudent;
    const currentCertNo = refNo || extractStudentCertificateNumber(raw);

    setIsRevokingSingleCert(true);
    try {
      const revocationSource = raw._certificateSourceRecord || raw;
      const res = await revokeCertificateNumberBatch([{
        ...selectedStudent,
        raw: revocationSource,
        certificateNo: currentCertNo
      }]);
      await registerIssuedDocument(selectedStudent, currentCertNo, certificateTitle, 'revoke').catch(() => {});
      if (res.success) {
        showToast(`TC/DC Certificate No. #${currentCertNo} revoked successfully.`, 'success');
        setRefNo('');
        if (raw) {
          raw.ccDcNo = '';
          raw.certificateNo = '';
          raw['No. & Date of CC/DC Issued (This Institution)'] = '';
          raw.dischargeCertStatus = 'Revoked';
        }
        setCustomCanvasHtml(null);
      }
    } catch (err) {
      console.error('Revoke certificate number error:', err);
      showToast(`Failed to revoke certificate number: ${err.message}`, 'error');
    } finally {
      setIsRevokingSingleCert(false);
    }
  };

  // Revoke issued certificate number for currently active student
  const handleRevokeStudentCertificateNumber = () => {
    if (!selectedStudent) return;
    const raw = selectedStudent.raw || selectedStudent;
    const currentCertNo = refNo || extractStudentCertificateNumber(raw);
    const displayName = studentName || selectedStudent.name || 'this student';

    setRevokeConfirmConfig({
      title: 'Revoke Certificate Serial',
      message: `Revoke TC/DC Certificate Number #${currentCertNo || ''} for ${displayName}? The student's assignment will be cleared in Firestore.`,
      consequence: 'The revoked serial remains retired in the school registry and will not be re-issued.',
      confirmText: 'Revoke Certificate',
      onConfirm: () => {
        setRevokeConfirmConfig(null);
        executeRevokeStudentCertificateNumber();
      }
    });
  };

  // ─── Retokenization Context Helper ───
  // Extracts active student and exam values into a rich dictionary for retokenizing HTML back into {TOKENS}
  const buildRetokenizeContext = useCallback(() => {
    const raw = selectedStudent?.raw || selectedStudent || {};
    const resInfo = extractStudentResultMarks(raw);
    const effExamRoll = tcExamRoll || resInfo.examRoll || rollNo || '';
    const effExamMode = tcExamMode || resInfo.examMode || session || '';
    const effMarksObt = tcMarksObtained !== '' ? tcMarksObtained : (resInfo.marksObtained || '');
    const effMaxMarks = tcMaxMarks || resInfo.maxMarks || '500';
    const effDiv = tcDivision || resInfo.division || (effMarksObt ? calculateDivision(effMarksObt, effMaxMarks).division : '');
    const effResultStatus = tcResultStatus || resInfo.resultStatus || 'Awaiting Result';
    const effReappSubjects = tcReappSubjects || resInfo.reappSubjects || '';
    const locality = resolveStudentLocality(selectedStudent, raw, address);

    return {
      studentName,
      fatherName,
      motherName,
      rollNo,
      regNo,
      dobFigures: parsedDob?.figures || '',
      dobWords: parsedDob?.words || '',
      session,
      address,
      className,
      stream,
      gender,
      refNo,
      date: dateStr,
      village: locality.village,
      tehsil: locality.tehsil,
      district: locality.district,
      examRollNo: effExamRoll,
      examSession: effExamMode,
      resultStatus: effResultStatus,
      divisionDistinction: effDiv,
      marksObtained: effMarksObt,
      maxMarks: effMaxMarks,
      reappSubjects: effReappSubjects,
      admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '',
      admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '',
      withdrawalDate: withdrawalDate || raw['Date of withdrawl'] || raw.withdrawalDate || '',
      conductStatus: 'Satisfactory',
      certificateNo: refNo,
      customFields,
      raw
    };
  }, [
    selectedStudent, tcExamRoll, tcExamMode, tcMarksObtained, tcMaxMarks, tcDivision, tcResultStatus, tcReappSubjects,
    studentName, fatherName, motherName, rollNo, regNo, parsedDob, session, address, className, stream, gender, refNo,
    dateStr, admissionDate, admissionNo, withdrawalDate, customFields
  ]);

  // ─── Select Template Handler ───
  const handleSelectTemplate = (tpl) => {
    const sanitizedTpl = sanitizeTemplateObject(tpl);
    setSelectedTemplateId(sanitizedTpl.id);
    const cleanBody = retokenizeCertificateBody(sanitizedTpl.bodyHtml, buildRetokenizeContext());
    setTemplateBody(cleanBody);
    setCustomCanvasHtml(null);

    const canonicalTitle = (sanitizedTpl.certificateTitle && sanitizedTpl.certificateTitle !== 'CERTIFICATE')
      ? sanitizedTpl.certificateTitle
      : (BUILTIN_CERTIFICATE_TEMPLATES.find(b => b.id === sanitizedTpl.id)?.certificateTitle || sanitizedTpl.name || 'CERTIFICATE');
    setCertificateTitle(canonicalTitle);

    const raw = selectedStudent?.raw || selectedStudent || {};
    const resInfo = extractStudentResultMarks(raw);
    const effMarksObt = tcMarksObtained !== '' ? tcMarksObtained : (resInfo.marksObtained || '');
    const effMaxMarks = tcMaxMarks || resInfo.maxMarks || '500';
    const effDiv = tcDivision || resInfo.division || (effMarksObt ? calculateDivision(effMarksObt, effMaxMarks).division : '');
    const effExamRoll = tcExamRoll || resInfo.examRoll || rollNo || '';
    const effExamMode = tcExamMode || resInfo.examMode || session || '';
    const effResultStatus = tcResultStatus || resInfo.resultStatus || 'Awaiting Result';
    const effReappSubjects = tcReappSubjects || resInfo.reappSubjects || '';
    const isPassed = normalizeResultStatus(effResultStatus) === 'Passed';
    const effectiveWd = withdrawalDate || raw['Date of withdrawl'] || raw.withdrawalDate || raw['Result Date'] || raw.resultDate || toLocalDateKey();
    const locality = resolveStudentLocality(selectedStudent, raw, address);

    if (editorRef.current) {
      const immediateHtml = interpolateCertificateTemplate(cleanBody, {
        studentName,
        fatherName,
        motherName,
        className,
        stream,
        rollNo,
        regNo,
        dobFigures: parsedDob.figures,
        dobWords: parsedDob.words,
        session,
        address,
        gender,
        refNo,
        date: dateStr,
        includeSalutations,
        customFields,
        // TC / DC tokens
        examName: `Class ${className || '12th'} Examination`,
        examRollNo: effExamRoll,
        examSession: effExamMode,
        resultStatus: isPassed || sanitizedTpl.id.includes('qualified') ? 'Qualified' : (normalizeResultStatus(effResultStatus) === 'Reap' ? 'Re-appear' : (effResultStatus || 'Did Not Qualify')),
        divisionDistinction: effDiv,
        marksObtained: effMarksObt,
        maxMarks: effMaxMarks,
        reappSubjects: effReappSubjects,
        admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '',
        admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '',
        withdrawalDate: effectiveWd,
        conductStatus: 'Satisfactory',
        village: locality.village,
        tehsil: locality.tehsil,
        district: locality.district,
        certificateNo: refNo || extractStudentCertificateNumber(raw) || '',
        raw
      });
      editorRef.current.innerHTML = sanitizeCertificateHtml(immediateHtml);
      pushSnapshot();
    }
    if (sanitizedTpl.officeTitle) setOfficeTitle(sanitizedTpl.officeTitle);
    if (sanitizedTpl.institutionName) setInstitutionName(sanitizedTpl.institutionName);
    if (sanitizedTpl.institutionAddress) setInstitutionAddress(sanitizedTpl.institutionAddress);
    if (sanitizedTpl.signatoryLeft !== undefined) setSignatoryLeft(sanitizedTpl.signatoryLeft);
    if (sanitizedTpl.signatoryRight !== undefined) setSignatoryRight(sanitizedTpl.signatoryRight);
    if (sanitizedTpl.showLeftSignatory !== undefined) setShowLeftSignatory(sanitizedTpl.showLeftSignatory);
    if (sanitizedTpl.signatorySubtext !== undefined) setSignatorySubtext(sanitizedTpl.signatorySubtext);
    if (sanitizedTpl.watermark !== undefined) setWatermark(sanitizedTpl.watermark);
    if (sanitizedTpl.isCustom && sanitizedTpl.includeSalutations !== undefined) setIncludeSalutations(sanitizedTpl.includeSalutations);
    if (sanitizedTpl.showPhoto !== undefined) {
      setShowPhoto(sanitizedTpl.showPhoto);
      if (sanitizedTpl.showPhoto && !studentPhotoUrl) {
        fetchAndResolveStudentPhoto();
      }
    }
    const issuedCertificateNo = extractStudentCertificateNumber(selectedStudent);
    const selectingTcDc = Boolean(sanitizedTpl.isTcDc || sanitizedTpl.id?.startsWith('tc_dc_'));
    if (selectingTcDc) {
      if (issuedCertificateNo) {
        setRefNo(extractCertificateSerial(issuedCertificateNo) || issuedCertificateNo);
      } else {
        setRefNo('');
        fetchLastIssuedCertificateNumber()
          .then(lastNo => setRefNo(String(lastNo + 1)))
          .catch(error => showToast(error.message || 'Certificate registry could not be verified.', 'error'));
      }
    } else {
      const cleanPrefix = (sanitizedTpl.refPrefix || generalRefPrefix || 'HSS').replace(/^HSS\/SHG(\/|$)/i, 'HSS$1');
      const figure = generalRefSerial || DEFAULT_INITIAL_GENERAL_REF_SERIAL;
      const shortYear = String(generalRefYear || new Date().getFullYear()).slice(-2);
      setRefNo(formatGeneralRefNo(cleanPrefix, figure, shortYear));
    }
    if (!isDesktop) {
      setShowMobileOptionsModal(false);
    }
  };

  // ─── Direct Inline Title (Salutation) Toggle ───
  const handleToggleSalutations = (forceVal = null) => {
    const next = forceVal !== null ? forceVal : !includeSalutations;
    setIncludeSalutations(next);

    if (editorRef.current) {
      const raw = selectedStudent?.raw || selectedStudent || {};
      const resInfo = extractStudentResultMarks(raw);
      const effMarksObt = tcMarksObtained !== '' ? tcMarksObtained : (resInfo.marksObtained || '—');
      const effMaxMarks = tcMaxMarks || resInfo.maxMarks || '500';
      const effDiv = tcDivision || resInfo.division || (effMarksObt !== '—' ? calculateDivision(effMarksObt, effMaxMarks).division : '—');
      const effExamRoll = tcExamRoll || resInfo.examRoll || '—';
      const effExamMode = tcExamMode || resInfo.examMode || '—';
      const effResultStatus = tcResultStatus || resInfo.resultStatus || 'Awaiting Result';
      const effReappSubjects = tcReappSubjects || resInfo.reappSubjects || '—';
      const isPassed = normalizeResultStatus(effResultStatus) === 'Passed';
      const effectiveWd = withdrawalDate || raw['Date of withdrawl'] || raw.withdrawalDate || raw['Result Date'] || raw.resultDate || toLocalDateKey();
      const rawVillage = raw['Village/Town'] || raw.village || raw['Name of your village'] || '';
      const cleanVillage = (rawVillage && rawVillage !== '—' && rawVillage !== '-' && !/^(null|undefined|n\/a)$/i.test(rawVillage)) ? rawVillage : '';
      const village = cleanVillage || (typeof extractVillage === 'function' ? extractVillage(raw) : '') || address || '';
      const rawTehsil = raw['Tehsil'] || raw.tehsil || raw['Block'] || raw.block || '';
      const cleanTehsil = (rawTehsil && rawTehsil !== '—' && rawTehsil !== '-' && !/^(null|undefined|n\/a)$/i.test(rawTehsil)) ? rawTehsil : '';
      const tehsil = cleanTehsil || (address && /shangus/i.test(address) ? 'Shangus' : '') || 'Shangus';
      const rawDistrict = raw['District'] || raw.district || '';
      const cleanDistrict = (rawDistrict && rawDistrict !== '—' && rawDistrict !== '-' && !/^(null|undefined|n\/a)$/i.test(rawDistrict)) ? rawDistrict : '';
      const district = cleanDistrict || (address && /anantnag/i.test(address) ? 'Anantnag' : '') || 'Anantnag';

      const newHtml = interpolateCertificateTemplate(templateBody, {
        studentName,
        fatherName,
        motherName,
        className,
        stream,
        rollNo,
        regNo,
        dobFigures: parsedDob.figures,
        dobWords: parsedDob.words,
        session,
        address,
        gender,
        refNo,
        date: dateStr,
        includeSalutations: next,
        customFields,
        // TC / DC tokens
        examName: `Class ${className || '12th'} Examination`,
        examRollNo: effExamRoll,
        examSession: effExamMode,
        resultStatus: isPassed || selectedTemplateId.includes('qualified') ? 'Qualified' : (normalizeResultStatus(effResultStatus) === 'Reap' ? 'Re-appear' : (effResultStatus || 'Did Not Qualify')),
        divisionDistinction: effDiv,
        marksObtained: effMarksObt,
        maxMarks: effMaxMarks,
        reappSubjects: effReappSubjects,
        admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '—',
        admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '—',
        withdrawalDate: effectiveWd,
        conductStatus: 'Satisfactory',
        village,
        tehsil,
        district,
        certificateNo: refNo || extractStudentCertificateNumber(raw) || '—'
      });

      if (!next) {
        let domHtml = editorRef.current.innerHTML;
        domHtml = domHtml.replace(/(?:Mr\.|Mrs\.|Ms\.|Miss|Master|Smt\.|Shri)\s+/gi, '');
        domHtml = domHtml.replace(/\{GENDER_TITLE\}\s*/gi, '');
        domHtml = domHtml.replace(/\{TITLE\}\s*/gi, '');
        domHtml = domHtml.replace(/\{TITLE_YOUNG\}\s*/gi, '');
        domHtml = domHtml.replace(/\{FATHER_TITLE\}\s*/gi, '');
        domHtml = domHtml.replace(/\{MOTHER_TITLE\}\s*/gi, '');
        editorRef.current.innerHTML = domHtml;
        setCustomCanvasHtml(domHtml);
      } else {
        editorRef.current.innerHTML = newHtml;
        setCustomCanvasHtml(newHtml);
      }
      pushSnapshot();
    } else {
      setCustomCanvasHtml(null);
    }

    showToast(next ? 'Titles (Mr. / Ms. / Mrs.) enabled.' : 'Titles (Mr. / Ms. / Mrs.) hidden.', 'info', 2000);
  };

  // ─── Auto-fetch database photo when Photo is ON ───
  useEffect(() => {
    if (showPhoto && !studentPhotoUrl && !isFetchingPhoto) {
      const studentKey = getCertificateStudentKey(selectedStudent);
      if (!studentKey || photoLookupAttemptsRef.current.has(studentKey)) return;
      photoLookupAttemptsRef.current.add(studentKey);
      fetchAndResolveStudentPhoto(selectedStudent, {
        requestId: selectionRequestRef.current,
        allowNetwork: true
      });
    }
  }, [showPhoto, studentPhotoUrl, isFetchingPhoto, selectedStudent, fetchAndResolveStudentPhoto]);

  // ─── Insert Placeholder Chip ───
  const insertToken = (token) => {
    setTemplateBody(prev => prev + ` ${token} `);
    setCustomCanvasHtml(null);
  };

  // ─── Live Interpolated Preview Content ───
  const interpolatedPreviewHtml = useMemo(() => {
    const raw = selectedStudent?.raw || selectedStudent || {};
    const resInfo = extractStudentResultMarks(raw);

    const effMarksObt = tcMarksObtained !== '' ? tcMarksObtained : (resInfo.marksObtained || '');
    const effMaxMarks = tcMaxMarks || resInfo.maxMarks || '500';
    const effDiv = tcDivision || resInfo.division || (effMarksObt ? calculateDivision(effMarksObt, effMaxMarks).division : '');
    const effExamRoll = tcExamRoll || resInfo.examRoll || rollNo || '';
    const effExamMode = tcExamMode || resInfo.examMode || session || '';
    const effResultStatus = tcResultStatus || resInfo.resultStatus || 'Awaiting Result';
    const effReappSubjects = tcReappSubjects || resInfo.reappSubjects || '';
    const isPassed = normalizeResultStatus(effResultStatus) === 'Passed';

    const effectiveWd = withdrawalDate || raw['Date of withdrawl'] || raw.withdrawalDate || raw['Result Date'] || raw.resultDate || toLocalDateKey();
    const ccDcNo = refNo || extractStudentCertificateNumber(raw) || '';
    const effAdmDate = admissionDate || extractStudentAdmissionDate(raw) || '';
    const effAdmNo = admissionNo || extractStudentAdmissionNumber(raw) || '';
    const locality = resolveStudentLocality(selectedStudent, raw, address);

    return interpolateCertificateTemplate(templateBody, {
      studentName,
      fatherName,
      motherName,
      className,
      stream,
      rollNo,
      regNo,
      dobFigures: parsedDob.figures,
      dobWords: parsedDob.words,
      session,
      address,
      gender,
      refNo,
      date: dateStr,
      includeSalutations,
      customFields,
      // TC / DC tokens
      examName: `Class ${className || '12th'} Examination`,
      examRollNo: effExamRoll,
      examSession: effExamMode,
      resultStatus: isPassed || selectedTemplateId.includes('qualified') ? 'Qualified' : (normalizeResultStatus(effResultStatus) === 'Reap' ? 'Re-appear' : (effResultStatus || 'Did Not Qualify')),
      divisionDistinction: effDiv,
      marksObtained: effMarksObt,
      maxMarks: effMaxMarks,
      reappSubjects: effReappSubjects,
      admissionDate: effAdmDate,
      admissionNo: effAdmNo,
      withdrawalDate: effectiveWd,
      conductStatus: 'Satisfactory',
      village: locality.village,
      tehsil: locality.tehsil,
      district: locality.district,
      certificateNo: ccDcNo,
      raw
    });
  }, [
    templateBody, studentName, fatherName, motherName, className, stream, rollNo, regNo, parsedDob, session, address, gender, refNo, dateStr, includeSalutations, customFields, selectedStudent, withdrawalDate, admissionDate, admissionNo,
    tcMarksObtained, tcMaxMarks, tcDivision, tcExamRoll, tcExamMode, tcResultStatus, tcReappSubjects, selectedTemplateId
  ]);

  // Active rendered HTML (Canvas override or cleanly interpolated preview)
  const activeDisplayHtml = customCanvasHtml !== null ? customCanvasHtml : interpolatedPreviewHtml;

  // Synchronize editorRef DOM with clean interpolated preview whenever not in manual canvas-override mode
  useEffect(() => {
    if (customCanvasHtml === null && editorRef.current) {
      editorRef.current.innerHTML = sanitizeCertificateHtml(interpolatedPreviewHtml);
    }
  }, [interpolatedPreviewHtml, customCanvasHtml]);

  // ─── 1-Click Set as Default Template ───
  const handleSetDefaultTemplate = async (templateId, e) => {
    e?.stopPropagation();
    setDefaultTemplateId(templateId);
    try {
      await setCloudDefaultTemplate(templateId, 'certificate');
      showToast('✓ Set as default certificate template!', 'success');
    } catch (err) {
      console.warn('Set default error:', err);
      showToast(`Default template set locally (${err.message})`, 'info');
    }
  };

  // ─── Duplicate Template to Create New Preset ───
  const handleDuplicateTemplate = (tpl, e) => {
    if (e) e.stopPropagation();
    handleSelectTemplate(tpl);
    setNewTplName(`${tpl.name} (Copy)`);
    setNewTplCategory(tpl.category || 'Bonafide & Age Certificates');
    setTemplateSaveMode('new');
    setShowSaveTemplateModal(true);
  };

  // ─── Save Custom / Update Existing Template (Cloud + LocalStorage) ───
  const handleSaveCustomTemplate = async (e) => {
    e?.preventDefault();
    const isUpdating = templateSaveMode === 'update';
    const activeTpl = allTemplatesList.find(t => t.id === selectedTemplateId) || BUILTIN_CERTIFICATE_TEMPLATES[0];

    if (!isUpdating && !newTplName.trim()) {
      showToast('Please enter a template name.', 'warning');
      return;
    }

    const currentHtml = editorRef.current ? editorRef.current.innerHTML : (templateBody || activeDisplayHtml);
    const cleanBodyHtml = retokenizeCertificateBody(currentHtml, buildRetokenizeContext());

    const targetTpl = sanitizeTemplateObject({
      id: isUpdating ? selectedTemplateId : `custom_cert_${Date.now()}`,
      name: isUpdating ? (activeTpl.name || 'Bonafide Certificate') : newTplName.trim(),
      category: isUpdating ? (activeTpl.category || 'Bonafide & Age Certificates') : (newTplCategory || 'Custom Certificates'),
      certificateTitle: certificateTitle || 'BONAFIDE CERTIFICATE',
      officeTitle: officeTitle || 'OFFICE OF THE PRINCIPAL',
      institutionName: institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
      institutionAddress: institutionAddress || 'District Anantnag, Kashmir — 192201 (J&K)',
      refNo: refNo || '',
      refPrefix: activeTpl.refPrefix || '',
      signatoryLeft: signatoryLeft || '',
      signatoryRight: signatoryRight || '',
      showLeftSignatory,
      signatorySubtext: signatorySubtext || 'Govt. HSS Shangus',
      bodyHtml: cleanBodyHtml,
      showPhoto,
      watermark,
      includeSalutations,
      isCustom: true
    });

    try {
      await saveCloudDocTemplate({
        type: 'certificate',
        template: targetTpl,
        makeDefault: isUpdating ? (selectedTemplateId === defaultTemplateId || makeTemplateDefault) : makeTemplateDefault
      });

      const updated = [targetTpl, ...customTemplates.filter(t => t.id !== targetTpl.id)];
      setCustomTemplates(updated);
      setSelectedTemplateId(targetTpl.id);
      setTemplateBody(cleanBodyHtml);
      if (makeTemplateDefault || (isUpdating && selectedTemplateId === defaultTemplateId)) {
        setDefaultTemplateId(targetTpl.id);
      }
      setShowSaveTemplateModal(false);
      setNewTplName('');
      showToast(`☁️ Template "${targetTpl.name}" successfully saved to Cloud Database!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Template saved locally (Cloud note: ${err.message})`, 'warning');
    }
  };

  // ─── 1-Click Quick Update of Active Template ───
  const handleQuickUpdateTemplate = async () => {
    const activeTpl = allTemplatesList.find(t => t.id === selectedTemplateId) || BUILTIN_CERTIFICATE_TEMPLATES[0];
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : (templateBody || activeDisplayHtml);
    const cleanBodyHtml = retokenizeCertificateBody(currentHtml, buildRetokenizeContext());

    const targetTpl = sanitizeTemplateObject({
      id: selectedTemplateId,
      name: activeTpl.name || 'Bonafide Certificate',
      category: activeTpl.category || 'Bonafide & Age Certificates',
      certificateTitle: (certificateTitle && certificateTitle !== 'CERTIFICATE') ? certificateTitle : (activeTpl.certificateTitle || activeTpl.name || 'BONAFIDE CERTIFICATE'),
      officeTitle: officeTitle || 'OFFICE OF THE PRINCIPAL',
      institutionName: institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
      institutionAddress: institutionAddress || 'District Anantnag, Kashmir — 192201 (J&K)',
      refNo: refNo || '',
      refPrefix: activeTpl.refPrefix || '',
      signatoryLeft: signatoryLeft || '',
      signatoryRight: signatoryRight || '',
      showLeftSignatory,
      signatorySubtext: signatorySubtext || 'Govt. HSS Shangus',
      bodyHtml: cleanBodyHtml,
      showPhoto,
      watermark,
      includeSalutations,
      isCustom: true
    });

    try {
      await saveCloudDocTemplate({
        type: 'certificate',
        template: targetTpl,
        makeDefault: selectedTemplateId === defaultTemplateId
      });

      const updated = [targetTpl, ...customTemplates.filter(t => t.id !== targetTpl.id)];
      setCustomTemplates(updated);
      setTemplateBody(cleanBodyHtml);
      showToast(`☁️ Template "${targetTpl.name}" successfully overwritten and saved in Cloud!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Template saved locally (Cloud note: ${err.message})`, 'warning');
    }
  };

  // ─── Delete Custom Template (With Warning & Cloud Confirmation Modal) ───
  const handleDeleteCustomTemplate = (target, e) => {
    if (e) e.stopPropagation();
    const tpl = typeof target === 'object' ? target : customTemplates.find(t => t.id === target);
    if (!tpl) return;
    setTemplateToDelete(tpl);
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    const id = templateToDelete.id;
    const name = templateToDelete.name;
    setIsDeletingTemplate(true);
    try {
      await deleteCloudDocTemplate(id, 'certificate');
      showToast(`🗑️   Template "${name}" permanently deleted from Cloud & workspace.`, 'info');
    } catch (err) {
      console.warn(err);
      showToast(`Template "${name}" deleted locally.`, 'info');
    }
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    if (selectedTemplateId === id) {
      handleSelectTemplate(BUILTIN_CERTIFICATE_TEMPLATES[0]);
    }
    if (defaultTemplateId === id) {
      setDefaultTemplateId('bonafide_dob');
    }
    setIsDeletingTemplate(false);
    setTemplateToDelete(null);
  };

  // ─── Preset Firestore Student Fields & Auto-Pick Handlers ───
  const FIRESTORE_PRESET_FIELDS = [
    { label: 'Mobile No', keys: ['mobile', 'mobile_no', 'Mobile', 'Mobile Number', 'Phone', 'contact_no', 'phone'] },
    { label: 'Email Address', keys: ['email', 'Email', 'email_address'] },
    { label: 'Admission Form No', keys: ['formNo', 'form_no', 'Form No', 'Form Number', 'FormNumber', 'id'] },
    { label: 'Aadhaar Number', keys: ['aadhar', 'aadhar_no', 'Aadhar', 'Aadhaar', 'aadhaar_no', 'Aadhar Number', 'aadhaar'] },
    { label: 'Category', keys: ['category', 'Category', 'Social Category', 'social_category', 'reserved_category'] },
    { label: 'Blood Group', keys: ['blood_group', 'Blood Group', 'bloodGroup', 'BloodGroup', 'blood_grp'] },
    { label: 'PEN Number', keys: ['pen', 'pen_no', 'PEN', 'PEN No', 'PEN Number', 'pen_number', 'Permanent Education No'] },
    { label: 'Previous School', keys: ['prev_school', 'previous_school', 'Previous School', 'Institution Last Attended', 'school_last_attended'] },
    { label: 'Marks Percentage', keys: ['percentage', 'Percentage', 'marks_percentage', 'Marks %', 'percent', 'Percentage / GPA'] },
    { label: 'Subjects', keys: ['subjects', 'Subjects', 'subjects_offered', 'Subjects Offered', 'subject_combination', 'Subjects Selected'] },
    { label: 'Admission Date', keys: ['admission_date', 'Admission Date', 'adm_date', 'date_of_admission', 'Date of Admission'] },
    { label: 'Guardian Contact', keys: ['parent_mobile', 'guardian_mobile', 'Father Mobile', 'father_mobile', 'Parent Contact'] },
    { label: 'Village / Tehsil', keys: ['village', 'Village', 'tehsil', 'Tehsil', 'residence_village'] }
  ];

  const findValueInStudentRaw = (st, keys) => {
    if (!st) return '';
    for (const k of keys) {
      if (st[k] !== undefined && st[k] !== null && String(st[k]).trim() !== '' && String(st[k]).trim() !== '—') {
        return String(st[k]).trim();
      }
    }
    if (st.raw && typeof st.raw === 'object') {
      for (const k of keys) {
        if (st.raw[k] !== undefined && st.raw[k] !== null && String(st.raw[k]).trim() !== '' && String(st.raw[k]).trim() !== '—') {
          return String(st.raw[k]).trim();
        }
      }
    }
    return '';
  };

  // Extract all extra raw keys present in the selected student's Firestore document
  const availableRawFirestoreFields = useMemo(() => {
    if (!selectedStudent?.raw || typeof selectedStudent.raw !== 'object') return [];
    const ignoredKeys = new Set([
      '_srcCollection', 'id', 'photoUrl', 'passport_photo', 'Photo', 'Student Photo', 
      'createdAt', 'updatedAt', 'timestamp', 'raw', 'status', 'Status', 'formStatus',
      'searchKeywords', 'uid', 'studentPhoto', 'name', 'father', 'mother', 'gender'
    ]);
    
    const list = [];
    Object.entries(selectedStudent.raw).forEach(([k, v]) => {
      if (ignoredKeys.has(k)) return;
      if (typeof v === 'object' && v !== null) return;
      const strVal = String(v ?? '').trim();
      if (!strVal || strVal === '—' || strVal === 'null' || strVal === 'undefined') return;
      
      const formattedLabel = k
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b\w/g, l => l.toUpperCase());
      
      list.push({ key: k, label: formattedLabel, value: strVal });
    });
    return list;
  }, [selectedStudent]);

  const handlePickFirestoreField = (label, defaultValue = '') => {
    // Check if already in customFields
    const existing = customFields.find(f => f.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      if (defaultValue && !existing.value) {
        handleUpdateCustomField(existing.id, 'value', defaultValue);
      }
      return;
    }
    const newField = {
      id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim(),
      value: defaultValue
    };
    setCustomFields(prev => [...prev, newField]);
  };

  // ─── Custom Dynamic Fields Handlers (Temporary In-Memory Overrides) ───
  const handleAddCustomField = (e) => {
    e?.preventDefault();
    if (!newCustomFieldName.trim()) return;
    const newField = {
      id: `custom_field_${Date.now()}`,
      label: newCustomFieldName.trim(),
      value: newCustomFieldValue.trim()
    };
    setCustomFields(prev => [...prev, newField]);
    setNewCustomFieldName('');
    setNewCustomFieldValue('');
  };

  const handleUpdateCustomField = (id, fieldKey, val) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, [fieldKey]: val } : f));
  };

  const handleDeleteCustomField = (id) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleResetFieldsToStudent = () => {
    if (!selectedStudent) return;
    const st = selectedStudent;
    const activeSingleSession = (selectedSessions.length === 1 && selectedSessions[0] !== '__NONE__') ? selectedSessions[0] : null;
    const activeSingleClass = (selectedClasses.length === 1 && selectedClasses[0] !== '__NONE__' && selectedClasses[0] !== 'past') ? selectedClasses[0] : null;
    const effectiveSession = activeSingleSession || st.session || '2025-26';
    const effectiveClass = activeSingleClass || st.cls || '11th';

    setStudentName(st.name || '');
    setFatherName(st.father || '');
    setMotherName(st.mother || '');
    setClassName(effectiveClass);
    setStream(st.stream || 'Arts');
    setRollNo(st.rollNo || '');
    setRegNo(st.regNo || '');
    setSession(effectiveSession);
    setGender(st.gender || '');
    setDobRaw(st.dob || '');
    setAddress(st.address || '');
    const raw = st.raw || st;
    const rawWd = raw['Date of withdrawl'] || raw.withdrawalDate || raw['Result Date'] || raw.resultDate || toLocalDateKey();
    setWithdrawalDate(rawWd);
    setCustomCanvasHtml(null);

    // Also refresh values for any active custom Firestore fields
    setCustomFields(prev => prev.map(f => {
      const preset = FIRESTORE_PRESET_FIELDS.find(p => p.label.toLowerCase() === f.label.toLowerCase());
      if (preset) {
        const val = findValueInStudentRaw(st, preset.keys);
        if (val) return { ...f, value: val };
      }
      return f;
    }));
  };

  // ─── Direct In-Place Canvas Editor & Right-Click Context Menu State ───
  const editorRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [tableMenuTab, setTableMenuTab] = useState('insert'); // 'insert' | 'edit'
  const [customTableRows, setCustomTableRows] = useState(3);
  const [customTableCols, setCustomTableCols] = useState(3);
  const colorMenuRef = useRef(null);
  const tableMenuRef = useRef(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [savedRange, setSavedRange] = useState(null);
  const savedRangeRef = useRef(null);
  const [showInsertFieldDropdown, setShowInsertFieldDropdown] = useState(false);
  const insertFieldDropdownRef = useRef(null);

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    h1: false,
    h2: false,
    p: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false
  });

  const checkActiveFormats = () => {
    if (typeof window === 'undefined' || !editorRef.current) return;
    try {
      const sel = window.getSelection();
      let isH1 = false;
      let isH2 = false;
      let isP = false;

      if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
        let node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;
        const blockParent = node?.closest('h1, h2, h3, h4, h5, h6, p, blockquote, div');
        const tag = blockParent?.tagName?.toLowerCase();
        if (tag === 'h1') isH1 = true;
        else if (tag === 'h2') isH2 = true;
        else if (tag === 'p' || tag === 'div' || !tag) isP = true;
      }

      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        h1: isH1,
        h2: isH2,
        p: isP,
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList')
      });
    } catch {}
  };

  const saveCurrentSelection = () => {
    if (typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        setSavedRange(savedRangeRef.current);
      }
    }
  };

  // ── Table Context & Manipulation State ──
  const [activeTableContext, setActiveTableContext] = useState(null);
  const lastActiveTableRef = useRef(null);

  const getSelectedTableElements = () => {
    const sel = window.getSelection();
    let node = sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode) ? sel.anchorNode : null;
    let td = null;
    let tr = null;
    let table = null;
    let colIndex = 0;
    let rowIndex = 0;

    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        td = node;
      }
      if (node.nodeName === 'TR') {
        tr = node;
      }
      if (node.nodeName === 'TABLE') {
        table = node;
        break;
      }
      node = node.parentNode;
    }

    if (table && tr && td) {
      colIndex = Array.from(tr.children).indexOf(td);
      const allRows = Array.from(table.querySelectorAll('tr'));
      rowIndex = allRows.indexOf(tr);
      lastActiveTableRef.current = { td, tr, table, colIndex, rowIndex, isInsideTable: true };
      return { td, tr, table, colIndex, rowIndex, isInsideTable: true };
    }

    if (lastActiveTableRef.current && editorRef.current && editorRef.current.contains(lastActiveTableRef.current.table)) {
      return { ...lastActiveTableRef.current, isInsideTable: false };
    }

    if (editorRef.current) {
      const firstTable = editorRef.current.querySelector('table');
      if (firstTable) {
        const allTrs = Array.from(firstTable.querySelectorAll('tr'));
        const lastTr = allTrs[allTrs.length - 1] || null;
        const lastTd = lastTr ? lastTr.children[lastTr.children.length - 1] : null;
        return {
          td: lastTd,
          tr: lastTr,
          table: firstTable,
          colIndex: lastTr ? lastTr.children.length - 1 : 0,
          rowIndex: allTrs.length - 1,
          isInsideTable: false
        };
      }
    }

    return null;
  };

  const checkTableContext = () => {
    const ctx = getSelectedTableElements();
    if (ctx && ctx.table) {
      const allTrs = Array.from(ctx.table.querySelectorAll('tr'));
      setActiveTableContext({
        colIndex: ctx.colIndex,
        rowIndex: ctx.rowIndex,
        totalCols: ctx.tr ? ctx.tr.children.length : 0,
        totalRows: allTrs.length,
        hasTable: true,
        isInsideTable: !!ctx.isInsideTable
      });
      if (ctx.isInsideTable) {
        setTableMenuTab('edit');
      } else {
        setTableMenuTab('insert');
      }
    } else {
      setActiveTableContext(null);
      setTableMenuTab('insert');
    }
  };

  const pushSnapshot = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === currentHtml) {
      return;
    }
    const newStack = historyRef.current.slice(0, historyIndexRef.current + 1);
    newStack.push(currentHtml);
    if (newStack.length > 50) newStack.shift();
    historyRef.current = newStack;
    historyIndexRef.current = newStack.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const handleUndo = () => {
    if (!editorRef.current || historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    editorRef.current.innerHTML = historyRef.current[historyIndexRef.current];
    setCustomCanvasHtml(historyRef.current[historyIndexRef.current]);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    editorRef.current.focus();
  };

  const handleRedo = () => {
    if (!editorRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    editorRef.current.innerHTML = historyRef.current[historyIndexRef.current];
    setCustomCanvasHtml(historyRef.current[historyIndexRef.current]);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    editorRef.current.focus();
  };

  const executeFormat = (command, value = null) => {
    if (!editorRef.current) return;
    pushSnapshot();
    editorRef.current.focus();

    // 1. Unconditionally restore activeRange into selection
    const sel = window.getSelection();
    const activeRange = savedRangeRef.current || savedRange;
    if (activeRange && sel && editorRef.current.contains(activeRange.commonAncestorContainer)) {
      try {
        sel.removeAllRanges();
        sel.addRange(activeRange);
      } catch {}
    }

    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}

    try {
      if (command === 'formatBlock') {
        const targetClean = (value || 'p').replace(/[<>]/g, '').toLowerCase();
        let currentBlock = null;
        if (sel && sel.rangeCount > 0) {
          let node = sel.getRangeAt(0).commonAncestorContainer;
          if (node.nodeType === 3) node = node.parentNode;
          currentBlock = node?.closest('h1, h2, h3, h4, h5, h6, p, blockquote, div');
        }

        const currentTag = currentBlock?.tagName?.toLowerCase() || 'p';
        const isSameTag = currentTag === targetClean;

        // If clicking the active heading again, toggle off to normal paragraph '<p>'
        const newTag = (isSameTag && targetClean !== 'p') ? 'p' : targetClean;

        let success = document.execCommand('formatBlock', false, `<${newTag}>`);
        if (!success) {
          success = document.execCommand('formatBlock', false, newTag);
        }

        if (currentBlock && currentBlock.isConnected && currentBlock !== editorRef.current) {
          if (currentBlock.tagName.toLowerCase() !== newTag) {
            const newElem = document.createElement(newTag);
            newElem.innerHTML = currentBlock.innerHTML;
            currentBlock.parentNode.replaceChild(newElem, currentBlock);
            const r = document.createRange();
            r.selectNodeContents(newElem);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        }
      } else {
        document.execCommand(command, false, value);
      }
    } catch (err) {
      console.warn('Formatting command error:', err);
    }
    if (editorRef.current) {
      setCustomCanvasHtml(editorRef.current.innerHTML);
    }
    saveCurrentSelection();
    setTimeout(() => {
      pushSnapshot();
      checkTableContext();
      checkActiveFormats();
    }, 50);
  };

  // Instantaneous Text Color Application with CSS styling, font conversion & smart selection recovery
  const applyTextColor = (color) => {
    if (!editorRef.current) return;
    pushSnapshot();
    editorRef.current.focus();

    // 1. Restore saved selection unconditionally
    const sel = window.getSelection();
    let activeRange = savedRangeRef.current || savedRange;
    if (activeRange && sel && editorRef.current.contains(activeRange.commonAncestorContainer)) {
      try {
        sel.removeAllRanges();
        sel.addRange(activeRange);
      } catch (err) {
        console.warn('Could not restore selection range:', err);
      }
    }

    // 2. If selection is collapsed inside text, auto-expand to word under cursor
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (range.collapsed && editorRef.current.contains(range.startContainer)) {
        const node = range.startContainer;
        if (node.nodeType === 3) {
          const text = node.nodeValue || '';
          let start = range.startOffset;
          let end = range.startOffset;
          while (start > 0 && !/\s/.test(text[start - 1])) start--;
          while (end < text.length && !/\s/.test(text[end])) end++;
          if (start < end) {
            const wordRange = document.createRange();
            wordRange.setStart(node, start);
            wordRange.setEnd(node, end);
            sel.removeAllRanges();
            sel.addRange(wordRange);
            activeRange = wordRange;
          }
        }
      }
    }

    // 3. Enable styleWithCSS so colors are applied as inline styles
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}

    // 4. Apply text color command with fallback
    let applied = false;
    try {
      applied = document.execCommand('foreColor', false, color);
      if (!applied) {
        document.execCommand('styleWithCSS', false, false);
        applied = document.execCommand('foreColor', false, color);
      }
    } catch (err) {
      console.warn('Text color command error:', err);
    }

    // 5. Convert any generated <font color="..."> elements to <span style="color: ...">
    if (editorRef.current) {
      const fontTags = editorRef.current.querySelectorAll('font[color]');
      fontTags.forEach(f => {
        const span = document.createElement('span');
        const cVal = f.getAttribute('color') || color;
        span.style.color = cVal;
        span.innerHTML = f.innerHTML;
        if (f.parentNode) {
          f.parentNode.replaceChild(span, f);
        }
        applied = true;
      });
    }

    // 6. Direct DOM wrap fallback if range is non-collapsed and execCommand didn't wrap it
    if (!applied && sel && sel.rangeCount > 0) {
      const currentRange = sel.getRangeAt(0);
      if (!currentRange.collapsed && editorRef.current.contains(currentRange.commonAncestorContainer)) {
        try {
          const span = document.createElement('span');
          span.style.color = color;
          span.appendChild(currentRange.extractContents());
          currentRange.insertNode(span);
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } catch (domErr) {
          console.warn('Direct DOM wrap fallback error:', domErr);
        }
      }
    }

    // 7. Update canvas state immediately
    if (editorRef.current) {
      setCustomCanvasHtml(editorRef.current.innerHTML);
    }
    saveCurrentSelection();
    setTimeout(() => {
      pushSnapshot();
      checkTableContext();
      checkActiveFormats();
    }, 50);
    showToast(`Color applied (${color})`, 'info', 1500);
  };

  // ─── Font Size Scaling & Selection Styling Handlers ───
  const FONT_SIZES = ['10px', '11px', '12px', '12.5px', '13px', '13.5px', '14px', '15px', '16px', '18px', '20px'];

  const handleSetFontSize = (size) => {
    setBaseFontSize(size);
    try {
      localStorage.setItem('hss_cert_base_font_size', size);
    } catch {}

    const sel = window.getSelection();
    let activeRange = savedRangeRef.current || savedRange;
    if (activeRange && sel && editorRef.current?.contains(activeRange.commonAncestorContainer)) {
      try {
        sel.removeAllRanges();
        sel.addRange(activeRange);
      } catch {}
    }

    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed && editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      // Apply inline font size to selected text
      pushSnapshot();
      try {
        const range = sel.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = size;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
        saveCurrentSelection();
        if (editorRef.current) setCustomCanvasHtml(editorRef.current.innerHTML);
      } catch (e) {
        console.warn('Font size selection styling error:', e);
      }
    } else {
      // Document-wide base font size update
      if (editorRef.current) {
        editorRef.current.style.fontSize = size;
        setCustomCanvasHtml(editorRef.current.innerHTML);
      }
    }
    showToast(`Font size set to ${size}`, 'info', 1200);
  };

  const handleAdjustFontSize = (delta) => {
    const sel = window.getSelection();
    let activeRange = savedRangeRef.current || savedRange;
    if (activeRange && sel && editorRef.current?.contains(activeRange.commonAncestorContainer)) {
      try {
        sel.removeAllRanges();
        sel.addRange(activeRange);
      } catch {}
    }

    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed && editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode;
      const computed = window.getComputedStyle(node).fontSize;
      const currentPx = parseInt(computed, 10) || parseInt(baseFontSize, 10) || 12;
      const newPx = Math.max(9, Math.min(26, currentPx + delta));
      handleSetFontSize(`${newPx}px`);
    } else {
      const currentIdx = FONT_SIZES.indexOf(baseFontSize);
      let nextIdx;
      if (currentIdx !== -1) {
        nextIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, currentIdx + delta));
      } else {
        const currentPx = parseInt(baseFontSize, 10) || 12;
        const targetPx = currentPx + delta;
        nextIdx = FONT_SIZES.findIndex(s => parseInt(s, 10) >= targetPx);
        if (nextIdx === -1) nextIdx = delta > 0 ? FONT_SIZES.length - 1 : 0;
      }
      handleSetFontSize(FONT_SIZES[nextIdx]);
    }
  };

  const insertTable = (rows = 2, cols = 3) => {
    pushSnapshot();
    if (!editorRef.current) return;
    editorRef.current.focus();

    // Check if live selection or saved range was inside an existing table
    const sel = window.getSelection();
    let currentTable = null;
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode;
      currentTable = node?.closest('table');
    }
    if (!currentTable && lastActiveTableRef.current?.table?.isConnected && lastActiveTableRef.current.isInsideTable) {
      currentTable = lastActiveTableRef.current.table;
    }

    let tableHtml = `<table style="width:100%; border-collapse:collapse; margin:10px 0;"><thead><tr style="background-color:#f1f5f9;">`;
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th style="border:1px solid #64748b; padding:4px 6px; text-align:left; font-weight:bold; font-size:11px;">Header ${c}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let r = 1; r <= rows; r++) {
      tableHtml += `<tr>`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td style="border:1px solid #94a3b8; padding:4px 6px; font-size:11px;">—</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br/></p>`;

    if (currentTable && currentTable.parentNode && editorRef.current.contains(currentTable)) {
      // Smart insertion: Place new table directly AFTER currentTable with paragraph break to avoid nesting
      const tempWrapper = document.createElement('div');
      tempWrapper.innerHTML = `<p><br/></p>${tableHtml}`;
      const fragment = document.createDocumentFragment();
      while (tempWrapper.firstChild) {
        fragment.appendChild(tempWrapper.firstChild);
      }
      if (currentTable.nextSibling) {
        currentTable.parentNode.insertBefore(fragment, currentTable.nextSibling);
      } else {
        currentTable.parentNode.appendChild(fragment);
      }
      showToast('Inserted another table below existing table', 'info', 2000);
    } else {
      executeFormat('insertHTML', tableHtml);
      showToast('Table inserted', 'info', 1500);
    }

    setTimeout(() => {
      pushSnapshot();
      checkTableContext();
      if (editorRef.current) setCustomCanvasHtml(editorRef.current.innerHTML);
    }, 50);
    setShowTableMenu(false);
  };

  const insertTableRow = (above = false) => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) {
      insertTable(2, 3);
      return;
    }
    pushSnapshot();
    const allRows = Array.from(ctx.table.querySelectorAll('tr'));
    if (allRows.length === 0) return;

    const colCount = allRows[0]?.children.length || 3;
    const newTr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.style.border = '1px solid #94a3b8';
      td.style.padding = '4px 6px';
      td.style.fontSize = '11px';
      td.innerHTML = '—';
      newTr.appendChild(td);
    }

    const targetRow = ctx.tr || allRows[allRows.length - 1];
    if (targetRow && targetRow.parentNode) {
      if (above && targetRow.parentNode.tagName !== 'THEAD') {
        targetRow.parentNode.insertBefore(newTr, targetRow);
      } else {
        targetRow.parentNode.insertBefore(newTr, targetRow.nextSibling);
      }
    } else {
      const tbody = ctx.table.querySelector('tbody') || ctx.table;
      tbody.appendChild(newTr);
    }

    lastActiveTableRef.current = { td: newTr.children[0], tr: newTr, table: ctx.table, colIndex: 0, rowIndex: allRows.length };
    pushSnapshot();
    checkTableContext();
    if (editorRef.current) setCustomCanvasHtml(editorRef.current.innerHTML);
    setShowTableMenu(false);
  };

  const deleteTableRow = () => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) return;

    pushSnapshot();
    const allRows = Array.from(ctx.table.querySelectorAll('tr'));
    if (allRows.length <= 1) {
      ctx.table.remove();
      lastActiveTableRef.current = null;
    } else {
      const targetRow = ctx.tr || allRows[allRows.length - 1];
      if (targetRow) {
        targetRow.remove();
      }
    }

    pushSnapshot();
    checkTableContext();
    if (editorRef.current) setCustomCanvasHtml(editorRef.current.innerHTML);
    setShowTableMenu(false);
  };

  const insertTableColumn = (left = false) => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) {
      insertTable(2, 3);
      return;
    }
    pushSnapshot();
    const allRows = ctx.table.querySelectorAll('tr');
    if (allRows.length === 0) return;

    const targetColIdx = (ctx.colIndex !== undefined && ctx.colIndex >= 0)
      ? ctx.colIndex
      : (ctx.tr && ctx.td ? Array.from(ctx.tr.children).indexOf(ctx.td) : (allRows[0].children.length - 1));

    allRows.forEach((row, rIdx) => {
      const isHeader = row.parentNode?.tagName === 'THEAD' || row.querySelector('th') || rIdx === 0;
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.style.border = isHeader ? '1px solid #64748b' : '1px solid #94a3b8';
      newCell.style.padding = '4px 6px';
      newCell.style.fontSize = '11px';
      newCell.innerHTML = isHeader ? `Header ${row.children.length + 1}` : `—`;

      const targetCell = row.children[targetColIdx];
      if (targetCell) {
        if (left) {
          row.insertBefore(newCell, targetCell);
        } else {
          row.insertBefore(newCell, targetCell.nextSibling);
        }
      } else {
        row.appendChild(newCell);
      }
    });

    pushSnapshot();
    checkTableContext();
    if (editorRef.current) setCustomCanvasHtml(editorRef.current.innerHTML);
    setShowTableMenu(false);
  };

  const deleteTableColumn = () => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) return;

    pushSnapshot();
    const allRows = ctx.table.querySelectorAll('tr');
    if (allRows.length === 0) return;

    const colIndex = (ctx.colIndex !== undefined && ctx.colIndex >= 0)
      ? ctx.colIndex
      : (ctx.tr && ctx.td ? Array.from(ctx.tr.children).indexOf(ctx.td) : (allRows[0].children.length - 1));

    allRows.forEach(row => {
      if (row.children[colIndex]) {
        row.children[colIndex].remove();
      }
    });

    if (allRows[0] && allRows[0].children.length === 0) {
      ctx.table.remove();
      lastActiveTableRef.current = null;
    }

    pushSnapshot();
    checkTableContext();
    if (editorRef.current) setCustomCanvasHtml(editorRef.current.innerHTML);
    setShowTableMenu(false);
  };

  const deleteEntireTable = () => {
    const ctx = getSelectedTableElements();
    if (ctx && ctx.table) {
      pushSnapshot();
      ctx.table.remove();
      lastActiveTableRef.current = null;
      pushSnapshot();
      checkTableContext();
      if (editorRef.current) setCustomCanvasHtml(editorRef.current.innerHTML);
    }
    setShowTableMenu(false);
  };

  const insertHorizontalRule = () => {
    executeFormat('insertHorizontalRule');
  };

  // Sync interpolated content into editorRef whenever active content changes
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = sanitizeCertificateHtml(activeDisplayHtml);
      pushSnapshot();
    }
  }, [activeDisplayHtml]);

  const handleEditorInput = () => {
    if (editorRef.current) {
      setCustomCanvasHtml(editorRef.current.innerHTML);
      pushSnapshot();
    }
  };

  const handleContextMenu = (e) => {
    // Disable right-click popup on mobile/touch screens to allow native text selection and copying
    const isTouchOrMobile = (typeof window !== 'undefined' && (
      window.innerWidth < 768 ||
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    ));
    if (isTouchOrMobile) {
      return;
    }
    e.preventDefault();
    saveCurrentSelection();
    const menuWidth = 280;
    const menuHeight = 440;
    const x = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 10));
    const y = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 10));
    setContextMenuPos({ x, y });
    setShowContextMenu(true);
  };

  useEffect(() => {
    const handleGlobalClick = (e) => {
      setShowContextMenu(false);
      if (insertFieldDropdownRef.current && !insertFieldDropdownRef.current.contains(e.target)) {
        setShowInsertFieldDropdown(false);
      }
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target)) {
        setShowColorMenu(false);
      }
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target)) {
        setShowTableMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowContextMenu(false);
        setShowInsertFieldDropdown(false);
        setShowColorMenu(false);
        setShowTableMenu(false);
      }
    };
    const onSelectionChange = () => {
      if (typeof window !== 'undefined' && window.getSelection && editorRef.current) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange();
          setSavedRange(savedRangeRef.current);
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, []);

  // Helper to determine if editor cursor is at start of sentence
  const isCursorAtStartOfSentence = () => {
    try {
      const activeRange = savedRangeRef.current || savedRange || (typeof window !== 'undefined' && window.getSelection && window.getSelection().rangeCount > 0 ? window.getSelection().getRangeAt(0) : null);
      if (!activeRange || !editorRef.current) return false;
      const preRange = document.createRange();
      preRange.selectNodeContents(editorRef.current);
      preRange.setEnd(activeRange.startContainer, activeRange.startOffset);
      const preText = preRange.toString().trimEnd();
      if (!preText || preText.length === 0) return true;
      const stripped = preText.replace(/["'”’)\]]+$/, '');
      const lastChar = stripped.length > 0 ? stripped[stripped.length - 1] : '';
      if (lastChar === '.' || lastChar === '!' || lastChar === '?' || lastChar === '\n' || lastChar === ':' || lastChar === '—') {
        if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Shri|Smt)\.$/i.test(stripped)) return false;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Helper to resolve any placeholder token or template string to its active rendered value
  const resolveTokenOrText = (rawTokenOrText) => {
    if (!rawTokenOrText) return '';
    const str = String(rawTokenOrText);
    const raw = selectedStudent?.raw || selectedStudent || {};
    const resInfo = extractStudentResultMarks(raw);
    const effExamRoll = tcExamRoll || resInfo.examRoll || rollNo || '';
    const effExamMode = tcExamMode || resInfo.examMode || session || '';
    const effMarksObt = tcMarksObtained !== '' ? tcMarksObtained : (resInfo.marksObtained || '');
    const effMaxMarks = tcMaxMarks || resInfo.maxMarks || '500';
    const effDiv = tcDivision || resInfo.division || (effMarksObt ? calculateDivision(effMarksObt, effMaxMarks).division : '');
    const effResultStatus = tcResultStatus || resInfo.resultStatus || 'Awaiting Result';
    const effReappSubjects = tcReappSubjects || resInfo.reappSubjects || '';
    const effectiveWd = withdrawalDate || raw['Date of withdrawl'] || raw.withdrawalDate || raw['Result Date'] || raw.resultDate || toLocalDateKey();
    const locality = resolveStudentLocality(selectedStudent, raw, address);

    const isFemale = String(gender).toUpperCase().startsWith('F') || String(gender).toUpperCase() === 'FEMALE';
    const studentTitle = includeSalutations ? (isFemale ? 'Ms.' : 'Mr.') : '';
    const studentTitleYoung = includeSalutations ? (isFemale ? 'Miss' : 'Master') : '';
    const fatherTitle = includeSalutations ? 'Mr.' : '';
    const motherTitle = includeSalutations ? 'Mrs.' : '';

    const isStart = isCursorAtStartOfSentence();
    const pronounHeShe = isStart ? (isFemale ? 'She' : 'He') : (isFemale ? 'she' : 'he');
    const pronounHisHer = isStart ? (isFemale ? 'Her' : 'His') : (isFemale ? 'her' : 'his');
    const pronounHimHer = isStart ? (isFemale ? 'Her' : 'Him') : (isFemale ? 'her' : 'him');
    const pronounSonDaughter = isStart ? (isFemale ? 'Daughter' : 'Son') : (isFemale ? 'daughter' : 'son');
    const pronounSonOfDaughterOf = isStart ? (isFemale ? 'Daughter of' : 'Son of') : (isFemale ? 'daughter of' : 'son of');
    const pronounHimselfHerself = isStart ? (isFemale ? 'Herself' : 'Himself') : (isFemale ? 'herself' : 'himself');

    // Direct token mapping
    const tokenMap = {
      '{STUDENT_NAME}': studentName || '',
      '{FATHER_NAME}': fatherName || '',
      '{MOTHER_NAME}': motherName || '',
      '{CLASS}': className || '11th',
      '{STREAM}': stream || 'Medical',
      '{ROLL_NO}': rollNo || '',
      '{REG_NO}': regNo || '',
      '{DOB_FIGURES}': parsedDob?.figures || '',
      '{DOB_WORDS}': parsedDob?.words || '',
      '{SESSION}': session || '2025-26',
      '{ADDRESS}': address || '',
      '{VILLAGE}': locality.village,
      '{TEHSIL}': locality.tehsil,
      '{DISTRICT}': locality.district,
      '{REF_NO}': refNo || '',
      '{DATE}': dateStr || new Date().toLocaleDateString('en-GB'),
      '{GENDER_TITLE}': studentTitle,
      '{TITLE}': studentTitle,
      '{TITLE_YOUNG}': studentTitleYoung,
      '{FATHER_TITLE}': fatherTitle,
      '{MOTHER_TITLE}': motherTitle,
      '{GENDER}': isFemale ? 'Female' : 'Male',
      '{PRONOUN_SON_DAUGHTER}': pronounSonDaughter,
      '{PRONOUN_Son_Daughter}': isFemale ? 'Daughter' : 'Son',
      '{PRONOUN_SON_DAUGHTER_CAP}': isFemale ? 'Daughter' : 'Son',
      '{PRONOUN_SON_DAUGHTER_LOW}': isFemale ? 'daughter' : 'son',
      '{SON_DAUGHTER}': pronounSonDaughter,
      '{SON_DAUGHTER_CAP}': isFemale ? 'Daughter' : 'Son',
      '{SON_DAUGHTER_LOW}': isFemale ? 'daughter' : 'son',
      '{PRONOUN_SO_DO}': isFemale ? 'D/o' : 'S/o',
      '{SO_DO}': isFemale ? 'D/o' : 'S/o',
      '{S_O_D_O}': isFemale ? 'D/o' : 'S/o',
      '{PRONOUN_SON_OF_DAUGHTER_OF}': pronounSonOfDaughterOf,
      '{PRONOUN_Son_Of_Daughter_Of}': isFemale ? 'Daughter of' : 'Son of',
      '{SON_OF_DAUGHTER_OF}': pronounSonOfDaughterOf,
      '{PRONOUN_HE_SHE}': pronounHeShe,
      '{PRONOUN_he_she}': isFemale ? 'she' : 'he',
      '{PRONOUN_HE_SHE_CAP}': isFemale ? 'She' : 'He',
      '{PRONOUN_HE_SHE_LOW}': isFemale ? 'she' : 'he',
      '{HE_SHE}': pronounHeShe,
      '{he_she}': isFemale ? 'she' : 'he',
      '{HE_SHE_CAP}': isFemale ? 'She' : 'He',
      '{HE_SHE_LOW}': isFemale ? 'she' : 'he',
      '{PRONOUN_HIS_HER}': pronounHisHer,
      '{PRONOUN_his_her}': isFemale ? 'her' : 'his',
      '{PRONOUN_HIS_HER_CAP}': isFemale ? 'Her' : 'His',
      '{PRONOUN_HIS_HER_LOW}': isFemale ? 'her' : 'his',
      '{HIS_HER}': pronounHisHer,
      '{his_her}': isFemale ? 'her' : 'his',
      '{HIS_HER_CAP}': isFemale ? 'Her' : 'His',
      '{HIS_HER_LOW}': isFemale ? 'her' : 'his',
      '{PRONOUN_HIM_HER}': pronounHimHer,
      '{PRONOUN_him_her}': isFemale ? 'her' : 'him',
      '{PRONOUN_HIM_HER_CAP}': isFemale ? 'Her' : 'Him',
      '{PRONOUN_HIM_HER_LOW}': isFemale ? 'her' : 'him',
      '{HIM_HER}': pronounHimHer,
      '{him_her}': isFemale ? 'her' : 'him',
      '{PRONOUN_HIMSELF_HERSELF}': pronounHimselfHerself,
      '{PRONOUN_himself_herself}': isFemale ? 'herself' : 'himself',
      // TC / DC tokens
      '{EXAM_NAME}': `Class ${className || '12th'} Examination`,
      '{EXAM_ROLL_NO}': effExamRoll || rollNo || '',
      '{EXAM_SESSION}': effExamMode || session || '',
      '{RESULT_STATUS}': effResultStatus || 'Qualified',
      '{DIVISION_DISTINCTION}': effDiv || 'Distinction',
      '{DIVISION}': effDiv || 'Distinction',
      '{DISTINCTION}': effDiv || 'Distinction',
      '{MARKS_OBTAINED}': effMarksObt || '',
      '{MAX_MARKS}': effMaxMarks || '500',
      '{REAPP_SUBJECTS}': effReappSubjects || '',
      '{REAPPEAR_SUBJECTS}': effReappSubjects || '',
      '{ADMISSION_DATE}': admissionDate || extractStudentAdmissionDate(raw) || '',
      '{ADMISSION_NO}': admissionNo || extractStudentAdmissionNumber(raw) || '',
      '{WITHDRAWAL_DATE}': effectiveWd,
      '{RESULT_DATE}': effectiveWd,
      '{CONDUCT_STATUS}': 'Satisfactory',
      '{CERTIFICATE_NO}': refNo || '',
      '{TC_DC_NO}': refNo || ''
    };

    if (tokenMap[str.toUpperCase()]) {
      return tokenMap[str.toUpperCase()];
    }

    if (tokenMap[str]) {
      return tokenMap[str];
    }

    // If it contains multiple tokens, interpolate cleanly
    if (str.includes('{') && str.includes('}')) {
      return interpolateCertificateTemplate(str, {
        studentName,
        fatherName,
        motherName,
        className,
        stream,
        rollNo,
        regNo,
        dobFigures: parsedDob?.figures || '',
        dobWords: parsedDob?.words || '',
        session,
        address,
        gender,
        refNo,
        date: dateStr,
        includeSalutations,
        customFields,
        examName: `Class ${className || '12th'} Examination`,
        examRollNo: effExamRoll,
        examSession: effExamMode,
        resultStatus: normalizeResultStatus(effResultStatus) === 'Passed' || selectedTemplateId.includes('qualified') ? 'Qualified' : (normalizeResultStatus(effResultStatus) === 'Reap' ? 'Re-appear' : (effResultStatus || 'Did Not Qualify')),
        divisionDistinction: effDiv,
        marksObtained: effMarksObt,
        maxMarks: effMaxMarks,
        reappSubjects: effReappSubjects,
        admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '',
        admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '',
        withdrawalDate: effectiveWd,
        conductStatus: 'Satisfactory',
        village: locality.village,
        tehsil: locality.tehsil,
        district: locality.district,
        certificateNo: refNo || extractStudentCertificateNumber(raw) || '',
        raw
      });
    }

    return str;
  };

  const handleInsertPlaceholder = (rawTokenOrText) => {
    if (!editorRef.current) return;
    const textToInsert = resolveTokenOrText(rawTokenOrText);
    pushSnapshot();
    editorRef.current.focus();

    const activeRange = savedRangeRef.current || savedRange;
    if (activeRange && window.getSelection) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(activeRange);
    }

    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, textToInsert);
    } catch (err) {
      console.warn('execCommand insertText error:', err);
    }

    if (!inserted) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(textToInsert);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRangeRef.current = range.cloneRange();
        setSavedRange(savedRangeRef.current);
      } else {
        const span = document.createElement('span');
        span.textContent = ` ${textToInsert}`;
        editorRef.current.appendChild(span);
      }
    } else {
      if (window.getSelection && window.getSelection().rangeCount > 0) {
        savedRangeRef.current = window.getSelection().getRangeAt(0).cloneRange();
        setSavedRange(savedRangeRef.current);
      }
    }

    // Auto-clean any un-interpolated curly bracket tokens that might have been typed or inserted
    if (editorRef.current.innerHTML.includes('{') && editorRef.current.innerHTML.includes('}')) {
      const raw = selectedStudent?.raw || selectedStudent || {};
      const resInfo = extractStudentResultMarks(raw);
      const effMarksObt = tcMarksObtained !== '' ? tcMarksObtained : (resInfo.marksObtained || '');
      const effMaxMarks = tcMaxMarks || resInfo.maxMarks || '500';
      const effDiv = tcDivision || resInfo.division || (effMarksObt ? calculateDivision(effMarksObt, effMaxMarks).division : '');
      const effExamRoll = tcExamRoll || resInfo.examRoll || rollNo || '';
      const effExamMode = tcExamMode || resInfo.examMode || session || '';
      const effResultStatus = tcResultStatus || resInfo.resultStatus || 'Awaiting Result';
      const effReappSubjects = tcReappSubjects || resInfo.reappSubjects || '';
      const isPassed = normalizeResultStatus(effResultStatus) === 'Passed';
      const effectiveWd = withdrawalDate || raw['Date of withdrawl'] || raw.withdrawalDate || raw['Result Date'] || raw.resultDate || toLocalDateKey();
      const locality = resolveStudentLocality(selectedStudent, raw, address);

      const cleanedHtml = interpolateCertificateTemplate(editorRef.current.innerHTML, {
        studentName,
        fatherName,
        motherName,
        className,
        stream,
        rollNo,
        regNo,
        dobFigures: parsedDob?.figures || '',
        dobWords: parsedDob?.words || '',
        session,
        address,
        gender,
        refNo,
        date: dateStr,
        includeSalutations,
        customFields,
        examName: `Class ${className || '12th'} Examination`,
        examRollNo: effExamRoll,
        examSession: effExamMode,
        resultStatus: isPassed || selectedTemplateId.includes('qualified') ? 'Qualified' : (normalizeResultStatus(effResultStatus) === 'Reap' ? 'Re-appear' : (effResultStatus || 'Did Not Qualify')),
        divisionDistinction: effDiv,
        marksObtained: effMarksObt,
        maxMarks: effMaxMarks,
        reappSubjects: effReappSubjects,
        admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '',
        admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '',
        withdrawalDate: effectiveWd,
        conductStatus: 'Satisfactory',
        village: locality.village,
        tehsil: locality.tehsil,
        district: locality.district,
        certificateNo: refNo || extractStudentCertificateNumber(raw) || '',
        raw
      });
      if (cleanedHtml !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = cleanedHtml;
      }
    }

    setCustomCanvasHtml(editorRef.current.innerHTML);
    const retokenized = retokenizeCertificateBody(editorRef.current.innerHTML, buildRetokenizeContext());
    setTemplateBody(retokenized);
    setTimeout(pushSnapshot, 50);
    setShowContextMenu(false);
    setShowInsertFieldDropdown(false);
  };

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // ─── Cloud History Save Handler ───
  const handleSaveToCloud = async () => {
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : activeDisplayHtml;
    const effectivePhoto = studentPhotoUrl || (selectedStudent ? resolveStudentPhoto(selectedStudent.raw || selectedStudent) : null);
    const raw = selectedStudent?.raw || selectedStudent || {};
    const metaDetails = {
      formNo: extractFormNo(raw),
      certificateNo: refNo || extractStudentCertificateNumber(raw) || '—',
      admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '—',
      admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '—',
      regNo: regNo || '—'
    };

    try {
      await saveGeneratedDocToHistory({
        docType: isTcDcActive ? 'discharge' : 'bonafide',
        title: certificateTitle || (isTcDcActive ? 'Discharge / Transfer Certificate' : 'Bonafide Certificate'),
        refNo: refNo || '',
        dateStr: dateStr || new Date().toLocaleDateString('en-GB'),
        recipientOrStudent: studentName || 'Student',
        studentDetails: {
          name: studentName,
          father: fatherName,
          mother: motherName,
          cls: className,
          stream,
          rollNo,
          regNo,
          dob: dobRaw,
          session,
          gender,
          address,
          admissionNo: metaDetails.admissionNo,
          admissionDate: metaDetails.admissionDate,
          certificateNo: metaDetails.certificateNo
        },
        bodyHtml: currentHtml,
        actionType: 'Saved to Cloud',
        templateId: selectedTemplateId,
        templateName: allTemplatesList.find(t => t.id === selectedTemplateId)?.name || 'Custom Certificate',
        extraData: {
          officeTitle,
          institutionName,
          institutionAddress,
          studentPhotoUrl: effectivePhoto,
          showPhoto,
          watermark,
          signatories,
          isDualCopy: isDualCopy && isTcDcActive,
          metaDetails,
          pageMargin,
          headerGap,
          titleMetaGap,
          metaBodyGap,
          paraSpacing,
          bodyLineHeight,
          baseFontSize,
          bodyDateGap,
          dateSigGap,
          sigReceiptGap
        }
      });

      // Record in per-app memory (max 3)
      recordApplicationPrint(
        selectedStudent || { refNo, studentName, className },
        isTcDcActive ? 'Discharge / Transfer Certificate' : (certificateTitle || 'Bonafide Certificate'),
        'Saved to Cloud',
        { refNo, studentName, className, fatherName }
      );

      showToast('✓ Certificate successfully archived in Cloud History!', 'success');
    } catch (err) {
      console.error('History save error:', err);
      showToast(`Could not save document to cloud history: ${err.message}`, 'error');
    }
  };

  // ─── Load Draft from History Handler ───
  const handleLoadDraftFromHistory = (rec) => {
    if (!rec) return;
    if (rec.title) setCertificateTitle(rec.title);
    if (rec.refNo) setRefNo(rec.refNo);
    if (rec.dateStr) setDateStr(rec.dateStr);
    if (rec.templateId) setSelectedTemplateId(rec.templateId);

    if (rec.studentDetails) {
      if (rec.studentDetails.name) setStudentName(rec.studentDetails.name);
      if (rec.studentDetails.father) setFatherName(rec.studentDetails.father);
      if (rec.studentDetails.mother) setMotherName(rec.studentDetails.mother);
      if (rec.studentDetails.cls) setClassName(rec.studentDetails.cls);
      if (rec.studentDetails.stream) setStream(rec.studentDetails.stream);
      if (rec.studentDetails.rollNo) setRollNo(rec.studentDetails.rollNo);
      if (rec.studentDetails.regNo) setRegNo(rec.studentDetails.regNo);
      if (rec.studentDetails.dob) setDobRaw(rec.studentDetails.dob);
      if (rec.studentDetails.session) setSession(rec.studentDetails.session);
      if (rec.studentDetails.gender) setGender(rec.studentDetails.gender);
      if (rec.studentDetails.address) setAddress(rec.studentDetails.address);
      if (rec.studentDetails.admissionDate) setAdmissionDate(rec.studentDetails.admissionDate);
      if (rec.studentDetails.admissionNo) setAdmissionNo(rec.studentDetails.admissionNo);
    }
    if (rec.extraData?.metaDetails) {
      if (rec.extraData.metaDetails.admissionDate) setAdmissionDate(rec.extraData.metaDetails.admissionDate);
      if (rec.extraData.metaDetails.admissionNo) setAdmissionNo(rec.extraData.metaDetails.admissionNo);
      if (rec.extraData.metaDetails.certificateNo) setRefNo(rec.extraData.metaDetails.certificateNo);
      if (rec.extraData.metaDetails.regNo) setRegNo(rec.extraData.metaDetails.regNo);
    }
    if (rec.extraData?.officeTitle) setOfficeTitle(rec.extraData.officeTitle);
    if (rec.extraData?.institutionName) setInstitutionName(rec.extraData.institutionName);
    if (rec.extraData?.institutionAddress) setInstitutionAddress(rec.extraData.institutionAddress);
    if (Array.isArray(rec.extraData?.signatories)) {
      if (rec.extraData.signatories[0]) setSignatoryLeft(rec.extraData.signatories[0]);
      if (rec.extraData.signatories.length === 2) {
        if (rec.extraData.signatories[1]) setSignatoryRight(rec.extraData.signatories[1]);
      } else if (rec.extraData.signatories.length >= 3) {
        if (rec.extraData.signatories[1]) setSignatoryCenter(rec.extraData.signatories[1]);
        if (rec.extraData.signatories[2]) setSignatoryRight(rec.extraData.signatories[2]);
      }
    }
    if (rec.extraData?.isDualCopy !== undefined) setIsDualCopy(rec.extraData.isDualCopy);
    if (rec.extraData?.pageMargin !== undefined) setPageMargin(rec.extraData.pageMargin);
    if (rec.extraData?.headerGap !== undefined) setHeaderGap(rec.extraData.headerGap);
    if (rec.extraData?.metaBodyGap !== undefined) setMetaBodyGap(rec.extraData.metaBodyGap);
    if (rec.extraData?.paraSpacing !== undefined) setParaSpacing(rec.extraData.paraSpacing);
    if (rec.extraData?.bodyLineHeight !== undefined) setBodyLineHeight(rec.extraData.bodyLineHeight);
    if (rec.extraData?.baseFontSize !== undefined) setBaseFontSize(rec.extraData.baseFontSize);
    if (rec.extraData?.studentPhotoUrl) {
      setStudentPhotoUrl(rec.extraData.studentPhotoUrl);
    }
    if (rec.extraData?.showPhoto !== undefined) {
      setShowPhoto(rec.extraData.showPhoto);
    }
    if (rec.bodyHtml) {
      setCustomCanvasHtml(rec.bodyHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = rec.bodyHtml;
      }
    }
    showToast('Certificate draft loaded from history archive.', 'info');
  };

  // ─── Gemini AI Handlers ───
  const handleOpenAiModal = (mode = 'draft') => {
    setAiMode(mode);
    setAiGeneratedHtml('');
    setAiError('');
    setAiSuccessKeyIndex(null);
    if (mode === 'humanize' || mode === 'formalize' || mode === 'shorten') {
      setAiPrompt('');
    }
    const currentKeys = getStoredGeminiKeys();
    setGeminiKeys(currentKeys);
    setKeysInputText(currentKeys.join('\n'));
    setShowAiModal(true);
  };

  const handleSaveKeys = async () => {
    const rawList = keysInputText.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    const cleaned = Array.from(new Set(rawList));
    setGeminiKeys(cleaned);
    await saveCloudGeminiKeys(cleaned);
    savePreferredGeminiModel(aiModel);
    setShowKeysConfig(false);
    showToast(`✓ Saved ${cleaned.length} Gemini API Key(s) to Cloud Firebase & LocalStorage!`, 'success');
  };

  const handleGenerateAi = async () => {
    setIsGeneratingAi(true);
    setAiError('');
    setAiGeneratedHtml('');
    setAiSuccessKeyIndex(null);

    try {
      const currentContent = editorRef.current ? editorRef.current.innerHTML : activeDisplayHtml;
      const result = await generateCertificateWithGemini({
        prompt: aiPrompt,
        currentContent,
        certificateTitle,
        studentDetails: {
          name: studentName,
          father: fatherName,
          mother: motherName,
          cls: className,
          stream,
          rollNo,
          regNo,
          dob: dobRaw,
          dobWords: parsedDob.words,
          session,
          address,
          gender
        },
        mode: aiMode,
        tone: aiTone,
        model: aiModel
      });

      setAiGeneratedHtml(sanitizeRichHtml(result.html));
      setAiSuccessKeyIndex(result.usedKeyIndex);
      savePreferredGeminiModel(aiModel);
    } catch (err) {
      console.error(err);
      setAiError(err.message || 'Failed to generate certificate with Gemini AI.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyAiContent = (action = 'replace') => {
    if (!aiGeneratedHtml) return;
    pushSnapshot();
    const safeAiHtml = sanitizeRichHtml(aiGeneratedHtml);

    if (action === 'replace') {
      setCustomCanvasHtml(safeAiHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = safeAiHtml;
      }
    } else if (action === 'append') {
      const current = editorRef.current ? editorRef.current.innerHTML : activeDisplayHtml;
      const merged = `${current}<br/>${safeAiHtml}`;
      setCustomCanvasHtml(merged);
      if (editorRef.current) {
        editorRef.current.innerHTML = merged;
      }
    } else if (action === 'insert') {
      executeFormat('insertHTML', safeAiHtml);
    }

    setTimeout(pushSnapshot, 50);
    showToast('✨ AI-generated certificate content applied to canvas!', 'success');
    setShowAiModal(false);
  };

  const ensureTcDcCertificateIssued = async () => {
    if (!isTcDcActive) return refNo;
    if (!selectedStudent) {
      showToast('Select a student before issuing a TC/DC certificate.', 'warning');
      return '';
    }

    const raw = selectedStudent.raw || selectedStudent;
    const existingSerial = extractCertificateSerial(extractStudentCertificateNumber(raw));
    if (existingSerial) {
      if (String(refNo) !== existingSerial) setRefNo(existingSerial);
      return existingSerial;
    }

    const formNo = extractFormNo(raw);
    const selectedIdentity = raw._docId || raw.docId || raw.id || formNo || ((raw._parentDocId && regNo) ? regNo : '');
    if (!selectedIdentity || selectedIdentity === '—') {
      showToast('This student has no document, form, or registration identifier. TC/DC issuance was stopped.', 'error');
      return '';
    }

    let serial = existingSerial;
    if (!serial) {
      const lastIssued = await fetchLastIssuedCertificateNumber();
      serial = String(lastIssued + 1);
    }

    setIsIssuingTcDc(true);
    try {
      await commitIssuedCertificateBatch([{
        student: selectedStudent,
        formNo: formNo && formNo !== '—' ? formNo : '',
        certNo: serial
      }], dateStr);
      const issueDate = dateStr || new Date().toLocaleDateString('en-GB');
      const issuedPatch = {
        ccDcNo: serial,
        certificateNo: serial,
        'No. & Date of CC/DC Issued (This Institution)': `${serial} (${issueDate})`,
        dischargeCertStatus: 'Issued'
      };
      setSelectedStudent(previous => previous ? {
        ...previous,
        certificateNo: serial,
        raw: { ...(previous.raw || previous), ...issuedPatch }
      } : previous);
      setRefNo(serial);
      setCustomCanvasHtml(null);
      showToast(`TC/DC certificate #${serial} assigned and locked.`, 'success');
      return serial;
    } finally {
      setIsIssuingTcDc(false);
    }
  };

  // ─── Export Handlers ───
  const handlePrint = async () => {
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : activeDisplayHtml;
    const effectivePhoto = studentPhotoUrl || (selectedStudent ? resolveStudentPhoto(selectedStudent.raw || selectedStudent) : null);
    const activeTpl = allTemplatesList.find(t => t.id === selectedTemplateId);
    const isTcDcActive = Boolean(activeTpl?.isTcDc || selectedTemplateId?.startsWith('tc_dc_'));
    let effectiveRefNo = refNo;
    if (isTcDcActive) {
      try {
        effectiveRefNo = await ensureTcDcCertificateIssued();
      } catch (error) {
        showToast(error.message || 'TC/DC certificate number could not be assigned.', 'error');
        return;
      }
      if (!effectiveRefNo) return;
    }

    if (!isTcDcActive) {
      try {
        await registerIssuedDocument(selectedStudent, effectiveRefNo, certificateTitle, 'issue', { session, className, stream });
      } catch (error) {
        console.warn('Certificate registration notice:', error.message || error);
      }
      advanceGeneralRefNumber(effectiveRefNo).catch(() => {});
    }
    const raw = selectedStudent?.raw || selectedStudent || {};
    const metaDetails = {
      formNo: extractFormNo(raw),
      certificateNo: effectiveRefNo || extractStudentCertificateNumber(raw) || '—',
      admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '—',
      admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '—',
      regNo: regNo || '—',
      rollNo: rollNo || selectedStudent?.classRollNo || selectedStudent?.rollNo || getStudentRollVal(selectedStudent) || '',
      name: studentName,
      studentName: studentName,
      fatherName: fatherName,
      motherName: motherName,
      className: className,
      session: session,
      stream: stream
    };

    // Auto-record print in per-app memory (max 3)
    recordApplicationPrint(
      selectedStudent || metaDetails,
      isTcDcActive ? 'Discharge / Transfer Certificate' : (certificateTitle || 'Bonafide Certificate'),
      'Printed / Saved PDF',
      { refNo: effectiveRefNo, studentName, className, fatherName }
    );

    logAdminActivity({
      actionType: 'export',
      actionTitle: isTcDcActive ? 'Issued Discharge / Transfer Certificate' : 'Issued Student Certificate',
      details: `Issued ${isTcDcActive ? 'TC/DC' : (certificateTitle || 'Certificate')} for ${studentName || 'Student'} (Ref: ${effectiveRefNo || 'N/A'}, Class: ${className || 'N/A'})`,
      metadata: { refNo: effectiveRefNo, studentName, className, fatherName, isTcDc: isTcDcActive }
    });

    // Auto-archive in Document History & Cloud Archive
    saveGeneratedDocToHistory({
      docType: isTcDcActive ? 'discharge' : 'bonafide',
      title: certificateTitle || (isTcDcActive ? 'Discharge / Transfer Certificate' : 'Bonafide Certificate'),
      refNo: effectiveRefNo || '',
      dateStr: dateStr || new Date().toLocaleDateString('en-GB'),
      recipientOrStudent: studentName || 'Student',
      studentDetails: {
        name: studentName,
        father: fatherName,
        mother: motherName,
        cls: className,
        stream,
        rollNo,
        regNo,
        dob: dobRaw,
        session,
        gender,
        address,
        admissionNo: metaDetails.admissionNo,
        admissionDate: metaDetails.admissionDate,
        certificateNo: metaDetails.certificateNo
      },
      bodyHtml: currentHtml,
      actionType: 'Printed / Saved PDF',
      templateId: selectedTemplateId,
      templateName: allTemplatesList.find(t => t.id === selectedTemplateId)?.name || 'Certificate',
      extraData: {
        officeTitle,
        institutionName,
        institutionAddress,
        studentPhotoUrl: effectivePhoto,
        showPhoto,
        watermark,
        signatories,
        isDualCopy: isDualCopy && isTcDcActive,
        metaDetails,
        pageMargin,
        headerGap,
        titleMetaGap,
        metaBodyGap,
        paraSpacing,
        bodyLineHeight,
        baseFontSize,
        bodyDateGap,
        dateSigGap,
        sigReceiptGap
      }
    }).catch(err => console.warn('Auto-save history on print error:', err));

    showToast('🖨️ Opening print dialog / PDF preview...', 'info', 2500);
    printStudentCertificate({
      officeTitle,
      institutionName,
      institutionAddress,
      certificateTitle,
      refNo: effectiveRefNo,
      dateStr,
      bodyHtml: currentHtml,
      studentPhotoUrl: effectivePhoto,
      showPhoto,
      watermark,
      signatories,
      signatorySubtext: signatorySubtext || institutionName || 'Govt. HSS Shangus',
      isDualCopy: isDualCopy && isTcDcActive,
      metaDetails,
      pageMargin,
      headerGap,
      titleMetaGap,
      metaBodyGap,
      paraSpacing,
      bodyLineHeight,
      baseFontSize,
      bodyDateGap,
      dateSigGap,
      sigReceiptGap
    });
  };

  const handlePrintRef = useRef(handlePrint);
  useEffect(() => {
    handlePrintRef.current = handlePrint;
  });

  // Intercept Ctrl+P / Cmd+P to trigger clean, isolated document print/PDF instead of browser window print
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        handlePrintRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : activeDisplayHtml;
    const effectivePhoto = studentPhotoUrl || (selectedStudent ? resolveStudentPhoto(selectedStudent.raw || selectedStudent) : null);
    const activeTpl = allTemplatesList.find(t => t.id === selectedTemplateId);
    const isTcDcActive = Boolean(activeTpl?.isTcDc || selectedTemplateId?.startsWith('tc_dc_'));
    let effectiveRefNo = refNo;
    if (isTcDcActive) {
      try {
        effectiveRefNo = await ensureTcDcCertificateIssued();
      } catch (error) {
        showToast(error.message || 'TC/DC certificate number could not be assigned.', 'error');
        setIsExportingDocx(false);
        return;
      }
      if (!effectiveRefNo) {
        setIsExportingDocx(false);
        return;
      }
    }

    if (!isTcDcActive) {
      try {
        await registerIssuedDocument(selectedStudent, effectiveRefNo, certificateTitle, 'issue', { session, className, stream });
      } catch (error) {
        console.warn('Certificate registration notice:', error.message || error);
      }
      advanceGeneralRefNumber(effectiveRefNo).catch(() => {});
    }
    const raw = selectedStudent?.raw || selectedStudent || {};
    const metaDetails = {
      formNo: extractFormNo(raw),
      certificateNo: effectiveRefNo || extractStudentCertificateNumber(raw) || '—',
      admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '—',
      admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '—',
      regNo: regNo || '—',
      rollNo: rollNo || selectedStudent?.classRollNo || selectedStudent?.rollNo || getStudentRollVal(selectedStudent) || '',
      name: studentName,
      studentName: studentName,
      fatherName: fatherName,
      motherName: motherName,
      className: className,
      session: session,
      stream: stream
    };

    // Auto-record in per-app memory (max 3)
    recordApplicationPrint(
      selectedStudent || metaDetails,
      isTcDcActive ? 'Discharge / Transfer Certificate' : (certificateTitle || 'Bonafide Certificate'),
      'Downloaded (.docx)',
      { refNo: effectiveRefNo, studentName, className, fatherName }
    );

    // Auto-archive in Document History & Cloud Archive
    saveGeneratedDocToHistory({
      docType: isTcDcActive ? 'discharge' : 'bonafide',
      title: certificateTitle || (isTcDcActive ? 'Discharge / Transfer Certificate' : 'Bonafide Certificate'),
      refNo: effectiveRefNo || '',
      dateStr: dateStr || new Date().toLocaleDateString('en-GB'),
      recipientOrStudent: studentName || 'Student',
      studentDetails: {
        name: studentName,
        father: fatherName,
        mother: motherName,
        cls: className,
        stream,
        rollNo,
        regNo,
        dob: dobRaw,
        session,
        gender,
        address,
        admissionNo: metaDetails.admissionNo,
        admissionDate: metaDetails.admissionDate,
        certificateNo: metaDetails.certificateNo
      },
      bodyHtml: currentHtml,
      actionType: 'Downloaded (.docx)',
      templateId: selectedTemplateId,
      templateName: allTemplatesList.find(t => t.id === selectedTemplateId)?.name || 'Certificate',
      extraData: {
        officeTitle,
        institutionName,
        institutionAddress,
        studentPhotoUrl: effectivePhoto,
        showPhoto,
        watermark,
        signatories,
        isDualCopy: isDualCopy && isTcDcActive,
        metaDetails,
        pageMargin,
        headerGap,
        titleMetaGap,
        metaBodyGap,
        paraSpacing,
        bodyLineHeight,
        bodyDateGap,
        dateSigGap,
        sigReceiptGap
      }
    }).catch(err => console.warn('Auto-save history on docx error:', err));

    try {
      await generateStudentCertificateDocx({
        officeTitle,
        institutionName,
        institutionAddress,
        certificateTitle,
        refNo: effectiveRefNo,
        dateStr,
        bodyHtml: currentHtml,
        signatories,
        signatorySubtext: signatorySubtext || institutionName || 'Govt. HSS Shangus',
        isDualCopy: isDualCopy && isTcDcActive,
        metaDetails
      });

      showToast('📥 Word document (.docx) successfully exported!', 'success');
    } catch (err) {
      console.error('Docx export error:', err);
      showToast('Could not generate Word document.', 'error');
    } finally {
      setIsExportingDocx(false);
    }
  };

  if (!isReady) {
    return (
      <TabLoadingOverlay
        moduleKey="certStudio"
        message="Initializing Student Certificates Studio and indexing records..."
      />
    );
  }

  // ─── Student & Certificate Template Selector Palette ───
  const renderStudentAndTemplateSelector = () => (
    <div className="space-y-2.5 text-xs">
      {/* STUDENT AUTO-COMPLETE SEARCH BAR & COHORT FILTERS */}
          <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-slate-800 relative shrink-0">
            <div className="flex items-center justify-between text-[9px] uppercase font-black tracking-wider text-slate-500">
              <span className="flex items-center gap-1">
                <Search size={10} className="text-teal-600 dark:text-teal-400" />
                <span>Search & Select Student</span>
              </span>
              <span className="text-[9px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                {isLoadingStudents && <RefreshCw size={9} className="animate-spin text-teal-600" />}
                <span>{unifiedStudentDirectory.length} Indexed</span>
              </span>
            </div>

            {/* Quick Cohort & Session Filter Dropdowns (Checkbox Style) */}
            <div className="space-y-1 pb-0.5 text-[9.5px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {/* Cohort / Class Multi-Select Filter */}
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-[8.5px] uppercase tracking-wider shrink-0">Class:</span>
                  <StudioMultiSelectDropdown
                    label="Classes"
                    options={classOptions}
                    selected={selectedClasses}
                    onChange={handleClassFilterChange}
                    align="left"
                  />
                </div>

                {/* Session Multi-Select Filter */}
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-[8.5px] uppercase tracking-wider shrink-0">Session:</span>
                  <StudioMultiSelectDropdown
                    label="Sessions"
                    options={sessionOptions}
                    selected={selectedSessions}
                    onChange={handleSessionFilterChange}
                    align="right"
                  />
                </div>
              </div>

              {/* TC/DC Specific Tools (Result Hub & Bulk Generator) - Shown ONLY when TC/DC template is selected */}
              {isTcDcActive && (
                <div className="flex items-center justify-end gap-1 shrink-0 animate-fadeIn pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowResultIngestionModal(true)}
                    className="px-2 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-[9px] flex items-center gap-1 cursor-pointer shadow-2xs shrink-0 transition-all active:scale-95"
                    title="Open JKBOSE Exam Result Ingestion Hub (Excel / AI PDF Gazette)"
                  >
                    <Sparkles size={10} />
                    <span>Result Hub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBulkGeneratorModal(true)}
                    className="px-2 py-1 rounded-lg bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white font-extrabold text-[9px] flex items-center gap-1 cursor-pointer shadow-2xs shrink-0 transition-all active:scale-95"
                    title="Open Bulk TC / Discharge Certificate Hub (Batch Print 2-Page copies)"
                  >
                    <FileSpreadsheet size={10} />
                    <span>Bulk TC</span>
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                aria-label="Search students by name, roll number, registration number, father, or mobile"
                aria-expanded={isSearchDropdownOpen}
                aria-controls="certificate-student-results"
                role="combobox"
                value={studentSearchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onKeyDown={handleKeyDownOnSearch}
                onChange={(e) => {
                  setStudentSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                placeholder="Search by Name, Roll No, Reg No, Father, Mobile..."
                className="w-full pl-7 pr-7 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/40 dark:bg-teal-950/30 font-bold text-[10px] sm:text-xs shadow-2xs focus:ring-1 focus:ring-teal-500 focus:outline-none placeholder:text-[9.5px] sm:placeholder:text-xs placeholder:text-slate-400"
              />
              <Search size={12} className="absolute left-2 top-2.5 text-teal-600 dark:text-teal-400" />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearchQuery('');
                    setIsSearchDropdownOpen(false);
                  }}
                  aria-label="Clear student search"
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Active Selected Student Badge (Quick Preview & Quick Actions) */}
            {selectedStudent && (
              <div className="space-y-1.5 animate-fadeIn">
                <div className="p-2 rounded-xl bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200/90 dark:border-teal-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {studentPhotoUrl ? (
                      <img src={studentPhotoUrl} alt={studentName} className="w-7 h-7 rounded-full object-cover border border-teal-300 shrink-0 shadow-2xs" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs">
                        {studentName ? studentName.charAt(0) : 'S'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-black text-[11px] text-teal-950 dark:text-teal-200 truncate flex items-center gap-1">
                        <span className="truncate">{studentName}</span>
                        <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-teal-200/70 dark:bg-teal-900 text-teal-900 dark:text-teal-200 font-bold shrink-0">
                          {className} ({stream})
                        </span>
                      </div>
                      <div className="text-[9px] text-teal-800 dark:text-teal-400 truncate">
                        {fatherName && <span>F: <strong>{fatherName}</strong> | </span>}
                        <span>Roll: <strong>{rollNo}</strong> | Reg: <strong>{regNo}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowResultEditorModal(true)}
                      className="px-1.5 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 hover:bg-indigo-200 text-indigo-800 dark:text-indigo-200 font-bold text-[9px] cursor-pointer flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
                      title="Edit JKBOSE Exam Result, Marks, Re-appear, and TC Details"
                    >
                      <Award size={10} />
                      <span>Result/TC</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowFieldManagerModal(true)}
                      className="px-1.5 py-0.5 rounded-lg bg-teal-100/80 dark:bg-teal-900/60 hover:bg-teal-200 text-teal-800 dark:text-teal-200 font-bold text-[9px] cursor-pointer flex items-center gap-1"
                      title="Edit or override student details"
                    >
                      <Edit3 size={10} />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        selectionRequestRef.current += 1;
                        setSelectedStudent(null);
                        setPreviewedStudentId(null);
                        setStudentPhotoUrl(null);
                        setStudentSearchQuery('');
                      }}
                      aria-label="Clear selected student"
                      className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Clear selected student"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* Quick Inline Result, Marks, Division & Withdrawal Date when TC/DC is Active */}
                {isTcDcActive && (
                  <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 space-y-2 animate-fadeIn shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10.5px] font-black text-amber-950 dark:text-amber-200">
                        <Award size={12} className="text-amber-600 dark:text-amber-400" />
                        <span>JKBOSE Result & Marks Data:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowResultEditorModal(true)}
                        className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <Edit3 size={9} />
                        <span>Full Editor</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div>
                        <label className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Exam Roll No</label>
                        <input
                          type="text"
                          value={tcExamRoll}
                          onChange={(e) => {
                            setTcExamRoll(e.target.value);
                            setCustomCanvasHtml(null);
                          }}
                          placeholder="e.g. 301003053"
                          className="w-full px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold text-[11px] outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Status</label>
                        <select
                          value={tcResultStatus}
                          onChange={(e) => {
                            const nextStatus = e.target.value;
                            setTcResultStatus(nextStatus);
                            setCustomCanvasHtml(null);
                            const isPass = nextStatus === 'Passed';
                            const targetId = isPass ? 'tc_dc_qualified' : 'tc_dc_reappear';
                            const foundTpl = BUILTIN_CERTIFICATE_TEMPLATES.find(t => t.id === targetId);
                            if (foundTpl) {
                              setSelectedTemplateId(foundTpl.id);
                              setTemplateBody(foundTpl.bodyHtml);
                            }
                          }}
                          className="w-full px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-[11px] outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="Passed">Passed (Qualified)</option>
                          <option value="Reap">Re-appear</option>
                          <option value="Did Not Qualify">Did Not Qualify</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Marks Obtained / Max</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={tcMarksObtained}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTcMarksObtained(val);
                              setCustomCanvasHtml(null);
                              if (val && /^\d+$/.test(val)) {
                                const auto = calculateDivision(val, tcMaxMarks || '500');
                                if (auto?.division) setTcDivision(auto.division);
                              }
                            }}
                            placeholder="e.g. 488"
                            className="w-1/2 px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-black text-[11px] outline-none text-center focus:ring-1 focus:ring-amber-500"
                          />
                          <span className="text-slate-400 font-bold text-xs">/</span>
                          <input
                            type="text"
                            value={tcMaxMarks}
                            onChange={(e) => {
                              setTcMaxMarks(e.target.value);
                              setCustomCanvasHtml(null);
                            }}
                            placeholder="500"
                            className="w-1/2 px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold text-[11px] outline-none text-center focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Division</label>
                        <input
                          type="text"
                          value={tcDivision}
                          onChange={(e) => {
                            setTcDivision(e.target.value);
                            setCustomCanvasHtml(null);
                          }}
                          placeholder="e.g. Distinction"
                          className="w-full px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-[11px] outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-amber-200/80 dark:border-amber-900/60">
                      <div>
                        <label className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Admission No.</label>
                        <input
                          type="text"
                          value={admissionNo}
                          onChange={(e) => {
                            setAdmissionNo(e.target.value);
                            setCustomCanvasHtml(null);
                          }}
                          placeholder="e.g. 1101"
                          className="w-full px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold text-[11px] outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Date of Admission</label>
                        <input
                          type="text"
                          value={admissionDate}
                          onChange={(e) => {
                            setAdmissionDate(e.target.value);
                            setCustomCanvasHtml(null);
                          }}
                          placeholder="DD-MM-YYYY"
                          className="w-full px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-[11px] outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>

<div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-amber-200/80 dark:border-amber-900/60">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 block">Certificate / TC-DC No.</label>
                          {selectedStudent && (refNo || extractStudentCertificateNumber(selectedStudent.raw || selectedStudent)) && (
                            <button
                              type="button"
                              onClick={handleRevokeStudentCertificateNumber}
                              disabled={isRevokingSingleCert}
                              title="Revoke & Release Certificate Number from this student"
                              className="text-[8.5px] font-black text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
                            >
                              <Unlock size={8} />
                              <span>{isRevokingSingleCert ? 'Revoking...' : 'Revoke'}</span>
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={refNo}
                          onChange={(e) => {
                            setRefNo(e.target.value);
                            setCustomCanvasHtml(null);
                          }}
                          placeholder="Enter issued certificate number"
                          className="w-full px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold text-[11px] outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Gender for Certificate Pronouns</label>
                        <select
                          value={gender}
                          onChange={(e) => {
                            setGender(e.target.value);
                            setCustomCanvasHtml(null);
                          }}
                          className="w-full px-1.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-[11px] outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="">Select gender</option>
                          <option value="F">Female — D/o, Her</option>
                          <option value="M">Male — S/o, His</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-200/80 dark:border-amber-900/60">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-300">
                        <Calendar size={11} className="text-amber-600" />
                        <span>Withdrawal Date:</span>
                      </div>
                      <input
                        type="text"
                        value={withdrawalDate}
                        onChange={(e) => {
                          setWithdrawalDate(e.target.value);
                          setCustomCanvasHtml(null);
                        }}
                        placeholder="DD-MM-YYYY or YYYY-MM-DD"
                        className="px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-[11px] w-32 focus:ring-1 focus:ring-amber-500 outline-none text-center"
                        title="Enter Withdrawal / Result Date"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dropdown Auto-Complete Results with Realtime Live Preview on Scroll & Hover */}
            {isSearchDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-teal-300/80 dark:border-teal-700/80 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                {/* Realtime Live Preview Controls Toolbar */}
                <div className="px-2.5 py-1.5 bg-slate-100/90 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-1 text-[10px] select-none">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsLivePreviewEnabled(v => !v)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold text-[9.5px] cursor-pointer transition-all ${
                        isLivePreviewEnabled
                          ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-500/50'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                      }`}
                      title="Auto-preview student certificate in real-time when scrolling or hovering"
                    >
                      <Zap size={10} className={isLivePreviewEnabled ? 'fill-current' : ''} />
                      <span>{isLivePreviewEnabled ? 'Live Preview ON' : 'Live Preview OFF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsDropdownPinned(v => !v)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[9.5px] cursor-pointer transition-all ${
                        isDropdownPinned
                          ? 'bg-indigo-600 text-white shadow-2xs ring-1 ring-indigo-500/50'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                      }`}
                      title={isDropdownPinned ? 'List is pinned open (will not close on selection)' : 'Pin list open while reviewing certificates'}
                    >
                      {isDropdownPinned ? <PinOff size={10} /> : <Pin size={10} />}
                      <span>{isDropdownPinned ? 'Pinned Open' : 'Pin List'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-slate-500 dark:text-slate-400 font-semibold text-[9px]">
                    <span className="hidden sm:inline font-mono text-[8.5px] px-1 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">↑ / ↓ Keys</span>
                    <span className="font-bold text-teal-700 dark:text-teal-400">({filteredStudents.length})</span>
                    <button
                      type="button"
                      onClick={() => setIsSearchDropdownOpen(false)}
                      aria-label="Close student results"
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Close list"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* Scrollable Students Container with Realtime Scroll Tracking */}
                <div
                  id="certificate-student-results"
                  role="listbox"
                  aria-label="Matching students"
                  ref={listContainerRef}
                  onScroll={handleListScroll}
                  className={`overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 overscroll-contain transition-all ${
                    isDropdownPinned ? 'max-h-[50vh] sm:max-h-96' : 'max-h-[42vh] sm:max-h-72'
                  }`}
                >
                  {filteredStudents.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500 font-bold space-y-1">
                      <div>{isLoadingStudents ? 'Loading student database...' : 'No matching students found.'}</div>
                      {(selectedClasses.length > 0 || selectedSessions.length > 0) && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          Scoped to selected {selectedClasses.length > 0 ? `${selectedClasses.length} class(es)` : ''}{selectedClasses.length > 0 && selectedSessions.length > 0 ? ' and ' : ''}{selectedSessions.length > 0 ? `${selectedSessions.length} session(s)` : ''}.
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClasses([]);
                              setSelectedSessions([]);
                            }}
                            className="ml-1 text-teal-600 dark:text-teal-400 underline font-bold cursor-pointer hover:text-teal-700"
                          >
                            Reset to All
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const studentKey = getCertificateStudentKey(st);
                      const isPreviewed = (previewedStudentId === studentKey) || (getCertificateStudentKey(selectedStudent) === studentKey);
                      return (
                        <button
                          key={studentKey || `${st.id}-${idx}`}
                          type="button"
                          role="option"
                          aria-selected={isPreviewed}
                          data-student-index={idx}
                          data-student-id={st.id}
                          onMouseEnter={() => {
                            if (isLivePreviewEnabled) handleLivePreview(st);
                          }}
                          onClick={() => handleSelectStudent(st, { keepOpen: isDropdownPinned })}
                          className={`cert-student-option w-full p-2 text-left flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isPreviewed
                              ? 'bg-teal-50/90 dark:bg-teal-950/60 border-l-4 border-teal-500 shadow-2xs ring-1 ring-teal-400/40'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {st.photo ? (
                              <img src={st.photo} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover border border-slate-300 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center text-[10.5px] font-black shrink-0">
                                {st.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{st.name}</span>
                                <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold shrink-0 ${
                                  st.sourceType === 'present'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}>
                                  {st.sourceType === 'present' ? 'Present' : 'Master Reg'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                {st.father && <span>F: <strong className="text-slate-700 dark:text-slate-300">{st.father}</strong> | </span>}
                                <span>Class: <strong className="text-slate-700 dark:text-slate-300">{st.cls} ({st.stream})</strong></span>
                                {st.rollNo && <span> | Roll: <strong className="text-slate-700 dark:text-slate-300">{st.rollNo}</strong></span>}
                                {st.regNo && <span> | Reg: <strong className="text-slate-700 dark:text-slate-300">{st.regNo}</strong></span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isPreviewed ? (
                              <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-[9px] font-black flex items-center gap-0.5 shadow-2xs animate-pulse">
                                <Eye size={9} />
                                <span>Previewing</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-200 hover:bg-teal-600 hover:text-white dark:bg-slate-700 dark:hover:bg-teal-600 text-slate-700 dark:text-slate-200 text-[9px] font-bold transition-colors">
                                Select
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Top Segmented Tab Switcher (Templates vs Gemini AI) */}
          <div className="flex items-center justify-between p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0 pt-1 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveRightTab('templates')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  activeRightTab === 'templates'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles size={11} className="text-teal-600 dark:text-teal-400" />
                <span>Templates ({allTemplatesList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab('ai')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  activeRightTab === 'ai'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xs'
                    : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-950/50'
                }`}
              >
                <Bot size={11} />
                <span>✨ Gemini AI</span>
              </button>
            </div>

            {activeRightTab === 'ai' && (
              <span className="px-2 py-0.5 rounded text-[8.5px] font-black border bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 flex items-center gap-1" title="Gemini credentials are held only by the server">
                <Shield size={9} />
                Server secured
              </span>
            )}
          </div>

          {/* TAB 1: GEMINI AI ASSISTANT (INLINE SIDEBAR PANEL) */}
          {activeRightTab === 'ai' && (
            <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 rounded-xl p-2.5 shadow-2xs space-y-2 animate-fadeIn text-xs">
              {/* API Keys Configuration Drawer */}
              {showKeysConfig && (
                <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-[10px] text-amber-950 dark:text-amber-200 flex items-center gap-1">
                      <Key size={11} className="text-amber-600" />
                      <span>Gemini API Key Pool:</span>
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9.5px] text-amber-800 dark:text-amber-400 font-extrabold hover:underline flex items-center gap-0.5"
                    >
                      <span>Free Key</span>
                      <ExternalLink size={9} />
                    </a>
                  </div>
                  <textarea
                    rows={2}
                    value={keysInputText}
                    onChange={(e) => setKeysInputText(e.target.value)}
                    placeholder="Paste API key here"
                    className="w-full px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-mono text-[10.5px] text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300">
                      {keysInputText.split(/[\n,]+/).map(k => k.trim()).filter(Boolean).length} keys detected
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveKeys}
                      className="px-2.5 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] cursor-pointer"
                    >
                      Save Keys
                    </button>
                  </div>
                </div>
              )}

              {/* Compact Mode Selector Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {[
                  { id: 'draft', label: '✍️ Draft' },
                  { id: 'humanize', label: '🪄 Polish' },
                  { id: 'formalize', label: '📜 Formalize' },
                  { id: 'shorten', label: '✂️ Shorten' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setAiMode(m.id); setAiGeneratedHtml(''); setAiError(''); }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap cursor-pointer transition-all border ${
                      aiMode === m.id
                        ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Prompt Input */}
              <div className="space-y-1">
                <textarea
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={
                    aiMode === 'draft'
                      ? 'What should this certificate certify? (e.g. Certify student passed Class 11th with distinction and displayed exemplary conduct)'
                      : 'Additional refinement notes or instructions (optional)'
                  }
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 font-medium text-xs text-slate-900 dark:text-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y min-h-[85px]"
                />

                {/* Quick Suggestion Chips */}
                {aiMode === 'draft' && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                    {[
                      'Scholarship Bonafide',
                      'Exemplary Conduct',
                      'Provisional Passing',
                      'Migration NOC',
                      'Sports Merit'
                    ].map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAiPrompt(sug)}
                        className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 text-slate-600 dark:text-slate-300 text-[8.5px] font-bold border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Model & Tone Selectors */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-[10px]"
                  >
                    {AVAILABLE_GEMINI_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name.split(' (')[0]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Tone</label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-[10px]"
                  >
                    <option value="Formal School">Formal Academic</option>
                    <option value="Dignified & Prestigious">Commendatory</option>
                    <option value="Meritorious">Meritorious</option>
                    <option value="Standard Official">Standard Official</option>
                  </select>
                </div>
              </div>

              {/* Generate AI Button */}
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={handleGenerateAi}
                className="w-full py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-black text-xs cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Drafting with Gemini AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} className="text-amber-200" />
                    <span>{aiMode === 'draft' ? 'Generate Certificate Text' : 'Refine Certificate Wording'}</span>
                  </>
                )}
              </button>

              {/* Error Banner */}
              {aiError && (
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[10px] flex items-center gap-1.5">
                  <AlertCircle size={12} className="shrink-0 text-rose-600" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Generated Result Preview Card & Real-Time Live Insertion */}
              {aiGeneratedHtml && (
                <div className="space-y-1.5 pt-2 border-t border-purple-200 dark:border-purple-900/60 animate-fadeIn">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <Check size={12} />
                      <span>Certificate Draft Ready</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiGeneratedHtml('')}
                      className="text-slate-400 hover:text-slate-600 text-[9px] font-bold"
                    >
                      Dismiss
                    </button>
                  </div>

                  <div
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-purple-200 dark:border-purple-800 text-[10.5px] leading-relaxed max-h-40 overflow-y-auto font-serif"
                    dangerouslySetInnerHTML={{ __html: aiGeneratedHtml }}
                  />

                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => handleApplyAiContent('replace')}
                      className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-black text-[9.5px] cursor-pointer shadow-2xs"
                      title="Replace current certificate body with this generated text"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyAiContent('append')}
                      className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9.5px] cursor-pointer shadow-2xs"
                      title="Append this text to the end of the certificate"
                    >
                      Append
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyAiContent('insert')}
                      className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[9.5px] cursor-pointer shadow-2xs"
                      title="Insert at current cursor position"
                    >
                      Insert
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEMPLATE SELECTOR & PRESETS DROPDOWN */}
          {activeRightTab === 'templates' && (
            <div className="space-y-1.5 shrink-0 pt-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[9px] uppercase font-black tracking-wider text-slate-500">
                <span className="flex items-center gap-1">
                  <Sparkles size={10} className="text-teal-600 dark:text-teal-400" />
                  <span>Certificate Template ({allTemplatesList.length})</span>
                </span>

                {/* Action Buttons: Duplicate & Overwrite (if custom) */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      const activeTpl = allTemplatesList.find(t => t.id === selectedTemplateId) || allTemplatesList[0];
                      if (activeTpl) handleDuplicateTemplate(activeTpl, e);
                    }}
                    className="px-2 py-0.5 rounded text-[9.5px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    title="Duplicate current template into new custom preset"
                  >
                    <Copy size={10} />
                    <span>Duplicate</span>
                  </button>

                  {(() => {
                    const cur = allTemplatesList.find(t => t.id === selectedTemplateId);
                    return cur?.isCustom ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateSaveMode('update');
                          setShowSaveTemplateModal(true);
                        }}
                        className="px-2 py-0.5 rounded text-[9.5px] font-black border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        title="Overwrite this custom template in Cloud"
                      >
                        <Save size={10} />
                        <span>Overwrite</span>
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Template Select Dropdown with Classified optgroups */}
              <div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const target = allTemplatesList.find(t => t.id === e.target.value);
                    if (target) handleSelectTemplate(target);
                  }}
                  className="w-full p-2 rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer shadow-2xs"
                >
                  {/* Builtin Classified Categories */}
                  {Array.from(new Set(allTemplatesList.filter(t => !t.isCustom).map(t => t.category || 'General Certificates'))).map(cat => (
                    <optgroup key={cat} label={`📂 ${cat}`}>
                      {allTemplatesList
                        .filter(t => !t.isCustom && (t.category || 'General Certificates') === cat)
                        .map(tpl => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name} {defaultTemplateId === tpl.id ? '⭐ (Default)' : ''}
                          </option>
                        ))}
                    </optgroup>
                  ))}

                  {/* Custom Presets Group */}
                  {customTemplates.length > 0 && (
                    <optgroup label="✨ Custom Saved Presets">
                      {customTemplates.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} ★ {defaultTemplateId === tpl.id ? '⭐ (Default)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {(() => {
                  const cur = allTemplatesList.find(t => t.id === selectedTemplateId);
                  return cur?.category ? (
                    <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 mt-1 px-0.5">
                      <span className="font-semibold text-teal-800 dark:text-teal-300">{cur.category}</span>
                      {cur.isCustom && <span className="font-mono text-[8px] bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 px-1 rounded border border-teal-200 dark:border-teal-800">Custom Cloud Preset</span>}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Actions Bar: Set Default & Delete */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[9.5px]">
                <div>
                  {defaultTemplateId !== selectedTemplateId ? (
                    <button
                      type="button"
                      onClick={(e) => handleSetDefaultTemplate(selectedTemplateId, e)}
                      className="text-amber-700 dark:text-amber-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>⭐ Set as Default</span>
                    </button>
                  ) : (
                    <span className="text-amber-600 font-bold flex items-center gap-0.5">
                      <span>⭐ Active Default</span>
                    </span>
                  )}
                </div>
                {(() => {
                  const cur = allTemplatesList.find(t => t.id === selectedTemplateId);
                  return cur?.isCustom ? (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustomTemplate(cur, e)}
                      className="text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 size={10} />
                      <span>Delete Custom</span>
                    </button>
                  ) : null;
                })()}
              </div>
            </div>
          )}
    </div>
  );

    return (
    <div className="space-y-2 animate-fadeIn text-slate-900 dark:text-slate-100">

      {/* Unified Global Floating Toast Notification */}
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999999 }}
          className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 font-sans font-bold text-xs animate-in fade-in slide-in-from-bottom-4 duration-200 backdrop-blur-md ${
            toast.type === 'error'
              ? 'bg-rose-950/95 text-rose-100 border-rose-700/80 shadow-rose-950/60'
              : toast.type === 'info'
              ? 'bg-sky-950/95 text-sky-100 border-sky-700/80 shadow-sky-950/60'
              : toast.type === 'warning'
              ? 'bg-amber-950/95 text-amber-100 border-amber-700/80 shadow-amber-950/60'
              : 'bg-emerald-950/95 text-emerald-100 border-emerald-700/80 shadow-emerald-950/60'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          ) : toast.type === 'info' ? (
            <Info size={16} className="text-sky-400 shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          )}
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* == == == == == == == ==  COLLAPSIBLE CERTIFICATE HEADER & LAYOUT CONFIG DRAWER == == == == == == == ==  */}
      {showSettingsDrawer && (
        <div 
          className="rounded-xl p-3 shadow-2xs space-y-2 animate-fadeIn text-xs border"
          style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
            <h3 className="font-black text-[10.5px] text-teal-900 dark:text-teal-200 uppercase tracking-wider flex items-center gap-1.5 m-0">
              <Sliders size={11} className="text-teal-600 dark:text-teal-400" />
              <span>Certificate Letterhead & Institutional Setup</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-slate-400 hidden sm:inline">Live preview & auto-applied on print/export</span>
              <button
                type="button"
                onClick={handleCloseSettings}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close setup drawer"
                aria-label="Close setup drawer"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {/* Office Title */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Office Header</label>
              <input
                type="text"
                value={officeTitle}
                onChange={(e) => setOfficeTitle(e.target.value)}
                placeholder="OFFICE OF THE PRINCIPAL"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-xs text-rose-800 dark:text-rose-300"
              />
            </div>

            {/* Institution Name */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Institution Name</label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="GOVT. HIGHER SECONDARY SCHOOL SHANGUS"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-blue-900 dark:text-blue-300"
              />
            </div>

            {/* Ref No & Manual Figure Editor */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[9.5px] font-black uppercase text-slate-500 truncate">
                  {isTcDcActive ? 'Cert Serial' : 'Reference Number'}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold text-slate-400">Fig:</span>
                  <div className="inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleStepFigure(-1)}
                      className="px-1.5 py-0.5 text-[9px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 border-r border-slate-200 dark:border-slate-700 cursor-pointer"
                      title="Step figure down (-1)"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      value={currentFigure || ''}
                      onChange={(e) => handleUpdateFigure(e.target.value)}
                      title="Directly edit the dispatch / certificate serial figure manually"
                      aria-label="Reference Serial Figure"
                      className="w-12 text-center text-[10px] font-mono font-bold text-teal-700 dark:text-teal-400 bg-transparent outline-none py-0.5 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepFigure(1)}
                      className="px-1.5 py-0.5 text-[9px] font-black text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-800 border-l border-slate-200 dark:border-slate-700 cursor-pointer"
                      title="Advance figure to next (+1)"
                    >
                      +1 Next
                    </button>
                  </div>
                </div>
              </div>
              <input
                type="text"
                value={refNo}
                onChange={(e) => handleGeneralRefChange(e.target.value)}
                onBlur={handleGeneralRefBlur}
                placeholder={isTcDcActive ? '1368' : 'HSS/1454/26'}
                title="Full Reference / Certificate String"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-xs"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Issue Date</label>
              <input
                type="text"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              />
            </div>

            {/* Certificate Title */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[9.5px] font-black uppercase text-slate-500">Certificate Title Banner</label>
                <span className="text-[9px] font-bold">
                  {isSavingCertTitle ? (
                    <span className="text-amber-600 animate-pulse">Saving to Cloud...</span>
                  ) : certTitleSavedStatus ? (
                    <span className="text-emerald-600 flex items-center gap-0.5">
                      <CheckCircle2 size={10} /> Saved to Firebase
                    </span>
                  ) : (
                    <span className="text-slate-400">Cloud Synced</span>
                  )}
                </span>
              </div>
              <input
                type="text"
                value={certificateTitle}
                onChange={(e) => {
                  setCertificateTitle(e.target.value);
                  try { localStorage.setItem('hss_certificate_studio_title', e.target.value); } catch {}
                }}
                onBlur={() => saveCertificateTitleToCloud(certificateTitle)}
                placeholder="BONAFIDE CERTIFICATE"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-amber-900 dark:text-amber-200"
              />
            </div>

            {/* Signatory 1 (Left) */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[9.5px] font-black uppercase text-slate-500">Signatory 1 (Left)</label>
                <label className="inline-flex items-center gap-1 cursor-pointer text-[9px] font-bold text-teal-700 dark:text-teal-400" title="Toggle to show or hide Left Signatory on certificate">
                  <input
                    type="checkbox"
                    checked={showLeftSignatory}
                    onChange={(e) => handleToggleLeftSignatory(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer w-3 h-3"
                  />
                  <span>{showLeftSignatory ? 'Shown' : 'Hidden'}</span>
                </label>
              </div>
              <input
                type="text"
                value={signatoryLeft}
                disabled={!showLeftSignatory}
                onChange={(e) => setSignatoryLeft(e.target.value)}
                placeholder="Incharge Admissions & Exam"
                className={`w-full px-2 py-0.5 rounded border font-medium text-xs transition-colors ${
                  showLeftSignatory 
                    ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white' 
                    : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed'
                }`}
              />
            </div>

            {/* Signatory 2 (Center - for TC/DC) */}
            {isTcDcActive && (
              <div>
                <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Signatory 2 (Center - Checked By)</label>
                <input
                  type="text"
                  value={signatoryCenter}
                  onChange={(e) => setSignatoryCenter(e.target.value)}
                  placeholder="Checked By"
                  className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
                />
              </div>
            )}

            {/* Signatory 3 (Right) */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">{isTcDcActive ? 'Signatory 3 (Right - Principal)' : 'Signatory 2 (Right - Principal)'}</label>
              <input
                type="text"
                value={signatoryRight}
                onChange={(e) => setSignatoryRight(e.target.value)}
                placeholder="Principal"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
              />
            </div>

            {/* Signatory Subtext / Institute Line */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Signatory Subtext / Institute</label>
              <input
                type="text"
                value={signatorySubtext}
                onChange={(e) => handleSignatorySubtextChange(e.target.value)}
                placeholder="Govt. HSS Shangus"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* ─── OPTIONS TOGGLES & PRECISION SPACING CONTROLS (FULL-WIDTH) ─── */}
          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2.5 w-full">
            
            {/* Top Row: Certificate Feature Options & Toggles Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs w-full">
              <div className="flex items-center gap-3.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-teal-600 dark:text-teal-400" />
                  <span>Options:</span>
                </span>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-teal-400 transition-colors" title="Toggle to hide or show Left Signatory (Incharge Admissions & Exam) on certificate">
                  <input
                    type="checkbox"
                    checked={showLeftSignatory}
                    onChange={(e) => handleToggleLeftSignatory(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span className={showLeftSignatory ? 'text-teal-700 dark:text-teal-300 font-bold' : 'text-slate-400 line-through'}>
                    Incharge Signatory (Left)
                  </span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-teal-400 transition-colors">
                  <input
                    type="checkbox"
                    checked={watermark}
                    onChange={(e) => setWatermark(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>Seal Watermark</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-teal-400 transition-colors">
                  <input
                    type="checkbox"
                    checked={showPhoto}
                    onChange={(e) => handleTogglePhoto(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>Photo Box</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-teal-400 transition-colors" title="Toggle to hide or show Mr., Mrs., Ms. titles on certificates">
                  <input
                    type="checkbox"
                    checked={includeSalutations}
                    onChange={(e) => handleToggleSalutations(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span className={includeSalutations ? 'text-teal-700 dark:text-teal-300 font-bold' : 'text-slate-400 line-through'}>
                    Mr. / Mrs. Titles
                  </span>
                </label>

                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs" title="Adjust Certificate Base Font Size">
                  <span className="text-[10px] font-bold text-slate-500">Base Font:</span>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleAdjustFontSize(-1)}
                      className="w-5 h-5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center cursor-pointer transition-all active:scale-95"
                      title="Decrease Font Size (A⁻)"
                    >
                      A⁻
                    </button>
                    <select
                      value={baseFontSize}
                      onChange={(e) => handleSetFontSize(e.target.value)}
                      className="text-[10px] font-bold text-slate-800 dark:text-slate-200 bg-transparent outline-none px-1 py-0.5 cursor-pointer"
                    >
                      {FONT_SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAdjustFontSize(1)}
                      className="w-5 h-5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center cursor-pointer transition-all active:scale-95"
                      title="Increase Font Size (A⁺)"
                    >
                      A⁺
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2-COLUMN DRAG-RESIZABLE SPLIT-SCREEN LAYOUT ── */}
      {showRefDateModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setShowRefDateModal(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 animate-scaleUp"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Edit Reference No. & Date
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRefDateModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 space-y-3">
              {/* Figure / Serial manual control inside modal */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-slate-300">
                    Serial Figure / Counter
                  </span>
                  <span className="text-[8.5px] text-slate-500">
                    Edit figure manually or step sequentially
                  </span>
                </div>
                <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                  <button
                    type="button"
                    onClick={() => handleStepFigure(-1)}
                    className="px-2 py-1 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-r border-slate-200 dark:border-slate-700 cursor-pointer"
                    title="Decrease figure by 1"
                  >
                    -1
                  </button>
                  <input
                    type="number"
                    value={currentFigure || ''}
                    onChange={(e) => handleUpdateFigure(e.target.value)}
                    className="w-16 text-center text-xs font-mono font-bold text-teal-700 dark:text-teal-400 py-1 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    title="Type any serial figure"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepFigure(1)}
                    className="px-2 py-1 text-xs font-black text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 border-l border-slate-200 dark:border-slate-700 cursor-pointer"
                    title="Advance figure by 1"
                  >
                    +1 Next
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[9.5px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Full Certificate Ref / Dispatch Number
                </label>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => handleGeneralRefChange(e.target.value)}
                  onBlur={handleGeneralRefBlur}
                  placeholder="e.g. HSS/Bonafide/1454/26"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9.5px] font-black uppercase text-slate-600 dark:text-slate-400">
                    Certificate Issue Date
                  </label>
                  <button
                    type="button"
                    onClick={() => setDateStr(new Date().toLocaleDateString('en-GB'))}
                    className="text-[9px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Set Today
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                  <input
                    type="date"
                    title="Pick date from calendar"
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-');
                        setDateStr(`${d}/${m}/${y}`);
                      }
                    }}
                    className="w-10 h-10 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer shrink-0"
                  />
                </div>
              </div>

              {isTcDcActive && (
                <div>
                  <label className="block text-[9.5px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Admission Number
                  </label>
                  <input
                    type="text"
                    value={admissionNo || ''}
                    onChange={(e) => setAdmissionNo(e.target.value)}
                    placeholder="e.g. 1045"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRefDateModal(false)}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 text-white font-black text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Check size={14} />
                <span>Apply & Done</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {!isDesktop && showMobileOptionsModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
            <div className="absolute inset-0" onClick={() => setShowMobileOptionsModal(false)} />
            <div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-xl max-h-[92dvh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 animate-scaleUp"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Award size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider truncate">
                    Select Student & Certificate Template
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileOptionsModal(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="overflow-y-auto p-2.5 space-y-2 flex-1 overscroll-contain">
                {/* Mobile Quick Ref & Date Box */}
                <div className="p-2 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-teal-900 dark:text-teal-300">
                    <span className="flex items-center gap-1">
                      <FileText size={11} className="text-teal-600 dark:text-teal-400" />
                      <span>Certificate Serial / Ref & Date</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDateStr(new Date().toLocaleDateString('en-GB'))}
                      className="text-[9px] font-bold text-teal-700 hover:text-teal-900 dark:text-teal-300 underline cursor-pointer"
                    >
                      Set Today
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 mb-0.5">Serial / Ref No.</label>
                      <input
                        type="text"
                        value={refNo}
                        onChange={(e) => setRefNo(e.target.value)}
                        placeholder="Certificate Serial / Ref..."
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-teal-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 mb-0.5">Certificate Date</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={dateStr}
                          onChange={(e) => setDateStr(e.target.value)}
                          placeholder="DD/MM/YYYY"
                          className="flex-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-teal-500 transition-all"
                        />
                        <input
                          type="date"
                          title="Pick date from calendar"
                          onChange={(e) => {
                            if (e.target.value) {
                              const [y, m, d] = e.target.value.split('-');
                              setDateStr(`${d}/${m}/${y}`);
                            }
                          }}
                          className="w-7 h-7 p-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer shrink-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {renderStudentAndTemplateSelector()}
              </div>

              {/* Sticky Done Footer */}
              <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900 shrink-0 flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold text-slate-500 truncate">
                  {selectedStudent ? `${selectedStudent.name || selectedStudent.studentName} (${selectedStudent.cls || selectedStudent.className || 'Student'})` : 'No student selected'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileOptionsModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
                >
                  <Check size={13} />
                  <span>Done & View Certificate</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── 2-COLUMN DRAG-RESIZABLE SPLIT-SCREEN LAYOUT ── */}
      <div className="cert-split-container flex flex-col lg:flex-row lg:flex-nowrap gap-0 items-start w-full relative">
        
        {/* == == == == == == == == LEFT HALF: LIVE A4 CERTIFICATE PREVIEW (2/3 OF PAGE) == == == == == == == == */}
        <div
          style={{ width: isDesktop ? `calc(${leftSplitPct}% - 9px)` : '100%' }}
          className="w-full flex flex-col items-center justify-start shrink-0 min-w-0"
        >
          {/* ─── MOBILE UNIFIED SINGLE-ROW TOOLBAR (Compact & Grouped) ─── */}
          {/* ─── MOBILE UNIFIED SINGLE-ROW TOOLBAR (Compact & Grouped) ─── */}
            <div className="lg:hidden w-full relative mb-1.5">
              {/* Click-outside backdrop to dismiss open dropdown */}
              {mobileDropdownOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setMobileDropdownOpen(null)} />
              )}

              <div className="flex items-center justify-between gap-1 p-0.5 sm:p-1 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-lg sm:rounded-xl shadow-2xs relative z-40 overflow-x-auto no-scrollbar max-w-full">
                {/* 1. Student / Template Selector Pill (Flexible Width) */}
                <button
                  type="button"
                  onClick={() => setShowMobileOptionsModal(true)}
                  className="studio-compact-toolbar-btn flex-1 min-w-0 text-left flex items-center gap-1 px-1.5 h-6 sm:h-7 rounded-md bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/80 shadow-2xs cursor-pointer active:scale-98 transition-transform"
                  title="Search Student & Select Certificate Template"
                >
                  <Award size={9.5} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-900 dark:text-white truncate">
                    {selectedStudent ? (selectedStudent.name || selectedStudent.studentName) : 'Select Student'}
                  </span>
                  <span className="px-1 py-0.2 rounded text-[7px] font-black bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 shrink-0 truncate max-w-[80px]">
                    <span className="sm:hidden">Template</span>
                    <span className="hidden sm:inline">{allTemplatesList.find(t => t.id === selectedTemplateId)?.name || 'Template'}</span>
                  </span>
                  <ChevronDown size={8} className="text-slate-400 shrink-0" />
                </button>

                {/* 2. Grouped Actions: Print, Word & Save in One Dropdown */}
                <button
                  type="button"
                  onClick={() => setMobileDropdownOpen(prev => prev === 'export' ? null : 'export')}
                  className={`studio-compact-toolbar-btn h-6 sm:h-7 px-1.5 sm:px-2 rounded-md font-bold text-[9px] sm:text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0 border whitespace-nowrap ${
                    mobileDropdownOpen === 'export'
                      ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                      : 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800 hover:bg-teal-100'
                  }`}
                  title="Print, Export Word (.docx) & Save Certificate"
                >
                  <Printer size={9.5} className="shrink-0" />
                  <span>Export</span>
                  <ChevronDown size={8} className={`transition-transform shrink-0 ${mobileDropdownOpen === 'export' ? 'rotate-180' : ''}`} />
                </button>

                {/* 3. Text Formatting Dropdown (Aa) */}
                <button
                  type="button"
                  onClick={() => setMobileDropdownOpen(prev => prev === 'format' ? null : 'format')}
                  className={`studio-compact-toolbar-btn h-6 sm:h-7 px-1.5 rounded-md font-extrabold text-[9.5px] sm:text-[11px] flex items-center gap-0.5 cursor-pointer transition-all active:scale-95 shrink-0 border whitespace-nowrap ${
                    mobileDropdownOpen === 'format'
                      ? 'bg-amber-100 text-amber-950 border-amber-400 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title="Text Style & Formatting"
                >
                  <span className="font-serif font-black">Aa</span>
                  <ChevronDown size={8} className={`transition-transform shrink-0 ${mobileDropdownOpen === 'format' ? 'rotate-180' : ''}`} />
                </button>

                {/* 3.5. Insert Field Button (Compact Mobile Drawer Trigger) */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileDropdownOpen(null);
                    saveCurrentSelection();
                    setShowContextMenu(true);
                  }}
                  className="studio-compact-toolbar-btn h-6 sm:h-7 px-1.5 rounded-md font-extrabold text-[9px] sm:text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0 border whitespace-nowrap bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700 hover:bg-teal-100"
                  title="Insert student fields at cursor"
                >
                  <PlusCircle size={9.5} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>+Field</span>
                </button>

                {/* 4. Layout Dropdown (Alignments & Inserts) */}
                <button
                  type="button"
                  onClick={() => setMobileDropdownOpen(prev => prev === 'layout' ? null : 'layout')}
                  className={`studio-compact-toolbar-btn h-6 sm:h-7 px-1.5 rounded-md font-extrabold text-[9.5px] sm:text-[11px] flex items-center gap-0.5 cursor-pointer transition-all active:scale-95 shrink-0 border whitespace-nowrap ${
                    mobileDropdownOpen === 'layout'
                      ? 'bg-amber-100 text-amber-950 border-amber-400 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title="Alignment, Lists & Tables"
                >
                  <AlignLeft size={9.5} className="shrink-0" />
                  <ChevronDown size={8} className={`transition-transform shrink-0 ${mobileDropdownOpen === 'layout' ? 'rotate-180' : ''}`} />
                </button>

                {/* 5. More Dropdown (Undo, Redo, AI, History) */}
                <button
                  type="button"
                  onClick={() => setMobileDropdownOpen(prev => prev === 'more' ? null : 'more')}
                  className={`studio-compact-toolbar-btn h-6 sm:h-7 w-6 sm:w-7 rounded-md font-bold text-[9.5px] sm:text-[11px] flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0 border whitespace-nowrap ${
                    mobileDropdownOpen === 'more'
                      ? 'bg-amber-100 text-amber-950 border-amber-400 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title="More Tools"
                >
                  <span>•••</span>
                </button>

                {/* 6. Dedicated Setup Button */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !showSettingsDrawer;
                    setShowSettingsDrawer(next);
                    if (onToggleSettingsDrawer) onToggleSettingsDrawer(next);
                  }}
                  className={`studio-compact-toolbar-btn h-6 sm:h-7 px-1.5 sm:px-2 rounded-md border font-bold text-[9px] sm:text-[10px] flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer shrink-0 transition-all ${
                    showSettingsDrawer
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border-amber-400'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                  title="Certificate Layout & Head Setup"
                >
                  <Sliders size={9} className={showSettingsDrawer ? 'text-amber-600' : 'text-slate-500'} />
                  <span className="hidden sm:inline">Setup</span>
                </button>
              </div>

              {/* ── Active Dropdown Menus ── */}
              {mobileDropdownOpen === 'export' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-1 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 w-56 max-w-[calc(100vw-1.5rem)] space-y-1.5 animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <span>Export & Issue Certificate</span>
                    <button
                      type="button"
                      onClick={() => setMobileDropdownOpen(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {/* Print / Save PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDropdownOpen(null);
                      handlePrint();
                    }}
                    disabled={isIssuingTcDc || isExportingDocx}
                    className="w-full h-8 px-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 text-white font-bold text-xs flex items-center justify-between shadow-xs cursor-pointer active:scale-98 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {isIssuingTcDc ? <RefreshCw size={13} className="animate-spin" /> : <Printer size={13} />}
                      <span>Print / Save PDF</span>
                    </div>
                    <span className="text-[9px] opacity-80 font-mono">A4</span>
                  </button>

                  {/* Export Word (.docx) */}
                  <button
                    type="button"
                    disabled={isExportingDocx || isIssuingTcDc}
                    onClick={() => {
                      setMobileDropdownOpen(null);
                      handleExportDocx();
                    }}
                    className="w-full h-8 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-between shadow-xs cursor-pointer disabled:opacity-50 active:scale-98 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {isExportingDocx ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />}
                      <span>Export Word</span>
                    </div>
                    <span className="text-[9px] opacity-80 font-mono">.docx</span>
                  </button>

                  {/* Save Template in Cloud */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDropdownOpen(null);
                      handleQuickUpdateTemplate();
                    }}
                    className="w-full h-8 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-xs flex items-center justify-between cursor-pointer active:scale-98 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Save size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>Save as Template</span>
                    </div>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono">Cloud</span>
                  </button>
                </div>
              )}

              {/* ── Active Dropdown Menus (Positioned outside overflow-x-auto to prevent clipping) ── */}
              {mobileDropdownOpen === 'format' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-1 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 w-64 max-w-[calc(100vw-1.5rem)] space-y-2 animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <span>Text & Headings</span>
                    <button
                      type="button"
                      onClick={() => setMobileDropdownOpen(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {/* Headings & Paragraph */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { executeFormat('formatBlock', '<h1>'); setMobileDropdownOpen(null); }}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-black border transition-all ${
                        activeFormats.h1
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 border-amber-400'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { executeFormat('formatBlock', '<h2>'); setMobileDropdownOpen(null); }}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-black border transition-all ${
                        activeFormats.h2
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 border-amber-400'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { executeFormat('formatBlock', '<p>'); setMobileDropdownOpen(null); }}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        activeFormats.p
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 border-amber-400'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Paragraph
                    </button>
                  </div>

                  {/* Font Size Stepper */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-bold text-slate-500">Font Size:</span>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAdjustFontSize(-1)}
                        className="w-6 h-6 rounded bg-white dark:bg-slate-700 font-black text-xs text-slate-800 dark:text-slate-200 flex items-center justify-center cursor-pointer shadow-2xs"
                        title="Decrease Font Size (A⁻)"
                      >
                        A⁻
                      </button>
                      <select
                        value={baseFontSize}
                        onChange={(e) => handleSetFontSize(e.target.value)}
                        className="text-[10px] font-bold text-slate-800 dark:text-slate-200 bg-transparent outline-none px-1 py-0.5"
                      >
                        {FONT_SIZES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAdjustFontSize(1)}
                        className="w-6 h-6 rounded bg-white dark:bg-slate-700 font-black text-xs text-slate-800 dark:text-slate-200 flex items-center justify-center cursor-pointer shadow-2xs"
                        title="Increase Font Size (A⁺)"
                      >
                        A⁺
                      </button>
                    </div>
                  </div>

                  {/* Inline Styles: B, I, U, S, Clear */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('bold')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeFormats.bold ? 'bg-amber-100 text-amber-900 font-black' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Bold"
                    >
                      <Bold size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('italic')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeFormats.italic ? 'bg-amber-100 text-amber-900 font-black' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Italic"
                    >
                      <Italic size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('underline')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeFormats.underline ? 'bg-amber-100 text-amber-900 font-black' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Underline"
                    >
                      <Underline size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('strikethrough')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeFormats.strikeThrough ? 'bg-amber-100 text-amber-900 font-black' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Strikethrough"
                    >
                      <Strikethrough size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { executeFormat('removeFormat'); setMobileDropdownOpen(null); }}
                      className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-600 flex items-center justify-center"
                      title="Clear Formatting"
                    >
                      <RemoveFormatting size={12} />
                    </button>
                  </div>

                  {/* Quick Text Colors */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-bold text-slate-500">Color:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: 'Black', color: '#0f172a' },
                        { label: 'Maroon', color: '#800000' },
                        { label: 'Navy Blue', color: '#0a192f' },
                        { label: 'Forest Green', color: '#065f46' },
                        { label: 'Slate Gray', color: '#475569' },
                        { label: 'Crimson', color: '#dc2626' }
                      ].map(c => (
                        <button
                          key={c.color}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { applyTextColor(c.color); setMobileDropdownOpen(null); }}
                          className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mobileDropdownOpen === 'layout' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-1 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 w-56 max-w-[calc(100vw-1.5rem)] space-y-2 animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <span>Layout & Structure</span>
                    <button
                      type="button"
                      onClick={() => setMobileDropdownOpen(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {/* Alignments */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('justifyLeft')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeFormats.justifyLeft ? 'bg-amber-100 text-amber-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Align Left"
                    >
                      <AlignLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('justifyCenter')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeFormats.justifyCenter ? 'bg-amber-100 text-amber-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Align Center"
                    >
                      <AlignCenter size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('justifyRight')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeFormats.justifyRight ? 'bg-amber-100 text-amber-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Align Right"
                    >
                      <AlignRight size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('justifyFull')}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeFormats.justifyFull ? 'bg-amber-100 text-amber-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Justify"
                    >
                      <AlignJustify size={12} />
                    </button>
                  </div>

                  {/* Lists */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('insertUnorderedList')}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 ${activeFormats.insertUnorderedList ? 'bg-amber-100 text-amber-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Bullet List"
                    >
                      <List size={11} />
                      <span>Bullets</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('insertOrderedList')}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 ${activeFormats.insertOrderedList ? 'bg-amber-100 text-amber-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                      title="Numbered List"
                    >
                      <ListOrdered size={11} />
                      <span>Numbered</span>
                    </button>
                  </div>

                  {/* Table & Divider */}
                  <div className="flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { executeFormat('insertHorizontalRule'); setMobileDropdownOpen(null); }}
                      className="flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <Minus size={11} />
                      <span>Divider</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { insertTable(2, 4); setMobileDropdownOpen(null); }}
                      className="flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800"
                    >
                      <TableIcon size={11} />
                      <span>Table</span>
                    </button>
                  </div>
                </div>
              )}

              {mobileDropdownOpen === 'more' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-1 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 w-52 max-w-[calc(100vw-1.5rem)] space-y-1 animate-fadeIn"
                >
                  {/* Undo / Redo */}
                  <div className="flex items-center justify-between gap-1 p-1 bg-slate-50 dark:bg-slate-800/80 rounded-xl">
                    <button
                      type="button"
                      disabled={!canUndo}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { handleUndo(); setTimeout(checkActiveFormats, 50); }}
                      className="flex-1 py-1 rounded-lg flex items-center justify-center gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30"
                    >
                      <Undo size={11} />
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      disabled={!canRedo}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { handleRedo(); setTimeout(checkActiveFormats, 50); }}
                      className="flex-1 py-1 rounded-lg flex items-center justify-center gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30"
                    >
                      <Redo size={11} />
                      <span>Redo</span>
                    </button>
                  </div>

                  {/* AI Assistant */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiModal(true);
                      setMobileDropdownOpen(null);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/50 text-purple-900 dark:text-purple-200 flex items-center gap-2 cursor-pointer text-[10.5px] font-bold"
                  >
                    <Sparkles size={12} className="text-purple-600 dark:text-purple-400" />
                    <span>Gemini AI Assistant</span>
                  </button>

                  {/* History / Archive */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowHistoryModal(true);
                      setMobileDropdownOpen(null);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer text-[10.5px] font-bold"
                  >
                    <History size={12} className="text-slate-500" />
                    <span>Archived Documents</span>
                  </button>

                  {/* Save As New Template */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveTemplateModal(true);
                      setMobileDropdownOpen(null);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer text-[10.5px] font-bold"
                  >
                    <BookmarkPlus size={12} className="text-slate-500" />
                    <span>Save As New Template</span>
                  </button>
                </div>
              )}
            </div>

          {/* == == == == == == == == A4 PAPER LIVE VIEWPORT & EDITOR == == == == == == == == */}
          <div className="w-full min-w-0">
            <div
                className="text-slate-900 border-2 border-[#800000] outline outline-1 outline-[#c5a059] -outline-offset-4 rounded-xl p-4 sm:p-6 shadow-md max-h-[75dvh] lg:max-h-[calc(100dvh-95px)] overflow-y-auto relative flex flex-col justify-start min-h-[520px] lg:min-h-[620px]"
                style={{
                  backgroundColor: '#fdfbf7',
                  backgroundImage: 'radial-gradient(ellipse at 50% 30%, #ffffff 0%, #fbf9f4 60%, #f6f1e7 100%), repeating-linear-gradient(45deg, rgba(197, 160, 89, 0.016) 0px, rgba(197, 160, 89, 0.016) 1.5px, transparent 1.5px, transparent 8px)'
                }}
              >
            
            {/* Watermark Background */}
            {watermark && (
              <div
                className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center z-0"
                style={{
                  backgroundImage: `url('/logo192.png')`,
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '110px'
                }}
              />
            )}

            <div className="relative z-10 space-y-3">
              
              {/* Top Official Letterhead Header Banner (Matches Official Letterhead Writer) */}
              <div
                style={{ marginBottom: `${headerGap}in` }}
                className="hidden lg:block print:!block -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 p-4 sm:p-5 text-center bg-[#f0f8ff] border-b-[2.5px] border-[#800000] rounded-t-xl"
              >
                <img
                  src="/logo192.png"
                  alt="School Seal"
                  style={{ width: '48px', height: '48px', maxWidth: '48px', maxHeight: '48px', objectFit: 'contain' }}
                  className="w-12 h-12 object-contain mx-auto mb-1.5 drop-shadow-xs"
                  onError={(e) => { e.target.src = '/logo.png'; e.target.onerror = null; }}
                />
                <h3 className="text-[11px] sm:text-xs font-black text-[#800000] uppercase tracking-[1.5px] m-0">
                  {officeTitle || 'OFFICE OF THE PRINCIPAL'}
                </h3>
                <h1 className="text-base sm:text-lg font-black text-[#0a192f] tracking-wide uppercase m-0 mt-0.5 font-serif">
                  {institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}
                </h1>
                <p className="text-[10px] text-slate-600 font-semibold m-0 mt-0.5">
                  {institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)'}
                </p>
              </div>

              {/* Ref & Date Row — Direct Inline Editing */}
              {!isTcDcActive && (
                <div className="flex items-center justify-between text-[10px] sm:text-[10.5px] font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1 px-1 mt-1 sm:mt-2 lg:-mt-[0.25in] mb-2 sm:mb-3 lg:mb-[0.25in] print:!-mt-[0.25in] print:!mb-[0.25in] gap-2">
                  <div className="flex items-center gap-1 group/ref min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setShowRefDateModal(true)}
                      className="shrink-0 text-slate-700 dark:text-slate-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-[10px] sm:text-[10.5px]"
                      title="Click to edit Reference No. & Date in popup"
                    >
                      <span>Ref No:</span>
                      <Edit3 size={9} className="text-slate-400 lg:hidden" />
                    </button>
                    <input
                      type="text"
                      value={refNo}
                      onChange={(e) => handleGeneralRefChange(e.target.value)}
                      onBlur={handleGeneralRefBlur}
                      placeholder="e.g. HSS/1454/26"
                      title="Click to directly edit Certificate Reference Number"
                      aria-label="Certificate Reference Number"
                      className="studio-inline-input font-mono font-bold text-slate-900 dark:text-white bg-transparent border-b border-dashed border-teal-300/80 hover:border-teal-500 focus:border-teal-600 focus:bg-teal-50/40 rounded px-1 py-0.5 outline-none transition-all w-full max-w-[240px] sm:max-w-[360px] text-[10px] sm:text-xs placeholder:text-[9px] print:border-none print:bg-transparent print:p-0 print:max-w-none print:w-auto"
                      style={{ fontSize: '11px', height: '22px' }}
                    />
                    <div className="print:hidden inline-flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStepFigure(-1)}
                        className="px-1 py-0.5 rounded text-[8.5px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        title="Step figure down (-1)"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepFigure(1)}
                        className="px-1 py-0.5 rounded text-[8.5px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/60 cursor-pointer"
                        title="Advance figure (+1 Next)"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 group/date shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowRefDateModal(true)}
                      className="shrink-0 text-slate-700 dark:text-slate-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-[10px] sm:text-[10.5px]"
                      title="Click to edit Reference No. & Date in popup"
                    >
                      <span>Date:</span>
                      <Edit3 size={9} className="text-slate-400 lg:hidden" />
                    </button>
                    <input
                      type="text"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      title="Click to directly edit Issue Date"
                      aria-label="Issue Date"
                      className="studio-inline-input font-bold text-slate-900 dark:text-white bg-transparent border-b border-dashed border-teal-300/80 hover:border-teal-500 focus:border-teal-600 focus:bg-teal-50/40 rounded px-1 py-0.5 outline-none transition-all w-20 sm:w-24 text-right text-[10px] sm:text-xs placeholder:text-[9px] print:border-none print:bg-transparent print:p-0 print:text-right"
                      style={{ fontSize: '11px', height: '22px' }}
                    />
                    <input
                      type="date"
                      title="Pick certificate issue date from calendar"
                      aria-label="Pick issue date from calendar"
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-');
                          setDateStr(`${d}/${m}/${y}`);
                        }
                      }}
                      className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer print:hidden shrink-0"
                    />
                  </div>
                </div>
              )}

              {/* Certificate Title Banner — Kept Close Vertically */}
              <div className="text-center pt-0 pb-0" style={{ marginTop: `${titleMetaGap}px`, marginBottom: `${titleMetaGap}px` }}>
                <span className="inline-block font-serif text-xs sm:text-sm font-black uppercase text-[#800000] tracking-widest px-5 py-0.5 border-y-2 border-[#800000] bg-[#fff9f5] shadow-2xs">
                  {certificateTitle}
                </span>
              </div>

              {/* TC/DC Meta Details on Studio Canvas — Modern 2x2 Grid with Integrated QR Security Badge */}
              {isTcDcActive && (
                <div
                  style={{
                    marginTop: `${titleMetaGap}px`,
                    marginBottom: `${metaBodyGap}in`
                  }}
                  className="w-full flex items-stretch justify-between bg-white border border-[#800000] rounded-md overflow-hidden text-[10px] font-sans shadow-2xs"
                >
                  {/* Left Column: 2x2 Metadata Grid */}
                  <div className="grid grid-cols-[1fr_1.25fr] gap-x-3 gap-y-2 flex-1 px-3 py-2 leading-relaxed min-w-0">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 text-[9px] shrink-0">Certificate No.:</span>
                      <input
                        type="text"
                        value={refNo}
                        onChange={(e) => setRefNo(e.target.value)}
                        placeholder="1368"
                        title="Click to directly edit Certificate Serial Number"
                        aria-label="Certificate Serial Number"
                        className="font-mono font-black text-red-600 bg-transparent border-b border-dashed border-red-300/80 hover:border-red-500 focus:border-red-600 focus:bg-red-50/40 rounded px-0.5 py-0 outline-none transition-all w-24 text-[9.5px] print:border-none print:bg-transparent print:p-0"
                      />
                      <div className="print:hidden inline-flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStepFigure(-1)}
                          className="px-1 py-0.5 rounded text-[8.5px] font-bold text-slate-600 hover:bg-slate-200"
                          title="Step TC/DC number down (-1)"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStepFigure(1)}
                          className="px-1 py-0.5 rounded text-[8.5px] font-bold text-red-600 hover:bg-red-100"
                          title="Advance TC/DC number (+1)"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 text-[9px] shrink-0">Reg. No.:</span>
                      <span className={`font-mono font-black text-blue-700 truncate ${String(regNo || '').length > 13 ? 'text-[8.5px] tracking-tight' : 'text-[9.5px]'}`}>{regNo || '—'}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 text-[9px] shrink-0">Admission No.:</span>
                      <input
                        type="text"
                        value={admissionNo || ''}
                        onChange={(e) => setAdmissionNo(e.target.value)}
                        placeholder="e.g. 1045"
                        title="Click to directly edit Admission Number"
                        aria-label="Admission Number"
                        className="font-mono font-black text-blue-700 bg-transparent border-b border-dashed border-blue-300/80 hover:border-blue-500 focus:border-blue-600 focus:bg-blue-50/40 rounded px-0.5 py-0 outline-none transition-all w-20 text-[9px] print:border-none print:bg-transparent print:p-0"
                      />
                    </div>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 text-[9px] shrink-0">Date of Admission:</span>
                      <input
                        type="text"
                        value={admissionDate || ''}
                        onChange={(e) => setAdmissionDate(e.target.value)}
                        placeholder="DD-MM-YYYY"
                        title="Click to directly edit Date of Admission"
                        aria-label="Date of Admission"
                        className="font-mono font-black text-blue-700 bg-transparent border-b border-dashed border-blue-300/80 hover:border-blue-500 focus:border-blue-600 focus:bg-blue-50/40 rounded px-0.5 py-0 outline-none transition-all w-20 text-[9px] print:border-none print:bg-transparent print:p-0"
                      />
                      <input
                        type="date"
                        title="Pick date of admission from calendar"
                        onChange={(e) => {
                          if (e.target.value) {
                            const [y, m, d] = e.target.value.split('-');
                            setAdmissionDate(`${d}-${m}-${y}`);
                          }
                        }}
                        className="w-3 h-3 opacity-40 hover:opacity-100 cursor-pointer print:hidden shrink-0"
                      />
                    </div>
                  </div>

                  {/* Right Column: Integrated QR Security Badge */}
                  <div className="flex flex-col items-center justify-center px-2 py-1.5 bg-white border-l border-dashed border-slate-300 shrink-0 self-stretch w-[88px] min-w-[88px] max-w-[88px] box-border">
                    <div className="w-14 h-14 bg-white border border-slate-200 rounded p-0.5 flex items-center justify-center shadow-2xs">
                      {canvasQrUri ? (
                        <img src={canvasQrUri} alt="Verification QR Code" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[7px] font-mono text-slate-500 font-black">[ QR CODE ]</span>
                      )}
                    </div>
                    <span className="text-[6px] font-black tracking-wider text-[#800000] uppercase mt-1 text-center whitespace-nowrap">SCAN TO VERIFY</span>
                  </div>
                </div>
              )}

              {/* Dynamic Injected Spacing Style Block for Live Canvas */}
              <style>{`
                .doc-studio-wysiwyg-body {
                  font-size: ${baseFontSize} !important;
                }
                .doc-studio-wysiwyg-body p {
                  margin-bottom: ${paraSpacing}px !important;
                }
                .cert-footer-dates-row {
                  margin-top: 0.5in !important;
                }
              `}</style>

              {/* Main Body with Direct Inline Editing & Context Menu */}
              <div className="flex items-start gap-4 relative" style={{ marginTop: '0px' }}>
                <div
                  ref={editorRef}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  style={{ lineHeight: bodyLineHeight, fontSize: baseFontSize }}
                  onInput={(e) => {
                    handleEditorInput(e);
                    saveCurrentSelection();
                    checkTableContext();
                    checkActiveFormats();
                  }}
                  onKeyUp={() => {
                    saveCurrentSelection();
                    checkTableContext();
                    checkActiveFormats();
                  }}
                  onMouseUp={() => {
                    saveCurrentSelection();
                    checkTableContext();
                    checkActiveFormats();
                  }}
                  onClick={() => {
                    saveCurrentSelection();
                    checkTableContext();
                    checkActiveFormats();
                  }}
                  onFocus={() => {
                    saveCurrentSelection();
                    checkTableContext();
                    checkActiveFormats();
                  }}
                  onSelect={() => {
                    saveCurrentSelection();
                    checkActiveFormats();
                  }}
                  onContextMenu={handleContextMenu}
                  className="doc-studio-wysiwyg-body flex-1 text-[11.5px] text-justify font-serif text-slate-900 space-y-2 focus:outline-none p-2 rounded-lg border border-dashed border-teal-200 hover:border-teal-400 focus:border-teal-500 focus:bg-teal-50/15 transition-all cursor-text min-h-[140px]"
                  title="Click to edit text directly • Right-click anywhere to insert student details or placeholders"
                />

                {showPhoto && (
                  <div 
                    onClick={() => { if (!studentPhotoUrl && !isFetchingPhoto) fetchAndResolveStudentPhoto(); }}
                    className={`w-24 h-28 border border-[#800000] p-1 bg-white shadow-xs rounded flex flex-col items-center justify-center shrink-0 text-center relative overflow-hidden transition-all ${
                      !studentPhotoUrl ? 'cursor-pointer hover:border-teal-600 hover:bg-teal-50/30 group' : ''
                    }`}
                    title={studentPhotoUrl ? "Student Photo (verified from database)" : "Click to fetch student photo from database"}
                  >
                    {isFetchingPhoto ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 p-1 animate-fadeIn">
                        <RefreshCw size={16} className="animate-spin text-teal-600" />
                        <span className="text-[7.5px] font-black text-teal-700 uppercase tracking-tighter">Fetching DB Photo...</span>
                      </div>
                    ) : studentPhotoUrl ? (
                      <img
                        src={studentPhotoUrl}
                        alt={studentName}
                        className="w-full h-full object-cover rounded shadow-2xs"
                        onError={() => setStudentPhotoUrl(null)}
                      />
                    ) : (
                      <div className="text-[8px] font-bold text-slate-400 uppercase leading-tight flex flex-col items-center justify-center gap-1 p-1">
                        <ImageIcon size={16} className="text-slate-300 group-hover:text-teal-600 transition-colors" />
                        <span>Affix Student Photo</span>
                        <span className="text-[7px] text-teal-600 underline font-mono">Fetch DB Photo</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Verification & Signatories */}
            <div
              style={{ marginTop: '0.77in' }}
              className="relative z-10 pt-0 border-t border-slate-200"
            >
              <div className="flex items-end justify-between px-2">
                {/* Signatory 1: Incharge Admissions & Exam (Controlled by showLeftSignatory) */}
                {showLeftSignatory && (
                  <div className="w-28 sm:w-36 text-center">
                    <div className="border-b-2 border-[#800000] mb-1"></div>
                    <div className="font-black text-[9.5px] uppercase tracking-tight text-[#800000]">{signatoryLeft || 'Incharge Admissions & Exam'}</div>
                    <div className="text-[7.5px] sm:text-[8px] text-slate-500 font-bold">{signatorySubtext || institutionName || 'Govt. HSS Shangus'}</div>
                  </div>
                )}

                {/* Signatory 2: Checked By (Shown for TC/DC or when 3 signatories exist) */}
                {isTcDcActive && (
                  <div className="w-28 sm:w-36 text-center">
                    <div className="border-b-2 border-slate-800 mb-1"></div>
                    <div className="font-black text-[9.5px] uppercase tracking-tight text-slate-800">{signatoryCenter || 'Checked By'}</div>
                    <div className="text-[7.5px] sm:text-[8px] text-slate-500 font-bold">{signatorySubtext || institutionName || 'Govt. HSS Shangus'}</div>
                  </div>
                )}

                {/* Signatory 3: Principal */}
                <div className={`w-28 sm:w-36 text-center ${!showLeftSignatory && !isTcDcActive ? 'ml-auto' : ''}`}>
                  <div className="border-b-2 border-[#800000] mb-1"></div>
                  <div className="font-black text-[9.5px] uppercase tracking-tight text-[#800000]">{signatoryRight || 'Principal'}</div>
                  <div className="text-[7.5px] sm:text-[8px] text-slate-500 font-bold">{signatorySubtext || institutionName || 'Govt. HSS Shangus'}</div>
                </div>
              </div>

              {/* Interactive Preview of Office Copy Receipt Box when TC/DC is Active */}
              {isTcDcActive && isDualCopy && (
                <div className="flex justify-center" style={{ marginTop: `${sigReceiptGap}px` }}>
                  <div className="relative pt-2 w-fit max-w-[460px]">
                    <div className="absolute top-0 left-4 bg-slate-100 border border-slate-300 text-rose-600 font-black text-[8px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs z-10">
                      Receipt by Student (Page 2 Office Copy)
                    </div>
                    <div className="p-3 px-6 rounded-xl bg-amber-50/90 border border-amber-300 font-sans shadow-2xs text-center">
                      <div className="text-[9.5px] font-bold text-slate-800">
                        Received <strong>'Discharge cum Character Certificate'</strong> in Original
                      </div>
                      <div className="flex justify-center items-end gap-6 text-[9px] mt-4">
                        <div className="flex items-end gap-2">
                          <span className="font-bold text-slate-700 whitespace-nowrap">today on</span>
                          <div className="w-24 border-b-2 border-slate-600"></div>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="font-bold text-slate-700 whitespace-nowrap">Signature</span>
                          <div className="w-32 border-b-2 border-slate-600"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* ── DRAGGABLE VERTICAL SPLITTER HANDLE ── */}
        {isDesktop && (
          <div
            onMouseDown={handleSplitterMouseDown}
            title="Drag horizontally to adjust workspace split width (Double-click to reset)"
            onDoubleClick={() => {
              setLeftSplitPct(67);
              try { localStorage.setItem('hss_cert_preview_split_pct', '67'); } catch {}
            }}
            className="hidden lg:flex flex-col items-center justify-center w-3.5 self-stretch cursor-col-resize hover:bg-teal-400/20 active:bg-teal-600/30 group transition-colors z-20 shrink-0 mx-0.5"
          >
            <div className={`w-1 rounded-full transition-all group-hover:w-1.5 group-hover:bg-teal-700 sticky top-1/2 -translate-y-1/2 ${isDraggingSplitter ? 'bg-teal-700 w-1.5 h-full shadow-md' : 'bg-slate-300 dark:bg-slate-700 h-24'}`} />
          </div>
        )}

        {/* == == == == == == == == RIGHT HALF: UNIFIED TOOLS & FILTERS CARD (DESKTOP) == == == == == == == == */}
        {isDesktop && (
          <div
            style={{ width: isDesktop ? `calc(${100 - leftSplitPct}% - 9px)` : '100%' }}
            className="w-full lg:w-auto shrink-0 pl-0 lg:pl-1 min-w-0 lg:sticky lg:top-1 self-start"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-xs p-2.5 space-y-2 flex flex-col max-h-[calc(100dvh-95px)] min-h-[580px] overflow-hidden text-xs">
              
              {/* ─── PINNED TOOLS & FORMATTING TOOLBAR ─── */}
              <div className="space-y-1.5 pb-2 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
                {/* Row 1: Document Actions */}
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePrint}
                      disabled={isIssuingTcDc || isExportingDocx}
                      className="h-7 px-2 rounded-lg bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 text-white font-bold text-[10px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                      title="Print or Save Certificate as PDF"
                    >
                      {isIssuingTcDc ? <RefreshCw size={11} className="animate-spin" /> : <Printer size={12} />}
                      <span>Print</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExportingDocx || isIssuingTcDc}
                      onClick={handleExportDocx}
                      className="h-7 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                      title="Download editable Word Document (.docx)"
                    >
                      {isExportingDocx ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={12} />}
                      <span>Word</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleQuickUpdateTemplate}
                      className="h-7 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-[10px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                      title="Save & Overwrite active template in Cloud"
                    >
                      <Save size={12} />
                      <span>Save</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Student Photo Toggle */}
                    <button
                      type="button"
                      onClick={() => handleTogglePhoto()}
                      className={`h-7 px-1.5 rounded-lg flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-all border ${
                        showPhoto
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                      title={`Student Photo: ${showPhoto ? 'ON (Click to hide)' : 'OFF (Click to show)'}`}
                    >
                      {isFetchingPhoto ? (
                        <RefreshCw size={11} className="animate-spin text-teal-600" />
                      ) : (
                        <ImageIcon size={12} className={showPhoto ? 'text-teal-600' : 'text-slate-400'} />
                      )}
                      <span>Photo</span>
                    </button>

                    {/* Insert Field Dropdown Popout */}
                    <div className="relative" ref={insertFieldDropdownRef}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setShowInsertFieldDropdown(!showInsertFieldDropdown);
                          setShowAskGeminiMenu(false);
                        }}
                        className="h-7 px-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        title="Insert student database fields at cursor"
                      >
                        <PlusCircle size={12} />
                        <span>Field</span>
                      </button>

                      {showInsertFieldDropdown && (
                    <div className={`absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[999999] p-2 space-y-1 text-xs animate-fadeIn divide-y divide-slate-100 dark:divide-slate-800 max-h-[75vh] overflow-y-auto`}>
                      <div className="px-1.5 py-1 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider">
                          <PlusCircle size={10} className="text-teal-600" />
                          <span>Insert Student Field</span>
                        </div>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setShowInsertFieldDropdown(false); setShowFieldManagerModal(true); }}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-teal-700 dark:text-teal-300 hover:bg-slate-200 text-[9px] font-extrabold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                          title="Edit or add temporary dynamic field values"
                        >
                          <Sliders size={9} />
                          <span>✍️ Edit Values</span>
                        </button>
                      </div>

                      {/* Group 1: Student & Parents */}
                      <div className="pt-1 space-y-0.5">
                        <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Student & Parents</div>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{STUDENT_NAME}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Student Name</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{studentName || '{STUDENT_NAME}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{FATHER_NAME}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Father's Name</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{fatherName || '{FATHER_NAME}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{MOTHER_NAME}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Mother's Name</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{motherName || '{MOTHER_NAME}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{GENDER_TITLE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Student Title (Mr./Ms.)</span>
                          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{includeSalutations ? (gender === 'F' ? 'Ms.' : 'Mr.') : 'Hidden'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{FATHER_TITLE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Father Title (Mr.)</span>
                          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{includeSalutations ? 'Mr.' : 'Hidden'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{MOTHER_TITLE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Mother Title (Mrs.)</span>
                          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{includeSalutations ? 'Mrs.' : 'Hidden'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{PRONOUN_SON_DAUGHTER}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Son / Daughter</span>
                          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'daughter' : 'son'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{PRONOUN_SO_DO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Relation (S/o / D/o)</span>
                          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'D/o' : 'S/o'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{PRONOUN_HIS_HER}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Possessive (His / Her)</span>
                          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'Her' : 'His'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{PRONOUN_HE_SHE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Pronoun (He / She)</span>
                          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'She' : 'He'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{PRONOUN_HIM_HER}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Object (him / her)</span>
                          <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'her' : 'him'}</span>
                        </button>
                      </div>

                      {/* Group 2: Academic Credentials */}
                      <div className="pt-1 space-y-0.5">
                        <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Class & Roll / Reg</div>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{CLASS}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Class</span>
                          <span className="text-[9px] text-slate-400">{className || '{CLASS}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{STREAM}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Stream</span>
                          <span className="text-[9px] text-slate-400">{stream || '{STREAM}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{ROLL_NO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Class Roll No</span>
                          <span className="text-[9px] text-slate-400 font-mono">{rollNo || '{ROLL_NO}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{REG_NO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Registration No</span>
                          <span className="text-[9px] text-slate-400 font-mono">{regNo || '{REG_NO}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{ADMISSION_NO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Admission No</span>
                          <span className="text-[9px] text-slate-400 font-mono">{admissionNo || '{ADMISSION_NO}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{ADMISSION_DATE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Admission Date</span>
                          <span className="text-[9px] text-slate-400 font-mono">{admissionDate || '{ADMISSION_DATE}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{SESSION}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Academic Session</span>
                          <span className="text-[9px] text-slate-400">{session || '{SESSION}'}</span>
                        </button>
                      </div>

                      {/* Group 3: DOB & Address */}
                      <div className="pt-1 space-y-0.5">
                        <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">DOB & Residence</div>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{DOB_FIGURES}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>DOB (DD-MM-YYYY)</span>
                          <span className="text-[9px] text-slate-400">{parsedDob?.figures || '{DOB_FIGURES}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{DOB_WORDS}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>DOB (in Words)</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{parsedDob?.words || '{DOB_WORDS}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{ADDRESS}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Full Address</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{address || '{ADDRESS}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{VILLAGE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Village / Town</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{resolveStudentLocality(selectedStudent, selectedStudent?.raw || selectedStudent, address).village || '{VILLAGE}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{TEHSIL}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Tehsil</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{resolveStudentLocality(selectedStudent, selectedStudent?.raw || selectedStudent, address).tehsil || '{TEHSIL}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{DISTRICT}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>District</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{resolveStudentLocality(selectedStudent, selectedStudent?.raw || selectedStudent, address).district || '{DISTRICT}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{DATE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Certificate Date</span>
                          <span className="text-[9px] text-slate-400">{dateStr || '{DATE}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{REF_NO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Reference / Dispatch No</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{refNo || '{REF_NO}'}</span>
                        </button>
                      </div>

                      {/* Group 4: TC/DC & Exam Results */}
                      <div className="pt-1 space-y-0.5">
                        <div className="px-2 text-[8.5px] font-bold text-amber-600 dark:text-amber-400 uppercase">TC/DC & JKBOSE Exam</div>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{EXAM_ROLL_NO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Exam / Board Roll No</span>
                          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{tcExamRoll || '{EXAM_ROLL_NO}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{EXAM_SESSION}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Exam Session</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{tcExamMode || session || '{EXAM_SESSION}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{RESULT_STATUS}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Result Status</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{tcResultStatus || '{RESULT_STATUS}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{MARKS_OBTAINED}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Marks Obtained</span>
                          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{tcMarksObtained || '{MARKS_OBTAINED}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{MAX_MARKS}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Max Marks</span>
                          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{tcMaxMarks || '500'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{DIVISION_DISTINCTION}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Division / Distinction</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{tcDivision || '{DIVISION_DISTINCTION}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder('{WITHDRAWAL_DATE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Withdrawal Date</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{withdrawalDate || '{WITHDRAWAL_DATE}'}</span>
                        </button>
                      </div>

                      {/* Group 5: Student Database Fields */}
                      <div className="pt-1 space-y-0.5">
                        <div className="px-2 text-[8.5px] font-bold text-teal-700 dark:text-teal-400 uppercase flex items-center justify-between">
                          <span>Database Fields</span>
                          <span className="text-[7.5px] text-slate-400 font-normal">From Record</span>
                        </div>
                        {FIRESTORE_PRESET_FIELDS.slice(0, 8).map((preset) => {
                          const studentVal = findValueInStudentRaw(selectedStudent, preset.keys);
                          const tokenName = `{${preset.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { handleInsertPlaceholder(tokenName); setShowInsertFieldDropdown(false); }}
                              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                            >
                              <span className="truncate">{preset.label}</span>
                              <span className="text-[9px] text-slate-400 truncate max-w-[120px] font-mono">
                                {studentVal || tokenName}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Bottom Quick Manager Link */}
                      <div className="pt-1.5 pb-0.5">
                        <button
                          type="button"
                          onClick={() => { setShowInsertFieldDropdown(false); setShowFieldManagerModal(true); }}
                          className="w-full py-1 px-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[10px] flex items-center justify-center gap-1 cursor-pointer shadow-2xs transition-all"
                        >
                          <PlusCircle size={10} />
                          <span>➕ Manage / Edit Custom & DB Fields</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>



                {/* Save As New Template */}
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="h-7 px-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-[10px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                  title="Save Certificate format as reusable template"
                >
                  <BookmarkPlus size={11} className="text-purple-600 dark:text-purple-400" />
                  <span>+ Template</span>
                </button>

                {/* History / Archive */}
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="h-7 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-[10px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                  title="Browse past generated documents archive"
                >
                  <History size={11} className="text-indigo-600 dark:text-indigo-400" />
                  <span>History</span>
                </button>
              </div>
            </div>

                {/* Row 2: Rich Text & Formatting */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Undo (Ctrl+Z)"
                      disabled={!canUndo}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { handleUndo(); setTimeout(checkActiveFormats, 50); }}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${canUndo ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'}`}
                    >
                      <Undo size={11} />
                    </button>
                    <button
                      type="button"
                      title="Redo (Ctrl+Y)"
                      disabled={!canRedo}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { handleRedo(); setTimeout(checkActiveFormats, 50); }}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${canRedo ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'}`}
                    >
                      <Redo size={11} />
                    </button>
                  </div>

                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Normal Body Paragraph (¶)"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('formatBlock', '<p>')}
                      className={`w-6 h-6 rounded font-black text-[9px] flex items-center justify-center cursor-pointer transition-all ${activeFormats.p ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      ¶
                    </button>
                    <button
                      type="button"
                      title="Heading 1"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('formatBlock', '<h1>')}
                      className={`w-6 h-6 rounded font-black text-[9px] flex items-center justify-center cursor-pointer transition-all ${activeFormats.h1 ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'}`}
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      title="Heading 2"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('formatBlock', '<h2>')}
                      className={`w-6 h-6 rounded font-black text-[9px] flex items-center justify-center cursor-pointer transition-all ${activeFormats.h2 ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'}`}
                    >
                      H2
                    </button>
                  </div>

                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                  {/* Font Size Stepper (A⁻ / Size Select / A⁺) */}
                  <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/80 rounded-md border border-slate-200/70 dark:border-slate-700/70 px-0.5 shadow-2xs" title="Adjust certificate base font or selected text size">
                    <button
                      type="button"
                      title="Decrease Font Size (A⁻)"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAdjustFontSize(-1)}
                      className="w-5 h-5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center cursor-pointer transition-all active:scale-95"
                    >
                      A⁻
                    </button>
                    <select
                      value={baseFontSize}
                      onChange={(e) => handleSetFontSize(e.target.value)}
                      title="Certificate Base / Selection Font Size"
                      className="h-5 px-0.5 bg-transparent text-[10px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    >
                      {FONT_SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Increase Font Size (A⁺)"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAdjustFontSize(1)}
                      className="w-5 h-5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center cursor-pointer transition-all active:scale-95"
                    >
                      A⁺
                    </button>
                  </div>

                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Bold (Ctrl+B)"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('bold')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.bold ? 'bg-teal-100 text-teal-900 font-black border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                    >
                      <Bold size={11} />
                    </button>
                    <button
                      type="button"
                      title="Italic (Ctrl+I)"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('italic')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.italic ? 'bg-teal-100 text-teal-900 font-black border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                    >
                      <Italic size={11} />
                    </button>
                    <button
                      type="button"
                      title="Underline (Ctrl+U)"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('underline')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.underline ? 'bg-teal-100 text-teal-900 font-black border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                    >
                      <Underline size={11} />
                    </button>
                    <button
                      type="button"
                      title="Strikethrough"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('strikethrough')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.strikeThrough ? 'bg-teal-100 text-teal-900 font-black border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                    >
                      <Strikethrough size={11} />
                    </button>
                  </div>

                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                  {/* Color Palette Popout */}
                  <div className="relative" ref={colorMenuRef}>
                    <button
                      type="button"
                      title="Text Color Palette"
                      onMouseDown={(e) => { e.preventDefault(); saveCurrentSelection(); }}
                      onClick={() => { saveCurrentSelection(); setShowColorMenu(!showColorMenu); }}
                      className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-all"
                    >
                      <Palette size={11} className="text-teal-600" />
                    </button>

                    {showColorMenu && (
                      <div
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 flex items-center gap-1.5 animate-fadeIn"
                      >
                        {[
                          { label: 'Black', color: '#0f172a' },
                          { label: 'Maroon', color: '#800000' },
                          { label: 'Navy Blue', color: '#0a192f' },
                          { label: 'Forest Green', color: '#065f46' },
                          { label: 'Slate Gray', color: '#475569' },
                          { label: 'Crimson', color: '#dc2626' }
                        ].map(c => (
                          <button
                            key={c.color}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { applyTextColor(c.color); setShowColorMenu(false); }}
                            title={c.label}
                            className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs hover:scale-125 transition-transform cursor-pointer"
                            style={{ backgroundColor: c.color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                  {/* Alignment */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Align Left"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('justifyLeft')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.justifyLeft ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <AlignLeft size={11} />
                    </button>
                    <button
                      type="button"
                      title="Align Center"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('justifyCenter')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.justifyCenter ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <AlignCenter size={11} />
                    </button>
                    <button
                      type="button"
                      title="Align Right"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('justifyRight')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.justifyRight ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <AlignRight size={11} />
                    </button>
                    <button
                      type="button"
                      title="Justify Full"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('justifyFull')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.justifyFull ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <AlignJustify size={11} />
                    </button>
                  </div>

                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                  {/* Lists */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Bulleted List"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('insertUnorderedList')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.insertUnorderedList ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <List size={11} />
                    </button>
                    <button
                      type="button"
                      title="Numbered List"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => executeFormat('insertOrderedList')}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${activeFormats.insertOrderedList ? 'bg-teal-100 text-teal-900 border border-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <ListOrdered size={11} />
                    </button>
                  </div>

                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                  {/* Table Tool Popout */}
                  <div className="relative" ref={tableMenuRef}>
                    <button
                      type="button"
                      title="Insert or Edit Table"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { checkTableContext(); setShowTableMenu(!showTableMenu); }}
                      className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${activeTableContext || (editorRef.current && editorRef.current.querySelector('table')) ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 border border-teal-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <TableIcon size={11} />
                    </button>

                    {showTableMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 w-64 space-y-2 animate-fadeIn"
                      >
                        {/* Segmented Mode Switcher */}
                        <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setTableMenuTab('insert')}
                            className={`flex-1 py-1 px-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              tableMenuTab === 'insert'
                                ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            <span>➕ Insert</span>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setTableMenuTab('edit')}
                            className={`flex-1 py-1 px-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              tableMenuTab === 'edit'
                                ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            <span>⚙️ Edit Table</span>
                            {activeTableContext && (
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                            )}
                          </button>
                        </div>

                        {/* ─── INSERT TAB ─── */}
                        {tableMenuTab === 'insert' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Quick Presets</span>
                              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-bold">1-Click</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertTable(2, 3)}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:bg-teal-50/60 dark:hover:bg-teal-950/40 text-left transition-all group cursor-pointer"
                              >
                                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                                  3 × 2 Details
                                </div>
                                <div className="text-[8.5px] text-slate-400 font-mono">Standard 3 cols</div>
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertTable(3, 3)}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:bg-teal-50/60 dark:hover:bg-teal-950/40 text-left transition-all group cursor-pointer"
                              >
                                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                                  3 × 3 Marks Grid
                                </div>
                                <div className="text-[8.5px] text-slate-400 font-mono">9 cells grid</div>
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertTable(2, 2)}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:bg-teal-50/60 dark:hover:bg-teal-950/40 text-left transition-all group cursor-pointer"
                              >
                                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                                  2 × 2 Two Column
                                </div>
                                <div className="text-[8.5px] text-slate-400 font-mono">Compact layout</div>
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertTable(3, 4)}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:bg-teal-50/60 dark:hover:bg-teal-950/40 text-left transition-all group cursor-pointer"
                              >
                                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                                  4 × 3 Subjects
                                </div>
                                <div className="text-[8.5px] text-slate-400 font-mono">Grades / Marks</div>
                              </button>
                            </div>

                            {/* Custom Dimensions */}
                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Custom Dimensions</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                                <div className="flex-1 flex items-center justify-between bg-white dark:bg-slate-900 px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <span className="text-[9px] font-bold text-slate-500">Rows</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => setCustomTableRows(Math.max(1, customTableRows - 1))}
                                      className="w-4 h-4 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="text-[10px] font-black w-3 text-center">{customTableRows}</span>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => setCustomTableRows(Math.min(15, customTableRows + 1))}
                                      className="w-4 h-4 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                <span className="text-slate-400 font-bold text-xs">×</span>
                                <div className="flex-1 flex items-center justify-between bg-white dark:bg-slate-900 px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <span className="text-[9px] font-bold text-slate-500">Cols</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => setCustomTableCols(Math.max(1, customTableCols - 1))}
                                      className="w-4 h-4 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="text-[10px] font-black w-3 text-center">{customTableCols}</span>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => setCustomTableCols(Math.min(10, customTableCols + 1))}
                                      className="w-4 h-4 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertTable(customTableRows, customTableCols)}
                                className="w-full py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                              >
                                <span>Insert {customTableCols} × {customTableRows} Table</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ─── EDIT TAB ─── */}
                        {tableMenuTab === 'edit' && (
                          <div className="space-y-1.5">
                            {/* Prominent Action to insert another table directly below */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => insertTable(2, 3)}
                              className="w-full py-1.5 px-2 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>➕ Insert Another Table Below</span>
                            </button>

                            {!activeTableContext && !editorRef.current?.querySelector('table') ? (
                              <div className="p-3 text-center space-y-1.5">
                                <div className="text-[10px] text-slate-500">No table in document yet.</div>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => setTableMenuTab('insert')}
                                  className="px-2.5 py-1 bg-teal-50 text-teal-700 text-[10px] font-bold rounded-lg border border-teal-200 hover:bg-teal-100"
                                >
                                  ➕ Insert a Table
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="px-1.5 py-0.5 text-[9px] font-black uppercase text-teal-600 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                  <span>Active Table Controls</span>
                                  <span className="text-[8px] bg-teal-100 text-teal-800 px-1 py-0.2 rounded font-mono">
                                    {activeTableContext?.totalCols || 3}C × {activeTableContext?.totalRows || 2}R
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-1">
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => { insertTableColumn(false); setShowTableMenu(false); }}
                                    className="text-left px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px] font-bold border border-teal-200"
                                  >
                                    + Col Right
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => { insertTableColumn(true); setShowTableMenu(false); }}
                                    className="text-left px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px] font-bold border border-teal-200"
                                  >
                                    + Col Left
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { deleteTableColumn(); setShowTableMenu(false); }}
                                  className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-50 text-rose-700 text-[10px] border border-rose-100"
                                >
                                  - Delete Col
                                </button>
                                <div className="grid grid-cols-2 gap-1">
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => { insertTableRow(false); setShowTableMenu(false); }}
                                    className="text-left px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px] font-bold border border-teal-200"
                                  >
                                    + Row Below
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => { insertTableRow(true); setShowTableMenu(false); }}
                                    className="text-left px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px] font-bold border border-teal-200"
                                  >
                                    + Row Above
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { deleteTableRow(); setShowTableMenu(false); }}
                                  className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-50 text-rose-700 text-[10px] border border-rose-100"
                                >
                                  - Delete Row
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { deleteEntireTable(); setShowTableMenu(false); }}
                                  className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200 flex items-center justify-between"
                                >
                                  <span>🗑️ Delete Table</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    title="Insert Horizontal Divider Line"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={insertHorizontalRule}
                    className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                  >
                    <Minus size={11} />
                  </button>

                  <button
                    type="button"
                    title="Clear Text Formatting"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeFormat('removeFormat')}
                    className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                  >
                    <RemoveFormatting size={11} />
                  </button>
                </div>
              </div>


              {/* ─── SCROLLABLE FILTERS & TEMPLATES CONTENT ─── */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0">
                {renderStudentAndTemplateSelector()}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Sleek Right-Click Placeholder & Formatting Context Menu ── */}
      {showContextMenu && (
        <>
          {/* Click-outside backdrop overlay */}
          <div
            className="fixed inset-0 z-[999990] bg-black/25 backdrop-blur-[0.5px]"
            onClick={() => setShowContextMenu(false)}
          />

          <div
            style={
              typeof window !== 'undefined' && window.innerWidth < 768
                ? { bottom: '16px', left: '50%', transform: 'translateX(-50%)', maxHeight: '68vh' }
                : { top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px`, maxHeight: '72vh' }
            }
            className="fixed z-[999999] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl p-2 w-72 max-w-[calc(100vw-1.5rem)] space-y-1 text-xs animate-fadeIn divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-1.5 py-1 flex items-center justify-between text-[10.5px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider">
              <span className="flex items-center gap-1.5">
                <PlusCircle size={12} className="text-teal-600 dark:text-teal-400" />
                <span>Insert Student Field</span>
              </span>
              <button
                type="button"
                onClick={() => setShowContextMenu(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>

          {/* Group 1: Student & Parents */}
          <div className="pt-1 space-y-0.5">
            <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Student & Parents</div>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{STUDENT_NAME}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Student Name</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{studentName || '{STUDENT_NAME}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{FATHER_NAME}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Father's Name</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{fatherName || '{FATHER_NAME}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{MOTHER_NAME}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Mother's Name</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{motherName || '{MOTHER_NAME}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{GENDER_TITLE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Student Title (Mr./Ms.)</span>
              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{includeSalutations ? (gender === 'F' ? 'Ms.' : 'Mr.') : 'Hidden'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{FATHER_TITLE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Father Title (Mr.)</span>
              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{includeSalutations ? 'Mr.' : 'Hidden'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{MOTHER_TITLE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Mother Title (Mrs.)</span>
              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{includeSalutations ? 'Mrs.' : 'Hidden'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{PRONOUN_SON_DAUGHTER}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Son / Daughter</span>
              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'daughter' : 'son'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{PRONOUN_SO_DO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Relation (S/o / D/o)</span>
              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'D/o' : 'S/o'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{PRONOUN_HIS_HER}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Possessive (His / Her)</span>
              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'Her' : 'His'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{PRONOUN_HE_SHE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Pronoun (He / She)</span>
              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'She' : 'He'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{PRONOUN_HIM_HER}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Object (him / her)</span>
              <span className="text-[9px] text-teal-600 dark:text-teal-400 font-mono">{gender === 'F' ? 'her' : 'him'}</span>
            </button>
          </div>

          {/* Group 2: Academic & Registration */}
          <div className="pt-1 space-y-0.5">
            <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Class & Roll / Reg</div>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{CLASS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Class</span>
              <span className="text-[9px] text-slate-400">{className || '{CLASS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{STREAM}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Stream</span>
              <span className="text-[9px] text-slate-400">{stream || '{STREAM}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{ROLL_NO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Class Roll No</span>
              <span className="text-[9px] text-slate-400">{rollNo || '{ROLL_NO}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{REG_NO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Registration No</span>
              <span className="text-[9px] text-slate-400 font-mono">{regNo || '{REG_NO}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{ADMISSION_NO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Admission No</span>
              <span className="text-[9px] text-slate-400 font-mono truncate max-w-[100px]">{admissionNo || '{ADMISSION_NO}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{ADMISSION_DATE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Admission Date</span>
              <span className="text-[9px] text-slate-400 font-mono truncate max-w-[100px]">{admissionDate || '{ADMISSION_DATE}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{SESSION}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Academic Session</span>
              <span className="text-[9px] text-slate-400">{session || '{SESSION}'}</span>
            </button>
          </div>

          {/* Group 3: DOB & Address */}
          <div className="pt-1 space-y-0.5">
            <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">DOB & Residence</div>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{DOB_FIGURES}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>DOB (in Figures)</span>
              <span className="text-[9px] text-slate-400">{parsedDob?.figures || '{DOB_FIGURES}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{DOB_WORDS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>DOB (in Words)</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{parsedDob?.words || '{DOB_WORDS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{ADDRESS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Permanent Address</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{address || '{ADDRESS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{VILLAGE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Village / Town</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{resolveStudentLocality(selectedStudent, selectedStudent?.raw || selectedStudent, address).village || '{VILLAGE}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{TEHSIL}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Tehsil</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{resolveStudentLocality(selectedStudent, selectedStudent?.raw || selectedStudent, address).tehsil || '{TEHSIL}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{DISTRICT}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>District</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{resolveStudentLocality(selectedStudent, selectedStudent?.raw || selectedStudent, address).district || '{DISTRICT}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{DATE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Certificate Date</span>
              <span className="text-[9px] text-slate-400">{dateStr || '{DATE}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder('{REF_NO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Reference No</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{refNo || '{REF_NO}'}</span>
            </button>
          </div>

          {/* Group 4: Custom Dynamic Fields in Context Menu */}
          {customFields.length > 0 && (
            <div className="pt-1 space-y-0.5 border-t border-slate-100 dark:border-slate-800">
              <div className="px-2 text-[8.5px] font-bold text-amber-600 dark:text-amber-400 uppercase">Custom Fields</div>
              {customFields.map((cf) => (
                <button
                  key={cf.id}
                  type="button"
                  onClick={() => handleInsertPlaceholder(`{${cf.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`)}
                  className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{cf.label}</span>
                  <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{cf.value || '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </>
      )}

      {/* ── Sub-Modal: Save / Update Custom Certificate Template ── */}
      {showSaveTemplateModal && (() => {
        const activeTpl = allTemplatesList.find(t => t.id === selectedTemplateId) || BUILTIN_CERTIFICATE_TEMPLATES[0];
        return (
          <div className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-teal-300 dark:border-teal-900/80 p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-teal-600 text-white shadow-md">
                    <BookmarkPlus size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white m-0">
                      Save / Update Certificate Template
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium m-0">
                      Overwrite current template or create a new reusable certificate format.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Segmented Mode Selector: Update Current vs Save New */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTemplateSaveMode('update')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    templateSaveMode === 'update'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <RefreshCw size={11} className={templateSaveMode === 'update' ? 'animate-spin-slow' : ''} />
                  <span>Update Current ({activeTpl.name.split(' ')[0]}...)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplateSaveMode('new')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    templateSaveMode === 'new'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <PlusCircle size={11} />
                  <span>Save as New</span>
                </button>
              </div>

              <form onSubmit={handleSaveCustomTemplate} className="space-y-3 text-xs">
                {templateSaveMode === 'update' ? (
                  <div className="p-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-teal-900 dark:text-teal-200 text-xs">
                        Target: {activeTpl.name}
                      </span>
                      <span className="text-[9.5px] font-bold text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/60">
                        {activeTpl.category || 'Bonafide Certificates'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-teal-800 dark:text-teal-300 leading-relaxed m-0">
                      This will overwrite this template in the cloud database with your current text, layout, and signatories. Future student certificates loaded with this template will immediately use your updated wording.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Template Name</label>
                      <input
                        type="text"
                        required
                        value={newTplName}
                        onChange={(e) => setNewTplName(e.target.value)}
                        placeholder="e.g. Merit Bonafide / Sports Character Certificate"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Category</label>
                      <select
                        value={newTplCategory}
                        onChange={(e) => setNewTplCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                      >
                        <option value="Bonafide & Age Certificates">Bonafide & Age Certificates</option>
                        <option value="Character & Conduct Certificates">Character & Conduct Certificates</option>
                        <option value="Admission & Enrollment">Admission & Enrollment</option>
                        <option value="Transfer & Migration">Transfer & Migration</option>
                        <option value="Sports & Extra-Curricular">Sports & Extra-Curricular</option>
                        <option value="Custom Certificates">Custom Certificates</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Set as Default Checkbox */}
                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={makeTemplateDefault}
                    onChange={(e) => setMakeTemplateDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 accent-teal-600 cursor-pointer shrink-0"
                  />
                  <div className="text-xs">
                    <span className="font-black text-amber-950 dark:text-amber-200 block">⭐  Make Default Active Template</span>
                    <span className="text-[10px] text-amber-800 dark:text-amber-400 block">Auto-loads on studio launch and saves directly to Cloud Database.</span>
                  </div>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <Save size={13} />
                    <span>{templateSaveMode === 'update' ? 'Overwrite & Update Template' : 'Save New Template'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      {/* == == == == == == == ==  EDIT DYNAMIC FIELDS & TEMPORARY OVERRIDES MODAL == == == == == == == ==  */}
      {showFieldManagerModal && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[88vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black shrink-0">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2 m-0">
                    <span>Edit Dynamic Field Values</span>
                    <span className="text-[9.5px] px-2.5 py-0.5 rounded-full font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      Temporary Overrides
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">
                    Edits apply only to this certificate session. Database in Firebase will not be modified.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldManagerModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Standard Student Fields Grid */}
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider flex items-center justify-between flex-wrap gap-1.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                  <span>1. Standard Student Fields</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleSalutations(!includeSalutations)}
                    className={`text-[9.5px] font-extrabold flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-md border transition-all ${
                      includeSalutations
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 line-through'
                    }`}
                    title="Toggle to show or hide Mr. / Ms. / Mrs. prefixes on the certificate"
                  >
                    {includeSalutations ? <Eye size={10} className="text-teal-600 dark:text-teal-400" /> : <EyeOff size={10} className="text-slate-400" />}
                    <span>{includeSalutations ? 'Mr./Mrs. Titles: ON' : 'Mr./Mrs. Titles: OFF'}</span>
                  </button>
                  {selectedStudent && (
                    <button
                      type="button"
                      onClick={handleResetFieldsToStudent}
                      className="text-[9.5px] font-extrabold text-teal-600 hover:text-teal-800 dark:text-teal-400 flex items-center gap-1 cursor-pointer bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800"
                    >
                      <RefreshCw size={9} />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-extrabold uppercase text-slate-400">Student Name</label>
                    <span className="text-[8.5px] font-mono text-teal-600 dark:text-teal-400 font-bold">
                      {includeSalutations ? (gender === 'F' ? 'Ms.' : 'Mr.') : 'No Title'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => { setStudentName(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-extrabold uppercase text-slate-400">Father's Name</label>
                    <span className="text-[8.5px] font-mono text-teal-600 dark:text-teal-400 font-bold">
                      {includeSalutations ? 'Mr.' : 'No Title'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => { setFatherName(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-extrabold uppercase text-slate-400">Mother's Name</label>
                    <span className="text-[8.5px] font-mono text-teal-600 dark:text-teal-400 font-bold">
                      {includeSalutations ? 'Mrs.' : 'No Title'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => { setMotherName(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Class</label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => { setClassName(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Stream</label>
                  <input
                    type="text"
                    value={stream}
                    onChange={(e) => { setStream(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Class Roll No</label>
                  <input
                    type="text"
                    value={rollNo}
                    onChange={(e) => { setRollNo(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Registration No</label>
                  <input
                    type="text"
                    value={regNo}
                    onChange={(e) => { setRegNo(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={session}
                    onChange={(e) => { setSession(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => { setGender(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  >
                    <option value="">Select gender (required for pronouns)</option>
                    <option value="M">Male (Mr. / He / Son)</option>
                    <option value="F">Female (Ms. / She / Daughter)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Date of Birth (DOB)</label>
                  <input
                    type="text"
                    value={dobRaw}
                    onChange={(e) => { setDobRaw(e.target.value); setCustomCanvasHtml(null); }}
                    placeholder="YYYY-MM-DD or DD/MM/YYYY"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Permanent Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-amber-600 dark:text-amber-400 mb-1">Withdrawal / Result Date</label>
                  <input
                    type="text"
                    value={withdrawalDate}
                    onChange={(e) => { setWithdrawalDate(e.target.value); setCustomCanvasHtml(null); }}
                    placeholder="YYYY-MM-DD or DD/MM/YYYY"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/40 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* DOB Words Live Result Pill */}
              <div className="p-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs flex items-center justify-between gap-2 mt-1.5">
                <span className="font-bold text-indigo-900 dark:text-indigo-200">
                  DOB in Words: <span className="font-black italic text-indigo-700 dark:text-indigo-300">{parsedDob.words}</span>
                </span>
                <span className="text-[10px] font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-700 font-bold shadow-2xs">
                  {parsedDob.figures}
                </span>
              </div>
            </div>

            {/* Custom Dynamic Fields Section (Add / Remove & Pick from Database) */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} />
                  <span>2. Custom & Database Fields</span>
                </div>
                <span className="text-[9.5px] font-bold text-slate-400">
                  {customFields.length} custom fields active
                </span>
              </div>

              {/* Standard Database Quick-Pick Badges */}
              <div className="p-3 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
                <div className="flex items-center justify-between text-[9px] font-black uppercase text-teal-800 dark:text-teal-300">
                  <span>Pick from Database Fields</span>
                  <span className="text-[8.5px] font-normal text-slate-500">Auto-filled from selected student record</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {FIRESTORE_PRESET_FIELDS.map((preset) => {
                    const studentVal = findValueInStudentRaw(selectedStudent, preset.keys);
                    const isAdded = customFields.some(f => f.label.toLowerCase() === preset.label.toLowerCase());

                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handlePickFirestoreField(preset.label, studentVal)}
                        className={`px-2.5 py-1 rounded-lg text-[9.5px] font-bold border flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                          isAdded
                            ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-teal-100/60 dark:hover:bg-teal-950/80 hover:border-teal-400'
                        }`}
                        title={studentVal ? `Value: ${studentVal}` : 'Click to add field'}
                      >
                        <span>{isAdded ? '✓' : '➕'} {preset.label}</span>
                        {studentVal && (
                          <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-mono truncate max-w-[90px] ${
                            isAdded ? 'bg-teal-800 text-teal-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {studentVal}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Extra Raw Record Fields Dropdown */}
                {availableRawFirestoreFields.length > 0 && (
                  <div className="pt-2 flex items-center gap-2 border-t border-teal-200/50 dark:border-teal-800/40">
                    <span className="text-[9px] font-extrabold text-slate-500 whitespace-nowrap">More from Student Record:</span>
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const item = availableRawFirestoreFields.find(f => f.key === e.target.value);
                        if (item) handlePickFirestoreField(item.label, item.value);
                        e.target.value = '';
                      }}
                      defaultValue=""
                      className="flex-1 px-2.5 py-1 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 font-bold text-xs text-teal-900 dark:text-teal-200"
                    >
                      <option value="" disabled>-- Select attribute from student record --</option>
                      {availableRawFirestoreFields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}: {f.value}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* List of Currently Active Custom Fields */}
              {customFields.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="px-1 text-[8.5px] font-black uppercase text-slate-400 tracking-wider">
                    Active Custom & Database Fields (Editable)
                  </div>
                  {customFields.map((cf) => {
                    const tokenName = `{${cf.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`;
                    return (
                      <div key={cf.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <div className="w-1/3">
                          <input
                            type="text"
                            value={cf.label}
                            onChange={(e) => handleUpdateCustomField(cf.id, 'label', e.target.value)}
                            placeholder="Field Label"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                          />
                          <span className="text-[8px] font-mono text-slate-400 block truncate mt-0.5">{tokenName}</span>
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={cf.value}
                            onChange={(e) => handleUpdateCustomField(cf.id, 'value', e.target.value)}
                            placeholder="Field Value (e.g. 1234567890)"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomField(cf.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                          title="Remove this custom field"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Manual Custom Field Entry Form */}
              <form onSubmit={handleAddCustomField} className="flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <input
                  type="text"
                  value={newCustomFieldName}
                  onChange={(e) => setNewCustomFieldName(e.target.value)}
                  placeholder="Or type custom field name (e.g. Conduct Grade, Sports)"
                  className="w-1/2 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={newCustomFieldValue}
                  onChange={(e) => setNewCustomFieldValue(e.target.value)}
                  placeholder="Value (e.g. Outstanding)"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!newCustomFieldName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-sm cursor-pointer disabled:opacity-50 shrink-0 transition-all"
                >
                  ➕ Add
                </button>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowFieldManagerModal(false)}
                className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-black text-xs cursor-pointer shadow-md transition-all"
              >
                ✓ Apply Overrides & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* == == == == == == == ==  GEMINI AI CERTIFICATE ASSISTANT MODAL == == == == == == == ==  */}
      {showAiModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/80 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs text-slate-900 dark:text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 text-white flex items-center justify-center shadow-md">
                  <Sparkles size={16} className="text-amber-200" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-purple-950 dark:text-purple-200 m-0">
                    Gemini AI Certificate Assistant
                  </h3>
                  <p className="text-[10px] text-slate-400 m-0">
                    Draft, humanize, formalize, and optimize student certificates with Gemini AI
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-1 rounded-lg font-extrabold text-[10px] border flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                  title="Gemini credentials are managed in the protected Netlify environment"
                >
                  <Shield size={11} />
                  <span>Server-secured AI</span>
                </span>

                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {[
                { id: 'draft', label: '✍️ Draft Certificate' },
                { id: 'humanize', label: '🪄 Polish & Humanize' },
                { id: 'formalize', label: '📜 Formalize Terms' },
                { id: 'shorten', label: '✂️ Shorten Wording' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setAiMode(m.id); setAiGeneratedHtml(''); setAiError(''); }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap cursor-pointer transition-all border ${
                    aiMode === m.id
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Prompt Input & Quick Suggestion Chips */}
            <div className="space-y-1.5">
              <textarea
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={
                  aiMode === 'draft'
                    ? 'What should this certificate certify? (e.g. Certify student passed Class 11th with distinction and displayed exemplary conduct)'
                    : 'Additional refinement notes or specific requirements (optional)'
                }
                className="w-full px-3 py-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 font-medium text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-y min-h-[90px]"
              />

              {/* Quick Suggestion Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {[
                  'Bonafide for Scholarship Application',
                  'Exemplary Character & Conduct',
                  'Provisional Passing Certificate with Distinction',
                  'Migration / Transfer Certificate NOC',
                  'Sports & Co-curricular Merit Achievement'
                ].map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAiPrompt(sug)}
                    className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 hover:text-purple-700 text-slate-600 dark:text-slate-300 text-[9px] font-bold border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer transition-colors"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Model & Tone Selectors */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Gemini AI Model</label>
                <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className="w-full px-2 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs">
                  {AVAILABLE_GEMINI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name.split(' (')[0]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Certificate Tone</label>
                <select value={aiTone} onChange={(e) => setAiTone(e.target.value)} className="w-full px-2 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs">
                  <option value="Formal School">Formal Academic (Standard)</option>
                  <option value="Dignified & Prestigious">Dignified & Commendatory</option>
                  <option value="Meritorious">Meritorious & High Praise</option>
                  <option value="Standard Official">Standard Official</option>
                </select>
              </div>
            </div>

            <button type="button" disabled={isGeneratingAi} onClick={handleGenerateAi} className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-black text-xs cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all active:scale-98">
              {isGeneratingAi ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Drafting Certificate with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-amber-200" />
                  <span>{aiMode === 'draft' ? 'Generate Certificate Text' : 'Refine Certificate Wording'}</span>
                </>
              )}
            </button>
            
            {aiError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0 text-rose-600" />
                <span>{aiError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* == == == == == == == ==  CLOUD DOCUMENT HISTORY & ARCHIVE MODAL == == == == == == == ==  */}
      {showHistoryModal && (
        <ModuleErrorBoundary key="doc-history-modal">
          <React.Suspense fallback={<StudioModalFallback text="Opening Document Archive..." />}>
            <DocumentHistoryModal
              isOpen={true}
              onClose={() => setShowHistoryModal(false)}
              defaultFilter="bonafide"
              onLoadAsDraft={handleLoadDraftFromHistory}
            />
          </React.Suspense>
        </ModuleErrorBoundary>
      )}

      {/* == == == == == == == ==  STUDENT JKBOSE RESULT & TC DETAILS EDITOR MODAL == == == == == == == ==  */}
      {showResultEditorModal && (
        <ModuleErrorBoundary key="result-editor-modal">
          <React.Suspense fallback={<StudioModalFallback text="Opening Result Editor..." />}>
            <StudentResultEditorModal
              isOpen={true}
              onClose={() => setShowResultEditorModal(false)}
              student={selectedStudent}
              onSaveSuccess={(updatedSt) => {
                setSelectedStudent(updatedSt);
                const res = extractStudentResultMarks(updatedSt?.raw || updatedSt);
                setTcMarksObtained(res.marksObtained);
                setTcMaxMarks(res.maxMarks);
                setTcDivision(res.division);
                setTcExamRoll(res.examRoll || updatedSt?.rollNo || '');
                setTcExamMode(res.examMode);
                setTcResultStatus(res.resultStatus);
                setTcReappSubjects(res.reappSubjects);
                if (updatedSt?.withdrawalDate) setWithdrawalDate(updatedSt.withdrawalDate);
                setCustomCanvasHtml(null);
                showToast('✓ Student exam result & TC records updated!', 'success');
              }}
              showToast={showToast}
            />
          </React.Suspense>
        </ModuleErrorBoundary>
      )}

      {/* == == == == == == == ==  JKBOSE RESULT & AI GAZETTE INGESTION HUB MODAL == == == == == == == ==  */}
      {showResultIngestionModal && (
        <ModuleErrorBoundary key="result-ingestion-modal">
          <React.Suspense fallback={<StudioModalFallback text="Opening Result & AI Gazette Ingestion Hub..." />}>
            <ResultIngestionModal
              isOpen={true}
              onClose={() => setShowResultIngestionModal(false)}
              allStudents={combinedStudentPool.length > 0 ? combinedStudentPool : allStudents}
              initialMode="gazette_ai"
              currentSession="2025-26"
              onIngestSuccess={({ records = [], overwriteExamRoll = false } = {}) => {
                const committedRows = records.map(row => ({ ...row, overwriteExamRoll }));
                setRecentIngestedResults(committedRows);
                const selectedRow = committedRows.find(row => ingestionRowMatchesStudent(row, selectedStudent));
                if (selectedRow && selectedStudent) {
                  const updatedStudent = mergeIngestedResultIntoStudent(selectedStudent, selectedRow, overwriteExamRoll);
                  const resultInfo = extractStudentResultMarks(updatedStudent.raw || updatedStudent);
                  setSelectedStudent(updatedStudent);
                  setTcMarksObtained(resultInfo.marksObtained);
                  setTcMaxMarks(resultInfo.maxMarks);
                  setTcDivision(resultInfo.division);
                  setTcExamRoll(resultInfo.examRoll);
                  setTcExamMode(resultInfo.examMode);
                  setTcResultStatus(resultInfo.resultStatus);
                  setTcReappSubjects(resultInfo.reappSubjects);
                  if (selectedRow.withdrawalDate) setWithdrawalDate(selectedRow.withdrawalDate);
                  setCustomCanvasHtml(null);
                }
                showToast('🎉 Ingestion complete! Certificate data refreshed from the synchronized results.', 'success');
              }}
              showToast={showToast}
            />
          </React.Suspense>
        </ModuleErrorBoundary>
      )}

      {/* == == == == == == == ==  BULK TC / DISCHARGE CERTIFICATE GENERATOR MODAL == == == == == == == ==  */}
      {showBulkGeneratorModal && (
        <ModuleErrorBoundary key="bulk-cert-gen-modal">
          <React.Suspense fallback={<StudioModalFallback text="Opening Bulk Certificate Generator..." />}>
            <BulkCertificateGeneratorModal
              isOpen={true}
              onClose={() => setShowBulkGeneratorModal(false)}
              allStudents={combinedStudentPool.length > 0 ? combinedStudentPool : allStudents}
              officeTitle={officeTitle}
              institutionName={institutionName}
              institutionAddress={institutionAddress}
              signatories={signatories}
              showToast={showToast}
            />
          </React.Suspense>
        </ModuleErrorBoundary>
      )}

      {/* == == == == == == == ==  CUSTOM TEMPLATE DELETE CONFIRMATION & WARNING MODAL == == == == == == == ==  */}
      <ConfirmModal
        isOpen={Boolean(templateToDelete)}
        onClose={() => { if (!isDeletingTemplate) setTemplateToDelete(null); }}
        onConfirm={handleConfirmDeleteTemplate}
        title="Delete Custom Template?"
        message={`⚠️   WARNING: You are about to permanently delete "${templateToDelete?.name}". This will remove it from both your local workspace and Firebase Cloud storage. This action cannot be undone.`}
        confirmText="Yes, Delete Permanently"
        cancelText="Cancel / Keep Template"
        type="danger"
        loading={isDeletingTemplate}
      />

      {revokeConfirmConfig && (
        <ConfirmModal
          isOpen={Boolean(revokeConfirmConfig)}
          onClose={() => setRevokeConfirmConfig(null)}
          onConfirm={revokeConfirmConfig.onConfirm}
          title={revokeConfirmConfig.title}
          message={revokeConfirmConfig.message}
          confirmText={revokeConfirmConfig.confirmText}
          type="danger"
          consequence={revokeConfirmConfig.consequence}
          loading={isRevokingSingleCert}
        />
      )}

    </div>
  );
}
