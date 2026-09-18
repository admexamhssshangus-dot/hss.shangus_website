import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Settings, BookOpen, ShieldCheck, Sliders, Save, RefreshCw, CheckCircle2, AlertCircle, 
  Trash2, Wand2, Mail, Plus, X, Database, Sparkles, Copy, Download, UserPlus, Edit3, 
  Lock, ShieldAlert, Check, ArrowRight, Layers, FileCheck, FileSpreadsheet, GitMerge, 
  PanelsTopLeft, Send, Key, UserCheck, Phone, GraduationCap, Eye, EyeOff, Search,
  RotateCcw, ArrowUpDown, Pencil, CalendarCheck, ChevronDown, ChevronUp, SlidersHorizontal
} from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { loadSiteSettings } from '../../utils/settingsLoader';
import SessionArchivalModal from './SessionArchivalModal';
import BulkFieldOverwriteModal from './BulkFieldOverwriteModal';
import ConfirmModal from '../components/ConfirmModal';
import { 
  createStaffAccount, 
  updateStaffAccount, 
  sendStaffPasswordReset, 
  deleteStaffAccount,
  clearStaffProfileCache
} from '../../services/staffAuthService';
import { 
  DEFAULT_FEEDER_SCHOOLS, 
  getCachedFeederSchools, 
  loadFeederSchools, 
  saveFeederSchools 
} from '../../utils/feederSchoolsManager';
import { isSuperAdminEmail } from '../../utils/authRoles';
import { logAdminActivity } from '../../services/adminActivityLogger';
import {
  ADMIN_MODULE_CATALOG,
  getModuleMaturity,
} from './adminModuleCatalog';

export const ALL_ADMIN_MODULES = ADMIN_MODULE_CATALOG.map(module => ({
  code: module.id,
  label: module.label,
  desc: module.description,
  maturity: module.maturity,
  maturityNote: module.maturityNote,
}));

