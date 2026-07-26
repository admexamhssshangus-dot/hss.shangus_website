import React from 'react';
import { ExternalLink, UserCheck, ShieldCheck, FileText, ArrowRight, GraduationCap, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function LoginPortal() {
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

  // Theme-aware styles using CSS custom properties from index.css theme system
  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border-ui)',
    color: 'var(--text-main)',
  };

  const textMain = { color: 'var(--text-main)' };
  const textMuted = { color: 'var(--text-muted)' };

  return (
    <div className="w-full min-h-[85vh] py-8 sm:py-12 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <SEO 
        title="Student & Staff Login Portal" 
        description="Official Govt HSS Shangus Student & Staff Login Portal. Access online services, examination details, fee receipts, roll numbers, and attendance tracking." 
        path="/login"
      />

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Header Hero Card — always dark gradient, always white text */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-10 border border-teal-500/30 shadow-2xl relative overflow-hidden text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-6" style={{ backgroundColor: '#042f2e' }}>
          <div className="space-y-3 max-w-2xl z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(20, 184, 166, 0.2)', borderColor: 'rgba(94, 234, 212, 0.4)', border: '1px solid rgba(94, 234, 212, 0.4)', color: '#5eead4' }}>
              <ShieldCheck size={14} style={{ color: '#5eead4' }} />
              Official Govt HSS Shangus Portal
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold font-title tracking-tight leading-tight" style={{ color: '#ffffff' }}>
              Student & Staff Login Portal
            </h1>
            <p className="text-sm sm:text-base leading-relaxed font-normal" style={{ color: '#f1f5f9' }}>
              Access online admissions status, examination results, student registration records, roll number generation, and faculty utilities.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto z-10 flex-shrink-0">
            <button
              onClick={openPortalWindow}
              className="login-cta-btn px-7 py-4 bg-teal-500 hover:bg-teal-400 font-extrabold rounded-2xl shadow-xl transition-all duration-200 flex items-center justify-center gap-2.5 text-base cursor-pointer"
              style={{ color: '#020617' }}
            >
              <span>Launch Full Login Window</span>
              <ExternalLink size={20} className="login-arrow-icon" />
            </button>
          </div>
        </div>

        {/* Portal Features & Quick Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Student Services Card */}
          <div className="rounded-2xl p-6 space-y-4 border transition-all hover:shadow-md" style={cardStyle}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold" style={{ backgroundColor: 'rgba(20, 184, 166, 0.1)', color: 'var(--teal-accent)' }}>
              <GraduationCap size={24} />
            </div>
            <h3 className="text-lg font-bold font-heading" style={textMain}>Student Services</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: 'var(--teal-accent)' }} /> 
                <span className="font-medium" style={textMain}>Check Admission Application Status</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: 'var(--teal-accent)' }} /> 
                <span className="font-medium" style={textMain}>Download Examination Roll Slip</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: 'var(--teal-accent)' }} /> 
                <span className="font-medium" style={textMain}>View Session Fee Receipts</span>
              </li>
            </ul>
          </div>

          {/* Teacher & Staff Panel Card */}
          <div className="rounded-2xl p-6 space-y-4 border transition-all hover:shadow-md" style={cardStyle}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <UserCheck size={24} />
            </div>
            <h3 className="text-lg font-bold font-heading" style={textMain}>Teacher & Staff Panel</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: '#10b981' }} /> 
                <span className="font-medium" style={textMain}>Manage Student Attendance & Lists</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: '#10b981' }} /> 
                <span className="font-medium" style={textMain}>Upload Marks & Evaluation Sheets</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: '#10b981' }} /> 
                <span className="font-medium" style={textMain}>Academic Reports & Circulars</span>
              </li>
            </ul>
          </div>

          {/* Admissions & Verification Card */}
          <div className="rounded-2xl p-6 space-y-4 border transition-all hover:shadow-md" style={cardStyle}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold" style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold font-heading" style={textMain}>Admissions & Verification</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: '#0ea5e9' }} /> 
                <span className="font-medium" style={textMain}>Online Registration Desk</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: '#0ea5e9' }} /> 
                <span className="font-medium" style={textMain}>Document Verification Desk</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle size={16} className="flex-shrink-0" style={{ color: '#0ea5e9' }} /> 
                <span className="font-medium" style={textMain}>Stream Selection & Subjects</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Navigation Quick Links Bar */}
        <div className="p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={cardStyle}>
          <div>
            <strong className="block font-bold text-sm sm:text-base" style={textMain}>Explore Govt HSS Shangus Official Website</strong>
            <span className="block mt-0.5" style={textMuted}>Quick navigation links for search engines and visitors</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admissions" className="px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5 shadow-sm" style={{ backgroundColor: 'var(--teal-accent)', color: '#ffffff' }}>
              Admissions 2026 <ArrowRight size={14} />
            </Link>
            <Link to="/about" className="px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5 border" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-main)', borderColor: 'var(--border-ui)' }}>
              About Us <ArrowRight size={14} />
            </Link>
            <Link to="/academics" className="px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5 border" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-main)', borderColor: 'var(--border-ui)' }}>
              Academics <ArrowRight size={14} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
