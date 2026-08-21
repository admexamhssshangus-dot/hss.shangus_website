import React, { useRef, useEffect, useState } from 'react';
import { 
  BarChart2, Contact, ShieldCheck, Settings, ClipboardCheck, 
  CalendarCheck, Hash, Layers, Mail, CreditCard, Edit3, PlusCircle, 
  Wrench, Check, ChevronRight, Zap, PanelsTopLeft, FileSpreadsheet, FileText,
  GitMerge, BookOpen
} from 'lucide-react';

export const ADMIN_TOOL_MODULES = [
  { id: 'reports', label: 'Student Records & Reports', desc: 'Master register, student records and reports', category: 'Records & Registers', icon: BarChart2 },
  { id: 'admRegisterSuite', label: 'Admission Register & Sentup Suite', desc: 'Official ledger, JKBOSE sentup roll, bulk assign IDs & dates', category: 'Records & Registers', icon: BookOpen },
  { id: 'docStudio', label: 'Official Documents & Registers Studio', desc: 'Custom student lists, fee sheets & official letterhead writer', category: 'Records & Registers', icon: FileSpreadsheet },
  { id: 'idCards', label: 'Student ID Cards', desc: 'Generate and print student identity cards', category: 'Records & Registers', icon: Contact },
  { id: 'gkTest', label: 'Competitive Exams', desc: 'Exam preparation and registrations', category: 'Records & Registers', icon: ShieldCheck },

  { id: 'controls', label: 'Academic Controls & Subjects', desc: 'Subjects, allocations and institutional rules', category: 'Academics & Controls', icon: Settings },
  { id: 'practicals', label: 'Practicals & Awards', desc: 'Practical marks and award rolls', category: 'Academics & Controls', icon: ClipboardCheck },
  { id: 'attendanceMgmt', label: 'Student Attendance', desc: 'Record and review daily attendance', category: 'Academics & Controls', icon: CalendarCheck },
  { id: 'rollNo', label: 'Roll Number Manager', desc: 'Assign and sequence class roll numbers', category: 'Academics & Controls', icon: Hash },

  { id: 'mergeStudio', label: 'Application Merger & Deduplication', desc: 'Scan, review side-by-side & merge duplicate records by Reg No', category: 'Operations & Automation', icon: GitMerge },
  { id: 'automations', label: 'Messages & Automations', desc: 'Group email and parent notifications', category: 'Operations & Automation', icon: Mail },
  { id: 'funds', label: 'Funds & Fee Accounts', desc: 'Student fees and institutional funds', category: 'Operations & Automation', icon: CreditCard },
  { id: 'cms', label: 'Website CMS & Administration', desc: 'Website content, access and publishing', category: 'Operations & Automation', icon: PanelsTopLeft },
];

