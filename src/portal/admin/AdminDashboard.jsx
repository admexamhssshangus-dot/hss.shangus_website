import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, ChevronDown, Wrench, Sliders, ArrowLeft, RefreshCw } from 'lucide-react';
import SEO from '../../components/SEO';
import GlobalDataSyncHUD from '../../components/GlobalDataSyncHUD';
import AdminToolsDropdown, { ADMIN_TOOL_MODULES, isUserPermittedForModule } from './AdminToolsDropdown';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import TabLoadingOverlay from '../../components/TabLoadingOverlay';
import ModuleErrorBoundary from '../../components/ModuleErrorBoundary';
import { lazyWithChunkRecovery } from '../../utils/lazyWithChunkRecovery';
import { getCachedCollection, getCachedCollectionSync, subscribeToCollection, getPaginatedCollection, hydrateRemainingPages, ensureFirestoreConnected } from '../../services/dbCache';
import { isBootstrapSuperAdminEmail } from '../../services/staffAuthService';
import { showToast } from '../../components/common/GlobalToast';

// Resilient lazy load of heavy admin modules with automated chunk recovery & retry
const AdvancedReports = lazyWithChunkRecovery(() => import('./AdvancedReports'), 'admin-reports');
const ApplicationReviewModal = lazyWithChunkRecovery(() => import('./ApplicationReviewModal'), 'admin-review-modal');
const CustomRosterDocumentBuilderView = lazyWithChunkRecovery(() => import('./CustomRosterDocumentBuilderView'), 'admin-roster');
const OfficialLetterWriterView = lazyWithChunkRecovery(() => import('./OfficialLetterWriterView'), 'admin-letter');
const StudentCertificateStudioView = lazyWithChunkRecovery(() => import('./StudentCertificateStudioView'), 'admin-certificate');
const StudentIdCardManager = lazyWithChunkRecovery(() => import('./StudentIdCardManager'), 'admin-id-cards');
const AdmissionRegisterSuite = lazyWithChunkRecovery(() => import('./AdmissionRegisterSuite'), 'admin-register-suite');
const ApplicationMergerStudio = lazyWithChunkRecovery(() => import('./ApplicationMergerStudio'), 'admin-merger');
const ControlsAndSubjects = lazyWithChunkRecovery(() => import('./ControlsAndSubjects'), 'admin-controls');
const CurriculumAndSubjectsManager = lazyWithChunkRecovery(() => import('./CurriculumAndSubjectsManager'), 'admin-curriculum');
const StaffPermissionsManager = lazyWithChunkRecovery(() => import('./StaffPermissionsManager'), 'admin-staff');
const AdminPracticals = lazyWithChunkRecovery(() => import('./AdminPracticals'), 'admin-practicals');
const AdminAttendance = lazyWithChunkRecovery(() => import('./AdminAttendance'), 'admin-attendance');
const AdminGkTestManager = lazyWithChunkRecovery(() => import('./AdminGkTestManager'), 'admin-gk-test');
const RollNoAssignment = lazyWithChunkRecovery(() => import('./RollNoAssignment'), 'admin-roll-no');
const AutomationsPage = lazyWithChunkRecovery(() => import('./AutomationsPage'), 'admin-automations');
const FundDistribution = lazyWithChunkRecovery(() => import('./FundDistribution'), 'admin-fund-dist');
const SchoolAccountsManager = lazyWithChunkRecovery(() => import('./SchoolAccountsManager'), 'admin-accounts');
const AdministrativeCms = lazyWithChunkRecovery(() => import('../../pages/AdminPortal'), 'admin-cms');
const ActivityAuditView = lazyWithChunkRecovery(() => import('./ActivityAuditView'), 'admin-activity-audit');

