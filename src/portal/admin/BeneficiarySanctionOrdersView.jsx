// =================================================================
// HSS SHANGUS — Mutual Benefit Fund & Sanction Orders Studio
// =================================================================
// A high-density administrative workspace for composing, customizing,
// and printing institutional financial assistance rolls, mutual benefit
// funds, bank debit orders, and beneficiary disbursement advice.
// =================================================================

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { printBeneficiarySanctionOrder } from '../../utils/beneficiaryPrintUtils';
import {
  Printer, Download, FileSpreadsheet, FileText, Plus, Trash2, Edit3,
  Save, RotateCcw, Check, Search, Layers, Settings2,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, HelpCircle, X, Calendar,
  Hash, IndianRupee, Users, CheckSquare, Square, UserCheck, RefreshCw,
  Copy, PlusCircle, Sparkles, Share2, Eye, EyeOff, GripVertical, CheckCircle2,
  AlertCircle, Building2, CreditCard, ShieldCheck, Award, ArrowLeft,
  PanelRightClose, PanelRightOpen,
  Undo, Redo, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, Palette, Type
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeightRule, BorderStyle, PageOrientation
} from 'docx';
import { showToast } from '../../components/common/GlobalToast';
import {
  getCachedCollectionSync,
  findCachedStudentSync,
  getCurrentAcademicSession
} from '../../services/dbCache';
import {
  getStudentRegIndex,
  lookupStudentByRegSync
} from '../../services/studentIndexService';
import {
  saveGeneratedDocToHistory
} from '../../services/docHistoryService';
import {
  parseRefParts,
  stepRefNumber,
  updateRefSerial
} from '../../services/certificateRegistryService';
import { logAdminActivity } from '../../services/adminActivityLogger';
import {
  extractStudentName,
  extractFatherName,
  extractMotherName,
  extractClass,
  extractSession,
  extractBoardRegNo,
  extractBankAccount,
  extractBankName,
  extractIfsc,
  extractDob,
  extractGender,
  extractMobile,
  extractAadhaar,
  extractCategory,
  cleanRegNoVal,
  getStudentRollNumber,
  CANONICAL_ACADEMIC_SESSIONS,
  DB_COLUMN_GROUPS,
  ALL_DB_COLUMNS
} from './CustomRosterDocumentBuilderView';
import DocumentHistoryModal from './DocumentHistoryModal';

export function extractParentage(st) {
  if (!st) return '—';
  const f = extractFatherName(st);
  if (f && f !== '—') return f;
  const m = extractMotherName(st);
  if (m && m !== '—') return m;
  const rawParent = st['Parentage'] || st.parentage || st["Father's Name"] || st.fatherName;
  return rawParent || '—';
}

// ─── Default Document Configurations & Templates ───
const TEMPLATE_PRESETS = [
  {
    id: 'mutual_benefit',
    name: 'Mutual Benefit Fund (Committee Sanction)',
    desc: 'Official list of student beneficiaries with candidate signatures and 5-member committee certification.',
    title: 'List of Beneficiaries for Mutual Benefit Fund, 2025-26',
    showPreamble: false,
    preambleText: '',
    showCertification: true,
    certificationTemplate:
      'Certified that the above-mentioned students, having been verified based on the available records of the institution, are found genuine in their request for financial assistance from the mutual benefit fund. They have been recommended by the designated committee members in accordance with the norms and rules of the institution.\n\nFollowing the evaluation and distribution process, the committee found all listed students eligible for support. The finalized list is in accordance with the available balance in the poor fund. The committee approved financial assistance of ₹800 per student under the orphan category and ₹600 per student for others.\n\nThe total amount disbursed is ₹{totalAmount}. After this distribution, the remaining balance has been reserved to address any pending requests from students.',
    signaturesMode: 'committee',
    committeeMemberCount: 5,
    columns: [
      { key: 'sno', label: 'S.No.', widthPct: 5, align: 'center', isCustom: false },
      { key: 'studentName', label: 'Name of the Candidate', widthPct: 18, align: 'left', isCustom: false },
      { key: 'parentage', label: 'Parentage', widthPct: 18, align: 'left', isCustom: false },
      { key: 'className', label: 'Class', widthPct: 7, align: 'center', isCustom: false },
      { key: 'bankAccount', label: 'Account number', widthPct: 16, align: 'center', isCustom: false },
      { key: 'ifsc', label: 'IFSC', widthPct: 12, align: 'center', isCustom: false },
      { key: 'amount', label: 'Amount sanctioned', widthPct: 12, align: 'right', isCustom: true, type: 'currency' },
      { key: 'signature', label: 'Signature of Candidate', widthPct: 12, align: 'center', isCustom: true, type: 'signature' },
    ]
  },
  {
    id: 'bank_debit',
    name: 'Bank Debit Order & Beneficiary Advice',
    desc: 'Directive to bank branch with account debit instructions and distribution breakup signed by Principal.',
    title: 'List of Beneficiaries',
    showPreamble: true,
    preambleText:
      'Kindly debit an amount of {totalAmount} from A/c {accountNumber} and distribute the same amount according to the following breakup.',
    sourceAccountNo: '0137040500000421',
    showCertification: false,
    certificationTemplate: '',
    signaturesMode: 'principal',
    columns: [
      { key: 'sno', label: 'S.No.', widthPct: 5, align: 'center', isCustom: false },
      { key: 'studentName', label: 'Name of the Candidate / Shop', widthPct: 18, align: 'left', isCustom: false },
      { key: 'parentage', label: 'Parentage', widthPct: 18, align: 'left', isCustom: false },
      { key: 'className', label: 'Class', widthPct: 7, align: 'center', isCustom: false },
      { key: 'bankAccount', label: 'Account number', widthPct: 16, align: 'center', isCustom: false },
      { key: 'ifsc', label: 'IFSC', widthPct: 12, align: 'center', isCustom: false },
      { key: 'amount', label: 'Amount', widthPct: 12, align: 'right', isCustom: true, type: 'currency' },
      { key: 'remarks', label: 'Remarks', widthPct: 12, align: 'left', isCustom: true, type: 'text' },
    ]
  },
  {
    id: 'poor_fund',
    name: 'Poor Fund Assistance Roll',
    desc: 'Institutional poor fund disbursement statement with committee certification.',
    title: 'Sanction Order — Institutional Poor Fund Assistance, 2025-26',
    showPreamble: false,
    preambleText: '',
    showCertification: true,
    certificationTemplate:
      'Sanction is hereby accorded to the grant and electronic disbursement of financial aid amounting to ₹{totalAmount} out of the School Poor Fund in favor of the eligible and underprivileged students listed above for academic session {session}. The selection was executed in transparent coordination with institutional faculty committee.',
    signaturesMode: 'committee',
    committeeMemberCount: 5,
    columns: [
      { key: 'sno', label: 'S.No.', widthPct: 5, align: 'center', isCustom: false },
      { key: 'studentName', label: 'Name of the Candidate', widthPct: 18, align: 'left', isCustom: false },
      { key: 'parentage', label: 'Parentage', widthPct: 18, align: 'left', isCustom: false },
      { key: 'className', label: 'Class', widthPct: 7, align: 'center', isCustom: false },
      { key: 'bankAccount', label: 'Account number', widthPct: 16, align: 'center', isCustom: false },
      { key: 'ifsc', label: 'IFSC', widthPct: 12, align: 'center', isCustom: false },
      { key: 'amount', label: 'Sanctioned (₹)', widthPct: 12, align: 'right', isCustom: true, type: 'currency' },
      { key: 'remarks', label: 'Category / Note', widthPct: 12, align: 'left', isCustom: true, type: 'text' },
    ]
  },
  {
    id: 'custom',
    name: 'Custom Sanction Roll',
    desc: 'Fully customizable roll with custom columns and arbitrary preamble/certification.',
    title: 'Official Sanction Order & Beneficiary Register',
    showPreamble: true,
    preambleText: 'The competent authority has approved financial assistance for the following candidates:',
    sourceAccountNo: '',
    showCertification: true,
    certificationTemplate: 'Certified that all candidates listed above have been scrutinized and approved as per school regulations.',
    signaturesMode: 'both',
    committeeMemberCount: 4,
    columns: [
      { key: 'sno', label: 'S.No.', widthPct: 6, align: 'center', isCustom: false },
      { key: 'studentName', label: 'Candidate Name', widthPct: 20, align: 'left', isCustom: false },
      { key: 'parentage', label: 'Parentage', widthPct: 18, align: 'left', isCustom: false },
      { key: 'className', label: 'Class', widthPct: 8, align: 'center', isCustom: false },
      { key: 'bankAccount', label: 'Account No.', widthPct: 16, align: 'center', isCustom: false },
      { key: 'ifsc', label: 'IFSC Code', widthPct: 12, align: 'center', isCustom: false },
      { key: 'amount', label: 'Amount (₹)', widthPct: 10, align: 'right', isCustom: true, type: 'currency' },
      { key: 'remarks', label: 'Remarks', widthPct: 10, align: 'left', isCustom: true, type: 'text' },
    ]
  }
];

