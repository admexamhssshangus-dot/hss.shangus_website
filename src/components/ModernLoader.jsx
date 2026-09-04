import React, { useState, useMemo } from 'react';

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
  auth: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Secure Access",
    defaultText: "Authenticating Session Credentials",
    hints: [
      "Verifying encrypted administrative tokens…",
      "Connecting to official institutional database…",
      "Loading session access privileges…"
    ]
  },
  login: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Secure Access",
    defaultText: "Authenticating Session Credentials",
    hints: [
      "Verifying encrypted administrative tokens…",
      "Connecting to official institutional database…",
      "Loading session access privileges…"
    ]
  },
  customRoster: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Roster & Registers",
    defaultText: "Loading Student Roster Studio",
    hints: [
      "Preparing student cohort records matrix…",
      "Indexing custom fee sheets and class registers…",
      "Configuring tabular column formulas…"
    ]
  },
  certStudio: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Certificates & Bonafides",
    defaultText: "Loading Certificate Studio",
    hints: [
      "Compiling official certificate templates…",
      "Indexing student directory and JKBOSE results…",
      "Preparing institutional signature engine…"
    ]
  },
  officialLetter: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Letterhead Writer",
    defaultText: "Loading Official Letterhead Writer",
    hints: [
      "Formatting institutional dispatch headers…",
      "Configuring official signatories and margins…",
      "Preparing Word & PDF document engine…"
    ]
  },
  admRegisterSuite: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Admission Registers",
    defaultText: "Loading Admission Register Suite",
    hints: [
      "Indexing Class 11th & 12th registers…",
      "Synchronizing official enrollment archives…",
      "Preparing sentup & examination rosters…"
    ]
  },
  mergeStudio: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Merger & Deduplication",
    defaultText: "Loading Deduplication Studio",
    hints: [
      "Scanning duplicate application entries…",
      "Reconciling student registration identifiers…",
      "Preparing unified database merger…"
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
  funds: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Funds & Fee Accounts",
    defaultText: "Loading Fee & Account Ledgers",
    hints: [
      "Calculating student fee allocation ledgers…",
      "Compiling department account summaries…"
    ]
  },
  automations: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Messages & Automations",
    defaultText: "Loading Automation Hub",
    hints: [
      "Synchronizing automated messaging queues…",
      "Preparing email & WhatsApp broadcast templates…"
    ]
  },
  archive: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Session Archival",
    defaultText: "Processing Session Archives",
    hints: [
      "Auditing current admissions database & analyzing records…",
      "Packaging approved students into master register archives…",
      "Configuring active admissions intake for new session…"
    ]
  },
  trash: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Recycle Bin",
    defaultText: "Loading Deleted Archives",
    hints: [
      "Retrieving soft-deleted student records…",
      "Scanning archival timestamps and audit logs…",
      "Preparing recovery and permanent purge controls…"
    ]
  },
  default: {
    title: "Govt. Higher Secondary School Shangus",
    badge: "Academic Portal",
    defaultText: "Loading School Data",
    hints: [
      "Nurturing Minds, Shaping Futures — Estd. 1917",
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
  progress, // Optional number 0–100 for actual percentage progress
  fullScreen = false,
  inverted = false,
  className = ''
}) {
  // Resolve module preset configuration
  const preset = useMemo(() => {
    const key = (moduleKey || 'default').toLowerCase();
    return PAGE_MODULE_PRESETS[key] || PAGE_MODULE_PRESETS.default;
  }, [moduleKey]);

  const displayTitle = title || preset.title;
  const displayBadge = badge || preset.badge;
  const [logoSrc, setLogoSrc] = useState('/logo512.png');
  const [logoFailed, setLogoFailed] = useState(false);

  const mainStatusText = text || 'Loading…';
  const secondarySubtext = subtext || (
    typeof totalRecords === 'number' && totalRecords > 0
      ? `Synchronizing ${totalRecords.toLocaleString()} student records…`
      : ''
  );

  const hasExplicitProgress = typeof progress === 'number' && !isNaN(progress);
  const clampedProgress = hasExplicitProgress ? Math.min(100, Math.max(0, Math.round(progress))) : null;

  const containerClasses = fullScreen
    ? (inverted
        ? "fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950/95 backdrop-blur-md text-center overflow-hidden animate-fadeIn"
        : "fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md text-center overflow-hidden animate-fadeIn")
    : `w-full py-10 sm:py-14 px-4 flex flex-col items-center justify-center text-center animate-fadeIn ${className}`;

  return (
    <div className={containerClasses} role="status" aria-live="polite" aria-busy="true">
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
        <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-sm overflow-hidden ${
          inverted
            ? 'bg-slate-900 ring-1 ring-slate-700'
            : 'bg-white dark:bg-slate-900 ring-1 ring-slate-200/80 dark:ring-slate-800'
        }`}>
          {!logoFailed ? (
            <img
              src={logoSrc}
              alt="Govt HSS Shangus"
              className="w-11 h-11 sm:w-13 sm:h-13 rounded-full object-contain"
              onError={() => {
                if (logoSrc === '/logo512.png') {
                  setLogoSrc('/logo.png');
                } else {
                  setLogoFailed(true);
                }
              }}
            />
          ) : (
            <span className="font-black text-xs text-teal-400">HSS</span>
          )}
        </div>
      </div>

      {/* Header & Module Badge */}
      <div className="flex flex-col items-center gap-1.5 mb-3 max-w-sm sm:max-w-md px-2">
        <h1 className={`text-xs sm:text-sm font-bold tracking-tight leading-tight ${
          inverted ? 'text-white font-extrabold' : 'text-slate-800 dark:text-slate-100'
        }`}>
          {displayTitle}
        </h1>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border ${
          inverted
            ? 'bg-teal-950/80 text-teal-300 border-teal-500/40'
            : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200/70 dark:border-teal-800/60'
        }`}>
          {displayBadge}
        </span>
      </div>

      {/* Status & Dynamic Context */}
      <div className="space-y-1 mb-3.5 max-w-xs sm:max-w-sm px-2 min-h-[38px] flex flex-col items-center justify-center">
        <h2 className={`text-xs sm:text-[13px] font-bold leading-snug ${
          inverted ? 'text-slate-100 font-extrabold' : 'text-slate-700 dark:text-slate-200'
        }`}>
          {mainStatusText}
        </h2>
        {secondarySubtext && (
          <p className={`text-[10.5px] sm:text-[11px] font-medium whitespace-normal break-words max-w-full transition-opacity duration-300 ${
            inverted ? 'text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'
          }`}>
            {secondarySubtext}
          </p>
        )}
      </div>

      {/* Modern Minimal Progress Line & Optional Minimal Percentage */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          role="progressbar"
          aria-label={mainStatusText}
          aria-valuemin={hasExplicitProgress ? 0 : undefined}
          aria-valuemax={hasExplicitProgress ? 100 : undefined}
          aria-valuenow={hasExplicitProgress ? clampedProgress : undefined}
          className={`w-48 sm:w-56 h-2 rounded-full overflow-hidden relative shadow-2xs ${
            inverted ? 'bg-slate-800' : 'bg-slate-200 dark:bg-slate-800'
          }`}
        >
          {hasExplicitProgress ? (
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300 ease-out shadow-xs"
              style={{ width: `${clampedProgress}%` }}
            />
          ) : (
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
              style={{
                width: '40%',
                animation: 'minimalSweep 1.4s ease-in-out infinite alternate'
              }}
            />
          )}
        </div>

        {/* Minimal numeric percentage counter */}
        {hasExplicitProgress && (
          <span className={`text-[10.5px] font-black font-mono tracking-tight ${
            inverted ? 'text-teal-300' : 'text-teal-700 dark:text-teal-400'
          }`}>
            {clampedProgress}%
          </span>
        )}
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
