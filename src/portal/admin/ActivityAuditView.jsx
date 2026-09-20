import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  History, ShieldAlert, Search, Filter, RefreshCw, Download, 
  Calendar, User, CheckCircle2, AlertCircle, Clock, Copy, 
  ExternalLink, ChevronDown, Award, Calculator, BookOpen, 
  FileText, UserCheck, ShieldCheck, ChevronRight, X, Printer,
  Eye, Laptop, Database, ArrowUpDown, Sparkles
} from 'lucide-react';
import { db } from '../../services/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  Timestamp
} from 'firebase/firestore';
import { showToast } from '../../components/common/GlobalToast';

const PAGE_SIZE = 25;

const CATEGORY_COLORS = {
  admissions: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800 font-bold',
  examinations: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 font-bold',
  accounts: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800 font-bold',
  certificates: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-800 font-bold',
  controls: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800 font-bold',
  general: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-bold'
};

// ─── RESILIENT ACTOR RESOLUTION ───
// Accurately classifies past and future audit records (even where actorType was 'user' or 'system')
export const resolveActorMeta = (log) => {
  const type = String(log.actorType || '').toLowerCase();
  const role = String(log.actorRole || '').toLowerCase();
  const email = String(log.actorEmail || log.adminEmail || '').toLowerCase();
  const name = String(log.actorName || log.adminName || '').toLowerCase();

  // 1. Admin determination
  if (
    type === 'admin' ||
    role.includes('admin') ||
    role.includes('superadmin') ||
    email.includes('adm.exam.hss.shangus') ||
    email.includes('admin') ||
    name === 'admin'
  ) {
    return {
      type: 'admin',
      label: 'Admin',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800'
    };
  }

  // 2. Teacher determination
  if (
    type === 'teacher' ||
    role.includes('teacher') ||
    role.includes('faculty') ||
    email.includes('teacher')
  ) {
    return {
      type: 'teacher',
      label: 'Teacher',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800'
    };
  }

  // 3. Student determination
  if (
    type === 'student' ||
    role.includes('student') ||
    email.includes('student')
  ) {
    return {
      type: 'student',
      label: 'Student',
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800'
    };
  }

  // 4. Default / System
  return {
    type: 'system',
    label: log.actorRole || log.actorType || 'System',
    badgeClass: 'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
  };
};

// ─── GOOGLE-LIKE SEARCH UTILITIES ───
// Tokenizes query into positive words, quoted phrases ("annual exam"), and negative terms (-absent)
const parseGoogleQuery = (rawQuery) => {
  if (!rawQuery || !rawQuery.trim()) return { must: [], mustNot: [] };
  const must = [];
  const mustNot = [];
  const regex = /(-?"[^"]+"|-?\S+)/g;
  let match;
  while ((match = regex.exec(rawQuery)) !== null) {
    let token = match[0].trim();
    const isNegative = token.startsWith('-');
    if (isNegative) token = token.slice(1);
    if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
      token = token.slice(1, -1).trim();
    }
    if (!token) continue;
    const lower = token.toLowerCase();
    if (isNegative) {
      mustNot.push(lower);
    } else {
      must.push(lower);
    }
  }
  return { must, mustNot };
};

