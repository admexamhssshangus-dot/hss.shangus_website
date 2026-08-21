import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  FileText,
  Eye,
  Edit2,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Calendar,
  Layers,
  Users,
  FlaskConical,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Printer,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  Save,
  SlidersHorizontal,
  FolderArchive,
  Settings,
  FileSpreadsheet,
  CheckSquare,
  Square,
  MoreVertical,
  Download,
  Loader2,
  BarChart3,
  TrendingUp,
  Filter,
  RotateCcw,
  Building2,
  CreditCard,
  CalendarDays,
  Wallet,
  Sparkles,
  Undo2,
  Info
} from 'lucide-react';
import { db } from '../../firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { getCachedCollectionSync } from '../../services/dbCache';
import {
  DEFAULT_SUBSIDIARY_ACCOUNTS,
  SUBSIDIARY_ACCOUNTS,
  CENTRAL_ACCOUNT_NO,
  getReportPeriodDescription,
  printFundDistributionLetter,
  exportFundDistributionToExcel,
  exportConsolidatedFundDistributionToExcel,
  printConsolidatedFundDistributionLetter,
  downloadFundDistributionPdf,
  downloadConsolidatedFundDistributionPdf,
  exportTransactionAnalysisToExcel,
  downloadTransactionAnalysisPdf,
  printTransactionAnalysisLetter
} from '../../utils/fundDistributionPdfGenerator';
import { getCanonicalSubjectCodes, resolveStudentStream } from './AdvancedReports';

/**
 * Reusable Live Report Preview Card for both Entry and History views
 */
function ReportPreviewCard({ report, rates, accounts = DEFAULT_SUBSIDIARY_ACCOUNTS, onDownload, onPrint, onClose }) {
  if (!report) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center space-y-1.5 shadow-2xs">
        <FileText size={28} className="text-slate-400 mx-auto" />
        <h4 className="font-black text-[11px] text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          REPORT PREVIEW PANE
        </h4>
        <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
          Click any report row to see the instant live breakdown here.
        </p>
      </div>
    );
  }

  const cls = report.class || '11th';
  const cRate = rates[cls] || DEFAULT_RATES[cls] || DEFAULT_RATES['11th'] || {};
  const paidCount = parseInt(report.paidStudents || report.onRoll || 0, 10) || 0;
  const sciCount = parseInt(report.scienceStudents || 0, 10) || 0;
  const periodLabel = getReportPeriodDescription(report);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden animate-fadeIn flex flex-col max-h-[calc(100vh-96px)]">
      {/* Compact Preview Header — Sticky inside Card */}
      <div className="bg-blue-600 px-3.5 py-2 text-white flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 flex-shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wider text-blue-100 flex items-center gap-1.5 whitespace-nowrap">
          <FileText size={13} /> REPORT PREVIEW
        </span>
        <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
          <button
            type="button"
            onClick={() => exportFundDistributionToExcel(report, rates, accounts)}
            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            title="Download Excel Sheet for Bank Operations"
          >
            <FileSpreadsheet size={11} /> Excel
          </button>
          <button
            type="button"
            onClick={() => printFundDistributionLetter(report, rates, accounts)}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white font-black text-[9px] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
          >
            <Printer size={11} /> Print PDF
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white cursor-pointer ml-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="p-3.5 space-y-2 text-slate-800 dark:text-slate-200 text-xs font-bold overflow-y-auto flex-grow scrollbar-thin">
        <div className="text-center space-y-0.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
            FUND DISTRIBUTION STATEMENT
          </div>
          <div className="text-sm font-black text-blue-700 dark:text-blue-400">
            Class {report.class} • {periodLabel}
          </div>
        </div>

        <div className="space-y-0.5 text-[10.5px]">
          <div className="flex justify-between text-slate-500">
            <span>Transaction Date:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">
              {report.generatedDate || report.date || '—'}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Academic Session:</span>
            <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
              {report.academicSession || report.session || (report.year?.includes('-') ? report.year : '2025-26')}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Paid Students:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">
              {paidCount}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Science Students:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">
              {sciCount}
            </span>
          </div>
        </div>

        {/* Dynamic 2-Column Fee Breakdown Grid for All Configured Accounts */}
        <div className="border-t border-dotted border-slate-200 dark:border-slate-700 pt-2 grid grid-cols-2 gap-x-3.5 gap-y-2 text-[10.5px]">
          {accounts.map(acc => {
            const count = acc.isScienceOnly ? sciCount : paidCount;
            const rateVal = cRate[acc.key] || 0;
            const val = (report[acc.key] !== undefined && report[acc.key] !== null)
              ? parseFloat(report[acc.key]) || (rateVal * count)
              : (rateVal * count);

            const displayName = String(acc.name || '').replace(/\s*\(\s*per science student\s*\)/gi, '').trim();

            return (
              <div key={acc.key} className="flex justify-between items-start gap-1 py-0.5">
                <div className="min-w-0 flex-1">
                  <div className="text-slate-600 dark:text-slate-400 truncate flex items-center gap-1 font-bold" title={displayName}>
                    <span className="truncate">{displayName}</span>
                    {acc.isScienceOnly && (
                      <span className="text-[8px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-extrabold flex-shrink-0">
                        Sci
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 font-bold leading-tight">
                    ({count} × ₹{rateVal})
                  </div>
                </div>
                <span className="font-mono font-black flex-shrink-0 text-slate-900 dark:text-white pt-0.5">
                  {formatCurrency(val)}
                </span>
              </div>
            );
          })}
        </div>

        {/* TOTAL AMOUNT Highlight */}
        <div className="border-t-2 border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between text-slate-900 dark:text-white">
          <span className="text-[11px] font-black uppercase tracking-wider">TOTAL AMOUNT</span>
          <span className="text-base font-mono font-black text-blue-600 dark:text-blue-400">
            {formatCurrency(report.totalAmount)}
          </span>
        </div>

        <div className="text-[8.5px] text-slate-400 italic text-center pt-0.5 border-t border-slate-100 dark:border-slate-800">
          Live Statement Breakdown ({accounts.length} Heads)
        </div>
      </div>

      {/* Persistent Sticky Action Footer — Always Visible Without Scrolling */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onDownload(report)}
            className="w-full py-2 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10.5px] flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all cursor-pointer active:scale-98"
            title="Download Statement as PDF or Excel"
          >
            <Download size={13} />
            <span>Download</span>
          </button>
          <button
            type="button"
            onClick={() => onPrint(report)}
            className="w-full py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-black text-[10.5px] flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-98"
            title="Print Official Letter"
          >
            <Printer size={13} />
            <span>Print Letter</span>
          </button>
        </div>
      </div>
    </div>
  );
}


const DEFAULT_RATES = {
  '12th': {
    schoolImprov: 175,
    gamesFund: 100,
    newsFund: 70,
    poorFund: 50,
    redCrossFund: 50,
    admFee: 0,
    printingFund: 135,
    libraryFund: 105,
    boardReg: 0,
    computerFund: 150,
    magazineFund: 150,
    scienceFund: 100,
    socialActivity: 90,
    sweepingFund: 80,
    electricityCharges: 70,
    totalFeeReceived: 1325
  },
  '11th': {
    schoolImprov: 175,
    gamesFund: 100,
    newsFund: 70,
    poorFund: 50,
    redCrossFund: 50,
    admFee: 0,
    printingFund: 135,
    libraryFund: 105,
    boardReg: 0,
    computerFund: 150,
    magazineFund: 150,
    scienceFund: 100,
    socialActivity: 90,
    sweepingFund: 80,
    electricityCharges: 70,
    totalFeeReceived: 1325
  },
  '10th': {
    schoolImprov: 110,
    gamesFund: 65,
    newsFund: 50,
    poorFund: 35,
    redCrossFund: 35,
    admFee: 0,
    printingFund: 40,
    libraryFund: 75,
    boardReg: 0,
    computerFund: 85,
    magazineFund: 75,
    scienceFund: 60,
    socialActivity: 40,
    sweepingFund: 60,
    electricityCharges: 50,
    totalFeeReceived: 780
  },
  '9th': {
    schoolImprov: 110,
    gamesFund: 65,
    newsFund: 50,
    poorFund: 35,
    redCrossFund: 35,
    admFee: 0,
    printingFund: 40,
    libraryFund: 75,
    boardReg: 0,
    computerFund: 85,
    magazineFund: 75,
    scienceFund: 60,
    socialActivity: 40,
    sweepingFund: 60,
    electricityCharges: 50,
    totalFeeReceived: 780
  }
};

const HEAD_LABELS = {
  schoolImprov: 'School Improvement Fund',
  redCrossFund: 'Red Cross Fund',
  poorFund: 'Mutual Benefit (Poor Fund)',
  gamesFund: 'Games Fund',
  printingFund: 'Printing Fund (Forms & Prospectus)',
  scienceFund: 'Science Fund',
  computerFund: 'Computer Fund',
  libraryFund: 'Library Fund',
  socialActivity: 'Social Activity Fund',
  sweepingFund: 'Sweeping Fund',
  magazineFund: 'Magazine Fund',
  electricityCharges: 'Electricity Charges',
  newsFund: 'News Fund'
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
'July', 'August', 'September', 'October', 'November', 'December'
];

function formatCurrency(val) {
  const n = parseFloat(val) || 0;
  return '₹' + n.toLocaleString('en-IN');
}

