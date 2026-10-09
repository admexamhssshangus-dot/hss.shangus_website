// =================================================================
// HSS SHANGUS — Official Document Catalog & Despatch Register View
// Multi-module classified & chronological register for all issued
// Official Letters, Certificates, Sanction Orders & ID Cards.
// =================================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookOpen, Calendar, Printer, FileSpreadsheet, Search, Filter,
  ArrowUpDown, ChevronDown, CheckCircle2, Award, FileText,
  CreditCard, Contact, RotateCcw, X, Eye, EyeOff, Download, IndianRupee,
  Layers, Check, ExternalLink, RefreshCw, FileBadge, User, Hash,
  Clock, ShieldAlert, Sparkles, Building2, HelpCircle, CheckSquare, Square
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { showToast } from '../../components/common/GlobalToast';
import {
  isDischargeDoc,
  isLetterDoc,
  isAdmissionFormDoc,
  isBonafideDoc,
  resolveRecordSubject,
  resolveRecordRecipient
} from './DocumentHistoryModal';

// ─── Classification Helper: Recognizes all 4 modules + admissions ───
export const isSanctionOrderDoc = (r) => {
  if (!r) return false;
  const dt = (r.docType || '').toLowerCase();
  if (dt === 'sanction_order' || dt === 'sanction' || dt === 'beneficiary') return true;
  const titleLower = (r.title || '').toLowerCase();
  const subLower = (r.subject || '').toLowerCase();
  return titleLower.includes('mutual benefit') ||
         titleLower.includes('sanction') ||
         titleLower.includes('beneficiar') ||
         subLower.includes('mutual benefit') ||
         subLower.includes('sanction order');
};

export const isIdCardDoc = (r) => {
  if (!r) return false;
  const dt = (r.docType || '').toLowerCase();
  if (dt === 'id_card' || dt === 'idcard') return true;
  const titleLower = (r.title || '').toLowerCase();
  return titleLower.includes('id card') ||
         titleLower.includes('identity card') ||
         titleLower.includes('student badge');
};

/**
 * Returns canonical module classification metadata
 */
export const getRecordClassification = (r) => {
  if (isIdCardDoc(r)) {
    return {
      key: 'idcard',
      label: 'Student ID Cards',
      shortLabel: 'ID Cards',
      code: 'IDC',
      color: 'purple',
      badgeBg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
      icon: Contact
    };
  }
  if (isSanctionOrderDoc(r)) {
    return {
      key: 'sanction',
      label: 'Mutual Benefit & Sanction Orders',
      shortLabel: 'Sanction Orders',
      code: 'MBF',
      color: 'emerald',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      icon: CreditCard
    };
  }
  if (isDischargeDoc(r)) {
    return {
      key: 'discharge',
      label: 'Discharge / Transfer Certificates',
      shortLabel: 'Discharge/TC',
      code: 'DTC',
      color: 'rose',
      badgeBg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      icon: FileBadge
    };
  }
  if (isBonafideDoc(r)) {
    return {
      key: 'bonafide',
      label: 'Student Bonafides & Certificates',
      shortLabel: 'Bonafides',
      code: 'BON',
      color: 'amber',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      icon: Award
    };
  }
  if (isLetterDoc(r)) {
    return {
      key: 'letter',
      label: 'Official Institutional Letters',
      shortLabel: 'Letters',
      code: 'LTR',
      color: 'blue',
      badgeBg: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
      icon: FileText
    };
  }
  if (isAdmissionFormDoc(r)) {
    return {
      key: 'admission',
      label: 'Admission Application Forms',
      shortLabel: 'Admissions',
      code: 'ADM',
      color: 'indigo',
      badgeBg: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      icon: Layers
    };
  }
  return {
    key: 'other',
    label: 'Official Document',
    shortLabel: 'Other',
    code: 'DOC',
    color: 'slate',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    icon: FileText
  };
};

// ─── Section Configuration & Section Inference ───
export const SECTION_CONFIG = {
  all: {
    key: 'all',
    label: 'All Sections',
    shortLabel: 'All Sections',
    code: 'ALL',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
  },
  accounts: {
    key: 'accounts',
    label: 'Accounts & Finance',
    shortLabel: 'Accounts',
    code: 'ACCT',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
  },
  adms_exams: {
    key: 'adms_exams',
    label: 'Admissions & Examinations',
    shortLabel: 'Adms & Exams',
    code: 'EXAM',
    badgeClass: 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
  },
  custom: {
    key: 'custom',
    label: 'General / Custom Administration',
    shortLabel: 'General / Custom',
    code: 'ADMIN',
    badgeClass: 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
  }
};

/**
 * Accurately categorizes any document into institutional sections:
 * - accounts: Mutual Benefit Fund, Fee distribution, financial sanctions, accounts letters
 * - adms_exams: Bonafide & Character certificates, Discharge, Admissions, ID Cards, JKBOSE Exam correspondence
 * - custom: General administration, Directorate/CEO covering letters, authority delegations, staff orders
 */
export const inferRecordSection = (r) => {
  if (!r) return 'custom';

  // 1. Sanctions & MBF are always Accounts
  if (isSanctionOrderDoc(r)) return 'accounts';

  // 2. Student Certificates, Admissions, and ID Cards are always Admissions & Exams
  if (isBonafideDoc(r) || isDischargeDoc(r) || isAdmissionFormDoc(r) || isIdCardDoc(r)) {
    return 'adms_exams';
  }

  // 3. For letters, examine refNo, subject, title, templateId, templateName, recipient
  const ref = (r.refNo || '').toLowerCase();
  const title = (r.title || '').toLowerCase();
  const sub = (resolveRecordSubject(r) || '').toLowerCase();
  const recip = (resolveRecordRecipient(r) || r.recipientOrStudent || '').toLowerCase();
  const tpl = ((r.templateId || '') + ' ' + (r.templateName || '')).toLowerCase();
  const combined = `${ref} ${title} ${sub} ${recip} ${tpl}`;

  // Financial / Accounts keywords
  if (
    combined.includes('fee-dist') ||
    combined.includes('fee') ||
    combined.includes('mutual benefit') ||
    combined.includes('mbf') ||
    combined.includes('sanction') ||
    combined.includes('salary') ||
    combined.includes('audit') ||
    combined.includes('acct') ||
    combined.includes('account') ||
    combined.includes('grant') ||
    combined.includes('stipend') ||
    combined.includes('scholarship') ||
    combined.includes('bill') ||
    combined.includes('voucher') ||
    combined.includes('cheque') ||
    combined.includes('drawal') ||
    combined.includes('disbursement') ||
    combined.includes('treasury')
  ) {
    return 'accounts';
  }

  // Admissions & Exams keywords
  if (
    combined.includes('jkbose') ||
    combined.includes('bose') ||
    combined.includes('exam') ||
    combined.includes('admission') ||
    combined.includes('marks') ||
    combined.includes('roll') ||
    combined.includes('sent up') ||
    combined.includes('sentup') ||
    combined.includes('certificate') ||
    combined.includes('bonafide') ||
    combined.includes('discharge') ||
    combined.includes('re-eval') ||
    combined.includes('rechecking') ||
    combined.includes('registration') ||
    combined.includes('provisional') ||
    combined.includes('migration') ||
    combined.includes('golden test') ||
    combined.includes('pre-board')
  ) {
    return 'adms_exams';
  }

  // General / Custom Administration
  return 'custom';
};