export const isUserPermittedForModule = (user, moduleId) => {
  if (!user) return true;
  const role = String(user.role || '').toLowerCase().trim();
  const email = String(user.email || '').toLowerCase().trim();

  if (
    role === 'superadmin' ||
    email === 'adm.exam.hss.shangus@gmail.com' ||
    email === 'socialshiftz@gmail.com'
  ) {
    return true;
  }

  const perms = Array.isArray(user.perms) ? user.perms : [];
  if (perms.includes('*')) return true;
  if (perms.length === 0) return moduleId === 'reports';
  if (moduleId === 'docStudio') {
    return perms.includes('docStudio') || perms.includes('customRoster') || perms.includes('officialLetter');
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const permittedModules = ADMIN_TOOL_MODULES.filter(t => isUserPermittedForModule(user, t.id));
  const isSuper = user?.role?.toLowerCase() === 'superadmin' || user?.email === 'adm.exam.hss.shangus@gmail.com';
  const canReports = isUserPermittedForModule(user, 'reports');
  const canBulk = isUserPermittedForModule(user, 'controls') || isUserPermittedForModule(user, 'reports') || isSuper;

  const categories = [
    { key: 'Records & Registers', title: 'Records & Registers', icon: BarChart2, color: 'text-amber-600 dark:text-amber-400' },
    { key: 'Academics & Controls', title: 'Academics & Controls', icon: Settings, color: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'Operations & Automation', title: 'Operations & Automation', icon: Layers, color: 'text-indigo-600 dark:text-indigo-400' },
    { key: 'Quick Actions', title: 'Quick Actions', icon: Zap, color: 'text-violet-600 dark:text-violet-400' },
  ];

  const currentCategoryItems = permittedModules.filter(m => m.category === activeCategoryKey);

  return (
    <div
      ref={dropdownRef}
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-[520px] max-w-[calc(100vw-12px)] max-h-[min(76vh,460px)] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[9999] p-2 space-y-1.5 animate-fadeIn bg-white/98 dark:bg-slate-900/98 backdrop-blur-md text-slate-900 dark:text-slate-100 text-xs font-bold`}
    >
      {/* Menu Header */}
      <div className="px-2.5 py-1 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Wrench size={13} className="text-amber-600 dark:text-amber-400" />
          <span>Administrative Modules</span>
        </span>
        <span className="text-amber-700 dark:text-amber-400 font-mono bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/60 px-1.5 py-0.2 rounded-md">
          {permittedModules.length} Available
        </span>
      </div>

      {/* 2-Column Side-by-Side Mega Menu Panel */}
      <div className="flex flex-col sm:flex-row gap-2 min-h-0 sm:min-h-[220px]">
        {/* Left Column: Category Navigation Tabs */}
        <div className="w-full sm:w-44 flex-shrink-0 flex sm:block gap-1 overflow-x-auto sm:overflow-visible space-y-0 sm:space-y-1 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800 pb-1.5 sm:pb-0 sm:pr-1.5 custom-scrollbar">
          <div className="hidden sm:block px-1.5 pt-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Categories
          </div>

          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isSelected = activeCategoryKey === cat.key;
            const count = cat.key === 'Quick Actions'
              ? (canReports ? 2 : 0) + (canBulk ? 1 : 0) + (setEnableQuickCellEdit !== undefined ? 1 : 0)
              : permittedModules.filter(m => m.category === cat.key).length;

            return (
              <button
                key={cat.key}
                type="button"
                onMouseEnter={() => setActiveCategoryKey(cat.key)}
                onClick={() => setActiveCategoryKey(cat.key)}
                className={`min-w-max sm:min-w-0 sm:w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between gap-1.5 transition-all cursor-pointer font-extrabold text-[10px] sm:text-[11px] ${
                  isSelected
                    ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-400/50 shadow-2xs'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <CatIcon size={13} className={cat.color} />
                  <span className="truncate">{cat.title}</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="text-[9px] font-mono opacity-70">({count})</span>
                  <ChevronRight size={12} className={isSelected ? 'text-amber-600 dark:text-amber-400' : 'opacity-40'} />
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Column: Display items for selected category */}
        <div className="min-w-0 flex-1 bg-slate-50/90 dark:bg-slate-950/80 p-2 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto max-h-[300px] custom-scrollbar">
          <div className="space-y-1">
            <div className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 pb-1 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span>{activeCategoryKey}</span>
              <span className="text-[9px] font-mono text-slate-400">Available Options</span>
            </div>

            {/* Render Category Modules */}
            {activeCategoryKey !== 'Quick Actions' && (
              <div className="space-y-1 pt-1">
                {currentCategoryItems.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (setActiveTab) setActiveTab(t.id);
                        else if (onOpenCustomRoster) onOpenCustomRoster();
                        setIsOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-start justify-between gap-2 transition-all cursor-pointer font-bold text-[11px] ${
                        isActive
                          ? 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 border border-amber-400/80 shadow-md ring-1 ring-amber-400/30'
                          : 'bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <div className={`p-1.5 rounded-lg ${isActive ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-[11px] truncate">{t.label}</div>
                          <div className="text-[9.5px] font-normal text-slate-500 dark:text-slate-400 truncate">{t.desc}</div>
                        </div>
                      </div>

                      {isActive && (
                        <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-black flex-shrink-0 pt-0.5">
                          <Check size={13} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}

                {currentCategoryItems.length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No permitted modules in this category.
                  </div>
                )}
              </div>
            )}

            {/* Render Quick Actions */}
            {activeCategoryKey === 'Quick Actions' && (
              <div className="space-y-1.5 pt-1">
                {setEnableQuickCellEdit !== undefined && (
                  <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 cursor-pointer font-black text-[11px] border border-slate-200 dark:border-slate-800">
                    <span className="flex items-center gap-2">
                      <Edit3 size={13} className="text-amber-600 dark:text-amber-400" />
                      <span>Quick Cell Edit Hover</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={enableQuickCellEdit}
                      onChange={(e) => setEnableQuickCellEdit(e.target.checked)}
                      className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
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
                    className="w-full text-left p-2 rounded-xl flex items-center gap-2 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer font-extrabold text-[11px]"
                  >
                    <BarChart2 size={14} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Analytics & Reports Suite</span>
                  </button>
                )}

                {canReports && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenDirectEntry) onOpenDirectEntry();
                      else if (setActiveTab) setActiveTab('reports');
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-xl flex items-center gap-2 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer font-extrabold text-[11px]"
                  >
                    <PlusCircle size={14} className="text-amber-600 dark:text-amber-400" />
                    <span>Express Direct Record Entry</span>
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
                    className="w-full text-left p-2 rounded-xl flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer font-extrabold text-[11px]"
                  >
                    <Wrench size={14} className="text-amber-600 dark:text-amber-400" />
                    <span>Bulk Tools & Photo Suite</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