export default function FundDistribution() {
  const [activeTab, setActiveTab] = useState('entry'); // 'entry' | 'history' | 'analytics'
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [distributions, setDistributions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Dynamic Subsidiary Accounts State
  const [accounts, setAccounts] = useState(DEFAULT_SUBSIDIARY_ACCOUNTS);
  const [tempAccounts, setTempAccounts] = useState(DEFAULT_SUBSIDIARY_ACCOUNTS);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountData, setNewAccountData] = useState({
    name: '',
    accNo: '',
    isScienceOnly: false,
    rate9th: '',
    rate10th: '',
    rate11th: '',
    rate12th: ''
  });

  // Local Academic Session State (Fund Distribution specific)
  const [fundSession, setFundSession] = useState('2025-26');
  const [formSession, setFormSession] = useState('2025-26');

  // Live Database Students & Master Registers for auto-populating enrollment and roll numbers
  const [rawStudents, setRawStudents] = useState(() => {
    const cached = getCachedCollectionSync('admissions');
    return Array.isArray(cached) ? cached : [];
  });

  const [masterRegisters, setMasterRegisters] = useState(() => {
    const cached = getCachedCollectionSync('masterRegisters');
    return Array.isArray(cached) ? cached : [];
  });

  // Entry Form State
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formClass, setFormClass] = useState('9th');
  const [formPaidCount, setFormPaidCount] = useState('');
  const [formScienceCount, setFormScienceCount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview & Modal States
  const [previewReport, setPreviewReport] = useState(null);
  const [editReport, setEditReport] = useState(null);
  const [deleteTargetReport, setDeleteTargetReport] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Rate Settings & Accounts Modal State
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState('rates'); // 'rates' | 'rolls'
  const [editingRatesClass, setEditingRatesClass] = useState('11th');
  const [tempRates, setTempRates] = useState(DEFAULT_RATES);
  const [isSavingRates, setIsSavingRates] = useState(false);

  // Manual Enrollment & Stream Figures Overrides State (freely editable by admin)
  const [enrollmentOverrides, setEnrollmentOverrides] = useState({});

  // History Filter & Accordion States
  const [historySearch, setHistorySearch] = useState('');
  const [historyClassFilter, setHistoryClassFilter] = useState('All');
  const [expandedYears, setExpandedYears] = useState({});

  const showNotification = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage({ text: '', type: '' });
    }, 4000);
  };

  // Helper string cleaner
  const cleanStr = (v) => (v !== null && v !== undefined ? String(v).trim() : '');

  // Fetch live rates, accounts, distributions, admissions, and master registers
  const fetchData = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 0. Fetch custom subsidiary accounts & default session
      const accDocSnap = await getDoc(doc(db, 'fund_config', 'subsidiary_accounts')).catch(() => null);
      if (accDocSnap && accDocSnap.exists()) {
        const d = accDocSnap.data();
        if (Array.isArray(d?.accounts) && d.accounts.length > 0) {
          setAccounts(d.accounts);
          setTempAccounts(d.accounts);
        } else {
          setAccounts(DEFAULT_SUBSIDIARY_ACCOUNTS);
          setTempAccounts(DEFAULT_SUBSIDIARY_ACCOUNTS);
        }
        if (d?.defaultSession) {
          setFundSession(d.defaultSession);
          setFormSession(d.defaultSession);
        }
      } else {
        setAccounts(DEFAULT_SUBSIDIARY_ACCOUNTS);
        setTempAccounts(DEFAULT_SUBSIDIARY_ACCOUNTS);
      }

      // 1. Fetch rates
      const ratesSnap = await getDocs(collection(db, 'fund_rates')).catch(() => null);
      if (ratesSnap && !ratesSnap.empty) {
        const loadedRates = { ...DEFAULT_RATES };
        ratesSnap.docs.forEach(d => {
          loadedRates[d.id] = { ...DEFAULT_RATES[d.id], ...d.data() };
        });
        setRates(loadedRates);
        setTempRates(loadedRates);
      }

      // 2. Fetch distributions
      const distSnap = await getDocs(collection(db, 'fund_distributions')).catch(() => null);
      if (distSnap && !distSnap.empty) {
        const distList = distSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        distList.sort((a, b) => {
          const tA = new Date(a.timestamp || a.generatedDate || 0).getTime() || 0;
          const tB = new Date(b.timestamp || b.generatedDate || 0).getTime() || 0;
          return tB - tA;
        });
        setDistributions(distList);
        if (!previewReport && distList.length > 0) {
          setPreviewReport(distList[0]);
        }
      }

      // 3. Fetch live admissions and masterRegisters
      const [admSnap, mrSnap] = await Promise.all([
        getDocs(collection(db, 'admissions')).catch(() => null),
        getDocs(collection(db, 'masterRegisters')).catch(() => null)
      ]);

      if (admSnap && !admSnap.empty) {
        const admList = admSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRawStudents(admList);
      }

      if (mrSnap && !mrSnap.empty) {
        const mrList = mrSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMasterRegisters(mrList);
      }
    } catch (e) {
      console.error('Error fetching fund distribution data:', e);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [previewReport]);

  useEffect(() => {
    fetchData();

    // Real-time listener for distributions
    const unsubDist = onSnapshot(collection(db, 'fund_distributions'), (snap) => {
      if (snap && !snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const tA = new Date(a.timestamp || a.generatedDate || 0).getTime() || 0;
          const tB = new Date(b.timestamp || b.generatedDate || 0).getTime() || 0;
          return tB - tA;
        });
        setDistributions(list);
      }
    }, (err) => {
      console.warn('Real-time distributions note:', err);
    });

    // Real-time listener for subsidiary accounts config
    const unsubConfig = onSnapshot(doc(db, 'fund_config', 'subsidiary_accounts'), (snap) => {
      if (snap && snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d?.accounts) && d.accounts.length > 0) {
          setAccounts(d.accounts);
          setTempAccounts(d.accounts);
        }
        if (d?.defaultSession) {
          setFundSession(d.defaultSession);
        }
      }
    }, (err) => {
      console.warn('Real-time config note:', err);
    });

    // Real-time listener for admissions (live database enrollment)
    const unsubAdmissions = onSnapshot(collection(db, 'admissions'), (snap) => {
      if (snap && !snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRawStudents(list);
      }
    }, (err) => {
      console.warn('Real-time admissions note in FundDistribution:', err);
    });

    // Real-time listener for masterRegisters (historical / archived datasets)
    const unsubMaster = onSnapshot(collection(db, 'masterRegisters'), (snap) => {
      if (snap && !snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMasterRegisters(list);
      }
    }, (err) => {
      console.warn('Real-time masterRegisters note in FundDistribution:', err);
    });

    return () => {
      unsubDist();
      unsubConfig();
      unsubAdmissions();
      unsubMaster();
    };
  }, [fetchData]);

  // ─── LIVE DATABASE STUDENT STATS FOR ACTIVE SESSION ACROSS ADMISSIONS & MASTER REGISTERS ───
  const dbStudentStats = useMemo(() => {
    const stats = {
      '9th': { total: 0, science: 0, streams: { Humanities: 0, Science: 0 } },
      '10th': { total: 0, science: 0, streams: { Humanities: 0, Science: 0 } },
      '11th': { total: 0, science: 0, streams: { Humanities: 0, Science: 0 } },
      '12th': { total: 0, science: 0, streams: { Humanities: 0, Science: 0 } }
    };

    const targetSession = String(fundSession || formSession || '2025-26').trim().toLowerCase();
    const processedIds = new Set();

    // Cross-referencing index for authentic 11th records (for 12th students with 'Same as in class 11th' or subject verification)
    const record11thByReg = new Map();
    const record11thByAdm = new Map();
    const record11thByName = new Map();

    const index11thRecord = (item) => {
      const cls = String(item.class || item.Class || item['Admission sought for class'] || '').toLowerCase();
      if (cls.includes('11') || cls.includes('xi')) {
        const reg = String(item.boardRegNo || item['Board Reg No'] || item.regNo || '').trim().toLowerCase();
        const adm = String(item.admNo || item['Admission No'] || item.admissionNo || '').trim().toLowerCase();
        const name = String(item.name || item.studentName || item["Student's Name"] || '').trim().toLowerCase();
        const parent = String(item.fatherName || item["Father's Name"] || '').trim().toLowerCase();
        if (reg && reg !== '—' && reg !== 'n/a') record11thByReg.set(reg, item);
        if (adm && adm !== '—' && adm !== 'n/a') record11thByAdm.set(adm, item);
        if (name && parent) record11thByName.set(`${name}_${parent}`, item);
      }
    };

    (masterRegisters || []).forEach(h => {
      const items = h.items || h.students || h.records || h.data;
      if (Array.isArray(items)) {
        items.forEach(index11thRecord);
      }
    });

    (rawStudents || []).forEach(index11thRecord);

    const processStudent = (s, idx) => {
      const id = String(s.id || s.docId || s.formNo || s['Form Number'] || `std_${idx}`);
      if (processedIds.has(id)) return;

      const status = String(s.status || s.Status || s['Admission Status'] || s.admission_status || '').trim().toLowerCase();
      const rollNo = String(s.classRollNo || s['Class Roll No'] || s['Class Roll No.'] || s.rollNo || s.RollNo || s.class_roll_no || '').trim();

      // Discard rejected or cancelled records
      if (status === 'rejected' || status === 'cancelled') return;

      // Must be approved or have assigned class roll number
      const isApproved = status === 'approved' || (rollNo && rollNo !== '—' && rollNo !== 'N/A' && rollNo !== 'undefined');
      if (!isApproved) return;

      // Match session
      const sSession = String(s.session || s.Session || s['Academic Session'] || s.academicSession || s.academic_session || '').trim().toLowerCase();
      if (sSession && !sSession.includes(targetSession) && !targetSession.includes(sSession)) {
        return;
      }

      // Identify class
      const rawClass = String(s.class || s.Class || s['Admission sought for class'] || s.className || '').trim().toLowerCase();
      let cls = null;
      if (rawClass.includes('9') || rawClass === 'ix') cls = '9th';
      else if (rawClass.includes('10') || rawClass === 'x') cls = '10th';
      else if (rawClass.includes('11') || rawClass === 'xi') cls = '11th';
      else if (rawClass.includes('12') || rawClass === 'xii') cls = '12th';

      if (!cls || !stats[cls]) return;

      processedIds.add(id);
      stats[cls].total += 1;

      // Find 11th record match if student is in 12th
      let masterMatch = null;
      if (cls === '12th') {
        const reg = String(s.boardRegNo || s['Board Reg No'] || s.regNo || '').trim().toLowerCase();
        const adm = String(s.admNo || s['Admission No'] || s.admissionNo || '').trim().toLowerCase();
        const name = String(s.name || s.studentName || s["Student's Name"] || '').trim().toLowerCase();
        const parent = String(s.fatherName || s["Father's Name"] || '').trim().toLowerCase();
        if (reg && reg !== '—' && reg !== 'n/a') masterMatch = record11thByReg.get(reg);
        if (!masterMatch && adm && adm !== '—' && adm !== 'n/a') masterMatch = record11thByAdm.get(adm);
        if (!masterMatch && name && parent) masterMatch = record11thByName.get(`${name}_${parent}`);
      }

      // Accurate stream resolution using canonical JKBOSE codes & 11th cross-referencing
      const stdStream = resolveStudentStream(s, masterMatch);
      stats[cls].streams[stdStream] = (stats[cls].streams[stdStream] || 0) + 1;
      if (stdStream === 'Science') {
        stats[cls].science += 1;
      }
    };

    // 1. Process active admissions
    (rawStudents || []).forEach((s, idx) => processStudent(s, idx));

    // 2. Process masterRegisters if targetSession exists in historical records
    (masterRegisters || []).forEach((h, hIdx) => {
      const pSess = String(h.session || h.Session || h['Academic Session'] || '').trim().toLowerCase();
      if (pSess && (pSess.includes(targetSession) || targetSession.includes(pSess))) {
        const items = h.items || h.students || h.records || h.data;
        if (Array.isArray(items)) {
          items.forEach((item, iIdx) => processStudent(item, `${hIdx}_${iIdx}`));
        }
      }
    });

    // In 9th and 10th, Science fund is universal (applies to 100% of students)
    stats['9th'].science = stats['9th'].total;
    stats['10th'].science = stats['10th'].total;

    return stats;
  }, [rawStudents, masterRegisters, fundSession, formSession]);

  // ─── ACTIVE ENROLLMENT STATS (Combines Live DB Roll Numbers with Manual Admin Figures) ───
  const activeStudentStats = useMemo(() => {
    const res = {};
    ['9th', '10th', '11th', '12th'].forEach(cls => {
      const db = dbStudentStats[cls] || { total: 0, science: 0, streams: {} };
      const ov = enrollmentOverrides[cls];
      if (ov) {
        res[cls] = {
          total: ov.total !== undefined ? ov.total : db.total,
          science: ov.science !== undefined ? ov.science : db.science,
          streams: {
            Humanities: ov.humanities !== undefined ? ov.humanities : (db.streams?.Humanities || 0),
            Science: ov.science !== undefined ? ov.science : (db.streams?.Science || 0),
            Commerce: ov.commerce !== undefined ? ov.commerce : (db.streams?.Commerce || 0),
            'Home Science': ov.homeScience !== undefined ? ov.homeScience : (db.streams?.['Home Science'] || 0)
          },
          isCustom: true
        };
      } else {
        res[cls] = {
          ...db,
          isCustom: false
        };
      }
    });
    return res;
  }, [dbStudentStats, enrollmentOverrides]);

  // Handle updating enrollment override figures (total or streamwise)
  const handleUpdateEnrollmentOverride = (cls, field, value) => {
    setEnrollmentOverrides(prev => {
      const current = prev[cls] || {
        total: dbStudentStats[cls]?.total || 0,
        science: dbStudentStats[cls]?.science || 0,
        humanities: dbStudentStats[cls]?.streams?.Humanities || 0,
        commerce: dbStudentStats[cls]?.streams?.Commerce || 0,
        homeScience: dbStudentStats[cls]?.streams?.['Home Science'] || 0
      };

      const numVal = Math.max(0, parseInt(value, 10) || 0);
      const updated = { ...current, [field]: numVal };

      if (cls === '9th' || cls === '10th') {
        if (field === 'total') {
          updated.science = numVal;
        }
      } else {
        // For 11th and 12th: If updating a stream, recompute total
        if (field === 'science' || field === 'humanities' || field === 'commerce' || field === 'homeScience') {
          updated.total = (updated.science || 0) + (updated.humanities || 0) + (updated.commerce || 0) + (updated.homeScience || 0);
        }
      }

      return {
        ...prev,
        [cls]: updated
      };
    });
  };

  const handleResetEnrollmentOverride = (cls) => {
    setEnrollmentOverrides(prev => {
      const next = { ...prev };
      delete next[cls];
      return next;
    });
    showNotification(`Reset Class ${cls} counts to database defaults.`, 'info');
  };

  // ─── FEE DISTRIBUTION PROGRESS & TRACKING (Approved vs Distributed vs Remaining Left) ───
  const feeDistributionProgress = useMemo(() => {
    const targetSession = String(fundSession || formSession || '2025-26').trim().toLowerCase();

    // Sum already distributed students from past statements in target session
    const distributed = {
      '9th': { total: 0, science: 0 },
      '10th': { total: 0, science: 0 },
      '11th': { total: 0, science: 0 },
      '12th': { total: 0, science: 0 }
    };

    (distributions || []).forEach(d => {
      const dSess = String(d.academicSession || d.session || d.year || '').trim().toLowerCase();
      if (!dSess || (!dSess.includes(targetSession) && !targetSession.includes(dSess))) {
        return;
      }
      const cls = d.class;
      if (cls && distributed[cls]) {
        distributed[cls].total += parseInt(d.paidStudents || d.onRoll || 0, 10) || 0;
        distributed[cls].science += parseInt(d.scienceStudents || 0, 10) || 0;
      }
    });

    const progress = {};
    ['9th', '10th', '11th', '12th'].forEach(cls => {
      const approvedTotal = activeStudentStats[cls]?.total || 0;
      const approvedSci = activeStudentStats[cls]?.science || 0;
      const distTotal = distributed[cls].total;
      const distSci = distributed[cls].science;

      const remainingTotal = Math.max(0, approvedTotal - distTotal);
      const remainingSci = Math.max(0, approvedSci - distSci);
      const percent = approvedTotal > 0 ? Math.min(100, Math.round((distTotal / approvedTotal) * 100)) : (distTotal > 0 ? 100 : 0);

      progress[cls] = {
        approvedTotal,
        approvedSci,
        distributedTotal: distTotal,
        distributedSci: distSci,
        remainingTotal,
        remainingSci,
        percent,
        isComplete: approvedTotal > 0 && remainingTotal === 0,
        streams: activeStudentStats[cls]?.streams || {}
      };
    });

    return progress;
  }, [activeStudentStats, distributions, fundSession, formSession]);

  // Handle Class Switch with Automatic 9th/10th Science Fund Sync
  const handleClassChange = (newCls) => {
    setFormClass(newCls);
    if (newCls === '9th' || newCls === '10th') {
      // In 9th and 10th, auto-sync SCI (OPT) to PAID STD
      if (formPaidCount) {
        setFormScienceCount(formPaidCount);
      }
    }
  };

  // Handle Paid Count Changes with Default 1:1 Auto-Update for 9th/10th
  const handlePaidCountChange = (val) => {
    setFormPaidCount(val);
    if (formClass === '9th' || formClass === '10th') {
      // For 9th and 10th, Science fund is for all students by default
      setFormScienceCount(val);
    }
  };

  // 1-Click Auto-Fill from Counts (Freely editable anytime)
  const handleApplyDbStats = (cls, paid, science) => {
    setFormClass(cls);
    setFormPaidCount(String(paid || 0));
    if (cls === '9th' || cls === '10th') {
      setFormScienceCount(String(paid || 0));
    } else {
      setFormScienceCount(String(science !== undefined ? science : 0));
    }
    showNotification(`Populated Class ${cls} counts (${paid} Paid Std • ${science !== undefined ? science : paid} Science Std). You can adjust numbers freely.`, 'info');
  };

  // Calculate Breakdown for class and student counts
  const calculateBreakdown = (cls, paid, science, accList = accounts) => {
    const classRates = rates[cls] || DEFAULT_RATES[cls] || DEFAULT_RATES['11th'] || {};
    const paidCount = parseInt(paid, 10) || 0;
    const sciCount = parseInt(science, 10) || 0;

    const breakdown = {};
    let total = 0;

    accList.forEach(acc => {
      const rateVal = classRates[acc.key] || 0;
      const count = acc.isScienceOnly ? sciCount : paidCount;
      const amt = rateVal * count;
      breakdown[acc.key] = amt;
      total += amt;
    });

    breakdown.totalAmount = total;
    return breakdown;
  };

  // Generate and Save new Fund Distribution Report
  const handleGenerateReport = async (e) => {
    e.preventDefault();
    if (!formPaidCount || parseInt(formPaidCount, 10) <= 0) {
      showNotification('Please enter a valid student paid count.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const pCount = parseInt(formPaidCount, 10) || 0;
      const sCount = parseInt(formScienceCount, 10) || 0;
      const dateObj = formDate ? new Date(formDate) : new Date();
      const monthName = MONTH_NAMES[dateObj.getMonth()] || 'April';
      const calYear = String(dateObj.getFullYear());
      const sessionVal = formSession?.trim() || fundSession || '2025-26';
      const yearStr = `${calYear} (${sessionVal})`;

      const breakdown = calculateBreakdown(formClass, pCount, sCount, accounts);
      const docId = `dist_${formClass}_${monthName}_${Date.now()}`;

      const newRecord = {
        id: docId,
        class: formClass,
        date: formDate,
        generatedDate: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        month: monthName,
        calendarYear: calYear,
        academicSession: sessionVal,
        session: sessionVal,
        year: yearStr,
        paidStudents: pCount,
        onRoll: pCount,
        scienceStudents: sCount,
        ...breakdown,
        timestamp: new Date().toISOString()
      };

      await setDoc(doc(db, 'fund_distributions', docId), newRecord);

      showNotification(`Successfully generated ${formClass} report for ${monthName} ${calYear} [Session: ${sessionVal}] (${formatCurrency(breakdown.totalAmount)})!`, 'success');
      setFormPaidCount('');
      setFormScienceCount('');
      setPreviewReport(newRecord);
    } catch (err) {
      console.error('Failed to generate fund distribution:', err);
      showNotification('Failed to generate report: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Edit Report with Confirmation and Recalculation
  const handleSaveEdit = async () => {
    if (!editReport) return;
    setIsUpdating(true);
    try {
      const pCount = parseInt(editReport.paidStudents, 10) || 0;
      const sCount = parseInt(editReport.scienceStudents, 10) || 0;
      const dateObj = editReport.date ? new Date(editReport.date) : new Date();
      const monthName = editReport.month || MONTH_NAMES[dateObj.getMonth()] || 'April';
      const calYear = editReport.calendarYear || String(dateObj.getFullYear());
      const sessionVal = editReport.academicSession || editReport.session || fundSession || '2025-26';
      const yearStr = `${calYear} (${sessionVal})`;

      const breakdown = calculateBreakdown(editReport.class, pCount, sCount, accounts);

      const updated = {
        ...editReport,
        date: editReport.date || new Date().toISOString().split('T')[0],
        generatedDate: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        month: monthName,
        calendarYear: calYear,
        academicSession: sessionVal,
        session: sessionVal,
        year: yearStr,
        paidStudents: pCount,
        onRoll: pCount,
        scienceStudents: sCount,
        ...breakdown,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'fund_distributions', editReport.id), updated);
      showNotification(`Report updated successfully! New Total: ${formatCurrency(breakdown.totalAmount)}`, 'success');
      if (previewReport?.id === editReport.id) {
        setPreviewReport(updated);
      }
      setEditReport(null);
    } catch (err) {
      console.error('Failed to update report:', err);
      showNotification('Failed to update: ' + err.message, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete Report with Confirmation
  const handleDeleteReport = async () => {
    if (!deleteTargetReport) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'fund_distributions', deleteTargetReport.id));
      showNotification(`Statement for ${deleteTargetReport.class} (${deleteTargetReport.month}) deleted permanently.`, 'success');
      if (previewReport?.id === deleteTargetReport.id) {
        setPreviewReport(null);
      }
      setDeleteTargetReport(null);
    } catch (err) {
      console.error('Failed to delete report:', err);
      showNotification('Failed to delete: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Account Management & Rate Table Updates
  const handleAddNewAccount = (e) => {
    e?.preventDefault?.();
    if (!newAccountData.name.trim()) {
      showNotification('Please enter a valid Subsidiary Account Name.', 'error');
      return;
    }
    const cleanName = newAccountData.name.trim();
    // Generate unique camelCase slug
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueKey = baseSlug || `acc_${Date.now().toString(36)}`;
    const finalKey = tempAccounts.some(a => a.key === uniqueKey) ? `${uniqueKey}_${Date.now().toString(36).slice(-4)}` : uniqueKey;

    const newAcc = {
      key: finalKey,
      name: cleanName,
      accNo: newAccountData.accNo.trim() || '0137040500000000',
      isScienceOnly: Boolean(newAccountData.isScienceOnly)
    };

    setTempAccounts(prev => [...prev, newAcc]);

    // Initialize rates for all 4 classes
    const r9 = parseInt(newAccountData.rate9th, 10) || 0;
    const r10 = parseInt(newAccountData.rate10th, 10) || r9;
    const r11 = parseInt(newAccountData.rate11th, 10) || r9;
    const r12 = parseInt(newAccountData.rate12th, 10) || r11;

    setTempRates(prev => ({
      '9th': { ...prev['9th'], [finalKey]: r9 },
      '10th': { ...prev['10th'], [finalKey]: r10 },
      '11th': { ...prev['11th'], [finalKey]: r11 },
      '12th': { ...prev['12th'], [finalKey]: r12 }
    }));

    setNewAccountData({
      name: '',
      accNo: '',
      isScienceOnly: false,
      rate9th: '',
      rate10th: '',
      rate11th: '',
      rate12th: ''
    });
    setIsAddingAccount(false);
    showNotification(`Added "${cleanName}". Remember to click "Save & Update All" to persist.`, 'success');
  };

  const handleDeleteAccount = (accKey) => {
    if (tempAccounts.length <= 1) {
      showNotification('Cannot delete the last remaining subsidiary account.', 'error');
      return;
    }
    const targetAcc = tempAccounts.find(a => a.key === accKey);
    const confirmed = window.confirm(`Remove "${targetAcc?.name || accKey}" from the institutional accounts list?`);
    if (!confirmed) return;

    setTempAccounts(prev => prev.filter(a => a.key !== accKey));
    setTempRates(prev => {
      const updated = { ...prev };
      ['9th', '10th', '11th', '12th'].forEach(cls => {
        if (updated[cls]) {
          const cObj = { ...updated[cls] };
          delete cObj[accKey];
          updated[cls] = cObj;
        }
      });
      return updated;
    });
    showNotification(`Removed account. Remember to click "Save & Update All" to confirm.`, 'success');
  };

  const handleUpdateAccountField = (accKey, field, val) => {
    setTempAccounts(prev => prev.map(a => {
      if (a.key === accKey) {
        return { ...a, [field]: val };
      }
      return a;
    }));
  };

  const handleResetToDefaults = () => {
    const confirmed = window.confirm('Reset all accounts and rates back to the original 13 institutional defaults?');
    if (!confirmed) return;
    setTempAccounts(DEFAULT_SUBSIDIARY_ACCOUNTS);
    setTempRates(DEFAULT_RATES);
    showNotification('Reset to defaults. Click "Save & Update All" to persist.', 'success');
  };

  // Save Rate Table & Custom Subsidiary Accounts Updates to Firestore
  const handleSaveRates = async () => {
    setIsSavingRates(true);
    try {
      // 1. Save rates for each class
      await Promise.all(['9th', '10th', '11th', '12th'].map(cls => {
        const classRatesToSave = tempRates[cls] || {};
        return setDoc(doc(db, 'fund_rates', cls), classRatesToSave);
      }));

      // 2. Save subsidiary accounts list to Firestore config with default session
      await setDoc(doc(db, 'fund_config', 'subsidiary_accounts'), {
        accounts: tempAccounts,
        defaultSession: fundSession,
        updatedAt: new Date().toISOString()
      });

      setRates({ ...tempRates });
      setAccounts([...tempAccounts]);

      showNotification('Fee rates and subsidiary accounts saved to database successfully!', 'success');
      setIsRatesModalOpen(false);
      setIsAddingAccount(false);
    } catch (err) {
      console.error('Failed to save rates & accounts:', err);
      showNotification('Failed to save rates: ' + err.message, 'error');
    } finally {
      setIsSavingRates(false);
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return distributions.filter(item => {
      const matchClass = historyClassFilter === 'All' || item.class === historyClassFilter;
      const matchQuery = !historySearch || 
        String(item.class || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        String(item.month || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        String(item.year || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        String(item.academicSession || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        String(item.session || '').toLowerCase().includes(historySearch.toLowerCase()) ||
        String(item.totalAmount || '').includes(historySearch);
      return matchClass && matchQuery;
    });
  }, [distributions, historyClassFilter, historySearch]);

  // Multi-Selection State for Bulk PDF / Excel / WhatsApp operations
  const [selectedReportIds, setSelectedReportIds] = useState(new Set());

  const toggleSelectReport = (id) => {
    setSelectedReportIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (reportsList) => {
    if (!reportsList || reportsList.length === 0) return;
    const allSelected = reportsList.every(r => selectedReportIds.has(r.id));
    setSelectedReportIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        reportsList.forEach(r => next.delete(r.id));
      } else {
        reportsList.forEach(r => next.add(r.id));
      }
      return next;
    });
  };

  const selectedReportsList = useMemo(() => {
    return distributions.filter(r => selectedReportIds.has(r.id));
  }, [distributions, selectedReportIds]);

  // Contextual More Actions Dropdown State
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  // Format Choice Modal: { action: 'download' | 'whatsapp', targetType: 'single' | 'consolidated', data: item | list }
  const [formatModal, setFormatModal] = useState(null);
  const [isProcessingFormat, setIsProcessingFormat] = useState(null); // 'pdf' | 'excel' | null

  // ──── ANALYTICS & TRANSACTION REPORT STATES ────
  const [analyticsSessions, setAnalyticsSessions] = useState([]); // [] = All
  const [analyticsClasses, setAnalyticsClasses] = useState([]); // [] = All
  const [analyticsMonths, setAnalyticsMonths] = useState([]); // [] = All
  const [analyticsAccounts, setAnalyticsAccounts] = useState([]); // [] = All
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsPerspective, setAnalyticsPerspective] = useState('account'); // 'account' | 'month' | 'class' | 'statement'
  const [analyticsSortBy, setAnalyticsSortBy] = useState('amount-desc'); // 'amount-desc' | 'amount-asc' | 'name-asc'
  const [isProcessingAnalytics, setIsProcessingAnalytics] = useState(null); // 'excel' | 'pdf' | 'print' | null

  // Available unique lists for filters dynamically fetched from admissions & masterRegisters
  const availableSessions = useMemo(() => {
    const set = new Set();

    // 1. From live admissions records
    (rawStudents || []).forEach(s => {
      const sess = cleanStr(s.session || s.Session || s['Academic Session'] || s.academicSession || s.academic_session);
      if (sess && sess !== '—' && sess.length >= 4) {
        set.add(sess);
      }
    });

    // 2. From historical master registers
    (masterRegisters || []).forEach(h => {
      const sess = cleanStr(h.session || h.Session || h['Academic Session']);
      if (sess && sess !== '—' && sess.length >= 4) set.add(sess);
      const items = h.items || h.students || h.records || h.data;
      if (Array.isArray(items)) {
        items.forEach(item => {
          const sItem = cleanStr(item.session || item.Session || item['Academic Session']);
          if (sItem && sItem !== '—' && sItem.length >= 4) set.add(sItem);
        });
      }
    });

    // 3. From fund distribution statements
    (distributions || []).forEach(d => {
      const s = cleanStr(d.academicSession || d.session || d.year);
      if (s && s !== '—' && s.length >= 4 && !s.includes('(')) {
        set.add(s);
      }
    });

    // Baseline fallbacks if nothing in DB yet
    if (set.size === 0) {
      set.add('2025-26');
      set.add('2024-25');
      set.add('2023-24');
    }

    // Sort cleanly in reverse chronological order
    return Array.from(set).sort((a, b) => {
      const numA = parseInt((a.match(/\d{4}/) || [0])[0], 10);
      const numB = parseInt((b.match(/\d{4}/) || [0])[0], 10);
      if (numA !== numB) return numB - numA;
      return String(b).localeCompare(String(a));
    });
  }, [rawStudents, masterRegisters, distributions]);

  const availableMonths = useMemo(() => {
    const set = new Set();
    distributions.forEach(d => {
      const m = d.month || '';
      const calY = d.calendarYear || (d.date ? new Date(d.date).getFullYear() : '');
      const label = m && calY ? `${m} ${calY}` : (m || d.year || '');
      if (label && label !== '—') set.add(label);
    });
    return Array.from(set);
  }, [distributions]);

  const availableClasses = ['9th', '10th', '11th', '12th'];

  // Filtered reports for analytics
  const filteredAnalyticsReports = useMemo(() => {
    return distributions.filter(r => {
      if (analyticsSessions.length > 0) {
        const s = r.academicSession || r.session || (r.year ? `${r.year}` : '');
        if (!analyticsSessions.includes(s)) return false;
      }
      if (analyticsClasses.length > 0) {
        if (!analyticsClasses.includes(r.class)) return false;
      }
      if (analyticsMonths.length > 0) {
        const m = r.month || '';
        const calY = r.calendarYear || (r.date ? new Date(r.date).getFullYear() : '');
        const label = m && calY ? `${m} ${calY}` : (m || r.year || '');
        if (!analyticsMonths.includes(label) && !analyticsMonths.includes(m)) return false;
      }
      if (analyticsSearch.trim()) {
        const q = analyticsSearch.toLowerCase();
        const str = `${r.class || ''} ${r.month || ''} ${r.calendarYear || ''} ${r.year || ''} ${r.academicSession || ''} ${r.session || ''} ${r.date || ''} ${r.generatedDate || ''} ${r.refNo || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [distributions, analyticsSessions, analyticsClasses, analyticsMonths, analyticsSearch]);

  // Comprehensive analytics aggregates
  const analyticsAggregates = useMemo(() => {
    const totalStatements = filteredAnalyticsReports.length;
    let totalBeneficiaryPaid = 0;
    let totalBeneficiaryScience = 0;
    let grandTotalAmount = 0;

    const classDistributionTotals = { '9th': 0, '10th': 0, '11th': 0, '12th': 0 };
    const classStudentTotals = { '9th': 0, '10th': 0, '11th': 0, '12th': 0 };
    const classSciStudentTotals = { '9th': 0, '10th': 0, '11th': 0, '12th': 0 };

    const accountMap = {};
    accounts.forEach(acc => {
      accountMap[acc.key] = {
        key: acc.key,
        name: acc.name,
        accNo: acc.accNo,
        isScienceOnly: acc.isScienceOnly,
        classAmounts: { '9th': 0, '10th': 0, '11th': 0, '12th': 0 },
        totalAmount: 0,
        percentage: 0
      };
    });

    const monthGroupMap = {};

    filteredAnalyticsReports.forEach(r => {
      const cls = r.class || '11th';
      const paid = parseInt(r.paidStudents || r.onRoll || 0, 10) || 0;
      const sci = parseInt(r.scienceStudents || 0, 10) || 0;
      const stmtTotal = parseFloat(r.totalAmount || 0) || 0;
      const mKey = r.month || r.year || 'Other';
      const sKey = r.session || r.academicSession || '2025-26';

      totalBeneficiaryPaid += paid;
      totalBeneficiaryScience += sci;
      grandTotalAmount += stmtTotal;

      if (classDistributionTotals[cls] !== undefined) {
        classDistributionTotals[cls] += stmtTotal;
        classStudentTotals[cls] += paid;
        classSciStudentTotals[cls] += sci;
      }

      const cRates = rates[cls] || rates['11th'] || {};

      accounts.forEach(acc => {
        const rateVal = cRates[acc.key] !== undefined ? cRates[acc.key] : 0;
        const count = acc.isScienceOnly ? sci : paid;
        const amt = (r[acc.key] !== undefined && r[acc.key] !== null)
          ? parseFloat(r[acc.key]) || (rateVal * count)
          : (rateVal * count);

        if (accountMap[acc.key]) {
          if (accountMap[acc.key].classAmounts[cls] !== undefined) {
            accountMap[acc.key].classAmounts[cls] += amt;
          }
          accountMap[acc.key].totalAmount += amt;
        }
      });

      if (!monthGroupMap[mKey]) {
        monthGroupMap[mKey] = {
          month: mKey,
          session: sKey,
          statementCount: 0,
          paidStudents: 0,
          scienceStudents: 0,
          totalAmount: 0,
          classBreakdown: { '9th': 0, '10th': 0, '11th': 0, '12th': 0 },
          accountAmounts: {}
        };
        accounts.forEach(acc => {
          monthGroupMap[mKey].accountAmounts[acc.key] = 0;
        });
      }

      monthGroupMap[mKey].statementCount += 1;
      monthGroupMap[mKey].paidStudents += paid;
      monthGroupMap[mKey].scienceStudents += sci;
      monthGroupMap[mKey].totalAmount += stmtTotal;
      if (monthGroupMap[mKey].classBreakdown[cls] !== undefined) {
        monthGroupMap[mKey].classBreakdown[cls] += stmtTotal;
      }

      accounts.forEach(acc => {
        const rateVal = cRates[acc.key] !== undefined ? cRates[acc.key] : 0;
        const count = acc.isScienceOnly ? sci : paid;
        const amt = (r[acc.key] !== undefined && r[acc.key] !== null)
          ? parseFloat(r[acc.key]) || (rateVal * count)
          : (rateVal * count);
        if (monthGroupMap[mKey].accountAmounts[acc.key] !== undefined) {
          monthGroupMap[mKey].accountAmounts[acc.key] += amt;
        }
      });
    });

    const accountList = Object.values(accountMap).map(acc => {
      const pct = grandTotalAmount > 0 ? (acc.totalAmount / grandTotalAmount) * 100 : 0;
      return { ...acc, percentage: pct };
    });

    const displayedAccounts = analyticsAccounts.length > 0
      ? accountList.filter(acc => analyticsAccounts.includes(acc.key))
      : accountList;

    displayedAccounts.sort((a, b) => {
      if (analyticsSortBy === 'amount-desc') return b.totalAmount - a.totalAmount;
      if (analyticsSortBy === 'amount-asc') return a.totalAmount - b.totalAmount;
      if (analyticsSortBy === 'name-asc') return a.name.localeCompare(b.name);
      return b.totalAmount - a.totalAmount;
    });

    const topAcc = [...accountList].sort((a, b) => b.totalAmount - a.totalAmount)[0] || null;
    const monthList = Object.values(monthGroupMap).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalStatements,
      totalBeneficiaryPaid,
      totalBeneficiaryScience,
      grandTotalAmount,
      classDistributionTotals,
      classStudentTotals,
      classSciStudentTotals,
      accountList: displayedAccounts,
      allAccountsList: accountList,
      topAccount: topAcc,
      monthList
    };
  }, [filteredAnalyticsReports, rates, accounts, analyticsAccounts, analyticsSortBy]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenActionMenuId(null);
    };
    if (openActionMenuId) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [openActionMenuId]);

  // Grouped History by Year & Month with Class-wise Totals
  const groupedHistoryByYear = useMemo(() => {
    const groups = {};
    filteredHistory.forEach(item => {
      const y = item.year || 'General / Undated';
      if (!groups[y]) {
        groups[y] = {
          year: y,
          records: [],
          totalAmount: 0,
          totalStudents: 0,
          classTotals: {}
        };
      }
      groups[y].records.push(item);
      groups[y].totalAmount += (parseFloat(item.totalAmount) || 0);
      groups[y].totalStudents += (parseInt(item.paidStudents || item.onRoll || 0, 10) || 0);

      const cls = item.class || 'Other';
      groups[y].classTotals[cls] = (groups[y].classTotals[cls] || 0) + (parseFloat(item.totalAmount) || 0);
    });
    return Object.values(groups).sort((a, b) => String(b.year).localeCompare(String(a.year)));
  }, [filteredHistory]);

  const toggleYearExpand = (yearKey) => {
    setExpandedYears(prev => ({
      ...prev,
      [yearKey]: prev[yearKey] === false ? true : false
    }));
  };

  // Recent Generations - Filtered for the active / recent session (e.g. 2025-26)
  const recentGenerations = useMemo(() => {
    const activeS = formSession?.trim() || fundSession?.trim() || '2025-26';
    const sessionRecords = distributions.filter(d => {
      const s = d.academicSession || d.session || (d.year && d.year.includes('-') && !d.year.includes('(') ? d.year : '') || d.year || '';
      return s === activeS;
    });
    if (sessionRecords.length > 0) {
      return sessionRecords.slice(0, 6);
    }
    return distributions.slice(0, 6);
  }, [distributions, formSession, fundSession]);

  // Keyboard navigation for preview selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isRatesModalOpen || editReport || deleteTargetReport) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      const isArrowDown = e.key === 'ArrowDown';
      const isArrowUp = e.key === 'ArrowUp';
      const isArrowRight = e.key === 'ArrowRight';
      const isArrowLeft = e.key === 'ArrowLeft';

      if (!isArrowDown && !isArrowUp && !isArrowRight && !isArrowLeft) return;

      e.preventDefault();

      let list = [];
      if (activeTab === 'entry') {
        list = recentGenerations;
      } else if (activeTab === 'history') {
        list = filteredHistory;
      }

      if (!list || list.length === 0) return;

      const currentIndex = previewReport ? list.findIndex(r => r.id === previewReport.id) : -1;
      let nextIndex = 0;

      if (isArrowDown || isArrowRight) {
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % list.length;
      } else if (isArrowUp || isArrowLeft) {
        nextIndex = currentIndex === -1 ? list.length - 1 : (currentIndex - 1 + list.length) % list.length;
      }

      const selectedItem = list[nextIndex];
      if (selectedItem) {
        setPreviewReport(selectedItem);
        setTimeout(() => {
          const el = document.getElementById(`recent-item-${selectedItem.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, previewReport, recentGenerations, distributions, filteredHistory, isRatesModalOpen, editReport, deleteTargetReport]);

  // Live Recalculation for Edit Modal
  const editRecalculatedBreakdown = useMemo(() => {
    if (!editReport) return null;
    return calculateBreakdown(editReport.class, editReport.paidStudents, editReport.scienceStudents, accounts);
  }, [editReport, rates, accounts]);

  // Rate Calculations for Active Class in Rate Settings Modal
  const activeClassRateStats = useMemo(() => {
    const r = tempRates[editingRatesClass] || DEFAULT_RATES[editingRatesClass] || {};
    let nonScienceSum = 0;
    let sciSum = 0;

    tempAccounts.forEach(acc => {
      const val = parseInt(r[acc.key], 10) || 0;
      if (acc.isScienceOnly) {
        sciSum += val;
      } else {
        nonScienceSum += val;
      }
    });

    return {
      baseGeneral: nonScienceSum,
      scienceFund: sciSum,
      totalScience: nonScienceSum + sciSum,
      headsCount: tempAccounts.length
    };
  }, [tempRates, editingRatesClass, tempAccounts]);

  return (
    <div className="space-y-3 animate-fadeIn pb-6">
      {/* Status Notification Toast */}
      {statusMessage.text && (
        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-black shadow-sm ${
          statusMessage.type === 'error'
            ? 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800'
            : 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800'
        }`}>
          <div className="flex items-center gap-1.5">
            {statusMessage.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage({ text: '', type: '' })} className="cursor-pointer opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ─────────────────── SHARED TAB NAVIGATION BAR (always visible) ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 shadow-2xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('entry')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'entry'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText size={13} />
            <span>Report Entry</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderArchive size={13} />
            <span>History ({distributions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 size={13} />
            <span>Analytics & Ledger Matrix</span>
            {filteredAnalyticsReports.length > 0 && (
              <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ml-0.5 ${
                activeTab === 'analytics' ? 'bg-blue-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {filteredAnalyticsReports.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Fund Distribution Local Academic Session Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[9px] font-black uppercase text-slate-400">Session:</span>
            <select
              value={fundSession}
              onChange={(e) => {
                const val = e.target.value;
                setFundSession(val);
                setFormSession(val);
                showNotification(`Fund Distribution session set to ${val}`, 'success');
              }}
              title="Academic Session for Fund Distribution letters & statements"
              className="bg-transparent text-xs font-black text-blue-600 dark:text-blue-400 outline-none cursor-pointer"
            >
              {availableSessions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setTempRates(rates);
              setEditingRatesClass(formClass);
              setIsRatesModalOpen(true);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-blue-200/60"
            title="Configure Institutional Fee Rates & Accounts (Settings)"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ─────────────────── TAB 1: REPORT ENTRY & GENERATOR ─────────────────── */}
      {activeTab === 'entry' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Left Column: Combined Entry Form & Recent Generations with Integrated Header */}
          <div className="lg:col-span-6 xl:col-span-7">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs space-y-3">
              {/* Card Section Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-600" />
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">New Fund Distribution Statement</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsModalTab('rolls');
                      setIsRatesModalOpen(true);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 text-[10px] font-black flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                    title="View and edit live database approved roll numbers & stream figures in Settings"
                  >
                    <Users size={11} className="text-blue-600" />
                    <span>DB Rolls ({activeStudentStats[formClass]?.total || 0} in {formClass})</span>
                  </button>
                  <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">
                    Class & Month Generator
                  </span>
                </div>
              </div>

              {/* ─── LIVE FEE RECONCILIATION PROGRESS FOR ACTIVE CLASS (Compact Micro-Bar) ─── */}
              {(() => {
                const prog = feeDistributionProgress[formClass] || {
                  approvedTotal: 0,
                  approvedSci: 0,
                  distributedTotal: 0,
                  distributedSci: 0,
                  remainingTotal: 0,
                  remainingSci: 0,
                  percent: 0
                };
                const is11or12 = formClass === '11th' || formClass === '12th';
                const isFullyPaid = prog.remainingTotal === 0 && prog.approvedTotal > 0;

                return (
                  <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                    {/* Left: Class Badge & Inline Micro Stats */}
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-black text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isFullyPaid ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`} />
                        <span>Class {formClass}:</span>
                      </span>

                      {/* 3 Inline Micro Badges */}
                      <div className="flex items-center gap-1 font-mono text-[9.5px]">
                        <span className="px-1.5 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold" title="Approved on Roll">
                          Roll: <strong className="text-slate-900 dark:text-white">{prog.approvedTotal}</strong>{is11or12 && ` (Sci:${prog.approvedSci})`}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-blue-700 dark:text-blue-300 font-bold" title="Previously Distributed">
                          Paid: <strong>{prog.distributedTotal}</strong>{is11or12 && ` (Sci:${prog.distributedSci})`}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded border font-bold ${
                          isFullyPaid
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`} title={isFullyPaid ? 'Fully Disbursed' : 'Remaining to Disburse'}>
                          {isFullyPaid ? '✓ 100% Disbursed' : `Left: ${prog.remainingTotal}${is11or12 ? ` (Sci:${prog.remainingSci})` : ''}`}
                        </span>
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApplyDbStats(formClass, prog.remainingTotal, is11or12 ? prog.remainingSci : prog.remainingTotal)}
                        disabled={isFullyPaid}
                        className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] flex items-center gap-0.5 cursor-pointer shadow-2xs transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={`Populate remaining ${prog.remainingTotal} students`}
                      >
                        <Sparkles size={9} />
                        <span>Fill Left ({prog.remainingTotal})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyDbStats(formClass, prog.approvedTotal, is11or12 ? prog.approvedSci : prog.approvedTotal)}
                        className="px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] flex items-center gap-0.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                        title={`Populate all ${prog.approvedTotal} approved students`}
                      >
                        <span>Fill Total ({prog.approvedTotal})</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Entry Form */}
              <form onSubmit={handleGenerateReport} className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  {/* 1. DATE Input */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                      <Calendar size={10} /> DATE
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  {/* 2. ACADEMIC SESSION Input / Selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                      <CalendarDays size={10} /> SESSION
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2025-26"
                      value={formSession}
                      onChange={(e) => setFormSession(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-blue-600 dark:text-blue-400 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  {/* 3. CLASS Selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                      <Layers size={10} /> CLASS
                    </label>
                    <select
                      value={formClass}
                      onChange={(e) => handleClassChange(e.target.value)}
                      className="w-full px-1.5 py-1.5 rounded-lg text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="9th">9th</option>
                      <option value="10th">10th</option>
                      <option value="11th">11th</option>
                      <option value="12th">12th</option>
                    </select>
                  </div>

                  {/* 4. STUDENTS (PAID) Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <Users size={10} /> PAID STD
                      </label>
                      <span className="text-[8px] font-bold text-slate-400">Total Fee</span>
                    </div>
                    <input
                      type="number"
                      placeholder="e.g. 18"
                      value={formPaidCount}
                      onChange={(e) => handlePaidCountChange(e.target.value)}
                      min="1"
                      className="w-full px-2 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  {/* 5. SCIENCE (opt) Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <FlaskConical size={10} /> SCI (OPT)
                      </label>
                      {(formClass === '9th' || formClass === '10th') ? (
                        <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 rounded">
                          Auto: All Std
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold text-purple-600 dark:text-purple-400">
                          Sci Stream
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder={formClass === '9th' || formClass === '10th' ? (formPaidCount || 'e.g. 18') : 'e.g. 7'}
                      value={formScienceCount}
                      onChange={(e) => setFormScienceCount(e.target.value)}
                      min="0"
                      className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold border ${
                        formClass === '9th' || formClass === '10th'
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'
                      } text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none`}
                    />
                  </div>
                </div>

                {/* Real-Time Statement Bank Label Preview */}
                <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold min-w-0">
                    <Calendar size={13} className="text-blue-600 flex-shrink-0" />
                    <span className="text-slate-500">Bank Letter Heading:</span>
                    <span className="font-mono font-black text-blue-700 dark:text-blue-300 truncate">
                      {MONTH_NAMES[new Date(formDate || Date.now()).getMonth()]} {new Date(formDate || Date.now()).getFullYear()} (Academic Session: {formSession || '2025-26'})
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold hidden sm:inline flex-shrink-0 ml-2">
                    Applies only in Funds Distribution
                  </span>
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-0.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-1 shadow-sm shadow-blue-500/20 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <>
                      <span>Generate Report Statement</span>
                      <ChevronRight size={13} />
                    </>
                  )}
                </button>
              </form>

              {/* Seamless Divider for Recent Generations */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      RECENT GENERATIONS
                    </h4>
                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200/60 dark:border-blue-800/60">
                      Session: {formSession || fundSession || '2025-26'}
                    </span>
                  </div>
                  <span className="text-[8.5px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    Quick Preview: ↑ ↓ / ← →
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[195px] overflow-y-auto pr-1 scrollbar-thin">
                  {recentGenerations.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 font-bold text-xs">
                      No recent generations found. Generate a new report above!
                    </div>
                  ) : (
                  recentGenerations.map((item) => (
                    <div
                      key={item.id}
                      id={`recent-item-${item.id}`}
                      className={`bg-slate-50/80 dark:bg-slate-950/80 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 shadow-2xs hover:shadow-sm cursor-pointer ${
                        previewReport?.id === item.id
                          ? 'border-blue-500 ring-2 ring-blue-500/15 bg-blue-50/40 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                      onClick={() => setPreviewReport(item)}
                    >
                      {/* Top / Main Line: Badge + Title + Mobile Amount */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100/80 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center text-center flex-shrink-0">
                            <span className="text-[9.5px] sm:text-[10px] font-black text-blue-700 dark:text-blue-300 leading-none">
                              {item.class}
                            </span>
                            <span className="text-[7px] sm:text-[7.5px] font-black text-blue-500 uppercase tracking-tight mt-0.5 leading-none">
                              {String(item.month || '').slice(0, 3)}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="font-extrabold text-[11px] text-slate-900 dark:text-white truncate">
                              Class {item.class} • {getReportPeriodDescription(item)}
                            </div>
                            <p className="text-[8.5px] sm:text-[9px] text-slate-400 font-bold sm:hidden">
                              {item.generatedDate || item.date || item.month}
                            </p>
                          </div>
                        </div>

                        {/* Amount on mobile top right */}
                        <span className="font-mono font-black text-xs sm:text-[11.5px] text-blue-600 dark:text-blue-400 sm:hidden">
                          {formatCurrency(item.totalAmount)}
                        </span>
                      </div>

                      {/* Bottom Line on Mobile / Right Line on Desktop: Badges + Amount + Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 dark:border-slate-800/50" onClick={(e) => e.stopPropagation()}>
                        {/* Student Badges */}
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono text-[8px] font-black">
                            P:{item.paidStudents || item.onRoll}
                          </span>
                          {parseInt(item.scienceStudents, 10) > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-mono text-[8px] font-black">
                              S:{item.scienceStudents}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 font-bold hidden sm:inline ml-1">
                            • {item.generatedDate || item.date || item.month}
                          </span>
                        </div>

                        {/* Desktop Amount & Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-[11.5px] text-blue-600 dark:text-blue-400 hidden sm:inline mr-1">
                            {formatCurrency(item.totalAmount)}
                          </span>

                          <div className="flex items-center gap-1">
                            {/* Preview */}
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewReport(item);
                                setActiveTab('entry');
                              }}
                              title="Preview Breakdown"
                              className="w-6 h-6 rounded-md flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                            >
                              <Eye size={12} />
                            </button>

                            {/* Download (Format Choice Modal) */}
                            <button
                              type="button"
                              onClick={() => setFormatModal({ targetType: 'single', data: item })}
                              title="Download Statement (PDF / Excel)"
                              className="w-6 h-6 rounded-md flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                            >
                              <Download size={12} />
                            </button>

                            {/* More Options (Edit & Delete) */}
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={() => setOpenActionMenuId(prev => prev === `recent-${item.id}` ? null : `recent-${item.id}`)}
                                title="More Options (Edit, Delete)"
                                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                  openActionMenuId === `recent-${item.id}`
                                    ? 'bg-slate-700 text-white shadow-xs'
                                    : 'text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <MoreVertical size={12} />
                              </button>

                              {openActionMenuId === `recent-${item.id}` && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-1 z-50 animate-fadeIn text-left">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditReport(item);
                                      setOpenActionMenuId(null);
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Edit2 size={12} className="text-amber-600 flex-shrink-0" />
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteTargetReport(item);
                                      setOpenActionMenuId(null);
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={12} className="text-rose-600 flex-shrink-0" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Naturally Compact Live Report Preview Card */}
          <div className="lg:col-span-6 xl:col-span-5 lg:sticky lg:top-[76px]">
            <ReportPreviewCard
              report={previewReport}
              rates={rates}
              accounts={accounts}
              onDownload={(r) => setFormatModal({ targetType: 'single', data: r })}
              onPrint={(r) => printFundDistributionLetter(r, rates, accounts)}
              onClose={() => setPreviewReport(null)}
            />
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 2: AUDIT STATEMENT HISTORY & RECONCILIATION ─────────────────── */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Left Column: History Controls & Scrollable Grouped Tables */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-2.5 flex flex-col">
            {/* History Controls Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex-shrink-0">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search by Class, Month, Year..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                {/* Class Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  {['All', '9th', '10th', '11th', '12th'].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setHistoryClassFilter(cls)}
                      className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        historyClassFilter === cls
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedReportIds.size === filteredHistory.length) {
                      setSelectedReportIds(new Set());
                    } else {
                      setSelectedReportIds(new Set(filteredHistory.map(r => r.id)));
                    }
                  }}
                  className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 transition-colors cursor-pointer border border-blue-200/60 dark:border-blue-800/60"
                >
                  {selectedReportIds.size === filteredHistory.length && filteredHistory.length > 0 ? 'Deselect All' : 'Select All'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTempRates(rates);
                    setEditingRatesClass(formClass);
                    setIsRatesModalOpen(true);
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-blue-200/60"
                  title="Configure Institutional Fee Rates (Settings)"
                >
                  <Settings size={15} />
                </button>
              </div>
            </div>

            {/* Scrollable Grouped Years Feed */}
            <div className="max-h-[calc(100vh-210px)] overflow-y-auto pr-1 space-y-3 scrollbar-thin relative rounded-2xl">
              {groupedHistoryByYear.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 font-bold text-xs">
                  No distribution statements found matching current filters.
                </div>
              ) : (
                groupedHistoryByYear.map((group) => {
                  const isCollapsed = expandedYears[group.year] === false;
                  const allGroupSelected = group.records.length > 0 && group.records.every(r => selectedReportIds.has(r.id));

                  return (
                    <div key={group.year} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                      {/* Group Header Banner */}
                      <div 
                        onClick={() => toggleYearExpand(group.year)}
                        className="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <button type="button" className="p-1 rounded-md text-slate-400 hover:text-slate-600">
                            {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              Session {group.year}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              ({group.records.length} {group.records.length === 1 ? 'Report' : 'Reports'})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectAll(group.records);
                            }}
                            className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border transition-colors ${
                              allGroupSelected 
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {allGroupSelected ? '✓ Selected' : 'Select Session'}
                          </button>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
                            Students: <b className="font-mono text-slate-800 dark:text-slate-200">{group.totalStudents}</b>
                          </span>
                          <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-800/60">
                            {formatCurrency(group.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Group Table */}
                      {!isCollapsed && (
                        <div>
                          {/* Class-wise Totals Breakdown Bar */}
                          <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">Class Totals:</span>
                            {['9th', '10th', '11th', '12th'].map(clsKey => {
                              const cData = group.classTotals[clsKey];
                              if (!cData) return null;
                              return (
                                <div key={clsKey} className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                  <span className="font-black text-blue-600 dark:text-blue-400 text-[10.5px]">{clsKey}:</span>
                                  <span className="font-mono font-black text-slate-900 dark:text-white text-[10.5px]">{formatCurrency(cData.amount)}</span>
                                  <span className="text-[9px] font-bold text-slate-400">({cData.count} std)</span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-bold border-collapse">
                              <thead className="bg-slate-50/50 dark:bg-slate-950/40 text-slate-400 font-black uppercase text-[9px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                  <th className="p-2.5 w-8 text-center">
                                    <input
                                      type="checkbox"
                                      checked={group.records.length > 0 && group.records.every(r => selectedReportIds.has(r.id))}
                                      onChange={() => toggleSelectAll(group.records)}
                                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                                      title="Select / Deselect all in this session"
                                    />
                                  </th>
                                  <th className="p-2.5">CLASS</th>
                                  <th className="p-2.5">STATEMENT PERIOD / SESSION</th>
                                  <th className="p-2.5 text-center">STUDENTS</th>
                                  <th className="p-2.5 text-right">TOTAL AMOUNT</th>
                                  <th className="p-2.5">DATE</th>
                                  <th className="p-2.5 text-center">ACTIONS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                                {group.records.map((item) => (
                                  <tr
                                    key={item.id}
                                    className={`hover:bg-slate-50 dark:hover:bg-slate-950/60 transition-colors cursor-pointer ${
                                      previewReport?.id === item.id 
                                        ? 'bg-blue-50/80 dark:bg-blue-950/60 ring-1 ring-blue-500/40 font-black'
                                        : selectedReportIds.has(item.id) 
                                        ? 'bg-blue-50/40 dark:bg-blue-950/30' 
                                        : ''
                                    }`}
                                    onClick={() => setPreviewReport(item)}
                                  >
                                    <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={selectedReportIds.has(item.id)}
                                        onChange={() => toggleSelectReport(item.id)}
                                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                                      />
                                    </td>
                                    <td className="p-2.5 font-black text-slate-900 dark:text-white">
                                      {item.class}
                                    </td>
                                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                                      {getReportPeriodDescription(item)}
                                    </td>
                                    <td className="p-2.5 text-center">
                                      <span className="font-mono text-[9.5px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        P:{item.paidStudents || item.onRoll} {parseInt(item.scienceStudents, 10) > 0 ? `S:${item.scienceStudents}` : ''}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                                      {formatCurrency(item.totalAmount)}
                                    </td>
                                    <td className="p-2.5 text-slate-400 font-mono text-[10px]">
                                      {item.generatedDate || item.date || item.month || 'N/A'}
                                    </td>
                                    <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        {/* Preview — updates right side preview pane immediately */}
                                        <button
                                          type="button"
                                          onClick={() => setPreviewReport(item)}
                                          title="Preview Breakdown"
                                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
                                        >
                                          <Eye size={13} />
                                        </button>

                                        {/* Download */}
                                        <button
                                          type="button"
                                          onClick={() => setFormatModal({ targetType: 'single', data: item })}
                                          title="Download Statement (PDF / Excel)"
                                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
                                        >
                                          <Download size={13} />
                                        </button>

                                        {/* More Options Menu (Edit & Delete) */}
                                        <div className="relative inline-block text-left">
                                          <button
                                            type="button"
                                            onClick={() => setOpenActionMenuId(prev => prev === `history-${item.id}` ? null : `history-${item.id}`)}
                                            title="More Options (Edit, Delete)"
                                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                              openActionMenuId === `history-${item.id}`
                                                ? 'bg-slate-700 text-white shadow-xs'
                                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                          >
                                            <MoreVertical size={13} />
                                          </button>

                                          {openActionMenuId === `history-${item.id}` && (
                                            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-1 z-50 animate-fadeIn text-left">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditReport(item);
                                                  setOpenActionMenuId(null);
                                                }}
                                                className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2 transition-colors cursor-pointer"
                                              >
                                                <Edit2 size={12} className="text-amber-600 flex-shrink-0" />
                                                <span>Edit</span>
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setDeleteTargetReport(item);
                                                  setOpenActionMenuId(null);
                                                }}
                                                className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2 transition-colors cursor-pointer"
                                              >
                                                <Trash2 size={12} className="text-rose-600 flex-shrink-0" />
                                                <span>Delete</span>
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-slate-50 dark:bg-slate-950/80 font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 text-[10px]">
                                <tr>
                                  <td colSpan="3" className="p-2.5 uppercase tracking-wider text-slate-500">
                                    Session {group.year} Summary
                                  </td>
                                  <td className="p-2.5 text-center font-mono font-black">
                                    {group.totalStudents} Students
                                  </td>
                                  <td className="p-2.5 text-right font-mono font-black text-blue-600 dark:text-blue-400 text-xs">
                                    {formatCurrency(group.totalAmount)}
                                  </td>
                                  <td colSpan="2" className="p-2.5 text-slate-400 text-[9px] text-right font-normal">
                                    {group.records.length} Statements Reconciled
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Sticky Multi-Select Consolidated Floating Toolbar */}
              {selectedReportIds.size > 0 && (
                <div className="sticky bottom-2 z-40 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center">
                      {selectedReportIds.size}
                    </span>
                    <span className="text-xs font-black">
                      Selected ({formatCurrency(selectedReportsList.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0))})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setFormatModal({ targetType: 'consolidated', data: selectedReportsList })}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer active:scale-98"
                      title="Download Consolidated Statement (PDF or Excel)"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => printConsolidatedFundDistributionLetter(selectedReportsList, rates, accounts)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                      title="Print Consolidated Letter"
                    >
                      <Printer size={12} />
                      <span>Print</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedReportIds(new Set())}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-[11px] cursor-pointer ml-1"
                      title="Clear Selection"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Naturally Compact Live Report Preview Card */}
          <div className="lg:col-span-6 xl:col-span-5">
            <ReportPreviewCard
              report={previewReport}
              rates={rates}
              accounts={accounts}
              onDownload={(r) => setFormatModal({ targetType: 'single', data: r })}
              onPrint={(r) => printFundDistributionLetter(r, rates, accounts)}
              onClose={() => setPreviewReport(null)}
            />
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 3: TRANSACTION AUDIT & LEDGER MATRIX ─────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-2 animate-fadeIn">
          {/* 1. Ultra-Compact Multi-Dimensional Filter Suite & Export Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-2">
            {/* Filter Header & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  <Filter size={12} />
                </div>
                <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Transaction Audit & Ledger Filter
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold">
                  {filteredAnalyticsReports.length} of {distributions.length} Statements Included
                </span>
              </div>

              {/* Action Buttons: Excel, PDF, Print */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={filteredAnalyticsReports.length === 0 || Boolean(isProcessingAnalytics)}
                  onClick={async () => {
                    setIsProcessingAnalytics('excel');
                    try {
                      exportTransactionAnalysisToExcel(filteredAnalyticsReports, {
                        sessions: analyticsSessions,
                        classes: analyticsClasses,
                        months: analyticsMonths
                      }, rates, accounts);
                      showNotification('Analysis Excel workbook downloaded successfully!', 'success');
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsProcessingAnalytics(null);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                  title="Export Full 3-Sheet Matrix & Log to Excel (.xlsx)"
                >
                  {isProcessingAnalytics === 'excel' ? (
                    <RefreshCw size={11} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={11} />
                  )}
                  <span>Excel</span>
                </button>

                <button
                  type="button"
                  disabled={filteredAnalyticsReports.length === 0 || Boolean(isProcessingAnalytics)}
                  onClick={async () => {
                    setIsProcessingAnalytics('pdf');
                    try {
                      await downloadTransactionAnalysisPdf(filteredAnalyticsReports, {
                        sessions: analyticsSessions,
                        classes: analyticsClasses,
                        months: analyticsMonths
                      }, rates, accounts);
                      showNotification('Audit PDF report downloaded successfully!', 'success');
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsProcessingAnalytics(null);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[10.5px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                  title="Download Official Audit Report on Letterhead (PDF)"
                >
                  {isProcessingAnalytics === 'pdf' ? (
                    <RefreshCw size={11} className="animate-spin" />
                  ) : (
                    <FileText size={11} />
                  )}
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  disabled={filteredAnalyticsReports.length === 0 || Boolean(isProcessingAnalytics)}
                  onClick={() => {
                    printTransactionAnalysisLetter(filteredAnalyticsReports, {
                      sessions: analyticsSessions,
                      classes: analyticsClasses,
                      months: analyticsMonths
                    }, rates, accounts);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black text-[10.5px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                  title="Print Official Analysis Letter"
                >
                  <Printer size={11} />
                  <span>Print</span>
                </button>

                {(analyticsSessions.length > 0 || analyticsClasses.length > 0 || analyticsMonths.length > 0 || analyticsAccounts.length > 0 || analyticsSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAnalyticsSessions([]);
                      setAnalyticsClasses([]);
                      setAnalyticsMonths([]);
                      setAnalyticsAccounts([]);
                      setAnalyticsSearch('');
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Clear All Filters"
                  >
                    <RotateCcw size={11} />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Controls Row — All 4 Filters in One Clean Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {/* 1. Academic Sessions Filter Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Academic Sessions</span>
                  {analyticsSessions.length > 0 && (
                    <span className="text-[8.5px] text-blue-600 dark:text-blue-400 font-bold">
                      {analyticsSessions.length} Sel
                    </span>
                  )}
                </label>
                <select
                  value={analyticsSessions.length === 1 ? analyticsSessions[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) setAnalyticsSessions([]);
                    else setAnalyticsSessions([val]);
                  }}
                  className="w-full px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Sessions ({availableSessions.length})</option>
                  {availableSessions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* 2. Classes Filter Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Classes</span>
                  {analyticsClasses.length > 0 && (
                    <span className="text-[8.5px] text-blue-600 dark:text-blue-400 font-bold">
                      {analyticsClasses.length} Sel
                    </span>
                  )}
                </label>
                <select
                  value={analyticsClasses.length === 1 ? analyticsClasses[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) setAnalyticsClasses([]);
                    else setAnalyticsClasses([val]);
                  }}
                  className="w-full px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Classes</option>
                  {availableClasses.map(c => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
              </div>

              {/* 3. Months / Period Filter Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Period / Month</span>
                  {analyticsMonths.length > 0 && (
                    <span className="text-[8.5px] text-blue-600 dark:text-blue-400 font-bold">
                      {analyticsMonths.length} Sel
                    </span>
                  )}
                </label>
                <select
                  value={analyticsMonths.length === 1 ? analyticsMonths[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) setAnalyticsMonths([]);
                    else setAnalyticsMonths([val]);
                  }}
                  className="w-full px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Periods ({availableMonths.length})</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 4. Subsidiary Accounts Filter Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Subsidiary Fund Account</span>
                  {analyticsAccounts.length > 0 && (
                    <span className="text-[8.5px] text-blue-600 dark:text-blue-400 font-bold">
                      {analyticsAccounts.length} Filtered
                    </span>
                  )}
                </label>
                <select
                  value={analyticsAccounts.length === 1 ? analyticsAccounts[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) setAnalyticsAccounts([]);
                    else setAnalyticsAccounts([val]);
                  }}
                  className="w-full px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Institutional Accounts ({accounts.length})</option>
                  {accounts.map(a => (
                    <option key={a.key} value={a.key}>{a.name} ({a.accNo ? a.accNo.slice(-6) : 'N/A'})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Compact Executive KPI Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Card 1: Total Disbursed */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl px-3 py-1.5 text-white shadow-2xs flex items-center justify-between gap-2">
              <div>
                <div className="text-[8.5px] font-black uppercase tracking-wider text-blue-200 flex items-center gap-1">
                  <Wallet size={11} /> TOTAL DISBURSED
                </div>
                <div className="text-sm sm:text-base font-black font-mono tracking-tight leading-tight">
                  {formatCurrency(analyticsAggregates.grandTotalAmount)}
                </div>
              </div>
              <span className="text-[9px] text-blue-100 font-semibold bg-white/10 px-1.5 py-0.5 rounded">
                {analyticsAggregates.totalStatements} batches
              </span>
            </div>

            {/* Card 2: Beneficiary Students */}
            <div className="bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-2">
              <div>
                <div className="text-[8.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Users size={11} /> BENEFICIARIES
                </div>
                <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white leading-tight">
                  {analyticsAggregates.totalBeneficiaryPaid.toLocaleString()}
                </div>
              </div>
              <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-900/40">
                {analyticsAggregates.totalBeneficiaryScience.toLocaleString()} Sci
              </span>
            </div>

            {/* Card 3: Class Breakdown Pills */}
            <div className="bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-center gap-0.5">
              <div className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Layers size={11} /> CLASS-WISE SHARE
              </div>
              <div className="flex items-center justify-between gap-1 text-[10px] font-black font-mono text-slate-700 dark:text-slate-300">
                <span>9th: {formatCurrency(analyticsAggregates.classDistributionTotals['9th'])}</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span>10th: {formatCurrency(analyticsAggregates.classDistributionTotals['10th'])}</span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[10px] font-black font-mono text-slate-700 dark:text-slate-300">
                <span>11th: {formatCurrency(analyticsAggregates.classDistributionTotals['11th'])}</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span>12th: {formatCurrency(analyticsAggregates.classDistributionTotals['12th'])}</span>
              </div>
            </div>

            {/* Card 4: Top Benefited Account */}
            <div className="bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[8.5px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <TrendingUp size={11} /> TOP FUND
                </div>
                <div className="text-[11px] font-black text-slate-900 dark:text-white truncate leading-tight" title={analyticsAggregates.topAccount?.name || 'N/A'}>
                  {analyticsAggregates.topAccount?.name || '—'}
                </div>
              </div>
              <span className="text-[10px] font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-900/40 flex-shrink-0">
                {formatCurrency(analyticsAggregates.topAccount?.totalAmount)} ({analyticsAggregates.topAccount?.percentage?.toFixed(1) || 0}%)
              </span>
            </div>
          </div>

          {/* 3. Compact Perspective Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              {[
                { id: 'account', label: 'Subsidiary Matrix', icon: Building2 },
                { id: 'month', label: 'By Year & Month', icon: CalendarDays },
                { id: 'class', label: 'By Class', icon: Layers },
                { id: 'statement', label: 'Statements Log', icon: FileText }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAnalyticsPerspective(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                      analyticsPerspective === tab.id
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 pr-1">
              <span>Sort:</span>
              <select
                value={analyticsSortBy}
                onChange={(e) => setAnalyticsSortBy(e.target.value)}
                className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
                <option value="name-asc">A → Z Name</option>
              </select>
            </div>
          </div>

          {/* 4. Perspective 1: SUBSIDIARY ACCOUNT ALLOCATION MATRIX (Default & Main) */}
          {analyticsPerspective === 'account' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden animate-fadeIn">
              <div className="bg-slate-50 dark:bg-slate-950/80 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 size={13} className="text-blue-600" />
                  <span>Subsidiary Fund Account Ledger Matrix</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Debit A/c: {CENTRAL_ACCOUNT_NO}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[9.5px] uppercase border-b border-slate-200 dark:border-slate-700">
                      <th className="py-1.5 px-2.5 text-center w-8">#</th>
                      <th className="py-1.5 px-2.5">Subsidiary Fund Account</th>
                      <th className="py-1.5 px-2.5 text-center font-mono">Beneficiary A/c No.</th>
                      <th className="py-1.5 px-2.5 text-right font-mono">9th Class</th>
                      <th className="py-1.5 px-2.5 text-right font-mono">10th Class</th>
                      <th className="py-1.5 px-2.5 text-right font-mono">11th Class</th>
                      <th className="py-1.5 px-2.5 text-right font-mono">12th Class</th>
                      <th className="py-1.5 px-2.5 text-right font-mono">Total Sent (₹)</th>
                      <th className="py-1.5 px-2.5 text-center w-24">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold text-[11px]">
                    {analyticsAggregates.accountList.map((acc, idx) => (
                      <tr
                        key={acc.key}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{acc.name}</span>
                            {acc.isScienceOnly && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                Sci Only
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-mono text-[10.5px] font-black text-blue-700 dark:text-blue-400">
                          {acc.accNo}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(acc.classAmounts['9th'])}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(acc.classAmounts['10th'])}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(acc.classAmounts['11th'])}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(acc.classAmounts['12th'])}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-black text-slate-900 dark:text-white text-xs">
                          {formatCurrency(acc.totalAmount)}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[9.5px] font-mono font-bold text-slate-500">
                              <span>{acc.percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 dark:bg-blue-400 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(2, acc.percentage))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Grand Total Footer Row */}
                    <tr className="bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-[11px] border-t-2 border-slate-300 dark:border-slate-700">
                      <td colSpan={3} className="py-2 px-2.5 text-right uppercase tracking-wider text-[10px]">
                        GRAND TOTAL ALLOCATION:
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {formatCurrency(analyticsAggregates.classDistributionTotals['9th'])}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {formatCurrency(analyticsAggregates.classDistributionTotals['10th'])}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {formatCurrency(analyticsAggregates.classDistributionTotals['11th'])}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {formatCurrency(analyticsAggregates.classDistributionTotals['12th'])}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-xs text-blue-700 dark:text-blue-400 font-black">
                        {formatCurrency(analyticsAggregates.grandTotalAmount)}
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono">
                        100%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Perspective 2: YEAR & MONTHLY BREAKDOWN */}
          {analyticsPerspective === 'month' && (
            <div className="space-y-3 animate-fadeIn">
              {analyticsAggregates.monthList.map(mGroup => (
                <div
                  key={mGroup.month}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-black text-xs">
                        <CalendarDays size={15} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          {mGroup.month} ({mGroup.session})
                        </h4>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {mGroup.statementCount} Statements • {mGroup.paidStudents} Paid Students ({mGroup.scienceStudents} Sci)
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-slate-400">Monthly Total</span>
                      <div className="text-sm font-black font-mono text-blue-600 dark:text-blue-400">
                        {formatCurrency(mGroup.totalAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Class Subtotals Chips */}
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    {['9th', '10th', '11th', '12th'].map(cls => {
                      const amt = mGroup.classBreakdown[cls] || 0;
                      if (amt === 0) return null;
                      return (
                        <div key={cls} className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                          <span className="text-slate-400 font-black">Class {cls}:</span>
                          <span className="font-mono font-black text-slate-800 dark:text-slate-200">{formatCurrency(amt)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 6. Perspective 3: CLASS-WISE COMPARISON */}
          {analyticsPerspective === 'class' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-fadeIn">
              {['9th', '10th', '11th', '12th'].map(cls => {
                const totalAmt = analyticsAggregates.classDistributionTotals[cls] || 0;
                const paidCount = analyticsAggregates.classStudentTotals[cls] || 0;
                const sciCount = analyticsAggregates.classSciStudentTotals[cls] || 0;
                const pct = analyticsAggregates.grandTotalAmount > 0 ? (totalAmt / analyticsAggregates.grandTotalAmount) * 100 : 0;
                const cRate = rates[cls] || rates['11th'] || {};

                return (
                  <div
                    key={cls}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-black text-xs">
                            {cls}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              Class {cls}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {paidCount} Paid Students
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {pct.toFixed(1)}%
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">Total Funds Disbursed</span>
                        <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                          {formatCurrency(totalAmt)}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-1">
                        <div className="flex justify-between">
                          <span>Science Opted:</span>
                          <span className="font-mono font-black text-purple-600 dark:text-purple-400">{sciCount} Students</span>
                        </div>
                        <div className="flex justify-between">
                          <span>School Improv Rate:</span>
                          <span className="font-mono font-bold">₹{cRate.schoolImprov || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Computer Fund Rate:</span>
                          <span className="font-mono font-bold">₹{cRate.computerFund || 0}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAnalyticsClasses([cls]);
                        setAnalyticsPerspective('account');
                      }}
                      className="w-full mt-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-black text-[10.5px] transition-colors cursor-pointer text-center"
                    >
                      Filter Account Matrix by Class {cls} &rarr;
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 7. Perspective 4: ALL FILTERED STATEMENTS LOG */}
          {analyticsPerspective === 'statement' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden animate-fadeIn">
              <div className="bg-slate-50 dark:bg-slate-950/80 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <FileText size={14} className="text-blue-600" />
                  <span>Statement Transaction Records ({filteredAnalyticsReports.length})</span>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10.5px] uppercase border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Class</th>
                      <th className="py-2.5 px-3">Period / Session</th>
                      <th className="py-2.5 px-3 text-center">Paid Std</th>
                      <th className="py-2.5 px-3 text-center">Sci Std</th>
                      <th className="py-2.5 px-3 text-right font-mono">Amount (₹)</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    {filteredAnalyticsReports.map((r, idx) => (
                      <tr
                        key={r.id}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                          {r.generatedDate || r.date || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            Class {r.class}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-800 dark:text-slate-200">
                          {getReportPeriodDescription(r)}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">
                          {r.paidStudents || r.onRoll || 0}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-purple-600 dark:text-purple-400">
                          {r.scienceStudents || 0}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                          {formatCurrency(r.totalAmount)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => printFundDistributionLetter(r, rates, accounts)}
                              className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                              title="Print Statement Letter"
                            >
                              <Printer size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormatModal({ targetType: 'single', data: r })}
                              className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Download PDF or Excel"
                            >
                              <Download size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── INSTITUTIONAL FEE RATES & SUBSIDIARY ACCOUNTS MODAL ─────────────────── */}
      {isRatesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-5 space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header with Top Navigation Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  {settingsModalTab === 'rolls' ? <Users size={17} /> : <SlidersHorizontal size={17} />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>{settingsModalTab === 'rolls' ? 'Database Roll Numbers & Enrollment' : 'Institutional Accounts & Fee Rates'}</span>
                    <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold normal-case">
                      {settingsModalTab === 'rolls' ? `${dbStudentStats['9th'].total + dbStudentStats['10th'].total + dbStudentStats['11th'].total + dbStudentStats['12th'].total} Enrolled` : `${tempAccounts.length} Active Heads`}
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-400 font-bold">
                    {settingsModalTab === 'rolls' 
                      ? `Session ${fundSession || formSession || '2025-26'} verified approved rolls across classes & streams`
                      : 'Configure per-student institutional fee heads and rates across classes'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {/* Modal Sub-Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSettingsModalTab('rates')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                      settingsModalTab === 'rates'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <SlidersHorizontal size={12} />
                    <span>Fee Rates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsModalTab('rolls')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                      settingsModalTab === 'rolls'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Users size={12} />
                    <span>Roll Numbers</span>
                  </button>
                </div>

                <button 
                  type="button" 
                  onClick={() => {
                    setIsRatesModalOpen(false);
                    setIsAddingAccount(false);
                  }} 
                  disabled={isSavingRates}
                  className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* TAB 1: APPROVED ROLL NUMBERS & ENROLLMENT BREAKDOWN (DIRECTLY EDITABLE) */}
            {settingsModalTab === 'rolls' && (
              <div className="overflow-y-auto flex-1 pr-1 space-y-3.5 text-xs scrollbar-thin">
                {/* Session Header Bar */}
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <Users size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>Approved Roll Records & Figures</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-[10px] font-mono">
                          Session: {fundSession || formSession || '2025-26'}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                        Editable figures for total & streams. Update values directly to account for offline receipts.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <span className="text-[9.5px] font-bold text-slate-400">Total Enrolled:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 font-mono font-black text-blue-700 dark:text-blue-300 text-xs">
                      {activeStudentStats['9th'].total + activeStudentStats['10th'].total + activeStudentStats['11th'].total + activeStudentStats['12th'].total} Students
                    </span>
                  </div>
                </div>

                {/* 4 Class Breakdown Cards Grid with Editable Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Class 9th */}
                  <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-blue-700 dark:text-blue-400">Class 9th</span>
                          {activeStudentStats['9th'].isCustom && (
                            <button
                              type="button"
                              onClick={() => handleResetEnrollmentOverride('9th')}
                              className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 underline font-bold cursor-pointer"
                              title="Reset to database count"
                            >
                              ↩ Reset DB ({dbStudentStats['9th'].total})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={activeStudentStats['9th'].total}
                            onChange={(e) => handleUpdateEnrollmentOverride('9th', 'total', e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-mono font-black text-xs text-right text-blue-700 dark:text-blue-300 outline-none focus:ring-1 focus:ring-blue-500"
                            title="Edit Class 9th Total Student count"
                          />
                          <span className="text-[10px] font-black text-slate-400">Std</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span>Paid Students (Editable):</span>
                          <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                            {activeStudentStats['9th'].total}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Science Fund (Universal):</span>
                          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                            All {activeStudentStats['9th'].total} (100%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                          <span>Paid So Far: {feeDistributionProgress['9th']?.distributedTotal || 0}</span>
                          <span className="font-black text-amber-600 dark:text-amber-400">
                            Left: {feeDistributionProgress['9th']?.remainingTotal || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('9th', activeStudentStats['9th'].total, activeStudentStats['9th'].total);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        className="py-1.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm cursor-pointer transition-all active:scale-98"
                      >
                        <Sparkles size={11} />
                        <span>All ({activeStudentStats['9th'].total})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('9th', feeDistributionProgress['9th']?.remainingTotal || 0, feeDistributionProgress['9th']?.remainingTotal || 0);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        disabled={(feeDistributionProgress['9th']?.remainingTotal || 0) <= 0}
                        className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm cursor-pointer transition-all active:scale-98 disabled:opacity-40"
                      >
                        <span>Left ({feeDistributionProgress['9th']?.remainingTotal || 0})</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Class 10th */}
                  <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-blue-700 dark:text-blue-400">Class 10th</span>
                          {activeStudentStats['10th'].isCustom && (
                            <button
                              type="button"
                              onClick={() => handleResetEnrollmentOverride('10th')}
                              className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 underline font-bold cursor-pointer"
                              title="Reset to database count"
                            >
                              ↩ Reset DB ({dbStudentStats['10th'].total})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={activeStudentStats['10th'].total}
                            onChange={(e) => handleUpdateEnrollmentOverride('10th', 'total', e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-mono font-black text-xs text-right text-blue-700 dark:text-blue-300 outline-none focus:ring-1 focus:ring-blue-500"
                            title="Edit Class 10th Total Student count"
                          />
                          <span className="text-[10px] font-black text-slate-400">Std</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span>Paid Students (Editable):</span>
                          <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                            {activeStudentStats['10th'].total}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Science Fund (Universal):</span>
                          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                            All {activeStudentStats['10th'].total} (100%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                          <span>Paid So Far: {feeDistributionProgress['10th']?.distributedTotal || 0}</span>
                          <span className="font-black text-amber-600 dark:text-amber-400">
                            Left: {feeDistributionProgress['10th']?.remainingTotal || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('10th', activeStudentStats['10th'].total, activeStudentStats['10th'].total);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        className="py-1.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm cursor-pointer transition-all active:scale-98"
                      >
                        <Sparkles size={11} />
                        <span>All ({activeStudentStats['10th'].total})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('10th', feeDistributionProgress['10th']?.remainingTotal || 0, feeDistributionProgress['10th']?.remainingTotal || 0);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        disabled={(feeDistributionProgress['10th']?.remainingTotal || 0) <= 0}
                        className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-sm cursor-pointer transition-all active:scale-98 disabled:opacity-40"
                      >
                        <span>Left ({feeDistributionProgress['10th']?.remainingTotal || 0})</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Class 11th (Stream-wise Editable) */}
                  <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-indigo-700 dark:text-indigo-400">Class 11th</span>
                          {activeStudentStats['11th'].isCustom && (
                            <button
                              type="button"
                              onClick={() => handleResetEnrollmentOverride('11th')}
                              className="text-[9px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline font-bold cursor-pointer"
                              title="Reset to database count"
                            >
                              ↩ Reset DB ({dbStudentStats['11th'].total})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={activeStudentStats['11th'].total}
                            onChange={(e) => handleUpdateEnrollmentOverride('11th', 'total', e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 font-mono font-black text-xs text-right text-indigo-700 dark:text-indigo-300 outline-none focus:ring-1 focus:ring-indigo-500"
                            title="Edit Class 11th Total (auto-updates when streams change)"
                          />
                          <span className="text-[10px] font-black text-slate-400">Total</span>
                        </div>
                      </div>

                      {/* Streamwise Editable Inputs */}
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold space-y-1.5">
                        {/* Science Stream */}
                        <div className="flex items-center justify-between bg-purple-50/60 dark:bg-purple-950/30 p-1 rounded-lg border border-purple-200/60 dark:border-purple-900/40">
                          <span className="text-purple-700 dark:text-purple-300 font-extrabold flex items-center gap-1">
                            <span>🔬 Science Stream (Opt Fee):</span>
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={activeStudentStats['11th'].science}
                            onChange={(e) => handleUpdateEnrollmentOverride('11th', 'science', e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 font-mono font-black text-xs text-right text-purple-700 dark:text-purple-300 outline-none focus:ring-1 focus:ring-purple-500"
                            title="Edit 11th Science stream student count"
                          />
                        </div>

                        {/* Humanities / Arts */}
                        <div className="flex items-center justify-between p-1">
                          <span>📚 Humanities / Arts:</span>
                          <input
                            type="number"
                            min="0"
                            value={activeStudentStats['11th'].streams.Humanities || 0}
                            onChange={(e) => handleUpdateEnrollmentOverride('11th', 'humanities', e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-right text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                            title="Edit 11th Humanities student count"
                          />
                        </div>

                        {/* Commerce */}
                        {((activeStudentStats['11th'].streams.Commerce || 0) > 0 || activeStudentStats['11th'].isCustom) && (
                          <div className="flex items-center justify-between p-1">
                            <span>📊 Commerce:</span>
                            <input
                              type="number"
                              min="0"
                              value={activeStudentStats['11th'].streams.Commerce || 0}
                              onChange={(e) => handleUpdateEnrollmentOverride('11th', 'commerce', e.target.value)}
                              className="w-16 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-right text-slate-800 dark:text-slate-200 outline-none"
                              title="Edit 11th Commerce student count"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                          <span>Paid: {feeDistributionProgress['11th']?.distributedTotal || 0} (Sci: {feeDistributionProgress['11th']?.distributedSci || 0})</span>
                          <span className="font-black text-amber-600 dark:text-amber-400">
                            Left: {feeDistributionProgress['11th']?.remainingTotal || 0} (Sci: {feeDistributionProgress['11th']?.remainingSci || 0})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('11th', activeStudentStats['11th'].total, activeStudentStats['11th'].science);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        className="py-1.5 px-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] flex items-center justify-center gap-0.5 shadow-sm cursor-pointer transition-all active:scale-98"
                        title="Populate All 11th students with Science count"
                      >
                        <Sparkles size={10} />
                        <span>All ({activeStudentStats['11th'].total})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('11th', activeStudentStats['11th'].science, activeStudentStats['11th'].science);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        className="py-1.5 px-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] flex items-center justify-center gap-0.5 shadow-sm cursor-pointer transition-all active:scale-98"
                        title="Populate 11th Science stream only"
                      >
                        <span>Sci ({activeStudentStats['11th'].science})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('11th', feeDistributionProgress['11th']?.remainingTotal || 0, feeDistributionProgress['11th']?.remainingSci || 0);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        disabled={(feeDistributionProgress['11th']?.remainingTotal || 0) <= 0}
                        className="py-1.5 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] flex items-center justify-center gap-0.5 shadow-sm cursor-pointer transition-all active:scale-98 disabled:opacity-40"
                        title="Populate Remaining 11th students"
                      >
                        <span>Left ({feeDistributionProgress['11th']?.remainingTotal || 0})</span>
                      </button>
                    </div>
                  </div>

                  {/* 4. Class 12th (Stream-wise Editable) */}
                  <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-rose-700 dark:text-rose-400">Class 12th</span>
                          {activeStudentStats['12th'].isCustom && (
                            <button
                              type="button"
                              onClick={() => handleResetEnrollmentOverride('12th')}
                              className="text-[9px] text-rose-600 hover:text-rose-800 dark:text-rose-400 underline font-bold cursor-pointer"
                              title="Reset to database count"
                            >
                              ↩ Reset DB ({dbStudentStats['12th'].total})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={activeStudentStats['12th'].total}
                            onChange={(e) => handleUpdateEnrollmentOverride('12th', 'total', e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded-md border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 font-mono font-black text-xs text-right text-rose-700 dark:text-rose-300 outline-none focus:ring-1 focus:ring-rose-500"
                            title="Edit Class 12th Total (auto-updates when streams change)"
                          />
                          <span className="text-[10px] font-black text-slate-400">Total</span>
                        </div>
                      </div>

                      {/* Streamwise Editable Inputs */}
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold space-y-1.5">
                        {/* Science Stream */}
                        <div className="flex items-center justify-between bg-purple-50/60 dark:bg-purple-950/30 p-1 rounded-lg border border-purple-200/60 dark:border-purple-900/40">
                          <span className="text-purple-700 dark:text-purple-300 font-extrabold flex items-center gap-1">
                            <span>🔬 Science Stream (Opt Fee):</span>
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={activeStudentStats['12th'].science}
                            onChange={(e) => handleUpdateEnrollmentOverride('12th', 'science', e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 font-mono font-black text-xs text-right text-purple-700 dark:text-purple-300 outline-none focus:ring-1 focus:ring-purple-500"
                            title="Edit 12th Science stream student count"
                          />
                        </div>

                        {/* Humanities / Arts */}
                        <div className="flex items-center justify-between p-1">
                          <span>📚 Humanities / Arts:</span>
                          <input
                            type="number"
                            min="0"
                            value={activeStudentStats['12th'].streams.Humanities || 0}
                            onChange={(e) => handleUpdateEnrollmentOverride('12th', 'humanities', e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-right text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                            title="Edit 12th Humanities student count"
                          />
                        </div>

                        {/* Commerce */}
                        {((activeStudentStats['12th'].streams.Commerce || 0) > 0 || activeStudentStats['12th'].isCustom) && (
                          <div className="flex items-center justify-between p-1">
                            <span>📊 Commerce:</span>
                            <input
                              type="number"
                              min="0"
                              value={activeStudentStats['12th'].streams.Commerce || 0}
                              onChange={(e) => handleUpdateEnrollmentOverride('12th', 'commerce', e.target.value)}
                              className="w-16 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-right text-slate-800 dark:text-slate-200 outline-none"
                              title="Edit 12th Commerce student count"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-100 dark:border-slate-800">
                          <span>Paid: {feeDistributionProgress['12th']?.distributedTotal || 0} (Sci: {feeDistributionProgress['12th']?.distributedSci || 0})</span>
                          <span className="font-black text-amber-600 dark:text-amber-400">
                            Left: {feeDistributionProgress['12th']?.remainingTotal || 0} (Sci: {feeDistributionProgress['12th']?.remainingSci || 0})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('12th', activeStudentStats['12th'].total, activeStudentStats['12th'].science);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        className="py-1.5 px-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] flex items-center justify-center gap-0.5 shadow-sm cursor-pointer transition-all active:scale-98"
                        title="Populate All 12th students with Science count"
                      >
                        <Sparkles size={10} />
                        <span>All ({activeStudentStats['12th'].total})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('12th', activeStudentStats['12th'].science, activeStudentStats['12th'].science);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        className="py-1.5 px-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] flex items-center justify-center gap-0.5 shadow-sm cursor-pointer transition-all active:scale-98"
                        title="Populate 12th Science stream only"
                      >
                        <span>Sci ({activeStudentStats['12th'].science})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyDbStats('12th', feeDistributionProgress['12th']?.remainingTotal || 0, feeDistributionProgress['12th']?.remainingSci || 0);
                          setIsRatesModalOpen(false);
                          setActiveTab('entry');
                        }}
                        disabled={(feeDistributionProgress['12th']?.remainingTotal || 0) <= 0}
                        className="py-1.5 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] flex items-center justify-center gap-0.5 shadow-sm cursor-pointer transition-all active:scale-98 disabled:opacity-40"
                        title="Populate Remaining 12th students"
                      >
                        <span>Left ({feeDistributionProgress['12th']?.remainingTotal || 0})</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Informational Help Alert */}
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5 text-[11px] text-blue-900 dark:text-blue-300 font-bold leading-relaxed">
                  <Sparkles size={15} className="flex-shrink-0 mt-0.5 text-blue-600" />
                  <span>
                    Figures are live and fully editable. When you adjust stream numbers, totals automatically recalculate. 1-click populate buttons inject current values directly into your statement generator.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: FEE RATES & SUBSIDIARY ACCOUNTS CONFIGURATION */}
            {settingsModalTab === 'rates' && (
              <>
                {/* Class Selector Tabs & Top Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0">
                  {/* Class Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-1">
                    {['9th', '10th', '11th', '12th'].map(cls => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setEditingRatesClass(cls)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          editingRatesClass === cls
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        Class {cls}
                      </button>
                    ))}
                  </div>

                  {/* Action Buttons: Add Account & Reset Defaults */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingAccount(prev => !prev)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        isAddingAccount
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20'
                      }`}
                      title="Add a new subsidiary account and fee head"
                    >
                      <Plus size={13} />
                      <span>{isAddingAccount ? 'Cancel Adding' : 'Add Account'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetToDefaults}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                      title="Reset all accounts and rates to original 13 institutional defaults"
                    >
                      <Undo2 size={13} />
                      <span className="hidden sm:inline">Reset Defaults</span>
                    </button>
                  </div>
                </div>

            {/* Expandable Add New Account Form Panel */}
            {isAddingAccount && (
              <form 
                onSubmit={handleAddNewAccount} 
                className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-3 animate-fadeIn flex-shrink-0"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-600" />
                    <span>Create New Subsidiary Institutional Account</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                    Unique account & fee rate registration
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                  {/* Account Name */}
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-[9.5px] font-black uppercase text-slate-500 dark:text-slate-400">
                      Account / Head Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sports Infrastructure Fund"
                      value={newAccountData.name}
                      onChange={(e) => setNewAccountData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 16-Digit Account Number */}
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-[9.5px] font-black uppercase text-slate-500 dark:text-slate-400">
                      J&K Bank 16-Digit Account No
                    </label>
                    <input
                      type="text"
                      placeholder="0137040500000000"
                      value={newAccountData.accNo}
                      onChange={(e) => setNewAccountData(prev => ({ ...prev, accNo: e.target.value }))}
                      maxLength={16}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Science Only Toggle Checkbox */}
                  <div className="sm:col-span-4 flex items-center gap-2 pt-1.5">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAccountData.isScienceOnly}
                        onChange={(e) => setNewAccountData(prev => ({ ...prev, isScienceOnly: e.target.checked }))}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Apply to Science Students Only</span>
                    </label>
                  </div>

                  {/* Initial Rate for Class */}
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[9.5px] font-black uppercase text-slate-500 dark:text-slate-400">
                      Default Rate (₹ / Student)
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 50"
                        value={newAccountData.rate9th}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewAccountData(prev => ({
                            ...prev,
                            rate9th: v,
                            rate10th: v,
                            rate11th: v,
                            rate12th: v
                          }));
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="sm:col-span-4 flex items-end justify-end">
                    <button
                      type="submit"
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-98"
                    >
                      <Plus size={13} />
                      <span>Register Account Head</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Live Rate Summary Header */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 text-center flex-shrink-0">
              <div>
                <span className="text-[9.5px] font-black uppercase text-slate-500">General / Humanities Base</span>
                <p className="font-mono font-black text-sm text-slate-900 dark:text-white mt-0.5">
                  {formatCurrency(activeClassRateStats.baseGeneral)}
                </p>
              </div>
              <div>
                <span className="text-[9.5px] font-black uppercase text-blue-600 dark:text-blue-400">Science Fund (Opt)</span>
                <p className="font-mono font-black text-sm text-blue-600 dark:text-blue-400 mt-0.5">
                  {formatCurrency(activeClassRateStats.scienceFund)}
                </p>
              </div>
              <div>
                <span className="text-[9.5px] font-black uppercase text-indigo-600 dark:text-indigo-400">Total Science Student</span>
                <p className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {formatCurrency(activeClassRateStats.totalScience)}
                </p>
              </div>
            </div>

            {/* Scrollable Dynamic Accounts & Rates Grid */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-2.5 text-xs scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {tempAccounts.map((acc, index) => {
                  const isSci = Boolean(acc.isScienceOnly);
                  const classRateVal = tempRates[editingRatesClass]?.[acc.key] ?? 0;

                  return (
                    <div 
                      key={acc.key} 
                      className={`p-3 rounded-xl border transition-all space-y-2 relative group ${
                        isSci 
                          ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/50' 
                          : 'bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {/* Top Row: Account Name & Trash Icon */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-[9.5px] font-mono text-slate-400 font-bold flex-shrink-0">
                            #{index + 1}
                          </span>
                          <input
                            type="text"
                            value={acc.name}
                            onChange={(e) => handleUpdateAccountField(acc.key, 'name', e.target.value)}
                            title="Edit Account Name"
                            className="w-full px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 bg-transparent font-extrabold text-xs text-slate-800 dark:text-slate-200 outline-none truncate"
                          />
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc.key)}
                          disabled={tempAccounts.length <= 1}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                          title="Delete this subsidiary account"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Middle Row: Bank Account Number & Type Toggle */}
                      <div className="flex items-center justify-between gap-2 text-[10.5px]">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <span className="text-[9px] font-black uppercase text-slate-400 flex-shrink-0">A/C:</span>
                          <input
                            type="text"
                            value={acc.accNo}
                            onChange={(e) => handleUpdateAccountField(acc.key, 'accNo', e.target.value)}
                            title="Edit 16-Digit J&K Bank Account Number"
                            maxLength={16}
                            placeholder="0137040500000000"
                            className="w-36 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-[10.5px] text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Type Toggle Badge */}
                        <button
                          type="button"
                          onClick={() => handleUpdateAccountField(acc.key, 'isScienceOnly', !acc.isScienceOnly)}
                          className={`px-2 py-0.5 rounded-full font-black text-[9px] cursor-pointer transition-all ${
                            isSci
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                          }`}
                          title="Click to toggle between General and Science-Only fund"
                        >
                          {isSci ? '🧪 Science Only' : '👥 General Fund'}
                        </button>
                      </div>

                      {/* Bottom Row: Fee Rate Input for Active Class */}
                      <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800 pt-1.5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Class {editingRatesClass} Rate:
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-mono text-xs font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={classRateVal}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setTempRates(prev => ({
                                ...prev,
                                [editingRatesClass]: {
                                  ...prev[editingRatesClass],
                                  [acc.key]: val
                                }
                              }));
                            }}
                            className="w-20 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-right outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmation Note */}
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-[10.5px] text-amber-800 dark:text-amber-300 font-bold leading-relaxed flex-shrink-0">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <span>Updating accounts and fee rates will apply to all future statements and transaction ledger matrix calculations. Past generated statements remain preserved.</span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsRatesModalOpen(false);
                  setIsAddingAccount(false);
                }}
                disabled={isSavingRates}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRates}
                disabled={isSavingRates}
                className="px-4 py-1.5 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingRates ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <>
                    <Save size={13} />
                    <span>Save & Update All (Classes & Accounts)</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )}

      {/* ─────────────────── ENHANCED EDIT / UPDATE CONFIRMATION MODAL ─────────────────── */}
      {editReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-5 space-y-3.5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                  <Edit2 size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Edit Fund Distribution
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold">
                    Class {editReport.class} • {getReportPeriodDescription(editReport)}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditReport(null)} 
                disabled={isUpdating}
                className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X size={15} />
              </button>
            </div>

            {/* Edit Inputs */}
            <div className="space-y-3 text-xs font-bold">
              {/* Row 1: Date & Academic Session */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Calendar size={11} /> TRANSACTION DATE
                  </label>
                  <input
                    type="date"
                    value={editReport.date || ''}
                    onChange={(e) => setEditReport({ ...editReport, date: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9.5px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <CalendarDays size={11} /> ACADEMIC SESSION
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2025-26"
                    value={editReport.academicSession || editReport.session || ''}
                    onChange={(e) => setEditReport({ ...editReport, academicSession: e.target.value, session: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-xs text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Paid & Science Students */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9.5px] font-black uppercase text-slate-400 flex items-center gap-1">
                      <Users size={11} /> PAID STUDENTS
                    </label>
                    <span className="text-[8px] font-bold text-slate-400">Total Fee</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={editReport.paidStudents || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (editReport.class === '9th' || editReport.class === '10th') {
                        setEditReport({ ...editReport, paidStudents: val, scienceStudents: val });
                      } else {
                        setEditReport({ ...editReport, paidStudents: val });
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9.5px] font-black uppercase text-slate-400 flex items-center gap-1">
                      <FlaskConical size={11} /> SCIENCE (OPT)
                    </label>
                    {(editReport.class === '9th' || editReport.class === '10th') ? (
                      <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 rounded">
                        Auto: All Std
                      </span>
                    ) : (
                      <span className="text-[8px] font-bold text-purple-600 dark:text-purple-400">
                        Sci Stream
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={editReport.scienceStudents || ''}
                    onChange={(e) => setEditReport({ ...editReport, scienceStudents: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Live Recalculation Preview Banner */}
              {editRecalculatedBreakdown && (
                <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-500">Original Amount:</span>
                    <span className="font-mono text-slate-600 line-through">
                      {formatCurrency(editReport.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-blue-900 dark:text-blue-200 flex items-center gap-1">
                      <RefreshCw size={12} className="text-blue-600" /> Recalculated Amount:
                    </span>
                    <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                      {formatCurrency(editRecalculatedBreakdown.totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Informational Warning Note */}
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-[10.5px] text-amber-800 dark:text-amber-300 font-bold leading-relaxed">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
                <span>Saving will automatically recalculate and update all 13 subsidiary account balances in the official ledger.</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditReport(null)}
                disabled={isUpdating}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="px-4 py-1.5 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <>
                    <Save size={13} />
                    <span>Confirm & Update</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── FORMAT SELECTION MODAL (PDF vs EXCEL) ─────────────────── */}
      {formatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-5 space-y-4 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Download size={17} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Download Statement
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {formatModal.targetType === 'consolidated'
                      ? `Consolidated (${formatModal.data.length} Statements)`
                      : `Class ${formatModal.data.class} (${formatModal.data.month || formatModal.data.year || ''})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormatModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between">
              <span>{isProcessingFormat ? 'Generating document...' : 'Select format to download:'}</span>
              {isProcessingFormat && (
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1.5 animate-pulse">
                  <RefreshCw size={12} className="animate-spin" /> Working...
                </span>
              )}
            </div>

            {/* Two Format Choice Cards */}
            <div className="grid grid-cols-1 gap-2.5">
              {/* PDF Option */}
              <button
                type="button"
                disabled={Boolean(isProcessingFormat)}
                onClick={async () => {
                  const { targetType, data } = formatModal;
                  setIsProcessingFormat('pdf');
                  // Give browser microtick to render spinning animation immediately
                  await new Promise(r => setTimeout(r, 60));
                  try {
                    if (targetType === 'consolidated') {
                      await downloadConsolidatedFundDistributionPdf(data, rates, accounts);
                    } else {
                      await downloadFundDistributionPdf(data, rates, accounts);
                    }
                    showNotification('PDF document downloaded successfully!', 'success');
                  } finally {
                    setIsProcessingFormat(null);
                    setFormatModal(null);
                  }
                }}
                className={`w-full p-3.5 rounded-xl border-2 transition-all group text-left cursor-pointer ${
                  isProcessingFormat === 'pdf'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 ring-2 ring-rose-500/30'
                    : isProcessingFormat
                    ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800'
                    : 'border-rose-200 dark:border-rose-900/60 hover:border-rose-500 dark:hover:border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-50 dark:hover:bg-rose-950/50 active:scale-98'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                      isProcessingFormat === 'pdf' ? 'bg-rose-600 text-white shadow-rose-500/20' : 'bg-rose-600 text-white'
                    }`}>
                      {isProcessingFormat === 'pdf' ? (
                        <Loader2 size={22} className="animate-spin" />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors flex items-center gap-1.5">
                        {isProcessingFormat === 'pdf' ? 'Generating Official PDF Letter...' : 'Official PDF Letter'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {isProcessingFormat === 'pdf' ? 'Capturing high-resolution letterhead & preparing file...' : 'Official letterhead for Bank submission'}
                      </div>
                    </div>
                  </div>
                  {isProcessingFormat === 'pdf' ? (
                    <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-black text-[10.5px]">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Generating...</span>
                    </div>
                  ) : (
                    <ChevronRight size={16} className="text-rose-400 group-hover:translate-x-1 transition-transform" />
                  )}
                </div>
                {isProcessingFormat === 'pdf' && (
                  <div className="w-full bg-rose-200 dark:bg-rose-900/50 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-rose-600 rounded-full animate-[pulse_1s_ease-in-out_infinite] w-3/4 transition-all"></div>
                  </div>
                )}
              </button>

              {/* Excel Option */}
              <button
                type="button"
                disabled={Boolean(isProcessingFormat)}
                onClick={async () => {
                  const { targetType, data } = formatModal;
                  setIsProcessingFormat('excel');
                  // Give browser microtick to render spinning animation immediately
                  await new Promise(r => setTimeout(r, 60));
                  try {
                    if (targetType === 'consolidated') {
                      exportConsolidatedFundDistributionToExcel(data, rates, accounts);
                    } else {
                      exportFundDistributionToExcel(data, rates, accounts);
                    }
                    showNotification('Excel spreadsheet downloaded successfully!', 'success');
                  } finally {
                    setIsProcessingFormat(null);
                    setFormatModal(null);
                  }
                }}
                className={`w-full p-3.5 rounded-xl border-2 transition-all group text-left cursor-pointer ${
                  isProcessingFormat === 'excel'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 ring-2 ring-emerald-500/30'
                    : isProcessingFormat
                    ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800'
                    : 'border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-500 dark:hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 active:scale-98'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                      isProcessingFormat === 'excel' ? 'bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-emerald-600 text-white'
                    }`}>
                      {isProcessingFormat === 'excel' ? (
                        <Loader2 size={22} className="animate-spin" />
                      ) : (
                        <FileSpreadsheet size={20} />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {isProcessingFormat === 'excel' ? 'Building J&K Bank Excel...' : 'J&K Bank Excel (.xlsx)'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {isProcessingFormat === 'excel' ? 'Formatting subsidiary accounts & transfer amounts...' : 'Tabular columns for fast transfer entry'}
                      </div>
                    </div>
                  </div>
                  {isProcessingFormat === 'excel' ? (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-[10.5px]">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Building...</span>
                    </div>
                  ) : (
                    <ChevronRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
                  )}
                </div>
                {isProcessingFormat === 'excel' && (
                  <div className="w-full bg-emerald-200 dark:bg-emerald-900/50 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full animate-[pulse_1s_ease-in-out_infinite] w-3/4 transition-all"></div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── ENHANCED DELETE CONFIRMATION MODAL ─────────────────── */}
      {deleteTargetReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-3.5">
            {/* Warning Icon & Title */}
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-200 dark:border-rose-800">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Delete Statement?
                </h3>
                <span className="text-[10px] text-rose-500 font-black">
                  Irreversible Database Action
                </span>
              </div>
            </div>

            {/* Target Details Card */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Class & Month:</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {deleteTargetReport.class} Class ({deleteTargetReport.month})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Students:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  Paid: {deleteTargetReport.paidStudents || deleteTargetReport.onRoll} • Sci: {deleteTargetReport.scienceStudents || 0}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 pt-1.5">
                <span className="text-slate-400 font-bold">Total Amount:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                  {formatCurrency(deleteTargetReport.totalAmount)}
                </span>
              </div>
            </div>

            {/* Danger Callout */}
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
              Are you sure you want to delete this fund distribution record? It will be permanently removed from the ledger and bank distribution records.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTargetReport(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteReport}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
