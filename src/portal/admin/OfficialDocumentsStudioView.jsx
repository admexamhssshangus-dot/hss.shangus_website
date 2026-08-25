// =================================================================
// HSS SHANGUS — Official Documents & Registers Studio
// Unified parent suite housing Student Roster Builder, Official Letterhead Writer & Certificates Studio
// Features Real-time Firebase Firestore Session Discovery & Zero-LocalStorage Pipeline
// =================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { preloadStudentPhotosCache } from '../../services/dbCache';
import CustomRosterDocumentBuilderView, { extractSession } from './CustomRosterDocumentBuilderView';
import OfficialLetterWriterView from './OfficialLetterWriterView';
import StudentCertificateStudioView from './StudentCertificateStudioView';

/**
 * Standardize and flatten student records from masterRegisters chunk/group documents into standard student objects.
 * Handles chunk_001..chunk_123, groupKey documents, and individual student documents.
 * @param {Array<object>} masterDocs - Raw documents from Firestore masterRegisters collection
 * @returns {Array<object>} Flat array of normalized student records
 */
export function unpackMasterRegisterStudents(masterDocs = []) {
  const flatList = [];
  if (!Array.isArray(masterDocs)) return flatList;

  masterDocs.forEach(m => {
    if (!m) return;
    const chunkItems = m.items || m.students || m.records || m.data;
    const docId = m.id || '';
    const groupKey = m.groupKey || '';
    
    // Extract document-level fallback session, class, stream metadata
    let docSession = m.Session || m.session || m['Academic Session'] || m['academicSession'] || '';
    if (!docSession) {
      if (groupKey) docSession = groupKey.split('_')[0];
      else if (docId.startsWith('part_')) {
        const parts = docId.replace(/^part_/, '').split('_');
        docSession = parts[0];
      }
    }
    const docClass = m.class || m.Class || m.className || m['Class'] || (groupKey ? groupKey.split('_')[1] : '') || '';
    const docStream = m.stream || m.Stream || m['Stream'] || (groupKey ? groupKey.split('_')[2] : '') || '';

    if (Array.isArray(chunkItems) && chunkItems.length > 0) {
      chunkItems.forEach((item, itemIdx) => {
        if (item && typeof item === 'object') {
          const itemSession = item.Session || item.session || item['Academic Session'] || item['academicSession'] || item['Session / Batch'] || item['Batch'] || docSession || '';
          const itemClass = item.Class || item.class || item['Class'] || item['Admission sought for class'] || docClass || '';
          const itemStream = item.Stream || item.stream || item['Stream'] || docStream || '';
          const itemId = item.id || item['Form Number'] || item['Form No.'] || item.formNo || item['Board Registration Number'] || `${docId}_${itemIdx}`;

          flatList.push({
            ...item,
            id: itemId,
            Session: itemSession,
            session: itemSession,
            Class: itemClass,
            class: itemClass,
            Stream: itemStream,
            stream: itemStream,
            _source: 'masterRegisters',
            _srcCollection: 'masterRegisters',
            _parentDocId: docId
          });
        }
      });
    } else if (typeof m === 'object' && !chunkItems) {
      // Individual student document in masterRegisters
      const itemSession = m.Session || m.session || m['Academic Session'] || docSession || '';
      flatList.push({
        ...m,
        id: m.id || m['Form Number'] || m.formNo,
        Session: itemSession,
        session: itemSession,
        Class: docClass || m.Class || m.class,
        class: docClass || m.class || m.Class,
        Stream: docStream || m.Stream || m.stream,
        stream: docStream || m.stream || m.Stream,
        _source: 'masterRegisters',
        _srcCollection: 'masterRegisters'
      });
    }
  });

  return flatList;
}

