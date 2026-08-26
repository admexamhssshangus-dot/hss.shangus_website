import React, { useEffect, useState } from 'react';
import { Sparkles, Layers, ShieldCheck, FileSpreadsheet, Award, FileText, Contact, BookOpen, GitMerge } from 'lucide-react';

const MODULE_ICONS = {
  customRoster: FileSpreadsheet,
  certStudio: Award,
  certificate: Award,
  officialLetter: FileText,
  idCards: Contact,
  admRegisterSuite: BookOpen,
  mergeStudio: GitMerge,
  default: Layers
};

const MODULE_LABELS = {
  customRoster: 'Student Roster & Registers',
  certStudio: 'Student Bonafides & Certificates',
  certificate: 'Student Bonafides & Certificates',
  officialLetter: 'Official Letterhead Writer',
  idCards: 'Student ID Cards Studio',
  admRegisterSuite: 'Admission Register & Sentup Suite',
  mergeStudio: 'Application Merger & Deduplication',
  default: 'Administrative Module'
};

export default function TabLoadingOverlay({ moduleKey = 'default', message = '' }) {
  const [progress, setProgress] = useState(15);
  const Icon = MODULE_ICONS[moduleKey] || MODULE_ICONS.default;
  const label = MODULE_LABELS[moduleKey] || MODULE_LABELS.default;

  useEffect(() => {
    // Smooth progress simulation
    const timer1 = setTimeout(() => setProgress(45), 100);
    const timer2 = setTimeout(() => setProgress(75), 300);
    const timer3 = setTimeout(() => setProgress(90), 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fadeIn select-none">
      <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
        {/* Glowing animated spinner rings */}
        <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-teal-500/20 to-indigo-500/20 animate-pulse blur-sm" />
        <div className="absolute -inset-1 rounded-2xl border-2 border-transparent border-t-amber-500 border-r-teal-500 border-b-indigo-500 animate-spin" style={{ animationDuration: '1.2s' }} />
        <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 z-10">
          <Icon size={28} className="animate-bounce" style={{ animationDuration: '1.8s' }} />
        </div>
      </div>

      <div className="space-y-1.5 max-w-sm mx-auto mb-5">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
          Loading Module
        </span>
        <h3 className="text-base font-black text-slate-900 dark:text-white">
          {label}
        </h3>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {message || 'Preparing records & rendering workspace...'}
        </p>
      </div>

      {/* Progress Bar Container */}
      <div className="w-64 max-w-xs space-y-1.5">
        <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-teal-500 to-indigo-600 rounded-full transition-all duration-500 ease-out shadow-xs"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles size={10} className="text-amber-500" /> Initializing
          </span>
          <span className="font-mono">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
