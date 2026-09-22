import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Lock, UserCheck, Key, Edit3, Trash2, UserPlus, 
  Sparkles, Save, RefreshCw, CheckCircle2, AlertCircle, X, Search,
  SlidersHorizontal, ChevronDown, Eye, EyeOff, Check, Users
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';
import { 
  createStaffAccount, 
  updateStaffAccount, 
  sendStaffPasswordReset, 
  deleteStaffAccount,
  clearStaffProfileCache
} from '../../services/staffAuthService';
import { logAdminActivity } from '../../services/adminActivityLogger';
import {
  ADMIN_MODULE_CATALOG,
  ADMIN_CATEGORIES,
  ROLE_PRESETS,
} from './adminModuleCatalog';

export const ALL_ADMIN_MODULES = ADMIN_MODULE_CATALOG.map(module => ({
  code: module.id,
  label: module.label,
  shortLabel: module.shortLabel,
  desc: module.description,
  category: module.category,
  maturity: module.maturity,
  maturityNote: module.maturityNote,
  isNew: Boolean(module.isNew),
  isQuickAction: Boolean(module.isQuickAction),
}));

// Official School Predefined Subject Catalogues (From Academics Curriculum & Admission System)
export const SECONDARY_SUBJECTS_CATALOGUE = [
  { group: 'Core / Compulsory (Group A)', subjects: ['English', 'Mathematics', 'Science', 'Social Science'] },
  { group: 'Languages (Group B)', subjects: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'] },
  { group: 'Vocational / Applied Skills (Group C)', subjects: ['Healthcare', 'IT and ITES'] },
];

export const HIGHER_SECONDARY_SUBJECTS_CATALOGUE = [
  {
    stream: 'Science Stream',
    groups: [
      { label: 'Compulsory', subjects: ['General English', 'Physics', 'Chemistry'] },
      { label: 'Core Electives', subjects: ['Biology', 'Botany', 'Zoology', 'Mathematics'] },
      { label: 'Applied & Elective', subjects: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'] },
    ]
  },
  {
    stream: 'Humanities / Arts Stream',
    groups: [
      { label: 'Compulsory', subjects: ['General English'] },
      { label: 'Core Electives', subjects: ['Political Science', 'History', 'Economics', 'Education', 'Urdu', 'Mathematics'] },
      { label: 'Applied & Elective', subjects: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'] },
    ]
  },
  {
    stream: 'Commerce Stream',
    groups: [
      { label: 'Compulsory', subjects: ['General English', 'Accountancy', 'Business Studies'] },
      { label: 'Core Electives', subjects: ['Economics', 'Entrepreneurship', 'Mathematics'] },
      { label: 'Applied & Elective', subjects: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'] },
    ]
  },
  {
    stream: 'Vocational & Physical Education',
    groups: [
      { label: 'Skill & Applied Practicals', subjects: ['Physical Education', 'Healthcare', 'IT and ITES'] }
    ]
  }
];

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
    perms: ['reports'],
  },
  {
    name: 'Nawaz Ahmad Shah (Admin)',
    email: 'shahnawaz13678@gmail.com',
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

export default function StaffPermissionsManager() {
  const [adminUsers, setAdminUsers] = useState(DEFAULT_ADMIN_USERS);
  const [staffRoleFilter, setStaffRoleFilter] = useState('all'); // 'all' | 'superadmin' | 'admin' | 'teacher'
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingResetFor, setSendingResetFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Dropdown permissions toggle per user card
  const [openDropdownUser, setOpenDropdownUser] = useState(null);
  const [dropdownSearch, setDropdownSearch] = useState('');

  // Add/Edit Staff Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [editingAdminEmail, setEditingAdminEmail] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [subjectTierTab, setSubjectTierTab] = useState('11th-12th'); // '9th-10th' | '11th-12th'
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  const [adminForm, setAdminForm] = useState({ 
    name: '', 
    email: '', 
    role: 'Admin', 
    designation: '',
    perms: ['reports'],
    subject: '',
    assignedSubjects: [],
    assignedClasses: [],
    mobile: '',
    password: '',
    sendSetupEmail: true
  });

  // Load Staff Accounts from Firestore (adminSettings/permissions & users collections)
  useEffect(() => {
    async function loadStaffAccounts() {
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

        // Normalize core institutional roles & emails
        loadedList = loadedList.map((u) => {
          const clean = String(u.email || '').trim().toLowerCase();
          if (clean === 'shahnawaz@gmail.com') {
            return { ...u, email: 'shahnawaz13678@gmail.com' };
          }
          if (clean === 'adm.exam.hss.shangus@gmail.com') {
            return {
              ...u,
              role: 'SuperAdmin',
              perms: ALL_ADMIN_MODULES.map(m => m.code),
            };
          }
          // Sole SuperAdmin policy
          if (u.role === 'SuperAdmin') {
            return {
              ...u,
              role: 'Admin',
              perms: Array.isArray(u.perms) && u.perms.length > 0 ? u.perms : ['reports'],
            };
          }
          return u;
        });

        // Query users collection for any additional registered faculty/teachers/admins
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          if (!usersSnap.empty) {
            const extraStaff = [];
            usersSnap.docs.forEach((d) => {
              const data = d.data();
              const roleStr = String(data.role || '').toLowerCase();
              const isTeacher = roleStr === 'teacher' || roleStr === 'faculty' || roleStr === 'staff';
              const isAdmin = roleStr === 'admin' || roleStr === 'administrator';
              if (isTeacher || isAdmin) {
                const cleanE = String(data.email || '').trim().toLowerCase();
                if (cleanE && !loadedList.some((a) => a.email.toLowerCase() === cleanE) && !extraStaff.some((s) => s.email.toLowerCase() === cleanE)) {
                  extraStaff.push({
                    name: data.name || data.displayName || cleanE.split('@')[0],
                    email: cleanE,
                    role: isTeacher ? 'Teacher' : 'Admin',
                    designation: data.designation || data.label || '',
                    perms: data.perms || (isTeacher ? ['attendanceMgmt', 'practicals'] : ['reports', 'analyticsReports']),
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
        console.warn('Firestore staff load note:', err);
        const cached = localStorage.getItem('hss_admin_users_permissions_v1');
        if (cached) {
          try { setAdminUsers(JSON.parse(cached)); } catch (_) {}
        }
      }
    }
    loadStaffAccounts();
  }, []);

  const toggleModulesDropdown = (email) => {
    setOpenDropdownUser(prev => prev === email ? null : email);
    setDropdownSearch('');
  };

  const filteredDropdownModules = useMemo(() => {
    if (!dropdownSearch.trim()) return ALL_ADMIN_MODULES;
    const q = dropdownSearch.toLowerCase().trim();
    return ALL_ADMIN_MODULES.filter(m => 
      m.label.toLowerCase().includes(q) || 
      m.code.toLowerCase().includes(q) || 
      (m.desc && m.desc.toLowerCase().includes(q))
    );
  }, [dropdownSearch]);

  // Toggle Module Permission for an individual account
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

  // Save / Apply Permissions to Firestore & Local Storage
  const handleApplyPermissions = async (updatedList = null) => {
    const listToSave = Array.isArray(updatedList) ? updatedList : adminUsers;
    setSaving(true);
    setAlert(null);
    try {
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

      // Save to adminSettings/permissions
      const permDocRef = doc(db, 'adminSettings', 'permissions');
      await setDoc(permDocRef, { users: sanitizedList, updatedAt: new Date().toISOString() }, { merge: true });
      try {
        localStorage.setItem('hss_admin_users_permissions_v1', JSON.stringify(sanitizedList));
      } catch (_) {}

      // Synchronize each user doc in users/{email}
      await Promise.all(sanitizedList.map(async (account) => {
        const cleanEmail = String(account.email || '').trim().toLowerCase();
        if (!cleanEmail) return;
        const isSuper = cleanEmail === 'adm.exam.hss.shangus@gmail.com';
        const cleanClasses = Array.isArray(account.assignedClasses)
          ? account.assignedClasses.filter(Boolean)
          : (account.assignedClasses ? [account.assignedClasses] : []);
        const cleanSubjects = Array.isArray(account.assignedSubjects) && account.assignedSubjects.length > 0
          ? account.assignedSubjects.filter(Boolean)
          : (account.subject ? String(account.subject).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : []);
        const primarySubj = cleanSubjects.join(', ') || account.subject || '';

        try {
          await setDoc(doc(db, 'users', cleanEmail), {
            name: account.name,
            email: cleanEmail,
            role: isSuper ? 'SuperAdmin' : (account.role || 'Admin'),
            designation: account.designation || '',
            perms: isSuper ? ALL_ADMIN_MODULES.map(m => m.code) : (account.perms || []),
            subject: primarySubj,
            teachingSubject: primarySubj,
            assignedSubjects: cleanSubjects,
            assignedClasses: cleanClasses,
            mobile: account.mobile || '',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (syncErr) {
          console.warn(`Sync user ${cleanEmail} note:`, syncErr);
        }
      }));

      clearStaffProfileCache();
      try {
        window.dispatchEvent(new CustomEvent('hss-permissions-updated'));
      } catch (_) {}
      setAlert({ type: 'success', text: '✨ Staff permissions and accounts successfully synchronized in Database!' });
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Updated Staff Account Permissions',
        details: `Updated administrative permissions and module access matrix for ${sanitizedList.length} staff accounts`,
        metadata: { staffCount: sanitizedList.length }
      });
    } catch (err) {
      console.error('Failed to save staff permissions:', err);
      setAlert({ type: 'error', text: `Permissions save note: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddAdmin = () => {
    setEditingAdminEmail(null);
    setAdminForm({ 
      name: '', 
      email: '', 
      role: 'Admin', 
      designation: '',
      perms: ['reports'],
      subject: '',
      assignedSubjects: [],
      assignedClasses: [],
      mobile: '',
      password: '',
      sendSetupEmail: true
    });
    setSubjectTierTab('11th-12th');
    setCustomSubjectInput('');
    setShowAdminModal(true);
  };

  const handleOpenEditAdmin = (user) => {
    const cleanEmail = String(user.email || '').trim().toLowerCase();
    const isSuperTarget = cleanEmail === 'adm.exam.hss.shangus@gmail.com';
    setEditingAdminEmail(user.email);

    // Normalize existing assigned subjects from array or delimited string
    const existingSubjects = Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0
      ? user.assignedSubjects
      : (user.subject || user.teachingSubject || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean);

    setAdminForm({ 
      name: user.name || '', 
      email: user.email || '', 
      role: isSuperTarget ? 'SuperAdmin' : (user.role === 'Teacher' ? 'Teacher' : 'Admin'), 
      designation: user.designation || user.label || '',
      perms: Array.isArray(user.perms) ? [...user.perms] : ['reports'],
      subject: existingSubjects.join(', '),
      assignedSubjects: existingSubjects,
      assignedClasses: Array.isArray(user.assignedClasses) ? [...user.assignedClasses] : (user.assignedClass ? [user.assignedClass] : []),
      mobile: user.mobile || '',
      password: '',
      sendSetupEmail: false
    });

    const hasSec = Array.isArray(user.assignedClasses) && user.assignedClasses.some(c => c.includes('9') || c.includes('10'));
    const hasHr = Array.isArray(user.assignedClasses) && user.assignedClasses.some(c => c.includes('11') || c.includes('12'));
    if (hasSec && !hasHr) {
      setSubjectTierTab('9th-10th');
    } else {
      setSubjectTierTab('11th-12th');
    }
    setCustomSubjectInput('');
    setShowAdminModal(true);
  };

  const handleSendPasswordReset = async (userEmail) => {
    const cleanEmail = String(userEmail || '').trim().toLowerCase();
    if (!cleanEmail) return;
    setSendingResetFor(cleanEmail);
    try {
      const res = await sendStaffPasswordReset(cleanEmail);
      setAlert({
        type: res.success ? 'success' : 'error',
        text: res.message || `✨ Password reset email successfully sent to ${cleanEmail}.`,
      });
    } catch (err) {
      setAlert({
        type: 'error',
        text: `Failed to send password reset: ${err.message || err}`,
      });
    } finally {
      setSendingResetFor(null);
    }
  };

  const handleSaveAdminForm = async (e) => {
    e.preventDefault();
    setModalError(null);
    if (!adminForm.name.trim() || !adminForm.email.trim()) {
      setModalError('Please enter both Full Name and Email Address.');
      return;
    }

    const cleanSubjects = Array.isArray(adminForm.assignedSubjects) && adminForm.assignedSubjects.length > 0
      ? adminForm.assignedSubjects.map(s => String(s || '').trim()).filter(Boolean)
      : (adminForm.subject ? String(adminForm.subject).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : []);
    const primarySubject = cleanSubjects.join(', ');

    if (adminForm.role === 'Teacher' && cleanSubjects.length === 0) {
      setModalError('Please select or add at least one Assigned Teaching Subject for this faculty member.');
      return;
    }
    const cleanEmail = adminForm.email.trim().toLowerCase();
    setSaving(true);

    try {
      if (editingAdminEmail) {
        const resolvedRole = cleanEmail === 'adm.exam.hss.shangus@gmail.com' 
          ? 'SuperAdmin' 
          : (adminForm.role === 'Teacher' ? 'Teacher' : 'Admin');

        await updateStaffAccount({
          oldEmail: editingAdminEmail,
          newEmail: cleanEmail,
          name: adminForm.name,
          role: resolvedRole,
          designation: adminForm.designation?.trim() || '',
          perms: adminForm.perms,
          subject: primarySubject,
          assignedSubjects: cleanSubjects,
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
                designation: adminForm.designation?.trim() || '',
                perms: adminForm.perms,
                subject: primarySubject,
                assignedSubjects: cleanSubjects,
                assignedClasses: adminForm.assignedClasses || [],
                mobile: adminForm.mobile
              }
            : u
        );
        setAdminUsers(updated);
        setShowAdminModal(false);
        try { window.dispatchEvent(new CustomEvent('hss-permissions-updated')); } catch (_) {}
        setAlert({
          type: 'success',
          text: `✨ Staff profile (${cleanEmail}) successfully updated!`,
        });
      } else {
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
          designation: adminForm.designation?.trim() || '',
          perms: adminForm.perms,
          subject: primarySubject,
          assignedSubjects: cleanSubjects,
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
            designation: adminForm.designation?.trim() || '',
            perms: adminForm.perms,
            subject: primarySubject,
            assignedSubjects: cleanSubjects,
            assignedClasses: adminForm.assignedClasses || [],
            mobile: adminForm.mobile
          }
        ];
        setAdminUsers(updated);
        setShowAdminModal(false);
        try { window.dispatchEvent(new CustomEvent('hss-permissions-updated')); } catch (_) {}
        setAlert({
          type: 'success',
          text: `✨ ${res.message || `Account for ${adminForm.name} configured successfully!`}`,
        });
      }
    } catch (err) {
      console.error('Error saving staff account:', err);
      setModalError('Failed to save staff account: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdmin = async (email) => {
    const cleanEmail = email.toLowerCase();
    if (cleanEmail === 'adm.exam.hss.shangus@gmail.com') {
      setAlert({ type: 'error', text: 'Security Protection: Master Super Administrator account cannot be deleted.' });
      return;
    }
    setSaving(true);
    try {
      await deleteStaffAccount(cleanEmail);
      const updated = adminUsers.filter((u) => u.email.toLowerCase() !== cleanEmail);
      setAdminUsers(updated);
      setUserToDelete(null);
      try { window.dispatchEvent(new CustomEvent('hss-permissions-updated')); } catch (_) {}
      setAlert({ type: 'success', text: `Access revoked and profile removed for ${email}.` });
    } catch (err) {
      console.error('Error deleting staff account:', err);
      setAlert({ type: 'error', text: 'Failed to revoke access: ' + (err.message || err) });
    } finally {
      setSaving(false);
    }
  };

  // Filter staff by category and search query
  const filteredStaff = useMemo(() => {
    return adminUsers.filter(u => {
      const cleanEmail = String(u.email || '').toLowerCase();
      const r = String(u.role || '').toLowerCase();
      const isSuper = cleanEmail === 'adm.exam.hss.shangus@gmail.com' || r === 'superadmin';
      const isTeacher = r === 'teacher' || r === 'faculty' || r === 'staff';
      const isAdmin = !isTeacher && !isSuper;

      if (staffRoleFilter === 'superadmin' && !isSuper) return false;
      if (staffRoleFilter === 'admin' && !isAdmin) return false;
      if (staffRoleFilter === 'teacher' && !isTeacher) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (u.name || '').toLowerCase().includes(q);
        const emailMatch = cleanEmail.includes(q);
        const desigMatch = (u.designation || '').toLowerCase().includes(q);
        const subjMatch = (u.subject || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !desigMatch && !subjMatch) return false;
      }
      return true;
    });
  }, [adminUsers, staffRoleFilter, searchQuery]);

  const superAdminCount = adminUsers.filter(u => String(u.email || '').toLowerCase() === 'adm.exam.hss.shangus@gmail.com' || String(u.role || '').toLowerCase() === 'superadmin').length;
  const adminCount = adminUsers.filter(u => {
    const clean = String(u.email || '').toLowerCase();
    const r = String(u.role || '').toLowerCase();
    return clean !== 'adm.exam.hss.shangus@gmail.com' && r !== 'superadmin' && r !== 'teacher' && r !== 'faculty';
  }).length;
  const teacherCount = adminUsers.filter(u => {
    const r = String(u.role || '').toLowerCase();
    return r === 'teacher' || r === 'faculty' || r === 'staff';
  }).length;

  return (
    <div className="space-y-3.5 text-xs animate-fadeIn text-slate-900 dark:text-slate-100">
      {/* Top Banner Alert */}
      {alert && (
        <div className={`p-3 rounded-2xl font-extrabold flex items-center justify-between gap-3 shadow-xs ${
          alert.type === 'error'
            ? 'bg-rose-600 text-white'
            : 'bg-emerald-600 text-white'
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

      {/* Main Staff Container Card */}
      <div className="p-2 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5 sm:space-y-3">
        {/* Top Header & Universal Controls Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2 sm:pb-3 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
              <Users size={14} className="sm:hidden" />
              <Users size={16} className="hidden sm:inline" />
            </div>
            <div>
              <h2 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                Staff & Permissions Manager
              </h2>
              <p className="text-[9.5px] sm:text-[10.5px] font-semibold text-slate-400 dark:text-slate-500">
                Governance for 4 categories: Student, Teacher, Standard Admin & SuperAdmin
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar with Standardized Consistent [Save Changes] */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                const allCodes = ALL_ADMIN_MODULES.map((m) => m.code);
                setAdminUsers((prev) =>
                  prev.map((u) => {
                    const roleStr = String(u.role || '').toLowerCase();
                    if (roleStr === 'teacher' || roleStr === 'faculty' || roleStr === 'staff') return u;
                    return { ...u, perms: allCodes };
                  })
                );
                setAlert({
                  type: 'success',
                  text: `✨ Upgraded all administrators to full access (${ALL_ADMIN_MODULES.length} modules). Click "Save Changes" to commit!`,
                });
              }}
              className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              title={`Grant all ${ALL_ADMIN_MODULES.length} modules to all active Admin accounts`}
            >
              <Sparkles size={11} className="text-indigo-600 dark:text-indigo-400" />
              <span className="sm:hidden">Upgrade ({ALL_ADMIN_MODULES.length})</span>
              <span className="hidden sm:inline">Upgrade All Admins ({ALL_ADMIN_MODULES.length})</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddAdmin}
              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[10.5px] sm:text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <UserPlus size={12} />
              <span>Add Staff</span>
            </button>

            {/* Consistent Standard Save Button */}
            <button
              type="button"
              onClick={() => handleApplyPermissions()}
              disabled={saving}
              className="px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Search Bar Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2 pt-0.5">
          <div className="inline-flex p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl sm:rounded-2xl text-[9.5px] sm:text-[10.5px] font-bold gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: `All (${adminUsers.length})` },
              { id: 'superadmin', label: `SuperAdmin (${superAdminCount})` },
              { id: 'admin', label: `Admins (${adminCount})` },
              { id: 'teacher', label: `Teachers (${teacherCount})` },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStaffRoleFilter(f.id)}
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                  staffRoleFilter === f.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, designation..."
              className="w-full pl-7 pr-6 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Staff Cards List */}
        <div className="space-y-2 pt-1">
          {filteredStaff.map((user, idx) => {
            const cleanEmail = String(user.email || '').trim().toLowerCase();
            const roleStr = String(user.role || '').toLowerCase();
            const isSuper = cleanEmail === 'adm.exam.hss.shangus@gmail.com' || roleStr === 'superadmin';
            const isTeacher = roleStr === 'teacher' || roleStr === 'faculty' || roleStr === 'staff';
            const userPerms = Array.isArray(user.perms) ? user.perms : [];
            const activeCount = isSuper ? ALL_ADMIN_MODULES.length : userPerms.length;
            const isSendingReset = sendingResetFor === cleanEmail;
            const isOpen = openDropdownUser === cleanEmail;
            const hasOutdatedStatus = !isTeacher && !isSuper && activeCount < ALL_ADMIN_MODULES.length;
            const desig = user.designation || (cleanEmail === 'ghssshangus74@gmail.com' ? 'Principal' : '');

            return (
              <div 
                key={idx} 
                className="p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 hover:border-indigo-500/40 transition-all space-y-1.5 sm:space-y-2"
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2">
                  {/* User Profile Column */}
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-black shrink-0 ${
                      isSuper 
                        ? 'bg-purple-500/20 text-purple-600 border border-purple-500/30' 
                        : isTeacher
                        ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                    }`}>
                      {isSuper ? <ShieldCheck size={14} className="sm:hidden" /> : isTeacher ? <UserCheck size={14} className="sm:hidden" /> : <Lock size={13} className="sm:hidden" />}
                      {isSuper ? <ShieldCheck size={16} className="hidden sm:inline" /> : isTeacher ? <UserCheck size={16} className="hidden sm:inline" /> : <Lock size={15} className="hidden sm:inline" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                        <strong className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white truncate">
                          {user.name}
                        </strong>
                        
                        {/* Category Badge */}
                        <span className={`px-1.5 py-0.5 rounded-full font-black text-[8px] sm:text-[9px] uppercase tracking-wider shrink-0 ${
                          isSuper ? 'bg-purple-600 text-white' : isTeacher ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                        }`}>
                          {isSuper ? 'SuperAdmin' : isTeacher ? 'Teacher' : 'Standard Admin'}
                        </span>

                        {/* Special Designation Label (Principal, Clerk, etc.) */}
                        {desig && (
                          <span className="px-1.5 py-0.5 rounded-full font-black text-[8px] sm:text-[9px] uppercase tracking-wider bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800 shrink-0 shadow-2xs">
                            {desig}
                          </span>
                        )}

                        {/* Teaching Subject(s) (if teacher) */}
                        {Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {user.assignedSubjects.map((sub) => (
                              <span key={sub} className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                                {sub}
                              </span>
                            ))}
                          </div>
                        ) : user.subject ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {user.subject.split(/[,;]+/).map((s) => s.trim()).filter(Boolean).map((sub) => (
                              <span key={sub} className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                                {sub}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {/* Assigned Classes */}
                        {Array.isArray(user.assignedClasses) && user.assignedClasses.length > 0 && (
                          <div className="flex flex-wrap items-center gap-0.5">
                            {user.assignedClasses.map((cls) => (
                              <span key={cls} className="px-1.5 py-0.2 rounded font-black text-[7.5px] sm:text-[8px] uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                                Class {cls}
                              </span>
                            ))}
                          </div>
                        )}

                        {hasOutdatedStatus && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[8.5px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                            Partial Access ({activeCount}/{ALL_ADMIN_MODULES.length})
                          </span>
                        )}
                      </div>

                      <div className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono truncate pt-0.5">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Modules Controls */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end">
                    {hasOutdatedStatus && (
                      <button
                        type="button"
                        onClick={() => setAllPermissionsForUser(user.email, true)}
                        className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-xl text-[9.5px] sm:text-[10px] font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Sparkles size={10} />
                        <span>Grant All ({ALL_ADMIN_MODULES.length})</span>
                      </button>
                    )}

                    {!isTeacher && (
                      <button
                        type="button"
                        onClick={() => toggleModulesDropdown(cleanEmail)}
                        className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-xl text-[9.5px] sm:text-[10.5px] font-bold inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all border ${
                          activeCount === ALL_ADMIN_MODULES.length
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20'
                        }`}
                      >
                        <SlidersHorizontal size={11} className="text-indigo-600 dark:text-indigo-400" />
                        <span>{activeCount}/{ALL_ADMIN_MODULES.length} Modules</span>
                        <ChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}

                    {/* Reset Password Email */}
                    <button
                      type="button"
                      onClick={() => handleSendPasswordReset(user.email)}
                      disabled={isSendingReset}
                      title="Send Password Reset Email"
                      className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-xl text-[9.5px] sm:text-[10px] font-bold bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {isSendingReset ? <RefreshCw size={10} className="animate-spin" /> : <Key size={10} />}
                      <span>Reset</span>
                    </button>

                    {/* Edit Staff Account */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditAdmin(user)}
                      title="Edit Account Details"
                      className="p-1 sm:p-1.5 rounded-md sm:rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200/60 dark:border-indigo-800/60 cursor-pointer"
                    >
                      <Edit3 size={12} />
                    </button>

                    {/* Delete / Revoke Access (Forbidden for sole SuperAdmin) */}
                    {!isSuper && (
                      <button
                        type="button"
                        onClick={() => setUserToDelete(user)}
                        title="Revoke / Delete Staff Account"
                        className="p-1 sm:p-1.5 rounded-md sm:rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200/60 dark:border-rose-800/60 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Module Permissions Dropdown */}
                {isOpen && !isTeacher && (
                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Configure Granted Modules for {user.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAllPermissionsForUser(user.email, true)}
                          className="text-[9.5px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button
                          type="button"
                          onClick={() => setAllPermissionsForUser(user.email, false)}
                          className="text-[9.5px] font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 scrollbar-thin">
                      {ALL_ADMIN_MODULES.map((mod) => {
                        const isGranted = isSuper || userPerms.includes(mod.code);
                        return (
                          <label
                            key={mod.code}
                            className={`flex items-center gap-2 p-1.5 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all ${
                              isGranted
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
                                : 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isGranted}
                              disabled={isSuper}
                              onChange={() => togglePermission(user.email, mod.code)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="truncate">{mod.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredStaff.length === 0 && (
            <div className="py-8 text-center text-slate-400 font-semibold text-xs">
              No staff members found matching filter criteria.
            </div>
          )}
        </div>
      </div>

      {/* ── WIDE & MINIMAL DESIGN: ADD / EDIT STAFF MODAL ── */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl lg:max-w-6xl xl:max-w-7xl w-full shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[94vh] overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-t-3xl flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                  {editingAdminEmail ? <Edit3 size={18} /> : <UserPlus size={18} />}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                    {editingAdminEmail ? 'Edit Staff Account Profile' : 'Register New Staff Member'}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {editingAdminEmail ? `Configuring account permissions for ${editingAdminEmail}` : 'Register faculty or administrator with module-level authorization'}
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

            {/* Modal Form Body */}
            <form onSubmit={handleSaveAdminForm} className="flex-1 overflow-y-auto flex flex-col justify-between">
              <div className="p-5 sm:p-6 space-y-4 text-xs font-semibold">
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

                {/* Primary Staff Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={adminForm.name}
                      onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                      placeholder="e.g. Ajaz Ahmad Bhat"
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Email Address (Login ID) <span className="text-rose-500">*</span>
                      </label>
                      {editingAdminEmail && (
                        <span className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400">
                          Auth ID
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

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Role Category
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
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
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

                {/* Administrative Title / Special Label (Clerk, Principal, Incharge, etc.) */}
                {adminForm.role === 'Admin' && (
                  <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="sm:w-1/3">
                      <label className="block text-[11px] font-black text-amber-900 dark:text-amber-300 leading-tight">
                        Administrative Designation / Title
                      </label>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-400 font-medium">
                        e.g. Clerk, Principal, Incharge Academics, Dealing Assistant
                      </span>
                    </div>
                    <div className="sm:w-2/3">
                      <input
                        type="text"
                        value={adminForm.designation || ''}
                        onChange={(e) => setAdminForm({ ...adminForm, designation: e.target.value })}
                        placeholder="Enter label (e.g. Clerk, Principal)"
                        className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-300/80 dark:border-amber-700/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Faculty Subject & Classes Assignment (if Teacher) */}
                {adminForm.role === 'Teacher' && (
                  <div className="space-y-3 p-3 sm:p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60">
                    {/* Header with Class Tier Selector Tabs */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/60 pb-2.5">
                      <div>
                        <label className="block text-xs font-black text-emerald-950 dark:text-emerald-200">
                          Assigned Teaching Subject(s) <span className="text-rose-500">*</span>
                        </label>
                        <p className="text-[10px] font-medium text-emerald-800/80 dark:text-emerald-400/80">
                          Check all subjects this faculty member teaches across secondary and higher secondary levels.
                        </p>
                      </div>

                      {/* Class Tier Tabs (9th-10th vs 11th-12th) */}
                      <div className="inline-flex p-0.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-2xs self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setSubjectTierTab('9th-10th')}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold cursor-pointer transition-all ${
                            subjectTierTab === '9th-10th'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-emerald-700'
                          }`}
                        >
                          Secondary (9th & 10th)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubjectTierTab('11th-12th')}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold cursor-pointer transition-all ${
                            subjectTierTab === '11th-12th'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-emerald-700'
                          }`}
                        >
                          Higher Secondary (11th & 12th)
                        </button>
                      </div>
                    </div>

                    {/* Selected Subjects Chips Summary */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-800/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>Active Subject Assignment ({adminForm.assignedSubjects?.length || 0})</span>
                        {adminForm.assignedSubjects && adminForm.assignedSubjects.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAdminForm({ ...adminForm, assignedSubjects: [], subject: '' })}
                            className="text-rose-500 hover:text-rose-600 cursor-pointer text-[9.5px] font-bold"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
                        {adminForm.assignedSubjects && adminForm.assignedSubjects.length > 0 ? (
                          adminForm.assignedSubjects.map((sub) => (
                            <span
                              key={sub}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-2xs animate-fadeIn"
                            >
                              <span>{sub}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = adminForm.assignedSubjects.filter((s) => s !== sub);
                                  setAdminForm({ ...adminForm, assignedSubjects: next, subject: next.join(', ') });
                                }}
                                className="hover:opacity-75 cursor-pointer p-0.5 -mr-0.5"
                                title={`Remove ${sub}`}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 italic">
                            No subjects selected yet — check below or add custom subjects
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subject Catalogue Grid by Tier */}
                    {subjectTierTab === '9th-10th' ? (
                      <div className="space-y-2.5 pt-0.5">
                        {SECONDARY_SUBJECTS_CATALOGUE.map((cat, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                              {cat.group}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {cat.subjects.map((sub) => {
                                const isChecked = (adminForm.assignedSubjects || []).includes(sub);
                                return (
                                  <button
                                    key={sub}
                                    type="button"
                                    onClick={() => {
                                      const current = adminForm.assignedSubjects || [];
                                      const next = isChecked ? current.filter((s) => s !== sub) : [...current, sub];
                                      setAdminForm({ ...adminForm, assignedSubjects: next, subject: next.join(', ') });
                                    }}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                      isChecked
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs scale-[1.02]'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                                    }`}
                                  >
                                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                      isChecked ? 'border-white bg-white/20' : 'border-slate-300 dark:border-slate-700'
                                    }`}>
                                      {isChecked && <Check size={10} strokeWidth={3} />}
                                    </span>
                                    <span>{sub}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5 pt-0.5">
                        {HIGHER_SECONDARY_SUBJECTS_CATALOGUE.map((streamBlock, sIdx) => (
                          <div key={sIdx} className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-emerald-100 dark:border-emerald-900/40 space-y-2">
                            <div className="text-[10.5px] font-black text-emerald-900 dark:text-emerald-200 border-b border-emerald-100 dark:border-emerald-900/40 pb-1">
                              {streamBlock.stream}
                            </div>
                            <div className="space-y-2">
                              {streamBlock.groups.map((grp, gIdx) => (
                                <div key={gIdx} className="space-y-1">
                                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                                    {grp.label}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {grp.subjects.map((sub) => {
                                      const isChecked = (adminForm.assignedSubjects || []).includes(sub);
                                      return (
                                        <button
                                          key={sub}
                                          type="button"
                                          onClick={() => {
                                            const current = adminForm.assignedSubjects || [];
                                            const next = isChecked ? current.filter((s) => s !== sub) : [...current, sub];
                                            setAdminForm({ ...adminForm, assignedSubjects: next, subject: next.join(', ') });
                                          }}
                                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                            isChecked
                                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs scale-[1.02]'
                                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                                          }`}
                                        >
                                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                            isChecked ? 'border-white bg-white/20' : 'border-slate-300 dark:border-slate-700'
                                          }`}>
                                            {isChecked && <Check size={10} strokeWidth={3} />}
                                          </span>
                                          <span>{sub}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Custom / Quick Write-In Subject Adder */}
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-2">
                      <input
                        type="text"
                        value={customSubjectInput}
                        onChange={(e) => setCustomSubjectInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const clean = customSubjectInput.trim();
                            if (clean && !(adminForm.assignedSubjects || []).includes(clean)) {
                              const next = [...(adminForm.assignedSubjects || []), clean];
                              setAdminForm({ ...adminForm, assignedSubjects: next, subject: next.join(', ') });
                              setCustomSubjectInput('');
                            }
                          }
                        }}
                        placeholder="Type any custom / other subject..."
                        className="flex-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-300 dark:border-emerald-700/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = customSubjectInput.trim();
                          if (clean && !(adminForm.assignedSubjects || []).includes(clean)) {
                            const next = [...(adminForm.assignedSubjects || []), clean];
                            setAdminForm({ ...adminForm, assignedSubjects: next, subject: next.join(', ') });
                            setCustomSubjectInput('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer transition-all active:scale-95"
                      >
                        + Add Subject
                      </button>
                    </div>

                    {/* Assigned Classes Checkboxes */}
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-1.5">
                      <label className="block text-[11px] font-black text-emerald-950 dark:text-emerald-200">
                        Assigned Classes (Evaluation & Registers)
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {['9th', '10th', '11th', '12th'].map((cls) => {
                          const isSelected = (adminForm.assignedClasses || []).includes(cls);
                          return (
                            <label
                              key={cls}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(event) =>
                                  setAdminForm((prev) => ({
                                    ...prev,
                                    assignedClasses: event.target.checked
                                      ? [...(prev.assignedClasses || []), cls]
                                      : (prev.assignedClasses || []).filter((v) => v !== cls),
                                  }))
                                }
                                className="hidden"
                              />
                              <span>Class {cls}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Password / Activation Link Settings */}
                <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 max-w-sm">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-black text-[11px] mb-1">
                      <Lock size={12} className="text-indigo-600 dark:text-indigo-400" />
                      <span>{editingAdminEmail ? 'Set / Override Password (Optional)' : 'Initial Password (Optional)'}</span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showPasswordText ? "text" : "password"}
                        value={adminForm.password}
                        onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                        placeholder="Leave blank for activation email"
                        className="w-full pl-3 pr-9 py-1.5 rounded-xl text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                      {adminForm.password && (
                        <button
                          type="button"
                          onClick={() => setShowPasswordText(!showPasswordText)}
                          className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                          tabIndex={-1}
                          title={showPasswordText ? "Hide password" : "Show password"}
                        >
                          {showPasswordText ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1 sm:pt-4 select-none self-start sm:self-center">
                    <input
                      type="checkbox"
                      checked={adminForm.sendSetupEmail}
                      onChange={(e) => setAdminForm({ ...adminForm, sendSetupEmail: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Send password setup & activation link to staff email
                    </span>
                  </label>
                </div>

                {/* Granted Feature Modules (For Admins & SuperAdmins) */}
                {adminForm.role !== 'Teacher' && (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                          Authorized Feature Modules
                        </label>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black border border-indigo-200/60 dark:border-indigo-800/60">
                          {adminForm.role === 'SuperAdmin' ? ALL_ADMIN_MODULES.length : adminForm.perms.length} / {ALL_ADMIN_MODULES.length}
                        </span>
                      </div>

                      {adminForm.role !== 'SuperAdmin' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">Presets:</span>
                          {ROLE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setAdminForm({ ...adminForm, perms: preset.perms() })}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                              title={preset.desc}
                            >
                              {preset.shortName || preset.name}
                            </button>
                          ))}
                          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
                          <button
                            type="button"
                            onClick={() => setAdminForm({ ...adminForm, perms: ALL_ADMIN_MODULES.map(m => m.code) })}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer transition-all shadow-2xs"
                          >
                            Select All ({ALL_ADMIN_MODULES.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminForm({ ...adminForm, perms: [] })}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-all shadow-2xs"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {adminForm.role === 'SuperAdmin' ? (
                      <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200 text-xs font-bold flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-600 flex-shrink-0" />
                        <span>Super Admins automatically retain unrestricted authority across all {ALL_ADMIN_MODULES.length} system modules.</span>
                      </div>
                    ) : (
                      <div className="p-3 space-y-3.5 max-h-[380px] sm:max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 scrollbar-thin">
                        {ADMIN_CATEGORIES.map((cat) => {
                          const catModules = ALL_ADMIN_MODULES.filter((m) => m.category === cat.key);
                          if (catModules.length === 0) return null;
                          const catCodes = catModules.map((m) => m.code);
                          const catActiveCount = catCodes.filter((code) => adminForm.perms.includes(code)).length;
                          const allCatActive = catActiveCount === catCodes.length;

                          return (
                            <div key={cat.key} className="space-y-1.5 bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 shadow-2xs">
                              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                  {cat.title} <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">({catActiveCount}/{catModules.length})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = allCatActive
                                      ? adminForm.perms.filter((c) => !catCodes.includes(c))
                                      : Array.from(new Set([...adminForm.perms, ...catCodes]));
                                    setAdminForm({ ...adminForm, perms: updated });
                                  }}
                                  className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer"
                                >
                                  {allCatActive ? 'Deselect Category' : 'Select All In Category'}
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                {catModules.map((module) => {
                                  const isChecked = adminForm.perms.includes(module.code);
                                  return (
                                    <label
                                      key={module.code}
                                      className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                                        isChecked
                                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100 shadow-2xs'
                                          : 'bg-slate-50/40 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          const updated = isChecked
                                            ? adminForm.perms.filter((c) => c !== module.code)
                                            : [...adminForm.perms, module.code];
                                          setAdminForm({ ...adminForm, perms: updated });
                                        }}
                                        className="mt-0.5 w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <span className="font-bold text-[11px] block leading-tight truncate">
                                          {module.label}
                                        </span>
                                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 line-clamp-1 block leading-tight">
                                          {module.desc}
                                        </span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/80 flex items-center justify-between gap-3 rounded-b-3xl flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                >
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{editingAdminEmail ? 'Update Staff Profile' : 'Create Staff Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REVOKE / DELETE CONFIRMATION DIALOG ── */}
      {userToDelete && (
        <ConfirmModal
          isOpen={true}
          type="danger"
          title={
            userToDelete.role === 'Teacher' 
              ? `Delete Teacher Account?` 
              : userToDelete.designation 
              ? `Revoke ${userToDelete.designation} Access?` 
              : `Revoke Administrative Access?`
          }
          message={
            userToDelete.role === 'Teacher'
              ? `Are you sure you want to permanently remove the teacher account for ${userToDelete.name} (${userToDelete.email})? They will lose practical and attendance access.`
              : `Are you sure you want to revoke administrative credentials for ${userToDelete.name} ${userToDelete.designation ? `(${userToDelete.designation})` : ''} (${userToDelete.email})? They will immediately lose access to all modules.`
          }
          confirmText={userToDelete.role === 'Teacher' ? 'Yes, Delete Teacher' : 'Yes, Revoke Access'}
          onConfirm={() => handleDeleteAdmin(userToDelete.email)}
          onCancel={() => setUserToDelete(null)}
          onClose={() => setUserToDelete(null)}
        />
      )}
    </div>
  );
}
