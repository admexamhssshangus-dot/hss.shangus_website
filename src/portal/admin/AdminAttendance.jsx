import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, CalendarCheck, RefreshCw, Save, CheckCircle2, AlertCircle, 
  Search, Filter, BookOpen, Users, Calendar, ChevronDown, ChevronUp, 
  ChevronRight, Eye, Sparkles, Check, X, Clock, BarChart3, Layers
} from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import ModernLoader from '../../components/ModernLoader';

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

function formatSubjectName(sub) {
  if (!sub) return 'General Attendance';
  const clean = String(sub).trim().toUpperCase();
  return MASTER_SUBJECT_NAMES[clean] || sub;
}

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
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Settings State
  const [attendanceConfig, setAttendanceConfig] = useState({
    '11th': { enabled: true, mode: 'daily' },
    '12th': { enabled: true, mode: 'daily' }
  });

  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // UI Filtering & Grouping State
  const [groupByMode, setGroupByMode] = useState('subject'); // 'subject' | 'date' | 'flat'
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all'); // 'all' | '11th' | '12th'
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedRecordForModal, setSelectedRecordForModal] = useState(null);

  // Load configuration and data
  const loadData = async () => {
    setLoading(true);
    setAlert(null);

    // 1. Load Config
    try {
      const configDoc = await getDoc(doc(db, 'systemSettings', 'attendanceConfig'));
      if (configDoc.exists()) {
        setAttendanceConfig(configDoc.data());
      }
    } catch (e) {
      console.warn('[AdminAttendance] Attendance config fetch note:', e);
    }

    // 2. Load Submissions
    try {
      const querySnapshot = await getDocs(collection(db, 'attendance'));
      const records = [];
      querySnapshot.forEach(d => {
        records.push({ id: d.id, ...d.data() });
      });
      setAttendanceRecords(records);
    } catch (e) {
      console.warn('[AdminAttendance] Attendance data fetch note:', e);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      await setDoc(doc(db, 'systemSettings', 'attendanceConfig'), attendanceConfig, { merge: true });
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

  // High-Level Analytics & Metric Calculations
  const analytics = useMemo(() => {
    let totalPresent = 0;
    let totalMarked = 0;
    const distinctDates = new Set();
    const classCount = { '11th': 0, '12th': 0, other: 0 };
    const subjectCount = {};

    attendanceRecords.forEach(r => {
      const cls = (r.className || '').includes('11') ? '11th' : (r.className || '').includes('12') ? '12th' : 'other';
      classCount[cls] = (classCount[cls] || 0) + 1;

      const subKey = formatSubjectName(r.subject || r.subjectName);
      subjectCount[subKey] = (subjectCount[subKey] || 0) + 1;

      if (r.date) distinctDates.add(r.date);

      if (Array.isArray(r.records)) {
        r.records.forEach(st => {
          totalMarked++;
          if (st.status === 'P' || st.status === 'Present') totalPresent++;
        });
      }
    });

    const avgRate = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

    return {
      totalRecords: attendanceRecords.length,
      distinctDays: distinctDates.size,
      classCount,
      subjectCount,
      avgRate
    };
  }, [attendanceRecords]);

  // Distinct subjects list for filtering
  const distinctSubjects = useMemo(() => {
    const subs = new Set();
    attendanceRecords.forEach(r => {
      const sub = r.subject || r.subjectName;
      if (sub) subs.add(sub);
    });
    return Array.from(subs).sort();
  }, [attendanceRecords]);

  // Filtered Records based on Class, Subject & Search
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      if (classFilter !== 'all' && !String(r.className || '').includes(classFilter)) {
        return false;
      }
      if (subjectFilter !== 'all' && (r.subject || r.subjectName || '') !== subjectFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dateStr = String(r.date || '').toLowerCase();
        const subStr = String(r.subject || r.subjectName || '').toLowerCase();
        const fullSub = formatSubjectName(r.subject || r.subjectName).toLowerCase();
        const clsStr = String(r.className || '').toLowerCase();
        if (!dateStr.includes(q) && !subStr.includes(q) && !fullSub.includes(q) && !clsStr.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [attendanceRecords, classFilter, subjectFilter, searchQuery]);

  // Grouped by Subject & Class
  const groupedBySubject = useMemo(() => {
    const groups = {};
    filteredRecords.forEach(r => {
      const cls = r.className || 'General';
      const rawSub = r.subject || r.subjectName || 'General';
      const key = `${cls}_${rawSub}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          className: cls,
          subjectCode: rawSub,
          subjectFullName: formatSubjectName(rawSub),
          records: [],
          totalStudentsCount: 0,
          totalPresentCount: 0
        };
      }
      groups[key].records.push(r);

      // Aggregate attendance rates
      if (Array.isArray(r.records)) {
        r.records.forEach(st => {
          groups[key].totalStudentsCount++;
          if (st.status === 'P' || st.status === 'Present') {
            groups[key].totalPresentCount++;
          }
        });
      }
    });

    // Sort records inside each group by date descending
    Object.values(groups).forEach(g => {
      g.records.sort((a, b) => new Date(b.date || b.updatedAt) - new Date(a.date || a.updatedAt));
      g.latestDate = g.records[0]?.date || '—';
      g.avgPresentRate = g.totalStudentsCount > 0 
        ? Math.round((g.totalPresentCount / g.totalStudentsCount) * 100) 
        : 0;
    });

    return Object.values(groups).sort((a, b) => b.records.length - a.records.length);
  }, [filteredRecords]);

  // Grouped by Date
  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredRecords.forEach(r => {
      const dt = r.date || 'Unknown Date';
      if (!groups[dt]) {
        groups[dt] = {
          date: dt,
          records: []
        };
      }
      groups[dt].records.push(r);
    });

    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredRecords]);

  if (loading) {
    return <ModernLoader moduleKey="attendance" text="Loading attendance…" subtext="Please wait." />;
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
        
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-black hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
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

      {/* VIEW 2: COMPACT MODERN ATTENDANCE OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="space-y-3">
          
          {/* Top Analytics KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Total Logs Logged</span>
              <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <CalendarCheck size={16} className="text-amber-600" />
                <span>{analytics.totalRecords}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 block">{analytics.distinctDays} Unique Days</span>
            </div>

            <div className="p-2.5 rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/30 dark:bg-teal-950/20 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400 block">Class 11th Submissions</span>
              <div className="text-lg font-black text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                <Users size={16} />
                <span>{analytics.classCount['11th']}</span>
              </div>
              <span className="text-[10px] font-bold text-teal-600/80 dark:text-teal-400/80 block">Active 11th Registers</span>
            </div>

            <div className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block">Class 12th Submissions</span>
              <div className="text-lg font-black text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <Users size={16} />
                <span>{analytics.classCount['12th']}</span>
              </div>
              <span className="text-[10px] font-bold text-blue-600/80 dark:text-blue-400/80 block">Active 12th Registers</span>
            </div>

            <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-2xs space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Overall Present Rate</span>
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <BarChart3 size={16} />
                <span>{analytics.avgRate}%</span>
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
                  <span>Group by Subject & Class</span>
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
                  <span>Group by Date</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGroupByMode('flat')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    groupByMode === 'flat'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers size={12} />
                  <span>All Entries ({filteredRecords.length})</span>
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
            </div>
          </div>

          {/* MODE 1: GROUP BY SUBJECT & CLASS (DEFAULT - ULTRA MODERN ACCORDION CARDS) */}
          {groupByMode === 'subject' && (
            <div className="space-y-2.5">
              {groupedBySubject.map((group) => {
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
                            Latest Log: <strong className="text-slate-700 dark:text-slate-300">{group.latestDate}</strong> • {group.records.length} Submissions Logged
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

                    {/* Expandable Session Log Table */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-2.5 space-y-1.5">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead>
                            <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                              <th className="pb-1 px-2">Attendance Date</th>
                              <th className="pb-1 px-2">Submitted Time</th>
                              <th className="pb-1 px-2">Students Marked</th>
                              <th className="pb-1 px-2">Present Rate</th>
                              <th className="pb-1 px-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                            {group.records.map((rec, rIdx) => {
                              const total = rec.records?.length || 0;
                              const present = rec.records?.filter(s => s.status === 'P' || s.status === 'Present').length || 0;
                              const rate = total > 0 ? Math.round((present / total) * 100) : 0;

                              return (
                                <tr key={rIdx} className="hover:bg-white dark:hover:bg-slate-900/80">
                                  <td className="py-1.5 px-2 font-black text-indigo-700 dark:text-indigo-400 font-mono">
                                    {rec.date}
                                  </td>
                                  <td className="py-1.5 px-2 text-slate-500 text-[11px]">
                                    {new Date(rec.updatedAt).toLocaleDateString()} {new Date(rec.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-1.5 px-2 font-black text-slate-800 dark:text-slate-200">
                                    {total} Students
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                                      {present}/{total} ({rate}%)
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRecordForModal(rec)}
                                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-black text-[11px] border border-indigo-200 dark:border-indigo-800/50 cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Eye size={11} />
                                      <span>View Register</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {groupedBySubject.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No attendance records found matching filters.
                </div>
              )}
            </div>
          )}

          {/* MODE 2: GROUP BY DATE (CALENDAR STREAM) */}
          {groupByMode === 'date' && (
            <div className="space-y-2.5">
              {groupedByDate.map((group) => (
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
                    </div>
                    <span className="text-[10px] font-black text-slate-500">
                      {group.records.length} Registers Submitted
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                    {group.records.map((rec, rIdx) => {
                      const total = rec.records?.length || 0;
                      const present = rec.records?.filter(s => s.status === 'P' || s.status === 'Present').length || 0;
                      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

                      return (
                        <div
                          key={rIdx}
                          onClick={() => setSelectedRecordForModal(rec)}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition-all text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-900 dark:text-white block text-[11px]">
                              {formatSubjectName(rec.subject || rec.subjectName)} ({rec.subject})
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              Class {rec.className} • {present}/{total} ({rate}%)
                            </span>
                          </div>
                          <Eye size={13} className="text-slate-400 hover:text-indigo-600" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MODE 3: HIGH-DENSITY FLAT TABLE */}
          {groupByMode === 'flat' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 font-black text-[10px] uppercase">
                    <tr>
                      <th className="px-3 py-2">S.No</th>
                      <th className="px-3 py-2">Attendance Date</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Students</th>
                      <th className="px-3 py-2">Present Rate</th>
                      <th className="px-3 py-2">Submission Timestamp</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    {filteredRecords.map((rec, idx) => {
                      const total = rec.records?.length || 0;
                      const present = rec.records?.filter(s => s.status === 'P' || s.status === 'Present').length || 0;
                      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

                      return (
                        <tr key={rec.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 font-mono text-slate-400 font-black">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-black text-indigo-700 dark:text-indigo-400">{rec.date}</td>
                          <td className="px-3 py-2 font-black text-slate-900 dark:text-white">Class {rec.className}</td>
                          <td className="px-3 py-2 font-black">
                            {formatSubjectName(rec.subject || rec.subjectName)} <span className="font-mono text-slate-400 text-[10px]">({rec.subject})</span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-black">{total}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                              {present}/{total} ({rate}%)
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-500 font-mono">
                            {new Date(rec.updatedAt).toLocaleDateString()} {new Date(rec.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedRecordForModal(rec)}
                              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-lg font-black text-[11px] border border-indigo-200 dark:border-indigo-800/50 cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye size={11} />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan="8" className="px-3 py-8 text-center text-slate-400 font-bold">No attendance records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL: VIEW STUDENT ATTENDANCE ROSTER */}
      {selectedRecordForModal && (
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
                    {formatSubjectName(selectedRecordForModal.subject || selectedRecordForModal.subjectName)} — Class {selectedRecordForModal.className}
                  </h3>
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-black">
                    Date: {selectedRecordForModal.date} • Logged: {new Date(selectedRecordForModal.updatedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecordForModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-center">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Total Marked</span>
                <strong className="text-sm font-black">{selectedRecordForModal.records?.length || 0}</strong>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200">
                <span className="text-[10px] font-black uppercase block">Present (P)</span>
                <strong className="text-sm font-black">
                  {selectedRecordForModal.records?.filter(s => s.status === 'P' || s.status === 'Present').length || 0}
                </strong>
              </div>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200">
                <span className="text-[10px] font-black uppercase block">Absent (A)</span>
                <strong className="text-sm font-black">
                  {selectedRecordForModal.records?.filter(s => s.status === 'A' || s.status === 'Absent').length || 0}
                </strong>
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
                  {selectedRecordForModal.records?.map((st, idx) => {
                    const isP = st.status === 'P' || st.status === 'Present';
                    const isL = st.status === 'L' || st.status === 'Leave';

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
                  {(!selectedRecordForModal.records || selectedRecordForModal.records.length === 0) && (
                    <tr>
                      <td colSpan="3" className="py-6 text-center text-slate-400 font-bold">
                        No student breakdown stored for this register.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecordForModal(null)}
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
