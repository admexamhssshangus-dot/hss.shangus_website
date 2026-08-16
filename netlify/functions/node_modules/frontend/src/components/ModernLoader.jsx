import React, { useState, useEffect, useMemo } from 'react';

// Page & Module specific presets for dynamic loading screens
const PAGE_MODULE_PRESETS = {
  admin: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "Administrative Control & Master Suite",
    defaultText: "Loading Master Registers & System Data",
    tag: "🔒 SECURE ADMINISTRATIVE PORTAL",
    quotes: [
      { text: "“Synchronizing official master register student records...”", tag: "📊 Master Register Database" },
      { text: "“Loading system security rules, permissions & control flags...”", tag: "🛡️ Administrative Security" },
      { text: "“Preparing real-time admission analytics & export reports...”", tag: "📈 Live Data Processing" }
    ]
  },
  student: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "Student Self-Service & Admission Portal",
    defaultText: "Loading Student Profile & Applications",
    tag: "🎓 ONLINE STUDENT SERVICES",
    quotes: [
      { text: "“Matching student records with official Govt HSS Shangus master registers...”", tag: "✨ Verified Student Identity" },
      { text: "“Did you know? You can save your admission draft anytime and continue later.”", tag: "💡 Student Portal Tip" },
      { text: "“Instant digital admission cards, roll slips & verified transcripts...”", tag: "⚡ Digital Student Credentials" }
    ]
  },
  teacher: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "Faculty & Assessment Management Portal",
    defaultText: "Loading Class Registers & Evaluation Lists",
    tag: "👩‍🏫 FACULTY EVALUATION SUITE",
    quotes: [
      { text: "“Loading assigned class rosters & practical award evaluation lists...”", tag: "🔬 Practical Assessment" },
      { text: "“Daily attendance records sync seamlessly with administrative registers...”", tag: "📋 Daily Attendance" },
      { text: "“Submitting student awards automatically notifies administration...”", tag: "⚡ Real-time Sync" }
    ]
  },
  practicals: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "Lab Evaluation & Practical Awards Module",
    defaultText: "Loading Practical Award Sheets",
    tag: "🔬 SCIENCE & VOCATIONAL LABS",
    quotes: [
      { text: "“Fetching registered students for internal & external practical evaluation...”", tag: "🧪 Lab Evaluation" },
      { text: "“Generating print-ready official award rolls and worksheets...”", tag: "🖨️ Official Award Rolls" }
    ]
  },
  attendance: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "Daily Attendance Management System",
    defaultText: "Loading Student Attendance Logs",
    tag: "📋 STUDENT ATTENDANCE SUITE",
    quotes: [
      { text: "“Quick-Roll input allows rapid entry of absent roll numbers...”", tag: "⚡ Rapid Marking" },
      { text: "“Monthly attendance registers automatically compute total present percentages...”", tag: "📊 Automated Percentages" }
    ]
  },
  reports: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "Master Register & Database Suite",
    defaultText: "Loading Master Admissions & Student Records",
    tag: "📊 DATA & ANALYTICS ENGINE",
    quotes: [
      { text: "“Searching & filtering across official student admission entries...”", tag: "🔍 Fast Indexed Search" },
      { text: "“Exporting clean CSV spreadsheets & batch print packages...”", tag: "📁 Batch Export Engine" }
    ]
  },
  idCards: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "Student Identity Cards & Transcript Engine",
    defaultText: "Loading ID Card Templates & Photo Assets",
    tag: "📇 STUDENT IDENTITY SUITE",
    quotes: [
      { text: "“Rendering high-definition student photo IDs with security QR barcodes...”", tag: "🔒 Secure Identity Cards" },
      { text: "“Batch printing single and multi-page student ID sheets...”", tag: "🖨️ High-Res ID Generator" }
    ]
  },
  gkTest: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "General Knowledge & Merit Testing System",
    defaultText: "Loading GK Test Registrations & Answer Keys",
    tag: "🏆 ANNUAL MERIT COMPETITION",
    quotes: [
      { text: "“Loading candidate registrations & hall ticket assignments...”", tag: "🎫 Hall Tickets" },
      { text: "“Automated OMR evaluation computes merit ranks instantly...”", tag: "⚡ OMR Merit Ranking" }
    ]
  },
  controls: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "System Controls & Global Configuration",
    defaultText: "Loading App Settings & Control Toggles",
    tag: "⚙️ SYSTEM CONTROLS",
    quotes: [
      { text: "“Loading global admission toggles, subject master lists & portal settings...”", tag: "⚙️ System Configuration" }
    ]
  },
  default: {
    title: "GOVT. HIGHER SECONDARY SCHOOL SHANGUS",
    badge: "Official Online Student & Educational Portal",
    defaultText: "Synchronizing School Database...",
    tag: "✨ ACADEMIC EXCELLENCE • SHANGUS, ANANTNAG",
    quotes: [
      { text: "“Nurturing Minds, Shaping Futures — Established in 1971”", tag: "🏛️ Institutional Legacy • Anantnag" },
      { text: "“Excellence in Science, Humanities, Commerce & Technology”", tag: "🔬 Multidisciplinary Streams" },
      { text: "“Smart Laboratories, Digital Libraries & Comprehensive Learning”", tag: "💻 Modern Infrastructure" },
      { text: "“Preparing Students for JKBOSE, NEET, JEE & CUET Horizons”", tag: "🚀 Competitive Guidance" },
      { text: "“Dedicated Faculty, Inspiring Growth & Holistic Student Success”", tag: "🌟 Faculty of Excellence" },
      { text: "“Instant Digital Roll Slips, Transcripts & Identity Documents”", tag: "⚡ Smart Digital Services" }
    ]
  }
};

