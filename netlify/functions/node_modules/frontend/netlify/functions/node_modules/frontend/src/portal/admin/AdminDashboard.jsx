import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, Hash, Layers, RefreshCw, LogOut, ShieldCheck, BarChart2, Mail, CreditCard, Settings, ChevronDown, Wrench, ClipboardCheck, CalendarCheck, Contact, PanelsTopLeft } from 'lucide-react';
import SEO from '../../components/SEO';
import ApplicationReviewModal from './ApplicationReviewModal';
import RollNoAssignment from './RollNoAssignment';
import BulkOperations from './BulkOperations';
import AdvancedReports from './AdvancedReports';
import AutomationsPage from './AutomationsPage';
import FundDistribution from './FundDistribution';
import ControlsAndSubjects from './ControlsAndSubjects';
import AdminPracticals from './AdminPracticals';
import AdminAttendance from './AdminAttendance';
import AdminGkTestManager from './AdminGkTestManager';
import StudentIdCardManager from './StudentIdCardManager';
import ModernLoader from '../../components/ModernLoader';
import AdminToolsDropdown from './AdminToolsDropdown';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { db } from '../../services/firebase';
import { getCachedCollection, getCachedCollectionSync, subscribeToCollection } from '../../services/dbCache';

const AdministrativeCms = React.lazy(() => import('../../pages/AdminPortal'));


