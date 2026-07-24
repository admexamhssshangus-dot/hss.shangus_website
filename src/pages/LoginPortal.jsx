import React, { useState } from 'react';
import { ExternalLink, Lock, UserCheck, ShieldCheck, FileText, ArrowRight, RefreshCw, GraduationCap, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function LoginPortal() {
  const [showEmbed, setShowEmbed] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxklDr4jb25tAiDDrIoU2pjEBe9UXmJxkbXY-jp-BXLjkq9FppA1NlE2Or-gCpwjp8B1g/exec';

  const openPortalWindow = () => {
    try {
      const w = (typeof window !== 'undefined' && window.screen && window.screen.width) ? window.screen.width : 1024;
      const h = (typeof window !== 'undefined' && window.screen && window.screen.height) ? window.screen.height : 768;
      const features = `left=0,top=0,width=${w},height=${h},toolbar=no,location=no,menubar=no,resizable=yes,scrollbars=yes`;
      const newWin = window.open(APPSCRIPT_URL, '_blank', features);
      if (newWin) newWin.focus();
      else window.open(APPSCRIPT_URL, '_blank');
    } catch (e) {
      window.open(APPSCRIPT_URL, '_blank');
    }
  };

  return (
    <div className="w-full bg-slate-900 text-white min-h-[85vh] py-8 sm:py-12 px-4 sm:px-6">
      <SEO 
        title="Student & Staff Login Portal" 
        description="Official Govt HSS Shangus Student & Staff Login Portal. Access online services, examination details, fee receipts, roll numbers, and attendance tracking." 
        path="/login"
      />

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-slate-800 via-teal-950 to-slate-800 rounded-3xl p-6 sm:p-10 border border-teal-500/30 shadow-2xl relative overflow-hidden text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold">
              <ShieldCheck size={14} className="text-teal-400" />
              Official Govt HSS Shangus Portal
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white font-title tracking-tight leading-tight">
              Student & Staff Login Portal
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Access online admissions status, examination results, student registration records, roll number generation, and faculty utilities.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto z-10 flex-shrink-0">
            <button
              onClick={openPortalWindow}
              className="px-6 py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              <span>Launch Full Login Window</span>
              <ExternalLink size={18} />
            </button>

            <button
              onClick={() => setShowEmbed(!showEmbed)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={showEmbed ? "animate-spin" : ""} />
              <span>{showEmbed ? "Hide Embedded Portal" : "View Portal Inside Page"}</span>
            </button>
          </div>
        </div>

        {/* Embedded Iframe Container (Toggleable) */}
        {showEmbed && (
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative">
            <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2 font-mono">
                <Lock size={12} className="text-teal-400" /> Secure AppScript Instance
              </span>
              <a 
                href={APPSCRIPT_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline flex items-center gap-1"
              >
                Open in new tab <ExternalLink size={12} />
              </a>
            </div>

            {iframeLoading && (
              <div className="h-96 flex flex-col items-center justify-center space-y-3 bg-slate-950 text-slate-400">
                <RefreshCw size={28} className="animate-spin text-teal-400" />
                <p className="text-xs font-medium">Connecting to Google Apps Script Portal...</p>
              </div>
            )}

            <iframe
              src={APPSCRIPT_URL}
              title="Govt HSS Shangus Login Portal"
              className="w-full h-[650px] border-0"
              onLoad={() => setIframeLoading(false)}
            />
          </div>
        )}

        {/* Portal Features & Quick Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 space-y-3 hover:border-teal-500/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold">
              <GraduationCap size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Student Services</h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-teal-400 flex-shrink-0" /> Check Admission Application Status</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-teal-400 flex-shrink-0" /> Download Examination Roll Slip</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-teal-400 flex-shrink-0" /> View Session Fee Receipts</li>
            </ul>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 space-y-3 hover:border-teal-500/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <UserCheck size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Teacher & Staff Panel</h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400 flex-shrink-0" /> Manage Student Attendance & Lists</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400 flex-shrink-0" /> Upload Marks & Evaluation Sheets</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400 flex-shrink-0" /> Academic Reports & Circulars</li>
            </ul>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 space-y-3 hover:border-teal-500/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
              <FileText size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">Admissions & Verification</h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-sky-400 flex-shrink-0" /> Online Registration Desk</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-sky-400 flex-shrink-0" /> Document Verification Desk</li>
              <li className="flex items-center gap-2"><CheckCircle size={14} className="text-sky-400 flex-shrink-0" /> Stream Selection & Subjects</li>
            </ul>
          </div>
        </div>

        {/* Navigation Quick Links Bar */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <strong className="text-white block font-semibold text-sm">Explore Govt HSS Shangus Official Website</strong>
            <span>Quick navigation links for search engines and visitors</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admissions" className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold transition-colors flex items-center gap-1">
              Admissions 2026 <ArrowRight size={12} />
            </Link>
            <Link to="/about" className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors flex items-center gap-1">
              About Us <ArrowRight size={12} />
            </Link>
            <Link to="/academics" className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors flex items-center gap-1">
              Academics <ArrowRight size={12} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
