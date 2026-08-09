import React, { useRef, useEffect } from 'react';
import { 
  BarChart2, Contact, ShieldCheck, Settings, ClipboardCheck, 
  CalendarCheck, Hash, Layers, Mail, CreditCard, Edit3, PlusCircle, 
  Wrench, Check 
} from 'lucide-react';

export const ADMIN_TOOL_MODULES = [
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

export default function AdminToolsDropdown({
  isOpen,
  setIsOpen,
  activeTab = 'reports',
  setActiveTab,
  onOpenAnalytics,
  onOpenDirectEntry,
  onOpenBulkTools,
  enableQuickCellEdit,
  setEnableQuickCellEdit,
  align = 'left' // 'left' | 'right'
}) {
  const dropdownRef = useRef(null);

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

  return (
    <div
      ref={dropdownRef}
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-64 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[9999] p-1.5 space-y-0.5 animate-fadeIn bg-white/98 dark:bg-slate-900/98 backdrop-blur-md text-slate-900 dark:text-slate-100 text-xs font-bold`}
    >
      <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
        <span>Admin Tools & Modules</span>
        <span className="text-amber-600 dark:text-amber-400 font-mono">10 Modules</span>
      </div>

      {/* ─── Top-Level Modules (Always Visible, Active Indicator) ─── */}
      <div className="space-y-0.5 max-h-[50vh] overflow-y-auto pr-0.5">
        {ADMIN_TOOL_MODULES.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (setActiveTab) setActiveTab(t.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer font-black text-[11px] ${
                isActive
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50 shadow-2xs'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Icon size={13} className={isActive ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'} />
                <span className="truncate">{t.label}</span>
              </span>
              {isActive && (
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-black flex-shrink-0">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Divider & Quick Utilities ─── */}
      <div className="pt-1 mt-1 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
        {setEnableQuickCellEdit !== undefined && (
          <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-black text-[11px]">
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

        <button
          type="button"
          onClick={() => {
            if (onOpenAnalytics) {
              onOpenAnalytics();
            } else if (setActiveTab) {
              setActiveTab('reports');
            }
            setIsOpen(false);
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 transition-colors cursor-pointer font-black text-[11px]"
        >
          <BarChart2 size={13} className="text-indigo-600 dark:text-indigo-400" />
          <span>Analytics & Reports Suite</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onOpenDirectEntry) {
              onOpenDirectEntry();
            } else if (setActiveTab) {
              setActiveTab('reports');
            }
            setIsOpen(false);
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 transition-colors cursor-pointer font-black text-[11px]"
        >
          <PlusCircle size={13} className="text-amber-600 dark:text-amber-400" />
          <span>Express Direct Record Entry</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onOpenBulkTools) {
              onOpenBulkTools();
            } else if (setActiveTab) {
              setActiveTab('reports');
            }
            setIsOpen(false);
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 transition-colors cursor-pointer font-black text-[11px]"
        >
          <Wrench size={13} className="text-amber-600 dark:text-amber-400" />
          <span>Bulk Tools & Photo Suite</span>
        </button>
      </div>
    </div>
  );
}
