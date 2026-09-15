import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart2, Contact, ShieldCheck, Settings, ClipboardCheck, 
  CalendarCheck, Hash, Layers, Mail, CreditCard, Edit3, PlusCircle, 
  Wrench, Check, ChevronRight, Zap, PanelsTopLeft, FileSpreadsheet, FileText,
  GitMerge, BookOpen, Award, X, Search
} from 'lucide-react';
import {
  ADMIN_MODULE_CATALOG,
  getModuleMaturity,
} from './adminModuleCatalog';
import { isBootstrapSuperAdminEmail, isBootstrapAdminEmail } from '../../services/staffAuthService';

const MODULE_ICONS = {
  reports: BarChart2,
  admRegisterSuite: BookOpen,
  customRoster: FileSpreadsheet,
  officialLetter: FileText,
  certStudio: Award,
  idCards: Contact,
  gkTest: ShieldCheck,
  controls: Settings,
  practicals: ClipboardCheck,
  attendanceMgmt: CalendarCheck,
  rollNo: Hash,
  mergeStudio: GitMerge,
  automations: Mail,
  funds: CreditCard,
  cms: PanelsTopLeft,
  boardSync: FileSpreadsheet,
  docStudio: FileSpreadsheet,
};

export const ADMIN_TOOL_MODULES = ADMIN_MODULE_CATALOG
  .filter(module => module.launcher)
  .map(module => ({ ...module, desc: module.description, icon: MODULE_ICONS[module.id] || PanelsTopLeft }));

export const isUserPermittedForModule = (user, moduleId) => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase().trim();
  const email = String(user.email || '').toLowerCase().trim();

  if (
    role === 'superadmin' ||
    isBootstrapSuperAdminEmail(email) ||
    isBootstrapAdminEmail(email)
  ) {
    return true;
  }

  const perms = Array.isArray(user.perms) ? user.perms : [];
  if (perms.includes('*')) return true;
  if (perms.length === 0) return moduleId === 'reports';
  if (moduleId === 'docStudio' || moduleId === 'customRoster' || moduleId === 'officialLetter' || moduleId === 'certStudio') {
    return perms.includes('docStudio') || perms.includes('customRoster') || perms.includes('officialLetter') || perms.includes('certStudio') || perms.includes('certificate');
  }
  return perms.includes(moduleId);
};

