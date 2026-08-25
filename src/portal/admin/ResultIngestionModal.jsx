// =================================================================
// HSS SHANGUS — JKBOSE Exam Result & Roll Number Ingestion Hub
// Supports Excel/CSV Template Import, Gemini AI Multimodal Gazette
// Analyzer, Gemini AI Admit Card Extractor, Interactive Review Grid,
// Multi-Class / Multi-Session Scoping (10th, 11th, 12th & APR/BIAN),
// and Mandatory Non-Destructive Admin Confirmation Gate.
// =================================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  EyeOff,
  Trash2,
  Edit2,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  BookOpen,
  Layers,
  Award,
  Key,
  ExternalLink
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
import {
  fetchCloudGeminiKeys,
  saveCloudGeminiKeys,
  getStoredGeminiKeys,
  getPreferredGeminiModel,
  savePreferredGeminiModel,
  getAvailableGeminiModels,
  saveCustomGeminiModel,
  deleteGeminiModel,
  restoreDefaultGeminiModels,
  checkIsSuperAdmin,
  AVAILABLE_GEMINI_MODELS
} from '../../services/geminiLetterService';

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
  const isSuperAdmin = checkIsSuperAdmin();

  // Tab State: 'excel' | 'ai_gazette' | 'ai_admit'
  const [activeTab, setActiveTab] = useState('excel');
  const [selectedClass, setSelectedClass] = useState('12th');
  const [selectedSession, setSelectedSession] = useState('2026 APR/BIAN');

  // Gemini API Key Pool & Cloud Sync State
  const [showKeysConfig, setShowKeysConfig] = useState(false);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  const [keysInputText, setKeysInputText] = useState('');
  const [preferredModel, setPreferredModel] = useState(() => getPreferredGeminiModel() || 'gemini-3.7-flash');
  const [showKeysPreview, setShowKeysPreview] = useState(false);
  const [modelsList, setModelsList] = useState(() => getAvailableGeminiModels());
  const [showAddCustomModel, setShowAddCustomModel] = useState(false);
  const [showManageModels, setShowManageModels] = useState(false);
  const [customModelIdInput, setCustomModelIdInput] = useState('');
  const [customModelNameInput, setCustomModelNameInput] = useState('');

  // Sync Gemini keys & custom models from Cloud Firestore whenever modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCloudGeminiKeys().then(keys => {
        if (Array.isArray(keys) && keys.length > 0) {
          setGeminiKeys(keys);
          setKeysInputText(keys.join('\n'));
        }
        const avail = getAvailableGeminiModels();
        setModelsList(avail);
        const pref = getPreferredGeminiModel();
        if (avail.some(m => m.id === pref)) {
          setPreferredModel(pref);
        } else if (avail.length > 0) {
          setPreferredModel(avail[0].id);
        }
      });
    }
  }, [isOpen]);

  const handleSaveKeys = async () => {
    const rawList = keysInputText.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    const cleaned = Array.from(new Set(rawList));
    setGeminiKeys(cleaned);
    await saveCloudGeminiKeys(cleaned);
    savePreferredGeminiModel(preferredModel);
    setShowKeysConfig(false);
    if (showToast) showToast(`✓ Saved ${cleaned.length} Gemini API Key(s) & Model (${preferredModel}) to Cloud DB!`, 'success');
  };

  const handleAddCustomModel = async (e) => {
    if (e) e.preventDefault();
    if (!customModelIdInput.trim()) {
      if (showToast) showToast('Please enter a valid Gemini Model ID (e.g. gemini-3.7-flash)', 'warning');
      return;
    }
    const cleanId = customModelIdInput.trim();
    const cleanName = customModelNameInput.trim() || cleanId;
    const updated = await saveCustomGeminiModel({
      id: cleanId,
      name: cleanName,
      tier: 'Custom Model',
      freeTier: true
    });
    setModelsList(updated);
    setPreferredModel(cleanId);
    setCustomModelIdInput('');
    setCustomModelNameInput('');
    setShowAddCustomModel(false);
    if (showToast) showToast(`✓ Added "${cleanName}" (${cleanId}) to Gemini AI Models!`, 'success');
  };

  const handleDeleteModel = async (modelId) => {
    if (modelsList.length <= 1) {
      if (showToast) showToast('At least one Gemini model must remain configured.', 'warning');
      return;
    }
    const updated = await deleteGeminiModel(modelId);
    setModelsList(updated);
    if (preferredModel === modelId) {
      const nextModel = updated[0]?.id || 'gemini-3.7-flash';
      setPreferredModel(nextModel);
      savePreferredGeminiModel(nextModel);
    }
    if (showToast) showToast(`✓ Deleted model ${modelId}`, 'info');
  };

  const handleRestoreDefaults = async () => {
    const updated = await restoreDefaultGeminiModels();
    setModelsList(updated);
    setPreferredModel('gemini-3.7-flash');
    if (showToast) showToast('✓ Restored standard Gemini models (Gemini 3.7 Flash default)!', 'success');
  };

  // File & Multi-Screenshot State (Up to 5 images/PDFs)
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [parsedRows, setParsedRows] = useState([]);
  const [parsedStats, setParsedStats] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]); // [{ id, file, name, size, mimeType, base64, previewUrl }]
  const abortControllerRef = useRef(null);

  // Live Timer for AI Processing
  useEffect(() => {
    let timer = null;
    if (isProcessing) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isProcessing]);

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    setProcessingStatusText('');
    if (showToast) showToast('AI analysis cancelled.', 'info');
  };

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

  // Handle Multi-Screenshot / PDF File Selection (Up to 5 images)
  const handleAddFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = 5 - uploadedFiles.length;
    if (remainingSlots <= 0) {
      if (showToast) showToast('Maximum 5 screenshot images/pages allowed per batch.', 'warning');
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
        const newItem = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          file,
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          base64,
          previewUrl: isImg ? base64 : null
        };
        setUploadedFiles(prev => {
          if (prev.length >= 5) return prev;
          return [...prev, newItem];
        });
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeUploadedFile = (id) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAllUploadedFiles = () => {
    setUploadedFiles([]);
  };

  // Run Gemini AI Multimodal Analysis on all selected files (up to 5)
  const handleRunAiAnalysis = async (mode) => {
    if (uploadedFiles.length === 0) {
      if (showToast) showToast('Please select at least 1 document or screenshot image.', 'warning');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProcessing(true);
    setProcessingStatusText(`Connecting to Gemini AI (${preferredModel}) for ${uploadedFiles.length} file(s)...`);

    try {
      const payloadFiles = uploadedFiles.map(f => ({
        data: f.base64,
        mimeType: f.mimeType
      }));

      let result;
      if (mode === 'ai_gazette') {
        result = await analyzeGazetteWithGemini(
          payloadFiles,
          'image/jpeg',
          allStudents,
          (status) => setProcessingStatusText(status),
          selectedClass,
          selectedSession,
          preferredModel,
          controller.signal
        );
      } else {
        result = await analyzeAdmitCardWithGemini(
          payloadFiles,
          'image/jpeg',
          allStudents,
          (status) => setProcessingStatusText(status),
          selectedClass,
          selectedSession,
          preferredModel,
          controller.signal
        );
      }

      if (!result.success) {
        throw new Error(result.error || 'Gemini AI analysis failed');
      }

      setParsedRows(result.rows);
      setParsedStats(result.stats);
      if (showToast) {
        showToast(
          mode === 'ai_gazette'
            ? `✨ Gemini AI successfully extracted ${result.rows.length} result records from ${uploadedFiles.length} screenshot(s)!`
            : `🎫 Gemini AI extracted ${result.rows.length} Admit Card candidate records from ${uploadedFiles.length} screenshot(s)!`,
          'success'
        );
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('cancelled')) {
        console.log('AI Analysis cancelled by user.');
      } else {
        console.error('Gemini AI Analysis Error:', err);
        if (showToast) showToast(`AI Analysis Error: ${err.message}`, 'error');
      }
    } finally {
      setIsProcessing(false);
      setProcessingStatusText('');
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
        
        {/* Minimal Header */}
        <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <Database size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black tracking-tight text-slate-100">
                  JKBOSE Result & Roll Number Ingestion
                </h3>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                  Universal Hub
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Minimal Segmented Tabs & Cohort Controls Bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 shrink-0">
          {/* Segmented Pill Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('excel')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'excel'
                  ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>Excel Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai_gazette')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ai_gazette'
                  ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sparkles size={13} />
              <span>Gazette AI OCR</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai_admit')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ai_admit'
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Award size={13} />
              <span>Admit Card AI</span>
            </button>
          </div>

          {/* Quick Scope Selectors: Class & Session & AI Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10.5px] font-bold text-slate-500">Class:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 text-[11px]"
              >
                <option value="12th">Class 12th</option>
                <option value="11th">Class 11th</option>
                <option value="10th">Class 10th</option>
                <option value="9th">Class 9th</option>
                <option value="">All Classes</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10.5px] font-bold text-slate-500">Session:</span>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 text-[11px]"
              >
                {STANDARD_SESSIONS_LIST.map(sess => (
                  <option key={sess} value={sess}>{sess}</option>
                ))}
                {!STANDARD_SESSIONS_LIST.includes(selectedSession) && (
                  <option value={selectedSession}>{selectedSession} (Custom)</option>
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowKeysConfig(!showKeysConfig)}
              className="px-2 py-0.5 rounded-lg font-bold text-[10.5px] border flex items-center gap-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 cursor-pointer shadow-2xs whitespace-nowrap"
              title={isSuperAdmin ? "Manage Gemini AI API Keys & Models (SuperAdmin Control)" : `Gemini AI Vision Active (${preferredModel})`}
            >
              {isSuperAdmin ? <Key size={11} className="text-amber-600" /> : <Sparkles size={11} className="text-amber-600" />}
              <span>{isSuperAdmin ? `${geminiKeys.length} Keys Pool` : preferredModel}</span>
            </button>
          </div>
        </div>

        {/* Gemini API Key Pool Configuration Drawer */}
        {showKeysConfig && (
          <div className="mx-6 mt-3 p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 space-y-2.5 animate-fadeIn text-xs">
            {isSuperAdmin ? (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Key size={14} className="text-amber-600" />
                    <span className="font-black text-amber-950 dark:text-amber-100 text-xs">
                      Gemini API Key Pool ({geminiKeys.length} Active Key{geminiKeys.length !== 1 ? 's' : ''} in Cloud DB):
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                      SuperAdmin Access
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowKeysPreview(!showKeysPreview)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-300 hover:bg-amber-100/50 flex items-center gap-1 cursor-pointer"
                    >
                      {showKeysPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                      <span>{showKeysPreview ? 'Hide Keys' : 'Reveal Keys'}</span>
                    </button>

                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-amber-800 dark:text-amber-300 font-black hover:underline flex items-center gap-0.5 bg-amber-200/50 dark:bg-amber-900/50 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700"
                    >
                      <span>Get Free Key</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={showKeysPreview ? keysInputText : (keysInputText ? keysInputText.split(/[\n,]+/).filter(Boolean).map(k => (k.length > 12 ? (k.slice(0, 8) + '••••••••••••••••••••••••' + k.slice(-4)) : '••••••••••••••••••••••••')).join('\n') : '')}
                  onChange={(e) => {
                    if (showKeysPreview) {
                      setKeysInputText(e.target.value);
                    }
                  }}
                  readOnly={!showKeysPreview}
                  placeholder={showKeysPreview ? "Paste your Gemini API keys here (one per line or comma-separated)." : "Keys are hidden. Click 'Reveal Keys' above to view or edit."}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <div className="font-black text-[11px] text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                      <span>Google Gemini AI Multi-Key Pool</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        {geminiKeys.length} Cloud Keys Active
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                      🔒 Secret API credentials and key rotation are managed exclusively by the SuperAdmin. AI extraction is fully operational.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1 border-t border-amber-200/80 dark:border-amber-800/60">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Preferred AI Model:</span>
                  <select
                    value={preferredModel}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setShowAddCustomModel(true);
                      } else {
                        setPreferredModel(e.target.value);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 font-bold text-[11px] text-slate-800 dark:text-slate-100 shadow-2xs"
                  >
                    {modelsList.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.freeTier ? '— [Free API Tier]' : ''}
                      </option>
                    ))}
                    <option value="__add_new__">➕ Add Future / Custom Gemini Model...</option>
                  </select>

                  {/* Direct Delete Selected Model Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteModel(preferredModel)}
                    title={`Delete / Remove "${preferredModel}" from models list`}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 cursor-pointer transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowAddCustomModel(!showAddCustomModel); setShowManageModels(false); }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 hover:bg-amber-300 border border-amber-400 dark:border-amber-700 cursor-pointer transition-colors"
                  >
                    {showAddCustomModel ? 'Hide Form' : '➕ Add Model'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowManageModels(!showManageModels); setShowAddCustomModel(false); }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    {showManageModels ? 'Close Models' : '⚙️ Manage Models'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKeysConfig(false)}
                    className="px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveKeys}
                    className="px-3.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] cursor-pointer shadow-xs"
                  >
                    {isSuperAdmin ? '✓ Save Keys & Model to Cloud DB' : '✓ Save Preferred Model'}
                  </button>
                </div>
              </div>

              {/* Inline Custom Model Adder Subform */}
              {showAddCustomModel && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 shadow-sm space-y-2 animate-scaleUp">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                      <Sparkles size={12} className="text-amber-500" />
                      Add Any Future / Custom Google Gemini Model
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomModel(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Model ID (Exact API Identifier)</label>
                      <input
                        type="text"
                        value={customModelIdInput}
                        onChange={(e) => setCustomModelIdInput(e.target.value)}
                        placeholder="e.g. gemini-3.7-flash or gemini-3.6-flash"
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[10.5px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Display Label (Optional)</label>
                      <input
                        type="text"
                        value={customModelNameInput}
                        onChange={(e) => setCustomModelNameInput(e.target.value)}
                        placeholder="e.g. Gemini 3.7 Flash (Latest)"
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-[10.5px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-slate-400">
                      💡 New models are saved to Cloud Firestore and instantly available across all AI features.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddCustomModel(false)}
                        className="px-2.5 py-0.5 rounded text-[10px] font-bold text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomModel}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10.5px] shadow-xs cursor-pointer"
                      >
                        ✓ Add & Select Model
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Complete Models Management Panel with Individual Delete & Reset Defaults */}
              {showManageModels && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-sm space-y-2 animate-scaleUp">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 flex items-center gap-1">
                      <span>Available Gemini Models ({modelsList.length})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRestoreDefaults}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw size={10} />
                        <span>Restore Defaults</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowManageModels(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {modelsList.map(m => (
                      <div
                        key={m.id}
                        className={`p-2 rounded-lg border flex items-center justify-between text-[10.5px] ${
                          preferredModel === m.id
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 text-amber-950 dark:text-amber-100 font-bold'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="truncate">{m.name || m.id}</span>
                            {preferredModel === m.id && (
                              <span className="text-[8.5px] bg-amber-200 dark:bg-amber-900 px-1 rounded text-amber-800 dark:text-amber-200">Active</span>
                            )}
                          </div>
                          <span className="font-mono text-[9px] text-slate-400 truncate">{m.id}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {preferredModel !== m.id && (
                            <button
                              type="button"
                              onClick={() => { setPreferredModel(m.id); savePreferredGeminiModel(m.id); }}
                              className="px-1.5 py-0.5 rounded text-[9.5px] bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 cursor-pointer font-bold"
                            >
                              Use
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteModel(m.id)}
                            title={`Delete ${m.id}`}
                            className="p-1 rounded text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/80 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content & Upload Banners */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          
          {parsedRows.length === 0 ? (
            <div className="space-y-3">
              {/* Tab 1: Excel Import (Minimal) */}
              {activeTab === 'excel' && (
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <FileSpreadsheet size={15} className="text-teal-600 dark:text-teal-400" />
                        <span>Excel Result Spreadsheet Import (.xlsx)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Download pre-populated template with Class {selectedClass || 'All'} students ({selectedSession}), fill in marks/roll numbers, and upload.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadTemplate('xlsx')}
                        className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700 font-bold flex items-center gap-1.5 cursor-pointer text-xs transition-all shadow-2xs"
                      >
                        <Download size={13} />
                        <span>Download Template ({classStudents.length} Students)</span>
                      </button>

                      <label className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs text-xs transition-all">
                        <Upload size={13} />
                        <span>Upload Excel (.xlsx)</span>
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
                </div>
              )}

              {/* Tab 2: Gazette AI OCR (Minimal) */}
              {activeTab === 'ai_gazette' && (
                <div className="p-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-purple-600" />
                        <span>Gemini Multimodal Gazette OCR Extractor</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Upload official JKBOSE Result Gazette (PDF or up to 5 screenshot images). Gemini AI automatically extracts roll numbers, names, marks, and re-appear subjects.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {uploadedFiles.length < 5 && !isProcessing && (
                        <label className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-purple-50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-bold flex items-center gap-1.5 cursor-pointer text-xs shadow-2xs transition-all">
                          <Upload size={13} />
                          <span>{uploadedFiles.length === 0 ? 'Upload Screenshots / PDF' : '+ Add Screenshot'}</span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,image/*"
                            onChange={handleAddFiles}
                            className="hidden"
                          />
                        </label>
                      )}

                      {uploadedFiles.length > 0 && !isProcessing && (
                        <button
                          type="button"
                          onClick={() => handleRunAiAnalysis('ai_gazette')}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black flex items-center gap-1.5 cursor-pointer shadow-xs text-xs transition-all active:scale-95"
                        >
                          <Sparkles size={13} />
                          <span>Extract Results ({uploadedFiles.length} Image{uploadedFiles.length > 1 ? 's' : ''})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Attached Screenshots Strip */}
                  {uploadedFiles.length > 0 && (
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1.5 px-1">
                        <span>Attached Pages ({uploadedFiles.length} of 5 max):</span>
                        <button type="button" onClick={clearAllUploadedFiles} className="text-rose-600 hover:underline cursor-pointer">Clear All</button>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {uploadedFiles.map((f, idx) => (
                          <div key={f.id} className="relative group shrink-0 w-24 h-18 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 flex flex-col justify-between p-1">
                            <span className="absolute top-1 left-1 px-1 rounded bg-black/70 text-white text-[8px] font-mono font-bold z-10">#{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeUploadedFile(f.id)}
                              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer z-10 shadow-xs"
                            >
                              <X size={9} />
                            </button>
                            {f.previewUrl ? (
                              <img src={f.previewUrl} alt={f.name} className="w-full h-11 object-cover rounded" />
                            ) : (
                              <div className="w-full h-11 flex items-center justify-center text-purple-600"><FileText size={18} /></div>
                            )}
                            <span className="text-[8px] text-slate-500 truncate">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time Processing HUD */}
                  {isProcessing && (
                    <div className="p-3 rounded-xl bg-purple-100/80 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-700 text-xs space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RefreshCw size={13} className="text-purple-600 dark:text-purple-400 animate-spin" />
                          <span className="font-black text-purple-950 dark:text-purple-100 text-[11px]">
                            Extracting Gazette Results with {preferredModel}...
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200">
                          ⏱️ {elapsedSeconds}s
                        </span>
                      </div>
                      <div className="w-full h-1 bg-purple-200 dark:bg-purple-900 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse w-full" />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] text-purple-700 dark:text-purple-300">
                        <span>{processingStatusText || `Reading OCR tables across ${uploadedFiles.length} screenshot(s)...`}</span>
                        <button type="button" onClick={handleCancelAnalysis} className="text-rose-600 hover:underline font-bold cursor-pointer">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Admit Card AI (Minimal) */}
              {activeTab === 'ai_admit' && (
                <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Award size={14} className="text-amber-600" />
                        <span>Gemini AI Admit Card Extractor</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Upload scanned JKBOSE Admit Cards (single PDF or up to 5 screenshot images). Gemini AI extracts Roll No, Registration No, Name, Parents, Stream, and Subjects.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {uploadedFiles.length < 5 && !isProcessing && (
                        <label className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold flex items-center gap-1.5 cursor-pointer text-xs shadow-2xs transition-all">
                          <Upload size={13} />
                          <span>{uploadedFiles.length === 0 ? 'Upload Admit Cards / PDF' : '+ Add Screenshot'}</span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,image/*"
                            onChange={handleAddFiles}
                            className="hidden"
                          />
                        </label>
                      )}

                      {uploadedFiles.length > 0 && !isProcessing && (
                        <button
                          type="button"
                          onClick={() => handleRunAiAnalysis('ai_admit')}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-teal-600 hover:from-amber-500 hover:to-teal-500 text-white font-black flex items-center gap-1.5 cursor-pointer shadow-xs text-xs transition-all active:scale-95"
                        >
                          <Sparkles size={13} />
                          <span>Extract Admit Cards ({uploadedFiles.length} Image{uploadedFiles.length > 1 ? 's' : ''})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Attached Screenshots Strip */}
                  {uploadedFiles.length > 0 && (
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1.5 px-1">
                        <span>Attached Pages ({uploadedFiles.length} of 5 max):</span>
                        <button type="button" onClick={clearAllUploadedFiles} className="text-rose-600 hover:underline cursor-pointer">Clear All</button>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {uploadedFiles.map((f, idx) => (
                          <div key={f.id} className="relative group shrink-0 w-24 h-18 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 flex flex-col justify-between p-1">
                            <span className="absolute top-1 left-1 px-1 rounded bg-black/70 text-white text-[8px] font-mono font-bold z-10">#{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeUploadedFile(f.id)}
                              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer z-10 shadow-xs"
                            >
                              <X size={9} />
                            </button>
                            {f.previewUrl ? (
                              <img src={f.previewUrl} alt={f.name} className="w-full h-11 object-cover rounded" />
                            ) : (
                              <div className="w-full h-11 flex items-center justify-center text-amber-600"><FileText size={18} /></div>
                            )}
                            <span className="text-[8px] text-slate-500 truncate">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time Processing HUD */}
                  {isProcessing && (
                    <div className="p-3 rounded-xl bg-amber-100/80 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-xs space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RefreshCw size={13} className="text-amber-600 dark:text-amber-400 animate-spin" />
                          <span className="font-black text-amber-950 dark:text-amber-100 text-[11px]">
                            Extracting Admit Cards with {preferredModel}...
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                          ⏱️ {elapsedSeconds}s
                        </span>
                      </div>
                      <div className="w-full h-1 bg-amber-200 dark:bg-amber-900 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-teal-500 animate-pulse w-full" />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] text-amber-700 dark:text-amber-300">
                        <span>{processingStatusText || `Reading candidate details across ${uploadedFiles.length} scan(s)...`}</span>
                        <button type="button" onClick={handleCancelAnalysis} className="text-rose-600 hover:underline font-bold cursor-pointer">Cancel</button>
                      </div>
                    </div>
                  )}
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

        {/* Minimal Footer & Admin Confirmation Gate Trigger */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            {parsedRows.length > 0 && (
              <span><strong>{selectedRowsToCommit.length}</strong> of {parsedRows.length} records selected to synchronize.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer text-xs"
            >
              Close
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={() => setShowConfirmGate(true)}
                disabled={selectedRowsToCommit.length === 0}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 text-white font-black shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50 text-xs"
              >
                <ShieldCheck size={14} />
                <span>Sync to Firebase ({selectedRowsToCommit.length})</span>
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