export default function BeneficiarySanctionOrdersView({
  onClose,
  allStudents = []
}) {
  // ─── Active Preset & Orientation ───
  const [activePresetId, setActivePresetId] = useState('mutual_benefit');
  const [orientation, setOrientation] = useState('portrait'); // 'portrait' | 'landscape'
  const [showControlsPanel, setShowControlsPanel] = useState(true);
  const [customSidebarWidth, setCustomSidebarWidth] = useState(null); // null = default 1/3 flex split

  // ─── Drag-to-Resize refs ───
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const asideRef = useRef(null);

  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    const currentW = asideRef.current ? asideRef.current.getBoundingClientRect().width : (window.innerWidth / 3);
    resizeStartWidth.current = currentW;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing.current) return;
      // Drag left = widen sidebar (we're resizing from the LEFT edge of the sidebar)
      const delta = resizeStartX.current - e.clientX;
      const maxW = window.innerWidth * 0.55;
      const minW = 280;
      const newWidth = Math.min(maxW, Math.max(minW, resizeStartWidth.current + delta));
      setCustomSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ─── Letterhead & Institutional Metadata ───
  const [officeTitle, setOfficeTitle] = useState('OFFICE OF THE PRINCIPAL');
  const [institutionName, setInstitutionName] = useState('GOVT. HIGHER SECONDARY SCHOOL SHANGUS');
  const [institutionAddress, setInstitutionAddress] = useState('Anantnag, Kashmir — 192201 (J&K)');
  const [contactLine, setContactLine] = useState('UDISE: 01061400618 | Email: ghssshangus74@gmail.com');
  const [showLetterheadBorder, setShowLetterheadBorder] = useState(true);

  // ─── Reference No & Date with Stepper ───
  const [refNo, setRefNo] = useState('HSS/SHG/MBF/2025-26/01');
  const [dateStr, setDateStr] = useState(() => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}-${m}-${y}`;
  });

  // Reference Number Parsing & Stepper
  const refParts = useMemo(() => parseRefParts(refNo), [refNo]);
  const handleStepRef = useCallback((delta) => {
    const { formatted, nextNum } = stepRefNumber(refNo, delta);
    setRefNo(formatted);
    showToast(`Ref serial set to #${nextNum} (${formatted})`, 'success');
  }, [refNo]);

  // ─── Document Title, Preamble & Certification ───
  const [documentTitle, setDocumentTitle] = useState('List of Beneficiaries for Mutual Benefit Fund, 2025-26');
  const [showPreamble, setShowPreamble] = useState(false);
  const [preambleText, setPreambleText] = useState(
    'Kindly debit an amount of {totalAmount} from A/c {accountNumber} and distribute the same amount according to the following breakup.'
  );
  const [sourceAccountNo, setSourceAccountNo] = useState('0137040500000421');

  const [showCertification, setShowCertification] = useState(true);
  const [certificationText, setCertificationText] = useState(
    TEMPLATE_PRESETS[0].certificationTemplate
  );

  // ─── Signatories Configuration ───
  const [signaturesMode, setSignaturesMode] = useState('committee'); // 'committee' | 'principal' | 'both'
  const [committeeMemberCount, setCommitteeMemberCount] = useState(5);
  const [committeeHeader, setCommitteeHeader] = useState('Signatures of committee members');
  const [principalTitle, setPrincipalTitle] = useState('Principal');
  const [principalSubtitle, setPrincipalSubtitle] = useState('');

  // ─── Active Columns ───
  const [activeColumns, setActiveColumns] = useState(() => TEMPLATE_PRESETS[0].columns);

  // ─── Beneficiary Row Records ───
  const [beneficiaries, setBeneficiaries] = useState([]);

  // ─── Font & Formatting State ───
  const [documentFontFamily, setDocumentFontFamily] = useState("'Times New Roman', Times, serif");
  const [tableFontSize, setTableFontSize] = useState('9.5pt');
  const [rowPaddingPreset, setRowPaddingPreset] = useState('compact'); // 'compact' | 'standard' | 'spacious'
  const [sidebarTab, setSidebarTab] = useState('students'); // 'students' | 'content' | 'signatures'
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    h1: false,
    h2: false,
    p: true,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    justify: false
  });

  const FONT_SIZE_STEPS = ['8pt', '8.5pt', '9pt', '9.5pt', '10pt', '10.5pt', '11pt', '11.5pt', '12pt', '13pt', '14pt'];

  const handleAdjustFontSize = (delta) => {
    const currentIdx = FONT_SIZE_STEPS.indexOf(tableFontSize);
    if (currentIdx !== -1) {
      const nextIdx = Math.max(0, Math.min(FONT_SIZE_STEPS.length - 1, currentIdx + delta));
      setTableFontSize(FONT_SIZE_STEPS[nextIdx]);
    } else {
      setTableFontSize('9.5pt');
    }
  };

  const checkActiveFormats = useCallback(() => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold') || false,
        italic: document.queryCommandState('italic') || false,
        underline: document.queryCommandState('underline') || false,
        strike: document.queryCommandState('strikeThrough') || false,
        alignLeft: document.queryCommandState('justifyLeft') || false,
        alignCenter: document.queryCommandState('justifyCenter') || false,
        alignRight: document.queryCommandState('justifyRight') || false,
        justify: document.queryCommandState('justifyFull') || false,
        h1: false,
        h2: false,
        p: true
      });
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handleSelChange = () => {
      checkActiveFormats();
    };
    document.addEventListener('selectionchange', handleSelChange);
    return () => document.removeEventListener('selectionchange', handleSelChange);
  }, [checkActiveFormats]);

  const executeFormat = (command, value = null) => {
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}

    try {
      if (command === 'formatBlock') {
        const targetClean = (value || 'p').replace(/[<>]/g, '').toLowerCase();
        let sel = window.getSelection();
        let currentBlock = null;
        if (sel && sel.rangeCount > 0) {
          let node = sel.getRangeAt(0).commonAncestorContainer;
          if (node.nodeType === 3) node = node.parentNode;
          currentBlock = node?.closest('h1, h2, h3, h4, h5, h6, p, blockquote, div');
        }
        const currentTag = currentBlock?.tagName?.toLowerCase() || 'p';
        const isSameTag = currentTag === targetClean;
        const newTag = (isSameTag && targetClean !== 'p') ? 'p' : targetClean;
        let success = document.execCommand('formatBlock', false, `<${newTag}>`);
        if (!success) {
          document.execCommand('formatBlock', false, newTag);
        }
      } else {
        document.execCommand(command, false, value);
      }
    } catch (err) {
      console.warn('Formatting command note:', err);
    }
    checkActiveFormats();
  };

  const applyTextColor = (color) => {
    try {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('foreColor', false, color);
    } catch (err) {
      console.warn('Apply text color note:', err);
    }
    checkActiveFormats();
    setShowColorPalette(false);
  };

  const OFFICIAL_PALETTE = [
    { name: 'Black', hex: '#000000' },
    { name: 'Maroon', hex: '#800000' },
    { name: 'Navy', hex: '#0a192f' },
    { name: 'Dark Slate', hex: '#1e293b' },
    { name: 'Slate Gray', hex: '#475569' },
    { name: 'Forest Emerald', hex: '#047857' },
    { name: 'Teal Blue', hex: '#0d9488' },
    { name: 'Royal Blue', hex: '#2563eb' },
    { name: 'Crimson', hex: '#dc2626' },
    { name: 'Gold Amber', hex: '#b45309' },
  ];

  // ─── Bulk Reg No Ingestion & Data Fetching State ───
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedClass, setSelectedClass] = useState('All');
  const [bulkRegInput, setBulkRegInput] = useState('');
  const [isFetchingRegs, setIsFetchingRegs] = useState(false);
  const [showBulkRegInput, setShowBulkRegInput] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_show_bulk_reg_input');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleBulkRegInput = useCallback(() => {
    setShowBulkRegInput(prev => {
      const next = !prev;
      try {
        localStorage.setItem('hss_show_bulk_reg_input', String(next));
      } catch (_) {}
      return next;
    });
  }, []);

  const bulkTokensCount = useMemo(() => {
    if (!bulkRegInput || !bulkRegInput.trim()) return 0;
    return bulkRegInput
      .split(/[\r\n,;\t]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && !/^(reg|no|sno|serial)$/i.test(t)).length;
  }, [bulkRegInput]);

  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // ─── Quick Amount Filler State ───
  const [showFillAmountModal, setShowFillAmountModal] = useState(false);
  const [bulkAmountVal, setBulkAmountVal] = useState('600');
  const [bulkAmountType, setBulkAmountType] = useState('all'); // 'all' | 'orphan_others'

  // ─── Custom Column Modal State ───
  const [showAddCustomColModal, setShowAddCustomColModal] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState('text'); // 'text' | 'currency' | 'signature'
  const [newColAlign, setNewColAlign] = useState('center');
  const [newColWidth, setNewColWidth] = useState(12);

  // ─── Add Standard DB Column Dropdown ───
  const [showInTableAddMenu, setShowInTableAddMenu] = useState(false);
  const inTableAddColRef = useRef(null);

  useEffect(() => {
    if (!showInTableAddMenu) return;
    const handleClickOutside = (e) => {
      if (inTableAddColRef.current && !inTableAddColRef.current.contains(e.target)) {
        setShowInTableAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInTableAddMenu]);

  // ─── History & Save Draft Modal ───
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // ─── Total Amount Sum (Dynamic Auto-Calculation) ───
  const totalAmount = useMemo(() => {
    return beneficiaries.reduce((sum, row) => {
      // Find all currency columns or key 'amount'
      const valStr = String(row.amount || '').replace(/[^0-9.]/g, '');
      const num = parseFloat(valStr) || 0;
      return sum + num;
    }, 0);
  }, [beneficiaries]);

  const formattedTotalAmount = useMemo(() => {
    return totalAmount.toLocaleString('en-IN');
  }, [totalAmount]);

  // ─── Interpolated Dynamic Preamble & Certification Text ───
  const resolvedPreambleText = useMemo(() => {
    return preambleText
      .replace(/{totalAmount}/g, formattedTotalAmount)
      .replace(/{accountNumber}/g, sourceAccountNo || '___________')
      .replace(/{session}/g, selectedSession);
  }, [preambleText, formattedTotalAmount, sourceAccountNo, selectedSession]);

  const resolvedCertificationText = useMemo(() => {
    return certificationText
      .replace(/{totalAmount}/g, formattedTotalAmount)
      .replace(/{session}/g, selectedSession);
  }, [certificationText, formattedTotalAmount, selectedSession]);

  // ─── Switch Template Preset ───
  const handleApplyPreset = (preset) => {
    setActivePresetId(preset.id);
    setDocumentTitle(preset.title);
    setShowPreamble(preset.showPreamble);
    setPreambleText(preset.preambleText || '');
    if (preset.sourceAccountNo !== undefined) {
      setSourceAccountNo(preset.sourceAccountNo);
    }
    setShowCertification(preset.showCertification);
    setCertificationText(preset.certificationTemplate || '');
    setSignaturesMode(preset.signaturesMode || 'committee');
    if (preset.committeeMemberCount) {
      setCommitteeMemberCount(preset.committeeMemberCount);
    }
    setActiveColumns(preset.columns);
    showToast(`Applied preset: ${preset.name}`, 'info');
  };

  // ─── Zero-Read Unified In-Memory Student Pool ───
  // Reuses pre-fetched student datasets from AdminDashboard (allStudents prop) and
  // local memory caches (getCachedCollectionSync) so zero new Firestore reads are consumed.
  const unifiedStudentsPool = useMemo(() => {
    const list = [];
    const seen = new Set();

    const addStudent = (st) => {
      if (!st || typeof st !== 'object') return;
      const id = String(st.id || st._docId || extractBoardRegNo(st) || '').trim();
      const reg = cleanRegNoVal(extractBoardRegNo(st)).toLowerCase();
      const dedupeKey = id || reg;
      if (dedupeKey && seen.has(dedupeKey)) return;
      if (dedupeKey) seen.add(dedupeKey);
      list.push(st);
    };

    // 1. Prioritize allStudents already fetched and maintained by AdminDashboard
    if (Array.isArray(allStudents)) {
      allStudents.forEach(addStudent);
    }

    // 2. Combine with in-memory sync cache from admissions (0 reads)
    const cachedAdm = getCachedCollectionSync('admissions');
    if (Array.isArray(cachedAdm)) {
      cachedAdm.forEach(addStudent);
    }

    // 3. Combine with in-memory sync cache from masterRegisters (0 reads)
    const cachedMaster = getCachedCollectionSync('masterRegisters');
    if (Array.isArray(cachedMaster)) {
      cachedMaster.forEach(addStudent);
    }

    return list;
  }, [allStudents]);

  // Derived in-memory cohort for currently selected session (0 reads)
  const sessionStudentsPool = useMemo(() => {
    if (!selectedSession || selectedSession === 'All') return unifiedStudentsPool;
    const cleanTarget = selectedSession.toLowerCase().replace(/session\s*/i, '').replace(/[\u2013\u2014]/g, '-').trim();

    const filtered = unifiedStudentsPool.filter(st => {
      const s = extractSession(st);
      if (!s) return false;
      const sNorm = String(s).toLowerCase().replace(/session\s*/i, '').replace(/[\u2013\u2014]/g, '-').trim();
      return sNorm === cleanTarget || sNorm.includes(cleanTarget) || cleanTarget.includes(sNorm);
    });

    return filtered.length > 0 ? filtered : unifiedStudentsPool;
  }, [unifiedStudentsPool, selectedSession]);

  // ─── Extract Column Value from Student Record ───
  const extractDbFieldValue = useCallback((st, colKey) => {
    if (!st) return '';
    switch (colKey) {
      case 'studentName': return extractStudentName(st);
      case 'parentage': return extractParentage(st) || extractFatherName(st);
      case 'fatherName': return extractFatherName(st);
      case 'motherName': return st['Mother\'s Name'] || st.motherName || '—';
      case 'className': return extractClass(st);
      case 'session': return extractSession(st) || selectedSession;
      case 'bankAccount': return extractBankAccount(st);
      case 'bankName': return extractBankName(st);
      case 'ifsc': return extractIfsc(st);
      case 'boardRegNo': return extractBoardRegNo(st);
      case 'classRollNo': return getStudentRollNumber(st);
      case 'gender': return extractGender(st);
      case 'dob': return extractDob(st);
      case 'category': return extractCategory(st);
      case 'mobile': return extractMobile(st);
      case 'aadhaarNo': return extractAadhaar(st);
      default:
        return st[colKey] || st.raw?.[colKey] || '';
    }
  }, [selectedSession]);

  // ─── Resolve Single Student by Reg No (Synchronous 0-Read In-Memory Resolution) ───
  const findStudentByReg = useCallback((rawReg) => {
    const clean = cleanRegNoVal(rawReg).toLowerCase();
    if (!clean) return null;

    // 1. Search in current session students pool
    const matchPool = sessionStudentsPool.find(st => {
      const r = cleanRegNoVal(extractBoardRegNo(st)).toLowerCase();
      return r === clean || (r && clean.length >= 5 && (r.includes(clean) || clean.includes(r)));
    });
    if (matchPool) return matchPool;

    // 2. Search in unified in-memory students pool (covers all sessions, admissions, and master registers)
    const matchUnified = unifiedStudentsPool.find(st => {
      const r = cleanRegNoVal(extractBoardRegNo(st)).toLowerCase();
      return r === clean || (r && clean.length >= 5 && (r.includes(clean) || clean.includes(r)));
    });
    if (matchUnified) return matchUnified;

    // 3. Search in global dbCache in-memory datasets (0 reads)
    const matchCache = findCachedStudentSync(rawReg);
    if (matchCache) return matchCache;

    // 4. Search in student index (reads synchronous memory/storage cache - 0 reads)
    const indexMatch = lookupStudentByRegSync(rawReg);
    if (indexMatch) {
      return {
        ...indexMatch,
        'Student\'s Name': indexMatch.name,
        'Father\'s Name': indexMatch.fatherName,
        'Admission sought for class': indexMatch.class,
        'Session': indexMatch.session,
        'Board Registration Number': rawReg,
      };
    }

    return null;
  }, [sessionStudentsPool, unifiedStudentsPool]);

  // ─── Bulk Reg No Fetch Handler ───
  const handleFetchBulkRegs = async () => {
    const rawText = bulkRegInput.trim();
    if (!rawText) {
      showToast('Please type or paste one or more Registration Numbers', 'warning');
      return;
    }

    setIsFetchingRegs(true);
    // Split by commas, newlines, tabs, semicolons or spaces
    const rawTokens = rawText
      .split(/[\r\n,;\t]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && !/^(reg|no|sno|serial)$/i.test(t));

    // Deduplicate within pasted input itself
    const seenPasted = new Set();
    const tokens = [];
    rawTokens.forEach(t => {
      const lower = t.toLowerCase();
      if (!seenPasted.has(lower)) {
        seenPasted.add(lower);
        tokens.push(t);
      }
    });

    if (tokens.length === 0) {
      setIsFetchingRegs(false);
      showToast('No valid Registration Numbers detected in text', 'warning');
      return;
    }

    // Set of already added registration numbers and student IDs in current list
    const existingRegs = new Set(
      beneficiaries
        .map(b => cleanRegNoVal(b.boardRegNo || extractBoardRegNo(b._rawStudent)).toLowerCase())
        .filter(Boolean)
    );

    let addedCount = 0;
    let manualCount = 0;
    let skippedDuplicatesCount = 0;
    const newRows = [];

    tokens.forEach((token, idx) => {
      const cleanToken = cleanRegNoVal(token).toLowerCase();
      if (cleanToken && existingRegs.has(cleanToken)) {
        skippedDuplicatesCount++;
        return;
      }

      const found = findStudentByReg(token);
      const foundReg = found ? cleanRegNoVal(extractBoardRegNo(found)).toLowerCase() : cleanToken;
      if (foundReg && existingRegs.has(foundReg)) {
        skippedDuplicatesCount++;
        return;
      }
      if (foundReg) {
        existingRegs.add(foundReg);
      }

      const rowId = `ben_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;

      if (found) {
        // Construct row from DB columns
        const newRow = {
          id: rowId,
          _rawStudent: found,
          boardRegNo: cleanRegNoVal(extractBoardRegNo(found)) || token,
          studentName: extractStudentName(found) || '',
          parentage: extractParentage(found) || extractFatherName(found) || '',
          className: extractClass(found) || (selectedClass !== 'All' ? selectedClass : ''),
          bankAccount: extractBankAccount(found) !== '—' ? extractBankAccount(found) : '',
          ifsc: extractIfsc(found) !== '—' ? extractIfsc(found) : '',
          amount: '600.00', // default assistance figure
          signature: '',
          remarks: '',
        };
        // Fill other active columns
        activeColumns.forEach(c => {
          if (!newRow[c.key] && !c.isCustom) {
            newRow[c.key] = extractDbFieldValue(found, c.key);
          }
        });
        newRows.push(newRow);
        addedCount++;
      } else {
        // Unmatched reg no: insert blank editable row with regNo filled
        const manualRow = {
          id: rowId,
          boardRegNo: token,
          studentName: '',
          parentage: '',
          className: selectedClass !== 'All' ? selectedClass : '',
          bankAccount: '',
          ifsc: '',
          amount: '600.00',
          signature: '',
          remarks: `Reg: ${token}`,
        };
        newRows.push(manualRow);
        manualCount++;
      }
    });

    setBeneficiaries(prev => [...prev, ...newRows]);
    setBulkRegInput('');
    setIsFetchingRegs(false);

    let msg = `Added ${addedCount} student(s) from DB.`;
    if (manualCount > 0) msg += ` ${manualCount} unrecognized Reg No(s) added as editable rows.`;
    if (skippedDuplicatesCount > 0) msg += ` (${skippedDuplicatesCount} duplicate entries skipped).`;
    showToast(msg, addedCount > 0 ? 'success' : 'info');
  };

  // ─── Add Single Student from Autocomplete ───
  const handleAddSingleStudent = (st) => {
    if (!st) return;
    const cleanReg = cleanRegNoVal(extractBoardRegNo(st)).toLowerCase();
    const isAlreadyAdded = beneficiaries.some(b => {
      const bReg = cleanRegNoVal(b.boardRegNo || extractBoardRegNo(b._rawStudent)).toLowerCase();
      return (cleanReg && bReg && cleanReg === bReg) || (b._rawStudent?.id && st.id && b._rawStudent.id === st.id);
    });
    if (isAlreadyAdded) {
      showToast(`"${extractStudentName(st)}" is already added in the beneficiary list`, 'warning');
      return;
    }

    const rowId = `ben_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newRow = {
      id: rowId,
      _rawStudent: st,
      boardRegNo: cleanRegNoVal(extractBoardRegNo(st)),
      studentName: extractStudentName(st) || '',
      parentage: extractParentage(st) || extractFatherName(st) || '',
      className: extractClass(st) || '',
      bankAccount: extractBankAccount(st) !== '—' ? extractBankAccount(st) : '',
      ifsc: extractIfsc(st) !== '—' ? extractIfsc(st) : '',
      amount: '600.00',
      signature: '',
      remarks: '',
    };
    activeColumns.forEach(c => {
      if (!newRow[c.key] && !c.isCustom) {
        newRow[c.key] = extractDbFieldValue(st, c.key);
      }
    });
    setBeneficiaries(prev => [...prev, newRow]);
    setStudentSearchQuery('');
    setShowSearchDropdown(false);
    showToast(`Added ${newRow.studentName} to beneficiary list`, 'success');
  };

  // ─── Add Custom Vendor / Blank Row ───
  const handleAddManualRow = () => {
    const rowId = `ben_manual_${Date.now()}`;
    const newRow = {
      id: rowId,
      boardRegNo: '',
      studentName: 'Vendor / Shop / Student',
      parentage: '—',
      className: '—',
      bankAccount: '',
      ifsc: '',
      amount: '0.00',
      signature: '',
      remarks: '',
    };
    setBeneficiaries(prev => [...prev, newRow]);
    showToast('Added new manual editable row to table', 'info');
  };

  // ─── Cell Update Handler ───
  const handleUpdateCell = (rowId, colKey, newVal) => {
    setBeneficiaries(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, [colKey]: newVal };
      }
      return row;
    }));
  };

  // ─── Delete Row ───
  const handleDeleteRow = (rowId) => {
    const target = beneficiaries.find(r => r.id === rowId);
    const label = target?.studentName
      ? `"${target.studentName}"`
      : (target?.boardRegNo ? `Reg No: ${target.boardRegNo}` : 'this row');
    if (!window.confirm(`Are you sure you want to delete the beneficiary entry for ${label}?`)) {
      return;
    }
    setBeneficiaries(prev => prev.filter(r => r.id !== rowId));
    showToast(`Deleted row for ${label}`, 'info');
  };

  // ─── Reorder Rows ───
  const handleMoveRow = (index, delta) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= beneficiaries.length) return;
    setBeneficiaries(prev => {
      const copy = [...prev];
      const item = copy.splice(index, 1)[0];
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  // ─── Bulk Fill Amounts ───
  const handleApplyBulkAmount = () => {
    const figure = parseFloat(bulkAmountVal) || 0;
    if (figure <= 0) {
      showToast('Please enter a valid amount (e.g. 600 or 800)', 'warning');
      return;
    }
    const formatted = figure.toFixed(2);

    if (bulkAmountType === 'all') {
      setBeneficiaries(prev => prev.map(r => ({ ...r, amount: formatted })));
      showToast(`Applied ₹${formatted} to all ${beneficiaries.length} entries`, 'success');
    } else {
      // Orphan = 800, others = 600
      setBeneficiaries(prev => prev.map(r => {
        const cat = (r.category || r.remarks || '').toLowerCase();
        const isOrphan = cat.includes('orphan') || cat.includes('ph') || cat.includes('pwd');
        return {
          ...r,
          amount: isOrphan ? '800.00' : '600.00'
        };
      }));
      showToast('Applied ₹800 to Orphan / Category entries and ₹600 to others', 'success');
    }
    setShowFillAmountModal(false);
  };

  // ─── Column Management: Add DB Column ───
  const handleAddDbColumn = (colDef) => {
    if (activeColumns.some(c => c.key === colDef.key)) {
      showToast(`Column "${colDef.label}" is already added`, 'info');
      return;
    }
    const newCol = {
      key: colDef.key,
      label: colDef.label,
      widthPct: colDef.defaultWidthPct || 10,
      align: colDef.align || 'center',
      isCustom: false
    };
    setActiveColumns(prev => [...prev, newCol]);

    // Populate data for new column into existing rows
    setBeneficiaries(prev => prev.map(row => {
      if (row._rawStudent) {
        return { ...row, [colDef.key]: extractDbFieldValue(row._rawStudent, colDef.key) };
      }
      return row;
    }));
    showToast(`Added column "${colDef.label}"`, 'success');
  };

  // ─── Column Management: Add Custom Column ───
  const handleCreateCustomColumn = () => {
    if (!newColLabel.trim()) {
      showToast('Please enter a column title', 'warning');
      return;
    }
    const key = `custom_${Date.now()}`;
    const newCol = {
      key,
      label: newColLabel.trim(),
      widthPct: parseInt(newColWidth, 10) || 12,
      align: newColAlign,
      isCustom: true,
      type: newColType
    };
    setActiveColumns(prev => [...prev, newCol]);
    setNewColLabel('');
    setShowAddCustomColModal(false);
    showToast(`Added custom column "${newCol.label}"`, 'success');
  };

  // ─── Column Management: Reorder & Remove ───
  const handleMoveColumn = (colIdx, delta) => {
    const nextIdx = colIdx + delta;
    if (nextIdx < 0 || nextIdx >= activeColumns.length) return;
    setActiveColumns(prev => {
      const copy = [...prev];
      const item = copy.splice(colIdx, 1)[0];
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const handleRemoveColumn = (colKey) => {
    if (activeColumns.length <= 1) {
      showToast('Must keep at least 1 column in table', 'warning');
      return;
    }
    const target = activeColumns.find(c => c.key === colKey);
    if (!target) return;
    const colName = target.label || colKey;
    if (!window.confirm(`Are you sure you want to remove the column "${colName}" from the table?`)) {
      return;
    }
    setActiveColumns(prev => prev.filter(c => c.key !== colKey));
    showToast(`Removed column "${colName}"`, 'info');
  };

  const handleResetColumns = () => {
    if (!window.confirm('Reset all table columns back to preset defaults? Any custom columns will be removed.')) {
      return;
    }
    const defaultCols = TEMPLATE_PRESETS.find(p => p.id === activePresetId)?.columns || TEMPLATE_PRESETS[0].columns;
    setActiveColumns(defaultCols);
    showToast('Reset table columns to preset default', 'info');
  };

  // ─── Filtered Search Results for Autocomplete (Name, Roll, or Reg No) ───
  const searchResults = useMemo(() => {
    if (!studentSearchQuery.trim() || studentSearchQuery.length < 2) return [];
    const q = studentSearchQuery.toLowerCase().trim();
    const tokens = q.split(/[\s,;]+/).filter(t => t.length > 0);

    return sessionStudentsPool
      .filter(st => {
        const name = (extractStudentName(st) || '').toLowerCase();
        const parent = (extractParentage(st) || extractFatherName(st) || '').toLowerCase();
        const reg = (extractBoardRegNo(st) || '').toLowerCase();
        const roll = String(getStudentRollNumber(st) || '').toLowerCase();
        return tokens.some(tok =>
          name.includes(tok) || parent.includes(tok) || reg.includes(tok) || roll.includes(tok)
        );
      })
      .slice(0, 15);
  }, [studentSearchQuery, sessionStudentsPool]);

  // ─── Print & PDF Export Handler (Isolated Engine matching Official Letterhead Writer) ───
  const handlePrint = () => {
    if (beneficiaries.length === 0) {
      showToast('Add at least one beneficiary to print', 'warning');
      return;
    }
    // Save to history automatically on print
    saveGeneratedDocToHistory({
      docType: 'sanction_order',
      title: documentTitle,
      subject: documentTitle,
      refNo,
      dateStr,
      recipientOrStudent: `${beneficiaries.length} Beneficiaries (Total ₹${formattedTotalAmount})`,
      action: 'Printed',
      bodyHtml: document.getElementById('beneficiary-document-sheet')?.innerHTML || '',
      extraData: {
        beneficiaryCount: beneficiaries.length,
        totalAmount: formattedTotalAmount,
        selectedSession,
        selectedClass
      }
    }).catch(e => console.warn('History save note:', e));

    logAdminActivity({
      actionType: 'export',
      actionTitle: 'Printed Mutual Benefit Fund Sanction Order',
      details: `Printed sanction order "${refNo}" with ${beneficiaries.length} beneficiaries (Total ₹${formattedTotalAmount})`,
      metadata: { refNo, documentTitle, count: beneficiaries.length, totalAmount: formattedTotalAmount }
    });

    showToast('🖨️ Opening print dialog / PDF preview...', 'info', 2200);

    printBeneficiarySanctionOrder({
      orientation,
      officeTitle,
      institutionName,
      institutionAddress,
      contactLine,
      refNo,
      dateStr,
      documentTitle,
      fontFamily: documentFontFamily,
      showPreamble,
      preambleText: resolvedPreambleText,
      activeColumns,
      beneficiaries,
      totalAmount: formattedTotalAmount,
      showCertification,
      certificationText: resolvedCertificationText,
      signaturesMode,
      committeeMemberCount,
      committeeHeader,
      principalTitle,
      principalSubtitle,
      tableFontSize,
      rowPaddingPreset
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── Excel Export (.xlsx) Handler ───
  const handleExportExcel = () => {
    if (beneficiaries.length === 0) {
      showToast('No beneficiary records to export', 'warning');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Build Headers
      const sheetHeaders = activeColumns.map(c => c.label);
      const sheetData = [];

      // Add Title & Ref Rows
      sheetData.push([institutionName]);
      sheetData.push([officeTitle]);
      sheetData.push([documentTitle]);
      sheetData.push([`Ref. No: ${refNo}`, '', '', `Date: ${dateStr}`]);
      if (showPreamble && resolvedPreambleText) {
        sheetData.push([resolvedPreambleText]);
      }
      sheetData.push([]); // blank row

      // Table Header
      sheetData.push(sheetHeaders);

      // Table Rows
      beneficiaries.forEach((b, idx) => {
        const row = activeColumns.map(c => {
          if (c.key === 'sno') return idx + 1;
          if (c.key === 'amount') {
            const num = parseFloat(b.amount) || 0;
            return `₹ ${num.toFixed(2)}`;
          }
          return b[c.key] || '';
        });
        sheetData.push(row);
      });

      // Total Row
      const totalRow = activeColumns.map((c, cIdx) => {
        if (cIdx === 0) return 'Total';
        if (c.key === 'amount') return `₹ ${formattedTotalAmount}`;
        return '';
      });
      sheetData.push(totalRow);

      // Add Certification Text if active
      if (showCertification && resolvedCertificationText) {
        sheetData.push([]);
        sheetData.push(['Certification:']);
        sheetData.push([resolvedCertificationText]);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, 'Beneficiary List');

      const cleanFilename = `${documentTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr}.xlsx`;
      XLSX.writeFile(wb, cleanFilename);
      showToast(`Exported ${cleanFilename} successfully!`, 'success');

      logAdminActivity('Exported Beneficiary List Excel', {
        title: documentTitle,
        count: beneficiaries.length,
        total: totalAmount
      });
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast('Failed to generate Excel file: ' + err.message, 'error');
    }
  };

  // ─── Word Document (.docx) Export Handler ───
  const handleExportDocx = async () => {
    if (beneficiaries.length === 0) {
      showToast('No beneficiary records to export', 'warning');
      return;
    }

    try {
      const isLandscape = orientation === 'landscape';

      // 1. Table Header Row
      const headerCells = activeColumns.map(c => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: c.label, bold: true, size: 18 })],
          alignment: c.align === 'center' ? AlignmentType.CENTER : c.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
        })],
        shading: { fill: 'E2E8F0' },
        width: { size: c.widthPct * 100, type: WidthType.DXA }
      }));

      // 2. Table Data Rows
      const dataRows = beneficiaries.map((b, idx) => {
        const cells = activeColumns.map(c => {
          let cellText = '';
          if (c.key === 'sno') cellText = String(idx + 1);
          else if (c.key === 'amount') {
            const num = parseFloat(b.amount) || 0;
            cellText = `₹ ${num.toFixed(2)}`;
          } else {
            cellText = String(b[c.key] || '');
          }

          return new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: cellText, size: 18 })],
              alignment: c.align === 'center' ? AlignmentType.CENTER : c.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
            })],
            width: { size: c.widthPct * 100, type: WidthType.DXA }
          });
        });

        return new TableRow({ children: cells });
      });

      // 3. Table Total Row
      const totalCells = activeColumns.map((c, cIdx) => {
        let text = '';
        if (cIdx === 0) text = 'Total';
        else if (c.key === 'amount') text = `₹ ${formattedTotalAmount}`;

        return new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 19 })],
            alignment: c.align === 'right' || c.key === 'amount' ? AlignmentType.RIGHT : AlignmentType.LEFT
          })],
          shading: { fill: 'F8FAFC' },
          width: { size: c.widthPct * 100, type: WidthType.DXA }
        });
      });

      const docxTable = new Table({
        rows: [
          new TableRow({ children: headerCells, tableHeader: true }),
          ...dataRows,
          new TableRow({ children: totalCells })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE }
      });

      // 4. Construct Full Document
      const docChildren = [
        new Paragraph({
          children: [new TextRun({ text: officeTitle, bold: true, color: 'DC2626', size: 22 })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [new TextRun({ text: institutionName, bold: true, size: 30 })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [new TextRun({ text: institutionAddress, size: 18, color: '475569' })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          children: [new TextRun({ text: contactLine, size: 16, color: '0284C7', bold: true })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: `Ref. No: ${refNo}`, bold: true, size: 20 }),
            new TextRun({ text: `\t\t\t\t\tDate: ${dateStr}`, bold: true, size: 20 })
          ]
        }),
        new Paragraph({ text: '' })
      ];

      if (showPreamble && resolvedPreambleText) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: resolvedPreambleText, size: 20 })]
          }),
          new Paragraph({ text: '' })
        );
      }

      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: documentTitle, bold: true, underline: true, size: 24 })],
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: '' }),
        docxTable,
        new Paragraph({ text: '' })
      );

      if (showCertification && resolvedCertificationText) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: resolvedCertificationText, size: 19 })]
          }),
          new Paragraph({ text: '' })
        );
      }

      // Signatures
      if (signaturesMode === 'committee' || signaturesMode === 'both') {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: committeeHeader, bold: true, size: 20 })]
          }),
          new Paragraph({
            children: Array.from({ length: committeeMemberCount }, (_, i) =>
              new TextRun({ text: `${i + 1} ________________\t\t`, size: 18 })
            )
          })
        );
      }
      if (signaturesMode === 'principal' || signaturesMode === 'both') {
        docChildren.push(
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: principalTitle, bold: true, size: 20 })],
            alignment: AlignmentType.RIGHT
          })
        );
      }

      const docxDoc = new Document({
        sections: [{
          properties: {
            page: {
              size: {
                orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
              }
            }
          },
          children: docChildren
        }]
      });

      const blob = await Packer.toBlob(docxDoc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${documentTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr}.docx`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Word document exported successfully!', 'success');
    } catch (err) {
      console.error('Word export failed:', err);
      showToast('Failed to export Word document: ' + err.message, 'error');
    }
  };

  // ─── Save Draft to Cloud ───
  const handleSaveToCloud = async () => {
    if (beneficiaries.length === 0) {
      showToast('No beneficiary entries to save', 'warning');
      return;
    }
    try {
      await saveGeneratedDocToHistory({
        docType: 'sanction_order',
        title: documentTitle,
        subject: documentTitle,
        refNo,
        dateStr,
        recipientOrStudent: `${beneficiaries.length} Beneficiaries (Total ₹${formattedTotalAmount})`,
        action: 'Saved',
        bodyHtml: document.getElementById('beneficiary-document-sheet')?.innerHTML || '',
        extraData: {
          beneficiaryCount: beneficiaries.length,
          totalAmount: formattedTotalAmount,
          selectedSession,
          selectedClass
        }
      });
      showToast('Document saved to Cloud History successfully!', 'success');
    } catch (err) {
      console.error('Cloud save failed:', err);
      showToast('Error saving to cloud: ' + err.message, 'error');
    }
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-155px)] max-h-[calc(100vh-155px)] min-h-[500px] bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl overflow-hidden font-sans border border-slate-200 dark:border-slate-800 shadow-xs">
      {/* ─── ACTION CONTROLS TOOLBAR (COMPACT HIGH-DENSITY) ─── */}
      <div className="flex-none bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 py-1 flex items-center justify-between shadow-2xs z-30 min-h-[38px] gap-2 print:hidden overflow-x-auto">
        {/* Left side: Preset selector, Orientation, and Related Document Styling Controls */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Quick Preset Selector */}
          <select
            value={activePresetId}
            onChange={(e) => {
              const p = TEMPLATE_PRESETS.find(x => x.id === e.target.value);
              if (p) handleApplyPreset(p);
            }}
            className="h-7 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer shadow-2xs max-w-[150px] sm:max-w-[210px] truncate shrink-0"
            title="Select Sanction Order Template Preset"
          >
            {TEMPLATE_PRESETS.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Orientation Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs shrink-0 h-7" title="Document Page Orientation">
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Landscape
            </button>
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Portrait
            </button>
          </div>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0 hidden sm:block" />

          {/* Row Spacing (Moved besides Orientation) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs shrink-0 h-7" title="Table Row Spacing Density">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1 hidden md:inline">Spacing:</span>
            {[
              { key: 'compact', label: 'Compact' },
              { key: 'standard', label: 'Normal' },
              { key: 'spacious', label: 'Spaced' }
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRowPaddingPreset(item.key)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  rowPaddingPreset === item.key
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title={`Row Spacing: ${item.label}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0 hidden sm:block" />

          {/* Font Size Stepper & Dropdown (Moved besides Orientation) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700 px-1 shrink-0 h-7 shadow-2xs" title="Table Font Size">
            <span className="text-[10px] font-bold text-slate-500 uppercase pr-1 hidden lg:inline">Font:</span>
            <button
              type="button"
              title="Decrease Font Size (A⁻)"
              onClick={() => handleAdjustFontSize(-1)}
              className="w-5 h-5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center cursor-pointer"
            >
              A⁻
            </button>
            <select
              value={tableFontSize}
              onChange={(e) => setTableFontSize(e.target.value)}
              className="h-6 px-1 bg-transparent text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              title="Select Table Font Size"
            >
              <option value="8pt">8 pt</option>
              <option value="8.5pt">8.5 pt</option>
              <option value="9pt">9 pt</option>
              <option value="9.5pt">9.5 pt (Standard)</option>
              <option value="10pt">10 pt</option>
              <option value="10.5pt">10.5 pt</option>
              <option value="11pt">11 pt</option>
              <option value="11.5pt">11.5 pt</option>
              <option value="12pt">12 pt</option>
              <option value="13pt">13 pt</option>
              <option value="14pt">14 pt</option>
            </select>
            <button
              type="button"
              title="Increase Font Size (A⁺)"
              onClick={() => handleAdjustFontSize(1)}
              className="w-5 h-5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center cursor-pointer"
            >
              A⁺
            </button>
          </div>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0 hidden sm:block" />

          {/* Font Family Selector (Moved besides Orientation) */}
          <select
            value={documentFontFamily}
            onChange={(e) => setDocumentFontFamily(e.target.value)}
            className="h-7 px-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 outline-none cursor-pointer shrink-0 max-w-[130px] truncate"
            title="Document Font Family"
          >
            <option value="'Times New Roman', Times, serif">Times New Roman</option>
            <option value="'Arial', Helvetica, sans-serif">Arial</option>
            <option value="'Georgia', serif">Georgia</option>
            <option value="'Calibri', sans-serif">Calibri</option>
            <option value="'Courier New', monospace">Courier New</option>
          </select>
        </div>

        {/* Right side: Action Controls Shortcuts */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="h-7 flex items-center gap-1 text-xs font-bold px-2.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
            title="Print or Save as PDF (Ctrl+P)"
          >
            <Printer size={12} className="shrink-0" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>

          {/* Quick Save Draft Button */}
          <button
            type="button"
            onClick={handleSaveToCloud}
            className="h-7 flex items-center gap-1 text-[11px] font-semibold px-2 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
            title="Save draft to Cloud History"
          >
            <Save size={12} className="text-teal-600 shrink-0" />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Sidebar Controls Toggle */}
          <button
            type="button"
            onClick={() => setShowControlsPanel(!showControlsPanel)}
            className={`h-7 flex items-center gap-1 text-[11px] font-bold px-2 rounded-md border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              showControlsPanel
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
            title={showControlsPanel ? "Hide Controls Sidebar" : "Show Controls Sidebar"}
          >
            {showControlsPanel ? (
              <PanelRightClose size={13} className="shrink-0" />
            ) : (
              <PanelRightOpen size={13} className="shrink-0" />
            )}
            <span className="hidden sm:inline">Controls</span>
          </button>
        </div>
      </div>

      {/* ─── DUAL PANE WORKSPACE (2/3 PREVIEW : 1/3 CONTROLS) ─── */}
      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row overflow-hidden">
        {/* ─── LEFT / MAIN CANVAS: LIVE WYSIWYG DOCUMENT CANVAS (2/3) ─── */}
        <main
          className={`h-full min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar overscroll-contain bg-slate-200/70 dark:bg-slate-950 p-4 sm:p-6 pb-16 flex flex-col items-center min-w-0 transition-all ${
            showControlsPanel && !customSidebarWidth
              ? 'w-full lg:w-2/3'
              : 'w-full flex-1'
          }`}
          style={
            showControlsPanel
              ? customSidebarWidth
                ? { flex: '1 1 0%' }
                : { flex: '2 2 0%' }
              : undefined
          }
        >
          {/* Native Browser Print Override: ensures only the document sheet prints without any controls */}
          <style>{`
            @media print {
              @page {
                size: A4 ${orientation};
                margin: 0.32in 0.38in;
              }
              body, html {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              header, aside, .print\\:hidden, #beneficiary-print-frame {
                display: none !important;
              }
              main {
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                overflow: visible !important;
                width: 100% !important;
                display: block !important;
              }
              #beneficiary-document-sheet {
                width: 100% !important;
                max-width: 100% !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `}</style>

          {/* Document Sheet Container */}
          <div
            id="beneficiary-document-sheet"
            className={`bg-white text-slate-900 shadow-2xl transition-all duration-200 print:shadow-none print:m-0 print:p-0 ${
              orientation === 'landscape'
                ? 'w-[297mm] min-h-[210mm] p-[10mm]'
                : 'w-[210mm] min-h-[297mm] p-[12mm]'
            }`}
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: tableFontSize
            }}
          >
            {/* 1. Official School Letterhead Banner (Exact match with Official Letterhead Writer & Student Certificates) */}
            <div className="letterhead-banner text-center bg-[#f0f8ff] border-b-[3px] border-[#800000] p-3.5 sm:p-4 rounded-t-lg -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-3 print:!-mx-6 print:!-mt-6 print:!mb-3">
              <img
                src="/logo192.png"
                alt="School Seal"
                style={{ width: '48px', height: '48px', maxWidth: '48px', maxHeight: '48px', objectFit: 'contain' }}
                className="w-12 h-12 object-contain mx-auto mb-1.5 drop-shadow-xs"
                onError={(e) => { e.target.src = '/logo.png'; e.target.onerror = null; }}
              />
              <div className="text-[11px] sm:text-xs font-black text-[#800000] uppercase tracking-[1.5px] m-0 font-sans">
                {officeTitle || 'OFFICE OF THE PRINCIPAL'}
              </div>
              <h1 className="text-base sm:text-lg font-black text-[#0a192f] tracking-wide uppercase m-0 mt-0.5 font-serif">
                {institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}
              </h1>
              <div className="text-[10.5px] text-slate-600 font-semibold m-0 mt-0.5 font-sans">
                {institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)'}
              </div>
              <div className="text-[9.5px] text-sky-800 font-bold tracking-tight m-0 mt-0.5 font-sans">
                {contactLine || 'UDISE: 01061400618 | Email: ghssshangus74@gmail.com'}
              </div>
            </div>

            {/* 2. Ref No & Date Bar — Directly Editable inside the letter */}
            <div className="flex items-center justify-between text-[11.5px] font-bold text-slate-900 my-2 px-1 font-serif border-b border-slate-200 pb-1.5">
              <div className="flex items-center gap-1.5 group/ref">
                <span className="text-[#800000] font-extrabold uppercase tracking-wide">Ref. No:</span>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="e.g. HSS/SHG/MBF/2025-26/01"
                  title="Click to directly edit Reference Number"
                  aria-label="Document Reference Number"
                  className="font-mono font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-300 hover:border-teal-500 focus:border-teal-600 focus:bg-teal-50/40 rounded px-1.5 py-0.5 outline-none transition-all w-56 sm:w-64 text-[11px] print:border-none print:bg-transparent print:p-0 print:w-auto"
                />
                <div className="print:hidden inline-flex items-center gap-0.5 opacity-60 group-hover/ref:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleStepRef(-1)}
                    title="Decrement Reference Serial Number"
                    className="w-4 h-4 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepRef(1)}
                    title="Increment Reference Serial Number"
                    className="w-4 h-4 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 group/date">
                <span className="text-[#800000] font-extrabold uppercase tracking-wide">Date:</span>
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  placeholder="DD-MM-YYYY"
                  title="Click to directly edit Issue Date"
                  aria-label="Document Issue Date"
                  className="font-mono font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-300 hover:border-teal-500 focus:border-teal-600 focus:bg-teal-50/40 rounded px-1.5 py-0.5 outline-none transition-all w-28 text-[11px] text-right print:border-none print:bg-transparent print:p-0 print:w-auto"
                />
              </div>
            </div>

            {/* 3. Bank Debit Directive Preamble (if active) */}
            {showPreamble && resolvedPreambleText && (
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setPreambleText(e.currentTarget.innerText)}
                className="text-[12px] font-semibold my-2 px-1 text-slate-800 leading-relaxed font-serif outline-none border border-transparent hover:border-dashed hover:border-slate-300 focus:border-teal-500 focus:bg-teal-50/20 rounded p-1 transition-all cursor-text"
                title="Click to directly edit Bank Debit Directive on sheet"
              >
                {resolvedPreambleText}
              </div>
            )}

            {/* 4. Document Subtitle / Banner */}
            <div className="text-center my-2 font-bold text-[14px] uppercase tracking-wide">
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setDocumentTitle(e.currentTarget.innerText.trim())}
                className="px-3 py-0.5 border-b-2 border-slate-900 inline-block outline-none hover:bg-slate-100/60 focus:bg-teal-50/40 rounded transition-all cursor-text"
                title="Click to directly edit Document Title on sheet"
              >
                {documentTitle}
              </span>
            </div>

            {/* 5. Main Beneficiaries Table */}
            <div className="overflow-x-auto my-2">
              <table
                className="w-full border-collapse border border-slate-900 text-slate-900"
                style={{ fontSize: tableFontSize }}
              >
                <thead>
                  <tr className="bg-slate-200 font-bold text-center border-b border-slate-900">
                    {activeColumns.map((c, colIdx) => (
                      <th
                        key={c.key}
                        className="border border-slate-900 px-1 py-1 text-slate-900 font-extrabold leading-tight align-top group/th relative"
                        style={{
                          width: `${c.widthPct}%`,
                          textAlign: c.align
                        }}
                      >
                        {/* Screen-only Column Reorder & Delete Toolbar */}
                        <div className="print:hidden flex items-center justify-between pb-1 mb-1 border-b border-slate-300/80 text-[10px] select-none">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveColumn(colIdx, -1); }}
                              disabled={colIdx === 0}
                              className="w-4 h-4 rounded hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 disabled:opacity-20 cursor-pointer transition-colors"
                              title="Move Column Left (←)"
                            >
                              <ChevronLeft size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveColumn(colIdx, 1); }}
                              disabled={colIdx === activeColumns.length - 1}
                              className="w-4 h-4 rounded hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 disabled:opacity-20 cursor-pointer transition-colors"
                              title="Move Column Right (→)"
                            >
                              <ChevronRight size={11} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemoveColumn(c.key); }}
                            className="w-4 h-4 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 hover:text-rose-700 flex items-center justify-center cursor-pointer transition-colors"
                            title={`Delete column "${c.label}"`}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>

                        {/* Column Title: Editable on screen, pure text on print */}
                        <div className="flex items-center justify-center">
                          <input
                            type="text"
                            value={c.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setActiveColumns(prev => prev.map((col, i) => i === colIdx ? { ...col, label: val } : col));
                            }}
                            className="print:hidden w-full text-center font-extrabold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-400 focus:border-teal-600 focus:outline-hidden py-0 px-0.5 text-[11px]"
                            style={{ textAlign: c.align }}
                            title="Click to rename column title"
                          />
                          <span className="hidden print:inline">{c.label}</span>
                        </div>
                      </th>
                    ))}

                    {/* Screen-only Action / Add Column Header */}
                    <th className="print:hidden border border-slate-900 px-1 py-1 w-16 text-center align-middle bg-slate-100">
                      <div className="relative inline-block text-left" ref={inTableAddColRef}>
                        <button
                          type="button"
                          onClick={() => setShowInTableAddMenu(prev => !prev)}
                          className="h-6 px-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
                          title="Add column to table (DB Column or Custom)"
                        >
                          <Plus size={11} />
                          <span>Column</span>
                        </button>

                        {/* Quick Add Column Menu in Table */}
                        {showInTableAddMenu && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 w-56 max-h-64 overflow-y-auto p-1.5 text-xs text-left">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 dark:border-slate-800 font-black text-[9.5px] uppercase text-teal-700 dark:text-teal-400">
                              <span>Columns ({activeColumns.length})</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleResetColumns();
                                    setShowInTableAddMenu(false);
                                  }}
                                  className="text-[9.5px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline cursor-pointer flex items-center gap-0.5"
                                  title="Reset columns to template preset defaults"
                                >
                                  <RotateCcw size={10} />
                                  <span>Reset</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowInTableAddMenu(false)}
                                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setShowInTableAddMenu(false);
                                setShowAddCustomColModal(true);
                              }}
                              className="w-full text-left px-2 py-1.5 mb-1.5 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 text-teal-800 dark:text-teal-200 rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <PlusCircle size={13} className="text-teal-600 shrink-0" />
                              <span>Create Custom Column...</span>
                            </button>

                            <div className="text-[9px] font-black uppercase text-slate-400 px-1 py-0.5">
                              Student Database Fields
                            </div>
                            {DB_COLUMN_GROUPS.map(g => (
                              <div key={g.category} className="mb-1">
                                <div className="text-[8.5px] font-bold text-slate-500 uppercase px-1">
                                  {g.category}
                                </div>
                                {g.columns.map(colDef => (
                                  <button
                                    key={colDef.key}
                                    type="button"
                                    onClick={() => {
                                      handleAddDbColumn(colDef);
                                      setShowInTableAddMenu(false);
                                    }}
                                    className="w-full text-left px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-between text-xs cursor-pointer"
                                  >
                                    <span>{colDef.label}</span>
                                    {activeColumns.some(x => x.key === colDef.key) && (
                                      <Check size={12} className="text-teal-600" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeColumns.length + 1}
                        className="border border-slate-900 p-8 text-center text-slate-400 font-sans italic"
                      >
                        No beneficiaries added yet. Use the controls panel on the right or the "Column" / "Blank Row" buttons to add rows or fetch student records.
                      </td>
                    </tr>
                  ) : (
                    beneficiaries.map((row, rIdx) => (
                      <tr
                        key={row.id || rIdx}
                        className="hover:bg-teal-50/50 transition-colors group"
                        style={{
                          height:
                            rowPaddingPreset === 'compact'
                              ? '24px'
                              : rowPaddingPreset === 'spacious'
                              ? '44px'
                              : '32px'
                        }}
                      >
                        {activeColumns.map((c) => {
                          const isSno = c.key === 'sno';
                          const isAmount = c.key === 'amount';
                          const cellVal = isSno ? rIdx + 1 : row[c.key] || '';

                          return (
                            <td
                              key={c.key}
                              className="border border-slate-700 px-1.5 py-0.5 leading-tight align-middle"
                              style={{ textAlign: c.align }}
                            >
                              {isSno ? (
                                <span className="font-bold">{cellVal}</span>
                              ) : isAmount ? (
                                <div className="flex items-center justify-end font-semibold">
                                  <span className="text-[10px] mr-0.5">₹</span>
                                  <input
                                    type="text"
                                    value={row.amount || ''}
                                    onChange={(e) => handleUpdateCell(row.id, 'amount', e.target.value)}
                                    className="w-16 text-right font-bold bg-transparent border-b border-transparent hover:border-slate-400 focus:border-teal-600 focus:outline-hidden"
                                  />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={cellVal}
                                  onChange={(e) => handleUpdateCell(row.id, c.key, e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-600 focus:outline-hidden py-0.5"
                                  style={{ textAlign: c.align }}
                                />
                              )}
                            </td>
                          );
                        })}

                        {/* Screen-only Row Action Controls: Move Up, Move Down, Delete */}
                        <td className="print:hidden border border-slate-700 px-1 py-0.5 text-center align-middle whitespace-nowrap">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rIdx, -1)}
                              disabled={rIdx === 0}
                              className="p-0.5 text-slate-400 hover:text-teal-600 disabled:opacity-20 cursor-pointer transition-colors"
                              title="Move Row Up"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rIdx, 1)}
                              disabled={rIdx === beneficiaries.length - 1}
                              className="p-0.5 text-slate-400 hover:text-teal-600 disabled:opacity-20 cursor-pointer transition-colors"
                              title="Move Row Down"
                            >
                              <ArrowDown size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer ml-0.5 transition-colors"
                              title="Delete this row"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* 6. Dynamic Total Sum Row (Colspan format to avoid S.No text wrapping) */}
                  {beneficiaries.length > 0 && (() => {
                    const amountIdx = activeColumns.findIndex(c => c.key === 'amount');
                    if (amountIdx !== -1) {
                      const beforeCols = activeColumns.slice(0, amountIdx);
                      const afterCols = activeColumns.slice(amountIdx + 1);
                      const beforeColSpan = Math.max(1, beforeCols.length);
                      return (
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                          <td
                            colSpan={beforeColSpan}
                            className="border border-slate-900 px-3 py-1 text-right font-extrabold uppercase text-[11px] tracking-wider"
                          >
                            Total Amount Sanctioned :
                          </td>
                          <td className="border border-slate-900 px-2 py-1 text-right font-extrabold text-[12px] whitespace-nowrap">
                            ₹ {formattedTotalAmount}
                          </td>
                          {afterCols.map(c => (
                            <td key={c.key} className="border border-slate-900 px-1 py-1" />
                          ))}
                          <td className="print:hidden border border-slate-900" />
                        </tr>
                      );
                    }
                    return (
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                        <td
                          colSpan={activeColumns.length}
                          className="border border-slate-900 px-3 py-1 text-right font-extrabold text-[11px]"
                        >
                          Total : ₹ {formattedTotalAmount}
                        </td>
                        <td className="print:hidden border border-slate-900" />
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* 7. Bottom Certification Paragraph (Matches Sample 1) */}
            {showCertification && resolvedCertificationText && (
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setCertificationText(e.currentTarget.innerText)}
                className="my-3 px-1 text-[11px] text-justify leading-relaxed font-serif text-slate-800 outline-none border border-transparent hover:border-dashed hover:border-slate-300 focus:border-teal-500 focus:bg-teal-50/20 rounded p-1.5 transition-all cursor-text"
                title="Click to directly edit Committee Certification Note on sheet (Rich Text Formatting supported)"
              >
                {resolvedCertificationText.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx} className="mb-1.5 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {/* 8. Committee Signatures Section (1 to 5 numbered member slots) */}
            {(signaturesMode === 'committee' || signaturesMode === 'both') && (
              <div className="mt-6 mb-3 px-1">
                <div className="font-bold text-[12px] mb-4 text-center">
                  {committeeHeader}
                </div>
                <div className="grid grid-cols-5 gap-3 pt-6">
                  {Array.from({ length: committeeMemberCount }).map((_, i) => (
                    <div key={i} className="text-center">
                      <div className="border-t border-slate-900 mx-auto w-4/5 pt-1 font-bold text-[11px]">
                        {i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. Principal Signature Section (Right-aligned, Matches Sample 2) */}
            {(signaturesMode === 'principal' || signaturesMode === 'both') && (
              <div className="mt-8 mb-2 flex justify-end px-2">
                <div className="text-right min-w-[140px]">
                  <div className="h-10"></div>
                  <div className="font-bold text-[13px] border-t border-slate-900 pt-1">
                    {principalTitle}
                  </div>
                  {principalSubtitle && (
                    <div className="text-[10px] text-slate-600">
                      {principalSubtitle}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ─── RESIZE HANDLE DIVIDER ─── */}
        {showControlsPanel && (
          <div
            onMouseDown={handleResizeMouseDown}
            onDoubleClick={() => setCustomSidebarWidth(null)}
            className="hidden lg:block flex-none w-1.5 h-full self-stretch cursor-col-resize bg-slate-200 dark:bg-slate-800 hover:bg-teal-400 dark:hover:bg-teal-600 transition-colors duration-150 relative group print:hidden select-none"
            title="Drag to resize panel (Double-click to reset to 1/3 width)"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-slate-300 dark:bg-slate-700 group-hover:bg-teal-500 transition-colors" />
          </div>
        )}

        {/* ─── RIGHT SIDEBAR: CONFIGURATION, INGESTION & CONTROLS (1/3) ─── */}
        {showControlsPanel && (
          <aside
            ref={asideRef}
            className={`border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 h-full min-h-0 overflow-y-auto custom-scrollbar overscroll-contain p-2.5 sm:p-3 pb-16 shadow-xs print:hidden min-w-0 transition-all flex flex-col gap-2.5 ${
              customSidebarWidth ? 'flex-none' : 'w-full lg:w-1/3'
            }`}
            style={
              customSidebarWidth
                ? { width: `${customSidebarWidth}px` }
                : { flex: '1 1 0%' }
            }
          >
            {/* ─── DOCKED ACTION BUTTONS (Matching Student Bonafides & Official Letterhead Writer) ─── */}
            <div className="space-y-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              {/* Primary 4-Button Action Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-8 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                  title="Print or Save as PDF (Ctrl+P)"
                >
                  <Printer size={13} className="shrink-0" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportDocx}
                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                  title="Export to Word (.docx)"
                >
                  <FileText size={13} className="shrink-0" />
                  <span>Word</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                  title="Export to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={13} className="shrink-0" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToCloud}
                  className="h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                  title="Save draft to Cloud History"
                >
                  <Save size={13} className="text-teal-600 shrink-0" />
                  <span>Save</span>
                </button>
              </div>

              {/* Secondary Operational Shortcuts */}
              <div className="grid grid-cols-4 gap-1.5 text-[10px] pt-0.5">
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="h-6.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                  title="Add blank editable row (vendor / non-student)"
                >
                  <Plus size={11} className="text-teal-600" />
                  <span>Blank Row</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFillAmountModal(true)}
                  className="h-6.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                  title="Bulk Fill Amount (₹600 / ₹800)"
                >
                  <IndianRupee size={11} className="text-emerald-600" />
                  <span>Fill ₹</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="h-6.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                  title="Document Drafts & History"
                >
                  <RotateCcw size={11} className="text-slate-500" />
                  <span>History</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetColumns}
                  className="h-6.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                  title="Reset table columns to preset default"
                >
                  <RotateCcw size={11} className="text-amber-600" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* ─── DEDICATED RICH TEXT & FORMATTING TOOLBAR ─── */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
              {/* Toolbar Sub-row 1: Undo/Redo | Tags | Font Size Stepper | Bold/Italic/Underline/Strike/Color */}
              <div className="flex items-center justify-between gap-1">
                {/* Undo / Redo */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Undo (Ctrl+Z)"
                    onClick={() => executeFormat('undo')}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Undo size={11} />
                  </button>
                  <button
                    type="button"
                    title="Redo (Ctrl+Y)"
                    onClick={() => executeFormat('redo')}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Redo size={11} />
                  </button>
                </div>

                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                {/* Paragraph / Headings */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Normal Body (¶)"
                    onClick={() => executeFormat('formatBlock', '<p>')}
                    className="w-6 h-6 rounded font-black text-[10px] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    ¶
                  </button>
                  <button
                    type="button"
                    title="Heading 1"
                    onClick={() => executeFormat('formatBlock', '<h1>')}
                    className="w-6 h-6 rounded font-black text-[10px] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    H1
                  </button>
                  <button
                    type="button"
                    title="Heading 2"
                    onClick={() => executeFormat('formatBlock', '<h2>')}
                    className="w-6 h-6 rounded font-black text-[10px] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    H2
                  </button>
                </div>

                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                {/* Font Size Stepper (A⁻ / Size Select / A⁺) */}
                <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-md border border-slate-200 dark:border-slate-700 px-0.5 shadow-2xs">
                  <button
                    type="button"
                    title="Decrease Font Size (A⁻)"
                    onClick={() => handleAdjustFontSize(-1)}
                    className="w-5 h-5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center cursor-pointer"
                  >
                    A⁻
                  </button>
                  <select
                    value={tableFontSize}
                    onChange={(e) => setTableFontSize(e.target.value)}
                    className="h-5 px-0.5 bg-transparent text-[10px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    title="Select Font Size"
                  >
                    <option value="8pt">8pt</option>
                    <option value="8.5pt">8.5pt</option>
                    <option value="9pt">9pt</option>
                    <option value="9.5pt">9.5pt</option>
                    <option value="10pt">10pt</option>
                    <option value="10.5pt">10.5pt</option>
                    <option value="11pt">11pt</option>
                    <option value="11.5pt">11.5pt</option>
                    <option value="12pt">12pt</option>
                    <option value="13pt">13pt</option>
                    <option value="14pt">14pt</option>
                  </select>
                  <button
                    type="button"
                    title="Increase Font Size (A⁺)"
                    onClick={() => handleAdjustFontSize(1)}
                    className="w-5 h-5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] flex items-center justify-center cursor-pointer"
                  >
                    A⁺
                  </button>
                </div>

                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                {/* Bold / Italic / Underline / Strike / Color */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Bold (Ctrl+B)"
                    onClick={() => executeFormat('bold')}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      activeFormats.bold ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-black border border-amber-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Bold size={11} />
                  </button>
                  <button
                    type="button"
                    title="Italic (Ctrl+I)"
                    onClick={() => executeFormat('italic')}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      activeFormats.italic ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-black border border-amber-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Italic size={11} />
                  </button>
                  <button
                    type="button"
                    title="Underline (Ctrl+U)"
                    onClick={() => executeFormat('underline')}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      activeFormats.underline ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-black border border-amber-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Underline size={11} />
                  </button>
                  <button
                    type="button"
                    title="Strikethrough"
                    onClick={() => executeFormat('strikeThrough')}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      activeFormats.strike ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-black border border-amber-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Strikethrough size={11} />
                  </button>

                  {/* Color Palette Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      title="Text Color"
                      onClick={() => setShowColorPalette(!showColorPalette)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Palette size={11} />
                    </button>
                    {showColorPalette && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 shadow-xl z-50 grid grid-cols-5 gap-1.5 w-36">
                        {OFFICIAL_PALETTE.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => applyTextColor(c.hex)}
                            className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Toolbar Sub-row 2: Alignment | Font Family | Row Spacing Density */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                {/* Alignment: Left / Center / Right / Justify */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Align Left"
                    onClick={() => executeFormat('justifyLeft')}
                    className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${activeFormats.alignLeft ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <AlignLeft size={11} />
                  </button>
                  <button
                    type="button"
                    title="Align Center"
                    onClick={() => executeFormat('justifyCenter')}
                    className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${activeFormats.alignCenter ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <AlignCenter size={11} />
                  </button>
                  <button
                    type="button"
                    title="Align Right"
                    onClick={() => executeFormat('justifyRight')}
                    className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${activeFormats.alignRight ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <AlignRight size={11} />
                  </button>
                  <button
                    type="button"
                    title="Justify"
                    onClick={() => executeFormat('justifyFull')}
                    className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${activeFormats.justify ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <AlignJustify size={11} />
                  </button>
                </div>

                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                {/* Font Family Selector */}
                <select
                  value={documentFontFamily}
                  onChange={(e) => setDocumentFontFamily(e.target.value)}
                  className="h-5.5 px-1 text-[10px] font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[110px] truncate"
                  title="Document Font Family"
                >
                  <option value="'Times New Roman', Times, serif">Times New Roman</option>
                  <option value="'Arial', Helvetica, sans-serif">Arial</option>
                  <option value="'Georgia', serif">Georgia</option>
                  <option value="'Calibri', sans-serif">Calibri</option>
                  <option value="'Courier New', monospace">Courier New</option>
                </select>

                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />

                {/* Row Spacing Density: Compact / Normal / Spaced */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs">
                  {[
                    { key: 'compact', label: 'Cmp' },
                    { key: 'standard', label: 'Std' },
                    { key: 'spacious', label: 'Spc' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setRowPaddingPreset(item.key)}
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${
                        rowPaddingPreset === item.key
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                      title={`Row Spacing: ${item.key}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── SEGMENTED 3-TAB CONTROLS NAVIGATOR (Zero-scroll architecture!) ─── */}
            <div className="flex rounded-xl bg-slate-200/80 dark:bg-slate-800/80 p-0.5 border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSidebarTab('students')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  sidebarTab === 'students'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users size={12} className={sidebarTab === 'students' ? 'text-teal-600' : ''} />
                <span>Students ({beneficiaries.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('content')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  sidebarTab === 'content'
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <FileText size={12} className={sidebarTab === 'content' ? 'text-amber-600' : ''} />
                <span>Text & Orders</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('signatures')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  sidebarTab === 'signatures'
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <UserCheck size={12} className={sidebarTab === 'signatures' ? 'text-purple-600' : ''} />
                <span>Signatures</span>
              </button>
            </div>

            {/* ─── TAB 1: BENEFICIARIES & STUDENT FETCHER ─── */}
            {sidebarTab === 'students' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5 min-w-0">
                {/* Enrolled Summary Banner */}
                <div className="flex items-center justify-between bg-teal-50/60 dark:bg-teal-950/40 p-2 rounded-lg border border-teal-200/70 dark:border-teal-800/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-teal-900 dark:text-teal-200">
                      {beneficiaries.length} Enrolled
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-[11px] font-mono font-bold text-teal-700 dark:text-teal-300">
                      Total: ₹ {formattedTotalAmount}
                    </span>
                  </div>
                  {beneficiaries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Clear all enrolled beneficiary rows from table?')) {
                          setBeneficiaries([]);
                        }
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Session & Class Cohort Filters */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Session
                    </label>
                    <select
                      value={selectedSession}
                      onChange={(e) => setSelectedSession(e.target.value)}
                      className="w-full h-7 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md px-2 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                    >
                      {CANONICAL_ACADEMIC_SESSIONS.slice(0, 10).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Class Cohort
                    </label>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full h-7 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md px-2 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                    >
                      <option value="All">All Classes (9th–12th)</option>
                      <option value="9th">Class 9th</option>
                      <option value="10th">Class 10th</option>
                      <option value="11th">Class 11th</option>
                      <option value="12th">Class 12th</option>
                    </select>
                  </div>
                </div>

                {/* Registration Nos (Bulk) & Non-student/Vendor Row on the EXACT SAME ROW */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    {/* Left: REGISTRATION NOS [BULK] */}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap">
                        <span>Registration Nos</span>
                        <span className="text-[8.5px] font-black px-1 py-0.5 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 uppercase leading-none">
                          Bulk
                        </span>
                      </span>
                      {bulkTokensCount > 0 && (
                        <span className="text-[9px] font-mono font-bold text-teal-600 dark:text-teal-400">
                          ({bulkTokensCount})
                        </span>
                      )}
                    </div>

                    {/* Right: [Paste Reg Nos] and [+ Blank Row] side-by-side on same row */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleToggleBulkRegInput}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border cursor-pointer flex items-center gap-1 transition-all shadow-2xs whitespace-nowrap ${
                          showBulkRegInput
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                            : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700 hover:bg-teal-100'
                        }`}
                        title="Toggle paste bulk registration numbers input box"
                      >
                        {showBulkRegInput ? <EyeOff size={11} className="text-teal-600" /> : <Eye size={11} className="text-teal-600" />}
                        <span>{showBulkRegInput ? "Hide Reg Box" : "Paste Reg Nos"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddManualRow}
                        className="text-[10px] font-bold px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1 transition-all shadow-2xs whitespace-nowrap"
                        title="Add non-student or vendor blank row"
                      >
                        <Plus size={11} className="text-teal-600" />
                        <span>Blank Row</span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Bulk Registration Input Area */}
                  {showBulkRegInput && (
                    <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                      <textarea
                        value={bulkRegInput}
                        onChange={(e) => setBulkRegInput(e.target.value)}
                        rows={2}
                        placeholder="Paste Registration Numbers separated by spaces, commas or newlines..."
                        className="w-full min-h-[48px] text-xs font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 focus:ring-1 focus:ring-teal-500 focus:outline-hidden resize-y shadow-2xs"
                      />

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleFetchBulkRegs}
                          disabled={isFetchingRegs || !bulkRegInput.trim()}
                          className={`flex-1 h-7 flex items-center justify-center gap-1 text-xs font-bold px-2 rounded-md transition-all shadow-2xs whitespace-nowrap cursor-pointer ${
                            !bulkRegInput.trim()
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed shadow-none'
                              : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-98'
                          }`}
                        >
                          {isFetchingRegs ? (
                            <>
                              <RefreshCw size={11} className="animate-spin shrink-0" />
                              <span>Fetching...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={11} className="shrink-0" />
                              <span>Fetch & Add {bulkTokensCount > 0 ? `(${bulkTokensCount})` : ''}</span>
                            </>
                          )}
                        </button>
                        {bulkRegInput && (
                          <button
                            type="button"
                            onClick={() => setBulkRegInput('')}
                            className="h-7 px-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Student Finder */}
                <div className="relative pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Quick Student Finder
                    </label>
                    {studentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStudentSearchQuery('')}
                        className="text-[9.5px] text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchResults.length > 0) {
                          e.preventDefault();
                          handleAddSingleStudent(searchResults[0]);
                        }
                      }}
                      placeholder="Search by name, roll no, or reg no... (Press Enter)"
                      className="w-full h-7 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md pl-6 pr-2 py-0 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                    />
                    <Search size={12} className="absolute left-2 top-2 text-slate-400" />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto">
                      <div className="p-1">
                        {searchResults.map((st, i) => (
                          <div
                            key={st.id || i}
                            onClick={() => handleAddSingleStudent(st)}
                            className="p-1.5 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-md cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                {extractStudentName(st)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {extractParentage(st) || extractFatherName(st)} • Cl: {extractClass(st)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                                {cleanRegNoVal(extractBoardRegNo(st)) || 'No Reg'}
                              </div>
                              <div className="text-[9px] text-slate-400">
                                A/c: {extractBankAccount(st) || '—'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Table Columns Manager */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Table Columns ({activeColumns.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomColModal(true)}
                      className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus size={10} />
                      <span>Custom Col</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar p-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                    {activeColumns.map((col, idx) => (
                      <span
                        key={col.key}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 shadow-2xs"
                      >
                        <span className="truncate max-w-[90px]">{col.label}</span>
                        {activeColumns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(col.key)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            title={`Remove column ${col.label}`}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 2: DOCUMENT ORDERS & TEXT TEMPLATES ─── */}
            {sidebarTab === 'content' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 shadow-2xs space-y-3 min-w-0">
                {/* Document Subtitle / Banner */}
                <div>
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Document Subtitle / Banner Title
                  </label>
                  <input
                    type="text"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    className="w-full h-7 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md px-2 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                  />
                  {/* Quick Preset Title Chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      'List of Beneficiaries for Mutual Benefit Fund, 2025-26',
                      'Sanction Order — Institutional Poor Fund Assistance, 2025-26',
                      'List of Beneficiaries',
                      'Financial Aid & Welfare Disbursement Roll'
                    ].map((titlePreset) => (
                      <button
                        key={titlePreset}
                        type="button"
                        onClick={() => setDocumentTitle(titlePreset)}
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 truncate max-w-[150px] cursor-pointer"
                        title={titlePreset}
                      >
                        {titlePreset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bank Debit Directive Toggle & Template */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPreamble}
                      onChange={(e) => setShowPreamble(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <CreditCard size={13} className="text-blue-600" />
                      <span>Bank Debit Directive Preamble</span>
                    </span>
                  </label>

                  {showPreamble && (
                    <div className="space-y-2 pl-3.5 pt-1 border-l-2 border-blue-200 dark:border-blue-800">
                      <div>
                        <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                          Source Account Number
                        </label>
                        <input
                          type="text"
                          value={sourceAccountNo}
                          onChange={(e) => setSourceAccountNo(e.target.value)}
                          placeholder="e.g. 0137040500000421"
                          className="w-full h-7 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md px-2 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 mb-0.5">
                          <span className="font-semibold">Directive Template</span>
                          <span className="font-mono text-[9px] text-blue-600">Tags: {'{totalAmount}'}, {'{accountNumber}'}</span>
                        </div>
                        <textarea
                          value={preambleText}
                          onChange={(e) => setPreambleText(e.target.value)}
                          rows={2}
                          className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 font-serif focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Committee Certification Note Toggle & Template */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCertification}
                        onChange={(e) => setShowCertification(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <ShieldCheck size={13} className="text-teal-600" />
                        <span>Committee Certification Note</span>
                      </span>
                    </label>
                    {showCertification && (
                      <button
                        type="button"
                        onClick={() => setCertificationText(TEMPLATE_PRESETS[0].certificationTemplate)}
                        className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline font-bold cursor-pointer"
                      >
                        Reset Default
                      </button>
                    )}
                  </div>

                  {showCertification && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Certification Template</span>
                        <span className="font-mono text-[9px] text-teal-600">Tags: {'{totalAmount}'}, {'{session}'}</span>
                      </div>
                      <textarea
                        value={certificationText}
                        onChange={(e) => setCertificationText(e.target.value)}
                        rows={4}
                        className="w-full text-xs font-serif bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md p-2 leading-relaxed focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                      />
                      <p className="text-[10px] text-slate-400 italic">
                        Tip: You can also click directly into this paragraph on the preview canvas to type or format text!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 3: SIGNATURES & LETTERHEAD CONFIGURATION ─── */}
            {sidebarTab === 'signatures' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 shadow-2xs space-y-3 min-w-0">
                {/* Signature Style Mode */}
                <div>
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Signatory Layout Style
                  </label>
                  <select
                    value={signaturesMode}
                    onChange={(e) => setSignaturesMode(e.target.value)}
                    className="w-full h-7 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md px-2 font-bold focus:ring-1 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="committee">Committee Members (1–5 numbered slots)</option>
                    <option value="principal">Designated Signatory (Right-aligned / Principal)</option>
                    <option value="both">Both (Committee Grid + Designated Signatory)</option>
                  </select>
                </div>

                {/* Committee Signatures Options */}
                {(signaturesMode === 'committee' || signaturesMode === 'both') && (
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <div className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300">
                      Committee Configuration
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                        Committee Title Header
                      </label>
                      <input
                        type="text"
                        value={committeeHeader}
                        onChange={(e) => setCommitteeHeader(e.target.value)}
                        className="w-full h-7 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                        Member Slots ({committeeMemberCount})
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setCommitteeMemberCount(num)}
                            className={`flex-1 h-7 rounded-md font-bold text-xs border transition-all cursor-pointer ${
                              committeeMemberCount === num
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Designated Signatory Options */}
                {(signaturesMode === 'principal' || signaturesMode === 'both') && (
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <div className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300">
                      Designated Signatory
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                        Signatory Title
                      </label>
                      <input
                        type="text"
                        value={principalTitle}
                        onChange={(e) => setPrincipalTitle(e.target.value)}
                        placeholder="e.g. Principal"
                        className="w-full h-7 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                        Signatory Subtitle (Optional)
                      </label>
                      <input
                        type="text"
                        value={principalSubtitle}
                        onChange={(e) => setPrincipalSubtitle(e.target.value)}
                        placeholder="e.g. Govt. Hr. Sec. School Shangus"
                        className="w-full h-7 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}

                {/* Letterhead Banner Metadata Customizer */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                    Official School Letterhead Header
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Office Title</label>
                      <input
                        type="text"
                        value={officeTitle}
                        onChange={(e) => setOfficeTitle(e.target.value)}
                        className="w-full h-6.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Institution Name</label>
                      <input
                        type="text"
                        value={institutionName}
                        onChange={(e) => setInstitutionName(e.target.value)}
                        className="w-full h-6.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ─── MODAL: Bulk Amount Filler ─── */}
      {showFillAmountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <IndianRupee size={16} className="text-teal-600" />
                Set Beneficiary Amounts
              </h3>
              <button onClick={() => setShowFillAmountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Distribution Rule
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="amountRule"
                      checked={bulkAmountType === 'all'}
                      onChange={() => setBulkAmountType('all')}
                      className="text-teal-600"
                    />
                    <span>Same Amount for All Entries</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="amountRule"
                      checked={bulkAmountType === 'orphan_others'}
                      onChange={() => setBulkAmountType('orphan_others')}
                      className="text-teal-600"
                    />
                    <span>₹800 for Orphan / PWD & ₹600 for Others</span>
                  </label>
                </div>
              </div>

              {bulkAmountType === 'all' && (
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Amount per Candidate (₹)
                  </label>
                  <input
                    type="number"
                    value={bulkAmountVal}
                    onChange={(e) => setBulkAmountVal(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-teal-700 dark:text-teal-300"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFillAmountModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBulkAmount}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs"
              >
                Apply Amounts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Add Custom Column ─── */}
      {showAddCustomColModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PlusCircle size={16} className="text-teal-600" />
                Add Custom Table Column
              </h3>
              <button onClick={() => setShowAddCustomColModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Column Title / Header
                </label>
                <input
                  type="text"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  placeholder="e.g. Signature of Candidate, Cheque No, Remarks"
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Column Type
                </label>
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="text">Editable Plain Text</option>
                  <option value="currency">Currency / Amount (Auto-Calculates Sum Total!)</option>
                  <option value="signature">Blank for Pen Signature</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Text Alignment
                  </label>
                  <select
                    value={newColAlign}
                    onChange={(e) => setNewColAlign(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Width Percentage
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={newColWidth}
                    onChange={(e) => setNewColWidth(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddCustomColModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomColumn}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Cloud History Archive & Despatch Register ─── */}
      <DocumentHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        defaultFilter="sanction"
        onLoadAsDraft={(rec) => {
          if (rec?.title) setDocumentTitle(rec.title);
          setShowHistoryModal(false);
          showToast('Loaded draft from history archive (retained working Ref No)', 'info');
        }}
      />
    </div>
  );
}
