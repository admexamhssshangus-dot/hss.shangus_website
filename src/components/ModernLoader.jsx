import React, { useState, useEffect, useMemo } from 'react';

// Page & Module specific presets for minimal dynamic loading screens
const PAGE_MODULE_PRESETS = {
  admin: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Admin Suite",
    defaultText: "Loading Master Registers & System Data",
    hints: [
      "Synchronizing official master register records…",
      "Verifying administrative security & control flags…",
      "Preparing real-time admission analytics…"
    ]
  },
  student: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Student Portal",
    defaultText: "Initializing Admission Application",
    hints: [
      "Matching student records with official master registers…",
      "Loading dynamic form schema and subjects…",
      "Securing your digital application draft…"
    ]
  },
  teacher: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Faculty Portal",
    defaultText: "Loading Evaluation & Class Rosters",
    hints: [
      "Loading assigned class rosters & award lists…",
      "Synchronizing daily student attendance…",
      "Connecting to administrative registers…"
    ]
  },
  practicals: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Lab Practicals",
    defaultText: "Loading Practical Award Sheets",
    hints: [
      "Fetching registered students for practical evaluation…",
      "Preparing official JKBOSE practical award rolls…"
    ]
  },
  attendance: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Student Attendance",
    defaultText: "Loading Attendance Records",
    hints: [
      "Fetching class attendance rosters…",
      "Computing monthly attendance percentages…"
    ]
  },
  reports: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Master Database",
    defaultText: "Loading Admission Records",
    hints: [
      "Searching indexed student admission entries…",
      "Preparing data export packages…"
    ]
  },
  idCards: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Student Identity",
    defaultText: "Loading ID Card Templates",
    hints: [
      "Rendering high-definition student photo IDs…",
      "Generating secure QR verification badges…"
    ]
  },
  gkTest: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Merit Competition",
    defaultText: "Loading GK Test Data",
    hints: [
      "Loading candidate hall ticket assignments…",
      "Preparing automated evaluation keys…"
    ]
  },
  controls: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "System Controls",
    defaultText: "Loading System Settings",
    hints: [
      "Loading admission rules and subject allocations…",
      "Fetching institutional configuration…"
    ]
  },
  default: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Academic Portal",
    defaultText: "Loading School Data",
    hints: [
      "Nurturing Minds, Shaping Futures — Estd. 1971",
      "Connecting to official student database…",
      "Preparing secure digital services…"
    ]
  }
};

export default function ModernLoader({
  moduleKey = 'default',
  title,
  badge,
  text,
  subtext,
  totalRecords,
  fullScreen = false,
  className = ''
}) {
  // Resolve module preset configuration
  const preset = useMemo(() => {
    const key = (moduleKey || 'default').toLowerCase();
    return PAGE_MODULE_PRESETS[key] || PAGE_MODULE_PRESETS.default;
  }, [moduleKey]);

  const displayTitle = title || preset.title;
  const displayBadge = badge || preset.badge;
  const hintsList = preset.hints || [preset.defaultText];

  const [hintIdx, setHintIdx] = useState(0);

  useEffect(() => {
    if (hintsList.length <= 1) return;
    const interval = setInterval(() => {
      setHintIdx(prev => (prev + 1) % hintsList.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [hintsList]);

  const mainStatusText = text || preset.defaultText;
  const secondarySubtext = subtext || (
    typeof totalRecords === 'number' && totalRecords > 0
      ? `Synchronizing ${totalRecords.toLocaleString()} student records…`
      : hintsList[hintIdx]
  );

  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md text-center overflow-hidden animate-fadeIn"
    : `w-full py-10 sm:py-14 px-4 flex flex-col items-center justify-center text-center animate-fadeIn ${className}`;

  return (
    <div className={containerClasses}>
      {/* Center Minimal Logo with Sleek Spinner Ring */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-4 flex items-center justify-center shrink-0">
        {/* Sleek minimal spinning track */}
        <div
          className="absolute -inset-1 rounded-full border-2 border-transparent border-t-teal-500 border-r-teal-500/30 animate-spin"
          style={{ animationDuration: '1.2s' }}
        />
        {/* Soft breathing pulse glow */}
        <div className="absolute inset-0 rounded-full bg-teal-500/10 dark:bg-teal-400/10 animate-pulse" />

        {/* Logo Card */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800">
          <img
            src="/logo.png"
            alt="Govt HSS Shangus"
            className="w-11 h-11 sm:w-13 sm:h-13 rounded-full object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Header & Module Badge */}
      <div className="flex flex-col items-center gap-1.5 mb-3 max-w-sm sm:max-w-md px-2">
        <h1 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
          {displayTitle}
        </h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/70 dark:border-teal-800/60">
          {displayBadge}
        </span>
      </div>

      {/* Status & Dynamic Context */}
      <div className="space-y-1 mb-4 max-w-xs sm:max-w-sm px-2 min-h-[42px] flex flex-col items-center justify-center">
        <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">
          {mainStatusText}
        </h2>
        {secondarySubtext && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-full transition-opacity duration-300">
            {secondarySubtext}
          </p>
        )}
      </div>

      {/* Modern Minimal Progress Line */}
      <div className="w-36 sm:w-44 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
          style={{
            width: '40%',
            animation: 'minimalSweep 1.4s ease-in-out infinite alternate'
          }}
        />
      </div>

      {/* Inline Keyframe Animation */}
      <style>{`
        @keyframes minimalSweep {
          0% { left: 0%; width: 25%; }
          50% { width: 50%; }
          100% { left: 75%; width: 25%; }
        }
      `}</style>
    </div>
  );
}

