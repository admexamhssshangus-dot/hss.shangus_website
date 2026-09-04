import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { 
  BarChart2, Contact, ShieldCheck, Settings, ClipboardCheck, 
  CalendarCheck, Hash, Layers, Mail, CreditCard, Edit3, PlusCircle, 
  Wrench, Check, ChevronRight, Zap, PanelsTopLeft, FileSpreadsheet, FileText,
  GitMerge, BookOpen, Award, X, Sparkles
} from 'lucide-react';
import {
  ADMIN_MODULE_CATALOG,
  getModuleMaturity,
  MODULE_MATURITY,
} from './adminModuleCatalog';
import { isBootstrapSuperAdminEmail } from '../../services/staffAuthService';

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
    isBootstrapSuperAdminEmail(email)
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
  enableQuickCellEdit,
  setEnableQuickCellEdit,
  align = 'left'
}) {
  const dropdownRef = useRef(null);

  // Active category selection tab for 2-column side flyout menu
  const [activeCategoryKey, setActiveCategoryKey] = useState('Records & Registers');

  const permittedModules = useMemo(
    () => ADMIN_TOOL_MODULES.filter(t => isUserPermittedForModule(user, t.id)),
    [user],
  );

  const isSuper = user?.role?.toLowerCase() === 'superadmin' || isBootstrapSuperAdminEmail(user?.email);
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
  }, [isOpen, activeTab, permittedModules, visibleCategories]);

  // Fallback in case currently selected category is not in visibleCategories
  useEffect(() => {
    if (isOpen && visibleCategories.length > 0 && !visibleCategories.some(c => c.key === activeCategoryKey)) {
      setActiveCategoryKey(visibleCategories[0].key);
    }
  }, [isOpen, visibleCategories, activeCategoryKey]);

  if (!isOpen) return null;

  const currentCategoryItems = permittedModules.filter(m => m.category === activeCategoryKey);

  return (
    <>
      {/* Mobile Backdrop Overlay for Clean Dismissal */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[99998] sm:hidden animate-fadeIn"
        onClick={() => setIsOpen(false)}
      />

      <div
        ref={dropdownRef}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Administrative modules"
        className={`fixed inset-x-3 top-16 sm:top-auto sm:mt-2 sm:absolute sm:inset-x-auto ${align === 'left' ? 'sm:left-0 sm:right-auto' : 'sm:right-0 sm:left-auto'} w-auto sm:w-[600px] md:w-[640px] max-w-[calc(100vw-24px)] max-h-[min(85vh,520px)] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[99999] p-3 space-y-2.5 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs`}
      >
        {/* Menu Header */}
        <div className="px-1.5 py-1 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Wrench size={13} />
            </div>
            <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
              Administrative Modules
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-1" aria-label="Module maturity legend">
              {Object.entries(MODULE_MATURITY).map(([key, status]) => (
                <span
                  key={key}
                  title={`${status.label}: ${status.description}`}
                  className={`rounded-md border px-1.5 py-0.5 text-[8px] font-black leading-none tracking-wide ${status.badgeClass}`}
                >
                  {status.shortLabel}
                </span>
              ))}
            </div>
            <span className="text-teal-800 dark:text-teal-300 font-mono font-bold bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-lg text-[9.5px]">
              {permittedModules.length} Available
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Menu"
              aria-label="Close Menu"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 2-Column Side-by-Side Mega Menu Panel */}
        <div className="flex flex-col sm:flex-row gap-2.5 min-h-0 sm:min-h-[260px]">
          {/* Left Column: Category Navigation Tabs */}
          <div className="w-full sm:w-52 flex-shrink-0 flex sm:block gap-1.5 overflow-x-auto sm:overflow-visible space-y-0 sm:space-y-1.5 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800 pb-2 sm:pb-0 sm:pr-2.5 no-scrollbar">
            <div className="hidden sm:block px-2 pt-0.5 pb-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
                  className={`min-w-max sm:min-w-0 sm:w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-950 dark:text-teal-100 border border-teal-300 dark:border-teal-700/80 shadow-xs font-black'
                      : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent font-bold'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${cat.bg} ${cat.color} shrink-0`}>
                      <CatIcon size={12} />
                    </div>
                    <span className="truncate">{cat.title}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-teal-200/60 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                      {count}
                    </span>
                    <ChevronRight size={13} className={isSelected ? 'text-teal-600 dark:text-teal-400' : 'opacity-30'} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Column: Display items for selected category */}
          <div className="min-w-0 flex-1 bg-slate-50/80 dark:bg-slate-950/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between overflow-y-auto max-h-[340px] custom-scrollbar space-y-2">
            <div className="space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 pb-1.5 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                <span>{activeCategoryKey}</span>
                <span className="text-[9px] font-mono text-slate-400 font-normal">Available Options</span>
              </div>

              {/* Render Category Modules */}
              {activeCategoryKey !== 'Quick Actions' && (
                <div className="space-y-1.5 pt-0.5">
                  {currentCategoryItems.map((t) => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    const maturity = getModuleMaturity(t.maturity);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (setActiveTab) setActiveTab(t.id);
                          else if (onOpenCustomRoster) onOpenCustomRoster();
                          setIsOpen(false);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        title={`${maturity.label}: ${t.maturityNote}`}
                        className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-white dark:bg-slate-900 text-teal-950 dark:text-teal-100 border-2 border-teal-500 shadow-sm ring-1 ring-teal-500/20'
                            : 'bg-white dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="min-w-0 truncate font-black text-xs text-slate-900 dark:text-white">
                                {t.label}
                              </span>
                              <span className={`flex-shrink-0 rounded-md border px-1.5 py-0.2 text-[8px] font-black leading-none tracking-wide ${maturity.badgeClass}`}>
                                {maturity.label}
                              </span>
                            </div>
                            <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {t.desc}
                            </div>
                          </div>
                        </div>

                        {isActive && (
                          <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-black flex-shrink-0 px-2 py-0.5 rounded-full bg-teal-100/70 dark:bg-teal-950 border border-teal-200 dark:border-teal-800">
                            <Check size={11} strokeWidth={3} />
                            <span>Active</span>
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {currentCategoryItems.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No permitted modules in this category.
                    </div>
                  )}
                </div>
              )}

              {/* Render Quick Actions */}
              {activeCategoryKey === 'Quick Actions' && (
                <div className="space-y-2 pt-0.5">
                  {setEnableQuickCellEdit !== undefined && (
                    <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 cursor-pointer font-bold text-xs border border-slate-200 dark:border-slate-800 shadow-2xs transition-all">
                      <span className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                          <Edit3 size={14} />
                        </div>
                        <div>
                          <div className="font-black text-xs text-slate-900 dark:text-white">Quick Cell Edit Hover</div>
                          <span className={`inline-flex mt-0.5 rounded-md border px-1.5 py-0.2 text-[8px] font-black leading-none tracking-wide ${getModuleMaturity('optimized').badgeClass}`}>Optimized</span>
                          <div className="text-[10px] text-slate-400 font-normal">Click directly on report cells to edit student records</div>
                        </div>
                      </span>
                      <input
                        type="checkbox"
                        checked={enableQuickCellEdit}
                        onChange={(e) => setEnableQuickCellEdit(e.target.checked)}
                        className="w-4 h-4 accent-teal-600 rounded cursor-pointer shrink-0"
                      />
                    </label>
                  )}

                  {canReports && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenAnalytics) onOpenAnalytics();
                        else if (setActiveTab) setActiveTab('reports');
                        setIsOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-900 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200 hover:text-indigo-900 dark:hover:text-indigo-200 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer shadow-2xs group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <BarChart2 size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className="font-black text-xs text-slate-900 dark:text-white">Analytics & Statistical Reports Suite</div>
                          <span className={`rounded-md border px-1.5 py-0.2 text-[8px] font-black leading-none tracking-wide ${getModuleMaturity('optimized').badgeClass}`}>Optimized</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">View gender breakdown, stream stats and intake reports</div>
                      </div>
                    </button>
                  )}

                  {canDirectEntry && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenDirectEntry) onOpenDirectEntry();
                        else if (setActiveTab) setActiveTab('reports');
                        setIsOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-900 hover:bg-teal-50/70 dark:hover:bg-teal-950/40 text-slate-800 dark:text-slate-200 hover:text-teal-900 dark:hover:text-teal-200 border border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 transition-all cursor-pointer shadow-2xs group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <PlusCircle size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className="font-black text-xs text-slate-900 dark:text-white">Express Direct Record Entry</div>
                          <span className={`rounded-md border px-1.5 py-0.2 text-[8px] font-black leading-none tracking-wide ${getModuleMaturity('beta').badgeClass}`}>Beta</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">Add a single student application directly into active intake</div>
                      </div>
                    </button>
                  )}

                  {canBulk && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenBulkTools) onOpenBulkTools();
                        else if (setActiveTab) setActiveTab('reports');
                        setIsOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-xl flex items-center gap-2.5 bg-white dark:bg-slate-900 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 text-slate-800 dark:text-slate-200 hover:text-amber-900 dark:hover:text-amber-200 border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 transition-all cursor-pointer shadow-2xs group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Wrench size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className="font-black text-xs text-slate-900 dark:text-white">Bulk Tools & Photo Suite</div>
                          <span className={`rounded-md border px-1.5 py-0.2 text-[8px] font-black leading-none tracking-wide ${getModuleMaturity('optimized').badgeClass}`}>Optimized</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">Bulk status updates, photo batch exports and recovery</div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
