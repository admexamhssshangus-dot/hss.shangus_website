/**
 * StudentIdCardManager.jsx — Complete Student Identity Card Suite
 * Govt. Higher Secondary School Shangus
 *
 * Features:
 * 1. Always-Visible Prominent Print Controls (No right-edge clipping or hidden print buttons!)
 * 2. Dynamic Card Sizing & Automatic Sheet Capacity Calculator (CR80, Compact, Badge, Custom mm)
 * 3. Visual Seal & Signature Placement Positioning on a Sample Card
 * 4. Comprehensive QR Code payload with all essential student details
 * 5. Multi-Class Student Loading (11th, 12th, 10th, 9th, and All Classes)
 * 6. Multi-Collection Firestore Data Pipeline (admissions, students, masterRegisters)
 * 7. Dual Orientation (Portrait A4 & Landscape A4) with clean centered fit
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Printer, CheckSquare, Square, Eye, RefreshCw, X,
  Shield, Check, ArrowLeftRight, Grid,
  Upload, Save, Sliders, ChevronDown, ChevronUp, Layers, RotateCcw, CheckCircle, Filter, Palette
} from 'lucide-react';
import ModernLoader from '../../components/ModernLoader';
import {
  ID_CARD_THEMES,
  resolveClassTheme,
  normalizeStudentClass,
  abbreviateSubjectName,
  getStudentRollVal,
  getStudentStreamVal,
  getIdCardSubjectText,
  generateVerificationQrUrl,
  filterIdCardStudents,
  getIdCardStudentKey,
  paginateIdCardStudents,
  selectIdCardStudents
} from '../../utils/idCardRenderer';
import { compressImageFile } from '../../utils/imageCompressor';
import { fetchStudentPhotoOnDemand, getCachedCollectionSync, resolveStudentPhoto as resolveCanonicalStudentPhoto } from '../../services/dbCache';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function preloadPhotoWithTimeout(photoUrl, timeoutMs = 6000) {
  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = success => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(success);
    };
    const timeout = setTimeout(() => finish(false), timeoutMs);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.referrerPolicy = 'no-referrer';
    image.src = photoUrl;
  });
}

/**
 * ─── UNIVERSAL PHOTO DISPLAY URL FORMATTER ───
 * Strictly formats Native Base64 and Firebase Storage URLs, rejecting Google Drive links
 */
export function formatPhotoDisplayUrl(val) {
  if (!val || typeof val !== 'string') return '';
  const str = val.trim();
  if (
    !str ||
    str === '—' ||
    str === 'N/A' ||
    str === 'null' ||
    str === 'undefined' ||
    str === '/logo.png' ||
    str.includes('drive.google.com') ||
    str.includes('docs.google.com') ||
    str.includes('googleusercontent.com') ||
    /^[A-Za-z0-9_-]{25,45}$/.test(str)
  ) {
    return '';
  }

  // 1. Native Firestore / Data URL Base64 image
  if (str.startsWith('data:image/') || str.startsWith('data:application/octet-stream;base64')) {
    return str;
  }
  // Raw Base64 string without data: prefix (e.g. /9j/4AAQSkZJRg... or long base64 string)
  if (str.startsWith('/9j/') || str.startsWith('iVBORw') || /^[A-Za-z0-9+/=]{100,}$/.test(str)) {
    return `data:image/jpeg;base64,${str}`;
  }

  // 2. Firebase Storage or standard web image URLs (excluding Google Drive)
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
    return str;
  }

  return '';
}

/**
 * ─── 100% UNSTRIPPED PHOTO RESOLVER ───
 * Cross-references student object and cache across all collections and field names
 */
const extractRawPhoto = student => student && (
  student.photo_id || student.photoId || student['Student Photo'] ||
  student['Student Photograph'] || student['Student Photo URL'] ||
  student.Photo || student.photoUrl || student.photo || ''
);

function getPhotoLookupKeys(student) {
  const normalize = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const className = normalizeStudentClass(student['Admission sought for class'] || student.Class || student.class);
  const band = ['9th', '10th'].includes(className) ? 'secondary' : ['11th', '12th'].includes(className) ? 'higher' : className;
  const registration = normalize(student['Board Registration Number'] || student.boardRegNo || student.regNo);
  const formNumber = normalize(student['Form Number'] || student['Form No.'] || student.formNo);
  const session = normalize(student.Session || student.session);
  const documentId = student.id || student.docId || student._docId;
  return [
    documentId ? `id:${documentId}` : null,
    registration && band ? `reg:${band}:${registration}` : null,
    formNumber && session && className ? `form:${session}:${className}:${formNumber}` : null,
  ].filter(Boolean);
}

function buildPhotoIndex(students) {
  const index = new Map();
  students.forEach(student => {
    const photo = formatPhotoDisplayUrl(extractRawPhoto(student));
    if (!photo) return;
    getPhotoLookupKeys(student).forEach(key => {
      // Conflicting identity matches are intentionally not guessed.
      if (index.has(key) && index.get(key) !== photo) index.set(key, null);
      else if (!index.has(key)) index.set(key, photo);
    });
  });
  return index;
}

function resolveStudentPhoto(student, photoIndex = new Map()) {
  if (!student) return '/logo.png';
  const direct = formatPhotoDisplayUrl(extractRawPhoto(student));
  if (direct) return direct;
  for (const key of getPhotoLookupKeys(student)) {
    const photo = photoIndex.get(key);
    if (photo) return photo;
  }
  return formatPhotoDisplayUrl(resolveCanonicalStudentPhoto(student)) || '/logo.png';
}