export default function AdminToolsDropdown({
  isOpen,
  setIsOpen,
  activeTab = 'reports',
  setActiveTab,
  user,
  onOpenAnalytics,
  onOpenDirectEntry,
  onOpenBulkTools,
  onOpenCustomRoster,
  onOpenBoardSync,
  enableQuickCellEdit,
  setEnableQuickCellEdit,
  align = 'left'
}) {
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Active category selection tab
  const [activeCategoryKey, setActiveCategoryKey] = useState('Records & Registers');
  const [searchQuery, setSearchQuery] = useState('');

  const permittedModules = useMemo(
    () => ADMIN_TOOL_MODULES.filter(t => isUserPermittedForModule(user, t.id)),
    [user],
  );

  const isSuper = user?.role?.toLowerCase() === 'superadmin' || isBootstrapSuperAdminEmail(user?.email) || isBootstrapAdminEmail(user?.email);
  const perms = Array.isArray(user?.perms) ? user.perms : [];
  const canReports = isUserPermittedForModule(user, 'reports');
  const canDirectEntry = isSuper || perms.includes('*') || perms.includes('directEntry') || perms.includes('ingestion');
  const canBulk = isSuper || perms.includes('*') || perms.includes('bulkTools') || perms.includes('bulk') || isUserPermittedForModule(user, 'controls');

  const categories = useMemo(() => [
    { key: 'Records & Registers', title: 'Records & Registers', icon: BarChart2, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10 dark:bg-amber-500/20' },
    { key: 'Academics & Controls', title: 'Academics & Controls', icon: Settings, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20' },
    { key: 'Operations & Automation', title: 'Operations & Automation', icon: Layers, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-500/10 dark:bg-indigo-500/20' },
    { key: 'Quick Actions', title: 'Quick Actions', icon: Zap, color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10 dark:bg-violet-500/20' },
  ], []);

  const getCategoryCount = useCallback((catKey) => {
    if (catKey === 'Quick Actions') {
      return (
        (setEnableQuickCellEdit !== undefined ? 1 : 0) +
        (canReports ? 1 : 0) +
        (canDirectEntry ? 1 : 0) +
        (canBulk ? 1 : 0)
      );
    }
    return permittedModules.filter(m => m.category === catKey).length;
  }, [setEnableQuickCellEdit, canReports, canDirectEntry, canBulk, permittedModules]);

  const visibleCategories = useMemo(() => {
    const activeList = categories.filter(cat => getCategoryCount(cat.key) > 0);
    return activeList.length > 0 ? activeList : categories;
  }, [categories, getCategoryCount]);

  // Dynamically calculate total available count across all visible categories
  const totalAvailableCount = useMemo(() => {
    return visibleCategories.reduce((sum, cat) => sum + getCategoryCount(cat.key), 0);
  }, [visibleCategories, getCategoryCount]);

  // All searchable items (modules + quick actions)
  const allItems = useMemo(() => {
    const items = [];

    // Modules
    permittedModules.forEach(m => {
      items.push({
        type: 'module',
        id: m.id,
        label: m.label,
        desc: m.desc,
        category: m.category,
        icon: m.icon,
        maturity: m.maturity,
        maturityNote: m.maturityNote,
        isActive: activeTab === m.id,
        onClick: () => {
          if (m.id === 'boardSync' && onOpenBoardSync) {
            onOpenBoardSync();
          } else if (setActiveTab) {
            setActiveTab(m.id);
          } else if (onOpenCustomRoster) {
            onOpenCustomRoster();
          }
          setIsOpen(false);
        },
      });
    });

    // Quick Actions
    if (setEnableQuickCellEdit !== undefined) {
      items.push({
        type: 'toggle',
        id: 'quickCellEdit',
        label: 'Quick Cell Edit Hover',
        desc: 'Click directly on report cells to edit student records',
        category: 'Quick Actions',
        icon: Edit3,
        isChecked: enableQuickCellEdit,
        onToggle: (val) => setEnableQuickCellEdit(val),
      });
    }
    if (canReports) {
      items.push({
        type: 'action',
        id: 'analyticsReports',
        label: 'Analytics & Statistical Reports',
        desc: 'View gender breakdown, stream stats and intake reports',
        category: 'Quick Actions',
        icon: BarChart2,
        onClick: () => {
          if (onOpenAnalytics) onOpenAnalytics();
          else if (setActiveTab) setActiveTab('reports');
          setIsOpen(false);
        },
      });
    }
    if (canDirectEntry) {
      items.push({
        type: 'action',
        id: 'directEntryAction',
        label: 'Express Direct Record Entry',
        desc: 'Add a single student application directly into active intake',
        category: 'Quick Actions',
        icon: PlusCircle,
        onClick: () => {
          if (onOpenDirectEntry) onOpenDirectEntry();
          else if (setActiveTab) setActiveTab('reports');
          setIsOpen(false);
        },
      });
    }
    if (canBulk) {
      items.push({
        type: 'action',
        id: 'bulkToolsAction',
        label: 'Bulk Tools & Photo Suite',
        desc: 'Bulk status updates, photo batch exports and recovery',
        category: 'Quick Actions',
        icon: Wrench,
        onClick: () => {
          if (onOpenBulkTools) onOpenBulkTools();
          else if (setActiveTab) setActiveTab('reports');
          setIsOpen(false);
        },
      });
    }

    return items;
  }, [
    permittedModules,
    activeTab,
    onOpenBoardSync,
    setActiveTab,
    onOpenCustomRoster,
    setEnableQuickCellEdit,
    enableQuickCellEdit,
    canReports,
    onOpenAnalytics,
    canDirectEntry,
    onOpenDirectEntry,
    canBulk,
    onOpenBulkTools,
    setIsOpen,
  ]);

  // Responsive state for mobile viewports
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter items when searching
  const filteredSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allItems.filter(item => 
      item.label.toLowerCase().includes(q) ||
      (item.desc && item.desc.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  }, [allItems, searchQuery]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  // Reset search when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Default category to active tab's category only when menu is opened
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const activeModule = permittedModules.find(module => module.id === activeTab);
      if (activeModule?.category && visibleCategories.some(c => c.key === activeModule.category)) {
        setActiveCategoryKey(activeModule.category);
      } else if (visibleCategories.length > 0 && !visibleCategories.some(c => c.key === activeCategoryKey)) {
        setActiveCategoryKey(visibleCategories[0].key);
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, activeTab, permittedModules, visibleCategories, activeCategoryKey]);

  // Fallback in case currently selected category is not in visibleCategories
  useEffect(() => {
    if (isOpen && visibleCategories.length > 0 && !visibleCategories.some(c => c.key === activeCategoryKey)) {
      setActiveCategoryKey(visibleCategories[0].key);
    }
  }, [isOpen, visibleCategories, activeCategoryKey]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const currentCategoryItems = allItems.filter(m => m.category === activeCategoryKey);

  const renderItemCard = (item) => {
    const Icon = item.icon;

    if (item.type === 'toggle') {
      return (
        <div
          key={item.id}
          className="w-full text-left p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl flex items-center justify-between gap-2 sm:gap-3 bg-white dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className="w-6.5 h-6.5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Icon size={13} className="sm:hidden" />
              <Icon size={15} className="hidden sm:block" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-[11px] sm:text-xs text-slate-900 dark:text-white truncate">
                  {item.label}
                </span>
                {searchQuery && (
                  <span className="text-[8px] sm:text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                    {item.category}
                  </span>
                )}
              </div>
              <div className="text-[9px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                {item.desc}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={item.isChecked}
            onClick={() => item.onToggle(!item.isChecked)}
            className={`relative inline-flex h-4 w-7 sm:h-5 sm:w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              item.isChecked ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                item.isChecked ? 'translate-x-3 sm:translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      );
    }

    const isActive = item.isActive;
    const isBeta = item.maturity === 'beta';

    return (
      <button
        key={item.id}
        type="button"
        onClick={item.onClick}
        aria-current={isActive ? 'page' : undefined}
        title={item.maturityNote || item.desc}
        className={`w-full text-left p-1 sm:p-2.5 rounded-lg sm:rounded-xl flex items-center justify-between gap-1.5 sm:gap-3 transition-all cursor-pointer group ${
          isActive
            ? 'bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 border border-teal-500/80 shadow-xs ring-1 ring-teal-500/20'
            : 'bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 hover:border-teal-300/80 dark:hover:border-teal-700/80 hover:shadow-xs'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <div
            className={`w-5.5 h-5.5 sm:w-8 sm:h-8 rounded-md sm:rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isActive
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-teal-500/10 group-hover:text-teal-600 dark:group-hover:text-teal-400'
            }`}
          >
            <Icon size={11} className="sm:hidden" />
            <Icon size={15} className="hidden sm:block" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 truncate font-bold text-[10px] sm:text-xs text-slate-900 dark:text-white group-hover:text-teal-950 dark:group-hover:text-teal-100 transition-colors">
                {item.label}
              </span>
              {isBeta && (
                <span className="shrink-0 rounded px-1 py-0.2 text-[7px] sm:text-[8px] font-bold border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-300 leading-none tracking-wide">
                  Beta
                </span>
              )}
              {searchQuery && (
                <span className="text-[7.5px] sm:text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                  {item.category}
                </span>
              )}
            </div>
            <div className="text-[8px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.2 leading-tight">
              {item.desc}
            </div>
          </div>
        </div>

        {isActive ? (
          <span className="shrink-0 flex items-center gap-0.5 text-[7.5px] sm:text-[9px] uppercase tracking-wider text-teal-700 dark:text-teal-300 font-black px-1 sm:px-2 py-0.5 rounded-full bg-teal-100/80 dark:bg-teal-900/60 border border-teal-200 dark:border-teal-800">
            <Check size={9} strokeWidth={3} />
            <span className="hidden sm:inline">Active</span>
          </span>
        ) : (
          <ChevronRight
            size={11}
            className="sm:hidden text-slate-300 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:translate-x-0.5 transition-transform shrink-0"
          />
        )}
        {!isActive && (
          <ChevronRight
            size={14}
            className="hidden sm:block text-slate-300 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:translate-x-0.5 transition-transform shrink-0"
          />
        )}
      </button>
    );
  };

  return createPortal(
    <div className="admin-tools-modal-portal fixed inset-0 z-[999999] overflow-hidden">
      {/* Full Backdrop Overlay (All Screen Sizes) */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fadeIn cursor-pointer"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <div
        ref={dropdownRef}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Administrative modules"
        className={`fixed inset-x-2.5 sm:inset-x-auto top-3 sm:top-14 bottom-3 sm:bottom-auto ${
          align === 'right' ? 'sm:right-4 sm:left-auto' : 'sm:left-4 sm:right-auto'
        } w-auto sm:w-[680px] md:w-[720px] max-w-[calc(100vw-20px)] sm:max-w-[calc(100vw-32px)] max-h-[calc(100vh-24px)] sm:max-h-[540px] sm:h-[500px] flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-2xl z-[1000000] p-2.5 sm:p-4 text-xs overflow-hidden animate-fadeIn`}
      >
        {/* Modal Header */}
        <div className="pb-1 sm:pb-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-md sm:rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Wrench size={12} className="sm:hidden" />
              <Wrench size={14} className="hidden sm:block" />
            </div>
            <div>
              <h2 className="font-bold text-[11px] sm:text-sm text-slate-900 dark:text-white tracking-tight leading-none truncate">
                <span className="sm:hidden">Admin Modules</span>
                <span className="hidden sm:inline">Administrative Modules</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Total Available Badge */}
            <span className="whitespace-nowrap shrink-0 text-teal-800 dark:text-teal-300 font-mono font-bold bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[8.5px] sm:text-xs flex items-center gap-1 sm:gap-1.5">
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span>{totalAvailableCount} Available</span>
            </span>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-0.5 sm:p-1 rounded-md sm:rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Close Menu"
              aria-label="Close Menu"
            >
              <X size={14} className="sm:hidden" />
              <X size={16} className="hidden sm:block" />
            </button>
          </div>
        </div>

        {/* Minimal Compact Search Bar */}
        <div className="py-1 sm:py-1.5 shrink-0">
          <div className="relative">
            <Search size={11} className="sm:hidden absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Search size={13} className="hidden sm:block absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMobile ? `Search ${totalAvailableCount} tools...` : `Search all ${totalAvailableCount} administrative modules & tools...`}
              className="w-full h-7 sm:h-8 pl-6 sm:pl-8 pr-6 sm:pr-8 py-0 leading-none bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-lg sm:rounded-xl text-[10px] sm:text-xs placeholder:text-[9px] sm:placeholder:text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
              >
                <X size={9} className="sm:hidden" />
                <X size={12} className="hidden sm:block" />
              </button>
            )}
          </div>
        </div>

        {/* Category Horizontal Bar for Mobile Only (Hidden when searching) */}
        {!searchQuery && (
          <div className="flex sm:hidden items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-1 border-b border-slate-100 dark:border-slate-800 shrink-0">
            {visibleCategories.map((cat) => {
              const CatIcon = cat.icon;
              const isSelected = activeCategoryKey === cat.key;
              const count = getCategoryCount(cat.key);

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategoryKey(cat.key)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750 font-medium'
                  }`}
                >
                  <CatIcon size={11} className={isSelected ? 'text-white' : cat.color} />
                  <span className="whitespace-nowrap">{cat.title}</span>
                  <span
                    className={`text-[8.5px] font-mono font-bold px-1 py-0 rounded ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1 sm:pt-2">
          {/* Desktop Left Sidebar: Category Navigation Tabs (Hidden when searching) */}
          {!searchQuery && (
            <div className="hidden sm:flex flex-col w-52 shrink-0 space-y-1 pr-3 border-r border-slate-100 dark:border-slate-800/80 overflow-y-auto custom-scrollbar">
              <div className="px-2 pt-0.5 pb-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Categories
              </div>

              {visibleCategories.map((cat) => {
                const CatIcon = cat.icon;
                const isSelected = activeCategoryKey === cat.key;
                const count = getCategoryCount(cat.key);

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onMouseEnter={() => setActiveCategoryKey(cat.key)}
                    onClick={() => setActiveCategoryKey(cat.key)}
                    aria-pressed={isSelected}
                    className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-950 dark:text-teal-100 border border-teal-300 dark:border-teal-700/80 shadow-xs font-bold'
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${cat.bg} ${cat.color} shrink-0`}>
                        <CatIcon size={12} />
                      </div>
                      <span className="truncate text-xs">{cat.title}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-md ${
                          isSelected
                            ? 'bg-teal-200/60 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 font-bold'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                      <ChevronRight
                        size={13}
                        className={isSelected ? 'text-teal-600 dark:text-teal-400' : 'opacity-30'}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Items Display Area */}
          <div className="flex-1 min-h-0 flex flex-col bg-slate-50/60 dark:bg-slate-950/40 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-slate-800/70 overflow-y-auto custom-scrollbar space-y-1 sm:space-y-1.5">
            {/* Header for regular category view */}
            {!searchQuery && (
              <div className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 pb-1 sm:pb-1.5 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between shrink-0">
                <span className="truncate">{activeCategoryKey}</span>
                <span className="text-[8.5px] sm:text-[9px] font-mono text-slate-400 font-normal shrink-0">
                  {currentCategoryItems.length} Available
                </span>
              </div>
            )}

            {/* Header for search view */}
            {searchQuery && (
              <div className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 pb-1 sm:pb-1.5 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between shrink-0">
                <span className="truncate">Search Results for "{searchQuery}"</span>
                <span className="text-[8.5px] sm:text-[9px] font-mono text-slate-400 font-normal shrink-0">
                  {filteredSearchResults.length} Found
                </span>
              </div>
            )}

            {/* List of items */}
            <div className="space-y-1 sm:space-y-1.5 pt-0.5">
              {!searchQuery && currentCategoryItems.map((item) => renderItemCard(item))}

              {searchQuery && filteredSearchResults.map((item) => renderItemCard(item))}

              {searchQuery && filteredSearchResults.length === 0 && (
                <div className="py-8 sm:py-12 text-center text-slate-400 text-[11px] sm:text-xs">
                  No modules or tools found matching "{searchQuery}".
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
