import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, ChevronDown, Wrench, Sliders, ArrowLeft } from 'lucide-react';
import SEO from '../../components/SEO';
import GlobalDataSyncHUD from '../../components/GlobalDataSyncHUD';
import AdminToolsDropdown, { ADMIN_TOOL_MODULES } from './AdminToolsDropdown';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import TabLoadingOverlay from '../../components/TabLoadingOverlay';
import { getCachedCollection, getCachedCollectionSync, subscribeToCollection, getPaginatedCollection, hydrateRemainingPages } from '../../services/dbCache';
import { isBootstrapSuperAdminEmail } from '../../services/staffAuthService';

// Lazy load heavy admin modules to keep tab transitions ultra-fast with zero UI hangs
const AdvancedReports = React.lazy(() => import('./AdvancedReports'));
const ApplicationReviewModal = React.lazy(() => import('./ApplicationReviewModal'));
const CustomRosterDocumentBuilderView = React.lazy(() => import('./CustomRosterDocumentBuilderView'));
const OfficialLetterWriterView = React.lazy(() => import('./OfficialLetterWriterView'));
const StudentCertificateStudioView = React.lazy(() => import('./StudentCertificateStudioView'));
const StudentIdCardManager = React.lazy(() => import('./StudentIdCardManager'));
const AdmissionRegisterSuite = React.lazy(() => import('./AdmissionRegisterSuite'));
const ApplicationMergerStudio = React.lazy(() => import('./ApplicationMergerStudio'));
const ControlsAndSubjects = React.lazy(() => import('./ControlsAndSubjects'));
const AdminPracticals = React.lazy(() => import('./AdminPracticals'));
const AdminAttendance = React.lazy(() => import('./AdminAttendance'));
const AdminGkTestManager = React.lazy(() => import('./AdminGkTestManager'));
const RollNoAssignment = React.lazy(() => import('./RollNoAssignment'));
const AutomationsPage = React.lazy(() => import('./AutomationsPage'));
const FundDistribution = React.lazy(() => import('./FundDistribution'));
const AdministrativeCms = React.lazy(() => import('../../pages/AdminPortal'));

// Only subscribe to the large admissions collection where live mutation is part
// of the workflow. Read-only studios hydrate once and reuse the in-memory data.
const ADMISSIONS_DATA_TABS = new Set([
  'reports',
  'gkTest',
  'admRegisterSuite',
  'idCards',
  'customRoster',
  'docStudio',
  'certStudio',
  'certificate',
  'rollNo',
  'mergeStudio',
  'automations'
]);
const ADMISSIONS_REALTIME_TABS = new Set(['reports', 'rollNo', 'mergeStudio', 'automations']);
const IDENTITY_DATA_TABS = new Set(['gkTest', 'customRoster', 'docStudio', 'certStudio', 'certificate']);


// Helper to read initial activeTab from URL search params, hash or sessionStorage
function getInitialTab() {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const urlTab = searchParams.get('tab');
    if (urlTab) {
      if (urlTab === 'bulk') return 'reports';
      if (urlTab === 'docStudio') {
        const sub = searchParams.get('subtab');
        if (sub === 'letter') return 'officialLetter';
        if (sub === 'certStudio' || sub === 'certificate') return 'certStudio';
        return 'customRoster';
      }
      return urlTab;
    }

    const subtab = searchParams.get('subtab');
    if (subtab === 'letter') return 'officialLetter';
    if (subtab === 'certStudio' || subtab === 'certificate') return 'certStudio';
    if (subtab === 'roster') return 'customRoster';

    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      if (hash === 'bulk') return 'reports';
      if (hash === 'docStudio') return 'customRoster';
      return hash;
    }

    const savedTab = sessionStorage.getItem('hss_admin_active_tab');
    if (savedTab) {
      if (savedTab === 'bulk') return 'reports';
      if (savedTab === 'docStudio') return 'customRoster';
      return savedTab;
    }
  } catch (_) {}
  return 'reports';
}



