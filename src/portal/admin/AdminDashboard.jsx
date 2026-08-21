import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, Hash, Layers, RefreshCw, LogOut, ShieldCheck, BarChart2, Mail, CreditCard, Settings, ChevronDown, Wrench, ClipboardCheck, CalendarCheck, Contact, PanelsTopLeft, FileSpreadsheet, FileText, Award, Sliders } from 'lucide-react';
import SEO from '../../components/SEO';
import ApplicationReviewModal from './ApplicationReviewModal';
import RollNoAssignment from './RollNoAssignment';
import AdvancedReports from './AdvancedReports';
import AutomationsPage from './AutomationsPage';
import FundDistribution from './FundDistribution';
import ControlsAndSubjects from './ControlsAndSubjects';
import AdminPracticals from './AdminPracticals';
import AdminAttendance from './AdminAttendance';
import AdminGkTestManager from './AdminGkTestManager';
import StudentIdCardManager from './StudentIdCardManager';
import ModernLoader from '../../components/ModernLoader';
import GlobalDataSyncHUD from '../../components/GlobalDataSyncHUD';
import AdminToolsDropdown from './AdminToolsDropdown';
import OfficialDocumentsStudioView from './OfficialDocumentsStudioView';
import ApplicationMergerStudio from './ApplicationMergerStudio';
import AdmissionRegisterSuite from './AdmissionRegisterSuite';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { getCachedCollection, getCachedCollectionSync, subscribeToCollection, preloadStudentPhotosCache, getCollectionCount, getPaginatedCollection, hydrateRemainingPages, mergeDuplicateStudentApplications } from '../../services/dbCache';

const AdministrativeCms = React.lazy(() => import('../../pages/AdminPortal'));


