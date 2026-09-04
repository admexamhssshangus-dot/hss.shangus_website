import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { 
  UserCheck, CalendarCheck, LogOut,
  ArrowRight, ShieldCheck, CheckCircle2, Award, Users, BookOpen
} from 'lucide-react';
import SEO from '../../components/SEO';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { getCachedCollection } from '../../services/dbCache';
import { getAssignedClassRollNumber } from '../../utils/studentApprovalStatus';
import { toLocalDateKey } from '../../utils/localDate';

export default function TeacherDashboard() {
  const { user, onLogout } = useOutletContext();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogoutRequest = () => setShowLogoutConfirm(true);
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

      // Parallelize all cache/firestore calls simultaneously using SWR (Stale-While-Revalidate)
      const [masterDocsRes, admDocsRes, attDocsRes, pracDocsRes] = await Promise.allSettled([
        getCachedCollection('masterRegisters', false, 15 * 60 * 1000).catch(() => []),
        getCachedCollection('admissions', false, 15 * 60 * 1000).catch(() => []),
        getCachedCollection('attendance', false, 5 * 60 * 1000).catch(() => []),
        getCachedCollection('practicalsData', false, 5 * 60 * 1000).catch(() => [])
      ]);

      const masterDocs = masterDocsRes.status === 'fulfilled' ? masterDocsRes.value : [];
      const admDocs = admDocsRes.status === 'fulfilled' ? admDocsRes.value : [];
      const attDocs = attDocsRes.status === 'fulfilled' ? attDocsRes.value : [];
      const pracDocs = pracDocsRes.status === 'fulfilled' ? pracDocsRes.value : [];

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
      const practicalCount = Array.isArray(pracDocs) ? pracDocs.length : 0;
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

      <div className="max-w-6xl mx-auto space-y-2.5">
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

          {/* Row 2: Minimal Stat Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-black pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1 flex-shrink-0">
              <Users size={12} className="text-teal-600 dark:text-teal-400" />
              <span>{stats.totalStudents ?? 0} Students</span>
            </span>

            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1 flex-shrink-0">
              <BookOpen size={12} className="text-indigo-600 dark:text-indigo-400" />
              <span>{stats.totalClasses ?? 0} Classes</span>
            </span>

            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 flex-shrink-0">
              <CheckCircle2 size={12} className="text-emerald-600" />
              <span>Session {stats.sessionLabel || 'Not configured'}</span>
            </span>

            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 flex-shrink-0">
              <ShieldCheck size={12} className="text-amber-600" />
              <span>Verified</span>
            </span>
          </div>
        </div>

        {/* Quick Action Navigation Grid (2 Compact Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
          {/* Card 1: Student Attendance Portal */}
          <div className="rounded-2xl p-3 border shadow-2xs space-y-2 transition-all hover:shadow-xs flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-500/20 shadow-2xs flex-shrink-0">
                  <CalendarCheck size={16} />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black" style={{ color: 'var(--text-main, #0f172a)' }}>
                    Mark Daily Attendance
                  </h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-tight">
                    Class 11th & 12th Attendance & Holidays Manager
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 flex items-center gap-1">
                <CheckCircle2 size={11} /> Today: {stats.todayAttendancePct} Marked
              </span>
              <Link
                to="/portal/teacher/attendance"
                className="px-3 py-1.5 rounded-xl text-xs font-black text-white bg-teal-600 hover:bg-teal-500 shadow-xs transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Open Attendance</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 2: Practical Evaluation Portal */}
          <div className="rounded-2xl p-3 border shadow-2xs space-y-2 transition-all hover:shadow-xs flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-2xs flex-shrink-0">
                  <UserCheck size={16} />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black" style={{ color: 'var(--text-main, #0f172a)' }}>
                    Practical Evaluation Portal
                  </h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-tight">
                    JKBOSE Lab Practical Award Lists & Viva Marks
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Award size={11} /> {stats.practicalsSubmitted} Submissions
              </span>
              <Link
                to="/portal/teacher/practicals"
                className="px-3 py-1.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Open Practicals</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>

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