export default function StudentIdCardManager({ students = [], onClose }) {
  // ─── Live Data Fetching & Sync across all classes ───
  const [liveStudents, setLiveStudents] = useState(() => {
    if (Array.isArray(students) && students.length > 0) return students;
    return getCachedCollectionSync('admissions') || [];
  });

  // The parent hydrates admissions progressively. Keep this module in sync
  // without launching its own full-collection reads.
  useEffect(() => {
    if (!Array.isArray(students)) return;
    React.startTransition(() => setLiveStudents(students));
  }, [students]);

  const photoIndex = useMemo(() => buildPhotoIndex(liveStudents), [liveStudents]);

  // ─── Settings Memory (localStorage Persistence) ───
  const SETTINGS_KEY = 'hss_id_card_suite_settings_v2';
  const SEAL_LOCAL_KEY = 'hss_seal_and_signature_config_v2';
  const loadSavedSettings = () => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  };
  const [initialSettings] = useState(loadSavedSettings);

  // ─── Card Sizing & Sheet Capacity Settings (Default LANDSCAPE & 5 COLS × 2 ROWS = 10 Cards/Sheet) ───
  const [cardWidthMm, setCardWidthMm] = useState(initialSettings?.cardWidthMm ?? 56.0); // mm (5 Cols fit on Landscape A4)
  const [cardHeightMm, setCardHeightMm] = useState(initialSettings?.cardHeightMm ?? 92.0); // 92mm height ensures 2 rows (10 cards) fit 100% on 1 A4 page
  const [paperMarginMm, setPaperMarginMm] = useState(initialSettings?.paperMarginMm ?? 3.0); // mm
  const [cardGapMm, setCardGapMm] = useState(initialSettings?.cardGapMm ?? 2.0); // mm
  const [paperOrientation, setPaperOrientation] = useState(initialSettings?.paperOrientation ?? 'landscape'); // DEFAULT LANDSCAPE
  const [showSizeCalculator, setShowSizeCalculator] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false); // DEFAULT HIDDEN
  const [cols, setCols] = useState(initialSettings?.cols ?? 5); // DEFAULT 5 COLUMNS
  const [rows, setRows] = useState(initialSettings?.rows ?? 2); // DEFAULT 2 ROWS
  const [isCustomGrid, setIsCustomGrid] = useState(initialSettings?.isCustomGrid ?? false); // DEFAULT AUTO-FIT MATH (false)
  const [photoWidthPx, setPhotoWidthPx] = useState(initialSettings?.photoWidthPx ?? 72);
  const [photoHeightPx, setPhotoHeightPx] = useState(initialSettings?.photoHeightPx ?? 86);
  const [qrSizePx, setQrSizePx] = useState(initialSettings?.qrSizePx ?? 72);

  // ─── Primary Filters ───
  const [selectedClass, setSelectedClass] = useState(initialSettings?.selectedClass ?? 'All');
  const [selectedStream, setSelectedStream] = useState(initialSettings?.selectedStream ?? 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [printPageRange, setPrintPageRange] = useState(initialSettings?.printPageRange ?? 'all');

  // ─── Range Selection & Fast Cache Generation States ───
  const [rangeMode, setRangeMode] = useState(initialSettings?.rangeMode ?? 'all'); // 'all' or 'range'
  const [rangeFrom, setRangeFrom] = useState(initialSettings?.rangeFrom ?? 1);
  const [rangeTo, setRangeTo] = useState(initialSettings?.rangeTo ?? 30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchNotice, setBatchNotice] = useState('');
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, percent: 0, status: '' });

  // ─── Advanced Filters & Theme State ───
  const [selectedSession, setSelectedSession] = useState(initialSettings?.selectedSession ?? 'All');
  const [selectedStatus, setSelectedStatus] = useState(initialSettings?.selectedStatus === 'All' ? 'All' : 'Approved');
  const [printMode, setPrintMode] = useState(initialSettings?.printMode ?? 'normal');
  const [selectedTheme, setSelectedTheme] = useState(initialSettings?.selectedTheme ?? 'classified');
  const [classThemes, setClassThemes] = useState(() => {
    return initialSettings?.classThemes ?? {
      '11th_Science': 'cobalt',
      '11th_Arts': 'navy',
      '11th_Commerce': 'amber',
      '12th_Science': 'emerald',
      '12th_Arts': 'burgundy',
      '12th_Commerce': 'amber',
      '10th': 'purple',
      '9th': 'purple',
    };
  });
  const [themeModalTab, setThemeModalTab] = useState('classified'); // 'classified' | 'presets'
  const [includeBackSide, setIncludeBackSide] = useState(initialSettings?.includeBackSide ?? false);
  const [showCropMarks, setShowCropMarks] = useState(initialSettings?.showCropMarks ?? true);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const cancelGenerationRef = useRef(false);
  const generationIdRef = useRef(0);

  useEffect(() => () => {
    cancelGenerationRef.current = true;
    generationIdRef.current += 1;
    document.body.classList.remove('id-card-print-mode');
  }, []);

  const handleCancelGeneration = () => {
    cancelGenerationRef.current = true;
    generationIdRef.current += 1;
    setIsGenerating(false);
    setIsPrintingActive(false);
  };

  // Auto-save settings to localStorage whenever config changes
  useEffect(() => {
    const settingsToSave = {
      cardWidthMm,
      cardHeightMm,
      paperMarginMm,
      cardGapMm,
      paperOrientation,
      selectedClass,
      selectedStream,
      printPageRange,
      selectedSession,
      selectedStatus,
      selectedTheme,
      classThemes,
      includeBackSide,
      showCropMarks,
      cols,
      rows,
      isCustomGrid,
      photoWidthPx,
      photoHeightPx,
      qrSizePx
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
    } catch (e) {}
  }, [
    cardWidthMm, cardHeightMm, paperMarginMm, cardGapMm, paperOrientation,
    selectedClass, selectedStream, printPageRange, selectedSession,
    selectedStatus, selectedTheme, classThemes, includeBackSide, showCropMarks,
    cols, rows, isCustomGrid, photoWidthPx, photoHeightPx, qrSizePx
  ]);

  // Custom Selection Checkbox Set
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [hasManuallySelected, setHasManuallySelected] = useState(false);

  // Single Card Preview Modal
  const [previewStudent, setPreviewStudent] = useState(null);

  // ─── Principal Seal & Signature Config (With 3-Preset History & 15KB Ceilings) ───
  const SEAL_HISTORY_KEY = 'hss_seal_and_signature_history_v3';

  const DEFAULT_SEAL_SET = {
    id: 'default_set_1',
    label: 'Official Set 1 (Default)',
    principalSignatureUrl: '/sig.png',
    schoolSealUrl: '/seal.png',
    principalName: 'Sheikh Gulfam',
    principalTitle: 'Principal • HSS Shangus',
    officeContact: '7006912918 | 9682641216',
    schoolLocation: 'ANANTNAG KMR-192201',
    sessionLabel: '2025-26',
    sigPosition: 'bottom-right',
    sigOffsetX: 2,
    sigOffsetY: 10,
    sigWidth: 40,
    sigOpacity: 0.95,
    sealPosition: 'bottom-right',
    sealOffsetX: 2,
    sealOffsetY: 2,
    sealWidth: 58,
    sealRotation: -8,
    sealOpacity: 0.85,
    sigSealOverlapPct: 40
  };

  const [sealHistory, setSealHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(SEAL_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 3);
      }
    } catch (e) {}
    return [DEFAULT_SEAL_SET];
  });

  const [sealConfig, setSealConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(SEAL_LOCAL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.principalSignatureUrl || parsed.schoolSealUrl || parsed.principalName)) {
          return { ...DEFAULT_SEAL_SET, ...parsed };
        }
      }
    } catch (e) {}
    return DEFAULT_SEAL_SET;
  });

  const [showSealModal, setShowSealModal] = useState(false);
  const [isSavingSealConfig, setIsSavingSealConfig] = useState(false);
  const [sealSavedSuccess, setSealSavedSuccess] = useState(false);

  // Helper to calculate base64 image size in KB
  const getImageKbSize = (base64Str) => {
    if (!base64Str) return 0;
    const stringLength = base64Str.length - (base64Str.indexOf(',') + 1);
    return Math.round((stringLength * 3 / 4) / 1024 * 10) / 10;
  };

  useEffect(() => {
    // Load seal config from Firestore (1 read, small doc)
    const loadSealConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'systemSettings', 'idCardConfig'));
        if (snap.exists()) {
          const merged = { ...snap.data() };
          setSealConfig(prev => {
            const next = { ...prev, ...merged };
            try { localStorage.setItem(SEAL_LOCAL_KEY, JSON.stringify(next)); } catch(e){}
            return next;
          });
        }
      } catch (e) {
        console.warn('ID Card settings read note:', e);
      }
    };
    loadSealConfig();
  }, []);

  const handleSaveSealConfig = async () => {
    setIsSavingSealConfig(true);
    let savedLocally = false;
    try {
      localStorage.setItem(SEAL_LOCAL_KEY, JSON.stringify(sealConfig));
      savedLocally = true;
      
      // Update history with active config (strictly max 3 sets)
      setSealHistory(prev => {
        const newSet = {
          id: `set_${Date.now()}`,
          label: `Set (${sealConfig.principalName || 'Principal'})`,
          ...sealConfig,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const updated = [newSet, ...prev.filter(item => item.id !== newSet.id)].slice(0, 3);
        try { localStorage.setItem(SEAL_HISTORY_KEY, JSON.stringify(updated)); } catch(e){}
        return updated;
      });

      await setDoc(doc(db, 'systemSettings', 'idCardConfig'), {
        ...sealConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSealSavedSuccess(true);
      setTimeout(() => {
        setSealSavedSuccess(false);
        setShowSealModal(false);
      }, 1200);
    } catch (e) {
      console.error('Failed to save ID card settings:', e);
      alert(savedLocally
        ? `Settings were saved locally, but cloud synchronization failed: ${e.message}`
        : `Settings could not be saved: ${e.message}`);
    } finally {
      setIsSavingSealConfig(false);
    }
  };

  // Image Upload with Strict <= 15 KB Ceiling Compression
  const handleUploadImage = async (field, file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      alert('Please choose a valid image file.');
      return;
    }
    try {
      let maxDim = 300;
      let quality = 0.80;
      let base64 = await compressImageFile(file, maxDim, maxDim, quality);
      
      let kb = getImageKbSize(base64);
      if (kb > 15) {
        maxDim = 230;
        quality = 0.65;
        base64 = await compressImageFile(file, maxDim, maxDim, quality);
        kb = getImageKbSize(base64);
      }
      if (kb > 15) {
        maxDim = 170;
        quality = 0.50;
        base64 = await compressImageFile(file, maxDim, maxDim, quality);
        kb = getImageKbSize(base64);
      }
      if (kb > 15) {
        maxDim = 120;
        quality = 0.35;
        base64 = await compressImageFile(file, maxDim, maxDim, quality);
        kb = getImageKbSize(base64);
      }

      if (kb > 15) throw new Error(`Compressed image is still ${kb} KB; the limit is 15 KB.`);

      setSealConfig(prev => ({ ...prev, [field]: base64 }));
    } catch (e) {
      console.warn('Image compression note:', e);
      alert(`Could not prepare this image: ${e.message}`);
    }
  };

  // ─── Mathematical Sheet Fit & Capacity Calculation ───
  const sheetSpecs = useMemo(() => {
    const sheetW = paperOrientation === 'landscape' ? 297 : 210;
    const sheetH = paperOrientation === 'landscape' ? 210 : 297;
    const availableW = Math.max(10, sheetW - (2 * paperMarginMm));
    const availableH = Math.max(10, sheetH - (2 * paperMarginMm));

    const maxCols = Math.max(1, Math.floor((availableW + cardGapMm) / (cardWidthMm + cardGapMm)));
    const maxRows = Math.max(1, Math.floor((availableH + cardGapMm) / (cardHeightMm + cardGapMm)));
    const totalPerPage = maxCols * maxRows;

    const usedW = (maxCols * cardWidthMm) + ((maxCols - 1) * cardGapMm);
    const usedH = (maxRows * cardHeightMm) + ((maxRows - 1) * cardGapMm);

    return {
      sheetW,
      sheetH,
      availableW: availableW.toFixed(1),
      availableH: availableH.toFixed(1),
      maxCols,
      maxRows,
      totalPerPage,
      usedW: usedW.toFixed(1),
      usedH: usedH.toFixed(1),
      excessW: Math.max(0, availableW - usedW).toFixed(1),
      excessH: Math.max(0, availableH - usedH).toFixed(1)
    };
  }, [paperOrientation, paperMarginMm, cardGapMm, cardWidthMm, cardHeightMm]);

  useEffect(() => {
    if (!isCustomGrid) {
      setCols(sheetSpecs.maxCols);
      setRows(sheetSpecs.maxRows);
    }
  }, [sheetSpecs.maxCols, sheetSpecs.maxRows, isCustomGrid]);

  const [resetNotice, setResetNotice] = useState(false);

  const handleApplyPreset = (w, h, name) => {
    setCardWidthMm(w);
    setCardHeightMm(h);
    setIsCustomGrid(false);
  };

  const handleResetToDefaults = () => {
    setPaperOrientation('landscape'); // DEFAULT LANDSCAPE
    setCardWidthMm(56.0); // 56mm width fits 5 columns cleanly on Landscape A4
    setCardHeightMm(92.0); // 92mm height fits 2 rows cleanly without overflowing A4 height
    setPaperMarginMm(3.0);
    setCardGapMm(2.0);
    setCols(5); // DEFAULT 5 COLUMNS
    setRows(2); // DEFAULT 2 ROWS
    setIsCustomGrid(false); // DEFAULT AUTO-FIT MATH (false)
    setPhotoWidthPx(72);
    setPhotoHeightPx(86);
    setQrSizePx(72);
    setSelectedClass('All');
    setSelectedStream('All');
    setSearchQuery('');
    setPrintPageRange('all');
    setSelectedSession('All');
    setSelectedStatus('Approved');
    setPrintMode('normal');
    setSelectedTheme('auto');
    setIncludeBackSide(false);
    setShowCropMarks(true);
    setSelectedStudentIds(new Set());
    setHasManuallySelected(false);
    setShowSizeCalculator(false);
    setShowFiltersPanel(false);

    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (e) {}

    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 2500);
  };

  const availableClasses = useMemo(() => {
    const classCountMap = new Map();
    (liveStudents || []).forEach(st => {
      const cls = normalizeStudentClass(st['Admission sought for class'] || st['Class'] || st.class || 'Other');
      classCountMap.set(cls, (classCountMap.get(cls) || 0) + 1);
    });

    return Array.from(classCountMap.entries()).map(([className, count]) => ({
      value: className,
      label: `Class ${className} (${count})`,
      count
    })).sort((a, b) => b.count - a.count);
  }, [liveStudents]);

  const availableSessions = useMemo(() => {
    const counts = new Map();
    (liveStudents || []).forEach(student => {
      const session = String(student.Session || student.session || '').trim();
      if (session) counts.set(session, (counts.get(session) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.value.localeCompare(a.value, undefined, { numeric: true }));
  }, [liveStudents]);

  const availableStreams = useMemo(() => {
    const streamCountMap = new Map();
    (liveStudents || []).forEach(st => {
      const cls = normalizeStudentClass(st['Admission sought for class'] || st['Class'] || st.class);
      if (selectedClass !== 'All' && cls !== selectedClass) return;

      const raw = getStudentStreamVal(st).trim();
      if (!raw || raw === 'null' || raw === '—' || raw === 'undefined') return;

      const count = streamCountMap.get(raw) || 0;
      streamCountMap.set(raw, count + 1);
    });

    return Array.from(streamCountMap.entries()).map(([streamName, count]) => ({
      value: streamName,
      label: `${streamName} (${count})`,
      count
    })).sort((a, b) => b.count - a.count);
  }, [liveStudents, selectedClass]);

  const filteredStudents = useMemo(() => {
    return filterIdCardStudents(liveStudents, {
      session: selectedSession,
      className: selectedClass,
      stream: selectedStream,
      status: selectedStatus,
      search: searchQuery,
    });
  }, [liveStudents, selectedSession, selectedClass, selectedStream, selectedStatus, searchQuery]);

  useEffect(() => {
    setSelectedStudentIds(new Set());
    setHasManuallySelected(false);
  }, [selectedSession, selectedClass, selectedStream, selectedStatus, searchQuery]);

  const allFilteredSelected = filteredStudents.length > 0 && (
    !hasManuallySelected || filteredStudents.every((student, index) => selectedStudentIds.has(getIdCardStudentKey(student, index)))
  );

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedStudentIds(new Set());
      setHasManuallySelected(true);
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((student, index) => getIdCardStudentKey(student, index))));
      setHasManuallySelected(true);
    }
  };

  const handleToggleStudent = (id) => {
    setHasManuallySelected(true);
    const next = hasManuallySelected
      ? new Set(selectedStudentIds)
      : new Set(filteredStudents.map((student, index) => getIdCardStudentKey(student, index)));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const targetStudents = useMemo(() => {
    return selectIdCardStudents(filteredStudents, selectedStudentIds, hasManuallySelected, rangeMode, rangeFrom, rangeTo);
  }, [filteredStudents, selectedStudentIds, hasManuallySelected, rangeMode, rangeFrom, rangeTo]);

  // ─── Print Active Flag for Lightweight Dashboard Preview ───
  const [isPrintingActive, setIsPrintingActive] = useState(false);

  const cardsPerPage = Math.max(1, cols * rows);
  const pages = useMemo(() => {
    return paginateIdCardStudents(targetStudents, cardsPerPage);
  }, [targetStudents, cardsPerPage]);

  const displayPages = useMemo(() => {
    // When executing print, return ALL pages for target range
    if (isPrintingActive) {
      if (printPageRange === '1') return pages.slice(0, 1);
      if (printPageRange === '1-3') return pages.slice(0, 3);
      if (printPageRange === '1-5') return pages.slice(0, 5);
      return pages;
    }
    // On-Screen Dashboard View: Limit preview to ONLY 1 Sample Page (First 10 Students / 1 A4 Sheet)
    return pages.slice(0, 1);
  }, [pages, printPageRange, isPrintingActive]);

  // ─── Duplex Alignment Helper: Mirrors Grid Columns per Row for Back Side Alignment ───
  const mirrorGridForDuplex = (studentsList, colsCount) => {
    const mirrored = [];
    for (let i = 0; i < studentsList.length; i += colsCount) {
      const rowChunk = studentsList.slice(i, i + colsCount);
      const fullRow = Array(colsCount).fill(null);
      for (let c = 0; c < rowChunk.length; c++) {
        fullRow[colsCount - 1 - c] = rowChunk[c];
      }
      mirrored.push(...fullRow);
    }
    return mirrored;
  };

  // ─── Fast Cache Photo Pre-Loader & Automatic Print Launcher ───
  const handleGenerateAndPrint = async () => {
    if (targetStudents.length === 0 || isGenerating) return;
    const generationId = ++generationIdRef.current;
    const isCancelled = () => cancelGenerationRef.current || generationId !== generationIdRef.current;
    cancelGenerationRef.current = false;
    setIsPrintingActive(true);
    setIsGenerating(true);
    setBatchNotice('');
    const pageLimit = printPageRange === '1' ? 1 : printPageRange === '1-3' ? 3 : printPageRange === '1-5' ? 5 : null;
    const generationStudents = pageLimit
      ? targetStudents.slice(0, pageLimit * cardsPerPage)
      : targetStudents;
    const total = generationStudents.length;
    const hydratedPhotos = new Map();
    let completed = 0;
    let missingPhotos = 0;

    setGenerationProgress({
      current: 0,
      total,
      percent: 0,
      status: `Fetching details & pre-warming photos for ${total} ID cards...`
    });

    await new Promise(r => setTimeout(r, 100));

    const prepareStudent = async (i) => {
      if (isCancelled()) return;
      const st = generationStudents[i];
      const studentKey = getIdCardStudentKey(st, i);
      let photoUrl = resolveStudentPhoto(st, photoIndex);

      if (!photoUrl || photoUrl === '/logo.png' || photoUrl === '—') {
        try {
          const fetchedPhoto = await fetchStudentPhotoOnDemand(st);
          const formattedPhoto = formatPhotoDisplayUrl(fetchedPhoto);
          if (formattedPhoto && formattedPhoto !== '/logo.png') {
            photoUrl = formattedPhoto;
            hydratedPhotos.set(studentKey, formattedPhoto);
          }
        } catch (error) {
          console.warn('[IDCards] Targeted photo lookup note:', error);
        }
      }

      if (isCancelled()) return;
      if (photoUrl && photoUrl !== '/logo.png') {
        const loaded = await preloadPhotoWithTimeout(photoUrl);
        if (!loaded) {
          missingPhotos += 1;
          hydratedPhotos.set(studentKey, '/logo.png');
        }
      } else if (!photoUrl || photoUrl === '/logo.png' || photoUrl === '—') {
        missingPhotos += 1;
      }

      if (isCancelled()) return;
      completed += 1;
      const percent = Math.round((completed / total) * 100);
      setGenerationProgress({
        current: completed,
        total,
        percent,
        status: `Prepared ${completed} of ${total} ID cards (${percent}%)...`
      });
    };

    // Four bounded workers substantially reduce large-batch preparation time
    // without flooding Firestore or the browser's image decoder.
    let nextIndex = 0;
    const worker = async () => {
      while (!isCancelled()) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= total) return;
        await prepareStudent(index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, total) }, () => worker()));

    if (isCancelled()) return;

    if (hydratedPhotos.size > 0) {
      setLiveStudents(prev => prev.map((student, index) => {
        const key = getIdCardStudentKey(student, index);
        const photo = hydratedPhotos.get(key);
        return photo ? { ...student, photo_id: photo } : student;
      }));
    }

    if (isCancelled()) return;

    setGenerationProgress({
      current: total,
      total,
      percent: 100,
      status: missingPhotos > 0
        ? `Layout prepared with ${missingPhotos} missing photo${missingPhotos === 1 ? '' : 's'} replaced by the school crest.`
        : 'Layout & photos 100% prepared! Launching print preview...'
    });
    if (missingPhotos > 0) {
      setBatchNotice(`${missingPhotos} card${missingPhotos === 1 ? '' : 's'} could not load a student photo. Review the school-crest placeholders before issuing these cards.`);
    }

    await new Promise(r => setTimeout(r, 300));
    if (isCancelled()) return;
    setIsGenerating(false);

    // Trigger print mode instantly
    handlePrint();
  };

  const handlePrint = () => {
    setIsPrintingActive(true);
    document.body.classList.add('id-card-print-mode');
    const cleanup = () => {
      document.body.classList.remove('id-card-print-mode');
      setIsPrintingActive(false);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1500);
    }, 50);
  };

  return (
    <div className="w-full min-h-[90vh] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-2 sm:p-3 space-y-3 print:space-y-0 print:p-0 print:bg-white print:m-0 id-cards-print-area">
      
      {/* ─── DYNAMIC PRINT CSS FOR EXACT A4 SHEET FIT (ZERO OVERFLOW) ─── */}
      <style>{`
        @media print {
          @page {
            size: A4 ${paperOrientation};
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          body.id-card-print-mode {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* Use visibility: hidden so child containers CAN override with visibility: visible */
          body.id-card-print-mode * {
            visibility: hidden !important;
          }

          /* Make ONLY the print area and all cards inside it visible */
          body.id-card-print-mode .id-cards-print-area,
          body.id-card-print-mode .id-cards-print-area * {
            visibility: visible !important;
          }

          /* Position print area absolute at top-left 0,0 to start on Page 1 without clipping multi-page output */
          body.id-card-print-mode .id-cards-print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            z-index: 9999999 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
          }

          /* Completely remove non-printable toolbar UI controls inside the suite */
          body.id-card-print-mode .id-cards-print-area .print\:hidden,
          body.id-card-print-mode .id-cards-print-area .no-print {
            display: none !important;
          }

          /* Single card instant print isolated 1-page bounds (zero page bleed) */
          body.single-card-print-active .id-card-sheet,
          body.single-card-print-active .id-card-sheets-container {
            display: none !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
          }

          body.single-card-print-active * {
            visibility: hidden !important;
          }
          body.single-card-print-active .single-card-print-target,
          body.single-card-print-active .single-card-print-target * {
            visibility: visible !important;
          }
          body.single-card-print-active .single-card-print-target {
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 3mm !important;
            background: #ffffff !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            break-before: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .id-card-sheet {
            width: ${paperOrientation === 'landscape' ? '297mm' : '210mm'} !important;
            height: ${paperOrientation === 'landscape' ? '210mm' : '297mm'} !important;
            max-height: ${paperOrientation === 'landscape' ? '210mm' : '297mm'} !important;
            min-height: ${paperOrientation === 'landscape' ? '210mm' : '297mm'} !important;
            margin: 0 auto !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding: ${paperMarginMm}mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            position: relative !important;
            visibility: visible !important;
          }
          /* Kill ALL space-y-* Tailwind margin-top applied to siblings inside the print area.
             The outer wrapper has space-y-3 which injects margin-top:12px onto
             .id-card-sheets-container — this pushes Sheet 1 down past Page 1 boundary.
             Override every possible variant here with highest specificity. */
          .id-cards-print-area > * + * {
            margin-top: 0 !important;
          }
          .id-cards-print-area * + * {
            /* Only zero the direct Tailwind space-y selectors, not all siblings */
          }
          .id-card-sheets-container {
            margin: 0 !important;
            padding: 0 !important;
          }
          .id-card-sheets-container > * + * {
            margin-top: 0 !important;
          }

          .id-card-sheet:first-child,
          .id-card-sheet:first-of-type {
            page-break-before: avoid !important;
            break-before: avoid !important;
            margin-top: 0 !important;
          }
          .id-card-sheet:last-child,
          .id-card-sheet:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .id-card-sheet * {
            visibility: visible !important;
          }
          .id-card-grid-container {
            display: grid !important;
            justify-content: center !important;
            align-content: center !important;
            align-items: center !important;
            justify-items: center !important;
            margin: auto !important;
            gap: ${cardGapMm}mm !important;
          }
          .id-card-element {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ─── MAIN CONTROL HEADER & TOOLS (ULTRA-COMPACT SINGLE ROW LAYOUT) ─── */}
      {batchNotice && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 print:hidden">
          {batchNotice}
        </div>
      )}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-800 p-1.5 sm:p-2 shadow-xs print:hidden">
        
        {/* Single non-wrapping scrollable toolbar row */}
        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar">
          
          {/* Group 1: Brand Title, Class Filter & Search Input */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 rounded-lg bg-amber-800 text-white flex items-center justify-center shadow-2xs flex-shrink-0">
                <Printer size={13} />
              </div>
              <h2 className="hidden sm:inline-block text-xs font-black text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                ID Suite
              </h2>
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono font-black text-[10px]">
                {filteredStudents.length}
              </span>
            </div>

            {/* Compact Class Dropdown */}
            <select
              aria-label="ID card class filter"
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedStream('All');
              }}
              className="px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-purple-50 dark:bg-purple-950/60 font-black text-[11px] text-purple-700 dark:text-purple-300 cursor-pointer max-w-[110px] sm:max-w-none"
            >
              <option value="All">All ({liveStudents.length})</option>
              {availableClasses.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            {/* Compact Search Input */}
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-20 sm:w-28 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-[11px]"
            />
          </div>

          {/* Group 2: Compact Range Selection Bar */}
          <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 p-0.5 rounded-lg border border-amber-300 dark:border-amber-700/60 shadow-2xs flex-shrink-0">
            <span className="font-black text-[10px] text-amber-950 dark:text-amber-300 pl-1 hidden sm:inline">Range:</span>
            
            <div className="flex items-center gap-0.5">
              {[
                { label: '1–30', f: 1, t: 30 },
                { label: '31–60', f: 31, t: 60 },
                { label: '61–90', f: 61, t: 90 },
                { label: 'All', f: 1, t: filteredStudents.length, isAll: true }
              ].map(pill => {
                const isSelected = pill.isAll 
                  ? rangeMode === 'all' 
                  : rangeMode === 'range' && rangeFrom === pill.f && rangeTo === pill.t;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => {
                      if (pill.isAll) {
                        setRangeMode('all');
                      } else {
                        setRangeMode('range');
                        setRangeFrom(pill.f);
                        setRangeTo(pill.t);
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-black transition-all cursor-pointer border ${isSelected
                      ? 'bg-amber-800 text-white border-amber-900 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-amber-100'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Inputs */}
            <div className="hidden sm:flex items-center gap-0.5 ml-0.5 border-l border-amber-300 dark:border-amber-700/50 pl-1">
              <input
                type="number"
                min="1"
                max={filteredStudents.length}
                value={rangeMode === 'range' ? rangeFrom : 1}
                onChange={(e) => {
                  setRangeMode('range');
                  setRangeFrom(Math.max(1, parseInt(e.target.value, 10) || 1));
                }}
                className="w-8 px-0.5 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-mono font-black text-center text-[10px] text-amber-900 dark:text-amber-300"
              />
              <span className="text-[9px] font-bold text-amber-800 dark:text-amber-400">–</span>
              <input
                type="number"
                min="1"
                max={filteredStudents.length}
                value={rangeMode === 'range' ? rangeTo : filteredStudents.length}
                onChange={(e) => {
                  setRangeMode('range');
                  setRangeTo(Math.max(1, parseInt(e.target.value, 10) || 1));
                }}
                className="w-8 px-0.5 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-mono font-black text-center text-[10px] text-amber-900 dark:text-amber-300"
              />
            </div>
          </div>

          {/* Group 2.5: Quick Layout, Card Size, Margin & Gap Controls */}
          <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 p-0.5 rounded-lg border border-purple-300 dark:border-purple-700/60 shadow-2xs flex-shrink-0">
            <span className="font-black text-[10px] text-purple-950 dark:text-purple-300 pl-1 hidden lg:inline">Size:</span>
            
            {/* Width & Height Quick Adjusters */}
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] font-bold text-purple-700 dark:text-purple-400">W</span>
              <input
                type="number"
                min="40"
                max="100"
                step="0.5"
                value={cardWidthMm}
                onChange={(e) => {
                  setCardWidthMm(parseFloat(e.target.value) || 56);
                  setIsCustomGrid(true);
                }}
                className="w-9 px-0.5 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 font-mono font-black text-center text-[10px] text-purple-900 dark:text-purple-300"
                title="Card Width (mm)"
              />
              <span className="text-[9px] font-bold text-purple-700 dark:text-purple-400">H</span>
              <input
                type="number"
                min="50"
                max="150"
                step="0.5"
                value={cardHeightMm}
                onChange={(e) => {
                  setCardHeightMm(parseFloat(e.target.value) || 95);
                  setIsCustomGrid(true);
                }}
                className="w-9 px-0.5 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 font-mono font-black text-center text-[10px] text-purple-900 dark:text-purple-300"
                title="Card Height (mm)"
              />
            </div>

            {/* Margins & Gaps Quick Adjuster */}
            <div className="flex items-center gap-0.5 ml-0.5 border-l border-purple-300 dark:border-purple-700/50 pl-1">
              <span className="text-[9px] font-bold text-purple-700 dark:text-purple-400">Margin</span>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={paperMarginMm}
                onChange={(e) => setPaperMarginMm(parseFloat(e.target.value) || 0)}
                className="w-7 px-0.5 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 font-mono font-black text-center text-[10px] text-purple-900 dark:text-purple-300"
                title="Paper Margin (mm)"
              />
              <span className="text-[9px] font-bold text-purple-700 dark:text-purple-400">Gap</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={cardGapMm}
                onChange={(e) => setCardGapMm(parseFloat(e.target.value) || 0)}
                className="w-7 px-0.5 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 font-mono font-black text-center text-[10px] text-purple-900 dark:text-purple-300"
                title="Gap between Cards (mm)"
              />
            </div>

            {/* Paper Orientation Toggle */}
            <button
              type="button"
              onClick={() => setPaperOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')}
              title={`Orientation: ${paperOrientation.toUpperCase()}`}
              className="px-1.5 py-0.5 rounded text-[9.5px] font-black cursor-pointer border bg-white dark:bg-slate-900 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700 hover:bg-purple-100"
            >
              {paperOrientation === 'landscape' ? '📐 Land' : '📄 Port'}
            </button>

            {/* ─── Classified Theme Palette Selector Button ─── */}
            <div className="border-l border-purple-300 dark:border-purple-700/50 pl-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowThemePicker(true)}
                title="Manage Card Themes (Realtime Classified View & 12 Presets)"
                className="px-2 py-0.5 rounded text-[9.5px] font-black cursor-pointer border bg-white dark:bg-slate-900 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700 hover:bg-purple-100 flex items-center gap-1 shadow-2xs"
              >
                <Palette size={11} className="text-purple-600 dark:text-purple-400" />
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block border border-slate-400 shadow-2xs"
                  style={{
                    backgroundColor: (selectedTheme === 'auto' || selectedTheme === 'classified')
                      ? (resolveClassTheme(selectedClass, selectedStream, classThemes)?.dotColor || '#1d4ed8')
                      : (ID_CARD_THEMES[selectedTheme]?.dotColor || '#1d4ed8')
                  }}
                />
                <span className="hidden sm:inline">
                  {selectedTheme === 'auto' || selectedTheme === 'classified' ? 'Theme' : `Theme: ${ID_CARD_THEMES[selectedTheme]?.name || selectedTheme}`}
                </span>
              </button>

              {/* ─── Normal / Reverse Mode Toggle Under Tools Header ─── */}
              <button
                type="button"
                onClick={() => setPrintMode(prev => prev === 'normal' ? 'reversed' : 'normal')}
                title={`Print View Mode: ${printMode === 'reversed' ? 'Reverse Mirrored (Transparent Sheet/PVC)' : 'Normal Direct Front'}`}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-black cursor-pointer border flex items-center gap-1 transition-all shadow-2xs ${
                  printMode === 'reversed'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700 hover:bg-purple-100'
                }`}
              >
                <ArrowLeftRight size={10} className="text-amber-500 dark:text-amber-400" />
                <span>{printMode === 'reversed' ? '🔄 Reverse' : '➡️ Normal'}</span>
              </button>
            </div>
          </div>

          {/* Group 3: Primary Action & Tools — pinned to far right */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
            {/* FAST CACHE GENERATION & PRINT BUTTON */}
            <button
              type="button"
              onClick={handleGenerateAndPrint}
              disabled={targetStudents.length === 0 || isGenerating}
              className="px-2 py-0.5 rounded-lg bg-amber-800 hover:bg-amber-700 text-white font-black text-[11px] shadow-2xs cursor-pointer flex items-center gap-1 transition-all hover:scale-102 disabled:opacity-50 ring-1 ring-amber-500/40"
            >
              <Printer size={12} />
              <span>⚡ PRINT ({rangeMode === 'range' ? `${rangeFrom}–${rangeTo}` : targetStudents.length})</span>
            </button>

            {/* Layout & Filters Toggle */}
            <button
              type="button"
              onClick={() => setShowFiltersPanel(prev => !prev)}
              title="Layout & Filters"
              className={`px-1.5 py-0.5 rounded-lg border font-extrabold text-[10.5px] cursor-pointer flex items-center gap-0.5 transition-all ${showFiltersPanel 
                ? 'bg-amber-800 text-white border-amber-900' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              <Filter size={11} />
              <span className="hidden xl:inline">Filters</span>
            </button>

            {/* Seal & Sign Button */}
            <button
              type="button"
              onClick={() => setShowSealModal(true)}
              title="Seal & Signature Setup"
              className="px-1.5 py-0.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-black text-[10.5px] cursor-pointer flex items-center gap-0.5"
            >
              <Upload size={11} />
              <span className="hidden xl:inline">Stamp</span>
            </button>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleResetToDefaults}
              title="Reset all settings"
              className="px-1 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
            >
              <RotateCcw size={11} className="text-amber-600" />
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close ID Suite"
                className="px-2 py-0.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 font-extrabold text-[10.5px] text-red-700 dark:text-red-300 cursor-pointer shadow-2xs"
              >
                Close
              </button>
            )}
          </div>

        </div>

        {/* Reset Success Toast Notice */}
        {resetNotice && (
          <div className="p-2 rounded-xl bg-emerald-600 text-white font-black text-xs text-center shadow-md animate-fadeIn flex items-center justify-center gap-2">
            <CheckCircle size={14} />
            <span>✅ ID Card layout, paper margins, card sizes, and filters successfully reset to factory defaults!</span>
          </div>
        )}

        {/* ─── EXPANDABLE FILTERS & LAYOUT DRAWER (HIDDEN BY DEFAULT, TOGGLEABLE) ─── */}
        {showFiltersPanel && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
              <label className="space-y-0.5">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Academic Session</span>
                <select
                  aria-label="ID card academic session filter"
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-[10.5px]"
                >
                  <option value="All">All Sessions ({liveStudents.length})</option>
                  {availableSessions.map(session => (
                    <option key={session.value} value={session.value}>{session.value} ({session.count})</option>
                  ))}
                </select>
              </label>

              <label className="space-y-0.5">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Class</span>
                <select
                  aria-label="ID card detailed class filter"
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedStream('All');
                  }}
                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-[10.5px]"
                >
                  <option value="All">All Classes</option>
                  {availableClasses.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label className="space-y-0.5">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Stream</span>
                <select
                  aria-label="ID card stream filter"
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-[10.5px]"
                >
                  <option value="All">All Streams</option>
                  {availableStreams.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label className="space-y-0.5">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Record Status</span>
                <select
                  aria-label="ID card record status filter"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-[10.5px]"
                >
                  <option value="Approved">Approved only</option>
                  <option value="All">All records with assigned roll</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              
              {/* Paper Orientation & Normal/Reverse Print Mode */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-[11px] text-slate-500">Paper Fit:</span>
                <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-300 dark:border-slate-700 font-extrabold text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPaperOrientation('landscape')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${paperOrientation === 'landscape'
                      ? 'bg-amber-800 text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Landscape A4 (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperOrientation('portrait')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${paperOrientation === 'portrait'
                      ? 'bg-amber-800 text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Portrait A4
                  </button>
                </div>

                <span className="font-extrabold text-[11px] text-slate-500 ml-1">View Mode:</span>
                <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-300 dark:border-slate-700 font-extrabold text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPrintMode('normal')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${printMode === 'normal'
                      ? 'bg-purple-700 text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    ➡️ Normal Direct
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('reversed')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${printMode === 'reversed'
                      ? 'bg-amber-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    🔄 Reverse Mirrored (Transparent PVC)
                  </button>
                </div>

                {/* Card Presets */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(54.0, 85.6, 'CR80 Standard')}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black cursor-pointer border ${cardWidthMm === 54 && cardHeightMm === 85.6
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    CR80 (54×85.6)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(50.0, 80.0, 'Compact')}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black cursor-pointer border ${cardWidthMm === 50 && cardHeightMm === 80
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Compact (50×80)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaperOrientation('landscape');
                      setCardWidthMm(56.0);
                      setCardHeightMm(95.0);
                      setCols(5);
                      setRows(2);
                      setIsCustomGrid(true);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black cursor-pointer border ${cols === 5 && cardWidthMm === 56
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    5-Col Fit (56×95mm)
                  </button>
                </div>

                {/* Custom Sizing Sliders Drawer Toggle */}
                <button
                  type="button"
                  onClick={() => setShowSizeCalculator(prev => !prev)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10.5px] font-black cursor-pointer flex items-center gap-1"
                >
                  <Sliders size={11} />
                  <span>Custom Sliders ({cardWidthMm}×{cardHeightMm}mm)</span>
                  {showSizeCalculator ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              </div>

              {/* Batch Scope Range & Selection Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Student Range Selector (e.g. 1-30, 31-60, 61-90) */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700 flex-wrap">
                  <span className="font-extrabold text-[11px] text-slate-500">Student Range:</span>
                  <button
                    type="button"
                    onClick={() => setRangeMode('all')}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${rangeMode === 'all'
                      ? 'bg-amber-800 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    All ({filteredStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangeMode('range')}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${rangeMode === 'range'
                      ? 'bg-amber-800 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Custom Range
                  </button>

                  {rangeMode === 'range' && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500">From</span>
                      <input
                        type="number"
                        min="1"
                        max={filteredStudents.length}
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-12 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-black text-center text-xs text-amber-800 dark:text-amber-300"
                      />
                      <span className="text-[10px] font-bold text-slate-500">To</span>
                      <input
                        type="number"
                        min="1"
                        max={filteredStudents.length}
                        value={rangeTo}
                        onChange={(e) => setRangeTo(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-12 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-black text-center text-xs text-amber-800 dark:text-amber-300"
                      />

                      {/* Quick Range Pills */}
                      <div className="flex items-center gap-1 ml-1 flex-wrap">
                        {[
                          { label: '1–30', f: 1, t: 30 },
                          { label: '31–60', f: 31, t: 60 },
                          { label: '61–90', f: 61, t: 90 },
                          { label: '91–120', f: 91, t: 120 }
                        ].map(pill => (
                          <button
                            key={pill.label}
                            type="button"
                            onClick={() => {
                              setRangeMode('range');
                              setRangeFrom(pill.f);
                              setRangeTo(pill.t);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-black cursor-pointer border ${rangeFrom === pill.f && rangeTo === pill.t
                              ? 'bg-blue-700 text-white border-blue-800'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {pill.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <select
                  value={printPageRange}
                  onChange={(e) => setPrintPageRange(e.target.value)}
                  className="px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-amber-800 dark:text-amber-300 cursor-pointer"
                >
                  <option value="all">All ({pages.length} Pgs • {targetStudents.length} Cards)</option>
                  <option value="1">Page 1 Only ({cardsPerPage} Cards)</option>
                  <option value="1-3">Pages 1–3 ({cardsPerPage * 3} Cards)</option>
                  <option value="1-5">Pages 1–5 ({cardsPerPage * 5} Cards)</option>
                </select>

                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-black cursor-pointer flex items-center gap-1"
                >
                  {allFilteredSelected ? (
                    <>
                      <CheckSquare size={12} className="text-emerald-600" />
                      <span>Deselect All ({filteredStudents.length})</span>
                    </>
                  ) : (
                    <>
                      <Square size={12} className="text-slate-400" />
                      <span>Select All</span>
                    </>
                  )}
                </button>

                <label className="flex items-center gap-1 cursor-pointer select-none bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-300 dark:border-slate-700 text-[10.5px] font-bold">
                  <input
                    type="checkbox"
                    checked={includeBackSide}
                    onChange={(e) => setIncludeBackSide(e.target.checked)}
                    className="rounded accent-amber-700 cursor-pointer"
                  />
                  <span>Back Side</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Custom Sizing Calculator Drawer */}
        {showSizeCalculator && (
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 animate-fadeIn text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                  <span>Card Width:</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="40"
                      max="110"
                      step="0.5"
                      value={cardWidthMm}
                      onChange={(e) => setCardWidthMm(Number(e.target.value))}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                    <span className="text-[10px] text-slate-500">mm</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="45"
                  max="95"
                  step="0.5"
                  value={cardWidthMm}
                  onChange={(e) => setCardWidthMm(Number(e.target.value))}
                  className="w-full accent-amber-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                  <span>Card Height:</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="50"
                      max="150"
                      step="0.5"
                      value={cardHeightMm}
                      onChange={(e) => setCardHeightMm(Number(e.target.value))}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                    <span className="text-[10px] text-slate-500">mm</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="60"
                  max="130"
                  step="0.5"
                  value={cardHeightMm}
                  onChange={(e) => setCardHeightMm(Number(e.target.value))}
                  className="w-full accent-amber-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                  <span>Paper Margins:</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={paperMarginMm}
                      onChange={(e) => setPaperMarginMm(Number(e.target.value))}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                    <span className="text-[10px] text-slate-500">mm</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="0.5"
                  value={paperMarginMm}
                  onChange={(e) => setPaperMarginMm(Number(e.target.value))}
                  className="w-full accent-amber-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                  <span>Card Spacing Gap:</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="0"
                      max="15"
                      step="0.5"
                      value={cardGapMm}
                      onChange={(e) => setCardGapMm(Number(e.target.value))}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                    <span className="text-[10px] text-slate-500">mm</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={cardGapMm}
                  onChange={(e) => setCardGapMm(Number(e.target.value))}
                  className="w-full accent-amber-700 cursor-pointer"
                />
              </div>
            </div>

            {/* Photo & QR Code Sizing & Tightness Controls */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                  <span>Photo Width:</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="40"
                      max="110"
                      value={photoWidthPx}
                      onChange={(e) => setPhotoWidthPx(Number(e.target.value))}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                    <span className="text-[10px] text-slate-500">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="40"
                  max="110"
                  value={photoWidthPx}
                  onChange={(e) => setPhotoWidthPx(Number(e.target.value))}
                  className="w-full accent-amber-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                  <span>Photo Height:</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="50"
                      max="130"
                      value={photoHeightPx}
                      onChange={(e) => setPhotoHeightPx(Number(e.target.value))}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                    <span className="text-[10px] text-slate-500">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="50"
                  max="130"
                  value={photoHeightPx}
                  onChange={(e) => setPhotoHeightPx(Number(e.target.value))}
                  className="w-full accent-amber-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                  <span>QR Code Size:</span>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min="40"
                      max="110"
                      value={qrSizePx}
                      onChange={(e) => setQrSizePx(Number(e.target.value))}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                    <span className="text-[10px] text-slate-500">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="40"
                  max="110"
                  value={qrSizePx}
                  onChange={(e) => setQrSizePx(Number(e.target.value))}
                  className="w-full accent-amber-700 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-2 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between flex-wrap gap-2">
              <div>
                📐 <strong>Sheet Math:</strong> A4 ({sheetSpecs.sheetW}×{sheetSpecs.sheetH}mm) • Available: <strong>{sheetSpecs.availableW}×{sheetSpecs.availableH}mm</strong> • Used: <strong>{sheetSpecs.usedW}×{sheetSpecs.usedH}mm</strong>
              </div>
              <div className="font-black text-emerald-800 dark:text-emerald-300">
                ✅ Grid Capacity: {cols} Cols × {rows} Rows = <strong className="underline">{cols * rows} Cards / A4 Sheet</strong> ({sheetSpecs.excessW}mm &amp; {sheetSpecs.excessH}mm margin clearance)
              </div>
            </div>

            {/* Grid Layout Controls: Manual Columns & Rows per A4 Page */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-extrabold text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Grid size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>A4 Sheet Grid Layout (Columns &amp; Rows per Page):</span>
                </div>

                {/* Auto vs Custom Grid Mode Toggle */}
                <div className="flex items-center rounded-lg bg-slate-200 dark:bg-slate-800 p-0.5 font-bold text-[10.5px]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomGrid(false);
                      setCols(sheetSpecs.maxCols);
                      setRows(sheetSpecs.maxRows);
                    }}
                    className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${!isCustomGrid
                      ? 'bg-emerald-700 text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ⚡ Auto-Fit Math ({sheetSpecs.maxCols}×{sheetSpecs.maxRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomGrid(true)}
                    className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${isCustomGrid
                      ? 'bg-amber-800 text-white shadow-2xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    🎛 Custom Grid ({cols}×{rows})
                  </button>
                </div>
              </div>

              {/* Columns and Rows Selectors & Sliders */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                <div>
                  <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                    <span>Columns (Horiz):</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      value={cols}
                      onChange={(e) => {
                        setCols(Number(e.target.value));
                        setIsCustomGrid(true);
                      }}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={cols}
                    onChange={(e) => {
                      setCols(Number(e.target.value));
                      setIsCustomGrid(true);
                    }}
                    className="w-full accent-amber-700 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between font-black text-slate-700 dark:text-slate-300 mb-1">
                    <span>Rows (Vert):</span>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      step="1"
                      value={rows}
                      onChange={(e) => {
                        setRows(Number(e.target.value));
                        setIsCustomGrid(true);
                      }}
                      className="w-13 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-xs"
                    />
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={rows}
                    onChange={(e) => {
                      setRows(Number(e.target.value));
                      setIsCustomGrid(true);
                    }}
                    className="w-full accent-amber-700 cursor-pointer"
                  />
                </div>

                {/* Direct Column & Row Selection Dropdowns */}
                <div className="col-span-2 flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700">
                  <div className="flex items-center gap-1 font-bold text-[11px]">
                    <span>Cols:</span>
                    <select
                      value={cols}
                      onChange={(e) => {
                        setCols(Number(e.target.value));
                        setIsCustomGrid(true);
                      }}
                      className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-black text-amber-800 dark:text-amber-300 cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <option key={n} value={n}>{n} Col{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 font-bold text-[11px]">
                    <span>Rows:</span>
                    <select
                      value={rows}
                      onChange={(e) => {
                        setRows(Number(e.target.value));
                        setIsCustomGrid(true);
                      }}
                      className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-black text-amber-800 dark:text-amber-300 cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n} Row{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ml-auto font-black text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                    = {cols * rows} Cards / A4 Sheet
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* On-Screen Lightweight Sample Preview Banner (Single-Line Compact) */}
      {!isPrintingActive && filteredStudents.length > 0 && (
        <div className="p-1 px-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-[11px] font-bold flex items-center justify-between gap-2 shadow-2xs print:hidden whitespace-nowrap overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-0 flex-shrink">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-ping" />
            <span className="truncate">
              👁 <strong>Sample Page 1 Preview ({displayPages[0]?.length || 0} Cards):</strong> Click <strong>⚡ PRINT ({rangeMode === 'range' ? `${rangeFrom}–${rangeTo}` : `All ${targetStudents.length}`})</strong> to fetch &amp; print full batch ({pages.length} Sheets).
            </span>
          </div>
          {pages.length > 1 && (
            <span className="px-1.5 py-0.2 rounded-md bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-mono font-black text-[10px] flex-shrink-0">
              {pages.length} Sheets Ready
            </span>
          )}
        </div>
      )}

      {/* ─── MULTI-PAGE A4 SHEETS PREVIEW (CENTRED & SCALED TO EXACT DIMENSIONS) ─── */}
      <div className="id-card-sheets-container space-y-4 print:space-y-0 print:m-0 print:p-0">
        {displayPages.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
            <Shield size={32} className="mx-auto text-amber-500 mb-2" />
            <h3 className="font-black text-base">No Matching Student Records Found</h3>
            <p className="text-xs text-slate-500 font-bold mt-1">
              Select <strong>All Classes</strong> or clear your search query above.
            </p>
          </div>
        ) : (
          displayPages.map((pageStudents, pageIdx) => {
            const mirroredBackStudents = mirrorGridForDuplex(pageStudents, cols);

            return (
              <React.Fragment key={`page_group_${pageIdx}`}>
                {/* ─── FRONT SIDE A4 SHEET ─── */}
                <div
                  className="mx-auto bg-white text-slate-900 shadow-2xl rounded-2xl border border-slate-300 print:border-none print:shadow-none print:rounded-none overflow-hidden print:p-0 print:m-0 id-card-sheet"
                  style={{
                    width: paperOrientation === 'landscape' ? '297mm' : '210mm',
                    height: paperOrientation === 'landscape' ? '210mm' : '297mm',
                    maxHeight: paperOrientation === 'landscape' ? '210mm' : '297mm',
                    padding: `${paperMarginMm}mm`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    pageBreakAfter: 'always',
                    breakAfter: 'page',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {/* Top Page Marker */}
                  <div className="w-full flex items-center justify-between text-[10px] font-black text-slate-400 border-b border-slate-200 pb-1 mb-1 print:hidden">
                    <span>A4 Sheet ({paperOrientation.toUpperCase()}) • Page {includeBackSide ? pageIdx * 2 + 1 : pageIdx + 1} FRONT ({pageStudents.length} Cards • Grid: {cols}×{rows})</span>
                    <span>Size: <strong>{cardWidthMm}×{cardHeightMm}mm</strong> • Margin: <strong>{paperMarginMm}mm</strong> • Gap: <strong>{cardGapMm}mm</strong></span>
                  </div>

                  {/* A4 Grid of FRONT ID Cards */}
                  <div
                    className="id-card-grid-container grid justify-center items-center m-auto"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, ${cardWidthMm}mm)`,
                      gap: `${cardGapMm}mm`
                    }}
                  >
                    {pageStudents.map((st, cardIdx) => {
                      const cardId = getIdCardStudentKey(st, pageIdx * cardsPerPage + cardIdx);
                      const isSelected = hasManuallySelected ? selectedStudentIds.has(cardId) : true;
                      const theme = resolveClassTheme(
                        st['Admission sought for class'] || st['Class'] || st.class,
                        getStudentStreamVal(st),
                        (selectedTheme !== 'auto' && selectedTheme !== 'classified') ? selectedTheme : classThemes,
                        st
                      );

                      return (
                        <div key={cardId} className="relative group flex justify-center id-card-element">
                          {/* Selection Checkbox & Preview overlay */}
                          <div className="absolute top-1.5 left-1.5 z-30 opacity-70 group-hover:opacity-100 transition-opacity print:hidden flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 p-1 rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm">
                            <button
                              type="button"
                              onClick={() => handleToggleStudent(cardId)}
                              className="cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare size={13} className="text-emerald-600" />
                              ) : (
                                <Square size={13} className="text-slate-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewStudent(st)}
                              title="Preview Single Card"
                              className="p-0.5 rounded hover:bg-slate-200 text-blue-600 cursor-pointer"
                            >
                              <Eye size={12} />
                            </button>
                          </div>

                          {/* Front Single ID Card Template */}
                          <SingleIdCardPortrait
                            student={st}
                            allStudents={photoIndex}
                            theme={theme}
                            sealConfig={sealConfig}
                            isReversed={printMode === 'reversed'}
                            showCropMarks={showCropMarks}
                            cardWidthMm={cardWidthMm}
                            cardHeightMm={cardHeightMm}
                            photoWidthPx={photoWidthPx}
                            photoHeightPx={photoHeightPx}
                            qrSizePx={qrSizePx}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ─── BACK SIDE A4 SHEET (HORIZONTALLY MIRRORED FOR PERFECT DUPLEX PRINTING) ─── */}
                {includeBackSide && (
                  <div
                    className="mx-auto bg-white text-slate-900 shadow-2xl rounded-2xl border border-slate-300 print:border-none print:shadow-none print:rounded-none overflow-hidden print:p-0 print:m-0 id-card-sheet"
                    style={{
                      width: paperOrientation === 'landscape' ? '297mm' : '210mm',
                      height: paperOrientation === 'landscape' ? '210mm' : '297mm',
                      maxHeight: paperOrientation === 'landscape' ? '210mm' : '297mm',
                      padding: `${paperMarginMm}mm`,
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {/* Top Page Marker */}
                    <div className="w-full flex items-center justify-between text-[10px] font-black text-amber-700 dark:text-amber-400 border-b border-slate-200 pb-1 mb-1 print:hidden">
                      <span>A4 Sheet ({paperOrientation.toUpperCase()}) • Page {pageIdx * 2 + 2} BACK SIDE (Duplex Mirrored Alignment)</span>
                      <span>Size: <strong>{cardWidthMm}×{cardHeightMm}mm</strong> • Margin: <strong>{paperMarginMm}mm</strong> • Gap: <strong>{cardGapMm}mm</strong></span>
                    </div>

                    {/* A4 Grid of BACK ID Cards (Horizontally Mirrored per Row) */}
                    <div
                      className="id-card-grid-container grid justify-center items-center m-auto"
                      style={{
                        gridTemplateColumns: `repeat(${cols}, ${cardWidthMm}mm)`,
                        gap: `${cardGapMm}mm`
                      }}
                    >
                      {mirroredBackStudents.map((st, backIdx) => {
                        if (!st) {
                          return (
                            <div
                              key={`empty_back_${backIdx}`}
                              style={{ width: `${cardWidthMm}mm`, height: `${cardHeightMm}mm` }}
                              className="id-card-element border border-dashed border-slate-200"
                            />
                          );
                        }
                        return (
                          <div key={`back_${st.id || backIdx}`} className="relative flex justify-center id-card-element">
                            <SingleIdCardBack
                              student={st}
                              sealConfig={sealConfig}
                              isReversed={printMode === 'reversed'}
                              showCropMarks={showCropMarks}
                              cardWidthMm={cardWidthMm}
                              cardHeightMm={cardHeightMm}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* ─── MODAL 1: VISUAL SEAL & SIGNATURE PLACEMENT POSITIONING ─── */}
      {showSealModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 p-4 sm:p-5 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield size={18} className="text-purple-600" />
                  Seal &amp; Signature Visual Placement (Applies to All Cards)
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  Position the official seal and signature on the live sample card below to apply across all batches.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSealModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Recent 3 Preset Sets History Bar */}
            <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <Layers size={13} className="text-purple-600 dark:text-purple-400" />
                  <span>Recent Seal &amp; Signature Sets (Max 3 History Sets):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newSet = {
                      id: `set_${Date.now()}`,
                      label: `Set (${sealConfig.principalName || 'Principal'})`,
                      ...sealConfig,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                    const updated = [newSet, ...sealHistory.filter(s => s.id !== newSet.id)].slice(0, 3);
                    setSealHistory(updated);
                    try { localStorage.setItem(SEAL_HISTORY_KEY, JSON.stringify(updated)); } catch(e){}
                  }}
                  className="px-2 py-0.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-black text-[10.5px] cursor-pointer shadow-2xs"
                >
                  + Save Current as New Set
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {sealHistory.map((set, idx) => {
                  const isActive = sealConfig.principalSignatureUrl === set.principalSignatureUrl && sealConfig.schoolSealUrl === set.schoolSealUrl;

                  return (
                    <div
                      key={set.id || idx}
                      onClick={() => setSealConfig(set)}
                      className={`p-2 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isActive
                          ? 'bg-purple-100 dark:bg-purple-900/60 border-purple-600 ring-2 ring-purple-500/30'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-purple-400'
                      }`}
                    >
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="font-black text-[10.5px] text-purple-950 dark:text-purple-100 truncate">
                          {isActive ? '👑 Active Set' : `Set #${idx + 1}`} ({set.principalName || 'Principal'})
                        </div>
                        <div className="flex items-center gap-1.5">
                          {set.schoolSealUrl ? (
                            <img src={set.schoolSealUrl} alt="Seal" className="w-5 h-5 object-contain border rounded p-0.5 bg-white" />
                          ) : <span className="text-[9px] text-slate-400">No Seal</span>}
                          {set.principalSignatureUrl ? (
                            <img src={set.principalSignatureUrl} alt="Sign" className="w-6 h-4 object-contain border rounded p-0.5 bg-white" />
                          ) : <span className="text-[9px] text-slate-400">No Sign</span>}
                        </div>
                      </div>

                      {sealHistory.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = sealHistory.filter(s => s.id !== set.id);
                            setSealHistory(updated);
                            try { localStorage.setItem(SEAL_HISTORY_KEY, JSON.stringify(updated)); } catch(e){}
                          }}
                          title="Delete Preset Set"
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              
              {/* Left Column: Live Sample Card Preview */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-3 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-black text-purple-700 dark:text-purple-300 mb-2">
                  🎯 Live Sample Card (Changes Reflect in Real-Time)
                </div>
                <div className="scale-105 origin-center my-2 shadow-lg rounded-[3mm] overflow-hidden">
                  <SingleIdCardPortrait
                    student={liveStudents[0] || {
                      "Student's Name (as per school records)": "Sample Student",
                      "Father's/Guardian's Name (as per school records)": "Father Name",
                      "Admission sought for class": "11th",
                      "Stream for Class 11th": "Science",
                      "Class Roll No.": "1",
                      "Board Registration Number": "1901003000900019",
                      "Subjects": "Physics, Chemistry, Math"
                    }}
                    allStudents={photoIndex}
                    theme={ID_CARD_THEMES.emerald}
                    sealConfig={sealConfig}
                    isReversed={false}
                    showCropMarks={true}
                    cardWidthMm={cardWidthMm}
                    cardHeightMm={cardHeightMm}
                    photoWidthPx={photoWidthPx}
                    photoHeightPx={photoHeightPx}
                    qrSizePx={qrSizePx}
                  />
                </div>
              </div>

              {/* Right Column: Uploads & Placement Sliders */}
              <div className="md:col-span-7 space-y-3 text-xs font-bold">
                
                {/* 1. Principal Signature Section */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 dark:text-slate-200">
                      1. Principal Signature (Max 30KB PNG)
                    </span>
                    {sealConfig.principalSignatureUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded font-black">
                          {getImageKbSize(sealConfig.principalSignatureUrl)} KB / 30 KB ✅
                        </span>
                        <button
                          type="button"
                          onClick={() => setSealConfig(prev => ({ ...prev, principalSignatureUrl: '' }))}
                          className="text-red-600 hover:text-red-700 text-[10px] cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUploadImage('principalSignatureUrl', e.target.files[0])}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-purple-700 file:text-white hover:file:bg-purple-600 cursor-pointer"
                  />

                  {/* Signature Positioning Sliders & Quick Alignment Helper */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10.5px] font-black text-purple-700 dark:text-purple-300">
                      Signature Location &amp; Overlap Controls:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newPct = 40;
                        const sealWidthPx = sealConfig.sealWidth || 58;
                        const sealHeightMm = sealWidthPx / 3.78;
                        const sealBaseY = sealConfig.sealOffsetY ?? 2;
                        const newSigOffsetY = Math.round((sealBaseY + sealHeightMm * (1 - newPct / 100)) * 10) / 10;
                        setSealConfig(prev => ({
                          ...prev,
                          sigSealOverlapPct: 40,
                          sigPosition: prev.sealPosition === 'over-photo' ? 'bottom-right' : (prev.sealPosition || 'bottom-right'),
                          sigOffsetX: prev.sealOffsetX ?? 2,
                          sigOffsetY: newSigOffsetY
                        }));
                      }}
                      className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-500 text-slate-950 text-[10px] font-black cursor-pointer shadow-2xs"
                    >
                      🎯 Snap 40% Body Overlap
                    </button>
                  </div>

                  {/* Dynamic Stamp Body Overlap Controller (0% to 100%) */}
                  <div className="p-2 rounded-xl bg-purple-100/60 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 space-y-1 my-1">
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <span className="text-purple-900 dark:text-purple-200">
                        ✨ Signature Body Overlap Percentage over Stamp:
                      </span>
                      <span className="px-2 py-0.2 rounded-full bg-purple-700 text-white font-mono text-[10px] shadow-2xs">
                        {sealConfig.sigSealOverlapPct ?? 40}% Overlap ({100 - (sealConfig.sigSealOverlapPct ?? 40)}% Floating Above)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={sealConfig.sigSealOverlapPct ?? 40}
                      onChange={(e) => {
                        const newPct = Number(e.target.value);
                        const sealWidthPx = sealConfig.sealWidth || 58;
                        const sealHeightMm = sealWidthPx / 3.78;
                        const sealBaseY = sealConfig.sealOffsetY ?? 2;
                        const newSigOffsetY = Math.round((sealBaseY + sealHeightMm * (1 - newPct / 100)) * 10) / 10;
                        setSealConfig(prev => ({
                          ...prev,
                          sigSealOverlapPct: newPct,
                          sigPosition: prev.sealPosition === 'over-photo' ? 'bottom-right' : (prev.sealPosition || 'bottom-right'),
                          sigOffsetX: prev.sealOffsetX ?? 2,
                          sigOffsetY: newSigOffsetY
                        }));
                      }}
                      className="w-full accent-purple-700 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                      <span>0% (Fully Above Stamp)</span>
                      <span>40% (40% Body Overlap)</span>
                      <span>100% (Center of Stamp)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <label className="font-bold">Sign Horiz Offset (X):</label>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="-30"
                            max="80"
                            step="0.5"
                            value={sealConfig.sigOffsetX ?? 2}
                            onChange={(e) => setSealConfig(prev => ({ ...prev, sigOffsetX: Number(e.target.value) }))}
                            className="w-12 px-1 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-[10px]"
                          />
                          <span>mm</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="80"
                        step="0.5"
                        value={sealConfig.sigOffsetX ?? 2}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sigOffsetX: Number(e.target.value) }))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <label className="font-bold">Sign Vert Offset (Y):</label>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="-10"
                            max="80"
                            step="0.5"
                            value={sealConfig.sigOffsetY ?? 10}
                            onChange={(e) => setSealConfig(prev => ({ ...prev, sigOffsetY: Number(e.target.value) }))}
                            className="w-12 px-1 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-[10px]"
                          />
                          <span>mm</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="80"
                        step="0.5"
                        value={sealConfig.sigOffsetY ?? 10}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sigOffsetY: Number(e.target.value) }))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <label className="font-bold">Signature Size:</label>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="20"
                            max="110"
                            value={sealConfig.sigWidth || 40}
                            onChange={(e) => setSealConfig(prev => ({ ...prev, sigWidth: Number(e.target.value) }))}
                            className="w-12 px-1 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-[10px]"
                          />
                          <span>px</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="110"
                        value={sealConfig.sigWidth || 40}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sigWidth: Number(e.target.value) }))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Sign Position Side</label>
                      <select
                        value={sealConfig.sigPosition || 'bottom-right'}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sigPosition: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold"
                      >
                        <option value="bottom-right">Bottom Right (Standard)</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-center">Bottom Center</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Official School Seal / Stamp Section */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 dark:text-slate-200">
                      2. Official School Seal / Stamp (Max 30KB PNG)
                    </span>
                    {sealConfig.schoolSealUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded font-black">
                          {getImageKbSize(sealConfig.schoolSealUrl)} KB / 30 KB ✅
                        </span>
                        <button
                          type="button"
                          onClick={() => setSealConfig(prev => ({ ...prev, schoolSealUrl: '' }))}
                          className="text-red-600 hover:text-red-700 text-[10px] cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUploadImage('schoolSealUrl', e.target.files[0])}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-purple-700 file:text-white hover:file:bg-purple-600 cursor-pointer"
                  />

                  {/* Stamp Placement Sliders */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <label className="font-bold">Stamp Horiz Offset (X):</label>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="-30"
                            max="80"
                            step="0.5"
                            value={sealConfig.sealOffsetX ?? 2}
                            onChange={(e) => setSealConfig(prev => ({ ...prev, sealOffsetX: Number(e.target.value) }))}
                            className="w-12 px-1 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-[10px]"
                          />
                          <span>mm</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="80"
                        step="0.5"
                        value={sealConfig.sealOffsetX ?? 2}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sealOffsetX: Number(e.target.value) }))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <label className="font-bold">Stamp Vert Offset (Y):</label>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="-10"
                            max="80"
                            step="0.5"
                            value={sealConfig.sealOffsetY ?? 2}
                            onChange={(e) => setSealConfig(prev => ({ ...prev, sealOffsetY: Number(e.target.value) }))}
                            className="w-12 px-1 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-[10px]"
                          />
                          <span>mm</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="80"
                        step="0.5"
                        value={sealConfig.sealOffsetY ?? 2}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sealOffsetY: Number(e.target.value) }))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <label className="font-bold">Stamp Size:</label>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="25"
                            max="120"
                            value={sealConfig.sealWidth || 58}
                            onChange={(e) => setSealConfig(prev => ({ ...prev, sealWidth: Number(e.target.value) }))}
                            className="w-12 px-1 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-[10px]"
                          />
                          <span>px</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="25"
                        max="120"
                        value={sealConfig.sealWidth || 58}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sealWidth: Number(e.target.value) }))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <label className="font-bold">Stamp Tilt / Rotation:</label>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="-25"
                            max="25"
                            value={sealConfig.sealRotation || -8}
                            onChange={(e) => setSealConfig(prev => ({ ...prev, sealRotation: Number(e.target.value) }))}
                            className="w-12 px-1 py-0.2 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-right font-mono font-black text-[10px]"
                          />
                          <span>°</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-25"
                        max="25"
                        value={sealConfig.sealRotation || -8}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sealRotation: Number(e.target.value) }))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Stamp Position Side</label>
                      <select
                        value={sealConfig.sealPosition || 'bottom-right'}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sealPosition: e.target.value }))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold"
                      >
                        <option value="bottom-right">Bottom Right (Standard)</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-center">Bottom Center</option>
                        <option value="over-photo">Over Photo Lower Corner</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Stamp Opacity ({Math.round((sealConfig.sealOpacity || 0.85) * 100)}%)</label>
                      <input
                        type="range"
                        min="0.3"
                        max="1.0"
                        step="0.05"
                        value={sealConfig.sealOpacity || 0.85}
                        onChange={(e) => setSealConfig(prev => ({ ...prev, sealOpacity: Number(e.target.value) }))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Text Fields */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-500 font-black mb-1">Principal Name / Sign Text</label>
                    <input
                      type="text"
                      value={sealConfig.principalName}
                      onChange={(e) => setSealConfig(prev => ({ ...prev, principalName: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-black mb-1">Office Contact Numbers</label>
                    <input
                      type="text"
                      value={sealConfig.officeContact}
                      onChange={(e) => setSealConfig(prev => ({ ...prev, officeContact: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSealModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSealConfig}
                disabled={isSavingSealConfig}
                className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingSealConfig ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Saving to Cloud Database...</span>
                  </>
                ) : sealSavedSuccess ? (
                  <>
                    <Check size={14} />
                    <span>Applied to All Cards!</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save &amp; Apply to All Cards</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: SINGLE CARD PREVIEW & INSTANT PRINT ─── */}
      {previewStudent && (
        <SingleCardModal
          student={previewStudent}
          allStudents={photoIndex}
          theme={resolveClassTheme(
            previewStudent['Admission sought for class'] || previewStudent['Class'] || previewStudent.class,
            getStudentStreamVal(previewStudent),
            (selectedTheme !== 'auto' && selectedTheme !== 'classified') ? selectedTheme : classThemes,
            previewStudent
          )}
          sealConfig={sealConfig}
          printMode={printMode}
          cardWidthMm={cardWidthMm}
          cardHeightMm={cardHeightMm}
          photoWidthPx={photoWidthPx}
          photoHeightPx={photoHeightPx}
          qrSizePx={qrSizePx}
          onClose={() => setPreviewStudent(null)}
        />
      )}

      {/* ─── MODAL 3: FAST CACHE GENERATION & PROGRESS BAR ─── */}
      {isGenerating && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 p-6 shadow-2xl space-y-4 text-center">
            {/* Top-Right Close X Button */}
            <button
              type="button"
              onClick={handleCancelGeneration}
              className="absolute top-4 right-4 p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              title="Cancel Preparation"
            >
              <X size={16} />
            </button>

            <ModernLoader
              moduleKey="idCards"
              text={`Preparing ID Cards (${generationProgress.current}/${generationProgress.total})`}
              subtext={generationProgress.status}
              progress={generationProgress.percent}
              totalRecords={generationProgress.total}
              className="py-2"
            />

            <div className="pt-1 text-[10px] text-slate-400 font-semibold italic">
              ⚡ Pre-warming photo memory cache &amp; structuring layout for clean print...
            </div>

            {/* Cancel Action Button */}
            <button
              type="button"
              onClick={handleCancelGeneration}
              className="w-full mt-2 py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-700 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-400 font-extrabold text-xs border border-slate-300 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <X size={14} className="text-slate-500 hover:text-red-600" />
              <span>Cancel Preparation</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: REALTIME CLASSIFIED & PRESET THEME PICKER (UNBLURRED BACKGROUND) ─── */}
      {showThemePicker && (
        <div
          className="fixed inset-0 z-[10020] flex items-center justify-center p-3 sm:p-4 bg-slate-950/20 animate-fadeIn print:hidden"
          onClick={() => setShowThemePicker(false)}
        >
          <div
            className="w-full max-w-lg bg-white/95 dark:bg-slate-900/95 rounded-3xl border border-slate-300 dark:border-slate-800 p-4 sm:p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title & Action Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center border border-purple-300 dark:border-purple-700/50">
                  <Palette size={18} />
                </div>
                <div>
                  <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-purple-900 dark:text-purple-300">
                    Card Theme Suite
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    Realtime live application — unblurred background view
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTheme('classified');
                  }}
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    selectedTheme === 'auto' || selectedTheme === 'classified'
                      ? 'bg-purple-700 text-white border-purple-800 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title="Reset to Classified Class Themes"
                >
                  Classified Auto
                </button>
                <button
                  type="button"
                  onClick={() => setShowThemePicker(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Tab Selector: Classified View vs 12 Presets */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black">
              <button
                type="button"
                onClick={() => setThemeModalTab('classified')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  themeModalTab === 'classified'
                    ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-xs border border-purple-200 dark:border-purple-800'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                🏫 Classified (Class-wise Themes)
              </button>
              <button
                type="button"
                onClick={() => setThemeModalTab('presets')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  themeModalTab === 'presets'
                    ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-xs border border-purple-200 dark:border-purple-800'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                🎨 Global 12 Presets
              </button>
            </div>

            {/* TAB 1: CLASSIFIED CLASS-WISE THEME MANAGER */}
            {themeModalTab === 'classified' && (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-xl border border-purple-200 dark:border-purple-900/40">
                  💡 Below are theme assignments for each class &amp; stream category. Clicking any swatch applies it <strong className="text-purple-700 dark:text-purple-300">LIVE IN REALTIME</strong> to background cards!
                </div>

                {[
                  { key: '11th_Science', label: 'Class 11th (Science)', icon: '🧪' },
                  { key: '11th_Arts', label: 'Class 11th (Humanities / Arts)', icon: '📖' },
                  { key: '11th_Commerce', label: 'Class 11th (Commerce)', icon: '📈' },
                  { key: '12th_Science', label: 'Class 12th (Science)', icon: '🔬' },
                  { key: '12th_Arts', label: 'Class 12th (Humanities / Arts)', icon: '🏛️' },
                  { key: '12th_Commerce', label: 'Class 12th (Commerce)', icon: '💼' },
                  { key: '10th', label: 'Class 9th & 10th (Secondary)', icon: '📚' },
                ].map(item => {
                  const currentThemeId = classThemes[item.key] || 'emerald';
                  const currentThemeObj = ID_CARD_THEMES[currentThemeId] || ID_CARD_THEMES.emerald;
                  return (
                    <div
                      key={item.key}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                          <span>{item.icon}</span> {item.label}
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md text-white shadow-2xs flex items-center gap-1" style={{ backgroundColor: currentThemeObj.dotColor }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block"></span>
                          {currentThemeObj.name}
                        </span>
                      </div>

                      {/* Swatch row for this class */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {Object.values(ID_CARD_THEMES).map(t => {
                          const isActive = currentThemeId === t.id && (selectedTheme === 'auto' || selectedTheme === 'classified');
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setClassThemes(prev => ({ ...prev, [item.key]: t.id }));
                                setSelectedTheme('classified');
                              }}
                              title={`Set ${item.label} to ${t.name}`}
                              className={`w-6 h-6 rounded-full border-2 transition-all transform hover:scale-115 flex items-center justify-center cursor-pointer shrink-0 ${
                                isActive ? 'border-purple-600 ring-2 ring-purple-500/60 scale-110 shadow-sm' : 'border-white dark:border-slate-900 shadow-2xs opacity-85 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: t.dotColor }}
                            >
                              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: GLOBAL 12 PRESETS GRID */}
            {themeModalTab === 'presets' && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Select a global theme preset to apply uniformly across all classes live:
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1 no-scrollbar">
                  {Object.values(ID_CARD_THEMES).map(t => {
                    const isSelected = selectedTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTheme(t.id);
                        }}
                        title={t.name}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-100 dark:bg-purple-950/80 border-purple-600 dark:border-purple-400 ring-2 ring-purple-500/50 shadow-xs scale-102 font-black'
                            : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:scale-102 font-bold'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 shadow-md mb-1 inline-block transform transition-transform"
                          style={{ backgroundColor: t.dotColor }}
                        />
                        <span className="text-[10px] leading-tight truncate w-full text-slate-800 dark:text-slate-200">
                          {t.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Action */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-500">
                {selectedTheme === 'auto' || selectedTheme === 'classified' ? '✨ Classified Mode Active' : `🎨 Preset: ${ID_CARD_THEMES[selectedTheme]?.name}`}
              </span>
              <button
                type="button"
                onClick={() => setShowThemePicker(false)}
                className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs shadow-md cursor-pointer transition-all hover:scale-102"
              >
                ✓ Apply &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ─── SINGLE ID CARD VERTICAL PORTRAIT COMPONENT ───
 */
const SingleIdCardPortrait = React.memo(function SingleIdCardPortrait({
  student,
  allStudents,
  theme,
  sealConfig,
  isReversed,
  showCropMarks,
  cardWidthMm = 54.0,
  cardHeightMm = 85.6,
  photoWidthPx = 72,
  photoHeightPx = 86,
  qrSizePx = 72
}) {
  const safeTheme = (theme && theme.cardBorder)
    ? theme
    : (ID_CARD_THEMES?.emerald || ID_CARD_THEMES?.cobalt || {
        cardBorder: 'border-emerald-800',
        ribbonBg: 'bg-emerald-800',
        ribbonText: 'text-white'
      });

  const sName = student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || 'Student Name';
  const fName = student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || student.fatherName || '—';
  const cls = normalizeStudentClass(student['Admission sought for class'] || student['Class'] || student.class) || '—';
  const stm = getStudentStreamVal(student) || '—';
  const roll = getStudentRollVal(student) || '—';
  const vill = student['Name of your village'] || student['Village/Town'] || student.village || '—';
  const dist = student['District'] || student.district || '—';
  const mob = student['Mobile No. (with working WhatsApp)'] || student.mobile || '—';
  const pMob = student["Parent's Contact"] || student.parentContact || '';
  
  const rawSubs = getIdCardSubjectText(student) || '—';
  const subs = abbreviateSubjectName(rawSubs);

  const session = student['Session'] || student.session || sealConfig?.sessionLabel || '2025-26';
  const photo = resolveStudentPhoto(student, allStudents);

  // Dynamic QR Code encoding direct verification URL
  const qrUrl = generateVerificationQrUrl(student, 200);

  // Dynamic auto-scaling for Photo & QR Code based on card height ratio relative to 95mm standard
  const heightRatio = Math.min(1.15, Math.max(0.65, cardHeightMm / 95.0));
  const effectivePhotoW = Math.max(36, Math.round((photoWidthPx || 72) * heightRatio));
  const effectivePhotoH = Math.max(44, Math.round((photoHeightPx || 86) * heightRatio));
  const effectiveQrSize = Math.max(36, Math.round((qrSizePx || 72) * heightRatio));

  return (
    <div
      className={`relative bg-white text-slate-900 border-2 shadow-sm overflow-hidden flex flex-col justify-between select-none ${isReversed ? 'scale-x-[-1]' : ''}`}
      style={{
        width: `${cardWidthMm}mm`,
        height: `${cardHeightMm}mm`,
        boxSizing: 'border-box',
        borderRadius: '3mm',
        padding: '0.6mm',
        backgroundColor: '#ffffff',
        borderColor: safeTheme.cardBorderHex || safeTheme.dotColor || '#1d4ed8',
        fontFamily: "'Plus Jakarta Sans', 'Outfit', 'Inter', -apple-system, sans-serif"
      }}
    >
      {/* Cutting Crop Marks */}
      {showCropMarks && (
        <div className="absolute inset-0 pointer-events-none border border-dashed border-slate-300 opacity-60 print:opacity-30" />
      )}

      {/* ─── Top Header (Class-Specific Dynamic Theme Banner) ─── */}
      <div
        className="relative rounded-t-[2.5mm] border-b-4 border-slate-900/40 text-white p-0.5 flex items-center justify-between shadow-xs overflow-hidden"
        style={{ backgroundColor: safeTheme.ribbonHex || safeTheme.dotColor || '#1d4ed8' }}
      >
        {/* School Crest Logo (Left Badge) */}
        <div
          className="rounded-full bg-white border-2 border-slate-900/60 flex items-center justify-center p-0.5 shadow-sm flex-shrink-0 z-10 my-0.5 ml-0.5"
          style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
        >
          <img src="/logo.png" alt="Crest" className="w-full h-full object-contain" />
        </div>

        {/* School Title & Location (Center Block - Expanded & Dynamic Class-Specific Contrast) */}
        <div className="text-center flex-1 px-0.5 flex flex-col items-center justify-center min-w-0">
          <h2 className="font-black text-[12px] leading-[1.0] tracking-tighter uppercase text-white font-sans drop-shadow-sm truncate w-full">
            GOVT. HR. SEC.
          </h2>
          <h2 className="font-black text-[12px] leading-[1.0] tracking-tighter uppercase text-white font-sans drop-shadow-sm truncate w-full">
            SCHOOL SHANGUS
          </h2>
          <div className="text-[8.5px] font-serif font-black text-amber-300 uppercase tracking-tight mt-0.5 truncate w-full drop-shadow-2xs">
            {sealConfig?.schoolLocation || 'ANANTNAG KMR-192201'}
          </div>
        </div>

        {/* Session Badge - SESSION first then year, minimal padding */}
        <div className="flex items-center justify-center flex-shrink-0 bg-white px-0.5 py-0.5 rounded-tr-[2mm] rounded-bl-sm border-l border-b border-slate-900/40 shadow-2xs self-stretch my-0 -mr-0.5 -mt-0.5 -mb-0.5">
          <div className="flex flex-col items-center justify-center [writing-mode:vertical-rl] leading-none select-none">
            <span className="text-[5px] font-black text-slate-800 uppercase tracking-widest">
              SESSION
            </span>
            <span className="text-[7px] font-mono font-black text-red-800 tracking-tight mt-0.5">
              {session}
            </span>
          </div>
        </div>
      </div>

      {/* Yellow Dotted Ribbon */}
      <div className="flex justify-center -mt-1 z-10">
        <span className="px-2 py-0.2 bg-amber-300 text-slate-950 border border-dashed border-red-700 text-[6.5px] font-black uppercase tracking-tight rounded-xs shadow-2xs">
          Student Identity Card
        </span>
      </div>

      {/* ─── Photo & QR Code Row (Dynamic Scaled & Reduced Vertical Padding) ─── */}
      <div className="flex items-center justify-center px-1 py-0.5 gap-2.5 my-0.5">
        {/* Student Photo with Stamp Overlay — Theme-Coloured Border */}
        <div
          className="relative rounded-md border-2 overflow-hidden bg-slate-100 flex-shrink-0 shadow-2xs"
          style={{
            width: `${effectivePhotoW}px`,
            height: `${effectivePhotoH}px`,
            borderColor: safeTheme.cardBorderHex || safeTheme.dotColor || '#1d4ed8'
          }}
        >
          <img
            src={photo}
            alt={sName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="eager"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/logo.png';
            }}
          />
          {/* Overlaid Principal Signature if configured over photo */}
          {sealConfig?.sealPosition === 'over-photo' && sealConfig?.schoolSealUrl && (
            <div className="absolute bottom-0 right-0 transform -rotate-12 pointer-events-none select-none opacity-85">
              <img
                src={sealConfig.schoolSealUrl}
                alt="Stamp"
                style={{ width: `${(sealConfig.sealWidth || 34) * 0.7}px`, height: 'auto' }}
                className="object-contain"
              />
            </div>
          )}
        </div>

        {/* Executive Pro Verification QR Code Container — Theme-Coloured Border & Background */}
        <div
          className="relative p-0.5 rounded-lg border-2 shadow-xs flex-shrink-0 flex items-center justify-center"
          style={{
            width: `${effectiveQrSize}px`,
            height: `${effectiveQrSize}px`,
            backgroundColor: safeTheme.ribbonHex || safeTheme.dotColor || '#1d4ed8',
            borderColor: safeTheme.cardBorderHex || safeTheme.dotColor || '#1d4ed8'
          }}
        >
          <div className="w-full h-full bg-white rounded-[5px] p-0.5 flex items-center justify-center overflow-hidden">
            <img src={qrUrl} alt="Verify QR" className="w-full h-full object-contain" />
          </div>
          <span className={`absolute -bottom-1.5 ${safeTheme.footerBg || 'bg-amber-400'} ${safeTheme.footerText || 'text-red-800'} text-[5.5px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter shadow-2xs border border-amber-500`}>
            Scan to Verify
          </span>
        </div>
      </div>

      {/* ─── Student Name Banner (Bigger Font) ─── */}
      <div
        className="w-full py-1 px-1 text-center font-black text-[11px] tracking-wide uppercase shadow-2xs rounded-xs truncate text-white"
        style={{ backgroundColor: safeTheme.ribbonHex || safeTheme.dotColor || '#1d4ed8' }}
      >
        {sName}
      </div>

      {/* Class & Stream Sub-Header — Theme-Coloured */}
      <div
        className="w-full text-center text-[8.5px] font-black py-0.5 uppercase tracking-tight text-white"
        style={{ backgroundColor: safeTheme.subHeaderHex || '#0f172a' }}
      >
        Class <strong className="text-amber-300 font-extrabold">{cls}</strong> ({stm})
      </div>

      {/* ─── Details Grid (Bigger Readable Text & Optimal Spacing) ─── */}
      <div className="relative px-1 py-1 text-[8.5px] font-bold text-slate-900 leading-tight space-y-1">
        {/* Subtle Translucent Watermark */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{ opacity: 0.04 }}
        >
          <img
            src="/logo.png"
            alt=""
            className="w-16 h-16 object-contain filter grayscale contrast-50"
          />
        </div>

        <div className={`grid grid-cols-12 gap-0.5 border-b ${safeTheme.tableBorder || 'border-blue-200'} pb-0.5`}>
          <span className="col-span-4 text-slate-600 font-black">Parentage</span>
          <span className="col-span-8 font-black uppercase text-slate-900 truncate">{fName}</span>
        </div>

        <div className={`grid grid-cols-12 gap-0.5 border-b ${safeTheme.tableBorder || 'border-blue-200'} pb-0.5`}>
          <span className="col-span-4 text-slate-600 font-black">Residence</span>
          <span className="col-span-8 font-black text-slate-900 truncate">{vill}, {dist}</span>
        </div>

        <div className={`grid grid-cols-12 gap-0.5 border-b ${safeTheme.tableBorder || 'border-blue-200'} pb-0.5`}>
          <span className="col-span-4 text-slate-600 font-black">Mobile</span>
          <span className="col-span-8 font-mono font-black text-slate-900 truncate">
            {mob}{pMob && pMob !== '—' && pMob !== mob ? ` / ${pMob}` : ''}
          </span>
        </div>

        <div className={`grid grid-cols-12 gap-0.5 border-b ${safeTheme.tableBorder || 'border-blue-200'} pb-0.5 bg-amber-50/90 px-0.5 rounded-xs`}>
          <span className="col-span-4 text-amber-900 font-black">Class Roll No.</span>
          <span className="col-span-8 font-mono font-black text-green-700 text-[10px]">{roll}</span>
        </div>

        <div className="grid grid-cols-12 gap-0.5 pt-0.5">
          <span className="col-span-4 text-slate-600 font-black">Subjects</span>
          <span className="col-span-8 font-black text-slate-900 truncate">{subs}</span>
        </div>
      </div>

      {/* ─── DYNAMIC VISUAL STAMP & SIGNATURE PLACEMENT ─── */}
      {sealConfig?.schoolSealUrl && sealConfig?.sealPosition !== 'over-photo' && (
        <div
          className="absolute pointer-events-none select-none z-[40]"
          style={{
            bottom: `${(sealConfig?.sealOffsetY ?? 2) + 5}mm`,
            left: sealConfig?.sealPosition === 'bottom-right' ? 'auto' : `${sealConfig?.sealOffsetX ?? 2}mm`,
            right: sealConfig?.sealPosition === 'bottom-right' ? `${sealConfig?.sealOffsetX ?? 2}mm` : 'auto',
            transform: `rotate(${sealConfig?.sealRotation ?? -8}deg)`,
            opacity: sealConfig?.sealOpacity ?? 0.85
          }}
        >
          <img
            src={sealConfig.schoolSealUrl}
            alt="Stamp"
            style={{ width: `${sealConfig?.sealWidth || 34}px`, height: 'auto' }}
            className="object-contain"
          />
        </div>
      )}

      {sealConfig?.principalSignatureUrl && (
        <div
          className="absolute pointer-events-none select-none z-[50]"
          style={{
            bottom: `${(sealConfig?.sigOffsetY ?? 2) + 5}mm`,
            right: sealConfig?.sigPosition === 'bottom-left' ? 'auto' : `${sealConfig?.sigOffsetX ?? 2}mm`,
            left: sealConfig?.sigPosition === 'bottom-left' ? `${sealConfig?.sigOffsetX ?? 2}mm` : 'auto',
            opacity: sealConfig?.sigOpacity ?? 0.95
          }}
        >
          <img
            src={sealConfig.principalSignatureUrl}
            alt="Sign"
            style={{ width: `${sealConfig?.sigWidth || 44}px`, height: 'auto' }}
            className="object-contain"
          />
        </div>
      )}

      {/* ─── Office Contact Footer ─── */}
      <div className="rounded-b-[2mm] bg-amber-300 text-red-800 text-center py-0.5 px-1 border-t border-amber-400">
        <div className="text-[6.5px] font-black uppercase text-slate-800 tracking-wider">Office Contact</div>
        <div className="font-mono font-black text-[9px] text-red-700 tracking-tight leading-none">
          {sealConfig?.officeContact || '7006912918 | 9682641216'}
        </div>
      </div>
    </div>
  );
});

/**
 * ─── OPTIONAL ID CARD BACK VIEW COMPONENT ───
 */
const SingleIdCardBack = React.memo(function SingleIdCardBack({
  student,
  sealConfig,
  isReversed,
  showCropMarks,
  cardWidthMm = 56.0,
  cardHeightMm = 95.0
}) {
  const sessionLabel = sealConfig?.sessionLabel || '2025–26';

  const rulesList = [
    { num: '1', title: 'Official Property', text: 'Property of Govt. HSS Shangus. Non-transferable and mandatory to carry on campus.' },
    { num: '2', title: 'Exam & Lab Access', text: 'Must be produced for entry to Examination Halls, Library, Computer & Science Labs.' },
    { num: '3', title: 'Loss & Replacement', text: 'Report loss or damage immediately to the Principal Office for official reissue.' },
    { num: '4', title: 'Strict Discipline', text: 'Tampering, alteration, or misuse of this card invites strict disciplinary action.' },
    { num: '5', title: 'Return Instructions', text: 'If found, please return to Admin Office, Govt. HSS Shangus, Anantnag (192201).' },
    { num: '6', title: 'Session Validity', text: `Valid strictly for Academic Session ${sessionLabel} unless cancelled.` },
    { num: '7', title: 'Digital Verification', text: 'Front QR code provides instant digital verification by school authorities.' }
  ];

  return (
    <div
      className={`relative bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 border-2 border-slate-700 shadow-sm overflow-hidden flex flex-col justify-between select-none p-1.5 ${isReversed ? 'scale-x-[-1]' : ''}`}
      style={{
        width: `${cardWidthMm}mm`,
        height: `${cardHeightMm}mm`,
        boxSizing: 'border-box',
        borderRadius: '3mm',
        backgroundColor: '#f8fafc',
        fontFamily: "'Plus Jakarta Sans', 'Outfit', 'Inter', -apple-system, sans-serif"
      }}
    >
      {showCropMarks && (
        <div className="absolute inset-0 pointer-events-none border border-dashed border-slate-300 opacity-60 print:opacity-30" />
      )}

      {/* ─── Back Header ─── */}
      <div className="rounded-t-md bg-blue-950 text-white p-1 text-center shadow-xs border-b-2 border-amber-400">
        <h4 className="font-black text-[8px] uppercase tracking-wider font-sans drop-shadow-2xs leading-tight">
          GOVT. HR. SEC. SCHOOL SHANGUS
        </h4>
        <div className="text-[6px] font-bold text-amber-300 uppercase tracking-tight mt-0.2">
          Rules &amp; Code of Conduct
        </div>
      </div>

      {/* ─── Rules Body (Beautifully Formatted Compact List) ─── */}
      <div className="flex-1 my-1 space-y-0.5 overflow-hidden px-0.5 flex flex-col justify-evenly">
        {rulesList.map((r) => (
          <div
            key={r.num}
            className="flex items-start gap-1 p-0.5 rounded bg-white border border-slate-200 shadow-2xs"
          >
            <span className="w-3 h-3 rounded-full bg-blue-900 text-amber-300 text-[6px] font-black flex items-center justify-center flex-shrink-0 mt-0.2 shadow-2xs">
              {r.num}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-black text-[6px] text-blue-950 uppercase tracking-tight block leading-none">
                {r.title}
              </span>
              <span className="text-[5.5px] font-semibold text-slate-700 leading-tight block mt-0.2">
                {r.text}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Back Footer: Authority & Signature ─── */}
      <div className="pt-0.5 border-t border-slate-300 flex items-end justify-between text-[5.5px]">
        <div className="text-left text-slate-700 font-bold leading-tight">
          <div className="text-[5px] text-slate-500 uppercase tracking-wider font-black">Issuing Authority</div>
          <div className="font-black text-slate-900 text-[6px]">Principal Office • HSS Shangus</div>
          <div className="text-[5px] font-mono text-slate-600">{sealConfig?.officeContact || '7006912918 | 9682641216'}</div>
        </div>

        <div className="text-right flex flex-col items-end justify-end">
          {sealConfig?.principalSignatureUrl ? (
            <img
              src={sealConfig.principalSignatureUrl}
              alt="Signature"
              className="h-4.5 w-auto object-contain max-w-[45px] -mb-0.5"
            />
          ) : (
            <div className="h-3.5" />
          )}
          <span className="font-black text-[5.5px] text-blue-950 uppercase border-t border-slate-400 pt-0.2">
            Principal Signature
          </span>
        </div>
      </div>
    </div>
  );
});

/**
 * ─── SINGLE CARD PREVIEW & INSTANT PRINT MODAL ───
 */
function SingleCardModal({
  student,
  allStudents,
  theme,
  sealConfig,
  printMode,
  cardWidthMm,
  cardHeightMm,
  photoWidthPx,
  photoHeightPx,
  qrSizePx,
  onClose
}) {
  const [isReversedMode, setIsReversedMode] = useState(printMode === 'reversed');
  const sName = student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || 'Student';

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-800 p-5 shadow-2xl space-y-4 flex flex-col">
        
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Shield size={16} className="text-amber-600" /> Single Card Inspector: {sName}
            </h3>
            <span className="text-[10px] text-slate-500 font-bold">
              High-Resolution Portrait Card &amp; Transparency Mirror
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="transform scale-110 sm:scale-125 origin-center my-4 single-card-print-target">
            <SingleIdCardPortrait
              student={student}
              allStudents={allStudents}
              theme={theme}
              sealConfig={sealConfig}
              isReversed={isReversedMode}
              showCropMarks={true}
              cardWidthMm={cardWidthMm}
              cardHeightMm={cardHeightMm}
              photoWidthPx={photoWidthPx}
              photoHeightPx={photoHeightPx}
              qrSizePx={qrSizePx}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs font-black">
          <button
            type="button"
            onClick={() => setIsReversedMode(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-all ${isReversedMode
              ? 'bg-purple-700 text-white border-purple-600 shadow-sm'
              : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <ArrowLeftRight size={13} />
            <span>{isReversedMode ? '🔄 Mirrored (Transparent Paper)' : 'Normal Direct View'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                document.body.classList.add('single-card-print-active');
                const cleanup = () => {
                  document.body.classList.remove('single-card-print-active');
                  window.removeEventListener('afterprint', cleanup);
                };
                window.addEventListener('afterprint', cleanup);
                setTimeout(() => {
                  window.print();
                  setTimeout(cleanup, 1200);
                }, 30);
              }}
              className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-black shadow-md cursor-pointer flex items-center gap-1.5 hover:scale-105 transition-all"
            >
              <Printer size={14} /> <span>Print Single Card (Instant)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
