// =================================================================
// HSS SHANGUS — JKBOSE Exam Result & Roll Number Ingestion Hub
// Supports Excel/CSV Template Import, Gemini AI Multimodal Gazette
// Analyzer, Gemini AI Admit Card Extractor, Interactive Review Grid,
// Multi-Class / Multi-Session Scoping (10th, 11th, 12th & APR/BIAN),
// and Mandatory Non-Destructive Admin Confirmation Gate.
// =================================================================

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Database,
  Search,
  Check,
  RefreshCw,
  Eye,
  Trash2,
  Edit2,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  BookOpen,
  Layers,
  Award
} from 'lucide-react';
import {
  generateResultImportTemplate,
  parseAndValidateResultFile,
  analyzeGazetteWithGemini,
  analyzeAdmitCardWithGemini,
  batchUpdateStudentResults,
  JKBOSE_SUBJECT_CODES,
  calculateDivision,
  expandJkboseSubjectCodes
} from '../../utils/jkboseResultManager';

export const STANDARD_SESSIONS_LIST = [
  '2026 APR/BIAN',
  '2025-26',
  '2025 APR/BIAN',
  '2024-25 (Oct-Nov)',
  '2024-25 (Mar-Apr)',
  '2024-25',
  '2023-24',
  '2022-23',
  '2021-22',
  '2020-21',
  '2019-20',
  '2018-19'
];