export default function AdminDashboard() {
  const { user, onLogout } = useOutletContext();

  // Tab State: 'reports' | 'controls' | 'rollNo' | 'bulk' | 'automations' | 'funds' | 'practicals' | 'attendanceMgmt' | 'gkTest' | 'idCards'
  const [activeTab, setActiveTabState] = useState(getInitialTab);

  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem('hss_admin_active_tab', tab);
      const url = new URL(window.location.href);
      if (tab === 'reports') {
        url.searchParams.delete('tab');
        url.searchParams.delete('subtab');
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

  const [isStudioSetupOpen, setIsStudioSetupOpen] = useState(false);

  const [, setCounts] = useState(() => {
    const initialCachedApps = getCachedCollectionSync('admissions');
    return {
      active: initialCachedApps?.length || 0,
      total: initialCachedApps?.length || 0
    };
  });
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [triggerAction, setTriggerAction] = useState(null); // 'analytics' | 'directEntry' | 'bulkTools'
  const [enableQuickCellEdit, setEnableQuickCellEditState] = useState(() => {
    try {
      return localStorage.getItem('hss_quick_cell_edit') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleQuickCellEdit = useCallback((val) => {
    setEnableQuickCellEditState(val);
    try {
      localStorage.setItem('hss_quick_cell_edit', String(val));
    } catch {}
  }, []);

  const dropdownRef = useRef(null);

  // Trigger confirm modal before logging out
  const handleLogoutRequest = () => setShowLogoutConfirm(true);

  useEffect(() => {
    if (!isToolsOpen) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isToolsOpen]);

  // Applications Data State with Instant Cache + Silent Background Sync
  const [loading, setLoading] = useState(() => {
    const cached = getCachedCollectionSync('admissions');
    return ADMISSIONS_DATA_TABS.has(activeTab) && (!cached || cached.length === 0);
  });
  const [applications, setApplications] = useState(() => {
    return getCachedCollectionSync('admissions') || [];
  });
  const [selectedApp, setSelectedApp] = useState(null); // For ApplicationReviewModal
  const appsRef = useRef(applications);
  appsRef.current = applications;
  const hydrationCancelRef = useRef(null);

  const commitApplications = useCallback((list, urgent = false) => {
    if (!Array.isArray(list)) return;
    appsRef.current = list;
    if (urgent) {
      setApplications(list);
      return;
    }
    React.startTransition(() => setApplications(list));
  }, []);

  // Fetch Admin Dashboard Data: instant first-page load + non-blocking background hydration
  const loadAdminData = useCallback(async (force = false, options = {}) => {
    const progressive = options && typeof options === 'object' && options.progressive === true;
    if (typeof hydrationCancelRef.current === 'function') {
      hydrationCancelRef.current();
      hydrationCancelRef.current = null;
    }
    if (appsRef.current.length === 0) {
      setLoading(true);
    }

    const timeoutTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    try {
      // 1. If we have cached data and not forcing, use cached and hydrate in background if needed
      const cached = getCachedCollectionSync('admissions');
      if (cached && cached.length > 0 && !force) {
        commitApplications(cached, true);
        setLoading(false);
      } else {
        // 2. Cold start / force sync: Fetch first 50 applications instantly
        const page1 = await getPaginatedCollection('admissions', 50);
        if (page1.docs && page1.docs.length > 0) {
          commitApplications(page1.docs, true);
          setLoading(false);

          if (page1.hasMore && page1.lastDoc) {
            // 3. Hydrate remaining pages in the background. Document studios
            // receive one completed update instead of re-rendering every batch.
            hydrationCancelRef.current = hydrateRemainingPages(
              'admissions',
              page1.lastDoc,
              page1.docs,
              progressive ? (batch) => commitApplications(batch) : null,
              (completeList) => {
                hydrationCancelRef.current = null;
                commitApplications(completeList);
              }
            );
          }
        } else {
          // Fallback to full fetch if paginated query returns empty
          const fullList = await getCachedCollection('admissions', force, 30 * 60 * 1000);
          if (fullList && Array.isArray(fullList)) {
            commitApplications(fullList);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      clearTimeout(timeoutTimer);
      setLoading(false);
    }
  }, [commitApplications]);

  // Load admissions only for modules that consume them. Lightweight editors
  // (letterhead, controls, CMS, etc.) must never download the entire collection.
  useEffect(() => {
    if (typeof hydrationCancelRef.current === 'function') {
      hydrationCancelRef.current();
      hydrationCancelRef.current = null;
    }

    if (!ADMISSIONS_DATA_TABS.has(activeTab)) {
      setLoading(false);
      return undefined;
    }

    if (!ADMISSIONS_REALTIME_TABS.has(activeTab)) {
      loadAdminData(false, { progressive: false });
      return () => {
        if (typeof hydrationCancelRef.current === 'function') {
          hydrationCancelRef.current();
          hydrationCancelRef.current = null;
        }
      };
    }

    if (typeof subscribeToCollection !== 'function') {
      loadAdminData(false, { progressive: activeTab === 'reports' });
      return undefined;
    }
    let unsubscribe = () => {};
    let receivedSnapshot = false;
    const fallbackTimer = setTimeout(() => {
      if (!receivedSnapshot && appsRef.current.length === 0) {
        loadAdminData(false, { progressive: activeTab === 'reports' });
      }
    }, 2500);
    try {
      unsubscribe = subscribeToCollection('admissions', (liveList) => {
        if (Array.isArray(liveList)) {
          receivedSnapshot = true;
          commitApplications(liveList);
          setLoading(false);
        }
      }, (err) => {
        console.warn('Realtime listener fallback note:', err);
        if (!receivedSnapshot) loadAdminData(false, { progressive: activeTab === 'reports' });
      });
    } catch (err) {
      console.warn('subscribeToCollection initialization note:', err);
      loadAdminData(false, { progressive: activeTab === 'reports' });
    }

    return () => {
      clearTimeout(fallbackTimer);
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof hydrationCancelRef.current === 'function') {
        hydrationCancelRef.current();
        hydrationCancelRef.current = null;
      }
    };
  }, [activeTab, commitApplications, loadAdminData]);

  const identityStudents = useMemo(() => {
    if (!IDENTITY_DATA_TABS.has(activeTab)) return applications;
    const master = getCachedCollectionSync('masterRegisters') || [];
    return [...(applications || []), ...master];
  }, [activeTab, applications]);

  const handleRecordDeleted = (student) => {
    if (!student) return;
    const formNo = String(student?.formNo || student?.['Form No.'] || student?.['Form Number'] || student?.id || '').replace(/^(N\/A|—)$/i, '').trim();
    const rawId = String(student?._docId || student?.docId || student?.id || formNo).replace(/^(N\/A|—)$/i, '').trim();
    const normForm = formNo ? formNo.replace(/[\/\s]/g, '_').toLowerCase() : '';
    const normId = rawId ? rawId.replace(/[\/\s]/g, '_').toLowerCase() : '';

    setApplications(prev => prev.filter(s => {
      if (!s) return false;
      const sId = String(s._docId || s.docId || s.id || '').trim().replace(/[\/\s]/g, '_').toLowerCase();
      if (normId && sId && sId === normId) return false;
      const sf = String(s.formNo || s['Form No.'] || s['Form Number'] || '').replace(/^(N\/A|—)$/i, '').trim();
      const snForm = sf ? sf.replace(/[\/\s]/g, '_').toLowerCase() : '';
      if (normForm && snForm && snForm === normForm) return false;
      return true;
    }));
  };

  // Check if a specific tab/module is permitted for the logged-in user
  const isTabPermitted = (tabId) => {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase().trim();
    const email = String(user.email || '').toLowerCase().trim();
    
    // Genuine SuperAdmins have unconditional access to all modules
    if (
      role === 'superadmin' || 
      isBootstrapSuperAdminEmail(email)
    ) {
      return true;
    }

    // For Admin and sub-admin accounts, strictly evaluate assigned perms array
    const perms = Array.isArray(user.perms) ? user.perms : [];
    if (perms.includes('*')) return true;
    if (perms.length > 0) {
      if (tabId === 'customRoster' || tabId === 'officialLetter' || tabId === 'certStudio' || tabId === 'docStudio') {
        return perms.includes('docStudio') || perms.includes('customRoster') || perms.includes('officialLetter') || perms.includes('certStudio') || perms.includes('certificate');
      }
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

  // Calculate all counters in one pass rather than scanning the full cohort five times.
  const { totalCount, approvedCount, submittedCount, draftCount, rejectedCount } = useMemo(() => {
    const next = {
      totalCount: applications.length,
      approvedCount: 0,
      submittedCount: 0,
      draftCount: 0,
      rejectedCount: 0
    };
    if (activeTab !== 'reports') return next;
    applications.forEach((application) => {
      if (hasClassRollVal(application)) {
        next.approvedCount += 1;
        return;
      }
      if (application?.Status === 'Submitted') next.submittedCount += 1;
      else if (application?.Status === 'Rejected') next.rejectedCount += 1;
      else if (application?.Status === 'Draft' || !application?.Status) next.draftCount += 1;
    });
    return next;
  }, [activeTab, applications]);

  const TOOL_MODULES = ADMIN_TOOL_MODULES;

  return (
    <div className="admin-dashboard-theme w-full min-h-[85vh] py-0.5 sm:py-1 px-1 sm:px-2" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Admin Dashboard | HSS Shangus"
        description="Comprehensive Super Admin Panel for managing student applications, roll numbers, fee structures, and automations."
      />

      <div className="w-full max-w-[1750px] mx-auto space-y-0.5">
        {/* Global Firestore Data Synchronization & Network Status Ribbon */}
        <div className="no-print">
          <GlobalDataSyncHUD
            isActive={loading}
            recordCount={applications.length}
          />
        </div>

        {/* Workspace Card */}
        <div className="rounded-xl p-0.5 sm:p-1 border shadow-sm space-y-1" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          {/* Navigation Tabs Dynamic Toolbar (For non-reports tabs) */}
          {activeTab !== 'reports' && (() => {
            const currentModule = TOOL_MODULES.find(m => m.id === activeTab) || { id: activeTab, label: 'Admin Tool', icon: Wrench };
            const CurrentIcon = currentModule.icon;
            return (
              <div className="no-print flex items-center justify-between gap-1.5 p-1.5 rounded-xl border text-xs font-bold flex-wrap md:flex-nowrap bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xs">
                
                {/* Left Slot: Navigation Back to Records + Active Module Title */}
                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 order-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-300 font-bold text-[11px] sm:text-xs shadow-2xs transition-all cursor-pointer group"
                    title="Return to Student Records & Reports"
                  >
                    <ArrowLeft size={12} className="text-slate-500 group-hover:text-teal-600 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="hidden sm:inline font-bold">Records</span>
                  </button>

                  <span className="text-slate-400 dark:text-slate-600 font-bold text-xs">/</span>

                  <div className="flex min-w-0 items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-xs font-black bg-gradient-to-r from-teal-50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-900 border-teal-200/80 dark:border-slate-700 shrink-0 shadow-2xs">
                    <div className="w-4 h-4 rounded-md bg-teal-600 text-white flex items-center justify-center shadow-xs">
                      <CurrentIcon size={11} />
                    </div>
                    <span className="truncate text-teal-950 dark:text-teal-100 font-black">{currentModule.label}</span>
                  </div>
                </div>

                {/* Right Slot: Setup Button (for certStudio/officialLetter) + Admin Tools Dropdown Button */}
                <div className="flex shrink-0 items-center gap-1.5 order-2 md:order-3 ml-auto">
                  {/* Setup / Configuration Button */}
                  {(activeTab === 'officialLetter' || activeTab === 'certStudio' || activeTab === 'certificate') && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsStudioSetupOpen(prev => !prev);
                        window.dispatchEvent(new CustomEvent('hss-toggle-studio-setup'));
                      }}
                      className={`h-8 px-2.5 sm:px-3 rounded-lg border font-black text-xs cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 shrink-0 ${
                        isStudioSetupOpen
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title="Configure Official Letterhead, Signatories, Ref No & Margins"
                    >
                      <Sliders size={12} className={isStudioSetupOpen ? 'text-amber-600' : 'text-slate-500'} />
                      <span>Setup</span>
                    </button>
                  )}

                  {/* Administrative Tools Switcher Dropdown (Positioned on Right Side) */}
                  <div className="relative inline-block text-left" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsToolsOpen(!isToolsOpen)}
                      title="Switch Administrative Tool / Module"
                      className="flex h-8 items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 text-purple-900 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-all cursor-pointer shadow-2xs font-black text-xs group"
                    >
                      <div className="w-5 h-5 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                        <Wrench size={13} />
                      </div>
                      <span className="tracking-tight font-black">Modules</span>
                      <ChevronDown size={14} className="text-purple-600 dark:text-purple-400 group-hover:translate-y-0.5 transition-transform ml-0.5" />
                    </button>

                    <AdminToolsDropdown
                      isOpen={isToolsOpen}
                      setIsOpen={setIsToolsOpen}
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      user={user}
                      onOpenCustomRoster={() => setActiveTab('customRoster')}
                      onOpenAnalytics={() => {
                        setActiveTab('reports');
                        setTriggerAction('analytics');
                      }}
                      onOpenDirectEntry={() => {
                        setActiveTab('reports');
                        setTriggerAction('directEntry');
                      }}
                      onOpenBulkTools={() => {
                        setActiveTab('reports');
                        setTriggerAction('bulkTools');
                      }}
                      enableQuickCellEdit={enableQuickCellEdit}
                      setEnableQuickCellEdit={handleToggleQuickCellEdit}
                      align="right"
                    />
                  </div>
                </div>
              </div>
            );
          })()}

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
                <React.Suspense fallback={<TabLoadingOverlay moduleKey={activeTab} />}>
                  {/* TAB 1: Master Register & Database */}
                  {activeTab === 'reports' && (
                    <AdvancedReports
                      setActiveTab={setActiveTab}
                      setCounts={setCounts}
                      user={user}
                      onLogout={handleLogoutRequest}
                      onSync={() => loadAdminData(true)}
                      stats={{ totalCount, submittedCount, draftCount, approvedCount, rejectedCount }}
                      initialData={applications}
                      onRecordDeleted={handleRecordDeleted}
                      triggerAction={triggerAction}
                      onTriggerActionHandled={() => setTriggerAction(null)}
                      enableQuickCellEdit={enableQuickCellEdit}
                      setEnableQuickCellEdit={handleToggleQuickCellEdit}
                    />
                  )}

                  {/* TAB 2: Combined Controls & Subjects Config v2 */}
                  {activeTab === 'controls' && <ControlsAndSubjects />}

                  {/* TAB: Competitive Exam Prep & OMR Registrations Manager */}
                  {activeTab === 'gkTest' && (
                    <AdminGkTestManager
                      allStudents={identityStudents || applications}
                      onRefresh={loadAdminData}
                    />
                  )}

                  {/* TAB: Admission Register & Sentup Suite */}
                  {activeTab === 'admRegisterSuite' && (
                    <AdmissionRegisterSuite
                      students={applications}
                      allHistory={getCachedCollectionSync('masterRegisters') || []}
                      onClose={() => setActiveTab('reports')}
                      onDataUpdated={() => loadAdminData(true)}
                      user={user}
                    />
                  )}

                  {/* TAB: Student ID Cards Suite */}
                  {activeTab === 'idCards' && (
                    <StudentIdCardManager
                      students={applications}
                      onClose={() => setActiveTab('reports')}
                    />
                  )}

                  {/* TAB: Student Roster & Registers Studio */}
                  {(activeTab === 'customRoster' || activeTab === 'docStudio') && (
                    <CustomRosterDocumentBuilderView
                      allStudents={identityStudents}
                      onClose={() => setActiveTab('reports')}
                    />
                  )}

                  {/* TAB: Official Letterhead Writer */}
                  {activeTab === 'officialLetter' && (
                    <OfficialLetterWriterView
                      onClose={() => setActiveTab('reports')}
                      showSettingsDrawerProp={isStudioSetupOpen}
                      onToggleSettingsDrawer={() => setIsStudioSetupOpen(prev => !prev)}
                    />
                  )}

                  {/* TAB: Student Bonafides & Certificates Studio */}
                  {(activeTab === 'certStudio' || activeTab === 'certificate') && (
                    <StudentCertificateStudioView
                      allStudents={identityStudents}
                      identityStudents={identityStudents}
                      onClose={() => setActiveTab('reports')}
                      showSettingsDrawerProp={isStudioSetupOpen}
                      onToggleSettingsDrawer={() => setIsStudioSetupOpen(prev => !prev)}
                    />
                  )}

                  {/* TAB 3: Roll No Assignment */}
                  {activeTab === 'rollNo' && (
                    <RollNoAssignment applications={applications} onRefresh={loadAdminData} />
                  )}

                  {/* TAB: Application Merger & Deduplication Studio */}
                  {activeTab === 'mergeStudio' && (
                    <ApplicationMergerStudio
                      applications={applications}
                      onRefresh={loadAdminData}
                      onClose={() => setActiveTab('reports')}
                    />
                  )}

                  {/* TAB 5: Automations & Group Email Composer */}
                  {activeTab === 'automations' && (
                    <AutomationsPage applications={applications} user={user} />
                  )}

                  {/* TAB 7: Fund Distribution */}
                  {activeTab === 'funds' && <FundDistribution />}

                  {/* TAB 8: Practicals & Awards */}
                  {activeTab === 'practicals' && <AdminPracticals />}

                  {/* TAB 9: Attendance Management */}
                  {activeTab === 'attendanceMgmt' && <AdminAttendance />}

                  {/* Unified replacement for the former independent Administrative Portal login. */}
                  {activeTab === 'cms' && (
                    <AdministrativeCms embeddedUser={user} onEmbeddedLogout={handleLogoutRequest} />
                  )}
                </React.Suspense>
              )}
        </div>

        {/* Application Review Modal Popup */}
        {selectedApp && (
          <React.Suspense fallback={null}>
            <ApplicationReviewModal
              app={selectedApp}
              onClose={() => setSelectedApp(null)}
              onRefresh={loadAdminData}
            />
          </React.Suspense>
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