/**
 * Resolves the issuing admin account / author email or name
 */
export const getRecordAccount = (r) => {
  if (!r) return 'Principal (Admin)';
  const candidate = (
    r.userEmail ||
    r.extraData?.userEmail ||
    r.createdBy ||
    r.author ||
    r.extraData?.author ||
    r.extraData?.signatoryName ||
    r.extraData?.issuedBy ||
    r.submittedByEmail ||
    r.submittedBy ||
    ''
  ).trim();

  if (!candidate) return 'Principal (Admin)';

  if (candidate.includes('@')) {
    return candidate.toLowerCase();
  }

  if (/^(admin|administrator|superadmin|principal)$/i.test(candidate)) {
    return 'Principal (Admin)';
  }

  return candidate;
};

/**
 * Formats account for compact UI display
 */
export const formatAccountDisplay = (accountStr) => {
  if (!accountStr || accountStr === 'Principal (Admin)') return 'Principal (Admin)';
  if (accountStr.includes('@')) {
    return accountStr.split('@')[0];
  }
  return accountStr;
};

/**
 * Unique identifier helper for row-level selection
 */
export const getRowId = (r, idx = 0) => {
  if (!r) return `doc_${idx}`;
  return r.id || `${r.refNo || 'doc'}_${r.dateStr || ''}_${idx}`;
};

/**
 * Universal Date Parser supporting Firestore timestamps, DD-MM-YYYY, DD/MM/YYYY, ISO 8601, and English dates
 */
