import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Settings, CalendarCheck, RefreshCw, Save, CheckCircle2, AlertCircle, 
  Search, BookOpen, Users, Calendar, ChevronDown, ChevronUp, 
  Eye, X, BarChart3, Database, Layers, Check, Clock, User
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import ModernLoader from '../../components/ModernLoader';
import { logAdminActivity } from '../../services/adminActivityLogger';

const MASTER_SUBJECT_NAMES = {
  'BO': 'Botany',
  'BOTANY': 'Botany',
  'BOTANY (BO)': 'Botany',
  'UR': 'Urdu',
  'URDU': 'Urdu',
  'EN': 'General English',
  'PH': 'Physics',
  'CH': 'Chemistry',
  'BI': 'Biology',
  'ZO': 'Zoology',
  'ES': 'Environmental Science',
  'PD': 'Physical Education',
  'ITE': 'IT and ITES',
  'HTC': 'Healthcare',
  'CS': 'Computer Science',
  'GG': 'Geography',
  'MA': 'Mathematics',
  'ED': 'Education',
  'HT': 'History',
  'PS': 'Political Science',
  'EC': 'Economics',
  'SO': 'Sociology',
  'GENERAL': 'General / Morning Roll Call'
};

export function formatSubjectName(sub) {
  if (!sub) return 'General Attendance';
  const clean = String(sub).trim().toUpperCase();
  return MASTER_SUBJECT_NAMES[clean] || sub;
}

export const resolveRecordClass = (r) => {
  if (!r) return 'other';
  const idParts = String(r.id || r.docId || '').split('_');
  const raw = String(r.className || r.class || r.Class || r.admittedClass || idParts[0] || '').trim().toLowerCase();
  if (raw.includes('11') || raw.includes('xi')) return '11th';
  if (raw.includes('12') || raw.includes('xii')) return '12th';
  if (raw.includes('10') || raw.includes('x')) return '10th';
  if (raw.includes('9') || raw.includes('ix')) return '9th';
  return raw || 'other';
};

export const resolveRecordDate = (r) => {
  if (!r) return '';
  const idParts = String(r.id || r.docId || '').split('_');
  return r.date || r.dateStr || (idParts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(idParts[1]) ? idParts[1] : '') || '';
};

export const resolveRecordSubject = (r) => {
  if (!r) return 'General';
  const idParts = String(r.id || r.docId || '').split('_');
  return r.subject || r.subjectName || r.subjectCode || (idParts.length >= 3 ? idParts[2] : '') || 'General';
};

const CACHE_KEY = 'hss_admin_attendance_summary_v1';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

