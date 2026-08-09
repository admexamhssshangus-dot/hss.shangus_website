import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, Hash, Layers, RefreshCw, LogOut, ShieldCheck, BarChart2, Mail, CreditCard, Settings, ChevronDown, Wrench, ClipboardCheck, CalendarCheck, Contact } from 'lucide-react';
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
import { getCachedCollection, getCachedCollectionSync } from '../../services/dbCache';

export default function AdminDashboard() {
  const { user, onLogout } = useOutletContext();

  // Tab State: 'reports' | 'controls' | 'rollNo' | 'bulk' | 'automations' | 'funds'
  const [activeTab, setActiveTab] = useState('reports');
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

  useEffect(() => {
    loadAdminData();
  }, []);

  // Check if a specific tab/module is permitted for the logged-in user
  const isTabPermitted = (tabId) => {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase();
    const email = String(user.email || '').toLowerCase();
    // SuperAdmin, Admin, or designated admin accounts have full access across all modules
    if (
      role.includes('admin') || 
      email === 'adm.exam.hss.shangus@gmail.com' ||
      email === 'socialshiftz@gmail.com' ||
      email === 'shahnawaz@gmail.com' ||
      email === 'bilalhcu@gmail.com'
    ) {
      return true;
    }
    const perms = Array.isArray(user.perms) ? user.perms : [];
    return perms.length === 0 || perms.includes('*') || perms.includes(tabId);
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
    { id: 'reports', label: 'Master Register & Database', icon: BarChart2 },
    { id: 'idCards', label: 'Student ID Cards Suite', icon: Contact },
    { id: 'gkTest', label: 'Competitive Exam Prep & Registrations', icon: ShieldCheck },
    { id: 'controls', label: 'Controls & Subjects', icon: Settings },
    { id: 'practicals', label: 'Practicals & Awards', icon: ClipboardCheck },
    { id: 'attendanceMgmt', label: 'Attendance Management', icon: CalendarCheck },
    { id: 'rollNo', label: 'Roll Numbers', icon: Hash },
    { id: 'bulk', label: 'Bulk Export', icon: Layers },
    { id: 'automations', label: 'Email & Automations', icon: Mail },
    { id: 'funds', label: 'Fund Accounts', icon: CreditCard },
  ];

  const allowedToolModules = TOOL_MODULES.filter((mod) => isTabPermitted(mod.id));

  return (
    <div className="w-full min-h-[85vh] py-0.5 sm:py-1 px-1 sm:px-2" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Admin Dashboard | HSS Shangus"
        description="Comprehensive Super Admin Panel for managing student applications, roll numbers, fee structures, and automations."
      />

      <div className="w-full max-w-[1750px] mx-auto space-y-0.5">
        {/* Workspace Card */}
        <div className="rounded-xl p-0.5 sm:p-1 border shadow-sm space-y-1" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          {/* Navigation Tabs Dynamic Toolbar (For non-reports tabs) */}
          {activeTab !== 'reports' && (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl border text-xs font-bold flex-wrap sm:flex-nowrap" style={{ backgroundColor: 'var(--bg-secondary, #f1f5f9)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
              
              {/* Left Slot: Brand & Active Tool Title */}
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-200 border-r border-slate-300 dark:border-slate-700 pr-2 flex-shrink-0" title={`${user?.email || 'Admin'} • HSS Shangus`}>
                  <div className="w-6 h-6 rounded-lg bg-amber-600/10 border border-amber-600/30 flex items-center justify-center font-black text-amber-600 text-[10px]">
                    <Lock size={11} />
                  </div>
                  <span className="hidden sm:inline text-[11px] font-black">Admin</span>
                </div>

                <div className="flex items-center p-0.5 rounded-xl border text-xs font-black bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700">
                  <span className="px-2.5 py-1 text-slate-800 dark:text-slate-200 font-black">
                    {activeTab === 'controls' && 'Controls & Subjects'}
                    {activeTab === 'gkTest' && 'Competitive Exam Prep & Registrations'}
                    {activeTab === 'rollNo' && 'Roll Numbers'}
                    {activeTab === 'bulk' && 'Bulk Export'}
                    {activeTab === 'automations' && 'Email & Automations'}
                    {activeTab === 'funds' && 'Fund Accounts'}
                    {activeTab === 'practicals' && 'Practicals & Awards'}
                    {activeTab === 'attendanceMgmt' && 'Attendance Management'}
                  </span>
                </div>

                {/* Tools Icon Button & Unified Dropdown */}
                <div className="relative inline-block text-left">
                  <button
                    type="button"
                    onClick={() => setIsToolsOpen(!isToolsOpen)}
                    title="Administrative Tools Suite"
                    className="p-1.5 rounded-xl flex items-center justify-center transition-all whitespace-nowrap cursor-pointer bg-indigo-700 hover:bg-indigo-600 text-white shadow-sm font-extrabold"
                  >
                    <Wrench size={14} />
                  </button>

                  <AdminToolsDropdown
                    isOpen={isToolsOpen}
                    setIsOpen={setIsToolsOpen}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    align="left"
                  />
                </div>
              </div>

              {/* Right Slot: Refresh Sync Button */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => loadAdminData(true)}
                  disabled={loading}
                  title="Refresh Data"
                  className="px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-black text-xs cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>Sync</span>
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator — Only show outer loader for non-reports tabs */}
          {loading && activeTab !== 'reports' ? (
            <ModernLoader
              text="Fetching Student Applications"
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
