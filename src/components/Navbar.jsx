import React, { useState, useEffect } from 'react';
import { Phone, Mail, X } from 'lucide-react';
import { Link } from 'react-router-dom';

// 1. IMPORT YOUR LOCAL LOGO HERE 
import schoolLogo from '../images/logo.png';

export default function Navbar() {
  // State for smart scrolling
  const [isVisible, setIsVisible] = useState(true);
  // State for the Apps Script Login Pop-up
  const [showLoginModal, setShowLoginModal] = useState(false);

  // close modal on Escape key
  useEffect(() => {
    if (!showLoginModal) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowLoginModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLoginModal]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const delta = 40; // require a larger scroll to trigger hide/show
    let hideTimeout = null;

    const controlNavbar = () => {
      if (typeof window === 'undefined') return;
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;

      if (Math.abs(diff) < delta) return; // ignore tiny movements

      if (diff > 0 && currentScrollY > 120) {
        // scrolling down: debounce hide so quick flicks don't toggle
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => setIsVisible(false), 120);
      } else if (diff < 0) {
        // scrolling up: show immediately
        clearTimeout(hideTimeout);
        setIsVisible(true);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', controlNavbar, { passive: true });
    return () => {
      window.removeEventListener('scroll', controlNavbar);
      clearTimeout(hideTimeout);
    };
  }, []);

  return (
    <>
      <header className={`w-full shadow-md z-40 sticky top-0 bg-white transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        {/* WRAPPER: keep content in flow; header is transformed to hide/show to avoid layout jitter */}
        <div className="overflow-hidden">
          
          {/* ROW 1: Top Contact Bar */}
          <div className="bg-slate-900 text-slate-300 text-xs py-1 px-4 flex justify-end space-x-6 border-b border-slate-700">
            <div className="flex items-center"><Phone size={12} className="mr-2 text-teal-500" /> +91-9682-547-458</div>
            <div className="flex items-center"><Mail size={12} className="mr-2 text-teal-500" /> adm.exam.hss.shangus@gmail.com</div>
          </div>

          {/* ROW 2: Logo and School Name */}
          <div className="max-w-7xl mx-auto px-4 py-2 md:py-3 flex flex-col md:flex-row items-center justify-between">
            <Link to="/" className="flex items-center">
              <img src={schoolLogo} alt="Govt HSS Shangus Logo" className="h-12 w-12 md:h-14 md:w-14 mr-3 object-contain" />
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-teal-800 tracking-tight">
                  <span className="hidden md:inline">Govt. Higher Secondary School Shangus</span>
                  <span className="inline md:hidden">Govt. HSS Shangus</span>
                </h1>
                <p className="text-sm md:text-base text-slate-500 italic mt-0.5">nurturing minds, shaping futures</p>
              </div>
            </Link>
          </div>
        </div>

        {/* ROW 3: Navigation Menu */}
        <div className="bg-slate-800 border-b-[3px] border-orange-500">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex flex-wrap items-center justify-center w-full">
              <Link to="/" className="px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors border-t-2 border-transparent hover:border-orange-400">Home</Link>
              <Link to="/about" className="px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors border-t-2 border-transparent hover:border-orange-400">About Us</Link>
              <Link to="/academics" className="px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors border-t-2 border-transparent hover:border-orange-400">Academics</Link>
              <Link to="/admissions" className="px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors border-t-2 border-transparent hover:border-orange-400">Admissions</Link>
              
              {/* Login Button Area (Triggers the Apps Script Modal) */}
              <div className="ml-2 md:ml-4 pl-2 md:pl-4 md:border-l border-slate-600 flex items-center h-full py-1">
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-1 text-sm font-bold bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors shadow"
                >
                  Login
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* --- LOGIN MODAL (APPS SCRIPT IFRAME) --- */}
      {showLoginModal && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false); }}
        >
          <div
            className="bg-slate-100 rounded-sm shadow-2xl relative overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
            style={{ width: '99vw', height: '99vh', maxWidth: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header for the modal (compact) */}
            <div className="flex justify-between items-center px-3 py-1 border-b border-slate-200 bg-white">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                 <img src={schoolLogo} className="h-5 w-5" alt="logo" />
                 <span className="leading-none">Secure Portal</span>
              </h3>
              <button 
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-red-500 transition-colors bg-transparent p-1 rounded"
                aria-label="Close login modal"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Google Apps Script Login Portal Embedded Here */}
              <div className="flex-1 w-full bg-slate-100 relative" style={{ minHeight: 0 }}>
              {/* Loading Spinner underneath the iframe so it shows while Apps Script boots up */}
              <div className="absolute inset-0 flex flex-col items-center justify-center -z-10">
                 <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-slate-400 text-xs mt-3">Connecting to secure server...</p>
              </div>
              <iframe
                src="https://script.google.com/macros/s/AKfycbxklDr4jb25tAiDDrIoU2pjEBe9UXmJxkbXY-jp-BXLjkq9FppA1NlE2Or-gCpwjp8B1g/exec"
                className="w-full h-full border-0 rounded-none"
                title="School ERP Login Portal"
              />
            </div>

          </div>
        </div>
      )}
    </>
  );
}
