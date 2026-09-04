import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Database, ShieldAlert, CheckCircle2, AlertTriangle, X, RefreshCw, 
  ArrowRight, Search, Users, Archive, Trash2, FileCheck, Layers, Sparkles, Check
} from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { clearAllMemoryCache, invalidateCache } from '../../services/dbCache';
import ModernLoader from '../../components/ModernLoader';
import {
  getAssignedClassRollNumber,
  resolveStudentAdmissionStatus
} from '../../utils/studentApprovalStatus';

export default function SessionArchivalModal({ isOpen, onClose, currentSession = '2025-26', onArchivalComplete }) {
  const [loading, setLoading] = useState(true);
  const [rawAdmissions, setRawAdmissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'approved' | 'drafts' | 'rejected'
  
  // Archival Configuration
  const [archiveSessionTag, setArchiveSessionTag] = useState(currentSession);
  const [newSessionTag, setNewSessionTag] = useState(() => {
    const parts = currentSession.split('-');
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return `${parseInt(parts[0], 10) + 1}-${parseInt(parts[1], 10) + 1}`;
    }
    return '2026-27';
  });
  const [purgeDrafts, setPurgeDrafts] = useState(true);
  const [purgeRejected, setPurgeRejected] = useState(true);

  // Safety Confirmation
  const [confirmInput, setConfirmInput] = useState('');
  const [step, setStep] = useState('analysis'); // 'analysis' | 'confirm' | 'executing' | 'completed'
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Load and analyze all admissions
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setErrorMsg(null);
    setStep('analysis');
    setConfirmInput('');

    async function loadAndAnalyze() {
      try {
        const snap = await getDocs(collection(db, 'admissions'));
        const list = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setRawAdmissions(list);
      } catch (err) {
        console.error('Failed to load admissions for archival analysis:', err);
        setErrorMsg('Failed to load admissions records: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAndAnalyze();
  }, [isOpen]);

  // Categorization Logic
  const analysis = useMemo(() => {
    const approved = [];
    const drafts = [];
    const rejected = [];
    const byClass = { '9th': 0, '10th': 0, '11th': 0, '12th': 0, 'Other': 0 };
    let totalPhotos = 0;

    rawAdmissions.forEach(rec => {
      const effectiveStatus = resolveStudentAdmissionStatus(rec);

      const cls = String(rec['Admission sought for class'] || rec.Class || rec.class || '').toLowerCase();
      let classKey = 'Other';
      if (cls.includes('9')) classKey = '9th';
      else if (cls.includes('10')) classKey = '10th';
      else if (cls.includes('11')) classKey = '11th';
      else if (cls.includes('12')) classKey = '12th';

      const photoVal = rec.photo_id || rec['Student Photo'] || rec.photoUrl || rec.photoId || '';
      if (photoVal && typeof photoVal === 'string' && photoVal.length > 10 && photoVal !== '—') {
        totalPhotos++;
      }

      if (effectiveStatus === 'Approved') {
        approved.push(rec);
        byClass[classKey] = (byClass[classKey] || 0) + 1;
      } else if (effectiveStatus === 'Rejected') {
        rejected.push(rec);
      } else {
        drafts.push(rec);
      }
    });

    return {
      total: rawAdmissions.length,
      approved,
      drafts,
      rejected,
      byClass,
      totalPhotos
    };
  }, [rawAdmissions]);

  // Filtered Preview Records
  const previewRecords = useMemo(() => {
    let list = analysis.approved;
    if (filterTab === 'drafts') list = analysis.drafts;
    else if (filterTab === 'rejected') list = analysis.rejected;
    else if (filterTab === 'all') list = rawAdmissions;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(r => {
      const name = String(r["Student's Name (as per school records)"] || r.studentName || r["Student's Name"] || '').toLowerCase();
      const form = String(r['Form Number'] || r['Form No.'] || r.formNo || r.id || '').toLowerCase();
      const roll = String(r['Class Roll No'] || r.classRollNo || '').toLowerCase();
      return name.includes(q) || form.includes(q) || roll.includes(q);
    });
  }, [analysis, filterTab, rawAdmissions, searchQuery]);

  const requiredConfirmText = `ARCHIVE ${archiveSessionTag.toUpperCase().trim()}`;
  const isConfirmValid = confirmInput.trim().toUpperCase() === requiredConfirmText;

  // ─── Execute 100% Native Firestore Archival Pipeline ───
  const executeArchival = async () => {
    if (!isConfirmValid) return;
    setStep('executing');
    setErrorMsg(null);
    setProgressPercent(10);
    setProgressStage('Preparing approved student records…');

    try {
      // 1. Prepare masterRegisters chunks
      const CHUNK_SIZE = 50;
      const approvedStudents = analysis.approved.map(st => {
        // Tag with session
        return {
          ...st,
          session: archiveSessionTag,
          Session: archiveSessionTag,
          _archivedAt: new Date().toISOString()
        };
      });

      const sessionSlug = archiveSessionTag.toLowerCase().replace(/[\/\s]/g, '_');
      const chunks = [];
      for (let i = 0; i < approvedStudents.length; i += CHUNK_SIZE) {
        chunks.push(approvedStudents.slice(i, i + CHUNK_SIZE));
      }

      setProgressPercent(30);
      setProgressStage(`Saving archive files (0/${chunks.length})…`);

      // 2. Write Chunks to Firestore masterRegisters
      for (let i = 0; i < chunks.length; i++) {
        const chunkDocId = `part_${sessionSlug}_${String(i + 1).padStart(3, '0')}`;
        await setDoc(doc(db, 'masterRegisters', chunkDocId), {
          students: chunks[i],
          session: archiveSessionTag,
          chunkIndex: i + 1,
          totalStudents: chunks[i].length,
          archivedAt: new Date().toISOString()
        }, { merge: true });
        setProgressPercent(30 + Math.round(((i + 1) / chunks.length) * 35));
        setProgressStage(`Saving archive files (${i + 1}/${chunks.length})…`);
      }

      setProgressStage('Updating active admissions…');
      setProgressPercent(75);

      // 3. Purge admissions documents that were archived or drafts
      const docsToDelete = [];
      analysis.approved.forEach(s => docsToDelete.push(s.id));
      if (purgeDrafts) {
        analysis.drafts.forEach(s => docsToDelete.push(s.id));
      }
      if (purgeRejected) {
        analysis.rejected.forEach(s => docsToDelete.push(s.id));
      }

      // Batch delete from admissions in chunks of 450
      const BATCH_LIMIT = 400;
      for (let i = 0; i < docsToDelete.length; i += BATCH_LIMIT) {
        const slice = docsToDelete.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        slice.forEach(id => {
          batch.delete(doc(db, 'admissions', id));
        });
        await batch.commit();
      }

      setProgressPercent(90);
      setProgressStage('Updating the active session…');

      // 4. Update System Settings with New Session Tag
      await setDoc(doc(db, 'site', 'settings'), {
        session: newSessionTag,
        lastArchivedSession: archiveSessionTag,
        lastArchivalDate: new Date().toISOString()
      }, { merge: true });

      // 5. Clear all local/session caches
      clearAllMemoryCache();
      invalidateCache('admissions');
      invalidateCache('masterRegisters');

      setProgressPercent(100);
      setProgressStage('Session archive completed.');
      setStep('completed');

      if (onArchivalComplete) {
        onArchivalComplete({
          archivedCount: analysis.approved.length,
          archivedSession: archiveSessionTag,
          newSession: newSessionTag
        });
      }
    } catch (err) {
      console.error('Session Archival execution error:', err);
      setErrorMsg('Archival failed: ' + err.message);
      setStep('confirm');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[94vh] sm:max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white my-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-purple-600/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                Annual Session Lifecycle & Rollover Manager
              </h2>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Cloud Database Pipeline • Preview & Safety Analysis before Archiving
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={step === 'executing'}
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {loading && (
            <ModernLoader
              moduleKey="archive"
              text="Checking admission records…"
              subtext="Please wait."
              className="py-12"
            />
          )}

          {!loading && errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-black flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!loading && step === 'analysis' && (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Total Active In Admissions</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Users size={18} className="text-slate-600" />
                    <span>{analysis.total}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 block">Active Intake</span>
                </div>

                <div className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/30 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">To Be Archived (Approved)</span>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Archive size={18} />
                    <span>{analysis.approved.length}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 block">Moves to masterRegisters</span>
                </div>

                <div className="p-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/30 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Incomplete / Drafts</span>
                  <div className="text-xl font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Trash2 size={18} />
                    <span>{analysis.drafts.length}</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300 block">Cleared on reset</span>
                </div>

                <div className="p-3 rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/30 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 block">Photos Preserved</span>
                  <div className="text-xl font-black text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                    <Sparkles size={18} />
                    <span>{analysis.totalPhotos}</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300 block">Native Base64</span>
                </div>
              </div>

              {/* Class Breakdown Pill Bar */}
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between flex-wrap gap-2 text-xs font-black">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Approved Breakdown:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    Class 9th: {analysis.byClass['9th']}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Class 10th: {analysis.byClass['10th']}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Class 11th: {analysis.byClass['11th']}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Class 12th: {analysis.byClass['12th']}
                  </span>
                </div>
              </div>

              {/* Configuration Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300">
                    1. Archive As Academic Session
                  </label>
                  <input
                    type="text"
                    value={archiveSessionTag}
                    onChange={(e) => setArchiveSessionTag(e.target.value)}
                    placeholder="e.g. 2025-26"
                    className="w-full p-2 rounded-xl text-xs font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 font-bold">Approved records will be stored under this historical session.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300">
                    2. Initialize Next Intake Session
                  </label>
                  <input
                    type="text"
                    value={newSessionTag}
                    onChange={(e) => setNewSessionTag(e.target.value)}
                    placeholder="e.g. 2026-27"
                    className="w-full p-2 rounded-xl text-xs font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 font-bold">New admission forms will open under this new academic session.</p>
                </div>
              </div>

              {/* Interactive Record Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl font-black text-xs">
                    {[
                      { id: 'approved', label: `Approved (${analysis.approved.length})` },
                      { id: 'drafts', label: `Drafts (${analysis.drafts.length})` },
                      { id: 'rejected', label: `Rejected (${analysis.rejected.length})` },
                      { id: 'all', label: `All (${analysis.total})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilterTab(tab.id)}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          filterTab === tab.id
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-48">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search preview..."
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px] font-bold">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2">Form No</th>
                        <th className="p-2">Student Name</th>
                        <th className="p-2">Class</th>
                        <th className="p-2">Roll No</th>
                        <th className="p-2">Action on Rollover</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewRecords.map((r, idx) => {
                        const status = (r.Status || r.status || '').trim().toLowerCase();
                        const roll = getAssignedClassRollNumber(r);
                        const isAppr = resolveStudentAdmissionStatus(r) === 'Approved';

                        return (
                          <tr key={r.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-mono font-black">{r['Form Number'] || r['Form No.'] || r.formNo || r.id}</td>
                            <td className="p-2 font-black">{r["Student's Name (as per school records)"] || r.studentName || 'Student'}</td>
                            <td className="p-2">{r['Admission sought for class'] || r.Class || '—'}</td>
                            <td className="p-2 font-mono text-teal-600">{roll || '—'}</td>
                            <td className="p-2">
                              {isAppr ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                                  <Check size={11} /> Migrate to masterRegisters
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                                  <Trash2 size={11} /> Clear from intake
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {previewRecords.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">No records found matching filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: SAFETY CONFIRMATION */}
          {!loading && step === 'confirm' && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2">
                <div className="flex items-center gap-2 font-black text-sm text-purple-900 dark:text-purple-200">
                  <ShieldAlert size={18} className="text-purple-600" />
                  <span>Final Review & Confirmation Before Archival</span>
                </div>
                <p className="text-xs font-bold text-purple-800 dark:text-purple-300 leading-relaxed">
                  Executing this rollover will permanently migrate <strong>{analysis.approved.length} approved students</strong> into historical <code className="font-mono font-black">masterRegisters</code> chunks tagged as session <strong>"{archiveSessionTag}"</strong>. Active admissions will be purged and initialized for session <strong>"{newSessionTag}"</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  Type <span className="font-mono text-purple-600 dark:text-purple-400 select-all font-black">"{requiredConfirmText}"</span> to authorize session rollover:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={`Type "${requiredConfirmText}" exactly`}
                  className="w-full p-2.5 rounded-xl font-mono font-black text-xs border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* STEP 3: EXECUTING PROGRESS */}
          {step === 'executing' && (
            <div className="py-8 px-4">
              <ModernLoader
                moduleKey="archive"
                text="Archiving session records…"
                subtext={progressStage}
                progress={progressPercent}
                className="py-4"
              />
            </div>
          )}

          {/* STEP 4: COMPLETED */}
          {step === 'completed' && (
            <div className="py-10 px-4 space-y-4 text-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-base text-slate-900 dark:text-white">Annual Session Successfully Archived!</h3>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
                  {analysis.approved.length} students have been securely packaged into <code className="font-mono text-purple-600">masterRegisters</code> under session <strong>{archiveSessionTag}</strong>. Active admissions intake is now cleanly configured for session <strong>{newSessionTag}</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            disabled={step === 'executing'}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer disabled:opacity-50"
          >
            {step === 'completed' ? 'Close & Refresh' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2">
            {!loading && step === 'analysis' && (
              <button
                type="button"
                disabled={analysis.approved.length === 0}
                onClick={() => setStep('confirm')}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-purple-700 hover:bg-purple-600 shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                <span>Proceed to Rollover Confirmation</span>
                <ArrowRight size={14} />
              </button>
            )}

            {!loading && step === 'confirm' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('analysis')}
                  className="px-3.5 py-2 rounded-xl text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                >
                  Back to Analysis
                </button>
                <button
                  type="button"
                  disabled={!isConfirmValid}
                  onClick={executeArchival}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-purple-700 hover:bg-purple-600 shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Database size={14} />
                  <span>Execute Permanent Rollover</span>
                </button>
              </>
            )}

            {step === 'completed' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-emerald-700 hover:bg-emerald-600 shadow-md cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