export default function AdminAttendance() {
  const getInitialAttendanceSubTab = () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSubTab = searchParams.get('subtab');
      if (urlSubTab && ['settings', 'overview'].includes(urlSubTab)) return urlSubTab;
      const saved = sessionStorage.getItem('hss_admin_attendance_subtab');
      if (saved && ['settings', 'overview'].includes(saved)) return saved;
    } catch (_) {}
    return 'overview';
  };

  const [activeSubTab, setActiveSubTabState] = useState(getInitialAttendanceSubTab);

  const setActiveSubTab = (newTab) => {
    setActiveSubTabState(newTab);
    try {
      sessionStorage.setItem('hss_admin_attendance_subtab', newTab);
      const url = new URL(window.location.href);
      if (newTab === 'overview') {
        url.searchParams.set('subtab', 'overview');
      } else {
        url.searchParams.delete('subtab');
      }
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  };

  const [loading, setLoading] = useState(true);
  const [reaggregating, setReaggregating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Portal Controls Settings State
  const [attendanceConfig, setAttendanceConfig] = useState({
    '11th': { enabled: true, mode: 'daily' },
    '12th': { enabled: true, mode: 'daily' }
  });

  // Compact Aggregated Summary State
  const [summaryData, setSummaryData] = useState({
    totalLogs: 0,
    totalSessions: 0,
    distinctDays: 0,
    classCounts: { '11th': 0, '12th': 0, other: 0 },
    totalPresent: 0,
    overallPresentRate: 0,
    subjectGroups: [],
    dateGroups: [],
    updatedAt: null
  });

  // UI Filtering & Grouping State
  const [groupByMode, setGroupByMode] = useState('subject'); // 'subject' | 'date'
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all'); // 'all' | '11th' | '12th'
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [datePageSize, setDatePageSize] = useState(30);

  // On-demand session modal state
  const [selectedSessionSummary, setSelectedSessionSummary] = useState(null);
  const [modalSessionData, setModalSessionData] = useState(null);
  const [loadingModalData, setLoadingModalData] = useState(false);
  const sessionRosterCacheRef = useRef({});

  // Helper: compute summary from raw collection on demand (used for fallback or cloud sync)
  const computeAndSaveSummary = useCallback(async () => {
    setReaggregating(true);
    try {
      const snap = await getDocs(collection(db, 'attendance'));
      let totalLogs = 0;
      let totalPresent = 0;
      const distinctDates = new Set();
      const classCounts = { '11th': 0, '12th': 0, other: 0 };
      const subjectGroupsMap = {};
      const dateGroupsMap = {};

      snap.forEach(docSnap => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const cls = resolveRecordClass({ ...data, docId });
        const dt = resolveRecordDate({ ...data, docId });
        const sub = resolveRecordSubject({ ...data, docId });
        const subKey = `${cls}_${sub.toUpperCase()}`;

        if (dt) distinctDates.add(dt);

        let sessionTotal = 0;
        let sessionPresent = 0;

        if (Array.isArray(data.records)) {
          data.records.forEach(st => {
            sessionTotal++;
            totalLogs++;
            if (cls === '11th' || cls === '12th') {
              classCounts[cls] = (classCounts[cls] || 0) + 1;
            } else {
              classCounts.other = (classCounts.other || 0) + 1;
            }
            const s = String(st.status || '').toUpperCase();
            if (s === 'P' || s === 'PRESENT') {
              sessionPresent++;
              totalPresent++;
            }
          });
        } else if (data.status) {
          sessionTotal++;
          totalLogs++;
          if (cls === '11th' || cls === '12th') {
            classCounts[cls] = (classCounts[cls] || 0) + 1;
          } else {
            classCounts.other = (classCounts.other || 0) + 1;
          }
          const s = String(data.status || '').toUpperCase();
          if (s === 'P' || s === 'PRESENT') {
            sessionPresent++;
            totalPresent++;
          }
        }

        // Subject grouping
        if (!subjectGroupsMap[subKey]) {
          subjectGroupsMap[subKey] = {
            id: subKey,
            className: cls,
            subjectCode: sub,
            subjectFullName: formatSubjectName(sub),
            sessionsCount: 0,
            totalStudentsCount: 0,
            totalPresentCount: 0,
            earliestDate: dt,
            latestDate: dt,
            sessions: []
          };
        }
        const sg = subjectGroupsMap[subKey];
        sg.sessionsCount++;
        sg.totalStudentsCount += sessionTotal;
        sg.totalPresentCount += sessionPresent;
        if (dt) {
          if (!sg.earliestDate || dt < sg.earliestDate) sg.earliestDate = dt;
          if (!sg.latestDate || dt > sg.latestDate) sg.latestDate = dt;
        }
        sg.sessions.push({
          docId,
          date: dt,
          totalStudents: sessionTotal,
          presentStudents: sessionPresent,
          presentRate: sessionTotal > 0 ? Math.round((sessionPresent / sessionTotal) * 100) : 0,
          teacher: data.teacher || data.teacherName || data.teacherEmail || 'Faculty'
        });

        // Date grouping
        if (dt) {
          if (!dateGroupsMap[dt]) {
            dateGroupsMap[dt] = {
              date: dt,
              sessionsCount: 0,
              totalStudentsCount: 0,
              totalPresentCount: 0,
              classes: new Set(),
              subjects: new Set(),
              sessionSummaries: []
            };
          }
          const dg = dateGroupsMap[dt];
          dg.sessionsCount++;
          dg.totalStudentsCount += sessionTotal;
          dg.totalPresentCount += sessionPresent;
          dg.classes.add(cls);
          dg.subjects.add(`${formatSubjectName(sub)} (${cls})`);
          dg.sessionSummaries.push({
            docId,
            className: cls,
            subject: formatSubjectName(sub),
            subjectCode: sub,
            totalStudents: sessionTotal,
            presentStudents: sessionPresent,
            rate: sessionTotal > 0 ? Math.round((sessionPresent / sessionTotal) * 100) : 0
          });
        }
      });

      const subjectGroups = Object.values(subjectGroupsMap).map(sg => {
        sg.avgPresentRate = sg.totalStudentsCount > 0 ? Math.round((sg.totalPresentCount / sg.totalStudentsCount) * 100) : 0;
        sg.sessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return sg;
      }).sort((a, b) => b.totalStudentsCount - a.totalStudentsCount);

      const dateGroups = Object.values(dateGroupsMap).map(dg => ({
        date: dg.date,
        sessionsCount: dg.sessionsCount,
        totalStudentsCount: dg.totalStudentsCount,
        totalPresentCount: dg.totalPresentCount,
        avgPresentRate: dg.totalStudentsCount > 0 ? Math.round((dg.totalPresentCount / dg.totalStudentsCount) * 100) : 0,
        classes: Array.from(dg.classes).sort(),
        subjects: Array.from(dg.subjects).sort(),
        sessionSummaries: dg.sessionSummaries
      })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const overallPresentRate = totalLogs > 0 ? Math.round((totalPresent / totalLogs) * 100) : 0;

      const payload = {
        totalLogs,
        totalSessions: snap.size,
        distinctDays: distinctDates.size,
        classCounts,
        totalPresent,
        overallPresentRate,
        subjectGroups,
        dateGroups,
        updatedAt: new Date().toISOString(),
        isCompactSummary: true
      };

      setSummaryData(payload);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: payload, timestamp: Date.now() }));
      } catch (_) {}

      // Save summary in systemSettings
      try {
        await setDoc(doc(db, 'systemSettings', 'attendanceSummary'), payload, { merge: true });
      } catch (err) {
        console.warn('Could not persist attendanceSummary doc:', err);
      }

      setAlert({ type: 'success', text: `Successfully re-aggregated all ${totalLogs} attendance logs across ${distinctDates.size} days!` });
    } catch (err) {
      console.error('Failed to re-aggregate attendance:', err);
      setAlert({ type: 'error', text: 'Failed to re-aggregate attendance records from cloud.' });
    } finally {
      setReaggregating(false);
    }
  }, []);

  // Intelligent Demand-Basis Loader: 1 read or 0 reads
  const loadData = useCallback(async (targetTab = activeSubTab, force = false) => {
    setLoading(true);
    setAlert(null);

    if (targetTab === 'settings') {
      try {
        const configDoc = await getDoc(doc(db, 'systemSettings', 'attendanceConfig'));
        if (configDoc.exists()) {
          setAttendanceConfig(configDoc.data());
        }
      } catch (e) {
        console.warn('[AdminAttendance] Attendance config fetch note:', e);
      }
    }

    if (targetTab === 'overview') {
      // 1. Check local cache if not forced (0 reads)
      if (!force) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.data && Date.now() - (parsed.timestamp || 0) < CACHE_TTL) {
              setSummaryData(parsed.data);
              setLoading(false);
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Fetch single compact summary document from Firestore (1 read)
      try {
        const summaryDoc = await getDoc(doc(db, 'systemSettings', 'attendanceSummary'));
        if (summaryDoc.exists() && summaryDoc.data()?.isCompactSummary) {
          const data = summaryDoc.data();
          setSummaryData(data);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
          } catch (_) {}
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('[AdminAttendance] Summary doc note:', e);
      }

      // 3. If summary document doesn't exist yet, compute from collection
      await computeAndSaveSummary();
    }

    setLoading(false);
  }, [activeSubTab, computeAndSaveSummary]);

  useEffect(() => {
    loadData(activeSubTab);
  }, [activeSubTab, loadData]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      await setDoc(doc(db, 'systemSettings', 'attendanceConfig'), attendanceConfig, { merge: true });
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Updated Attendance Configuration',
        details: 'Updated institutional student attendance configuration and mode settings',
        metadata: { attendanceConfig }
      });
      setAlert({ type: 'success', text: 'Attendance configuration saved successfully.' });
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', text: 'Failed to save configuration.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // On-demand session roster modal fetch (Demand-basis read of a single session document)
  const handleOpenSessionModal = async (sessionSummary) => {
    setSelectedSessionSummary(sessionSummary);
    const docId = sessionSummary.docId;
    if (!docId) {
      setModalSessionData(sessionSummary);
      return;
    }

    // Check in-memory session cache
    if (sessionRosterCacheRef.current[docId]) {
      setModalSessionData(sessionRosterCacheRef.current[docId]);
      return;
    }

    setLoadingModalData(true);
    try {
      const snap = await getDoc(doc(db, 'attendance', docId));
      if (snap.exists()) {
        const fullData = { ...snap.data(), docId: snap.id };
        sessionRosterCacheRef.current[docId] = fullData;
        setModalSessionData(fullData);
      } else {
        setModalSessionData(sessionSummary);
      }
    } catch (err) {
      console.warn('Could not fetch single session doc:', err);
      setModalSessionData(sessionSummary);
    } finally {
      setLoadingModalData(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedSessionSummary(null);
    setModalSessionData(null);
  };

  // Filtered Subject Groups
  const filteredSubjectGroups = useMemo(() => {
    return (summaryData.subjectGroups || []).filter(group => {
      if (classFilter !== 'all') {
        if (classFilter === '11th' && !group.className.includes('11')) return false;
        if (classFilter === '12th' && !group.className.includes('12')) return false;
      }
      if (subjectFilter !== 'all') {
        if (group.subjectCode !== subjectFilter && group.subjectFullName !== subjectFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = String(group.subjectCode || '').toLowerCase();
        const name = String(group.subjectFullName || '').toLowerCase();
        const cls = String(group.className || '').toLowerCase();
        const hasMatchingSession = (group.sessions || []).some(s => (s.date || '').includes(q));
        if (!code.includes(q) && !name.includes(q) && !cls.includes(q) && !hasMatchingSession) {
          return false;
        }
      }
      return true;
    });
  }, [summaryData.subjectGroups, classFilter, subjectFilter, searchQuery]);

  // Filtered Date Groups
  const filteredDateGroups = useMemo(() => {
    return (summaryData.dateGroups || []).filter(group => {
      if (classFilter !== 'all') {
        const hasClass = (group.classes || []).some(c => c.includes(classFilter));
        if (!hasClass) return false;
      }
      if (subjectFilter !== 'all') {
        const hasSubject = (group.sessionSummaries || []).some(
          s => s.subjectCode === subjectFilter || s.subject === subjectFilter
        );
        if (!hasSubject) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dateMatch = (group.date || '').toLowerCase().includes(q);
        const subMatch = (group.subjects || []).some(s => s.toLowerCase().includes(q));
        if (!dateMatch && !subMatch) return false;
      }
      return true;
    });
  }, [summaryData.dateGroups, classFilter, subjectFilter, searchQuery]);

  // Distinct subjects list for filtering
  const distinctSubjects = useMemo(() => {
    const subs = new Set();
    (summaryData.subjectGroups || []).forEach(g => {
      if (g.subjectCode) subs.add(g.subjectCode);
    });
    return Array.from(subs).sort();
  }, [summaryData.subjectGroups]);

  if (loading) {
    return <ModernLoader moduleKey="attendance" text="Loading compact attendance…" subtext="Retrieving aggregated institutional figures." />;
  }

  return (
    <div className="space-y-3 animate-fadeIn text-slate-900 dark:text-white">
      
      {/* Header and Subtabs Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-sm flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'overview' 
                ? 'bg-amber-600 text-white shadow-2xs' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CalendarCheck size={14} />
            <span>Attendance Overview</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'settings' 
                ? 'bg-amber-600 text-white shadow-2xs' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Settings size={14} />
            <span>Class Portal Controls</span>
          </button>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => loadData(activeSubTab, true)}
            title="Refresh summary (1 Firestore read)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-black hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

          {activeSubTab === 'overview' && (
            <button
              onClick={computeAndSaveSummary}
              disabled={reaggregating}
              title="Full Re-aggregation of Cloud Attendance"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Database size={13} className={reaggregating ? 'animate-spin text-amber-500' : ''} />
              <span>{reaggregating ? 'Aggregating...' : 'Sync Cloud Aggregates'}</span>
            </button>
          )}
        </div>
      </div>

      {alert && (
        <div className={`p-3 rounded-2xl text-xs font-black border flex items-center justify-between gap-2 ${
          alert.type === 'error' 
            ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800' 
            : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {alert.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} className="p-1 hover:opacity-70 cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {/* VIEW 1: SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">Attendance Control Panel</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">Enable or disable faculty attendance submission access per class.</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              Live Gateway
            </span>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-3">
            {['11th', '12th'].map((cls) => (
              <div key={cls} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-black text-xs text-slate-900 dark:text-white block">Class {cls} Attendance Submissions</span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Allow subject teachers to submit daily roll call</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className={`w-9 h-5 rounded-full relative transition-colors ${attendanceConfig[cls]?.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${attendanceConfig[cls]?.enabled ? 'left-4.5' : 'left-0.5'}`} />
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={attendanceConfig[cls]?.enabled || false}
                    onChange={(e) => setAttendanceConfig({
                      ...attendanceConfig,
                      [cls]: { ...attendanceConfig[cls], enabled: e.target.checked }
                    })}
                  />
                </label>
              </div>
            ))}

            <button 
              type="submit" 
              disabled={saving}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition-all"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Save Portal Configuration</span>
            </button>
          </form>
        </div>
      )}

      {/* VIEW 2: COMPACT MODERN ATTENDANCE OVERVIEW (GROUPED & NO UNNECESSARY READS) */}
      {activeSubTab === 'overview' && (
        <div className="space-y-3">
          
          {/* Top Analytics KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Total Logs Logged</span>
              <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <CalendarCheck size={16} className="text-amber-600" />
                <span>{summaryData.totalLogs}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 block">{summaryData.distinctDays} Unique Days • {summaryData.totalSessions} Registers</span>
            </div>

            <div className="p-2.5 rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/30 dark:bg-teal-950/20 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400 block">Class 11th Submissions</span>
              <div className="text-lg font-black text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                <Users size={16} />
                <span>{summaryData.classCounts['11th'] || 0}</span>
              </div>
              <span className="text-[10px] font-bold text-teal-600/80 dark:text-teal-400/80 block">Active 11th Records</span>
            </div>

            <div className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block">Class 12th Submissions</span>
              <div className="text-lg font-black text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <Users size={16} />
                <span>{summaryData.classCounts['12th'] || 0}</span>
              </div>
              <span className="text-[10px] font-bold text-blue-600/80 dark:text-blue-400/80 block">Active 12th Records</span>
            </div>

            <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Overall Present Rate</span>
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <BarChart3 size={16} />
                <span>{summaryData.overallPresentRate}%</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 block">Average Attendance</span>
            </div>
          </div>

          {/* Grouping & Filter Toolbar */}
          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
            
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Grouping Switcher */}
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black">
                <button
                  type="button"
                  onClick={() => setGroupByMode('subject')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    groupByMode === 'subject'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BookOpen size={12} />
                  <span>Group by Subject & Class ({filteredSubjectGroups.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGroupByMode('date')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    groupByMode === 'date'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar size={12} />
                  <span>Group by Date ({filteredDateGroups.length} Days)</span>
                </button>
              </div>

              {/* Class Filter */}
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black">
                {['all', '11th', '12th'].map(cls => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setClassFilter(cls)}
                    className={`px-2.5 py-1 rounded-lg transition-all uppercase cursor-pointer ${
                      classFilter === cls
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cls === 'all' ? 'All Classes' : `${cls}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Subject Select Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by date (YYYY-MM-DD), subject name or code..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              {distinctSubjects.length > 0 && (
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
                >
                  <option value="all">All Subjects ({distinctSubjects.length})</option>
                  {distinctSubjects.map(s => (
                    <option key={s} value={s}>{s} — {formatSubjectName(s)}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* MODE 1: GROUP BY SUBJECT & CLASS (HIGH-LEVEL COMPACT SUMMARY ACCORDIONS) */}
          {groupByMode === 'subject' && (
            <div className="space-y-2.5">
              {filteredSubjectGroups.map((group) => {
                const isExpanded = expandedGroups[group.id];
                const is11th = group.className.includes('11');

                return (
                  <div
                    key={group.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-all"
                  >
                    {/* Header Card */}
                    <div
                      onClick={() => toggleGroupExpand(group.id)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex-wrap gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          is11th 
                            ? 'bg-teal-500/10 text-teal-600 border border-teal-500/30' 
                            : 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                        }`}>
                          <BookOpen size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-black text-xs text-slate-900 dark:text-white">
                              {group.subjectFullName} <span className="font-mono text-slate-400">({group.subjectCode})</span>
                            </h4>
                            <span className={`px-2 py-0.2 rounded-full font-black text-[10px] ${
                              is11th ? 'bg-teal-600 text-white' : 'bg-blue-600 text-white'
                            }`}>
                              Class {group.className}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                            Latest Log: <strong className="text-slate-700 dark:text-slate-300">{group.latestDate || '—'}</strong> • {group.sessionsCount} Registers Logged • {group.totalStudentsCount} Marked Records
                          </span>
                        </div>
                      </div>

                      {/* Right Metrics & Expand Arrow */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1 text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                          <CheckCircle2 size={12} />
                          <span>{group.avgPresentRate}% Avg Attendance</span>
                        </div>

                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Session Log Table (Compact figures, no student spam) */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-2.5 space-y-1.5">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead>
                            <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                              <th className="pb-1 px-2">Attendance Date</th>
                              <th className="pb-1 px-2">Teacher / In-Charge</th>
                              <th className="pb-1 px-2">Students Marked</th>
                              <th className="pb-1 px-2">Present Rate</th>
                              <th className="pb-1 px-2 text-right">Register Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                            {(group.sessions || []).map((session, sIdx) => (
                              <tr key={session.docId || sIdx} className="hover:bg-white dark:hover:bg-slate-900/80">
                                <td className="py-1.5 px-2 font-black text-indigo-700 dark:text-indigo-400 font-mono">
                                  {session.date || '—'}
                                </td>
                                <td className="py-1.5 px-2 text-slate-600 dark:text-slate-300 text-[11px]">
                                  {session.teacher || 'Faculty Member'}
                                </td>
                                <td className="py-1.5 px-2 font-black text-slate-800 dark:text-slate-200">
                                  {session.totalStudents} Students
                                </td>
                                <td className="py-1.5 px-2">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                                    {session.presentStudents}/{session.totalStudents} ({session.presentRate}%)
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSessionModal({
                                      ...session,
                                      className: group.className,
                                      subject: group.subjectFullName,
                                      subjectCode: group.subjectCode
                                    })}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-black text-[11px] border border-indigo-200 dark:border-indigo-800/50 cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Eye size={11} />
                                    <span>View Register</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredSubjectGroups.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No attendance subject groups found matching your filter criteria.
                </div>
              )}
            </div>
          )}

          {/* MODE 2: GROUP BY DATE (COMPACT TIMELINE) */}
          {groupByMode === 'date' && (
            <div className="space-y-2.5">
              {filteredDateGroups.slice(0, datePageSize).map((group) => (
                <div
                  key={group.date}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-black">
                        <Calendar size={13} />
                      </div>
                      <strong className="font-mono text-xs font-black text-slate-900 dark:text-white">
                        {group.date}
                      </strong>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        {group.avgPresentRate}% Overall Present
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500">
                      {group.sessionsCount} Registers • {group.totalStudentsCount} Students
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                    {(group.sessionSummaries || []).map((session, rIdx) => (
                      <div
                        key={session.docId || rIdx}
                        onClick={() => handleOpenSessionModal({
                          ...session,
                          date: group.date
                        })}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition-all text-xs"
                      >
                        <div>
                          <span className="font-black text-slate-900 dark:text-white block text-[11px]">
                            {session.subject} ({session.subjectCode})
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Class {session.className} • {session.presentStudents}/{session.totalStudents} ({session.rate}%)
                          </span>
                        </div>
                        <Eye size={13} className="text-slate-400 hover:text-indigo-600" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {filteredDateGroups.length > datePageSize && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setDatePageSize(prev => prev + 30)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    Load More Dates ({filteredDateGroups.length - datePageSize} remaining)
                  </button>
                </div>
              )}

              {filteredDateGroups.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No attendance records found for the selected date criteria.
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* DETAIL MODAL: ON-DEMAND FETCH OF STUDENT ATTENDANCE ROSTER */}
      {selectedSessionSummary && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-300 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white">
            
            {/* Header */}
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">
                  <CalendarCheck size={16} />
                </div>
                <div>
                  <h3 className="font-black text-xs sm:text-sm leading-tight">
                    {formatSubjectName(selectedSessionSummary.subject || selectedSessionSummary.subjectCode)} — Class {selectedSessionSummary.className}
                  </h3>
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-black">
                    Date: {selectedSessionSummary.date || '—'} • Teacher: {selectedSessionSummary.teacher || 'Faculty'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {loadingModalData ? (
              <div className="p-12 text-center space-y-2">
                <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs font-bold text-slate-500">Fetching session student roster on demand...</p>
              </div>
            ) : (() => {
              const modalRecords = Array.isArray(modalSessionData?.records) && modalSessionData.records.length > 0
                ? modalSessionData.records
                : [{
                    rollNo: modalSessionData?.rollNo || modalSessionData?.classRollNo || '—',
                    name: modalSessionData?.studentName || modalSessionData?.name || 'Class Student',
                    status: modalSessionData?.status || 'P'
                  }];
              const totalMarked = modalRecords.length;
              const totalPresent = modalRecords.filter(s => String(s.status || '').toUpperCase() === 'P' || String(s.status || '').toUpperCase() === 'PRESENT').length;
              const totalAbsent = modalRecords.filter(s => String(s.status || '').toUpperCase() === 'A' || String(s.status || '').toUpperCase() === 'ABSENT').length;

              return (
                <>
                  {/* Quick Stats Banner */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-center">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Total Marked</span>
                      <strong className="text-sm font-black">{totalMarked}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200">
                      <span className="text-[10px] font-black uppercase block">Present (P)</span>
                      <strong className="text-sm font-black">{totalPresent}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200">
                      <span className="text-[10px] font-black uppercase block">Absent (A)</span>
                      <strong className="text-sm font-black">{totalAbsent}</strong>
                    </div>
                  </div>

                  {/* Students List Table */}
                  <div className="p-3 overflow-y-auto flex-1">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-slate-900 text-slate-400 font-black text-[10px] uppercase border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-1.5 px-2">Roll No</th>
                          <th className="py-1.5 px-2">Student Name / ID</th>
                          <th className="py-1.5 px-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                        {modalRecords.map((st, idx) => {
                          const s = String(st.status || '').toUpperCase();
                          const isP = s === 'P' || s === 'PRESENT';
                          const isL = s === 'L' || s === 'LEAVE';

                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-1.5 px-2 font-mono font-black text-amber-600 dark:text-amber-400">
                                {st.classRollNo || st.rollNo || idx + 1}
                              </td>
                              <td className="py-1.5 px-2 font-black text-slate-800 dark:text-slate-200">
                                {st.studentName || st.name || `Student #${st.classRollNo || st.rollNo || idx + 1}`}
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  isP 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                    : isL 
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                }`}>
                                  {isP ? 'Present (P)' : isL ? 'Leave (L)' : 'Absent (A)'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
