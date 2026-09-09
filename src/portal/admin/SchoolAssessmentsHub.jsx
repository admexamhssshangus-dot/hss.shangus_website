import React, { useState, useEffect, useCallback } from 'react';
import {
  Award, Plus, Edit2, Trash2, CheckCircle2, Lock, Unlock, ExternalLink,
  Copy, Check, Users, FileText, Calendar, Clock, AlertCircle, RefreshCw,
  Save, Eye, EyeOff, ShieldCheck, CheckSquare, Square, ChevronRight,
  ArrowRight, Sparkles, BookOpen
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { DEFAULT_SCHOOL_EVALUATIONS } from '../../utils/practicalsSettingsManager';

const PRESET_EVALUATIONS = [
  {
    title: 'Pre-Board Examination 2026',
    evalType: 'Pre-Board Test',
    session: '2025-26',
    classes: ['10th', '11th', '12th'],
    allowedStatuses: ['approved'],
    maxMarks: 100,
    minMarks: 36,
    description: 'Formal pre-board examination conducted in accordance with JKBOSE board pattern.'
  },
  {
    title: 'Golden Test / Winter Assessment 2026',
    evalType: 'Golden Test',
    session: '2025-26',
    classes: ['11th', '12th'],
    allowedStatuses: ['approved'],
    maxMarks: 100,
    minMarks: 36,
    description: 'Comprehensive mid-session preparatory assessment covering complete syllabus.'
  },
  {
    title: 'Unit Test & Internal Assessment 2026',
    evalType: 'Unit Assessment',
    session: '2025-26',
    classes: ['10th', '11th', '12th'],
    allowedStatuses: ['approved', 'provisional'],
    maxMarks: 50,
    minMarks: 18,
    description: 'Routine continuous and comprehensive unit evaluation conducted by subject teachers.'
  }
];

const AVAILABLE_CLASSES = ['10th', '11th', '12th'];
const AVAILABLE_STATUSES = [
  { id: 'approved', label: 'Approved (Confirmed)', default: true },
  { id: 'provisional', label: 'Provisional Admission', default: false },
  { id: 'pending', label: 'Pending Verification', default: false }
];

export default function SchoolAssessmentsHub({ allStudents = [], onSwitchToGazette }) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Edit / Create Form Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState({
    title: 'Pre-Board Examination 2026',
    evalType: 'Pre-Board Test',
    session: '2025-26',
    classes: ['10th', '11th', '12th'],
    allowedStatuses: ['approved'],
    maxMarks: 100,
    minMarks: 36,
    isOpenForTeachers: true,
    isPublishedForStudents: true,
    description: ''
  });

  // Load configuration from Firestore
  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'adminPracticalsSettings', 'config')).catch(() => null);
      if (snap && snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.customEvaluations) && data.customEvaluations.length > 0) {
          setEvaluations(data.customEvaluations);
          setLoading(false);
          return;
        }
      }
      setEvaluations(DEFAULT_SCHOOL_EVALUATIONS);
    } catch (err) {
      console.warn('Error loading school evaluations:', err);
      setEvaluations(DEFAULT_SCHOOL_EVALUATIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  // Persist evaluations list to Firestore
  const saveEvaluationsToFirestore = async (newList) => {
    setSaving(true);
    setAlertMsg(null);
    try {
      await setDoc(doc(db, 'adminPracticalsSettings', 'config'), {
        customEvaluations: newList,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setEvaluations(newList);
      setAlertMsg({ type: 'success', text: 'School assessment settings saved live to database.' });
    } catch (err) {
      console.error('Failed to save assessment settings:', err);
      setAlertMsg({ type: 'error', text: 'Failed to save changes: ' + (err.message || 'Unknown error') });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddModal = (preset = null) => {
    if (preset) {
      setFormState({
        title: preset.title,
        evalType: preset.evalType,
        session: preset.session || '2025-26',
        classes: preset.classes || ['10th', '11th', '12th'],
        allowedStatuses: preset.allowedStatuses || ['approved'],
        maxMarks: preset.maxMarks || 100,
        minMarks: preset.minMarks || 36,
        isOpenForTeachers: true,
        isPublishedForStudents: true,
        description: preset.description || ''
      });
    } else {
      setFormState({
        title: '',
        evalType: 'Pre-Board Test',
        session: '2025-26',
        classes: ['10th', '11th', '12th'],
        allowedStatuses: ['approved'],
        maxMarks: 100,
        minMarks: 36,
        isOpenForTeachers: true,
        isPublishedForStudents: true,
        description: ''
      });
    }
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (evalItem) => {
    setFormState({
      title: evalItem.title || '',
      evalType: evalItem.evalType || 'Pre-Board Test',
      session: evalItem.session || '2025-26',
      classes: Array.isArray(evalItem.classes) ? evalItem.classes : ['10th', '11th', '12th'],
      allowedStatuses: Array.isArray(evalItem.allowedStatuses) ? evalItem.allowedStatuses : ['approved'],
      maxMarks: evalItem.maxMarks || 100,
      minMarks: evalItem.minMarks || 36,
      isOpenForTeachers: evalItem.isOpenForTeachers !== false,
      isPublishedForStudents: evalItem.isPublishedForStudents !== false,
      description: evalItem.description || ''
    });
    setEditingId(evalItem.id);
    setShowModal(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!formState.title.trim()) {
      alert('Please enter an assessment title.');
      return;
    }
    if (!formState.evalType.trim()) {
      alert('Please enter an evaluation type name.');
      return;
    }
    if (formState.classes.length === 0) {
      alert('Please select at least one class.');
      return;
    }
    if (formState.allowedStatuses.length === 0) {
      alert('Please select at least one eligible student status.');
      return;
    }

    let updatedList;
    if (editingId) {
      updatedList = evaluations.map(item => item.id === editingId ? { ...formState, id: editingId } : item);
    } else {
      const newId = `eval-${Date.now()}`;
      updatedList = [{ ...formState, id: newId }, ...evaluations];
    }

    await saveEvaluationsToFirestore(updatedList);
    setShowModal(false);
  };

  const handleDeleteEvaluation = async (id) => {
    if (!window.confirm('Are you sure you want to remove this assessment configuration? Existing marks in practicalsData will not be deleted.')) {
      return;
    }
    const updatedList = evaluations.filter(item => item.id !== id);
    await saveEvaluationsToFirestore(updatedList);
  };

  const handleToggleTeacherPortal = async (evalItem) => {
    const updatedList = evaluations.map(item =>
      item.id === evalItem.id ? { ...item, isOpenForTeachers: !item.isOpenForTeachers } : item
    );
    await saveEvaluationsToFirestore(updatedList);
  };

  const handleToggleStudentPublish = async (evalItem) => {
    const updatedList = evaluations.map(item =>
      item.id === evalItem.id ? { ...item, isPublishedForStudents: !item.isPublishedForStudents } : item
    );
    await saveEvaluationsToFirestore(updatedList);
  };

  const publicResultUrl = typeof window !== 'undefined' ? `${window.location.origin}/results` : '/results';

  const handleCopyPublicLink = () => {
    navigator.clipboard.writeText(publicResultUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100">
      {/* Alert Notification */}
      {alertMsg && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border shadow-sm ${
          alertMsg.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/50 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/50 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className={alertMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />
            <span>{alertMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMsg(null)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Info & Public Access Card with High Contrast Theme Support */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300 text-[11px] font-bold">
              <ShieldCheck size={12} className="text-teal-600 dark:text-teal-400" />
              <span>School Examination & Assessment Authority</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight m-0">
              School Assessments & Pre-Board Hub
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed m-0 font-medium">
              Define formal school-level examinations (Pre-Board Tests, Golden Tests).
              Selected evaluation types instantly appear in the Teacher Award Roll portal,
              respect eligible student status restrictions, and publish live to the student scorecard search portal.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>New Assessment</span>
            </button>
            {onSwitchToGazette && (
              <button
                type="button"
                onClick={onSwitchToGazette}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileText size={14} className="text-orange-600 dark:text-orange-400" />
                <span>View Consolidated Gazette</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadEvaluations}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh evaluations"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Public Scorecard Link Bar */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs bg-slate-50/80 dark:bg-slate-950/50 p-2.5 rounded-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-700 dark:text-slate-300 font-bold text-[11px]">Student Result Lookup:</span>
            <code className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-teal-800 dark:text-teal-300 font-mono text-[11px] font-bold">
              /results
            </code>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Searchable by Reg No / Roll No / Form No</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPublicLink}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
            >
              {copiedLink ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
            <a
              href="/results"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-xs"
            >
              <ExternalLink size={12} />
              <span>Test Student Search</span>
            </a>
          </div>
        </div>
      </div>

      {/* Quick Assessment Templates */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Sparkles size={13} className="text-amber-500" /> Instant Presets:
        </span>
        {PRESET_EVALUATIONS.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleOpenAddModal(preset)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 text-slate-800 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            + {preset.title}
          </button>
        ))}
      </div>

      {/* Configured Evaluations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {evaluations.map((item) => {
          const isTeacherOpen = item.isOpenForTeachers !== false;
          const isPublished = item.isPublishedForStudents !== false;

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all relative overflow-hidden shadow-xs hover:shadow-sm"
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                isTeacherOpen ? 'bg-teal-600' : 'bg-slate-400 dark:bg-slate-700'
              }`} />

              <div className="space-y-2.5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                      {item.session || 'Current Session'}
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1.5 leading-snug">
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      title="Edit assessment settings"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvaluation(item.id)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                      title="Delete assessment"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Eval Type Tag & Description */}
                <div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Evaluation Type:</span>
                    <strong className="text-teal-700 dark:text-teal-300 font-black">{item.evalType}</strong>
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Scope: Target Classes & Allowed Student Statuses */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Classes:</span>
                    {(Array.isArray(item.classes) ? item.classes : ['10th', '11th', '12th']).map(cls => (
                      <span key={cls} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] border border-slate-200 dark:border-slate-700">
                        {cls}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Student Status:</span>
                    {(Array.isArray(item.allowedStatuses) ? item.allowedStatuses : ['approved']).map(st => (
                      <span
                        key={st}
                        className={`px-2 py-0.5 rounded font-black text-[10px] uppercase border ${
                          st === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {st}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1 font-semibold">
                    <span>Subject Max: <strong className="text-slate-900 dark:text-white font-bold">{item.maxMarks || 100}</strong></span>
                    <span>Min Pass: <strong className="text-slate-900 dark:text-white font-bold">{item.minMarks || 36} ({Math.round(((item.minMarks || 36)/(item.maxMarks || 100))*100)}%)</strong></span>
                  </div>
                </div>
              </div>

              {/* Toggles Footer */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleTeacherPortal(item)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer border ${
                    isTeacherOpen
                      ? 'bg-teal-50 dark:bg-teal-950 text-teal-900 dark:text-teal-300 border-teal-300 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title="Toggle Teacher Marks Entry Portal open or locked"
                >
                  {isTeacherOpen ? <Unlock size={12} className="text-teal-700 dark:text-teal-400" /> : <Lock size={12} />}
                  <span>Teacher Entry: {isTeacherOpen ? 'OPEN' : 'LOCKED'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStudentPublish(item)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer border ${
                    isPublished
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title="Toggle student public lookup visibility"
                >
                  {isPublished ? <Eye size={12} className="text-emerald-700 dark:text-emerald-400" /> : <EyeOff size={12} />}
                  <span>Lookup: {isPublished ? 'LIVE' : 'DRAFT'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {evaluations.length === 0 && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <Award size={36} className="mx-auto text-slate-400 dark:text-slate-600" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300">No School Assessments Configured</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Click &ldquo;New Assessment&rdquo; or choose an instant template above to define your school pre-board examination.
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddModal(PRESET_EVALUATIONS[0])}
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-black text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles size={14} />
            <span>Enable Pre-Board Examination 2026</span>
          </button>
        </div>
      )}

      {/* Create / Edit Modal with High Contrast Fields */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {editingId ? 'Edit School Assessment' : 'Create School Assessment'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                  Configure evaluation rules, candidate status eligibility, and publishing controls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Title & Evaluation Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Assessment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.title}
                    onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                    placeholder="e.g. Pre-Board Examination 2026"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Evaluation Type Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.evalType}
                    onChange={(e) => setFormState({ ...formState, evalType: e.target.value })}
                    placeholder="e.g. Pre-Board Test"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    This exact label appears on the Teacher Evaluation portal under &ldquo;Eval. Type&rdquo;.
                  </p>
                </div>
              </div>

              {/* Session & Target Classes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Academic Session *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.session}
                    onChange={(e) => setFormState({ ...formState, session: e.target.value })}
                    placeholder="e.g. 2025-26"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Target Classes *
                  </label>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {AVAILABLE_CLASSES.map(cls => {
                      const isSelected = formState.classes.includes(cls);
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => {
                            const newClasses = isSelected
                              ? formState.classes.filter(c => c !== cls)
                              : [...formState.classes, cls];
                            setFormState({ ...formState, classes: newClasses });
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-600 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:bg-slate-200'
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* STUDENT STATUS CONTROL */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-teal-700 dark:text-teal-400" />
                    <span>Eligible Student Admission Statuses *</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-bold">
                    (Default: Approved Only)
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Only students with matching admission statuses will appear in the Teacher Award Roll portal for this test.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {AVAILABLE_STATUSES.map(st => {
                    const isChecked = formState.allowedStatuses.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          const newStatuses = isChecked
                            ? formState.allowedStatuses.filter(s => s !== st.id)
                            : [...formState.allowedStatuses, st.id];
                          setFormState({ ...formState, allowedStatuses: newStatuses });
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                          isChecked
                            ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-950 dark:text-teal-200 shadow-2xs font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 font-medium'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} className="text-teal-700 dark:text-teal-400 flex-shrink-0" />
                        ) : (
                          <Square size={16} className="text-slate-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="block text-xs truncate">{st.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Marks Scoring Scheme */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Max Marks per Subject
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={formState.maxMarks}
                    onChange={(e) => setFormState({ ...formState, maxMarks: Number(e.target.value) || 100 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Min Passing Marks
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formState.maxMarks}
                    value={formState.minMarks}
                    onChange={(e) => setFormState({ ...formState, minMarks: Number(e.target.value) || 36 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Toggles: Teacher Portal & Student Lookup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.isOpenForTeachers}
                    onChange={(e) => setFormState({ ...formState, isOpenForTeachers: e.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Teacher Award Entry</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Enable marks submission on teacher portal</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.isPublishedForStudents}
                    onChange={(e) => setFormState({ ...formState, isPublishedForStudents: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Student Result Lookup</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Make results searchable at /results</span>
                  </div>
                </label>
              </div>

              {/* Description / Circular Note */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description / Order Reference (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  placeholder="e.g. Conducted under Order No. HSS/SH/2026/EXAM-01 as pre-board diagnostic test."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{editingId ? 'Save Changes' : 'Create Assessment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
