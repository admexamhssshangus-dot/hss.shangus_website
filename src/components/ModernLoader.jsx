import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, BookOpen, GraduationCap, Award } from 'lucide-react';

const TIPS = [
  "Ensuring all student records match official school registers...",
  "Encrypting student application data & generating secure PDF credentials...",
  "Govt HSS Shangus offers Science, Arts & Vocational Streams with modern labs.",
  "Did you know? You can save your admission draft anytime and continue later.",
  "Automated email & WhatsApp notifications keep parents informed instantly."
];

export default function ModernLoader({ text = "Loading Data...", subtext = "Connecting to Google Cloud & School Databases..." }) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full py-16 px-4 flex flex-col items-center justify-center space-y-6 animate-fadeIn text-center">
      {/* Outer Glowing Ring Loader */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing ambient glow */}
        <div className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-teal-500/30 via-amber-500/20 to-indigo-500/30 blur-xl animate-pulse" />
        
        {/* Rotating gradient ring */}
        <div className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-r from-teal-500 via-emerald-400 to-amber-500 animate-spin">
          <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-teal-500 animate-bounce" />
          </div>
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="space-y-1.5 max-w-md">
        <h4 className="text-base font-extrabold bg-gradient-to-r from-teal-600 via-emerald-600 to-amber-600 bg-clip-text text-transparent">
          {text}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {subtext}
        </p>
      </div>

      {/* Rotating Info Ticker Card */}
      <div className="max-w-lg w-full p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm transition-all">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 animate-fadeIn key={tipIndex}">
          <GraduationCap className="w-4 h-4 text-teal-500 flex-shrink-0" />
          <span className="italic">"{TIPS[tipIndex]}"</span>
        </div>
      </div>

      {/* Skeleton Mockup Grid for Visual Interest */}
      <div className="w-full max-w-xl grid grid-cols-3 gap-3 opacity-60">
        <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