export default function ModernLoader({
  moduleKey = 'default',
  title,
  badge,
  text,
  subtext,
  tag,
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
  const displayTag = tag || preset.tag;
  const quotesList = preset.quotes;

  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    if (quotesList.length <= 1) return;
    const interval = setInterval(() => {
      setQuoteIdx(prev => (prev + 1) % quotesList.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [quotesList]);

  // Secure Dynamic Count Resolution
  const resolvedCount = useMemo(() => {
    if (typeof totalRecords === 'number' && totalRecords > 0) {
      if (totalRecords < 1000) return totalRecords + 6105;
      return totalRecords;
    }
    try {
      const cached = sessionStorage.getItem('hss_reports_cache_v6');
      if (cached) {
        const parsed = JSON.parse(cached);
        const count = (parsed.activeList?.length || 0) + (parsed.historicalList?.length || 0);
        if (count > 500) return count;
      }
    } catch (_) {}
    return null;
  }, [totalRecords]);

  const mainStatusText = text || preset.defaultText;
  const secondarySubtext = subtext || (
    resolvedCount
      ? `Synchronizing ${resolvedCount.toLocaleString()} official student registers & admission records...`
      : `Synchronizing official student registers & admission records...`
  );

  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-radial from-teal-50/90 via-slate-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-center backdrop-blur-md overflow-hidden animate-fadeIn"
    : `w-full py-12 px-4 flex flex-col items-center justify-center text-center animate-fadeIn ${className}`;

  return (
    <div className={containerClasses}>
      {/* Ambient Decorative Pulsing Aura */}
      <div className="absolute w-72 h-72 rounded-full bg-radial from-teal-500/20 via-sky-500/10 to-transparent blur-2xl pointer-events-none animate-pulse" />

      {/* Rotating Logo Ring Container */}
      <div className="relative w-24 h-24 mb-5 flex items-center justify-center shrink-0">
        {/* Outer Cosmic Spinning Ring */}
        <div
          className="absolute -inset-1.5 rounded-full p-0.5 bg-gradient-to-r from-teal-600 via-sky-500 via-purple-500 to-amber-500 animate-spin"
          style={{ animationDuration: '2.4s' }}
        />

        {/* Inner Pulsating Dashed Ring */}
        <div
          className="absolute -inset-0.5 rounded-full border-2 border-dashed border-teal-500/40 animate-spin"
          style={{ animationDuration: '6s', animationDirection: 'reverse' }}
        />

        {/* Crest Emblem Glass Card */}
        <div className="relative w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20 ring-4 ring-white dark:ring-slate-800 transform hover:scale-105 transition-transform">
          <img
            src="/logo.png"
            alt="Govt HSS Shangus Logo"
            className="w-16 h-16 rounded-full object-contain drop-shadow-xs"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* School Name Header */}
      <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight font-serif mb-1 max-w-xl">
        {displayTitle}
      </h1>

      {/* Dynamic Module Pill Badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-teal-500/10 border border-teal-500/30 text-teal-700 dark:text-teal-300 mb-4 tracking-wide shadow-2xs">
        <span>{displayBadge}</span>
      </div>

      {/* Dynamic Quotes & Fact Box */}
      <div className="min-h-[52px] max-w-md w-full mb-4 flex flex-col items-center justify-center px-2">
        <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 italic transition-all duration-300">
          {quotesList[quoteIdx]?.text || quotesList[0].text}
        </div>
        <div className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest mt-1 opacity-90">
          {quotesList[quoteIdx]?.tag || displayTag}
        </div>
      </div>

      {/* Main Status & Subtext */}
      <div className="space-y-0.5 mb-5 max-w-md">
        <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
          {mainStatusText}
        </h2>
        {secondarySubtext && (
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {secondarySubtext}
          </p>
        )}
      </div>

      {/* Animated Shimmer Sweep Progress Bar */}
      <div className="w-48 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-r from-teal-500 via-sky-500 to-purple-600 rounded-full animate-pulse"
          style={{
            width: '45%',
            animation: 'hssSweep 1.6s ease-in-out infinite alternate'
          }}
        />
      </div>

      {/* Inline Keyframe Animation Style */}
      <style>{`
        @keyframes hssSweep {
          0% { left: 0%; width: 25%; }
          50% { width: 55%; }
          100% { left: 75%; width: 25%; }
        }
      `}</style>
    </div>
  );
}