// Helper to read initial activeTab from URL search params, hash or sessionStorage
function getInitialTab() {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const urlTab = searchParams.get('tab');
    if (urlTab) {
      if (urlTab === 'bulk') return 'reports';
      return urlTab;
    }

    const subtab = searchParams.get('subtab');
    if (subtab) return 'docStudio';

    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      if (hash === 'bulk') return 'reports';
      return hash;
    }

    const savedTab = sessionStorage.getItem('hss_admin_active_tab');
    if (savedTab) {
      if (savedTab === 'bulk') return 'reports';
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

  // Sub-Tab state for Official Documents Studio (roster | letter | certStudio)
  const [docStudioSubTab, setDocStudioSubTabState] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const sub = sp.get('subtab');
      if (sub) return sub;
      return sessionStorage.getItem('hss_doc_studio_subtab') || 'roster';
    } catch {
      return 'roster';
    }
  });

  const setDocStudioSubTab = useCallback((sub) => {
    setDocStudioSubTabState(sub);
    try {
      sessionStorage.setItem('hss_doc_studio_subtab', sub);
      const url = new URL(window.location.href);
      url.searchParams.set('subtab', sub);
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  }, []);

  const [isStudioSetupOpen, setIsStudioSetupOpen] = useState(false);

  const [counts, setCounts] = useState(() => {
    const initialCachedApps = getCachedCollectionSync('admissions');
    return {
      active: initialCachedApps?.length || 0,
      total: initialCachedApps?.length || 0
    };
  });
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [showCustomRosterModal, setShowCustomRosterModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef(null);

  // Trigger confirm modal before logging out
  const handleLogoutRequest = () => setShowLogoutConfirm(true);

  useEffect(() => {
    preloadStudentPhotosCache().catch(() => {});
  }, []);

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
    return !cached || cached.length === 0;
  });
  const [applications, setApplications] = useState(() => {
    return getCachedCollectionSync('admissions') || [];
  });
  const [selectedApp, setSelectedApp] = useState(null); // For ApplicationReviewModal
  const appsRef = useRef(applications);
  appsRef.current = applications;

  // Fetch Admin Dashboard Data: instant first-page load + non-blocking background hydration
  const loadAdminData = useCallback(async (force = false) => {
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
        setApplications(cached);
        setLoading(false);
      } else {
        // 2. Cold start / force sync: Fetch first 50 applications instantly
        const page1 = await getPaginatedCollection('admissions', 50);
        if (page1.docs && page1.docs.length > 0) {
          setApplications(page1.docs);
          setLoading(false);

          if (page1.hasMore && page1.lastDoc) {
            // 3. Hydrate remaining pages in background without freezing UI
            hydrateRemainingPages('admissions', page1.lastDoc, page1.docs, (batch) => {
              setApplications(batch);
            });
          }
        } else {
          // Fallback to full fetch if paginated query returns empty
          const fullList = await getCachedCollection('admissions', force, 30 * 60 * 1000);
          if (fullList && Array.isArray(fullList)) {
            setApplications(fullList);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      clearTimeout(timeoutTimer);
      setLoading(false);
    }
  }, []);

  // Real-time live synchronization for admissions (0ms updates when students submit, edit, or withdraw)
  useEffect(() => {
    if (typeof subscribeToCollection !== 'function') {
      loadAdminData();
      return undefined;
    }
    let unsubscribe = () => {};
    let receivedSnapshot = false;
    const fallbackTimer = setTimeout(() => {
      if (!receivedSnapshot && appsRef.current.length === 0) loadAdminData();
    }, 2500);
    try {
      unsubscribe = subscribeToCollection('admissions', (liveList) => {
        if (Array.isArray(liveList)) {
          receivedSnapshot = true;
          setApplications(liveList);
          setLoading(false);
        }
      }, (err) => {
        console.warn('Realtime listener fallback note:', err);
        if (!receivedSnapshot) loadAdminData();
      });
    } catch (err) {
      console.warn('subscribeToCollection initialization note:', err);
      loadAdminData();
    }

    return () => {
      clearTimeout(fallbackTimer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadAdminData]);

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
    { id: 'docStudio', label: 'Official Documents Studio', icon: FileSpreadsheet },
    { id: 'idCards', label: 'Student ID Cards', icon: Contact },
    { id: 'gkTest', label: 'Competitive Exams', icon: ShieldCheck },
    { id: 'controls', label: 'Academic Controls & Subjects', icon: Settings },
    { id: 'practicals', label: 'Practicals & Awards', icon: ClipboardCheck },
    { id: 'attendanceMgmt', label: 'Student Attendance', icon: CalendarCheck },
    { id: 'rollNo', label: 'Roll Number Manager', icon: Hash },
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
        {/* Global Firestore Data Synchronization & Network Status Ribbon */}
        <GlobalDataSyncHUD
          isActive={loading}
          recordCount={applications.length}
        />

        {/* Workspace Card */}
        <div className="rounded-xl p-0.5 sm:p-1 border shadow-sm space-y-1" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          {/* Navigation Tabs Dynamic Toolbar (For non-reports tabs) */}
          {activeTab !== 'reports' && (() => {
            const currentModule = TOOL_MODULES.find(m => m.id === activeTab) || { id: activeTab, label: 'Admin Tool', icon: Wrench };
            const CurrentIcon = currentModule.icon;
            return (
              <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-xl border text-xs font-bold flex-wrap md:flex-nowrap bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xs">
                
                {/* Left Slot: Brand & Active Module Title (Strictly Anchored Left) */}
                <div className="flex min-w-0 items-center gap-1.5 flex-nowrap shrink-0 order-1">
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-200 border-r border-slate-300 dark:border-slate-700 pr-2.5 flex-shrink-0" title={`${user?.email || 'Admin'} • HSS Shangus`}>
                    <div className="w-6 h-6 rounded-lg bg-amber-600/10 border border-amber-600/30 flex items-center justify-center font-black text-amber-600 text-[10px]">
                      <Lock size={11} />
                    </div>
                    <span className="hidden sm:inline text-[11px] font-black">Admin</span>
                  </div>

                  <div className="flex min-w-0 items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-black bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shrink-0 shadow-2xs">
                    <div className="w-4 h-4 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                      <CurrentIcon size={12} />
                    </div>
                    <span className="truncate text-slate-800 dark:text-slate-200 font-black">{currentModule.label}</span>
                  </div>
                </div>

                {/* Center Slot: Official Documents Studio Sub-Tabs (In Between on Desktop, Full Row on Mobile) */}
                {(activeTab === 'docStudio' || activeTab === 'customRoster' || activeTab === 'officialLetter') && (
                  <div className="w-full md:w-auto order-3 md:order-2 inline-flex items-center gap-1.5 mx-auto justify-between sm:justify-center">
                    <div className="inline-flex p-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 text-[10.5px] sm:text-[11px] font-black shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setDocStudioSubTab('roster')}
                        className={`flex-1 md:flex-initial px-2 sm:px-2.5 py-1 rounded-md flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer transition-all ${
                          docStudioSubTab === 'roster'
                            ? 'bg-amber-600 text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                        }`}
                      >
                        <FileSpreadsheet size={12} className="shrink-0" />
                        <span className="hidden sm:inline">Student Roster & Registers</span>
                        <span className="sm:hidden text-[10px]">Roster</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDocStudioSubTab('letter')}
                        className={`flex-1 md:flex-initial px-2 sm:px-2.5 py-1 rounded-md flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer transition-all ${
                          docStudioSubTab === 'letter'
                            ? 'bg-rose-700 text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                        }`}
                      >
                        <FileText size={12} className="shrink-0" />
                        <span className="hidden sm:inline">Official Letterhead Writer</span>
                        <span className="sm:hidden text-[10px]">Letterhead</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDocStudioSubTab('certStudio')}
                        className={`flex-1 md:flex-initial px-2 sm:px-2.5 py-1 rounded-md flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer transition-all ${
                          docStudioSubTab === 'certStudio' || docStudioSubTab === 'certificate'
                            ? 'bg-gradient-to-r from-teal-700 to-indigo-700 text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
                        }`}
                      >
                        <Award size={12} className="shrink-0" />
                        <span className="hidden sm:inline">Student Bonafides & Certificates</span>
                        <span className="sm:hidden text-[10px]">Certificates</span>
                      </button>
                    </div>

                    {/* Setup / Configuration Button (Positioned here per user request) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsStudioSetupOpen(prev => !prev);
                        window.dispatchEvent(new CustomEvent('hss-toggle-studio-setup'));
                      }}
                      className={`h-7 sm:h-7.5 px-2.5 rounded-lg border font-black text-xs cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 shrink-0 ${
                        isStudioSetupOpen
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title="Configure Official Letterhead, Signatories, Ref No & Margins"
                    >
                      <Sliders size={12} className={isStudioSetupOpen ? 'text-amber-600' : 'text-slate-500'} />
                      <span>Setup</span>
                    </button>
                  </div>
                )}

                {/* Right Slot: Admin Tools Dropdown Button & Refresh Sync Button (Strictly Anchored Right) */}
                <div className="flex shrink-0 items-center gap-1 order-2 md:order-3 ml-auto">
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
                      onOpenCustomRoster={() => setShowCustomRosterModal(true)}
                      align="right"
                    />
                  </div>

                  {/* Refresh Sync Button */}
                  {activeTab !== 'cms' && activeTab !== 'customRoster' && activeTab !== 'officialLetter' && activeTab !== 'docStudio' && (
                    <button
                      type="button"
                      onClick={() => loadAdminData(true)}
                      disabled={loading}
                      title="Sync & Refresh Database Records"
                      className="h-8 px-2 sm:px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-black text-xs cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
                    >
                      <RefreshCw size={13} className={loading ? 'animate-spin text-purple-600' : 'text-slate-500'} />
                      <span className="hidden sm:inline">Sync</span>
                    </button>
                  )}
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

                  {/* TAB: Official Documents & Registers Studio (Houses Student Roster, Official Letterhead & Certificates) */}
                  {(activeTab === 'customRoster' || activeTab === 'officialLetter' || activeTab === 'docStudio') && (
                    <OfficialDocumentsStudioView
                      allStudents={applications}
                      initialSubTab={docStudioSubTab}
                      activeSubTab={docStudioSubTab}
                      onSwitchSubTab={setDocStudioSubTab}
                      showSettingsDrawer={isStudioSetupOpen}
                      onToggleSettingsDrawer={() => setIsStudioSetupOpen(prev => !prev)}
                      onClose={() => setActiveTab('reports')}
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