const DEFAULT_ADMIN_USERS = [
  {
    name: 'Sheikh Gulfam (SuperAdmin)',
    email: 'adm.exam.hss.shangus@gmail.com',
    role: 'SuperAdmin',
    perms: ALL_ADMIN_MODULES.map(m => m.code),
  },
  {
    name: 'Sheikh Gulfam',
    email: 'e.educational.24@gmail.com',
    role: 'Admin',
    perms: ALL_ADMIN_MODULES.map(m => m.code),
  },
  {
    name: 'Nawaz Ahmad Shah (Admin)',
    email: 'shahnawaz13678@gmail.com',
    role: 'Admin',
    perms: ALL_ADMIN_MODULES.map(m => m.code),
  },
  {
    name: 'Bilal Ahmad Khandy',
    email: 'bilalhcu@gmail.com',
    role: 'Admin',
    perms: ALL_ADMIN_MODULES.map(m => m.code),
  },
  {
    name: 'Majid Hassan Najar',
    email: 'majidhassannajar@gmail.com',
    role: 'Admin',
    perms: ALL_ADMIN_MODULES.map(m => m.code),
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
    groupB: ['Biology', 'Mathematics'],
    groupC: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 2, g2Min: 0, g2Max: 1
  },
  '12th_Science': {
    groupA: ['General English', 'Physics', 'Chemistry'],
    groupB: ['Biology', 'Mathematics'],
    groupC: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 2, g2Min: 0, g2Max: 1
  },
  '11th_Humanities': {
    groupA: ['General English'],
    groupB: ['Urdu', 'Education', 'Economics', 'History', 'Political Science', 'Mathematics'],
    groupC: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 3, g1Max: 4, g2Min: 0, g2Max: 1
  },
  '12th_Humanities': {
    groupA: ['General English'],
    groupB: ['Urdu', 'Education', 'Economics', 'History', 'Political Science', 'Mathematics'],
    groupC: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'],
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
      if (urlSubTab && ['controls', 'subjects', 'schools', 'permissions', 'lab'].includes(urlSubTab)) return urlSubTab;
      const saved = sessionStorage.getItem('hss_admin_controls_subtab');
      if (saved && ['controls', 'subjects', 'schools', 'permissions', 'lab'].includes(saved)) return saved;
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

  // Staff Permissions Dropdown Checkbox State
  const [openDropdownUser, setOpenDropdownUser] = useState(null);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const toggleModulesDropdown = (email) => {
    setOpenDropdownUser(prev => prev === email ? null : email);
    setDropdownSearch('');
  };

  const filteredModules = useMemo(() => {
    if (!dropdownSearch.trim()) return ALL_ADMIN_MODULES;
    const q = dropdownSearch.toLowerCase().trim();
    return ALL_ADMIN_MODULES.filter(m => 
      m.label.toLowerCase().includes(q) || 
      m.code.toLowerCase().includes(q) || 
      (m.desc && m.desc.toLowerCase().includes(q))
    );
  }, [dropdownSearch]);

  // Settings & Controls States
  const [session, setSession] = useState('2025-26');
  const [printOrder, setPrintOrder] = useState('Newest');
  const [logoUrl, setLogoUrl] = useState('https://raw.githubusercontent.com/ShGulfam/hss.shangus_exam_2024-25/refs/heads/main/hss%20shangus_logo_2024_small.png');
  const [rawSiteSettings, setRawSiteSettings] = useState(null);
  
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

  // Master Student Data & Board Ingestion Hub States
  const [showMasterHubModal, setShowMasterHubModal] = useState(false);
  const [masterHubInitialMode, setMasterHubInitialMode] = useState('overwrite');
  const strict3PointMatching = true;
  const [allowExpressZeroRestrictions, setAllowExpressZeroRestrictions] = useState(false);
  const enable30DayRollback = true;

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
  const [staffRoleFilter, setStaffRoleFilter] = useState('all'); // 'all' | 'admin' | 'teacher'
  const [sendingResetFor, setSendingResetFor] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [editingAdminEmail, setEditingAdminEmail] = useState(null);
  const [adminForm, setAdminForm] = useState({ 
    name: '', 
    email: '', 
    role: 'Admin', 
    perms: ['reports'],
    subject: '',
    mobile: '',
    password: '',
    sendSetupEmail: true
  });
  const [userToDelete, setUserToDelete] = useState(null);

  // Feeder Schools Master Directory State
  const [feederSchools, setFeederSchools] = useState(() => getCachedFeederSchools());
  const [newSchoolName, setNewSchoolName] = useState('');
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [editingSchoolIndex, setEditingSchoolIndex] = useState(null);
  const [editingSchoolValue, setEditingSchoolValue] = useState('');
  const [savingSchools, setSavingSchools] = useState(false);

  // LAB Test Data Generator & Session Rollover State
  const [testGenSize, setTestGenSize] = useState('10');
  const [showArchivalModal, setShowArchivalModal] = useState(false);

  // General Loading & Notification States
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);

  // Load existing subject config, app settings, and Firestore permissions
  useEffect(() => {
    async function loadConfigs() {
      try {
        loadFeederSchools().then((schools) => {
          if (Array.isArray(schools) && schools.length > 0) {
            setFeederSchools(schools);
          }
        });

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
          setRawSiteSettings(siteSettings);
          if (siteSettings.session) setSession(siteSettings.session);
          if (siteSettings.practicalsSubmissionOpen !== undefined) setPracticalsSubmissionOpen(Boolean(siteSettings.practicalsSubmissionOpen));
          if (siteSettings.attendanceSubmissionOpen !== undefined) setAttendanceSubmissionOpen(Boolean(siteSettings.attendanceSubmissionOpen));

          // Populate annual session cutoff date
          if (siteSettings.annualRolloverCutoff) {
            const m = siteSettings.annualRolloverCutoff.rolloverMonth ?? siteSettings.annualRolloverCutoff.month;
            const d = siteSettings.annualRolloverCutoff.rolloverDay ?? siteSettings.annualRolloverCutoff.day;
            if (m !== undefined) setRolloverMonth(Number(m));
            if (d !== undefined) setRolloverDay(Number(d));
          }

          // Populate class admission toggles
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

          // Populate automated email triggers
          if (siteSettings.email_submission !== undefined) setEmailSubmission(Boolean(siteSettings.email_submission));
          if (siteSettings.email_upgrade_pdf !== undefined) setEmailUpgradePdf(Boolean(siteSettings.email_upgrade_pdf));
          if (siteSettings.email_rejection !== undefined) setEmailRejection(Boolean(siteSettings.email_rejection));
          if (siteSettings.email_reg_otp !== undefined) setEmailRegOtp(Boolean(siteSettings.email_reg_otp));
          if (siteSettings.email_reset_otp !== undefined) setEmailResetOtp(Boolean(siteSettings.email_reset_otp));

          // Populate Master Student Data Hub Settings
          if (siteSettings.allowExpressZeroRestrictions !== undefined) setAllowExpressZeroRestrictions(Boolean(siteSettings.allowExpressZeroRestrictions));
        }
      } catch (e) {}

      // Load Firestore Subjects Configuration
      try {
        const snap = await getDocs(collection(db, 'subjectsConfig'));
        if (!snap.empty) {
          const loadedMap = { ...INITIAL_SUBJECT_MAP };
          snap.docs.forEach(docSnap => {
            const d = docSnap.data();
            const cls = d.Class || d.className || d.class;
            const stream = d.Stream || d.stream || 'General';
            if (cls) {
              const k = `${cls}_${stream}`;
              loadedMap[k] = {
                groupA: d.groupA || d.compulsory || d['Compulsory Subjects'] || [],
                groupB: d.groupB || d.group1 || d['Group1 Options'] || [],
                groupC: d.groupC || d.group2 || d['Group2 Options'] || [],
                minSubjects: d.minSubjects !== undefined ? Number(d.minSubjects) : 5,
                maxSubjects: d.maxSubjects !== undefined ? Number(d.maxSubjects) : 6,
                g1Min: d.g1Min !== undefined ? Number(d.g1Min) : (d['G1 Min'] !== undefined ? Number(d['G1 Min']) : 1),
                g1Max: d.g1Max !== undefined ? Number(d.g1Max) : (d['G1 Max'] !== undefined ? Number(d['G1 Max']) : 1),
                g2Min: d.g2Min !== undefined ? Number(d.g2Min) : (d['G2 Min'] !== undefined ? Number(d['G2 Min']) : 0),
                g2Max: d.g2Max !== undefined ? Number(d.g2Max) : (d['G2 Max'] !== undefined ? Number(d['G2 Max']) : 1),
              };
            }
          });
          setSubjectConfigMap(loadedMap);
          try {
            localStorage.setItem('hss_subject_config_map_v2', JSON.stringify(loadedMap));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Firestore subjectsConfig load note:', err);
      }

      // Load Firestore Admin Permissions & Staff
      try {
        const permDocRef = doc(db, 'adminSettings', 'permissions');
        const permSnap = await getDoc(permDocRef);
        let loadedList = [];
        if (permSnap.exists() && Array.isArray(permSnap.data().users)) {
          loadedList = permSnap.data().users;
        } else {
          const cached = localStorage.getItem('hss_admin_users_permissions_v1');
          if (cached) loadedList = JSON.parse(cached);
          else loadedList = DEFAULT_ADMIN_USERS;
        }

        // Normalize core institutional roles & admin emails
        loadedList = loadedList.map((u) => {
          const clean = String(u.email || '').trim().toLowerCase();
          if (clean === 'shahnawaz@gmail.com') {
            return {
              ...u,
              email: 'shahnawaz13678@gmail.com',
            };
          }
          if (clean === 'adm.exam.hss.shangus@gmail.com') {
            return {
              ...u,
              role: 'SuperAdmin',
              perms: ALL_ADMIN_MODULES.map(m => m.code),
            };
          }
          // Strictly only adm.exam.hss.shangus@gmail.com is SuperAdmin; all others are Admin or Teacher
          if (u.role === 'SuperAdmin') {
            return {
              ...u,
              role: 'Admin',
              perms: Array.isArray(u.perms) && u.perms.length > 0 ? u.perms : ['reports'],
            };
          }
          return u;
        });

        // Also fetch any faculty/teachers from users collection
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          if (!usersSnap.empty) {
            const extraStaff = [];
            usersSnap.docs.forEach((d) => {
              const data = d.data();
              const roleStr = String(data.role || '').toLowerCase();
              if (roleStr === 'teacher' || roleStr === 'faculty' || roleStr === 'staff') {
                const cleanE = String(data.email || '').trim().toLowerCase();
                if (cleanE && !loadedList.some((a) => a.email.toLowerCase() === cleanE) && !extraStaff.some((s) => s.email.toLowerCase() === cleanE)) {
                  extraStaff.push({
                    name: data.name || data.displayName || cleanE.split('@')[0],
                    email: cleanE,
                    role: 'Teacher',
                    perms: data.perms || ['attendanceMgmt', 'practicals'],
                    subject: data.subject || data.teachingSubject || '',
                    teachingSubject: data.teachingSubject || data.subject || '',
                    assignedClasses: Array.isArray(data.assignedClasses) ? data.assignedClasses : (data.assignedClass ? [data.assignedClass] : []),
                    mobile: data.mobile || data.phone || '',
                  });
                }
              }
            });
            setAdminUsers([...loadedList, ...extraStaff]);
          } else {
            setAdminUsers(loadedList);
          }
        } catch (_) {
          setAdminUsers(loadedList);
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
        actionTitle: 'Updated System Controls & Academic Settings',
        details: `Updated system controls: Session=${session}, 11th Adm=${allow11th ? 'OPEN' : 'CLOSED'}, 12th Adm=${allow12th ? 'OPEN' : 'CLOSED'}`,
        metadata: { session, allow11th, allow12th, allow9th, allow10th }
      });
      setAlert({ type: 'success', text: 'System controls & emergency settings updated successfully!' });
    } catch (err) {
      setAlert({ type: 'error', text: `Settings were not saved: ${err.message || 'Please retry.'}` });
    } finally {
      setSaving(false);
    }
  };

  // Dedicated Save Handler for Rollover Cutoff Schedule (Tab 5)
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
      setAlert({ type: 'success', text: `Annual session rollover cutoff updated to ${formattedDate}!` });
    } catch (err) {
      setAlert({ type: 'error', text: `Failed to save cutoff schedule: ${err.message}` });
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
    // Save directly to Firestore collection 'subjectsConfig' for instant global sync
    try {
      await setDoc(doc(db, 'subjectsConfig', `${selectedClass}_${selectedStream}`), {
        Class: selectedClass,
        Stream: selectedStream,
        compulsory: groupA,
        group1: groupB,
        group2: groupC,
        'Compulsory Subjects': groupA,
        'Group1 Options': groupB,
        'Group2 Options': groupC,
        'G1 Min': parseInt(g1Min, 10),
        'G1 Max': parseInt(g1Max, 10),
        'G2 Min': parseInt(g2Min, 10),
        'G2 Max': parseInt(g2Max, 10),
        minSubjects: parseInt(minSubjects, 10),
        maxSubjects: parseInt(maxSubjects, 10),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSubjectConfigMap(updatedMap);
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Updated Stream Subject Rules',
        details: `Saved subject rules for ${selectedClass} ${selectedStream} (${groupA.length} Compulsory, ${groupB.length} Group 1, ${groupC.length} Group 2)`,
        metadata: { selectedClass, selectedStream, minSubjects, maxSubjects }
      });
      setAlert({ type: 'success', text: `Subject rules saved for ${selectedClass} ${selectedStream}.` });
    } catch (err) {
      setAlert({ type: 'error', text: `Subject rules were not saved: ${err.message}` });
    } finally { setSaving(false); }
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
      // Sanitize list so strictly only adm.exam.hss.shangus@gmail.com is SuperAdmin
      const sanitizedList = listToSave.map((account) => {
        const clean = String(account.email || '').trim().toLowerCase();
        if (clean === 'adm.exam.hss.shangus@gmail.com') {
          return { ...account, role: 'SuperAdmin', perms: ALL_ADMIN_MODULES.map(m => m.code) };
        }
        return {
          ...account,
          role: account.role === 'SuperAdmin' ? 'Admin' : (account.role || 'Admin'),
        };
      });

      // 1. Directly save all accounts to adminSettings/permissions in Firestore
      const permDocRef = doc(db, 'adminSettings', 'permissions');
      await setDoc(permDocRef, { users: sanitizedList, updatedAt: new Date().toISOString() }, { merge: true });
      try {
        localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(sanitizedList));
      } catch (_) {}

      // 2. Synchronize each staff user document in users/{cleanEmail}
      await Promise.all(sanitizedList.map(async (account) => {
        const cleanEmail = String(account.email || '').trim().toLowerCase();
        if (!cleanEmail) return;
        const isSuper = cleanEmail === 'adm.exam.hss.shangus@gmail.com';
        const cleanClasses = Array.isArray(account.assignedClasses)
          ? account.assignedClasses.filter(Boolean)
          : (account.assignedClasses ? [account.assignedClasses] : []);
        try {
          await setDoc(doc(db, 'users', cleanEmail), {
            name: account.name,
            email: cleanEmail,
            role: isSuper ? 'SuperAdmin' : (account.role || 'Admin'),
            perms: isSuper ? ALL_ADMIN_MODULES.map(m => m.code) : (account.perms || []),
            subject: account.subject || '',
            teachingSubject: account.subject || '',
            assignedClasses: cleanClasses,
            mobile: account.mobile || '',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (syncErr) {
          console.warn(`Sync user ${cleanEmail} note:`, syncErr);
        }
      }));

      clearStaffProfileCache();
      setAlert({ type: 'success', text: '✨ Staff permissions & accounts updated successfully in School Database!' });
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Updated Staff Account Permissions',
        details: `Updated administrative permissions and module access matrix for ${listToSave.length} staff accounts`,
        metadata: { staffCount: listToSave.length }
      });
    } catch (err) {
      console.error('Failed to save permissions to Firestore:', err);
      setAlert({ type: 'error', text: `Permissions were not fully saved: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Modal Action: Open Add Admin/Staff Modal
  const handleOpenAddAdmin = () => {
    setEditingAdminEmail(null);
    setAdminForm({ 
      name: '', 
      email: '', 
      role: 'Admin', 
      perms: ['reports'],
      subject: '',
      mobile: '',
      password: '',
      sendSetupEmail: true
    });
    setShowAdminModal(true);
  };

  // Modal Action: Open Edit Staff Modal
  const handleOpenEditAdmin = (user) => {
    const cleanEmail = String(user.email || '').trim().toLowerCase();
    const isSuperTarget = cleanEmail === 'adm.exam.hss.shangus@gmail.com';
    setEditingAdminEmail(user.email);
    setAdminForm({ 
      name: user.name || '', 
      email: user.email || '', 
      role: isSuperTarget ? 'SuperAdmin' : (user.role === 'Teacher' ? 'Teacher' : 'Admin'), 
      perms: Array.isArray(user.perms) ? [...user.perms] : ['reports'],
      subject: user.subject || '',
      assignedClasses: user.assignedClasses || [],
      mobile: user.mobile || '',
      password: '',
      sendSetupEmail: false
    });
    setShowAdminModal(true);
  };

  // 1-Click Send Password Setup / Reset Link
  const handleSendPasswordReset = async (userEmail) => {
    const cleanEmail = String(userEmail || '').trim().toLowerCase();
    if (!cleanEmail) return;
    setSendingResetFor(cleanEmail);
    try {
      const res = await sendStaffPasswordReset(cleanEmail);
      setAlert({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
    } catch (err) {
      setAlert({
        type: 'error',
        text: `Failed to trigger reset email: ${err.message || err}`,
      });
    } finally {
      setSendingResetFor(null);
    }
  };

  // Save Modal Form (Add or Edit with full Firestore & Auth sync)
  const handleSaveAdminForm = async (e) => {
    e.preventDefault();
    setModalError(null);
    if (!adminForm.name.trim() || !adminForm.email.trim()) {
      setModalError('Please enter both Full Name and Email Address.');
      return;
    }
    if (adminForm.role === 'Teacher' && !adminForm.subject.trim()) {
      setModalError('Please specify the Assigned Teaching Subject for this faculty member.');
      return;
    }
    const cleanEmail = adminForm.email.trim().toLowerCase();
    setSaving(true);

    try {
      if (editingAdminEmail) {
        const resolvedRole = cleanEmail === 'adm.exam.hss.shangus@gmail.com' 
          ? 'SuperAdmin' 
          : (adminForm.role === 'Teacher' ? 'Teacher' : 'Admin');

        // Update existing staff profile and email address
        await updateStaffAccount({
          oldEmail: editingAdminEmail,
          newEmail: cleanEmail,
          name: adminForm.name,
          role: resolvedRole,
          perms: adminForm.perms,
          subject: adminForm.subject,
          assignedClasses: adminForm.assignedClasses || [],
          mobile: adminForm.mobile,
          sendResetEmail: adminForm.sendSetupEmail,
          password: adminForm.password,
        });

        const updated = adminUsers.map((u) =>
          u.email.toLowerCase() === editingAdminEmail.toLowerCase()
            ? { 
                ...u, 
                name: adminForm.name.trim(), 
                email: cleanEmail, 
                role: resolvedRole, 
                perms: adminForm.perms,
                subject: adminForm.subject,
          assignedClasses: adminForm.assignedClasses || [],
                mobile: adminForm.mobile
              }
            : u
        );
        setAdminUsers(updated);
        setShowAdminModal(false);
        setAlert({
          type: 'success',
          text: `✨ Staff profile & email (${cleanEmail}) successfully updated in School Database!`,
        });
      } else {
        // Add new staff account
        if (adminUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
          setModalError('A staff account with this email address already exists in the system!');
          setSaving(false);
          return;
        }

        const resolvedRole = cleanEmail === 'adm.exam.hss.shangus@gmail.com' 
          ? 'SuperAdmin' 
          : (adminForm.role === 'Teacher' ? 'Teacher' : 'Admin');

        const res = await createStaffAccount({
          name: adminForm.name,
          email: cleanEmail,
          role: resolvedRole,
          perms: adminForm.perms,
          subject: adminForm.subject,
          assignedClasses: adminForm.assignedClasses || [],
          mobile: adminForm.mobile,
          password: adminForm.password,
          sendSetupEmail: adminForm.sendSetupEmail,
        });

        const updated = [
          ...adminUsers,
          { 
            name: adminForm.name.trim(), 
            email: cleanEmail, 
            role: resolvedRole, 
            perms: adminForm.perms,
            subject: adminForm.subject,
            assignedClasses: adminForm.assignedClasses || [],
            mobile: adminForm.mobile
          }
        ];
        setAdminUsers(updated);
        setShowAdminModal(false);
        setAlert({
          type: 'success',
          text: `✨ ${res.message || `Account for ${adminForm.name} configured in Firebase database!`}`,
        });
      }
    } catch (err) {
      console.error('Error saving staff account:', err);
      setModalError('Failed to save staff account: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Revoke / Delete Admin or Teacher Account
  const handleDeleteAdmin = async (email) => {
    const cleanEmail = email.toLowerCase();
    if (cleanEmail === 'adm.exam.hss.shangus@gmail.com') {
      setAlert({ type: 'error', text: 'Security Protection: Master Super Administrator account cannot be revoked.' });
      return;
    }
    setSaving(true);
    try {
      await deleteStaffAccount(cleanEmail);
      const updated = adminUsers.filter((u) => u.email.toLowerCase() !== cleanEmail);
      setAdminUsers(updated);
      setUserToDelete(null);
      setAlert({ type: 'success', text: `Access revoked and profile removed for ${email}.` });
    } catch (err) {
      console.error('Error revoking staff account:', err);
      setAlert({ type: 'error', text: 'Failed to revoke access: ' + (err.message || err) });
    } finally {
      setSaving(false);
    }
  };

  // Feeder Schools Directory Management Handlers
  const handleAddSchool = (e) => {
    e?.preventDefault();
    const clean = newSchoolName.trim();
    if (!clean) return;

    if (feederSchools.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setAlert({ type: 'error', text: `School "${clean}" already exists in the directory.` });
      return;
    }

    const updated = [...feederSchools, clean];
    setFeederSchools(updated);
    setNewSchoolName('');
    saveFeederSchools(updated);
    setAlert({ type: 'success', text: `Added "${clean}" to feeder schools directory!` });
  };

  const handleStartEditSchool = (index, currentName) => {
    setEditingSchoolIndex(index);
    setEditingSchoolValue(currentName);
  };

  const handleSaveEditSchool = (index) => {
    const clean = editingSchoolValue.trim();
    if (!clean) return;

    const exists = feederSchools.some((s, idx) => idx !== index && s.toLowerCase() === clean.toLowerCase());
    if (exists) {
      setAlert({ type: 'error', text: `School "${clean}" already exists in the list.` });
      return;
    }

    const updated = [...feederSchools];
    updated[index] = clean;
    setFeederSchools(updated);
    setEditingSchoolIndex(null);
    setEditingSchoolValue('');
    saveFeederSchools(updated);
    setAlert({ type: 'success', text: `Updated school name to "${clean}"!` });
  };

  const handleDeleteSchool = (index, name) => {
    setConfirmModalConfig({
      type: 'danger',
      title: 'Remove Feeder School',
      message: `Remove "${name}" from the feeder schools list?`,
      confirmText: 'Remove School',
      onConfirm: () => {
        setConfirmModalConfig(null);
        const updated = feederSchools.filter((_, idx) => idx !== index);
        setFeederSchools(updated);
        saveFeederSchools(updated);
        setAlert({ type: 'success', text: `Removed "${name}" from feeder schools.` });
      }
    });
  };

  const handleSortSchools = () => {
    const sorted = [...feederSchools].sort((a, b) => a.localeCompare(b));
    setFeederSchools(sorted);
    saveFeederSchools(sorted);
    setAlert({ type: 'success', text: `Sorted ${sorted.length} schools alphabetically (A-Z)!` });
  };

  const handleResetDefaultSchools = () => {
    setConfirmModalConfig({
      type: 'warning',
      title: 'Reset Feeder Schools',
      message: 'Reset the feeder schools list to the standard 44 valley schools? Any custom additions will be restored to defaults.',
      confirmText: 'Reset to Defaults',
      onConfirm: () => {
        setConfirmModalConfig(null);
        setFeederSchools(DEFAULT_FEEDER_SCHOOLS);
        saveFeederSchools(DEFAULT_FEEDER_SCHOOLS);
        setAlert({ type: 'success', text: 'Feeder schools list reset to standard defaults (44 schools)!' });
      }
    });
  };

  const handleSyncSchoolsToCloud = async () => {
    setSavingSchools(true);
    try {
      await saveFeederSchools(feederSchools);
      setAlert({ type: 'success', text: `Successfully synced ${feederSchools.length} feeder schools with the central database!` });
    } catch (err) {
      setAlert({ type: 'error', text: 'Failed to sync feeder schools to database.' });
    } finally {
      setSavingSchools(false);
    }
  };

  const displayedSchools = useMemo(() => {
    const term = schoolSearchTerm.trim().toLowerCase();
    const mapped = feederSchools.map((school, originalIndex) => ({ school, originalIndex }));
    if (!term) return mapped;
    return mapped.filter(({ school }) => school.toLowerCase().includes(term));
  }, [feederSchools, schoolSearchTerm]);

  // Generate Test Data
  const handleGenerateTestData = () => {
    setConfirmModalConfig({
      type: 'info',
      title: 'Generate Test Applications',
      message: `Generate ${testGenSize} test student admission records?`,
      confirmText: 'Generate Data',
      onConfirm: async () => {
        setConfirmModalConfig(null);
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
      }
    });
  };

  // Clear Log
  const handleClearLog = (clsToken) => {
    setConfirmModalConfig({
      type: 'danger',
      title: 'Purge Admission Logs',
      message: `Are you sure you want to purge logs for ${clsToken}? This action is permanent and cannot be undone.`,
      confirmText: 'Purge Logs',
      onConfirm: async () => {
        setConfirmModalConfig(null);
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
      }
    });
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
      {/* Sleek Sub Navigation Bar with Horizontal Swipe on Mobile */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'controls', label: '1. Admission Controls', shortLabel: '1. Controls', icon: Sliders },
          { id: 'subjects', label: '2. Subjects & Streams', shortLabel: '2. Subjects', icon: BookOpen },
          { id: 'schools', label: '3. Feeder Schools', shortLabel: '3. Feeders', icon: GraduationCap },
          { id: 'permissions', label: '4. Staff & Permissions', shortLabel: '4. Permissions', icon: ShieldCheck },
          { id: 'lab', label: '5. Session Rollover', shortLabel: '5. Sessions', icon: Database },
        ].map((sub) => {
          const Icon = sub.icon;
          const isActive = activeSubTab === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => setActiveSubTab(sub.id)}
              className={`py-1 px-2 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl font-black text-[10.5px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 shadow-2xs ${
                isActive
                  ? 'bg-amber-600 text-white border border-amber-700 shadow-sm ring-1 ring-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={12} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
              <span className="sm:hidden">{sub.shortLabel}</span>
              <span className="hidden sm:inline">{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB TAB 1: CONTROLS & EMERGENCY TOGGLES */}
      {activeSubTab === 'controls' && (
        <form onSubmit={handleSaveControls} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Column 1: Admission Status (Open / Close) */}
            <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
              <div className="font-black text-xs flex items-center justify-between text-amber-700 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5"><Sliders size={14} /> Class Admission Controls</span>
                <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">4 Classes</span>
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
                <span className="flex items-center gap-1.5"><BookOpen size={14} /> Faculty Submissions</span>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">Portals</span>
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

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <label className="block text-[10.5px] font-black uppercase text-slate-600 dark:text-slate-400">Active Academic Session</label>
                <input
                  type="text"
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder="e.g. 2025-26"
                  className="w-full p-2 rounded-xl text-xs font-black border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* Column 3: Automated Notifications */}
            <div className="p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
              <div className="font-black text-xs flex items-center justify-between text-purple-700 dark:text-purple-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5"><Mail size={14} /> Automated Notifications</span>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">Email Triggers</span>
              </div>

              <div className="space-y-1.5">
                {[
                  { label: 'Application Submission Email', val: emailSubmission, set: setEmailSubmission },
                  { label: 'Provisional Upgrade PDF Email', val: emailUpgradePdf, set: setEmailUpgradePdf },
                  { label: 'Rejection Notification Email', val: emailRejection, set: setEmailRejection },
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

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5"><Key size={13} className="text-teal-600" /> Account Security</span>
                    <span className="text-[9.5px] bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-black px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">Direct Auth</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Student registration verification & password reset links are issued directly via Firebase Authentication.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Master Student Data & Board Ingestion Control Center Card */}
          <div className="p-3 sm:p-3.5 rounded-2xl border border-emerald-300 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/60 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Database size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-xs text-slate-900 dark:text-white leading-tight">Master Student Data & Board Ingestion Hub</h4>
                    <span className="text-[9px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Board Records & Sync</span>
                  </div>
                  <p className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Board overwrites, spreadsheet sync, express intake, and document OCR
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setMasterHubInitialMode('overwrite');
                    setShowMasterHubModal(true);
                  }}
                  className="px-2.5 py-1.5 sm:py-1 rounded-xl font-black text-xs text-white bg-emerald-700 hover:bg-emerald-600 shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <FileSpreadsheet size={12} />
                  <span>Bulk Overwrite</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMasterHubInitialMode('express');
                    setShowMasterHubModal(true);
                  }}
                  className="px-2.5 py-1.5 sm:py-1 rounded-xl font-black text-xs text-white bg-blue-600 hover:bg-blue-500 shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <UserPlus size={12} />
                  <span>Express Entry</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMasterHubInitialMode('gazette_ai');
                    setShowMasterHubModal(true);
                  }}
                  className="px-2.5 py-1.5 sm:py-1 rounded-xl font-black text-xs text-white bg-purple-600 hover:bg-purple-500 shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Sparkles size={12} />
                  <span>Gazette AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMasterHubInitialMode('admit_ai');
                    setShowMasterHubModal(true);
                  }}
                  className="px-2.5 py-1.5 sm:py-1 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <FileCheck size={12} />
                  <span>Admit Card AI</span>
                </button>
              </div>
            </div>

            {/* Governance Policy Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
              <label className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                <div className="pr-2">
                  <div className="font-black text-xs text-slate-900 dark:text-white">Strict 3-Point Matching</div>
                  <div className="text-[10px] text-slate-400 font-normal">Session, Class & Reg No.</div>
                </div>
                <input
                  type="checkbox"
                  checked={strict3PointMatching}
                  readOnly disabled aria-label="Required protection"
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs">
                <div className="pr-2">
                  <div className="font-black text-xs text-slate-900 dark:text-white">Express Admin Ingestion</div>
                  <div className="text-[10px] text-slate-400 font-normal">Privileged single-record entry</div>
                </div>
                <input
                  type="checkbox"
                  checked={allowExpressZeroRestrictions}
                  onChange={(e) => setAllowExpressZeroRestrictions(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                <div className="pr-2">
                  <div className="font-black text-xs text-slate-900 dark:text-white">Rollback Protection</div>
                  <div className="text-[10px] text-slate-400 font-normal">Pre-update snapshot preservation</div>
                </div>
                <input
                  type="checkbox"
                  checked={enable30DayRollback}
                  readOnly disabled aria-label="Required protection"
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 shrink-0"
                />
              </label>
            </div>

            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-500 dark:text-slate-400 px-1 pt-0.5 flex-wrap gap-2">
              <span>Cohort Session: <strong className="text-slate-800 dark:text-slate-200 font-mono">{session}</strong></span>
              <span>Supported: <strong className="text-slate-800 dark:text-slate-200">Classes 9th–12th</strong></span>
              <span>Schema: <strong className="text-emerald-700 dark:text-emerald-400">40+ Core Fields & Results</strong></span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl font-black text-xs text-white bg-amber-700 hover:bg-amber-600 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            <span>Save All System Controls</span>
          </button>
        </form>
      )}

      {/* SUB TAB 2: SUBJECT CONFIGURATION — COMPACT & MINIMAL */}
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
                    Subject Configuration Rules
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

            {/* Dynamic Sync Notice */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] font-bold text-amber-900 dark:text-amber-200">
              <Sparkles size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>Subject pools configured below dynamically propagate to online admission forms, direct entry forms, and curriculum validation.</span>
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

      {/* SUB TAB 3: FEEDER SCHOOLS & INSTITUTES DIRECTORY */}
      {activeSubTab === 'schools' && (
        <div className="space-y-2.5 animate-fadeIn">
          {/* Top Compact Control & Stats Toolbar */}
          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={17} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white tracking-tight">
                    Feeder Schools & Institutes Directory
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {feederSchools.length} Master Institutions
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-xl">
                  Choices available in admission forms with smart search, live abbreviation matching, and instant synchronization.
                </p>
              </div>
            </div>

            {/* Quick Actions Header Buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={handleSortSchools}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Sort A to Z"
              >
                <ArrowUpDown size={12} className="text-indigo-600 dark:text-indigo-400" />
                <span>Sort A-Z</span>
              </button>
              <button
                type="button"
                onClick={handleResetDefaultSchools}
                className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset to 44 standard default schools"
              >
                <RotateCcw size={12} className="text-rose-600 dark:text-rose-400" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={handleSyncSchoolsToCloud}
                disabled={savingSchools}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white text-[11px] font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {savingSchools ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                <span>Sync Cloud</span>
              </button>
            </div>
          </div>

          {/* Unified Compact Add & Search Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            {/* Add School Form (7 cols) */}
            <form onSubmit={handleAddSchool} className="sm:col-span-7 flex items-center gap-1.5 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <input
                type="text"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="Add institution (e.g. Govt High School Shangus)..."
                className="flex-1 px-2.5 py-1 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/60 text-slate-900 dark:text-white rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!newSchoolName.trim()}
                className="px-3 py-1 rounded-lg text-xs font-black bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-all flex-shrink-0"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </form>

            {/* Filter Search Input (5 cols) */}
            <div className="sm:col-span-5 relative flex items-center p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <Search size={13} className="text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={schoolSearchTerm}
                onChange={(e) => setSchoolSearchTerm(e.target.value)}
                placeholder="Quick filter schools..."
                className="w-full pl-7 pr-6 py-1 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/60 text-slate-900 dark:text-white rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {schoolSearchTerm && (
                <button
                  type="button"
                  onClick={() => setSchoolSearchTerm('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* School Directory Cards Grid - 4 Columns for High Density */}
          <div className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
              <span>Showing {displayedSchools.length} of {feederSchools.length} schools</span>
              {schoolSearchTerm && <span>Filtered by &quot;{schoolSearchTerm}&quot;</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[64vh] overflow-y-auto pr-1 scrollbar-thin">
              {displayedSchools.map(({ school, originalIndex }) => {
                const isEditing = editingSchoolIndex === originalIndex;
                return (
                  <div
                    key={originalIndex}
                    className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-1.5 shadow-2xs ${
                      isEditing
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          value={editingSchoolValue}
                          onChange={(e) => setEditingSchoolValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditSchool(originalIndex);
                            if (e.key === 'Escape') setEditingSchoolIndex(null);
                          }}
                          autoFocus
                          className="flex-1 px-2 py-0.5 text-xs font-bold border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-md outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditSchool(originalIndex)}
                          className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow-2xs"
                          title="Save changes"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSchoolIndex(null)}
                          className="p-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 cursor-pointer transition-colors"
                          title="Cancel"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                            {originalIndex + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={school}>
                            {school}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditSchool(originalIndex, school)}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer transition-colors"
                            title="Edit School Name"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchool(originalIndex, school)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer transition-colors"
                            title="Delete School"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {displayedSchools.length === 0 && (
                <div className="col-span-full py-6 text-center text-slate-400 text-xs font-medium">
                  No schools match your search filter &quot;{schoolSearchTerm}&quot;.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: SUPER ADMIN TAB PERMISSIONS & STAFF ACCOUNT MANAGER */}
      {activeSubTab === 'permissions' && (() => {
        const filteredStaff = adminUsers.filter(u => {
          const r = String(u.role || '').toLowerCase();
          if (staffRoleFilter === 'admin') return r.includes('admin');
          if (staffRoleFilter === 'teacher') return r === 'teacher' || r === 'faculty' || r === 'staff';
          return true;
        });

        const adminCount = adminUsers.filter(u => String(u.role || '').toLowerCase().includes('admin')).length;
        const teacherCount = adminUsers.filter(u => {
          const r = String(u.role || '').toLowerCase();
          return r === 'teacher' || r === 'faculty' || r === 'staff';
        }).length;

        return (
          <div className="space-y-2.5 sm:space-y-3">
            <div className="p-2 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5 sm:space-y-3">
              {/* Header Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <ShieldCheck size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                      Staff Accounts & Permissions
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-[11px] font-bold leading-tight line-clamp-1 sm:line-clamp-none">
                      Manage Admins, SuperAdmins, and Faculty permissions
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                  {/* Role Filter Pills */}
                  <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-bold w-full sm:w-auto justify-between sm:justify-start">
                    <button
                      type="button"
                      onClick={() => setStaffRoleFilter('all')}
                      className={`px-2 py-1 rounded-lg cursor-pointer transition-all flex-1 sm:flex-none text-center ${
                        staffRoleFilter === 'all'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      All ({adminUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffRoleFilter('admin')}
                      className={`px-2 py-1 rounded-lg cursor-pointer transition-all flex-1 sm:flex-none text-center ${
                        staffRoleFilter === 'admin'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Admins ({adminCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffRoleFilter('teacher')}
                      className={`px-2 py-1 rounded-lg cursor-pointer transition-all flex-1 sm:flex-none text-center ${
                        staffRoleFilter === 'teacher'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Teachers ({teacherCount})
                    </button>
                  </div>

                  {/* Actions in a single side-by-side row */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleOpenAddAdmin}
                      className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-[10.5px] sm:text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      <UserPlus size={12} className="sm:w-3.5 sm:h-3.5" />
                      <span>Add Staff</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyPermissions()}
                      disabled={saving}
                      className="flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 rounded-xl font-black text-[10.5px] sm:text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-2xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    >
                      {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} className="sm:w-3.5 sm:h-3.5" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Staff Users List */}
              <div className="space-y-1.5 sm:space-y-2">
                {filteredStaff.map((user, idx) => {
                  const cleanEmail = String(user.email || '').trim().toLowerCase();
                  const roleStr = String(user.role || '').toLowerCase();
                  const isSuper = cleanEmail === 'adm.exam.hss.shangus@gmail.com';
                  const isTeacher = roleStr === 'teacher' || roleStr === 'faculty' || roleStr === 'staff';
                  const userPerms = Array.isArray(user.perms) ? user.perms : [];
                  const allSelected = ALL_ADMIN_MODULES.every((m) => userPerms.includes(m.code));
                  const activeCount = isSuper ? ALL_ADMIN_MODULES.length : userPerms.length;
                  const isSendingReset = sendingResetFor === cleanEmail;
                  const isOpen = openDropdownUser === cleanEmail;

                  return (
                    <div 
                      key={idx} 
                      className="p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 hover:border-amber-500/40 transition-all space-y-1.5"
                    >
                      {/* Compact Single-Line User Header */}
                      <div className="flex items-start sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-black shrink-0 ${
                            isSuper 
                              ? 'bg-purple-500/20 text-purple-600 border border-purple-500/30' 
                              : isTeacher
                              ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                          }`}>
                            {isSuper ? <ShieldCheck size={13} /> : isTeacher ? <UserCheck size={13} /> : <Lock size={12} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <strong className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-none">
                                {user.name}
                              </strong>
                              <span className={`px-1.5 py-0.2 rounded-full font-black text-[8.5px] uppercase tracking-wider shrink-0 ${
                                isSuper ? 'bg-purple-600 text-white' : isTeacher ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                              }`}>
                                {isSuper ? 'SuperAdmin' : isTeacher ? 'Teacher' : 'Admin'}
                              </span>
                              {user.subject && (
                                <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0 font-sans">
                                  {user.subject}
                                </span>
                              )}
                            </div>
                            <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono truncate max-w-[200px] sm:max-w-none">
                              {user.email}
                            </div>
                          </div>
                        </div>

                        {/* Controls & Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isTeacher && (
                            <button
                              type="button"
                              onClick={() => toggleModulesDropdown(cleanEmail)}
                              className={`px-2 py-1 rounded-lg text-[9.5px] font-black inline-flex items-center gap-1 cursor-pointer transition-all border ${
                                activeCount === ALL_ADMIN_MODULES.length
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20'
                              }`}
                              title="Click to open module permissions dropdown checklist"
                            >
                              <SlidersHorizontal size={11} className="text-indigo-600 dark:text-indigo-400" />
                              <span>{activeCount}/{ALL_ADMIN_MODULES.length}</span>
                              <ChevronDown size={11} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`} />
                            </button>
                          )}

                          {/* Send Password Setup / Reset Email Button */}
                          <button
                            type="button"
                            onClick={() => handleSendPasswordReset(user.email)}
                            disabled={isSendingReset}
                            title="Send Password Reset Link"
                            className="p-1 sm:px-2 sm:py-1 rounded-lg text-[10px] font-black bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {isSendingReset ? <RefreshCw size={11} className="animate-spin" /> : <Key size={11} />}
                            <span className="hidden md:inline">Reset</span>
                          </button>
                          
                          {/* Edit Staff Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditAdmin(user)}
                            title="Edit Account Details"
                            className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 cursor-pointer"
                          >
                            <Edit3 size={11} />
                          </button>
                          
                          {!isSuper && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(user)}
                              title="Revoke / Delete Account"
                              className="p-1 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Checkbox Panel for Granular Modules */}
                      {!isTeacher && isOpen && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 animate-fadeIn">
                          {/* Dropdown Header Toolbar */}
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ShieldCheck size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                              <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                Module Permissions ({activeCount}/{ALL_ADMIN_MODULES.length})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!isSuper && (
                                <button
                                  type="button"
                                  onClick={() => setAllPermissionsForUser(user.email, !allSelected)}
                                  className="px-2 py-0.5 rounded text-[9.5px] font-black bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                >
                                  {allSelected ? 'Clear All' : 'Select All'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setOpenDropdownUser(null)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 cursor-pointer"
                                title="Close Dropdown"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Quick Search inside Dropdown */}
                          <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search modules (e.g. attendance, exams, reports)..."
                              value={dropdownSearch}
                              onChange={(e) => setDropdownSearch(e.target.value)}
                              className="w-full pl-7 pr-2.5 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                            />
                          </div>

                          {isSuper && (
                            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[10.5px] font-bold flex items-center gap-1.5">
                              <ShieldAlert size={13} className="shrink-0" />
                              <span>SuperAdmins inherently retain global access to all 19 modules by default.</span>
                            </div>
                          )}

                          {/* Scrollable Checkbox Checklist */}
                          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                            {filteredModules.map((mod) => {
                              const checked = userPerms.includes(mod.code) || isSuper;
                              const maturity = getModuleMaturity(mod.maturity);

                              return (
                                <label
                                  key={mod.code}
                                  className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all select-none cursor-pointer ${
                                    checked
                                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 text-indigo-950 dark:text-indigo-100 font-bold'
                                      : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                                  } ${isSuper ? 'cursor-default' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isSuper}
                                    onChange={() => !isSuper && togglePermission(user.email, mod.code)}
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-default shrink-0"
                                  />
                                  <div className="min-w-0 flex-1 leading-tight">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-xs ${checked ? 'font-black' : 'font-semibold'}`}>
                                        {mod.label}
                                      </span>
                                      <span className={`rounded border px-1 py-0.2 text-[7.5px] font-black leading-none ${maturity.badgeClass}`}>
                                        {maturity.label}
                                      </span>
                                    </div>
                                    {mod.desc && (
                                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                        {mod.desc}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}

                            {filteredModules.length === 0 && (
                              <div className="p-4 text-center text-slate-400 text-xs font-bold">
                                No modules match "{dropdownSearch}"
                              </div>
                            )}
                          </div>

                          {/* Dropdown Footer */}
                          <div className="flex items-center justify-between pt-1 text-[10px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-800">
                            <span>Click checkbox to grant or revoke instantly.</span>
                            <button
                              type="button"
                              onClick={() => setOpenDropdownUser(null)}
                              className="px-3 py-1 rounded-md text-[10px] font-black bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer active:scale-95 transition-all"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredStaff.length === 0 && (
                  <div className="p-8 text-center text-slate-500 font-bold text-xs bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                    No staff accounts match the selected role filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ADD / EDIT STAFF & EMAIL ACCOUNT MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-scaleUp">
            {/* Fixed Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-t-3xl flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                  <UserPlus size={19} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                    {editingAdminEmail ? 'Edit Staff Account Profile' : 'Register New Staff Member'}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {editingAdminEmail ? `Updating configuration for ${editingAdminEmail}` : 'Configure credentials & module access'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveAdminForm} className="flex-1 overflow-y-auto flex flex-col justify-between">
              <div className="p-6 space-y-4 text-xs font-semibold">
                {modalError && (
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="text-rose-600 flex-shrink-0" />
                      <span>{modalError}</span>
                    </div>
                    <button type="button" onClick={() => setModalError(null)} className="p-0.5 text-rose-500 hover:text-rose-800 cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                )}
                {/* Full Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={adminForm.name}
                      onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                      placeholder="e.g. Nawaz Ahmad Shah"
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Email (Login ID) <span className="text-rose-500">*</span>
                      </label>
                      {editingAdminEmail && (
                        <span className="text-[9.5px] font-extrabold text-indigo-600 dark:text-indigo-400">
                          Editable (Firebase Auth)
                        </span>
                      )}
                    </div>
                    <input
                      type="email"
                      required
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                      placeholder="staff.member@gmail.com"
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {editingAdminEmail && editingAdminEmail.toLowerCase() !== adminForm.email.toLowerCase() && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-start gap-2">
                    <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>Changing login email from <code className="font-mono text-amber-900 dark:text-amber-200">{editingAdminEmail}</code> to <code className="font-mono text-amber-900 dark:text-amber-200">{adminForm.email}</code> will migrate this staff profile and permissions.</span>
                  </div>
                )}

                {/* Role Type & Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Role Type
                    </label>
                    <select
                      value={adminForm.role}
                      onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/60 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="Admin">Standard Admin</option>
                      {adminForm.email.trim().toLowerCase() === 'adm.exam.hss.shangus@gmail.com' && (
                        <option value="SuperAdmin">Super Admin (Sole Master Authority)</option>
                      )}
                      <option value="Teacher">Teaching Faculty / Subject Teacher</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Mobile / WhatsApp No.
                    </label>
                    <input
                      type="text"
                      value={adminForm.mobile}
                      onChange={(e) => setAdminForm({ ...adminForm, mobile: e.target.value })}
                      placeholder="e.g. 9876543210"
                      maxLength={15}
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Teaching Subject (if Teacher) */}
                {adminForm.role === 'Teacher' && (
                  <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                    <label className="block text-[11px] font-extrabold text-emerald-900 dark:text-emerald-300">
                      Assigned Teaching Subject <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={adminForm.subject}
                      onChange={(e) => setAdminForm({ ...adminForm, subject: e.target.value })}
                      placeholder="e.g. Physics, Chemistry, Biology, Mathematics, Urdu, General English"
                      className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-300 dark:border-emerald-700/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 pt-0.5">
                      Restricts this faculty member to their specific subject practical awards and attendance.
                    </p>
                  </div>
                )}

                {adminForm.role === 'Teacher' && <fieldset className="p-3 border rounded-xl space-y-2">
                  <legend className="text-xs font-bold">Assigned classes</legend>
                  <div className="flex flex-wrap gap-4">{['9th', '10th', '11th', '12th'].map(cls => <label key={cls} className="flex gap-2 text-sm">
                    <input type="checkbox" checked={(adminForm.assignedClasses || []).includes(cls)} onChange={event => setAdminForm(previous => ({ ...previous,
                      assignedClasses: event.target.checked ? [...(previous.assignedClasses || []), cls] : (previous.assignedClasses || []).filter(value => value !== cls) }))} />{cls}
                  </label>)}</div>
                </fieldset>}

                {/* Account Credentials Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-extrabold text-xs">
                    <Lock size={13} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Account Credentials & Login Setup</span>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {editingAdminEmail ? 'Set / Override Password (Optional)' : 'Initial Password (Optional)'}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showPasswordText ? "text" : "password"}
                        value={adminForm.password}
                        onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                        placeholder="Leave blank to let user set up via email link"
                        className="w-full pl-3 pr-10 py-1.5 rounded-xl text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                      {adminForm.password && (
                        <button
                          type="button"
                          onClick={() => setShowPasswordText(!showPasswordText)}
                          className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                          tabIndex={-1}
                          title={showPasswordText ? "Hide password" : "Show password"}
                        >
                          {showPasswordText ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-0.5 select-none">
                    <input
                      type="checkbox"
                      checked={adminForm.sendSetupEmail}
                      onChange={(e) => setAdminForm({ ...adminForm, sendSetupEmail: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Send password setup & activation link to email address
                    </span>
                  </label>
                </div>

                {/* Granted Feature Modules (For Admins & SuperAdmins) */}
                {adminForm.role !== 'Teacher' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>Granted Feature Modules</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold">
                          {adminForm.role === 'SuperAdmin' ? ALL_ADMIN_MODULES.length : adminForm.perms.length}/{ALL_ADMIN_MODULES.length}
                        </span>
                      </label>
                      {adminForm.role !== 'SuperAdmin' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAdminForm({ ...adminForm, perms: ALL_ADMIN_MODULES.map(m => m.code) })}
                            className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => setAdminForm({ ...adminForm, perms: ['reports'] })}
                            className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                            title="Reset to Simple Admin default permissions (Reports & Register only)"
                          >
                            Default (Simple Admin)
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => setAdminForm({ ...adminForm, perms: [] })}
                            className="text-[10px] font-extrabold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </div>

                    {adminForm.role === 'SuperAdmin' ? (
                      <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200 text-xs font-bold flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-600 flex-shrink-0" />
                        <span>Super Admins automatically have unrestricted access to all {ALL_ADMIN_MODULES.length} system modules.</span>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1.5 max-h-52 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 scrollbar-thin">
                        {ALL_ADMIN_MODULES.map((mod) => {
                          const checked = adminForm.perms.includes(mod.code);
                          const maturity = getModuleMaturity(mod.maturity);
                          return (
                            <label
                              key={mod.code}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all select-none cursor-pointer ${
                                checked
                                  ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700/80 shadow-xs ring-1 ring-indigo-400/20'
                                  : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900 opacity-80'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...adminForm.perms, mod.code]
                                    : adminForm.perms.filter((p) => p !== mod.code);
                                  setAdminForm({ ...adminForm, perms: updated });
                                }}
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className={`min-w-0 truncate text-xs leading-tight ${checked ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                                    {mod.label}
                                  </span>
                                  <span
                                    title={mod.maturityNote}
                                    className={`flex-shrink-0 rounded border px-1 py-px text-[7.5px] font-black leading-none tracking-wide ${maturity.badgeClass}`}
                                  >
                                    {maturity.label}
                                  </span>
                                </span>
                                <span className="text-[10.5px] font-normal text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                                  {mod.desc}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fixed Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md rounded-b-3xl flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{editingAdminEmail ? 'Update Staff Account' : 'Save & Configure Account'}</span>
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
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {userToDelete.role === 'Teacher' ? 'Delete Teacher Account?' : 'Revoke Admin Access?'}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                {userToDelete.role === 'Teacher' ? (
                  <>Are you sure you want to delete the teacher account for <strong className="text-slate-900 dark:text-white">{userToDelete.name}</strong> ({userToDelete.email})?</>
                ) : (
                  <>Are you sure you want to revoke admin privileges for <strong className="text-slate-900 dark:text-white">{userToDelete.name}</strong> ({userToDelete.email})?</>
                )}
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
                {userToDelete.role === 'Teacher' ? 'Yes, Delete Account' : 'Yes, Revoke Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 5: ANNUAL SESSION LIFECYCLE & ROLLOVER */}
      {activeSubTab === 'lab' && (
        <div className="space-y-3">
          <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <Database size={15} />
                </div>
                <div>
                  <h3 className="font-black text-xs text-slate-900 dark:text-white leading-tight">
                    Session Lifecycle & Archival Manager
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold leading-none">
                    Archive active intake to Master Registers and transition session
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Active Session: {session}
              </span>
            </div>

            {/* Compact Informational Callout */}
            <p className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-400 leading-normal">
              Packages approved students into permanent, searchable <code className="font-mono font-bold text-purple-600 dark:text-purple-400">masterRegisters</code> in Firestore with photos preserved, clears unsubmitted drafts, and safely transitions active intake to the next academic year.
            </p>

            {/* Cutoff Date Manager with Save Button */}
            <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 font-black text-xs text-purple-950 dark:text-purple-200">
                  <CalendarCheck size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>Annual Rollover Cutoff Schedule</span>
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                    ({rolloverDay} {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][rolloverMonth - 1]})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveRolloverCutoff}
                  disabled={saving}
                  className="px-2.5 py-1 rounded-lg text-xs font-black text-white bg-purple-700 hover:bg-purple-600 active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                  <span>Save Cutoff Date</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 mb-1">
                    Cutoff Month
                  </label>
                  <select
                    value={rolloverMonth}
                    onChange={(e) => setRolloverMonth(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-bold text-xs text-slate-800 dark:text-slate-200"
                  >
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((mName, idx) => (
                      <option key={mName} value={idx + 1}>{mName} (Month {idx + 1})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 mb-1">
                    Cutoff Day of Month
                  </label>
                  <select
                    value={rolloverDay}
                    onChange={(e) => setRolloverDay(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-bold text-xs text-slate-800 dark:text-slate-200"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Day {d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-[10.5px] font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5 pt-0.5">
                <AlertCircle size={12} className="text-amber-600 shrink-0" />
                <span>Controls the date when administrators receive the annual rollover prompt in portal reports.</span>
              </div>
            </div>

            {/* 3 Safety Safeguards (Compact Micro-Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-2">
                <Layers size={15} className="text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-black text-[11px] text-slate-900 dark:text-white block leading-tight">Pre-Audit Scan</span>
                  <span className="text-[10px] text-slate-500 font-medium block truncate">Categorizes Approved, Drafts & Rejected</span>
                </div>
              </div>

              <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-black text-[11px] text-slate-900 dark:text-white block leading-tight">Dry-Run Preview</span>
                  <span className="text-[10px] text-slate-500 font-medium block truncate">Full student table & photo verification</span>
                </div>
              </div>

              <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-2">
                <FileCheck size={15} className="text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-black text-[11px] text-slate-900 dark:text-white block leading-tight">Atomic Transactions</span>
                  <span className="text-[10px] text-slate-500 font-medium block truncate">Native Firestore batch architecture</span>
                </div>
              </div>
            </div>

            {/* Launch Action Button Bar */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <AlertCircle size={12} className="text-amber-500 shrink-0" />
                Zero auto-action: Clicking only launches the safe audit & preview modal.
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
