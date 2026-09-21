import React, { useState, useEffect } from 'react';
import { 
  Settings, Sliders, BookOpen, Database, Save, RefreshCw, 
  CheckCircle2, AlertCircle, X, Mail, ShieldCheck, Layers, 
  FileCheck, ArrowRight, ShieldAlert, Sparkles, Check
} from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { loadSiteSettings } from '../../utils/settingsLoader';
import SessionArchivalModal from './SessionArchivalModal';
import ConfirmModal from '../components/ConfirmModal';
import { logAdminActivity } from '../../services/adminActivityLogger';

export default function ControlsAndSubjects() {
  const getInitialControlsSubTab = () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSubTab = searchParams.get('subtab');
      if (urlSubTab && ['controls', 'rollover', 'lab'].includes(urlSubTab)) return urlSubTab === 'lab' ? 'rollover' : urlSubTab;
      const saved = sessionStorage.getItem('hss_admin_controls_subtab');
      if (saved && ['controls', 'rollover', 'lab'].includes(saved)) return saved === 'lab' ? 'rollover' : saved;
    } catch (_) {}
    return 'controls';
  };

  const [activeSubTab, setActiveSubTabState] = useState(getInitialControlsSubTab);

  const setActiveSubTab = (newTab) => {
    setActiveSubTabState(newTab);
    try {
      sessionStorage.setItem('hss_admin_controls_subtab', newTab);
      const url = new URL(window.location.href);
      if (newTab === 'controls') {
        url.searchParams.delete('subtab');
      } else {
        url.searchParams.set('subtab', newTab);
      }
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  };

  // Settings & Controls States
  const [session, setSession] = useState('2025-26');
  const [printOrder, setPrintOrder] = useState('Newest');
  const [logoUrl, setLogoUrl] = useState('https://raw.githubusercontent.com/ShGulfam/hss.shangus_exam_2024-25/refs/heads/main/hss%20shangus_logo_2024_small.png');
  
  // Class Admission Toggles
  const [allow9th, setAllow9th] = useState(true);
  const [allow10th, setAllow10th] = useState(true);
  const [allow11th, setAllow11th] = useState(true);
  const [allow12th, setAllow12th] = useState(true);

  // Teacher Evaluation & Submission Toggles
  const [practicalsSubmissionOpen, setPracticalsSubmissionOpen] = useState(true);
  const [attendanceSubmissionOpen, setAttendanceSubmissionOpen] = useState(true);

  // Annual Session Rollover Cutoff States (Default: 15th October)
  const [rolloverMonth, setRolloverMonth] = useState(10); // 1-12 (October)
  const [rolloverDay, setRolloverDay] = useState(15); // 1-31

  // Administrative Ingestion & Admission Controls
  const [allowExpressZeroRestrictions, setAllowExpressZeroRestrictions] = useState(false);
  const strict3PointMatching = true;
  const enable30DayRollback = true;

  // Email Functionality Toggles
  const [emailSubmission, setEmailSubmission] = useState(true);
  const [emailUpgradePdf, setEmailUpgradePdf] = useState(true);
  const [emailRejection, setEmailRejection] = useState(true);
  const [emailRegOtp, setEmailRegOtp] = useState(true);
  const [emailResetOtp, setEmailResetOtp] = useState(true);

  // Session Rollover Modal State
  const [showArchivalModal, setShowArchivalModal] = useState(false);

  // Loading & Alert Notification States
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);

  // Load existing app settings from Firestore / Local Storage
  useEffect(() => {
    async function loadConfigs() {
      try {
        const [appRes, siteSettings] = await Promise.all([
          appsScriptApi.getPublicSettings().catch(() => null),
          loadSiteSettings().catch(() => null)
        ]);

        if (appRes && appRes.data) {
          const cfg = appRes.data;
          if (cfg.session) setSession(cfg.session);
          if (cfg.logo_url) setLogoUrl(cfg.logo_url);
        }

        if (siteSettings) {
          if (siteSettings.session) setSession(siteSettings.session);
          if (siteSettings.practicalsSubmissionOpen !== undefined) setPracticalsSubmissionOpen(Boolean(siteSettings.practicalsSubmissionOpen));
          if (siteSettings.attendanceSubmissionOpen !== undefined) setAttendanceSubmissionOpen(Boolean(siteSettings.attendanceSubmissionOpen));

          // Annual session cutoff date
          if (siteSettings.annualRolloverCutoff) {
            const m = siteSettings.annualRolloverCutoff.rolloverMonth ?? siteSettings.annualRolloverCutoff.month;
            const d = siteSettings.annualRolloverCutoff.rolloverDay ?? siteSettings.annualRolloverCutoff.day;
            if (m !== undefined) setRolloverMonth(Number(m));
            if (d !== undefined) setRolloverDay(Number(d));
          }

          // Class admission toggles
          if (siteSettings.allow_9th !== undefined) setAllow9th(Boolean(siteSettings.allow_9th));
          else if (siteSettings.allow9th !== undefined) setAllow9th(Boolean(siteSettings.allow9th));
          else if (siteSettings.admissionsClosed?.['9th'] !== undefined) setAllow9th(!siteSettings.admissionsClosed['9th']);

          if (siteSettings.allow_10th !== undefined) setAllow10th(Boolean(siteSettings.allow_10th));
          else if (siteSettings.allow10th !== undefined) setAllow10th(Boolean(siteSettings.allow10th));
          else if (siteSettings.admissionsClosed?.['10th'] !== undefined) setAllow10th(!siteSettings.admissionsClosed['10th']);

          if (siteSettings.allow_11th !== undefined) setAllow11th(Boolean(siteSettings.allow_11th));
          else if (siteSettings.allow11th !== undefined) setAllow11th(Boolean(siteSettings.allow11th));
          else if (siteSettings.admissionsClosed?.['11th'] !== undefined) setAllow11th(!siteSettings.admissionsClosed['11th']);

          if (siteSettings.allow_12th !== undefined) setAllow12th(Boolean(siteSettings.allow_12th));
          else if (siteSettings.allow12th !== undefined) setAllow12th(Boolean(siteSettings.allow12th));
          else if (siteSettings.admissionsClosed?.['12th'] !== undefined) setAllow12th(!siteSettings.admissionsClosed['12th']);

          // Automated email triggers
          if (siteSettings.email_submission !== undefined) setEmailSubmission(Boolean(siteSettings.email_submission));
          if (siteSettings.email_upgrade_pdf !== undefined) setEmailUpgradePdf(Boolean(siteSettings.email_upgrade_pdf));
          if (siteSettings.email_rejection !== undefined) setEmailRejection(Boolean(siteSettings.email_rejection));
          if (siteSettings.email_reg_otp !== undefined) setEmailRegOtp(Boolean(siteSettings.email_reg_otp));
          if (siteSettings.email_reset_otp !== undefined) setEmailResetOtp(Boolean(siteSettings.email_reset_otp));

          // Master Student Data Hub Settings
          if (siteSettings.allowExpressZeroRestrictions !== undefined) setAllowExpressZeroRestrictions(Boolean(siteSettings.allowExpressZeroRestrictions));
        }
      } catch (e) {
        console.warn('Settings load fallback:', e);
      }
    }
    loadConfigs();
  }, []);

  // Save All System & Admission Controls
  const handleSaveControls = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const formattedDate = `${rolloverDay} ${monthNames[Number(rolloverMonth) - 1]}`;

      const settings = {
        session,
        currentSession: session,
        print_order: printOrder,
        logo_url: logoUrl,
        allow_9th: allow9th,
        allow_10th: allow10th,
        allow_11th: allow11th,
        allow_12th: allow12th,
        allow9th,
        allow10th,
        allow11th,
        allow12th,
        admissionsClosed: {
          "9th": !allow9th,
          "10th": !allow10th,
          "11th": !allow11th,
          "12th": !allow12th
        },
        practicalsSubmissionOpen,
        attendanceSubmissionOpen,
        email_submission: emailSubmission,
        email_upgrade_pdf: emailUpgradePdf,
        email_rejection: emailRejection,
        email_reg_otp: emailRegOtp,
        email_reset_otp: emailResetOtp,
        strict3PointMatching,
        allowExpressZeroRestrictions,
        enable30DayRollback,
        annualRolloverCutoff: {
          month: Number(rolloverMonth),
          day: Number(rolloverDay),
          rolloverMonth: Number(rolloverMonth),
          rolloverDay: Number(rolloverDay),
          formatted: formattedDate,
          rolloverFormatted: formattedDate,
        },
      };

      await setDoc(doc(db, 'site', 'settings'), settings, { merge: true });
      try { localStorage.setItem('site_settings', JSON.stringify(settings)); } catch (_) {}
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Updated System & Admission Controls',
        details: `Updated controls: Session=${session}, 11th Adm=${allow11th ? 'OPEN' : 'CLOSED'}, 12th Adm=${allow12th ? 'OPEN' : 'CLOSED'}`,
        metadata: { session, allow11th, allow12th, allow9th, allow10th }
      });
      setAlert({ type: 'success', text: '✨ System & admission controls updated successfully!' });
    } catch (err) {
      setAlert({ type: 'error', text: `Settings save note: ${err.message || 'Please retry.'}` });
    } finally {
      setSaving(false);
    }
  };

  // Dedicated Save for Rollover Cutoff Schedule
  const handleSaveRolloverCutoff = async () => {
    setSaving(true);
    setAlert(null);
    try {
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const formattedDate = `${rolloverDay} ${monthNames[Number(rolloverMonth) - 1]}`;
      const cutoffObj = {
        month: Number(rolloverMonth),
        day: Number(rolloverDay),
        rolloverMonth: Number(rolloverMonth),
        rolloverDay: Number(rolloverDay),
        formatted: formattedDate,
        rolloverFormatted: formattedDate,
      };
      await setDoc(doc(db, 'site', 'settings'), { annualRolloverCutoff: cutoffObj }, { merge: true });
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Updated Annual Rollover Cutoff Schedule',
        details: `Annual rollover cutoff schedule set to ${formattedDate}`,
        metadata: { rolloverMonth, rolloverDay }
      });
      setAlert({ type: 'success', text: `✨ Annual session rollover cutoff updated to ${formattedDate}!` });
    } catch (err) {
      setAlert({ type: 'error', text: `Failed to save cutoff schedule: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5 text-xs animate-fadeIn text-slate-900 dark:text-slate-100">
      {/* Top Banner Alert */}
      {alert && (
        <div className={`p-3 rounded-2xl font-extrabold flex items-center justify-between gap-3 shadow-xs ${
          alert.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {alert.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <div className="p-2 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5 sm:space-y-3">
        {/* Top Header & Universal Controls Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2 sm:pb-3 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-2xs">
              <Settings size={14} className="sm:hidden" />
              <Settings size={16} className="hidden sm:inline" />
            </div>
            <div>
              <h2 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                System & Admission Controls
              </h2>
              <p className="text-[9.5px] sm:text-[10.5px] font-semibold text-slate-400 dark:text-slate-500">
                Class admission windows, academic session year & automated rollover
              </p>
            </div>
          </div>

          {/* Consistent Standard Save Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleSaveControls}
              disabled={saving}
              className="px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar */}
        <div className="flex items-center gap-1 sm:gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5 sm:pb-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'controls', label: '1. Admission & System Controls', shortLabel: '1. Controls', icon: Sliders },
            { id: 'rollover', label: '2. Annual Session Rollover', shortLabel: '2. Rollover', icon: Database },
          ].map((sub) => {
            const Icon = sub.icon;
            const isActive = activeSubTab === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveSubTab(sub.id)}
                className={`py-0.5 sm:py-1 px-2 sm:px-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-500/30'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={12} />
                <span className="sm:hidden">{sub.shortLabel}</span>
                <span className="hidden sm:inline">{sub.label}</span>
              </button>
            );
          })}
        </div>

        {/* SUBTAB 1: ADMISSION & SYSTEM CONTROLS */}
        {activeSubTab === 'controls' && (
          <form onSubmit={handleSaveControls} className="space-y-2.5 sm:space-y-3.5 pt-0.5 sm:pt-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
              {/* Column 1: Class Admission Status */}
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2 sm:space-y-2.5">
                <div className="font-black text-[11px] sm:text-xs flex items-center justify-between text-amber-700 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 sm:pb-2">
                  <span className="flex items-center gap-1.5"><Sliders size={13} /> Class Admission Windows</span>
                  <span className="text-[9px] sm:text-[10px] font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold">4 Classes</span>
                </div>

                <div className="space-y-1 sm:space-y-1.5">
                  {[
                    { label: 'Class 9th Admissions', val: allow9th, set: setAllow9th },
                    { label: 'Class 10th Admissions', val: allow10th, set: setAllow10th },
                    { label: 'Class 11th Admissions', val: allow11th, set: setAllow11th },
                    { label: 'Class 12th Admissions', val: allow12th, set: setAllow12th },
                  ].map((item, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-black cursor-pointer transition-all ${
                        item.val
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={(e) => item.set(e.target.checked)}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Column 2: Faculty Submission Toggles & Session */}
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2 sm:space-y-2.5">
                <div className="font-black text-[11px] sm:text-xs flex items-center justify-between text-indigo-700 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 sm:pb-2">
                  <span className="flex items-center gap-1.5"><BookOpen size={13} /> Faculty Submissions</span>
                  <span className="text-[9px] sm:text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold">Portals</span>
                </div>

                <div className="space-y-1 sm:space-y-1.5">
                  {[
                    { label: 'Practicals & Marks Entry', val: practicalsSubmissionOpen, set: setPracticalsSubmissionOpen },
                    { label: 'Attendance Management', val: attendanceSubmissionOpen, set: setAttendanceSubmissionOpen },
                  ].map((item, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-black cursor-pointer transition-all ${
                        item.val
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={(e) => item.set(e.target.checked)}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>

                <div className="pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <label className="block text-[9.5px] sm:text-[10.5px] font-black uppercase text-slate-600 dark:text-slate-400">
                    Active Academic Session Year
                  </label>
                  <input
                    type="text"
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    placeholder="e.g. 2025-26"
                    className="w-full p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Column 3: Automated Parent & Student Notifications */}
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2 sm:space-y-2.5">
                <div className="font-black text-[11px] sm:text-xs flex items-center justify-between text-teal-700 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 sm:pb-2">
                  <span className="flex items-center gap-1.5"><Mail size={13} /> Email Automations</span>
                  <span className="text-[9px] sm:text-[10px] bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 px-1.5 sm:px-2 py-0.5 rounded-full font-bold">Live Triggers</span>
                </div>

                <div className="space-y-1 sm:space-y-1.5">
                  {[
                    { label: 'Application Submission Email', val: emailSubmission, set: setEmailSubmission },
                    { label: 'Provisional Upgrade Slip PDF', val: emailUpgradePdf, set: setEmailUpgradePdf },
                    { label: 'Rejection Notification', val: emailRejection, set: setEmailRejection },
                    { label: 'Registration OTP Email', val: emailRegOtp, set: setEmailRegOtp },
                    { label: 'Password Reset OTP Email', val: emailResetOtp, set: setEmailResetOtp },
                  ].map((item, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center justify-between p-1.5 rounded-lg sm:rounded-xl border text-[10.5px] sm:text-[11px] font-bold cursor-pointer transition-all ${
                        item.val
                          ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={(e) => item.set(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Ingestion & Admission Controls Card */}
            <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-1.5 sm:space-y-2">
              <span className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white block">
                Administrative Ingestion Safeguards
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 pt-0.5">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[11px] sm:text-xs block text-slate-800 dark:text-slate-200">Strict 3-Point Matching</span>
                    <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono">Session, Class & Reg No.</span>
                  </div>
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                </div>

                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[11px] sm:text-xs block text-slate-800 dark:text-slate-200">Rollback Protection</span>
                    <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono">30-day pre-update backup</span>
                  </div>
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                </div>

                <label className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-bold text-[11px] sm:text-xs block text-slate-800 dark:text-slate-200">Express Admin Ingestion</span>
                    <span className="text-[9.5px] sm:text-[10px] text-slate-400">Allow single-record intake</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowExpressZeroRestrictions}
                    onChange={(e) => setAllowExpressZeroRestrictions(e.target.checked)}
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </form>
        )}

        {/* SUBTAB 2: ANNUAL SESSION ROLLOVER */}
        {activeSubTab === 'rollover' && (
          <div className="space-y-2.5 sm:space-y-3.5 pt-0.5 sm:pt-1">
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-purple-200 dark:border-purple-800/80 bg-purple-50/40 dark:bg-purple-950/20 space-y-2.5 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-200/60 dark:border-purple-800/60 pb-2 sm:pb-2.5 gap-2">
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-purple-600 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-sm text-purple-950 dark:text-purple-200">
                      Annual Session Rollover & Archive Hub
                    </h3>
                    <p className="text-[9.5px] sm:text-[10.5px] text-purple-800 dark:text-purple-300">
                      Configure automated cutoff date and review students before rolling over to the new academic year
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveRolloverCutoff}
                  disabled={saving}
                  className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl font-black text-[10.5px] sm:text-xs text-white bg-purple-600 hover:bg-purple-500 shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95 self-end sm:self-auto"
                >
                  {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                  <span>Save Cutoff Schedule</span>
                </button>
              </div>

              {/* Cutoff Date Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 mb-0.5 sm:mb-1">
                    Cutoff Month
                  </label>
                  <select
                    value={rolloverMonth}
                    onChange={(e) => setRolloverMonth(Number(e.target.value))}
                    className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-bold text-[11px] sm:text-xs text-slate-800 dark:text-slate-200"
                  >
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((mName, idx) => (
                      <option key={mName} value={idx + 1}>{mName} (Month {idx + 1})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 mb-0.5 sm:mb-1">
                    Cutoff Day of Month
                  </label>
                  <select
                    value={rolloverDay}
                    onChange={(e) => setRolloverDay(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-bold text-xs text-slate-800 dark:text-slate-200"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Day {d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-[10.5px] font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5 pt-0.5">
                <AlertCircle size={13} className="text-amber-600 shrink-0" />
                <span>Controls the date when administrators receive the annual rollover prompt in portal reports.</span>
              </div>
            </div>

            {/* Safeguards Summary Micro-Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-2.5">
                <Layers size={16} className="text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-black text-xs text-slate-900 dark:text-white block leading-tight">Pre-Audit Scan</span>
                  <span className="text-[10px] text-slate-500 font-medium block truncate">Categorizes Approved, Drafts & Rejected</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-black text-xs text-slate-900 dark:text-white block leading-tight">Dry-Run Preview</span>
                  <span className="text-[10px] text-slate-500 font-medium block truncate">Full student table & photo verification</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-2.5">
                <FileCheck size={16} className="text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-black text-xs text-slate-900 dark:text-white block leading-tight">Atomic Transactions</span>
                  <span className="text-[10px] text-slate-500 font-medium block truncate">Native Firestore batch architecture</span>
                </div>
              </div>
            </div>

            {/* Launch Action Button Bar */}
            <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <AlertCircle size={13} className="text-amber-500 shrink-0" />
                Zero auto-action: Clicking launches the non-destructive audit & preview modal.
              </span>

              <button
                type="button"
                onClick={() => setShowArchivalModal(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl font-black text-xs text-white bg-purple-700 hover:bg-purple-600 active:scale-95 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Database size={13} />
                <span>Analyze & Preview Archival</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SESSION ARCHIVAL & ROLLOVER MODAL */}
      <SessionArchivalModal
        isOpen={showArchivalModal}
        onClose={() => setShowArchivalModal(false)}
        currentSession={session}
        onArchivalComplete={(res) => {
          setAlert({
            type: 'success',
            text: `Successfully archived ${res.archivedCount} students to masterRegisters for session ${res.archivedSession}! New session: ${res.newSession}.`
          });
        }}
      />

      {confirmModalConfig && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmModalConfig(null)}
          onCancel={() => setConfirmModalConfig(null)}
          {...confirmModalConfig}
        />
      )}
    </div>
  );
}
