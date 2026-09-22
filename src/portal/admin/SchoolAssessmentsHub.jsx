import React, { useState, useEffect, useCallback } from 'react';
import {
  Award, Plus, Edit2, Trash2, CheckCircle2, Lock, Unlock, ExternalLink,
  Copy, Check, Users, FileText, Calendar, Clock, AlertCircle, RefreshCw,
  Save, Eye, EyeOff, ShieldCheck, CheckSquare, Square, ChevronRight,
  ArrowRight, Sparkles, BookOpen, Layers
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { invalidateCache } from '../../services/dbCache';
import { DEFAULT_SCHOOL_EVALUATIONS, SUBJECT_CONFIG_DEFS } from '../../utils/practicalsSettingsManager';
import ConfirmModal from '../components/ConfirmModal';
import { showToast } from '../../components/common/GlobalToast';

const PRESET_EVALUATIONS = [
  {
    title: 'Pre-Board Examination 2026',
    evalType: 'Pre-Board Test',
    session: '2025-26',
    classes: ['9th', '10th', '11th', '12th'],
    allowedStatuses: ['approved'],
    maxMarks: 50,
    minMarks: 18,
    biologyDisplayMode: 'combined',
    normalizeTo50: true,
    subjectOverrides: {
      'BO': { code: 'BO', name: 'Botany', maxMarks: 25, minMarks: 9 },
      'ZO': { code: 'ZO', name: 'Zoology', maxMarks: 25, minMarks: 9 }
    },
    description: 'Formal pre-board examination conducted in accordance with JKBOSE board pattern.'
  },
  {
    title: 'Golden Test / Winter Assessment 2026',
    evalType: 'Golden Test',
    session: '2025-26',
    classes: ['9th', '10th', '11th', '12th'],
    allowedStatuses: ['approved'],
    maxMarks: 50,
    minMarks: 18,
    biologyDisplayMode: 'combined',
    normalizeTo50: true,
    subjectOverrides: {
      'BO': { code: 'BO', name: 'Botany', maxMarks: 25, minMarks: 9 },
      'ZO': { code: 'ZO', name: 'Zoology', maxMarks: 25, minMarks: 9 }
    },
    description: 'Comprehensive mid-session preparatory assessment covering complete syllabus.'
  },
  {
    title: 'Unit Test & Internal Assessment 2026',
    evalType: 'Unit Assessment',
    session: '2025-26',
    classes: ['9th', '10th', '11th', '12th'],
    allowedStatuses: ['approved', 'provisional'],
    maxMarks: 50,
    minMarks: 18,
    biologyDisplayMode: 'combined',
    normalizeTo50: true,
    subjectOverrides: {},
    description: 'Routine continuous and comprehensive unit evaluation conducted by subject teachers.'
  }
];

const AVAILABLE_CLASSES = ['9th', '10th', '11th', '12th'];
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
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Edit / Create Form Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [overrideTargetClass, setOverrideTargetClass] = useState('ALL');
  const [overrideSelectCode, setOverrideSelectCode] = useState('');
  const [overrideMaxInput, setOverrideMaxInput] = useState('');
  const [overridePassInput, setOverridePassInput] = useState('');

  const [formState, setFormState] = useState({
    title: 'Pre-Board Examination 2026',
    evalType: 'Pre-Board Test',
    session: '2025-26',
    classes: ['9th', '10th', '11th', '12th'],
    allowedStatuses: ['approved'],
    maxMarks: 50,
    minMarks: 18,
    biologyDisplayMode: 'combined',
    normalizeTo50: true,
    subjectOverrides: {
      '11th_BO': { key: '11th_BO', targetClass: '11th', code: 'BO', name: 'Botany', maxMarks: 25, minMarks: 9 },
      '11th_ZO': { key: '11th_ZO', targetClass: '11th', code: 'ZO', name: 'Zoology', maxMarks: 50, minMarks: 18 }
    },
    isOpenForTeachers: true,
    isPublishedForStudents: true,
    description: ''
  });

  const handleAddSubjectOverride = () => {
    if (!overrideSelectCode) return;
    const subObj = SUBJECT_CONFIG_DEFS.find(s => s.code === overrideSelectCode);
    const max = Number(overrideMaxInput);
    if (!max || max <= 0) {
      showToast('Please enter a valid Maximum Marks (e.g. 25, 35).', 'warning');
      return;
    }
    const pass = Number(overridePassInput) || Math.ceil(max * 0.36);
    const cls = overrideTargetClass || 'ALL';
    const compositeKey = cls === 'ALL' ? overrideSelectCode : `${cls}_${overrideSelectCode}`;

    setFormState(prev => ({
      ...prev,
      subjectOverrides: {
        ...(prev.subjectOverrides || {}),
        [compositeKey]: {
          key: compositeKey,
          targetClass: cls,
          code: overrideSelectCode,
          name: subObj?.name || overrideSelectCode,
          maxMarks: max,
          minMarks: pass
        }
      }
    }));
    setOverrideSelectCode('');
    setOverrideMaxInput('');
    setOverridePassInput('');
  };

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

      try {
        invalidateCache('adminPracticalsSettings');
      } catch (_) {}

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
    setOverrideSelectCode('');
    setOverrideMaxInput('');
    setOverridePassInput('');
    if (preset) {
      setFormState({
        title: preset.title,
        evalType: preset.evalType,
        session: preset.session || '2025-26',
        classes: preset.classes || ['9th', '10th', '11th', '12th'],
        allowedStatuses: preset.allowedStatuses || ['approved'],
        maxMarks: preset.maxMarks || 50,
        minMarks: preset.minMarks || 18,
        biologyDisplayMode: preset.biologyDisplayMode || 'combined',
        normalizeTo50: preset.normalizeTo50 !== false,
        subjectOverrides: preset.subjectOverrides || {},
        isOpenForTeachers: true,
        isPublishedForStudents: true,
        description: preset.description || ''
      });
    } else {
      setFormState({
        title: '',
        evalType: 'Pre-Board Test',
        session: '2025-26',
        classes: ['9th', '10th', '11th', '12th'],
        allowedStatuses: ['approved'],
        maxMarks: 50,
        minMarks: 18,
        biologyDisplayMode: 'combined',
        normalizeTo50: true,
        subjectOverrides: {
          'BO': { code: 'BO', name: 'Botany', maxMarks: 25, minMarks: 9 },
          'ZO': { code: 'ZO', name: 'Zoology', maxMarks: 25, minMarks: 9 }
        },
        isOpenForTeachers: true,
        isPublishedForStudents: true,
        description: ''
      });
    }
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (evalItem) => {
    setOverrideSelectCode('');
    setOverrideMaxInput('');
    setOverridePassInput('');
    setFormState({
      title: evalItem.title || '',
      evalType: evalItem.evalType || 'Pre-Board Test',
      session: evalItem.session || '2025-26',
      classes: Array.isArray(evalItem.classes) ? evalItem.classes : ['10th', '11th', '12th'],
      allowedStatuses: Array.isArray(evalItem.allowedStatuses) ? evalItem.allowedStatuses : ['approved'],
      maxMarks: evalItem.maxMarks || 50,
      minMarks: evalItem.minMarks || 18,
      biologyDisplayMode: evalItem.biologyDisplayMode || 'combined',
      normalizeTo50: evalItem.normalizeTo50 !== false,
      subjectOverrides: evalItem.subjectOverrides || {},
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
      showToast('Please enter an assessment title.', 'warning');
      return;
    }
    if (!formState.evalType.trim()) {
      showToast('Please enter an evaluation type name.', 'warning');
      return;
    }
    if (formState.classes.length === 0) {
      showToast('Please select at least one class.', 'warning');
      return;
    }
    if (formState.allowedStatuses.length === 0) {
      showToast('Please select at least one eligible student status.', 'warning');
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
    showToast(`Assessment "${formState.title}" saved successfully!`, 'success');
    setShowModal(false);
  };

  const handleDeleteEvaluation = (id) => {
    setDeleteConfirmId(id);
  };

  const executeDeleteEvaluation = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    const updatedList = evaluations.filter(item => item.id !== id);
    await saveEvaluationsToFirestore(updatedList);
    showToast('Assessment configuration removed.', 'info');
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
    <div className="space-y-3 text-slate-900 dark:text-slate-100">
      {/* Alert Notification (Compact banner) */}
      {alertMsg && (
        <div className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border shadow-xs animate-in fade-in duration-150 ${
          alertMsg.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/50 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/50 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className={alertMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />
            <span>{alertMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMsg(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ultra-Compact Modern Action Header (Mobile-First) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Title & Active Count */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center font-black shrink-0">
              <Award size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight m-0 truncate">
                  <span className="sm:hidden">School Assessments</span>
                  <span className="hidden sm:inline">School Assessments & Pre-Board Hub</span>
                </h2>
                <span className="text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 shrink-0">
                  {evaluations.length} Active
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 m-0 truncate">
                Dynamic teacher marks rolls & scorecards
              </p>
            </div>
          </div>

          {/* Quick Result Portal Link (Desktop) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Portal:</span>
            <code className="text-teal-700 dark:text-teal-300 font-mono font-bold text-[11px]">/results</code>
            <button
              type="button"
              onClick={handleCopyPublicLink}
              title="Copy public result link"
              className="p-0.5 rounded hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={12} />}
            </button>
            <a
              href="/results"
              target="_blank"
              rel="noopener noreferrer"
              title="Open public result page"
              className="p-0.5 rounded hover:bg-white dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Action Buttons Toolbar: Full-width clean row on mobile */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80 sm:border-0 sm:pt-0">
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="flex-1 sm:flex-initial h-7.5 px-3 rounded-lg bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Test</span>
          </button>

          {onSwitchToGazette && (
            <button
              type="button"
              onClick={onSwitchToGazette}
              className="h-7.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <FileText size={13} className="text-orange-600 dark:text-orange-400" />
              <span>Gazette</span>
            </button>
          )}

          <a
            href="/results"
            target="_blank"
            rel="noopener noreferrer"
            className="sm:hidden h-7.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-300 font-bold text-[11px] flex items-center gap-1"
            title="Open /results"
          >
            <ExternalLink size={12} />
            <span>/results</span>
          </a>

          <button
            type="button"
            onClick={loadEvaluations}
            disabled={loading}
            className="h-7.5 w-7.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 ml-auto sm:ml-0"
            title="Refresh database records"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Modern Compact Instant Presets Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 text-xs">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap pl-0.5">
          <Sparkles size={12} className="text-amber-500" /> Presets:
        </span>
        {PRESET_EVALUATIONS.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleOpenAddModal(preset)}
            className="h-7 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shadow-2xs flex items-center gap-1"
          >
            <span>+ {preset.title}</span>
          </button>
        ))}
      </div>

      {/* Configured Evaluations Cards (Modern, High-Density Compact Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {evaluations.map((item) => {
          const isTeacherOpen = item.isOpenForTeachers !== false;
          const isPublished = item.isPublishedForStudents !== false;

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 transition-all relative shadow-2xs hover:shadow-xs"
            >
              <div className="space-y-2">
                {/* Header row: Session pill, Title, and Action icons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9.5px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                        {item.session || '2025-26'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                        {item.evalType}
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1 leading-snug truncate" title={item.title}>
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Edit assessment"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvaluation(item.id)}
                      className="p-1 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 transition-colors cursor-pointer"
                      title="Delete assessment"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Scope: Classes, Statuses, and Marks */}
                <div className="flex items-center gap-1 flex-wrap text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Classes:</span>
                  {(Array.isArray(item.classes) ? item.classes : ['10th', '11th', '12th']).map(cls => (
                    <span key={cls} className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[10px] border border-slate-200 dark:border-slate-700">
                      {cls}
                    </span>
                  ))}

                  <span className="text-[10px] text-slate-400 font-semibold ml-1.5 mr-0.5">Status:</span>
                  {(Array.isArray(item.allowedStatuses) ? item.allowedStatuses : ['approved']).map(st => (
                    <span
                      key={st}
                      className={`px-1.5 py-0.2 rounded font-black text-[9.5px] uppercase border ${
                        st === 'approved'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      {st}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  <span>Max Marks: <strong className="text-slate-800 dark:text-slate-200">{item.maxMarks || 100}</strong></span>
                  <span>Min Pass: <strong className="text-slate-800 dark:text-slate-200">{item.minMarks || 36} ({Math.round(((item.minMarks || 36)/(item.maxMarks || 100))*100)}%)</strong></span>
                </div>

                {/* Biology & Normalization indicators */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-1">
                  <span className="px-1.5 py-0.5 rounded font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    Biology: {item.biologyDisplayMode === 'separate' ? 'Separate (50M each)' : 'Combined (50M)'}
                  </span>
                  {item.subjectOverrides && typeof item.subjectOverrides === 'object' && Object.keys(item.subjectOverrides).length > 0 && (
                    <span className="px-1.5 py-0.5 rounded font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Custom: {Object.entries(item.subjectOverrides).map(([c, o]) => {
                        if (!o || typeof o !== 'object') return `${c}(${o || '?'}M)`;
                        return `${o.targetClass && o.targetClass !== 'ALL' ? `${o.targetClass}:` : ''}${o.code || c}(${o.maxMarks || '?'}M)`;
                      }).join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Compact Toggle Pills Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleTeacherPortal(item)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer border ${
                    isTeacherOpen
                      ? 'bg-teal-50 dark:bg-teal-950 text-teal-900 dark:text-teal-300 border-teal-300 dark:border-teal-700 hover:bg-teal-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title="Toggle teacher award roll entry"
                >
                  {isTeacherOpen ? <Unlock size={11} className="text-teal-700 dark:text-teal-400" /> : <Lock size={11} />}
                  <span>Teacher: {isTeacherOpen ? 'OPEN' : 'LOCKED'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStudentPublish(item)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer border ${
                    isPublished
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title="Toggle public student result lookup"
                >
                  {isPublished ? <Eye size={11} className="text-emerald-700 dark:text-emerald-400" /> : <EyeOff size={11} />}
                  <span>Results: {isPublished ? 'LIVE' : 'DRAFT'}</span>
                </button>

                {onSwitchToGazette && (
                  <button
                    type="button"
                    onClick={onSwitchToGazette}
                    className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs flex-shrink-0"
                    title="View consolidated gazette for this assessment"
                  >
                    <FileText size={11} className="text-orange-600 dark:text-orange-400" />
                    <span>Gazette</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {evaluations.length === 0 && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-6 text-center space-y-2.5">
          <Award size={32} className="mx-auto text-slate-400 dark:text-slate-600" />
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300">No School Assessments Configured</h4>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Click &ldquo;New Test&rdquo; or choose an instant template above to define your pre-board examination.
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddModal(PRESET_EVALUATIONS[0])}
            className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-black text-xs transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs"
          >
            <Sparkles size={13} />
            <span>Enable Pre-Board Examination 2026</span>
          </button>
        </div>
      )}

      {/* Create / Edit Modal (Wider Minimal Desktop Dialog) */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Minimal Header */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200/60 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <Award size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white m-0 truncate">
                    {editingId ? 'Edit School Assessment' : 'Create School Assessment'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium m-0 truncate">
                    Configure evaluation rules, status eligibility, scoring scheme, and subject scales.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body: 2-Column Responsive Desktop Grid */}
            <form onSubmit={handleSaveModal} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto custom-scrollbar p-4 sm:p-5 md:p-6 space-y-4 flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                  {/* ── LEFT COLUMN: Core Examination Settings (Col Span 6) ── */}
                  <div className="lg:col-span-6 space-y-4">
                    {/* Identity & Scope Card */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                        <Calendar size={13} className="text-teal-700 dark:text-teal-400" />
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Assessment Identity & Session
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Assessment Title *
                          </label>
                          <input
                            type="text"
                            required
                            value={formState.title}
                            onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                            placeholder="e.g. Pre-Board Examination 2026"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Evaluation Type Label *
                          </label>
                          <input
                            type="text"
                            required
                            value={formState.evalType}
                            onChange={(e) => setFormState({ ...formState, evalType: e.target.value })}
                            placeholder="e.g. Pre-Board Test"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Academic Session *
                          </label>
                          <input
                            type="text"
                            required
                            value={formState.session}
                            onChange={(e) => setFormState({ ...formState, session: e.target.value })}
                            placeholder="e.g. 2025-26"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Target Classes *
                          </label>
                          <div className="flex items-center gap-1.5">
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
                                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                                    isSelected
                                      ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-600 shadow-xs'
                                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:bg-slate-100'
                                  }`}
                                >
                                  {cls}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Student Status Eligibility Card */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-teal-700 dark:text-teal-400" />
                          <span>Eligible Student Admission Status *</span>
                        </label>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-bold">
                          (Default: Approved Only)
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-0.5">
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
                              className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                                isChecked
                                  ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-950 dark:text-teal-200 shadow-2xs font-bold'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 font-medium'
                              }`}
                            >
                              {isChecked ? (
                                <CheckSquare size={14} className="text-teal-700 dark:text-teal-400 shrink-0" />
                              ) : (
                                <Square size={14} className="text-slate-400 shrink-0" />
                              )}
                              <span className="text-[11px] truncate">{st.label.split(' ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Marks Scoring Scheme Card */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
                      <div className="flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                        <Clock size={13} className="text-teal-700 dark:text-teal-400" />
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Default Subject Scoring Scheme
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Default Max Marks per Subject
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="100"
                            value={formState.maxMarks}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 50;
                              setFormState({
                                ...formState,
                                maxMarks: val,
                                minMarks: Math.ceil(val * 0.36)
                              });
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono font-bold transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Min Passing Marks
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={formState.maxMarks}
                            value={formState.minMarks}
                            onChange={(e) => setFormState({ ...formState, minMarks: Number(e.target.value) || 18 })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono font-bold transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Toggles & Circular Note */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                          <input
                            type="checkbox"
                            checked={formState.isOpenForTeachers}
                            onChange={(e) => setFormState({ ...formState, isOpenForTeachers: e.target.checked })}
                            className="rounded border-slate-300 text-teal-600 focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <span className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Teacher Entry</span>
                            <span className="text-[9.5px] text-slate-500 leading-tight">Allow marks roll in portal</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                          <input
                            type="checkbox"
                            checked={formState.isPublishedForStudents}
                            onChange={(e) => setFormState({ ...formState, isPublishedForStudents: e.target.checked })}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <span className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Student Search</span>
                            <span className="text-[9.5px] text-slate-500 leading-tight">Live at /results scorecard</span>
                          </div>
                        </label>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Circular / Reference Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={formState.description}
                          onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                          placeholder="e.g. Conducted under Order No. HSS/SH/2026/EXAM-01 as pre-board test."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT COLUMN: Subject Overrides & Special Modes (Col Span 6) ── */}
                  <div className="lg:col-span-6 space-y-4">
                    {/* Subject-Specific Custom Paper Scales (Overrides) */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen size={14} className="text-teal-700 dark:text-teal-400" />
                          <span>Subject-Specific Paper Scales (Overrides)</span>
                        </label>
                        <span className="text-[10px] text-teal-700 dark:text-teal-300 font-extrabold px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800/60">
                          {Object.keys(formState.subjectOverrides || {}).length} Configured
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 leading-normal">
                        Need custom scales for specific papers? (e.g. Botany 25M, Zoology 25M, Physics 35M, Chemistry 35M). Teachers will enter scores out of these custom scales. All unconfigured subjects use the default {formState.maxMarks}M scale.
                      </p>

                      {/* Quick 1-Click Preset Shortcuts */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Quick:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormState(prev => ({
                              ...prev,
                              subjectOverrides: {
                                ...(prev.subjectOverrides || {}),
                                '11th_BO': { key: '11th_BO', targetClass: '11th', name: 'Botany', code: 'BO', maxMarks: 25, minMarks: 9 },
                                '11th_ZO': { key: '11th_ZO', targetClass: '11th', name: 'Zoology', code: 'ZO', maxMarks: 50, minMarks: 18 },
                                '12th_BO': { key: '12th_BO', targetClass: '12th', name: 'Botany', code: 'BO', maxMarks: 25, minMarks: 9 },
                                '12th_ZO': { key: '12th_ZO', targetClass: '12th', name: 'Zoology', code: 'ZO', maxMarks: 50, minMarks: 18 }
                              }
                            }));
                          }}
                          className="px-2 py-0.5 rounded-md bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/80 dark:hover:bg-teal-800 text-teal-950 dark:text-teal-200 border border-teal-300 dark:border-teal-700 text-[10px] font-black cursor-pointer transition-colors shadow-2xs"
                          title="Sets Botany to 25M and Zoology to 50M for Class 11th and 12th"
                        >
                          + Botany 25M &amp; Zoology 50M
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormState(prev => ({
                              ...prev,
                              subjectOverrides: {
                                ...(prev.subjectOverrides || {}),
                                'BO': { key: 'BO', targetClass: 'ALL', name: 'Botany', code: 'BO', maxMarks: 25, minMarks: 9 },
                                'ZO': { key: 'ZO', targetClass: 'ALL', name: 'Zoology', code: 'ZO', maxMarks: 25, minMarks: 9 }
                              }
                            }));
                          }}
                          className="px-2 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          + Botany &amp; Zoology (25M each)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormState(prev => ({
                              ...prev,
                              subjectOverrides: {
                                ...(prev.subjectOverrides || {}),
                                'PH': { key: 'PH', targetClass: 'ALL', name: 'Physics', code: 'PH', maxMarks: 35, minMarks: 13 },
                                'CH': { key: 'CH', targetClass: 'ALL', name: 'Chemistry', code: 'CH', maxMarks: 35, minMarks: 13 }
                              }
                            }));
                          }}
                          className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          + Science 35M (Physics &amp; Chemistry)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormState(prev => ({
                              ...prev,
                              subjectOverrides: {
                                ...(prev.subjectOverrides || {}),
                                'HTC': { key: 'HTC', targetClass: 'ALL', name: 'Healthcare', code: 'HTC', maxMarks: 30, minMarks: 11 },
                                'ITE': { key: 'ITE', targetClass: 'ALL', name: 'IT and ITES', code: 'ITE', maxMarks: 30, minMarks: 11 }
                              }
                            }));
                          }}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          + Vocational 30M (IT/Healthcare)
                        </button>
                      </div>

                      {/* Add Custom Override Row */}
                      <div className="flex items-center gap-1.5 pt-1 flex-wrap sm:flex-nowrap">
                        <select
                          value={overrideTargetClass}
                          onChange={(e) => setOverrideTargetClass(e.target.value)}
                          className="w-24 shrink-0 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-teal-800 dark:text-teal-300 focus:outline-none focus:border-teal-600 transition-colors"
                          title="Target Class for this paper scale override"
                        >
                          <option value="ALL">All Classes</option>
                          {(formState.classes || ['10th', '11th', '12th']).map(cls => (
                            <option key={cls} value={cls}>Class {cls}</option>
                          ))}
                        </select>
                        <select
                          value={overrideSelectCode}
                          onChange={(e) => setOverrideSelectCode(e.target.value)}
                          className="flex-1 min-w-[130px] px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-600 transition-colors"
                        >
                          <option value="">Select Subject...</option>
                          {SUBJECT_CONFIG_DEFS.map(sub => (
                            <option key={sub.code} value={sub.code}>
                              {sub.name} [{sub.code}]
                            </option>
                          ))}
                        </select>
                        <div className="relative w-20 shrink-0">
                          <input
                            type="number"
                            min="10"
                            max="100"
                            placeholder="Max"
                            value={overrideMaxInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOverrideMaxInput(val);
                              if (val && Number(val) > 0) {
                                setOverridePassInput(String(Math.ceil(Number(val) * 0.36)));
                              }
                            }}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-600"
                            title="Custom Max Marks"
                          />
                        </div>
                        <div className="relative w-20 shrink-0">
                          <input
                            type="number"
                            min="1"
                            placeholder="Pass"
                            value={overridePassInput}
                            onChange={(e) => setOverridePassInput(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-600"
                            title="Custom Min Pass Marks"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddSubjectOverride}
                          className="h-8 px-3 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-black text-xs cursor-pointer shrink-0 transition-colors shadow-2xs"
                        >
                          + Add
                        </button>
                      </div>

                      {/* List of Configured Subject Overrides */}
                      {Object.keys(formState.subjectOverrides || {}).length > 0 ? (
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Active Overrides:</span>
                            <button
                              type="button"
                              onClick={() => setFormState({ ...formState, subjectOverrides: {} })}
                              className="text-[10px] text-rose-600 hover:underline cursor-pointer font-bold"
                            >
                              Clear All
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {Object.entries(formState.subjectOverrides).map(([key, ov]) => {
                              const clsBadge = ov.targetClass && ov.targetClass !== 'ALL' ? `Class ${ov.targetClass}` : 'All Classes';
                              return (
                                <span
                                  key={key}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] shadow-2xs font-medium"
                                >
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                                    {clsBadge}
                                  </span>
                                  <strong className="font-bold text-slate-900 dark:text-white">{ov.name || ov.code} [{ov.code}]</strong>
                                  <span className="font-mono font-black text-teal-700 dark:text-teal-400">{ov.maxMarks}M</span>
                                  <span className="text-[9.5px] text-slate-400 font-mono">(Pass {ov.minMarks})</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormState(prev => {
                                        const next = { ...(prev.subjectOverrides || {}) };
                                        delete next[key];
                                        return { ...prev, subjectOverrides: next };
                                      });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 cursor-pointer font-bold ml-1 transition-colors"
                                    title="Remove custom marks"
                                  >
                                    ✕
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2.5 px-3 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center text-[10.5px] text-slate-400">
                          No custom overrides configured. All subjects evaluate out of {formState.maxMarks}M.
                        </div>
                      )}
                    </div>

                    {/* Botany & Zoology Handling & Normalization Config */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/70 dark:border-teal-800/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10.5px] font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers size={14} className="text-teal-700 dark:text-teal-400" />
                          <span>Biology (Botany & Zoology) Display Mode</span>
                        </label>
                        <span className="text-[9.5px] font-semibold text-teal-700 dark:text-teal-300">
                          Faculty submit separately
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormState({ ...formState, biologyDisplayMode: 'combined' })}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            formState.biologyDisplayMode === 'combined'
                              ? 'bg-white dark:bg-slate-900 border-teal-600 dark:border-teal-400 text-teal-950 dark:text-teal-200 shadow-xs ring-1 ring-teal-500/20'
                              : 'bg-teal-50/30 dark:bg-slate-950 border-teal-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-teal-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11.5px] font-black">Combined Biology (50M)</span>
                            {formState.biologyDisplayMode === 'combined' && <CheckCircle2 size={14} className="text-teal-600 dark:text-teal-400" />}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 leading-normal">
                            Merges Botany & Zoology into 1 row with sub-breakdown (BO: X/25 • ZO: Y/25).
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormState({ ...formState, biologyDisplayMode: 'separate' })}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            formState.biologyDisplayMode === 'separate'
                              ? 'bg-white dark:bg-slate-900 border-teal-600 dark:border-teal-400 text-teal-950 dark:text-teal-200 shadow-xs ring-1 ring-teal-500/20'
                              : 'bg-teal-50/30 dark:bg-slate-950 border-teal-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-teal-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11.5px] font-black">Show Separately</span>
                            {formState.biologyDisplayMode === 'separate' && <CheckCircle2 size={14} className="text-teal-600 dark:text-teal-400" />}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0 leading-normal">
                            Displays Botany (50M) and Zoology (50M) as two individual subject rows.
                          </p>
                        </button>
                      </div>

                      <div className="text-[10px] text-teal-900 dark:text-teal-300/90 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-teal-200/60 dark:border-teal-800/40 flex items-start gap-2 leading-relaxed">
                        <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Auto-Score Normalization:</strong> Teachers can set exam papers of any scale (e.g. 20, 25, 30, 35, 40, 50, 70, 100). On student scorecards and public result lookup, all subjects will be automatically standardized to <strong>50 Max Marks (Passing: 18/50)</strong>.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Minimal Clean Footer */}
              <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-slate-400">
                  <span>Session: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formState.session}</strong></span>
                  <span>•</span>
                  <span>Classes: <strong className="text-slate-800 dark:text-slate-200">{formState.classes.join(', ')}</strong></span>
                  <span>•</span>
                  <span>Overrides: <strong className="text-teal-700 dark:text-teal-400 font-bold">{Object.keys(formState.subjectOverrides || {}).length}</strong></span>
                </div>

                <div className="flex items-center justify-end gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>{editingId ? 'Save Changes' : 'Create Test'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={executeDeleteEvaluation}
        type="danger"
        title="Remove Assessment Configuration"
        message="Are you sure you want to remove this assessment configuration?"
        consequence="Existing student marks in practicalsData will remain intact, but this assessment will no longer appear in active teacher or student tabs."
        confirmText="Yes, Remove Assessment"
      />
    </div>
  );
}
