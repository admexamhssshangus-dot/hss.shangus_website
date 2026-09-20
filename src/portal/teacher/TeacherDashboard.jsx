import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { 
  History, CalendarCheck, LogOut,
  ArrowRight, Award, X, Clock, RefreshCw, Search, Printer
} from 'lucide-react';
import SEO from '../../components/SEO';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { getCachedCollection, invalidateCollectionCache } from '../../services/dbCache';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { printHistoricalSubmission, isSubmissionOwnedByTeacher } from '../../utils/practicalsPdfGenerator';
import { isBootstrapAdminEmail, isBootstrapSuperAdminEmail } from '../../utils/authRoles';
import { showToast } from '../../components/common/GlobalToast';

export default function TeacherDashboard() {
  const { user, onLogout } = useOutletContext();
  const navigate = useNavigate();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogoutRequest = () => setShowLogoutConfirm(true);

  // Determine administrator status (teachers only see their own submissions; admins can view all)
  const userEmail = (user?.email || auth.currentUser?.email || '').toLowerCase().trim();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || isBootstrapAdminEmail(userEmail) || isBootstrapSuperAdminEmail(userEmail);
  const [adminShowAllFaculty, setAdminShowAllFaculty] = useState(false);

  // Server-side practical count (0 docs downloaded)
  const [practicalCount, setPracticalCount] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const countSnap = await getCountFromServer(collection(db, 'practicalsData'));
        if (active && countSnap?.data) {
          setPracticalCount(countSnap.data().count || 0);
        }
      } catch (_) {}
    })();
    return () => { active = false; };
  }, []);

  // Submission History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const fetchSubmissionHistory = useCallback(async (force = true) => {
    setLoadingHistory(true);
    try {
      if (force) {
        invalidateCollectionCache('practicalsData');
      }
      let rawDocs = [];
      try {
        const snap = await getDocs(collection(db, 'practicalsData'));
        if (!snap.empty) {
          rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (err) {
        console.warn('Direct getDocs failed, falling back to cache:', err);
        rawDocs = await getCachedCollection('practicalsData', force, 5 * 60 * 1000).catch(() => []);
      }

      if (Array.isArray(rawDocs) && rawDocs.length > 0) {
        const list = rawDocs
          .filter(d => {
            if (!d) return false;
            const rawId = String(d.id || d.docId || '');
            if (rawId.startsWith('history_')) return false;

            const recCount = Array.isArray(d.records) ? d.records.length : (Array.isArray(d.students) ? d.students.length : 0);
            const subj = String(d.subject || d.subjectName || d.subjectCode || '').trim();
            const hasValidSubject = subj.length > 0 && subj.toLowerCase() !== 'n/a' && subj.toLowerCase() !== 'null';

            // Filter out shell/corrupted records that have 0 students or no valid subject
            if (recCount === 0 || !hasValidSubject) return false;
            return true;
          })
          .map(d => {
            const rawId = String(d.id || d.docId || '');
            const evalType = d.practicalType || d.evaluationType || d.examTitle || d.title || 'Assessment';
            
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
              practicalType: evalType,
              evaluationType: evalType,
              yearSuffix: d.yearSuffix || d.sessionCanonical || d.session || '',
              recordsCount: Array.isArray(d.records) ? d.records.length : (Array.isArray(d.students) ? d.students.length : 0),
              displayDate,
              sortTime
            };
          })
          .sort((a, b) => b.sortTime - a.sortTime);

        // Deduplicate duplicate items by unique compound identity
        const seen = new Set();
        const deduped = [];
        for (const item of list) {
          const key = `${item.id}_${item.className}_${item.subject}_${item.practicalType}_${item.yearSuffix}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
        }

        // Filter to only this teacher's submissions (unless administrator toggles to view all faculty)
        const filteredList = (isAdmin && adminShowAllFaculty)
          ? deduped
          : deduped.filter(item => isSubmissionOwnedByTeacher(item, user, auth.currentUser));

        setSubmissionHistory(filteredList);
        setPracticalCount(filteredList.length);
      } else {
        setSubmissionHistory([]);
        setPracticalCount(0);
      }
    } catch (e) {
      console.error('Failed to load submissions history:', e);
      setSubmissionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [user, isAdmin, adminShowAllFaculty]);

  const filteredSubmissions = useMemo(() => {
    let list = submissionHistory;
    // Extra safety guarantee: enforce teacher ownership
    if (!isAdmin || !adminShowAllFaculty) {
      list = list.filter(item => isSubmissionOwnedByTeacher(item, user, auth.currentUser));
    }

    if (!historySearch.trim()) return list;
    const q = historySearch.toLowerCase().trim();
    return list.filter(item => {
      const className = String(item.className || '').toLowerCase();
      const subject = String(item.subject || '').toLowerCase();
      const practicalType = String(item.practicalType || '').toLowerCase();
      const displayDate = String(item.displayDate || '').toLowerCase();
      const year = String(item.yearSuffix || '').toLowerCase();
      return className.includes(q) || subject.includes(q) || practicalType.includes(q) || displayDate.includes(q) || year.includes(q);
    });
  }, [submissionHistory, historySearch, user, isAdmin, adminShowAllFaculty]);

  useEffect(() => {
    if (showHistoryModal) {
      fetchSubmissionHistory(true);
    }
  }, [showHistoryModal, fetchSubmissionHistory]);

  const handleOpenHistoryModal = () => {
    setShowHistoryModal(true);
    fetchSubmissionHistory(true);
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
                <span className="font-extrabold">Submissions History{practicalCount !== null ? ` (${practicalCount})` : ''}</span>
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {isAdmin && adminShowAllFaculty ? 'All Faculty Submissions Log' : 'My Assessment Submissions Log'}
                    </h3>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setAdminShowAllFaculty(prev => !prev)}
                        className="text-[9.5px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer transition-colors shrink-0"
                      >
                        {adminShowAllFaculty ? 'Switch to: Only My Submissions' : 'Switch to: All Faculty'}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {isAdmin && adminShowAllFaculty
                      ? 'All school evaluations (Pre-Board, Practicals, Term End & Unit Tests)'
                      : 'Showing your own submitted evaluations only (Pre-Board, Practicals, Term End & Unit Tests)'}
                  </p>
                </div>
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

            {/* Quick Search Filter */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by subject, class, or test type (e.g. Physics, 11th, Pre-Board)..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs font-bold text-slate-400 space-y-2">
                <RefreshCw size={18} className="animate-spin mx-auto text-indigo-600" />
                <div>Fetching historical submissions…</div>
              </div>
            ) : filteredSubmissions.length > 0 ? (
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {filteredSubmissions.map((item, i) => {
                  const itemId = String(item.id || item.docId || '');
                  const isPending = itemId.startsWith('pending_') || item.status === 'pending_approval';
                  const isRejected = item.status === 'rejected';

                  return (
                    <div 
                      key={`${itemId || 'eval'}_${item.className}_${item.subject}_${item.practicalType}_${i}`} 
                      className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {item.className} • {item.subject}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            {item.practicalType || 'Assessment'}
                          </span>
                          {isPending ? (
                            isRejected ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                                Revision Requested
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                Pending Approval
                              </span>
                            )
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              Approved & Live
                            </span>
                          )}
                          {item.isCrossSubject && (
                            <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400">
                              Cross-Subject
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Clock size={10} className="shrink-0" />
                          <span>{item.displayDate || (item.updatedAt || item.submittedAt ? String(item.updatedAt || item.submittedAt) : 'N/A')}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">• {item.recordsCount || (item.records?.length || 0)} Students</span>
                          {item.yearSuffix && (
                            <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">• Session {item.yearSuffix}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Direct Print or Save as PDF button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAdmin && !isSubmissionOwnedByTeacher(item, user, auth.currentUser)) {
                              showToast('Access Restricted: You cannot view or print awards submitted by other teachers.', 'error');
                              return;
                            }
                            const ok = printHistoricalSubmission(item);
                            if (!ok) {
                              showToast('No student records found in this submission.', 'warning');
                            }
                          }}
                          className="h-7 px-2.5 rounded-lg text-[10.5px] font-bold bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-slate-300 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                          title="Print or Save/Download PDF of Official Award Roll"
                        >
                          <Printer size={12} className="text-indigo-600 dark:text-indigo-400" />
                          <span>Print / PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isAdmin && !isSubmissionOwnedByTeacher(item, user, auth.currentUser)) {
                              showToast('Access Restricted: You cannot load awards submitted by other teachers.', 'error');
                              return;
                            }
                            setShowHistoryModal(false);
                            const rawCls = String(item.className || '');
                            const cleanCls = rawCls.includes('11') ? '11th' : (rawCls.includes('12') ? '12th' : (rawCls.includes('10') ? '10th' : (rawCls.includes('9') ? '9th' : '11th')));
                            navigate('/portal/teacher/practicals', {
                              state: {
                                selectedClass: cleanCls,
                                selectedSubject: item.subject !== 'N/A' ? item.subject : 'Physics',
                                practicalType: item.practicalType,
                                yearSuffix: item.yearSuffix,
                                loadedRecord: item
                              }
                            });
                          }}
                          className="h-7 px-2.5 rounded-lg text-[10.5px] font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          Load Record
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs font-bold text-slate-400">
                {historySearch ? 'No matching submissions found for this search.' : 'No past evaluation submission records found.'}
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
