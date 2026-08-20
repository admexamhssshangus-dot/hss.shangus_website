import React, { useState, useEffect, useRef } from 'react';
import { Settings, BookOpen, ShieldCheck, Sliders, Save, RefreshCw, CheckCircle2, AlertCircle, Trash2, Wand2, Mail, Plus, X, Database, Sparkles, Copy, Download, UserPlus, Edit3, Lock, ShieldAlert, Check, ArrowRight, Layers, FileCheck } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { loadSiteSettings } from '../../utils/settingsLoader';
import SessionArchivalModal from './SessionArchivalModal';

export const ALL_ADMIN_MODULES = [
  { code: 'reports', label: 'Master Register & Database', desc: 'View, edit, approve student applications & tables' },
  { code: 'controls', label: 'System & Emergency Controls', desc: 'Enable/disable 9th-12th classes, sessions, print settings' },
  { code: 'subjects', label: 'Subject Configuration Rules', desc: 'Configure streams, groups A/B/C, min/max limits' },
  { code: 'gkTest', label: 'GK Test & OMR System', desc: 'Manage GK registrations, admit cards, centers & OMR' },
  { code: 'practicals', label: 'Practicals & Awards', desc: 'Practical marks entry, examiners, awards locking' },
  { code: 'attendanceMgmt', label: 'Attendance Management', desc: 'Class attendance registers, log attendance & reports' },
  { code: 'rollNo', label: 'Roll Number Assignment', desc: 'Auto-assign roll numbers & roll series configuration' },
  { code: 'idCards', label: 'Student ID Cards Studio', desc: 'Generate batch ID Card PDFs & print cards' },
  { code: 'automations', label: 'Email & Automations', desc: 'Group Email Composer, broadcast notifications & logs' },
  { code: 'funds', label: 'Fund & Fee Accounts', desc: 'Fee structures, student fee ledgers & account distribution' },
  { code: 'ingestion', label: 'Direct Ingestion & CSV Import', desc: 'Express student creation & raw CSV data importer' },
  { code: 'adminMgmt', label: 'Admin Permissions Manager', desc: 'Add, edit, or revoke other admin accounts & permissions' },
];