export const parseRecordDate = (rec) => {
  if (!rec) return new Date(0);
  if (rec.createdAt) {
    if (typeof rec.createdAt.toDate === 'function') {
      const d = rec.createdAt.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof rec.createdAt.toMillis === 'function') {
      const d = new Date(rec.createdAt.toMillis());
      if (!isNaN(d.getTime())) return d;
    }
    if (rec.createdAt.seconds) {
      const d = new Date(rec.createdAt.seconds * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(rec.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (rec.updatedAt) {
    if (typeof rec.updatedAt.toDate === 'function') {
      const d = rec.updatedAt.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    if (rec.updatedAt.seconds) {
      const d = new Date(rec.updatedAt.seconds * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(rec.updatedAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (rec.dateStr) {
    const s = String(rec.dateStr).trim();
    // Try DD-MM-YYYY or DD/MM/YYYY
    const parts = s.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
        if (!isNaN(d.getTime())) return d;
      } else {
        // DD-MM-YYYY
        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

/**
 * Clean up raw HTML tags and entities like &nbsp;, &amp;, &quot; into plain legible text
 */
export const cleanHtmlEntities = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Format a Date object into standard display string (DD-MM-YYYY)
 */
export const formatDisplayDate = (d) => {
  if (!d || isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

/**
 * Extract clean, high-value identifying info across all 4 module document types
 */
export const extractIdentifyingInfo = (rec) => {
  if (!rec) return { primary: '—', secondary: '' };
  
  // 1. Student Certificates & Bonafides
  if (rec.studentDetails) {
    const sd = rec.studentDetails;
    const name = sd.name || rec.recipientOrStudent || 'Student';
    const parent = sd.father || sd.parentage || '';
    const cls = sd.cls || sd.className || '';
    const roll = sd.rollNo ? `Roll: ${sd.rollNo}` : '';
    const reg = sd.regNo ? `Reg: ${sd.regNo}` : '';
    const subParts = [parent ? `S/o or D/o ${parent}` : '', cls ? `Class: ${cls}` : '', roll, reg].filter(Boolean);
    return {
      primary: name,
      secondary: subParts.join(' • ')
    };
  }

  // 2. Sanction Orders & Mutual Benefit Fund
  if (isSanctionOrderDoc(rec)) {
    const count = rec.extraData?.beneficiaryCount;
    const total = rec.extraData?.totalAmount;
    const countStr = count ? `${count} Beneficiaries` : '';
    const totalStr = total ? `Total Sanction: ₹${total}` : '';
    const primary = rec.recipientOrStudent || (countStr ? `${countStr} ${totalStr}` : 'Beneficiary Sanction');
    const secondary = [countStr, totalStr, rec.extraData?.selectedSession ? `Session: ${rec.extraData.selectedSession}` : ''].filter(Boolean).join(' • ');
    return {
      primary,
      secondary
    };
  }

  // 3. Student ID Cards Batch
  if (isIdCardDoc(rec)) {
    const cardCount = rec.extraData?.cardCount;
    const cls = rec.extraData?.selectedClass;
    return {
      primary: rec.recipientOrStudent || (cardCount ? `${cardCount} Student ID Cards` : 'ID Card Batch'),
      secondary: [cls ? `Cohort: Class ${cls}` : '', cardCount ? `Cards: ${cardCount}` : '', rec.dateStr ? `Issue: ${rec.dateStr}` : ''].filter(Boolean).join(' • ')
    };
  }

  // 4. Official Letters & Office Orders
  const recipient = resolveRecordRecipient(rec) || rec.recipientOrStudent || '';
  const secondary = rec.templateName ? `Template: ${rec.templateName}` : '';
  return {
    primary: recipient || 'The Designated Authority',
    secondary
  };
};

/**
 * Checkbox component supporting standard indeterminate state
 */
export function IndeterminateCheckbox({ isSelected, isIndeterminate, onChange, title = '', className = '' }) {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = Boolean(isIndeterminate);
    }
  }, [isIndeterminate]);

  return (
    <input
      type="checkbox"
      ref={checkboxRef}
      checked={Boolean(isSelected)}
      onChange={onChange}
      title={title}
      className={`w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600 transition-all ${className}`}
    />
  );
}

export default function OfficialDocumentCatalogView({
  records = [],
  onClose = null,
  onPreviewRecord = null,
  onRefresh = null,
  isLoading = false
}) {
  // ─── Filter & View States ───
  const [timeRange, setTimeRange] = useState('all'); // 'all' (default) | academic_2025_26 | year_2026 | etc.
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all'); // all | accounts | adms_exams | custom
  const [accountFilter, setAccountFilter] = useState('all'); // all | specific account email or name
  const [moduleFilter, setModuleFilter] = useState('all'); // all | letter | cert | sanction | idcard | admission
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest first) | 'asc'
  const [groupMode, setGroupMode] = useState('flat'); // 'flat' (continuous chronological ledger) | 'classified'
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [hideAdmissionForms, setHideAdmissionForms] = useState(true); // Hidden by default for clean outward institutional register

  // ─── Time Range Calculations ───
  const rangeBounds = useMemo(() => {
    const now = new Date();

    switch (timeRange) {
      case 'all':
        return {
          start: new Date(0),
          end: new Date(8640000000000000),
          label: 'All-Time Historical Register'
        };
      case 'year_2026':
        return {
          start: new Date(2026, 0, 1, 0, 0, 0),
          end: new Date(2026, 11, 31, 23, 59, 59),
          label: 'Calendar Year 2026 (01 Jan 2026 – 31 Dec 2026)'
        };
      case 'academic_2025_26':
        return {
          start: new Date(2025, 3, 1, 0, 0, 0), // 01-Apr-2025
          end: new Date(2026, 11, 31, 23, 59, 59), // 31-Dec-2026
          label: 'Academic Session 2025–26 (01 Apr 2025 – 31 Dec 2026)'
        };
      case 'academic_2026_27':
        return {
          start: new Date(2026, 3, 1, 0, 0, 0), // 01-Apr-2026
          end: new Date(2027, 2, 31, 23, 59, 59), // 31-Mar-2027
          label: 'Academic Session 2026–27 (01 Apr 2026 – 31 Mar 2027)'
        };
      case 'academic_2024_25':
        return {
          start: new Date(2024, 3, 1, 0, 0, 0),
          end: new Date(2025, 11, 31, 23, 59, 59),
          label: 'Academic Session 2024–25 (01 Apr 2024 – 31 Dec 2025)'
        };
      case 'year_2025':
        return {
          start: new Date(2025, 0, 1, 0, 0, 0),
          end: new Date(2025, 11, 31, 23, 59, 59),
          label: 'Calendar Year 2025 (01 Jan 2025 – 31 Dec 2025)'
        };
      case 'last_365': {
        const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return {
          start,
          end: now,
          label: `Past 1 Year (${formatDisplayDate(start)} to ${formatDisplayDate(now)})`
        };
      }
      case 'last_180': {
        const start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        return {
          start,
          end: now,
          label: `Past 6 Months (${formatDisplayDate(start)} to ${formatDisplayDate(now)})`
        };
      }
      case 'last_30': {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          start,
          end: now,
          label: `Past 30 Days (${formatDisplayDate(start)} to ${formatDisplayDate(now)})`
        };
      }
      case 'custom': {
        const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
        const end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : new Date(8640000000000000);
        return {
          start,
          end,
          label: `Custom Range (${customStartDate || 'Start'} to ${customEndDate || 'Present'})`
        };
      }
      default:
        return {
          start: new Date(0),
          end: new Date(8640000000000000),
          label: 'All-Time Historical Register'
        };
    }
  }, [timeRange, customStartDate, customEndDate]);

  // ─── Pre-filtered by Time Range for Metric Counting ───
  const timeFilteredRecords = useMemo(() => {
    const list = Array.isArray(records) ? records : [];
    const { start, end } = rangeBounds;
    return list.filter(r => {
      const d = parseRecordDate(r);
      const t = d.getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }, [records, rangeBounds]);

  // ─── Total Admission Forms Count in Period ───
  const totalAdmissionFormsCount = useMemo(() => {
    return timeFilteredRecords.filter(r => isAdmissionFormDoc(r)).length;
  }, [timeFilteredRecords]);

  // ─── Active Records (Filtered when hideAdmissionForms is true) ───
  const activeTimeFilteredRecords = useMemo(() => {
    if (!hideAdmissionForms) return timeFilteredRecords;
    return timeFilteredRecords.filter(r => !isAdmissionFormDoc(r));
  }, [timeFilteredRecords, hideAdmissionForms]);

  // ─── Extract Unique Accounts / Generating Users for Filter ───
  const availableAccounts = useMemo(() => {
    const counts = {};
    activeTimeFilteredRecords.forEach(r => {
      const acct = getRecordAccount(r);
      counts[acct] = (counts[acct] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([account, count]) => ({ account, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeTimeFilteredRecords]);

  // ─── Extract Section Counts for Segmented Control ───
  const sectionCounts = useMemo(() => {
    let accountsCount = 0;
    let admsExamsCount = 0;
    let customCount = 0;
    activeTimeFilteredRecords.forEach(r => {
      const sec = inferRecordSection(r);
      if (sec === 'accounts') accountsCount++;
      else if (sec === 'adms_exams') admsExamsCount++;
      else customCount++;
    });
    return {
      all: activeTimeFilteredRecords.length,
      accounts: accountsCount,
      adms_exams: admsExamsCount,
      custom: customCount
    };
  }, [activeTimeFilteredRecords]);

  // ─── Filtered and Chronologically Sorted Records ───
  const { catalogRecords, stats } = useMemo(() => {
    let list = [...activeTimeFilteredRecords];

    // Compute metrics across the filtered time period (before secondary filters)
    let totalCount = list.length;
    let letterCount = 0;
    let certCount = 0;
    let sanctionCount = 0;
    let idCardCount = 0;
    let admissionCount = 0;
    let totalSanctionAmount = 0;

    list.forEach(r => {
      const cls = getRecordClassification(r);
      if (cls.key === 'letter') letterCount++;
      else if (cls.key === 'bonafide' || cls.key === 'discharge') certCount++;
      else if (cls.key === 'sanction') {
        sanctionCount++;
        const amt = parseFloat(r.extraData?.totalAmount || 0);
        if (!isNaN(amt)) totalSanctionAmount += amt;
      } else if (cls.key === 'idcard') idCardCount++;
      else if (cls.key === 'admission') admissionCount++;
    });

    // 1. Section Filter (Accounts | Adms & Exams | General / Custom)
    if (sectionFilter !== 'all') {
      list = list.filter(r => inferRecordSection(r) === sectionFilter);
    }

    // 2. Account / Generated By Filter
    if (accountFilter !== 'all') {
      list = list.filter(r => getRecordAccount(r) === accountFilter);
    }

    // 3. Module / Classification Filter
    if (moduleFilter === 'letter') {
      list = list.filter(r => getRecordClassification(r).key === 'letter');
    } else if (moduleFilter === 'cert') {
      list = list.filter(r => {
        const k = getRecordClassification(r).key;
        return k === 'bonafide' || k === 'discharge';
      });
    } else if (moduleFilter === 'sanction') {
      list = list.filter(r => getRecordClassification(r).key === 'sanction');
    } else if (moduleFilter === 'idcard') {
      list = list.filter(r => getRecordClassification(r).key === 'idcard');
    } else if (moduleFilter === 'admission') {
      list = list.filter(r => getRecordClassification(r).key === 'admission');
    }

    // 4. Search Query Filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(r => {
        const ref = (r.refNo || '').toLowerCase();
        const title = (r.title || '').toLowerCase();
        const subject = resolveRecordSubject(r).toLowerCase();
        const recipient = resolveRecordRecipient(r).toLowerCase();
        const info = extractIdentifyingInfo(r);
        const infoStr = `${info.primary} ${info.secondary}`.toLowerCase();
        const date = (r.dateStr || '').toLowerCase();
        const action = (r.actionType || '').toLowerCase();
        const acct = getRecordAccount(r).toLowerCase();
        const sec = inferRecordSection(r).toLowerCase();

        return ref.includes(q) ||
               title.includes(q) ||
               subject.includes(q) ||
               recipient.includes(q) ||
               infoStr.includes(q) ||
               date.includes(q) ||
               action.includes(q) ||
               acct.includes(q) ||
               sec.includes(q);
      });
    }

    // 5. Chronological Sorting
    list = [...list].sort((a, b) => {
      const timeA = parseRecordDate(a).getTime();
      const timeB = parseRecordDate(b).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    return {
      catalogRecords: list,
      stats: {
        total: totalCount,
        letters: letterCount,
        certs: certCount,
        sanctions: sanctionCount,
        idCards: idCardCount,
        admissions: admissionCount,
        totalAdmissionFormsCount,
        hideAdmissionForms,
        totalSanctionAmount
      }
    };
  }, [activeTimeFilteredRecords, sectionFilter, accountFilter, moduleFilter, searchQuery, sortOrder, totalAdmissionFormsCount, hideAdmissionForms]);

  // ─── Grouped by Classification (when groupMode === 'classified') ───
  const classifiedGroups = useMemo(() => {
    if (groupMode !== 'classified') return null;
    const groups = {
      letter: { label: 'Official Institutional Letters & Orders', records: [] },
      bonafide: { label: 'Student Bonafides & Certificates', records: [] },
      discharge: { label: 'Discharge / Transfer Certificates', records: [] },
      sanction: { label: 'Mutual Benefit Fund & Sanction Orders', records: [] },
      idcard: { label: 'Student Identity Card Batches', records: [] },
      admission: { label: 'Admission Applications', records: [] },
      other: { label: 'Other Documents', records: [] }
    };

    catalogRecords.forEach(r => {
      const cls = getRecordClassification(r);
      if (groups[cls.key]) {
        groups[cls.key].records.push(r);
      } else {
        groups.other.records.push(r);
      }
    });

    return Object.entries(groups).filter(([_, g]) => g.records.length > 0);
  }, [catalogRecords, groupMode]);

  // ─── Selection Helpers: Row-level checking / unchecking ───
  const visibleRowIds = useMemo(() => {
    return catalogRecords.map((r, idx) => getRowId(r, idx));
  }, [catalogRecords]);

  const isAllVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every(id => selectedDocIds.has(id));
  const isSomeVisibleSelected = visibleRowIds.some(id => selectedDocIds.has(id)) && !isAllVisibleSelected;

  const handleToggleRow = (rowId, e) => {
    e?.stopPropagation?.();
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const handleToggleSelectRecords = (recsToToggle) => {
    if (!Array.isArray(recsToToggle) || recsToToggle.length === 0) return;
    const ids = recsToToggle.map((r, idx) => getRowId(r, idx));
    const allSelected = ids.every(id => selectedDocIds.has(id));

    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleToggleSelectAll = (e) => {
    e?.stopPropagation?.();
    if (isAllVisibleSelected) {
      setSelectedDocIds(prev => {
        const next = new Set(prev);
        visibleRowIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedDocIds(prev => {
        const next = new Set(prev);
        visibleRowIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleSelectAllVisible = () => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      visibleRowIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedDocIds(new Set());
  };

  // ─── 1-Click Hide/Unhide Admission Forms Handler ───
  const handleToggleHideAdmissions = () => {
    setHideAdmissionForms(prev => {
      const next = !prev;
      if (next && moduleFilter === 'admission') {
        setModuleFilter('all');
      }
      showToast(
        next
          ? `Admission forms (${totalAdmissionFormsCount}) hidden from register & print`
          : `Admission forms (${totalAdmissionFormsCount}) shown in register & print`,
        'info'
      );
      return next;
    });
  };

  // Determine records targeted by print or export (selected if any, otherwise all filtered)
  const targetRecords = useMemo(() => {
    if (selectedDocIds.size > 0) {
      const filtered = catalogRecords.filter((r, idx) => selectedDocIds.has(getRowId(r, idx)));
      if (filtered.length > 0) return filtered;
    }
    return catalogRecords;
  }, [catalogRecords, selectedDocIds]);

  // ─── Action: Print Official Despatch Register / PDF (Compact & Minimal) ───
  const handlePrintCatalog = () => {
    if (targetRecords.length === 0) {
      showToast('No documents match current filters to print', 'warning');
      return;
    }

    const isSelective = selectedDocIds.size > 0 && targetRecords.length < catalogRecords.length;

    const tableRowsHtml = targetRecords.map((r, idx) => {
      const cls = getRecordClassification(r);
      const secKey = inferRecordSection(r);
      const secConfig = SECTION_CONFIG[secKey] || SECTION_CONFIG.custom;
      const acct = getRecordAccount(r);
      const acctDisplay = formatAccountDisplay(acct);
      const parsedDate = parseRecordDate(r);
      const dateText = formatDisplayDate(parsedDate);
      const refText = r.refNo || '—';
      const subjectText = cleanHtmlEntities(resolveRecordSubject(r) || r.title || 'Official Document');
      const info = extractIdentifyingInfo(r);
      const cleanPrimary = cleanHtmlEntities(info.primary);
      const cleanSecondary = cleanHtmlEntities(info.secondary);
      const actionText = r.actionType || 'Recorded';

      return `
        <tr>
          <td style="text-align: center; font-weight: bold; font-size: 8pt;">${idx + 1}</td>
          <td style="text-align: center; white-space: nowrap; font-family: monospace; font-size: 8pt;">${dateText}</td>
          <td style="font-weight: bold; font-family: monospace; font-size: 8.5pt;">${refText}</td>
          <td style="font-size: 7.5pt; text-align: center; font-weight: 700; text-transform: uppercase;">
            ${secConfig.code}
          </td>
          <td style="font-size: 8pt; white-space: nowrap;">
            <strong style="font-size: 7.5pt;">${cls.code}</strong> - ${cls.shortLabel}
          </td>
          <td style="font-size: 8pt; line-height: 1.25;">
            <div style="font-weight: 700;">${subjectText}</div>
            ${r.title && r.title !== subjectText ? `<div style="font-size: 7pt; color: #475569;">Title: ${cleanHtmlEntities(r.title)}</div>` : ''}
          </td>
          <td style="font-size: 8pt; line-height: 1.25;">
            <div style="font-weight: 700;">${cleanPrimary}</div>
            ${cleanSecondary ? `<div style="font-size: 7pt; color: #475569;">${cleanSecondary}</div>` : ''}
          </td>
          <td style="font-size: 7.5pt; font-family: monospace; color: #334155; white-space: nowrap;">
            ${acctDisplay}
          </td>
          <td style="text-align: center; font-size: 7.5pt; white-space: nowrap;">${actionText}</td>
          <td style="font-size: 7.5pt; color: #94a3b8; text-align: center;"></td>
        </tr>
      `;
    }).join('');

    const formattedAmount = stats.totalSanctionAmount > 0 
      ? ` | Total Sanctions: ₹${stats.totalSanctionAmount.toLocaleString('en-IN')}`
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Official Despatch & Document Issue Register — HSS Shangus</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 landscape;
            margin: 7mm 8mm 7mm 8mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 8.5pt;
            line-height: 1.25;
          }
          .header {
            text-align: center;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 4px;
            margin-bottom: 5px;
          }
          .office-title {
            font-size: 9pt;
            font-weight: 800;
            color: #b91c1c;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .inst-name {
            font-size: 13.5pt;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            margin: 1px 0;
          }
          .inst-meta {
            font-size: 7.5pt;
            color: #475569;
          }
          .register-banner {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 4px 8px;
            margin: 4px 0 5px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .register-title {
            font-size: 9.5pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #0f172a;
          }
          .register-meta {
            font-size: 7.5pt;
            font-weight: 700;
            color: #334155;
          }
          .summary-kpi {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            font-size: 7.5pt;
            margin-bottom: 5px;
            padding: 3px 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
          }
          .kpi-item {
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          th, td {
            border: 1px solid #64748b;
            padding: 2.5px 4px;
            vertical-align: middle;
          }
          th {
            background-color: #e2e8f0;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 7.5pt;
            letter-spacing: 0.2px;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .certification {
            margin-top: 6px;
            font-size: 7.5pt;
            font-style: italic;
            color: #334155;
            border-top: 1px dashed #cbd5e1;
            padding-top: 4px;
          }
          .sign-grid {
            margin-top: 24px;
            display: flex;
            justify-content: space-between;
            padding: 0 15px;
            page-break-inside: avoid;
          }
          .sign-block {
            text-align: center;
            width: 170px;
          }
          .sign-line {
            border-top: 1px solid #000;
            margin-bottom: 3px;
          }
          .sign-title {
            font-size: 7.5pt;
            font-weight: 700;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="office-title">OFFICE OF THE PRINCIPAL</div>
          <div class="inst-name">GOVT. HIGHER SECONDARY SCHOOL SHANGUS</div>
          <div class="inst-meta">Anantnag, Kashmir — 192201 (J&K) | UDISE: 01061400618 | Email: ghssshangus74@gmail.com</div>
        </div>

        <div class="register-banner">
          <div class="register-title">
            OFFICIAL DESPATCH & DOCUMENT REGISTER ${isSelective ? '(SELECTIVE AUDIT)' : ''}
          </div>
          <div class="register-meta">
            Period: ${rangeBounds.label} | Records: ${targetRecords.length}${isSelective ? ` (Selected of ${catalogRecords.length})` : ''}${hideAdmissionForms && totalAdmissionFormsCount > 0 ? ` | Admissions Hidden (${totalAdmissionFormsCount})` : ''}
          </div>
        </div>

        <div class="summary-kpi">
          <div class="kpi-item">Section: ${SECTION_CONFIG[sectionFilter]?.label || 'All'}</div>
          <div class="kpi-item">Account: ${accountFilter === 'all' ? 'All Accounts' : accountFilter}</div>
          <div class="kpi-item">Letters: ${stats.letters}</div>
          <div class="kpi-item">Certificates: ${stats.certs}</div>
          <div class="kpi-item">Sanctions: ${stats.sanctions}${formattedAmount}</div>
          <div class="kpi-item">ID Cards: ${stats.idCards}</div>
          ${!hideAdmissionForms && stats.admissions > 0 ? `<div class="kpi-item">Admissions: ${stats.admissions}</div>` : ''}
          <div class="kpi-item">Printed: ${new Date().toLocaleString('en-GB')}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 3.5%;">S.No</th>
              <th style="width: 7.5%;">Date</th>
              <th style="width: 12%;">Ref. / Despatch No</th>
              <th style="width: 7.5%;">Section</th>
              <th style="width: 8%;">Type</th>
              <th style="width: 24.5%;">Subject / Purpose / Title</th>
              <th style="width: 20%;">Issued To / Student / Addressee</th>
              <th style="width: 9.5%;">Generated By</th>
              <th style="width: 4%;">Status</th>
              <th style="width: 3.5%;">Sign</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="certification">
          Certified that the above entries from S.No. 1 to ${targetRecords.length} represent official authenticated records of letters, certificates, sanction orders, and identity documents issued by Govt. Higher Secondary School Shangus during the indicated period.
        </div>

        <div class="sign-grid">
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-title">Dealing Assistant / Clerk</div>
          </div>
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-title">Incharge Records & Despatch</div>
          </div>
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-title">Principal<br>Govt. Higher Secondary School Shangus</div>
          </div>
        </div>

      </body>
      </html>
    `;

    // Hidden offscreen iframe for single, non-popup print dialog
    let iframe = document.getElementById('despatch-catalog-print-frame');
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }

    iframe = document.createElement('iframe');
    iframe.id = 'despatch-catalog-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '1024px';
    iframe.style.height = '768px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    let hasPrinted = false;
    const triggerPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn('Iframe print warning:', err);
      }
    };

    setTimeout(triggerPrint, 350);
  };

  // ─── Action: Export Official Despatch Register to Excel (.xlsx) ───
  const handleExportExcel = () => {
    if (targetRecords.length === 0) {
      showToast('No records available to export', 'warning');
      return;
    }

    try {
      setIsExporting(true);
      const wb = XLSX.utils.book_new();
      const isSelective = selectedDocIds.size > 0 && targetRecords.length < catalogRecords.length;

      // Sheet 1: Detailed Master Register
      const rows = [];
      rows.push(['GOVT. HIGHER SECONDARY SCHOOL SHANGUS']);
      rows.push(['OFFICE OF THE PRINCIPAL — OFFICIAL DESPATCH & DOCUMENT REGISTER']);
      rows.push([`Time Range: ${rangeBounds.label} | Section: ${SECTION_CONFIG[sectionFilter]?.label || 'All'} | Account: ${accountFilter === 'all' ? 'All Accounts' : accountFilter}`]);
      rows.push([
        `Generated On: ${new Date().toLocaleString('en-GB')}`,
        '',
        '',
        `Total Exported Documents: ${targetRecords.length}${isSelective ? ` (Selected from ${catalogRecords.length})` : ''}`
      ]);
      rows.push([]); // blank line

      // Column Headers
      rows.push([
        'S.No.',
        'Issue Date',
        'Ref. / Despatch No.',
        'Section',
        'Classification Code',
        'Module / Document Type',
        'Subject / Purpose',
        'Document Title',
        'Issued To / Recipient',
        'Identifying Details (Student / Beneficiaries / Cohort)',
        'Generated By / Account',
        'Class Cohort',
        'Action Type',
        'Internal Document ID',
        'System Timestamp'
      ]);

      targetRecords.forEach((r, idx) => {
        const cls = getRecordClassification(r);
        const sec = SECTION_CONFIG[inferRecordSection(r)]?.label || 'General / Custom';
        const acct = getRecordAccount(r);
        const parsedDate = parseRecordDate(r);
        const dateText = formatDisplayDate(parsedDate);
        const refText = r.refNo || '—';
        const subjectText = resolveRecordSubject(r) || r.title || 'Official Document';
        const info = extractIdentifyingInfo(r);

        rows.push([
          idx + 1,
          dateText,
          refText,
          sec,
          cls.code,
          cls.label,
          subjectText,
          r.title || '',
          info.primary,
          info.secondary,
          acct,
          r.studentDetails?.cls || r.extraData?.selectedClass || '',
          r.actionType || 'Recorded',
          r.id || '',
          r.createdAt || ''
        ]);
      });

      const wsRegister = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, wsRegister, 'Despatch Register');

      // Sheet 2: Summary Statistics
      const summaryRows = [
        ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS — SUMMARY CLASSIFICATION'],
        [`Period: ${rangeBounds.label}`],
        [],
        ['Section Breakdown', 'Code', 'Count in Period'],
        ['Accounts & Finance', 'ACCT', sectionCounts.accounts],
        ['Admissions & Examinations', 'EXAM', sectionCounts.adms_exams],
        ['General / Custom Administration', 'ADMIN', sectionCounts.custom],
        [],
        ['Document Classification', 'Code', 'Count', 'Percentage (%)', 'Financial Sanctions (₹)'],
        ['Official Institutional Letters & Orders', 'LTR', stats.letters, stats.total > 0 ? ((stats.letters / stats.total) * 100).toFixed(1) + '%' : '0%', '—'],
        ['Student Bonafides & Certificates', 'BON/DTC', stats.certs, stats.total > 0 ? ((stats.certs / stats.total) * 100).toFixed(1) + '%' : '0%', '—'],
        ['Mutual Benefit Fund & Sanction Orders', 'MBF', stats.sanctions, stats.total > 0 ? ((stats.sanctions / stats.total) * 100).toFixed(1) + '%' : '0%', `₹ ${stats.totalSanctionAmount.toLocaleString('en-IN')}`],
        ['Student Identity Cards Batches', 'IDC', stats.idCards, stats.total > 0 ? ((stats.idCards / stats.total) * 100).toFixed(1) + '%' : '0%', '—'],
        ['Admission Application Forms', 'ADM', hideAdmissionForms ? `Hidden (${totalAdmissionFormsCount})` : stats.admissions, (!hideAdmissionForms && stats.total > 0) ? ((stats.admissions / stats.total) * 100).toFixed(1) + '%' : '0%', '—'],
        [],
        ['TOTAL DOCUMENTS IN REGISTER', 'ALL', stats.total, '100%', stats.totalSanctionAmount > 0 ? `₹ ${stats.totalSanctionAmount.toLocaleString('en-IN')}` : '—']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Statistics');

      const fileName = `HSS_Shangus_Despatch_${sectionFilter}_${timeRange}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`Exported ${fileName} successfully!`, 'success');
    } catch (err) {
      console.error('Excel catalog export failed:', err);
      showToast('Failed to export catalog spreadsheet: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* ─── TOOLBAR & CONTROL PANEL (Ultra-Compact & High Density) ─── */}
      <div className="flex-none p-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 space-y-2">
        
        {/* Row 1: Time Range, Section Pills, Account Filter & Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Time Range Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                <Calendar size={12} className="text-teal-600" />
                Range:
              </span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="h-7 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs cursor-pointer max-w-[190px] truncate"
              >
                <option value="all">All Records (All-Time Archive)</option>
                <option value="academic_2025_26">Academic 2025–26 (01 Apr 2025 – 31 Dec 2026)</option>
                <option value="academic_2026_27">Academic 2026–27 (01 Apr 2026 – 31 Mar 2027)</option>
                <option value="academic_2024_25">Academic 2024–25 (01 Apr 2024 – 31 Dec 2025)</option>
                <option value="year_2026">Calendar Year 2026</option>
                <option value="year_2025">Calendar Year 2025</option>
                <option value="last_365">Past 1 Year (365 Days)</option>
                <option value="last_180">Past 6 Months</option>
                <option value="last_30">Past 30 Days</option>
                <option value="custom">Custom Date Range...</option>
              </select>

              {/* Custom Date Pickers */}
              {timeRange === 'custom' && (
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-7 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 text-slate-700 dark:text-slate-200"
                    title="From Date"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-7 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 text-slate-700 dark:text-slate-200"
                    title="To Date"
                  />
                </div>
              )}
            </div>

            {/* Section Segmented Control: (Accounts | Adms & Exams | General / Custom) */}
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 text-xs shadow-2xs">
              <span className="text-[9.5px] font-black uppercase text-slate-400 px-1 select-none">
                Section:
              </span>
              <button
                type="button"
                onClick={() => setSectionFilter('all')}
                className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all ${
                  sectionFilter === 'all'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="All Sections combined"
              >
                All ({sectionCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter('accounts')}
                className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all flex items-center gap-0.5 ${
                  sectionFilter === 'accounts'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200'
                }`}
                title="Accounts & Finance: Mutual Benefit Fund, Fee distribution, financial sanctions & vouchers"
              >
                <IndianRupee size={10} />
                <span>Accounts ({sectionCounts.accounts})</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter('adms_exams')}
                className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all flex items-center gap-0.5 ${
                  sectionFilter === 'adms_exams'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200'
                }`}
                title="Admissions & Examinations: Bonafides, Discharge, Admissions, ID Cards & JKBOSE Exam letters"
              >
                <Award size={10} />
                <span>Adms & Exams ({sectionCounts.adms_exams})</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter('custom')}
                className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all flex items-center gap-0.5 ${
                  sectionFilter === 'custom'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-200'
                }`}
                title="General / Custom Administration: Covering letters to Directorate/CEO, authority letters, custom orders"
              >
                <Building2 size={10} />
                <span>Custom ({sectionCounts.custom})</span>
              </button>
            </div>

            {/* Account / Generated By Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                <User size={12} className="text-teal-600" />
                Account:
              </span>
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="h-7 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs cursor-pointer max-w-[170px] truncate"
                title="Filter by generating staff account / issuer"
              >
                <option value="all">All Accounts ({activeTimeFilteredRecords.length})</option>
                {availableAccounts.map(item => (
                  <option key={item.account} value={item.account}>
                    {formatAccountDisplay(item.account)} ({item.count})
                  </option>
                ))}
              </select>
            </div>

            {/* 1-Click Hide/Unhide Admissions in One Go */}
            {totalAdmissionFormsCount > 0 && (
              <button
                type="button"
                onClick={handleToggleHideAdmissions}
                className={`h-7 px-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border shadow-2xs ${
                  hideAdmissionForms
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                }`}
                title={
                  hideAdmissionForms
                    ? `Admission forms (${totalAdmissionFormsCount}) are hidden from catalog & print. Click to show in one go.`
                    : `Admission forms (${totalAdmissionFormsCount}) are visible. Click to hide in one go from catalog & print.`
                }
              >
                {hideAdmissionForms ? <EyeOff size={13} className="text-amber-600 shrink-0" /> : <Eye size={13} className="text-indigo-600 shrink-0" />}
                <span className="whitespace-nowrap">
                  {hideAdmissionForms ? `Admissions Hidden (${totalAdmissionFormsCount})` : `Admissions Shown (${totalAdmissionFormsCount})`}
                </span>
              </button>
            )}
          </div>

          {/* Action Buttons: Export Excel & Print Register */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || catalogRecords.length === 0}
              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-98"
              title={selectedDocIds.size > 0 ? `Export ${targetRecords.length} selected documents to Excel` : 'Export all visible documents to Excel'}
            >
              <FileSpreadsheet size={13} />
              <span>{selectedDocIds.size > 0 ? `Export (${targetRecords.length})` : 'Export Excel'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintCatalog}
              disabled={catalogRecords.length === 0}
              className="h-7 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-98"
              title={selectedDocIds.size > 0 ? `Print ${targetRecords.length} selected documents as official register` : 'Print complete catalog / register'}
            >
              <Printer size={13} />
              <span>{selectedDocIds.size > 0 ? `Print (${targetRecords.length})` : 'Print Catalog / PDF'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Module Tabs, Sort Toggle, Grouping, & Search Box */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
          
          {/* Module Filter Tabs */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 flex-wrap">
            <button
              type="button"
              onClick={() => setModuleFilter('all')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-black cursor-pointer transition-all ${
                moduleFilter === 'all'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Modules ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('letter')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'letter'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText size={11} />
              <span>Letters ({stats.letters})</span>
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('cert')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'cert'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Award size={11} />
              <span>Certificates ({stats.certs})</span>
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('sanction')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'sanction'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CreditCard size={11} />
              <span>Sanctions ({stats.sanctions})</span>
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('idcard')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'idcard'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Contact size={11} />
              <span>ID Cards ({stats.idCards})</span>
            </button>

            {!hideAdmissionForms && stats.admissions > 0 && (
              <button
                type="button"
                onClick={() => setModuleFilter('admission')}
                className={`px-2 py-0.5 rounded text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                  moduleFilter === 'admission'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Layers size={11} />
                <span>Admissions ({stats.admissions})</span>
              </button>
            )}
          </div>

          {/* Grouping, Sort & Search Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* View Layout Toggle */}
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setGroupMode('flat')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  groupMode === 'flat'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                title="Continuous Chronological Ledger"
              >
                Chronological
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('classified')}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  groupMode === 'classified'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                title="Grouped by Module Classification"
              >
                Classified Groups
              </button>
            </div>

            {/* Sort Order Button */}
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-[10.5px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Toggle date sorting order"
            >
              <ArrowUpDown size={11} />
              <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>

            {/* Search Box */}
            <div className="relative min-w-[170px] sm:min-w-[200px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ref, student, subject..."
                className="w-full h-7 pl-7 pr-6 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: High Density Compact KPI Summary Strip */}
        <div className="flex items-center flex-wrap gap-2 text-[11px] py-1 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs">
          <div className="flex items-center gap-1 font-black text-slate-800 dark:text-slate-200">
            <BookOpen size={12} className="text-teal-600" />
            <span>Period Total:</span>
            <span className="text-teal-700 dark:text-teal-400 font-extrabold">{stats.total} Documents</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
            <FileText size={12} className="text-blue-600" />
            <span>Letters:</span>
            <span className="text-blue-600 dark:text-blue-400">{stats.letters}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
            <Award size={12} className="text-amber-600" />
            <span>Certificates:</span>
            <span className="text-amber-600 dark:text-amber-400">{stats.certs}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
            <CreditCard size={12} className="text-emerald-600" />
            <span>Sanctions:</span>
            <span className="text-emerald-600 dark:text-emerald-400">{stats.sanctions}</span>
            {stats.totalSanctionAmount > 0 && (
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1 rounded border border-emerald-200 dark:border-emerald-800">
                ₹{stats.totalSanctionAmount.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
            <Contact size={12} className="text-purple-600" />
            <span>ID Cards:</span>
            <span className="text-purple-600 dark:text-purple-400">{stats.idCards}</span>
          </div>

          {/* Active Filter Indicators */}
          {(sectionFilter !== 'all' || accountFilter !== 'all') && (
            <>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <div className="text-[10.5px] font-semibold text-slate-500">
                Filtered: <strong className="text-slate-700 dark:text-slate-200">{catalogRecords.length}</strong> matching
              </div>
            </>
          )}

          {/* Selection indicator & quick actions */}
          {selectedDocIds.size > 0 && (
            <div className="ml-auto flex items-center gap-1.5 bg-teal-100 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 px-2 py-0.5 rounded-full font-black text-[10.5px] border border-teal-300 dark:border-teal-700 animate-in fade-in">
              <Check size={11} className="stroke-[3]" />
              <span>{selectedDocIds.size} of {catalogRecords.length} selected</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="ml-1 hover:text-rose-600 text-teal-700 dark:text-teal-300 underline text-[10px] cursor-pointer"
                title="Deselect all rows"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Row 4 (Conditional): Floating Selection Banner when rows are selected */}
        {selectedDocIds.size > 0 && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-bold text-teal-900 dark:text-teal-200">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-teal-600" />
              <span>{selectedDocIds.size} row{selectedDocIds.size === 1 ? '' : 's'} checked for Selective Export & Print</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 text-[10.5px] hover:bg-teal-100 dark:hover:bg-teal-900/50 cursor-pointer"
              >
                Select All Visible ({catalogRecords.length})
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10.5px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── DESPATCH & ISSUE REGISTER TABLE CONTAINER ─── */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-2.5">
        {catalogRecords.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-2">
            <BookOpen size={36} className="text-slate-300 dark:text-slate-600" />
            <div className="font-bold text-sm text-slate-600 dark:text-slate-300">
              No Issued Documents Match Selected Filters
            </div>
            <p className="text-xs max-w-md text-slate-500">
              No official letters, certificates, sanction orders, or ID card batches found for period ({rangeBounds.label}) with current Section ({SECTION_CONFIG[sectionFilter]?.label}) and Account filters.
            </p>
          </div>
        ) : groupMode === 'classified' && classifiedGroups ? (
          /* Classified Grouped Sections */
          <div className="space-y-3">
            {classifiedGroups.map(([catKey, group]) => (
              <div key={catKey} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
                <div className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>{group.label}</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                      {group.records.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectRecords(group.records)}
                    className="text-[10.5px] font-semibold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                  >
                    Select/Deselect Group
                  </button>
                </div>

                <RegisterTable
                  records={group.records}
                  onPreviewRecord={onPreviewRecord}
                  selectedDocIds={selectedDocIds}
                  onToggleRow={handleToggleRow}
                  onToggleSelectRecords={handleToggleSelectRecords}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Continuous Master Chronological Register */
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
            <RegisterTable
              records={catalogRecords}
              onPreviewRecord={onPreviewRecord}
              selectedDocIds={selectedDocIds}
              onToggleRow={handleToggleRow}
              onToggleSelectRecords={handleToggleSelectRecords}
              isAllSelected={isAllVisibleSelected}
              isSomeSelected={isSomeVisibleSelected}
              onToggleSelectAll={handleToggleSelectAll}
            />
          </div>
        )}
      </div>

      {/* ─── FOOTER BAR: SUMMARY METRICS & AUDIT INFO ─── */}
      <div className="flex-none bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong>{catalogRecords.length}</strong> of {stats.total} total documents
            {selectedDocIds.size > 0 && <span className="text-teal-700 dark:text-teal-400 font-bold"> ({selectedDocIds.size} checked)</span>}
          </span>
          <span>•</span>
          <span className="font-mono text-[10px]">{rangeBounds.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Official Despatch Register • Govt. Higher Secondary School Shangus</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Standard Register Data Table component (Compact, Minimal & Interactive)
 */
function RegisterTable({
  records = [],
  onPreviewRecord,
  selectedDocIds,
  onToggleRow,
  onToggleSelectRecords,
  isAllSelected = null,
  isSomeSelected = null,
  onToggleSelectAll = null
}) {
  // If master selection props not provided (e.g. in classified mode), compute group-level selection
  const groupIds = useMemo(() => records.map((r, idx) => getRowId(r, idx)), [records]);
  const tableAllSelected = isAllSelected !== null 
    ? isAllSelected 
    : (groupIds.length > 0 && groupIds.every(id => selectedDocIds?.has(id)));
  const tableSomeSelected = isSomeSelected !== null 
    ? isSomeSelected 
    : (groupIds.some(id => selectedDocIds?.has(id)) && !tableAllSelected);

  const handleHeaderCheckboxToggle = () => {
    if (onToggleSelectAll) {
      onToggleSelectAll();
    } else if (onToggleSelectRecords) {
      onToggleSelectRecords(records);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 select-none">
            {/* Row Selection Master Checkbox */}
            <th className="py-1.5 px-2 w-8 text-center" onClick={(e) => e.stopPropagation()}>
              <IndeterminateCheckbox
                isSelected={tableAllSelected}
                isIndeterminate={tableSomeSelected}
                onChange={handleHeaderCheckboxToggle}
                title="Select or deselect all visible records in this table"
              />
            </th>
            <th className="py-1.5 px-1.5 w-9 text-center">S.No</th>
            <th className="py-1.5 px-2 w-20 text-center">Date</th>
            <th className="py-1.5 px-2 w-36">Ref. / Despatch No</th>
            <th className="py-1.5 px-2 w-28">Section & Type</th>
            <th className="py-1.5 px-2.5 min-w-[200px]">Subject / Purpose / Title</th>
            <th className="py-1.5 px-2.5 min-w-[170px]">Issued To / Recipient</th>
            <th className="py-1.5 px-2 w-28">Generated By</th>
            <th className="py-1.5 px-2 w-18 text-center">Status</th>
            <th className="py-1.5 px-1.5 w-10 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
          {records.map((rec, idx) => {
            const rowId = getRowId(rec, idx);
            const isRowSelected = Boolean(selectedDocIds?.has(rowId));
            const cls = getRecordClassification(rec);
            const secKey = inferRecordSection(rec);
            const secConfig = SECTION_CONFIG[secKey] || SECTION_CONFIG.custom;
            const acct = getRecordAccount(rec);
            const acctDisplay = formatAccountDisplay(acct);
            const parsedDate = parseRecordDate(rec);
            const dateText = formatDisplayDate(parsedDate);
            const refText = rec.refNo || '—';
            const subjectText = cleanHtmlEntities(resolveRecordSubject(rec) || rec.title || 'Official Document');
            const info = extractIdentifyingInfo(rec);
            const cleanPrimary = cleanHtmlEntities(info.primary);
            const cleanSecondary = cleanHtmlEntities(info.secondary);
            const Icon = cls.icon;

            return (
              <tr
                key={rowId}
                onClick={() => onPreviewRecord?.(rec)}
                className={`cursor-pointer transition-colors ${
                  isRowSelected
                    ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 font-medium'
                    : 'hover:bg-teal-50/40 dark:hover:bg-slate-800/50'
                }`}
              >
                {/* Row Checkbox */}
                <td 
                  className="py-1.5 px-2 text-center" 
                  onClick={(e) => onToggleRow?.(rowId, e)}
                >
                  <input
                    type="checkbox"
                    checked={isRowSelected}
                    onChange={(e) => onToggleRow?.(rowId, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                    title={`Check / uncheck row: ${refText}`}
                  />
                </td>

                {/* S.No */}
                <td className="py-1.5 px-1.5 text-center font-bold text-slate-500 text-[11px]">
                  {idx + 1}
                </td>

                {/* Date */}
                <td className="py-1.5 px-2 text-center font-mono text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {dateText}
                </td>

                {/* Ref / Despatch No */}
                <td className="py-1.5 px-2">
                  <div className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100 break-all leading-tight">
                    {refText !== '—' ? (
                      <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {refText}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">Unassigned Draft</span>
                    )}
                  </div>
                </td>

                {/* Section & Classification Badges */}
                <td className="py-1.5 px-2 whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <span className={`inline-flex items-center gap-1 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border w-fit ${cls.badgeBg}`}>
                      <Icon size={9} className="shrink-0" />
                      <span>{cls.shortLabel}</span>
                    </span>
                    <span className={`text-[9px] font-bold px-1 rounded border w-fit ${secConfig.badgeClass}`}>
                      {secConfig.shortLabel}
                    </span>
                  </div>
                </td>

                {/* Subject / Purpose / Title */}
                <td className="py-1.5 px-2.5">
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs line-clamp-1 leading-snug">
                    {subjectText}
                  </div>
                  {rec.title && cleanHtmlEntities(rec.title) !== subjectText && (
                    <div className="text-[10px] text-slate-500 line-clamp-1 leading-tight">
                      {cleanHtmlEntities(rec.title)}
                    </div>
                  )}
                </td>

                {/* Issued To / Student / Addressee */}
                <td className="py-1.5 px-2.5">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs leading-snug">
                    {cleanPrimary}
                  </div>
                  {cleanSecondary && (
                    <div className="text-[9.5px] text-slate-500 font-mono leading-tight truncate max-w-[220px]">
                      {cleanSecondary}
                    </div>
                  )}
                </td>

                {/* Generated By / Account */}
                <td className="py-1.5 px-2 whitespace-nowrap">
                  <div className="flex items-center gap-1 text-[10.5px] font-mono text-slate-600 dark:text-slate-400" title={`Issuer Account: ${acct}`}>
                    <User size={10} className="text-teal-600 shrink-0" />
                    <span className="truncate max-w-[105px]">{acctDisplay}</span>
                  </div>
                </td>

                {/* Status */}
                <td className="py-1.5 px-2 text-center whitespace-nowrap">
                  <span className="text-[9.5px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                    {rec.actionType || 'Recorded'}
                  </span>
                </td>

                {/* Action */}
                <td className="py-1.5 px-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onPreviewRecord?.(rec)}
                    className="p-1 rounded hover:bg-teal-100 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 transition-colors cursor-pointer"
                    title="View Document Snapshot"
                  >
                    <Eye size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