// Deep Searchable Haystack across all primary, secondary and nested metadata fields
const buildLogSearchHaystack = (log, logDate) => {
  const actorMeta = resolveActorMeta(log);
  const parts = [
    log.id || '',
    log.actorName || log.adminName || '',
    log.actorEmail || log.adminEmail || '',
    actorMeta.type,
    actorMeta.label,
    log.actorType || '',
    log.actorRole || '',
    log.actionCategory || '',
    log.actionType || '',
    log.actionTitle || '',
    log.details || '',
    log.targetId || '',
    log.targetType || '',
    log.targetName || '',
    log.reasonCategory || '',
    log.customReason || '',
    log.ip || '',
    log.deviceInfo?.platform || '',
    log.deviceInfo?.userAgent || ''
  ];

  if (log.metadata && typeof log.metadata === 'object') {
    try {
      parts.push(JSON.stringify(log.metadata));
    } catch (_) {}
  }

  if (logDate && !isNaN(logDate.getTime())) {
    parts.push(logDate.toISOString());
    parts.push(logDate.toLocaleDateString('en-IN', { dateStyle: 'medium' }));
    parts.push(logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    parts.push(logDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
    parts.push(logDate.toLocaleTimeString());
    parts.push(String(logDate.getFullYear()));
  }

  return parts.join(' ').toLowerCase();
};

// Highlights matching search terms in the rendered table text with high light-theme contrast
const HighlightText = ({ text, query }) => {
  if (!text) return null;
  if (!query || !query.trim()) return <>{text}</>;

  const { must } = parseGoogleQuery(query);
  const validTokens = must.filter(t => t.length > 0);
  if (validTokens.length === 0) return <>{text}</>;

  try {
    const escaped = validTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = String(text).split(pattern);

    return (
      <>
        {parts.map((part, i) => {
          if (validTokens.some(t => t.toLowerCase() === part.toLowerCase())) {
            return (
              <mark key={i} className="bg-amber-300 dark:bg-amber-400 text-slate-950 px-1 py-0.5 rounded font-black shadow-2xs">
                {part}
              </mark>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  } catch (_) {
    return <>{text}</>;
  }
};

export default function ActivityAuditView({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allHistoryLoaded, setAllHistoryLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActor, setSelectedActor] = useState('all'); // all | admin | teacher | student | system
  const [selectedCategory, setSelectedCategory] = useState('all'); // all | admissions | examinations | accounts | certificates | controls
  const [selectedActionType, setSelectedActionType] = useState('all'); // all | update | submit | create | delete | export
  const [selectedDateRange, setSelectedDateRange] = useState('all'); // all | today | 7d | 30d

  // Dispute Inspection Modal
  const [inspectedLog, setInspectedLog] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Helper to parse Firestore timestamp or ISO string
  const parseLogDate = (log) => {
    if (log.createdAt && typeof log.createdAt.toDate === 'function') {
      return log.createdAt.toDate();
    }
    if (log.timestamp) {
      const d = new Date(log.timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  // Initial Fetch & Refresh (Loads 25 records initially for fast first paint)
  const fetchLogs = useCallback(async (isRefresh = false) => {
    try {
      setLoading(true);
      if (isRefresh) {
        setLogs([]);
        setLastDoc(null);
        setHasMore(true);
        setAllHistoryLoaded(false);
      }

      // Query with limit(PAGE_SIZE) to strictly cast minimum initial Firestore reads
      let q;
      try {
        q = query(
          collection(db, 'activityLogs'),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        );
      } catch (_) {
        q = query(
          collection(db, 'activityLogs'),
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Chronological sort
      fetched.sort((a, b) => parseLogDate(b) - parseLogDate(a));

      setLogs(fetched);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching activity audit logs:', err);
      showToast('Could not load activity audit trail. Please retry.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Entire Historical Audit Trail (Ensures search queries search with respect to 100% of history)
  const loadAllHistory = useCallback(async (silent = false) => {
    if (loadingAll || allHistoryLoaded) return;
    try {
      setLoadingAll(true);
      let snap;
      try {
        const q = query(
          collection(db, 'activityLogs'),
          orderBy('createdAt', 'desc')
        );
        snap = await getDocs(q);
      } catch (_) {
        snap = await getDocs(collection(db, 'activityLogs'));
      }

      const fetched = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      fetched.sort((a, b) => parseLogDate(b) - parseLogDate(a));

      setLogs(fetched);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(false);
      setAllHistoryLoaded(true);

      if (!silent) {
        showToast(`Indexed complete audit history (${fetched.length} events)!`, 'success');
      }
    } catch (err) {
      console.error('Error loading complete activity audit history:', err);
      if (!silent) {
        showToast('Failed to load full audit history.', 'warning');
      }
    } finally {
      setLoadingAll(false);
    }
  }, [loadingAll, allHistoryLoaded]);

  // Fetch Next Page On Demand (Load More)
  const handleLoadMore = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      let q;
      try {
        q = query(
          collection(db, 'activityLogs'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      } catch (_) {
        q = query(
          collection(db, 'activityLogs'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      fetched.sort((a, b) => parseLogDate(b) - parseLogDate(a));

      setLogs(prev => {
        const seen = new Set(prev.map(p => p.id));
        const combined = [...prev];
        for (const item of fetched) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            combined.push(item);
          }
        }
        combined.sort((a, b) => parseLogDate(b) - parseLogDate(a));
        return combined;
      });

      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching more activity logs:', err);
      showToast('Failed to load older activity logs.', 'warning');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-fetch ALL history whenever the user starts typing a search query
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length > 0 && !allHistoryLoaded && !loadingAll) {
      const timer = setTimeout(() => {
        loadAllHistory(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, allHistoryLoaded, loadingAll, loadAllHistory]);

  // Memoized Google search query breakdown
  const parsedSearch = useMemo(() => {
    return parseGoogleQuery(searchQuery);
  }, [searchQuery]);

  // Client-Side Filtering for maximum responsiveness and 0 added Firestore cost
  const filteredLogs = useMemo(() => {
    const { must, mustNot } = parsedSearch;
    const hasSearch = must.length > 0 || mustNot.length > 0;

    return logs.filter(log => {
      const logDate = parseLogDate(log);
      const actorMeta = resolveActorMeta(log);

      // 1. Actor Filter
      if (selectedActor !== 'all') {
        if (selectedActor !== actorMeta.type) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'all') {
        const cat = String(log.actionCategory || '').toLowerCase();
        if (!cat.includes(selectedCategory.toLowerCase())) return false;
      }

      // 3. Action Type Filter
      if (selectedActionType !== 'all') {
        const act = String(log.actionType || '').toLowerCase();
        if (act !== selectedActionType.toLowerCase()) return false;
      }

      // 4. Date Filter
      if (selectedDateRange !== 'all') {
        const now = new Date();
        const diffHours = (now - logDate) / (1000 * 60 * 60);

        if (selectedDateRange === 'today' && diffHours > 24) return false;
        if (selectedDateRange === '7d' && diffHours > 24 * 7) return false;
        if (selectedDateRange === '30d' && diffHours > 24 * 30) return false;
      }

      // 5. Google-like Multi-Term & Quoted Phrase Search
      if (hasSearch) {
        const haystack = buildLogSearchHaystack(log, logDate);

        // Exclude if any negative term matches (-term)
        for (const neg of mustNot) {
          if (haystack.includes(neg)) return false;
        }

        // Require ALL positive terms/phrases to match (Google AND semantics)
        for (const term of must) {
          if (!haystack.includes(term)) return false;
        }
      }

      return true;
    });
  }, [logs, selectedActor, selectedCategory, selectedActionType, selectedDateRange, parsedSearch]);

  // Statistics Summary accurately calculated via resolveActorMeta
  const stats = useMemo(() => {
    let adminCount = 0;
    let teacherCount = 0;
    let studentCount = 0;
    let systemCount = 0;

    logs.forEach(l => {
      const { type } = resolveActorMeta(l);
      if (type === 'admin') adminCount++;
      else if (type === 'teacher') teacherCount++;
      else if (type === 'student') studentCount++;
      else systemCount++;
    });

    return {
      total: logs.length,
      admin: adminCount,
      teacher: teacherCount,
      student: studentCount,
      system: systemCount
    };
  }, [logs]);

  // CSV Export for Dispute Records with S.No included
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      showToast('No logs match active filters for export.', 'warning');
      return;
    }

    const headers = [
      'S.No',
      'Log ID',
      'Timestamp (UTC)',
      'Local Date & Time',
      'Actor Type',
      'Actor Role',
      'Actor Name',
      'Actor Email',
      'Action Category',
      'Action Type',
      'Action Title',
      'Details',
      'Target ID',
      'Reason Category',
      'Custom Reason'
    ];

    const rows = filteredLogs.map((l, idx) => {
      const d = parseLogDate(l);
      const actorMeta = resolveActorMeta(l);
      return [
        `"${idx + 1}"`,
        `"${l.id}"`,
        `"${d.toISOString()}"`,
        `"${d.toLocaleString()}"`,
        `"${actorMeta.label}"`,
        `"${l.actorRole || actorMeta.label}"`,
        `"${(l.actorName || l.adminName || '').replace(/"/g, '""')}"`,
        `"${l.actorEmail || l.adminEmail || '—'}"`,
        `"${l.actionCategory || 'general'}"`,
        `"${l.actionType || 'update'}"`,
        `"${(l.actionTitle || '').replace(/"/g, '""')}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${l.targetId || '—'}"`,
        `"${l.reasonCategory || '—'}"`,
        `"${(l.customReason || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `HSS_Shangus_Activity_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Activity Audit Trail exported to CSV!', 'success');
  };

  const copyLogIdToClipboard = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    showToast('Log Entry ID copied to clipboard!', 'info');
  };

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3 animate-fadeIn">
      {/* ─── HIGH-CONTRAST HEADER BANNER & STATS STRIP ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:px-4 sm:py-3 shadow-xs border-2 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Title & Immutable Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border-2 border-indigo-200 dark:bg-indigo-950/60 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 shadow-2xs">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-950 dark:text-white truncate">
                  Activity Audit & Dispute Trail
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 text-[9.5px] font-black uppercase tracking-wider border border-indigo-200 dark:border-indigo-800 shrink-0 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Immutable Audit
                </span>
                <span className="hidden md:inline-block text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                  Server-verified audit records across GHSS Shangus.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {allHistoryLoaded ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>All History Ready</span>
              </span>
            ) : (
              <button
                onClick={() => loadAllHistory(false)}
                disabled={loadingAll}
                title="Index entire historical audit trail for complete search"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 text-xs font-bold border border-indigo-300 dark:border-indigo-800 transition shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loadingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span>Indexing All...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Load All History</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => fetchLogs(true)}
              disabled={loading || loadingAll}
              title="Refresh Audit Logs"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCsv}
              title="Export Current Filtered Audit Logs as CSV"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* High-Contrast Metrics Ribbon */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap font-medium text-[11px]">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold shadow-2xs">
              Loaded: <strong className="text-indigo-700 dark:text-indigo-300 font-black">{stats.total}</strong> <span className="text-[10px] text-slate-500 font-semibold">{allHistoryLoaded ? 'all records' : 'in cache'}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-bold shadow-2xs">
              Admin: <strong className="text-rose-950 dark:text-rose-100 font-black">{stats.admin}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold shadow-2xs">
              Teacher: <strong className="text-emerald-950 dark:text-emerald-100 font-black">{stats.teacher}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-200 font-bold shadow-2xs">
              Student: <strong className="text-sky-950 dark:text-sky-100 font-black">{stats.student}</strong>
            </span>
            {stats.system > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 font-bold shadow-2xs">
                System: <strong className="text-amber-950 dark:text-amber-100 font-black">{stats.system}</strong>
              </span>
            )}
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-mono font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Tamper-Proof Audit Trail</span>
          </div>
        </div>
      </div>

      {/* ─── GOOGLE-STYLE SEARCH & UNIFIED HIGH CONTRAST FILTERS ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border-2 border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 space-y-2">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          {/* Google-like Keyword Search across ALL history */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search across all history (e.g., 'botany marks', 'teacher submit', roll no, email, dates)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-14 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-950 dark:text-slate-100 placeholder-slate-400 shadow-2xs"
            />
            {loadingAll && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-indigo-600 font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </div>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Dropdowns Grouped on Same Row */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
            {/* Actor Filter */}
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="text-xs font-bold py-2 px-2.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Actors</option>
              <option value="admin">Administrators</option>
              <option value="teacher">Teachers / Faculty</option>
              <option value="student">Students</option>
              <option value="system">System Processes</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-bold py-2 px-2.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Categories</option>
              <option value="admissions">Admissions</option>
              <option value="examinations">Examinations</option>
              <option value="accounts">Accounts & Tax</option>
              <option value="certificates">Certificates</option>
              <option value="controls">System Controls</option>
            </select>

            {/* Action Type Filter */}
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="text-xs font-bold py-2 px-2.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Actions</option>
              <option value="update">Updates</option>
              <option value="submit">Submissions</option>
              <option value="approve">Approvals</option>
              <option value="create">Creations</option>
              <option value="delete">Deletions</option>
              <option value="export">Exports</option>
            </select>

            {/* Date Range Preset */}
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="text-xs font-bold py-2 px-2.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Time</option>
              <option value="today">Past 24h</option>
              <option value="7d">Past 7d</option>
              <option value="30d">Past 30d</option>
            </select>
          </div>
        </div>

        {/* Status Line & Active Search Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Showing <strong className="text-slate-950 dark:text-white font-black text-xs">{filteredLogs.length}</strong> of {logs.length} events
              {allHistoryLoaded && (
                <span className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-extrabold ml-1">
                  (w.r.t all history)
                </span>
              )}
            </span>

            {loadingAll && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-bold border border-indigo-200 dark:border-indigo-800 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Indexing all history from Firestore...
              </span>
            )}

            {parsedSearch.must.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 text-[11px] font-black border border-indigo-300 dark:border-indigo-700">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Search: {parsedSearch.must.map(m => `"${m}"`).join(' + ')}
              </span>
            )}
            {parsedSearch.mustNot.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 text-[11px] font-black border border-rose-300 dark:border-rose-700">
                Excluding: -{parsedSearch.mustNot.join(', -')}
              </span>
            )}
          </div>

          {(selectedActor !== 'all' || selectedCategory !== 'all' || selectedActionType !== 'all' || selectedDateRange !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedActor('all');
                setSelectedCategory('all');
                setSelectedActionType('all');
                setSelectedDateRange('all');
                setSearchQuery('');
              }}
              className="text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 underline font-black text-xs cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* ─── ACTIVITY TRAIL TABLE (High-Contrast View with Dynamic S.No) ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-200/95 dark:bg-slate-950 border-b-2 border-slate-300 dark:border-slate-800 text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                <th className="py-2.5 px-3 text-center w-12 font-black">S.No</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Date & Time</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Action & Details</th>
                <th className="py-2.5 px-3">Target / Reference</th>
                <th className="py-2.5 px-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredLogs.map((log, idx) => {
                const logDate = parseLogDate(log);
                const categoryColor = CATEGORY_COLORS[log.actionCategory] || CATEGORY_COLORS.general;
                const actorMeta = resolveActorMeta(log);

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition cursor-pointer border-b border-slate-200/80 dark:border-slate-800"
                    onClick={() => setInspectedLog(log)}
                  >
                    {/* Dynamic S.No */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-slate-200/90 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-black text-xs border border-slate-300 dark:border-slate-700 shadow-2xs">
                        {idx + 1}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono font-black text-slate-950 dark:text-white text-[11.5px]">
                        {logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-0.5">
                        {logDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>

                    {/* Actor Details */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider border shadow-2xs ${actorMeta.badgeClass}`}>
                          {actorMeta.label}
                        </span>
                        <div className="font-black text-slate-950 dark:text-white text-xs truncate max-w-[150px]">
                          <HighlightText text={log.actorName || log.adminName || actorMeta.label} query={searchQuery} />
                        </div>
                      </div>
                      <div className="text-[10.5px] text-slate-600 dark:text-slate-400 font-mono font-medium truncate max-w-[170px] mt-0.5">
                        <HighlightText text={log.actorEmail || log.adminEmail || '—'} query={searchQuery} />
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${categoryColor}`}>
                        {log.actionCategory || 'General'}
                      </span>
                    </td>

                    {/* Action Title & Details */}
                    <td className="py-2.5 px-3">
                      <div className="font-black text-slate-950 dark:text-white text-[12.5px] flex items-center gap-1.5 flex-wrap leading-snug">
                        <HighlightText text={log.actionTitle} query={searchQuery} />
                        {log.actionType && (
                          <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-mono font-black uppercase border ${
                            log.actionType.toLowerCase() === 'delete'
                              ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800'
                              : log.actionType.toLowerCase() === 'approve'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800'
                              : log.actionType.toLowerCase() === 'submit'
                              ? 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800'
                              : 'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                          }`}>
                            {log.actionType}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 text-[11px] font-medium leading-relaxed line-clamp-1 mt-0.5">
                        <HighlightText text={log.details || log.actionTitle} query={searchQuery} />
                      </div>
                    </td>

                    {/* Target / Reference */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {log.targetId ? (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                          <HighlightText text={log.targetId} query={searchQuery} />
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold text-[11px]">—</span>
                      )}
                    </td>

                    {/* Inspect Button */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedLog(log);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-700 hover:text-indigo-700 dark:text-slate-200 dark:hover:text-indigo-300 transition border border-slate-300 dark:border-slate-700 shadow-2xs cursor-pointer"
                        title="Inspect full dispute evidence"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <History className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No activity logs found matching the filter</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try broadening your date range or adjusting keyword filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Pagination & History Controls */}
        {hasMore && !allHistoryLoaded && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore || loadingAll}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-black border-2 border-slate-300 dark:border-slate-700 shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  Loading older audit events...
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-indigo-600" />
                  Load Next {PAGE_SIZE} Events
                </>
              )}
            </button>

            <button
              onClick={() => loadAllHistory(false)}
              disabled={loadingMore || loadingAll}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 text-xs font-black border-2 border-indigo-300 dark:border-indigo-700 shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loadingAll ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  Indexing All Records...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Load & Index Entire History
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Dispute Resolution & Evidence Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Audit Verification & Dispute Evidence
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Entry ID: {inspectedLog.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Event Title Card */}
              <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${CATEGORY_COLORS[inspectedLog.actionCategory] || CATEGORY_COLORS.general}`}>
                    {inspectedLog.actionCategory || 'General'}
                  </span>
                  <span className="font-mono text-slate-400 text-[10px]">
                    {parseLogDate(inspectedLog).toUTCString()}
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mt-2">
                  {inspectedLog.actionTitle}
                </h4>
                <p className="mt-1 text-slate-600 dark:text-slate-300 text-xs">
                  {inspectedLog.details || inspectedLog.actionTitle}
                </p>
              </div>

              {/* Actor Identity Breakdown */}
              {(() => {
                const modalActorMeta = resolveActorMeta(inspectedLog);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 space-y-1.5 shadow-2xs">
                      <span className="text-[10.5px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Verified Actor Identity
                      </span>
                      <div className="font-black text-slate-950 dark:text-white text-xs">
                        {inspectedLog.actorName || inspectedLog.adminName || modalActorMeta.label}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 font-mono text-[11px] font-semibold truncate">
                        {inspectedLog.actorEmail || inspectedLog.adminEmail || '—'}
                      </div>
                      <div className="pt-1 flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded border shadow-2xs ${modalActorMeta.badgeClass}`}>
                          {modalActorMeta.label}
                        </span>
                        <span className="text-[10.5px] text-slate-600 dark:text-slate-400 font-mono font-bold">
                          Role: {inspectedLog.actorRole || modalActorMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 space-y-1.5 shadow-2xs">
                      <span className="text-[10.5px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Timestamp & Context
                      </span>
                      <div className="font-black text-slate-950 dark:text-white text-xs">
                        {parseLogDate(inspectedLog).toLocaleString([], { dateStyle: 'full', timeStyle: 'medium' })}
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                        Target Ref: <span className="font-mono font-black text-indigo-700 dark:text-indigo-400">{inspectedLog.targetId || 'N/A'}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 text-[10.5px] font-bold">
                        Reason: {inspectedLog.reasonCategory || 'Standard Operation'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Client / Device Fingerprint */}
              {inspectedLog.deviceInfo && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40 flex items-start gap-3">
                  <Laptop className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-white">Device Context: </span>
                    {inspectedLog.deviceInfo.platform || 'Web Client'} • {inspectedLog.deviceInfo.userAgent || 'Modern Browser'}
                  </div>
                </div>
              )}

              {/* Raw Metadata Details */}
              {inspectedLog.metadata && Object.keys(inspectedLog.metadata).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-indigo-500" />
                      Payload Metadata
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(inspectedLog.metadata, null, 2));
                        showToast('Payload JSON copied!', 'info');
                      }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto max-h-48 border border-slate-800">
                    {JSON.stringify(inspectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <button
                onClick={() => copyLogIdToClipboard(inspectedLog.id)}
                className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 text-xs font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedId ? 'Copied ID!' : 'Copy Verification Hash'}
              </button>
              <button
                onClick={() => setInspectedLog(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