const DEFAULT_ADMIN_USERS = [
  {
    name: 'Sheikh Gulfam (SuperAdmin)',
    email: 'adm.exam.hss.shangus@gmail.com',
    role: 'SuperAdmin',
    perms: ALL_ADMIN_MODULES.map(m => m.code),
  },
  {
    name: 'Sheikh Gulfam (SuperAdmin)',
    email: 'e.educational.24@gmail.com',
    role: 'SuperAdmin',
    perms: ALL_ADMIN_MODULES.map(m => m.code),
  },
  {
    name: 'Nawaz Ahmad Shah (Admin)',
    email: 'shahnawaz@gmail.com',
    role: 'Admin',
    perms: ['reports'],
  },
  {
    name: 'Bilal Ahmad Khandy',
    email: 'bilalhcu@gmail.com',
    role: 'Admin',
    perms: ['reports'],
  },
  {
    name: 'Majid Hassan Najar',
    email: 'majidhassannajar@gmail.com',
    role: 'Admin',
    perms: ['reports'],
  },
];

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
  const getInitialControlsSubTab = () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSubTab = searchParams.get('subtab');
      if (urlSubTab && ['controls', 'subjects', 'permissions', 'lab'].includes(urlSubTab)) return urlSubTab;
      const saved = sessionStorage.getItem('hss_admin_controls_subtab');
      if (saved && ['controls', 'subjects', 'permissions', 'lab'].includes(saved)) return saved;
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

  // Super Admin Tab & Module Permissions State
  const [adminUsers, setAdminUsers] = useState(DEFAULT_ADMIN_USERS);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdminEmail, setEditingAdminEmail] = useState(null);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', role: 'Admin', perms: ['reports', 'attendanceMgmt', 'rollNo', 'idCards'] });
  const [userToDelete, setUserToDelete] = useState(null);

  // LAB Test Data Generator & Session Rollover State
  const [testGenSize, setTestGenSize] = useState('10');
  const [showArchivalModal, setShowArchivalModal] = useState(false);

  // General Loading & Notification States
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Load existing subject config, app settings, and Firestore permissions
  useEffect(() => {
    async function loadConfigs() {
      try {
        const [subjRes, appRes, siteSettings] = await Promise.all([
          appsScriptApi.getSubjectsConfig().catch(() => null),
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
        }
      } catch (e) {}

      // Load Firestore Admin Permissions
      try {
        const permDocRef = doc(db, 'adminSettings', 'permissions');
        const permSnap = await getDoc(permDocRef);
        if (permSnap.exists() && Array.isArray(permSnap.data().users)) {
          setAdminUsers(permSnap.data().users);
        } else {
          const cached = localStorage.getItem('hss_admin_users_permissions_v1');
          if (cached) setAdminUsers(JSON.parse(cached));
        }
      } catch (err) {
        console.warn('Firestore permissions load fallback:', err);
        const cached = localStorage.getItem('hss_admin_users_permissions_v1');
        if (cached) {
          try { setAdminUsers(JSON.parse(cached)); } catch (_) {}
        }
      }
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
        practicalsSubmissionOpen,
        attendanceSubmissionOpen,
        email_submission: emailSubmission,
        email_upgrade_pdf: emailUpgradePdf,
        email_rejection: emailRejection,
        email_reg_otp: emailRegOtp,
        email_reset_otp: emailResetOtp,
      };

      try {
        await setDoc(doc(db, 'site', 'settings'), settings, { merge: true });
        localStorage.setItem('site_settings', JSON.stringify(settings));
      } catch (e) {
        console.warn('Firestore site/settings write note:', e);
      }

      const res = await appsScriptApi.call('saveAppSettings', { settings }).catch(() => null);
      setAlert({ type: 'success', text: 'System controls & emergency settings updated successfully!' });
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

  // Toggle Module Permission for a specific Admin
  const togglePermission = (userEmail, moduleCode) => {
    setAdminUsers((prev) =>
      prev.map((u) => {
        if (u.email.toLowerCase() === userEmail.toLowerCase()) {
          const currentPerms = Array.isArray(u.perms) ? u.perms : [];
          const exists = currentPerms.includes(moduleCode);
          const updatedPerms = exists
            ? currentPerms.filter((p) => p !== moduleCode)
            : [...currentPerms, moduleCode];
          return { ...u, perms: updatedPerms };
        }
        return u;
      })
    );
  };

  // Select / Deselect All Permissions for an Admin
  const setAllPermissionsForUser = (userEmail, enableAll = true) => {
    setAdminUsers((prev) =>
      prev.map((u) => {
        if (u.email.toLowerCase() === userEmail.toLowerCase()) {
          return {
            ...u,
            perms: enableAll ? ALL_ADMIN_MODULES.map((m) => m.code) : []
          };
        }
        return u;
      })
    );
  };

  // Save/Apply Permissions to Firestore & Local Storage
  const handleApplyPermissions = async (updatedList = null) => {
    const listToSave = Array.isArray(updatedList) ? updatedList : adminUsers;
    setSaving(true);
    setAlert(null);
    try {
      // 1. Save to Cloud Firestore
      await setDoc(doc(db, 'adminSettings', 'permissions'), {
        users: listToSave,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Sync to individual user documents in 'users' collection
      for (const u of listToSave) {
        const cleanEmail = u.email.trim().toLowerCase();
        await setDoc(doc(db, 'users', cleanEmail), {
          name: u.name,
          email: cleanEmail,
          role: u.role || 'Admin',
          perms: u.perms || [],
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }

      // 3. Cache locally
      localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(listToSave));

      // 4. Legacy fallback
      appsScriptApi.call('saveAdminPermissions', { users: listToSave }).catch(() => {});

      setAlert({ type: 'success', text: '✨ Super Admin permissions & admin accounts updated successfully in School Database!' });
    } catch (err) {
      console.error('Failed to save permissions to Firestore:', err);
      localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(listToSave));
      setAlert({ type: 'success', text: 'Permissions saved locally!' });
    } finally {
      setSaving(false);
    }
  };

  // Modal Action: Open Add Admin Modal
  const handleOpenAddAdmin = () => {
    setEditingAdminEmail(null);
    setAdminForm({ name: '', email: '', role: 'Admin', perms: ['reports', 'attendanceMgmt', 'rollNo', 'idCards'] });
    setShowAdminModal(true);
  };

  // Modal Action: Open Edit Admin Modal
  const handleOpenEditAdmin = (user) => {
    setEditingAdminEmail(user.email);
    setAdminForm({ name: user.name, email: user.email, role: user.role || 'Admin', perms: Array.isArray(user.perms) ? [...user.perms] : [] });
    setShowAdminModal(true);
  };

  // Save Modal Form (Add or Edit)
  const handleSaveAdminForm = (e) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.email.trim()) {
      alert('Please enter both Full Name and Email Address.');
      return;
    }
    const cleanEmail = adminForm.email.trim().toLowerCase();
    let updated;
    if (editingAdminEmail) {
      updated = adminUsers.map((u) =>
        u.email.toLowerCase() === editingAdminEmail.toLowerCase()
          ? { ...u, name: adminForm.name.trim(), email: cleanEmail, role: adminForm.role, perms: adminForm.perms }
          : u
      );
    } else {
      if (adminUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        alert('An admin account with this email address already exists!');
        return;
      }
      updated = [
        ...adminUsers,
        { name: adminForm.name.trim(), email: cleanEmail, role: adminForm.role, perms: adminForm.perms }
      ];
    }
    setAdminUsers(updated);
    setShowAdminModal(false);
    handleApplyPermissions(updated);
  };

  // Revoke / Delete Admin User
  const handleDeleteAdmin = (email) => {
    if (email.toLowerCase() === 'adm.exam.hss.shangus@gmail.com') {
      alert('Security Protection: The primary Super Admin account cannot be revoked.');
      return;
    }
    const updated = adminUsers.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
    setAdminUsers(updated);
    setUserToDelete(null);
    handleApplyPermissions(updated);
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
      {/* Sleek Standard Sub Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'controls', label: '1. Admission & Controls', icon: Sliders },
          { id: 'subjects', label: '2. Subject Config (v2)', icon: BookOpen },
          { id: 'permissions', label: '3. Admin Permissions', icon: ShieldCheck },
          { id: 'lab', label: '4. Session Lifecycle (Rollover)', icon: Database },
        ].map((sub) => {
          const Icon = sub.icon;
          const isActive = activeSubTab === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => setActiveSubTab(sub.id)}
              className={`py-1.5 px-3 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                isActive
                  ? 'bg-amber-600 text-white border border-amber-700 shadow-sm ring-1 ring-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={13} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
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
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">4 Classes</span>
              </div>

              <div className="space-y-1.5">
                {[
                  { label: 'Class 9th Admissions', val: allow9th, set: setAllow9th },
                  { label: 'Class 10th Admissions', val: allow10th, set: setAllow10th },
                  { label: 'Class 11th Admissions', val: allow11th, set: setAllow11th },
                  { label: 'Class 12th Admissions', val: allow12th, set: setAllow12th },
                ].map((item, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs font-black cursor-pointer transition-all ${
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
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Column 2: Teacher Evaluation Toggles */}
            <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
              <div className="font-black text-xs flex items-center justify-between text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5"><BookOpen size={15} /> Faculty Submissions</span>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full">Portals</span>
              </div>

              <div className="space-y-1.5">
                {[
                  { label: 'Practicals & Marks Entry', val: practicalsSubmissionOpen, set: setPracticalsSubmissionOpen },
                  { label: 'Attendance Management', val: attendanceSubmissionOpen, set: setAttendanceSubmissionOpen },
                ].map((item, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs font-black cursor-pointer transition-all ${
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
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300">Active Academic Session</label>
                <input
                  type="text"
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder="e.g. 2025-26"
                  className="w-full p-2 rounded-xl text-xs font-black border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Column 3: Automated Notifications */}
            <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
              <div className="font-black text-xs flex items-center justify-between text-purple-700 dark:text-purple-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5"><Mail size={15} /> Automated Notifications</span>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full">Email Triggers</span>
              </div>

              <div className="space-y-1.5">
                {[
                  { label: 'Application Submission Email', val: emailSubmission, set: setEmailSubmission },
                  { label: 'Provisional Upgrade PDF Email', val: emailUpgradePdf, set: setEmailUpgradePdf },
                  { label: 'Rejection Notification Email', val: emailRejection, set: setEmailRejection },
                  { label: 'Registration OTP Email', val: emailRegOtp, set: setEmailRegOtp },
                  { label: 'Password Reset OTP Email', val: emailResetOtp, set: setEmailResetOtp },
                ].map((item, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs font-black cursor-pointer transition-all ${
                      item.val
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={item.val}
                      onChange={(e) => item.set(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl font-black text-xs text-white bg-amber-700 hover:bg-amber-600 shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save All System Controls</span>
          </button>
        </form>
      )}

      {/* SUB TAB 2: SUBJECT CONFIGURATION (v2) — ULTRA COMPACT & CLEAN DESIGN */}
      {activeSubTab === 'subjects' && (
        <form onSubmit={handleSaveSubjects} className="space-y-3">
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            
            {/* Header Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <BookOpen size={15} />
                </div>
                <div>
                  <h3 className="font-black text-xs text-slate-900 dark:text-white leading-tight">
                    Subject Configuration Rules (v2)
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold leading-none">
                    Configure compulsory & elective subject pools for admission forms
                  </p>
                </div>
              </div>

              {/* Class & Stream Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Segmented Class Selector */}
                <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black">
                  {['8th', '9th', '10th', '11th', '12th'].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSelectedClass(cls)}
                      className={`px-2.5 py-1 rounded-lg transition-all text-xs font-black cursor-pointer ${
                        selectedClass === cls
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                  className="px-3 py-1 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
                >
                  <option value="General">General Stream</option>
                  <option value="Science">Science Stream</option>
                  <option value="Humanities">Humanities Stream</option>
                  <option value="Commerce">Commerce Stream</option>
                </select>
              </div>
            </div>

            {/* Compact Rules & Numeric Limits Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Min Subjects Required</span>
                <input
                  type="number"
                  value={minSubjects}
                  onChange={(e) => setMinSubjects(e.target.value)}
                  className="w-full py-1 px-2 rounded-lg font-black text-xs text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Max Subjects Required</span>
                <input
                  type="number"
                  value={maxSubjects}
                  onChange={(e) => setMaxSubjects(e.target.value)}
                  className="w-full py-1 px-2 rounded-lg font-black text-xs text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">G1 (Group B) Min / Max</span>
                <div className="flex items-center gap-1">
                  <input type="number" value={g1Min} onChange={(e) => setG1Min(e.target.value)} className="w-full py-1 px-1.5 rounded-lg font-black text-xs text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <span className="text-slate-400 font-bold">-</span>
                  <input type="number" value={g1Max} onChange={(e) => setG1Max(e.target.value)} className="w-full py-1 px-1.5 rounded-lg font-black text-xs text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">G2 (Group C) Min / Max</span>
                <div className="flex items-center gap-1">
                  <input type="number" value={g2Min} onChange={(e) => setG2Min(e.target.value)} className="w-full py-1 px-1.5 rounded-lg font-black text-xs text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <span className="text-slate-400 font-bold">-</span>
                  <input type="number" value={g2Max} onChange={(e) => setG2Max(e.target.value)} className="w-full py-1 px-1.5 rounded-lg font-black text-xs text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                </div>
              </div>
            </div>

            {/* Compact 3-Column Subject Pools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-stretch">
              {/* Group A (Compulsory) */}
              <div className="flex flex-col justify-between p-2.5 rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/30 dark:bg-teal-950/20 space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-teal-800 dark:text-teal-300">
                    <span className="flex items-center gap-1">Group A (Compulsory)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-teal-600 text-white font-black">{groupA.length} Subjects</span>
                  </div>
                  {/* Clean Non-Overflowing Tag Cloud */}
                  <div className="flex flex-wrap items-start gap-1 p-1.5 min-h-[90px] rounded-lg border border-teal-200/60 dark:border-teal-900/40 bg-white dark:bg-slate-900">
                    {groupA.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-600 text-white font-black text-[11px] shadow-2xs">
                        <span>{s}</span>
                        <button type="button" onClick={() => setGroupA(groupA.filter((_, idx) => idx !== i))} className="hover:text-red-200 cursor-pointer ml-0.5"><X size={11} /></button>
                      </span>
                    ))}
                    {groupA.length === 0 && (
                      <span className="text-slate-400 text-[11px] italic font-bold p-1">No compulsory subjects</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 pt-1">
                  <input
                    type="text"
                    value={newSubA}
                    onChange={(e) => setNewSubA(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newSubA.trim()) { setGroupA([...groupA, newSubA.trim()]); setNewSubA(''); } } }}
                    placeholder="Add Compulsory subject..."
                    className="w-full py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => { if (newSubA.trim()) { setGroupA([...groupA, newSubA.trim()]); setNewSubA(''); } }}
                    className="p-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-black cursor-pointer flex-shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Group B (Electives) */}
              <div className="flex flex-col justify-between p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1">Group B (Electives)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-600 text-white font-black">{groupB.length} Subjects</span>
                  </div>
                  {/* Clean Non-Overflowing Tag Cloud */}
                  <div className="flex flex-wrap items-start gap-1 p-1.5 min-h-[90px] rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-white dark:bg-slate-900">
                    {groupB.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-600 text-white font-black text-[11px] shadow-2xs">
                        <span>{s}</span>
                        <button type="button" onClick={() => setGroupB(groupB.filter((_, idx) => idx !== i))} className="hover:text-red-200 cursor-pointer ml-0.5"><X size={11} /></button>
                      </span>
                    ))}
                    {groupB.length === 0 && (
                      <span className="text-slate-400 text-[11px] italic font-bold p-1">No elective subjects</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 pt-1">
                  <input
                    type="text"
                    value={newSubB}
                    onChange={(e) => setNewSubB(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newSubB.trim()) { setGroupB([...groupB, newSubB.trim()]); setNewSubB(''); } } }}
                    placeholder="Add Elective subject..."
                    className="w-full py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => { if (newSubB.trim()) { setGroupB([...groupB, newSubB.trim()]); setNewSubB(''); } }}
                    className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer flex-shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Group C (Vocational & Skill) */}
              <div className="flex flex-col justify-between p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-indigo-800 dark:text-indigo-300">
                    <span className="flex items-center gap-1">Group C (Vocational & Skill)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-600 text-white font-black">{groupC.length} Subjects</span>
                  </div>
                  {/* Clean Non-Overflowing Tag Cloud */}
                  <div className="flex flex-wrap items-start gap-1 p-1.5 min-h-[90px] rounded-lg border border-indigo-200/60 dark:border-indigo-900/40 bg-white dark:bg-slate-900">
                    {groupC.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-black text-[11px] shadow-2xs">
                        <span>{s}</span>
                        <button type="button" onClick={() => setGroupC(groupC.filter((_, idx) => idx !== i))} className="hover:text-red-200 cursor-pointer ml-0.5"><X size={11} /></button>
                      </span>
                    ))}
                    {groupC.length === 0 && (
                      <span className="text-slate-400 text-[11px] italic font-bold p-1">No vocational subjects</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 pt-1">
                  <input
                    type="text"
                    value={newSubC}
                    onChange={(e) => setNewSubC(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newSubC.trim()) { setGroupC([...groupC, newSubC.trim()]); setNewSubC(''); } } }}
                    placeholder="Add Vocational subject..."
                    className="w-full py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => { if (newSubC.trim()) { setGroupC([...groupC, newSubC.trim()]); setNewSubC(''); } }}
                    className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black cursor-pointer flex-shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save Subject Configuration</span>
            </button>

            <button
              type="button"
              onClick={handleExploreCombinations}
              className="px-3.5 py-2 rounded-xl font-black text-xs text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Sparkles size={13} className="text-teal-600 dark:text-teal-400" />
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

      {/* SUB TAB 3: SUPER ADMIN TAB PERMISSIONS & ADMIN ACCOUNT MANAGER */}
      {activeSubTab === 'permissions' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="font-black text-xs text-slate-900 dark:text-white leading-tight">
                    Admin Accounts & Dynamic Permissions
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold leading-none">
                    Configure granular module access for each administrator
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenAddAdmin}
                  className="px-3 py-1.5 rounded-xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                >
                  <UserPlus size={13} />
                  <span>Add Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPermissions()}
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Permissions</span>
                </button>
              </div>
            </div>

            {/* High-Density Admin Users List */}
            <div className="space-y-2.5">
              {adminUsers.map((user, idx) => {
                const isSuper = user.role === 'SuperAdmin' || user.email.toLowerCase() === 'adm.exam.hss.shangus@gmail.com';
                const userPerms = Array.isArray(user.perms) ? user.perms : [];
                const allSelected = ALL_ADMIN_MODULES.every((m) => userPerms.includes(m.code));
                const activeCount = isSuper ? ALL_ADMIN_MODULES.length : userPerms.length;

                return (
                  <div 
                    key={idx} 
                    className="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 space-y-2 hover:border-amber-500/40 transition-all"
                  >
                    {/* Compact Single-Line User Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black ${
                          isSuper 
                            ? 'bg-purple-500/20 text-purple-600 border border-purple-500/30' 
                            : 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                        }`}>
                          {isSuper ? <ShieldCheck size={14} /> : <Lock size={13} />}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-xs font-black text-slate-900 dark:text-white">{user.name}</strong>
                          <span className={`px-2 py-0.2 rounded-full font-black text-[9px] uppercase tracking-wider ${
                            isSuper ? 'bg-purple-600 text-white' : 'bg-amber-600 text-white'
                          }`}>
                            {isSuper ? 'SuperAdmin' : 'Admin'}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">({user.email})</span>
                        </div>
                      </div>

                      {/* Controls & Module Count Badge */}
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          activeCount === ALL_ADMIN_MODULES.length
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {activeCount} / {ALL_ADMIN_MODULES.length} Active
                        </span>

                        <button
                          type="button"
                          onClick={() => setAllPermissionsForUser(user.email, !allSelected)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                        >
                          {allSelected ? 'Clear All' : 'Select All'}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleOpenEditAdmin(user)}
                          title="Edit Admin"
                          className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 cursor-pointer"
                        >
                          <Edit3 size={12} />
                        </button>
                        
                        {!isSuper && (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            title="Revoke Admin"
                            className="p-1 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Compact 4-Column Micro-Chips Ribbon */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                      {ALL_ADMIN_MODULES.map((mod) => {
                        const active = userPerms.includes(mod.code) || isSuper;
                        return (
                          <button
                            key={mod.code}
                            type="button"
                            onClick={() => togglePermission(user.email, mod.code)}
                            title={mod.desc}
                            className={`py-1 px-2 rounded-lg text-left text-[10.5px] transition-all cursor-pointer border flex items-center justify-between ${
                              active
                                ? 'bg-amber-600 text-white border-amber-700 font-black shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-400 font-bold'
                            }`}
                          >
                            <span className="truncate pr-1">{mod.label}</span>
                            {active ? (
                              <Check size={11} className="flex-shrink-0 text-white" />
                            ) : (
                              <Plus size={11} className="opacity-30 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT ADMIN ACCOUNT MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-5 shadow-2xl border border-slate-300 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus size={18} className="text-indigo-600" />
                {editingAdminEmail ? 'Edit Admin Account' : 'Register New Admin Account'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdminForm} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    placeholder="e.g. Nawaz Ahmad Shah"
                    className="w-full p-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingAdminEmail}
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    placeholder="e.g. shahnawaz@gmail.com"
                    className="w-full p-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">Role Type</label>
                  <select
                    value={adminForm.role}
                    onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                    className="w-full p-2.5 rounded-xl text-xs font-black border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="Admin">Standard Admin</option>
                    <option value="SuperAdmin">Super Admin (Full Control)</option>
                  </select>
                </div>

                {/* Module Permissions Checkboxes */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">Granted Feature Modules</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {ALL_ADMIN_MODULES.map((mod) => {
                      const checked = adminForm.perms.includes(mod.code) || adminForm.role === 'SuperAdmin';
                      return (
                        <label
                          key={mod.code}
                          className="flex items-start gap-2.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <input
                            type="checkbox"
                            disabled={adminForm.role === 'SuperAdmin'}
                            checked={checked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...adminForm.perms, mod.code]
                                : adminForm.perms.filter((p) => p !== mod.code);
                              setAdminForm({ ...adminForm, perms: updated });
                            }}
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <span className="text-xs font-black text-slate-900 dark:text-white block">{mod.label}</span>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">{mod.desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-700 text-white hover:bg-indigo-600 shadow-md cursor-pointer"
                >
                  Save Admin Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE / REVOKE ADMIN MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-300 dark:border-slate-800 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-600 border border-rose-500/30 flex items-center justify-center mx-auto font-black">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Revoke Admin Access?</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to revoke admin privileges for <strong className="text-slate-900 dark:text-white">{userToDelete.name}</strong> ({userToDelete.email})?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAdmin(userToDelete.email)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-700 text-white hover:bg-rose-600 shadow-md cursor-pointer"
              >
                Yes, Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: ANNUAL SESSION LIFECYCLE & ROLLOVER */}
      {activeSubTab === 'lab' && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                    Annual Session Lifecycle & Archival Manager
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-0.5">
                    100% Native Firestore Pipeline • Conclude Academic Session & Initialize Next Intake
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Active Session: {session}
              </span>
            </div>

            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              When an academic intake concludes (e.g., in <strong>October</strong>), this utility cleanly packages all approved students with roll numbers from <code className="font-mono font-black text-purple-600 dark:text-purple-400">admissions</code> into permanent, searchable <code className="font-mono font-black text-purple-600 dark:text-purple-400">masterRegisters</code> chunks in Firestore with native Base64 photos preserved. Unsubmitted drafts are cleaned, and admissions intake is reset for the new academic year.
            </p>

            {/* 3 Safety Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-1">
                <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers size={14} className="text-purple-600" />
                  <span>1. Deep Pre-Audit</span>
                </div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Scans all active records and categorizes Approved vs. Drafts vs. Rejected before executing.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-1">
                <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>2. Full Dry-Run Preview</span>
                </div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Inspect the full student table and verify photos before confirming with an explicit verification key.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-1">
                <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileCheck size={14} className="text-blue-600" />
                  <span>3. Pure Firestore Schema</span>
                </div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Zero external Google Drive or Sheets dependencies. Direct atomic batch transactions.
                </p>
              </div>
            </div>

            {/* Launch Action Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle size={13} />
                <span>Zero automatic action: Clicking will only launch the safe analysis & preview modal.</span>
              </div>

              <button
                type="button"
                onClick={() => setShowArchivalModal(true)}
                className="px-4 py-2.5 rounded-xl font-black text-xs text-white bg-purple-700 hover:bg-purple-600 shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <Database size={14} />
                <span>Analyze & Preview Session Archival</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