export default function OfficialDocumentsStudioView({
  allStudents = [],
  initialSubTab = 'roster',
  activeSubTab: controlledActiveSubTab,
  onSwitchSubTab: controlledOnSwitchSubTab,
  showSettingsDrawer,
  onToggleSettingsDrawer,
  onClose
}) {
  const [internalActiveSubTab, setInternalActiveSubTab] = useState(initialSubTab);
  const activeSubTab = controlledActiveSubTab !== undefined ? controlledActiveSubTab : internalActiveSubTab;
  const setActiveSubTab = controlledOnSwitchSubTab || setInternalActiveSubTab;

  // Detect default active session from current preloaded intake (prioritize latest academic year e.g. '2025-26' and dominant count)
  const defaultActiveSession = useMemo(() => {
    if (allStudents && allStudents.length > 0) {
      const counts = {};
      for (const st of allStudents) {
        const s = extractSession(st);
        if (s) counts[s] = (counts[s] || 0) + 1;
      }
      const sorted = Object.entries(counts).sort((a, b) => {
        const yearA = parseInt(a[0].match(/\d{4}/)?.[0] || '0', 10);
        const yearB = parseInt(b[0].match(/\d{4}/)?.[0] || '0', 10);
        if (yearB !== yearA) return yearB - yearA;
        return b[1] - a[1];
      });
      if (sorted.length > 0) return sorted[0][0];
    }
    return '2025-26';
  }, [allStudents]);

  // ─── Global Academic Session State ───
  const [selectedGlobalSession, setSelectedGlobalSession] = useState(`active_${defaultActiveSession}`);
  
  // Real-time Firestore masterRegisters raw docs (Kept strictly in component RAM — NEVER written to localStorage)
  const [masterHistoricalRecords, setMasterHistoricalRecords] = useState([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [historicalFetchToast, setHistoricalFetchToast] = useState('');

  // Sync if defaultActiveSession changes on initial load
  useEffect(() => {
    if (defaultActiveSession && selectedGlobalSession !== `active_${defaultActiveSession}` && !selectedGlobalSession.startsWith('master_') && selectedGlobalSession !== 'ALL') {
      setSelectedGlobalSession(`active_${defaultActiveSession}`);
    }
  }, [defaultActiveSession, selectedGlobalSession]);

  // Sync if initialSubTab prop changes
  useEffect(() => {
    if (initialSubTab && controlledActiveSubTab === undefined) {
      setInternalActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, controlledActiveSubTab]);

  // ─── 1. ON-DEMAND REALTIME FETCH FOR MASTER REGISTERS ───
  // Strictly fetched when user selects a historical session, preventing UI freeze on initial load
  const loadHistoricalRecordsOnDemand = useCallback(async () => {
    if (masterHistoricalRecords.length > 0 || isLoadingHistorical) return;
    setIsLoadingHistorical(true);
    setHistoricalFetchToast('Loading historical registers from Firestore...');
    try {
      const snap = await getDocs(collection(db, 'masterRegisters'));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const flatList = unpackMasterRegisterStudents(docs);
      setMasterHistoricalRecords(flatList);
      preloadStudentPhotosCache().catch(() => {});
      setHistoricalFetchToast('');
    } catch (err) {
      console.warn('Historical master registers fetch note:', err);
      setHistoricalFetchToast('Failed to load past registers.');
      setTimeout(() => setHistoricalFetchToast(''), 3000);
    } finally {
      setIsLoadingHistorical(false);
    }
  }, [masterHistoricalRecords.length, isLoadingHistorical]);

  const handleSessionChange = useCallback((sessVal) => {
    setSelectedGlobalSession(sessVal);
    if (sessVal.startsWith('master_') || sessVal === 'ALL') {
      loadHistoricalRecordsOnDemand();
    }
  }, [loadHistoricalRecordsOnDemand]);

  // ─── 2. DYNAMIC SESSIONS (Live Admissions + Master Registers) ───
  const dynamicSessionOptions = useMemo(() => {
    const standardSessions = [
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
      '2018-19',
      '2017-18',
      '2016-17',
      '2015-16'
    ];

    // 1. Group Live Admissions by Session, sorting current/latest year (2026 / 2025-26) to top
    const activeSessionMap = new Map();
    (allStudents || []).forEach(st => {
      const s = extractSession(st) || defaultActiveSession;
      activeSessionMap.set(s, (activeSessionMap.get(s) || 0) + 1);
    });

    const activeOptions = Array.from(activeSessionMap.entries())
      .sort((a, b) => {
        const yearA = parseInt(a[0].match(/\d{4}/)?.[0] || '0', 10);
        const yearB = parseInt(b[0].match(/\d{4}/)?.[0] || '0', 10);
        if (yearB !== yearA) return yearB - yearA;
        return b[0].localeCompare(a[0], undefined, { numeric: true, sensitivity: 'base' });
      })
      .map(([sess, count]) => ({
        value: `active_${sess}`,
        label: `${sess} (Live Admissions · ${count})`,
        count,
        isLive: true
      }));

    if (activeOptions.length === 0) {
      activeOptions.push({
        value: `active_${defaultActiveSession}`,
        label: `${defaultActiveSession} (Live Admissions · 0)`,
        count: 0,
        isLive: true
      });
    }

    // 2. Group Master Registers by Session
    const masterOptions = [];
    if (masterHistoricalRecords.length > 0) {
      const masterSessionMap = new Map();
      masterHistoricalRecords.forEach(st => {
        const s = extractSession(st) || 'Historical';
        masterSessionMap.set(s, (masterSessionMap.get(s) || 0) + 1);
      });

      const sortedMaster = Array.from(masterSessionMap.entries())
        .sort((a, b) => {
          const yearA = parseInt(a[0].match(/\d{4}/)?.[0] || '0', 10);
          const yearB = parseInt(b[0].match(/\d{4}/)?.[0] || '0', 10);
          if (yearB !== yearA) return yearB - yearA;
          return b[0].localeCompare(a[0], undefined, { numeric: true, sensitivity: 'base' });
        });

      sortedMaster.forEach(([sess, count]) => {
        masterOptions.push({
          value: `master_${sess}`,
          label: `${sess} (Master Register Archive · ${count})`,
          count,
          isMaster: true
        });
      });
    } else {
      standardSessions.forEach(sess => {
        masterOptions.push({
          value: `master_${sess}`,
          label: `${sess} (Master Register Archive)`,
          count: 0,
          isMaster: true
        });
      });
    }

    const options = [
      ...activeOptions,
      ...masterOptions
    ];

    const totalCombined = (allStudents || []).length + (masterHistoricalRecords || []).length;
    if (options.length > 1) {
      options.push({
        value: 'ALL',
        label: `All Sessions (Combined · ${totalCombined})`,
        count: totalCombined,
        isAll: true
      });
    }

    return options;
  }, [allStudents, defaultActiveSession, masterHistoricalRecords]);

  // ─── 3. FILTER STUDENTS FED TO SUB-STUDIOS BASED ON SELECTED GLOBAL SESSION ───
  const currentSessionStudents = useMemo(() => {
    if (selectedGlobalSession === 'ALL') {
      return [...(allStudents || []), ...masterHistoricalRecords];
    }

    if (selectedGlobalSession.startsWith('active_')) {
      const targetSess = selectedGlobalSession.replace(/^active_/, '').toLowerCase().trim();
      return (allStudents || []).filter(st => {
        const s = (extractSession(st) || '').toLowerCase().trim();
        return !targetSess || s === targetSess || s.includes(targetSess) || targetSess.includes(s);
      });
    }

    if (selectedGlobalSession.startsWith('master_')) {
      const targetSess = selectedGlobalSession.replace(/^master_/, '').toLowerCase().trim();
      return masterHistoricalRecords.filter(st => {
        const s = (extractSession(st) || '').toLowerCase().trim();
        return !targetSess || s === targetSess || s.includes(targetSess) || targetSess.includes(s);
      });
    }

    // Fallback for legacy plain session values:
    const norm = selectedGlobalSession.toLowerCase().trim();
    const activeMatches = (allStudents || []).filter(st => {
      const s = (extractSession(st) || '').toLowerCase().trim();
      return s === norm || s.includes(norm) || norm.includes(s);
    });
    if (activeMatches.length > 0) return activeMatches;

    return masterHistoricalRecords.filter(st => {
      const s = (extractSession(st) || '').toLowerCase().trim();
      return s === norm || s.includes(norm) || norm.includes(s);
    });
  }, [allStudents, masterHistoricalRecords, selectedGlobalSession]);

  return (
    <div className="space-y-1 text-xs sm:text-sm animate-fadeIn relative text-slate-900 dark:text-slate-100">
      
      {/* ── SLEEK ULTRA-COMPACT STUDIO CONTROL BAR ── */}
      <div 
        className="px-1.5 py-0.5 sm:py-1 rounded-xl border shadow-2xs space-y-1 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-1.5 text-xs font-extrabold"
        style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}
      >
        {/* Left Section: Active Studio Indicator & Cohort Counter */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-black tracking-tight uppercase truncate">
              {activeSubTab === 'roster' && 'Roster & Registers Studio'}
              {activeSubTab === 'letter' && 'Official Letterhead Writer'}
              {(activeSubTab === 'certStudio' || activeSubTab === 'certificate') && 'Certificates & Bonafides Studio'}
            </span>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs text-[10.5px] font-black">
            <span className="text-emerald-700 dark:text-emerald-400">📋 Cohort:</span>
            <span className="font-mono font-black text-slate-900 dark:text-slate-50">{currentSessionStudents.length}</span>
          </div>
        </div>

        {/* Right Section: Real-time Academic Session Selector */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
            <Calendar size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase shrink-0">Session:</span>
            <select
              value={selectedGlobalSession}
              onChange={(e) => handleSessionChange(e.target.value)}
              className="bg-transparent font-black text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
            >
              {dynamicSessionOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── RENDER ACTIVE STUDIO ── */}
      {activeSubTab === 'roster' && (
        <CustomRosterDocumentBuilderView
          allStudents={currentSessionStudents}
          onClose={onClose}
          activeSubTab={activeSubTab}
          onSwitchSubTab={setActiveSubTab}
          globalSession={selectedGlobalSession}
          onSelectGlobalSession={handleSessionChange}
        />
      )}

      {activeSubTab === 'letter' && (
        <OfficialLetterWriterView
          onClose={onClose}
          activeSubTab={activeSubTab}
          onSwitchSubTab={setActiveSubTab}
          showSettingsDrawerProp={showSettingsDrawer}
          onToggleSettingsDrawer={onToggleSettingsDrawer}
        />
      )}

      {(activeSubTab === 'certStudio' || activeSubTab === 'certificate') && (
        <StudentCertificateStudioView
          allStudents={currentSessionStudents}
          onClose={onClose}
          activeSubTab={activeSubTab}
          onSwitchSubTab={setActiveSubTab}
          showSettingsDrawerProp={showSettingsDrawer}
          onToggleSettingsDrawer={onToggleSettingsDrawer}
          globalSession={selectedGlobalSession}
        />
      )}
    </div>
  );
}
