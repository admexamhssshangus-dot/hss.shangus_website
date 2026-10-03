import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2, Clock, X, Search, RefreshCw, Printer, AlertTriangle,
  Award, Eye, FileText, Check, ChevronDown, Filter, Trash2, Edit3,
  Shield, CheckSquare, Sparkles, User, AlertCircle
} from 'lucide-react';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getCachedCollection, invalidateCollectionCache } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { showToast } from '../../components/common/GlobalToast';
import ConfirmModal from '../components/ConfirmModal';
import { sanitizeForFirestore } from '../../utils/firestoreSanitizer';
import { saveVersionToBin, moveSubmissionToRecycleBin } from '../../services/practicalsBinService';
import { isSchoolAssessmentType } from '../../utils/evaluationTypes';
import { printIndividualAwardRoll } from '../../utils/practicalsPdfGenerator';
import PracticalsRecycleBinModal from './PracticalsRecycleBinModal';

export default function SchoolAssessmentApprovalsView({ allStudents = [], onPendingCountChange }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterSession, setFilterSession] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('pending'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState(null); // Inspection modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    badgeText: '',
    confirmText: '',
    confirmBtnStyle: 'success',
    icon: CheckCircle2,
    onConfirm: () => {}
  });

  // Revision Modal state
  const [revisionModal, setRevisionModal] = useState({
    isOpen: false,
    sub: null,
    reason: ''
  });

  const processRawDocs = useCallback((rawDocs) => {
    // Filter strictly to School-Based Assessments (NOT practical evaluations)
    const assessmentDocs = (rawDocs || [])
      .filter(d => {
        if (!d) return false;
        const rawId = String(d.id || d.docId || '');
        if (rawId.startsWith('history_') || rawId.startsWith('bin_')) return false;

        const recCount = Array.isArray(d.records) ? d.records.length : (Array.isArray(d.students) ? d.students.length : 0);
        if (recCount === 0) return false;

        const evalType = d.practicalType || d.evaluationType || d.examTitle || d.title || '';
        return isSchoolAssessmentType(evalType);
      })
      .map(d => {
        const rawId = String(d.id || d.docId || '');
        const isPending = rawId.startsWith('pending_') || d.status === 'pending_approval';
        const isRejected = d.status === 'rejected';
        const isApproved = d.status === 'approved' && !rawId.startsWith('pending_');

        const records = Array.isArray(d.records) ? d.records : (Array.isArray(d.students) ? d.students : []);
        const evalType = d.practicalType || d.evaluationType || d.examTitle || d.title || 'Pre-Board Test';
        const targetDocId = d.targetDocId || d.canonicalDocId || rawId.replace(/^pending_/, '');

        // Resolve sort timestamp
        let sortTime = 0;
        const rawTime = d.updatedAt || d.submittedAt;
        if (rawTime) {
          if (typeof rawTime?.toDate === 'function') sortTime = rawTime.toDate().getTime();
          else if (rawTime?.seconds) sortTime = rawTime.seconds * 1000;
          else sortTime = new Date(rawTime).getTime() || 0;
        }

        return {
          ...d,
          id: rawId,
          targetDocId,
          records,
          recordsCount: records.length,
          className: d.className || d.class || '11th',
          subject: d.subject || d.subjectName || d.subjectCode || 'General English',
          evaluationType: evalType,
          session: d.yearSuffix || d.sessionCanonical || d.session || '2025-26',
          isPending,
          isRejected,
          isApproved,
          sortTime
        };
      })
      .sort((a, b) => b.sortTime - a.sortTime);

    setSubmissions(assessmentDocs);

    const pendingCount = assessmentDocs.filter(d => d.isPending && !d.isRejected).length;
    if (typeof onPendingCountChange === 'function') {
      onPendingCountChange(pendingCount);
    }
  }, [onPendingCountChange]);

  const fetchSubmissions = useCallback(async (force = false) => {
    setLoading(true);
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
        console.warn('Direct getDocs failed, attempting cache:', err);
        rawDocs = await getCachedCollection('practicalsData', force, 5 * 60 * 1000).catch(() => []);
      }
      processRawDocs(rawDocs);
    } catch (err) {
      console.error('Failed to load assessment submissions:', err);
      showToast('Error loading school assessment submissions', 'error');
    } finally {
      setLoading(false);
    }
  }, [processRawDocs]);

  // Real-time Firestore sync: ensures teacher submissions, approvals, and revisions reflect immediately
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'practicalsData'), (snap) => {
      const rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      processRawDocs(rawDocs);
      setLoading(false);
    }, (err) => {
      console.warn('Real-time assessment approvals sync note, falling back to manual fetch:', err);
      fetchSubmissions(false);
    });

    return () => {
      try { unsub(); } catch (_) {}
    };
  }, [processRawDocs, fetchSubmissions]);

  // Derived filter options
  const sessions = useMemo(() => {
    const s = new Set(submissions.map(d => d.session).filter(Boolean));
    return ['ALL', ...Array.from(s)];
  }, [submissions]);

  const evaluationTypes = useMemo(() => {
    const s = new Set(submissions.map(d => d.evaluationType).filter(Boolean));
    return ['ALL', ...Array.from(s)];
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      if (filterClass !== 'ALL' && sub.className !== filterClass) return false;
      if (filterSession !== 'ALL' && sub.session !== filterSession) return false;
      if (filterType !== 'ALL' && sub.evaluationType !== filterType) return false;

      if (filterStatus === 'pending') {
        if (!sub.isPending || sub.isRejected) return false;
      } else if (filterStatus === 'rejected') {
        if (!sub.isRejected) return false;
      } else if (filterStatus === 'approved') {
        if (!sub.isApproved) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const str = `${sub.className} ${sub.subject} ${sub.evaluationType} ${sub.submittedBy || ''} ${sub.teacherEmail || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, filterClass, filterSession, filterType, filterStatus, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    submissions.forEach(s => {
      if (s.isPending && !s.isRejected) pending++;
      else if (s.isApproved) approved++;
      else if (s.isRejected) rejected++;
    });
    return { pending, approved, rejected, total: submissions.length };
  }, [submissions]);

  // ── Approval Handler ─────────────────────────────────────────────
  const handleApprove = (sub) => {
    if (!sub) return;
    const targetDocId = sub.targetDocId;

    setConfirmModal({
      isOpen: true,
      title: 'Approve School Assessment Awards?',
      subtitle: `Approve and integrate ${sub.evaluationType} marks for ${sub.subject} (${sub.className}) submitted by ${sub.submittedBy || 'Teacher'} (${sub.recordsCount} students). This will publish marks to school records.`,
      badgeText: 'Assessment Approval',
      confirmText: 'Approve & Integrate',
      confirmBtnStyle: 'success',
      icon: CheckCircle2,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
          const canonicalRef = doc(db, 'practicalsData', targetDocId);
          const canonicalSnap = await getDoc(canonicalRef);

          if (canonicalSnap.exists()) {
            const canonicalData = canonicalSnap.data();
            if (canonicalData && Array.isArray(canonicalData.records) && canonicalData.records.length > 0) {
              await saveVersionToBin(targetDocId, canonicalData, 'admin_approved_overwrite', {
                name: auth.currentUser?.displayName || 'Administrator',
                email: auth.currentUser?.email
              }).catch(() => {});
            }
          }

          const { id: _ignoreId, isPending, isRejected, isApproved, sortTime, recordsCount, ...cleanData } = sub;
          delete cleanData.rejectionReason;
          delete cleanData.rejectedAt;
          delete cleanData.rejectedBy;

          const canonicalPayload = sanitizeForFirestore({
            ...cleanData,
            id: targetDocId,
            docId: targetDocId,
            status: 'approved',
            isDraft: false,
            isPendingApproval: false,
            approvedAt: new Date().toISOString(),
            approvedBy: auth.currentUser?.email || 'Administrator',
            lastIntegratedAt: new Date().toISOString()
          });

          await setDoc(canonicalRef, canonicalPayload);
          if (sub.id.startsWith('pending_')) {
            await deleteDoc(doc(db, 'practicalsData', sub.id));
          }

          invalidateCollectionCache('practicalsData');

          logAdminActivity({
            actionType: 'approve',
            actionTitle: 'Approved School Assessment Submission',
            details: `Approved ${sub.evaluationType} for ${sub.subject} (${sub.className}) submitted by ${sub.submittedBy || 'Teacher'} (${sub.recordsCount} students)`,
            metadata: { targetDocId, pendingId: sub.id, evaluationType: sub.evaluationType }
          });

          showToast(`Successfully approved ${sub.evaluationType} for ${sub.subject}!`, 'success');
          fetchSubmissions(true);
        } catch (err) {
          console.error('Failed to approve assessment:', err);
          showToast(`Approval failed: ${err.message || err}`, 'error');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  // ── Revision Request Handler ──────────────────────────────────────
  const handleOpenRevision = (sub) => {
    setRevisionModal({
      isOpen: true,
      sub,
      reason: ''
    });
  };

  const handleConfirmRevision = async () => {
    const { sub, reason } = revisionModal;
    if (!sub) return;

    setActionLoading(true);
    try {
      const pendingDocRef = doc(db, 'practicalsData', sub.id);
      await setDoc(pendingDocRef, sanitizeForFirestore({
        status: 'rejected',
        rejectionReason: reason.trim() || 'Please re-verify student marks and resubmit.',
        rejectedAt: new Date().toISOString(),
        rejectedBy: auth.currentUser?.email || 'Administrator'
      }), { merge: true });

      invalidateCollectionCache('practicalsData');

      logAdminActivity({
        actionType: 'reject',
        actionTitle: 'Requested Revision for School Assessment',
        details: `Requested revision for ${sub.evaluationType} in ${sub.subject} (${sub.className}): "${reason || 'No comments'}"`,
        metadata: { docId: sub.id, reason }
      });

      showToast(`Revision requested for ${sub.subject} (${sub.className}).`, 'info');
      setRevisionModal({ isOpen: false, sub: null, reason: '' });
      fetchSubmissions(true);
    } catch (err) {
      console.error('Failed to request revision:', err);
      showToast(`Action failed: ${err.message || err}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Deletion Handler ─────────────────────────────────────────────
  const handleDeleteSubmission = (sub) => {
    if (!sub) return;
    const label = `${sub.subject || 'Subject'} (${sub.className || 'Class'}) — ${sub.evaluationType || 'Assessment'}`;
    const teacher = sub.submittedBy || sub.teacherName || 'Teacher';

    setConfirmModal({
      isOpen: true,
      title: 'Move Submission to Recycle Bin?',
      subtitle: `Move the ${sub.evaluationType || 'school assessment'} submission for ${sub.subject} (${sub.className}) by ${teacher} (${sub.recordsCount} students) to the Practicals Recycle Bin? The teacher's slot will be freed so they can submit afresh.`,
      badgeText: 'Soft Delete — Recoverable',
      confirmText: 'Move to Recycle Bin',
      confirmBtnStyle: 'danger',
      icon: Trash2,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        try {
          await moveSubmissionToRecycleBin(sub, {
            name: auth.currentUser?.displayName || 'Administrator',
            email: auth.currentUser?.email || ''
          });
          invalidateCollectionCache('practicalsData');

          logAdminActivity({
            actionType: 'delete',
            actionTitle: 'Moved School Assessment Submission to Recycle Bin',
            details: `Moved ${sub.evaluationType} submission for ${sub.subject} (${sub.className}) by ${teacher} to Practicals Recycle Bin — teacher slot freed`,
            metadata: { docId: sub.id, evaluationType: sub.evaluationType, subject: sub.subject }
          });

          showToast(`Submission moved to Recycle Bin. ${teacher} can now re-submit.`, 'success');
          fetchSubmissions(true);
        } catch (err) {
          console.error('Failed to delete submission:', err);
          showToast(`Deletion failed: ${err.message || err}`, 'error');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  // ── Print Award Roll ──────────────────────────────────────────────
  const handlePrintRoll = (sub) => {
    if (!sub) return;
    const isExt = String(sub.evaluationType || '').toLowerCase().includes('ext');
    printIndividualAwardRoll({
      subjectCode: sub.subjectCode || sub.subject,
      subjectName: sub.subject,
      className: `Class ${sub.className}`,
      session: sub.session,
      records: sub.records || [],
      isExternal: isExt,
      evaluationType: sub.evaluationType,
      practicalType: sub.evaluationType,
      examTitle: sub.evaluationType,
      maxMarks: Number(sub.maxMarks) || 50,
      minMarks: Number(sub.minMarks) || 18
    });
  };

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div 
          onClick={() => setFilterStatus('pending')}
          className={`p-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            filterStatus === 'pending'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Pending Review</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {counts.pending}
          </div>
          <p className="text-[10px] text-slate-400 m-0 mt-0.5">Awaiting Administrator Approval</p>
        </div>

        <div 
          onClick={() => setFilterStatus('approved')}
          className={`p-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            filterStatus === 'approved'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Approved & Live</span>
            <CheckCircle2 size={13} className="text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {counts.approved}
          </div>
          <p className="text-[10px] text-slate-400 m-0 mt-0.5">Integrated into School Gazette</p>
        </div>

        <div 
          onClick={() => setFilterStatus('rejected')}
          className={`p-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            filterStatus === 'rejected'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Needs Revision</span>
            <AlertTriangle size={13} className="text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {counts.rejected}
          </div>
          <p className="text-[10px] text-slate-400 m-0 mt-0.5">Sent back to Teacher</p>
        </div>

        <div 
          onClick={() => setFilterStatus('all')}
          className={`p-3 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            filterStatus === 'all'
              ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Records</span>
            <FileText size={13} className="text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {counts.total}
          </div>
          <p className="text-[10px] text-slate-400 m-0 mt-0.5">All School Assessments</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[240px]">
          {/* Search input */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search subject, teacher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Class Filter */}
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Classes</option>
            <option value="9th">Class 9th</option>
            <option value="10th">Class 10th</option>
            <option value="11th">Class 11th</option>
            <option value="12th">Class 12th</option>
          </select>

          {/* Assessment Type Filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200"
          >
            {evaluationTypes.map(et => (
              <option key={et} value={et}>{et === 'ALL' ? 'All Assessment Types' : et}</option>
            ))}
          </select>

          {/* Session Filter */}
          {sessions.length > 2 && (
            <select
              value={filterSession}
              onChange={e => setFilterSession(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200"
            >
              {sessions.map(s => (
                <option key={s} value={s}>{s === 'ALL' ? 'All Sessions' : s}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRecycleBin(true)}
            className="px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="View Practicals & Assessment Recycle Bin"
          >
            <Trash2 size={12} className="text-purple-600 dark:text-purple-400" />
            <span>Recycle Bin</span>
          </button>

          <button
            type="button"
            onClick={() => fetchSubmissions(true)}
            disabled={loading || actionLoading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Reload submissions"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-teal-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="py-16 text-center text-xs font-bold text-slate-400 space-y-2">
          <RefreshCw size={20} className="animate-spin mx-auto text-teal-600" />
          <div>Loading school assessment submissions…</div>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="py-12 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 m-0">
            {filterStatus === 'pending'
              ? 'No pending assessment approvals!'
              : 'No matching assessment submissions found.'}
          </p>
          <p className="text-[11px] text-slate-400 m-0">
            {filterStatus === 'pending'
              ? 'All school-based assessments submitted by faculty have been verified and integrated.'
              : 'Try adjusting your filters or search term above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSubmissions.map((sub) => {
            const isPending = sub.isPending && !sub.isRejected;
            const isRejected = sub.isRejected;
            const isApproved = sub.isApproved;

            return (
              <div
                key={sub.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-700 rounded-xl p-3 shadow-2xs transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
              >
                {/* Left Meta */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      Class {sub.className} • {sub.subject}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                      {sub.evaluationType}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {sub.session}
                    </span>

                    {/* Status Badge */}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Pending Approval
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        Approved & Live
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertTriangle size={11} className="text-rose-600" />
                        Revision Requested
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                    <span>
                      <strong>{sub.recordsCount}</strong> examinees
                    </span>
                    {sub.submittedBy && (
                      <span>
                        Teacher: <strong>{sub.submittedBy}</strong>
                      </span>
                    )}
                    {sub.teacherEmail && (
                      <span className="text-[10px] text-slate-400">
                        ({sub.teacherEmail})
                      </span>
                    )}
                    {sub.approvedBy && isApproved && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Approved by: {sub.approvedBy}
                      </span>
                    )}
                  </div>

                  {isRejected && sub.rejectionReason && (
                    <div className="p-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300">
                      <strong>Revision feedback:</strong> {sub.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSub(sub);
                      setInspectModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Inspect Student Marks"
                  >
                    <Eye size={13} />
                    <span>Inspect</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintRoll(sub)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Print Award Roll"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>

                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenRevision(sub)}
                        disabled={actionLoading}
                        className="px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Request Revision from Teacher"
                      >
                        <Edit3 size={13} />
                        <span>Revision</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove(sub)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer active:scale-95"
                        title="Approve & Publish Marks"
                      >
                        <Check size={13} />
                        <span>Approve</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteSubmission(sub)}
                    disabled={actionLoading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                    title="Delete record"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Student Marks Modal */}
      {inspectModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-2xl space-y-3 border-slate-200 dark:border-slate-800 my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 dark:text-white truncate m-0">
                  {selectedSub.evaluationType} Marks Inspection
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">
                  Class {selectedSub.className} • {selectedSub.subject} • Session {selectedSub.session}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Marks Table */}
            <div className="overflow-y-auto flex-1 max-h-[60vh] border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">#</th>
                    <th className="py-2 px-3 w-20">Roll No</th>
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3">Father Name</th>
                    <th className="py-2 px-3 w-24 text-right">Marks / Max</th>
                    <th className="py-2 px-3 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(selectedSub.records || []).map((st, idx) => {
                    const marks = st.marks !== undefined ? st.marks : (st.practicalMarks || st.score || '—');
                    const isAbsent = String(marks).toUpperCase() === 'AB' || String(marks).toUpperCase() === 'A';
                    const maxMarks = Number(selectedSub.maxMarks) || 50;
                    const minMarks = Number(selectedSub.minMarks) || 18;
                    const numMarks = Number(marks);
                    const isPass = !isAbsent && !isNaN(numMarks) && numMarks >= minMarks;

                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {st.rollNo || st.roll || '—'}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                          {st.name || st.studentName || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                          {st.fatherName || '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                          {isAbsent ? (
                            <span className="text-rose-600 font-bold">AB</span>
                          ) : (
                            <span>{marks} <span className="text-[10px] text-slate-400">/ {maxMarks}</span></span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isAbsent ? (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-600 border border-rose-200">Absent</span>
                          ) : isPass ? (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Pass</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-600 border border-amber-200">Reappear</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0 gap-2">
              <button
                type="button"
                onClick={() => handlePrintRoll(selectedSub)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={13} />
                <span>Print Official Award Roll</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedSub.isPending && !selectedSub.isRejected && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectModalOpen(false);
                        handleOpenRevision(selectedSub);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 text-amber-800 text-xs font-bold cursor-pointer"
                    >
                      Request Revision
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectModalOpen(false);
                        handleApprove(selectedSub);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Approve & Publish
                    </button>
                  </>
                )}
                {handleDeleteSubmission && (
                  <button
                    type="button"
                    onClick={() => {
                      setInspectModalOpen(false);
                      handleDeleteSubmission(selectedSub);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Move to Recycle Bin"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision Request Feedback Modal */}
      {revisionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-2xl space-y-3 border-slate-200 dark:border-slate-800 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white m-0 flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-500" />
                Request Revision from Teacher
              </h3>
              <button
                type="button"
                onClick={() => setRevisionModal({ isOpen: false, sub: null, reason: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
              Provide feedback or specify required corrections for <strong>{revisionModal.sub?.subject} ({revisionModal.sub?.className})</strong>:
            </p>

            <textarea
              rows={3}
              value={revisionModal.reason}
              onChange={e => setRevisionModal(p => ({ ...p, reason: e.target.value }))}
              placeholder="e.g. Please verify roll numbers 12 and 18; re-check absent examinee marks."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRevisionModal({ isOpen: false, sub: null, reason: '' })}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevision}
                disabled={actionLoading}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-2xs"
              >
                Send Revision Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        subtitle={confirmModal.subtitle}
        badgeText={confirmModal.badgeText}
        confirmText={confirmModal.confirmText}
        confirmBtnStyle={confirmModal.confirmBtnStyle}
        icon={confirmModal.icon}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Practicals & Assessment Recycle Bin Modal */}
      <PracticalsRecycleBinModal
        isOpen={showRecycleBin}
        onClose={() => setShowRecycleBin(false)}
        onRestoreSuccess={() => fetchSubmissions(true)}
      />
    </div>
  );
}