// Module Loaders Map for High-Speed Dynamic Chunk Prefetching
export const MODULE_LOADERS = {
  reports: () => import('./AdvancedReports'),
  customRoster: () => import('./CustomRosterDocumentBuilderView'),
  docStudio: () => import('./CustomRosterDocumentBuilderView'),
  officialLetter: () => import('./OfficialLetterWriterView'),
  certStudio: () => import('./StudentCertificateStudioView'),
  certificate: () => import('./StudentCertificateStudioView'),
  idCards: () => import('./StudentIdCardManager'),
  admRegisterSuite: () => import('./AdmissionRegisterSuite'),
  mergeStudio: () => import('./ApplicationMergerStudio'),
  controls: () => import('./ControlsAndSubjects'),
  admissionControls: () => import('./ControlsAndSubjects'),
  systemControls: () => import('./ControlsAndSubjects'),
  curriculum: () => import('./CurriculumAndSubjectsManager'),
  subjects: () => import('./CurriculumAndSubjectsManager'),
  streams: () => import('./CurriculumAndSubjectsManager'),
  feederSchools: () => import('./CurriculumAndSubjectsManager'),
  staff: () => import('./StaffPermissionsManager'),
  permissions: () => import('./StaffPermissionsManager'),
  staffPermissions: () => import('./StaffPermissionsManager'),
  adminMgmt: () => import('./StaffPermissionsManager'),
  practicals: () => import('./AdminPracticals'),
  attendanceMgmt: () => import('./AdminAttendance'),
  gkTest: () => import('./AdminGkTestManager'),
  rollNo: () => import('./RollNoAssignment'),
  automations: () => import('./AutomationsPage'),
  funds: () => import('./FundDistribution'),
  accounts: () => import('./SchoolAccountsManager'),
  cms: () => import('../../pages/AdminPortal'),
  heroButtons: () => import('../../pages/AdminPortal'),
  activityAudit: () => import('./ActivityAuditView'),
};

export const prefetchAdminModule = (moduleId) => {
  if (!moduleId) return;
  const loader = MODULE_LOADERS[moduleId];
  if (typeof loader === 'function') {
    try {
      loader().catch(() => {});
    } catch (_) {}
  }
};

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
      if (urlTab === 'bulk' || urlTab === 'boardSync') return 'reports';
      if (urlTab === 'curriculum' || urlTab === 'subjects' || urlTab === 'streams' || urlTab === 'feederSchools') return 'curriculum';
      if (urlTab === 'staff' || urlTab === 'permissions' || urlTab === 'staffPermissions') return 'staff';
      if (urlTab === 'controls' || urlTab === 'admissionControls' || urlTab === 'systemControls') return 'controls';
      if (urlTab === 'docStudio') {
        const sub = searchParams.get('subtab');
        if (sub === 'letter') return 'officialLetter';
        if (sub === 'cert') return 'certStudio';
        return 'customRoster';
      }
      return urlTab;
    }
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== 'portal') return hash;
    const stored = sessionStorage.getItem('hss_admin_active_tab');
    if (stored) {
      if (stored === 'bulk' || stored === 'boardSync') return 'reports';
      if (stored === 'curriculum' || stored === 'subjects' || stored === 'streams' || stored === 'feederSchools') return 'curriculum';
      if (stored === 'staff' || stored === 'permissions' || stored === 'staffPermissions') return 'staff';
      if (stored === 'controls' || stored === 'admissionControls' || stored === 'systemControls') return 'controls';
      if (stored === 'docStudio') return 'customRoster';
      return stored;
    }
  } catch (_) {}
  return 'reports';
}



