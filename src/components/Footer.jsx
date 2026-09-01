import React, { useState, useEffect } from 'react';
import { BookOpen, X, Mail, Info, Lock, Unlock, Code, Terminal, Sparkles, Cpu, GraduationCap, Plane, Wallet, Zap, Globe, ExternalLink, ShieldCheck, MapPin, Layers, Building2, FileText, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadSiteSettings, DEFAULT_SETTINGS } from '../utils/settingsLoader';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';


// Social Media Custom SVG Icons (since brand icons are not exported in this Lucide version)
function FacebookIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function YoutubeIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  );
}

function TwitterIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

function InstagramIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// Smart email link handler (opens Gmail web on desktop, uses mailto on mobile)
function handleEmailClick(e, email, subject = '', body = '') {
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) {
    e.preventDefault();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}${subject ? `&su=${encodeURIComponent(subject)}` : ''}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  }
}

export default function Footer() {
  // This state controls which popup is open ('privacy', 'terms', or null for closed)
  const [activeModal, setActiveModal] = useState(null);
  // Contact form state is handled by ContactForm component
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadSiteSettings().then(setSettings);

    const checkAdmin = () => {
      const isAuth = sessionStorage.getItem('isAdminAuthenticated') === 'true' || !!auth?.currentUser;
      setIsAdmin(isAuth);
    };
    checkAdmin();
    const unsub = auth?.onAuthStateChanged(() => checkAdmin());

    try {
      const channel = new BroadcastChannel('hss_data_sync');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'UPDATE_DATA') {
          loadSiteSettings().then(setSettings);
        }
      };
      return () => {
        channel.close();
        if (unsub) unsub();
      };
    } catch (err) {
      return () => {
        if (unsub) unsub();
      };
    }
  }, []);

  return (
    <>
      <footer className="site-footer bg-slate-950 text-slate-300 pt-12 pb-24 md:pb-8 mt-0 border-t-[3px] footer-theme-border">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_0.65fr_1.2fr_0.95fr] gap-8 lg:gap-10 xl:gap-12 mb-8">

          {/* Brand */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center mb-4">
              <BookOpen className="text-teal-500 mr-2" size={24} />
              <h2 className="text-white font-bold text-lg tracking-wide font-title">Govt. H.S.S. Shangus</h2>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xl font-sans">
              Since 1971, Govt HSS Shangus provides Science, Humanities and Secondary education with experienced faculty, well-equipped labs, a library and active sports programs.
              We emphasise leadership, critical thinking and community engagement to prepare students for higher education and civic life.
            </p>

            {/* Social Media Links */}
            {settings.socialLinks && (
              <div className="flex gap-3 mt-4 items-center justify-center md:justify-start flex-wrap">
                {settings.socialLinks.facebook && settings.socialLinks.facebook !== '#' && (
                  <a
                    href={settings.socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 min-w-[2.25rem] max-w-[2.25rem] min-h-[2.25rem] max-h-[2.25rem] aspect-square rounded-full bg-slate-900 text-slate-300 hover:text-white hover:bg-[#961c14] border border-slate-800 transition-all duration-200 flex items-center justify-center shrink-0 shadow-sm hover:scale-110 active:scale-95"
                    title="Facebook"
                    aria-label="Facebook"
                  >
                    <FacebookIcon size={15} />
                  </a>
                )}
                {settings.socialLinks.youtube && settings.socialLinks.youtube !== '#' && (
                  <a
                    href={settings.socialLinks.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 min-w-[2.25rem] max-w-[2.25rem] min-h-[2.25rem] max-h-[2.25rem] aspect-square rounded-full bg-slate-900 text-slate-300 hover:text-white hover:bg-[#961c14] border border-slate-800 transition-all duration-200 flex items-center justify-center shrink-0 shadow-sm hover:scale-110 active:scale-95"
                    title="YouTube"
                    aria-label="YouTube"
                  >
                    <YoutubeIcon size={15} />
                  </a>
                )}
                {settings.socialLinks.twitter && settings.socialLinks.twitter !== '#' && (
                  <a
                    href={settings.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 min-w-[2.25rem] max-w-[2.25rem] min-h-[2.25rem] max-h-[2.25rem] aspect-square rounded-full bg-slate-900 text-slate-300 hover:text-white hover:bg-[#961c14] border border-slate-800 transition-all duration-200 flex items-center justify-center shrink-0 shadow-sm hover:scale-110 active:scale-95"
                    title="Twitter / X"
                    aria-label="Twitter / X"
                  >
                    <TwitterIcon size={15} />
                  </a>
                )}
                {settings.socialLinks.instagram && settings.socialLinks.instagram !== '#' && (
                  <a
                    href={settings.socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 min-w-[2.25rem] max-w-[2.25rem] min-h-[2.25rem] max-h-[2.25rem] aspect-square rounded-full bg-slate-900 text-slate-300 hover:text-white hover:bg-[#961c14] border border-slate-800 transition-all duration-200 flex items-center justify-center shrink-0 shadow-sm hover:scale-110 active:scale-95"
                    title="Instagram"
                    aria-label="Instagram"
                  >
                    <InstagramIcon size={15} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="text-center md:text-left">
            <h2 className="text-white font-bold mb-3 text-base tracking-wide font-sans">Quick Links</h2>
            <ul className="space-y-1 text-sm flex flex-col items-center md:items-start font-sans">
              <li><Link to="/" onClick={() => window.scrollTo(0, 0)} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors">Home</Link></li>
              <li><Link to="/about" onClick={() => window.scrollTo(0, 0)} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors">About Us</Link></li>
              <li><Link to="/admissions" onClick={() => window.scrollTo(0, 0)} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors">Admissions</Link></li>
              <li><Link to="/login" onClick={() => window.scrollTo(0, 0)} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors">Login / Portal</Link></li>
              <li><Link to="/academics" onClick={() => window.scrollTo(0, 0)} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors">Academics</Link></li>
            </ul>
          </div>

          {/* Contact Us - With Real Google Maps & Custom Spacing */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left font-sans">
            {/* 1. Heading + quick contact button */}
            <div className="flex items-center justify-center md:justify-start gap-2.5 mb-3">
              <h2 className="text-white font-bold text-base mb-0 mt-0 leading-tight tracking-wide font-sans">Contact Us</h2>
              <button
                onClick={() => setActiveModal('contactForm')}
                aria-label="Open contact form"
                className="btn-primary-custom rounded-lg w-7 h-7 min-w-[1.75rem] min-h-[1.75rem] aspect-square flex items-center justify-center text-xs font-bold shadow-md transition-all duration-200 hover:scale-105 shrink-0 cursor-pointer"
                style={{ boxShadow: '0 4px 12px rgba(16,185,129,0.18)' }}
              >
                <Mail size={13} />
              </button>
            </div>

            {/* 2. Map */}
            <div className="w-full max-w-xs md:max-w-none rounded-xl overflow-hidden border-2 border-slate-800 leading-none m-0 mt-1 shadow-md hover:border-teal-500/50 transition-colors duration-300">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d651.5363008761467!2d75.28722872804701!3d33.697775316694695!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x38e20b9b41c3c13b%3A0xcf46d931eae137a!2sGovt%20Higher%20Secondry%20School%20Shangus!5e1!3m2!1sen!2sin!4v1776567033858!5m2!1sen!2sin"
                width="100%"
                height="110"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="School Location Map"
              />
            </div>

            {/* Line 1 */}
            <div className="w-[2px] h-[10px] bg-[#10b981] m-0 mt-3 md:self-start"></div>

            {/* 3. Address Box */}
            <div className="text-center md:text-left w-full m-0 p-0 mt-2">
              <div className="text-slate-400 text-[14px] leading-[1.4] m-0 p-0 font-sans">
                Main Road, Shangus,<br />Anantnag, J&K - 192201
              </div>
            </div>
          </div>

          {/* Legal & Compliance Menu */}
          <div className="text-center md:text-left">
            <h2 className="text-white font-bold mb-3 text-base tracking-wide font-sans">Legal & Compliance</h2>
            <ul className="space-y-1 text-sm flex flex-col items-center md:items-start font-sans">
              <li><button onClick={() => setActiveModal('privacy')} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors focus:outline-none cursor-pointer">
                Privacy Policy
              </button></li>
              <li><button onClick={() => setActiveModal('terms')} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors focus:outline-none cursor-pointer">
                Terms & Conditions
              </button></li>
              <li><button onClick={() => setActiveModal('refund')} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors focus:outline-none cursor-pointer">
                Refund Policy
              </button></li>
              <li><button onClick={() => setActiveModal('contact')} className="text-slate-400 hover:text-teal-400 py-1 px-1 inline-block transition-colors focus:outline-none cursor-pointer">
                Contact Us
              </button></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar - Developer Credit, Contact Links & Admin Portal Trigger */}
        <div className="max-w-7xl mx-auto px-4 pt-6 border-t border-slate-800 flex flex-col items-center text-center gap-2 text-xs text-white font-sans">
          
          {/* Mobile Only: Admin Portal Lock Button placed ABOVE Copyright */}
          <div className="flex md:hidden items-center justify-center mb-1 pt-0.5">
            <Link
              to="/portal/login"
              onClick={() => window.scrollTo(0, 0)}
              title="Open Login Portal"
              className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-sm hover:scale-105 cursor-pointer border"
              style={{
                color: isAdmin ? '#059669' : '#0f766e',
                backgroundColor: isAdmin ? '#ecfdf5' : '#f0fdf4',
                borderColor: isAdmin ? '#a7f3d0' : '#ccfbf1'
              }}
              aria-label="Open Login Portal"
            >
              {isAdmin ? (
                <Unlock size={20} className="stroke-[2.2] animate-pulse" />
              ) : (
                <Lock size={20} className="stroke-[2.2]" />
              )}
            </Link>
          </div>

          {/* Line 1: Copyright */}
          <p className="text-slate-400 font-medium text-xs sm:text-sm">© 2023 Govt HSS Shangus. All Rights Reserved.</p>

          {/* Line 2: Developer Credit Badge */}
          <div className="pt-2 flex flex-col items-center justify-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-400/80 hover:border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_22px_rgba(6,182,212,0.45)] transition-all duration-300 font-mono text-xs backdrop-blur-md">
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Terminal size={14} className="text-cyan-400 animate-pulse" />
                <span className="text-slate-500 text-[11px] font-bold">&lt;dev&gt;</span>
              </span>
              <div className="flex items-center gap-1">
                <a 
                  href="https://nexliftech.netlify.app/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-extrabold text-cyan-300 hover:text-cyan-200 transition-all underline decoration-cyan-400/50 hover:decoration-cyan-200 underline-offset-4 tracking-tight"
                >
                  Next Life Technologies
                </a>
                <button
                  type="button"
                  onClick={() => setActiveModal('companyInfo')}
                  className="inline-flex items-center justify-center text-cyan-400 hover:text-cyan-200 transition-colors cursor-pointer p-0.5"
                  title="About Next Life Technologies (NexLifTech)"
                  aria-label="About Company Info"
                >
                  <Info size={13} strokeWidth={2.5} />
                </button>
              </div>

              <span className="text-slate-700 font-bold">&lt;/dev&gt;</span>
              <span className="text-slate-700 font-bold">|</span>

              {/* Developer Contact Actions */}
              <div className="flex items-center gap-2">
                <a 
                  href="https://wa.me/919682547458" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#25D366] hover:text-emerald-300 transition-all transform hover:scale-105 flex items-center gap-1 text-[11px] font-bold" 
                  title="Contact Developer on WhatsApp (+91 9682547458)"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.024-5.11-2.887-6.974C16.486 1.91 14.018.883 11.399.883c-5.438 0-9.863 4.42-9.866 9.861 0 1.764.496 3.488 1.443 5.074l-1.012 3.693 3.793-1.042L6.647 19.16zM17.15 13.9c-.282-.142-1.67-.824-1.929-.918-.258-.094-.447-.142-.635.142-.188.283-.729.918-.894 1.106-.165.188-.329.212-.612.071-.282-.141-1.192-.44-2.271-1.402-.84-.749-1.407-1.673-1.572-1.956-.165-.283-.018-.436.123-.576.127-.126.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.53-.87-2.094-.229-.553-.46-.477-.635-.486-.164-.008-.353-.01-.54-.01-.188 0-.494.07-.753.353-.258.282-.988.965-.988 2.353s1.011 2.73 1.152 2.918c.142.188 1.99 3.04 4.821 4.261.673.29 1.2.463 1.609.593.676.214 1.291.184 1.777.112.541-.08 1.67-.682 1.905-1.341.235-.659.235-1.223.165-1.341-.07-.118-.259-.188-.541-.33z" />
                  </svg>
                  <span>WhatsApp</span>
                </a>

                <span className="text-slate-700 font-bold">/</span>

                <a 
                  href="mailto:2nexlif@gmail.com" 
                  onClick={(e) => handleEmailClick(e, '2nexlif@gmail.com')} 
                  className="text-cyan-400 hover:text-cyan-300 transition-all transform hover:scale-105 flex items-center gap-1 text-[11px] font-bold" 
                  title="Email Developer (2nexlif@gmail.com)"
                >
                  <Mail size={13} />
                  <span>Email</span>
                </a>
              </div>
            </div>
          </div>
        </div>


      </footer>
      {/* If activeModal is NOT null, draw this dark background overlay */}
      {activeModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-300"
          onClick={() => setActiveModal(null)}
        >
          {/* Glassmorphic Popup Box */}
          <div
            className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl sm:rounded-3xl border border-teal-500/20 dark:border-teal-500/30 shadow-[0_25px_70px_-15px_rgba(13,148,136,0.35)] max-w-2xl w-full relative animate-in zoom-in-95 duration-250 max-h-[88vh] sm:max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Glows */}
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Accent Gradient Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500 shrink-0 z-30" />

            {/* Standard Modal Sticky Header */}
            <div className="flex items-center justify-between px-5 sm:px-7 py-3 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shrink-0 z-20">
              <div className="flex items-center gap-2.5">
                {activeModal === 'privacy' && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none">Privacy Policy</h2>
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">School Policy</span>
                    </div>
                  </div>
                )}
                {activeModal === 'terms' && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none">Terms & Conditions</h2>
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Portal Agreement</span>
                    </div>
                  </div>
                )}
                {activeModal === 'refund' && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <RefreshCw size={18} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none">Refund Policy</h2>
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Fee Refunds</span>
                    </div>
                  </div>
                )}
                {activeModal === 'contact' && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <Mail size={18} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none">Contact Us</h2>
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">School Office</span>
                    </div>
                  </div>
                )}
                {activeModal === 'contactForm' && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <Mail size={18} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none">Send Us a Message</h2>
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Admissions & Exams</span>
                    </div>
                  </div>
                )}
                {activeModal === 'companyInfo' && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 via-emerald-500 to-teal-400 text-white shadow-sm flex items-center justify-center flex-shrink-0">
                      <Building2 size={17} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none">Next Life Technologies</h2>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider">NexLifTech</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Responsive Close Button */}
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                aria-label="Close dialog"
                title="Close"
              >
                <X size={18} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Scrollable Inner Body with Sleek Contained Scrollbar */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4 sm:py-5 custom-scrollbar overscroll-contain relative z-10">

              {/* Next Life Technologies (NexLifTech) Company Profile Modal */}
              {activeModal === 'companyInfo' && (
                <div className="space-y-4">
                  {/* Hero / Company Profile Spotlight Card */}
                  <div className="rounded-2xl bg-gradient-to-br from-teal-50/80 via-slate-50 to-emerald-50/80 dark:from-slate-800 dark:via-slate-850 dark:to-teal-950/40 p-4 md:p-5 border border-teal-200/80 dark:border-teal-800/60 shadow-xs space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">
                        <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
                        Company Overview
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-900/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-700">
                        <MapPin size={10} className="text-teal-600 dark:text-teal-400" />
                        Anantnag, J&K
                      </span>
                    </div>

                    <p className="text-xs md:text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
                      <strong className="text-slate-950 dark:text-white font-bold">NexLifTech</strong> provides digital transformation, custom software, ERP solutions, and web development services tailored to institutions and businesses.
                    </p>

                    {/* Badges / Credentials */}
                    <div className="pt-2 border-t border-teal-200/60 dark:border-teal-800/60 flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-100/80 dark:bg-teal-900/50 text-teal-900 dark:text-teal-200 border border-teal-300/80 dark:border-teal-700 flex items-center gap-1">
                        <Cpu size={11} className="text-teal-700 dark:text-teal-300" /> Enterprise ERP Solutions
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700 flex items-center gap-1">
                        <Code size={11} className="text-emerald-700 dark:text-emerald-300" /> Full-Stack & Automation
                      </span>
                    </div>
                  </div>

                  {/* Tech Stack Banner */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers size={13} className="text-teal-600 dark:text-teal-400" />
                      Core Tech Stack & Frameworks
                    </h4>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                      {['React', 'Next.js', 'Vite', 'Cloud Architecture', 'Python', 'Tailwind CSS', 'Node.js', 'PostgreSQL'].map((tech) => (
                        <span key={tech} className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Portfolio Grid */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Globe size={13} className="text-teal-600 dark:text-teal-400" />
                      Portfolio Solutions
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-teal-500/10 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-500/20">
                        <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <GraduationCap size={14} />
                          </div>
                          Education & ERP
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-8">
                          Admission management portals, fee tracking & student reporting systems.
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500/5 to-blue-500/10 dark:from-sky-950/30 dark:to-blue-950/20 border border-sky-500/20">
                        <div className="flex items-center gap-2 font-bold text-sky-900 dark:text-sky-300 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                            <Plane size={14} />
                          </div>
                          Travel & Hospitality
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-8">
                          Custom booking engines, reservation portals & package systems.
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/10 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-500/20">
                        <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                            <Wallet size={14} />
                          </div>
                          Finance & Accounts
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-8">
                          Ledger management, expense tracking & digital billing platforms.
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/10 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-500/20">
                        <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                            <Zap size={14} />
                          </div>
                          Workflow Automation
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-8">
                          Automated data extraction, spreadsheet syncing & database workflows.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <a
                      href="https://nexliftech.netlify.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Visit Official Website
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Privacy Policy Content */}
              {activeModal === 'privacy' && (
                <div className="space-y-4">
                  <div className="space-y-3 text-[12px] md:text-sm text-slate-650 dark:text-slate-300 leading-relaxed">
                    <p><strong className="text-slate-800 dark:text-white">1. Information We Collect:</strong> We collect student and contact information solely for admissions, student records, fee receipts, and school communications.</p>
                    <p><strong className="text-slate-800 dark:text-white">2. Secure Online Payments:</strong> Fee payments are securely handled by authorized payment gateways (Razorpay / Cashfree). The school does not collect or store card numbers, CVV, or net banking passwords on our servers.</p>
                    <p><strong className="text-slate-800 dark:text-white">3. Data Protection:</strong> We do not sell, rent, or trade your personal information to third parties or marketing platforms.</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <Link
                      to="/privacy-policy"
                      onClick={() => { setActiveModal(null); window.scrollTo(0, 0); }}
                      className="w-full sm:w-auto px-5 py-2.5 btn-primary-custom text-xs font-bold rounded-xl shadow-md text-center transition-transform hover:-translate-y-0.5"
                    >
                      Read Full Privacy Policy →
                    </Link>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Terms and Conditions Content */}
              {activeModal === 'terms' && (
                <div className="space-y-4">
                  <div className="space-y-3 text-[12px] md:text-sm text-slate-650 dark:text-slate-300 leading-relaxed">
                    <p><strong className="text-slate-800 dark:text-white">1. Accurate Information:</strong> Users agree to provide correct details during registration. Falsified documents will result in cancellation of admission.</p>
                    <p><strong className="text-slate-800 dark:text-white">2. Fee Payments in INR:</strong> All fees are charged in Indian Rupees (INR ₹) and are complete upon successful payment gateway confirmation.</p>
                    <p><strong className="text-slate-800 dark:text-white">3. Portal Use:</strong> Users must not attempt unauthorized access, misuse digital receipts, or disrupt website services.</p>
                    <p><strong className="text-slate-800 dark:text-white">4. Governing Law:</strong> Governed by laws applicable in Jammu & Kashmir and India (Jurisdiction: District Anantnag, J&K).</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <Link
                      to="/terms-and-conditions"
                      onClick={() => { setActiveModal(null); window.scrollTo(0, 0); }}
                      className="w-full sm:w-auto px-5 py-2.5 btn-primary-custom text-xs font-bold rounded-xl shadow-md text-center transition-transform hover:-translate-y-0.5"
                    >
                      Read Full Terms & Conditions →
                    </Link>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Refund Policy Content */}
              {activeModal === 'refund' && (
                <div className="space-y-4">
                  <div className="space-y-3 text-[12px] md:text-sm text-slate-650 dark:text-slate-300 leading-relaxed">
                    <p><strong className="text-slate-800 dark:text-white">1. Refund Timeline (5 to 7 Days):</strong> Approved refunds for duplicate payments or failed transactions are credited back to the original payment source within <strong>5 to 7 working days</strong>.</p>
                    <p><strong className="text-slate-800 dark:text-white">2. Duplicate Payments:</strong> If money was deducted multiple times for the same application, the extra amount will be refunded upon verification.</p>
                    <p><strong className="text-slate-800 dark:text-white">3. Confirmed Admissions:</strong> Once admission is confirmed and recorded by the school, session admission fees are generally non-refundable.</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <Link
                      to="/refund-policy"
                      onClick={() => { setActiveModal(null); window.scrollTo(0, 0); }}
                      className="w-full sm:w-auto px-5 py-2.5 btn-primary-custom text-xs font-bold rounded-xl shadow-md text-center transition-transform hover:-translate-y-0.5"
                    >
                      Read Full Refund Policy →
                    </Link>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Contact Us Content */}
              {activeModal === 'contact' && (
                <div className="space-y-4">
                  <div className="space-y-3 text-[12px] md:text-sm text-slate-650 dark:text-slate-300 leading-relaxed">
                    <p><strong className="text-slate-800 dark:text-white">Address:</strong> Main Road, Shangus, Anantnag, Jammu & Kashmir - 192201</p>
                    <p><strong className="text-slate-800 dark:text-white">Email:</strong> <a href="mailto:adm.exam.hss.shangus@gmail.com" className="text-[var(--teal-accent)] font-bold hover:underline">adm.exam.hss.shangus@gmail.com</a></p>
                    <p><strong className="text-slate-800 dark:text-white">Phone:</strong> +91 7006034501 / +91 9682547458</p>
                    <p><strong className="text-slate-800 dark:text-white">Working Hours:</strong> Mon – Sat: 10:00 AM – 4:00 PM</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <Link
                      to="/contact-us"
                      onClick={() => { setActiveModal(null); window.scrollTo(0, 0); }}
                      className="w-full sm:w-auto px-5 py-2.5 btn-primary-custom text-xs font-bold rounded-xl shadow-md text-center transition-transform hover:-translate-y-0.5"
                    >
                      Go to Full Contact Page →
                    </Link>
                    <button
                      onClick={() => setActiveModal('contactForm')}
                      className="w-full sm:w-auto px-4 py-2.5 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 text-xs font-bold rounded-xl text-center transition-colors font-semibold"
                    >
                      Send Quick Message
                    </button>
                  </div>
                </div>
              )}

              {/* Contact Form Content */}
              {activeModal === 'contactForm' && (
                <div>
                  <ContactForm onClose={() => setActiveModal(null)} />
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ContactForm({ onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  const subjects = [
    'Admissions',
    'Academics',
    'Examination',
    'Fees',
    'General Inquiry',
    'Feedback',
  ];


  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!name.trim() || !phone.trim() || !message.trim() || subject === '') {
      setFormError('Please fill required fields: Name, Phone, Subject, Message');
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      subject,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    // persist locally so admin can view even without backend
    try {
      const existing = JSON.parse(localStorage.getItem('site_messages') || '[]');
      existing.unshift(payload);
      localStorage.setItem('site_messages', JSON.stringify(existing));
    } catch (err) {
      // ignore localStorage errors
    }

    try {
      // 1. Try to save to Firestore first (Live Database)
      if (db) {
        await addDoc(collection(db, 'messages'), payload);
        setFormSuccess(true);
        return;
      }
      
      throw new Error('Database not configured');
    } catch (err) {
      console.error('Message submission failed:', err);
      setShowFallback(true);
    }
  }

  if (showFallback) {
    const to = 'adm.exam.hss.shangus@gmail.com';
    const mailSubject = encodeURIComponent(`${subject} - Website Contact`);
    const body = encodeURIComponent(
      `Name: ${name}\nPhone: ${phone}\nEmail: ${email || 'N/A'}\n\nMessage:\n${message}`
    );
    const wsBody = encodeURIComponent(
      `*Website Inquiry*\n*Name:* ${name}\n*Phone:* ${phone}\n*Email:* ${email || 'N/A'}\n*Subject:* ${subject}\n\n*Message:*\n${message}`
    );

    return (
      <div className="space-y-6 py-2">
        <div className="banner-teal-custom p-4 rounded-lg flex items-start gap-3 border text-xs">
          <div className="bg-emerald-500 text-white rounded-full p-1 mt-0.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-[15px]">Logged to Admin Messages Panel</h4>
            <p className="text-xs mt-1">
              Your inquiry has been successfully logged on this system's Admin Messages board.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium">
            Since the database server is currently offline, please choose a method below to deliver your message to the <strong>Admissions & Exams</strong> department:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <a
              href={`https://wa.me/917006034501?text=${wsBody}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="bg-[#25D366] text-white hover:bg-[#20ba5a] font-bold px-4 py-3.5 rounded-lg flex items-center justify-center gap-2.5 w-full transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-center text-sm"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.024-5.11-2.887-6.974C16.486 1.91 14.018.883 11.399.883c-5.438 0-9.863 4.42-9.866 9.861 0 1.764.496 3.488 1.443 5.074l-1.012 3.693 3.793-1.042L6.647 19.16zM17.15 13.9c-.282-.142-1.67-.824-1.929-.918-.258-.094-.447-.142-.635.142-.188.283-.729.918-.894 1.106-.165.188-.329.212-.612.071-.282-.141-1.192-.44-2.271-1.402-.84-.749-1.407-1.673-1.572-1.956-.165-.283-.018-.436.123-.576.127-.126.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.53-.87-2.094-.229-.553-.46-.477-.635-.486-.164-.008-.353-.01-.54-.01-.188 0-.494.07-.753.353-.258.282-.988.965-.988 2.353s1.011 2.73 1.152 2.918c.142.188 1.99 3.04 4.821 4.261.673.29 1.2.463 1.609.593.676.214 1.291.184 1.777.112.541-.08 1.67-.682 1.905-1.341.235-.659.235-1.223.165-1.341-.07-.118-.259-.188-.541-.33z" />
              </svg>
              WhatsApp
            </a>

            <a
              href={`mailto:${to}?subject=${mailSubject}&body=${body}`}
              onClick={(e) => {
                handleEmailClick(e, to, subject + ' - Website Contact', `Name: ${name}\nPhone: ${phone}\nEmail: ${email || 'N/A'}\n\nMessage:\n${message}`);
                onClose();
              }}
              className="bg-[#ea4335] text-white hover:bg-[#d93025] font-bold px-4 py-3.5 rounded-lg flex items-center justify-center gap-2.5 w-full transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-center text-sm"
            >
              <Mail size={18} />
              Email App
            </a>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold rounded-md transition-all text-sm btn-cancel-custom"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (formSuccess) {
    return (
      <div className="space-y-6 py-2">
        <div className="banner-teal-custom p-4 rounded-lg flex items-start gap-3 border text-xs">
          <div className="bg-emerald-500 text-white rounded-full p-1 mt-0.5 flex-shrink-0 animate-pulse">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-[15px]">Message Sent Successfully</h4>
            <p className="text-xs mt-1">
              Your inquiry has been successfully delivered and saved to the administration console.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-250 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold rounded-md transition-all text-sm btn-cancel-custom"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
      {formError && (
        <div className="banner-red-custom p-3 rounded-lg text-xs flex items-center gap-2 mb-3 border">
          <svg className="w-4 h-4 flex-shrink-0 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-semibold">{formError}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Your Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mohammad Aamir" className="w-full mt-1 p-2 border rounded-md text-sm" required />
        </div>
        <div>
          <label className="text-sm font-medium">Phone Number</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" className="w-full mt-1 p-2 border rounded-md text-sm" required />
        </div>
        <div>
          <label className="text-sm font-medium">Email Address (optional)</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. you@email.com" className="w-full mt-1 p-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Subject</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full mt-1 p-2 border rounded-md text-sm" required>
            <option value="" disabled>-- Select a subject --</option>
            {subjects.map((s, i) => (
              <option key={i} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Your Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message here..." rows={5} className="w-full mt-1 p-2 border rounded-md text-sm" required />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary-custom font-bold px-4 py-2 rounded w-full shadow-md transition-all duration-200">
          Send Message
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 border rounded w-32 btn-cancel-custom">
          Cancel
        </button>
      </div>
    </form>
  );
}

