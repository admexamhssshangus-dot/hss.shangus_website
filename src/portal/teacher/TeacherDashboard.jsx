import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { 
  History, CalendarCheck, LogOut,
  ArrowRight, ShieldCheck, CheckCircle2, Users, BookOpen,
  Award, X, Clock, RefreshCw
} from 'lucide-react';
import SEO from '../../components/SEO';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { getCachedCollection } from '../../services/dbCache';
import { db } from '../../services/firebase';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { getAssignedClassRollNumber } from '../../utils/studentApprovalStatus';
import { toLocalDateKey } from '../../utils/localDate';

export default function TeacherDashboard() {
  const { user, onLogout } = useOutletContext();
  const navigate = useNavigate();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogoutRequest = () => setShowLogoutConfirm(true);

  // Submission History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchSubmissionHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const snap = await getDocs(collection(db, 'practicalsData'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        setSubmissionHistory(list);
      } else {
        setSubmissionHistory([]);
      }
    } catch (e) {
      console.error('Failed to load practicals history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleOpenHistoryModal = () => {
    setShowHistoryModal(true);
    fetchSubmissionHistory();
  };

  const [stats, setStats] = useState(() => {
    try {
      const cached = localStorage.getItem('hss_teacher_dash_stats_cache');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {
      totalStudents: 0,
      totalClasses: 0,
      todayAttendancePct: '0%',
      practicalsSubmitted: 0,
      sessionLabel: 'Not configured',
    };
  });

  // Helper: check if student is approved and has assigned class roll no
  const hasAssignedRollAndApproved = (st) => {
    if (!st) return false;
    const roll = getAssignedClassRollNumber(st);
    const hasRoll = roll !== undefined && roll !== null && String(roll).trim() !== '' && String(roll).trim() !== '—';
    const status = String(st.status || st.admissionStatus || st.ApprovalStatus || 'Approved').toLowerCase();
    const isApproved = !status.includes('reject') && !status.includes('cancel');
    return hasRoll && isApproved;
  };

  // Fetch Teacher Stats & Today's Attendance overview (Fast 0ms SWR)
  const fetchDashboardStats = useCallback(async () => {
    try {
      const todayStr = toLocalDateKey();
      const recordCandidates = [];

      const recordIdentity = (student, fallbackClass = '', fallbackSession = '') => {
        if (!hasAssignedRollAndApproved(student)) return;
        const roll = getAssignedClassRollNumber(student);
        const cls = String(student.class || student.Class || student['Admission sought for class'] || fallbackClass || '').trim();
        const session = String(student.Session || student.session || student['Academic Session'] || fallbackSession || '').trim();
        recordCandidates.push({ roll, className: cls, session });
      };

      // Load roster data plus only today's attendance and a server-side practical count.
      const [masterDocsRes, admDocsRes, attDateRes, attDateStrRes, practicalCountRes] = await Promise.allSettled([
        getCachedCollection('masterRegisters', false, 15 * 60 * 1000).catch(() => []),
        getCachedCollection('admissions', false, 15 * 60 * 1000).catch(() => []),
        getDocs(query(collection(db, 'attendance'), where('date', '==', todayStr))),
        getDocs(query(collection(db, 'attendance'), where('dateStr', '==', todayStr))),
        getCountFromServer(collection(db, 'practicalsData'))
      ]);

      const masterDocs = masterDocsRes.status === 'fulfilled' ? masterDocsRes.value : [];
      const admDocs = admDocsRes.status === 'fulfilled' ? admDocsRes.value : [];
      const attendanceById = new Map();
      [attDateRes, attDateStrRes].forEach(result => {
        if (result.status !== 'fulfilled') return;
        result.value.docs.forEach(snapshot => attendanceById.set(snapshot.id, { id: snapshot.id, ...snapshot.data() }));
      });
      const attDocs = Array.from(attendanceById.values());

      if (Array.isArray(masterDocs)) {
        masterDocs.forEach(data => {
          const items = data.items || data.data || data.records || data.students;
          if (Array.isArray(items)) {
            items.forEach(st => {
              recordIdentity(st, data.className, data.Session || data.session);
            });
          }
        });
      }

      if (Array.isArray(admDocs)) {
        admDocs.forEach(data => {
          const items = data.items || data.data || data.records || data.students;
          if (Array.isArray(items)) {
            items.forEach(st => {
              recordIdentity(st, data.className, data.Session || data.session);
            });
          } else recordIdentity(data);
        });
      }

      const sessionSet = new Set(recordCandidates.map(record => record.session).filter(Boolean));
      const activeSession = Array.from(sessionSet).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] || '';
      const activeRecords = recordCandidates.filter(record => !activeSession || !record.session || record.session === activeSession);
      const countSet = new Set(activeRecords.map(record => `${record.className || 'class'}_${record.roll}`));
      const classSet = new Set(activeRecords.map(record => record.className.toLowerCase()).filter(Boolean));
      const approvedRollCount = countSet.size;

      // Count today's unique attended students across all marked subjects (prevents >100% bug when multiple subjects submit)
      const todayAttendedStudents = new Set();
      if (Array.isArray(attDocs)) {
        attDocs.forEach(d => {
          const data = d.data ? (typeof d.data === 'function' ? d.data() : d.data) : d;
          const dDate = data.date || data.dateStr || '';
          if (dDate === todayStr && Array.isArray(data.records)) {
            const clsNorm = String(data.className || data.class || '').replace(/class/i, '').trim();
            data.records.forEach(r => {
              const roll = r.rollNo || r.classRollNo || r.name;
              if (roll) todayAttendedStudents.add(`${clsNorm}_${roll}`);
            });
          }
        });
      }

      // Count practicals
      const practicalCount = practicalCountRes.status === 'fulfilled' ? practicalCountRes.value.data().count : 0;
      const markedUniqueCount = todayAttendedStudents.size;
      const rawPct = approvedRollCount > 0 ? Math.round((markedUniqueCount / approvedRollCount) * 100) : 0;
      const pct = `${Math.min(100, Math.max(0, rawPct))}%`;

      const newStats = {
        totalStudents: approvedRollCount,
        totalClasses: classSet.size,
        todayAttendancePct: pct,
        practicalsSubmitted: practicalCount,
        sessionLabel: activeSession || 'Not configured',
      };

      setStats(newStats);
      try {
        localStorage.setItem('hss_teacher_dash_stats_cache', JSON.stringify(newStats));
      } catch (e) {}
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const userName = user?.displayName || user?.name || 'Teacher';

  return (
    <div className="portal-page w-full min-h-[85vh] py-2 sm:py-3 px-2 sm:px-4 space-y-2.5" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Teacher Workspace Dashboard"
        description="Faculty management hub for marking attendance and uploading practical evaluation marks."
        path="/portal/teacher"
      />

      <div className="max-w-6xl mx-auto space-y-2.5 pb-16">
        {/* Ultra-Minimal Header Card */}
        <div className="rounded-2xl p-2.5 sm:p-3 border shadow-xs space-y-2" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          {/* Row 1: Profile + Quick Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shadow-2xs flex-shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-xs sm:text-sm font-black tracking-tight truncate leading-tight" style={{ color: 'var(--text-main, #0f172a)' }}>
                    {userName}
                  </h1>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Educator
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleLogoutRequest}
                className="px-2.5 py-1 rounded-lg font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all duration-200 shadow-2xs"
                style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #cbd5e1' }}
                title="Sign out"
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.borderColor = '#dc2626';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.color = '#000000';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                <LogOut size={12} />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Row 2: Minimal Stat Chips — 2x2 on mobile, 4-col on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-black pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="px-2 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center gap-1.5 truncate">
              <Users size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate">{stats.totalStudents ?? 0} Students</span>
            </div>

            <div className="px-2 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center gap-1.5 truncate">
              <BookOpen size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate">{stats.totalClasses ?? 0} Classes</span>
            </div>

            <div className="px-2 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center gap-1.5 truncate">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span className="truncate">Session {stats.sessionLabel || 'Not configured'}</span>
            </div>

            <div className="px-2 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center gap-1.5 truncate">
              <ShieldCheck size={13} className="text-amber-600 shrink-0" />
              <span className="truncate">Verified Faculty</span>
            </div>
          </div>
        </div>

        {/* Quick Action Navigation Grid (2 Mobile-First Interactive Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
          {/* Card 1: Student Attendance Portal */}
          <div className="rounded-xl p-3 sm:p-3.5 border shadow-2xs space-y-2.5 transition-all hover:shadow-xs flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/25 shadow-2xs shrink-0 mt-0.5">
                  <CalendarCheck size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    Mark Daily Attendance
                  </h2>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                    Class 11th & 12th Classroom Attendance, Leaves & Holiday Management
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-teal-600" /> Today: {stats.todayAttendancePct} Marked
              </span>
              <Link
                to="/portal/teacher/attendance"
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-2xs transition-all inline-flex items-center justify-center gap-1 cursor-pointer active:scale-98"
              >
                <span>Open Attendance</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 2: Practical Evaluation Portal */}
          <div className="rounded-xl p-3 sm:p-3.5 border shadow-2xs space-y-2.5 transition-all hover:shadow-xs flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/25 shadow-2xs shrink-0 mt-0.5">
                  <Award size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    Practical Evaluation Portal
                  </h2>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                    JKBOSE Laboratory Practical Award Lists, Viva Marks & Print Rolls
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleOpenHistoryModal}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer group underline decoration-indigo-300 dark:decoration-indigo-700 underline-offset-2 bg-transparent border-none p-0 text-left"
                title="Click to view all practical award submission history & records"
              >
                <History size={13} className="text-indigo-600 dark:text-indigo-400 group-hover:rotate-[-20deg] transition-transform" />
                <span className="font-extrabold">{stats.practicalsSubmitted} Submissions</span>
              </button>
              <Link
                to="/portal/teacher/practicals"
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-2xs transition-all inline-flex items-center justify-center gap-1 cursor-pointer active:scale-98"
              >
                <span>Open Practicals</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Submission History Drawer/Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-xl space-y-3 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <History className="text-indigo-600 dark:text-indigo-400 shrink-0" size={18} />
                <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">Practicals Submission History Log</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs font-bold text-slate-400 space-y-2">
                <RefreshCw size={18} className="animate-spin mx-auto text-indigo-600" />
                <div>Fetching historical submissions…</div>
              </div>
            ) : submissionHistory.length > 0 ? (
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {submissionHistory.map((item, i) => (
                  <div key={i} className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {item.className} • {item.subject} ({item.practicalType || 'Internal'})
                      </div>
                      <div className="text-[9.5px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Clock size={10} className="shrink-0" />
                        <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">• {item.records?.length || 0} Students</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowHistoryModal(false);
                        navigate('/portal/teacher/practicals', {
                          state: {
                            selectedClass: item.className || '12th',
                            selectedSubject: item.subject || 'Physics',
                            practicalType: item.practicalType,
                            yearSuffix: item.yearSuffix
                          }
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-all cursor-pointer shrink-0 active:scale-95"
                    >
                      Load Record
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs font-bold text-slate-400">
                No past practical submission records found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onConfirm={onLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        userName={user?.name || user?.displayName}
      />
    </div>
  );
}