export default function AdminDashboard() {
  const { user, onLogout } = useOutletContext();

  // Tab State: 'reports' | 'controls' | 'rollNo' | 'bulk' | 'automations' | 'funds' | 'practicals' | 'attendanceMgmt' | 'gkTest' | 'idCards'
  const [activeTab, setActiveTabState] = useState(getInitialTab);

  // Keep-Alive Architecture: All opened modules remain mounted in the DOM.
  // Switching between any visited module takes 0ms with zero DOM reconstruction,
  // preserving scroll positions, filter queries, modal setups and local UI state.
  const [mountedTabs, setMountedTabs] = useState(() => {
    const init = getInitialTab();
    const set = new Set(['reports']);
    if (init) set.add(init);
    return set;
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Idle-time background prefetching of high-priority admin modules
  useEffect(() => {
    const idlePrefetch = () => {
      const commonModules = ['controls', 'practicals', 'idCards', 'admRegisterSuite', 'attendanceMgmt'];
      commonModules.forEach((modId) => {
        if (isUserPermittedForModule(user, modId)) {
          prefetchAdminModule(modId);
        }
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(idlePrefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(idleId);
    } else {
      const timer = setTimeout(idlePrefetch, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const setActiveTab = useCallback((tab) => {
    if (!tab) return;
    if (tab === 'boardSync') {
      setMountedTabs(prev => {
        if (prev.has('reports')) return prev;
        const next = new Set(prev);
        next.add('reports');
        return next;
      });
      setActiveTabState('reports');
      setTriggerAction('boardSync');
      try {
        sessionStorage.setItem('hss_admin_active_tab', 'reports');
        const url = new URL(window.location.href);
        url.searchParams.delete('tab');
        url.searchParams.delete('subtab');
        window.history.replaceState(null, '', url.toString());
      } catch (_) {}
      return;
    }
    if (tab === activeTab) return;

    // Trigger instant chunk prefetch
    prefetchAdminModule(tab);

    const syncUrl = (targetTab) => {
      try {
        sessionStorage.setItem('hss_admin_active_tab', targetTab);
        const url = new URL(window.location.href);
        if (targetTab === 'reports') {
          url.searchParams.delete('tab');
          url.searchParams.delete('subtab');
        } else {
          url.searchParams.set('tab', targetTab);
        }
        window.history.replaceState(null, '', url.toString());
      } catch (_) {}
    };

    syncUrl(tab);

    // If tab is already mounted, switch is instantaneous (0ms) without any artificial delays!
    if (mountedTabs.has(tab)) {
      React.startTransition(() => {
        setActiveTabState(tab);
      });
      return;
    }

    // Otherwise, register it in mountedTabs and transition smoothly
    setMountedTabs(prev => {
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    React.startTransition(() => {
      setActiveTabState(tab);
    });
  }, [activeTab, mountedTabs]);

  // Handle browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const tab = getInitialTab();
      if (tab) {
        setMountedTabs(prev => {
          if (prev.has(tab)) return prev;
          const next = new Set(prev);
          next.add(tab);
          return next;
        });
        setActiveTabState(tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  // Auto-route to the first permitted module if current activeTab is not permitted for this user
  useEffect(() => {
    if (!user) return;
    if (!isUserPermittedForModule(user, activeTab)) {
      const firstPermitted = ADMIN_TOOL_MODULES.find(m => isUserPermittedForModule(user, m.id));
      if (firstPermitted && firstPermitted.id !== activeTab) {
        setActiveTab(firstPermitted.id);
      }
    }
  }, [user, activeTab, setActiveTab]);

  const [isStudioSetupOpen, setIsStudioSetupOpen] = useState(false);

  // Automatically reset Studio Setup drawer/modal state when switching tabs
  useEffect(() => {
    setIsStudioSetupOpen(false);
  }, [activeTab]);

  const [, setCounts] = useState(() => {
    const initialCachedApps = getCachedCollectionSync('admissions');
    return {
      active: initialCachedApps?.length || 0,
      total: initialCachedApps?.length || 0
    };
  });
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [triggerAction, setTriggerAction] = useState(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('tab') === 'boardSync') return 'boardSync';
    } catch (_) {}
    return null;
  }); // 'analytics' | 'directEntry' | 'bulkTools' | 'boardSync'
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

  // Auto-heal stuck UI states on tab wake-up or focus; reconnect network only on actual online event
  useEffect(() => {
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        setLoading(false);
      }
    };
    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);
    window.addEventListener('online', ensureFirestoreConnected);
    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('online', ensureFirestoreConnected);
    };
  }, []);

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
    if (force) {
      setIsSyncing(true);
    }

    const timeoutTimer = setTimeout(() => {
      setLoading(false);
      setIsSyncing(false);
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
                if (force) {
                  showToast('Cloud database synchronized successfully', 'success');
                }
              }
            );
          } else if (force) {
            showToast('Cloud database synchronized successfully', 'success');
          }
        } else {
          // Fallback to full fetch if paginated query returns empty
          const fullList = await getCachedCollection('admissions', force, 30 * 60 * 1000);
          if (fullList && Array.isArray(fullList)) {
            commitApplications(fullList);
            if (force) {
              showToast('Cloud database synchronized successfully', 'success');
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
      if (force) {
        showToast('Failed to sync cloud database. Please check your connection.', 'error');
      }
    } finally {
      clearTimeout(timeoutTimer);
      setLoading(false);
      setIsSyncing(false);
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
    const master = getCachedCollectionSync('masterRegisters') || [];
    if (!master.length) return applications || [];
    return [...(applications || []), ...master];
  }, [applications]);

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
  const isTabPermitted = useCallback((tabId) => {
    return isUserPermittedForModule(user, tabId);
  }, [user]);

  // Helper to test if student has a valid assigned Class Roll Number
  const hasClassRollVal = (a) => {
    if (!a) return false;
    const roll = String(a['Class Roll No'] || a['Class Roll No.'] || a['RL. NO.'] || a['RL. NO'] || a['Class R.No.'] || a['Class R.No'] || a.classRollNo || a.rollNo || a.roll || '').trim();
    return !!(roll && roll !== '—' && roll !== 'N/A' && roll !== 'null' && roll !== 'undefined');
  };

  // Calculate all counters in one pass rather than scanning the full cohort five times.
  const stats = useMemo(() => {
    const next = {
      totalCount: applications.length,
      approvedCount: 0,
      submittedCount: 0,
      draftCount: 0,
      rejectedCount: 0
    };
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
  }, [applications]);

  const TOOL_MODULES = ADMIN_TOOL_MODULES;

  return (
    <div className="portal-page admin-dashboard-theme w-full min-h-[85vh] py-0.5 sm:py-1 px-1 sm:px-2" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
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
        {/* Workspace Card */}
        <div className="rounded-lg sm:rounded-xl p-0 sm:p-1 border-0 sm:border shadow-none sm:shadow-sm space-y-0.5 sm:space-y-1" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          {/* Navigation Tabs Dynamic Toolbar (For non-reports tabs) */}
          {activeTab !== 'reports' && (() => {
            const currentModule = TOOL_MODULES.find(m => m.id === activeTab || (Array.isArray(m.aliases) && m.aliases.includes(activeTab))) || { id: activeTab, label: 'Admin Tool', shortLabel: 'Admin Tool', icon: Wrench };
            const CurrentIcon = currentModule.icon;
            const displayLabel = currentModule.shortLabel || currentModule.label;
            return (
              <div className={`no-print flex items-center justify-between gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-0 sm:py-1 h-7 sm:h-8 rounded-lg sm:rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-xs font-bold shadow-2xs w-full min-w-0 flex-nowrap overflow-hidden relative ${isToolsOpen ? 'z-[99999]' : 'z-20'}`}>
                
                {/* Left Slot: Navigation Back to Records + Active Module Title */}
                <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 flex-1 mr-1">
                  {isTabPermitted('reports') && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveTab('reports')}
                        className="flex items-center justify-center h-6 w-6 sm:h-7 sm:w-auto p-0 sm:px-2 rounded sm:rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-300 font-bold text-[10px] sm:text-xs shadow-2xs transition-all cursor-pointer group shrink-0 active:scale-95"
                        title="Return to Student Records & Reports"
                        aria-label="Return to Records"
                      >
                        <ArrowLeft size={11} className="sm:hidden text-slate-500 group-hover:text-teal-600 transition-transform" />
                        <ArrowLeft size={12} className="hidden sm:inline text-slate-500 group-hover:text-teal-600 group-hover:-translate-x-0.5 transition-transform" />
                        <span className="hidden sm:inline font-bold ml-1 text-xs">Records</span>
                      </button>

                      <span className="hidden sm:inline text-slate-300 dark:text-slate-700 font-bold text-xs select-none">/</span>
                    </>
                  )}

                  {/* Active Module Title Pill */}
                  <div
                    onClick={() => {
                      if (window.innerWidth < 640) {
                        setIsToolsOpen(prev => !prev);
                      }
                    }}
                    className="flex min-w-0 items-center gap-1 sm:gap-1.5 h-6 sm:h-7 px-1.5 sm:px-2.5 py-0 rounded sm:rounded-lg border border-teal-200/80 dark:border-slate-700 bg-gradient-to-r from-teal-50/80 to-indigo-50/40 dark:from-slate-900 dark:to-slate-900 text-teal-950 dark:text-teal-100 shadow-2xs cursor-pointer sm:cursor-default max-w-full"
                    title={currentModule.label}
                  >
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <CurrentIcon size={8.5} className="sm:hidden" />
                      <CurrentIcon size={11} className="hidden sm:block" />
                    </div>
                    <span className="truncate font-bold text-[9.5px] sm:text-xs leading-tight">
                      <span className="sm:hidden">{displayLabel}</span>
                      <span className="hidden sm:inline">{currentModule.label}</span>
                    </span>
                  </div>
                </div>

                {/* Right Slot: On-Demand Cloud Sync + Setup Button + Admin Tools Dropdown Button */}
                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 ml-auto">
                  {/* On-Demand Cloud Sync Button (For all modules that consume admissions data) */}
                  {ADMISSIONS_DATA_TABS.has(activeTab) && (
                    <button
                      type="button"
                      onClick={() => loadAdminData(true, { progressive: true })}
                      disabled={isSyncing || loading}
                      className="flex h-6 sm:h-7 items-center gap-1 px-1.5 sm:px-2 rounded sm:rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50/70 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 transition-all cursor-pointer shadow-2xs font-bold text-[9.5px] sm:text-xs shrink-0 disabled:opacity-60 active:scale-95"
                      title="Sync and refresh data from cloud database"
                    >
                      <RefreshCw size={11} className={`${isSyncing ? 'animate-spin text-teal-600' : 'text-teal-700 dark:text-teal-300'}`} />
                      <span className="hidden md:inline font-bold">Sync</span>
                    </button>
                  )}

                  {/* Setup / Configuration Button (Shown on sm+ screens; each module has its own focused mobile setup) */}
                  {(activeTab === 'officialLetter' || activeTab === 'certStudio' || activeTab === 'certificate' || activeTab === 'customRoster' || activeTab === 'docStudio') && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isStudioSetupOpen;
                        setIsStudioSetupOpen(nextState);
                        window.dispatchEvent(new CustomEvent('hss-toggle-studio-setup', {
                          detail: { targetModule: activeTab, open: nextState }
                        }));
                      }}
                      className={`hidden sm:flex h-7 px-2 rounded-lg border font-bold text-xs cursor-pointer transition-all shadow-2xs items-center gap-1 active:scale-95 shrink-0 ${
                        isStudioSetupOpen
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title="Configure Options, Filters, Signatories & Layout"
                    >
                      <Sliders size={11} className={isStudioSetupOpen ? 'text-amber-600' : 'text-slate-500'} />
                      <span>Setup</span>
                    </button>
                  )}

                  {/* Administrative Tools Switcher Dropdown (Positioned on Right Side) */}
                  <div className="relative inline-block text-left" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsToolsOpen(!isToolsOpen)}
                      onMouseEnter={() => {
                        prefetchAdminModule('reports');
                        prefetchAdminModule('customRoster');
                        prefetchAdminModule('idCards');
                        prefetchAdminModule('admRegisterSuite');
                        prefetchAdminModule('controls');
                      }}
                      title="Switch Administrative Tool / Module"
                      className="flex h-6 sm:h-7 items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 rounded sm:rounded-lg border border-purple-300/80 dark:border-purple-800/80 bg-purple-50/70 dark:bg-purple-950/60 sm:bg-white sm:dark:bg-slate-900 text-purple-900 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all cursor-pointer shadow-2xs font-bold text-[9.5px] sm:text-xs group shrink-0 active:scale-95"
                    >
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                        <Wrench size={8.5} className="sm:hidden" />
                        <Wrench size={11} className="hidden sm:block" />
                      </div>
                      <span className="tracking-tight font-bold text-[9.5px] sm:text-xs">Modules</span>
                      <ChevronDown size={9} className="sm:hidden text-purple-600 dark:text-purple-400 group-hover:translate-y-0.5 transition-transform" />
                      <ChevronDown size={11} className="hidden sm:inline text-purple-600 dark:text-purple-400 group-hover:translate-y-0.5 transition-transform ml-0.5" />
                    </button>

                    <AdminToolsDropdown
                      isOpen={isToolsOpen}
                      setIsOpen={setIsToolsOpen}
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      user={user}
                      onPrefetchModule={prefetchAdminModule}
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
                      onOpenBoardSync={() => {
                        setMountedTabs(prev => new Set(prev).add('reports'));
                        setActiveTab('reports');
                        setTriggerAction('boardSync');
                      }}
                      onOpenGoogleContacts={() => {
                        setMountedTabs(prev => new Set(prev).add('reports'));
                        setActiveTab('reports');
                        setTriggerAction('googleContacts');
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
              {(() => {
                const firstPermitted = ADMIN_TOOL_MODULES.find(m => isTabPermitted(m.id));
                if (!firstPermitted) return null;
                return (
                  <button
                    type="button"
                    onClick={() => setActiveTab(firstPermitted.id)}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-700 hover:bg-indigo-600 cursor-pointer shadow-md transition-colors"
                  >
                    Go to Permitted Module ({firstPermitted.label})
                  </button>
                );
              })()}
            </div>
          ) : (
            <div className="block w-full">
              <ModuleErrorBoundary resetKey={activeTab}>
                <React.Suspense fallback={<TabLoadingOverlay moduleKey={activeTab} />}>
                  {/* TAB 1: Master Register & Database (Kept mounted to eliminate tab-switch stalls and preserve scroll/search/filter state) */}
                  {mountedTabs.has('reports') && (
                    <div
                      key="master-records-reports-container"
                      className={activeTab === 'reports' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'reports' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'reports'}
                    >
                      <AdvancedReports
                        setActiveTab={setActiveTab}
                        setCounts={setCounts}
                        user={user}
                        onLogout={handleLogoutRequest}
                        onSync={() => loadAdminData(true)}
                        stats={stats}
                        initialData={applications}
                        onRecordDeleted={handleRecordDeleted}
                        triggerAction={triggerAction}
                        onTriggerActionHandled={() => setTriggerAction(null)}
                        enableQuickCellEdit={enableQuickCellEdit}
                        setEnableQuickCellEdit={handleToggleQuickCellEdit}
                        isActive={activeTab === 'reports'}
                        onPrefetchModule={prefetchAdminModule}
                      />
                    </div>
                  )}

                  {/* TAB 2: System & Admission Controls */}
                  {mountedTabs.has('controls') && (
                    <div
                      key="controls-container"
                      className={activeTab === 'controls' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'controls' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'controls'}
                    >
                      <ControlsAndSubjects />
                    </div>
                  )}

                  {/* TAB: Subjects, Streams & Feeder Schools */}
                  {(mountedTabs.has('curriculum') || mountedTabs.has('subjects')) && (
                    <div
                      key="curriculum-container"
                      className={(activeTab === 'curriculum' || activeTab === 'subjects') ? 'block w-full' : 'hidden'}
                      style={(activeTab === 'curriculum' || activeTab === 'subjects') ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'curriculum' && activeTab !== 'subjects'}
                    >
                      <CurriculumAndSubjectsManager />
                    </div>
                  )}

                  {/* TAB: Staff & Permissions */}
                  {(mountedTabs.has('staff') || mountedTabs.has('permissions')) && (
                    <div
                      key="staff-container"
                      className={(activeTab === 'staff' || activeTab === 'permissions') ? 'block w-full' : 'hidden'}
                      style={(activeTab === 'staff' || activeTab === 'permissions') ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'staff' && activeTab !== 'permissions'}
                    >
                      <StaffPermissionsManager />
                    </div>
                  )}

                  {/* TAB: Homepage Hero Action Buttons (Integrated in CMS) */}
                  {mountedTabs.has('heroButtons') && (
                    <div
                      key="hero-buttons-container"
                      className={activeTab === 'heroButtons' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'heroButtons' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'heroButtons'}
                    >
                      <AdministrativeCms embeddedUser={user} onEmbeddedLogout={handleLogoutRequest} initialTab="hero_buttons" />
                    </div>
                  )}

                  {/* TAB: Competitive Exam Prep & OMR Registrations Manager */}
                  {mountedTabs.has('gkTest') && (
                    <div
                      key="gk-test-container"
                      className={activeTab === 'gkTest' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'gkTest' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'gkTest'}
                    >
                      <AdminGkTestManager
                        allStudents={identityStudents || applications}
                        onRefresh={loadAdminData}
                      />
                    </div>
                  )}

                  {/* TAB: Admission Register & Sentup Suite */}
                  {mountedTabs.has('admRegisterSuite') && (
                    <div
                      key="adm-register-suite-container"
                      className={activeTab === 'admRegisterSuite' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'admRegisterSuite' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'admRegisterSuite'}
                    >
                      <AdmissionRegisterSuite
                        students={applications}
                        allHistory={getCachedCollectionSync('masterRegisters') || []}
                        onClose={() => setActiveTab('reports')}
                        onDataUpdated={() => loadAdminData(true)}
                        user={user}
                      />
                    </div>
                  )}

                  {/* TAB: Student ID Cards Suite */}
                  {mountedTabs.has('idCards') && (
                    <div
                      key="id-cards-container"
                      className={activeTab === 'idCards' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'idCards' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'idCards'}
                    >
                      <StudentIdCardManager
                        students={applications}
                        onClose={() => setActiveTab('reports')}
                      />
                    </div>
                  )}

                  {/* TAB: Student Roster & Registers Studio (Kept mounted once opened to eliminate tab-switch stalls and preserve document setup) */}
                  {(mountedTabs.has('customRoster') || mountedTabs.has('docStudio')) && (
                    <div
                      key="student-roster-registers-container"
                      className={(activeTab === 'customRoster' || activeTab === 'docStudio') ? 'block w-full' : 'hidden'}
                      style={(activeTab === 'customRoster' || activeTab === 'docStudio') ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'customRoster' && activeTab !== 'docStudio'}
                    >
                      <CustomRosterDocumentBuilderView
                        allStudents={identityStudents}
                        onClose={() => setActiveTab('reports')}
                        isActive={activeTab === 'customRoster' || activeTab === 'docStudio'}
                        showSettingsDrawerProp={isStudioSetupOpen}
                        onToggleSettingsDrawer={(val) => setIsStudioSetupOpen(typeof val === 'boolean' ? val : !isStudioSetupOpen)}
                      />
                    </div>
                  )}

                  {/* TAB: Official Letterhead Writer */}
                  {mountedTabs.has('officialLetter') && (
                    <div
                      key="official-letter-container"
                      className={activeTab === 'officialLetter' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'officialLetter' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'officialLetter'}
                    >
                      <OfficialLetterWriterView
                        onClose={() => setActiveTab('reports')}
                        onSwitchToRoster={() => setActiveTab('customRoster')}
                        showSettingsDrawerProp={isStudioSetupOpen}
                        onToggleSettingsDrawer={(val) => setIsStudioSetupOpen(typeof val === 'boolean' ? val : !isStudioSetupOpen)}
                      />
                    </div>
                  )}

                  {/* TAB: Student Bonafides & Certificates Studio */}
                  {(mountedTabs.has('certStudio') || mountedTabs.has('certificate')) && (
                    <div
                      key="cert-studio-container"
                      className={(activeTab === 'certStudio' || activeTab === 'certificate') ? 'block w-full' : 'hidden'}
                      style={(activeTab === 'certStudio' || activeTab === 'certificate') ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'certStudio' && activeTab !== 'certificate'}
                    >
                      <StudentCertificateStudioView
                        allStudents={identityStudents}
                        identityStudents={identityStudents}
                        onClose={() => setActiveTab('reports')}
                        onSwitchToRoster={() => setActiveTab('customRoster')}
                        onSwitchToLetter={() => setActiveTab('officialLetter')}
                        showSettingsDrawerProp={isStudioSetupOpen}
                        onToggleSettingsDrawer={(val) => setIsStudioSetupOpen(typeof val === 'boolean' ? val : !isStudioSetupOpen)}
                      />
                    </div>
                  )}

                  {/* TAB 3: Roll No Assignment */}
                  {mountedTabs.has('rollNo') && (
                    <div
                      key="roll-no-container"
                      className={activeTab === 'rollNo' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'rollNo' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'rollNo'}
                    >
                      <RollNoAssignment
                        applications={applications}
                        onRefresh={loadAdminData}
                        onOpenGoogleContacts={() => {
                          setMountedTabs(prev => new Set(prev).add('reports'));
                          setActiveTab('reports');
                          setTriggerAction('googleContacts');
                        }}
                      />
                    </div>
                  )}

                  {/* TAB: Application Merger & Deduplication Studio */}
                  {mountedTabs.has('mergeStudio') && (
                    <div
                      key="merge-studio-container"
                      className={activeTab === 'mergeStudio' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'mergeStudio' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'mergeStudio'}
                    >
                      <ApplicationMergerStudio
                        applications={applications}
                        onRefresh={loadAdminData}
                        onClose={() => setActiveTab('reports')}
                      />
                    </div>
                  )}

                  {/* TAB 5: Automations & Group Email Composer */}
                  {mountedTabs.has('automations') && (
                    <div
                      key="automations-container"
                      className={activeTab === 'automations' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'automations' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'automations'}
                    >
                      <AutomationsPage applications={applications} user={user} />
                    </div>
                  )}

                  {/* TAB 7: Fund Distribution */}
                  {mountedTabs.has('funds') && (
                    <div
                      key="funds-container"
                      className={activeTab === 'funds' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'funds' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'funds'}
                    >
                      <FundDistribution />
                    </div>
                  )}

                  {/* TAB: School Accounts, Salaries & Staff Tax */}
                  {mountedTabs.has('accounts') && (
                    <div
                      key="accounts-container"
                      className={activeTab === 'accounts' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'accounts' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'accounts'}
                    >
                      <SchoolAccountsManager user={user} />
                    </div>
                  )}

                  {/* TAB 8: Practicals & Awards */}
                  {mountedTabs.has('practicals') && (
                    <div
                      key="practicals-container"
                      className={activeTab === 'practicals' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'practicals' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'practicals'}
                    >
                      <AdminPracticals />
                    </div>
                  )}

                  {/* TAB 9: Attendance Management */}
                  {mountedTabs.has('attendanceMgmt') && (
                    <div
                      key="attendance-container"
                      className={activeTab === 'attendanceMgmt' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'attendanceMgmt' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'attendanceMgmt'}
                    >
                      <AdminAttendance />
                    </div>
                  )}

                  {/* Unified replacement for the former independent Administrative Portal login. */}
                  {mountedTabs.has('cms') && (
                    <div
                      key="cms-container"
                      className={activeTab === 'cms' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'cms' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'cms'}
                    >
                      <AdministrativeCms embeddedUser={user} onEmbeddedLogout={handleLogoutRequest} />
                    </div>
                  )}

                  {/* TAB: Activity Audit & Dispute Trail */}
                  {mountedTabs.has('activityAudit') && (
                    <div
                      key="activity-audit-container"
                      className={activeTab === 'activityAudit' ? 'block w-full' : 'hidden'}
                      style={activeTab === 'activityAudit' ? undefined : { display: 'none' }}
                      aria-hidden={activeTab !== 'activityAudit'}
                    >
                      <ActivityAuditView user={user} />
                    </div>
                  )}
                </React.Suspense>
              </ModuleErrorBoundary>
            </div>
          )}
        </div>

        {/* Application Review Modal Popup */}
        {selectedApp && (
          <ModuleErrorBoundary key="review-modal">
            <React.Suspense fallback={null}>
              <ApplicationReviewModal
                app={selectedApp}
                onClose={() => setSelectedApp(null)}
                onRefresh={loadAdminData}
              />
            </React.Suspense>
          </ModuleErrorBoundary>
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
