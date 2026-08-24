import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Search, SearchX, Wrench, Columns, Printer, Check, X, Play, ChevronDown, ChevronLeft, ChevronRight, CheckSquare, Square, FileSpreadsheet, FileText, Maximize2, Settings, Hash, Layers, Mail, CreditCard, Camera, Upload, Image as ImageIcon, Download, Copy, Save, RotateCcw, Lock, LogOut, Unlock, Eye, History, Key, MessageSquare, AlertOctagon, Trash2, CheckCircle2, ClipboardCheck, CalendarCheck, Edit3, UserCheck, User, BookOpen, Landmark, CheckCircle, Loader2, PlusCircle, ShieldCheck, ShieldAlert, BarChart2, Building2, Database, Zap, Sliders, Sparkles, Star } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { db } from '../../services/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc, deleteField, writeBatch, query, where } from 'firebase/firestore';
import { invalidateCache, updateCachedItem, getCachedCollectionSync, getCachedCollection, getPhotoUrlFromCache, preloadStudentPhotosCache, fetchStudentPhotoOnDemand, fetchAllMatchingStudentPhotos, syncStudentPhotoOnRegUpdate, reconcileAllStudentPhotosInDatabase } from '../../services/dbCache';
import { compressImageFile, parsePhotoFilename, getStudentPhotoUrl } from '../../utils/imageCompressor';
import ApplicationReviewModal from './ApplicationReviewModal';
import DirectIngestionModal from './DirectIngestionModal';
import ConfirmDialogModal from '../components/ConfirmDialogModal';
import AnalyticsSuiteModal from './AnalyticsSuiteModal';
import DeleteApplicationModal from './DeleteApplicationModal';
import RecycleBinModal from './RecycleBinModal';
import AdminToolsDropdown from './AdminToolsDropdown';
import { moveToRecycleBin, getRecycleBinItems } from '../../services/recycleBinService';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { generateStudentAdmissionPdf, generateBulkAdmissionPdf, downloadStudentAdmissionPdf, downloadBulkAdmissionPdf } from '../../utils/pdfGenerator';
import ModernLoader from '../../components/ModernLoader';
import { parseSearchQuery, executeGlobalSearch, buildLocalSearchIndex, cleanSearchAdm, cleanSearchReg, cleanSearchMobile } from '../../services/searchIndexService';
import { getNextAvailableFormNumber, consumeFormNumber, recycleDeletedFormNumber } from '../../services/formNumberService';
import { getStudentRegIndex, lookupStudentByRegSync } from '../../services/studentIndexService';
import LazyStudentPhoto from '../../components/LazyStudentPhoto';

// ─── Global Helper to extract authentic Class Roll No across all 13 database keys ───
export function getStudentRollVal(st) {
  if (!st) return '';
  const keys = [
    'Class Roll No', 'Class Roll No.', 'RL. NO.', 'RL. NO',
    'Class R.No.', 'Class R.No', 'Class R. No.', 'Class R. No',
    'classRollNo', 'rollNo', 'Roll No.', 'Roll No', 'roll'
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

// ─── Global Helper to normalize class names to canonical values ('11th', '12th', '10th', '9th') ───
export function normalizeClassVal(cls) {
  if (!cls) return '';
  const str = String(cls).trim().toLowerCase();
  if (str.includes('12') || str.includes('xii')) return '12th';
  if (str.includes('11') || str.includes('xi')) return '11th';
  if (str.includes('10') || str.includes('x')) return '10th';
  if (str.includes('9') || str.includes('ix')) return '9th';
  return str;
}

// ─── Global Helper to normalize session strings to canonical format ('2025-26', '2024-25 (Mar-Apr)', '2026 APR/BIAN') ───
export function normalizeSessionVal(sess) {
  if (!sess) return '';
  const str = String(sess).trim();
  // Preserve specific session qualifiers like (Oct-Nov), (Mar-Apr), APR/BIAN
  if (/oct|nov|mar|apr|bian|bi-annual|revised/i.test(str)) {
    return str;
  }
  const match = str.match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
  if (match) {
    const yr1 = match[1];
    let yr2 = match[2];
    if (yr2.length === 4) yr2 = yr2.slice(2);
    return `${yr1}-${yr2}`;
  }
  return str;
}

// ─── CANONICAL JKBOSE SUBJECT CODES & COMPARISON ENGINE ───
export function getCanonicalSubjectCodes(raw) {
  if (!raw) return new Set();
  const tokens = Array.isArray(raw)
    ? raw
    : String(raw).split(/[,;+/|\n\r]+/).map(s => s.trim()).filter(Boolean);

  const codes = new Set();

  tokens.forEach(token => {
    const t = String(token).toLowerCase().trim();
    if (!t || t === '—' || t === 'n/a' || t === '-' || t.includes('same as')) return;

    // English
    if (t === 'ge' || t === 'en' || t.includes('english')) { codes.add('GE'); return; }
    // Environmental Science
    if (t === 'es' || t === 'evs' || t.includes('environmental') || t.includes('environment')) { codes.add('ES'); return; }
    // Physical Education (MUST be checked BEFORE Physics since "physical education" contains "physic")
    if (t === 'pd' || t === 'phe' || t === 'physical education' || t.includes('physical edu')) { codes.add('PD'); return; }
    // Physics
    if (t === 'ph' || t === 'physics' || (t.includes('physic') && !t.includes('education'))) { codes.add('PH'); return; }
    // Chemistry
    if (t === 'ch' || t.includes('chemist')) { codes.add('CH'); return; }
    // Biology / Botany / Zoology
    if (t === 'bi' || t.includes('biolog')) { codes.add('BI'); return; }
    if (t === 'bo' || t.includes('botan')) { codes.add('BO'); return; }
    if (t === 'zo' || t.includes('zoolog')) { codes.add('ZO'); return; }
    if (t === 'bt' || t.includes('biotech')) { codes.add('BT'); return; }
    // Mathematics
    if (t === 'ma' || t === 'math' || t === 'maths' || t.includes('mathemat')) { codes.add('MA'); return; }
    // IT & ITES
    if (t === 'ite' || t === 'it' || t.includes('information tech') || t.includes('ites') || t.includes('it & ites') || t.includes('it and ites')) { codes.add('ITE'); return; }
    // Computer Science
    if (t === 'cs' || t === 'ip' || t.includes('computer') || t.includes('informatics')) { codes.add('CS'); return; }
    // Healthcare
    if (t === 'htc' || t === 'hc' || t.includes('health') || t.includes('healthcare')) { codes.add('HTC'); return; }
    // Tourism
    if (t === 'th' || t === 'tt' || t.includes('tourism') || t.includes('hospitality')) { codes.add('TH'); return; }
    // Agriculture
    if (t === 'ag' || t === 'at' || t.includes('agricult')) { codes.add('AG'); return; }
    // Commerce
    if (t === 'ac' || t === 'act' || t.includes('account')) { codes.add('AC'); return; }
    if (t === 'bs' || t === 'bst' || t.includes('business')) { codes.add('BS'); return; }
    if (t === 'ep' || t.includes('entrepreneur')) { codes.add('EP'); return; }
    // Humanities
    if (t === 'ec' || t.includes('econom')) { codes.add('EC'); return; }
    if (t === 'ht' || t.includes('histor')) { codes.add('HT'); return; }
    if (t === 'ps' || t.includes('pol') || t.includes('politic')) { codes.add('PS'); return; }
    if (t === 'ed' || t.includes('educat')) { codes.add('ED'); return; }
    if (t === 'so' || t.includes('sociol')) { codes.add('SO'); return; }
    if (t === 'ur' || t.includes('urdu')) { codes.add('UR'); return; }
    if (t === 'ar' || t.includes('arabic')) { codes.add('AR'); return; }
    if (t === 'ka' || t === 'ks' || t.includes('kashmir')) { codes.add('KA'); return; }
    if (t === 'hi' || t.includes('hindi')) { codes.add('HI'); return; }
    if (t === 'is' || t.includes('islamic')) { codes.add('IS'); return; }
    if (t === 'gg' || t.includes('geograph')) { codes.add('GG'); return; }
    if (t === 'pl' || t.includes('philosoph')) { codes.add('PL'); return; }
    if (t === 'py' || t.includes('psycholog')) { codes.add('PY'); return; }
    if (t === 'hs' || t.includes('home sci')) { codes.add('HS'); return; }

    // Direct 2-4 letter uppercase abbreviation
    if (/^[a-zA-Z]{2,4}$/.test(t)) {
      codes.add(t.toUpperCase());
    }
  });

  return codes;
}

export function areSubjectSetsMatching(raw1, raw2) {
  if (!raw1 || !raw2 || raw1 === '—' || raw2 === '—') return true;
  const codes1 = getCanonicalSubjectCodes(raw1);
  const codes2 = getCanonicalSubjectCodes(raw2);

  if (codes1.size === 0 || codes2.size === 0) return true;

  // Filter out compulsory common subjects (GE, ES) when checking elective mismatches
  const electives1 = new Set([...codes1].filter(c => c !== 'GE' && c !== 'ES'));
  const electives2 = new Set([...codes2].filter(c => c !== 'GE' && c !== 'ES'));

  if (electives1.size === 0 || electives2.size === 0) {
    return codes1.size === codes2.size && [...codes1].every(c => codes2.has(c));
  }

  // Exact elective match
  if (electives1.size === electives2.size && [...electives1].every(c => electives2.has(c))) {
    return true;
  }

  // If both have at least 3 matching core electives and size difference <= 1
  const common = [...electives1].filter(c => electives2.has(c));
  if (common.length >= 3 && Math.abs(electives1.size - electives2.size) <= 1) {
    if (electives1.size === electives2.size) return true;
  }

  return false;
}

// ─── Global Helper to resolve authentic student stream without 'Same as in class 11th' ───
export function resolveStudentStream(st, masterMatch = null) {
  if (!st && !masterMatch) return 'General';

  // 1. Check direct stream fields
  const candidates = [
    st?.['Stream for Class 11th'],
    st?.['Stream opted in Class 11th'],
    st?.['Stream & Subjects for Class 12th'],
    st?.['Stream / Faculty'],
    st?.stream,
    st?.Stream,
    masterMatch?.['Stream'],
    masterMatch?.stream,
    masterMatch?.['Stream for Class 11th'],
    masterMatch?.['Stream opted in Class 11th']
  ];

  for (const cand of candidates) {
    if (cand && typeof cand === 'string') {
      const trimmed = cand.trim();
      const lower = trimmed.toLowerCase();
      if (lower && !lower.includes('same as') && lower !== '—' && lower !== 'n/a' && lower !== 'null' && lower !== 'undefined' && lower !== '-') {
        if (lower.includes('hum') || lower.includes('art')) return 'Humanities';
        if (lower.includes('com')) return 'Commerce';
        if (lower.includes('sci') || lower.includes('med')) return 'Science';
        if (lower.includes('home sci') || lower.includes('home-sci')) return 'Home Science';
        if (lower.includes('gen')) return 'General';
        return trimmed;
      }
    }
  }

  // 2. If Class 9th or 10th -> General
  const cls = String(st?.['Admission sought for class'] || st?.['Class'] || st?.class || masterMatch?.Class || '').toLowerCase();
  if (cls.includes('9') || cls.includes('10')) {
    return 'General';
  }

  // 3. Infer canonically from subjects using canonical subject codes
  const rawSubjs = (
    String(st?.subs || '') + ' ' +
    String(st?.Subjects || '') + ' ' +
    String(st?.['Subjects to be taken in Class 11th'] || '') + ' ' +
    String(st?.['Subjects to be taken in Class 12th'] || '') + ' ' +
    String(st?.['Subjects Studied in Class 11th'] || '') + ' ' +
    String(st?.selectedSubjects || '') + ' ' +
    String(st?.Subjects1 || '') + ' ' +
    String(st?.Subjects2 || '') + ' ' +
    String(st?.Subjects3 || '') + ' ' +
    String(st?.Subjects4 || '') + ' ' +
    String(st?.Subjects5 || '') + ' ' +
    String(st?.Subject6 || '') + ' ' +
    String(masterMatch?.subs || '') + ' ' +
    String(masterMatch?.Subjects || '')
  );

  const codes = getCanonicalSubjectCodes(rawSubjs);

  // Pure Science: (Physics && Chemistry) or (Physics && Biology) or (Chemistry && Biology) or pure science codes
  if ((codes.has('PH') && codes.has('CH')) || (codes.has('PH') && codes.has('BI')) || (codes.has('CH') && codes.has('BI')) || (codes.has('PH') && codes.has('MA')) || codes.has('BO') || codes.has('ZO') || codes.has('BT')) {
    return 'Science';
  }

  // Commerce Core:
  if (codes.has('AC') || codes.has('BS') || codes.has('EP')) {
    return 'Commerce';
  }

  // Humanities Core:
  if (codes.has('HT') || codes.has('PS') || codes.has('ED') || codes.has('EC') || codes.has('SO') || codes.has('UR') || codes.has('AR') || codes.has('KA') || codes.has('HI') || codes.has('IS') || codes.has('GG') || codes.has('PL') || codes.has('PY')) {
    return 'Humanities';
  }

  if (cls.includes('11') || cls.includes('12')) {
    return 'Humanities';
  }

  return 'General';
}

// ─── Global Helper for safe Firestore document mutation handling IDs with slashes ───
export async function updateStudentDocument(student, updates) {
  if (!student || !updates) return false;
  const formNo = String(student['Form No.'] || student.formNo || student['Form Number'] || '').replace(/^'/, '').trim();
  const rawId = String(student.docId || student._docId || student.id || '').trim();
  
  // Clean and synchronize all Registration Number aliases
  const rawUpdatedReg = 
    updates.boardRegNo ||
    updates['Board Registration Number'] ||
    updates['Board Registration No.'] ||
    updates['Board Registration No. (Class 10th)'] ||
    updates['Board Registration No. (Class 11th)'] ||
    updates['Registration No. (allotted by JKBOSE)'] ||
    updates.regNo ||
    updates['REG. NO.'] ||
    updates['Registration No.'] ||
    updates['Registration No'];

  const oldReg = cleanRegNoVal(
    student?.boardRegNo ||
    student?.['Board Registration Number'] ||
    student?.['Board Registration No.'] ||
    student?.['Board Registration No. (Class 10th)'] ||
    student?.['Board Registration No. (Class 11th)'] ||
    student?.['Registration No. (allotted by JKBOSE)'] ||
    student?.regNo ||
    student?.['REG. NO.'] ||
    student?.['Registration No.'] ||
    ''
  );

  let newReg = '';
  if (rawUpdatedReg !== undefined && rawUpdatedReg !== null) {
    newReg = cleanRegNoVal(rawUpdatedReg);
    if (newReg && newReg !== '—') {
      updates.boardRegNo = newReg;
      updates.regNo = newReg;
      updates['Board Registration Number'] = newReg;
      updates['Board Registration No.'] = newReg;
      updates['Board Registration No. (Class 10th)'] = newReg;
      updates['Board Registration No. (Class 11th)'] = newReg;
      updates['Registration No. (allotted by JKBOSE)'] = newReg;
      updates['REG. NO.'] = newReg;
      updates['Registration No.'] = newReg;
    }
  }

  const idCandidates = Array.from(new Set([
    rawId,
    student._docId,
    student.docId,
    student.id,
    formNo ? `adm_${formNo}` : '',
    formNo ? `active_${formNo}` : '',
    rawId.replace(/^active_/, ''),
    rawId.replace(/^hist_/, ''),
    formNo
  ].filter(Boolean)));

  let updated = false;

  for (const cid of idCandidates) {
    if (!cid || cid.includes('/')) continue;
    try {
      await updateDoc(doc(db, 'admissions', cid), updates);
      updated = true;
      break;
    } catch (e) {
      try {
        await setDoc(doc(db, 'admissions', cid), updates, { merge: true });
        updated = true;
        break;
      } catch (err2) {}
    }

    try {
      await updateDoc(doc(db, 'masterRegisters', cid), updates);
      updated = true;
      break;
    } catch (e) {
      try {
        await setDoc(doc(db, 'masterRegisters', cid), updates, { merge: true });
        updated = true;
        break;
      } catch (err2) {}
    }
  }

  if (!updated && formNo && formNo !== '—') {
    for (const field of ['Form Number', 'Form No.', 'formNo', 'id']) {
      try {
        const qSnap = await getDocs(query(collection(db, 'admissions'), where(field, '==', formNo)));
        if (!qSnap.empty) {
          for (const dSnap of qSnap.docs) {
            await setDoc(doc(db, 'admissions', dSnap.id), updates, { merge: true });
            updated = true;
          }
          break;
        }
      } catch (e) {}
    }
  }

  // Update ONLY single item in cache (no full refetch)
  idCandidates.forEach(cid => {
    updateCachedItem('admissions', cid, updates);
    updateCachedItem('masterRegisters', cid, updates);
  });

  // Automatically synchronize centralized student photo when registration number or photo updates
  if (newReg || updates.photo_id || updates.photoUrl) {
    const photoData = updates?.photo_id || updates?.photoUrl || '';
    syncStudentPhotoOnRegUpdate({
      oldReg: oldReg || newReg,
      newReg: newReg || oldReg,
      student: { ...student, ...updates },
      photoData
    }).catch(() => {});
  }

  return updated;
}

export async function deleteStudentDocument(student) {
  if (!student) return false;
  const sourceColl = student._sourceCollection || student._source || (student._isCurrentScope ? 'admissions' : 'masterRegisters');
  try {
    await moveToRecycleBin(student, sourceColl, 'Admin');
  } catch (err) {
    console.error('moveToRecycleBin in deleteStudentDocument error:', err);
  }
  return true;
}

// ─── Reusable Multi-Select Checkbox Dropdown Component ───
function MultiSelectCheckboxDropdown({ label, options = [], selected = [], onChange, align = 'left' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [localSelected, setLocalSelected] = useState(selected);

  useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);

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

  const isAllSelected = localSelected.length === 0;
  const isNoneSelected = localSelected.includes('__NONE__');

  const toggleOption = (opt) => {
    let next;
    if (localSelected.includes('__NONE__')) {
      next = [opt];
    } else if (localSelected.length === 0) {
      next = options.filter((item) => item !== opt);
    } else if (localSelected.includes(opt)) {
      next = localSelected.filter((item) => item !== opt);
    } else {
      next = [...localSelected, opt];
    }

    if (next.length === 0) {
      next = ['__NONE__'];
    } else if (next.length === options.length) {
      next = [];
    }
    setLocalSelected(next);
    React.startTransition(() => {
      onChange(next);
    });
  };

  const handleSelectAll = () => {
    setLocalSelected([]);
    React.startTransition(() => {
      onChange([]);
    });
  };

  const handleDeselectAll = () => {
    setLocalSelected(['__NONE__']);
    React.startTransition(() => {
      onChange(['__NONE__']);
    });
  };

  const displayText = isAllSelected
    ? `All ${label}`
    : isNoneSelected
      ? `No ${label}`
      : localSelected.length === 1
        ? localSelected[0]
        : `${label} (${localSelected.length})`;

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2 py-1 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-between gap-1 transition-all cursor-pointer shadow-sm ${!isAllSelected
          ? 'bg-amber-700 text-white border border-amber-800'
          : 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:bg-slate-50'
          }`}
      >
        <span className="truncate flex-1 min-w-0 text-left">{displayText}</span>
        <ChevronDown size={12} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 w-48 sm:w-52 max-w-[calc(100vw-32px)] rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl z-50 p-2 space-y-1.5 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100`}>
          <div className="flex items-center justify-between px-1 py-0.5 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black gap-1">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider font-extrabold truncate flex-1 min-w-0">{label}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-1.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 text-[10px] font-black cursor-pointer transition-colors shadow-2xs"
              >
                All
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-1.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 hover:bg-rose-200 text-[10px] font-black cursor-pointer transition-colors shadow-2xs"
              >
                None
              </button>
            </div>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-0.5 py-0.5">
            {options.map((opt, idx) => {
              const checked = isAllSelected || (selected.includes(opt) && !isNoneSelected);
              return (
                <button
                  key={`${opt}_${idx}`}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className="w-full flex items-center gap-2 px-1.5 py-1 rounded-lg text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  {checked ? (
                    <CheckSquare size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  ) : (
                    <Square size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  )}
                  <span className="truncate flex-1 min-w-0">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Unified Filters Group Dropdown (Grouped Classes, Gender, Stream, Status, Session) ───
function UnifiedFiltersGroupDropdown({
  availableSessions,
  selectedSessions,
  setSelectedSessions,
  availableClasses,
  selectedClasses,
  setSelectedClasses,
  availableGenders,
  selectedGenders,
  setSelectedGenders,
  availableStreams,
  selectedStreams,
  setSelectedStreams,
  availableStatuses,
  selectedStatuses,
  setSelectedStatuses,
  sortBy = 'classRollNo',
  setSortBy,
  sortOrder = 'asc',
  setSortOrder,
  setCurrentPage
}) {
  const [isOpen, setIsOpen] = useState(false);
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

  const totalActiveFilters =
    (selectedClasses.length > 0 && !selectedClasses.includes('__NONE__') ? 1 : 0) +
    (selectedGenders.length > 0 && !selectedGenders.includes('__NONE__') ? 1 : 0) +
    (selectedStreams.length > 0 && !selectedStreams.includes('__NONE__') ? 1 : 0) +
    (selectedStatuses.length > 0 && !selectedStatuses.includes('__NONE__') ? 1 : 0) +
    (selectedSessions.length > 0 && !selectedSessions.includes('__NONE__') ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedClasses([]);
    setSelectedGenders([]);
    setSelectedStreams([]);
    setSelectedStatuses([]);
    setSelectedSessions([]);
    if (setSortBy) setSortBy('classRollNo');
    if (setSortOrder) setSortOrder('asc');
    if (setCurrentPage) setCurrentPage(1);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${totalActiveFilters > 0
          ? 'bg-amber-700 text-white border border-amber-800'
          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50'
          }`}
      >
        <span className="flex items-center gap-1">
          <span>🔍</span>
          <span className="hidden sm:inline">Filters</span>
        </span>
        {totalActiveFilters > 0 && (
          <span className="bg-white text-amber-900 px-1.5 py-0.2 rounded-full text-[10px] font-black shadow-2xs">
            {totalActiveFilters}
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute -left-24 sm:left-0 mt-1.5 w-[280px] sm:w-[310px] max-w-[calc(100vw-16px)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2.5 sm:p-3 space-y-2 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 text-xs font-black gap-2">
            <span className="text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px] whitespace-nowrap">Filter Student Records</span>
            {totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer whitespace-nowrap"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 w-full">
            {availableSessions.length > 1 && (
              <MultiSelectCheckboxDropdown
                label="Sessions"
                options={availableSessions}
                selected={selectedSessions}
                onChange={(val) => { setSelectedSessions(val); setCurrentPage(1); }}
                align="left"
              />
            )}

            <MultiSelectCheckboxDropdown
              label="Classes"
              options={availableClasses}
              selected={selectedClasses}
              onChange={(val) => { setSelectedClasses(val); setCurrentPage(1); }}
              align="left"
            />

            <MultiSelectCheckboxDropdown
              label="Gender"
              options={availableGenders}
              selected={selectedGenders}
              onChange={(val) => { setSelectedGenders(val); setCurrentPage(1); }}
              align="right"
            />

            <MultiSelectCheckboxDropdown
              label="Streams"
              options={availableStreams}
              selected={selectedStreams}
              onChange={(val) => { setSelectedStreams(val); setCurrentPage(1); }}
              align="left"
            />

            <MultiSelectCheckboxDropdown
              label="Status"
              options={availableStatuses}
              selected={selectedStatuses}
              onChange={(val) => { setSelectedStatuses(val); setCurrentPage(1); }}
              align="right"
            />
          </div>

          {/* Sort Controls inside Filter popover */}
          {setSortBy && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Sort Records By</span>
                <button
                  type="button"
                  onClick={() => setSortOrder && setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="text-amber-700 dark:text-amber-400 font-extrabold hover:underline cursor-pointer flex items-center gap-1"
                  title="Toggle Sort Order"
                >
                  <span>{sortOrder === 'asc' ? 'Asc ⬆️' : 'Desc ⬇️'}</span>
                </button>
              </div>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); if (setCurrentPage) setCurrentPage(1); }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="classRollNo">🔢 Class Roll No (Default)</option>
                <option value="formNo">📄 Form Number</option>
                <option value="admNo">🎓 Admission Number (Adm. No.)</option>
                <option value="studentName">👤 Student's Name (A-Z)</option>
                <option value="boardRegNo">🆔 Board Registration No.</option>
                <option value="onlineSubmDate">📅 Online Submission Date</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reusable More Actions Dropdown (Slim Toolbar Consolidated Button) ───
function MoreActionsDropdown({
  density,
  setDensity,
  setShowColumnManager,
  onPrint,
  onExportCSV,
  onSync,
  onOpenRecycleBin,
  unreadRecycleBinCount = 0,
  loading,
  align = 'right'
}) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="More Actions & Display Settings"
        className="relative p-1.5 rounded-xl font-black bg-gradient-to-r from-indigo-700 to-indigo-800 hover:from-indigo-600 hover:to-indigo-700 text-white flex items-center justify-center shadow-sm transition-all cursor-pointer text-xs"
      >
        <Settings size={15} />
        {unreadRecycleBinCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black font-mono shadow-sm animate-bounce">
            {unreadRecycleBinCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className={`absolute ${align === 'left' ? 'left-0 sm:right-0 sm:left-auto' : 'right-0'} mt-1.5 w-60 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 space-y-1 animate-fadeIn bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-slate-100 text-xs font-extrabold`}
        >
          <div className="px-2 py-1 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400">
            Layout & Display Controls
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60">
            <span>Density:</span>
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 text-[10px]">
              <button
                type="button"
                onClick={() => setDensity('fit')}
                className={`px-2 py-0.5 rounded font-black transition-colors ${density === 'fit' ? 'bg-amber-700 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-300'}`}
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2 py-0.5 rounded font-black transition-colors ${density === 'compact' ? 'bg-amber-700 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-300'}`}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDensity('normal')}
                className={`px-2 py-0.5 rounded font-black transition-colors ${density === 'normal' ? 'bg-amber-700 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-300'}`}
              >
                Normal
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setShowColumnManager(true); setIsOpen(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-extrabold cursor-pointer"
          >
            <Columns size={13} />
            <span>Manage Table Columns (Cols)</span>
          </button>

          {onOpenRecycleBin && (
            <button
              type="button"
              onClick={() => { onOpenRecycleBin(); setIsOpen(false); }}
              className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-between text-amber-800 dark:text-amber-300 font-extrabold cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Trash2 size={13} className="text-amber-600 dark:text-amber-400" />
                <span>90-Day Recycle Bin</span>
              </span>
              {unreadRecycleBinCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-black font-mono">
                  {unreadRecycleBinCount}
                </span>
              )}
            </button>
          )}

          <div className="px-2 py-1 border-t border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400 mt-1">
            Export & Print
          </div>

          <button
            type="button"
            onClick={() => { onPrint(); setIsOpen(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-extrabold cursor-pointer"
          >
            <Printer size={13} />
            <span>Print Register Report</span>
          </button>

          <button
            type="button"
            onClick={() => { onExportCSV(); setIsOpen(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-teal-600 dark:text-teal-400 font-extrabold cursor-pointer"
          >
            <FileSpreadsheet size={13} />
            <span>Export to Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => { onSync(); setIsOpen(false); }}
            disabled={loading}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300 font-extrabold cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Force Sync Data</span>
          </button>
        </div>
      )}
    </div>
  );
}

const SUBJECT_ABBR_MAP = {
  // Academic Subjects
  'General English': 'GE',
  'English Literature': 'EL',
  'Functional English': 'FE',
  'English': 'GE',
  'Hindi': 'HI',
  'Dogri': 'DG',
  'Sanskrit': 'SA',
  'Punjabi': 'PU',
  'Bhoti': 'BO',
  'Arabic': 'AR',
  'Persian': 'PE',
  'Kashmiri': 'KA',
  'Urdu': 'UR',
  'History': 'HT',
  'Economics': 'EC',
  'Geography': 'GG',
  'Philosophy': 'PL',
  'Education': 'ED',
  'Psychology': 'PY',
  'Sociology': 'SO',
  'Political Science': 'PS',
  'Home Science (Elective)': 'HS',
  'Home Science': 'HS',
  'Statistics': 'SS',
  'Mathematics': 'MA',
  'Maths': 'MA',
  'Islamic Studies': 'IS',
  'Vedic Studies': 'VS',
  'Computer Science': 'CS',
  'Information Practices': 'IP',
  'Environmental Science': 'ES',
  'Environmental Education': 'ES',
  'EVS': 'ES',
  'Physics': 'PH',
  'Chemistry': 'CH',
  'Biology (Botany/Zoology)': 'BI',
  'Biology': 'BI',
  'Science': 'BI',
  'Science (Physics, Chemistry, Biology)': 'BI',
  'Science (Phy/Chem/Bio)': 'BI',
  'Social Science (Hist/Civ/Geog)': 'SST',
  'Social Science': 'SST',
  'Social Studies': 'SST',
  'Electronics': 'ET',
  'Biotechnology': 'BT',
  'Bio-chemistry': 'BC',
  'Music': 'MU',
  'Family Health Care & Prevention': 'FH',
  'Food Science': 'FS',
  'Management of Resources': 'MR',
  'Business Studies': 'BS',
  'Travel, Tourism & Hotel Management': 'TT',
  'Accountancy': 'AY',
  'Entrepreneurship': 'EP',
  'Public Administration': 'PA',
  'Typewriting and Shorthand': 'TS',
  'Business Mathematics': 'BM',
  'Geology': 'GO',
  'Buddhist Studies': 'BU',
  'Physical Education': 'PD',
  'Clothing for the Family': 'CT',
  'Applied Mathematics': 'AM',
  'Microbiology': 'MB',
  'Extension Education': 'EE',
  'Human Development': 'HD',

  // Vocational Subjects
  'IT and ITeS': 'ITE',
  'IT & ITES': 'ITE',
  'IT and ITES': 'ITE',
  'Retail': 'RET',
  'Healthcare': 'HTC',
  'Tourism': 'TOU',
  'Tourism and Hospitality': 'TOU',
  'Security': 'SEC',
  'Agriculture': 'AGR',
  'Telecommunication': 'TLC',
  'Media and Entertainment': 'MDE',
  'Beauty and Wellness': 'BTW',
  'Physical Education & Sports': 'PES',
};

const abbreviateSubjects = (str) => {
  if (!str || str === '—') return '—';
  const parts = String(str).split(',').map(s => s.trim()).filter(Boolean);
  const abbrParts = parts.map(part => {
    if (SUBJECT_ABBR_MAP[part]) return SUBJECT_ABBR_MAP[part];
    const foundKey = Object.keys(SUBJECT_ABBR_MAP).find(k => k.toLowerCase() === part.toLowerCase());
    if (foundKey) return SUBJECT_ABBR_MAP[foundKey];

    if (/general english|functional english|english/i.test(part)) return 'GE';
    if (/math/i.test(part)) return 'MA';
    if (/social science|social studies|sst/i.test(part)) return 'SST';
    if (/science/i.test(part) && !/environmental|political|social|food|home/i.test(part)) return 'BI';
    if (/environmental|evs/i.test(part)) return 'ES';
    if (/physics/i.test(part)) return 'PH';
    if (/chemistry/i.test(part)) return 'CH';
    if (/biology|botany|zoology/i.test(part)) return 'BI';
    if (/urdu/i.test(part)) return 'UR';
    if (/health/i.test(part)) return 'HTC';
    if (/it and ites|it & ites|information tech|ites/i.test(part)) return 'ITE';
    if (/physical education & sports|sports/i.test(part)) return 'PES';
    if (/physical education/i.test(part)) return 'PD';
    if (/history/i.test(part)) return 'HT';
    if (/political/i.test(part)) return 'PS';
    if (/sociology/i.test(part)) return 'SO';
    if (/economics/i.test(part)) return 'EC';
    if (/education/i.test(part)) return 'ED';
    if (/arabic/i.test(part)) return 'AR';
    if (/kashmiri/i.test(part)) return 'KA';
    if (/hindi/i.test(part)) return 'HI';
    if (/retail/i.test(part)) return 'RET';
    if (/tourism/i.test(part)) return 'TOU';

    if (part.length > 4) {
      return part.slice(0, 3).toUpperCase();
    }
    return part.toUpperCase();
  });

  return abbrParts.join(', ');
};

// Helper: Automatically convert DOB figures (e.g. 08-05-2011, 16-04-2008, 1996-01-01) to official DOB words
const DAY_ORDINAL_WORDS = [
  '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth',
  'Twenty First', 'Twenty Second', 'Twenty Third', 'Twenty Fourth', 'Twenty Fifth', 'Twenty Sixth', 'Twenty Seventh', 'Twenty Eighth', 'Twenty Ninth', 'Thirtieth',
  'Thirty First'
];

const MONTH_NAMES_WORDS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function numberToWordsSmall(n) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n < 20) return ones[n];
  const rem = n % 10;
  return tens[Math.floor(n / 10)] + (rem ? ' ' + ones[rem] : '');
}

function yearToWords(yearNum) {
  if (yearNum >= 2000 && yearNum <= 2099) {
    if (yearNum === 2000) return 'Two Thousand';
    const rem = yearNum - 2000;
    return 'Two Thousand ' + numberToWordsSmall(rem);
  }
  if (yearNum >= 1900 && yearNum <= 1999) {
    const lastTwo = yearNum % 100;
    if (lastTwo === 0) return 'Nineteen Hundred';
    return 'Nineteen ' + numberToWordsSmall(lastTwo);
  }
  return String(yearNum);
}

/**
 * Standardize DOB strings to DD-MM-YYYY format for consistent table display across all records.
 */
export function formatDobToDisplay(dobRaw) {
  if (!dobRaw || dobRaw === '—' || dobRaw === 'N/A' || dobRaw === 'null' || dobRaw === 'undefined') return '—';
  const str = String(dobRaw).trim();
  // 1. Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}-${m}-${y}`;
  }
  // 2. Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}-${m}-${y}`;
  }
  // 3. Fallback Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return str;
}

/**
 * Format online submission date/timestamp to DD-MM-YYYY HH:mm AM/PM or DD-MM-YYYY
 */
export function formatOnlineSubmDate(val) {
  if (!val || val === '—' || val === 'N/A' || val === '-') return '—';
  try {
    let d;
    if (typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (typeof val.toMillis === 'function') {
      d = new Date(val.toMillis());
    } else if (typeof val === 'object' && typeof val.seconds === 'number') {
      d = new Date(val.seconds * 1000);
    } else if (typeof val === 'number') {
      d = new Date(val);
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === '—') return '—';
      if (/^\d{2}[-/.]\d{2}[-/.]\d{4}/.test(trimmed)) {
        return trimmed.replace(/\//g, '-');
      }
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        d = new Date(parsed);
      } else {
        return trimmed;
      }
    }

    if (d && !isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = String(hours).padStart(2, '0');
      return `${day}-${month}-${year} ${strHours}:${minutes} ${ampm}`;
    }
  } catch (err) {
    console.error('Error formatting onlineSubmDate:', err);
  }
  return String(val);
}

/**
 * Extract numerical timestamp for sorting records by newest activity.
 */
export function getDocTimestamp(rec) {
  if (!rec) return 0;
  const ts = rec.updatedAt || rec.createdAt || rec['Online Subm. Date'] || rec.onlineSubmDate || rec.submittedAt || rec.timestamp || rec.admDate;
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? 0 : parsed;
}

function convertDobToWords(dobRaw) {
  if (!dobRaw || dobRaw === '—' || dobRaw === 'N/A') return '';
  const str = String(dobRaw).trim();

  let day = 0, month = 0, year = 0;

  // 1. Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  let m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    day = parseInt(m[1], 10);
    month = parseInt(m[2], 10);
    year = parseInt(m[3], 10);
  } else {
    // 2. Match YYYY-MM-DD or YYYY/MM/DD
    m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) {
      year = parseInt(m[1], 10);
      month = parseInt(m[2], 10);
      day = parseInt(m[3], 10);
    } else {
      // 3. Try Date parsing
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        day = d.getDate();
        month = d.getMonth() + 1;
        year = d.getFullYear();
      }
    }
  }

  if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2099) {
    const dayWord = DAY_ORDINAL_WORDS[day];
    const monthWord = MONTH_NAMES_WORDS[month];
    const yearWord = yearToWords(year);
    if (dayWord && monthWord && yearWord) {
      return `${dayWord} of ${monthWord} ${yearWord}`;
    }
  }
  return '';
}

