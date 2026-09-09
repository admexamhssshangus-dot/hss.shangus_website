import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sparkles, Upload, FileText, Trash2, CheckCircle2, AlertTriangle, 
  Terminal, Key, ExternalLink, RefreshCw, Eye, EyeOff, ShieldCheck, 
  Search, CheckSquare, Square, Edit2, ArrowRight, Layers, FileSpreadsheet
} from 'lucide-react';
import { 
  analyzeGazetteWithGemini, 
  analyzeAdmitCardWithGemini, 
  batchUpdateStudentResults, 
  calculateDivision 
} from '../../../utils/jkboseResultManager';
import { 
  fetchCloudGeminiKeys, 
  saveCloudGeminiKeys, 
  getStoredGeminiKeys, 
  getPreferredGeminiModel, 
  savePreferredGeminiModel, 
  getAvailableGeminiModels,
  callDirectGeminiClient 
} from '../../../services/geminiLetterService';

export default function GazetteAndAdmitAiTab({
  mode = 'gazette_ai', // 'gazette_ai' | 'admit_ai'
  allStudents = [],
  targetClass = '12th',
  targetSession = '2026 APR/BIAN',
  onIngestSuccess,
  showToast
}) {
  // File & Multi-Screenshot State (Up to 5 images/PDFs)
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [parsedStats, setParsedStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState('all'); // 'all' | 'matched' | 'new' | 'Passed' | 'Reap'
  const [overwriteExamRoll, setOverwriteExamRoll] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Gemini API Key & Model Configuration
  const [preferredModel, setPreferredModel] = useState(() => getPreferredGeminiModel() || 'gemini-3.7-flash');
  const [modelsList, setModelsList] = useState(() => getAvailableGeminiModels());
  const [showKeysConfig, setShowKeysConfig] = useState(false);
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  const [keysInputText, setKeysInputText] = useState('');
  const [keyTestResult, setKeyTestResult] = useState(null);

  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const terminalEndRef = useRef(null);

  // Sync Gemini keys from cloud
  useEffect(() => {
    fetchCloudGeminiKeys().then(keys => {
      if (Array.isArray(keys) && keys.length > 0) {
        setGeminiKeys(keys);
        setKeysInputText(keys.join('\n'));
      }
      const avail = getAvailableGeminiModels();
      setModelsList(avail);
    }).catch(() => {});
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Timer
  useEffect(() => {
    let timer = null;
    if (isProcessing) {
      setElapsedSeconds(0);
      timer = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isProcessing]);

  // File selection
  const handleAddFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = 5 - uploadedFiles.length;
    if (remainingSlots <= 0) {
      if (showToast) showToast('Maximum 5 files allowed per AI batch.', 'warning');
      return;
    }

    files.slice(0, remainingSlots).forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target.result;
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
        setUploadedFiles(prev => [...prev, newItem].slice(0, 5));
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    setParsedRows([]);
    setParsedStats(null);
  };

  // Run AI Analysis
  const handleRunAnalysis = async () => {
    if (uploadedFiles.length === 0) {
      if (showToast) showToast('Please select at least 1 document or screenshot image.', 'warning');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const nowStr = new Date().toLocaleTimeString();
    setTerminalLogs([
      { id: '1', time: nowStr, type: 'init', text: `🚀 Initialized ${mode === 'gazette_ai' ? 'Gazette Multimodal Vision OCR' : 'Admit Card AI Extractor'}` },
      { id: '2', time: nowStr, type: 'info', text: `🎯 Target Cohort: Class ${targetClass} (${targetSession}) • Model: [${preferredModel}]` },
      { id: '3', time: nowStr, type: 'payload', text: `📦 Prepared ${uploadedFiles.length} file(s) for Gemini multimodal inference.` }
    ]);

    setIsProcessing(true);
    setProcessingStatusText(`Connecting to Gemini AI (${preferredModel})...`);

    const onProgress = (logObj) => {
      const time = new Date().toLocaleTimeString();
      const text = typeof logObj === 'string' ? logObj : logObj.message || JSON.stringify(logObj);
      setProcessingStatusText(text);
      setTerminalLogs(prev => [...prev, { id: `${Date.now()}_${Math.random()}`, time, type: 'info', text }]);
    };

    try {
      const payloadFiles = uploadedFiles.map(f => ({
        data: f.base64,
        mimeType: f.mimeType
      }));

      let result;
      if (mode === 'gazette_ai') {
        result = await analyzeGazetteWithGemini(
          payloadFiles,
          'image/jpeg',
          allStudents,
          onProgress,
          targetClass,
          targetSession,
          preferredModel,
          controller.signal
        );
      } else {
        result = await analyzeAdmitCardWithGemini(
          payloadFiles,
          'image/jpeg',
          allStudents,
          onProgress,
          targetClass,
          targetSession,
          preferredModel,
          controller.signal
        );
      }

      if (!result.success) {
        throw new Error(result.error || 'Gemini AI extraction failed');
      }

      setParsedRows(result.rows || []);
      setParsedStats(result.stats || null);
      if (showToast) {
        showToast(`✨ Successfully extracted ${result.rows?.length || 0} candidate records via Gemini AI!`, 'success');
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('cancelled')) {
        setTerminalLogs(prev => [...prev, { id: `${Date.now()}`, time: new Date().toLocaleTimeString(), type: 'abort', text: '🛑 Analysis aborted by user.' }]);
      } else {
        console.error('Gemini Analysis Error:', err);
        setTerminalLogs(prev => [...prev, { id: `${Date.now()}`, time: new Date().toLocaleTimeString(), type: 'warn', text: `❌ Error: ${err.message}` }]);
        if (showToast) showToast(`Gemini AI extraction failed: ${err.message}`, 'error');
      }
    } finally {
      setIsProcessing(false);
      setProcessingStatusText('');
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsProcessing(false);
    setProcessingStatusText('');
  };

  // Test Key
  const handleTestKey = async () => {
    setKeyTestResult({ status: 'testing', message: 'Testing Gemini API connectivity...' });
    try {
      const res = await callDirectGeminiClient({
        prompt: 'Respond with exactly: CONNECTIVITY_OK',
        maxOutputTokens: 16,
        model: preferredModel
      });
      if (res?.text) {
        setKeyTestResult({ status: 'success', message: `✅ Key active! Model "${preferredModel}" responded.` });
      } else {
        setKeyTestResult({ status: 'error', message: '⚠️ Empty response from API.' });
      }
    } catch (err) {
      setKeyTestResult({ status: 'error', message: `❌ ${err.message}` });
    }
  };

  const handleSaveKeys = async () => {
    const rawList = keysInputText.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    const cleaned = Array.from(new Set(rawList));
    setGeminiKeys(cleaned);
    await saveCloudGeminiKeys(cleaned);
    savePreferredGeminiModel(preferredModel);
    setShowKeysConfig(false);
    if (showToast) showToast(`✓ Saved ${cleaned.length} API Key(s) & Model (${preferredModel})!`, 'success');
  };

  // Table row edits
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

  const toggleRowSelect = (id) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selectedForImport: !r.selectedForImport } : r));
  };

  const toggleSelectAll = (select) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selectedForImport: select })));
  };

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
        String(r.examRollNo || '').toLowerCase().includes(term) ||
        String(r.regNo || '').toLowerCase().includes(term) ||
        String(r.subs || '').toLowerCase().includes(term)
      );
    });
  }, [parsedRows, filterResult, searchTerm]);

  const selectedRowsToCommit = useMemo(() => {
    return parsedRows.filter(r => r.selectedForImport);
  }, [parsedRows]);

  // Batch commit
  const handleCommit = async () => {
    if (selectedRowsToCommit.length === 0) {
      if (showToast) showToast('No student records selected for commit.', 'warning');
      return;
    }

    setIsCommitting(true);
    try {
      const res = await batchUpdateStudentResults(selectedRowsToCommit, { overwriteExamRoll });
      if (showToast) {
        showToast(`🎉 Successfully updated ${res.count} records in Firebase Firestore!`, 'success');
      }
      if (onIngestSuccess) {
        onIngestSuccess({ records: selectedRowsToCommit, result: res, overwriteExamRoll });
      }
      setParsedRows([]);
      setUploadedFiles([]);
    } catch (err) {
      console.error('Batch commit failed:', err);
      if (showToast) showToast(`Failed to update records: ${err.message}`, 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/20 dark:to-blue-950/30 border border-purple-200 dark:border-purple-900/60 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-xs">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-900 dark:text-white">
                {mode === 'gazette_ai' ? '📰 Multimodal Gazette AI Vision OCR' : '🪪 Admit Card AI Extractor'}
              </h3>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                Gemini Vision Multimodal
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Upload PDF gazette pages or screenshots to extract official Roll Numbers, Marks, Divisions, and Results automatically.
            </p>
          </div>
        </div>

        {/* Model & Keys Selector */}
        <div className="flex items-center gap-2">
          <select
            value={preferredModel}
            onChange={(e) => {
              setPreferredModel(e.target.value);
              savePreferredGeminiModel(e.target.value);
            }}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            {modelsList.map(m => (
              <option key={m.id} value={m.id}>{m.name || m.id}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowKeysConfig(!showKeysConfig)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 cursor-pointer"
          >
            <Key size={13} />
            <span>Keys ({geminiKeys.length})</span>
          </button>
        </div>
      </div>

      {/* Keys Config Drawer */}
      {showKeysConfig && (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Gemini API Key Pool</span>
            <button
              type="button"
              onClick={handleTestKey}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Test Connectivity
            </button>
          </div>
          <textarea
            rows={2}
            value={keysInputText}
            onChange={(e) => setKeysInputText(e.target.value)}
            placeholder="Enter Gemini API keys separated by commas or newlines"
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-[11px] text-slate-900 dark:text-white outline-none"
          />
          {keyTestResult && (
            <div className={`p-2 rounded-lg text-[11px] font-bold ${keyTestResult.status === 'success' ? 'bg-emerald-50 text-emerald-800' : keyTestResult.status === 'testing' ? 'bg-blue-50 text-blue-800' : 'bg-rose-50 text-rose-800'}`}>
              {keyTestResult.message}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowKeysConfig(false)}
              className="px-3 py-1 rounded-lg text-slate-500 hover:bg-slate-200 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveKeys}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer"
            >
              Save Keys
            </button>
          </div>
        </div>
      )}

      {/* File Dropzone */}
      <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Upload size={20} />
          <span className="font-bold text-xs">Drop PDF / Image Gazette Pages or Screenshots (Max 5)</span>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
            {uploadedFiles.map(f => (
              <div key={f.id} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 shadow-xs">
                {f.previewUrl ? (
                  <img src={f.previewUrl} alt="preview" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <FileText size={18} className="text-purple-600" />
                )}
                <div className="text-left">
                  <div className="text-[11px] font-bold truncate max-w-[130px]">{f.name}</div>
                  <div className="text-[9px] text-slate-400">{f.size}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadedFiles.length >= 5 || isProcessing}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-xs text-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
          >
            {uploadedFiles.length === 0 ? 'Select Files' : `Add More (${uploadedFiles.length}/5)`}
          </button>

          {uploadedFiles.length > 0 && (
            <>
              <button
                type="button"
                onClick={clearFiles}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 font-bold text-xs cursor-pointer"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={isProcessing}
                className="px-5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>{isProcessing ? `Analyzing (${elapsedSeconds}s)...` : 'Run AI Vision OCR'}</span>
              </button>

              {isProcessing && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={handleAddFiles}
          className="hidden"
        />
      </div>

      {/* Terminal Logs */}
      {terminalLogs.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] max-h-36 overflow-y-auto space-y-1 custom-scrollbar border border-slate-800">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Terminal size={11} />
              <span>Gemini Terminal Log</span>
            </span>
            <span>{terminalLogs.length} events</span>
          </div>
          {terminalLogs.map(l => (
            <div key={l.id} className="leading-tight">
              <span className="text-slate-500">[{l.time}]</span>{' '}
              <span className={l.type === 'warn' ? 'text-rose-400 font-bold' : l.type === 'abort' ? 'text-amber-400' : 'text-slate-300'}>
                {l.text}
              </span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      )}

      {/* Extracted Review Grid */}
      {parsedRows.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                Extracted Results Review ({parsedRows.length})
              </h4>
              {parsedStats && (
                <span className="text-[10px] text-slate-500 font-medium">
                  • {parsedStats.matched} DB Matched • {parsedStats.passed} Passed
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search candidates..."
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none"
              />

              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none cursor-pointer"
              >
                <option value="all">All Records</option>
                <option value="matched">Matched Only</option>
                <option value="new">New Records</option>
                <option value="Passed">Passed</option>
                <option value="Reap">Reappear</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-[320px] custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="p-2 text-center w-8">
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(selectedRowsToCommit.length !== parsedRows.length)}
                      className="cursor-pointer text-slate-600"
                    >
                      {selectedRowsToCommit.length === parsedRows.length ? <CheckSquare size={13} /> : <Square size={13} />}
                    </button>
                  </th>
                  <th className="p-2">Exam Roll No</th>
                  <th className="p-2">Registration No</th>
                  <th className="p-2">Student Name</th>
                  <th className="p-2">Result</th>
                  <th className="p-2">Marks Obt</th>
                  <th className="p-2">Div/Grade</th>
                  <th className="p-2">Match %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {displayedRows.map((r) => {
                  const isMatched = Boolean(r.matchedStudent && r.matchConfidence >= 70);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRowSelect(r.id)}
                          className="cursor-pointer text-purple-600"
                        >
                          {r.selectedForImport ? <CheckSquare size={13} /> : <Square size={13} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={r.examRollNo || ''}
                          onChange={(e) => handleCellEdit(r.id, 'examRollNo', e.target.value)}
                          className="w-24 px-1.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 rounded font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="p-2 font-mono text-[11px]">{r.regNo || '—'}</td>
                      <td className="p-2 font-bold">{r.studentName || '—'}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.resultStatus === 'Passed' ? 'bg-emerald-100 text-emerald-800' : r.resultStatus === 'Reap' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                          {r.resultStatus || '—'}
                        </span>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={r.marksReapp || ''}
                          onChange={(e) => handleCellEdit(r.id, 'marksReapp', e.target.value)}
                          className="w-16 px-1.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 rounded font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="p-2">{r.divDistinc || '—'}</td>
                      <td className="p-2 font-bold">
                        <span className={isMatched ? 'text-emerald-600' : 'text-slate-400'}>
                          {r.matchConfidence ? `${r.matchConfidence}%` : 'New'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteExamRoll}
                onChange={(e) => setOverwriteExamRoll(e.target.checked)}
                className="rounded text-purple-600"
              />
              <span>Also update student Exam Roll No. in database records</span>
            </label>

            <button
              type="button"
              disabled={selectedRowsToCommit.length === 0 || isCommitting}
              onClick={handleCommit}
              className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40"
            >
              {isCommitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Commit Selected ({selectedRowsToCommit.length}) to Firebase</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
