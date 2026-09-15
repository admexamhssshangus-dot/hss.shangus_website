import React, { useState, useCallback } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { 
  History, CalendarCheck, LogOut,
  ArrowRight, Award, X, Clock, RefreshCw
} from 'lucide-react';
import SEO from '../../components/SEO';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { getCachedCollection } from '../../services/dbCache';

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
      const docs = await getCachedCollection('practicalsData', false, 15 * 60 * 1000);
      if (Array.isArray(docs) && docs.length > 0) {
        const list = docs
          .filter(d => d && !String(d.id || d.docId || '').startsWith('history_'))
          .map(d => {
            const rawId = String(d.id || d.docId || '');
            
            // Safely resolve timestamp
            let sortTime = 0;
            let displayDate = 'N/A';
            const rawTime = d.updatedAt || d.submittedAt;
            if (rawTime) {
              if (typeof rawTime?.toDate === 'function') {
                const dateObj = rawTime.toDate();
                sortTime = dateObj.getTime();
                displayDate = dateObj.toLocaleString();
              } else if (rawTime?.seconds) {
                const dateObj = new Date(rawTime.seconds * 1000);
                sortTime = dateObj.getTime();
                displayDate = dateObj.toLocaleString();
              } else {
                const dateObj = new Date(rawTime);
                if (!isNaN(dateObj.getTime())) {
                  sortTime = dateObj.getTime();
                  displayDate = dateObj.toLocaleString();
                } else {
                  displayDate = String(rawTime);
                }
              }
            }

            return {
              ...d,
              id: rawId,
              className: d.className || d.class || d.selectedClass || 'N/A',
              subject: d.subject || d.subjectName || d.subjectCode || 'N/A',
              recordsCount: Array.isArray(d.records) ? d.records.length : (Array.isArray(d.students) ? d.students.length : 0),
              displayDate,
              sortTime
            };
          })
          .sort((a, b) => b.sortTime - a.sortTime);
        setSubmissionHistory(list);
      } else {
        setSubmissionHistory([]);
      }
    } catch (e) {
      console.error('Failed to load practicals history:', e);
      setSubmissionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleOpenHistoryModal = () => {
    setShowHistoryModal(true);
    fetchSubmissionHistory();
  };

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
        <div className="rounded-2xl p-2.5 sm:p-3 border shadow-xs" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          {/* Profile + Quick Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shadow-2xs flex-shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <h1 className="text-xs sm:text-sm font-black tracking-tight truncate leading-tight" style={{ color: 'var(--text-main, #0f172a)' }}>
                  {userName}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Educator
                  </span>
                  {(user?.subject || user?.teachingSubject) && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {user?.subject || user?.teachingSubject}
                    </span>
                  )}
                  {Array.isArray(user?.assignedClasses) && user.assignedClasses.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                      Class {user.assignedClasses.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleLogoutRequest}
                className="portal-compact-btn rounded-lg font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all duration-200 shadow-2xs border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white hover:border-rose-600"
                title="Sign out"
              >
                <LogOut size={11} />
                <span>Logout</span>
              </button>
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
              <span className="text-[10.5px] font-bold text-teal-700 dark:text-teal-400">
                Daily Roster
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
                <span className="font-extrabold">Submissions History</span>
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
                {submissionHistory.map((item, i) => {
                  const itemId = String(item.id || item.docId || '');
                  const isPending = itemId.startsWith('pending_') || item.status === 'pending_approval';
                  const isRejected = item.status === 'rejected';

                  return (
                    <div key={itemId || i} className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {item.className} • {item.subject} ({item.practicalType || 'Internal'})
                          </span>
                          {isPending ? (
                            isRejected ? (
                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                                Revision Requested
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                Pending Approval
                              </span>
                            )
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              Approved & Live
                            </span>
                          )}
                          {item.isCrossSubject && (
                            <span className="px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400">
                              Cross-Subject
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Clock size={10} className="shrink-0" />
                          <span>{item.displayDate || (item.updatedAt || item.submittedAt ? String(item.updatedAt || item.submittedAt) : 'N/A')}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">• {item.recordsCount || (item.records?.length || 0)} Students</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHistoryModal(false);
                          navigate('/portal/teacher/practicals', {
                            state: {
                              selectedClass: item.className !== 'N/A' ? item.className : '12th',
                              selectedSubject: item.subject !== 'N/A' ? item.subject : 'Physics',
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
                  );
                })}
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
