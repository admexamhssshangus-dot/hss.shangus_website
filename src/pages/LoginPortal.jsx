import React from 'react';
import { 
  UserCheck, ShieldCheck, FileText, ArrowRight, GraduationCap, 
  CheckCircle, Lock, Globe, Search, Award, Sparkles, Building2, QrCode
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function LoginPortal() {
  const cardStyle = {
    backgroundColor: 'var(--bg-card, #ffffff)',
    borderColor: 'var(--border-ui, #e2e8f0)',
    color: 'var(--text-main, #0f172a)',
  };

  const textMain = { color: 'var(--text-main, #0f172a)' };
  const textMuted = { color: 'var(--text-muted, #64748b)' };

  return (
    <div className="w-full min-h-[85vh] py-8 sm:py-12 px-3 sm:px-6" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', color: 'var(--text-main, #0f172a)' }}>
      <SEO 
        title="Student, Faculty & Admin Portal | Govt HSS Shangus ERP" 
        description="Official Govt HSS Shangus Digital Campus ERP. Access admissions, roll slips, exam evaluation, attendance, verifiable student records, and faculty utilities." 
        path="/login"
      />

      <div className="max-w-6xl mx-auto space-y-7 sm:space-y-9">
        
        {/* Top Header Hero Card */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-10 border border-teal-500/30 shadow-2xl relative overflow-hidden text-center sm:text-left flex flex-col lg:flex-row items-center justify-between gap-6" style={{ backgroundColor: '#042f2e' }}>
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-3 max-w-2xl z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-teal-500/20 border border-teal-400/40 text-teal-300">
              <ShieldCheck size={14} className="text-teal-300" />
              <span>Govt. Higher Secondary School Shangus • Official Digital Campus ERP</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-extrabold font-title tracking-tight leading-tight text-white">
              Student, Staff &amp; Institutional{' '}
              <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-200 bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer-text inline-block">
                Digital Portal
              </span>
            </h1>
            
            <p className="text-sm sm:text-base leading-relaxed font-normal text-slate-200">
              Unified enterprise school management suite powering online admissions, examination evaluations, verifiable student records, digital fee receipts, roll slips, and faculty workflows.
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-teal-200/90 font-medium">
              <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-teal-400" /> 256-Bit Encrypted</span>
              <span className="text-teal-500">•</span>
              <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-teal-400" /> Real-time Cloud Sync</span>
              <span className="text-teal-500">•</span>
              <span className="flex items-center gap-1.5"><Award size={13} className="text-teal-400" /> Academic Session 2025–26</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full sm:w-auto z-10 shrink-0">
            <Link
              to="/portal/login"
              className="login-cta-btn px-6 py-3.5 bg-teal-500 hover:bg-teal-400 font-extrabold rounded-2xl shadow-xl transition-all duration-200 flex items-center justify-center gap-2.5 text-sm sm:text-base cursor-pointer text-slate-950 no-underline hover:scale-105"
            >
              <span>Open Online Portal</span>
              <ArrowRight size={17} />
            </Link>

            <div className="flex items-center gap-2">
              <Link
                to="/results"
                className="flex-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center justify-center gap-1.5 text-center"
              >
                <Search size={13} />
                <span>Check Results</span>
              </Link>
              <Link
                to="/verify-student"
                className="flex-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center justify-center gap-1.5 text-center"
              >
                <QrCode size={13} />
                <span>Verify Student</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4 Pillars of the Institutional ERP */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-teal-600 block">
                Integrated Architecture
              </span>
              <h2 className="text-xl sm:text-2xl font-black font-heading tracking-tight" style={textMain}>
                Explore Institutional ERP Modules
              </h2>
            </div>
            <Link
              to="/portal/login"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>Sign In</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            
            {/* 1. Student Services Suite */}
            <div className="rounded-2xl p-5 border flex flex-col justify-between transition-all duration-200 hover:shadow-lg group" style={cardStyle}>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold bg-teal-500/10 text-teal-600 border border-teal-500/20 group-hover:scale-105 transition-transform">
                    <GraduationCap size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 border border-teal-500/20">
                    Students
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold font-heading" style={textMain}>Student Services Desk</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Admissions, roll slips, receipts &amp; scorecards</p>
                </div>

                <ul className="space-y-2 text-xs">
                  {[
                    'Online Admissions & Stream Selection',
                    'Download Exam Roll Slips & Admit Cards',
                    'Digital Session Fee Receipts & Ledger',
                    'Pre-Board & Term Marks Lookup',
                    'Real-time Attendance & Subject Allocation',
                    'Student Profile & Application Tracking'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-teal-500 shrink-0 mt-0.5" />
                      <span className="font-medium" style={textMain}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  to="/portal/login"
                  className="w-full py-2 px-3 rounded-xl text-xs font-black bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Student Portal</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* 2. Faculty Academic Workspace */}
            <div className="rounded-2xl p-5 border flex flex-col justify-between transition-all duration-200 hover:shadow-lg group" style={cardStyle}>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                    <UserCheck size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                    Faculty
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold font-heading" style={textMain}>Faculty Workspace</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Evaluation, attendance &amp; award rolls</p>
                </div>

                <ul className="space-y-2 text-xs">
                  {[
                    'Daily Class Attendance Rolls',
                    'Key-Navigation Practical & Theory Entry',
                    '1-Click Official Award Roll PDF Creation',
                    'Secondary (9th-10th) Tier Registers',
                    'Higher Secondary (11th-12th) Tiers',
                    'Cross-Subject & Multi-Class Evaluations'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span className="font-medium" style={textMain}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  to="/portal/login"
                  className="w-full py-2 px-3 rounded-xl text-xs font-black bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Faculty Workspace Login</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* 3. Administration & Control Suite */}
            <div className="rounded-2xl p-5 border flex flex-col justify-between transition-all duration-200 hover:shadow-lg group" style={cardStyle}>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20 group-hover:scale-105 transition-transform">
                    <Lock size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/20">
                    Admin
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold font-heading" style={textMain}>Admin Control Center</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Master registers, roll nos, certificates &amp; finance</p>
                </div>

                <ul className="space-y-2 text-xs">
                  {[
                    'Master Admission Register & Tabular Rolls',
                    'Automated Roll Number Allocation Engine',
                    'Certificate Studio (Bonafide/Character/Transfer)',
                    'Student ID Card Generator with Live QR',
                    'School Accounts, Cashbook & Fee Funds',
                    'Staff Permissions, 2SV & Audit Trails'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-purple-500 shrink-0 mt-0.5" />
                      <span className="font-medium" style={textMain}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  to="/portal/login"
                  className="w-full py-2 px-3 rounded-xl text-xs font-black bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Admin Control Center</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* 4. Public Digital Services */}
            <div className="rounded-2xl p-5 border flex flex-col justify-between transition-all duration-200 hover:shadow-lg group" style={cardStyle}>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 group-hover:scale-105 transition-transform">
                    <Globe size={22} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 border border-cyan-500/20">
                    Public
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold font-heading" style={textMain}>Public Campus Desk</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Results, verification, notices &amp; talent tests</p>
                </div>

                <ul className="space-y-2 text-xs">
                  {[
                    'Instant Public Result Lookup (9th–12th)',
                    'Live QR Student Verification Desk',
                    'Digital Notice Board & Circular Archive',
                    'Entrance & GK Talent Test Portal',
                    'Academic Curriculum & Stream Details',
                    'Principal & Administration Helpdesk'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-cyan-500 shrink-0 mt-0.5" />
                      <span className="font-medium" style={textMain}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <Link
                  to="/results"
                  className="flex-1 py-2 px-2 rounded-xl text-[11px] font-black bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/80 flex items-center justify-center gap-1 transition-colors text-center"
                >
                  <Search size={11} />
                  <span>Results</span>
                </Link>
                <Link
                  to="/verify-student"
                  className="flex-1 py-2 px-2 rounded-xl text-[11px] font-black bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/80 flex items-center justify-center gap-1 transition-colors text-center"
                >
                  <ShieldCheck size={11} />
                  <span>Verify</span>
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* Navigation Quick Links Bar */}
        <div className="p-5 sm:p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={cardStyle}>
          <div>
            <strong className="block font-bold text-sm sm:text-base" style={textMain}>Govt HSS Shangus Official Online Resources</strong>
            <span className="block mt-0.5" style={textMuted}>Direct navigation links for students, parents, examiners, and visitors</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <Link to="/results" className="px-3.5 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-xs bg-teal-600 hover:bg-teal-700 text-white">
              <Search size={13} />
              <span>Public Results</span>
            </Link>
            <Link to="/verify-student" className="px-3.5 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" style={textMain}>
              <ShieldCheck size={13} className="text-teal-600" />
              <span>Verify Student</span>
            </Link>
            <Link to="/admissions" className="px-3.5 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" style={textMain}>
              <span>Admissions 2026</span>
            </Link>
            <Link to="/notices" className="px-3.5 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" style={textMain}>
              <FileText size={13} />
              <span>Notice Board</span>
            </Link>
            <Link to="/academics" className="px-3.5 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" style={textMain}>
              <span>Academics</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