export default function ResultIngestionModal({
  isOpen,
  onClose,
  allStudents = [],
  onIngestSuccess,
  showToast
}) {
  // Tab State: 'excel' | 'ai_gazette' | 'ai_admit'
  const [activeTab, setActiveTab] = useState('excel');
  const [selectedClass, setSelectedClass] = useState('12th');
  const [selectedSession, setSelectedSession] = useState('2026 APR/BIAN');

  // File & Parsing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parsedStats, setParsedStats] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Filter & Search in Review Table
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState('all'); // 'all' | 'matched' | 'new' | 'Passed' | 'Reap' | 'Failed'

  // Admin Confirmation Gate State
  const [showConfirmGate, setShowConfirmGate] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const fileInputRef = useRef(null);

  // Filter students by selected class and session for template generation
  const classStudents = useMemo(() => {
    return allStudents.filter(s => {
      const cls = String(s.selectedClass || s.raw?.['Class'] || s.cls || '').trim();
      const sess = String(s.selectedSession || s.raw?.['Session'] || s.session || '').trim();
      const matchCls = !selectedClass || cls.toLowerCase().includes(selectedClass.toLowerCase());
      const matchSess = !selectedSession || sess.toLowerCase().includes(selectedSession.toLowerCase()) || 
        selectedSession.toLowerCase().includes(sess.toLowerCase());
      return matchCls && matchSess;
    });
  }, [allStudents, selectedClass, selectedSession]);

  // Handle Download Pre-filled Template
  const handleDownloadTemplate = () => {
    generateResultImportTemplate(classStudents, selectedClass, selectedSession);
    if (showToast) showToast(`📥 Downloaded Excel template with ${classStudents.length} students for Class ${selectedClass || 'All'} (${selectedSession})!`, 'success');
  };

  // Handle File Upload (Excel)
  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setIsProcessing(true);
    setProcessingStatusText(`Reading and parsing Excel records for Class ${selectedClass || 'All'} (${selectedSession})...`);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseAndValidateResultFile(buffer, allStudents, selectedClass, selectedSession);

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse file');
      }

      setParsedRows(result.rows);
      setParsedStats(result.stats);
      if (showToast) showToast(`✅ Successfully parsed ${result.rows.length} records!`, 'success');
    } catch (err) {
      console.error('Excel Import Error:', err);
      if (showToast) showToast(`Failed to parse file: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setProcessingStatusText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Gazette PDF / Image Upload via Gemini AI
  const handleAiGazetteUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setIsProcessing(true);
    setProcessingStatusText(`Preparing document for Gemini AI analysis (Class: ${selectedClass || 'All'}, Session: ${selectedSession})...`);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target.result;
        const result = await analyzeGazetteWithGemini(
          base64Data,
          file.type || 'application/pdf',
          allStudents,
          (status) => setProcessingStatusText(status),
          selectedClass,
          selectedSession
        );

        if (!result.success) {
          throw new Error(result.error || 'Gemini AI parsing failed');
        }

        setParsedRows(result.rows);
        setParsedStats(result.stats);
        if (showToast) showToast(`✨ Gemini AI extracted ${result.rows.length} examination records!`, 'success');
        setIsProcessing(false);
        setProcessingStatusText('');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('AI Gazette Error:', err);
      if (showToast) showToast(`AI Gazette Analysis Error: ${err.message}`, 'error');
      setIsProcessing(false);
      setProcessingStatusText('');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Admit Card PDF / Image Upload via Gemini AI
  const handleAiAdmitCardUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setIsProcessing(true);
    setProcessingStatusText(`Extracting candidate details from JKBOSE Admit Card(s) via Gemini AI...`);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target.result;
        const result = await analyzeAdmitCardWithGemini(
          base64Data,
          file.type || 'application/pdf',
          allStudents,
          (status) => setProcessingStatusText(status),
          selectedClass,
          selectedSession
        );

        if (!result.success) {
          throw new Error(result.error || 'Gemini AI Admit Card extraction failed');
        }

        setParsedRows(result.rows);
        setParsedStats(result.stats);
        if (showToast) showToast(`🎫 Gemini AI extracted ${result.rows.length} Admit Card records!`, 'success');
        setIsProcessing(false);
        setProcessingStatusText('');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('AI Admit Card Error:', err);
      if (showToast) showToast(`AI Admit Card Extraction Error: ${err.message}`, 'error');
      setIsProcessing(false);
      setProcessingStatusText('');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle selection of row
  const toggleRowSelect = (id) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selectedForImport: !r.selectedForImport } : r));
  };

  // Toggle select all
  const toggleSelectAll = (select) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selectedForImport: select })));
  };

  // Update a field directly in table cell
  const handleCellEdit = (id, field, value) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'marksReapp' && updated.resultStatus === 'Passed') {
        const numMatch = String(value).match(/(\d+)(?:\s*\/\s*(\d+))?/);
        if (numMatch) {
          const { division } = calculateDivision(numMatch[1], numMatch[2] || 500);
          updated.divDistinc = division;
        }
      }
      return updated;
    }));
  };

  // Remove row from review
  const handleRemoveRow = (id) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  // Filtered rows for display
  const displayedRows = useMemo(() => {
    return parsedRows.filter(r => {
      const isMatched = Boolean(r.matchedStudent && r.matchConfidence >= 70);
      if (filterResult === 'matched' && !isMatched) return false;
      if (filterResult === 'new' && isMatched) return false;
      if (['Passed', 'Reap', 'Failed'].includes(filterResult) && r.resultStatus !== filterResult) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        String(r.studentName || '').toLowerCase().includes(term) ||
        String(r.fatherName || '').toLowerCase().includes(term) ||
        String(r.motherName || '').toLowerCase().includes(term) ||
        String(r.examRollNo || '').toLowerCase().includes(term) ||
        String(r.regNo || '').toLowerCase().includes(term) ||
        String(r.formNo || '').toLowerCase().includes(term) ||
        String(r.subs || '').toLowerCase().includes(term)
      );
    });
  }, [parsedRows, filterResult, searchTerm]);

  // Selected count for import
  const selectedRowsToCommit = useMemo(() => {
    return parsedRows.filter(r => r.selectedForImport);
  }, [parsedRows]);

  const matchedCount = useMemo(() => {
    return selectedRowsToCommit.filter(r => r.matchedStudent && r.matchConfidence >= 70).length;
  }, [selectedRowsToCommit]);

  const newCount = useMemo(() => {
    return selectedRowsToCommit.length - matchedCount;
  }, [selectedRowsToCommit, matchedCount]);

  // Commit Batch to Firestore (Non-Destructive Upsert)
  const handleCommitToFirebase = async () => {
    if (selectedRowsToCommit.length === 0) {
      if (showToast) showToast('No records selected for import.', 'warning');
      return;
    }

    setIsCommitting(true);
    try {
      const res = await batchUpdateStudentResults(selectedRowsToCommit);
      if (showToast) {
        showToast(
          `🎉 Successfully synchronized ${res.count} student records in Firebase Firestore (${matchedCount} updated, ${newCount} new created)!`,
          'success'
        );
      }
      if (onIngestSuccess) onIngestSuccess();
      setShowConfirmGate(false);
      onClose();
    } catch (err) {
      console.error('Batch commit failed:', err);
      if (showToast) showToast(`Failed to update Firestore: ${err.message}`, 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-6xl w-full flex flex-col max-h-[96vh] overflow-hidden text-xs">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold shadow-inner">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide flex items-center gap-2">
                JKBOSE Exam Result, Admit Card & Roll Number Ingestion Hub
              </h3>
              <p className="text-[11px] text-slate-300">
                Universal Ingestion for Regular, Private & Bi-Annual Candidates across Classes 10th, 11th, 12th.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Navigation Tabs & Cohort Controls */}
        <div className="px-6 pt-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => { setActiveTab('excel'); }}
              className={`pb-2.5 px-3 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'excel'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileSpreadsheet size={15} />
              <span>Pipeline A: Excel Spreadsheet Import</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('ai_gazette'); }}
              className={`pb-2.5 px-3 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'ai_gazette'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sparkles size={15} />
              <span>Pipeline B: Gemini AI Result Gazette Analyzer</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('ai_admit'); }}
              className={`pb-2.5 px-3 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'ai_admit'
                  ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Award size={15} />
              <span>Pipeline C: Gemini AI Admit Card Extractor</span>
            </button>
          </div>

          {/* Quick Scope Selectors: Class & Dynamic Session */}
          <div className="flex items-center gap-2 pb-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-500">Class:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 text-xs"
              >
                <option value="12th">Class 12th</option>
                <option value="11th">Class 11th</option>
                <option value="10th">Class 10th</option>
                <option value="9th">Class 9th</option>
                <option value="">All Classes</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-500">Session:</span>
              <div className="relative">
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 text-xs"
                >
                  {STANDARD_SESSIONS_LIST.map(sess => (
                    <option key={sess} value={sess}>{sess}</option>
                  ))}
                  {!STANDARD_SESSIONS_LIST.includes(selectedSession) && (
                    <option value={selectedSession}>{selectedSession} (Custom)</option>
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content & Upload Banners */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {parsedRows.length === 0 ? (
            <div className="space-y-4">
              {activeTab === 'excel' ? (
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-teal-300 dark:border-teal-800/60 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                    <FileSpreadsheet size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      Excel Result & Roll Number Ingestion (.xlsx)
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mt-1">
                      Download the pre-populated template with all active Class {selectedClass || 'All'} students ({selectedSession}), fill in the result/roll fields (or provide <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">Marks Obt. (Prev.)</code> for re-appear subjects), and upload below.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate('xlsx')}
                      className="px-5 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700 font-extrabold flex items-center gap-2 cursor-pointer shadow-xs transition-all active:scale-95 text-xs"
                    >
                      <Download size={15} />
                      <span>Download Excel Template (.xlsx — Text Formatted)</span>
                    </button>

                    <label className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 text-white font-black flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 text-xs">
                      <Upload size={15} />
                      <span>Upload Completed Excel File (.xlsx)</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleExcelUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : activeTab === 'ai_gazette' ? (
                <div className="p-6 rounded-3xl bg-purple-50/50 dark:bg-purple-950/20 border border-dashed border-purple-300 dark:border-purple-800/60 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <Sparkles size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      Gemini AI Multimodal Gazette PDF Analyzer
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mt-1">
                      Upload the official JKBOSE Result Gazette (PDF or document image scan). Gemini AI will extract roll numbers, names, marks, and re-appear subject abbreviations (e.g. <code className="bg-purple-100 dark:bg-purple-900/60 px-1 rounded">Reap GN ED UD PD</code>) and automatically match by Exam Roll No & Registration No.
                    </p>
                  </div>

                  <label className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-black flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95">
                    <Upload size={15} />
                    <span>Upload Result Gazette (PDF / Image)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleAiGazetteUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="p-6 rounded-3xl bg-amber-50/50 dark:bg-amber-950/20 border border-dashed border-amber-300 dark:border-amber-800/60 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Award size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      Gemini AI JKBOSE Admit Card Extractor
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mt-1">
                      Upload scanned JKBOSE Admit Cards (single or multi-page PDF/Images). Gemini AI extracts Roll No, Registration No (R.R. No), Candidate Name, Father Name, Mother Name, Gender, Stream, Exam Centre, and Subjects Offered for Private/Bi-Annual candidates without prior admission forms.
                    </p>
                  </div>

                  <label className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-teal-600 hover:from-amber-500 hover:to-teal-500 text-white font-black flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95">
                    <Upload size={15} />
                    <span>Upload JKBOSE Admit Cards (PDF / Image)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleAiAdmitCardUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Processing Loader */}
              {isProcessing && (
                <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-3 text-indigo-900 dark:text-indigo-200 font-bold animate-pulse">
                  <RefreshCw size={18} className="animate-spin text-indigo-600" />
                  <span>{processingStatusText || 'Processing document...'}</span>
                </div>
              )}
            </div>
          ) : (
            
            /* ════════ INTERACTIVE REVIEW & VERIFICATION GRID ════════ */
            <div className="space-y-3 animate-fadeIn">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total Parsed</div>
                  <div className="text-base font-black text-slate-900 dark:text-white">{parsedStats?.total || parsedRows.length}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800">
                  <div className="text-[10px] text-teal-600 font-bold uppercase">DB Matched (Patch)</div>
                  <div className="text-base font-black text-teal-700 dark:text-teal-300">{parsedStats?.matched || 0}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                  <div className="text-[10px] text-sky-600 font-bold uppercase">New Candidates (Create)</div>
                  <div className="text-base font-black text-sky-700 dark:text-sky-300">{(parsedStats?.total || parsedRows.length) - (parsedStats?.matched || 0)}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[10px] text-emerald-600 font-bold uppercase">Passed</div>
                  <div className="text-base font-black text-emerald-700 dark:text-emerald-300">{parsedStats?.passed || 0}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-[10px] text-amber-600 font-bold uppercase">Re-appear</div>
                  <div className="text-base font-black text-amber-700 dark:text-amber-300">{parsedStats?.reap || 0}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <div className="text-[10px] text-indigo-600 font-bold uppercase">Selected To Commit</div>
                  <div className="text-base font-black text-indigo-700 dark:text-indigo-300">{selectedRowsToCommit.length}</div>
                </div>
              </div>

              {/* Table Controls & Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search parsed records by student, roll no, reg no, subjects..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'matched', label: '🟢 Matched (Patch)' },
                    { id: 'new', label: '🔵 New (Create)' },
                    { id: 'Passed', label: 'Passed' },
                    { id: 'Reap', label: 'Re-appear' }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterResult(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        filterResult === f.id
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-[10px] cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-[10px] cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => { setParsedRows([]); setParsedStats(null); }}
                    className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-[10px] cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[48vh] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    <tr>
                      <th className="p-2 w-8 text-center">Sel</th>
                      <th className="p-2 w-28">Identity / Status</th>
                      <th className="p-2">Student & Parents</th>
                      <th className="p-2 w-24">Reg. No.</th>
                      <th className="p-2 w-24">Class & Stream</th>
                      <th className="p-2 w-28">Exam Roll No</th>
                      <th className="p-2 w-32">Subjects / Re-appear</th>
                      <th className="p-2 w-24">Result</th>
                      <th className="p-2 w-24">Marks / Division</th>
                      <th className="p-2 w-8 text-center">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {displayedRows.map((row) => {
                      const isMatched = Boolean(row.matchedStudent && row.matchConfidence >= 70);
                      return (
                        <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!row.selectedForImport ? 'opacity-40' : ''}`}>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.selectedForImport}
                              onChange={() => toggleRowSelect(row.id)}
                              className="rounded accent-teal-600 cursor-pointer"
                            />
                          </td>

                          <td className="p-2">
                            {isMatched ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[9.5px]">
                                <CheckCircle2 size={11} />
                                <span>Form #{row.matchedStudent.formNo || row.matchedStudent.id}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold text-[9.5px]">
                                <UserPlus size={11} />
                                <span>New Candidate</span>
                              </span>
                            )}
                            <div className="text-[9px] text-slate-400 truncate max-w-[110px]" title={row.matchType}>
                              {row.matchType}
                            </div>
                          </td>

                          <td className="p-2">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{row.studentName}</div>
                            <div className="text-[9.5px] text-slate-400">
                              S/o {row.fatherName || '—'} {row.motherName ? `• M/o ${row.motherName}` : ''}
                            </div>
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={row.regNo}
                              onChange={(e) => handleCellEdit(row.id, 'regNo', e.target.value)}
                              placeholder="Reg No"
                              className="w-24 px-1.5 py-0.5 rounded bg-transparent border border-slate-200 dark:border-slate-700 hover:border-slate-300 focus:border-teal-500 font-mono text-[10.5px] outline-none"
                            />
                          </td>

                          <td className="p-2">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{row.className || selectedClass || '—'}</div>
                            <div className="text-[9.5px] text-slate-500">{row.stream || '—'}</div>
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={row.examRollNo}
                              onChange={(e) => handleCellEdit(row.id, 'examRollNo', e.target.value)}
                              placeholder="e.g. 301001258"
                              className="w-24 px-1.5 py-0.5 rounded bg-transparent border border-slate-200 dark:border-slate-700 hover:border-slate-300 focus:border-teal-500 font-bold font-mono text-[11px] text-indigo-700 dark:text-indigo-300 outline-none"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={row.subs || row.marksReapp || ''}
                              onChange={(e) => {
                                handleCellEdit(row.id, 'subs', e.target.value);
                                handleCellEdit(row.id, 'marksReapp', e.target.value);
                              }}
                              placeholder="Subjects Offered / Reappear"
                              className="w-32 px-1.5 py-0.5 rounded bg-transparent border border-slate-200 dark:border-slate-700 hover:border-slate-300 focus:border-teal-500 text-[10px] outline-none"
                              title={row.subs || row.marksReapp}
                            />
                          </td>

                          <td className="p-2">
                            <select
                              value={row.resultStatus}
                              onChange={(e) => handleCellEdit(row.id, 'resultStatus', e.target.value)}
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] outline-none ${
                                row.resultStatus === 'Passed'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  : row.resultStatus === 'Reap'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                  : row.resultStatus === 'Failed'
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <option value="Awaiting Result">Awaiting Result</option>
                              <option value="Passed">Passed</option>
                              <option value="Reap">Re-appear</option>
                              <option value="Failed">Failed</option>
                            </select>
                          </td>

                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={row.marksReapp}
                                onChange={(e) => handleCellEdit(row.id, 'marksReapp', e.target.value)}
                                placeholder="Marks / Div"
                                className="w-20 px-1.5 py-0.5 rounded bg-transparent border border-slate-200 dark:border-slate-700 hover:border-slate-300 focus:border-teal-500 font-bold text-[10px] outline-none"
                              />
                              <span className="text-[9px] text-slate-400 font-semibold">{row.divDistinc}</span>
                            </div>
                          </td>

                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              className="w-6 h-6 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors"
                              title="Remove Row"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* Footer & Admin Confirmation Gate Trigger */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span><strong>{selectedRowsToCommit.length}</strong> of {parsedRows.length} records selected to synchronize.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={() => setShowConfirmGate(true)}
                disabled={selectedRowsToCommit.length === 0}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 text-white font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <ShieldCheck size={16} />
                <span>Review & Commit to Firebase ({selectedRowsToCommit.length})</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ════════ MANDATORY ADMIN CONFIRMATION GATE DIALOG ════════ */}
      {showConfirmGate && (
        <div className="fixed inset-0 z-[9999999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-teal-500 rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            
            <div className="w-14 h-14 rounded-3xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
              <ShieldCheck size={32} />
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Admin Confirmation Gate
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                You are about to batch-synchronize <strong>{selectedRowsToCommit.length} student records</strong> into Firebase Firestore with non-destructive patch protection.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-left space-y-1.5 text-xs">
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">Target Cohort:</span>
                <span className="text-slate-900 dark:text-white font-mono">Class {selectedClass || 'All'} • {selectedSession}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">Total Selected:</span>
                <span className="text-teal-600 font-black">{selectedRowsToCommit.length} Students</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">Existing Records Patched:</span>
                <span className="text-emerald-600 font-bold">{matchedCount} Students</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">New Candidates Created:</span>
                <span className="text-sky-600 font-bold">{newCount} Students</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmGate(false)}
                disabled={isCommitting}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer"
              >
                Go Back & Edit
              </button>

              <button
                type="button"
                onClick={handleCommitToFirebase}
                disabled={isCommitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Writing to Firebase...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Confirm & Write Securely</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

