// =================================================================
// HSS SHANGUS — Reassign Document Owner Modal (Super Admin Only)
// Allows Super Admin to move/reallocate documents into another admin's history
// =================================================================

import React, { useState, useEffect } from 'react';
import {
  UserCheck, ArrowRightLeft, X, ShieldAlert, Check,
  AlertCircle, ChevronDown, User, Mail, ShieldCheck,
  RefreshCw, FileText
} from 'lucide-react';
import { fetchAdminAccountsList } from '../../services/staffAuthService';
import {
  reassignGeneratedDocOwner,
  reassignMultipleGeneratedDocsOwner
} from '../../services/docHistoryService';
import { getRecordAccount, formatAccountDisplay } from './OfficialDocumentCatalogView';
import { showToast } from '../../components/common/GlobalToast';

export default function ReassignDocOwnerModal({
  isOpen,
  onClose,
  targetDocs = [],
  onSuccess = null
}) {
  const [adminAccounts, setAdminAccounts] = useState([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [selectedAdminEmail, setSelectedAdminEmail] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load administrative accounts on open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingAdmins(true);
    fetchAdminAccountsList()
      .then(list => {
        if (!isMounted) return;
        setAdminAccounts(list);
        if (list.length > 0) {
          // Default to the first Standard Admin if available, otherwise first admin
          const firstStandardAdmin = list.find(a => !a.isSuperAdmin);
          setSelectedAdminEmail(firstStandardAdmin ? firstStandardAdmin.email : list[0].email);
        }
      })
      .catch(err => {
        console.warn('Failed to load admin accounts:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAdmins(false);
      });

    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen || !Array.isArray(targetDocs) || targetDocs.length === 0) return null;

  const isBulk = targetDocs.length > 1;
  const singleDoc = targetDocs[0];

  const handleConfirmReassign = async () => {
    const targetEmail = (isCustomMode ? customEmail : selectedAdminEmail).trim().toLowerCase();
    if (!targetEmail) {
      showToast('Please select or specify a target admin email', 'warning');
      return;
    }

    const matchedAdmin = adminAccounts.find(a => a.email.toLowerCase() === targetEmail);
    const targetName = matchedAdmin?.name || targetEmail.split('@')[0];

    setIsSubmitting(true);
    try {
      if (isBulk) {
        const ids = targetDocs.map(d => d.id);
        await reassignMultipleGeneratedDocsOwner(ids, targetEmail, targetName);
        showToast(
          `Successfully moved ${ids.length} documents into ${targetName}'s history!`,
          'success'
        );
      } else {
        await reassignGeneratedDocOwner(singleDoc.id, targetEmail, targetName);
        showToast(
          `Document #${singleDoc.refNo || ''} moved into ${targetName}'s history!`,
          'success'
        );
      }

      if (typeof onSuccess === 'function') {
        onSuccess(targetEmail, targetName, targetDocs);
      }
      onClose();
    } catch (err) {
      console.error('Reassignment error:', err);
      showToast(`Failed to reassign document: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-fadeIn font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ArrowRightLeft size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white flex items-center gap-2">
                <span>{isBulk ? `Reassign ${targetDocs.length} Documents` : 'Reassign Document Owner'}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-extrabold">
                  Super Admin
                </span>
              </h3>
              <p className="text-[11px] text-indigo-200/80">
                Move historical outward records into another administrator's history
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-slate-800 dark:text-slate-100">
          
          {/* Target Document(s) Summary Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {isBulk ? 'Target Documents for Reallocation:' : 'Document to Reallocate:'}
            </span>
            
            {!isBulk ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {singleDoc.title || singleDoc.subject || 'Official Document'}
                  </div>
                  {singleDoc.refNo && (
                    <span className="text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                      Ref: {singleDoc.refNo}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                  <span>Date: <strong className="text-slate-700 dark:text-slate-300">{singleDoc.dateStr || '—'}</strong></span>
                  <span>•</span>
                  <span>Currently Assigned To: <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{formatAccountDisplay(getRecordAccount(singleDoc))}</strong></span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  {targetDocs.length} Documents Selected for Transfer
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-[10.5px] text-slate-600 dark:text-slate-400">
                  {targetDocs.map((doc, idx) => (
                    <div key={doc.id || idx} className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-200/50 dark:border-slate-800/50">
                      <span className="truncate max-w-[280px]">
                        {idx + 1}. {doc.title || doc.subject || 'Document'} {doc.refNo ? `(#${doc.refNo})` : ''}
                      </span>
                      <span className="font-mono text-[9.5px] text-slate-400 shrink-0">
                        {formatAccountDisplay(getRecordAccount(doc))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* New Owner Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UserCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
                Select New Administrator / Owner:
              </label>
              
              <button
                type="button"
                onClick={() => setIsCustomMode(prev => !prev)}
                className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {isCustomMode ? 'Choose from Registered Admins' : 'Custom Email...'}
              </button>
            </div>

            {!isCustomMode ? (
              <div className="space-y-1.5">
                {isLoadingAdmins ? (
                  <div className="h-9 flex items-center justify-center text-xs text-slate-400 gap-1.5">
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Loading registered administrators...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {adminAccounts.map(account => {
                      const isSelected = selectedAdminEmail.toLowerCase() === account.email.toLowerCase();
                      return (
                        <div
                          key={account.email}
                          onClick={() => setSelectedAdminEmail(account.email)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                              account.isSuperAdmin 
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' 
                                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            }`}>
                              <User size={12} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {account.name}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 truncate">
                                {account.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                              account.isSuperAdmin
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}>
                              {account.role}
                            </span>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                <Check size={10} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="Enter target administrator email (e.g. admin@example.com)..."
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  autoFocus
                />
                <span className="text-[10px] text-slate-400">
                  Must be an official school administrator email address.
                </span>
              </div>
            )}
          </div>

          {/* Operational Policy Note */}
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
            <ShieldAlert size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Super Admin Reassignment:</strong> The chosen administrator will immediately see this document in their personal outward register and history. Standard Admins will no longer see documents belonging to other staff members.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmReassign}
            disabled={isSubmitting || (!isCustomMode && !selectedAdminEmail) || (isCustomMode && !customEmail.trim())}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-98"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Reassigning...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft size={13} />
                <span>{isBulk ? `Move ${targetDocs.length} Documents` : 'Move Document'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
