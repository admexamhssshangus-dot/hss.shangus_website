// =================================================================
// HSS SHANGUS — Student Bonafides & Official Certificates Studio
// Dynamic Student Auto-Complete, DOB-to-Words Engine, Template Builder & Multi-Format Exports
// =================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Award, FileSpreadsheet, FileText, Printer, Download, Save,
  Search, Check, Sparkles, UserCheck, Sliders, RefreshCw, X,
  Plus, PlusCircle, ChevronDown, Edit3, Trash2, BookmarkPlus, Eye, EyeOff, Image as ImageIcon,
  User, CheckCircle2, History, RotateCcw, AlertCircle, Info, AlertTriangle,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Table as TableIcon, Undo, Redo, RemoveFormatting, Palette, Minus,
  Bot, Key, Wand2, Shield, ExternalLink, Calendar, Scissors, Copy, Unlock
} from 'lucide-react';
import {
  BUILTIN_CERTIFICATE_TEMPLATES,
  dobToWords,
  interpolateCertificateTemplate,
  printStudentCertificate,
  generateStudentCertificateDocx
} from '../../utils/certificateExportUtils';
import StudentResultEditorModal from './StudentResultEditorModal';
import ResultIngestionModal from './ResultIngestionModal';
import BulkCertificateGeneratorModal from './BulkCertificateGeneratorModal';
import ConfirmModal from '../components/ConfirmModal';
import { fetchLastIssuedCertificateNumber, extractCertificateSerial, commitIssuedCertificateBatch, revokeCertificateNumberBatch } from '../../services/certificateRegistryService';
import {
  normalizeResultStatus,
  calculateDivision,
  extractStudentResultMarks,
  extractStudentAdmissionNumber,
  extractStudentAdmissionDate,
  extractStudentCertificateNumber
} from '../../utils/jkboseResultManager';
import {
  getCachedCollectionSync,
  getCachedCollection,
  getPhotoUrlFromCache,
  resolveStudentPhoto,
  fetchStudentPhotoOnDemand,
  fetchAllMatchingStudentPhotos
} from '../../services/dbCache';
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
  resolveCertificateStream,
  resolveScopedCertificateResult
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
  unpackMasterRegisterStudents
} from './CustomRosterDocumentBuilderView';
import { db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  fetchCloudDocTemplates,
  saveCloudDocTemplate,
  setCloudDefaultTemplate,
  deleteCloudDocTemplate
} from '../../services/docTemplateService';
import { saveGeneratedDocToHistory } from '../../services/docHistoryService';
import { recordApplicationPrint } from '../../services/printTrackerService';
import DocumentHistoryModal from './DocumentHistoryModal';
import TabLoadingOverlay from '../../components/TabLoadingOverlay';
import { scheduleIdleWork } from '../../utils/scheduleIdleWork';

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

  return enriched;
};

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

  const combinedStudentPool = useMemo(() => {
    const primary = Array.isArray(allStudents) && allStudents.length > 0 ? allStudents : (Array.isArray(identityStudents) ? identityStudents : []);
    const list = [...primary];
    if (Array.isArray(masterRegistersList) && masterRegistersList.length > 0) {
      const seenIds = new Set(list.map(s => String(s.formNo || s['Form Number'] || s['Form No.'] || s.boardRegNo || s.id || '').trim()).filter(Boolean));
      masterRegistersList.forEach(m => {
        const key = String(m.formNo || m['Form Number'] || m['Form No.'] || m.boardRegNo || m.id || '').trim();
        if (!key || !seenIds.has(key)) {
          list.push(m);
        }
      });
    }
    return list;
  }, [allStudents, identityStudents, masterRegistersList]);

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

  const [activeCohortFilter, setActiveCohortFilter] = useState('ALL'); // 'ALL' | '12th' | '11th' | '10th' | '9th' | 'present' | 'past'
  const [activeSessionFilter, setActiveSessionFilter] = useState(() => defaultActiveSession);
  const [recentIngestedResults, setRecentIngestedResults] = useState([]);
  const isLoadingStudents = false;

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

  // Combined searchable student directory with fast canonical single-pass mapping
  const unifiedStudentDirectory = useMemo(() => {
    if (!isReady) return [];
    const list = [];
    const seenKeys = new Set();

    (combinedStudentPool || []).forEach(st => {
      if (!st) return;
      const latestResult = recentIngestedResults.find(row => ingestionRowMatchesStudent(row, st));
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
      const village = extractVillage(effectiveStudent);
      const address = village && village !== '—' ? `${village}, Shangus, Anantnag (J&K)` : 'Shangus, Anantnag — 192201 (J&K)';
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
  }, [combinedStudentPool, recentIngestedResults, isReady, registrationHistoryByReg]);

  // ─── Dynamic Sessions Derived from Indexed Directory (Reverse Chronological Order) ───
  const dynamicSessions = useMemo(() => {
    const counts = {};
    unifiedStudentDirectory.forEach(st => {
      const sess = st.session;
      if (sess && sess !== '—') {
        counts[sess] = (counts[sess] || 0) + 1;
      }
    });
    const sorted = Object.keys(counts).sort((a, b) => {
      const yearA = parseInt(a.match(/\d{4}/)?.[0] || '0', 10);
      const yearB = parseInt(b.match(/\d{4}/)?.[0] || '0', 10);
      if (yearB !== yearA) return yearB - yearA;
      return b.localeCompare(a, undefined, { numeric: true });
    });
    return sorted.map(k => ({ value: k, label: `Session ${k} (${counts[k]})` }));
  }, [unifiedStudentDirectory]);

  // ─── Student Search & Selection State ───
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [debouncedStudentQuery, setDebouncedStudentQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStudentQuery(studentSearchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [studentSearchQuery]);

  const deferredStudentQuery = useDeferredValue(debouncedStudentQuery);

  // Filtered search list with real cohort filters and ultra-fast pre-indexed searchToken matching
  const filteredStudents = useMemo(() => {
    let pool = unifiedStudentDirectory;

    // Apply Active Cohort / Class Filter Chip
    if (activeCohortFilter === '12th') {
      pool = pool.filter(st => st.cls.toLowerCase().includes('12'));
    } else if (activeCohortFilter === '11th') {
      pool = pool.filter(st => st.cls.toLowerCase().includes('11'));
    } else if (activeCohortFilter === '10th') {
      pool = pool.filter(st => st.cls.toLowerCase().includes('10'));
    } else if (activeCohortFilter === '9th') {
      pool = pool.filter(st => st.cls.toLowerCase().includes('9'));
    } else if (activeCohortFilter === 'present') {
      pool = pool.filter(st => st.sourceType === 'present');
    } else if (activeCohortFilter === 'past') {
      pool = pool.filter(st => st.sourceType === 'past');
    }

    // Apply Active Session Filter
    if (activeSessionFilter !== 'ALL') {
      pool = pool.filter(st => (st.session || '').toLowerCase().includes(activeSessionFilter.toLowerCase()));
    }

    const q = deferredStudentQuery.trim().toLowerCase();
    if (!q) return pool.slice(0, 30);

    return pool.filter(st => (st.searchToken || '').includes(q)).slice(0, 40);
  }, [unifiedStudentDirectory, deferredStudentQuery, activeCohortFilter, activeSessionFilter]);

  // ─── Active Certificate Form State (Auto-filled + Manual Overrides) ───
  const [studentName, setStudentName] = useState('MOHAMMAD TAHIR WANI');
  const [fatherName, setFatherName] = useState('GHULAM NABI WANI');
  const [motherName, setMotherName] = useState('FAHMEEDA AKHTER');
  const [className, setClassName] = useState('11th');
  const [stream, setStream] = useState('Medical');
  const [rollNo, setRollNo] = useState('1101');
  const [regNo, setRegNo] = useState('24SHG1101');
  const [dobRaw, setDobRaw] = useState('2007-08-15');
  const [session, setSession] = useState('2025-26');
  const [address, setAddress] = useState('Shangus, Anantnag — 192201 (J&K)');
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
        return dobToWords(dobRaw);
      }
    } catch (e) {
      console.warn('dobToWords execution error:', e);
    }
    return { figures: dobRaw || '—', words: '—', standard: dobRaw || '—' };
  }, [dobRaw]);

  // Certificate Header & Options State
  const [officeTitle, setOfficeTitle] = useState('OFFICE OF THE PRINCIPAL');
  const [institutionName, setInstitutionName] = useState('GOVT. HIGHER SECONDARY SCHOOL SHANGUS');
  const [institutionAddress, setInstitutionAddress] = useState('District Anantnag, Kashmir — 192201 (J&K)');
  const [certificateTitle, setCertificateTitle] = useState('BONAFIDE CERTIFICATE');
  const [refNo, setRefNo] = useState('HSS/SHG/Bonafide/2026/01');
  const [dateStr, setDateStr] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [showPhoto, setShowPhoto] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [includeSalutations, setIncludeSalutations] = useState(true);
  const [signatoryLeft, setSignatoryLeft] = useState('Incharge Admissions & Exam');
  const [signatoryCenter, setSignatoryCenter] = useState('Checked By');
  const [signatoryRight, setSignatoryRight] = useState('Principal');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Sync external Setup toggle from Top Sub-Nav bar
  useEffect(() => {
    if (showSettingsDrawerProp !== undefined) {
      setShowSettingsDrawer(showSettingsDrawerProp);
    }
  }, [showSettingsDrawerProp]);

  useEffect(() => {
    const handleToggle = () => setShowSettingsDrawer(prev => !prev);
    window.addEventListener('hss-toggle-studio-setup', handleToggle);
    return () => window.removeEventListener('hss-toggle-studio-setup', handleToggle);
  }, []);

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
  const [templateBody, setTemplateBody] = useState(BUILTIN_CERTIFICATE_TEMPLATES[0].bodyHtml);
  const [customCanvasHtml, setCustomCanvasHtml] = useState(null);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_custom_certificate_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
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

  // TC/DC Active check: Only show Result Hub and Bulk TC Generator when TC/DC is selected
  const isTcDcActive = useMemo(() => {
    if (selectedTemplateId?.startsWith('tc_dc')) return true;
    const currentTpl = [...customTemplates, ...BUILTIN_CERTIFICATE_TEMPLATES].find(t => t.id === selectedTemplateId);
    return Boolean(currentTpl?.isTcDc || currentTpl?.category?.includes('TC/DC') || currentTpl?.category?.toLowerCase().includes('transfer'));
  }, [selectedTemplateId, customTemplates]);

  const signatories = useMemo(() => {
    if (isTcDcActive) {
      return [signatoryLeft || 'I/c Admissions', signatoryCenter || 'Checked By', signatoryRight || 'Principal'];
    }
    return [signatoryLeft || 'Incharge Admissions & Exam', signatoryRight || 'Principal'].filter(Boolean);
  }, [isTcDcActive, signatoryLeft, signatoryCenter, signatoryRight]);

  const [toast, setToast] = useState(null); // { message: string, type: 'success' | 'error' | 'info' | 'warning' }
  const toastTimeoutRef = useRef(null);
  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  }, []);
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

  // Combined and deduplicated templates list (Cloud custom overrides take priority over built-ins)
  const allTemplatesList = useMemo(() => {
    const map = new Map();
    BUILTIN_CERTIFICATE_TEMPLATES.forEach(t => map.set(t.id, t));
    customTemplates.forEach(t => map.set(t.id, t));
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
          setCustomTemplates(templates);
        }

        const activeDefId = cloudDefaultId || defaultTemplateId || 'bonafide_dob';
        if (cloudDefaultId) setDefaultTemplateId(cloudDefaultId);

        const allTpls = [...(templates || []), ...BUILTIN_CERTIFICATE_TEMPLATES];
        const found = allTpls.find(t => t.id === activeDefId) || BUILTIN_CERTIFICATE_TEMPLATES[0];
        if (found) {
          setSelectedTemplateId(found.id);
          setTemplateBody(found.bodyHtml);
          if (found.certificateTitle) setCertificateTitle(found.certificateTitle);
          if (found.officeTitle) setOfficeTitle(found.officeTitle);
          if (found.institutionName) setInstitutionName(found.institutionName);
          if (found.institutionAddress) setInstitutionAddress(found.institutionAddress);
          if (found.signatoryLeft !== undefined) setSignatoryLeft(found.signatoryLeft);
          if (found.signatoryRight !== undefined) setSignatoryRight(found.signatoryRight);
          if (found.watermark !== undefined) setWatermark(found.watermark);
          if (found.includeSalutations !== undefined) setIncludeSalutations(found.includeSalutations);
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
      const saved = localStorage.getItem('hss_cert_split_pct');
      return saved ? Math.max(22, Math.min(65, Number(saved))) : 36;
    } catch {
      return 36;
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
    const container = e.currentTarget.closest('.cert-split-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvt) => {
      moveEvt.preventDefault();
      const mouseX = moveEvt.clientX - rect.left;
      const pct = Math.max(22, Math.min(65, (mouseX / rect.width) * 100));
      const rounded = Math.round(pct * 10) / 10;
      setLeftSplitPct(rounded);
      try {
        localStorage.setItem('hss_cert_split_pct', String(rounded));
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
  const fetchAndResolveStudentPhoto = useCallback(async (targetStudent = null) => {
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

    setIsFetchingPhoto(true);

    try {
      // 1. Instant check in memory / localStorage photo cache
      const fastPhoto = resolveStudentPhoto(st.raw || st) || getPhotoUrlFromCache(st.regNo || regNo || st.rollNo || rollNo) || st.photo;
      if (fastPhoto && typeof fastPhoto === 'string' && fastPhoto.length > 20 && fastPhoto !== '/logo.png') {
        setStudentPhotoUrl(fastPhoto);
        setIsFetchingPhoto(false);
        return fastPhoto;
      }

      // 2. Fetch on-demand from centralized Firestore studentPhotos cache
      const onDemandPhoto = await fetchStudentPhotoOnDemand(st.raw || st);
      if (onDemandPhoto && typeof onDemandPhoto === 'string' && onDemandPhoto.length > 20 && onDemandPhoto !== '/logo.png') {
        setStudentPhotoUrl(onDemandPhoto);
        setIsFetchingPhoto(false);
        return onDemandPhoto;
      }

      // 3. Fallback to comprehensive cross-session matching
      const allMatches = await fetchAllMatchingStudentPhotos(st.raw || st);
      if (allMatches && allMatches.length > 0 && allMatches[0].url) {
        setStudentPhotoUrl(allMatches[0].url);
        setIsFetchingPhoto(false);
        return allMatches[0].url;
      }

      // 4. Query Firestore studentPhotos directly for key permutations
      const rawReg = (st.regNo || regNo || '').replace(/[^a-zA-Z0-9]/g, '');
      const rawRoll = (st.rollNo || rollNo || '').replace(/[^a-zA-Z0-9]/g, '');
      const candidateKeys = [
        rawReg ? `photo_${rawReg}` : null,
        rawReg || null,
        rawRoll ? `photo_${rawRoll}` : null,
        rawRoll || null,
        st.id ? `photo_${st.id}` : null,
        st.id || null
      ].filter(Boolean);

      for (const cKey of candidateKeys) {
        try {
          const snap = await getDoc(doc(db, 'studentPhotos', cKey));
          if (snap.exists()) {
            const data = snap.data();
            const p = (data.photo_id || data.photoData || data.photo || data.photoUrl || '').trim();
            if (p && p.length > 20 && p !== '/logo.png') {
              setStudentPhotoUrl(p);
              if (typeof window !== 'undefined') {
                window._hss_central_photo_map = window._hss_central_photo_map || {};
                window._hss_central_photo_map[cKey] = p;
                if (rawReg) window._hss_central_photo_map[rawReg] = p;
              }
              setIsFetchingPhoto(false);
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
            setStudentPhotoUrl(p);
            setIsFetchingPhoto(false);
            return p;
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching student photo from database:', err);
    } finally {
      setIsFetchingPhoto(false);
    }
    return null;
  }, [selectedStudent, studentName, fatherName, regNo, rollNo, className, session, unifiedStudentDirectory]);

  // ─── Toggle Student Photo with Instant Database Fetch ───
  const handleTogglePhoto = async (forcedVal = null) => {
    const nextVal = forcedVal !== null ? forcedVal : !showPhoto;
    setShowPhoto(nextVal);
    if (nextVal) {
      // Immediately fetch this student's photo from database!
      await fetchAndResolveStudentPhoto();
    }
  };

  // ─── Select Student Handler (Auto-Fills Fields & Instantly Resolves DB Photo) ───
  const handleSelectStudent = async (st) => {
    setSelectedStudent(st);
    setIsSearchDropdownOpen(false);
    setStudentSearchQuery(`${st.name} (${st.rollNo || st.regNo || st.cls})`);

    // Reset canvas override so the new student data is cleanly interpolated from template tokens
    setCustomCanvasHtml(null);

    // Historical/master-register rows often hold result data while the linked
    // admission document holds identity details. Join them by the permanent
    // board registration number before filling the certificate.
    const primaryRaw = st.raw || st;
    const targetReg = normalizeRegistrationKey(extractBoardRegNo(primaryRaw) || st.regNo);
    let registrationMatches = targetReg ? [...(registrationHistoryByReg.get(targetReg) || [])] : [];
    if (targetReg) {
      try {
        const identityMatches = (identityStudents || []).filter(record =>
          normalizeRegistrationKey(extractBoardRegNo(record)) === targetReg
        );
        registrationMatches = [...registrationMatches, ...identityMatches];
        const hasAuthoritativeIdentity = registrationMatches.some(record =>
          extractStudentAdmissionNumber(record) || extractStudentAdmissionDate(record) || extractDob(record) !== '—'
        );
        // Avoid a redundant full admissions read when the complete master-register
        // pool already contains the linked admission identity.
        if (!hasAuthoritativeIdentity) {
          const cachedAdmissions = getCachedCollectionSync('admissions');
          const admissions = Array.isArray(cachedAdmissions) && cachedAdmissions.length > 0
            ? cachedAdmissions
            : await getCachedCollection('admissions');
          registrationMatches = [...registrationMatches, ...(admissions || []).filter(record =>
            normalizeRegistrationKey(extractBoardRegNo(record)) === targetReg
          )];
        }
        if (registrationMatches.length > 0) {
          let enrichedRaw = enrichCertificateIdentityFields(primaryRaw, registrationMatches);
          const priorCertificateRecord = registrationMatches.find(record => Boolean(extractStudentCertificateNumber(record)));
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
          setSelectedStudent(st);
        }
      } catch (error) {
        console.warn('Certificate registration enrichment note:', error);
      }
    }

    const raw = st.raw || st;
    const scopedResult = resolveScopedCertificateResult(
      [st, ...registrationMatches],
      st.session || extractSession(st),
      st.cls || extractClass(st)
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

    let activeTpl = [...customTemplates, ...BUILTIN_CERTIFICATE_TEMPLATES].find(t => t.id === selectedTemplateId) || BUILTIN_CERTIFICATE_TEMPLATES[0];

    // If a TC/DC template is active, automatically select the Qualified or Re-appear template variant
    if (activeTpl.isTcDc || selectedTemplateId.startsWith('tc_dc_')) {
      const targetId = isPassed ? 'tc_dc_qualified' : ((resInfo.isReap || resInfo.isFailed) ? 'tc_dc_reappear' : 'tc_dc_awaiting');
      const foundTarget = BUILTIN_CERTIFICATE_TEMPLATES.find(t => t.id === targetId) || activeTpl;
      setSelectedTemplateId(foundTarget.id);
      activeTpl = foundTarget;
      if (foundTarget.certificateTitle) setCertificateTitle(foundTarget.certificateTitle);
    }

    setTemplateBody(activeTpl.bodyHtml);

    setStudentName(st.name || '');
    setFatherName(st.father || '');
    setMotherName(st.mother || '');
    setClassName(st.cls || '11th');
    setStream(resolveCertificateStream(st, registrationMatches, st.cls || extractClass(st)));
    setRollNo(st.rollNo || '—');
    setRegNo(st.regNo || '—');
    const resolvedDob = extractDob(raw);
    setDobRaw(resolvedDob && resolvedDob !== '—' ? resolvedDob : (st.dob || ''));
    setSession(st.session || '2025-26');
    setAddress(st.address || 'Shangus, Anantnag');
    const resolvedGender = extractGender(raw);
    setGender(String(resolvedGender || '').toUpperCase().startsWith('F')
      ? 'F'
      : (String(resolvedGender || '').toUpperCase().startsWith('M') ? 'M' : (st.gender || '')));
    
    const rawWd = raw['Date of withdrawl'] || raw.withdrawalDate || raw['Result Date'] || raw.resultDate || toLocalDateKey();
    setWithdrawalDate(rawWd);

    const admNoResolved = extractStudentAdmissionNumber(raw);
    const admDateResolved = extractStudentAdmissionDate(raw);
    setAdmissionNo(admNoResolved);
    setAdmissionDate(admDateResolved);
    
    // Immediately fetch & resolve student photo from database
    await fetchAndResolveStudentPhoto(st);

    // Auto-update Ref No / Certificate No cleanly without 16-digit Reg No or Form No
    const existingCertNo = extractStudentCertificateNumber(raw);
    const isTcDcTemplate = Boolean(activeTpl.isTcDc || activeTpl.id?.startsWith('tc_dc_'));
    
    if (existingCertNo && !/^(—|-|n\/?a|null|undefined)$/i.test(String(existingCertNo).trim())) {
      setRefNo(isTcDcTemplate ? (extractCertificateSerial(existingCertNo) || String(existingCertNo).trim()) : String(existingCertNo).trim());
    } else {
      let lastNo = 1367;
      try {
        lastNo = await fetchLastIssuedCertificateNumber();
      } catch (_) {}
      const nextNo = lastNo + 1;
      setRefNo(isTcDcTemplate ? String(nextNo) : `${activeTpl.refPrefix || 'HSS/SHG'}/${nextNo}/${new Date().getFullYear()}`);
    }
  };

  const [isRevokingSingleCert, setIsRevokingSingleCert] = useState(false);

  // Revoke issued certificate number for currently active student
  const handleRevokeStudentCertificateNumber = async () => {
    if (!selectedStudent) return;
    const raw = selectedStudent.raw || selectedStudent;
    const currentCertNo = refNo || extractStudentCertificateNumber(raw);
    const displayName = studentName || selectedStudent.name || 'this student';

    if (!window.confirm(`Revoke TC/DC Certificate Number #${currentCertNo || ''} for ${displayName}?\n\nThe student's assignment will be cleared in Firestore. The revoked serial remains retired and will not be reused.`)) {
      return;
    }

    setIsRevokingSingleCert(true);
    try {
      const revocationSource = raw._certificateSourceRecord || raw;
      const res = await revokeCertificateNumberBatch([{
        ...selectedStudent,
        raw: revocationSource,
        certificateNo: currentCertNo
      }]);
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

  // ─── Select Template Handler ───
  const handleSelectTemplate = (tpl) => {
    setSelectedTemplateId(tpl.id);
    setTemplateBody(tpl.bodyHtml);
    setCustomCanvasHtml(null);
    if (tpl.certificateTitle) setCertificateTitle(tpl.certificateTitle);
    if (tpl.officeTitle) setOfficeTitle(tpl.officeTitle);
    if (tpl.institutionName) setInstitutionName(tpl.institutionName);
    if (tpl.institutionAddress) setInstitutionAddress(tpl.institutionAddress);
    if (tpl.signatoryLeft !== undefined) setSignatoryLeft(tpl.signatoryLeft);
    if (tpl.signatoryRight !== undefined) setSignatoryRight(tpl.signatoryRight);
    if (tpl.watermark !== undefined) setWatermark(tpl.watermark);
    if (tpl.includeSalutations !== undefined) setIncludeSalutations(tpl.includeSalutations);
    if (tpl.showPhoto !== undefined) {
      setShowPhoto(tpl.showPhoto);
      if (tpl.showPhoto && !studentPhotoUrl) {
        fetchAndResolveStudentPhoto();
      }
    }
    const issuedCertificateNo = extractStudentCertificateNumber(selectedStudent);
    const selectingTcDc = Boolean(tpl.isTcDc || tpl.id?.startsWith('tc_dc_'));
    if (issuedCertificateNo) {
      setRefNo(selectingTcDc
        ? (extractCertificateSerial(issuedCertificateNo) || issuedCertificateNo)
        : issuedCertificateNo);
    } else if (selectingTcDc) {
      setRefNo('');
      fetchLastIssuedCertificateNumber()
        .then(lastNo => setRefNo(String(lastNo + 1)))
        .catch(error => showToast(error.message || 'Certificate registry could not be verified.', 'error'));
    } else if (tpl.refPrefix) {
      const cleanSerial = (rollNo && rollNo !== '—' && String(rollNo).length < 8)
        ? rollNo
        : (admissionNo && admissionNo !== '—' && String(admissionNo).length < 8 ? admissionNo : '1368');
      setRefNo(`${tpl.refPrefix}/${cleanSerial}/${new Date().getFullYear()}`);
    } else if (tpl.refNo) {
      setRefNo(tpl.refNo);
    }
  };

  // ─── Direct Inline Title (Salutation) Toggle ───
  const handleToggleSalutations = (forceVal = null) => {
    const next = forceVal !== null ? forceVal : !includeSalutations;
    setIncludeSalutations(next);

    if (editorRef.current) {
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
        customFields
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
      fetchAndResolveStudentPhoto();
    }
  }, [showPhoto, studentPhotoUrl, isFetchingPhoto, fetchAndResolveStudentPhoto]);

  // ─── Insert Placeholder Chip ───
  const insertToken = (token) => {
    setTemplateBody(prev => prev + ` ${token} `);
    setCustomCanvasHtml(null);
  };

  // ─── Live Interpolated Preview Content ───
  const interpolatedPreviewHtml = useMemo(() => {
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
    const ccDcNo = refNo || extractStudentCertificateNumber(raw) || '—';
    const effAdmDate = admissionDate || extractStudentAdmissionDate(raw) || '—';
    const effAdmNo = admissionNo || extractStudentAdmissionNumber(raw) || '—';
    const village = raw['Village/Town'] || raw.village || raw.address || address || 'Shangus';
    const tehsil = raw['Tehsil'] || raw.tehsil || 'Anantnag';
    const district = raw['District'] || raw.district || 'Anantnag';

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
      village,
      tehsil,
      district,
      certificateNo: ccDcNo
    });
  }, [
    templateBody, studentName, fatherName, motherName, className, stream, rollNo, regNo, parsedDob, session, address, gender, refNo, dateStr, includeSalutations, customFields, selectedStudent, withdrawalDate, admissionDate, admissionNo,
    tcMarksObtained, tcMaxMarks, tcDivision, tcExamRoll, tcExamMode, tcResultStatus, tcReappSubjects
  ]);

  // Active rendered HTML (Canvas override or cleanly interpolated preview)
  const activeDisplayHtml = customCanvasHtml !== null ? customCanvasHtml : interpolatedPreviewHtml;

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

    const targetTpl = {
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
      bodyHtml: currentHtml,
      showPhoto,
      watermark,
      includeSalutations,
      isCustom: true
    };

    try {
      await saveCloudDocTemplate({
        type: 'certificate',
        template: targetTpl,
        makeDefault: isUpdating ? (selectedTemplateId === defaultTemplateId || makeTemplateDefault) : makeTemplateDefault
      });

      const updated = [targetTpl, ...customTemplates.filter(t => t.id !== targetTpl.id)];
      setCustomTemplates(updated);
      setSelectedTemplateId(targetTpl.id);
      setTemplateBody(currentHtml);
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

    const targetTpl = {
      id: selectedTemplateId,
      name: activeTpl.name || 'Bonafide Certificate',
      category: activeTpl.category || 'Bonafide & Age Certificates',
      certificateTitle: certificateTitle || 'BONAFIDE CERTIFICATE',
      officeTitle: officeTitle || 'OFFICE OF THE PRINCIPAL',
      institutionName: institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
      institutionAddress: institutionAddress || 'District Anantnag, Kashmir — 192201 (J&K)',
      refNo: refNo || '',
      refPrefix: activeTpl.refPrefix || '',
      signatoryLeft: signatoryLeft || '',
      signatoryRight: signatoryRight || '',
      bodyHtml: currentHtml,
      showPhoto,
      watermark,
      includeSalutations,
      isCustom: true
    };

    try {
      await saveCloudDocTemplate({
        type: 'certificate',
        template: targetTpl,
        makeDefault: selectedTemplateId === defaultTemplateId
      });

      const updated = [targetTpl, ...customTemplates.filter(t => t.id !== targetTpl.id)];
      setCustomTemplates(updated);
      setTemplateBody(currentHtml);
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
    setStudentName(st.name || '');
    setFatherName(st.father || '');
    setMotherName(st.mother || '');
    setClassName(st.cls || '11th');
    setStream(st.stream || 'Arts');
    setRollNo(st.rollNo || '');
    setRegNo(st.regNo || '');
    setSession(st.session || '2025-26');
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
    let node = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
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
      lastActiveTableRef.current = { td, tr, table, colIndex, rowIndex };
      return { td, tr, table, colIndex, rowIndex };
    }

    if (lastActiveTableRef.current && editorRef.current && editorRef.current.contains(lastActiveTableRef.current.table)) {
      return lastActiveTableRef.current;
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
          rowIndex: allTrs.length - 1
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
        hasTable: true
      });
    } else {
      if (editorRef.current && editorRef.current.querySelector('table')) {
        const table = editorRef.current.querySelector('table');
        const allTrs = Array.from(table.querySelectorAll('tr'));
        setActiveTableContext({
          colIndex: 0,
          rowIndex: 0,
          totalCols: table.querySelector('tr')?.children.length || 0,
          totalRows: allTrs.length,
          hasTable: true
        });
      } else {
        setActiveTableContext(null);
      }
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

    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}

    const sel = window.getSelection();
    const activeRange = savedRangeRef.current || savedRange;
    if (activeRange && sel) {
      try {
        if (sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
          sel.removeAllRanges();
          sel.addRange(activeRange);
        }
      } catch {}
    }

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

  // Instantaneous Text Color Application with CSS styling & smart selection recovery
  const applyTextColor = (color) => {
    if (!editorRef.current) return;
    pushSnapshot();
    editorRef.current.focus();

    // 1. Enable CSS inline styles so color overrides all parent CSS classes immediately
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}

    // 2. Restore saved selection if shifted or blurred
    const sel = window.getSelection();
    const activeRange = savedRangeRef.current || savedRange;
    if (activeRange && sel) {
      try {
        if (sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
          sel.removeAllRanges();
          sel.addRange(activeRange);
        }
      } catch {}
    }

    // 3. If selection is collapsed inside text, auto-expand to word under cursor
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
          }
        }
      }
    }

    // 4. Apply text color command
    try {
      const ok = document.execCommand('foreColor', false, color);
      if (!ok) {
        document.execCommand('styleWithCSS', false, false);
        document.execCommand('foreColor', false, color);
      }
    } catch (err) {
      console.warn('Text color command error:', err);
    }

    // 5. Update canvas state immediately
    if (editorRef.current) {
      setCustomCanvasHtml(editorRef.current.innerHTML);
    }
    saveCurrentSelection();
    setTimeout(() => {
      pushSnapshot();
      checkTableContext();
    }, 50);
    showToast(`Color applied (${color})`, 'info', 1500);
  };

  const insertTable = (rows = 2, cols = 3) => {
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
    tableHtml += `</tbody></table><p></p>`;

    pushSnapshot();
    executeFormat('insertHTML', tableHtml);
    setTimeout(() => {
      pushSnapshot();
      checkTableContext();
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
      const activeRange = savedRangeRef.current || savedRange;
      if (!activeRange || !editorRef.current) return false;
      const preRange = document.createRange();
      preRange.selectNodeContents(editorRef.current);
      preRange.setEnd(activeRange.startContainer, activeRange.startOffset);
      const preText = preRange.toString().trimEnd();
      if (!preText || preText.length === 0) return true;
      const lastChar = preText[preText.length - 1];
      if (lastChar === '.' || lastChar === '!' || lastChar === '?' || lastChar === '\n' || lastChar === ':') {
        if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Shri|Smt)\.$/i.test(preText)) return false;
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
      '{STUDENT_NAME}': studentName || '—',
      '{FATHER_NAME}': fatherName || '—',
      '{MOTHER_NAME}': motherName || '—',
      '{CLASS}': className || '11th',
      '{STREAM}': stream || 'Medical',
      '{ROLL_NO}': rollNo || '—',
      '{REG_NO}': regNo || '—',
      '{DOB_FIGURES}': parsedDob.figures || '—',
      '{DOB_WORDS}': parsedDob.words || '—',
      '{SESSION}': session || '2025-26',
      '{ADDRESS}': address || 'Shangus, Anantnag',
      '{REF_NO}': refNo || '—',
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
      '{PRONOUN_himself_herself}': isFemale ? 'herself' : 'himself'
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
        dobFigures: parsedDob.figures,
        dobWords: parsedDob.words,
        session,
        address,
        gender,
        refNo,
        date: dateStr,
        includeSalutations,
        customFields
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
      const cleanedHtml = interpolateCertificateTemplate(editorRef.current.innerHTML, {
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
        customFields
      });
      if (cleanedHtml !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = cleanedHtml;
      }
    }

    setCustomCanvasHtml(editorRef.current.innerHTML);
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

    let serial = extractCertificateSerial(refNo);
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

    const raw = selectedStudent?.raw || selectedStudent || {};
    const metaDetails = {
      certificateNo: effectiveRefNo || extractStudentCertificateNumber(raw) || '—',
      admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '—',
      admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '—',
      regNo: regNo || '—'
    };

    // Auto-record print in per-app memory (max 3)
    recordApplicationPrint(
      selectedStudent || metaDetails,
      isTcDcActive ? 'Discharge / Transfer Certificate' : (certificateTitle || 'Bonafide Certificate'),
      'Printed / Saved PDF',
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
    });
  };

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

    const raw = selectedStudent?.raw || selectedStudent || {};
    const metaDetails = {
      certificateNo: effectiveRefNo || extractStudentCertificateNumber(raw) || '—',
      admissionDate: admissionDate || extractStudentAdmissionDate(raw) || '—',
      admissionNo: admissionNo || extractStudentAdmissionNumber(raw) || '—',
      regNo: regNo || '—'
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

  return (
    <div className="space-y-2 animate-fadeIn text-slate-900 dark:text-slate-100">

      {/* Unified Global Floating Toast Notification */}
      {toast && (
        <div
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
            <span className="text-[9px] font-bold text-slate-400">Live preview & auto-applied on print/export</span>
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

            {/* Ref No */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Reference Number</label>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="HSS/SHG/Bonafide/2026/01"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
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
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Certificate Title Banner</label>
              <input
                type="text"
                value={certificateTitle}
                onChange={(e) => setCertificateTitle(e.target.value)}
                placeholder="BONAFIDE CERTIFICATE"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-amber-900 dark:text-amber-200"
              />
            </div>

            {/* Signatory 1 (Left) */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Signatory 1 (Left)</label>
              <input
                type="text"
                value={signatoryLeft}
                onChange={(e) => setSignatoryLeft(e.target.value)}
                placeholder="Incharge Admissions & Exam"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2-COLUMN DRAG-RESIZABLE SPLIT-SCREEN LAYOUT ── */}
      <div className="cert-split-container flex flex-col lg:flex-row gap-0 items-start w-full relative">
        
        {/* ================ LEFT HALF: STUDENT SELECTOR & CERTIFICATE PALETTE ================ */}
        <div
          style={{ width: isDesktop ? `${leftSplitPct}%` : '100%' }}
          className="w-full lg:w-auto shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-3 space-y-2.5 text-xs overflow-hidden flex flex-col min-h-[620px] max-h-[calc(100vh-95px)]"
        >
          
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

            {/* Quick Cohort & Session Filter Dropdowns & TC Tools Action */}
            <div className="space-y-1 pb-0.5 text-[9.5px]">
              <div className="grid grid-cols-2 gap-1.5">
                {/* Cohort / Class Filter */}
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-[8.5px] uppercase tracking-wider shrink-0">Class:</span>
                  <select
                    value={activeCohortFilter}
                    onChange={(e) => setActiveCohortFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] rounded-lg px-1.5 py-1 focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer truncate shadow-2xs"
                  >
                    <option value="ALL">All Classes ({unifiedStudentDirectory.length})</option>
                    <option value="12th">Class 12th ({unifiedStudentDirectory.filter(s => s.cls.includes('12')).length})</option>
                    <option value="11th">Class 11th ({unifiedStudentDirectory.filter(s => s.cls.includes('11')).length})</option>
                    <option value="10th">Class 10th ({unifiedStudentDirectory.filter(s => s.cls.includes('10')).length})</option>
                    <option value="9th">Class 9th ({unifiedStudentDirectory.filter(s => s.cls.includes('9')).length})</option>
                    <option value="past">Historical ({unifiedStudentDirectory.filter(s => s.sourceType === 'past').length})</option>
                  </select>
                </div>

                {/* Session Filter */}
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-[8.5px] uppercase tracking-wider shrink-0">Session:</span>
                  <select
                    value={activeSessionFilter}
                    onChange={(e) => setActiveSessionFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] rounded-lg px-1.5 py-1 focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer truncate shadow-2xs"
                  >
                    <option value="ALL">All Sessions ({unifiedStudentDirectory.length})</option>
                    {dynamicSessions.map((sess) => (
                      <option key={sess.value} value={sess.value}>{sess.label}</option>
                    ))}
                  </select>
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
                value={studentSearchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setStudentSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                placeholder="Search by Name, Roll No, Reg No, Father, Mobile..."
                className="w-full pl-7 pr-7 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/40 dark:bg-teal-950/30 font-bold text-xs shadow-2xs focus:ring-1 focus:ring-teal-500 focus:outline-none placeholder:text-slate-400"
              />
              <Search size={12} className="absolute left-2 top-2.5 text-teal-600 dark:text-teal-400" />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearchQuery('');
                    setIsSearchDropdownOpen(false);
                  }}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Active Selected Student Badge (Quick Preview & Quick Actions) */}
            {selectedStudent && (
              <div className="space-y-1.5 animate-fadeIn">
                <div className="p-2 rounded-xl bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200/90 dark:border-teal-800 flex items-center justify-between gap-2">
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
                        setSelectedStudent(null);
                        setStudentSearchQuery('');
                      }}
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

            {/* Dropdown Auto-Complete Results */}
            {isSearchDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500 font-bold">
                    {isLoadingStudents ? 'Loading student database...' : 'No matching students found.'}
                  </div>
                ) : (
                  filteredStudents.map((st) => (
                    <button
                      key={st.id + st.sourceType + (st.rollNo || '')}
                      type="button"
                      onClick={() => handleSelectStudent(st)}
                      className="w-full p-2 text-left hover:bg-teal-50/60 dark:hover:bg-teal-950/40 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {st.photo ? (
                          <img src={st.photo} alt={st.name} className="w-8 h-8 rounded-full object-cover border border-slate-300 shrink-0" />
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
                      <span className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9.5px] font-black shrink-0">
                        Select
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* TEMPLATE SELECTOR & PRESETS */}
          <div className="space-y-2 flex-1 flex flex-col min-h-0 pt-1">
            <div className="flex items-center justify-between text-[9px] uppercase font-black tracking-wider text-slate-500 shrink-0">
              <span className="flex items-center gap-1">
                <Sparkles size={10} className="text-amber-600" />
                <span>Certificate Templates ({displayedTemplates.length})</span>
              </span>
              
              {/* Template Filter Pills */}
              <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[8.5px] font-bold">
                <button
                  type="button"
                  onClick={() => setTemplateFilterTab('all')}
                  className={`px-1.5 py-0.2 rounded cursor-pointer ${templateFilterTab === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black' : 'text-slate-500'}`}
                >
                  All ({allTemplatesList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateFilterTab('builtin')}
                  className={`px-1.5 py-0.2 rounded cursor-pointer ${templateFilterTab === 'builtin' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black' : 'text-slate-500'}`}
                >
                  Built-in ({BUILTIN_CERTIFICATE_TEMPLATES.length})
                </button>
                {customTemplates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTemplateFilterTab('custom')}
                    className={`px-1.5 py-0.2 rounded cursor-pointer ${templateFilterTab === 'custom' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black' : 'text-slate-500'}`}
                  >
                    Custom ({customTemplates.length})
                  </button>
                )}
              </div>
            </div>

            {/* Expansive Compact Template Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 overflow-y-auto p-1 flex-1 max-h-[calc(100vh-280px)] content-start items-start auto-rows-max rounded-xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80">
              {displayedTemplates.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                const isDefault = defaultTemplateId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col gap-0.5 group relative h-auto ${
                      isSelected
                        ? 'bg-teal-50/90 dark:bg-teal-950/70 border-teal-600 dark:border-teal-500 shadow-2xs ring-1 ring-teal-500/40'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-black text-[9px] text-slate-900 dark:text-white leading-tight flex items-start gap-1 flex-1 min-w-0">
                        {isSelected && <CheckCircle2 size={10} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />}
                        <span className="line-clamp-2">{tpl.name}</span>
                      </div>
                      {isDefault && (
                        <span className="px-1 py-0.2 rounded text-[7px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                          ⭐ Default
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[7.5px] mt-0.5">
                      <span className="text-slate-400 dark:text-slate-500 truncate flex-1 font-medium">
                        {tpl.category}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDuplicateTemplate(tpl, e)}
                          className="opacity-70 group-hover:opacity-100 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 p-0.5 transition-opacity cursor-pointer"
                          title="Duplicate template to create new preset"
                        >
                          <Copy size={9} />
                        </button>
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={(e) => handleSetDefaultTemplate(tpl.id, e)}
                            className="opacity-0 group-hover:opacity-100 text-[7px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800 transition-opacity cursor-pointer"
                            title="Set as default certificate template"
                          >
                            Set Default
                          </button>
                        )}
                        {tpl.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomTemplate(tpl, e)}
                            title="Delete custom template"
                            className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                          >
                            <Trash2 size={9} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── DRAGGABLE VERTICAL SPLITTER HANDLE ── */}
        <div
          onMouseDown={handleSplitterMouseDown}
          title="Drag horizontally to adjust workspace split width (Double-click to reset)"
          onDoubleClick={() => {
            setLeftSplitPct(36);
            try { localStorage.setItem('hss_cert_split_pct', '36'); } catch {}
          }}
          className="hidden lg:flex flex-col items-center justify-center w-3.5 self-stretch cursor-col-resize hover:bg-teal-400/20 active:bg-teal-600/30 group transition-colors z-20 shrink-0 mx-0.5"
        >
          <div className={`w-1 rounded-full transition-all group-hover:w-1.5 group-hover:bg-teal-700 ${isDraggingSplitter ? 'bg-teal-700 w-1.5 h-full shadow-md' : 'bg-slate-300 dark:bg-slate-700 h-24'}`} />
        </div>

        {/* == == == == == == == ==  RIGHT HALF: LIVE A4 CERTIFICATE PREVIEW & VERTICAL FLOATING DOCK == == == == == == == ==  */}
        <div
          style={{ width: isDesktop ? `${100 - leftSplitPct}%` : '100%' }}
          className="w-full lg:flex-1 pl-0 lg:pl-1 min-w-0"
        >
          {/* Main preview container hosting the Vertical Floating Dock + A4 Canvas */}
          <div className={`flex flex-col lg:flex-row items-start justify-center gap-3 ${dockSide === 'right' ? 'lg:flex-row-reverse' : ''}`}>

            {/* ── VERTICAL FLOATING DOCK (3 Vertical Columns Side-by-Side) ── */}
            <div className="w-full lg:w-auto lg:sticky lg:top-2 z-30 shrink-0">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-1.5 shadow-md flex flex-wrap lg:grid lg:grid-cols-3 items-center justify-items-center gap-1 max-w-fit">

                {/* ── Row 1: Primary Actions (Print, Word, Save) ── */}
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isIssuingTcDc || isExportingDocx}
                  className="w-7 h-7 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 text-white flex items-center justify-center shadow-xs cursor-pointer transition-all active:scale-90"
                  title="Print or Save Certificate as PDF"
                >
                  {isIssuingTcDc ? <RefreshCw size={12} className="animate-spin" /> : <Printer size={13} />}
                </button>

                {/* Word (.docx) Export */}
                <button
                  type="button"
                  disabled={isExportingDocx || isIssuingTcDc}
                  onClick={handleExportDocx}
                  className="w-7 h-7 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50 transition-all active:scale-90"
                  title="Download editable Word Document (.docx)"
                >
                  {isExportingDocx ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={13} />}
                </button>

                {/* History / Archive button in Row 1 */}
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="w-7 h-7 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                  title="Browse past generated / printed documents archive"
                >
                  <History size={13} />
                </button>

                {/* ── Row 2: Overwrite, Insert Fields & Gemini AI ── */}
                <button
                  type="button"
                  onClick={handleQuickUpdateTemplate}
                  className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center cursor-pointer transition-all active:scale-90"
                  title="Save & Overwrite active template in Cloud"
                >
                  <Save size={13} />
                </button>

                {/* Insert Student Field Dropdown (Popout) */}
                <div className="relative" ref={insertFieldDropdownRef}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowInsertFieldDropdown(!showInsertFieldDropdown);
                      setShowAskGeminiMenu(false);
                    }}
                    className="w-7 h-7 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 flex items-center justify-center cursor-pointer transition-all active:scale-90"
                    title="Insert student database fields at cursor"
                  >
                    <PlusCircle size={13} />
                  </button>

                  {showInsertFieldDropdown && (
                    <div className={`absolute ${dockSide === 'right' ? 'right-full mr-2 top-0' : 'left-full ml-2 top-0'} w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[999999] p-2 space-y-1 text-xs animate-fadeIn divide-y divide-slate-100 dark:divide-slate-800 max-h-[75vh] overflow-y-auto`}>
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
                          onClick={() => { handleInsertPlaceholder(studentName || '{STUDENT_NAME}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Student Name</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{studentName || '{STUDENT_NAME}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(fatherName || '{FATHER_NAME}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Father's Name</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{fatherName || '{FATHER_NAME}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(motherName || '{MOTHER_NAME}'); setShowInsertFieldDropdown(false); }}
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
                          onClick={() => { handleInsertPlaceholder(className || '{CLASS}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Class</span>
                          <span className="text-[9px] text-slate-400">{className || '{CLASS}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(stream || '{STREAM}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Stream</span>
                          <span className="text-[9px] text-slate-400">{stream || '{STREAM}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(rollNo || '{ROLL_NO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Class Roll No</span>
                          <span className="text-[9px] text-slate-400 font-mono">{rollNo || '{ROLL_NO}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(regNo || '{REG_NO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Registration No</span>
                          <span className="text-[9px] text-slate-400 font-mono">{regNo || '{REG_NO}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(session || '{SESSION}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Academic Session</span>
                          <span className="text-[9px] text-slate-400">{session || '{SESSION}'}</span>
                        </button>
                      </div>

                      {/* Group 3: DOB & Address */}
                      <div className="pt-1 space-y-0.5">
                        <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">DOB & Address</div>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(parsedDob.formatted || '{DOB_FIGURES}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>DOB (DD-MM-YYYY)</span>
                          <span className="text-[9px] text-slate-400">{parsedDob.formatted || '{DOB_FIGURES}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(parsedDob.inWords || '{DOB_WORDS}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>DOB (in Words)</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{parsedDob.inWords || '{DOB_WORDS}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(address || '{ADDRESS}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Permanent Address</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{address || '{ADDRESS}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(dateStr || '{DATE}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Certificate Date</span>
                          <span className="text-[9px] text-slate-400">{dateStr || '{DATE}'}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { handleInsertPlaceholder(refNo || '{REF_NO}'); setShowInsertFieldDropdown(false); }}
                          className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span>Reference No</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{refNo || '{REF_NO}'}</span>
                        </button>
                      </div>

                      {/* Group 4: Student Database Fields */}
                      <div className="pt-1 space-y-0.5">
                        <div className="px-2 text-[8.5px] font-bold text-teal-700 dark:text-teal-400 uppercase flex items-center justify-between">
                          <span>Database Fields</span>
                          <span className="text-[7.5px] text-slate-400 font-normal">From Record</span>
                        </div>
                        {FIRESTORE_PRESET_FIELDS.slice(0, 8).map((preset) => {
                          const studentVal = findValueInStudentRaw(selectedStudent, preset.keys);
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { handleInsertPlaceholder(studentVal || `{${preset.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`); setShowInsertFieldDropdown(false); }}
                              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                            >
                              <span className="truncate">{preset.label}</span>
                              <span className="text-[9px] text-slate-400 truncate max-w-[120px] font-mono">
                                {studentVal || `{${preset.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`}
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

                {/* Purple Gemini AI Assistant Button */}
                <div className="relative" ref={askGeminiMenuRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAskGeminiMenu(prev => !prev);
                      setShowInsertFieldDropdown(false);
                    }}
                    className="w-7 h-7 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white flex items-center justify-center shadow-xs cursor-pointer transition-all active:scale-90"
                    title="Gemini AI Certificate Assistant (Draft, Polish, Formalize)"
                  >
                    <Sparkles size={13} className="text-amber-200" />
                  </button>

                  {showAskGeminiMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute ${dockSide === 'right' ? 'right-full mr-2 top-0' : 'left-full ml-2 top-0'} w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[999999] p-1.5 space-y-1 text-xs font-bold animate-fadeIn`}
                    >
                      <div className="px-2 py-1 text-[8.5px] font-black uppercase text-purple-600 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Sparkles size={10} className="text-purple-600" />
                          <span>Gemini AI Assistant</span>
                        </span>
                        <span className="text-[7.5px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">secure server</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { handleOpenAiModal('draft'); setShowAskGeminiMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/60 text-purple-900 dark:text-purple-200 flex items-center gap-2 cursor-pointer text-[10.5px]"
                      >
                        <Bot size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>Draft Certificate with AI</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleOpenAiModal('humanize'); setShowAskGeminiMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/60 text-purple-900 dark:text-purple-200 flex items-center gap-2 cursor-pointer text-[10.5px]"
                      >
                        <Sparkles size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>Polish & Humanize</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleOpenAiModal('formalize'); setShowAskGeminiMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 flex items-center gap-2 cursor-pointer text-[10.5px]"
                      >
                        <FileText size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>Formalize Terms</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleOpenAiModal('shorten'); setShowAskGeminiMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 flex items-center gap-2 cursor-pointer text-[10.5px]"
                      >
                        <Scissors size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Shorten Wording</span>
                      </button>
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 px-2 py-1 text-[9.5px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <Shield size={9} /> Server-secured AI
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Row 3: BookmarkPlus, Photo & Undo ── */}
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="w-7 h-7 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                  title="Save Certificate format as reusable template"
                >
                  <BookmarkPlus size={13} />
                </button>

                <div className="col-span-3 w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5 hidden lg:block"></div>

                {/* ── Row 3: Photo, Undo & Redo ── */}
                <button
                  type="button"
                  onClick={() => handleTogglePhoto()}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-all border ${
                    showPhoto
                      ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                  title={`Student Photo: ${showPhoto ? 'ON (Click to hide)' : 'OFF (Click to show & fetch from DB)'}`}
                >
                  {isFetchingPhoto ? (
                    <RefreshCw size={12} className="animate-spin text-teal-600" />
                  ) : (
                    <ImageIcon size={13} className={showPhoto ? 'text-teal-600' : 'text-slate-400'} />
                  )}
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { handleUndo(); setTimeout(checkActiveFormats, 50); }}
                  disabled={!canUndo}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-20 flex items-center justify-center cursor-pointer transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo size={12} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { handleRedo(); setTimeout(checkActiveFormats, 50); }}
                  disabled={!canRedo}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-20 flex items-center justify-center cursor-pointer transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo size={12} />
                </button>

                {/* ── Row 4: Headings & Paragraph ── */}
                <button
                  type="button"
                  title="Heading 1 (Click to apply, click again to revert to body text)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('formatBlock', '<h1>')}
                  className={`w-7 h-7 rounded-lg font-black text-[10px] flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.h1
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  H1
                </button>

                <button
                  type="button"
                  title="Heading 2 (Click to apply, click again to revert to body text)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('formatBlock', '<h2>')}
                  className={`w-7 h-7 rounded-lg font-black text-[10px] flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.h2
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  H2
                </button>

                <button
                  type="button"
                  title="Normal Body Paragraph (Â¶)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('formatBlock', '<p>')}
                  className={`w-7 h-7 rounded-lg font-bold text-[10px] flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.p
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Â¶
                </button>

                <div className="col-span-3 w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5 hidden lg:block"></div>

                {/* ── Row 5: Character Styles (Bold, Italic, Underline) ── */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('bold')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.bold
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 font-black shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-black'
                  }`}
                  title="Bold (Ctrl+B)"
                >
                  <Bold size={12} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('italic')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.italic
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 font-black shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold'
                  }`}
                  title="Italic (Ctrl+I)"
                >
                  <Italic size={12} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('underline')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.underline
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 font-black shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold'
                  }`}
                  title="Underline (Ctrl+U)"
                >
                  <Underline size={12} />
                </button>

                {/* ── Row 6: Strike, Color & Divider Line ── */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('strikeThrough')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.strikeThrough
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 font-black shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                  title="Strikethrough"
                >
                  <Strikethrough size={12} />
                </button>

                {/* Color Palette Popout */}
                <div className="relative" ref={colorMenuRef}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
                    onClick={() => {
                      saveCurrentSelection();
                      setShowColorMenu(!showColorMenu);
                    }}
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                    title="Text Color Palette"
                  >
                    <Palette size={12} className="text-amber-600" />
                  </button>
                  {showColorMenu && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute ${dockSide === 'right' ? 'right-full mr-2 top-0' : 'left-full ml-2 top-0'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 z-50 flex items-center gap-1.5 animate-fadeIn`}
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
                          onClick={() => {
                            applyTextColor(c.color);
                            setShowColorMenu(false);
                          }}
                          className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={insertHorizontalRule}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                  title="Insert Divider Line"
                >
                  <Minus size={12} />
                </button>

                <div className="col-span-3 w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5 hidden lg:block"></div>

                {/* ── Row 7: Alignments Left, Center & Right ── */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('justifyLeft')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.justifyLeft
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Align Left"
                >
                  <AlignLeft size={12} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('justifyCenter')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.justifyCenter
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Align Center"
                >
                  <AlignCenter size={12} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('justifyRight')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.justifyRight
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Align Right"
                >
                  <AlignRight size={12} />
                </button>

                {/* ── Row 8: Justify & Lists ── */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('justifyFull')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.justifyFull
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Justify Text"
                >
                  <AlignJustify size={12} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('insertUnorderedList')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.insertUnorderedList
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Bulleted List"
                >
                  <List size={12} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('insertOrderedList')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.insertOrderedList
                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Numbered List"
                >
                  <ListOrdered size={12} />
                </button>

                <div className="col-span-3 w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5 hidden lg:block"></div>

                {/* ── Row 9: Table, Clear Format & Switcher ── */}
                {/* Table Tool Popout */}
                <div className="relative" ref={tableMenuRef}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      checkTableContext();
                      setShowTableMenu(prev => !prev);
                      setShowColorMenu(false);
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
                      activeTableContext || (editorRef.current && editorRef.current.querySelector('table'))
                        ? 'bg-teal-50 dark:bg-teal-950 text-teal-700 border border-teal-300'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                    title="Table Tools & Column / Row Controls"
                  >
                    <TableIcon size={12} />
                  </button>

                  {showTableMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute ${dockSide === 'right' ? 'right-full mr-2 top-0' : 'left-full ml-2 top-0'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 z-50 w-52 space-y-1.5 text-xs animate-fadeIn font-bold`}
                    >
                      {(activeTableContext || (editorRef.current && editorRef.current.querySelector('table'))) ? (
                        <>
                          <div className="px-2 py-0.5 text-[9px] font-black uppercase text-teal-600 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800">
                            Table Controls
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
                            className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200"
                          >
                            🗑️ Delete Table
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="px-2 py-1 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                            Insert Table Preset
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { insertTable(2, 2); setShowTableMenu(false); }}
                            className="w-full text-left px-2.5 py-1 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-900 dark:text-teal-200 text-[10.5px] font-bold flex items-center justify-between"
                          >
                            <span>2 × 2 Table</span>
                            <span className="text-[9px] text-slate-400 font-mono">4 cells</span>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { insertTable(2, 3); setShowTableMenu(false); }}
                            className="w-full text-left px-2.5 py-1 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-900 dark:text-teal-200 text-[10.5px] font-bold flex items-center justify-between"
                          >
                            <span>2 × 3 Table</span>
                            <span className="text-[9px] text-slate-400 font-mono">6 cells</span>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { insertTable(3, 3); setShowTableMenu(false); }}
                            className="w-full text-left px-2.5 py-1 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-900 dark:text-teal-200 text-[10.5px] font-bold flex items-center justify-between"
                          >
                            <span>3 × 3 Table</span>
                            <span className="text-[9px] text-slate-400 font-mono">9 cells</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('removeFormat')}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                  title="Clear Formatting"
                >
                  <RemoveFormatting size={12} />
                </button>

                {/* Dock Side Switcher (Spanning 2 columns) */}
                <button
                  type="button"
                  onClick={() => {
                    const nextSide = dockSide === 'left' ? 'right' : 'left';
                    setDockSide(nextSide);
                    try { localStorage.setItem('hss_cert_dock_side', nextSide); } catch {}
                  }}
                  className="col-span-2 w-full h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors text-[9px] font-bold font-mono hidden lg:flex"
                  title={dockSide === 'left' ? 'Move Dock to Right side of Canvas' : 'Move Dock to Left side of Canvas'}
                >
                  {dockSide === 'left' ? '👉 Right' : '👈 Left'}
                </button>

              </div>
            </div>

            {/* ================ A4 PAPER LIVE VIEWPORT & EDITOR ================ */}
            <div className="flex-1 w-full max-w-[840px] min-w-0">
              <div
                className="text-slate-900 border-2 border-[#800000] outline outline-1 outline-[#c5a059] -outline-offset-4 rounded-xl p-4 sm:p-6 shadow-md max-h-[calc(100vh-95px)] overflow-y-auto relative flex flex-col justify-start min-h-[620px]"
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
                className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 p-4 sm:p-5 text-center bg-[#f0f8ff] border-b-[2.5px] border-[#800000] rounded-t-xl"
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

              {/* Ref & Date Row (Hidden for Discharge / Transfer Certificate where structured metadata box is used) */}
              {!isTcDcActive && (
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 border-b border-slate-300 pb-1 px-1 -mt-[0.25in] mb-[0.25in]">
                  <div>Ref No: <span className="font-mono font-black">{refNo}</span></div>
                  <div>Date: <span className="font-black">{dateStr}</span></div>
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
                    marginBottom: `${metaBodyGap}in`,
                    marginLeft: '0.5in',
                    marginRight: '0.5in'
                  }}
                  className="flex items-stretch justify-between bg-white border border-[#800000] rounded-md overflow-hidden text-[10px] font-sans shadow-2xs"
                >
                  {/* Left Column: 2x2 Metadata Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1 px-3.5 py-3 leading-relaxed">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 text-[9px] shrink-0">Certificate No.:</span>
                      <span className="font-mono font-black text-red-600 truncate">{refNo || '—'}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 text-[9px] shrink-0">Registration No.:</span>
                      <span className="font-mono font-black text-blue-700 truncate">{regNo || '—'}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 text-[9px] shrink-0">Admission No.:</span>
                      <span className="font-mono font-black text-blue-700 truncate">{admissionNo || extractStudentAdmissionNumber(selectedStudent) || '—'}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 text-[9px] shrink-0">Date of Admission:</span>
                      <span className="font-mono font-black text-blue-700 truncate">{admissionDate || extractStudentAdmissionDate(selectedStudent) || '—'}</span>
                    </div>
                  </div>

                  {/* Right Column: Integrated QR Security Badge */}
                  <div className="flex flex-col items-center justify-center px-3.5 py-1.5 bg-slate-50 border-l border-dashed border-slate-300 shrink-0 self-stretch min-w-[84px]">
                    <div className="w-14 h-14 bg-white border border-slate-200 rounded flex flex-col items-center justify-center text-[7.5px] font-mono text-slate-500 font-black shadow-2xs">
                      <span>[ QR CODE ]</span>
                    </div>
                    <span className="text-[6.5px] font-black tracking-wider text-[#800000] uppercase mt-1">SCAN TO VERIFY</span>
                  </div>
                </div>
              )}

              {/* Dynamic Injected Spacing Style Block for Live Canvas */}
              <style>{`
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
                  style={{ lineHeight: bodyLineHeight }}
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
                {/* Signatory 1: Incharge Admissions & Exam */}
                <div className="w-28 sm:w-36 text-center">
                  <div className="border-b-2 border-[#800000] mb-1"></div>
                  <div className="font-black text-[9.5px] uppercase tracking-tight text-[#800000]">{signatories[0] || 'Incharge Admissions & Exam'}</div>
                  <div className="text-[7.5px] sm:text-[8px] text-slate-500 font-bold">Govt. HSS Shangus</div>
                </div>

                {/* Signatory 2: Checked By (Shown for TC/DC or when 3 signatories exist) */}
                {signatories.length > 2 && (
                  <div className="w-28 sm:w-36 text-center">
                    <div className="border-b-2 border-slate-800 mb-1"></div>
                    <div className="font-black text-[9.5px] uppercase tracking-tight text-slate-800">{signatories[1] || 'Checked By'}</div>
                    <div className="text-[7.5px] sm:text-[8px] text-slate-500 font-bold">Govt. HSS Shangus</div>
                  </div>
                )}

                {/* Signatory 3: Principal */}
                <div className="w-28 sm:w-36 text-center">
                  <div className="border-b-2 border-[#800000] mb-1"></div>
                  <div className="font-black text-[9.5px] uppercase tracking-tight text-[#800000]">{signatories[signatories.length - 1] || 'Principal'}</div>
                  <div className="text-[7.5px] sm:text-[8px] text-slate-500 font-bold">Govt. HSS Shangus</div>
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

      </div>

      </div>

      {/* ── Sleek Right-Click Placeholder & Formatting Context Menu ── */}
      {showContextMenu && (
        <div
          style={{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }}
          className="fixed z-[999999] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl p-1.5 w-64 space-y-1 text-xs animate-fadeIn divide-y divide-slate-100 dark:divide-slate-800 max-h-[72vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-2 py-1 flex items-center justify-between text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider">
            <span>Insert Student Field</span>
            <span className="text-[8.5px] text-slate-400 font-mono">1-Click</span>
          </div>

          {/* Group 1: Student & Parents */}
          <div className="pt-1 space-y-0.5">
            <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Student & Parents</div>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder(studentName ? studentName : '{STUDENT_NAME}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Student Name</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{studentName || '{STUDENT_NAME}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(fatherName ? fatherName : '{FATHER_NAME}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Father's Name</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{fatherName || '{FATHER_NAME}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(motherName ? motherName : '{MOTHER_NAME}')}
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
              onClick={() => handleInsertPlaceholder(className || '{CLASS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Class</span>
              <span className="text-[9px] text-slate-400">{className || '{CLASS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(stream || '{STREAM}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Stream</span>
              <span className="text-[9px] text-slate-400">{stream || '{STREAM}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(rollNo || '{ROLL_NO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Class Roll No</span>
              <span className="text-[9px] text-slate-400">{rollNo || '{ROLL_NO}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(regNo || '{REG_NO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Registration No</span>
              <span className="text-[9px] text-slate-400">{regNo || '{REG_NO}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(session || '{SESSION}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Academic Session</span>
              <span className="text-[9px] text-slate-400">{session || '{SESSION}'}</span>
            </button>
          </div>

          {/* Group 3: DOB & Address */}
          <div className="pt-1 space-y-0.5">
            <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">DOB & Record Dates</div>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder(parsedDob.figures || '{DOB_FIGURES}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>DOB (in Figures)</span>
              <span className="text-[9px] text-slate-400">{parsedDob.figures || '{DOB_FIGURES}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(parsedDob.words || '{DOB_WORDS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>DOB (in Words)</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{parsedDob.words || '{DOB_WORDS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(address || '{ADDRESS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Permanent Address</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{address || '{ADDRESS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(dateStr || '{DATE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Certificate Date</span>
              <span className="text-[9px] text-slate-400">{dateStr || '{DATE}'}</span>
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
                  onClick={() => handleInsertPlaceholder(cf.value || `{${cf.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`)}
                  className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{cf.label}</span>
                  <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{cf.value || '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
      <DocumentHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        defaultFilter="bonafide"
        onLoadAsDraft={handleLoadDraftFromHistory}
      />

      {/* == == == == == == == ==  STUDENT JKBOSE RESULT & TC DETAILS EDITOR MODAL == == == == == == == ==  */}
      <StudentResultEditorModal
        isOpen={showResultEditorModal}
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

      {/* == == == == == == == ==  JKBOSE RESULT & AI GAZETTE INGESTION HUB MODAL == == == == == == == ==  */}
      <ResultIngestionModal
        isOpen={showResultIngestionModal}
        onClose={() => setShowResultIngestionModal(false)}
        allStudents={combinedStudentPool.length > 0 ? combinedStudentPool : allStudents}
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

      {/* == == == == == == == ==  BULK TC / DISCHARGE CERTIFICATE GENERATOR MODAL == == == == == == == ==  */}
      <BulkCertificateGeneratorModal
        isOpen={showBulkGeneratorModal}
        onClose={() => setShowBulkGeneratorModal(false)}
        allStudents={combinedStudentPool.length > 0 ? combinedStudentPool : allStudents}
        officeTitle={officeTitle}
        institutionName={institutionName}
        institutionAddress={institutionAddress}
        signatories={[signatoryLeft || 'I/c Admissions', 'Checked By', signatoryRight || 'Principal']}
        showToast={showToast}
      />

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

    </div>
  );
}
