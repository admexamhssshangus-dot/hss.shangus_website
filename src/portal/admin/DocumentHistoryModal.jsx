// =================================================================
// HSS SHANGUS — Official Document History & Cloud Archive Modal
// Browse, search, re-print, download, and load past generated Bonafides & Letters
// =================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  History, Search, Printer, Download, Eye, RotateCcw,
  Trash2, X, FileText, Award, Calendar, User, Hash,
  CheckCircle2, Filter, AlertTriangle, ExternalLink,
  ChevronRight, RefreshCw, FileEdit, CheckSquare, Square,
  Layers, ShieldAlert
} from 'lucide-react';
import {
  fetchGeneratedDocHistory,
  deleteGeneratedDocFromHistory,
  deleteMultipleGeneratedDocsFromHistory
} from '../../services/docHistoryService';
import {
  printOfficialLetter,
  generateOfficialLetterDocx
} from '../../utils/officialLetterExportUtils';
import {
  printStudentCertificate,
  generateStudentCertificateDocx
} from '../../utils/certificateExportUtils';

export default function DocumentHistoryModal({
  isOpen,
  onClose,
  defaultFilter = 'all', // 'all' | 'discharge' | 'bonafide' | 'letter'
  onLoadAsDraft = null
}) {
  const [historyRecords, setHistoryRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState(defaultFilter); // 'all' | 'discharge' | 'bonafide' | 'letter'
  const [actionFilter, setActionFilter] = useState('all'); // 'all' | 'Printed' | 'Downloaded' | 'Saved'
  
  // Multi-Selection State for Bulk Deletion
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null);

  // Delete Confirmation State
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refresh history on open or when event fires
  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const records = await fetchGeneratedDocHistory({ docType: 'all' });
      setHistoryRecords(records);
      setSelectedDocIds(new Set());
    } catch (e) {
      console.error('Failed to load history records:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setModuleFilter(defaultFilter);
      loadHistory();
    }
  }, [isOpen, defaultFilter]);

  useEffect(() => {
    const handleHistoryUpdate = () => {
      if (isOpen) loadHistory();
    };
    window.addEventListener('hss-doc-history-updated', handleHistoryUpdate);
    return () => window.removeEventListener('hss-doc-history-updated', handleHistoryUpdate);
  }, [isOpen]);

  // Dynamic Category Counters
  const categoryCounts = useMemo(() => {
    let discharge = 0;
    let bonafide = 0;
    let letter = 0;

    historyRecords.forEach(r => {
      const titleLower = (r.title || '').toLowerCase();
      const isDischarge = titleLower.includes('discharge') || titleLower.includes('transfer') || titleLower.includes('character') || titleLower.includes('tc');
      if (isDischarge) {
        discharge++;
      } else if (r.docType === 'letter') {
        letter++;
      } else {
        bonafide++;
      }
    });

    return {
      all: historyRecords.length,
      discharge,
      bonafide,
      letter
    };
  }, [historyRecords]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    let list = historyRecords;

    // Module / Category Filter
    if (moduleFilter === 'discharge') {
      list = list.filter(r => {
        const titleLower = (r.title || '').toLowerCase();
        return titleLower.includes('discharge') || titleLower.includes('transfer') || titleLower.includes('character') || titleLower.includes('tc');
      });
    } else if (moduleFilter === 'bonafide') {
      list = list.filter(r => {
        const titleLower = (r.title || '').toLowerCase();
        const isDischarge = titleLower.includes('discharge') || titleLower.includes('transfer') || titleLower.includes('character') || titleLower.includes('tc');
        return !isDischarge && (r.docType === 'bonafide' || r.docType === 'certificate');
      });
    } else if (moduleFilter === 'letter') {
      list = list.filter(r => r.docType === 'letter');
    }

    // Action Filter
    if (actionFilter === 'Printed') {
      list = list.filter(r => (r.actionType || '').toLowerCase().includes('print'));
    } else if (actionFilter === 'Downloaded') {
      list = list.filter(r => (r.actionType || '').toLowerCase().includes('download') || (r.actionType || '').toLowerCase().includes('docx'));
    } else if (actionFilter === 'Saved') {
      list = list.filter(r => (r.actionType || '').toLowerCase().includes('saved'));
    }

    // Search Query
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter(r => {
      const title = (r.title || '').toLowerCase();
      const rec = (r.recipientOrStudent || '').toLowerCase();
      const ref = (r.refNo || '').toLowerCase();
      const date = (r.dateStr || '').toLowerCase();
      const act = (r.actionType || '').toLowerCase();
      const body = (r.bodyHtml || '').toLowerCase();
      const tpl = (r.templateName || '').toLowerCase();

      return (
        title.includes(q) ||
        rec.includes(q) ||
        ref.includes(q) ||
        date.includes(q) ||
        act.includes(q) ||
        body.includes(q) ||
        tpl.includes(q)
      );
    });
  }, [historyRecords, moduleFilter, actionFilter, searchQuery]);

  // Selection Handlers
  const handleToggleSelect = (id, e) => {
    e?.stopPropagation();
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAllFiltered = () => {
    if (filteredRecords.length === 0) return;
    const allFilteredSelected = filteredRecords.every(r => selectedDocIds.has(r.id));
    if (allFilteredSelected) {
      setSelectedDocIds(prev => {
        const next = new Set(prev);
        filteredRecords.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedDocIds(prev => {
        const next = new Set(prev);
        filteredRecords.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  const handleSelectAllInCurrentCategory = () => {
    const ids = new Set(filteredRecords.map(r => r.id));
    setSelectedDocIds(ids);
  };

  // Bulk Delete Execution
  const executeBulkDelete = async () => {
    if (selectedDocIds.size === 0) return;
    setIsBulkDeleting(true);
    const idsToDelete = Array.from(selectedDocIds);
    try {
      await deleteMultipleGeneratedDocsFromHistory(idsToDelete);
      setHistoryRecords(prev => prev.filter(r => !selectedDocIds.has(r.id)));
      setSelectedDocIds(new Set());
      setShowBulkDeleteConfirm(false);
      if (previewDoc && selectedDocIds.has(previewDoc.id)) setPreviewDoc(null);
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Failed to delete selected history records.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Re-Print Handler
  const handleRePrint = (rec, e) => {
    e?.stopPropagation();
    if (rec.docType === 'letter') {
      printOfficialLetter({
        refNo: rec.refNo,
        dateStr: rec.dateStr,
        bodyHtml: rec.bodyHtml,
        signatoryName: rec.extraData?.signatoryName || '',
        signatoryDesignation: rec.extraData?.signatoryDesignation || 'Principal',
        signatoryInstitution: rec.extraData?.signatoryInstitution || 'Govt. Higher Secondary School Shangus',
        copyToText: rec.extraData?.copyToText || '',
        officeTitle: rec.extraData?.officeTitle || 'OFFICE OF THE PRINCIPAL',
        institutionName: rec.extraData?.institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
        institutionAddress: rec.extraData?.institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)',
        pageMargin: rec.extraData?.pageMargin,
        headerLayout: rec.extraData?.headerLayout
      });
    } else {
      const isTcDc = rec.docType === 'discharge' ||
                     (rec.title || '').toLowerCase().includes('discharge') ||
                     (rec.title || '').toLowerCase().includes('transfer') ||
                     (rec.title || '').toLowerCase().includes('character');

      const metaDetails = rec.extraData?.metaDetails || {
        certificateNo: rec.refNo || rec.studentDetails?.certificateNo || rec.studentDetails?.regNo || '—',
        admissionDate: rec.studentDetails?.admissionDate || rec.extraData?.admissionDate || '01-07-2024',
        admissionNo: rec.studentDetails?.admissionNo || rec.studentDetails?.rollNo || '—',
        regNo: rec.studentDetails?.regNo || '—'
      };

      const signatories = rec.extraData?.signatories || (isTcDc
        ? ['Incharge Admissions & Exam', 'Checked By', 'Principal']
        : ['Incharge Admissions & Exam', 'Principal']
      );

      printStudentCertificate({
        certificateTitle: rec.title || (isTcDc ? 'Discharge/Transfer cum Character Certificate' : 'BONAFIDE CERTIFICATE'),
        refNo: rec.refNo || metaDetails.certificateNo,
        dateStr: rec.dateStr || new Date().toLocaleDateString('en-GB'),
        bodyHtml: rec.bodyHtml,
        studentPhotoUrl: rec.extraData?.studentPhotoUrl || null,
        showPhoto: rec.extraData?.showPhoto !== undefined ? rec.extraData.showPhoto : true,
        watermark: rec.extraData?.watermark !== undefined ? rec.extraData.watermark : true,
        signatories,
        isDualCopy: rec.extraData?.isDualCopy !== undefined ? rec.extraData.isDualCopy : isTcDc,
        metaDetails,
        officeTitle: rec.extraData?.officeTitle || 'OFFICE OF THE PRINCIPAL',
        institutionName: rec.extraData?.institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
        institutionAddress: rec.extraData?.institutionAddress || 'District Anantnag, Kashmir — 192201 (J&K)',
        pageMargin: rec.extraData?.pageMargin ?? 0.3,
        headerGap: rec.extraData?.headerGap ?? 0.50,
        titleMetaGap: rec.extraData?.titleMetaGap ?? 0,
        metaBodyGap: rec.extraData?.metaBodyGap ?? 0.50,
        paraSpacing: rec.extraData?.paraSpacing ?? 8,
        bodyLineHeight: rec.extraData?.bodyLineHeight ?? 1.85,
        bodyDateGap: rec.extraData?.bodyDateGap ?? 12,
        dateSigGap: rec.extraData?.dateSigGap ?? 0.50,
        sigReceiptGap: rec.extraData?.sigReceiptGap ?? 12
      });
    }
  };

  // Download Word .docx Handler
  const handleDownloadDocx = async (rec, e) => {
    e?.stopPropagation();
    try {
      if (rec.docType === 'letter') {
        await generateOfficialLetterDocx({
          refNo: rec.refNo,
          dateStr: rec.dateStr,
          bodyHtml: rec.bodyHtml,
          signatoryName: rec.extraData?.signatoryName || '',
          signatoryDesignation: rec.extraData?.signatoryDesignation || 'Principal',
          signatoryInstitution: rec.extraData?.signatoryInstitution || 'Govt. Hr Sec. School Shangus',
          copyToText: rec.extraData?.copyToText || '',
          officeTitle: rec.extraData?.officeTitle || 'OFFICE OF THE PRINCIPAL',
          institutionName: rec.extraData?.institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
          institutionAddress: rec.extraData?.institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)'
        });
      } else {
        const isTcDc = rec.docType === 'discharge' ||
                       (rec.title || '').toLowerCase().includes('discharge') ||
                       (rec.title || '').toLowerCase().includes('transfer') ||
                       (rec.title || '').toLowerCase().includes('character');

        const metaDetails = rec.extraData?.metaDetails || {
          certificateNo: rec.refNo || rec.studentDetails?.certificateNo || rec.studentDetails?.regNo || '—',
          admissionDate: rec.studentDetails?.admissionDate || rec.extraData?.admissionDate || '01-07-2024',
          admissionNo: rec.studentDetails?.admissionNo || rec.studentDetails?.rollNo || '—',
          regNo: rec.studentDetails?.regNo || '—'
        };

        const signatories = rec.extraData?.signatories || (isTcDc
          ? ['Incharge Admissions & Exam', 'Checked By', 'Principal']
          : ['Incharge Admissions & Exam', 'Principal']
        );

        await generateStudentCertificateDocx({
          certificateTitle: rec.title || (isTcDc ? 'Discharge/Transfer cum Character Certificate' : 'BONAFIDE CERTIFICATE'),
          refNo: rec.refNo || metaDetails.certificateNo,
          dateStr: rec.dateStr || new Date().toLocaleDateString('en-GB'),
          bodyHtml: rec.bodyHtml,
          signatories,
          isDualCopy: rec.extraData?.isDualCopy !== undefined ? rec.extraData.isDualCopy : isTcDc,
          metaDetails,
          officeTitle: rec.extraData?.officeTitle || 'OFFICE OF THE PRINCIPAL',
          institutionName: rec.extraData?.institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
          institutionAddress: rec.extraData?.institutionAddress || 'District Anantnag, Kashmir — 192201 (J&K)'
        });
      }
    } catch (err) {
      console.error('Word download error:', err);
      alert('Failed to download Word document.');
    }
  };

  // Load as New Draft Handler
  const handleLoadAsDraft = (rec, e) => {
    e?.stopPropagation();
    if (onLoadAsDraft) {
      onLoadAsDraft(rec);
      onClose();
    }
  };

  // Delete Action Confirm
  const executeDelete = async () => {
    if (!deleteConfirmDoc) return;
    setIsDeleting(true);
    try {
      await deleteGeneratedDocFromHistory(deleteConfirmDoc.id);
      setHistoryRecords(prev => prev.filter(r => r.id !== deleteConfirmDoc.id));
      setDeleteConfirmDoc(null);
      if (previewDoc?.id === deleteConfirmDoc.id) setPreviewDoc(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Could not delete history document.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      
      {/* Main Dialog Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] max-h-[780px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center">
              <History size={17} className="text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-wide text-white">
                  Document History & Cloud Archive
                </h2>
                <span className="text-[10px] font-mono bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-1.5 py-0.2 rounded-md font-bold">
                  {historyRecords.length} Saved
                </span>
              </div>
              <p className="text-[10.5px] text-indigo-200/80 font-medium">
                Immutable audit records for all printed, downloaded, and cloud-saved documents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={loadHistory}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white cursor-pointer transition-all"
              title="Refresh History"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600 text-slate-300 hover:text-white cursor-pointer transition-all"
              title="Close Archive"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, roll no, ref no, title..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category Filter Tabs with Counts */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
            <button
              type="button"
              onClick={() => setModuleFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${
                moduleFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Types ({categoryCounts.all})
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('discharge')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'discharge'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={11} />
              <span>Discharge/TC ({categoryCounts.discharge})</span>
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('bonafide')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'bonafide'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={11} />
              <span>Bonafides ({categoryCounts.bonafide})</span>
            </button>

            <button
              type="button"
              onClick={() => setModuleFilter('letter')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                moduleFilter === 'letter'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText size={11} />
              <span>Letters ({categoryCounts.letter})</span>
            </button>
          </div>

          {/* Action Filter Tabs */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-bold">
            <span className="px-1.5 text-slate-400 uppercase tracking-wider text-[9px] font-black">Action:</span>
            {['all', 'Printed', 'Downloaded', 'Saved'].map((act) => (
              <button
                key={act}
                type="button"
                onClick={() => setActionFilter(act)}
                className={`px-2 py-0.8 rounded-lg cursor-pointer transition-all ${
                  actionFilter === act
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {act === 'all' ? 'All' : act}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bulk Selection & Action Bar ── */}
        <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAllFiltered}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs text-[11px] flex items-center gap-1.5"
            >
              {filteredRecords.length > 0 && filteredRecords.every(r => selectedDocIds.has(r.id)) ? (
                <>
                  <CheckSquare size={13} className="text-indigo-600" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={13} className="text-slate-400" />
                  <span>Select All ({filteredRecords.length})</span>
                </>
              )}
            </button>

            {selectedDocIds.size > 0 && (
              <span className="font-extrabold text-indigo-700 dark:text-indigo-300 text-xs">
                Selected: <strong className="font-black text-indigo-600">{selectedDocIds.size}</strong> of {filteredRecords.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedDocIds.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedDocIds(new Set())}
                  className="px-2 py-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 text-[11px] font-bold cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer animate-pulse"
                >
                  <Trash2 size={13} />
                  <span>Delete Selected ({selectedDocIds.size})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar bg-slate-100/50 dark:bg-slate-950/40">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-52 space-y-2 text-slate-400">
              <RefreshCw size={24} className="animate-spin text-indigo-500" />
              <span className="text-xs font-bold">Loading Cloud Document History...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
              <History size={28} className="text-slate-300 dark:text-slate-700 mb-2" />
              <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                No Archived Documents Found
              </h3>
              <p className="text-[11px] text-slate-400 max-w-sm mt-1">
                {searchQuery
                  ? 'No archived documents matched your search criteria.'
                  : 'Whenever you Print, Download (.docx), or click "Save to Cloud", documents will appear here automatically.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredRecords.map((rec) => {
                const isLetter = rec.docType === 'letter';
                const isSelected = selectedDocIds.has(rec.id);
                const titleLower = (rec.title || '').toLowerCase();
                const isDischarge = titleLower.includes('discharge') || titleLower.includes('transfer') || titleLower.includes('character') || titleLower.includes('tc');

                const actionColor = (rec.actionType || '').includes('Print')
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                  : (rec.actionType || '').includes('Download')
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';

                return (
                  <div
                    key={rec.id}
                    onClick={() => handleToggleSelect(rec.id)}
                    className={`group border rounded-xl p-3 shadow-2xs transition-all cursor-pointer flex flex-col justify-between relative ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-500 dark:border-indigo-500 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600'
                    }`}
                  >
                    {/* Top Row: Checkbox + Icon + Title + Action Badge */}
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Selection Checkbox */}
                          <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelect(rec.id, e)}
                              className="w-4 h-4 rounded text-indigo-600 cursor-pointer accent-indigo-600"
                            />
                          </div>

                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isLetter 
                              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600' 
                              : isDischarge
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                                : 'bg-teal-100 dark:bg-teal-950 text-teal-600'
                          }`}>
                            {isLetter ? <FileText size={14} /> : <Award size={14} />}
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {rec.title}
                            </h4>
                            <div className="text-[10px] text-slate-500 font-semibold truncate flex items-center gap-1.5">
                              <span>Ref: <strong className="font-mono text-slate-700 dark:text-slate-300">{rec.refNo || '—'}</strong></span>
                              <span>•</span>
                              <span>{rec.dateStr}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Status Badge */}
                        <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border shrink-0 ${actionColor}`}>
                          {rec.actionType || 'Saved to Cloud'}
                        </span>
                      </div>

                      {/* Recipient / Student Info */}
                      {rec.recipientOrStudent && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 mt-1">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{rec.recipientOrStudent}</span>
                          {rec.studentDetails?.cls && (
                            <span className="text-[9.5px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-700 px-1 rounded ml-auto shrink-0">
                              {rec.studentDetails.cls}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Buttons Bar */}
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] font-mono text-slate-400">
                        {rec.createdAt ? new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>

                      <div className="flex items-center gap-1">
                        {/* Quick View Button */}
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(rec)}
                          className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                          title="Preview Document"
                        >
                          <Eye size={11} />
                          <span>View</span>
                        </button>

                        {/* Direct Re-Print Button */}
                        <button
                          type="button"
                          onClick={(e) => handleRePrint(rec, e)}
                          className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-800"
                          title="Re-Print / Save PDF"
                        >
                          <Printer size={11} />
                          <span>Print</span>
                        </button>

                        {/* Direct Word .docx Download */}
                        <button
                          type="button"
                          onClick={(e) => handleDownloadDocx(rec, e)}
                          className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer border border-emerald-200 dark:border-emerald-800"
                          title="Download Word (.docx)"
                        >
                          <Download size={11} />
                          <span>Word</span>
                        </button>

                        {/* Use as New Draft */}
                        {onLoadAsDraft && (
                          <button
                            type="button"
                            onClick={(e) => handleLoadAsDraft(rec, e)}
                            className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer border border-amber-200 dark:border-amber-800"
                            title="Load content into editor as a new draft"
                          >
                            <FileEdit size={11} />
                            <span>Draft</span>
                          </button>
                        )}

                        {/* Delete Record Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmDoc(rec);
                          }}
                          className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                          title="Delete from History"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>Audit-safe immutable cloud records • Use checkboxes for bulk deletion of past prints</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10.5px] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* ── Document Full Preview Popup ── */}
      {previewDoc && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Preview Header */}
            <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-indigo-300">Document Snapshot:</span>
                <span className="text-xs font-bold text-white truncate max-w-md">{previewDoc.title}</span>
                <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.2 rounded text-slate-300">
                  {previewDoc.refNo}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRePrint(previewDoc)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={12} />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadDocx(previewDoc)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download size={12} />
                  <span>Word (.docx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Rendered HTML Content in A4 Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200 dark:bg-slate-950 flex justify-center custom-scrollbar">
              <div className="bg-white text-slate-900 border border-slate-300 rounded-xl p-6 sm:p-8 shadow-md w-full max-w-[760px] min-h-[500px]">
                
                {/* Header Banner */}
                <div className="-mx-6 sm:-mx-8 -mt-6 sm:-mt-8 p-4 text-center bg-[#f0f8ff] border-b-[2.5px] border-[#800000] rounded-t-xl mb-4">
                  <h3 className="text-[11px] font-black text-[#800000] uppercase tracking-[1.5px] m-0">
                    {previewDoc.extraData?.officeTitle || 'OFFICE OF THE PRINCIPAL'}
                  </h3>
                  <h1 className="text-base sm:text-lg font-black text-[#0a192f] tracking-wide uppercase m-0 mt-0.5 font-serif">
                    {previewDoc.extraData?.institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}
                  </h1>
                  <p className="text-[10px] text-slate-600 font-semibold m-0 mt-0.5">
                    {previewDoc.extraData?.institutionAddress || 'District Anantnag, Kashmir — 192201 (J&K)'}
                  </p>
                </div>

                {/* Ref & Date Bar */}
                <div className="flex justify-between items-center text-xs pb-2 mb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[#800000] font-black">Ref. No.:</span>{' '}
                    <span className="text-slate-900 font-mono font-bold">{previewDoc.refNo || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#800000] font-black">Date:</span>{' '}
                    <span className="text-slate-900 font-semibold">{previewDoc.dateStr}</span>
                  </div>
                </div>

                {/* Body Snapshot */}
                <div
                  className="text-[13px] leading-relaxed text-slate-900 my-4"
                  dangerouslySetInnerHTML={{ __html: previewDoc.bodyHtml }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Delete Confirmation Dialog ── */}
      {deleteConfirmDoc && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/60 rounded-2xl p-5 max-w-md w-full shadow-2xl text-center space-y-3 animate-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Delete Archived Document Record?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Are you sure you want to remove the archived record for <strong>"{deleteConfirmDoc.title}"</strong> (Ref: {deleteConfirmDoc.refNo})?
              </p>
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-900/60 mt-2">
                ⚠️ Warning: This audit record will be permanently deleted from Cloud History.
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmDoc(null)}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer shadow-md flex items-center gap-1.5"
              >
                {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirmation Dialog ── */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-rose-400 dark:border-rose-900 rounded-2xl p-5 max-w-md w-full shadow-2xl text-center space-y-3 animate-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert size={26} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Bulk Delete {selectedDocIds.size} History Records?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                You are about to permanently delete <strong>{selectedDocIds.size} selected document records</strong> from Cloud Firestore and local storage.
              </p>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-800 mt-2 text-left">
                • This action cannot be undone.<br />
                • Test prints and unwanted historical records will be permanently removed.
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBulkDeleting}
                className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBulkDelete}
                disabled={isBulkDeleting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer shadow-md flex items-center gap-1.5"
              >
                {isBulkDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                <span>{isBulkDeleting ? 'Deleting Batch...' : `Delete All ${selectedDocIds.size} Records`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
