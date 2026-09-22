import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, CheckCircle2, Hash, RotateCcw, Trash2, ShieldCheck, AlertCircle, ListFilter, Database, HardDrive, Image, Layers, Sparkles, Check } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { getFormNumberConfig, saveFormNumberConfig, getNextAvailableFormNumber, getDeletedFormsHistory } from '../../services/formNumberService';
import { showToast } from '../../components/common/GlobalToast';
import { fetchFirebaseStorageMetrics, getAutomatedStorageMetrics } from '../../services/firebaseMetricsApi';
import { emptyRecycleBin, sweepOrphanedStudentPhotos } from '../../services/recycleBinService';

export default function AppSettings() {
  const [session, setSession] = useState('2025-26');
  const [allow9th, setAllow9th] = useState(true);
  const [allow10th, setAllow10th] = useState(true);
  const [allow11th, setAllow11th] = useState(true);
  const [allow12th, setAllow12th] = useState(true);

  // Firebase Cloud Storage & Quota States
  const [metrics, setMetrics] = useState(() => getAutomatedStorageMetrics());
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [reclaimingSpace, setReclaimingSpace] = useState(false);
  const [sweepingPhotos, setSweepingPhotos] = useState(false);

  // Form Number Control States
  const [startingSeries, setStartingSeries] = useState(250001);
  const [nextFormNumber, setNextFormNumber] = useState(250001);
  const [cutoffMonth, setCutoffMonth] = useState(10); // 10 = October
  const [cutoffDay, setCutoffDay] = useState(31); // 31st
  const [digitFormat, setDigitFormat] = useState('YY0000'); // YY0000 -> 260001
  const [recycledFormNumbers, setRecycledFormNumbers] = useState([]);
  const [deletedHistory, setDeletedHistory] = useState([]);
  const [nextPreview, setNextPreview] = useState('');
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState('');

  // Load Form Number Config & Deleted History on Mount
  useEffect(() => {
    async function loadConfig() {
      setLoadingConfig(true);
      try {
        const config = await getFormNumberConfig();
        if (config) {
          if (config.session) setSession(config.session);
          if (config.startingSeries) setStartingSeries(config.startingSeries);
          if (config.nextFormNumber) setNextFormNumber(config.nextFormNumber);
          if (config.cutoffMonth !== undefined) setCutoffMonth(Number(config.cutoffMonth));
          if (config.cutoffDay !== undefined) setCutoffDay(Number(config.cutoffDay));
          if (config.digitFormat) setDigitFormat(config.digitFormat);
          if (Array.isArray(config.recycledFormNumbers)) setRecycledFormNumbers(config.recycledFormNumbers);
        }

        const previewNext = await getNextAvailableFormNumber();
        setNextPreview(previewNext);

        const history = await getDeletedFormsHistory();
        setDeletedHistory(history || []);
      } catch (e) {
        console.warn('Failed to load form number config:', e);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  // Fetch Firebase Cloud Storage Quota & Capacity Metrics
  const loadMetrics = async (force = false) => {
    setLoadingMetrics(true);
    try {
      const initial = getAutomatedStorageMetrics();
      setMetrics(initial);
      let data = null;
      try {
        data = await fetchFirebaseStorageMetrics({ force });
      } catch (_) {}
      const resolved = getAutomatedStorageMetrics({ serverData: data });
      setMetrics(resolved);
    } catch (err) {
      console.warn('Could not load storage metrics:', err.message);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    loadMetrics(false);
  }, []);

  const handleEmptyRecycleBin = async () => {
    if (!window.confirm('Are you sure you want to permanently purge all items in the Recycle Bin? This action cannot be undone and will immediately reclaim Firestore storage space.')) return;
    setReclaimingSpace(true);
    try {
      const result = await emptyRecycleBin();
      showToast(`Recycle bin purged. Permanently deleted ${result.count} soft-deleted items.`, 'success');
      await loadMetrics(true);
    } catch (err) {
      showToast(err.message || 'Failed to empty recycle bin.', 'error');
    } finally {
      setReclaimingSpace(false);
    }
  };

  const handleSweepOrphanPhotos = async () => {
    if (!window.confirm('Scan studentPhotos collection for orphaned images whose admission records have been deleted?')) return;
    setSweepingPhotos(true);
    try {
      const result = await sweepOrphanedStudentPhotos();
      if (result.count > 0) {
        showToast(`Sweep completed: Removed ${result.count} orphaned student photos.`, 'success');
      } else {
        showToast('Sweep completed: Zero orphaned photos found. Storage is clean.', 'info');
      }
      await loadMetrics(true);
    } catch (err) {
      showToast(err.message || 'Failed to sweep orphaned photos.', 'error');
    } finally {
      setSweepingPhotos(false);
    }
  };

  // When active session changes, auto-suggest standard series (e.g. 2026-27 -> 260001)
  const handleSessionChange = (newSession) => {
    setSession(newSession);
    const endYearStr = newSession.split('-')[1] || newSession.slice(-2);
    const cleanYear = endYearStr.replace(/[^0-9]/g, '');
    if (cleanYear.length >= 2) {
      const suggestedSeries = parseInt(`${cleanYear.slice(-2)}0001`, 10);
      setStartingSeries(suggestedSeries);
      setNextFormNumber(suggestedSeries);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      // 1. Save App Settings
      const settings = {
        session,
        allow_9th: allow9th,
        allow_10th: allow10th,
        allow_11th: allow11th,
        allow_12th: allow12th,
      };
      await appsScriptApi.call('saveAppSettings', { settings });

      // 2. Save Form Number Configuration
      const fnConfig = {
        session,
        cutoffMonth: Number(cutoffMonth),
        cutoffDay: Number(cutoffDay),
        digitFormat,
        startingSeries: Number(startingSeries),
        nextFormNumber: Number(nextFormNumber),
        recycledFormNumbers,
      };
      await saveFormNumberConfig(fnConfig);

      const previewNext = await getNextAvailableFormNumber();
      setNextPreview(previewNext);

      setMessage('✨ Super Admin Form Number & System Settings saved successfully!');
      showToast('Super Admin Form Number & System Settings saved successfully!', 'success');
    } catch (err) {
      console.error('Save settings error:', err);
      showToast('Failed to save settings: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Recalculate & Sync Next Form Number from Database
  const handleRecalculateCounter = async () => {
    setRecalculating(true);
    try {
      const freshNext = await getNextAvailableFormNumber();
      setNextFormNumber(freshNext);
      setNextPreview(freshNext);
      const msg = `Counter recalculated! Next assigned form number will be #${freshNext}`;
      setMessage(`✅ ${msg}`);
      showToast(msg, 'success');
    } catch (e) {
      showToast('Failed to recalculate counter.', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  // Remove a recycled form number from queue manually
  const handleRemoveRecycled = async (targetNo) => {
    const updated = recycledFormNumbers.filter(n => String(n) !== String(targetNo));
    setRecycledFormNumbers(updated);
    await saveFormNumberConfig({
      session,
      startingSeries: Number(startingSeries),
      nextFormNumber: Number(nextFormNumber),
      recycledFormNumbers: updated
    });
    const previewNext = await getNextAvailableFormNumber();
    setNextPreview(previewNext);
  };

  return (
    <div className="max-w-4xl space-y-6 text-xs">
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={18} /> {message}
        </div>
      )}

      {/* Super Admin Status Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-blue-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-black">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              Super Admin Form Number & Session Control
            </h3>
            <p className="text-slate-500 text-[11px]">
              Control academic sessions, sequential form numbering, collision prevention, and recycled deleted form numbers.
            </p>
          </div>
        </div>
        <div className="px-4 py-2 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-700 dark:text-teal-300 font-black text-xs whitespace-nowrap">
          Next Auto-Assigned Form: #{nextPreview || nextFormNumber}
        </div>
      </div>

      {/* Firebase Cloud Storage & Quota Health Panel */}
      <div className="p-6 rounded-3xl border shadow-sm space-y-5" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Database size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Firebase Cloud Storage & Quota Health
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  Spark Free Tier (1,024 MB)
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Authoritative database metric sourced from Google Cloud Monitoring & live Firestore indexes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadMetrics(true)}
            disabled={loadingMetrics}
            className="px-3 py-1.5 rounded-xl border font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-[11px] shadow-2xs"
            style={{ borderColor: 'var(--border-ui, #cbd5e1)' }}
            title="Refresh database quota metrics"
          >
            <RefreshCw size={13} className={loadingMetrics ? 'animate-spin text-teal-600' : ''} />
            <span>{loadingMetrics ? 'Syncing...' : 'Refresh Metrics'}</span>
          </button>
        </div>

        {metrics ? (
          <div className="space-y-4">
            {/* Storage Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between font-extrabold text-xs">
                <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <HardDrive size={14} className="text-teal-600" />
                  <span>Storage Used: <strong className="text-teal-700 dark:text-teal-400">{metrics.storageMB} MB</strong> of {metrics.quotaMB} MB</span>
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {metrics.percentUsed}% ({metrics.freeMB} MB Free)
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    metrics.percentUsed >= 85
                      ? 'bg-rose-500'
                      : metrics.percentUsed >= 70
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, metrics.percentUsed))}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10.5px] text-slate-500">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${metrics.capacityStatus?.level === 'critical' ? 'bg-rose-500 animate-ping' : metrics.capacityStatus?.level === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className={metrics.capacityStatus?.level === 'critical' ? 'text-rose-600 font-extrabold' : metrics.capacityStatus?.level === 'warning' ? 'text-amber-600 font-extrabold' : 'text-emerald-700 dark:text-emerald-400 font-bold'}>
                    {metrics.capacityStatus?.message || 'Storage capacity is optimal.'}
                  </span>
                </span>
                {metrics.lastSampledAt && (
                  <span className="font-mono text-[10px]">
                    Telemetry Sample: {new Date(metrics.lastSampledAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ({metrics.source === 'cloud_monitoring' ? 'Cloud Monitoring v3' : 'Estimated'})
                  </span>
                )}
              </div>
            </div>

            {/* Collection Counters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-900/50 space-y-1" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
                <div className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1">
                  <Layers size={13} className="text-teal-600" /> Active Admissions
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {metrics.counts?.admissions?.toLocaleString() || 0}
                </div>
                <div className="text-[10px] text-slate-400">Class 9th–12th online forms</div>
              </div>

              <div className="p-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-900/50 space-y-1" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
                <div className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1">
                  <Database size={13} className="text-blue-600" /> Master Registers
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {metrics.counts?.masterRegisters?.toLocaleString() || 0}
                </div>
                <div className="text-[10px] text-slate-400">Historic student archives</div>
              </div>

              <div className="p-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-900/50 space-y-1" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
                <div className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1">
                  <Image size={13} className="text-amber-600" /> Student Photos
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {metrics.counts?.studentPhotos?.toLocaleString() || 0}
                </div>
                <div className="text-[10px] text-slate-400">~60–75 KB compressed images</div>
              </div>

              <div className="p-3 rounded-2xl border bg-slate-50/50 dark:bg-slate-900/50 space-y-1" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
                <div className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1">
                  <Trash2 size={13} className="text-red-500" /> Recycle Bin
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {metrics.counts?.recycleBin?.toLocaleString() || 0}
                </div>
                <div className="text-[10px] text-slate-400">Soft-deleted trash items</div>
              </div>
            </div>

            {/* Maintenance / Space Reclamation Toolbar */}
            <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Sparkles size={13} className="text-teal-600" />
                <span>Tip: Deleting records soft-deletes them into the Recycle Bin. Permanently empty it below to immediately release storage.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSweepOrphanPhotos}
                  disabled={sweepingPhotos}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                  title="Detect and delete photo documents without corresponding student records"
                >
                  <Image size={13} className={sweepingPhotos ? 'animate-spin' : ''} />
                  <span>{sweepingPhotos ? 'Sweeping...' : 'Sweep Orphan Photos'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleEmptyRecycleBin}
                  disabled={reclaimingSpace || (metrics.counts?.recycleBin || 0) === 0}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                  title="Permanently empty all items currently in the Recycle Bin"
                >
                  <Trash2 size={13} className={reclaimingSpace ? 'animate-spin' : ''} />
                  <span>{reclaimingSpace ? 'Purging Bin...' : `Empty Recycle Bin (${metrics.counts?.recycleBin || 0})`}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-500">
            <span>{loadingMetrics ? 'Synchronizing metrics with Google Cloud…' : 'Storage metrics ready to fetch.'}</span>
            <button
              type="button"
              onClick={() => loadMetrics(true)}
              className="font-bold text-teal-600 hover:underline cursor-pointer"
            >
              Load Metrics
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Session & Series Config */}
          <div className="p-6 rounded-3xl border space-y-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
            <div className="font-extrabold text-sm flex items-center gap-2" style={{ color: 'var(--text-main, #0f172a)' }}>
              <Settings size={18} className="text-amber-600" /> Academic Session Configuration
            </div>

            <div className="space-y-1">
              <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Active Academic Session Year *</label>
              <select
                value={session}
                onChange={(e) => handleSessionChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
                style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
              >
                <option value="2025-26">2025-26 Session (Series 25xxxx)</option>
                <option value="2026-27">2026-27 Session (Series 26xxxx)</option>
                <option value="2027-28">2027-28 Session (Series 27xxxx)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Session Validity Cutoff Month & Day *</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={cutoffMonth}
                  onChange={(e) => setCutoffMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
                  style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                >
                  <option value={1}>January (Month 1)</option>
                  <option value={2}>February (Month 2)</option>
                  <option value={3}>March (Month 3)</option>
                  <option value={4}>April (Month 4)</option>
                  <option value={5}>May (Month 5)</option>
                  <option value={6}>June (Month 6)</option>
                  <option value={7}>July (Month 7)</option>
                  <option value={8}>August (Month 8)</option>
                  <option value={9}>September (Month 9)</option>
                  <option value={10}>October (Month 10 - Default)</option>
                  <option value={11}>November (Month 11)</option>
                  <option value={12}>December (Month 12)</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cutoffDay}
                  onChange={(e) => setCutoffDay(Number(e.target.value))}
                  placeholder="Day (31)"
                  className="w-full px-3 py-2 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
                  style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                />
              </div>
              <span className="text-[10px] text-slate-400">Till 31st Oct 2026, forms continue 2025-26 series (e.g. 250458). After 31st Oct 2026, series auto-resets to 260001 for 2026-27.</span>
            </div>

            <div className="space-y-1">
              <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Form Number Digits Format *</label>
              <select
                value={digitFormat}
                onChange={(e) => setDigitFormat(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
                style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
              >
                <option value="YY0000">YY + 4 Digits (e.g. 260001 for 2026-27) [Default]</option>
                <option value="YYYY0000">YYYY + 4 Digits (e.g. 20260001 for 2026-27)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Session Starting Form Number Series *</label>
              <input
                type="number"
                value={startingSeries}
                onChange={(e) => setStartingSeries(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
                style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
              />
              <span className="text-[10px] text-slate-400">Standard prefix for new session (e.g. 260001 for 2026-27 session starting Oct).</span>
            </div>

            <div className="space-y-1">
              <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Next Form Number Counter *</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={nextFormNumber}
                  onChange={(e) => setNextFormNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
                  style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
                />
                <button
                  type="button"
                  onClick={handleRecalculateCounter}
                  disabled={recalculating}
                  className="px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Recalculate highest form number in DB"
                >
                  <RotateCcw size={14} className={recalculating ? 'animate-spin' : ''} />
                  <span>Sync Counter</span>
                </button>
              </div>
            </div>
          </div>

          {/* Class Admission Toggles */}
          <div className="p-6 rounded-3xl border space-y-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
            <div className="font-extrabold text-sm flex items-center gap-2" style={{ color: 'var(--text-main, #0f172a)' }}>
              <ListFilter size={18} className="text-teal-600" /> Active Online Admission Classes
            </div>

            <div className="space-y-2">
              {[
                { label: 'Allow 12th Class Admissions', state: allow12th, set: setAllow12th },
                { label: 'Allow 11th Class Admissions', state: allow11th, set: setAllow11th },
                { label: 'Allow 10th Class Admissions', state: allow10th, set: setAllow10th },
                { label: 'Allow 9th Class Admissions', state: allow9th, set: setAllow9th },
              ].map((item, idx) => (
                <label key={idx} className="flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-slate-900 cursor-pointer font-bold" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
                  <input
                    type="checkbox"
                    checked={item.state}
                    onChange={(e) => item.set(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Recycled Form Numbers Queue Panel */}
        <div className="p-6 rounded-3xl border space-y-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          <div className="flex items-center justify-between">
            <div className="font-extrabold text-sm flex items-center gap-2" style={{ color: 'var(--text-main, #0f172a)' }}>
              <Hash size={18} className="text-teal-600" /> Recycled / Deleted Form Numbers Queue ({recycledFormNumbers.length})
            </div>
            {recycledFormNumbers.length > 0 && (
              <span className="text-[11px] font-bold text-teal-600 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/20">
                These recycled form numbers will be assigned first to new applicants
              </span>
            )}
          </div>

          {recycledFormNumbers.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-center font-bold">
              No recycled form numbers in queue. Sequential auto-increment counter is active.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recycledFormNumbers.map((no, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-extrabold">
                  <span>#{no}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecycled(no)}
                    className="text-red-500 hover:text-red-700 cursor-pointer"
                    title="Purge from recycled queue"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deleted Forms History Log */}
        {deletedHistory.length > 0 && (
          <div className="p-6 rounded-3xl border space-y-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
            <div className="font-extrabold text-sm flex items-center gap-2" style={{ color: 'var(--text-main, #0f172a)' }}>
              <AlertCircle size={18} className="text-red-500" /> Deleted Application Form Numbers History ({deletedHistory.length})
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-600 dark:text-slate-300">
                    <th className="p-3">Form No.</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Class / Stream</th>
                    <th className="p-3">Deleted Date</th>
                    <th className="p-3">Deleted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  {deletedHistory.slice(0, 15).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 text-amber-600 font-black">#{row.formNumber}</td>
                      <td className="p-3">{row.studentName}</td>
                      <td className="p-3">{row.className} ({row.stream})</td>
                      <td className="p-3 text-[11px] text-slate-400">{new Date(row.deletedAt).toLocaleString('en-IN')}</td>
                      <td className="p-3">{row.deletedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-7 py-3.5 rounded-2xl font-extrabold text-white bg-amber-600 hover:bg-amber-500 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Save Super Admin Form Number Settings</span>
        </button>
      </form>
    </div>
  );
}