// Smart Title Case Formatter for Names (Fixes AHmad, ahmad, AHMAD -> Ahmad)
const formatProperName = (str) => {
  if (!str || typeof str !== 'string' || str === '—') return str || '—';
  const trimmed = str.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '—';

  return trimmed
    .split(' ')
    .map(word => {
      if (!word) return '';
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : '')
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

// Helper for Re-admission & Admission Number Formatting (sanitizes #N/A, #VALUE!, #REF!, etc.)
const cleanAdmNoVal = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    return String(val);
  }
  const str = String(val).trim();
  if (
    !str ||
    /^(#N\/A|#VALUE!|#REF!|#N\/A!|#NAME\?|#NULL!|#NUM!|#DIV\/0!|N\/A|NA|—|-|null|undefined|nan|none)$/i.test(str)
  ) {
    return '';
  }
  // Reject ordinal class names like "11th", "12th", "9th", "10th"
  if (/^\d{1,2}(st|nd|rd|th)$/i.test(str)) return '';
  // Reject explicit class strings like "Class 11", "Class 12", "11th Class", "Class 11th"
  if (/^class\s*\d{1,2}(st|nd|rd|th)?$/i.test(str)) return '';
  if (/^\d{1,2}(st|nd|rd|th)?\s+class$/i.test(str)) return '';
  return str;
};

const extractRawAdmNo = (rec) => {
  if (!rec) return '';

  // 1. Direct property key candidates across all common casing & naming variants
  const candidates = [
    rec['admNo'],
    rec['Adm. No.'],
    rec['Adm No.'],
    rec['Adm No'],
    rec['Adm. No'],
    rec['Adm.No.'],
    rec['Adm.No'],
    rec['AdmNo'],
    rec['adm_no'],
    rec['ADM. NO.'],
    rec['ADM NO'],
    rec['ADM_NO'],
    rec['Admission No.'],
    rec['Admission No'],
    rec['Admission Number'],
    rec['Adm. Number'],
    rec['Adm. #'],
    rec['Adm #'],
    rec['Adm_No'],
    rec['adm_number'],
    rec['Admission_No'],
    rec['Admission_Number'],
    rec['Adm. No. (if allotted)'],
    rec['Adm No (if allotted)'],
    rec['Admitted S.No'],
    rec['Admitted S. No.'],
    rec['S.No'],
    rec['S. No.']
  ];

  for (const c of candidates) {
    const cleaned = cleanAdmNoVal(c);
    if (cleaned) return cleaned;
  }

  // 2. Dynamic key scan fallback for any property containing 'adm' or 'admission' + 'no'/'number'/'#'
  for (const key of Object.keys(rec)) {
    const kLower = key.toLowerCase();
    if (
      (kLower.includes('adm') && (kLower.includes('no') || kLower.includes('number') || kLower.includes('#'))) ||
      (kLower.includes('admission') && (kLower.includes('no') || kLower.includes('number') || kLower.includes('#')))
    ) {
      // Skip fields that are NOT admission numbers
      if (kLower.includes('readmission') || kLower.includes('status') || kLower.includes('sought') || kLower.includes('class') || kLower.includes('date') || kLower.includes('form')) continue;
      const cleaned = cleanAdmNoVal(rec[key]);
      if (cleaned && !/^(yes|no|true|false)$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return '';
};

const formatStudentAdmNo = (rec) => {
  if (!rec) return '';
  let newAdm = extractRawAdmNo(rec);

  const isReAdmission =
    String(
      rec['readmission'] ||
      rec['Re-admission'] ||
      rec['isReadmission'] ||
      rec['Is Re-admission'] ||
      rec['Are you seeking Re-admission?'] ||
      rec['reAdmissionStatus'] || ''
    ).toLowerCase() === 'yes' ||
    rec['readmission'] === true ||
    rec['isReadmission'] === true;

  const oldAdm = cleanAdmNoVal(
    rec['Old Admission No.'] ||
    rec['Old Adm. No.'] ||
    rec['oldAdmNo'] ||
    rec['old_adm_no'] ||
    rec['Old Admission Number'] ||
    rec['Previous Adm. No.'] ||
    rec['Prev Adm No']
  );

  if (isReAdmission && oldAdm && oldAdm !== newAdm) {
    return newAdm ? `${newAdm} (${oldAdm})` : `${oldAdm}`;
  }

  if (!newAdm && oldAdm) {
    return oldAdm;
  }

  return newAdm;
};

export const cleanFormNo = (val) => {
  if (!val) return '—';
  if (typeof val === 'object') {
    val = val['Form Number'] || val['Form No.'] || val['Form No'] || val['FormNo'] || val['formNumber'] || val.formNo || val.form_no || val.docId || val.id || '—';
  }
  const str = String(val).replace(/^'/, '').trim();
  if (!str || str === '—' || str === 'N/A' || str === 'null' || str === 'undefined' || str === '-') return '—';
  return str;
};

export const extractStudentFormNo = (rec) => {
  if (!rec) return '—';
  if (typeof rec !== 'object') return cleanFormNo(rec);
  const val = rec['Form Number'] || rec['Form No.'] || rec['Form No'] || rec['FormNo'] || rec['formNumber'] || rec.formNo || rec.form_no || rec.docId || rec.id;
  return cleanFormNo(val);
};

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

export const areNamesCompatible = (n1, n2) => {
  if (!n1 || !n2) return true;
  const clean1 = String(n1).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const clean2 = String(n2).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (!clean1 || !clean2 || clean1 === 'student' || clean2 === 'student' || clean1 === '—' || clean2 === '—') return true;
  if (clean1 === clean2) return true;

  if (clean1.startsWith(clean2) || clean2.startsWith(clean1)) return true;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

  const tokens1 = clean1.split(/\s+/).filter(t => t.length > 2);
  const tokens2 = clean2.split(/\s+/).filter(t => t.length > 2);
  if (tokens1.length === 0 || tokens2.length === 0) return true;

  const common = tokens1.filter(t => tokens2.includes(t));
  if (common.length >= 2) return true;
  if (common.length >= 1 && (tokens1.length === 1 || tokens2.length === 1)) return true;

  return false;
};

export const filterActiveAgainstRecycleBin = (list, trashItems) => {
  if (!Array.isArray(list) || list.length === 0) return [];
  if (!Array.isArray(trashItems) || trashItems.length === 0) {
    return list.filter(s => s && s.Status !== 'Deleted' && s.status !== 'Deleted' && s._deleted !== true);
  }

  const admissionTrash = trashItems.filter(item => (item?.originalCollection || 'admissions') === 'admissions');
  const trashForms = new Set(admissionTrash.map(i => i.formNo || i.data?.['Form Number'] || i.data?.formNo).filter(f => f && f !== '—').map(String));
  const trashDocIds = new Set(admissionTrash.flatMap(i => [i.originalDocId, i.sanitizedDocId]).filter(Boolean).map(String));

  return list.filter(s => {
    if (!s) return false;
    if (s.Status === 'Deleted' || s.status === 'Deleted' || s._deleted === true) return false;

    const sForm = extractStudentFormNo(s);
    if (sForm && sForm !== '—' && trashForms.has(sForm)) return false;

    // A registration number belongs to the student across sessions and may
    // legitimately identify several applications. Recycle filtering must only
    // hide the exact archived document/form, never every matching registration.
    const sId = String(s._docId || s.docId || s.id || '').trim();
    if (sId && trashDocIds.has(sId)) return false;

    return true;
  });
};

export const extractRegNo = (st) => {
  if (!st) return '';
  const raw = String(
    st['Board Registration Number'] ||
    st['Board Registration No. (Class 11th)'] ||
    st['Board Registration No. (Class 10th)'] ||
    st['Board Reg. No.'] ||
    st['Board Reg No'] ||
    st['Reg. No.'] ||
    st['Reg No'] ||
    st['Registration No'] ||
    st['Registration Number'] ||
    st.boardRegNo ||
    st.regNo ||
    st.registrationNo ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();

  return cleanRegNoVal(raw);
};

export const extractRegNoClean = (st) => {
  const raw = extractRegNo(st);
  if (!raw || raw === '—') return '';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

export const getStudentName = (st) => {
  if (!st) return '';
  return String(
    st["Student's Name (as per school records)"] ||
    st["Student's Name"] ||
    st['Student Name'] ||
    st['Name of Student'] ||
    st['Account Name'] ||
    st.studentName ||
    st['Name'] ||
    st['name'] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();
};

export const getFatherName = (st) => {
  if (!st) return '';
  return String(
    st["Father's/Guardian's Name (as per school records)"] ||
    st["Father's Name"] ||
    st['Father Name'] ||
    st.fatherName ||
    st["Parent's Name"] ||
    ''
  ).replace(/^(N\/A|—)$/i, '').trim();
};

export const resolveAdmNo = (rec) => {
  if (!rec) return '—';
  const directFormat = formatStudentAdmNo(rec);
  if (directFormat && directFormat !== '—' && directFormat.length > 0) return directFormat;
  const raw = extractRawAdmNo(rec);
  const cleaned = cleanAdmNoVal(raw);
  return cleaned || '—';
};

// Bulk mutations must never identify a record by a name, registration number,
// or form number. Those values can legitimately be shared while records are
// being merged; only the Firestore document ID is safe for exact selection.
const getExactAdmissionDocId = (student) => String(
  student?._docId || student?.docId || student?.id || ''
).trim();

async function updateExactAdmissionDocument(student, updates) {
  const exactId = getExactAdmissionDocId(student);
  if (!exactId || exactId.includes('/')) {
    throw new Error('This record has no safe Firestore document ID. Refresh the table and try again.');
  }
  await updateDoc(doc(db, 'admissions', exactId), updates);
  updateCachedItem('admissions', exactId, updates);
  return true;
}

// ─── Status Smart Action Dropdown Component ───
function StatusActionDropdown({ student, onViewEdit, onRefresh, onDeleteRecord, onTriggerDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, openUp: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogConfig, setDialogConfig] = useState(null);
  const [promptInput, setPromptInput] = useState('');
  const dropdownRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event) {
      // Portal-based dropdown: check both the portal element and the trigger button
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
      const inButton = btnRef.current && btnRef.current.contains(event.target);
      if (!inDropdown && !inButton) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const roll = String(student?.classRollNo || student?.['Class Roll No'] || student?.['Class Roll No.'] || student?.['RL. NO.'] || student?.['RL. NO'] || student?.['Class R.No.'] || student?.['Class R.No'] || student?.rollNo || student?.['Roll No.'] || student?.['Roll No'] || student?.roll || '').trim();
  const hasRoll = roll && roll !== '—' && roll !== 'N/A' && roll !== 'null' && roll !== 'undefined';
  const val = student?.status || student?.Status || 'Submitted';
  const isApp = hasRoll;
  const isDft = !hasRoll && (val === 'Draft' || val === 'DRAFT' || val === 'dft');
  const isProv = !hasRoll && (val === 'Provisional' || val === 'PROV');
  const isRejt = !hasRoll && (val === 'Rejected' || val === 'REJT');
  const isWithdrawn = !hasRoll && (val === 'Withdrawn' || val === 'WITHDRAWN' || val === 'withdrawn' || val === 'Adm Withdrawn' || val === 'ADM WITHDRAWN');
  const isSub = !hasRoll && !isDft && !isProv && !isRejt && !isWithdrawn;

  const bg = isApp ? 'bg-green-600 hover:bg-green-700' : isSub ? 'bg-blue-600 hover:bg-blue-700' : isProv ? 'bg-indigo-600 hover:bg-indigo-700' : isDft ? 'bg-yellow-500 hover:bg-yellow-600 !text-slate-900' : isWithdrawn ? 'bg-rose-600 hover:bg-rose-700 font-extrabold' : 'bg-red-600 hover:bg-red-700';
  const abbr = isApp ? 'APPR' : isSub ? 'SUBM' : isProv ? 'PROV' : isDft ? 'DRAFT' : isWithdrawn ? 'WTHD' : 'REJT';

  const handleAssignFormNo = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setDialogConfig({
      type: 'confirm',
      title: 'Assign Form Number',
      message: `Assign next available sequential form number to ${student?.studentName || 'student'}?`,
      icon: Hash,
      iconColor: 'text-teal-600 dark:text-teal-400',
      btnColor: 'bg-teal-700 hover:bg-teal-600 text-white',
      confirmText: 'Assign Form No',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const nextNo = await getNextAvailableFormNumber();
          if (nextNo) {
            await consumeFormNumber(nextNo);
            await updateStudentDocument(student, {
              'Form Number': nextNo,
              'FormNo': nextNo,
              formNo: nextNo
            });
            if (onRefresh) onRefresh();
            setDialogConfig({
              type: 'alert',
              title: 'Form Number Assigned',
              message: `Form #${nextNo} successfully assigned to ${student?.studentName}.`,
              icon: CheckCircle2,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              btnColor: 'bg-emerald-700 hover:bg-emerald-600 text-white'
            });
          }
        } catch (err) {
          console.error('Assign form no error:', err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handlePurgeSensitiveData = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setDialogConfig({
      type: 'confirm',
      title: 'Approve Erasure & Wipe Sensitive Data',
      message: `Approve online erasure for ${student?.studentName || 'student'} (Form #${student?.formNo || '—'})?\n\nThis will completely wipe out sensitive details (photograph, bank info, Aadhaar) from cloud database, recycle Form #${student?.formNo || '—'}, and retain minimal reference metadata for audit logs.`,
      icon: ShieldAlert,
      iconColor: 'text-rose-600 dark:text-rose-400',
      btnColor: 'bg-rose-700 hover:bg-rose-600 text-white',
      confirmText: 'Wipe Sensitive Data',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          const formNo = student?.formNo || student?.['Form Number'] || student?.['FormNo'];
          const rawId = student?.docId || student?._docId || student?.id || formNo;

          // 1. Save 90-day recovery archive in recycleBin
          await moveToRecycleBin(student, 'admissions', 'Admin').catch(() => {});

          // 2. Recycle Form Number in Firebase
          if (formNo && formNo !== '—') {
            await recycleDeletedFormNumber(formNo, student, 'Admin').catch(() => {});
          }

          // 3. Keep sanitized minimal identity record in admissions collection
          if (rawId) {
            await setDoc(doc(db, 'admissions', rawId), {
              "Student's Name (as per school records)": student?.studentName || student?.name || 'Student',
              "Father's/Guardian's Name (as per school records)": student?.fatherName || 'N/A',
              "Admission sought for class": student?.class || '11th',
              "Form Number": formNo || 'N/A',
              "Session": student?.session || '',
              "Status": "Purged",
              "_purged": true,
              "purgedAt": new Date().toISOString(),
              "purgedBy": "Admin"
            }, { merge: false }).catch(() => {});
          }

          if (onRefresh) onRefresh();

          setDialogConfig({
            type: 'alert',
            title: 'Sensitive Data Wiped',
            message: `Sensitive data for ${student?.studentName} has been wiped. Form #${formNo || '—'} is now recycled for the next applicant.`,
            icon: CheckCircle2,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            btnColor: 'bg-emerald-700 hover:bg-emerald-600 text-white'
          });
        } catch (err) {
          console.error('Purge error:', err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleUnlock = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setPromptInput('24');
    setDialogConfig({
      type: 'prompt',
      title: 'Unlock Application for Edit',
      message: `Enter unlock duration in hours for ${student?.studentName || 'student'}:`,
      placeholder: 'Hours (e.g. 24)',
      icon: Unlock,
      iconColor: 'text-amber-600 dark:text-amber-400',
      btnColor: 'bg-amber-700 hover:bg-amber-600 text-white',
      confirmText: 'Unlock Application',
      onConfirm: async (inputVal) => {
        const hrs = parseInt(inputVal, 10);
        if (isNaN(hrs) || hrs <= 0) return;
        try {
          setActionLoading(true);
          const formNo = student?.formNo || student?.['Form Number'] || student?.id;
          await appsScriptApi.call('unlockApplication', { formNo, hours: hrs }).catch(() => {});
          await updateStudentDocument(student, { editUnlocked: true, editUnlockedUntil: Date.now() + hrs * 3600000 });
          if (onRefresh) onRefresh();
          setDialogConfig({
            type: 'alert',
            title: 'Application Unlocked',
            message: `Application Form #${formNo} has been unlocked for editing for ${hrs} hours!`,
            icon: CheckCircle2,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            btnColor: 'bg-emerald-700 hover:bg-emerald-600 text-white'
          });
        } catch (err) {
          console.warn(err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handlePdfView = async (e) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      setActionLoading(true);
      await generateStudentAdmissionPdf(student);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePdfDownload = async (e) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      setActionLoading(true);
      await downloadStudentAdmissionPdf(student);
    } catch (err) {
      console.error('PDF error:', err);
      setDialogConfig({
        type: 'alert',
        title: 'PDF Download Error',
        message: 'Could not download PDF file on device.',
        icon: AlertOctagon,
        iconColor: 'text-rose-600 dark:text-rose-400',
        btnColor: 'bg-rose-700 hover:bg-rose-600 text-white'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewHistory = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setDialogConfig({
      type: 'alert',
      title: `Activity History: ${student?.studentName || 'Student'}`,
      message: `Form #${student?.formNo || student?.id}\n• Current Status: ${student?.status || 'Submitted'}\n• Online Submission Date: ${student?.onlineSubmDate || '—'}\n• Admission Date: ${student?.admDate || '—'}`,
      icon: History,
      iconColor: 'text-purple-600 dark:text-purple-400',
      btnColor: 'bg-purple-700 hover:bg-purple-600 text-white'
    });
  };

  const handleSendPassword = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    const mob = student?.mobile || student?.["Student's Contact"] || 'N/A';
    setDialogConfig({
      type: 'alert',
      title: 'Credentials Sent',
      message: `Credentials notification successfully sent to student mobile: ${mob}`,
      icon: Key,
      iconColor: 'text-blue-600 dark:text-blue-400',
      btnColor: 'bg-blue-700 hover:bg-blue-600 text-white'
    });
  };

  const handleSendWhatsApp = async (e) => {
    e.stopPropagation();
    setIsOpen(false);
    const rawMob = String(student?.mobile || student?.["Student's Contact"] || '').replace(/\D/g, '');
    if (!rawMob || rawMob.length < 10) {
      setDialogConfig({
        type: 'alert',
        title: 'Missing Mobile Number',
        message: 'No valid WhatsApp mobile number found for this student record.',
        icon: AlertOctagon,
        iconColor: 'text-amber-600 dark:text-amber-400',
        btnColor: 'bg-amber-700 hover:bg-amber-600 text-white'
      });
      return;
    }
    const cleanMob = rawMob.length === 10 ? `91${rawMob}` : rawMob;

    // 1. Trigger clean local PDF generation & download
    try {
      await downloadStudentAdmissionPdf(student);
    } catch (pdfErr) {
      console.error('WhatsApp PDF download error:', pdfErr);
    }

    const msgText = `Hello ${student?.studentName || 'Student'}, regarding your Admission Application (Form #${student?.formNo || ''}) at Govt. HSS Shangus:\n\n📌 Application Status: ${student?.status || 'Submitted'}\n📄 Form PDF: Downloaded to your device.\n\nThank you,\nGovt. HSS Shangus Administration`;
    const text = encodeURIComponent(msgText);

    // 2. Direct launch: Attempt opening installed WhatsApp application directly first
    const appUrl = `whatsapp://send?phone=${cleanMob}&text=${text}`;
    const webUrl = `https://api.whatsapp.com/send?phone=${cleanMob}&text=${text}`;

    const start = Date.now();
    // Try opening deep-link protocol for installed desktop/mobile app
    window.location.href = appUrl;

    setTimeout(() => {
      // If app protocol was not handled within 1200ms, open in WhatsApp Web browser tab
      if (Date.now() - start < 2000) {
        window.open(webUrl, '_blank');
      }
    }, 1000);
  };

  const handleAssignRollNo = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    const currRoll = (student?.classRollNo && student?.classRollNo !== 'N/A' && student?.classRollNo !== '—') ? student?.classRollNo : (student?.['Class Roll No'] || student?.['Class Roll No.'] || student?.['RL. NO.'] || student?.['RL. NO'] || student?.rollNo || '');
    setPromptInput(currRoll);
    setDialogConfig({
      type: 'prompt',
      title: 'Assign Class Roll Number',
      message: `Assign or update class roll number for ${student?.studentName}:`,
      placeholder: 'Enter Class Roll No (e.g. 15)...',
      icon: Hash,
      iconColor: 'text-teal-600 dark:text-teal-400',
      btnColor: 'bg-teal-700 hover:bg-teal-600 text-white',
      confirmText: 'Save Roll No',
      onConfirm: async (inputVal) => {
        const newRoll = (inputVal || '').trim();
        try {
          setActionLoading(true);
          await updateStudentDocument(student, {
            'Class Roll No': newRoll,
            'Class R.No.': newRoll,
            classRollNo: newRoll
          });
          if (onRefresh) onRefresh();
          setDialogConfig({
            type: 'alert',
            title: 'Roll Number Saved',
            message: `Class Roll No updated to "${newRoll || 'Unassigned'}" for ${student?.studentName}.`,
            icon: CheckCircle2,
            iconColor: 'text-teal-600 dark:text-teal-400',
            btnColor: 'bg-teal-700 hover:bg-teal-600 text-white'
          });
        } catch (err) {
          console.warn(err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleReject = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setPromptInput('Documents incomplete / verification pending');
    setDialogConfig({
      type: 'prompt',
      title: 'Reject Application',
      message: `Enter rejection reason for ${student?.studentName}:`,
      placeholder: 'Reason for rejection...',
      icon: AlertOctagon,
      iconColor: 'text-rose-600 dark:text-rose-400',
      btnColor: 'bg-rose-700 hover:bg-rose-600 text-white',
      confirmText: 'Confirm Rejection',
      onConfirm: async (inputVal) => {
        const reason = (inputVal || '').trim();
        if (!reason) return;
        try {
          setActionLoading(true);
          await updateStudentDocument(student, {
            'Status': 'Rejected',
            'status': 'Rejected',
            'rejectionReason': reason
          });
          if (onRefresh) onRefresh();
          setDialogConfig({
            type: 'alert',
            title: 'Application Rejected',
            message: `Application for ${student?.studentName} marked as Rejected.`,
            icon: AlertOctagon,
            iconColor: 'text-rose-600 dark:text-rose-400',
            btnColor: 'bg-rose-700 hover:bg-rose-600 text-white'
          });
        } catch (err) {
          console.warn(err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onTriggerDelete) {
      onTriggerDelete(student);
      return;
    }
    setDialogConfig({
      type: 'confirm',
      title: 'Delete Student Record',
      message: `Are you sure you want to delete student record for ${student?.studentName || 'student'} (Form #${student?.formNo || '—'})?`,
      icon: Trash2,
      iconColor: 'text-red-600 dark:text-red-400',
      btnColor: 'bg-red-700 hover:bg-red-600 text-white',
      confirmText: 'Delete Record',
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          if (onDeleteRecord) onDeleteRecord(student);
          await deleteStudentDocument(student);
        } catch (_) {} finally { setIsSubmitting(false); }
      }
    });
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpen && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 320;
            setDropdownPos({
              top: openUp ? undefined : rect.bottom + 4,
              bottom: openUp ? (window.innerHeight - rect.top + 4) : undefined,
              left: Math.min(rect.left, window.innerWidth - 230),
              openUp,
            });
          }
          setIsOpen(!isOpen);
        }}
        title="Click to view & execute form actions"
        className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black text-white ${bg} tracking-tight uppercase cursor-pointer shadow-2xs transition-all hover:scale-105 active:scale-95`}
      >
        <span>{actionLoading ? '...' : abbr}</span>
        <ChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            ...(dropdownPos.openUp
              ? { bottom: dropdownPos.bottom + 'px' }
              : { top: dropdownPos.top + 'px' }),
            left: dropdownPos.left + 'px',
            zIndex: 99999,
          }}
          className="w-56 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 space-y-0.5 animate-fadeIn bg-white/98 dark:bg-slate-900/98 backdrop-blur-md text-slate-900 dark:text-slate-100 text-xs font-bold"
        >
          <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Form Controls</span>
            <span className="font-mono text-amber-600 dark:text-amber-400">#{student?.formNo || student?.sno}</span>
          </div>

          <div className="space-y-0.5 pt-1">
            {(!student?.formNo || student?.formNo === '—' || student?.formNo === 'N/A') && (
              <button
                type="button"
                onClick={handleAssignFormNo}
                className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-teal-500/15 dark:hover:bg-teal-500/25 border border-transparent hover:border-teal-500/30 text-teal-700 dark:text-teal-400 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
              >
                <Hash size={13} className="text-teal-600 dark:text-teal-400" />
                <span>Assign Form No</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                if (onViewEdit) onViewEdit(student);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-indigo-500/15 dark:hover:bg-indigo-500/25 border border-transparent hover:border-indigo-500/30 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
            >
              <Eye size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span>View / Edit Record</span>
            </button>

            {isWithdrawn && (
              <button
                type="button"
                onClick={handlePurgeSensitiveData}
                className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-rose-500/20 dark:hover:bg-rose-500/30 border border-transparent hover:border-rose-500/30 text-rose-700 dark:text-rose-300 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
              >
                <ShieldAlert size={13} className="text-rose-600 dark:text-rose-400" />
                <span>Approve Erasure &amp; Wipe Data</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleUnlock}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-transparent hover:border-amber-500/30 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
            >
              <Unlock size={13} className="text-amber-600 dark:text-amber-400" />
              <span>Unlock for Edit</span>
            </button>

            <button
              type="button"
              onClick={handleAssignRollNo}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-teal-500/15 dark:hover:bg-teal-500/25 border border-transparent hover:border-teal-500/30 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
            >
              <Hash size={13} className="text-teal-600 dark:text-teal-400" />
              <span>Assign Class Roll No</span>
            </button>

            <button
              type="button"
              onClick={handlePdfView}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-transparent hover:border-emerald-500/30 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
            >
              <Printer size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Print PDF</span>
            </button>

            <button
              type="button"
              onClick={handleViewHistory}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-purple-500/15 dark:hover:bg-purple-500/25 border border-transparent hover:border-purple-500/30 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
            >
              <History size={13} className="text-purple-600 dark:text-purple-400" />
              <span>View Activity History</span>
            </button>

            <button
              type="button"
              onClick={handleSendPassword}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-blue-500/15 dark:hover:bg-blue-500/25 border border-transparent hover:border-blue-500/30 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
            >
              <Key size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Send Password</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-transparent hover:border-emerald-500/30 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
            >
              <MessageSquare size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleReject}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-rose-500/15 dark:hover:bg-rose-500/25 border border-transparent hover:border-rose-500/30 text-rose-700 dark:text-rose-400 cursor-pointer font-extrabold transition-all hover:scale-[1.01]"
            >
              <AlertOctagon size={13} className="text-rose-600 dark:text-rose-400" />
              <span>Reject Application</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-red-500/20 dark:hover:bg-red-500/30 border border-transparent hover:border-red-500/30 text-red-600 dark:text-red-400 cursor-pointer font-extrabold transition-all hover:scale-[1.01] border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-1"
            >
              <Trash2 size={13} className="text-red-600 dark:text-red-400" />
              <span>Delete Record</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Sleek Custom Action Dialog Modal (Replaces browser window.prompt / alert) */}
      {dialogConfig && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl space-y-4">

            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-3">
              {dialogConfig.icon && (
                <div className={`p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 ${dialogConfig.iconColor || ''}`}>
                  <dialogConfig.icon size={20} />
                </div>
              )}
              <h3 className="font-black text-base text-slate-900 dark:text-white flex-1">
                {dialogConfig.title}
              </h3>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDialogConfig(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Message */}
            <div className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {dialogConfig.message}
            </div>

            {/* Prompt Text Input */}
            {dialogConfig.type === 'prompt' && (
              <div className="pt-1">
                <input
                  type="text"
                  autoFocus
                  disabled={isSubmitting}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={dialogConfig.placeholder || 'Enter value...'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (dialogConfig.onConfirm) dialogConfig.onConfirm(promptInput);
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {dialogConfig.type !== 'alert' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setDialogConfig(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  const cb = dialogConfig.onConfirm;
                  if (cb) {
                    await cb(promptInput);
                  } else {
                    setDialogConfig(null);
                  }
                }}
                className={`px-5 py-2 rounded-xl font-black text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${dialogConfig.btnColor || 'bg-amber-700 hover:bg-amber-600 text-white'}`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{dialogConfig.submittingText || 'Saving & Syncing...'}</span>
                  </>
                ) : (
                  <span>{dialogConfig.confirmText || 'OK'}</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

const formatPhotoDisplayUrl = (val, student = null) => {
  let str = (typeof val === 'string' ? val : '').trim();

  // If val is empty or placeholder, resolve from getStudentPhotoUrl
  if ((!str || str === '—' || str === 'N/A' || str === 'null' || str === 'undefined' || str === '/logo.png') && student) {
    str = getStudentPhotoUrl(student) || '';
  }

  if (!str || str === '—' || str === 'N/A' || str === 'null' || str === 'undefined' || str === '/logo.png') return '';

  // 1. Native Firestore / Data URL Base64 image
  if (str.startsWith('data:image/') || str.startsWith('data:application/octet-stream;base64')) {
    return str;
  }
  // Raw Base64 string without data: prefix
  if (/^[A-Za-z0-9+/=]{100,}$/.test(str)) {
    return `data:image/jpeg;base64,${str}`;
  }

  // 2. Google Drive Links -> Convert to direct high-res image stream URL
  if (str.includes('drive.google.com') || str.includes('docs.google.com') || str.includes('googleusercontent.com')) {
    const idMatch = str.match(/[-\w]{25,}/);
    if (idMatch && idMatch[0]) {
      return `https://lh3.googleusercontent.com/d/${idMatch[0]}=w500`;
    }
  }

  // 3. Firebase Storage or standard web image URLs
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
    return str;
  }

  return '';
};

function OnDemandStudentPhotoCell({ student, val }) {
  const studentKey = `${student?.id || ''}_${student?.docId || ''}_${student?.boardRegNo || student?.regNo || ''}_${val || ''}`;
  const [photoUrl, setPhotoUrl] = useState(() => {
    return formatPhotoDisplayUrl(val, student) || getStudentPhotoUrl(student) || '';
  });

  const [isHovered, setIsHovered] = useState(false);
  const [hoverPosition, setHoverPosition] = useState({ top: 0, left: 0 });
  const [matchingPhotos, setMatchingPhotos] = useState([]);
  const [isLoadingMatching, setIsLoadingMatching] = useState(false);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState(null);
  const [isSettingActive, setIsSettingActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const cellRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const current = formatPhotoDisplayUrl(val, student) || getStudentPhotoUrl(student);
    if (current && current !== '/logo.png' && current !== '—') {
      setPhotoUrl(current);
      return;
    }

    // Do NOT fetch or track photos for historical archives — only active admissions
    if (student?._isCurrentScope === false || student?.isHistorical || student?._isHistorical) {
      setPhotoUrl('');
      return;
    }

    // Lazy load photo on scroll into viewport via IntersectionObserver
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && cellRef.current) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && isMounted) {
            observer.disconnect();
            fetchStudentPhotoOnDemand(student).then((res) => {
              if (isMounted && res && res !== '/logo.png' && res !== '—') {
                setPhotoUrl(res);
              }
            }).catch(() => {});
          }
        });
      }, {
        rootMargin: '120px' // Preload 120px before scrolling into direct view
      });

      observer.observe(cellRef.current);
      return () => {
        isMounted = false;
        observer.disconnect();
      };
    } else {
      // Fallback if IntersectionObserver not supported
      fetchStudentPhotoOnDemand(student).then((res) => {
        if (isMounted && res && res !== '/logo.png' && res !== '—') {
          setPhotoUrl(res);
        }
      }).catch(() => {});
    }

    return () => { isMounted = false; };
  }, [studentKey]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(async () => {
      if (cellRef.current) {
        const rect = cellRef.current.getBoundingClientRect();
        // Smart popover position calculation
        const popoverWidth = 320;
        const popoverHeight = 350;
        let left = rect.left + (rect.width / 2) - (popoverWidth / 2);
        if (left < 10) left = 10;
        if (left + popoverWidth > window.innerWidth - 10) left = window.innerWidth - popoverWidth - 10;

        let top = rect.bottom + 8;
        if (top + popoverHeight > window.innerHeight - 10) {
          top = Math.max(10, rect.top - popoverHeight - 8);
        }

        setHoverPosition({ top, left });
      }
      setIsHovered(true);
      setSelectedPreviewUrl(photoUrl);

      // Load all matching photos for this regNo
      setIsLoadingMatching(true);
      try {
        const list = await fetchAllMatchingStudentPhotos(student);
        setMatchingPhotos(list);
      } catch (_) {}
      setIsLoadingMatching(false);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setSelectedPreviewUrl(null);
    }, 250);
  };

  const handleSetActivePhoto = async (targetUrl) => {
    if (!targetUrl || isSettingActive) return;
    setIsSettingActive(true);
    try {
      const reg = String(student?.boardRegNo || student?.regNo || '').trim();
      const payload = {
        photo_id: targetUrl,
        'Student Photo': deleteField(),
        photoUrl: deleteField(),
        photoId: deleteField(),
        photo: deleteField(),
        studentPhoto: deleteField(),
        studentPhotoUrl: deleteField(),
        passport_photo: deleteField(),
        photoData: deleteField()
      };

      await updateStudentDocument(student, payload);

      await syncStudentPhotoOnRegUpdate({
        newReg: reg,
        student: { ...student, photo_id: targetUrl },
        photoData: targetUrl
      });

      setPhotoUrl(targetUrl);
      setSelectedPreviewUrl(targetUrl);
      setMatchingPhotos(prev => prev.map(p => ({ ...p, isCurrent: p.url === targetUrl })));
    } catch (err) {
      console.error('Error setting active photo:', err);
    } finally {
      setIsSettingActive(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressed = await compressImageFile(file, 300, 360, 0.8);
      await handleSetActivePhoto(compressed);
    } catch (err) {
      console.error('Upload photo error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const displayPhoto = selectedPreviewUrl || photoUrl;
  const sName = student?.studentName || student?.["Student's Name (as per school records)"] || student?.["Student's Name"] || student?.name || 'Student';
  const regNo = student?.boardRegNo || student?.regNo || '—';
  const rollNo = student?.classRollNo || student?.rollNo || '—';
  const formNo = student?.formNo || student?.['Form Number'] || '—';
  const sClass = student?.class || student?.['Class'] || '11th';

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  return (
    <div 
      ref={cellRef}
      className="relative inline-block font-sans"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {photoUrl && photoUrl !== '—' && photoUrl !== '/logo.png' ? (
        <img
          src={photoUrl}
          alt={sName}
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
          className="w-8 h-10 mx-auto rounded-lg border border-teal-500/40 object-cover shadow-2xs hover:scale-110 hover:border-teal-500 hover:shadow-md transition-all cursor-pointer"
          title={`Hover to preview photo (${sName})`}
        />
      ) : (
        <div 
          className="w-8 h-10 mx-auto rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center cursor-pointer hover:border-teal-500 transition-colors"
          title={`Hover to upload/view photo for ${sName}`}
        >
          <Camera size={13} className="text-slate-400 dark:text-slate-500" />
        </div>
      )}

      {/* Minimal Interactive Photo Hover Popover */}
      {isHovered && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${hoverPosition.top}px`,
            left: `${hoverPosition.left}px`,
            zIndex: 99999
          }}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setIsHovered(true);
          }}
          onMouseLeave={handleMouseLeave}
          className="w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100 font-sans"
        >
          {/* Popover Header */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
              {sName}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              <span>Class {sClass}</span>
              <span>•</span>
              <span className="font-mono">F#{formNo}</span>
              {regNo && regNo !== '—' && (
                <>
                  <span>•</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">Reg: {regNo}</span>
                </>
              )}
            </div>
          </div>

          {/* Main Photo Preview */}
          <div className="relative w-full h-44 bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-2">
            {displayPhoto && displayPhoto !== '/logo.png' && displayPhoto !== '—' ? (
              <img
                src={formatPhotoDisplayUrl(displayPhoto) || displayPhoto}
                alt={sName}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                }}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                <Camera size={28} className="stroke-[1.5] mb-1 text-slate-400" />
                <span className="text-[11px] font-medium">No photo available</span>
              </div>
            )}

            {selectedPreviewUrl && selectedPreviewUrl !== photoUrl && (
              <div className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                <Sparkles size={10} /> Preview
              </div>
            )}
          </div>

          {/* Matching Photos Thumbnail Strip (only shown if there are multiple candidate photos) */}
          {matchingPhotos.length > 1 && (
            <div className="mb-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl p-1.5 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 px-0.5">
                <span>Available Photos ({matchingPhotos.length})</span>
                <span className="text-[9px] font-normal text-slate-400">Click to preview</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                {matchingPhotos.map((item, idx) => {
                  const formattedItemUrl = formatPhotoDisplayUrl(item.url) || item.url;
                  const isSelected = (selectedPreviewUrl || photoUrl) === item.url || (selectedPreviewUrl || photoUrl) === formattedItemUrl;
                  return (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => setSelectedPreviewUrl(formattedItemUrl)}
                      className={`relative shrink-0 w-10 h-12 rounded-lg overflow-hidden border-2 transition-all p-0.5 bg-white dark:bg-slate-900 ${
                        isSelected 
                          ? 'border-blue-500 ring-2 ring-blue-500/20' 
                          : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                      title={item.title}
                    >
                      <img 
                        src={formattedItemUrl} 
                        alt="" 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.opacity = '0.3';
                        }}
                        className="w-full h-full object-cover rounded" 
                      />
                      {item.isCurrent && (
                        <div className="absolute bottom-0 inset-x-0 bg-teal-600 text-white text-[7px] font-bold text-center">
                          ACTIVE
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {selectedPreviewUrl && selectedPreviewUrl !== photoUrl && (
              <button
                type="button"
                disabled={isSettingActive}
                onClick={() => handleSetActivePhoto(selectedPreviewUrl)}
                className="flex-1 py-1.5 px-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSettingActive ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Set as Active
              </button>
            )}

            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>

            {displayPhoto && displayPhoto !== '/logo.png' && (
              <a
                href={displayPhoto}
                download={`${regNo || formNo || 'student'}_photo.jpg`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700 transition-colors"
                title="Download photo"
              >
                <Download size={13} />
              </a>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Minimal Full History Modal Link */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsHovered(false);
              setIsHistoryModalOpen(true);
            }}
            className="w-full mt-1.5 py-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center justify-center gap-1 cursor-pointer"
          >
            <History size={11} />
            <span>View Full Photo History ({matchingPhotos.length || 1})</span>
          </button>
        </div>,
        document.body
      )}

      {/* Minimal Photo History Modal */}
      {isHistoryModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-100 font-sans"
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div 
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {sName} — Photo History
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-medium">
                  <span>Class {sClass}</span>
                  <span>•</span>
                  <span className="font-mono">F#{formNo}</span>
                  <span>•</span>
                  <span className="font-mono">R#{rollNo}</span>
                  {regNo && regNo !== '—' && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">Reg: {regNo}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Minimal Sub-toolbar */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                {matchingPhotos.length} photo{matchingPhotos.length !== 1 ? 's' : ''} in archive
              </span>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                Upload New
              </button>
            </div>

            {/* Photo Cards Grid */}
            <div className="p-4 overflow-y-auto max-h-[55vh] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {matchingPhotos.map((item, idx) => {
                const isActive = item.isCurrent || (photoUrl && photoUrl === item.url);
                return (
                  <div
                    key={item.id || idx}
                    className={`rounded-xl border overflow-hidden bg-white dark:bg-slate-900 transition-all flex flex-col ${
                      isActive 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm' 
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Card Image */}
                    <div className="relative h-44 bg-slate-950 flex items-center justify-center p-1.5">
                      <img
                        src={item.url}
                        alt=""
                        className="w-full h-full object-contain rounded"
                      />
                      {isActive && (
                        <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                          <Star size={9} className="fill-white" /> Active
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="p-2.5 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                      <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200 truncate">
                        {item.title || `Photo #${idx + 1}`}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {!isActive ? (
                          <button
                            type="button"
                            disabled={isSettingActive}
                            onClick={() => handleSetActivePhoto(item.url)}
                            className="py-1 px-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] cursor-pointer transition-colors disabled:opacity-50"
                          >
                            {isSettingActive ? <Loader2 size={10} className="animate-spin" /> : 'Set Active'}
                          </button>
                        ) : null}

                        <a
                          href={item.url}
                          download={`${sName}_photo.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                          title="Download"
                        >
                          <Download size={13} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Minimal Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>All photos permanently preserved & synced</span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function SubjectStreamCell({ val, student }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState(null);
  const btnRef = useRef(null);
  const abbr = abbreviateSubjects(val);

  // Close popup on outside click or escape key
  useEffect(() => {
    if (!isExpanded) return;
    const handleOutsideClick = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setIsExpanded(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  const togglePopover = (e) => {
    e.stopPropagation();
    if (isExpanded) {
      setIsExpanded(false);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const popoverWidth = 290;
      let left = rect.right - popoverWidth;
      if (left < 12) left = 12;
      if (left + popoverWidth > window.innerWidth - 12) left = window.innerWidth - popoverWidth - 12;

      let top = rect.bottom + 6;
      if (top + 220 > window.innerHeight) {
        top = Math.max(12, rect.top - 220);
      }

      setPopoverCoords({ top, left });
      setIsExpanded(true);
    }
  };

  const getStreamDetails = (st, rawSubs) => {
    const cls = String(st?.class || st?.Class || st?.['Admission sought for class'] || '').trim().toLowerCase();
    if (cls.includes('9') || cls.includes('10')) {
      return { code: 'G', label: 'General', style: 'bg-teal-600 text-white border-teal-700' };
    }

    const rawStream = String(
      st?.stream ||
      st?.Stream ||
      st?.['Stream for Class 11th'] ||
      st?.['Stream opted in Class 11th'] ||
      st?.['Stream & Subjects for Class 12th'] ||
      ''
    ).toLowerCase();

    const abbrSubjs = abbreviateSubjects(rawSubs);
    const allSubjStr = `${rawSubs || ''} ${st?.subs || ''} ${st?.Subjects || ''} ${abbrSubjs || ''}`;
    const codes = getCanonicalSubjectCodes(allSubjStr);

    const hasScienceSubjects =
      (codes.has('PH') && codes.has('CH')) ||
      (codes.has('PH') && codes.has('BI')) ||
      (codes.has('CH') && codes.has('BI')) ||
      (codes.has('PH') && codes.has('MA')) ||
      codes.has('BO') || codes.has('ZO') || codes.has('BT');

    const hasScienceStream = rawStream.includes('sci') || rawStream.includes('med');

    const hasCommerce =
      rawStream.includes('commerce') ||
      codes.has('AC') ||
      codes.has('BS') ||
      codes.has('EP');

    const hasHumanitiesSubjects =
      codes.has('HT') ||
      codes.has('PS') ||
      codes.has('ED') ||
      codes.has('EC') ||
      codes.has('SO') ||
      codes.has('UR') ||
      codes.has('AR') ||
      codes.has('KA') ||
      codes.has('HI') ||
      codes.has('IS') ||
      codes.has('GG') ||
      codes.has('PL') ||
      codes.has('PY');

    const hasHumanitiesStream = rawStream.includes('hum') || rawStream.includes('art');

    if (hasScienceSubjects || (hasScienceStream && !hasHumanitiesSubjects)) {
      return { code: 'S', label: 'Science', style: 'bg-blue-600 dark:bg-blue-600 text-white border-blue-700' };
    }

    if (hasCommerce) {
      return { code: 'C', label: 'Commerce', style: 'bg-amber-600 text-white border-amber-700' };
    }

    if (hasHumanitiesSubjects || hasHumanitiesStream) {
      return { code: 'H', label: 'Humanities', style: 'bg-purple-700 text-white border-purple-800' };
    }

    if (cls.includes('11') || cls.includes('12')) {
      return { code: 'H', label: 'Humanities', style: 'bg-purple-700 text-white border-purple-800' };
    }

    return { code: 'G', label: 'General', style: 'bg-teal-600 text-white border-teal-700' };
  };

  const streamInfo = getStreamDetails(student, val);
  const hasMismatch = Boolean(student?.hasStreamMismatch || student?.hasSubsMismatch || student?.hasMismatch);

  return (
    <div className="flex flex-col leading-tight relative pr-4">
      {/* Warning icon pinned at TOP-RIGHT of cell */}
      {hasMismatch && (
        <button
          ref={btnRef}
          type="button"
          onClick={togglePopover}
          className="absolute top-0 right-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-100 dark:bg-amber-950/90 border border-amber-400 dark:border-amber-600 text-[9px] text-amber-800 dark:text-amber-300 font-black hover:scale-125 transition-transform cursor-pointer shadow-xs z-10"
          title="⚠️ 11th vs 12th Discrepancy — Click to view details"
        >
          ⚠️
        </button>
      )}

      {/* Subject abbreviations + Stream badge INLINE */}
      <span
        title={`Stream: ${streamInfo.label} | Full Subjects: ${val || '—'}`}
        className="font-black text-[11px] text-slate-800 dark:text-slate-200 tracking-tight leading-snug cursor-help"
      >
        {abbr}
        {streamInfo.code && (
          <span className={`inline-block ml-1 px-1 py-0.2 rounded text-[9px] font-black border shadow-2xs whitespace-nowrap align-middle ${streamInfo.style}`}>
            ({streamInfo.code})
          </span>
        )}
      </span>

      {/* Expandable Mismatch Details Portal (Fixed to Body - Never Clipped) */}
      {hasMismatch && isExpanded && popoverCoords && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${popoverCoords.top}px`,
            left: `${popoverCoords.left}px`,
            zIndex: 999999
          }}
          onClick={(e) => e.stopPropagation()}
          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-amber-500 shadow-2xl text-[10px] leading-snug w-[290px] max-w-[95vw] animate-fadeIn text-slate-800 dark:text-slate-100"
        >
          <div className="flex items-center justify-between font-black text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-slate-800 pb-1.5 mb-2">
            <span className="flex items-center gap-1">
              <span>⚠️</span>
              <span>11th vs 12th Discrepancy</span>
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-black cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="font-extrabold text-emerald-800 dark:text-emerald-300 block text-[9.5px] uppercase tracking-wider">
                11th Record (Authentic / Prev Session):
              </span>
              <div className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                Stream: <span className="text-emerald-700 dark:text-emerald-300 font-black">{student.stream11th || student.stream || 'N/A'}</span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 text-[9px] mt-0.5 font-mono">
                Subjs: {student.subs11th || student.subs || '—'}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
              <span className="font-extrabold text-amber-800 dark:text-amber-300 block text-[9.5px] uppercase tracking-wider">
                12th Form (Opted / Form Entry):
              </span>
              <div className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                Stream: <span className="text-amber-700 dark:text-amber-300 font-black">{student.optedStream12th || student.stream || 'N/A'}</span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 text-[9px] mt-0.5 font-mono">
                Subjs: {student.optedSubs12th || student.subs || '—'}
              </div>
            </div>

            {student.subsMismatchNotice && (
              <div className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-950/60 p-1.5 rounded-lg border border-amber-300/60">
                {student.subsMismatchNotice}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const COLUMN_DEFS = [
  { key: 'sno', label: 'S.No.', isSticky: true, className: 'font-mono font-black text-amber-700 dark:text-amber-400 border-r border-slate-200 dark:border-slate-800/50' },
  {
    key: 'formNo', label: 'F.No.', className: 'font-mono font-bold', render: (val, student) => {
      const raw = String(val || student?.['Form Number'] || student?.FormNo || student?.['Form No.'] || '').trim();
      if (!raw || raw === '—' || raw === 'N/A' || raw.length > 10 || raw.startsWith('doc_') || raw.startsWith('FORM_')) {
        return <span className="font-mono text-slate-400 dark:text-slate-600">—</span>;
      }
      return raw;
    }
  },
  {
    key: 'status', label: 'Status', className: 'text-center', render: (val, student) => {
      return (
        <StatusActionDropdown
          student={student}
          onViewEdit={(s) => {
            if (student && typeof student._setSelectedApp === 'function') {
              student._setSelectedApp(s);
            }
          }}
          onRefresh={student?._onRefresh}
          onDeleteRecord={student?._onDeleteRecord}
          onTriggerDelete={student?._onTriggerDelete}
        />
      );
    }
  },
  { key: 'classRollNo', label: 'R.NO.', className: 'font-mono font-black text-teal-700 dark:text-teal-400' },
  {
    key: 'admNo', label: 'Adm. No.', className: 'font-mono font-black', render: (val, student) => {
      const formatted = formatStudentAdmNo(student) || cleanAdmNoVal(val);
      if (!formatted) return <span className="font-mono text-slate-400 dark:text-slate-600">—</span>;

      const isRe =
        String(
          student?.['readmission'] ||
          student?.['Re-admission'] ||
          student?.['isReadmission'] ||
          student?.['Is Re-admission'] || ''
        ).toLowerCase() === 'yes' ||
        student?.['readmission'] === true ||
        student?.['isReadmission'] === true;

      const oldAdm = cleanAdmNoVal(
        student?.['Old Admission No.'] ||
        student?.['Old Adm. No.'] ||
        student?.['oldAdmNo'] ||
        student?.['old_adm_no'] || ''
      );

      if (isRe && oldAdm && oldAdm !== formatted) {
        return (
          <span className="font-mono font-black text-slate-900 dark:text-white" title={`Re-admission student. New Adm No: ${formatted}, Old Adm No: ${oldAdm}`}>
            <span className="text-amber-800 dark:text-amber-300 font-extrabold">{formatted}</span>
            <span className="ml-1 text-[10px] text-indigo-700 dark:indigo-400 font-black">({oldAdm})</span>
          </span>
        );
      }

      return <span className="font-mono font-black text-slate-900 dark:text-white">{formatted}</span>;
    }
  },
  { key: 'class', label: 'Class', className: 'font-black' },
  { key: 'session', label: 'Session', className: 'font-black text-purple-700 dark:text-purple-400' },
  { key: 'boardRegNo', label: 'Reg. No.', className: 'font-mono text-[11px] leading-tight text-slate-700 dark:text-slate-300 whitespace-normal break-all' },
  {
    key: 'photoId', label: 'Photo', className: 'text-center', render: (val, student) => {
      return <OnDemandStudentPhotoCell student={student} val={val} />;
    }
  },
  {
    key: 'studentName', label: "Student's Name", className: 'font-black text-slate-900 dark:text-white whitespace-normal break-words leading-tight', render: (val, student) => {
      const formatted = formatProperName(val);
      const gRaw = String(student?.gender || '').trim().toLowerCase();
      let gCode = '';
      let gColor = '';

      if (gRaw.startsWith('f')) {
        gCode = 'F';
        gColor = 'bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-800';
      } else if (gRaw.startsWith('m')) {
        gCode = 'M';
        gColor = 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      } else if (gRaw && gRaw !== '—') {
        gCode = 'O';
        gColor = 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      }

      const isDirect = Boolean(
        student?._isDirectIngested ||
        String(student?.remarks || '').toLowerCase().includes('direct ingestion') ||
        String(student?.lastEditedBy || '').toLowerCase().includes('direct')
      );

      const isGenderColumnSelected = student?._visibleCols?.gender;

      return (
        <span className="inline-flex items-center gap-1 flex-wrap">
          <span className="font-black text-slate-900 dark:text-white">{formatted}</span>
          {isGenderColumnSelected && gCode && (
            <span
              title={`Gender: ${student?.gender || gCode}`}
              className={`inline-block px-1 py-0.2 rounded text-[9px] font-black border shadow-2xs leading-none whitespace-nowrap ${gColor}`}
            >
              ({gCode})
            </span>
          )}
        </span>
      );
    }
  },
  {
    key: 'fatherName',
    label: 'Parentage',
    isComposite: true,
    className: 'text-slate-600 dark:text-slate-400 whitespace-normal break-words leading-tight',
    render: (fatherName, student) => {
      const father = formatProperName(fatherName || '—');
      const mother = formatProperName(student?.motherName || '—');
      const stId = student?.id || student?.sno || 'st';
      const copyValue = (event, id, value) => {
        event.stopPropagation();
        if (!value || value === '—') return;
        if (student?._handleCopyCell) student._handleCopyCell(id, value);
        else navigator.clipboard?.writeText(value);
      };

      return (
        <div className="group/parentage grid min-w-0 gap-1 py-0.5 leading-tight">
          <div className="flex min-w-0 items-center justify-between gap-1" title="Father's name">
            <span className="min-w-0 break-words font-extrabold text-slate-700 dark:text-slate-200">{father}</span>
            {father !== '—' && <button
              type="button"
              onClick={(event) => copyValue(event, `${stId}_father`, father)}
              className="flex-shrink-0 rounded p-0.5 text-teal-700 opacity-0 transition-opacity hover:bg-teal-100 focus:opacity-100 group-hover/parentage:opacity-100 dark:text-teal-300 dark:hover:bg-teal-950/60"
              title="Copy father's name"
              aria-label="Copy father's name"
            >
              {student?._copiedCellId === `${stId}_father` ? <Check size={11} /> : <Copy size={11} />}
            </button>}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-1 border-t border-slate-200/70 pt-1 dark:border-slate-700/70" title="Mother's name">
            <span className="min-w-0 break-words font-extrabold text-slate-700 dark:text-slate-200">{mother}</span>
            {mother !== '—' && <button
              type="button"
              onClick={(event) => copyValue(event, `${stId}_mother`, mother)}
              className="flex-shrink-0 rounded p-0.5 text-teal-700 opacity-0 transition-opacity hover:bg-teal-100 focus:opacity-100 group-hover/parentage:opacity-100 dark:text-teal-300 dark:hover:bg-teal-950/60"
              title="Copy mother's name"
              aria-label="Copy mother's name"
            >
              {student?._copiedCellId === `${stId}_mother` ? <Check size={11} /> : <Copy size={11} />}
            </button>}
          </div>
        </div>
      );
    }
  },
  { key: 'dob', label: 'DoB', className: 'text-slate-600 dark:text-slate-400 whitespace-nowrap' },
  { key: 'village', label: 'Village/Town', className: 'whitespace-normal break-words leading-tight text-slate-700 dark:text-slate-300', render: (val) => formatProperName(val) },
  { key: 'gender', label: 'Gender', className: 'font-black whitespace-nowrap' },
  { key: 'category', label: 'Category', className: 'font-extrabold text-amber-800 dark:text-amber-300 whitespace-nowrap' },
  {
    key: 'subs', label: 'SUBS (STREAM)', className: 'whitespace-normal break-words leading-tight', render: (val, student) => (
      <SubjectStreamCell val={val} student={student} />
    )
  },
  {
    key: 'mobile',
    label: 'Mobile (S/P)',
    className: 'font-mono text-slate-900 dark:text-slate-100 font-extrabold',
    render: (val, student) => {
      const sMob = student?.mobile && student?.mobile !== '—' && student?.mobile !== '-' ? String(student.mobile).trim() : '';
      const pMob = student?.parentContact && student?.parentContact !== '—' && student?.parentContact !== '-' ? String(student.parentContact).trim() : '';
      const stId = student?.id || student?.sno || 'st';

      if (!sMob && !pMob) return <span className="text-slate-400 dark:text-slate-600 font-normal">—</span>;

      if (sMob && pMob && sMob === pMob) {
        const isCopied = student?._copiedCellId === `${stId}_sp`;
        return (
          <div className="flex items-center justify-between gap-1 group/sp">
            <span className="font-mono text-xs sm:text-[13px] font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap tracking-wide" title="Student and parent share this mobile number">
              {sMob}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (student?._handleCopyCell) {
                  student._handleCopyCell(`${stId}_sp`, sMob);
                } else {
                  navigator.clipboard.writeText(sMob);
                }
              }}
              className="opacity-0 group-hover/sp:opacity-100 group-hover/cell:opacity-100 p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 cursor-pointer transition-opacity flex-shrink-0 hover:scale-110"
              title={`Copy Mobile: ${sMob}`}
            >
              {isCopied ? (
                <span className="text-[9px] font-black text-emerald-600">Copied!</span>
              ) : (
                <Copy size={11} />
              )}
            </button>
          </div>
        );
      }

      const isSCopied = student?._copiedCellId === `${stId}_smob`;
      const isPCopied = student?._copiedCellId === `${stId}_pmob`;

      return (
        <div className="flex flex-col text-xs sm:text-[13px] leading-tight py-0.5 font-mono tracking-wide gap-0.5">
          {sMob ? (
            <div className="flex items-center justify-between gap-1 group/smob" title="Student mobile number">
              <span className="text-slate-900 dark:text-slate-100 font-black whitespace-nowrap">
                {sMob}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (student?._handleCopyCell) {
                    student._handleCopyCell(`${stId}_smob`, sMob);
                  } else {
                    navigator.clipboard.writeText(sMob);
                  }
                }}
                className="opacity-0 group-hover/smob:opacity-100 group-hover/cell:opacity-100 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 cursor-pointer transition-opacity flex-shrink-0 hover:scale-110"
                title={`Copy Student Mobile: ${sMob}`}
              >
                {isSCopied ? (
                  <span className="text-[9px] font-black text-emerald-600">Copied!</span>
                ) : (
                  <Copy size={11} />
                )}
              </button>
            </div>
          ) : null}
          {pMob ? (
            <div className={`flex items-center justify-between gap-1 group/pmob ${sMob ? 'border-t border-slate-200/70 pt-1 dark:border-slate-700/70' : ''}`} title="Parent mobile number">
              <span className="text-amber-900 dark:text-amber-300 font-black whitespace-nowrap">
                {pMob}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (student?._handleCopyCell) {
                    student._handleCopyCell(`${stId}_pmob`, pMob);
                  } else {
                    navigator.clipboard.writeText(pMob);
                  }
                }}
                className="opacity-0 group-hover/pmob:opacity-100 group-hover/cell:opacity-100 p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-700 dark:text-amber-300 cursor-pointer transition-opacity flex-shrink-0 hover:scale-110"
                title={`Copy Parent Mobile: ${pMob}`}
              >
                {isPCopied ? (
                  <span className="text-[9px] font-black text-emerald-600">Copied!</span>
                ) : (
                  <Copy size={11} />
                )}
              </button>
            </div>
          ) : null}
        </div>
      );
    }
  },
  {
    key: 'aadhar',
    label: 'Aadhaar / PEN',
    isComposite: true,
    className: 'font-mono whitespace-normal break-all',
    render: (aadhar, student) => {
      const aadhaarValue = aadhar || '—';
      const penValue = student?.penNo || '—';
      const stId = student?.id || student?.sno || 'st';
      const copyValue = (event, id, value) => {
        event.stopPropagation();
        if (!value || value === '—') return;
        if (student?._handleCopyCell) student._handleCopyCell(id, value);
        else navigator.clipboard?.writeText(value);
      };

      return (
        <div className="group/identifiers grid min-w-0 gap-1 py-0.5 leading-tight">
          <div className="flex min-w-0 items-center justify-between gap-1" title="Aadhaar number">
            <span className="min-w-0 break-all font-bold text-slate-700 dark:text-slate-200">{aadhaarValue}</span>
            {aadhaarValue !== '—' && <button
              type="button"
              onClick={(event) => copyValue(event, `${stId}_aadhaar`, aadhaarValue)}
              className="flex-shrink-0 rounded p-0.5 text-teal-700 opacity-0 transition-opacity hover:bg-teal-100 focus:opacity-100 group-hover/identifiers:opacity-100 dark:text-teal-300 dark:hover:bg-teal-950/60"
              title="Copy Aadhaar number"
              aria-label="Copy Aadhaar number"
            >
              {student?._copiedCellId === `${stId}_aadhaar` ? <Check size={11} /> : <Copy size={11} />}
            </button>}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-1 border-t border-slate-200/70 pt-1 dark:border-slate-700/70" title="PEN number">
            <span className="min-w-0 break-all font-bold text-slate-700 dark:text-slate-200">{penValue}</span>
            {penValue !== '—' && <button
              type="button"
              onClick={(event) => copyValue(event, `${stId}_pen`, penValue)}
              className="flex-shrink-0 rounded p-0.5 text-teal-700 opacity-0 transition-opacity hover:bg-teal-100 focus:opacity-100 group-hover/identifiers:opacity-100 dark:text-teal-300 dark:hover:bg-teal-950/60"
              title="Copy PEN number"
              aria-label="Copy PEN number"
            >
              {student?._copiedCellId === `${stId}_pen` ? <Check size={11} /> : <Copy size={11} />}
            </button>}
          </div>
        </div>
      );
    }
  },
  {
    key: 'fatherAadhar',
    label: "Father's Aadhaar",
    className: 'font-mono whitespace-normal break-all'
  },
  { key: 'bankAccount', label: 'Bank Account Number', className: 'font-mono whitespace-normal break-all' },
  { key: 'bankName', label: 'Bank Name' },
  {
    key: 'onlineSubmDate',
    label: 'Online Subm. Date',
    className: 'font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs',
    render: (val, student) => {
      const formatted = formatOnlineSubmDate(val || student?.submittedAt || student?.createdAt || student?.updatedAt);
      if (!formatted || formatted === '—') return <span className="text-slate-400 dark:text-slate-600 font-normal">—</span>;
      return <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{formatted}</span>;
    }
  },
  { key: 'admDate', label: 'Adm. Date' },
  { key: 'boardName', label: 'Board Name' },
  {
    key: 'dobWords',
    label: 'DoB (words)',
    render: (val, student) => {
      if (val && val !== '—' && String(val).trim().length > 3) return val;
      const computed = convertDobToWords(student?.dob);
      return computed || val || '—';
    }
  },
  { key: 'block', label: 'Block' },
  { key: 'tehsil', label: 'Tehsil' },
  { key: 'district', label: 'District' },
  { key: 'pinCode', label: 'PIN code', className: 'font-mono' },
  { key: 'state', label: 'State/UT' },
  { key: 'residence', label: 'Residence (Village, District)' },
  { key: 'religion', label: 'Religion' },
  { key: 'disabilityStatus', label: 'Disability Status' },
  { key: 'disabilityType', label: 'Disability Type' },
  { key: 'subjects1', label: 'Subjects1' },
  { key: 'subjects2', label: 'Subjects2' },
  { key: 'subjects3', label: 'Subjects3' },
  { key: 'subjects4', label: 'Subjects4' },
  { key: 'subjects5', label: 'Subjects5' },
  { key: 'subjects6', label: 'Subject6' },
  { key: 'email1', label: 'email1' },
  { key: 'email2', label: 'email2' },
  {
    key: 'parentContact',
    label: 'Mobile (P)',
    className: 'font-mono text-amber-800 dark:text-amber-300 font-extrabold',
    render: (val, student) => {
      const pMob = val && val !== '—' && val !== '-' ? String(val).trim() : (student?.parentContact && student?.parentContact !== '—' && student?.parentContact !== '-' ? String(student.parentContact).trim() : '');
      if (!pMob) return <span className="text-slate-400 dark:text-slate-600 font-normal">—</span>;
      return <span className="font-mono text-xs sm:text-[13px] font-black text-amber-800 dark:text-amber-300 tracking-wide">{pMob}</span>;
    }
  },
  { key: 'bloodType', label: 'Blood Type' },
  { key: 'height', label: 'Height (cm)' },
  { key: 'weight', label: 'Weight (kg)' },
  { key: 'socialCategory', label: 'Social category' },
  { key: 'socioEconomicCategory', label: 'Socio-economic category' },
  { key: 'houseNo', label: 'House No.' },
  { key: 'vocationalPercentage', label: 'Vocational %age' },
  { key: 'prevComplexHead', label: 'Previous Complex Head' },
  { key: 'prevSchool', label: 'Previous School' },
  { key: 'prevCcDc', label: 'CC/DC No. & Date (Prev. insitution)' },
  { key: 'prevExamMode', label: 'Exam Mode (Prev.)' },
  { key: 'prevExamRollNo', label: 'Exam R.No. (Prev.)', className: 'font-mono' },
  { key: 'prevMarksObt', label: 'Marks Obt. (Prev.)', className: 'font-mono' },
  { key: 'prevMaxMarks', label: 'Max. Marks (Prev.)', className: 'font-mono' },
  { key: 'prevPercentage', label: '%age (Prev.)', className: 'font-mono' },
  { key: 'prevDivision', label: 'Div/Distinc (Prev.)' },
  { key: 'currExamMode', label: 'Exam Mode (Current)' },
  { key: 'currExamRollNo', label: 'Exam R.No. (Current)', className: 'font-mono' },
  { key: 'currResult', label: 'Result (Current)' },
  { key: 'currMarksReapp', label: 'Marks/Reapp (Current)' },
  { key: 'withdrawalDate', label: 'Date of withdrawl' },
  { key: 'currCcDc', label: 'No. & Date of CC/DC Issued (This Institution)' },
  { key: 'remarks', label: 'Remarks' },
  {
    key: 'pdfUrl', label: 'PDF_URL', render: (val) => (
      val && typeof val === 'string' && val.startsWith('http') ? (
        <a href={val} target="_blank" rel="noreferrer" className="text-teal-600 font-mono underline hover:text-teal-500 text-[10px]">
          📄 PDF Copy
        </a>
      ) : (
        <span className="text-slate-400 font-normal text-[10px]">—</span>
      )
    )
  },
  { key: 'readmission', label: 'readmission' },
  { key: 'apaarId', label: 'APAAR ID', className: 'font-mono whitespace-normal break-all' },
];

const DEFAULT_1_WIDTHS = {
  sno: 45,
  formNo: 62,
  status: 62,
  classRollNo: 65,
  admNo: 70,
  class: 52,
  session: 65,
  boardRegNo: 80,
  photoId: 66,
  studentName: 135,
  fatherName: 165,
  aadhar: 140,
  fatherAadhar: 140,
  dob: 78,
  village: 90,
  gender: 60,
  category: 68,
  stream: 72,
  subs: 80,
  mobile: 100,
  pinCode: 70,
  state: 80,
  residence: 130,
  religion: 75,
  disabilityStatus: 100,
  disabilityType: 100,
  subjects1: 90,
  subjects2: 90,
  subjects3: 90,
  subjects4: 90,
  subjects5: 90,
  subjects6: 90,
  email1: 120,
  email2: 120,
  parentContact: 100,
  bloodType: 70,
  height: 70,
  weight: 70,
  socialCategory: 100,
  socioEconomicCategory: 110,
  houseNo: 80,
  vocationalPercentage: 90,
  prevComplexHead: 110,
  prevSchool: 130,
  prevCcDc: 120,
  prevExamMode: 90,
  prevExamRollNo: 90,
  prevMarksObt: 85,
  prevMaxMarks: 85,
  prevPercentage: 80,
  prevDivision: 90,
  currExamMode: 90,
  currExamRollNo: 90,
  currResult: 85,
  currMarksReapp: 90,
  withdrawalDate: 95,
  currCcDc: 120,
  remarks: 110,
  pdfUrl: 85,
  readmission: 80,
  apaarId: 100,
};

// ─── ADMIN STUDENT PROFILE FIELD EDITOR MODAL ───
function AdminStudentEditModal({ student, onClose, onSave, isSaving, restrictedCols = {} }) {
  const isNewStudent = !student || !student.id;
  const isFieldLocked = (fieldKey) => !isNewStudent && !!restrictedCols[fieldKey];

  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState(() => ({
    'Form Number': student?.formNo || student?.['Form Number'] || student?.['Form No.'] || '',
    'Class': student?.class || student?.['Class'] || '11th',
    'Session': student?.session || student?.['Session'] || '2025-26',
    'Class Roll No': student?.classRollNo || student?.['Class Roll No'] || '',
    'Adm. No.': student?.admNo || student?.['Adm. No.'] || '',
    'Board Registration Number': student?.boardRegNo || student?.['Board Registration Number'] || student?.['Board Reg. No.'] || '',
    'Status': student?.status || student?.['Status'] || 'Submitted',
    'Stream': student?.stream || student?.['Stream'] || 'General',

    "Student's Name": student?.studentName || student?.["Student's Name (as per school records)"] || student?.["Student's Name"] || '',
    "Father's Name": student?.fatherName || student?.["Father's/Guardian's Name (as per school records)"] || student?.["Father's Name"] || '',
    "Mother's Name": student?.motherName || student?.["Mother's Name (as per school records)"] || student?.["Mother's Name"] || '',
    'DoB': student?.dob || student?.["DoB (as per school records)"] || student?.['DoB (figures)'] || '',
    'Gender': student?.gender || student?.['Gender'] || 'Male',
    'Cat._JKBOSE': student?.category || student?.['Cat._JKBOSE'] || student?.['Category'] || 'General',
    'Religion': student?.religion || student?.['Religion'] || 'Muslim',
    'Village/Town': student?.village || student?.['Name of your village'] || student?.['Village/Town'] || 'Shangus',
    'Mobile No.': student?.mobile || student?.['Mobile No. (with working WhatsApp)'] || student?.["Student's Contact"] || '',
    "Parent's Contact": student?.parentContact || student?.["Parent's Contact"] || '',
    'Aadhar No.': student?.aadhar || student?.['Aadhar No.'] || '',
    "Father's Aadhar No.": student?.fatherAadhar || student?.["Father's Aadhar No."] || student?.["Father's Aadhaar No."] || '',

    'Subjects1': student?.subjects1 || student?.['Subjects1'] || '',
    'Subjects2': student?.subjects2 || student?.['Subjects2'] || '',
    'Subjects3': student?.subjects3 || student?.['Subjects3'] || '',
    'Subjects4': student?.subjects4 || student?.['Subjects4'] || '',
    'Subjects5': student?.subjects5 || student?.['Subjects5'] || '',
    'Subject6': student?.subjects6 || student?.['Subject6'] || '',

    'Bank Name': student?.bankName || student?.['Name of Bank'] || '',
    'Bank Account Number': student?.bankAccount || student?.['Bank Account No.'] || student?.['Bank Account Number'] || '',
    'IFSC Code': student?.ifsc || student?.['IFSC code'] || student?.['IFSC Code'] || '',
    'PEN No.': student?.penNo || student?.['PEN No.'] || '',
    'APAAR ID': student?.apaarId || student?.['APAAR ID'] || '',
    'Previous School': student?.prevSchool || student?.['Previous School'] || '',
    'Remarks': student?.remarks || student?.['Remarks'] || '',
    'photo_id': student?.photo_id || student?.photoId || student?.['Student Photo'] || '',
  }));

  const handleChange = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-3xl my-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-xs">
              <UserCheck size={22} className="text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Edit Student Record</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-400/20 border border-amber-400/30 text-amber-200">
                  Form #{formData['Form Number'] || '—'}
                </span>
              </h2>
              <p className="text-xs text-amber-200/80 font-medium">
                Edits will save to Firestore & sync across all portal dashboards.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-amber-200 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: 'basic', label: 'Personal & Family', icon: User },
            { id: 'academic', label: 'Academic & Roll', icon: BookOpen },
            { id: 'subjects', label: 'Subjects', icon: Layers },
            { id: 'banking', label: 'Bank & IDs', icon: Landmark }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${isActive
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-900'
                  }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-extrabold">
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Photo Upload & Change Control */}
              <div className="sm:col-span-2 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {formatPhotoDisplayUrl(formData['Student Photo'] || formData['photoId']) ? (
                    <img
                      src={formatPhotoDisplayUrl(formData['Student Photo'] || formData['photoId'])}
                      alt="Student"
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-600/40 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs">
                      No Photo
                    </div>
                  )}
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-amber-200 text-xs">Student Passport Photo</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Upload or replace photo for this specific student record.
                    </p>
                  </div>
                </div>
                <label className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-black text-xs cursor-pointer shadow-sm flex items-center gap-1.5 transition-all flex-shrink-0">
                  <Camera size={14} />
                  <span>Upload / Replace Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          let w = img.width;
                          let h = img.height;
                          const maxDim = 400;
                          if (w > maxDim || h > maxDim) {
                            if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                            else { w = Math.round((w * maxDim) / h); h = maxDim; }
                          }
                          canvas.width = w;
                          canvas.height = h;
                          const ctx = canvas.getContext('2d');
                          ctx.drawImage(img, 0, 0, w, h);
                          const compressed = canvas.toDataURL('image/jpeg', 0.85);
                          handleChange('Student Photo', compressed);
                          handleChange('photoId', compressed);
                          handleChange('photo_id', compressed);
                        };
                        img.src = evt.target.result;
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Student's Name (Full)</label>
                <input
                  type="text"
                  value={formData["Student's Name"]}
                  onChange={(e) => handleChange("Student's Name", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Father's / Guardian's Name</label>
                <input
                  type="text"
                  value={formData["Father's Name"]}
                  onChange={(e) => handleChange("Father's Name", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Mother's Name</label>
                <input
                  type="text"
                  value={formData["Mother's Name"]}
                  onChange={(e) => handleChange("Mother's Name", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Date of Birth (DD-MM-YYYY)</label>
                <input
                  type="text"
                  value={formData['DoB']}
                  onChange={(e) => handleChange('DoB', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Gender</label>
                <select
                  value={formData['Gender']}
                  onChange={(e) => handleChange('Gender', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Category</label>
                <select
                  value={formData['Cat._JKBOSE']}
                  onChange={(e) => handleChange('Cat._JKBOSE', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="General">General</option>
                  <option value="RBA">RBA</option>
                  <option value="ST">ST</option>
                  <option value="SC">SC</option>
                  <option value="OBC">OBC</option>
                  <option value="EWS">EWS</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Village / Town</label>
                <input
                  type="text"
                  value={formData['Village/Town']}
                  onChange={(e) => handleChange('Village/Town', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Student Contact (WhatsApp)</label>
                <input
                  type="text"
                  value={formData['Mobile No.']}
                  onChange={(e) => handleChange('Mobile No.', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Mobile (P)</label>
                <input
                  type="text"
                  value={formData["Parent's Contact"]}
                  onChange={(e) => handleChange("Parent's Contact", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Aadhaar Number</label>
                <input
                  type="text"
                  value={formData['Aadhar No.']}
                  onChange={(e) => handleChange('Aadhar No.', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Father's Aadhaar Number</label>
                <input
                  type="text"
                  value={formData["Father's Aadhar No."]}
                  onChange={(e) => handleChange("Father's Aadhar No.", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Form Number</label>
                <input
                  type="text"
                  value={formData['Form Number']}
                  onChange={(e) => handleChange('Form Number', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black flex items-center justify-between">
                  <span>Class</span>
                  {isFieldLocked('class') && <span className="text-[10px] text-rose-500 font-black">🔒 Field Locked</span>}
                </label>
                <select
                  value={formData['Class']}
                  disabled={isFieldLocked('class')}
                  onChange={(e) => handleChange('Class', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="9th">9th</option>
                  <option value="10th">10th</option>
                  <option value="11th">11th</option>
                  <option value="12th">12th</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Session</label>
                <input
                  type="text"
                  value={formData['Session']}
                  onChange={(e) => handleChange('Session', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Class Roll No.</label>
                <input
                  type="text"
                  value={formData['Class Roll No']}
                  onChange={(e) => handleChange('Class Roll No', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-teal-700 dark:text-teal-300 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Admission Number (Adm. No.)</label>
                <input
                  type="text"
                  value={formData['Adm. No.']}
                  onChange={(e) => handleChange('Adm. No.', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-amber-700 dark:text-amber-300 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Board Registration Number</label>
                <input
                  type="text"
                  value={formData['Board Registration Number']}
                  onChange={(e) => handleChange('Board Registration Number', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Status</label>
                <select
                  value={formData['Status']}
                  onChange={(e) => handleChange('Status', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Submitted">Submitted (SUBM)</option>
                  <option value="Approved">Approved (APPR)</option>
                  <option value="Provisional">Provisional</option>
                  <option value="Draft">Draft</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Stream</label>
                <select
                  value={formData['Stream']}
                  onChange={(e) => handleChange('Stream', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="General">General</option>
                  <option value="Science">Science</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Commerce">Commerce</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 1 (Core English)</label>
                <input
                  type="text"
                  value={formData['Subjects1']}
                  onChange={(e) => handleChange('Subjects1', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 2</label>
                <input
                  type="text"
                  value={formData['Subjects2']}
                  onChange={(e) => handleChange('Subjects2', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 3</label>
                <input
                  type="text"
                  value={formData['Subjects3']}
                  onChange={(e) => handleChange('Subjects3', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 4</label>
                <input
                  type="text"
                  value={formData['Subjects4']}
                  onChange={(e) => handleChange('Subjects4', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 5</label>
                <input
                  type="text"
                  value={formData['Subjects5']}
                  onChange={(e) => handleChange('Subjects5', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 6 (Vocational / Elective)</label>
                <input
                  type="text"
                  value={formData['Subject6']}
                  onChange={(e) => handleChange('Subject6', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'banking' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Bank Name</label>
                <input
                  type="text"
                  value={formData['Bank Name']}
                  onChange={(e) => handleChange('Bank Name', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Bank Account Number</label>
                <input
                  type="text"
                  value={formData['Bank Account Number']}
                  onChange={(e) => handleChange('Bank Account Number', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">IFSC Code</label>
                <input
                  type="text"
                  value={formData['IFSC Code']}
                  onChange={(e) => handleChange('IFSC Code', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">PEN No.</label>
                <input
                  type="text"
                  value={formData['PEN No.']}
                  onChange={(e) => handleChange('PEN No.', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">APAAR ID</label>
                <input
                  type="text"
                  value={formData['APAAR ID']}
                  onChange={(e) => handleChange('APAAR ID', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Previous School</label>
                <input
                  type="text"
                  value={formData['Previous School']}
                  onChange={(e) => handleChange('Previous School', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Remarks / Special Notes</label>
                <textarea
                  rows={2}
                  value={formData['Remarks']}
                  onChange={(e) => handleChange('Remarks', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-black text-xs shadow-lg hover:shadow-amber-900/30 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  <span>Save & Apply System-Wide</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdvancedReports({
  setActiveTab,
  setCounts,
  user,
  onLogout,
  onSync,
  stats,
  initialData = [],
  onRecordDeleted,
  triggerAction,
  onTriggerActionHandled,
  enableQuickCellEdit: parentQuickCellEdit,
  setEnableQuickCellEdit: parentSetQuickCellEdit
}) {
  // Clear legacy cache keys on initial render to prevent stale dataset from sticking in sessionStorage
  useEffect(() => {
    try {
      sessionStorage.removeItem('hss_reports_cache_v2');
      sessionStorage.removeItem('hss_reports_cache_v3');
      sessionStorage.removeItem('hss_reports_cache_v4');
      sessionStorage.removeItem('hss_reports_cache_v5');
    } catch (_) { }
  }, []);

  // Data States — Instant initialization from props or session/local cache
  const syncCachedAdmissions = (Array.isArray(initialData) && initialData.length > 0)
    ? initialData
    : (getCachedCollectionSync('admissions') || []);

  const [loading, setLoading] = useState(syncCachedAdmissions.length === 0);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [currentAdmissions, setCurrentAdmissions] = useState(syncCachedAdmissions);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [deletingStudentTarget, setDeletingStudentTarget] = useState(null);
  const [selectedTableDocIds, setSelectedTableDocIds] = useState(() => new Set());
  const [bulkTableStatus, setBulkTableStatus] = useState('Submitted');
  const [bulkTableActionBusy, setBulkTableActionBusy] = useState(false);
  const [showRecycleBinModal, setShowRecycleBinModal] = useState(false);
  const [unreadRecycleBinCount, setUnreadRecycleBinCount] = useState(0);

  // Handle triggerAction from global module launcher
  useEffect(() => {
    if (!triggerAction) return;
    if (triggerAction === 'analytics') {
      setShowAnalyticsModal(true);
    } else if (triggerAction === 'directEntry') {
      setShowDirectIngestionModal(true);
    } else if (triggerAction === 'bulkTools') {
      setShowToolsModal(true);
    } else if (triggerAction === 'recycleBin') {
      setShowRecycleBinModal(true);
    }
    if (onTriggerActionHandled) {
      onTriggerActionHandled();
    }
  }, [triggerAction, onTriggerActionHandled]);
  const recycleBinCount = unreadRecycleBinCount;
  const [hasUnseenToolsUpdate, setHasUnseenToolsUpdate] = useState(false);
  const lastSyncedInputRef = useRef(null);

  // Compute active user permissions signature
  const currentPermsSig = useMemo(() => {
    const role = String(user?.role || '').toLowerCase().trim();
    const perms = Array.isArray(user?.perms) ? [...user.perms].sort().join(',') : '*';
    return `${role}::${perms}`;
  }, [user]);

  const [photosLoaded, setPhotosLoaded] = useState(false);

  // Preload centralized student photos into memory/cache and trigger reactive re-render
  useEffect(() => {
    let isMounted = true;
    preloadStudentPhotosCache().then(() => {
      if (isMounted) setPhotosLoaded(true);
    }).catch(() => {});

    const handlePhotosLoaded = () => {
      if (isMounted) setPhotosLoaded(true);
    };
    window.addEventListener('hss-photos-loaded', handlePhotosLoaded);
    return () => {
      isMounted = false;
      window.removeEventListener('hss-photos-loaded', handlePhotosLoaded);
    };
  }, []);

  // Check if tools permissions were updated by SuperAdmin
  useEffect(() => {
    try {
      const savedSig = localStorage.getItem('hss_seen_tools_perms_v1');
      if (savedSig && savedSig !== currentPermsSig) {
        setHasUnseenToolsUpdate(true);
      } else if (!savedSig) {
        localStorage.setItem('hss_seen_tools_perms_v1', currentPermsSig);
      }
    } catch (_) {}
  }, [currentPermsSig]);

  const handleMarkToolsSeen = useCallback(() => {
    try {
      localStorage.setItem('hss_seen_tools_perms_v1', currentPermsSig);
      setHasUnseenToolsUpdate(false);
    } catch (_) {}
  }, [currentPermsSig]);

  const handleMarkRecycleBinSeen = useCallback(() => {
    try {
      localStorage.setItem('hss_seen_recycle_bin_time_v1', String(Date.now()));
      setUnreadRecycleBinCount(0);
    } catch (_) {}
  }, []);

  const refreshRecycleBinCount = useCallback(async () => {
    try {
      const items = await getRecycleBinItems();
      if (!items || items.length === 0) {
        setUnreadRecycleBinCount(0);
        return;
      }
      const savedTime = parseInt(localStorage.getItem('hss_seen_recycle_bin_time_v1') || '0', 10);
      if (!savedTime) {
        setUnreadRecycleBinCount(items.length);
      } else {
        const unread = items.filter(it => new Date(it.deletedAt || 0).getTime() > savedTime);
        setUnreadRecycleBinCount(unread.length);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (showRecycleBinModal) {
      handleMarkRecycleBinSeen();
    } else {
      refreshRecycleBinCount();
    }
  }, [refreshRecycleBinCount, handleMarkRecycleBinSeen, showRecycleBinModal, deletingStudentTarget]);
  const [printSections, setPrintSections] = useState({
    includeAdmissionForm: true,
    includeLibraryForm: true,
    includeConductDeclaration: true
  });
  const [selectedBulkFormIds, setSelectedBulkFormIds] = useState(new Set());

  // ─── Direct Admin Student Edit Execution ───
  const executeSaveStudentEdit = async (updatedFields, reasonCategory = 'Routine Update', customReason = '') => {
    try {
      setIsSavingEdit(true);

      const fNo = updatedFields['Form Number'] || updatedFields['Form No.'] || updatedFields.formNo;
      const cleanFNo = fNo ? String(fNo).replace(/^'/, '').trim() : '';

      const payload = {
        ...updatedFields,
        updatedAt: new Date().toISOString(),
        lastEditedBy: `Admin (${user?.email || 'System'})`
      };

      // Perform in-place update on existing document (never creates duplicate docs)
      await updateStudentDocument(editingStudent, payload);

      if (updatedFields.email1 || updatedFields.email || cleanFNo) {
        const userDocId = (updatedFields.email1 || updatedFields.email || `form_${cleanFNo}`).toLowerCase().replace(/[^a-z0-9_@-]/g, '_');
        try {
          await setDoc(doc(db, 'users', userDocId), {
            studentName: updatedFields["Student's Name (as per school records)"] || updatedFields["Student's Name"] || updatedFields.studentName,
            classRollNo: updatedFields['Class Roll No'] || updatedFields.classRollNo,
            admNo: updatedFields['Adm. No.'] || updatedFields.admNo,
            boardRegNo: updatedFields['Board Registration Number'] || updatedFields.boardRegNo,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) { }
      }

      setCurrentAdmissions(prev => prev.map(st => {
        const stFNo = String(st['Form Number'] || st['FormNo'] || st['Form No.'] || st.formNo || '').replace(/^'/, '').trim();
        if ((cleanFNo && stFNo.toLowerCase() === cleanFNo.toLowerCase()) || st.id === editingStudent.id) {
          return { ...st, ...payload };
        }
        return st;
      }));

      // Log activity
      const studentName = updatedFields["Student's Name (as per school records)"] || updatedFields["Student's Name"] || 'Student';
      try {
        logAdminActivity(
          user?.email || 'Admin',
          'STUDENT_EDIT',
          `Updated full profile for ${studentName} (Form #${cleanFNo || '—'}) [Reason: ${reasonCategory} - ${customReason}]`
        );
      } catch (_) {}

      setEditingStudent(null);
      setConfirmModalConfig(null);
      setToast({
        message: `✅ Student record for ${studentName} updated successfully across all portals!`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 4000);
    } catch (error) {
      console.error('Error saving student edits:', error);
      setToast({
        message: `❌ Failed to save student changes: ${error.message}`,
        type: 'error'
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveStudentEdit = (updatedFields) => {
    const sName = updatedFields["Student's Name (as per school records)"] || updatedFields["Student's Name"] || editingStudent?.studentName || 'Student';
    const fNo = updatedFields['Form Number'] || updatedFields['Form No.'] || editingStudent?.formNo || '—';

    setConfirmModalConfig({
      isOpen: true,
      type: 'warning',
      title: 'Confirm Student Record Update',
      message: `Are you sure you want to save modifications for ${sName} (Form #${fNo})?`,
      consequence: 'All changed fields will be committed directly to official student registers in Cloud Firestore and synced.',
      confirmText: 'Confirm & Commit',
      showReasonInput: true,
      onConfirm: ({ reasonCategory, customReason }) => {
        executeSaveStudentEdit(updatedFields, reasonCategory, customReason);
      }
    });
  };

  // ─── Quick Cell Edit Controls & Handlers ───
  const [localQuickCellEdit, setLocalQuickCellEdit] = useState(() => {
    try {
      return localStorage.getItem('hss_quick_cell_edit') === 'true';
    } catch {
      return false;
    }
  });
  const enableQuickCellEdit = parentQuickCellEdit !== undefined ? parentQuickCellEdit : localQuickCellEdit;
  const setEnableQuickCellEdit = parentSetQuickCellEdit !== undefined ? parentSetQuickCellEdit : setLocalQuickCellEdit;
  const [quickEditCell, setQuickEditCell] = useState(null);
  const [isSavingQuickEdit, setIsSavingQuickEdit] = useState(false);
  const [quickEditProgress, setQuickEditProgress] = useState(0);
  const [quickEditStage, setQuickEditStage] = useState('');
  const [quickEditReasonCategory, setQuickEditReasonCategory] = useState('Routine Data Update & Correction');
  const [quickEditCustomReason, setQuickEditCustomReason] = useState('');
  const [showQuickEditReason, setShowQuickEditReason] = useState(false);

  const executeSaveQuickCellEdit = async (student, colKey, newValue, reasonCategory = 'Routine Correction', customReason = '') => {
    try {
      setIsSavingQuickEdit(true);
      setQuickEditProgress(15);
      setQuickEditStage('Validating & Preparing field updates...');
      await new Promise(r => setTimeout(r, 100));

      const fNo = student['Form Number'] || student['Form No.'] || student.formNo;
      const cleanFNo = fNo ? String(fNo).replace(/^'/, '').trim() : '';

      // Use actual Firestore document ID as primary key to prevent creating duplicate docs
      const rawDocId = student.id || student.docId || student._docId || cleanFNo || `doc_${Date.now()}`;
      const docId = String(rawDocId).replace(/^(active_|hist_|adm_)/, '').trim();
      const sanitizedDocId = docId.replace(/[/\s]/g, '_').toLowerCase();

      const keyMap = {
        formNo: 'Form Number',
        classRollNo: 'Class Roll No',
        admNo: 'Adm. No.',
        boardRegNo: 'Board Registration Number',
        currExamRollNo: 'Exam R.No. (Current)',
        examRoll: 'Exam R.No. (Current)',
        examRollNo: 'Exam R.No. (Current)',
        boardRoll: 'Exam R.No. (Current)',
        boardRollNo: 'Exam R.No. (Current)',
        'Exam R.No. (Current)': 'Exam R.No. (Current)',
        studentName: "Student's Name (as per school records)",
        fatherName: "Father's/Guardian's Name (as per school records)",
        motherName: "Mother's Name (as per school records)",
        dob: 'DoB (as per school records)',
        gender: 'Gender',
        category: 'Cat._JKBOSE',
        village: 'Name of your village',
        mobile: 'Mobile No. (with working WhatsApp)',
        aadhar: 'Aadhar No.',
        bankAccount: 'Bank Account No.',
        bankName: 'Name of Bank',
        ifsc: 'IFSC code',
        onlineSubmDate: 'Online Subm. Date',
        admDate: 'Adm. Date',
        boardName: 'Board Name',
        penNo: 'PEN No.',
        apaarId: 'APAAR ID',
        prevSchool: 'Previous School',
        remarks: 'Remarks'
      };

      const targetFieldName = keyMap[colKey] || colKey;
      const isExamRollEdit = colKey.toLowerCase().includes('exam') || colKey.toLowerCase().includes('boardroll') || targetFieldName === 'Exam R.No. (Current)' || colKey === 'currExamRollNo';

      const payload = {
        [targetFieldName]: newValue,
        ...(isExamRollEdit ? {
          'Exam R.No. (Current)': newValue,
          currExamRollNo: newValue,
          examRollNo: newValue,
          examRoll: newValue,
          boardRollNo: newValue
        } : {}),
        updatedAt: new Date().toISOString(),
        lastEditedBy: `Admin (${user?.email || 'Quick Cell'})`
      };

      setQuickEditProgress(50);
      setQuickEditStage('Syncing live record to Cloud Firestore database...');

      // Perform in-place update on existing document (never creates duplicate docs)
      await updateStudentDocument(student, payload);

      setQuickEditProgress(75);
      setQuickEditStage('Updating local registers cache & table view...');

      setCurrentAdmissions(prev => prev.map(st => {
        if ((cleanFNo && String(st['Form Number'] || st['Form No.'] || st.formNo || '').replace(/^'/, '').trim().toLowerCase() === cleanFNo.toLowerCase()) || st.id === student.id) {
          return { ...st, [colKey]: newValue, [targetFieldName]: newValue, 'Exam R.No. (Current)': newValue, currExamRollNo: newValue, examRollNo: newValue };
        }
        return st;
      }));

      setQuickEditProgress(90);
      setQuickEditStage('Logging administrative activity audit trail...');

      // Log activity
      try {
        logAdminActivity(
          user?.email || 'Admin',
          'QUICK_EDIT',
          `Changed "${targetFieldName}" to "${newValue}" for ${student.studentName || 'Student'} (Form #${cleanFNo || '—'}) [Reason: ${reasonCategory} - ${customReason}]`
        );
      } catch (_) {}

      setQuickEditProgress(100);
      setQuickEditStage('✅ Successfully Synced System-Wide!');
      await new Promise(r => setTimeout(r, 450));

      setQuickEditCell(null);
      setConfirmModalConfig(null);
      setToast({
        message: `✅ Updated ${targetFieldName} to "${newValue}"!`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Quick edit error:', err);
      setToast({ message: `❌ Quick edit failed: ${err.message}`, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSavingQuickEdit(false);
      setQuickEditProgress(0);
      setQuickEditStage('');
    }
  };

  const handleSaveQuickCellEdit = (student, colKey, newValue) => {
    const rawVal = student[colKey] !== undefined ? String(student[colKey]) : (student[colKey] || '');
    const cleanNew = String(newValue ?? '').trim();
    const cleanOld = rawVal.trim();

    // If value has not changed, simply close without prompt
    if (cleanNew === cleanOld) {
      setQuickEditCell(null);
      return;
    }

    executeSaveQuickCellEdit(student, colKey, cleanNew, quickEditReasonCategory, quickEditCustomReason);
  };

  // Copy Cell / Row State & Handlers
  const [copiedCellId, setCopiedCellId] = useState(null);

  const handleCopyCell = (cellId, textValue) => {
    if (!textValue || textValue === '—') return;
    navigator.clipboard.writeText(String(textValue));
    setCopiedCellId(cellId);
    setTimeout(() => setCopiedCellId(null), 1500);
  };

  const handleCopyRow = (student) => {
    const rowValues = orderedVisibleColumns
      .flatMap(col => {
        if (col.key === 'mobile') {
          const sMob = student?.mobile && student?.mobile !== '—' && student?.mobile !== '-' ? String(student.mobile).trim() : '';
          const pMob = student?.parentContact && student?.parentContact !== '—' && student?.parentContact !== '-' ? String(student.parentContact).trim() : '';
          return [sMob, pMob];
        }
        const val = student[col.key];
        return (val === undefined || val === null || val === '—') ? '' : String(val);
      })
      .join('\t');
    navigator.clipboard.writeText(rowValues);
    setCopiedCellId(`row_${student.id || student.sno}`);
    setTimeout(() => setCopiedCellId(null), 1500);
  };

  // Tools dropdown state
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [showCustomRosterModal, setShowCustomRosterModal] = useState(false);
  const toolsDropdownRef = useRef(null);

  useEffect(() => {
    if (!isToolsOpen) return;
    function handleClickOutside(event) {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isToolsOpen]);

  // Filter States (All filters default to [] so all records are visible by default)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchTerm === debouncedSearch) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setIsSearching(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

  const deferredSearchTerm = useDeferredValue(debouncedSearch);
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const searchHelpRef = useRef(null);

  useEffect(() => {
    if (!showSearchHelp) return;
    function handleClickOutside(event) {
      if (searchHelpRef.current && !searchHelpRef.current.contains(event.target)) {
        setShowSearchHelp(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchHelp]);

  const [selectedSessions, setSelectedSessions] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedGenders, setSelectedGenders] = useState([]);
  const [selectedStreams, setSelectedStreams] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  // Default sort: Most Recent First (Descending order)
  const [sortBy, setSortBy] = useState('onlineSubmDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Layout & Density States (with LocalStorage Persistence)
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem('hss_admin_table_density_v1') || 'compact';
    } catch {
      return 'compact';
    }
  });


  const DEFAULT_VISIBLE_COLS = {
    sno: true,
    formNo: true,
    status: true,
    classRollNo: true,
    admNo: true,
    class: true,
    session: true,
    boardRegNo: true,
    photoId: true,
    studentName: true,
    fatherName: true,
    dob: true,
    village: true,
    gender: false,
    stream: false,
    subs: true,
    mobile: true,
    category: false,
    aadhar: true,
    fatherAadhar: false,
    bankAccount: false,
    bankName: false,
    ifsc: false,
  };

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_admin_table_cols_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load saved layout cols', e);
    }
    return DEFAULT_VISIBLE_COLS;
  });

  const DEFAULT_RESTRICTED_COLS = {
    sno: true,
    status: true,
    formNo: true,
    admNo: true,
    session: true,
    photoId: true,
    subs: true,
    class: true, // Specifically locked per user request!
  };

  const [restrictedCols, setRestrictedCols] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_admin_restricted_cols_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load saved restricted cols', e);
    }
    return DEFAULT_RESTRICTED_COLS;
  });

  // ─── Temporary Column Shifting State (Per Session / Resets on Login) ───
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const cached = sessionStorage.getItem('hss_temp_column_order_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) { }
    return COLUMN_DEFS.map(c => c.key);
  });

  const [draggedColKey, setDraggedColKey] = useState(null);

  const handleShiftColumn = (colKey, direction) => {
    setColumnOrder((prev) => {
      const currentList = [...prev];
      const idx = currentList.indexOf(colKey);
      if (idx === -1) return prev;

      const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentList.length) return prev;

      const temp = currentList[idx];
      currentList[idx] = currentList[targetIdx];
      currentList[targetIdx] = temp;

      try {
        sessionStorage.setItem('hss_temp_column_order_v1', JSON.stringify(currentList));
      } catch (e) { }

      return currentList;
    });
  };

  const handleColumnDragStart = (e, colKey) => {
    e.dataTransfer.setData('text/plain', colKey);
    setDraggedColKey(colKey);
  };

  const handleColumnDrop = (e, targetColKey) => {
    e.preventDefault();
    const sourceColKey = e.dataTransfer.getData('text/plain') || draggedColKey;
    if (!sourceColKey || sourceColKey === targetColKey) return;

    setColumnOrder((prev) => {
      const currentList = [...prev];
      const fromIdx = currentList.indexOf(sourceColKey);
      const toIdx = currentList.indexOf(targetColKey);
      if (fromIdx === -1 || toIdx === -1) return prev;

      currentList.splice(fromIdx, 1);
      currentList.splice(toIdx, 0, sourceColKey);

      try {
        sessionStorage.setItem('hss_temp_column_order_v1', JSON.stringify(currentList));
      } catch (e) { }

      return currentList;
    });

    setDraggedColKey(null);
  };

  const handleResetColumnOrder = () => {
    const defaultOrder = COLUMN_DEFS.map(c => c.key);
    setColumnOrder(defaultOrder);
    try {
      sessionStorage.removeItem('hss_temp_column_order_v1');
    } catch (e) { }
  };

  const isColumnOrderCustom = useMemo(() => {
    const defaultKeys = COLUMN_DEFS.map(c => c.key);
    if (columnOrder.length !== defaultKeys.length) return true;
    return columnOrder.some((k, i) => k !== defaultKeys[i]);
  }, [columnOrder]);

  const orderedVisibleColumns = useMemo(() => {
    const map = new Map(COLUMN_DEFS.map((col) => [col.key, col]));
    const ordered = [];

    columnOrder.forEach((key) => {
      if (key !== 'gender' && visibleCols[key] && map.has(key)) {
        ordered.push(map.get(key));
      }
    });

    COLUMN_DEFS.forEach((col) => {
      if (col.key !== 'gender' && visibleCols[col.key] && !ordered.some((c) => c.key === col.key)) {
        ordered.push(col);
      }
    });

    return ordered;
  }, [columnOrder, visibleCols]);

  const toggleRestrictedCol = (colKey) => {
    setRestrictedCols(prev => {
      const updated = { ...prev, [colKey]: !prev[colKey] };
      try {
        localStorage.setItem('hss_admin_restricted_cols_v1', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  };
  const [colWidths, setColWidths] = useState(() => {
    try {
      const savedWidths = localStorage.getItem('hss_admin_table_widths_v2');
      if (savedWidths) return JSON.parse(savedWidths);
    } catch (e) {
      console.warn('Could not load saved Default 2 widths', e);
    }
    return DEFAULT_1_WIDTHS;
  });

  const [layoutNotice, setLayoutNotice] = useState(null);

  const handleResizeStart = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || DEFAULT_1_WIDTHS[colKey] || 100;

    let latestWidths = { ...colWidths };

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(1, startWidth + deltaX);
      latestWidths = { ...latestWidths, [colKey]: newWidth };
      setColWidths(prev => ({
        ...prev,
        [colKey]: newWidth
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      // Auto-persist widths to localStorage so they survive page refresh
      try {
        localStorage.setItem('hss_admin_table_widths_v2', JSON.stringify(latestWidths));
      } catch (err) {
        console.warn('Could not auto-save column widths', err);
      }
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Save current active columns, density & widths as Default 2 Preset
  const saveAsDefault2 = () => {
    try {
      localStorage.setItem('hss_admin_table_widths_v2', JSON.stringify(colWidths));
      localStorage.setItem('hss_admin_table_cols_v1', JSON.stringify(visibleCols));
      localStorage.setItem('hss_admin_table_density_v1', density);
      setLayoutNotice({ type: 'success', msg: 'Current column widths saved as Default 2 preset!' });
      setTimeout(() => setLayoutNotice(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Reset to original System Default 1 layout and widths
  const resetToDefault1 = () => {
    setColWidths(DEFAULT_1_WIDTHS);
    setVisibleCols(DEFAULT_VISIBLE_COLS);
    setDensity('fit');
    try {
      localStorage.removeItem('hss_admin_table_widths_v2');
      localStorage.removeItem('hss_admin_table_cols_v1');
      localStorage.removeItem('hss_admin_table_density_v1');
    } catch (err) {
      console.error(err);
    }
    setLayoutNotice({ type: 'reset', msg: 'Reset to System Default 1 widths & layout!' });
    setTimeout(() => setLayoutNotice(null), 3000);
  };

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal States
  const [previewPhotoModal, setPreviewPhotoModal] = useState(null);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [colManagerTab, setColManagerTab] = useState('visibility'); // 'visibility' | 'restrictions'
  const [colSearchQuery, setColSearchQuery] = useState('');
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [activeToolsTab, setActiveToolsTab] = useState('bulk_forms');
  const [showDirectIngestionModal, setShowDirectIngestionModal] = useState(false);

  // Global Custom Confirmation Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);

  const handleDirectRecordAdded = (newRecord) => {
    setCurrentAdmissions(prev => [newRecord, ...prev]);
    setToast({ message: `⚡ Direct Record Ingested for "${newRecord.studentName}"!`, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRecordDeleted = useCallback((student) => {
    if (!student) return;
    const formNo = String(student?.formNo || student?.['Form No.'] || student?.['Form Number'] || student?.id || '').replace(/^(N\/A|—)$/i, '').trim();
    const rawId = String(student?._docId || student?.docId || student?.id || formNo).replace(/^(N\/A|—)$/i, '').trim();
    const normForm = formNo ? formNo.replace(/[\/\s]/g, '_').toLowerCase() : '';
    const normId = rawId ? rawId.replace(/[\/\s]/g, '_').toLowerCase() : '';
    const isMatch = (s) => {
      if (!s) return false;
      const sId = String(s._docId || s.docId || s.id || '').trim().replace(/[\/\s]/g, '_').toLowerCase();
      // When the deleted record has an exact Firestore ID, never fall through
      // to a form-number match: merged applications can share that form value.
      if (normId) return Boolean(sId && sId === normId);
      const sf = String(s.formNo || s['Form No.'] || s['Form Number'] || '').replace(/^(N\/A|—)$/i, '').trim();
      const snForm = sf ? sf.replace(/[\/\s]/g, '_').toLowerCase() : '';
      return Boolean(normForm && snForm && snForm === normForm);
    };

    // 1. Immediately remove from React state (0ms instant UI update)
    setCurrentAdmissions(prev => prev.filter(s => !isMatch(s)));

    // 2. Remove from global window memory cache
    if (window._hssMasterRegistersCache && Array.isArray(window._hssMasterRegistersCache)) {
      window._hssMasterRegistersCache = window._hssMasterRegistersCache.filter(s => !isMatch(s));
    }

    // 3. Notify parent dashboard to update counts & applications list
    if (onRecordDeleted && typeof onRecordDeleted === 'function') {
      onRecordDeleted(student);
    }
  }, [onRecordDeleted]);

  const handleDeleteStudent = (student) => {
    if (!student) return;
    setDeletingStudentTarget(student);
  };

  const handleClearCellField = (student, col) => {
    if (!student || !col) return;
    const colKey = col.key;
    const colLabel = col.label || colKey;
    const cleanFNo = String(student['Form Number'] || student['Form No.'] || student.formNo || '').replace(/^'/, '').trim();
    const docId = cleanFNo ? cleanFNo : (student.id ? student.id.replace(/^(active_|hist_)/, '') : `doc_${Date.now()}`);
    const sanitizedDocId = docId.replace(/\//g, '_').toLowerCase();
    const nameDisplay = student.studentName || student["Student's Name (as per school records)"] || 'Student';

    setConfirmModalConfig({
      isOpen: true,
      type: 'warning',
      title: `Clear ${colLabel}`,
      message: `Are you sure you want to clear/reset the value for "${colLabel}" for ${nameDisplay}?`,
      consequence: `This will clear only the "${colLabel}" field value without deleting the student's main admission record.`,
      confirmText: `Clear ${colLabel}`,
      cancelText: 'Cancel',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        try {
          const keyMap = {
            formNo: 'Form Number',
            classRollNo: 'Class Roll No',
            admNo: 'Adm. No.',
            boardRegNo: 'Board Registration Number',
            studentName: "Student's Name (as per school records)",
            fatherName: "Father's/Guardian's Name (as per school records)",
            motherName: "Mother's Name (as per school records)",
            dob: 'DoB (as per school records)',
            gender: 'Gender',
            category: 'Cat._JKBOSE',
            village: 'Name of your village',
            mobile: 'Mobile No. (with working WhatsApp)',
            aadhar: 'Aadhar No.',
            bankAccount: 'Bank Account No.',
            bankName: 'Name of Bank',
            ifsc: 'IFSC code',
            onlineSubmDate: 'Online Subm. Date',
            admDate: 'Adm. Date',
            boardName: 'Board Name',
            penNo: 'PEN No.',
            apaarId: 'APAAR ID',
            prevSchool: 'Previous School',
            remarks: 'Remarks'
          };
          const targetFieldName = keyMap[colKey] || colKey;
          const payload = {
            [targetFieldName]: '',
            [colKey]: '',
            updatedAt: new Date().toISOString(),
            lastEditedBy: 'Admin (Field Reset)'
          };

          // Perform in-place update on existing document (never creates duplicate docs)
          await updateStudentDocument(student, payload);

          await logAdminActivity({
            actionType: 'cell_clear',
            actionTitle: `Cleared Field "${colLabel}"`,
            details: `Cleared field "${colLabel}" for "${nameDisplay}" (ID: ${docId})`,
            reasonCategory,
            customReason,
            metadata: { docId, colKey, colLabel, studentName: nameDisplay }
          });

          updateCachedItem('admissions', docId, payload);

          setCurrentAdmissions(prev => prev.map(st => st.id === student.id ? { ...st, [colKey]: '', [targetFieldName]: '' } : st));

          setToast({ message: `🧹 Cleared ${colLabel} field for ${nameDisplay}`, type: 'success' });
          setTimeout(() => setToast(null), 3000);
        } catch (err) {
          console.error('Clear cell field error:', err);
          setToast({ message: `❌ Clear field failed: ${err.message}`, type: 'error' });
        } finally {
          setConfirmModalConfig(null);
        }
      }
    });
  };

  // ID Assigner & Tools Suite States
  const [assignStartId, setAssignStartId] = useState('5476');
  const [assigningIds, setAssigningIds] = useState(false);
  const [assignClasses, setAssignClasses] = useState(['9th', '11th']);
  const [assignSessionFilter, setAssignSessionFilter] = useState('2025-26');
  const [onlyMissingAdmNo, setOnlyMissingAdmNo] = useState(true);
  const [assignStrategies, setAssignStrategies] = useState({});
  const [customIds, setCustomIds] = useState({});
  const [assignDateValue, setAssignDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [assignDateField, setAssignDateField] = useState('admDate');
  const [batchEditField, setBatchEditField] = useState('class_session');
  const [batchEditValue, setBatchEditValue] = useState('Approved');
  const [bulkNewClass, setBulkNewClass] = useState('KEEP');
  const [bulkNewSession, setBulkNewSession] = useState('KEEP');
  const [bulkNewStream, setBulkNewStream] = useState('KEEP');
  const [bulkNewStatus, setBulkNewStatus] = useState('KEEP');
  const [bulkCustomSession, setBulkCustomSession] = useState('');
  const [bulkTargetMode, setBulkTargetMode] = useState('filtered'); // 'filtered' | 'selected'
  const [bulkProgress, setBulkProgress] = useState({ active: false, current: 0, total: 0, percent: 0, studentName: '' });
  const [bulkPreviewSession, setBulkPreviewSession] = useState('CURRENT_FILTER');
  const [bulkPreviewClass, setBulkPreviewClass] = useState('ALL');
  const [bulkPreviewSearch, setBulkPreviewSearch] = useState('');
  const [quickEditStudent, setQuickEditStudent] = useState(null);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [toolExecuting, setToolExecuting] = useState(false);

  // Photo Manager States
  const [photoBatchFiles, setPhotoBatchFiles] = useState([]);
  const [photoMatchResults, setPhotoMatchResults] = useState([]);
  const [batchSyncingPhotos, setBatchSyncingPhotos] = useState(false);
  const [reconcilingPhotos, setReconcilingPhotos] = useState(false);
  const [reconcileProgress, setReconcileProgress] = useState({ active: false, current: 0, total: 0, percent: 0, stats: null });
  const [isBackingUpPdfs, setIsBackingUpPdfs] = useState(false);

  const handleBackupPdfsToDrive = async () => {
    setIsBackingUpPdfs(true);
    try {
      const res = await appsScriptApi.call('backupPdfsWithClassOrganization');
      const folderUrl = res?.folderUrl || res?.url;
      if (folderUrl) {
        window.open(folderUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('PDF backup task initialized successfully on Google Drive!');
      }
    } catch (err) {
      console.error('PDF backup error:', err);
      alert('Failed to initialize Google Drive PDF backup: ' + (err.message || 'Server error'));
    } finally {
      setIsBackingUpPdfs(false);
    }
  };

  // Helper to flatten chunked or flat admissions records into uniform student objects
  const flattenAdmissionsList = (rawList = []) => {
    if (!Array.isArray(rawList)) return [];
    const flat = [];
    const seenIds = new Set();

    rawList.forEach((doc, docIdx) => {
      if (!doc || typeof doc !== 'object') return;
      if (doc.Status === 'Deleted' || doc.status === 'Deleted' || doc._deleted === true) return;

      const chunk = doc.items || doc.students || doc.records || doc.applications || doc.data;
      if (Array.isArray(chunk) && chunk.length > 0) {
        chunk.forEach((item, itemIdx) => {
          if (!item || typeof item !== 'object') return;
          if (item.Status === 'Deleted' || item.status === 'Deleted' || item._deleted === true) return;
          const cleanFNo = String(item.formNo || item['Form Number'] || item['Form No.'] || '').trim();
          const cleanReg = String(item.boardRegNo || item['Board Registration Number'] || '').trim();
          const cleanId = String(item.id || item.docId || cleanFNo || cleanReg || `${doc.id}_${itemIdx}`).trim();
          if (seenIds.has(cleanId)) return;
          seenIds.add(cleanId);
          flat.push({ ...item, id: cleanId, _isCurrentScope: true });
        });
      } else {
        const cleanFNo = String(doc.formNo || doc['Form Number'] || doc['Form No.'] || '').trim();
        const cleanReg = String(doc.boardRegNo || doc['Board Registration Number'] || '').trim();
        const cleanId = String(doc.id || doc.docId || cleanFNo || cleanReg || `adm_${docIdx}`).trim();
        if (seenIds.has(cleanId)) return;
        seenIds.add(cleanId);
        flat.push({ ...doc, id: cleanId, _isCurrentScope: true });
      }
    });
    return flat;
  };

  // Helper to flatten chunked or flat masterRegisters records into uniform objects
  const flattenAndFormatMasterRegisters = (rawList = []) => {
    if (!Array.isArray(rawList)) return [];
    const flat = [];
    rawList.forEach((doc, docIdx) => {
      if (!doc || typeof doc !== 'object') return;
      const chunk = doc.items || doc.students || doc.records || doc.data;
      if (Array.isArray(chunk) && chunk.length > 0) {
        const parentSession = doc.Session || doc.session || doc['Academic Session'] || doc.groupKey?.split('_')[0] || doc.id?.split('_')[0] || '';
        const parentClass = doc.class || doc.Class || doc.className || doc['Class'] || doc.groupKey?.split('_')[1] || '';
        const parentStream = doc.stream || doc.Stream || doc['Stream'] || doc.groupKey?.split('_')[2] || '';

        chunk.forEach((item, itemIdx) => {
          if (item && typeof item === 'object') {
            if (item.Status === 'Deleted' || item.status === 'Deleted' || item._deleted === true) return;
            flat.push({
              ...item,
              id: item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'] || `${doc.id}_${itemIdx}`,
              Session: item.Session || item.session || item['Academic Session'] || parentSession || '2024-25',
              session: item.session || item.Session || item['Academic Session'] || parentSession || '2024-25',
              Class: item.Class || item.class || item['Class'] || parentClass || '11th',
              class: item.class || item.Class || item['Class'] || parentClass || '11th',
              Stream: item.Stream || item.stream || item['Stream'] || parentStream || 'General',
              stream: item.stream || item.Stream || item['Stream'] || parentStream || 'General',
              _source: 'masterRegisters',
              _srcCollection: 'masterRegisters',
              _isHistorical: true,
              _isCurrentScope: false
            });
          }
        });
      } else {
        if (doc.Status === 'Deleted' || doc.status === 'Deleted' || doc._deleted === true) return;
        flat.push({
          ...doc,
          _source: 'masterRegisters',
          _srcCollection: 'masterRegisters',
          _isHistorical: true,
          _isCurrentScope: false
        });
      }
    });
    return flat;
  };

  // Historical Master Registers State (for instant global search across all school history)
  const [masterHistoricalRecords, setMasterHistoricalRecords] = useState(() => {
    const cached = getCachedCollectionSync('masterRegisters');
    return Array.isArray(cached) && cached.length > 0 ? flattenAndFormatMasterRegisters(cached) : [];
  });

  // Fetch Current Admissions with instant cache + silent background sync & search indexing
  const loadReportsData = async (forceRefresh = false) => {
    setIsFetchingData(true);
    setFetchProgress(30);

    // ── ADMISSIONS: On forceRefresh (e.g. after deletion), fetch from Firebase directly ──
    let activeList;
    if (forceRefresh) {
      try {
        const freshFromFirestore = await getCachedCollection('admissions', true);
        activeList = Array.isArray(freshFromFirestore) && freshFromFirestore.length > 0
          ? freshFromFirestore
          : (getCachedCollectionSync('admissions') || currentAdmissions || initialData);
      } catch (_) {
        activeList = getCachedCollectionSync('admissions') || currentAdmissions || initialData;
      }
    } else {
      activeList = currentAdmissions.length > 0
        ? currentAdmissions
        : (initialData.length > 0 ? initialData : (getCachedCollectionSync('admissions') || []));
    }

    // Filter out any residual soft-deleted records or items residing in Recycle Bin
    let recycleBinItems = [];
    try {
      recycleBinItems = await getRecycleBinItems();
    } catch (_) {}

    if (Array.isArray(activeList)) {
      activeList = filterActiveAgainstRecycleBin(activeList, recycleBinItems);
    }

    // Fallback on fresh cold login: Fetch active admissions from dbCache
    if (!activeList || activeList.length === 0) {
      try {
        const freshActive = await getCachedCollection('admissions');
        if (Array.isArray(freshActive) && freshActive.length > 0) {
          activeList = freshActive.filter(s => !s || (s.Status !== 'Deleted' && s.status !== 'Deleted' && s._deleted !== true));
        }
      } catch (e) {
        console.warn('Admissions fetch note:', e);
      }
    }

    // Flatten any chunked structures and deduplicate
    const flatAdmissions = flattenAdmissionsList(activeList);

    if (flatAdmissions && flatAdmissions.length > 0) {
      setCurrentAdmissions(flatAdmissions);
      if (setCounts) {
        setCounts({
          active: flatAdmissions.length,
          total: flatAdmissions.length
        });
      }
      // Build in-memory fast search index for immediate ranked matching
      buildLocalSearchIndex(flatAdmissions, masterHistoricalRecords);
    }

    // Lazy master registers load: Only load historical master registers on demand
    // (when searching or explicit force refresh) to keep initial load lightweight and instant.
    if (forceRefresh) {
      getCachedCollection('masterRegisters', true).then((masterList) => {
        if (Array.isArray(masterList) && masterList.length > 0) {
          const flat = flattenAndFormatMasterRegisters(masterList);
          setMasterHistoricalRecords(flat);
          buildLocalSearchIndex(flatAdmissions || currentAdmissions, flat);
        }
      }).catch(() => {});
    }

    setFetchProgress(100);
    setLoading(false);
    setIsFetchingData(false);
    setTimeout(() => setFetchProgress(0), 250);
  };

  useEffect(() => {
    loadReportsData();
    getStudentRegIndex().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronize the already-filtered live admissions supplied by the parent.
  // Re-reading the recycle bin for every snapshot caused duplicate reads and
  // blocked the admin table while Firestore updates were settling.
  useEffect(() => {
    if (!Array.isArray(initialData) || initialData.length === 0) return;

    // The parent preserves the array reference until a real snapshot arrives.
    if (lastSyncedInputRef.current === initialData) {
      return;
    }
    lastSyncedInputRef.current = initialData;

    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted) return;
      const filtered = flattenAdmissionsList(initialData);
      setCurrentAdmissions(filtered);

      const buildIndex = () => {
        if (isMounted) buildLocalSearchIndex(filtered, masterHistoricalRecords);
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(buildIndex, { timeout: 800 });
      } else {
        setTimeout(buildIndex, 0);
      }
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [initialData, masterHistoricalRecords]);

  // Combined Dataset
  const allStudents = useMemo(() => {
    const combined = [];

    const formatStudentSubjects = (rec) => {
      if (!rec) return '—';

      // 1. Array or String Subject fields across classes & forms
      const rawCandidates = [
        rec['Subjects to be taken in Class 12th'],
        rec['Subjects to be taken in Class 11th'],
        rec['Subjects to be taken in Class 10th'],
        rec['Subjects to be taken in Class 9th'],
        rec['Subjects to be taken in Class 8th'],
        rec['Subjects Studied in Class 11th'],
        rec['Subjects Studied in Class 9th'],
        rec['Subjects Studied in Class 8th'],
        rec['Subjects Studied in Class 10th'],
        rec['selectedSubjects'],
        rec['Subjects'],
        rec['subjects'],
        rec['Subs'],
        rec['subs'],
        rec['Stream & Subjects for Class 12th']
      ];

      for (const item of rawCandidates) {
        if (!item) continue;
        if (Array.isArray(item) && item.length > 0) {
          const cleaned = item.filter(s => s && String(s).trim() !== '—' && !String(s).toLowerCase().includes('same as')).map(s => String(s).trim());
          if (cleaned.length > 0) return cleaned.join(', ');
        } else if (typeof item === 'string' && item.trim() && item.trim() !== '—' && !item.toLowerCase().includes('same as')) {
          return item.trim();
        }
      }

      // 2. Individual subjects1..6 fields (Subjects1, Subjects2, Subjects3, etc.)
      const subjList = [];
      const subjKeys = [
        'Subjects1', 'Subjects2', 'Subjects3', 'Subjects4', 'Subjects5', 'Subjects6', 'Subject6',
        'subject1', 'subject2', 'subject3', 'subject4', 'subject5', 'subject6'
      ];

      subjKeys.forEach(k => {
        const val = rec[k];
        if (val && typeof val === 'string' && val.trim() && val.trim() !== '—' && !subjList.includes(val.trim())) {
          subjList.push(val.trim());
        }
      });

      if (subjList.length > 0) {
        return subjList.join(', ');
      }

      return '—';
    };

    const cleanRegNoVal = (val) => {
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

    const extractRegNo = (st) => {
      if (!st) return '';
      const raw = String(
        st['Board Registration Number'] ||
        st['Board Registration No. (Class 11th)'] ||
        st['Board Registration No. (Class 10th)'] ||
        st['Board Reg. No.'] ||
        st['Board Reg No'] ||
        st['Reg. No.'] ||
        st['Reg No'] ||
        st['Registration No'] ||
        st['Registration Number'] ||
        st.boardRegNo ||
        st.regNo ||
        st.registrationNo ||
        ''
      ).replace(/^(N\/A|—)$/i, '').trim();

      return cleanRegNoVal(raw);
    };

    const extractClassRoll = (st) => getStudentRollVal(st);

    const getStudentName = (st) => {
      if (!st) return '';
      return String(
        st["Student's Name (as per school records)"] ||
        st["Student's Name"] ||
        st['Student Name'] ||
        st['Name of Student'] ||
        st['Account Name'] ||
        st.studentName ||
        st['Name'] ||
        st['name'] ||
        ''
      ).replace(/^(N\/A|—)$/i, '').trim();
    };

    const getFatherName = (st) => {
      if (!st) return '';
      return String(
        st["Father's/Guardian's Name (as per school records)"] ||
        st["Father's Name"] ||
        st['Father Name'] ||
        st.fatherName ||
        st["Parent's Name"] ||
        ''
      ).replace(/^(N\/A|—)$/i, '').trim();
    };

    const extractRegNoClean = (st) => {
      const raw = extractRegNo(st);
      if (!raw || raw === '—') return '';
      return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    };

    // ─── GLOBAL STUDENT IDENTITY INDEX ───
    // Multi-key registry mapping students across 9th-12th classes to their allotted Adm Nos and details
    const admNoSetByIdentity = new Map();
    const oldAdmNoByIdentity = new Map();
    const masterRecordByIdentity = new Map();
    const assignedRollByIdentity = new Map();

    // ─── DEDICATED 11TH GRADE INDEX (FOR 12TH STREAM & SUBJECT CONTINUITY / MISMATCH DETECTION) ───
    const record11thByReg = new Map();
    const record11thByAdm = new Map();
    const record11thByName = new Map();

    // ─── CLASS PHOTO GROUP: 9th+10th share 'lower' bucket; 11th+12th share 'upper' bucket ───
    // This means a photo uploaded in 9th is reused for 10th, and a photo in 11th is reused for 12th.
    // Last record scanned wins — so if a student re-uploads in 12th, it replaces the 11th photo.
    const classPhotoGroup = (cls) => {
      const n = normalizeClassVal(cls);
      return (n === '11th' || n === '12th') ? 'upper' : 'lower';
    };

    // Separate photo maps keyed by reg no and adm no (scoped to photo group).
    // Using TWO maps instead of one ensures reg-based lookup is always preferred over adm-based.
    // last-write-wins: later records (e.g. 12th) overwrite earlier (e.g. 11th) for same student.
    const photoByReg = new Map(); // key: `${group}::reg_${regNo}`
    const photoByAdm = new Map(); // key: `${group}::adm_${admNo}`

    const extractPhotoVal = (st) => {
      if (!st) return '';
      const raw = String(
        st['photo_id'] ||
        st['Student Photo'] ||
        st['photoUrl'] ||
        st['Student Photo URL'] ||
        st['Photo'] ||
        st.photo_id ||
        st.photoUrl ||
        st.photoId ||
        ''
      ).trim();
      return formatPhotoDisplayUrl(raw, st);
    };

    // Helper: detect bogus/dummy reg numbers that students leave as zeros (e.g. 2301000000000000)
    const isValidRegNo = (reg) => {
      if (!reg || reg.length < 6) return false;
      // Reject if last 5 or more digits are all zeros (dummy placeholder entry)
      if (/0{5,}$/.test(reg)) return false;
      // Reject if 80%+ of the digits are zeros (mostly-zero submissions)
      const zeros = (reg.match(/0/g) || []).length;
      if (zeros / reg.length >= 0.75) return false;
      return true;
    };

    const getStudentEmail = (rec) => {
      if (!rec) return '';
      return String(
        rec['email1'] || rec['Email'] || rec['Email Address'] || rec.email || rec.email1 || ''
      ).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    };

    const areNamesCompatible = (n1, n2) => {
      if (!n1 || !n2) return true;
      const clean1 = String(n1).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const clean2 = String(n2).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (!clean1 || !clean2 || clean1 === 'student' || clean2 === 'student' || clean1 === '—' || clean2 === '—') return true;
      if (clean1 === clean2) return true;

      // Check prefix or substring inclusion (e.g. "faizan mushtaq" vs "faizan mushtaq sheikh")
      if (clean1.startsWith(clean2) || clean2.startsWith(clean1)) return true;
      if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

      // Token overlap check
      const tokens1 = clean1.split(/\s+/).filter(t => t.length > 2);
      const tokens2 = clean2.split(/\s+/).filter(t => t.length > 2);
      if (tokens1.length === 0 || tokens2.length === 0) return true;

      const common = tokens1.filter(t => tokens2.includes(t));
      if (common.length >= 2) return true;
      if (common.length >= 1 && (tokens1.length === 1 || tokens2.length === 1)) return true;

      return false;
    };

    const getIdentityKeys = (rec) => {
      const keys = [];
      const reg = extractRegNoClean(rec);
      const rawAdm = extractRawAdmNo(rec);
      const cleanAdm = cleanAdmNoVal(rawAdm);
      const sName = getStudentName(rec).toLowerCase();
      const fName = getFatherName(rec).toLowerCase();
      const fNo = cleanFormNo(rec['Form Number'] || rec['FormNo'] || rec['Form No.'] || rec.formNo);

      const cls = normalizeClassVal(rec['Admission sought for class'] || rec['Class']);
      const sess = normalizeSessionVal(rec['Session']);
      const scope = `${cls}_${sess}`;

      // 1. Admission Number — PRIMARY STABLE IDENTIFIER ACROSS 9-10th & 11-12th
      if (cleanAdm && cleanAdm !== '—' && cleanAdm.length > 0) {
        keys.push(`adm_${cleanAdm}`);
      }

      // 2. Board Reg No — valid ONLY if not a dummy/zero-padded entry
      if (reg && isValidRegNo(reg)) {
        keys.push(`reg_${reg}`);
      }

      // 3. Student + Father name combination (normalized)
      if (sName && sName !== 'student' && sName.length > 2) {
        const fatherPart = fName && fName !== '—' ? fName.slice(0, 8) : '';
        keys.push(`name_${sName}_${fatherPart}`);
      }

      // 4. Form Number (scoped to class + session so form numbers from old sessions don't collide!)
      if (fNo && fNo !== '—' && fNo.length > 2 && scope) {
        keys.push(`form_${scope}_${fNo.toLowerCase()}`);
      }

      return keys;
    };

    // PASS 1: Scan records to index identities, adm numbers, photo URLs, assigned roll numbers, and 11th grade subjects/stream
    const allRawDocs = [...currentAdmissions, ...masterHistoricalRecords];

    allRawDocs.forEach(rec => {
      const isHist = rec.isHistorical || rec._isHistorical || rec._isCurrentScope === false;
      const keys = getIdentityKeys(rec);
      const rawAdm = extractRawAdmNo(rec);
      const cleanedAdm = cleanAdmNoVal(rawAdm);
      const rollVal = extractClassRoll(rec);
      const photoVal = !isHist ? extractPhotoVal(rec) : '';
      const recName = getStudentName(rec);
      const recFather = getFatherName(rec);

      const recCls = normalizeClassVal(rec['Admission sought for class'] || rec['Class']);
      const recSess = normalizeSessionVal(rec['Session']);

      const rawOldAdm = cleanAdmNoVal(
        rec['Old Admission No.'] || rec['Old Adm. No.'] || rec['oldAdmNo'] || rec['Previous Adm. No.']
      );

      // Index Class 11th record for authentic stream & subject verification in 12th
      if (recCls === '11th') {
        const regKey = extractRegNoClean(rec);
        const admKey = cleanedAdm;
        const nameKey = recName && recName !== 'student' && recName !== '—' ? `${recName.toLowerCase()}_${(recFather || '').toLowerCase().slice(0, 8)}` : '';
        if (regKey && isValidRegNo(regKey) && !record11thByReg.has(regKey)) {
          record11thByReg.set(regKey, rec);
        }
        if (admKey && admKey !== '—' && !record11thByAdm.has(admKey)) {
          record11thByAdm.set(admKey, rec);
        }
        if (nameKey && !record11thByName.has(nameKey)) {
          record11thByName.set(nameKey, rec);
        }
      }

      keys.forEach(k => {
        if (!admNoSetByIdentity.has(k)) admNoSetByIdentity.set(k, new Set());
        if (cleanedAdm) admNoSetByIdentity.get(k).add(cleanedAdm);

        if (!oldAdmNoByIdentity.has(k)) oldAdmNoByIdentity.set(k, new Set());
        if (rawOldAdm) oldAdmNoByIdentity.get(k).add(rawOldAdm);

        // ─── Photo indexing: Only track active admission photos ───
        if (photoVal && !isHist) {
          const group = classPhotoGroup(recCls);
          const regKey = extractRegNoClean(rec);
          const admKey = cleanedAdm;
          if (regKey) photoByReg.set(`${group}::reg_${regKey}`, photoVal);
          if (admKey) photoByAdm.set(`${group}::adm_${admKey}`, photoVal);
        }

        if (rollVal && rollVal !== '—' && rollVal !== 'N/A') {
          // Scope assigned roll number strictly to Class + Session AND Student Name so wrong reg numbers never transfer roll numbers!
          assignedRollByIdentity.set(`${recCls}_${recSess}_${k}`, { roll: rollVal, name: recName });
        }

        if (!masterRecordByIdentity.has(k)) {
          masterRecordByIdentity.set(k, rec);
        }
      });
    });

    // ─── getResolvedPhoto: reg-first then adm, no name-based fallback ───
    const getResolvedPhoto = (st) => {
      const explicit = extractPhotoVal(st);
      if (explicit) return explicit;

      const stCls = normalizeClassVal(st['Admission sought for class'] || st['Class'] || '');
      const group = classPhotoGroup(stCls);

      const regKey = extractRegNoClean(st);
      if (regKey) {
        const byReg = photoByReg.get(`${group}::reg_${regKey}`);
        if (byReg) return byReg;
      }

      const rawAdm = extractRawAdmNo(st);
      const admKey = cleanAdmNoVal(rawAdm);
      if (admKey) {
        const byAdm = photoByAdm.get(`${group}::adm_${admKey}`);
        if (byAdm) return byAdm;
      }

      return '—';
    };

    // PASS 2: Helper to resolve final formatted Adm No for ANY record (with 9th/11th inheritance & re-admission formatting)
    const resolveAdmNo = (rec) => {
      const directFormat = formatStudentAdmNo(rec);
      if (directFormat && directFormat !== '—' && directFormat.length > 0) return directFormat;

      // Fast Path: Check pre-computed registration index (O(1) lookup)
      const directReg = extractRegNoClean(rec);
      if (directReg) {
        const indexed = lookupStudentByRegSync(directReg);
        if (indexed && indexed.admNo && indexed.admNo !== '—') {
          return cleanAdmNoVal(indexed.admNo);
        }
      }

      const recName = getStudentName(rec);
      const keys = getIdentityKeys(rec);

      const collectedAdms = new Set();
      const collectedOldAdms = new Set();

      keys.forEach(k => {
        // If key is a reg_ key, ensure candidate match name is compatible!
        if (k.startsWith('reg_')) {
          const matchRec = masterRecordByIdentity.get(k);
          if (matchRec && !areNamesCompatible(recName, getStudentName(matchRec))) {
            return; // Skip reg_ match if student names don't match!
          }
        }

        const adms = admNoSetByIdentity.get(k);
        if (adms) adms.forEach(a => collectedAdms.add(a));

        const oldAdms = oldAdmNoByIdentity.get(k);
        if (oldAdms) oldAdms.forEach(a => collectedOldAdms.add(a));
      });

      const admsList = Array.from(collectedAdms);
      const oldAdmsList = Array.from(collectedOldAdms);

      if (admsList.length === 0 && oldAdmsList.length === 0) return '—';

      const isRe =
        String(rec['readmission'] || rec['Re-admission'] || rec['isReadmission'] || '').toLowerCase() === 'yes' ||
        rec['readmission'] === true;

      const oldAdmVal = oldAdmsList[0] || (admsList.length > 1 ? admsList[0] : null);
      const newAdmVal = admsList.length > 0 ? admsList[admsList.length - 1] : oldAdmVal;

      if ((isRe || oldAdmsList.length > 0 || admsList.length > 1) && oldAdmVal && newAdmVal && oldAdmVal !== newAdmVal) {
        return `${newAdmVal} (${oldAdmVal})`;
      }

      return newAdmVal || oldAdmVal || '—';
    };

    // Helper to find rich master record for any active admission
    const resolveMasterMatch = (rec) => {
      const recName = getStudentName(rec);
      const keys = getIdentityKeys(rec);
      for (const k of keys) {
        const match = masterRecordByIdentity.get(k);
        if (match) {
          const matchName = getStudentName(match);
          if (!areNamesCompatible(matchName, recName)) {
            continue; // Skip false match with a different student name!
          }
          return match;
        }
      }
      return null;
    };

    const parseNum = (val) => {
      if (val === null || val === undefined || val === '' || val === '—' || val === 'N/A' || val === 'null' || val === 'undefined') return Infinity;
      const str = String(val).trim();
      const match = str.match(/\d+/);
      if (!match) return Infinity;
      const num = parseInt(match[0], 10);
      return isNaN(num) ? Infinity : num;
    };

    // Process active admissions (with full identity inheritance & duplicate form pruning)
    const sortedActive = [...currentAdmissions].sort((a1, a2) => {
      const hasRoll1 = !!extractClassRoll(a1);
      const hasRoll2 = !!extractClassRoll(a2);
      if (hasRoll1 && !hasRoll2) return -1;
      if (!hasRoll1 && hasRoll2) return 1;

      const num1 = parseInt(extractStudentFormNo(a1), 10) || 0;
      const num2 = parseInt(extractStudentFormNo(a2), 10) || 0;

      if (num1 > 0 && num2 > 0) return num2 - num1;

      const ts1 = getDocTimestamp(a1);
      const ts2 = getDocTimestamp(a2);
      if (num1 === 0 && num2 === 0) return ts2 - ts1;
      if (num1 === 0 && num2 > 0) return -1;
      if (num2 === 0 && num1 > 0) return 1;

      return num2 - num1;
    });

    sortedActive.forEach((a, idx) => {
      const aStatus = String(a['Status'] || a['status'] || '').trim().toLowerCase();
      if (aStatus === 'deleted' || a._deleted === true || aStatus === 'archived') return;

      const cleanFNo = extractStudentFormNo(a);
      const masterMatch = resolveMasterMatch(a);
      const mergedRec = masterMatch ? { ...masterMatch, ...a } : a;
      const finalAdmNo = resolveAdmNo(a) !== '—' ? resolveAdmNo(a) : resolveAdmNo(mergedRec);

      const regFromMaster = masterMatch ? extractRegNo(masterMatch) : '';
      const regFromActive = extractRegNo(a);
      let finalBoardRegNo = regFromActive;
      if (regFromMaster && regFromMaster !== '—') {
        if (!regFromActive || regFromActive === '—' || regFromActive.endsWith('00000000') || regFromMaster !== regFromActive) {
          finalBoardRegNo = regFromMaster;
        }
      }
      if (!finalBoardRegNo) finalBoardRegNo = '—';

      const rawSubmDate = 
        a['Online Subm. Date'] || 
        a.onlineSubmDate || 
        a.submittedAt || 
        a.submissionDate || 
        a['Submission Date'] ||
        a.createdAt || 
        a.updatedAt || 
        a.timestamp || 
        (masterMatch ? (masterMatch['Online Subm. Date'] || masterMatch.onlineSubmDate || masterMatch.submittedAt || masterMatch.createdAt) : null);
      const finalOnlineSubmDate = formatOnlineSubmDate(rawSubmDate);

      const targetClass = normalizeClassVal(a['Admission sought for class'] || a['Class'] || '11th');
      const targetSession = normalizeSessionVal(a['Session'] || '2025-26');
      const activeClassRoll = extractClassRoll(a);

      const activeRawStatus = String(a['Status'] || a['status'] || '').trim().toLowerCase();
      let activeResolvedStatus = 'Submitted';
      if (activeClassRoll && activeClassRoll !== '—' && activeClassRoll !== 'N/A') {
        activeResolvedStatus = 'Approved';
      } else if (activeRawStatus.includes('reject') || activeRawStatus.includes('rejt')) {
        activeResolvedStatus = 'Rejected';
      } else if (activeRawStatus.includes('draft') || activeRawStatus.includes('dft')) {
        activeResolvedStatus = 'Draft';
      }

      const sanitizedRecord = { ...mergedRec };
      const rawRollKeys = [
        'Class Roll No', 'Class Roll No.', 'RL. NO.', 'RL. NO',
        'Class R.No.', 'Class R.No', 'Class R. No.', 'Class R. No',
        'classRollNo', 'rollNo', 'Roll No.', 'Roll No', 'roll'
      ];
      rawRollKeys.forEach(k => {
        delete sanitizedRecord[k];
      });

      const sName = masterMatch?.["Student's Name"] || a["Student's Name (as per school records)"] || a["Student's Name"] || a['Account Name'] || 'Student';
      const fName = masterMatch?.["Father's Name"] || a["Father's/Guardian's Name (as per school records)"] || a["Father's Name"] || '—';
      const mName = masterMatch?.["Mother's Name"] || a["Mother's Name (as per school records)"] || a["Mother's Name"] || '—';
      const sDob = formatDobToDisplay(masterMatch?.["DoB (figures)"] || a["DoB (as per school records)"] || a['DoB (figures)'] || a['dob'] || '—');
      const sVillage = a['Name of your village'] || a['Village/Town'] || 'Shangus';
      const sGender = a['Gender'] || '—';
      const sCategory = a['Cat._JKBOSE'] || a['Category'] || a['Social Category'] || 'General';
      let sStream = resolveStudentStream(a, masterMatch);
      let sSubs = formatStudentSubjects(a) !== '—' ? formatStudentSubjects(a) : formatStudentSubjects(mergedRec);

      // ─── 11th vs 12th STREAM & SUBJECT VERIFICATION (MATCHED ON BOARD REG NO) ───
      let stream11th = null;
      let subs11th = null;
      const optedStream12th = sStream;
      const optedSubs12th = sSubs;
      let hasStreamMismatch = false;
      let hasSubsMismatch = false;
      let streamMismatchNotice = null;
      let subsMismatchNotice = null;
      let matched11thRec = null;

      if (targetClass === '12th') {
        const regKey = extractRegNoClean(a) || extractRegNoClean(mergedRec);
        const admKey = cleanAdmNoVal(finalAdmNo);
        const nameKey = sName && sName !== 'student' && sName !== '—' ? `${sName.toLowerCase()}_${(fName || '').toLowerCase().slice(0, 8)}` : '';

        if (regKey && isValidRegNo(regKey)) {
          matched11thRec = record11thByReg.get(regKey);
        }
        if (!matched11thRec && admKey && admKey !== '—') {
          matched11thRec = record11thByAdm.get(admKey);
        }
        if (!matched11thRec && nameKey) {
          matched11thRec = record11thByName.get(nameKey);
        }

        if (matched11thRec) {
          stream11th = resolveStudentStream(matched11thRec);
          subs11th = formatStudentSubjects(matched11thRec);

          if (stream11th && stream11th !== 'General') {
            if (sStream && sStream !== 'General' && sStream.toLowerCase() !== stream11th.toLowerCase()) {
              hasStreamMismatch = true;
              streamMismatchNotice = `⚠️ Stream Mismatch: Opted "${optedStream12th}" in 12th vs "${stream11th}" in 11th`;
              // Ground truth stream from 11th takes precedence!
              sStream = stream11th;
            }
          }

          if (subs11th && subs11th !== '—' && optedSubs12th && optedSubs12th !== '—') {
            const isMatch = areSubjectSetsMatching(subs11th, optedSubs12th);
            if (!isMatch) {
              hasSubsMismatch = true;
              subsMismatchNotice = `⚠️ Subjects Mismatch: Opted [${optedSubs12th}] in 12th vs [${subs11th}] in 11th`;
              // Ground truth subjects from 11th takes precedence!
              sSubs = subs11th;
            }
          }
        }
      }

      const sMobile = a['Mobile No. (with working WhatsApp)'] || a["Student's Contact"] || a['Account Mobile'] || '—';
      const sAadhar = a['Aadhar No.'] || a.aadhar || '—';
      const sPen = a['PEN No.'] || '—';

      const searchBlob = `${sName} ${fName} ${mName} ${cleanFNo} ${activeClassRoll} ${finalBoardRegNo} ${finalAdmNo} ${targetClass} ${targetSession} ${sStream} ${sSubs} ${optedStream12th} ${optedSubs12th} ${sMobile} ${sVillage} ${sDob} ${sPen} ${sAadhar} ${sCategory} ${hasStreamMismatch ? 'mismatch stream' : ''} ${hasSubsMismatch ? 'mismatch subjects' : ''}`.toLowerCase();

      const uniqueDocId = a.docId || a._docId || a.id || (cleanFNo && cleanFNo !== '—' ? `adm_${cleanFNo}` : `adm_${idx}`);

      combined.push({
        ...sanitizedRecord,
        _isCurrentScope: true,
        _searchBlob: searchBlob,
        _ts: getDocTimestamp(a),
        _formNum: parseNum(cleanFNo),
        _rollNum: parseNum(activeClassRoll),
        _admNum: parseNum(finalAdmNo),
        _nameLower: sName.toLowerCase(),
        _regLower: finalBoardRegNo.toLowerCase(),
        id: uniqueDocId,
        docId: uniqueDocId,
        sno: idx + 1,
        formNo: cleanFNo || '—',
        classRollNo: activeClassRoll,
        'Class Roll No': activeClassRoll,
        'Class Roll No.': activeClassRoll,
        'RL. NO.': activeClassRoll,
        'RL. NO': activeClassRoll,
        admNo: finalAdmNo,
        class: targetClass,
        session: targetSession,
        boardRegNo: finalBoardRegNo,
        studentName: sName,
        fatherName: fName,
        motherName: mName,
        dob: sDob,
        village: sVillage,
        gender: sGender,
        category: sCategory,
        status: activeResolvedStatus,
        stream: sStream,
        subs: sSubs,
        hasStreamMismatch,
        hasSubsMismatch,
        hasMismatch: hasStreamMismatch || hasSubsMismatch,
        stream11th,
        subs11th,
        optedStream12th,
        optedSubs12th,
        streamMismatchNotice,
        subsMismatchNotice,
        photoId: extractPhotoVal(a) || extractPhotoVal(mergedRec) || getStudentPhotoUrl(a) || getStudentPhotoUrl(mergedRec) || '',
        mobile: sMobile,
        aadhar: sAadhar,
        fatherAadhar: a["Father's Aadhar No."] || a["Father's Aadhaar No."] || a.fatherAadhar || '—',
        bankAccount: a['Bank Account No.'] || a['Bank Account Number'] || '—',
        bankName: a['Name of Bank'] || a['Bank Name'] || '—',
        ifsc: a['IFSC code'] || a['IFSC Code'] || '—',

        onlineSubmDate: finalOnlineSubmDate,
        admDate: a['Adm. Date'] || '—',
        boardName: a['Board Name'] || a['Board Name (Class 10th)'] || '—',
        dobWords: a['DoB (words)'] || '—',
        block: a['Block'] || '—',
        tehsil: a['Tehsil'] || '—',
        district: a['District'] || '—',
        pinCode: a['PIN code'] || a['Pin Code'] || '—',
        state: a['State/UT'] || a['State'] || '—',
        residence: a['Residence (Village, District)'] || '—',
        religion: a['Religion'] || '—',
        disabilityStatus: a['Disability Status'] || '—',
        disabilityType: a['Disability Type'] || '—',
        subjects1: a['Subjects1'] || '—',
        subjects2: a['Subjects2'] || '—',
        subjects3: a['Subjects3'] || '—',
        subjects4: a['Subjects4'] || '—',
        subjects5: a['Subjects5'] || '—',
        subjects6: a['Subject6'] || '—',
        email1: a['email1'] || a['Email'] || '—',
        email2: a['email2'] || '—',
        parentContact: a["Parent's Contact"] || a["Parent's Mobile No. (must be working)"] || a["Parent's Mobile No."] || a["Father's Mobile No."] || a["parentContact"] || '—',
        bloodType: a['Blood Type'] || a['Blood Group'] || '—',
        height: a['Height (cm)'] || a['Height'] || '—',
        weight: a['Weight (kg)'] || a['Weight'] || '—',
        socialCategory: a['Social category'] || '—',
        socioEconomicCategory: a['Socio-economic category'] || '—',
        houseNo: a['House No.'] || '—',
        vocationalPercentage: a['Vocational %age'] || '—',
        prevComplexHead: a['Previous Complex Head'] || '—',
        penNo: sPen,
        prevSchool: a['Previous School'] || a['Name of the Institution last attended'] || '—',
        prevCcDc: a['CC/DC No. & Date (Prev. insitution)'] || '—',
        prevExamMode: a['Exam Mode (Prev.)'] || '—',
        prevExamRollNo: a['Exam R.No. (Prev.)'] || a['Roll No. (Class 10th)'] || '—',
        prevMarksObt: a['Marks Obt. (Prev.)'] || a['Marks Obtained (Class 10th)'] || '—',
        prevMaxMarks: a['Max. Marks (Prev.)'] || a['Max Marks (Class 10th)'] || '—',
        prevPercentage: a['%age (Prev.)'] || a['Percentage (Class 10th)'] || '—',
        prevDivision: a['Div/Distinc (Prev.)'] || '—',
        currExamMode: a['Exam Mode (Current)'] || '—',
        currExamRollNo: a['Exam R.No. (Current)'] || '—',
        currResult: a['Result (Current)'] || '—',
        currMarksReapp: a['Marks/Reapp (Current)'] || '—',
        withdrawalDate: a['Date of withdrawl'] || '—',
        currCcDc: a['No. & Date of CC/DC Issued (This Institution)'] || '—',
        remarks: a['Remarks'] || '—',
        pdfUrl: a['PDF_URL'] || '—',
        readmission: a['readmission'] || '—',
        apaarId: a['APAAR ID'] || '—',
      });
    });

    // Build index of seen active admission keys to prevent duplicate entries when historical records are merged
    const seenActiveKeys = new Set();
    combined.forEach(c => {
      const cleanFNo = String(c.formNo || '').replace(/[^a-z0-9]/g, '').toLowerCase();
      const cleanReg = String(c.boardRegNo || '').replace(/[^a-z0-9]/g, '').toLowerCase();
      const cleanAdm = String(c.admNo || '').replace(/[^a-z0-9]/g, '').toLowerCase();
      const sName = String(c.studentName || '').toLowerCase().trim();
      const fName = String(c.fatherName || '').toLowerCase().trim();
      const cls = String(c.class || '').toLowerCase().trim();
      const sess = String(c.session || '').toLowerCase().trim();

      if (cleanFNo && cleanFNo !== '—') seenActiveKeys.add(`fno_${sess}_${cleanFNo}`);
      if (cleanReg && cleanReg.length > 5 && !cleanReg.endsWith('00000000')) seenActiveKeys.add(`reg_${cls}_${sess}_${cleanReg}`);
      if (cleanAdm && cleanAdm !== '—') seenActiveKeys.add(`adm_${cls}_${sess}_${cleanAdm}`);
      if (sName && sName !== 'student') seenActiveKeys.add(`name_${cls}_${sess}_${sName}_${fName.slice(0, 8)}`);
    });

    // Process Historical Master Registers records (for global search, historical archives & earlier sessions)
    masterHistoricalRecords.forEach((m, idx) => {
      const cleanFNo = String(m['Form Number'] || m['Form No.'] || m.formNo || '').replace(/^'/, '').replace(/^(N\/A|—)$/i, '').trim();
      const rawReg = extractRegNo(m);
      const rawRoll = extractClassRoll(m);
      const finalAdmNo = resolveAdmNo(m) || cleanAdmNoVal(m['Admission No.'] || m['Adm. No.'] || m.admNo) || '—';
      const targetClass = normalizeClassVal(m['Admission sought for class'] || m['Class'] || m.class || '11th');
      const targetSession = normalizeSessionVal(m['Session'] || m.session || '2024-25');

      const sName = m["Student's Name (as per school records)"] || m["Student's Name"] || m['Student Name'] || m['Name of Student'] || m['Account Name'] || m.studentName || m.name || 'Student';
      const fName = m["Father's/Guardian's Name (as per school records)"] || m["Father's Name"] || m['Father Name'] || m.fatherName || '—';
      const mName = m["Mother's Name (as per school records)"] || m["Mother's Name"] || m['Mother Name'] || m.motherName || '—';

      // Skip this historical record ONLY if an identical active record is already present for the SAME CLASS and SESSION!
      const checkFNo = cleanFNo.replace(/[^a-z0-9]/g, '').toLowerCase();
      const checkReg = rawReg.replace(/[^a-z0-9]/g, '').toLowerCase();
      const checkAdm = String(finalAdmNo).replace(/[^a-z0-9]/g, '').toLowerCase();
      const targetClsLower = targetClass.toLowerCase().trim();
      const targetSessLower = targetSession.toLowerCase().trim();
      const checkNameKey = `name_${targetClsLower}_${targetSessLower}_${sName.toLowerCase().trim()}_${fName.toLowerCase().trim().slice(0, 8)}`;

      if (checkFNo && checkFNo !== '—' && seenActiveKeys.has(`fno_${targetSessLower}_${checkFNo}`)) return;
      if (checkReg && checkReg.length > 5 && !checkReg.endsWith('00000000') && seenActiveKeys.has(`reg_${targetClsLower}_${targetSessLower}_${checkReg}`)) return;
      if (checkAdm && checkAdm !== '—' && seenActiveKeys.has(`adm_${targetClsLower}_${targetSessLower}_${checkAdm}`)) return;
      if (seenActiveKeys.has(checkNameKey)) return;

      const sDob = formatDobToDisplay(m["DoB (figures)"] || m["DoB (as per school records)"] || m['DoB (figures)'] || m['dob'] || '—');
      const sVillage = m['Permanent Address'] || m['Name of your village'] || m['Village/Town'] || m['Address'] || m.village || 'Shangus';
      const sGender = m['Gender'] || m.gender || '—';
      const sCategory = m['Cat._JKBOSE'] || m['Category'] || m['Social Category'] || m.category || 'General';
      let sStream = resolveStudentStream(m, null);
      let sSubs = formatStudentSubjects(m);

      // ─── 11th vs 12th STREAM & SUBJECT VERIFICATION FOR HISTORICAL RECORDS ───
      let stream11th = null;
      let subs11th = null;
      const optedStream12th = sStream;
      const optedSubs12th = sSubs;
      let hasStreamMismatch = false;
      let hasSubsMismatch = false;
      let streamMismatchNotice = null;
      let subsMismatchNotice = null;
      let matched11thRec = null;

      if (targetClass === '12th') {
        const regKey = extractRegNoClean(m);
        const admKey = cleanAdmNoVal(finalAdmNo);
        const nameKey = sName && sName !== 'student' && sName !== '—' ? `${sName.toLowerCase()}_${(fName || '').toLowerCase().slice(0, 8)}` : '';

        if (regKey && isValidRegNo(regKey)) {
          matched11thRec = record11thByReg.get(regKey);
        }
        if (!matched11thRec && admKey && admKey !== '—') {
          matched11thRec = record11thByAdm.get(admKey);
        }
        if (!matched11thRec && nameKey) {
          matched11thRec = record11thByName.get(nameKey);
        }

        if (matched11thRec) {
          stream11th = resolveStudentStream(matched11thRec);
          subs11th = formatStudentSubjects(matched11thRec);

          if (stream11th && stream11th !== 'General') {
            if (sStream && sStream !== 'General' && sStream.toLowerCase() !== stream11th.toLowerCase()) {
              hasStreamMismatch = true;
              streamMismatchNotice = `⚠️ Stream Mismatch: Opted "${optedStream12th}" in 12th vs "${stream11th}" in 11th`;
              sStream = stream11th;
            }
          }

          if (subs11th && subs11th !== '—' && optedSubs12th && optedSubs12th !== '—') {
            const isMatch = areSubjectSetsMatching(subs11th, optedSubs12th);
            if (!isMatch) {
              hasSubsMismatch = true;
              subsMismatchNotice = `⚠️ Subjects Mismatch: Opted [${optedSubs12th}] in 12th vs [${subs11th}] in 11th`;
              sSubs = subs11th;
            }
          }
        }
      }

      const sMobile = m['Mobile No. (with working WhatsApp)'] || m["Student's Contact"] || m['Account Mobile'] || m.mobile || '—';
      const sAadhar = m['Aadhar No.'] || m.aadhar || '—';
      const sPen = m['PEN No.'] || m.penNo || '—';

      const searchBlob = `${sName} ${fName} ${mName} ${cleanFNo} ${rawRoll} ${rawReg} ${finalAdmNo} ${targetClass} ${targetSession} ${sStream} ${sSubs} ${optedStream12th} ${optedSubs12th} ${sMobile} ${sVillage} ${sDob} ${sPen} ${sAadhar} ${sCategory} ${hasStreamMismatch ? 'mismatch stream' : ''} ${hasSubsMismatch ? 'mismatch subjects' : ''}`.toLowerCase();

      const uniqueHistId = m.id || `hist_${targetSession}_${targetClass}_${cleanFNo || rawReg || idx}`;

      combined.push({
        ...m,
        _isCurrentScope: false,
        _isHistorical: true,
        _source: 'masterRegisters',
        _searchBlob: searchBlob,
        _ts: getDocTimestamp(m),
        _formNum: parseNum(cleanFNo),
        _rollNum: parseNum(rawRoll),
        _admNum: parseNum(finalAdmNo),
        _nameLower: sName.toLowerCase(),
        _regLower: rawReg.toLowerCase(),
        id: uniqueHistId,
        docId: uniqueHistId,
        sno: combined.length + 1,
        formNo: cleanFNo || '—',
        classRollNo: rawRoll || '—',
        'Class Roll No': rawRoll || '—',
        'Class Roll No.': rawRoll || '—',
        'RL. NO.': rawRoll || '—',
        'RL. NO': rawRoll || '—',
        admNo: finalAdmNo,
        class: targetClass,
        session: targetSession,
        boardRegNo: rawReg || '—',
        studentName: sName,
        fatherName: fName,
        motherName: mName,
        dob: sDob,
        village: sVillage,
        gender: sGender,
        category: sCategory,
        status: m['Status'] || m.status || 'Approved',
        stream: sStream,
        subs: sSubs,
        hasStreamMismatch,
        hasSubsMismatch,
        hasMismatch: hasStreamMismatch || hasSubsMismatch,
        stream11th,
        subs11th,
        optedStream12th,
        optedSubs12th,
        streamMismatchNotice,
        subsMismatchNotice,
        photoId: extractPhotoVal(m) || '',
        mobile: sMobile,
        aadhar: sAadhar,
        penNo: sPen,
        prevSchool: m['Previous School'] || m['Name of the Institution last attended'] || '—',
        currResult: m['Result (Current)'] || m.result || '—',
        currMarksReapp: m['Marks/Reapp (Current)'] || m.marks || '—',
        withdrawalDate: m['Date of withdrawl'] || m.withdrawalDate || '—',
        apaarId: m['APAAR ID'] || '—'
      });
    });

    return combined;
  }, [currentAdmissions, masterHistoricalRecords]);

  // Dynamic Dropdown Lists extracted in a single fast pass directly from database records
  const {
    availableSessions,
    availableClasses,
    availableGenders,
    availableStreams,
    availableCategories,
    availableStatuses,
    calculatedNextAdmNo
  } = useMemo(() => {
    const sessionSet = new Set();
    const classSet = new Set();
    const genderSet = new Set();
    const streamSet = new Set();
    const categorySet = new Set();
    const statusSet = new Set();
    let maxAdmNo = 0;

    for (let i = 0; i < allStudents.length; i++) {
      const s = allStudents[i];
      if (s.session && s.session !== '—') sessionSet.add(s.session);
      if (s.class && s.class !== '—') classSet.add(s.class);
      if (s.gender && s.gender !== '—') genderSet.add(s.gender);
      if (s.stream && s.stream !== '—') streamSet.add(s.stream);
      if (s.category && s.category !== '—') categorySet.add(s.category);
      if (s.status && s.status !== '—') statusSet.add(s.status);

      if (s._admNum && s._admNum !== Infinity && s._admNum > maxAdmNo && s._admNum < 100000) {
        maxAdmNo = s._admNum;
      }
    }

    const sessList = Array.from(sessionSet);
    sessList.sort((a, b) => {
      const aIsBian = /bian|bi-annual|apr/i.test(a);
      const bIsBian = /bian|bi-annual|apr/i.test(b);
      if (aIsBian && !bIsBian) return 1;
      if (!aIsBian && bIsBian) return -1;
      return b.localeCompare(a, undefined, { numeric: true });
    });

    return {
      availableSessions: sessList,
      availableClasses: Array.from(classSet).sort(),
      availableGenders: Array.from(genderSet).sort(),
      availableStreams: Array.from(streamSet).sort(),
      availableCategories: Array.from(categorySet).sort(),
      availableStatuses: Array.from(statusSet).sort(),
      calculatedNextAdmNo: maxAdmNo > 0 ? String(maxAdmNo + 1) : '5476'
    };
  }, [allStudents]);

  // Lazy load masterRegisters on demand in a clean reactive useEffect (never inside useMemo)
  useEffect(() => {
    if ((deferredSearchTerm.trim() !== '' || (selectedSessions && selectedSessions.length > 0 && !selectedSessions.includes('__NONE__'))) && masterHistoricalRecords.length === 0) {
      getCachedCollection('masterRegisters').then(ml => {
        if (Array.isArray(ml) && ml.length > 0) {
          setMasterHistoricalRecords(flattenAndFormatMasterRegisters(ml));
        }
      }).catch(() => {});
    }
  }, [deferredSearchTerm, selectedSessions, masterHistoricalRecords.length]);

  // Target dataset: when search query is active or user explicitly chooses specific/historical sessions,
  // search across all records (active + historical); when empty default view, show active admissions for 0ms speed.
  const targetDataset = useMemo(() => {
    const activeQuery = (deferredSearchTerm || '').trim();
    if (activeQuery !== '') {
      return allStudents;
    }
    if (selectedSessions && selectedSessions.length > 0 && !selectedSessions.includes('__NONE__')) {
      const activeSessionLowerSet = new Set(selectedSessions.map(s => String(s || '').trim().toLowerCase()));
      return allStudents.filter(s => activeSessionLowerSet.has(String(s.session || '').trim().toLowerCase()));
    }
    // Default view ("All Sessions" without search query): only active admissions for 0ms instant speed
    return allStudents.filter(s => s._isCurrentScope === true);
  }, [allStudents, deferredSearchTerm, selectedSessions]);

  // ─── Pre-Parsed Google-like Intelligent Search & Relevance Engine ───
  const evaluateParsedGoogleSearch = useCallback((s, parsed) => {
    if (!parsed) return { matches: true, score: 0 };

    if (parsed.isPattern) {
      const val = parsed.patternVal.toLowerCase();
      if (parsed.patternType === 'admNo') {
        const sAdm = String(s.admNo || '').toLowerCase();
        const sRawAdm = cleanSearchAdm(s.admNo);
        if (sAdm === val || sRawAdm === cleanSearchAdm(val)) return { matches: true, score: 3500 };
        if (sAdm.includes(val)) return { matches: true, score: 2200 };
        return { matches: false, score: 0 };
      }
      if (parsed.patternType === 'boardRegNo') {
        const sReg = cleanSearchReg(s.boardRegNo);
        const targetReg = cleanSearchReg(val);
        if (sReg === targetReg) return { matches: true, score: 3500 };
        if (sReg.includes(targetReg)) return { matches: true, score: 2200 };
        return { matches: false, score: 0 };
      }
      if (parsed.patternType === 'formNo') {
        const sFNo = String(s.formNo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetFNo = val.replace(/[^a-z0-9]/g, '');
        if (sFNo === targetFNo) return { matches: true, score: 3500 };
        if (sFNo.includes(targetFNo)) return { matches: true, score: 2200 };
        return { matches: false, score: 0 };
      }
      if (parsed.patternType === 'classRollNo') {
        const sRoll = String(s.classRollNo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetRoll = val.replace(/[^a-z0-9]/g, '');
        if (sRoll === targetRoll) return { matches: true, score: 3500 };
        if (sRoll.includes(targetRoll)) return { matches: true, score: 2200 };
        return { matches: false, score: 0 };
      }
      if (parsed.patternType === 'mobile') {
        const sMob = cleanSearchMobile(s.mobile || s.parentContact);
        const targetMob = cleanSearchMobile(val);
        if (sMob === targetMob) return { matches: true, score: 3500 };
        if (sMob.includes(targetMob)) return { matches: true, score: 2200 };
        return { matches: false, score: 0 };
      }
    }

    const rawTokens = parsed.rawTokens;
    if (!rawTokens || rawTokens.length === 0) return { matches: true, score: 0 };

    const blob = `${s._searchBlob || ''} ${s.motherName || ''} ${s.parentContact || ''} ${s.fatherName || ''} ${s.village || ''} ${s.admNo || ''} ${s.boardRegNo || ''} ${s.formNo || ''} ${s.classRollNo || ''} ${s.mobile || ''}`.toLowerCase();
    let score = 0;

    for (let i = 0; i < rawTokens.length; i++) {
      const token = rawTokens[i];
      if (!blob.includes(token)) {
        return { matches: false, score: 0 };
      }

      // Fast relevance score boosting
      if (s.formNo === token || String(s._formNum) === token) score += 2500;
      else if (String(s.formNo || '').includes(token)) score += 800;

      if (String(s.admNo || '').toLowerCase() === token) score += 2200;
      else if (String(s.admNo || '').toLowerCase().includes(token)) score += 800;

      if (s.boardRegNo === token) score += 2000;
      else if (String(s.boardRegNo || '').includes(token)) score += 700;

      if (s.classRollNo === token || String(s._rollNum) === token) score += 1500;
      else if (String(s.classRollNo || '').includes(token)) score += 600;

      if (String(s.mobile || '').includes(token) || String(s.parentContact || '').includes(token)) score += 1200;

      if (s._nameLower === token) score += 1200;
      else if (s._nameLower?.startsWith(token)) score += 700;
      else if (s._nameLower?.includes(token)) score += 350;

      if (String(s.fatherName || '').toLowerCase().includes(token)) score += 400;
      if (String(s.motherName || '').toLowerCase().includes(token)) score += 400;
      if (String(s.subs || '').toLowerCase().includes(token) || String(s.stream || '').toLowerCase().includes(token)) score += 100;
      if (String(s.village || '').toLowerCase().includes(token)) score += 80;
    }

    return { matches: true, score };
  }, []);

  // Filtered & Sorted Students with Pre-Parsed Google Search Relevance
  const filteredStudents = useMemo(() => {
    const activeQuery = deferredSearchTerm.trim();
    const parsedQuery = activeQuery ? parseSearchQuery(activeQuery) : null;

    // Strict exact string matching for Sessions, Streams, Gender, Categories
    const matchesExact = (sel, val) => {
      if (!sel || sel.length === 0) return true;
      if (sel.includes('__NONE__')) return false;
      const strVal = String(val ?? '').trim().toLowerCase();
      return sel.some(item => String(item ?? '').trim().toLowerCase() === strVal);
    };

    // Class matching allowing '11th' vs 'Class 11th'
    const matchesClass = (sel, val) => {
      if (!sel || sel.length === 0) return true;
      if (sel.includes('__NONE__')) return false;
      const strVal = String(val ?? '').trim().toLowerCase();
      const cleanVal = strVal.replace(/class/gi, '').trim();

      return sel.some(item => {
        const strItem = String(item ?? '').trim().toLowerCase();
        const cleanItem = strItem.replace(/class/gi, '').trim();
        if (cleanItem === cleanVal) return true;
        const d1 = cleanItem.match(/\d+/)?.[0];
        const d2 = cleanVal.match(/\d+/)?.[0];
        return !!(d1 && d2 && d1 === d2);
      });
    };

    const matchesStatus = (sel, s) => {
      if (!sel || sel.length === 0) return true;
      if (sel.includes('__NONE__')) return false;

      const roll = String(s.classRollNo || s['Class Roll No'] || s.rollNo || '').trim();
      const hasRollNo = roll !== '' && roll !== '—' && roll !== '-' && roll !== 'N/A' && roll !== 'null' && roll !== 'undefined';
      const rawStat = String(s.status || s.Status || '').trim().toLowerCase();

      let effStatus = 'Submitted';
      if (hasRollNo) {
        effStatus = 'Approved';
      } else if (rawStat.includes('reject') || rawStat.includes('rejt')) {
        effStatus = 'Rejected';
      } else if (rawStat.includes('draft')) {
        effStatus = 'Draft';
      }

      return sel.some(item => {
        const strItem = String(item ?? '').trim().toLowerCase();
        if (strItem === 'approved') return effStatus === 'Approved';
        if (strItem === 'submitted') return effStatus === 'Submitted';
        if (strItem === 'draft') return effStatus === 'Draft';
        if (strItem === 'rejected') return effStatus === 'Rejected';
        return strItem === effStatus.toLowerCase();
      });
    };

    const scoredList = [];

    targetDataset.forEach(s => {
      const searchRes = evaluateParsedGoogleSearch(s, parsedQuery);
      if (!searchRes.matches) return;

      const matchesSessionVal = matchesExact(selectedSessions, s.session);
      const matchesClassVal = matchesClass(selectedClasses, s.class);
      const matchesGenderVal = matchesExact(selectedGenders, s.gender);
      const matchesStreamVal = matchesExact(selectedStreams, s.stream);
      const matchesCategoryVal = matchesExact(selectedCategories, s.category);
      const matchesStatusVal = matchesStatus(selectedStatuses, s);

      if (matchesSessionVal && matchesClassVal && matchesGenderVal && matchesStreamVal && matchesCategoryVal && matchesStatusVal) {
        scoredList.push({
          student: s,
          relevanceScore: searchRes.score
        });
      }
    });

    // If search query is active, sort by Google Relevance Score descending
    if (activeQuery !== '') {
      scoredList.sort((a, b) => b.relevanceScore - a.relevanceScore);
      return scoredList.map(item => item.student);
    }

    const list = scoredList.map(item => item.student);

    // ─── HIGH PERFORMANCE PRE-COMPUTED NUMERICAL & HIERARCHICAL SORTING ───
    const factor = sortOrder === 'desc' ? -1 : 1;

    list.sort((a, b) => {
      if (sortBy === 'classRollNo') {
        const clsA = String(a.class || '').toLowerCase();
        const clsB = String(b.class || '').toLowerCase();
        if (clsA !== clsB) return clsA.localeCompare(clsB) * factor;

        const sessA = String(a.session || '').toLowerCase();
        const sessB = String(b.session || '').toLowerCase();
        if (sessA !== sessB) return sessA.localeCompare(sessB) * factor;

        if (a._rollNum !== b._rollNum) return (a._rollNum - b._rollNum) * factor;
        return (a._formNum - b._formNum) * factor;
      }

      if (sortBy === 'formNo') {
        const isBlankA = !a.formNo || a.formNo === '—' || a.formNo === 'N/A';
        const isBlankB = !b.formNo || b.formNo === '—' || b.formNo === 'N/A';

        if (sortOrder === 'desc') {
          if (isBlankA && !isBlankB) return -1;
          if (!isBlankA && isBlankB) return 1;
          if (isBlankA && isBlankB) return (b._ts - a._ts);
        }

        if (a._formNum !== b._formNum) return (a._formNum - b._formNum) * factor;
        return String(a.formNo || '').localeCompare(String(b.formNo || '')) * factor;
      }

      if (sortBy === 'admNo') {
        if (a._admNum !== b._admNum) return (a._admNum - b._admNum) * factor;
        return String(a.admNo || '').localeCompare(String(b.admNo || '')) * factor;
      }

      if (sortBy === 'studentName') {
        return a._nameLower.localeCompare(b._nameLower, undefined, { sensitivity: 'base' }) * factor;
      }

      if (sortBy === 'boardRegNo') {
        return a._regLower.localeCompare(b._regLower) * factor;
      }

      if (sortBy === 'onlineSubmDate') {
        const isBlankA = !a.formNo || a.formNo === '—' || a.formNo === 'N/A';
        const isBlankB = !b.formNo || b.formNo === '—' || b.formNo === 'N/A';

        if (sortOrder === 'desc') {
          if (isBlankA && !isBlankB) return -1;
          if (!isBlankA && isBlankB) return 1;
        }

        if (a._ts !== 0 && b._ts !== 0 && a._ts !== b._ts) {
          return (a._ts - b._ts) * factor;
        }
        if (a._ts !== 0 && b._ts === 0) {
          return sortOrder === 'desc' ? -1 : 1;
        }
        if (a._ts === 0 && b._ts !== 0) {
          return sortOrder === 'desc' ? 1 : -1;
        }

        if (a._formNum !== b._formNum) return (a._formNum - b._formNum) * factor;
        return String(a.formNo || '').localeCompare(String(b.formNo || '')) * factor;
      }

      return 0;
    });

    return list;
  }, [targetDataset, deferredSearchTerm, selectedSessions, selectedClasses, selectedGenders, selectedStreams, selectedCategories, selectedStatuses, sortBy, sortOrder]);

  // Paginated Students (with 500 row safety cap if 'All' is chosen on massive datasets)
  const paginatedStudents = useMemo(() => {
    if (pageSize === 'All') {
      if (filteredStudents.length > 500) {
        return filteredStudents.slice(0, 500);
      }
      return filteredStudents;
    }
    const size = parseInt(pageSize, 10) || 50;
    const start = (currentPage - 1) * size;
    return filteredStudents.slice(start, start + size);
  }, [filteredStudents, currentPage, pageSize]);

  const selectableFilteredStudents = useMemo(
    () => filteredStudents.filter(student => student?._isCurrentScope !== false && getExactAdmissionDocId(student)),
    [filteredStudents]
  );

  const selectablePageStudents = useMemo(
    () => paginatedStudents.filter(student => student?._isCurrentScope !== false && getExactAdmissionDocId(student)),
    [paginatedStudents]
  );

  const selectedTableStudents = useMemo(() => {
    if (selectedTableDocIds.size === 0) return [];
    const activeById = new Map();
    allStudents.forEach(student => {
      if (student?._isCurrentScope === false) return;
      const exactId = getExactAdmissionDocId(student);
      if (exactId) activeById.set(exactId, student);
    });
    return Array.from(selectedTableDocIds)
      .map(id => activeById.get(id))
      .filter(Boolean);
  }, [allStudents, selectedTableDocIds]);

  const allPageRowsSelected = selectablePageStudents.length > 0 &&
    selectablePageStudents.every(student => selectedTableDocIds.has(getExactAdmissionDocId(student)));
  const somePageRowsSelected = selectablePageStudents.some(student =>
    selectedTableDocIds.has(getExactAdmissionDocId(student))
  );
  const selectedIncludesAssignedRoll = selectedTableStudents.some(student => Boolean(getStudentRollVal(student)));

  useEffect(() => {
    const validIds = new Set(
      allStudents
        .filter(student => student?._isCurrentScope !== false)
        .map(getExactAdmissionDocId)
        .filter(Boolean)
    );
    setSelectedTableDocIds(previous => {
      const next = new Set(Array.from(previous).filter(id => validIds.has(id)));
      if (next.size === previous.size && Array.from(next).every(id => previous.has(id))) return previous;
      return next;
    });
  }, [allStudents]);

  const toggleTableStudent = useCallback((student) => {
    if (student?._isCurrentScope === false) return;
    const exactId = getExactAdmissionDocId(student);
    if (!exactId) return;
    setSelectedTableDocIds(previous => {
      const next = new Set(previous);
      if (next.has(exactId)) next.delete(exactId);
      else next.add(exactId);
      return next;
    });
  }, []);

  const toggleCurrentPageSelection = useCallback(() => {
    setSelectedTableDocIds(previous => {
      const next = new Set(previous);
      const pageIds = selectablePageStudents.map(getExactAdmissionDocId);
      const shouldClear = pageIds.length > 0 && pageIds.every(id => next.has(id));
      pageIds.forEach(id => {
        if (shouldClear) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }, [selectablePageStudents]);

  const selectAllFilteredApplications = useCallback(() => {
    setSelectedTableDocIds(previous => {
      const next = new Set(previous);
      selectableFilteredStudents.forEach(student => next.add(getExactAdmissionDocId(student)));
      return next;
    });
  }, [selectableFilteredStudents]);

  const runSelectedMutation = useCallback(async (operation) => {
    const selected = selectedTableStudents;
    for (let offset = 0; offset < selected.length; offset += 10) {
      const group = selected.slice(offset, offset + 10);
      await Promise.all(group.map(operation));
    }
  }, [selectedTableStudents]);

  const confirmBulkUnlock = useCallback(() => {
    if (selectedTableStudents.length === 0) return;
    setConfirmModalConfig({
      isOpen: true,
      type: 'warning',
      title: `Unlock ${selectedTableStudents.length} Applications`,
      message: 'Allow the selected students to edit their applications for the next 24 hours?',
      consequence: 'Only the exact selected Firestore documents will be updated. No linked or similarly named application will be changed.',
      confirmText: 'Unlock Selected for 24 Hours',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        try {
          setBulkTableActionBusy(true);
          const until = Date.now() + (24 * 60 * 60 * 1000);
          await runSelectedMutation(student => updateExactAdmissionDocument(student, {
            editUnlocked: true,
            editUnlockedUntil: until,
            updatedAt: new Date().toISOString(),
            lastEditedBy: `Admin (${user?.email || 'System'})`
          }));
          await logAdminActivity({
            actionType: 'bulk_unlock',
            actionTitle: 'Bulk Application Edit Unlock',
            details: `Unlocked ${selectedTableStudents.length} exact application record(s) for 24 hours.`,
            reasonCategory,
            customReason,
            metadata: { documentIds: selectedTableStudents.map(getExactAdmissionDocId), hours: 24 }
          });
          setToast({ type: 'success', message: `${selectedTableStudents.length} applications unlocked for 24 hours.` });
          setConfirmModalConfig(null);
        } catch (error) {
          setToast({ type: 'error', message: `Bulk unlock failed: ${error.message}` });
        } finally {
          setBulkTableActionBusy(false);
        }
      }
    });
  }, [runSelectedMutation, selectedTableStudents, user?.email]);

  const confirmBulkStatusChange = useCallback(() => {
    if (selectedTableStudents.length === 0) return;
    const nextStatus = bulkTableStatus;
    setConfirmModalConfig({
      isOpen: true,
      type: nextStatus === 'Rejected' || nextStatus === 'Withdrawn' ? 'danger' : 'warning',
      title: `Set ${selectedTableStudents.length} Applications to ${nextStatus}`,
      message: `Change the workflow status of every selected application to “${nextStatus}”?`,
      consequence: nextStatus === 'Approved'
        ? 'Approval is intentionally unavailable here because each student needs a unique class roll number.'
        : 'The operation uses exact Firestore document IDs and records one auditable bulk activity entry.',
      confirmText: `Apply ${nextStatus} Status`,
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        try {
          setBulkTableActionBusy(true);
          const payload = {
            Status: nextStatus,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
            lastEditedBy: `Admin (${user?.email || 'System'})`
          };
          if (nextStatus === 'Rejected') payload.rejectionReason = customReason || reasonCategory;
          await runSelectedMutation(student => updateExactAdmissionDocument(student, { ...payload }));
          const selectedIds = new Set(selectedTableStudents.map(getExactAdmissionDocId));
          setCurrentAdmissions(previous => previous.map(student =>
            selectedIds.has(getExactAdmissionDocId(student)) ? { ...student, ...payload } : student
          ));
          await logAdminActivity({
            actionType: 'bulk_status_update',
            actionTitle: `Bulk Status Updated to ${nextStatus}`,
            details: `Updated ${selectedTableStudents.length} exact application record(s).`,
            reasonCategory,
            customReason,
            metadata: { documentIds: Array.from(selectedIds), status: nextStatus }
          });
          setToast({ type: 'success', message: `${selectedTableStudents.length} applications set to ${nextStatus}.` });
          setConfirmModalConfig(null);
        } catch (error) {
          setToast({ type: 'error', message: `Bulk status update failed: ${error.message}` });
        } finally {
          setBulkTableActionBusy(false);
        }
      }
    });
  }, [bulkTableStatus, runSelectedMutation, selectedTableStudents, user?.email]);

  const confirmBulkDelete = useCallback(() => {
    if (selectedTableStudents.length === 0) return;
    setConfirmModalConfig({
      isOpen: true,
      type: 'danger',
      title: `Archive ${selectedTableStudents.length} Applications`,
      message: 'Move only the selected active applications to the 90-day Recycle Bin?',
      consequence: 'Each exact Firestore document is archived and deleted independently. Master-register records and other applications with matching student details are not touched.',
      confirmText: 'Archive Selected Applications',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        try {
          setBulkTableActionBusy(true);
          const records = [...selectedTableStudents];
          await runSelectedMutation(student => moveToRecycleBin(student, 'admissions', user?.email || 'Admin'));
          records.forEach(handleRecordDeleted);
          await logAdminActivity({
            actionType: 'bulk_delete',
            actionTitle: 'Bulk Applications Archived',
            details: `Moved ${records.length} exact application record(s) to the 90-day Recycle Bin.`,
            reasonCategory,
            customReason,
            metadata: { documentIds: records.map(getExactAdmissionDocId), count: records.length }
          });
          // The administrator just performed and confirmed this archive, so
          // these new items are already seen. Keep the bin's Archived total,
          // but clear the separate unread-notification badge immediately.
          handleMarkRecycleBinSeen();
          setSelectedTableDocIds(new Set());
          setToast({ type: 'success', message: `${records.length} applications moved to the Recycle Bin.` });
          setConfirmModalConfig(null);
        } catch (error) {
          setToast({ type: 'error', message: `Bulk archive failed: ${error.message}` });
        } finally {
          setBulkTableActionBusy(false);
        }
      }
    });
  }, [handleMarkRecycleBinSeen, handleRecordDeleted, runSelectedMutation, selectedTableStudents, user?.email]);

  const totalPages = pageSize === 'All' ? 1 : Math.ceil(filteredStudents.length / (parseInt(pageSize, 10) || 50));

  // Candidates for the Bulk Class, Session & Stream Tool (with fast preview by session, class, or keyword search)
  const bulkCandidateStudents = useMemo(() => {
    let pool = [];
    if (bulkPreviewSession === 'CURRENT_FILTER') {
      pool = filteredStudents;
    } else if (bulkPreviewSession === 'ALL') {
      pool = allStudents;
    } else {
      const matchSess = String(bulkPreviewSession).trim().toLowerCase();
      pool = allStudents.filter(s => String(s.session || '').trim().toLowerCase() === matchSess);
    }

    if (bulkPreviewClass !== 'ALL') {
      const matchCls = String(bulkPreviewClass).trim().toLowerCase();
      pool = pool.filter(s => String(s.class || '').trim().toLowerCase() === matchCls);
    }

    if (bulkPreviewSearch && bulkPreviewSearch.trim()) {
      const q = bulkPreviewSearch.trim().toLowerCase();
      pool = pool.filter(s => {
        const name = String(s.studentName || '').toLowerCase();
        const father = String(s.fatherName || '').toLowerCase();
        const fNo = String(s.formNo || '').toLowerCase();
        const roll = String(s.classRollNo || '').toLowerCase();
        const adm = String(s.admNo || '').toLowerCase();
        const reg = String(s.boardRegNo || '').toLowerCase();
        return name.includes(q) || father.includes(q) || fNo.includes(q) || roll.includes(q) || adm.includes(q) || reg.includes(q);
      });
    }

    return pool;
  }, [bulkPreviewSession, bulkPreviewClass, bulkPreviewSearch, filteredStudents, allStudents]);

  // Synchronize selection checkboxes whenever bulk candidate pool changes
  useEffect(() => {
    if (showToolsModal && activeToolsTab === 'db_editor') {
      if (bulkCandidateStudents && bulkCandidateStudents.length > 0) {
        setSelectedBulkFormIds(new Set(bulkCandidateStudents.map(s => s.id || s.formNo || s['Form Number'])));
      } else {
        setSelectedBulkFormIds(new Set());
      }
    }
  }, [showToolsModal, activeToolsTab, bulkCandidateStudents]);

  const toggleBulkStudent = (id) => {
    setSelectedBulkFormIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllBulk = () => {
    setSelectedBulkFormIds(new Set(bulkCandidateStudents.map(s => s.id || s.formNo || s['Form Number'])));
  };

  const handleDeselectAllBulk = () => {
    setSelectedBulkFormIds(new Set());
  };

  const handleInvertBulk = () => {
    setSelectedBulkFormIds(prev => {
      const next = new Set();
      bulkCandidateStudents.forEach(s => {
        const id = s.id || s.formNo || s['Form Number'];
        if (!prev.has(id)) next.add(id);
      });
      return next;
    });
  };

  const handleSaveIndividualStudent = async (student, individualUpdates) => {
    setQuickEditSaving(true);
    try {
      const payload = {
        ...individualUpdates,
        updatedAt: new Date().toISOString(),
        lastEditedBy: `Admin (${user?.email || 'Individual Quick Editor'})`
      };

      await updateStudentDocument(student, payload);

      setCurrentAdmissions(prev => prev.map(s => {
        if ((s.id && s.id === student.id) || (s.formNo && s.formNo === student.formNo)) {
          return { ...s, ...payload };
        }
        return s;
      }));

      invalidateCache('admissions');
      invalidateCache('masterRegisters');

      await logAdminActivity({
        actionType: 'individual_edit',
        actionTitle: `Updated Application #${student.formNo || student.id}`,
        details: `Updated fields for ${student.studentName || 'Student'}: ${Object.keys(individualUpdates).map(k => `${k}="${individualUpdates[k]}"`).join(', ')}`,
        reasonCategory: 'Administrative Record Correction',
        customReason: 'Direct update via Tools Modal Quick Editor',
        metadata: { studentId: student.id, formNo: student.formNo, updates: individualUpdates }
      });

      setToast({
        type: 'success',
        message: `✅ Updated application for ${student.studentName || `Form #${student.formNo}`}!`
      });
      setTimeout(() => setToast(null), 3000);
      setQuickEditStudent(null);
    } catch (err) {
      console.error('Save individual student error:', err);
      setToast({
        type: 'error',
        message: `Failed to update student: ${err.message || 'Database error'}`
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setQuickEditSaving(false);
    }
  };

  // Column Presets
  const applyPreset = (preset) => {
    const allOff = {};
    COLUMN_DEFS.forEach(c => { allOff[c.key] = false; });

    if (preset === 'fit') {
      const fitKeys = ['sno', 'formNo', 'status', 'classRollNo', 'admNo', 'class', 'session', 'boardRegNo', 'photoId', 'studentName', 'fatherName', 'dob', 'village', 'gender', 'stream', 'mobile'];
      setDensity('fit');
      const next = { ...allOff };
      fitKeys.forEach(k => { next[k] = true; });
      setVisibleCols(next);
    } else if (preset === 'essential') {
      const essentialKeys = ['sno', 'formNo', 'status', 'classRollNo', 'admNo', 'class', 'boardRegNo', 'photoId', 'studentName', 'fatherName', 'gender', 'stream', 'mobile'];
      setDensity('compact');
      const next = { ...allOff };
      essentialKeys.forEach(k => { next[k] = true; });
      setVisibleCols(next);
    } else if (preset === 'all') {
      setDensity('compact');
      const next = {};
      COLUMN_DEFS.forEach(c => { next[c.key] = true; });
      setVisibleCols(next);
    }
  };

  // Custom Layout Presets State & Dynamic Management
  const [customPresets, setCustomPresets] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_custom_layout_presets_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const handleSaveCustomPreset = () => {
    const name = window.prompt('Enter a title for your custom column layout preset (e.g. "Examination View", "Fee List"):');
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const newPreset = { name: cleanName, cols: { ...visibleCols } };
    const updated = [...customPresets.filter(p => p.name !== cleanName), newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem('hss_custom_layout_presets_v1', JSON.stringify(updated));
    } catch (_) { }
    setToast({ message: `✨ Custom layout preset "${cleanName}" saved!`, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const applyCustomPreset = (preset) => {
    if (!preset || !preset.cols) return;
    setVisibleCols({ ...preset.cols });
    try {
      localStorage.setItem('hss_admin_table_cols_v1', JSON.stringify(preset.cols));
    } catch (_) { }
    setToast({ message: `📋 Applied layout preset: "${preset.name}"`, type: 'info' });
    setTimeout(() => setToast(null), 2500);
  };

  const deleteCustomPreset = (name) => {
    const updated = customPresets.filter(p => p.name !== name);
    setCustomPresets(updated);
    try {
      localStorage.setItem('hss_custom_layout_presets_v1', JSON.stringify(updated));
    } catch (_) { }
  };

  // Toggle Column Visibility & persist as default
  const toggleCol = (colKey) => {
    setVisibleCols(prev => {
      const updated = { ...prev, [colKey]: !prev[colKey] };
      try {
        localStorage.setItem('hss_admin_table_cols_v1', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  };

  // Sync assignStartId with calculatedNextAdmNo when tool opens or data changes
  useEffect(() => {
    if (calculatedNextAdmNo && (!assignStartId || assignStartId === '5476')) {
      setAssignStartId(calculatedNextAdmNo);
    }
  }, [calculatedNextAdmNo]);

  // Helper to find previous admission numbers linked by Board Reg No
  const getPreviousAdmNoForStudent = useCallback((st) => {
    const regKey = extractRegNoClean(st);
    if (!regKey) return null;

    const indexed = lookupStudentByRegSync(regKey);
    if (indexed && indexed.admNo && indexed.admNo !== '—') {
      return {
        admNo: cleanAdmNoVal(indexed.admNo),
        class: indexed.class || 'Previous',
        session: indexed.session || ''
      };
    }
    return null;
  }, []);

  // Candidate students matching session filter, class scope & missing filter across all database records
  const candidateAssignStudents = useMemo(() => {
    return allStudents.filter(st => {
      // 1. Session Filter
      if (assignSessionFilter !== 'all') {
        const stSess = String(st.session || st['Session'] || st['Academic Session'] || '').trim();
        if (stSess && stSess !== assignSessionFilter) return false;
      }

      // 2. Class Scope Filter
      const stCls = normalizeClassVal(st.class || st['Admission sought for class'] || st['Class']);
      if (assignClasses.length > 0 && !assignClasses.includes(stCls)) return false;

      // 3. Only Missing Adm No Filter
      if (onlyMissingAdmNo) {
        const currentAdm = resolveAdmNo(st) || cleanAdmNoVal(st.admNo || st['Adm. No.']);
        if (currentAdm && currentAdm !== '—' && currentAdm !== 'N/A') return false;
      }
      return true;
    });
  }, [allStudents, assignSessionFilter, assignClasses, onlyMissingAdmNo]);

  // Live preview list with sequential proposed IDs & per-student strategy
  const candidatePreviewList = useMemo(() => {
    let seqCounter = parseInt(assignStartId, 10) || 5476;
    return candidateAssignStudents.map(st => {
      const prevInfo = getPreviousAdmNoForStudent(st);
      const currentAdm = resolveAdmNo(st) || cleanAdmNoVal(st.admNo || st['Adm. No.']);
      const userStrat = assignStrategies[st.id];

      // Default strategy: if previous adm no exists via Reg No -> inherit_prev, else assign_new
      const strat = userStrat || (prevInfo ? 'inherit_prev' : 'assign_new');

      let proposed = '—';
      if (strat === 'assign_new') {
        proposed = String(seqCounter);
        seqCounter++;
      } else if (strat === 'inherit_prev' && prevInfo) {
        proposed = prevInfo.admNo;
      } else if (strat === 'custom') {
        proposed = customIds[st.id] || '';
      } else if (strat === 'skip') {
        proposed = currentAdm || '—';
      }

      return {
        student: st,
        currentAdm,
        prevInfo,
        strat,
        proposed
      };
    });
  }, [candidateAssignStudents, assignStartId, assignStrategies, customIds, getPreviousAdmNoForStudent]);

  // Execute Assign IDs on candidate preview list
  // Fast Parallel Atomic Firestore Assign IDs Execution
  const handleRunAssignIds = async () => {
    if (candidatePreviewList.length === 0) {
      setToast({ message: '⚠️ No eligible students selected for assignment.', type: 'error' });
      return;
    }

    setAssigningIds(true);
    let assignedCount = 0;
    let inheritedCount = 0;
    let customCount = 0;

    try {
      // 1. Prepare batch operation for fast atomic Firestore execution
      const batch = writeBatch(db);
      const todayDate = new Date().toISOString().split('T')[0];

      for (const item of candidatePreviewList) {
        const { student, proposed, strat } = item;
        if (!proposed || proposed === '—' || strat === 'skip') continue;

        const cleanFNo = cleanFormNo(student.formNo || student['Form Number'] || student['FormNo']);
        const docId = cleanFNo ? `form_${cleanFNo}` : String(student.id || '').replace(/^(active_|hist_)/, '');

        const payload = {
          'Adm. No.': proposed,
          'admNo': proposed,
          'Adm. Date': student.admDate && student.admDate !== '—' ? student.admDate : todayDate,
          updatedAt: new Date().toISOString(),
          lastEditedBy: 'Admin (Assign IDs Tool)'
        };

        // Write directly to admissions collection in Firestore (Fast & Reliable)
        const docRef = doc(db, 'admissions', docId);
        batch.set(docRef, payload, { merge: true });

        if (strat === 'assign_new') assignedCount++;
        else if (strat === 'inherit_prev') inheritedCount++;
        else if (strat === 'custom') customCount++;
      }

      // 2. Commit batch atomically to Cloud Firestore in 1 single ultra-fast network call
      await batch.commit();

      setToast({
        message: `⚡ High-Speed Database Update Complete! Assigned IDs to ${assignedCount + inheritedCount + customCount} students.`,
        type: 'success'
      });

      // Clear session cache & trigger instant reload
      try { sessionStorage.removeItem('hss_reports_cache_v5'); } catch (_) { }
      loadReportsData(true);
    } catch (err) {
      console.error('Assign IDs batch error:', err);
      setToast({ message: `❌ Error assigning IDs: ${err.message}`, type: 'error' });
    } finally {
      setAssigningIds(false);
    }
  };

  // Run Assign Dates
  const handleRunAssignDates = async () => {
    setToolExecuting(true);
    try {
      alert(`Bulk assigned ${assignDateField === 'admDate' ? 'Admission Date' : 'Online Submission Date'} (${assignDateValue}) to ${filteredStudents.length} selected student records!`);
    } finally {
      setToolExecuting(false);
    }
  };

  // Run Batch Edit
  const handleRunBatchEdit = async () => {
    const targetList = bulkCandidateStudents.filter(s => selectedBulkFormIds.has(s.id || s.formNo || s['Form Number']));

    if (!targetList || targetList.length === 0) {
      setToast({
        type: 'error',
        message: 'No student records selected for bulk update. Please check at least one student.'
      });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    const updates = {
      updatedAt: new Date().toISOString(),
      lastEditedBy: `Admin (${user?.email || 'Bulk Updater'})`
    };

    if (batchEditField === 'class_session') {
      const appliedSession = bulkNewSession === 'CUSTOM' ? bulkCustomSession.trim() : (bulkNewSession !== 'KEEP' ? bulkNewSession : '');

      if (bulkNewClass && bulkNewClass !== 'KEEP') {
        updates.class = bulkNewClass;
        updates['Class'] = bulkNewClass;
        updates['Admission sought for class'] = bulkNewClass;
      }

      if (appliedSession) {
        updates.session = appliedSession;
        updates['Session'] = appliedSession;
        updates['Academic Session'] = appliedSession;
      }

      if (bulkNewStream && bulkNewStream !== 'KEEP') {
        updates.stream = bulkNewStream;
        updates['Stream'] = bulkNewStream;
      }

      if (bulkNewStatus && bulkNewStatus !== 'KEEP') {
        updates.status = bulkNewStatus;
        updates['Status'] = bulkNewStatus;
      }
    } else {
      if (!batchEditValue) {
        setToast({
          type: 'error',
          message: 'Please enter a new field value.'
        });
        setTimeout(() => setToast(null), 4000);
        return;
      }
      updates[batchEditField] = batchEditValue;
      if (batchEditField === 'status') updates['Status'] = batchEditValue;
      if (batchEditField === 'class') {
        updates['Class'] = batchEditValue;
        updates['Admission sought for class'] = batchEditValue;
      }
      if (batchEditField === 'session') {
        updates['Session'] = batchEditValue;
        updates['Academic Session'] = batchEditValue;
      }
      if (batchEditField === 'stream') updates['Stream'] = batchEditValue;
      if (batchEditField === 'category') updates['Cat._JKBOSE'] = batchEditValue;
    }

    const changeKeys = Object.keys(updates).filter(k => k !== 'updatedAt' && k !== 'lastEditedBy');
    if (changeKeys.length === 0) {
      setToast({
        type: 'error',
        message: 'Please choose at least one field to change (e.g. New Class or New Session).'
      });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    const summaryItems = changeKeys.map(k => `${k}: "${updates[k]}"`).join(' • ');

    setConfirmModalConfig({
      isOpen: true,
      type: 'warning',
      title: `Confirm Bulk Update for ${targetList.length} Students`,
      message: `You are about to batch update ${targetList.length} student records in the school registers.`,
      consequence: `Field updates: ${summaryItems}. This will commit directly to Cloud Firestore.`,
      confirmText: `🚀 Apply Updates to ${targetList.length} Students`,
      cancelText: 'Cancel',
      showReasonInput: true,
      onConfirm: async ({ reasonCategory, customReason }) => {
        setConfirmModalConfig(null);
        setToolExecuting(true);
        setBulkProgress({
          active: true,
          current: 0,
          total: targetList.length,
          percent: 0,
          studentName: targetList[0]?.studentName || ''
        });

        try {
          let count = 0;
          for (let i = 0; i < targetList.length; i++) {
            const st = targetList[i];
            const currentName = st.studentName || st["Student's Name (as per school records)"] || `Form #${st.formNo}`;
            setBulkProgress({
              active: true,
              current: i + 1,
              total: targetList.length,
              percent: Math.round(((i + 1) / targetList.length) * 100),
              studentName: currentName
            });

            await updateStudentDocument(st, updates);
            count++;
            if (targetList.length > 10) {
              await new Promise(r => setTimeout(r, 15));
            }
          }

          // Update in-memory currentAdmissions list in place
          setCurrentAdmissions(prev => prev.map(s => {
            const isMatched = targetList.some(t => (t.id && t.id === s.id) || (t.formNo && t.formNo === s.formNo));
            return isMatched ? { ...s, ...updates } : s;
          }));

          invalidateCache('admissions');
          invalidateCache('masterRegisters');

          await logAdminActivity({
            actionType: 'bulk_edit',
            actionTitle: 'Bulk Class & Session Update',
            details: `Bulk updated ${count} student records with fields: ${changeKeys.map(k => `${k}="${updates[k]}"`).join(', ')}`,
            reasonCategory: reasonCategory || 'Bulk Ingestion & Correction',
            customReason: customReason || '',
            metadata: { count, updates }
          });

          setToast({
            type: 'success',
            message: `🎉 Successfully updated ${count} students to Class "${updates.class || 'Current'}" and Session "${updates.session || 'Current'}"!`
          });
          setTimeout(() => setToast(null), 5000);

          setShowToolsModal(false);
        } catch (err) {
          console.error('Bulk update error:', err);
          setToast({
            type: 'error',
            message: `Bulk update failed: ${err.message || 'Unknown database error'}`
          });
          setTimeout(() => setToast(null), 5000);
        } finally {
          setToolExecuting(false);
          setBulkProgress({ active: false, current: 0, total: 0, percent: 0, studentName: '' });
        }
      }
    });
  };

  // Export Official Admission Register
  const handleExportAdmRegister = () => {
    handleExportCSV();
  };

  // Export Sentup List
  const handleExportSentup = () => {
    handleExportCSV();
  };

  // Export Filtered Table to CSV/Excel
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;
    const headers = ['S.No.', 'Roll No.', 'Adm. No.', 'Form No.', 'Class', 'Session', 'Board Reg. No.', "Student's Name", "Father's Name", "Mother's Name", 'Aadhaar No.', "Father's Aadhaar", 'PEN No.', 'DoB', 'Village/Town', 'Gender', 'Category', 'Stream', 'Subjects', 'Mobile (S)', 'Mobile (P)'];

    const cleanVal = (val) => {
      if (!val || val === '—' || val === 'N/A' || val === 'undefined' || val === 'null' || val === '-') return '';
      return String(val).trim();
    };

    const rows = filteredStudents.map(s => [
      s.sno,
      `"${cleanVal(s.classRollNo)}"`,
      `"${cleanVal(s.admNo)}"`,
      `"${cleanVal(s.formNo)}"`,
      `"${cleanVal(s.class)}"`,
      `"${cleanVal(s.session)}"`,
      `"${cleanVal(s.boardRegNo)}"`,
      `"${cleanVal(s.studentName)}"`,
      `"${cleanVal(s.fatherName)}"`,
      `"${cleanVal(s.motherName)}"`,
      `"${cleanVal(s.aadhar)}"`,
      `"${cleanVal(s.fatherAadhar)}"`,
      `"${cleanVal(s.penNo)}"`,
      `"${cleanVal(s.dob)}"`,
      `"${cleanVal(s.village)}"`,
      `"${cleanVal(s.gender)}"`,
      `"${cleanVal(s.category)}"`,
      `"${cleanVal(s.stream)}"`,
      `"${cleanVal(s.subs)}"`,
      `"${cleanVal(s.mobile)}"`,
      `"${cleanVal(s.parentContact)}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HSS_Shangus_Master_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dedicated Print Register Generator with full data rendering
  const handlePrintRegister = () => {
    if (filteredStudents.length === 0) {
      alert('No student records found to print.');
      return;
    }

    const visibleColsList = orderedVisibleColumns;
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popup windows in your browser to print the official report.');
      return;
    }

    const title = 'Govt. Higher Secondary School Shangus';
    const subTitle = `OFFICIAL STUDENT ADMISSION & ENROLLMENT REGISTER (Total: ${filteredStudents.length} Records)`;

    const tableHeaders = visibleColsList.map(col => `<th style="border:1px solid #cbd5e1; padding:6px 8px; font-size:10px; background:#f1f5f9; text-transform:uppercase; font-weight:800; color:#0f172a;">${col.label}</th>`).join('');

    const tableRows = filteredStudents.map((s, idx) => {
      const cells = visibleColsList.map(col => {
        let val = s[col.key] ?? '—';
        if (col.key === 'photoId') {
          val = (val && typeof val === 'string' && val.startsWith('data:'))
            ? `<img src="${val}" style="width:28px; height:34px; object-fit:cover; border-radius:4px; border:1px solid #94a3b8;" />`
            : '—';
        }
        return `<td style="border:1px solid #e2e8f0; padding:5px 8px; font-size:10px; text-align:left; color:#0f172a; font-weight:600;">${val}</td>`;
      }).join('');
      return `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">${cells}</tr>`;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - Official Register</title>
          <style>
            @page { margin: 10mm; }
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 10px; background: #ffffff; }
            .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { font-size: 16px; margin: 0; color: #0f766e; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
            .header h2 { font-size: 11px; margin: 4px 0 0 0; color: #334155; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; color: #334155; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <h2>${subTitle}</h2>
          </div>
          <table>
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div class="footer">
            <span>Generated on: ${new Date().toLocaleString()}</span>
            <span>Admission Incharge Signature: _______________________</span>
            <span>Principal Signature: _______________________</span>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // ─── Photo Manager Handlers ───
  const handlePhotoBatchSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotoBatchFiles(files);

    const matches = files.map(file => {
      const parsed = parsePhotoFilename(file.name);
      let matchedStudent = null;

      // 1. Match by Board Registration Number or Form Number
      if (parsed.regNoOrFormNo) {
        const target = parsed.regNoOrFormNo.trim();
        matchedStudent = allStudents.find(s => {
          const sReg = String(s.boardRegNo || s['Board Registration Number'] || s.regNo || '').replace(/[\s-]/g, '');
          const sForm = String(s.formNo || s['Form Number'] || '').trim();
          const sId = String(s.id || '').trim();
          return sReg === target || sForm === target || sId === target;
        });
      }

      // 2. Match by Admission Number (e.g. 4347, adm_4347)
      if (!matchedStudent && parsed.admNo) {
        const targetAdm = String(parsed.admNo).trim();
        matchedStudent = allStudents.find(s => {
          const sAdm = String(s.admNo || s['Adm. No.'] || s['Admission No.'] || '').replace(/\D/g, '');
          return sAdm === targetAdm;
        });
      }

      // 3. Match by Normalized Student Name
      if (!matchedStudent && parsed.studentName) {
        const q = parsed.studentName.toLowerCase().replace(/[\s_.-]/g, '');
        if (q.length >= 3) {
          matchedStudent = allStudents.find(s => {
            const sName = String(s.studentName || s["Student's Name (as per school records)"] || s.name || '').toLowerCase().replace(/[\s_.-]/g, '');
            return sName === q || sName.includes(q) || q.includes(sName);
          });
        }
      }

      return {
        file,
        parsed,
        matchedStudent
      };
    });

    setPhotoMatchResults(matches);
  };

  const handleRunBatchPhotoSync = async () => {
    const matchedItems = photoMatchResults.filter(m => m.matchedStudent);
    if (!matchedItems.length) {
      alert('No matched student records found in the selected files.');
      return;
    }

    if (!window.confirm(`Sync & compress photos for ${matchedItems.length} matched student records in School Database?`)) return;

    setBatchSyncingPhotos(true);
    let successCount = 0;

    try {
      for (const item of matchedItems) {
        const compressed = await compressImageFile(item.file, 300, 360, 0.8);
        const s = item.matchedStudent;

        // 1. Sync to central studentPhotos collection
        await syncStudentPhotoOnRegUpdate({
          student: s,
          photoData: compressed
        });

        // 2. Update student doc in admissions or masterRegisters
        const docId = s._docId || s.docId || s.id;
        if (docId) {
          try {
            const colName = s._isHistorical || s._isMasterRegister ? 'masterRegisters' : 'admissions';
            const docRef = doc(db, colName, String(docId));
            await setDoc(docRef, {
              photo_id: compressed,
              'Student Photo': deleteField(),
              photoUrl: deleteField(),
              photoId: deleteField(),
              photo: deleteField(),
              studentPhoto: deleteField(),
              studentPhotoUrl: deleteField(),
              passport_photo: deleteField(),
              'photo_synced_at': new Date().toISOString()
            }, { merge: true });
          } catch (e) {
            console.warn('Firestore update note:', e);
          }
        }

        successCount++;
      }

      alert(`Successfully compressed & synced ${successCount} student photos to Firebase School Database!`);
      loadReportsData();
      setPhotoBatchFiles([]);
      setPhotoMatchResults([]);
    } catch (err) {
      console.error('Batch photo sync error:', err);
      alert('Error during batch photo sync.');
    } finally {
      setBatchSyncingPhotos(false);
    }
  };

  const handleRunPhotoReconciliation = async () => {
    if (!allStudents || allStudents.length === 0) {
      alert('No student records loaded to reconcile.');
      return;
    }

    if (!window.confirm(`Run Photo Database Reconciliation for all ${allStudents.length} student records?\n\nThis will:\n1. Match records against processed studentPhotos in Firebase\n2. Overwrite stale raw uploads with official passport photos\n3. Purge deprecated Google Drive URLs & redundant fields\n4. Synchronize 100% to Cloud Firestore`)) return;

    setReconcilingPhotos(true);
    setReconcileProgress({ active: true, current: 0, total: allStudents.length, percent: 0, stats: null });

    try {
      const stats = await reconcileAllStudentPhotosInDatabase({
        students: allStudents,
        onProgress: ({ current, total, percentage, stats }) => {
          setReconcileProgress({
            active: true,
            current,
            total,
            percent: percentage,
            stats
          });
        }
      });

      alert(`✅ Photo Database Reconciliation Completed Successfully!\n\n• Total Scanned: ${stats.totalScanned}\n• Processed Photos Matched: ${stats.matchedCount}\n• Records Updated in Firestore: ${stats.updatedCount}\n• Already Clean: ${stats.alreadyCleanCount}\n• No Photos Found: ${stats.noPhotoCount}`);
      
      logAdminActivity('Photo Database Reconciled', `Reconciled ${stats.totalScanned} student records. Updated ${stats.updatedCount} records to official passport photos from studentPhotos.`);
      
      loadReportsData();
    } catch (err) {
      console.error('Photo reconciliation error:', err);
      alert(`Error during photo reconciliation: ${err.message}`);
    } finally {
      setReconcilingPhotos(false);
      setReconcileProgress(prev => ({ ...prev, active: false }));
    }
  };

  const handleDownloadMissingPhotosReport = () => {
    const missing = filteredStudents.filter(s => !s.photoId || s.photoId === '—' || s.photoId === '');
    if (!missing.length) {
      alert('Great news! All students in the current filtered view already have photos.');
      return;
    }

    let reportText = `The following ${missing.length} students do not have photos uploaded:\n\n`;
    missing.forEach((s, idx) => {
      reportText += `${idx + 1} - ${s.studentName} (Form: ${s.formNo}, Board Reg: ${s.boardRegNo || 'N/A'}, Class: ${s.class})\n`;
    });

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Missing_Photos_Admissions_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cell padding class based on density state (comfortable legible font sizes to prevent eye strain)
  const cellPaddingClass = density === 'fit'
    ? 'px-2 py-1.5 text-xs font-bold leading-normal'
    : density === 'compact'
      ? 'px-2.5 py-2 text-xs sm:text-[13px] font-extrabold leading-normal'
      : 'px-3.5 py-2.5 text-xs sm:text-sm font-black leading-normal';

  return (
    <div className="space-y-0.5 text-xs sm:text-sm animate-fadeIn relative">
      {/* Sleek Ultra-Compact Control Bar */}
      {/* Ultra-Responsive Control Bar: Single Row on Desktop / Minimal 2-Rows on Mobile */}
      <div className="px-1.5 py-0.5 sm:py-1 rounded-xl border shadow-2xs space-y-1 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-1.5 text-xs font-extrabold" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>

        {/* ROW 1 (Mobile) / LEFT SECTION (Desktop): Search Bar + Desktop Filters + Total Records Counter */}
        <div className="flex items-center justify-between gap-1 sm:gap-1.5 flex-1 min-w-0">

          {/* Left Sub-Group: Search Bar, Desktop Filters Dropdown, and Total Records Counter */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
            {/* Search Input Bar with Shortcut Tooltip Popover */}
            <div className="relative flex-1 min-w-[100px] sm:min-w-[240px] md:min-w-[320px] lg:min-w-[380px] lg:max-w-[480px]" ref={searchHelpRef}>
              {isSearching || searchTerm !== deferredSearchTerm ? (
                <RefreshCw size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-500 animate-spin pointer-events-none" />
              ) : (
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              )}
              <input
                type="text"
                placeholder="Search Name, Father, Mother, Mob, adm4347, reg..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-7 pr-12 py-1 sm:py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 text-[11px] sm:text-xs bg-slate-50 dark:bg-slate-950 shadow-2xs leading-normal"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {searchTerm ? (
                  <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-slate-700 p-0.5 cursor-pointer">
                    <X size={12} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowSearchHelp(prev => !prev)}
                  title="Search shortcuts & keyword guide"
                  className={`p-1 rounded-md transition-all cursor-pointer ${showSearchHelp ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' : 'text-slate-400 hover:text-amber-600'}`}
                >
                  <Sparkles size={12} />
                </button>
              </div>

              {/* Interactive Search Shortcuts Tooltip / Guide Popover */}
              {showSearchHelp && (
                <div className="absolute left-0 top-full mt-1 w-72 sm:w-80 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 text-[11px] space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Sparkles size={12} className="text-amber-500" />
                      Global Search Shortcuts
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSearchHelp(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[10px] sm:text-[11px]">
                    <div
                      onClick={() => { setSearchTerm('adm'); setShowSearchHelp(false); }}
                      className="p-1 rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">Admission No:</span>
                      <code className="font-mono font-bold text-amber-600 dark:text-amber-400">adm4347</code>
                    </div>
                    <div
                      onClick={() => { setSearchTerm('reg'); setShowSearchHelp(false); }}
                      className="p-1 rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">Board Reg No:</span>
                      <code className="font-mono font-bold text-blue-600 dark:text-blue-400">reg23...</code>
                    </div>
                    <div
                      onClick={() => { setSearchTerm('form'); setShowSearchHelp(false); }}
                      className="p-1 rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">Form Number:</span>
                      <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">form123</code>
                    </div>
                    <div
                      onClick={() => { setSearchTerm('roll'); setShowSearchHelp(false); }}
                      className="p-1 rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">Class Roll No:</span>
                      <code className="font-mono font-bold text-purple-600 dark:text-purple-400">roll12</code>
                    </div>
                    <div
                      onClick={() => { setSearchTerm('mob'); setShowSearchHelp(false); }}
                      className="p-1 rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">Mobile / Contact:</span>
                      <code className="font-mono font-bold text-rose-600 dark:text-rose-400">mob9906...</code>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1">
                    🔍 Or type any student name, father name, mother name, village, class, or stream.
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Filters Dropdown (Shown ONLY on Desktop >= sm right next to Search Bar) */}
            <div className="hidden sm:block flex-shrink-0">
              <UnifiedFiltersGroupDropdown
                availableSessions={availableSessions}
                selectedSessions={selectedSessions}
                setSelectedSessions={setSelectedSessions}
                availableClasses={availableClasses}
                selectedClasses={selectedClasses}
                setSelectedClasses={setSelectedClasses}
                availableGenders={availableGenders}
                selectedGenders={selectedGenders}
                setSelectedGenders={setSelectedGenders}
                availableStreams={availableStreams}
                selectedStreams={selectedStreams}
                setSelectedStreams={setSelectedStreams}
                availableStatuses={availableStatuses}
                selectedStatuses={selectedStatuses}
                setSelectedStatuses={setSelectedStatuses}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                setCurrentPage={setCurrentPage}
              />
            </div>

            {/* Interactive Real-Time Data Sync & Records Counter Badge */}
            <div className="relative overflow-hidden flex items-center px-2.5 py-1 rounded-xl border text-[11px] sm:text-xs font-black bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-2xs flex-shrink-0 gap-1.5 text-slate-800 dark:text-slate-100 transition-all">
              {isFetchingData || loading ? (
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 animate-pulse">
                  <RefreshCw size={12} className="animate-spin text-amber-600 shrink-0" />
                  <span>Syncing...</span>
                  <span className="font-mono text-slate-900 dark:text-white font-extrabold">({filteredStudents.length})</span>
                </div>
              ) : (isSearching || searchTerm !== deferredSearchTerm) ? (
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 animate-pulse">
                  <RefreshCw size={12} className="animate-spin text-amber-600 shrink-0" />
                  <span>Searching...</span>
                  <span className="font-mono text-slate-900 dark:text-white font-extrabold">({filteredStudents.length})</span>
                </div>
              ) : searchTerm.trim() ? (
                <div className="flex items-center gap-1 text-sky-700 dark:text-sky-400">
                  <span className="font-black">🔍 Records:</span>
                  <span className="font-mono text-slate-900 dark:text-white font-extrabold">{filteredStudents.length}</span>
                  <span className="text-[10px] text-slate-400 font-mono">/ {allStudents.length}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400" title="Connected to Cloud Firestore in Real-Time">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-black">Live:</span>
                  <span className="font-mono font-black text-slate-900 dark:text-slate-50">{filteredStudents.length}</span>
                </div>
              )}

              {/* Glowing animated progress stripe */}
              {(isFetchingData || loading || isSearching || searchTerm !== deferredSearchTerm || fetchProgress > 0) && (
                <div className="absolute left-0 right-0 bottom-0 h-1 bg-amber-100 dark:bg-amber-950/40 overflow-hidden pointer-events-none transition-all">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-teal-400 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse"
                    style={{ width: `${fetchProgress || 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2 (Mobile) / RIGHT SECTION (Desktop): Administrative Tools + Mobile Filters + Pagination + Settings */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60 flex-shrink-0">

          {/* Left Sub-Group on Mobile: Administrative Tools Suite + Mobile Filters Dropdown */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Wrench Tools Suite Dropdown Button */}
            <div className="relative inline-block text-left flex-shrink-0" ref={toolsDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  const nextState = !isToolsOpen;
                  setIsToolsOpen(nextState);
                  if (nextState) handleMarkToolsSeen();
                }}
                title="Administrative Tools Suite"
                className="relative p-1.5 rounded-xl flex items-center justify-center transition-all whitespace-nowrap cursor-pointer bg-indigo-700 hover:bg-indigo-600 text-white shadow-sm font-extrabold text-xs"
              >
                <Wrench size={14} />
                {hasUnseenToolsUpdate && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black font-mono shadow-sm animate-pulse">
                    NEW
                  </span>
                )}
              </button>

              <AdminToolsDropdown
                isOpen={isToolsOpen}
                setIsOpen={setIsToolsOpen}
                activeTab="reports"
                setActiveTab={setActiveTab}
                user={user}
                onOpenCustomRoster={() => setShowCustomRosterModal(true)}
                onOpenAnalytics={() => setShowAnalyticsModal(true)}
                onOpenDirectEntry={() => setShowDirectIngestionModal(true)}
                onOpenBulkTools={() => setShowToolsModal(true)}
                onOpenRecycleBin={() => setShowRecycleBinModal(true)}
                enableQuickCellEdit={enableQuickCellEdit}
                setEnableQuickCellEdit={setEnableQuickCellEdit}
                align="right"
              />
            </div>

            {/* Mobile Filters Dropdown (Shown ONLY on Mobile < sm right next to Wrench Tools) */}
            <div className="block sm:hidden flex-shrink-0">
              <UnifiedFiltersGroupDropdown
                availableSessions={availableSessions}
                selectedSessions={selectedSessions}
                setSelectedSessions={setSelectedSessions}
                availableClasses={availableClasses}
                selectedClasses={selectedClasses}
                setSelectedClasses={setSelectedClasses}
                availableGenders={availableGenders}
                selectedGenders={selectedGenders}
                setSelectedGenders={setSelectedGenders}
                availableStreams={availableStreams}
                selectedStreams={selectedStreams}
                setSelectedStreams={setSelectedStreams}
                availableStatuses={availableStatuses}
                selectedStatuses={selectedStatuses}
                setSelectedStatuses={setSelectedStatuses}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                setCurrentPage={setCurrentPage}
              />
            </div>
          </div>

          {/* Right Sub-Group: Pagination + Table Settings */}
          <div className="flex items-center gap-1 flex-shrink-0">

            {/* Temporary Column Order Reset Badge */}
            {isColumnOrderCustom && (
              <button
                type="button"
                onClick={handleResetColumnOrder}
                title="Reset column positions back to official default order"
                className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-900 dark:text-amber-300 font-black text-[10px] sm:text-xs flex items-center gap-1 border border-amber-300 dark:border-amber-700 cursor-pointer shadow-2xs transition-all animate-fadeIn"
              >
                <RotateCcw size={11} />
                <span>Reset Order</span>
              </button>
            )}

            {/* Compact Pagination */}
            {pageSize !== 'All' && totalPages > 1 && (
              <div className="flex items-center gap-0.5 font-black text-[10px]">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  ‹
                </button>
                <span className="whitespace-nowrap">{currentPage}/{totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  ›
                </button>
              </div>
            )}

            {/* Table Settings Dropdown (Includes Layout, Columns, Density, Export, Print, Sync, and 90-Day Recycle Bin) */}
            <MoreActionsDropdown
              density={density}
              setDensity={setDensity}
              setShowColumnManager={setShowColumnManager}
              onPrint={handlePrintRegister}
              onExportCSV={handleExportCSV}
              onSync={onSync || (() => loadReportsData(true))}
              onOpenRecycleBin={() => setShowRecycleBinModal(true)}
              unreadRecycleBinCount={recycleBinCount}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Exact-record multi-selection actions */}
      {selectedTableStudents.length > 0 && (
        <div className="mx-0.5 mb-1.5 px-2.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/95 dark:bg-indigo-950/80 shadow-sm flex flex-wrap items-center gap-2 sticky top-0 z-40">
          <div className="flex items-center gap-2 mr-auto min-w-0">
            <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-lg bg-indigo-600 text-white font-black text-[11px]">
              {selectedTableStudents.length}
            </span>
            <div className="min-w-0">
              <p className="font-black text-xs text-indigo-950 dark:text-indigo-100 leading-tight">Applications selected</p>
              <p className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 leading-tight">Actions apply only to exact database records</p>
            </div>
          </div>

          {selectedTableStudents.length < selectableFilteredStudents.length && (
            <button
              type="button"
              onClick={selectAllFilteredApplications}
              className="px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-indigo-800 dark:text-indigo-200 font-black text-[10px] cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
            >
              Select all {selectableFilteredStudents.length} filtered
            </button>
          )}

          <button
            type="button"
            disabled={bulkTableActionBusy}
            onClick={() => generateBulkAdmissionPdf(selectedTableStudents, printSections)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-black text-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Open the selected applications as one printable document"
          >
            <Printer size={12} /> Print selected
          </button>

          <button
            type="button"
            disabled={bulkTableActionBusy}
            onClick={confirmBulkUnlock}
            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Unlock size={12} /> Unlock 24h
          </button>

          <div className="flex items-center rounded-lg overflow-hidden border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900">
            <select
              value={bulkTableStatus}
              onChange={event => setBulkTableStatus(event.target.value)}
              disabled={bulkTableActionBusy || selectedIncludesAssignedRoll}
              aria-label="Status for selected applications"
              className="h-7 px-2 bg-transparent text-[10px] font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="Submitted">Submitted</option>
              <option value="Provisional">Provisional</option>
              <option value="Rejected">Rejected</option>
              <option value="Withdrawn">Withdrawn</option>
            </select>
            <button
              type="button"
              disabled={bulkTableActionBusy || selectedIncludesAssignedRoll}
              onClick={confirmBulkStatusChange}
              title={selectedIncludesAssignedRoll ? 'Status changes are disabled when an approved record with an assigned roll number is selected' : 'Apply status to selected applications'}
              className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply status
            </button>
          </div>

          <button
            type="button"
            disabled={bulkTableActionBusy}
            onClick={confirmBulkDelete}
            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={12} /> Archive
          </button>

          <button
            type="button"
            disabled={bulkTableActionBusy}
            onClick={() => setSelectedTableDocIds(new Set())}
            className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
            title="Clear selection"
            aria-label="Clear selected applications"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Master Data Table (Clean Light Theme Adaptive Headers & Sticky S.No Column) */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-110px)] rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs max-w-full bg-white dark:bg-slate-900 relative">
        {/* Real-time Table Loading Progress Stripe */}
        {(isFetchingData || loading || fetchProgress > 0) && (
          <div className="sticky top-0 left-0 right-0 z-50 h-1 bg-amber-100 dark:bg-amber-950/60 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 w-full animate-pulse shadow-sm" />
          </div>
        )}
        <table className="w-full text-left text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 whitespace-normal break-words table-fixed">
            <thead className="sticky top-0 z-30 overflow-visible bg-slate-100 dark:bg-slate-800 text-[#800000] dark:text-rose-400 font-black border-b-2 border-rose-900/30 uppercase tracking-tight text-xs sm:text-[13px] shadow-2xs">
              <tr className="overflow-visible">
                <th className="sticky left-0 top-0 z-50 w-9 min-w-9 max-w-9 px-1 py-1 text-center bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={allPageRowsSelected}
                    ref={element => {
                      if (element) element.indeterminate = somePageRowsSelected && !allPageRowsSelected;
                    }}
                    disabled={selectablePageStudents.length === 0}
                    onChange={toggleCurrentPageSelection}
                    aria-label={allPageRowsSelected ? 'Deselect all applications on this page' : 'Select all applications on this page'}
                    title={allPageRowsSelected ? 'Deselect current page' : 'Select current page'}
                    className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                  />
                </th>
                {orderedVisibleColumns.map((col, idx) => {
                  const configuredWidth = colWidths[col.key] || DEFAULT_1_WIDTHS[col.key] || 100;
                  const widthPx = col.key === 'fatherName' ? Math.max(configuredWidth, 150) : configuredWidth;
                  const stickyClasses = col.isSticky
                    ? 'sticky left-9 top-0 z-40 bg-slate-100 dark:bg-slate-800 text-[#800000] dark:text-rose-400 font-black border-r border-slate-300 dark:border-slate-700'
                    : 'sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 text-[#800000] dark:text-rose-400 font-black';

                  const isFirstShiftable = idx === 0 || (idx === 1 && orderedVisibleColumns[0]?.isSticky);
                  const isLastShiftable = idx === orderedVisibleColumns.length - 1;

                  return (
                    <th
                      key={col.key}
                      style={{ width: `${widthPx}px`, maxWidth: `${widthPx}px` }}
                      draggable={!col.isSticky}
                      onDragStart={(e) => handleColumnDragStart(e, col.key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleColumnDrop(e, col.key)}
                      className={`relative group/th group-hover/th:z-50 select-none px-1.5 py-1 text-xs sm:text-[12px] leading-tight whitespace-normal break-all overflow-visible cursor-grab active:cursor-grabbing transition-colors ${stickyClasses} ${draggedColKey === col.key ? 'opacity-40 bg-amber-200 dark:bg-amber-900' : ''}`}
                    >
                      {/* Prominent Column Shift Arrows (Centered, z-50 elevated, uncropped) */}
                      {!col.isSticky && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-0.5 opacity-0 group-hover/th:opacity-100 flex items-center gap-0.5 transition-all z-50 pointer-events-auto bg-amber-100/95 dark:bg-slate-800/95 text-[#800000] dark:text-rose-300 px-1 py-0.5 rounded-full border border-amber-600/50 dark:border-rose-400/50 shadow-lg hover:scale-110">
                          <button
                            type="button"
                            disabled={isFirstShiftable}
                            onClick={(e) => { e.stopPropagation(); handleShiftColumn(col.key, 'left'); }}
                            title="Shift column left"
                            className="p-0.5 rounded hover:bg-amber-500/30 hover:scale-125 text-[#800000] dark:text-rose-300 hover:text-amber-800 dark:hover:text-amber-400 disabled:opacity-20 cursor-pointer transition-all leading-none"
                          >
                            <ChevronLeft size={11} strokeWidth={3} />
                          </button>
                          <button
                            type="button"
                            disabled={isLastShiftable}
                            onClick={(e) => { e.stopPropagation(); handleShiftColumn(col.key, 'right'); }}
                            title="Shift column right"
                            className="p-0.5 rounded hover:bg-amber-500/30 hover:scale-125 text-[#800000] dark:text-rose-300 hover:text-amber-800 dark:hover:text-amber-400 disabled:opacity-20 cursor-pointer transition-all leading-none"
                          >
                            <ChevronRight size={11} strokeWidth={3} />
                          </button>
                        </div>
                      )}

                      <div className={`flex items-center ${col.key === 'sno' ? 'justify-center text-center' : 'justify-between'} overflow-hidden`}>
                        <span className={`break-all overflow-hidden font-black text-[#800000] dark:text-rose-400 ${col.key === 'sno' ? 'text-center w-full' : ''}`}>{col.label}</span>
                      </div>

                      {/* Interactive Drag Handle to Resize Column Width */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize hover:bg-amber-500 active:bg-amber-600 z-20 flex items-center justify-center transition-all group/handle"
                        title="Drag left/right to adjust column width"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/50 dark:bg-slate-500/50 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50 text-slate-900 dark:text-slate-100 font-extrabold bg-white dark:bg-slate-900">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((s, idx) => {
                  const studentWithModal = {
                    ...s,
                    _visibleCols: visibleCols,
                    _setPreviewPhotoModal: setPreviewPhotoModal,
                    _setSelectedApp: setSelectedApp,
                    _onRefresh: () => loadReportsData(false),
                    _onDeleteRecord: handleRecordDeleted,
                    _onTriggerDelete: (st) => setDeletingStudentTarget(st),
                    _handleCopyCell: handleCopyCell,
                    _copiedCellId: copiedCellId,
                  };
                  const dynamicSNo = pageSize === 'All' ? idx + 1 : (currentPage - 1) * (parseInt(pageSize, 10) || 50) + idx + 1;
                  const exactDocId = getExactAdmissionDocId(s);
                  const isSelectable = s?._isCurrentScope !== false && Boolean(exactDocId);
                  const isSelected = isSelectable && selectedTableDocIds.has(exactDocId);

                  return (
                    <tr key={`adv_rep_row_${s.id || s.docId || s.formNo || idx}_${dynamicSNo}_${idx}`} className={`group transition-colors font-bold ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/50 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-800' : idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'} hover:bg-amber-50 dark:hover:bg-amber-900/30`}>
                      <td className={`sticky left-0 z-20 w-9 min-w-9 max-w-9 px-1 py-1 text-center border-r border-slate-200 dark:border-slate-800 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950' : idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSelectable || bulkTableActionBusy}
                          onChange={() => toggleTableStudent(s)}
                          aria-label={isSelectable ? `Select ${s.studentName || `application ${dynamicSNo}`}` : 'Historical records cannot be selected for application actions'}
                          title={isSelectable ? 'Select this exact application' : 'Historical register record: actions unavailable'}
                          className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                        />
                      </td>
                      {orderedVisibleColumns.map(col => {
                        const val = col.key === 'sno' ? dynamicSNo : (s[col.key] ?? '—');
                        const cellId = `${s.id || s.sno || idx}_${col.key}`;
                        const isCopied = copiedCellId === cellId;
                        const isRowCopied = copiedCellId === `row_${s.id || s.sno}`;
                        const configuredWidth = colWidths[col.key] || DEFAULT_1_WIDTHS[col.key] || 100;
                        const widthPx = col.key === 'fatherName' ? Math.max(configuredWidth, 150) : configuredWidth;

                        const stickyBg = col.isSticky
                          ? ` sticky left-9 z-10 border-r border-slate-200 dark:border-slate-800/50 transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950' : idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'} group-hover:bg-amber-50 dark:group-hover:bg-amber-900/30`
                          : '';

                        return (
                          <td
                            key={col.key}
                            style={{ width: `${widthPx}px`, maxWidth: `${widthPx}px` }}
                            className={`relative group/cell overflow-hidden ${cellPaddingClass} ${col.className || ''} ${stickyBg}`}
                          >
                            {col.key === 'sno' ? (
                              <div className="flex flex-col items-center justify-center text-center py-0.5 min-w-0 w-full">
                                <span className="font-mono font-black text-amber-800 dark:text-amber-300 text-xs sm:text-[13px]">{dynamicSNo}</span>
                                {s._isHistorical ? (
                                  <span className="text-[8px] font-black leading-none px-1 py-px rounded bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/60 mt-0.5 select-none" title="Source: Master Registers (Historical)">REG</span>
                                ) : (
                                  <span className="text-[8px] font-black leading-none px-1 py-px rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 mt-0.5 select-none" title="Source: Active Admissions">ADM</span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyRow(s);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 p-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-800/60 text-amber-700 dark:text-amber-300 cursor-pointer flex items-center justify-center"
                                  title="Copy entire row for Excel/Sheets"
                                >
                                  {isRowCopied ? (
                                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">Copied!</span>
                                  ) : (
                                    <Copy size={10} />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1 min-w-0">
                                <div className="flex-1 min-w-0 whitespace-normal break-words">
                                  {col.render ? col.render(val, studentWithModal) : val}
                                </div>
                              </div>
                            )}

                            {/* Horizontal edit/copy/clear action capsule placed at absolute bottom-right wall of td */}
                            {!col.isComposite && col.key !== 'mobile' && col.key !== 'sno' && ((val && val !== '—') || (enableQuickCellEdit && !restrictedCols[col.key])) && (
                              <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute right-0.5 bottom-0.5 z-20 flex flex-row items-center gap-0.5 p-0.5 rounded-md bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                {/* Edit/Add Icon — Only active when Quick Cell Edit Hover is checked */}
                                {enableQuickCellEdit && !restrictedCols[col.key] && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuickEditCell({
                                        student: s,
                                        column: col,
                                        currentValue: val === '—' ? '' : val
                                      });
                                    }}
                                    className="p-0.5 hover:bg-amber-200 dark:hover:bg-amber-900/80 text-amber-700 dark:text-amber-300 rounded cursor-pointer transition-colors"
                                    title={(!val || val === '—') ? `Add ${col.label}` : `Quick Edit ${col.label}`}
                                  >
                                    {(!val || val === '—')
                                      ? <PlusCircle size={9} />
                                      : <Edit3 size={9} />}
                                  </button>
                                )}

                                {/* Copy Icon — Always allowed by default */}
                                {val && val !== '—' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCell(cellId, val);
                                    }}
                                    className="p-0.5 hover:bg-teal-200 dark:hover:bg-teal-900/80 text-teal-700 dark:text-teal-300 rounded cursor-pointer transition-colors"
                                    title={`Copy ${col.label}`}
                                  >
                                    {isCopied ? <Check size={9} className="text-emerald-500 font-black" /> : <Copy size={9} />}
                                  </button>
                                )}

                                {/* Clear Field Value Icon — Only active when Quick Cell Edit Hover is checked */}
                                {enableQuickCellEdit && !restrictedCols[col.key] && val && val !== '—' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClearCellField(s, col);
                                    }}
                                    className="p-0.5 hover:bg-rose-200 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 rounded cursor-pointer transition-colors"
                                    title={`Clear field value for ${col.label}`}
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (loading || isFetchingData) ? (
                <tr>
                  <td colSpan={(orderedVisibleColumns.length || 1) + 1} className="p-10 text-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex flex-col items-center justify-center gap-2.5 py-4">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-300 dark:border-amber-700/50 shadow-inner">
                        <RefreshCw size={20} className="animate-spin text-amber-700 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="font-black text-sm text-slate-800 dark:text-slate-200">
                          Loading Student Database Records...
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {fetchProgress > 0 ? `Fetching & indexing records (${fetchProgress}%)...` : 'Fetching records securely from database...'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={(orderedVisibleColumns.length || 1) + 1} className="p-10 text-center text-slate-600 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <SearchX size={28} className="text-slate-400 dark:text-slate-500" />
                      <p className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
                        No matching student records found.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Try adjusting your search query, class selection, or session filter.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {/* MODAL 1: Column Manager & Presets (☰ Cols) */}
      {showColumnManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl lg:max-w-5xl p-5 sm:p-6 rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-shrink-0">
              <h3 className="font-black text-base flex items-center gap-2 text-slate-900 dark:text-white">
                <Columns size={18} className="text-amber-600" /> Manage Table Columns & Layout Presets
              </h3>
              <button type="button" onClick={() => setShowColumnManager(false)} className="p-1 hover:opacity-70 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Unified Single Row Header: Tabs & Quick Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-black flex-shrink-0">
              {/* Tab Buttons */}
              <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-900/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setColManagerTab('visibility')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[11px] ${colManagerTab === 'visibility'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-800'
                    }`}
                >
                  <Eye size={13} /> <span>Column Display Visibility</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColManagerTab('restrictions')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[11px] ${colManagerTab === 'restrictions'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-800'
                    }`}
                >
                  <ShieldCheck size={13} /> <span>🔒 Lock Fields</span>
                </button>
              </div>

              {/* Quick Presets & Dynamic Presets Manager in Same Row */}
              {colManagerTab === 'visibility' && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-700 dark:text-slate-300 font-extrabold">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPreset('fit')}
                    className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                  >
                    ⚡ Fit Screen Width
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('essential')}
                    className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-600 text-white shadow-xs cursor-pointer"
                  >
                    📋 Essential
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('all')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white shadow-xs cursor-pointer"
                  >
                    🌐 Show All
                  </button>

                  {/* Custom Presets */}
                  {customPresets.map(preset => (
                    <div key={preset.name} className="flex items-center gap-1 bg-purple-700 hover:bg-purple-600 text-white px-2.5 py-1 rounded-lg font-bold shadow-xs">
                      <button type="button" onClick={() => applyCustomPreset(preset)} className="cursor-pointer">
                        ✨ {preset.name}
                      </button>
                      <button type="button" onClick={() => deleteCustomPreset(preset.name)} className="hover:text-rose-300 ml-1 cursor-pointer">
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleSaveCustomPreset}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs cursor-pointer flex items-center gap-1 font-black"
                    title="Save currently selected columns as a custom layout preset"
                  >
                    <PlusCircle size={13} /> <span>Save Preset</span>
                  </button>
                </div>
              )}
            </div>

            {colManagerTab === 'visibility' ? (
              <>

                {/* Search Input for Columns */}
                <div className="relative flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search columns by name..."
                    value={colSearchQuery}
                    onChange={(e) => setColSearchQuery(e.target.value)}
                    className="w-full px-2.5 py-1.5 pl-8 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 text-[11px] bg-slate-50 dark:bg-slate-950"
                  />
                  <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500 dark:text-slate-400" />
                  {colSearchQuery && (
                    <button onClick={() => setColSearchQuery('')} className="absolute right-2.5 top-1.5 text-slate-500 hover:text-slate-700">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Classified Columns List */}
                <div className="space-y-2 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-xl flex-1 max-h-[60vh]">
                  {[
                    {
                      category: "👤 Personal Details",
                      columns: [
                        { key: 'studentName', label: "Student's Name" },
                        { key: 'fatherName', label: 'Parentage (Father & Mother)' },
                        { key: 'dob', label: 'DoB' },
                        { key: 'dobWords', label: 'DoB (words)' },
                        { key: 'gender', label: 'Gender' },
                        { key: 'category', label: 'Category' },
                        { key: 'religion', label: 'Religion' },
                        { key: 'disabilityStatus', label: 'Disability Status' },
                        { key: 'disabilityType', label: 'Disability Type' },
                        { key: 'bloodType', label: 'Blood Type' },
                        { key: 'height', label: 'Height (cm)' },
                        { key: 'weight', label: 'Weight (kg)' },
                        { key: 'aadhar', label: 'Aadhaar / PEN' },
                        { key: 'apaarId', label: 'APAAR ID' },
                        { key: 'socialCategory', label: 'Social Category' },
                        { key: 'socioEconomicCategory', label: 'Socio-economic Category' },
                      ]
                    },
                    {
                      category: "📍 Address & Contact",
                      columns: [
                        { key: 'village', label: 'Village/Town' },
                        { key: 'residence', label: 'Residence (Village, District)' },
                        { key: 'block', label: 'Block' },
                        { key: 'tehsil', label: 'Tehsil' },
                        { key: 'district', label: 'District' },
                        { key: 'pinCode', label: 'PIN Code' },
                        { key: 'state', label: 'State/UT' },
                        { key: 'houseNo', label: 'House No.' },
                        { key: 'mobile', label: 'Mobile (S/P)' },
                        { key: 'parentContact', label: 'Mobile (P)' },
                        { key: 'email1', label: 'Email 1' },
                        { key: 'email2', label: 'Email 2' },
                      ]
                    },
                    {
                      category: "🎓 Academic & Enrollment",
                      columns: [
                        { key: 'classRollNo', label: 'Class R.No.' },
                        { key: 'admNo', label: 'Adm. No.' },
                        { key: 'class', label: 'Class' },
                        { key: 'session', label: 'Session' },
                        { key: 'stream', label: 'Stream' },
                        { key: 'subs', label: 'Subs' },
                        { key: 'subjects1', label: 'Subjects 1' },
                        { key: 'subjects2', label: 'Subjects 2' },
                        { key: 'subjects3', label: 'Subjects 3' },
                        { key: 'subjects4', label: 'Subjects 4' },
                        { key: 'subjects5', label: 'Subjects 5' },
                        { key: 'subjects6', label: 'Subject 6' },
                        { key: 'boardRegNo', label: 'Board Reg. No.' },
                        { key: 'photoId', label: 'Photo' },
                        { key: 'boardName', label: 'Board Name' },
                        { key: 'onlineSubmDate', label: 'Online Subm. Date' },
                        { key: 'admDate', label: 'Adm. Date' },
                      ]
                    },
                    {
                      category: "🏫 Previous School Details",
                      columns: [
                        { key: 'prevSchool', label: 'Previous School' },
                        { key: 'prevComplexHead', label: 'Previous Complex Head' },
                        { key: 'prevCcDc', label: 'CC/DC No. & Date (Prev. institution)' },
                        { key: 'prevExamMode', label: 'Exam Mode (Prev.)' },
                        { key: 'prevExamRollNo', label: 'Exam R.No. (Prev.)' },
                        { key: 'prevMarksObt', label: 'Marks Obt. (Prev.)' },
                        { key: 'prevMaxMarks', label: 'Max. Marks (Prev.)' },
                        { key: 'prevPercentage', label: '%age (Prev.)' },
                        { key: 'prevDivision', label: 'Div/Distinc (Prev.)' },
                        { key: 'vocationalPercentage', label: 'Vocational %age' },
                      ]
                    },
                    {
                      category: "🏦 Bank Details",
                      columns: [
                        { key: 'bankAccount', label: 'Bank Account Number' },
                        { key: 'bankName', label: 'Bank Name' },
                        { key: 'ifsc', label: 'IFSC Code' },
                      ]
                    },
                    {
                      category: "⚙️ System & Current Exam",
                      columns: [
                        { key: 'sno', label: 'S.No.' },
                        { key: 'formNo', label: 'F.No.' },
                        { key: 'status', label: 'Status' },
                        { key: 'currExamMode', label: 'Exam Mode (Current)' },
                        { key: 'currExamRollNo', label: 'Exam R.No. (Current)' },
                        { key: 'currResult', label: 'Result (Current)' },
                        { key: 'currMarksReapp', label: 'Marks/Reapp (Current)' },
                        { key: 'withdrawalDate', label: 'Date of Withdrawal' },
                        { key: 'currCcDc', label: 'No. & Date of CC/DC Issued' },
                        { key: 'remarks', label: 'Remarks' },
                        { key: 'pdfUrl', label: 'PDF URL' },
                        { key: 'readmission', label: 'Re-admission' },
                      ]
                    }
                  ].map((group) => {
                    const filteredCols = group.columns.filter(c =>
                      c.label.toLowerCase().includes(colSearchQuery.toLowerCase()) ||
                      c.key.toLowerCase().includes(colSearchQuery.toLowerCase())
                    );

                    if (filteredCols.length === 0) return null;

                    return (
                      <div key={group.category} className="space-y-1.5">
                        <h4 className="text-[10px] font-black text-amber-700 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-0.5 uppercase tracking-wide">
                          {group.category}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1">
                          {filteredCols.map((c) => (
                            <label key={`${group.category}_${c.key}`} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-amber-500 cursor-pointer font-bold text-[10.5px] sm:text-[11px] text-slate-900 dark:text-slate-100 transition-colors shadow-2xs">
                              <input
                                type="checkbox"
                                checked={visibleCols[c.key]}
                                onChange={() => toggleCol(c.key)}
                                className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                              />
                              <span className="truncate" title={c.label}>{c.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1 flex-1 max-h-[60vh]">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-bold space-y-1">
                  <div className="font-black text-sm flex items-center gap-1.5">
                    <ShieldCheck size={16} /> Restricted Fields Manager
                  </div>
                  <p>
                    Check fields below to <strong>LOCK</strong> them from editing. Checked fields will not allow quick cell edit or modal editing. Unchecked fields are <strong>automatically editable</strong>.
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-black pt-1">
                    📌 Note: <strong>Class</strong> field is locked by default as requested.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {COLUMN_DEFS.map((c) => {
                    const isRestricted = !!restrictedCols[c.key];
                    return (
                      <label
                        key={`lock_${c.key}`}
                        className={`flex items-center justify-between p-2 rounded-xl border font-black text-xs cursor-pointer transition-all ${isRestricted
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isRestricted}
                            onChange={() => toggleRestrictedCol(c.key)}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer flex-shrink-0"
                          />
                          <span className="truncate">{c.label}</span>
                        </div>
                        <span className="text-[10px] font-black flex-shrink-0 ml-1">
                          {isRestricted ? '🔒 Locked' : '✏️ Editable'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}


            {layoutNotice && (
              <div className={`p-2 rounded-xl font-extrabold text-xs text-center border ${layoutNotice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}>
                {layoutNotice.msg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={saveAsDefault2}
                  className="flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 shadow-xs cursor-pointer flex items-center justify-center gap-1 transition-colors"
                  title="Save active column widths and visibility as Default 2 preset"
                >
                  <Save size={13} /> <span>Save Widths (Default 2)</span>
                </button>
                <button
                  type="button"
                  onClick={resetToDefault1}
                  className="flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 shadow-xs cursor-pointer flex items-center justify-center gap-1 transition-colors"
                  title="Reset column widths and visibility to System Default 1"
                >
                  <RotateCcw size={13} /> <span>Reset Widths (Default 1)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('hss_admin_table_cols_v1', JSON.stringify(visibleCols));
                    localStorage.setItem('hss_admin_table_widths_v2', JSON.stringify(colWidths));
                  } catch (e) { }
                  setShowColumnManager(false);
                }}
                className="w-full sm:w-auto px-5 py-2 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 shadow-md cursor-pointer text-xs"
              >
                Apply Column Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Admin Tools (🛠 Tools) */}
      {showToolsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl lg:max-w-5xl p-5 sm:p-6 rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base flex items-center gap-2 text-slate-900 dark:text-white">
                <Wrench size={18} className="text-amber-600" /> Administrative Tools Suite
              </h3>
              <button type="button" onClick={() => setShowToolsModal(false)} className="p-1 hover:opacity-70">
                <X size={18} />
              </button>
            </div>

            {/* Tools Sub Navigation */}
            <div className="flex items-center gap-1 p-1 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-black overflow-x-auto">
              {[
                { id: 'bulk_forms', label: '📄 Bulk Forms Generator' },
                { id: 'db_editor', label: '🔄 Bulk Class & Session' },
                { id: 'photo_manager', label: '📷 Photo Sync & Manager' },
                { id: 'drive_backup', label: '☁️ PDF Drive Backup' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveToolsTab(t.id)}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${activeToolsTab === t.id ? 'bg-amber-700 text-white shadow-sm font-black' : 'text-slate-800 dark:text-slate-200'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tool Content 0: Bulk Forms Generator */}
            {activeToolsTab === 'bulk_forms' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap gap-2">
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Printer size={18} className="text-amber-600" />
                      Bulk Official Form Generator & Section Configurator
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs font-bold mt-0.5">
                      Select target student applications and configure form sections (Admission Form, Library Form, Anti-Drug Undertaking) for bulk printing.
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black border border-amber-300 dark:border-amber-700">
                    {selectedBulkFormIds.size} Selected / {filteredStudents.length} Filtered
                  </div>
                </div>

                {/* Section Configurator (Super Admin / Admin Control) */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings size={14} className="text-indigo-600" />
                    <span>Super Admin Form Section Selector (Toggle pages to generate):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={printSections.includeAdmissionForm}
                        onChange={(e) => setPrintSections(prev => ({ ...prev, includeAdmissionForm: e.target.checked }))}
                        className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                      />
                      <span>📋 Admission Form (Pages 1 & 2)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={printSections.includeLibraryForm}
                        onChange={(e) => setPrintSections(prev => ({ ...prev, includeLibraryForm: e.target.checked }))}
                        className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                      />
                      <span>📚 Library Form (Page 3)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={printSections.includeConductDeclaration}
                        onChange={(e) => setPrintSections(prev => ({ ...prev, includeConductDeclaration: e.target.checked }))}
                        className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                      />
                      <span>📜 Conduct & Anti-Drug (Page 4)</span>
                    </label>
                  </div>
                </div>

                {/* Selection Action Toolbar */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBulkFormIds(new Set(filteredStudents.map(s => s.id || s.formNo || s['Form Number'])))}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold cursor-pointer"
                    >
                      Select All Filtered ({filteredStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBulkFormIds(new Set())}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-extrabold cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedBulkFormIds.size === 0 || (!printSections.includeAdmissionForm && !printSections.includeLibraryForm && !printSections.includeConductDeclaration)}
                      onClick={() => {
                        const selectedList = filteredStudents.filter(s => selectedBulkFormIds.has(s.id || s.formNo || s['Form Number']));
                        generateBulkAdmissionPdf(selectedList, printSections);
                      }}
                      className="px-3.5 py-2 rounded-xl font-black text-xs text-white bg-teal-700 hover:bg-teal-600 shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Printer size={15} />
                      <span>View / Print ({selectedBulkFormIds.size})</span>
                    </button>
                  </div>
                </div>

                {/* Filtered Records Table with Checkboxes */}
                <div className="max-h-[38vh] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs font-bold border-collapse">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredStudents.length > 0 && selectedBulkFormIds.size === filteredStudents.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBulkFormIds(new Set(filteredStudents.map(s => s.id || s.formNo || s['Form Number'])));
                              } else {
                                setSelectedBulkFormIds(new Set());
                              }
                            }}
                            className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                          />
                        </th>
                        <th className="p-2.5">Form / Roll No.</th>
                        <th className="p-2.5">Student's Name</th>
                        <th className="p-2.5">Parentage</th>
                        <th className="p-2.5">Class (Stream)</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredStudents.map((st) => {
                        const stId = st.id || st.formNo || st['Form Number'];
                        const isChecked = selectedBulkFormIds.has(stId);
                        return (
                          <tr
                            key={stId}
                            onClick={() => {
                              const next = new Set(selectedBulkFormIds);
                              if (isChecked) next.delete(stId); else next.add(stId);
                              setSelectedBulkFormIds(next);
                            }}
                            className={`cursor-pointer transition-colors ${isChecked ? 'bg-amber-500/10 dark:bg-amber-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-950'}`}
                          >
                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = new Set(selectedBulkFormIds);
                                  if (e.target.checked) next.add(stId); else next.delete(stId);
                                  setSelectedBulkFormIds(next);
                                }}
                                className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-mono font-black text-amber-700 dark:text-amber-400">
                              {st['Form Number'] || st.formNo || '—'}
                            </td>
                            <td className="p-2.5 font-black text-slate-900 dark:text-white">
                              {st["Student's Name"] || st["Student's Name (as per school records)"] || st.studentName || st.name || '—'}
                            </td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-400 font-extrabold">
                              <div className="grid gap-1 leading-tight">
                                <div title="Father's name">{st["Father's Name"] || st["Father's/Guardian's Name (as per school records)"] || st.fatherName || '—'}</div>
                                <div className="border-t border-slate-200/70 pt-1 dark:border-slate-700/70" title="Mother's name">{st["Mother's Name"] || st["Mother's Name (as per school records)"] || st.motherName || '—'}</div>
                              </div>
                            </td>
                            <td className="p-2.5 font-extrabold text-teal-700 dark:text-teal-400">
                              {st["Admission sought for class"] || st.class || '11th'} ({st.stream || st["Stream for Class 11th"] || 'General'})
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${(st.status || st.Status || '').toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                {st.status || st.Status || 'Submitted'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tool Content 3: Bulk Class & Session Updater */}
            {activeToolsTab === 'db_editor' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap gap-2">
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <RefreshCw size={18} className="text-amber-600" />
                      Bulk Class, Academic Session & Stream Updater
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs font-bold mt-0.5">
                      Preview any academic session, select individual or all applications, and batch update or edit individual records.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black border border-amber-300 dark:border-amber-700 shadow-2xs">
                      {selectedBulkFormIds.size} of {bulkCandidateStudents.length} Selected
                    </div>
                  </div>
                </div>

                {/* ─── 1. SESSION & CLASS PREVIEW TOOLBAR ─── */}
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-2xs">
                  <div className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🔍</span>
                    <span>1. Preview Session & Filter Candidate Students:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Session Selector */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 mb-1">
                        Academic Session Preview:
                      </label>
                      <select
                        value={bulkPreviewSession}
                        onChange={(e) => setBulkPreviewSession(e.target.value)}
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="CURRENT_FILTER">Current Table Filter ({filteredStudents.length} Students)</option>
                        {availableSessions.map(sess => (
                          <option key={sess} value={sess}>Session: {sess}</option>
                        ))}
                        <option value="ALL">All School History ({allStudents.length} Students)</option>
                      </select>
                    </div>

                    {/* Class Selector */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 mb-1">
                        Class Scope:
                      </label>
                      <select
                        value={bulkPreviewClass}
                        onChange={(e) => setBulkPreviewClass(e.target.value)}
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="ALL">All Classes</option>
                        <option value="9th">9th</option>
                        <option value="10th">10th</option>
                        <option value="11th">11th</option>
                        <option value="12th">12th</option>
                        <option value="6th">6th</option>
                        <option value="7th">7th</option>
                        <option value="8th">8th</option>
                      </select>
                    </div>

                    {/* Quick Search within Candidate Pool */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 mb-1">
                        Quick Filter:
                      </label>
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search name, roll, form..."
                          value={bulkPreviewSearch}
                          onChange={(e) => setBulkPreviewSearch(e.target.value)}
                          className="w-full pl-7 pr-3 p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── 2. INTERACTIVE STUDENT PREVIEW & CHECKBOX TABLE ─── */}
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        2. Select Applications ({selectedBulkFormIds.size} / {bulkCandidateStudents.length}):
                      </span>
                    </div>

                    {/* Checkbox Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllBulk}
                        className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 text-[10px] font-black cursor-pointer shadow-2xs"
                      >
                        ✓ Select All ({bulkCandidateStudents.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAllBulk}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-[10px] font-black cursor-pointer shadow-2xs"
                      >
                        ✕ Deselect All
                      </button>
                      <button
                        type="button"
                        onClick={handleInvertBulk}
                        className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 hover:bg-amber-200 text-[10px] font-black cursor-pointer shadow-2xs"
                      >
                        🔄 Invert
                      </button>
                    </div>
                  </div>

                  {bulkCandidateStudents.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-[11px] text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 sticky top-0 z-10 font-black">
                          <tr>
                            <th className="p-1.5 w-8 text-center">
                              <input
                                type="checkbox"
                                checked={bulkCandidateStudents.length > 0 && selectedBulkFormIds.size === bulkCandidateStudents.length}
                                onChange={(e) => {
                                  if (e.target.checked) handleSelectAllBulk();
                                  else handleDeselectAllBulk();
                                }}
                                className="accent-amber-600 rounded cursor-pointer"
                              />
                            </th>
                            <th className="p-1.5 w-10 text-center">S.No</th>
                            <th className="p-1.5 w-16">Form #</th>
                            <th className="p-1.5">Student & Father Name</th>
                            <th className="p-1.5 w-14 text-center">Class</th>
                            <th className="p-1.5 w-24 text-center">Session</th>
                            <th className="p-1.5 w-20 text-center">Stream</th>
                            <th className="p-1.5 w-20 text-center">Status</th>
                            <th className="p-1.5 w-14 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                          {bulkCandidateStudents.map((st, idx) => {
                            const idKey = st.id || st.formNo || st['Form Number'] || idx;
                            const isChecked = selectedBulkFormIds.has(idKey);
                            const currentName = st.studentName || st["Student's Name (as per school records)"] || '—';
                            const fatherName = st.fatherName || st["Father's/Guardian's Name (as per school records)"] || '—';
                            const clsVal = st.class || st['Class'] || '11th';
                            const sessVal = st.session || st['Session'] || '2025-26';
                            const streamVal = st.stream || st['Stream'] || 'General';
                            const statusVal = st.status || st['Status'] || 'Submitted';

                            return (
                              <tr
                                key={idKey}
                                className={`transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 ${
                                  isChecked ? 'bg-amber-500/10 dark:bg-amber-950/20 font-extrabold' : ''
                                }`}
                                onClick={(e) => {
                                  if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !e.target.closest('button')) {
                                    toggleBulkStudent(idKey);
                                  }
                                }}
                              >
                                <td className="p-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleBulkStudent(idKey)}
                                    className="accent-amber-600 rounded cursor-pointer"
                                  />
                                </td>
                                <td className="p-1.5 text-center text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                                <td className="p-1.5 font-mono text-slate-900 dark:text-slate-100 font-extrabold">
                                  {st.formNo || st['Form Number'] || '—'}
                                </td>
                                <td className="p-1.5">
                                  <div className="text-slate-900 dark:text-slate-100 truncate max-w-[180px] font-black">
                                    {currentName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                                    {fatherName}
                                  </div>
                                </td>
                                <td className="p-1.5 text-center">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                                    {clsVal}
                                  </span>
                                </td>
                                <td className="p-1.5 text-center text-[10px] font-mono text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                  {sessVal}
                                </td>
                                <td className="p-1.5 text-center text-[10px] text-slate-600 dark:text-slate-400">
                                  {streamVal}
                                </td>
                                <td className="p-1.5 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                    statusVal.toLowerCase().includes('appr')
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : statusVal.toLowerCase().includes('rejt')
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                        : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                  }`}>
                                    {statusVal}
                                  </span>
                                </td>
                                <td className="p-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => setQuickEditStudent({
                                      ...st,
                                      editClass: clsVal,
                                      editSession: sessVal,
                                      editStream: streamVal,
                                      editStatus: statusVal,
                                      editRollNo: st.classRollNo || st['Class Roll No'] || '',
                                      editAdmDate: st.admDate || st['Adm. Date'] || ''
                                    })}
                                    title="Quick edit this individual application"
                                    className="p-1 rounded-lg bg-slate-100 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-950/60 text-slate-700 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300 transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs font-semibold text-slate-500 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      No students found matching the selected preview session and search filters.
                    </div>
                  )}
                </div>

                {/* ─── 3. BATCH EDIT VALUES CONFIGURATION ─── */}
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
                  <div className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>3. Choose Batch Updates to Apply to {selectedBulkFormIds.size} Selected Students:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Target Class */}
                    <div>
                      <label className="font-black block text-slate-700 dark:text-slate-300 mb-1 text-xs">
                        🏫 New Admission Class:
                      </label>
                      <select
                        value={bulkNewClass}
                        onChange={(e) => setBulkNewClass(e.target.value)}
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950"
                      >
                        <option value="KEEP">— Keep Current Class —</option>
                        <option value="9th">9th</option>
                        <option value="10th">10th</option>
                        <option value="11th">11th</option>
                        <option value="12th">12th</option>
                        <option value="6th">6th</option>
                        <option value="7th">7th</option>
                        <option value="8th">8th</option>
                      </select>
                    </div>

                    {/* Target Session */}
                    <div>
                      <label className="font-black block text-slate-700 dark:text-slate-300 mb-1 text-xs">
                        📅 New Academic Session:
                      </label>
                      <select
                        value={bulkNewSession}
                        onChange={(e) => setBulkNewSession(e.target.value)}
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950"
                      >
                        <option value="KEEP">— Keep Current Session —</option>
                        <option value="2025-26">2025-26</option>
                        <option value="2025-26 (Oct-Nov)">2025-26 (Oct-Nov)</option>
                        <option value="2024-25">2024-25</option>
                        <option value="2024-25 (Oct-Nov)">2024-25 (Oct-Nov)</option>
                        <option value="2026-27">2026-27</option>
                        <option value="2023-24">2023-24</option>
                        <option value="CUSTOM">Custom Session (type below)...</option>
                      </select>

                      {bulkNewSession === 'CUSTOM' && (
                        <input
                          type="text"
                          value={bulkCustomSession}
                          onChange={(e) => setBulkCustomSession(e.target.value)}
                          placeholder="e.g. 2025-26 (Nov-Dec)"
                          className="mt-1.5 w-full p-1.5 rounded-xl border border-amber-400 font-bold text-xs bg-amber-50 dark:bg-amber-950/40 text-slate-900 dark:text-white"
                        />
                      )}
                    </div>

                    {/* Target Stream */}
                    <div>
                      <label className="font-black block text-slate-700 dark:text-slate-300 mb-1 text-xs">
                        🔬 New Stream (Optional):
                      </label>
                      <select
                        value={bulkNewStream}
                        onChange={(e) => setBulkNewStream(e.target.value)}
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950"
                      >
                        <option value="KEEP">— Keep Current Stream —</option>
                        <option value="General">General (for junior classes 6th–10th)</option>
                        <option value="Science">Science</option>
                        <option value="Humanities">Humanities</option>
                        <option value="Commerce">Commerce</option>
                      </select>
                    </div>

                    {/* Target Status */}
                    <div>
                      <label className="font-black block text-slate-700 dark:text-slate-300 mb-1 text-xs">
                        ✅ New Status (Optional):
                      </label>
                      <select
                        value={bulkNewStatus}
                        onChange={(e) => setBulkNewStatus(e.target.value)}
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950"
                      >
                        <option value="KEEP">— Keep Current Status —</option>
                        <option value="Approved">Approved</option>
                        <option value="Submitted">Submitted (SUBM)</option>
                        <option value="Draft">Draft</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Real-time Progress HUD */}
                {bulkProgress.active && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 space-y-2 animate-fadeIn">
                    <div className="flex justify-between items-center text-xs font-black text-amber-900 dark:text-amber-200">
                      <span>⏳ Updating Record {bulkProgress.current} of {bulkProgress.total} ({bulkProgress.percent}%)</span>
                      <span className="truncate max-w-[200px]">{bulkProgress.studentName}</span>
                    </div>
                    <div className="w-full h-2.5 bg-amber-950/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-150 rounded-full"
                        style={{ width: `${bulkProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* ─── 4. APPLY CHANGES ACTION BUTTON ─── */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRunBatchEdit}
                    disabled={toolExecuting || selectedBulkFormIds.size === 0}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {toolExecuting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>
                      Apply Changes to {selectedBulkFormIds.size} Selected Student Records
                    </span>
                  </button>
                </div>

                {/* ─── 5. QUICK INDIVIDUAL APPLICATION EDITOR MODAL ─── */}
                {quickEditStudent && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10002] p-3 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                            <Edit3 size={16} />
                          </div>
                          <div>
                            <div className="font-black text-sm text-slate-900 dark:text-white">
                              Edit Application #{quickEditStudent.formNo || quickEditStudent.id}
                            </div>
                            <div className="text-[11px] text-slate-500 font-bold">
                              {quickEditStudent.studentName || quickEditStudent["Student's Name (as per school records)"]} • Parentage: {quickEditStudent.fatherName || quickEditStudent["Father's/Guardian's Name (as per school records)"] || '—'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuickEditStudent(null)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                            Admission Class:
                          </label>
                          <select
                            value={quickEditStudent.editClass}
                            onChange={(e) => setQuickEditStudent({ ...quickEditStudent, editClass: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                          >
                            <option value="9th">9th</option>
                            <option value="10th">10th</option>
                            <option value="11th">11th</option>
                            <option value="12th">12th</option>
                            <option value="6th">6th</option>
                            <option value="7th">7th</option>
                            <option value="8th">8th</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                            Academic Session:
                          </label>
                          <input
                            type="text"
                            value={quickEditStudent.editSession}
                            onChange={(e) => setQuickEditStudent({ ...quickEditStudent, editSession: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                            Stream:
                          </label>
                          <select
                            value={quickEditStudent.editStream}
                            onChange={(e) => setQuickEditStudent({ ...quickEditStudent, editStream: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                          >
                            <option value="General">General</option>
                            <option value="Science">Science</option>
                            <option value="Humanities">Humanities</option>
                            <option value="Commerce">Commerce</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                            Status:
                          </label>
                          <select
                            value={quickEditStudent.editStatus}
                            onChange={(e) => setQuickEditStudent({ ...quickEditStudent, editStatus: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                          >
                            <option value="Approved">Approved</option>
                            <option value="Submitted">Submitted (SUBM)</option>
                            <option value="Draft">Draft</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                            Class Roll No:
                          </label>
                          <input
                            type="text"
                            value={quickEditStudent.editRollNo}
                            onChange={(e) => setQuickEditStudent({ ...quickEditStudent, editRollNo: e.target.value })}
                            placeholder="e.g. 101"
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                            Admission Date:
                          </label>
                          <input
                            type="date"
                            value={quickEditStudent.editAdmDate}
                            onChange={(e) => setQuickEditStudent({ ...quickEditStudent, editAdmDate: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setQuickEditStudent(null)}
                          disabled={quickEditSaving}
                          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={quickEditSaving}
                          onClick={() => handleSaveIndividualStudent(quickEditStudent, {
                            class: quickEditStudent.editClass,
                            'Class': quickEditStudent.editClass,
                            'Admission sought for class': quickEditStudent.editClass,
                            session: quickEditStudent.editSession,
                            'Session': quickEditStudent.editSession,
                            'Academic Session': quickEditStudent.editSession,
                            stream: quickEditStudent.editStream,
                            'Stream': quickEditStudent.editStream,
                            status: quickEditStudent.editStatus,
                            'Status': quickEditStudent.editStatus,
                            classRollNo: quickEditStudent.editRollNo,
                            'Class Roll No': quickEditStudent.editRollNo,
                            admDate: quickEditStudent.editAdmDate,
                            'Adm. Date': quickEditStudent.editAdmDate
                          })}
                          className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                        >
                          {quickEditSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                          <span>Save & Sync Record</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}



            {/* Tool Content 6: Photo Sync & Manager */}
            {activeToolsTab === 'photo_manager' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="font-black text-sm text-slate-900 dark:text-white flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-2">
                    <Camera size={18} className="text-amber-600" />
                    Student Photo Synchronization & Database Manager
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadMissingPhotosReport}
                      className="px-3 py-1.5 rounded-xl font-black text-xs text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 cursor-pointer flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>Missing Photos List (.txt)</span>
                    </button>
                  </div>
                </div>

                {/* 1. Database Reconciliation & Deduplication Card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 dark:border-amber-500/20 shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-black">
                        <Database size={16} />
                      </div>
                      <div>
                        <div className="font-black text-xs text-slate-900 dark:text-white">
                          Pure Firebase Photo Database Reconciliation & Deduplication
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold">
                          Matches all {allStudents.length} loaded records against processed <code className="text-purple-600 dark:text-purple-400 font-bold">studentPhotos</code>, sets official passport photos as active, and purges deprecated Google Drive URLs.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={reconcilingPhotos || allStudents.length === 0}
                      onClick={handleRunPhotoReconciliation}
                      className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {reconcilingPhotos ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>{reconcilingPhotos ? 'Reconciling Database...' : 'Run Photo Reconciliation (1-Click Heal)'}</span>
                    </button>
                  </div>

                  {/* Real-time Reconciliation Progress HUD */}
                  {reconcileProgress.active && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-fadeIn">
                      <div className="flex justify-between items-center text-xs font-black text-amber-900 dark:text-amber-200">
                        <span>⏳ Reconciling Record {reconcileProgress.current} of {reconcileProgress.total} ({reconcileProgress.percent}%)</span>
                        {reconcileProgress.stats && (
                          <span className="text-[11px]">
                            ✅ Matched: {reconcileProgress.stats.matchedCount} • Updated: {reconcileProgress.stats.updatedCount}
                          </span>
                        )}
                      </div>
                      <div className="w-full h-2.5 bg-amber-950/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-150 rounded-full"
                          style={{ width: `${reconcileProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold leading-relaxed">
                  Bulk upload processed passport photos (naming format: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-purple-700 dark:text-purple-300">Class_Session_RegNo_Name.jpg</code>). The system automatically compresses images in-browser to ~5–10 KB JPEGs and syncs them directly to Cloud Firestore.
                </p>

                {/* File Picker */}
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoBatchSelect}
                    className="hidden"
                    id="photoBatchInput"
                  />
                  <label htmlFor="photoBatchInput" className="cursor-pointer flex flex-col items-center justify-center space-y-1">
                    <Upload size={24} className="text-amber-600" />
                    <span className="font-black text-xs text-slate-900 dark:text-white">
                      Click to Choose or Drag Optimized Student Photos
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      Supports JPG, JPEG, PNG • Select multiple photos at once
                    </span>
                  </label>
                </div>

                {/* Match Results Preview */}
                {photoMatchResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span>Selected Files: {photoMatchResults.length}</span>
                      <span className="text-teal-700 dark:text-teal-400">
                        ✅ Matched Records: {photoMatchResults.filter(m => m.matchedStudent).length}
                      </span>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                      {photoMatchResults.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                          <span className="truncate max-w-[240px] text-slate-700 dark:text-slate-300">{item.file.name}</span>
                          {item.matchedStudent ? (
                            <span className="text-teal-700 dark:text-teal-400 font-black flex items-center gap-1">
                              <Check size={12} /> {item.matchedStudent.studentName} ({item.matchedStudent.class})
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-black">❌ No Matching Record</span>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={batchSyncingPhotos || !photoMatchResults.some(m => m.matchedStudent)}
                      onClick={handleRunBatchPhotoSync}
                      className="w-full py-3 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 disabled:opacity-50 shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      {batchSyncingPhotos ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Compressing & Syncing to Cloud Firestore...</span>
                        </>
                      ) : (
                        <>
                          <Camera size={14} />
                          <span>Compress & Sync {photoMatchResults.filter(m => m.matchedStudent).length} Photos to Cloud Firestore</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tool Content: PDF Drive Backup */}
            {activeToolsTab === 'drive_backup' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap gap-2">
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers size={18} className="text-indigo-600" />
                      Google Drive Class-Wise Application PDF Backup Hub
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs font-bold mt-0.5">
                      Organize all student application PDFs into class-wise and session-wise Google Drive backup folders.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 space-y-2 text-xs">
                  <div className="font-extrabold text-indigo-700 dark:text-indigo-400">Cloud Storage Architecture:</div>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-700 dark:text-slate-300 font-bold">
                    <li>Target Storage: <strong>Official School Google Drive</strong></li>
                    <li>Automated Hierarchy: <strong>HSS_Admissions_Backup &gt; [Class 9th–12th] &gt; [Session]</strong></li>
                    <li>Includes: <strong>Generated Application PDFs with photographs, QR codes, and Undertakings</strong></li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isBackingUpPdfs}
                    onClick={handleBackupPdfsToDrive}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs transition-all"
                  >
                    {isBackingUpPdfs ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Organizing & Syncing PDFs to Google Drive...</span>
                      </>
                    ) : (
                      <>
                        <Download size={15} />
                        <span>Start Class-Wise PDF Google Drive Backup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Photo Preview Modal Popup */}
      {previewPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn"
          onClick={() => setPreviewPhotoModal(null)}
        >
          <div
            className="relative w-full max-w-xs sm:max-w-sm p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl space-y-4 text-center animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewPhotoModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X size={18} />
            </button>

            <h3 className="font-black text-xs uppercase tracking-widest text-amber-800 dark:text-amber-400">
              📸 Student Photo Preview
            </h3>

            {/* Photo Display */}
            <div className="relative mx-auto w-44 h-56 rounded-2xl border-4 border-amber-500/50 overflow-hidden shadow-xl bg-slate-950 flex items-center justify-center">
              <img
                src={previewPhotoModal.url}
                alt={previewPhotoModal.name || "Student Photo"}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Student Info Metadata */}
            <div className="space-y-1.5 bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <p className="font-black text-sm text-slate-900 dark:text-white">{previewPhotoModal.name || 'Student Record'}</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-extrabold">
                {previewPhotoModal.class && (
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-amber-300">Class: {previewPhotoModal.class}</span>
                )}
                {previewPhotoModal.rollNo && (
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-amber-300">Roll: {previewPhotoModal.rollNo}</span>
                )}
                {previewPhotoModal.admNo && (
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-amber-300">Adm: {previewPhotoModal.admNo}</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <a
                href={previewPhotoModal.url}
                download={`${previewPhotoModal.name || 'Student'}_Photo.png`}
                className="w-full py-2.5 rounded-xl font-extrabold text-xs text-white bg-teal-700 hover:bg-teal-600 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download size={14} /> Download Photo
              </a>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                className="px-4 py-2.5 rounded-xl font-extrabold text-xs text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors border border-slate-300 dark:border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Full Student Field Editor Modal */}
      {editingStudent && (
        <AdminStudentEditModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={handleSaveStudentEdit}
          isSaving={isSavingEdit}
          restrictedCols={restrictedCols}
        />
      )}

      {/* Quick Cell Edit Modal */}
      {quickEditCell && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black">
                <Edit3 size={16} />
                <span className="text-xs sm:text-sm">Quick Edit: {quickEditCell.column.label}</span>
              </div>
              <button
                type="button"
                disabled={isSavingQuickEdit}
                onClick={() => setQuickEditCell(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="text-[11px] text-slate-500 font-extrabold flex items-center justify-between">
                <span>Student: <strong className="text-slate-900 dark:text-white font-black">{quickEditCell.student.studentName || 'Student'}</strong></span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Form #{quickEditCell.student.formNo || quickEditCell.student['Form Number'] || '—'}
                </span>
              </div>

              {/* Progress & Stage Animation View when Saving */}
              {isSavingQuickEdit ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {quickEditProgress >= 100 ? (
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 animate-bounce" />
                      ) : (
                        <Loader2 size={16} className="text-amber-600 dark:text-amber-400 animate-spin" />
                      )}
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[190px]">
                        {quickEditStage || 'Syncing changes...'}
                      </span>
                    </div>
                    <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-300">
                      {quickEditProgress}%
                    </span>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out ${
                        quickEditProgress >= 100
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600'
                      }`}
                      style={{ width: `${quickEditProgress}%` }}
                    />
                  </div>

                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Firestore live write & cache update</span>
                    <span>Admin Audit Logged</span>
                  </div>
                </div>
              ) : (
                <>
                  {quickEditCell.column.key === 'gender' ? (
                    <select
                      autoFocus
                      defaultValue={quickEditCell.currentValue || 'Male'}
                      id="quickEditInput"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : quickEditCell.column.key === 'category' ? (
                    <select
                      autoFocus
                      defaultValue={quickEditCell.currentValue || 'General'}
                      id="quickEditInput"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="General">General</option>
                      <option value="RBA">RBA</option>
                      <option value="ST">ST</option>
                      <option value="SC">SC</option>
                      <option value="OBC">OBC</option>
                      <option value="EWS">EWS</option>
                    </select>
                  ) : quickEditCell.column.key === 'status' ? (
                    <select
                      autoFocus
                      defaultValue={quickEditCell.currentValue || 'Submitted'}
                      id="quickEditInput"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="Submitted">Submitted (SUBM)</option>
                      <option value="Approved">Approved (APPR)</option>
                      <option value="Provisional">Provisional</option>
                      <option value="Draft">Draft</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      autoFocus
                      defaultValue={quickEditCell.currentValue}
                      id="quickEditInput"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.target.value;
                          handleSaveQuickCellEdit(quickEditCell.student, quickEditCell.column.key, val);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs font-mono"
                    />
                  )}

                  {/* Audit Reason Toggle & Selector */}
                  <div className="pt-1 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowQuickEditReason(!showQuickEditReason)}
                      className="text-[11px] font-black text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FileText size={12} />
                      <span>{showQuickEditReason ? 'Hide Audit Log Details' : 'Add Audit Log Reason (Optional)'}</span>
                    </button>

                    {showQuickEditReason && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 animate-fadeIn">
                        <select
                          value={quickEditReasonCategory}
                          onChange={(e) => setQuickEditReasonCategory(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold text-[11px] text-slate-800 dark:text-slate-200"
                        >
                          <option value="Routine Data Update & Correction">📋 Routine Data Update & Correction</option>
                          <option value="Student Request / Grievance Resolution">✏️ Student Request / Grievance Resolution</option>
                          <option value="Official Record Verification">📄 Official Record Verification</option>
                          <option value="Administrative Audit & Cleanup">⚙️ Administrative Audit & Cleanup</option>
                          <option value="Custom Justification">✍️ Custom Justification...</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Custom note (e.g. As per Principal directive)..."
                          value={quickEditCustomReason}
                          onChange={(e) => setQuickEditCustomReason(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-[11px] text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={isSavingQuickEdit}
                onClick={() => setQuickEditCell(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingQuickEdit}
                onClick={() => {
                  const el = document.getElementById('quickEditInput');
                  const val = el ? el.value : '';
                  handleSaveQuickCellEdit(quickEditCell.student, quickEditCell.column.key, val);
                }}
                className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingQuickEdit ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={13} />
                    <span>Save & Sync</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Express Admin Student Record Ingestion Modal */}
      <DirectIngestionModal
        isOpen={showDirectIngestionModal}
        onClose={() => setShowDirectIngestionModal(false)}
        onRecordAdded={handleDirectRecordAdded}
        allStudents={allStudents.length > 0 ? allStudents : currentAdmissions}
      />

      {/* Analytics & Statistical Reports Suite Modal */}
      <AnalyticsSuiteModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        students={allStudents.length > 0 ? allStudents : currentAdmissions}
      />

      {/* 2-Stage Application Deletion Modal */}
      <DeleteApplicationModal
        isOpen={!!deletingStudentTarget}
        onClose={() => setDeletingStudentTarget(null)}
        student={deletingStudentTarget}
        currentAdmissions={currentAdmissions}
        userEmail={user?.email || 'Admin'}
        onDeleteSuccess={(deletedRecords) => {
          if (Array.isArray(deletedRecords)) {
            deletedRecords.forEach(rec => handleRecordDeleted(rec));
          }
          // Force cache invalidation so stale deleted records don't reload
          // Live admissions listener updates both parent and table state.
        }}
      />

      {/* 90-Day Recycle Bin & Restoration Modal */}
      <RecycleBinModal
        isOpen={showRecycleBinModal}
        onClose={() => setShowRecycleBinModal(false)}
        onRestoreSuccess={() => {
          // Live admissions listener refreshes restored records without a full scan.
        }}
      />

      {/* Reusable Custom Confirmation Modal */}
      {confirmModalConfig && (
        <ConfirmDialogModal
          {...confirmModalConfig}
          loading={isSavingEdit || isSavingQuickEdit || bulkTableActionBusy}
          onClose={() => setConfirmModalConfig(null)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[10001] px-5 py-3.5 rounded-2xl font-black text-xs shadow-2xl border flex items-center gap-2 animate-bounce ${toast.type === 'error'
          ? 'bg-rose-950 text-rose-100 border-rose-700 shadow-rose-950/50'
          : 'bg-emerald-950 text-emerald-100 border-emerald-700 shadow-emerald-950/50'
          }`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
