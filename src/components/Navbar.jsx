import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Phone, Mail, X, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

// 1. IMPORT YOUR LOCAL LOGO HERE 
import schoolLogo from '../images/logo.png';

export default function Navbar() {
  // State for smart scrolling
  const [isVisible, setIsVisible] = useState(true);
  // Mobile menu open
  const [mobileOpen, setMobileOpen] = useState(false);
  // Login URL for external portal
  const LOGIN_URL = 'https://script.google.com/macros/s/AKfycbxklDr4jb25tAiDDrIoU2pjEBe9UXmJxkbXY-jp-BXLjkq9FppA1NlE2Or-gCpwjp8B1g/exec';

  const openLoginWindow = () => {
    try {
      const w = window.screen.width || screen.width;
      const h = window.screen.height || screen.height;
      const features = `left=0,top=0,width=${w},height=${h},toolbar=no,location=no,menubar=no,resizable=yes,scrollbars=yes`;
      const newWin = window.open(LOGIN_URL, '_blank', features);
      if (newWin) newWin.focus();
      else window.open(LOGIN_URL, '_blank');
    } catch (e) {
      window.open(LOGIN_URL, '_blank');
    }
  };

  const location = useLocation();
  function isActive(path) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  // no modal Escape-key handler anymore

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

  const headerRef = useRef(null);

  // Measure header height and expose as CSS variable so pages can offset correctly
  useEffect(() => {
    function updateHeaderHeight() {
      const el = headerRef.current;
      if (!el) return;
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--site-header-height', `${h}px`);
    }
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, [mobileOpen, isVisible]);

  return (
    <>
      <header ref={headerRef} className={`w-full shadow-md z-40 fixed top-0 left-0 right-0 bg-white transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        {/* WRAPPER: keep content in flow; header is transformed to hide/show to avoid layout jitter */}
        <div className="overflow-hidden">
          {/* ROW 1: Top Contact Bar (hidden on small screens) */}
          <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 hidden md:flex justify-end space-x-6 border-b border-slate-700">
            <div className="flex items-center"><Phone size={12} className="mr-2 text-teal-500" /> +91-9682-547-458</div>
            <div className="flex items-center"><Mail size={12} className="mr-2 text-teal-500" /> adm.exam.hss.shangus@gmail.com</div>
          </div>

          {/* ROW 2: Logo and School Name */}
          <div className="max-w-7xl mx-auto px-4 py-1 md:py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img src={schoolLogo} alt="Govt HSS Shangus Logo" className="h-9 w-9 md:h-12 md:w-12 mr-3 object-contain" />
              <div>
                <h1 className="text-[14.4px] md:text-xl font-extrabold text-teal-800 tracking-tight leading-tight">
                  <span className="hidden md:inline">Govt. Higher Secondary School Shangus</span>
                  <span className="inline md:hidden">Govt. Hr Sec. School Shangus</span>
                </h1>
                <p className="text-[8.8px] md:text-[12px] text-slate-500 not-italic mt-0">nurturing minds, shaping futures</p>
              </div>
            </Link>

            {/* Mobile hamburger */}
            <div className="md:hidden flex items-center">
              <button
                aria-label="Toggle menu"
                onClick={() => setMobileOpen((s) => !s)}
                className="p-1 rounded text-slate-800 bg-slate-100 border border-slate-200"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* ROW 3: Navigation Menu */}
        <div className="bg-slate-800 border-b-[3px] border-orange-500 md:py-1.5">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center justify-center w-full">
              {/* Desktop menu */}
              <div className="hidden md:flex items-center gap-2">
                <Link to="/" className={`px-3 py-1 text-xs md:text-sm font-semibold ${isActive('/') ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-white hover:bg-slate-700 transition-colors border-t-2 border-transparent hover:border-orange-400'}`}>Home</Link>
                <Link to="/about" className={`px-3 py-1 text-xs md:text-sm font-semibold ${isActive('/about') ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-white hover:bg-slate-700 transition-colors border-t-2 border-transparent hover:border-orange-400'}`}>About Us</Link>
                <Link to="/academics" className={`px-3 py-1 text-xs md:text-sm font-semibold ${isActive('/academics') ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-white hover:bg-slate-700 transition-colors border-t-2 border-transparent hover:border-orange-400'}`}>Academics</Link>
                <Link to="/admissions" className={`px-3 py-1 text-xs md:text-sm font-semibold ${isActive('/admissions') ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-white hover:bg-slate-700 transition-colors border-t-2 border-transparent hover:border-orange-400'}`}>Admissions</Link>
              </div>

              {/* Login Button Area (Desktop) */}
              <div className="hidden md:flex ml-2 md:ml-4 pl-2 md:pl-4 md:border-l border-slate-600 flex items-center h-full py-1">
                <button
                  onClick={openLoginWindow}
                  className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-md hover:from-teal-700 hover:to-teal-600 transition-colors"
                >
                  Login
                </button>
              </div>
            </nav>
          </div>

          {/* Mobile slide-down menu */}
          {mobileOpen && (
              <div className="md:hidden bg-slate-800 text-white border-t border-slate-700">
              <div className="px-4 py-4 space-y-3">
                <Link to="/" onClick={() => setMobileOpen(false)} className={`block font-semibold px-3 py-2 rounded ${isActive('/') ? 'bg-slate-700' : ''}`}>Home</Link>
                <Link to="/about" onClick={() => setMobileOpen(false)} className={`block font-semibold px-3 py-2 rounded ${isActive('/about') ? 'bg-slate-700' : ''}`}>About Us</Link>
                <Link to="/academics" onClick={() => setMobileOpen(false)} className={`block font-semibold px-3 py-2 rounded ${isActive('/academics') ? 'bg-slate-700' : ''}`}>Academics</Link>
                <Link to="/admissions" onClick={() => setMobileOpen(false)} className={`block font-semibold px-3 py-2 rounded ${isActive('/admissions') ? 'bg-slate-700' : ''}`}>Admissions</Link>
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-teal-400"/> +91-9682-547-458</div>
                  <div className="flex items-center gap-2 text-sm mt-1"><Mail size={14} className="text-teal-400"/> adm.exam.hss.shangus@gmail.com</div>
                </div>
                <div className="pt-3">
                  <button onClick={() => { openLoginWindow(); setMobileOpen(false); }} className="w-full px-3 py-1 bg-gradient-to-r from-teal-600 to-teal-500 rounded font-bold text-sm">Login</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      
    </>
  );
}
