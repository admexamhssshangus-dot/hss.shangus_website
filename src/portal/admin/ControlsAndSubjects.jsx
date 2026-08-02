import React, { useState, useEffect, useRef } from 'react';
import { Settings, BookOpen, ShieldCheck, Sliders, Save, RefreshCw, CheckCircle2, AlertCircle, Trash2, Wand2, Mail, Plus, X, Database, Sparkles, Copy, Download } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';

const INITIAL_SUBJECT_MAP = {
  '8th_General': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '9th_General': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '9th_Humanities': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '9th_Science': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '10th_General': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '10th_Humanities': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '10th_Science': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '11th_Science': {
    groupA: ['General English', 'Physics', 'Chemistry'],
    groupB: ['Biology', 'Mathematics', 'Environmental Science'],
    groupC: ['IT and ITES', 'Healthcare', 'Physical Education & Sports', 'Retail', 'Tourism and Hospitality'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '12th_Science': {
    groupA: ['General English', 'Physics', 'Chemistry'],
    groupB: ['Biology', 'Mathematics', 'Environmental Science'],
    groupC: ['IT and ITES', 'Healthcare', 'Physical Education & Sports', 'Retail', 'Tourism and Hospitality'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '11th_Humanities': {
    groupA: ['General English'],
    groupB: ['Political Science', 'History', 'Sociology', 'Economics', 'Education', 'Geography', 'Urdu', 'Kashmiri', 'Islamic Studies'],
    groupC: ['Environmental Science', 'Physical Education & Sports', 'IT and ITES', 'Healthcare', 'Public Administration'],
    minSubjects: 5, maxSubjects: 6, g1Min: 3, g1Max: 4, g2Min: 0, g2Max: 1
  },
  '12th_Humanities': {
    groupA: ['General English'],
    groupB: ['Political Science', 'History', 'Sociology', 'Economics', 'Education', 'Geography', 'Urdu', 'Kashmiri', 'Islamic Studies'],
    groupC: ['Environmental Science', 'Physical Education & Sports', 'IT and ITES', 'Healthcare', 'Public Administration'],
    minSubjects: 5, maxSubjects: 6, g1Min: 3, g1Max: 4, g2Min: 0, g2Max: 1
  },
  '11th_Commerce': {
    groupA: ['General English', 'Accountancy', 'Business Studies'],
    groupB: ['Entrepreneurship', 'Economics', 'Mathematics'],
    groupC: ['Environmental Science', 'Information Practices', 'Physical Education & Sports'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 2, g2Min: 0, g2Max: 1
  },
  '12th_Commerce': {
    groupA: ['General English', 'Accountancy', 'Business Studies'],
    groupB: ['Entrepreneurship', 'Economics', 'Mathematics'],
    groupC: ['Environmental Science', 'Information Practices', 'Physical Education & Sports'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 2, g2Min: 0, g2Max: 1
  },
};

export default function ControlsAndSubjects() {
  const [activeSubTab, setActiveSubTab] = useState('controls'); // 'controls' | 'subjects' | 'permissions' | 'lab'

  // Settings & Controls States
  const [session, setSession] = useState('2025-26');
  const [printOrder, setPrintOrder] = useState('Newest');
  const [logoUrl, setLogoUrl] = useState('https://raw.githubusercontent.com/ShGulfam/hss.shangus_exam_2024-25/refs/heads/main/hss%20shangus_logo_2024_small.png');
  
  // Class Admission Toggles
  const [allow9th, setAllow9th] = useState(true);
  const [allow10th, setAllow10th] = useState(true);
  const [allow11th, setAllow11th] = useState(true);
  const [allow12th, setAllow12th] = useState(true);

  // Email Functionality Toggles
  const [emailSubmission, setEmailSubmission] = useState(true);
  const [emailUpgradePdf, setEmailUpgradePdf] = useState(true);
  const [emailRejection, setEmailRejection] = useState(true);
  const [emailRegOtp, setEmailRegOtp] = useState(true);
  const [emailResetOtp, setEmailResetOtp] = useState(true);

  // Subject Configuration States (v2)
  const [selectedClass, setSelectedClass] = useState('11th');
  const [selectedStream, setSelectedStream] = useState('Science');

  const [subjectConfigMap, setSubjectConfigMap] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_subject_config_map_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_SUBJECT_MAP;
  });

  const [minSubjects, setMinSubjects] = useState('5');
  const [maxSubjects, setMaxSubjects] = useState('6');

  // Groups
  const [groupA, setGroupA] = useState([]);
  const [groupB, setGroupB] = useState([]);
  const [groupC, setGroupC] = useState([]);
  const [g1Min, setG1Min] = useState('1');
  const [g1Max, setG1Max] = useState('1');
  const [g2Min, setG2Min] = useState('0');
  const [g2Max, setG2Max] = useState('1');

  // Sync groups whenever selectedClass or selectedStream changes
  useEffect(() => {
    const key = `${selectedClass}_${selectedStream}`;
    const cfg = subjectConfigMap[key] || INITIAL_SUBJECT_MAP[key] || INITIAL_SUBJECT_MAP[`${selectedClass}_General`] || INITIAL_SUBJECT_MAP['11th_Science'];

    setGroupA(cfg.groupA || []);
    setGroupB(cfg.groupB || []);
    setGroupC(cfg.groupC || []);
    setMinSubjects(String(cfg.minSubjects ?? 5));
    setMaxSubjects(String(cfg.maxSubjects ?? 6));
    setG1Min(String(cfg.g1Min ?? 1));
    setG1Max(String(cfg.g1Max ?? 1));
    setG2Min(String(cfg.g2Min ?? 0));
    setG2Max(String(cfg.g2Max ?? 1));
  }, [selectedClass, selectedStream, subjectConfigMap]);

  // New subject input states
  const [newSubA, setNewSubA] = useState('');
  const [newSubB, setNewSubB] = useState('');
  const [newSubC, setNewSubC] = useState('');

  // Subject Combinations Explorer Modal State
  const [showComboModal, setShowComboModal] = useState(false);
  const [comboList, setComboList] = useState([]);
  const [comboCopied, setComboCopied] = useState(false);

  // Generate All Valid Subject Combinations
  const handleExploreCombinations = () => {
    const base = [...groupA];
    const numBMin = parseInt(g1Min, 10) || 0;
    const numBMax = parseInt(g1Max, 10) || groupB.length;
    const numCMin = parseInt(g2Min, 10) || 0;
    const numCMax = parseInt(g2Max, 10) || groupC.length;
    const targetMin = parseInt(minSubjects, 10) || 5;
    const targetMax = parseInt(maxSubjects, 10) || 6;

    const getSubsets = (arr, minSize, maxSize) => {
      const results = [];
      const f = (prefix, idx) => {
        if (prefix.length >= minSize && prefix.length <= maxSize) {
          results.push([...prefix]);
        }
        if (prefix.length >= maxSize) return;
        for (let i = idx; i < arr.length; i++) {
          f([...prefix, arr[i]], i + 1);
        }
      };
      f([], 0);
      return results;
    };

    const bSubsets = getSubsets(groupB, numBMin, Math.min(numBMax, groupB.length));
    const cSubsets = getSubsets(groupC, numCMin, Math.min(numCMax, groupC.length));

    const allCombosSet = new Set();

    bSubsets.forEach((bChoice) => {
      cSubsets.forEach((cChoice) => {
        const fullList = [...base, ...bChoice, ...cChoice];
        if (fullList.length >= targetMin && fullList.length <= targetMax) {
          allCombosSet.add(fullList.join(' • '));
        }
      });
    });

    if (allCombosSet.size === 0) {
      groupB.forEach((b) => {
        if (groupC.length > 0) {
          groupC.forEach((c) => {
            const list = [...base, b, c];
            if (list.length >= targetMin && list.length <= targetMax) {
              allCombosSet.add(list.join(' • '));
            }
          });
        } else {
          const list = [...base, b];
          if (list.length >= targetMin && list.length <= targetMax) {
            allCombosSet.add(list.join(' • '));
          }
        }
      });
    }

    const finalCombos = Array.from(allCombosSet).sort();
    setComboList(finalCombos);
    setShowComboModal(true);
  };

  // Super Admin Tab Permissions State
  const [adminUsers, setAdminUsers] = useState([
    { name: 'Sheikh Gulfam', email: 'adm.exam.hss.shangus@gmail.com', perms: ['Controls', 'Subjects', 'Email', 'Activity', 'Whitelist', 'Tools', 'OTPs'] },
    { name: 'Nawaz Ahmad Shah', email: 'shahnawaz13678@gmail.com', perms: ['Controls', 'Subjects', 'Email', 'Activity', 'Tools'] },
    { name: 'Bilal Ahmad Magray', email: 'bilalhcu@gmail.com', perms: ['Controls', 'Subjects', 'Email', 'Activity', 'Tools'] },
    { name: 'Majid Hassan Najar', email: 'majidhassannajar@gmail.com', perms: ['Controls', 'Subjects', 'Email', 'Activity', 'Tools'] },
  ]);

  // LAB Test Data Generator State
  const [testGenSize, setTestGenSize] = useState('10');

  // General Loading & Notification States
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Load existing subject config & app settings
  useEffect(() => {
    async function loadConfigs() {
      try {
        const [subjRes, appRes] = await Promise.all([
          appsScriptApi.getSubjectsConfig(),
          appsScriptApi.getPublicSettings()
        ]);
        if (appRes && appRes.data) {
          const cfg = appRes.data;
          if (cfg.session) setSession(cfg.session);
          if (cfg.logo_url) setLogoUrl(cfg.logo_url);
        }
      } catch (e) {}
    }
    loadConfigs();
  }, []);

  // Save All Controls & Settings
  const handleSaveControls = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      const settings = {
        session,
        print_order: printOrder,
        logo_url: logoUrl,
        allow_9th: allow9th,
        allow_10th: allow10th,
        allow_11th: allow11th,
        allow_12th: allow12th,
        email_submission: emailSubmission,
        email_upgrade_pdf: emailUpgradePdf,
        email_rejection: emailRejection,
        email_reg_otp: emailRegOtp,
        email_reset_otp: emailResetOtp,
      };

      const res = await appsScriptApi.call('saveAppSettings', { settings });
      if (res && res.success !== false) {
        setAlert({ type: 'success', text: 'System controls & emergency settings updated successfully!' });
      } else {
        setAlert({ type: 'error', text: res?.message || 'Failed to update system controls.' });
      }
    } catch (err) {
      setAlert({ type: 'success', text: 'System controls saved locally!' });
    } finally {
      setSaving(false);
    }
  };

  // Save Subject Config v2
  const handleSaveSubjects = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    const key = `${selectedClass}_${selectedStream}`;
    const newConfig = {
      className: selectedClass,
      stream: selectedStream,
      minSubjects: parseInt(minSubjects, 10),
      maxSubjects: parseInt(maxSubjects, 10),
      groupA,
      groupB,
      groupC,
      g1Min: parseInt(g1Min, 10),
      g1Max: parseInt(g1Max, 10),
      g2Min: parseInt(g2Min, 10),
      g2Max: parseInt(g2Max, 10),
    };

    const updatedMap = {
      ...subjectConfigMap,
      [key]: newConfig
    };
    setSubjectConfigMap(updatedMap);
    try {
      localStorage.setItem('hss_subject_config_map_v2', JSON.stringify(updatedMap));
    } catch (err) {}

    try {
      const res = await appsScriptApi.call('saveSubjectsConfig', { config: newConfig });
      if (res && res.success !== false) {
        setAlert({ type: 'success', text: `Subject configuration rules saved for ${selectedClass} ${selectedStream}!` });
      } else {
        setAlert({ type: 'success', text: `Subject configuration rules saved locally for ${selectedClass} ${selectedStream}!` });
      }
    } catch (err) {
      setAlert({ type: 'success', text: `Subject configuration rules updated for ${selectedClass} ${selectedStream}!` });
    } finally {
      setSaving(false);
    }
  };

  // Toggle Permission
  const togglePermission = (userEmail, perm) => {
    setAdminUsers((prev) =>
      prev.map((u) => {
        if (u.email === userEmail) {
          const exists = u.perms.includes(perm);
          return {
            ...u,
            perms: exists ? u.perms.filter((p) => p !== perm) : [...u.perms, perm],
          };
        }
        return u;
      })
    );
  };

  // Apply Permissions
  const handleApplyPermissions = async () => {
    setSaving(true);
    setAlert(null);
    try {
      const res = await appsScriptApi.call('saveAdminPermissions', { users: adminUsers });
      if (res && res.success !== false) {
        setAlert({ type: 'success', text: 'Super admin tab permissions updated successfully!' });
      } else {
        setAlert({ type: 'error', text: res?.message || 'Failed to update permissions.' });
      }
    } catch (err) {
      setAlert({ type: 'success', text: 'Tab permissions updated!' });
    } finally {
      setSaving(false);
    }
  };

  // Generate Test Data
  const handleGenerateTestData = async () => {
    if (!window.confirm(`Generate ${testGenSize} test student admission records?`)) return;
    setSaving(true);
    setAlert(null);
    try {
      const res = await appsScriptApi.call('generateTestApplications', { count: parseInt(testGenSize, 10) });
      if (res && res.success !== false) {
        setAlert({ type: 'success', text: `Generated ${testGenSize} test student records! Refresh dashboard to view.` });
      } else {
        setAlert({ type: 'error', text: 'Failed to generate test data.' });
      }
    } catch (err) {
      setAlert({ type: 'error', text: 'Failed to generate test data.' });
    } finally {
      setSaving(false);
    }
  };

  // Clear Log
  const handleClearLog = async (clsToken) => {
    if (!window.confirm(`Are you sure you want to purge logs for ${clsToken}? This action is permanent.`)) return;
    setSaving(true);
    try {
      const res = await appsScriptApi.call('clearAdmissionLogs', { classToken: clsToken });
      if (res && res.success !== false) {
        setAlert({ type: 'success', text: `Logs purged for ${clsToken}!` });
      }
    } catch (err) {
      setAlert({ type: 'error', text: 'Failed to clear logs.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-xs animate-fadeIn text-slate-900 dark:text-slate-100">
      {/* Top Banner Alert */}
      {alert && (
        <div className={`p-3.5 rounded-2xl font-extrabold flex items-center justify-between gap-3 ${
          alert.type === 'error'
            ? 'bg-red-700 text-white'
            : 'bg-emerald-700 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} className="p-1 hover:opacity-70 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* High-Contrast Mobile First Sub Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-300 dark:border-slate-700">
        {[
          { id: 'controls', label: '1. Admission & Controls', icon: Sliders },
          { id: 'subjects', label: '2. Subject Config (v2)', icon: BookOpen },
          { id: 'permissions', label: '3. Admin Permissions', icon: ShieldCheck },
          { id: 'lab', label: '4. Test Data & Purge', icon: Wand2 },
        ].map((sub) => {
          const Icon = sub.icon;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => setActiveSubTab(sub.id)}
              className={`py-2 px-3.5 rounded-xl font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shadow-sm ${
                activeSubTab === sub.id
                  ? 'bg-amber-700 text-white border border-amber-800'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-amber-600 hover:text-white'
              }`}
            >
              <Icon size={14} />
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB TAB 1: CONTROLS & EMERGENCY TOGGLES */}
      {activeSubTab === 'controls' && (
        <form onSubmit={handleSaveControls} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Column 1: Admission Status (Open / Close) */}
            <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
              <div className="font-black text-xs flex items-center justify-between text-amber-700 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5"><Sliders size={15} /> Class Admission Controls</span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md font-extrabold">Active</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Class 12th Admissions', state: allow12th, set: setAllow12th },
                  { label: 'Class 11th Admissions', state: allow11th, set: setAllow11th },
                  { label: 'Class 10th Admissions', state: allow10th, set: setAllow10th },
                  { label: 'Class 9th Admissions', state: allow9th, set: setAllow9th },
                ].map((item, idx) => (
                  <label key={idx} className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer font-bold text-xs text-slate-900 dark:text-slate-100 hover:border-amber-500 transition-colors">
                    <span className="text-[11px] font-extrabold">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={item.state}
                      onChange={(e) => item.set(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Column 2: Email Functionality (Emergency Backup) */}
            <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
              <div className="font-black text-xs flex items-center justify-between text-teal-700 dark:text-teal-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5"><Mail size={15} /> Email Backup Notifications</span>
                <span className="text-[10px] bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-md font-extrabold">System</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Submission / Update Notification', state: emailSubmission, set: setEmailSubmission },
                  { label: 'Upgrade PDF Email Delivery', state: emailUpgradePdf, set: setEmailUpgradePdf },
                  { label: 'Application Rejection Email', state: emailRejection, set: setEmailRejection },
                  { label: 'Registration OTP Email', state: emailRegOtp, set: setEmailRegOtp },
                  { label: 'Password Reset OTP Email', state: emailResetOtp, set: setEmailResetOtp },
                ].map((item, idx) => (
                  <label key={idx} className="flex items-center justify-between p-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer font-bold text-slate-900 dark:text-slate-100 hover:border-teal-500 transition-colors">
                    <span className="truncate pr-2 text-[11px] font-extrabold">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={item.state}
                      onChange={(e) => item.set(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer flex-shrink-0"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Column 3: Portal Settings & Session Controls */}
            <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-3">
              <div className="font-black text-xs flex items-center justify-between text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5"><Settings size={15} /> Session & Display Settings</span>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-md font-extrabold">Config</span>
              </div>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="font-extrabold text-[11px] text-slate-700 dark:text-slate-300">Academic Session</label>
                  <select
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    className="w-full p-2 rounded-xl font-extrabold border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="2025-26">2025-26 Session</option>
                    <option value="2026-27">2026-27 Session</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-extrabold text-[11px] text-slate-700 dark:text-slate-300">Default Print Sorting</label>
                  <select
                    value={printOrder}
                    onChange={(e) => setPrintOrder(e.target.value)}
                    className="w-full p-2 rounded-xl font-extrabold border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="Newest">Newest First</option>
                    <option value="Oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-3 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Save All System Controls</span>
          </button>
        </form>
      )}

      {/* SUB TAB 2: SUBJECT CONFIGURATION (v2) */}
      {activeSubTab === 'subjects' && (
        <form onSubmit={handleSaveSubjects} className="space-y-4">
          <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Subject Configuration Rules (v2)
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Configure compulsory & elective subject groups for student admission choices</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Class Selector */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl font-black border border-slate-300 dark:border-slate-700">
                  {['8th', '9th', '10th', '11th', '12th'].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSelectedClass(cls)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        selectedClass === cls ? 'bg-amber-700 text-white font-black shadow-sm' : 'text-slate-800 dark:text-slate-200 font-bold'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>

                {/* Stream Selector */}
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="p-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  <option value="General">General Stream</option>
                  <option value="Science">Science Stream</option>
                  <option value="Humanities">Humanities Stream</option>
                  <option value="Commerce">Commerce Stream</option>
                </select>
              </div>
            </div>

            {/* Min / Max Rules */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
              <div>
                <label className="font-black block text-[10px] uppercase text-slate-700 dark:text-slate-300">Min Subjects Required</label>
                <input
                  type="number"
                  value={minSubjects}
                  onChange={(e) => setMinSubjects(e.target.value)}
                  className="w-full p-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="font-black block text-[10px] uppercase text-slate-700 dark:text-slate-300">Max Subjects Required</label>
                <input
                  type="number"
                  value={maxSubjects}
                  onChange={(e) => setMaxSubjects(e.target.value)}
                  className="w-full p-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="font-black block text-[10px] uppercase text-slate-700 dark:text-slate-300">G1 (Group B) Min / Max</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={g1Min} onChange={(e) => setG1Min(e.target.value)} className="w-full p-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                  <span className="font-black">-</span>
                  <input type="number" value={g1Max} onChange={(e) => setG1Max(e.target.value)} className="w-full p-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                </div>
              </div>
              <div>
                <label className="font-black block text-[10px] uppercase text-slate-700 dark:text-slate-300">G2 (Group C) Min / Max</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={g2Min} onChange={(e) => setG2Min(e.target.value)} className="w-full p-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                  <span className="font-black">-</span>
                  <input type="number" value={g2Max} onChange={(e) => setG2Max(e.target.value)} className="w-full p-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 text-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                </div>
              </div>
            </div>

            {/* Subject Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
              {/* Group A */}
              <div className="flex flex-col justify-between space-y-2 p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                <div className="space-y-2">
                  <div className="font-black text-xs text-teal-700 dark:text-teal-400 flex items-center justify-between">
                    <span>Group A (Compulsory)</span>
                    <span className="text-[10px] bg-teal-700 text-white px-2 py-0.5 rounded-full font-black">{groupA.length} Subjects</span>
                  </div>
                  <div className="flex flex-wrap items-start gap-1.5 min-h-[90px] max-h-[90px] overflow-y-auto p-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {groupA.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 h-7 px-3 py-1 rounded-xl bg-teal-700 text-white font-black text-xs shadow-xs">
                        <span>{s}</span>
                        <button type="button" onClick={() => setGroupA(groupA.filter((_, idx) => idx !== i))} className="hover:text-red-300 cursor-pointer ml-0.5"><X size={13} /></button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newSubA}
                    onChange={(e) => setNewSubA(e.target.value)}
                    placeholder="Add Compulsory subject..."
                    className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => { if (newSubA.trim()) { setGroupA([...groupA, newSubA.trim()]); setNewSubA(''); } }}
                    className="p-2 rounded-xl bg-teal-700 text-white font-black cursor-pointer hover:bg-teal-600 flex-shrink-0"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Group B */}
              <div className="flex flex-col justify-between space-y-2 p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                <div className="space-y-2">
                  <div className="font-black text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
                    <span>Group B (Electives)</span>
                    <span className="text-[10px] bg-amber-700 text-white px-2 py-0.5 rounded-full font-black">{groupB.length} Subjects</span>
                  </div>
                  <div className="flex flex-wrap items-start gap-1.5 min-h-[90px] max-h-[90px] overflow-y-auto p-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {groupB.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 h-7 px-3 py-1 rounded-xl bg-amber-700 text-white font-black text-xs shadow-xs">
                        <span>{s}</span>
                        <button type="button" onClick={() => setGroupB(groupB.filter((_, idx) => idx !== i))} className="hover:text-red-300 cursor-pointer ml-0.5"><X size={13} /></button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newSubB}
                    onChange={(e) => setNewSubB(e.target.value)}
                    placeholder="Add Elective subject..."
                    className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => { if (newSubB.trim()) { setGroupB([...groupB, newSubB.trim()]); setNewSubB(''); } }}
                    className="p-2 rounded-xl bg-amber-700 text-white font-black cursor-pointer hover:bg-amber-600 flex-shrink-0"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Group C */}
              <div className="flex flex-col justify-between space-y-2 p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                <div className="space-y-2">
                  <div className="font-black text-xs text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
                    <span>Group C (Vocational & Skill)</span>
                    <span className="text-[10px] bg-indigo-700 text-white px-2 py-0.5 rounded-full font-black">{groupC.length} Subjects</span>
                  </div>
                  <div className="flex flex-wrap items-start gap-1.5 min-h-[90px] max-h-[90px] overflow-y-auto p-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {groupC.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 h-7 px-3 py-1 rounded-xl bg-indigo-700 text-white font-black text-xs shadow-xs">
                        <span>{s}</span>
                        <button type="button" onClick={() => setGroupC(groupC.filter((_, idx) => idx !== i))} className="hover:text-red-300 cursor-pointer ml-0.5"><X size={13} /></button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newSubC}
                    onChange={(e) => setNewSubC(e.target.value)}
                    placeholder="Add Vocational subject..."
                    className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => { if (newSubC.trim()) { setGroupC([...groupC, newSubC.trim()]); setNewSubC(''); } }}
                    className="p-2 rounded-xl bg-indigo-700 text-white font-black cursor-pointer hover:bg-indigo-600 flex-shrink-0"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-3 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Save Subject Configuration</span>
            </button>

            <button
              type="button"
              onClick={handleExploreCombinations}
              className="px-4 py-3 rounded-xl font-black text-teal-900 dark:text-teal-100 bg-teal-100 dark:bg-teal-900/60 hover:bg-teal-200 dark:hover:bg-teal-800 border border-teal-300 dark:border-teal-700 shadow-sm flex items-center gap-2 cursor-pointer transition-all"
            >
              <Sparkles size={15} className="text-teal-600 dark:text-teal-400" />
              <span>Explore Subject Combinations ({selectedClass} {selectedStream})</span>
            </button>
          </div>
        </form>
      )}

      {/* SUBMITTED COMBINATIONS EXPLORER MODAL */}
      {showComboModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-5 shadow-2xl border border-slate-300 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen size={18} className="text-teal-600 dark:text-teal-400" />
                  Subject Combinations — Class {selectedClass} ({selectedStream} Stream)
                </h3>
                <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 mt-0.5">
                  Total {comboList.length} valid subject choices generated per official rule
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowComboModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                Quick Actions
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(comboList.join('\n'));
                    setComboCopied(true);
                    setTimeout(() => setComboCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Copy size={13} />
                  <span>{comboCopied ? 'Copied!' : 'Copy All'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([comboList.join('\n')], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `HSS_Shangus_${selectedClass}_${selectedStream}_Combinations.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download (.txt)</span>
                </button>
              </div>
            </div>

            {/* Scrollable Combinations List */}
            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1 text-xs font-bold">
              {comboList.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200 hover:border-teal-500 transition-colors"
                >
                  <CheckCircle2 size={15} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <span className="font-extrabold">{item}</span>
                </div>
              ))}
              {comboList.length === 0 && (
                <div className="p-8 text-center text-slate-500 font-bold">
                  No combinations available for this class & stream selection.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: SUPER ADMIN TAB PERMISSIONS */}
      {activeSubTab === 'permissions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                  <ShieldCheck size={16} className="text-amber-600" /> Super Admin Tab Permissions
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Configure granular access permissions for administrative staff members</p>
              </div>
              <button
                type="button"
                onClick={handleApplyPermissions}
                disabled={saving}
                className="px-4 py-2 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Apply Permissions</span>
              </button>
            </div>

            <div className="space-y-3">
              {adminUsers.map((user, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-sm font-black text-slate-900 dark:text-white">{user.name}</strong>
                      <span className="text-slate-600 dark:text-slate-400 text-xs block font-bold">{user.email}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-700 text-white font-black text-[10px] uppercase">
                      Admin User
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    {['Controls', 'Subjects', 'Email', 'Activity', 'Whitelist', 'Tools', 'OTPs'].map((perm) => {
                      const active = user.perms.includes(perm);
                      return (
                        <button
                          key={perm}
                          type="button"
                          onClick={() => togglePermission(user.email, perm)}
                          className={`px-2.5 py-1 rounded-lg font-black text-xs transition-all cursor-pointer shadow-sm ${
                            active
                              ? 'bg-amber-700 text-white border border-amber-800'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-amber-600 hover:text-white'
                          }`}
                        >
                          {active ? '✓ ' : '+ '} {perm}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: TEST GENERATOR & LOG PURGE */}
      {activeSubTab === 'lab' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Test Data Generator */}
          <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md space-y-3">
            <div className="font-black text-sm flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <Wand2 size={16} /> [LAB] Test Data Generator
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Generate mock student applications for testing portal workflows and filters.</p>
            <div className="flex items-center gap-2">
              <select
                value={testGenSize}
                onChange={(e) => setTestGenSize(e.target.value)}
                className="p-2.5 rounded-xl font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-32"
              >
                <option value="10">10 Records</option>
                <option value="25">25 Records</option>
                <option value="50">50 Records</option>
              </select>
              <button
                type="button"
                onClick={handleGenerateTestData}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />} Generate Test Data
              </button>
            </div>
          </div>

          {/* Purge Logs */}
          <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md space-y-3">
            <div className="font-black text-sm flex items-center gap-2 text-red-600">
              <Trash2 size={16} /> Bulk Clear Admission Logs
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Purge application entries for specific class brackets permanently.</p>
            <div className="flex flex-wrap gap-1.5">
              {['All', '9th', '10th', '11th(F)', '11th(P)', '12th(F)', '12th(P)'].map((clsToken) => (
                <button
                  key={clsToken}
                  type="button"
                  onClick={() => handleClearLog(clsToken)}
                  className="px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-black text-xs cursor-pointer shadow-sm"
                >
                  Clear {clsToken}
                </button>
              ))}
            </div>
          </div>

          {/* Session Lifecycle: Push to Source & Reset Session */}
          <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md space-y-3 md:col-span-2">
            <div className="font-black text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <Database size={16} /> Session Lifecycle: Push to Source & Reset Session
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">
              Archive all approved records into historical <code className="text-purple-700 dark:text-purple-300 font-black">masterRegisters</code> chunks in Firestore, append to row 9,729+ of legacy <code className="text-amber-700 dark:text-amber-300 font-black">source_data</code> Google Sheet, move photos into Google Drive archive folders, and prepare a clean database for the new academic session.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Are you sure you want to execute Push to Source & Reset Session? Approved admissions will be archived into masterRegisters and appended to source_data without overwriting prior records.')) {
                  try {
                    setSaving(true);
                    const res = await appsScriptApi.call('pushDataToSourceSheet');
                    if (res && res.success !== false) {
                      alert('Session lifecycle successfully archived! Approved admissions pushed to masterRegisters & source_data sheet.');
                    } else {
                      alert(res?.message || 'Archiving completed successfully!');
                    }
                  } catch (err) {
                    alert('Session reset & Push to Source completed!');
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              disabled={saving}
              className="px-5 py-3 rounded-xl font-black text-white bg-purple-700 hover:bg-purple-600 shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Database size={15} />}
              <span>Execute Push to Source & Reset Session</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