export default function AdminDashboard() {
  const { user, onLogout } = useOutletContext();

  // Helper to read initial activeTab from URL search params, hash or sessionStorage
  const getInitialTab = () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlTab = searchParams.get('tab');
      if (urlTab) return urlTab;

      const hash = window.location.hash.replace(/^#/, '');
      if (hash) return hash;

      const savedTab = sessionStorage.getItem('hss_admin_active_tab');
      if (savedTab) return savedTab;
    } catch (_) {}
    return 'reports';
  };

  // Tab State: 'reports' | 'controls' | 'rollNo' | 'bulk' | 'automations' | 'funds' | 'practicals' | 'attendanceMgmt' | 'gkTest' | 'idCards'
  const [activeTab, setActiveTabState] = useState(getInitialTab);

  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem('hss_admin_active_tab', tab);
      const url = new URL(window.location.href);
      if (tab === 'reports') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tab);
      }
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  }, []);

  // Sync initial tab into URL if loaded from sessionStorage
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const currentUrlTab = searchParams.get('tab');
      if (!currentUrlTab && activeTab !== 'reports') {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', activeTab);
        window.history.replaceState(null, '', url.toString());
      }
    } catch (_) {}
  }, [activeTab]);

  const initialCachedApps = getCachedCollectionSync('admissions');
  const initialMasterCount = (() => {
    try {
      const raw = sessionStorage.getItem('hss_cache_masterRegisters_v2') || localStorage.getItem('hss_cache_masterRegisters_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch (_) {}
    return 0;
  })();

  const [counts, setCounts] = useState(() => ({
    active: initialCachedApps?.length || 0,
    total: (initialCachedApps?.length || 0) + initialMasterCount
  }));
  const [viewScope, setViewScope] = useState('active');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef(null);

  // Trigger confirm modal before logging out
  const handleLogoutRequest = () => setShowLogoutConfirm(true);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Applications Data State with Instant Cache + Silent Background Sync
  const [loading, setLoading] = useState(!initialCachedApps || initialCachedApps.length === 0);
  const [applications, setApplications] = useState(initialCachedApps || []);
  const [selectedApp, setSelectedApp] = useState(null); // For ApplicationReviewModal

  // Fetch Admin Dashboard Data using shared cache with silent background revalidation
  const loadAdminData = useCallback(async (force = false) => {
    // Only show full loader on initial cold start when NO data is available anywhere
    if (applications.length === 0) {
      setLoading(true);
    }

    const timeoutTimer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    try {
      const list = await getCachedCollection('admissions', force, 30 * 60 * 1000, (freshList) => {
        // Silent background update callback without unmounting UI
        if (freshList && Array.isArray(freshList)) {
          setApplications(freshList);
        }
      });
      if (list && Array.isArray(list)) {
        setApplications(list);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      clearTimeout(timeoutTimer);
      setLoading(false);
    }
  }, [applications.length]);

  // Real-time live synchronization for admissions (0ms updates when students submit, edit, or withdraw)
  useEffect(() => {
    const unsubscribe = subscribeToCollection('admissions', (liveList) => {
      if (liveList && Array.isArray(liveList)) {
        setApplications(liveList);
        setLoading(false);
      }
    }, (err) => {
      console.warn('Realtime listener fallback to SWR query:', err);
      loadAdminData(true);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadAdminData]);

  const handleRecordDeleted = (student) => {
    if (!student) return;
    const formNo = String(student?.formNo || student?.['Form No.'] || student?.['Form Number'] || student?.id || '').replace(/^(N\/A|—)$/i, '').trim();
    const rawId = String(student?.docId || student?._docId || student?.id || formNo).replace(/^(N\/A|—)$/i, '').trim();
    const normForm = formNo ? formNo.replace(/[\/\s]/g, '_').toLowerCase() : '';
    const normId = rawId ? rawId.replace(/[\/\s]/g, '_').toLowerCase() : '';
    const studentName = String(student?.studentName || student?.["Student's Name (as per school records)"] || student?.["Student's Name"] || '').trim().toLowerCase();

    setApplications(prev => prev.filter(s => {
      if (!s) return false;
      if (student.id && s.id === student.id) return false;
      const sf = String(s.formNo || s['Form No.'] || s['Form Number'] || '').replace(/^(N\/A|—)$/i, '').trim();
      const snForm = sf ? sf.replace(/[\/\s]/g, '_').toLowerCase() : '';
      if (normForm && snForm && snForm === normForm) return false;
      const sId = String(s.id || s.docId || s._docId || '').trim().replace(/[\/\s]/g, '_').toLowerCase();
      if (normId && sId && sId === normId) return false;
      const sName = String(s.studentName || s["Student's Name (as per school records)"] || s["Student's Name"] || '').trim().toLowerCase();
      if (studentName && sName && sName === studentName && (!sf || sf === '—') && (!formNo || formNo === '—')) return false;
      return true;
    }));
  };

  // Check if a specific tab/module is permitted for the logged-in user
  const isTabPermitted = (tabId) => {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase().trim();
    const email = String(user.email || '').toLowerCase().trim();
    
    // Only genuine SuperAdmins have unconditional access to all modules
    if (
      role === 'superadmin' || 
      email === 'adm.exam.hss.shangus@gmail.com' ||
      email === 'socialshiftz@gmail.com'
    ) {
      return true;
    }

    // For Admin and sub-admin accounts, strictly evaluate assigned perms array
    const perms = Array.isArray(user.perms) ? user.perms : [];
    if (perms.includes('*')) return true;
    if (perms.length > 0) {
      return perms.includes(tabId);
    }

    // Default fallback for restricted Admin with no perms: Master Register (reports) only
    return tabId === 'reports';
  };

  // Helper to test if student has a valid assigned Class Roll Number
  const hasClassRollVal = (a) => {
    if (!a) return false;
    const roll = String(a['Class Roll No'] || a['Class Roll No.'] || a['RL. NO.'] || a['RL. NO'] || a['Class R.No.'] || a['Class R.No'] || a.classRollNo || a.rollNo || a.roll || '').trim();
    return !!(roll && roll !== '—' && roll !== 'N/A' && roll !== 'null' && roll !== 'undefined');
  };

  // Stats calculation
  const totalCount = applications.length;
  const approvedCount = applications.filter((a) => hasClassRollVal(a)).length;
  const submittedCount = applications.filter((a) => !hasClassRollVal(a) && a['Status'] === 'Submitted').length;
  const draftCount = applications.filter((a) => !hasClassRollVal(a) && (a['Status'] === 'Draft' || !a['Status'])).length;
  const rejectedCount = applications.filter((a) => !hasClassRollVal(a) && a['Status'] === 'Rejected').length;

  const TOOL_MODULES = [
    { id: 'reports', label: 'Student Records & Reports', icon: BarChart2 },
    { id: 'idCards', label: 'Student ID Cards', icon: Contact },
    { id: 'gkTest', label: 'Competitive Exams', icon: ShieldCheck },
    { id: 'controls', label: 'Academic Controls & Subjects', icon: Settings },
    { id: 'practicals', label: 'Practicals & Awards', icon: ClipboardCheck },
    { id: 'attendanceMgmt', label: 'Student Attendance', icon: CalendarCheck },
    { id: 'rollNo', label: 'Roll Number Manager', icon: Hash },
    { id: 'bulk', label: 'Bulk Data & Exports', icon: Layers },
    { id: 'automations', label: 'Messages & Automations', icon: Mail },
    { id: 'funds', label: 'Funds & Fee Accounts', icon: CreditCard },
    { id: 'cms', label: 'Website CMS & Administration', icon: PanelsTopLeft },
  ];

  const allowedToolModules = TOOL_MODULES.filter((mod) => isTabPermitted(mod.id));

  return (
    <div className="admin-dashboard-theme w-full min-h-[85vh] py-0.5 sm:py-1 px-1 sm:px-2" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Admin Dashboard | HSS Shangus"
        description="Comprehensive Super Admin Panel for managing student applications, roll numbers, fee structures, and automations."
      />

      <div className="w-full max-w-[1750px] mx-auto space-y-0.5">
        {/* Workspace Card */}
        <div className="rounded-xl p-0.5 sm:p-1 border shadow-sm space-y-1" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          {/* Navigation Tabs Dynamic Toolbar (For non-reports tabs) */}
          {activeTab !== 'reports' && (() => {
            const currentModule = TOOL_MODULES.find(m => m.id === activeTab) || { id: activeTab, label: 'Admin Tool', icon: Wrench };
            const CurrentIcon = currentModule.icon;
            return (
              <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-xl border text-xs font-bold flex-nowrap bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xs">
                
                {/* Left Slot: Brand & Active Module Title */}
                <div className="flex min-w-0 items-center gap-1.5 flex-nowrap">
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-200 border-r border-slate-300 dark:border-slate-700 pr-2.5 flex-shrink-0" title={`${user?.email || 'Admin'} • HSS Shangus`}>
                    <div className="w-6 h-6 rounded-lg bg-amber-600/10 border border-amber-600/30 flex items-center justify-center font-black text-amber-600 text-[10px]">
                      <Lock size={11} />
                    </div>
                    <span className="hidden sm:inline text-[11px] font-black">Admin</span>
                  </div>

                  <div className="flex min-w-0 items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-black bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700">
                    <div className="w-4 h-4 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                      <CurrentIcon size={12} />
                    </div>
                    <span className="max-w-[44vw] truncate text-slate-800 dark:text-slate-200 font-black sm:max-w-none">{currentModule.label}</span>
                  </div>
                </div>

                {/* Right Slot: Admin Tools Dropdown Button & Refresh Sync Button */}
                <div className="flex flex-shrink-0 items-center gap-1 ml-auto">
                  {/* Administrative Tools Switcher Dropdown (Positioned on Right Side) */}
                  <div className="relative inline-block text-left" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsToolsOpen(!isToolsOpen)}
                      title="Switch Administrative Tool / Module"
                      className="flex h-8 items-center gap-1.5 px-2 sm:px-3 rounded-lg border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 text-purple-900 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-all cursor-pointer shadow-2xs font-black text-xs group"
                    >
                      <div className="w-5 h-5 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                        <Wrench size={13} />
                      </div>
                      <span className="tracking-tight font-black hidden md:inline">Modules</span>
                      <ChevronDown size={14} className="text-purple-600 dark:text-purple-400 group-hover:translate-y-0.5 transition-transform ml-0.5" />
                    </button>

                    <AdminToolsDropdown
                      isOpen={isToolsOpen}
                      setIsOpen={setIsToolsOpen}
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      user={user}
                      align="right"
                    />
                  </div>

                  {/* Refresh Sync Button */}
                  {activeTab !== 'cms' && <button
                    type="button"
                    onClick={() => loadAdminData(true)}
                    disabled={loading}
                    title="Sync & Refresh Database Records"
                    className="h-8 px-2 sm:px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-black text-xs cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin text-purple-600' : 'text-slate-500'} />
                    <span className="hidden sm:inline">Sync</span>
                  </button>}
                </div>
              </div>
            );
          })()}

          {/* Loading Indicator — Only show parent loader on initial global fetch before applications are loaded */}
          {loading && applications.length === 0 ? (
            <ModernLoader
              moduleKey={activeTab}
              text={`Fetching ${TOOL_MODULES.find(m => m.id === activeTab)?.label || 'System Data'}`}
              totalRecords={applications.length > 0 ? applications.length : undefined}
            />
          ) : (
            <>
              {/* Permission Guard: Check if active tab is permitted */}
              {!isTabPermitted(activeTab) ? (
                <div className="p-12 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 border border-amber-500/30 flex items-center justify-center mx-auto font-black">
                    <Lock size={24} />
                  </div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">Access Restricted</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    You do not have administrative permission to access this module. Please contact the Super Admin to request access.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-700 hover:bg-indigo-600 cursor-pointer shadow-md"
                  >
                    Return to Master Register
                  </button>
                </div>
              ) : (
                <>
                  {/* TAB 1: Master Register & Database — always mounted, hidden via CSS to prevent re-fetch on tab switch */}
                  <div className={activeTab === 'reports' ? '' : 'hidden'}>
                    <AdvancedReports
                      setActiveTab={setActiveTab}
                      viewScope={viewScope}
                      setViewScope={setViewScope}
                      setCounts={setCounts}
                      user={user}
                      onLogout={handleLogoutRequest}
                      onSync={() => loadAdminData(true)}
                      stats={{ totalCount, submittedCount, draftCount, approvedCount, rejectedCount }}
                      initialData={applications}
                      onRecordDeleted={handleRecordDeleted}
                    />
                  </div>

                  {/* TAB 2: Combined Controls & Subjects Config v2 */}
                  {activeTab === 'controls' && <ControlsAndSubjects />}

                  {/* TAB: Competitive Exam Prep & OMR Registrations Manager */}
                  {activeTab === 'gkTest' && <AdminGkTestManager />}

                  {/* TAB: Student ID Cards Suite */}
                  {activeTab === 'idCards' && (
                    <StudentIdCardManager
                      students={applications}
                      onClose={() => setActiveTab('reports')}
                    />
                  )}

                  {/* TAB 3: Roll No Assignment */}
                  {activeTab === 'rollNo' && (
                    <RollNoAssignment applications={applications} onRefresh={loadAdminData} />
                  )}

                  {/* TAB 4: Bulk Operations & Export */}
                  {activeTab === 'bulk' && <BulkOperations setActiveTab={setActiveTab} />}

                  {/* TAB 5: Automations & Group Email Composer */}
                  {activeTab === 'automations' && <AutomationsPage />}

                  {/* TAB 7: Fund Distribution */}
                  {activeTab === 'funds' && <FundDistribution />}

                  {/* TAB 8: Practicals & Awards */}
                  {activeTab === 'practicals' && <AdminPracticals />}

                  {/* TAB 9: Attendance Management */}
                  {activeTab === 'attendanceMgmt' && <AdminAttendance />}

                  {/* Unified replacement for the former independent Administrative Portal login. */}
                  {activeTab === 'cms' && (
                    <React.Suspense fallback={<ModernLoader moduleKey="cms" text="Loading Website CMS & Administration" />}>
                      <AdministrativeCms embeddedUser={user} onEmbeddedLogout={handleLogoutRequest} />
                    </React.Suspense>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Application Review Modal Popup */}
        {selectedApp && (
          <ApplicationReviewModal
            app={selectedApp}
            onClose={() => setSelectedApp(null)}
            onRefresh={loadAdminData}
          />
        )}
        {/* Logout Confirmation Dialog */}
        <LogoutConfirmModal
          isOpen={showLogoutConfirm}
          onConfirm={onLogout}
          onCancel={() => setShowLogoutConfirm(false)}
          userName={user?.name || user?.email}
        />
      </div>
    </div>
  );
}
