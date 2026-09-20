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
  admissions: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900',
  examinations: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
  accounts: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  certificates: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900',
  controls: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900',
  general: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
};

const ACTOR_BADGES = {
  admin: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  teacher: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  student: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  system: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
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
  const parts = [
    log.id || '',
    log.actorName || log.adminName || '',
    log.actorEmail || log.adminEmail || '',
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

// Highlights matching search terms in the rendered table text
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
              <mark key={i} className="bg-amber-200/90 dark:bg-amber-500/30 text-slate-950 dark:text-amber-200 px-0.5 rounded font-bold">
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

  // Initial Fetch & Refresh (On-Demand only 25 records to minimize reads)
  const fetchLogs = useCallback(async (isRefresh = false) => {
    try {
      setLoading(true);
      if (isRefresh) {
        setLogs([]);
        setLastDoc(null);
        setHasMore(true);
      }

      // Query with limit(PAGE_SIZE) to strictly cast minimum Firestore reads
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

      // In case createdAt wasn't populated on some legacy docs, do an in-memory chronological sort
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

      setLogs(prev => [...prev, ...fetched]);
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

  // Memoized Google search query breakdown
  const parsedSearch = useMemo(() => {
    return parseGoogleQuery(searchQuery);
  }, [searchQuery]);

  // Client-Side In-Memory Filtering for maximum responsiveness and 0 added Firestore read cost
  const filteredLogs = useMemo(() => {
    const { must, mustNot } = parsedSearch;
    const hasSearch = must.length > 0 || mustNot.length > 0;

    return logs.filter(log => {
      const logDate = parseLogDate(log);

      // 1. Actor Filter
      if (selectedActor !== 'all') {
        const actor = String(log.actorType || '').toLowerCase();
        if (selectedActor === 'admin' && actor !== 'admin') return false;
        if (selectedActor === 'teacher' && actor !== 'teacher') return false;
        if (selectedActor === 'student' && actor !== 'student') return false;
        if (selectedActor === 'system' && actor !== 'system') return false;
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

  // Statistics Summary
  const stats = useMemo(() => {
    let adminCount = 0;
    let teacherCount = 0;
    let studentCount = 0;
    let systemCount = 0;

    logs.forEach(l => {
      const type = String(l.actorType || '').toLowerCase();
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

  // CSV Export for Dispute Records
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      showToast('No logs match active filters for export.', 'warning');
      return;
    }

    const headers = [
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

    const rows = filteredLogs.map(l => {
      const d = parseLogDate(l);
      return [
        `"${l.id}"`,
        `"${d.toISOString()}"`,
        `"${d.toLocaleString()}"`,
        `"${l.actorType || 'System'}"`,
        `"${l.actorRole || '—'}"`,
        `"${(l.actorName || '').replace(/"/g, '""')}"`,
        `"${l.actorEmail || '—'}"`,
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
      {/* ─── COMPACT HEADER BANNER & STATS STRIP ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-3 sm:px-4 sm:py-2.5 shadow-sm border border-indigo-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Title & Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  Activity Audit & Dispute Trail
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[9.5px] font-bold uppercase tracking-wider border border-indigo-400/25 shrink-0">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  Immutable Audit
                </span>
                <span className="hidden md:inline-block text-xs text-slate-300/80 font-normal truncate">
                  Server-verified audit records across GHSS Shangus.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => fetchLogs(true)}
              disabled={loading}
              title="Refresh Audit Logs"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleExportCsv}
              title="Export Current Filtered Audit Logs as CSV"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-2xs active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Compact Metrics Row */}
        <div className="mt-2 pt-2 border-t border-indigo-900/50 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap font-medium text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/80 text-slate-300">
              Loaded: <strong className="text-indigo-300 font-extrabold">{stats.total}</strong> <span className="text-[10px] text-slate-400">in cache</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/40 border border-rose-900/50 text-rose-300">
              Admin: <strong className="text-rose-200 font-extrabold">{stats.admin}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-900/50 text-emerald-300">
              Teacher: <strong className="text-emerald-200 font-extrabold">{stats.teacher}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/40 border border-sky-900/50 text-sky-300">
              Student: <strong className="text-sky-200 font-extrabold">{stats.student}</strong>
            </span>
            {stats.system > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/80 text-slate-400">
                System: <strong className="text-slate-200 font-extrabold">{stats.system}</strong>
              </span>
            )}
          </div>
          <div className="hidden lg:flex items-center gap-1 text-[10.5px] text-indigo-300/70 font-mono">
            <span>● Tamper-Proof Trail</span>
          </div>
        </div>
      </div>

      {/* ─── GOOGLE-STYLE SEARCH & UNIFIED COMPACT FILTERS ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xs border border-slate-200 dark:border-slate-800 p-2 sm:p-2.5 space-y-1.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          {/* Google-like Keyword Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Google-like search (e.g., 'botany marks', 'teacher submit', roll no, email, dates)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Dropdowns Grouped on Same Row */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
            {/* Actor Filter */}
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="text-xs font-semibold py-1.2 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
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
              className="text-xs font-semibold py-1.2 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
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
              className="text-xs font-semibold py-1.2 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Actions</option>
              <option value="update">Updates</option>
              <option value="submit">Submissions</option>
              <option value="create">Creations</option>
              <option value="delete">Deletions</option>
              <option value="export">Exports</option>
            </select>

            {/* Date Range Preset */}
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="text-xs font-semibold py-1.2 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Time</option>
              <option value="today">Past 24h</option>
              <option value="7d">Past 7d</option>
              <option value="30d">Past 30d</option>
            </select>
          </div>
        </div>

        {/* Status Line & Active Search Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <Filter className="w-3 h-3 text-indigo-500" />
              Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredLogs.length}</strong> of {logs.length} events
            </span>

            {parsedSearch.must.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-semibold border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Google Search: {parsedSearch.must.map(m => `"${m}"`).join(' + ')}
              </span>
            )}
            {parsedSearch.mustNot.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10.5px] font-semibold border border-rose-200 dark:border-rose-800">
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
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* ─── ACTIVITY TRAIL TABLE (Compact View) ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xs border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-[10.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Action & Details</th>
                <th className="py-2.5 px-3">Target / Reference</th>
                <th className="py-2.5 px-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.map((log) => {
                const logDate = parseLogDate(log);
                const categoryColor = CATEGORY_COLORS[log.actionCategory] || CATEGORY_COLORS.general;
                const actorBadge = ACTOR_BADGES[log.actorType] || ACTOR_BADGES.system;

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition cursor-pointer"
                    onClick={() => setInspectedLog(log)}
                  >
                    {/* Timestamp */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white text-[11px]">
                        {logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-[9.5px] text-slate-400">
                        {logDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>

                    {/* Actor Details */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase tracking-wider border ${actorBadge}`}>
                          {log.actorType || 'User'}
                        </span>
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                          <HighlightText text={log.actorName || log.adminName || 'Unknown'} query={searchQuery} />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px] mt-0.5">
                        <HighlightText text={log.actorEmail || log.adminEmail || '—'} query={searchQuery} />
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider border ${categoryColor}`}>
                        {log.actionCategory || 'General'}
                      </span>
                    </td>

                    {/* Action Title & Details */}
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5 flex-wrap">
                        <HighlightText text={log.actionTitle} query={searchQuery} />
                        {log.actionType && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono uppercase">
                            {log.actionType}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-1 mt-0.5">
                        <HighlightText text={log.details || log.actionTitle} query={searchQuery} />
                      </div>
                    </td>

                    {/* Target / Reference */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {log.targetId ? (
                        <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                          <HighlightText text={log.targetId} query={searchQuery} />
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Inspect Button */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedLog(log);
                        }}
                        className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 transition cursor-pointer"
                        title="Inspect full dispute evidence"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <History className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No activity logs found matching the filter</p>
                    <p className="text-xs text-slate-500 mt-1">Try broadening your date range or adjusting keyword filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Pagination (Ensures Minimum Reads from Firebase) */}
        {hasMore && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  Loading older audit events...
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-indigo-500" />
                  Load More History ({PAGE_SIZE} Records)
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3 h-3 text-indigo-500" />
                    Verified Actor Identity
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs">
                    {inspectedLog.actorName || inspectedLog.adminName || 'System'}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate">
                    {inspectedLog.actorEmail || inspectedLog.adminEmail || '—'}
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
                      {inspectedLog.actorRole || 'Official'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Type: {inspectedLog.actorType || 'User'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    Timestamp & Context
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs">
                    {parseLogDate(inspectedLog).toLocaleString([], { dateStyle: 'full', timeStyle: 'medium' })}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Target Ref: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{inspectedLog.targetId || 'N/A'}</span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    Reason: {inspectedLog.reasonCategory || 'Standard Operation'}
                  </div>
                </div>
              </div>

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
