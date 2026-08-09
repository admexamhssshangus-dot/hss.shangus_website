import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Phone, Mail, X, Menu, Lock, Unlock, LogOut, User, ShieldCheck } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { sessionManager } from '../services/sessionManager';
import ConfirmModal from '../portal/components/ConfirmModal';

// 1. IMPORT YOUR LOCAL LOGO HERE 
import schoolLogo from '../images/logo.png';

// WhatsApp SVG Icon component
function WhatsAppIcon({ size = 12, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.024-5.11-2.887-6.974C16.486 1.91 14.018.883 11.399.883c-5.438 0-9.863 4.42-9.866 9.861 0 1.764.496 3.488 1.443 5.074l-1.012 3.693 3.793-1.042L6.647 19.16zM17.15 13.9c-.282-.142-1.67-.824-1.929-.918-.258-.094-.447-.142-.635.142-.188.283-.729.918-.894 1.106-.165.188-.329.212-.612.071-.282-.141-1.192-.44-2.271-1.402-.84-.749-1.407-1.673-1.572-1.956-.165-.283-.018-.436.123-.576.127-.126.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.53-.87-2.094-.229-.553-.46-.477-.635-.486-.164-.008-.353-.01-.54-.01-.188 0-.494.07-.753.353-.258.282-.988.965-.988 2.353s1.011 2.73 1.152 2.918c.142.188 1.99 3.04 4.821 4.261.673.29 1.2.463 1.609.593.676.214 1.291.184 1.777.112.541-.08 1.67-.682 1.905-1.341.235-.659.235-1.223.165-1.341-.07-.118-.259-.188-.541-.33z" />
    </svg>
  );
}

// Smart email link handler (opens Gmail web on desktop, uses mailto on mobile)
function handleEmailClick(e, email) {
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) {
    e.preventDefault();
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}`, '_blank');
  }
}

export default function Navbar() {
  const navigate = useNavigate();
  // State for smart scrolling
  const [isVisible, setIsVisible] = useState(true);
  // Mobile menu open
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dynamicLinks, setDynamicLinks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const checkAuthStatus = () => {
    // 1. Check portal session via sessionManager (primary source of truth)
    const session = sessionManager.getSession();
    if (session && session.user && (session.user.role || session.user.email)) {
      setCurrentUser(session.user);
      setIsAdmin(session.user.role === 'Admin' || session.user.role === 'SuperAdmin');
      return;
    }

    // 2. Check legacy Admin Session via sessionStorage
    const isAdminAuth = sessionStorage.getItem('isAdminAuthenticated') === 'true';
    if (isAdminAuth) {
      const storedAdminRaw = sessionStorage.getItem('adminUser');
      let storedAdmin = null;
      if (storedAdminRaw) {
        try { storedAdmin = JSON.parse(storedAdminRaw); } catch (e) {}
      }
      const adminEmail = storedAdmin?.email || sessionStorage.getItem('adminEmail') || 'adm.exam.hss.shangus@gmail.com';
      const adminName = storedAdmin?.name || storedAdmin?.displayName || 'Admin';
      setCurrentUser({ name: adminName, role: 'SuperAdmin', email: adminEmail });
      setIsAdmin(true);
      return;
    }

    // 3. No active session — show Login button
    // NOTE: Firebase auth is intentionally NOT checked here. Firebase can remain
    // signed in after our custom session is cleared (e.g. clearSession() + signOut
    // are async). The Navbar must reflect the portal session, not Firebase state.
    setCurrentUser(null);
    setIsAdmin(false);
  };

  useEffect(() => {
    checkAuthStatus();
    const unsub = auth?.onAuthStateChanged(() => checkAuthStatus());

    const handleStorageChange = () => checkAuthStatus();
    window.addEventListener('storage', handleStorageChange);
    // Custom event: fires in the same tab when sessionManager saves/clears a session
    window.addEventListener('hss-auth-changed', handleStorageChange);

    return () => {
      if (unsub) unsub();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('hss-auth-changed', handleStorageChange);
    };
  }, []);

  // Global Logout Execution
  const executeGlobalLogout = async () => {
    setIsLoggingOut(true);
    try {
      sessionManager.clearSession();
      sessionStorage.removeItem('isAdminAuthenticated');
      sessionStorage.removeItem('adminEmail');
      sessionStorage.removeItem('adminToken');
      sessionStorage.clear();

      if (auth?.currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn('Logout note:', err);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
      setCurrentUser(null);
      setIsAdmin(false);
      setMobileOpen(false);
      navigate('/portal/login');
    }
  };

  const handleGlobalLogout = () => {
    setShowLogoutModal(true);
  };

  const getDashboardPath = (role) => {
    const r = String(role || '').toLowerCase();
    if (r.includes('admin')) {
      return '/portal/admin';
    }
    if (r.includes('teacher') || r.includes('faculty')) return '/portal/teacher';
    if (r.includes('student')) return '/portal/student';
    return '/portal/admin';
  };



  const loadDynamicPages = async () => {
    try {
      const snap = await getDoc(doc(db, 'site', 'pages'));
      if (snap.exists()) {
        const list = snap.data().list || [];
        const activeCustom = list
          .filter(p => p.isActive && !p.isSystem)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setDynamicLinks(activeCustom);
      }
    } catch (err) {
      console.warn("Failed to load dynamic pages for navbar:", err);
    }
  };

  useEffect(() => {
    loadDynamicPages();
    try {
      const channel = new BroadcastChannel('hss_data_sync');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'UPDATE_DATA') {
          loadDynamicPages();
        }
      };
      return () => channel.close();
    } catch (err) {
      // ignore
    }
  }, []);





  const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxklDr4jb25tAiDDrIoU2pjEBe9UXmJxkbXY-jp-BXLjkq9FppA1NlE2Or-gCpwjp8B1g/exec';

  const handleLoginClick = () => {
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

  const location = useLocation();
  const isAwayFromDashboard = currentUser && !location.pathname.startsWith('/portal/admin') && !location.pathname.startsWith('/portal/teacher') && !location.pathname.startsWith('/portal/student') && !location.pathname.startsWith('/admin');

  function isActive(path) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  // no modal Escape-key handler anymore

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const delta = 30; // require a small scroll to trigger hide/show
    let ticking = false;

    const controlNavbar = () => {
      if (typeof window === 'undefined') return;
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;

      if (diff > delta && currentScrollY > 100) {
        setIsVisible(false);
      } else if (diff < -delta) {
        setIsVisible(true);
      }

      lastScrollY = currentScrollY;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(controlNavbar);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const headerRef = useRef(null);

  // Measure header height and expose as CSS variable so pages can offset correctly
  useEffect(() => {
    function updateHeaderHeight() {
      const el = headerRef.current;
      if (!el) return;
      const menuEl = el.querySelector('[data-mobile-menu]');
      const menuHeight = menuEl ? menuEl.getBoundingClientRect().height : 0;
      const rawH = el.getBoundingClientRect().height - menuHeight;
      // Use Math.floor with -0.5px offset to ensure hero container snaps 100% flush to header bottom border without sub-pixel white gap
      const h = Math.max(0, Math.floor(rawH - 0.5));
      document.documentElement.style.setProperty('--site-header-height', `${h}px`);
    }
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, [mobileOpen, isVisible]);

  return (
    <>
      <header ref={headerRef} className={`w-full shadow-md z-40 fixed top-0 left-0 right-0 bg-white transition-all duration-200 ease-out ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        {/* WRAPPER: keep content in flow; header is transformed to hide/show to avoid layout jitter */}
        <div className="overflow-hidden">
          {/* ROW 1: Top Contact Bar (hidden on small screens) */}
          <div className="bg-slate-900 text-slate-300 text-[10px] lg:text-xs py-1.5 px-4 hidden md:flex justify-between items-center border-b border-slate-700 flex-wrap gap-y-1">
            <div className="flex items-center space-x-3 lg:space-x-4 flex-wrap">
              <span className="flex items-center"><Phone size={12} className="mr-1 text-teal-500" /> Principal:&nbsp;<a href="tel:+917006912918" className="hover:text-teal-400 transition-colors font-medium">+91-7006912918</a></span>
              <span className="flex items-center"><Phone size={12} className="mr-1 text-teal-500" /> VP:&nbsp;<a href="tel:+919682641216" className="hover:text-teal-400 transition-colors font-medium">+91-9682641216</a></span>
              <span className="flex items-center">
                <Phone size={12} className="mr-1 text-teal-500" /> Adms & Exams:&nbsp;
                <a href="tel:+917006034501" className="hover:text-teal-400 transition-colors font-medium">+91-7006034501</a>
                <a href="https://wa.me/917006034501" target="_blank" rel="noopener noreferrer" className="ml-1.5 text-emerald-500 hover:text-emerald-400 transition-transform hover:scale-110 inline-flex items-center" title="Chat on WhatsApp">
                  <WhatsAppIcon size={12} className="fill-current" />
                </a>
                &nbsp;/&nbsp;
                <a href="tel:+917006537425" className="hover:text-teal-400 transition-colors font-medium">+91-7006537425</a>
                <a href="https://wa.me/917006537425" target="_blank" rel="noopener noreferrer" className="ml-1.5 text-emerald-500 hover:text-emerald-400 transition-transform hover:scale-110 inline-flex items-center" title="Chat on WhatsApp">
                  <WhatsAppIcon size={12} className="fill-current" />
                </a>
              </span>
            </div>
            <div className="flex items-center space-x-3 lg:space-x-4 flex-wrap">
              <span className="flex items-center"><Mail size={12} className="mr-1 text-teal-500" /> <a href="mailto:ghssshangus74@gmail.com" onClick={(e) => handleEmailClick(e, 'ghssshangus74@gmail.com')} className="hover:text-teal-400 transition-colors font-medium">ghssshangus74@gmail.com (Principal)</a></span>
            </div>
          </div>

          {/* ROW 2: Logo and School Name */}
          <div className="max-w-7xl mx-auto px-4 py-1 md:py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img src={schoolLogo} alt="Govt HSS Shangus Logo" className="h-9 w-9 md:h-12 md:w-12 mr-3 object-contain" />
              <div>
                <h1 className="text-[14.4px] md:text-xl font-bold text-teal-800 tracking-tight leading-tight font-title">
                  <span className="hidden md:inline">Govt. Higher Secondary School Shangus</span>
                  <span className="inline md:hidden">Govt. Hr. Sec. School Shangus</span>
                </h1>
                <p className="text-[10.6px] md:text-[14.4px] text-slate-500 not-italic mt-0 font-slogan">nurturing minds, shaping futures</p>
              </div>
            </Link>

            {/* Desktop Actions: Avatar & Logout Badge in Upper White Header (ROW 2) when Logged In */}
            {currentUser && (
              <div className="hidden md:flex items-center gap-3">
                <div
                  className="flex items-center gap-2 p-1 rounded-2xl border shadow-sm transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    borderColor: 'var(--border-ui, #cbd5e1)',
                  }}
                >
                  <Link
                    to={getDashboardPath(currentUser.role)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-extrabold text-xs shadow-sm transition-all duration-200 text-white ${
                      isAwayFromDashboard ? 'ring-2 ring-amber-400/80 shadow-xs' : ''
                    }`}
                    style={{
                      backgroundColor: 'var(--teal-accent, #00674F)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--teal-accent-hover, #004d3b)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--teal-accent, #00674F)';
                    }}
                    title={`Dashboard (${currentUser.role}) — Click to return to active workspace`}
                  >
                    <div className="relative flex items-center justify-center">
                      <User size={14} className="stroke-[2.5]" />
                      {isAwayFromDashboard && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 border border-slate-900 shadow-2xs"></span>
                        </span>
                      )}
                    </div>
                    <span className="tracking-tight">{currentUser.name ? currentUser.name.split(' ')[0] : 'Dashboard'}</span>
                    <span className="text-[10px] font-bold opacity-90 bg-black/20 px-1.5 py-0.2 rounded-md">
                      ({currentUser.role === 'SuperAdmin' ? 'Admin' : currentUser.role})
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleGlobalLogout}
                    className="p-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 flex items-center justify-center"
                    style={{
                      borderColor: 'var(--border-ui, #cbd5e1)',
                      color: 'var(--text-muted, #64748b)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.borderColor = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted, #64748b)';
                      e.currentTarget.style.borderColor = 'var(--border-ui, #cbd5e1)';
                    }}
                    title="Sign Out of Session"
                  >
                    <LogOut size={15} className="stroke-[2.5]" />
                  </button>
                </div>
              </div>
            )}

            {/* Mobile top right actions: Hamburger Menu */}
            <div className="md:hidden flex items-center gap-2">
              <button
                aria-label="Toggle menu"
                onClick={() => setMobileOpen((s) => !s)}
                className="p-1.5 rounded-lg text-slate-800 bg-slate-100 border border-slate-200 shadow-sm relative"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                {currentUser && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600 border-2 border-white shadow-2xs"></span>
                  </span>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* ROW 3: Navigation Menu */}
        <div className="bg-slate-800 border-b-[3px] md:py-0.5" style={{ borderBottomColor: '#961c14' }}>
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center justify-center w-full relative">
              {/* Desktop menu */}
              <div className="hidden md:flex items-center gap-2">
                <Link to="/" className={`px-3 py-0.5 text-xs md:text-sm font-semibold transition-all ${isActive('/') ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-slate-300 hover:text-white border-t-2 border-transparent hover:border-orange-400'}`} onClick={() => window.scrollTo(0, 0)}>Home</Link>
                <Link to="/about" className={`px-3 py-0.5 text-xs md:text-sm font-semibold transition-all ${isActive('/about') ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-slate-300 hover:text-white border-t-2 border-transparent hover:border-orange-400'}`} onClick={() => window.scrollTo(0, 0)}>About Us</Link>
                <Link to="/academics" className={`px-3 py-0.5 text-xs md:text-sm font-semibold transition-all ${isActive('/academics') ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-slate-300 hover:text-white border-t-2 border-transparent hover:border-orange-400'}`} onClick={() => window.scrollTo(0, 0)}>Academics</Link>
                <Link to="/admissions" className={`px-3 py-0.5 text-xs md:text-sm font-semibold transition-all ${isActive('/admissions') ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-slate-300 hover:text-white border-t-2 border-transparent hover:border-orange-400'}`} onClick={() => window.scrollTo(0, 0)}>Admissions</Link>
                {dynamicLinks.map((link) => (
                  <Link
                    key={link.id}
                    to={`/${link.id}`}
                    className={`px-3 py-0.5 text-xs md:text-sm font-semibold transition-all ${isActive(`/${link.id}`) ? 'bg-slate-900 text-white border-t-4 border-orange-500 rounded-t-sm -mt-1' : 'text-slate-300 hover:text-white border-t-2 border-transparent hover:border-orange-400'}`}
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    {link.title}
                  </Link>
                ))}

                {/* Login Button right beside Admissions when NOT logged in */}
                {!currentUser && (
                  <Link
                    to="/portal/login"
                    className="ml-2.5 px-3.5 py-1 text-xs font-black rounded-md text-white transition-all duration-200 inline-flex items-center gap-1.5 shadow-md outline-none border-0 hover:scale-[1.03] active:scale-[0.97]"
                    style={{ backgroundColor: '#005943' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#004232'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#005943'; }}
                    title="Student & Staff Login Portal"
                  >
                    <Lock size={12} className="stroke-[2.5]" />
                    <span>Login</span>
                  </Link>
                )}
              </div>



              {/* Admin Lock Portal Button at Far Right Extreme (Desktop Only) */}
              <div className="hidden md:flex absolute -right-2 sm:right-0 lg:-right-4 items-center h-full py-0.5 z-20">
                <Link
                  to="/admin/portal"
                  onClick={() => window.scrollTo(0, 0)}
                  title={isAdmin ? "Admin Dashboard (Active Session)" : "Administrative Portal"}
                  className="p-1.5 rounded-md flex items-center justify-center transition-all duration-200 cursor-pointer opacity-25 hover:opacity-100 hover:scale-110 text-slate-400 hover:text-white"
                  aria-label="Admin Portal"
                >
                  {isAdmin ? (
                    <Unlock size={14} className="stroke-[2.5] text-emerald-400" />
                  ) : (
                    <Lock size={14} className="stroke-[2.5] text-slate-400" />
                  )}
                </Link>
              </div>
            </nav>
          </div>

          {/* Mobile slide-down menu */}
          {mobileOpen && (
              <div data-mobile-menu className="md:hidden bg-slate-800 text-white border-t border-slate-700">
              <div className="px-4 py-3">
                {/* Menu items */}
                <div className="space-y-1.5">
                  <Link to="/" onClick={() => setMobileOpen(false)} className="block font-semibold px-3 py-1.5 rounded" style={isActive('/') ? { backgroundColor: '#961c14', color: 'white' } : {}}>Home</Link>
                  <Link to="/about" onClick={() => setMobileOpen(false)} className="block font-semibold px-3 py-1.5 rounded" style={isActive('/about') ? { backgroundColor: '#961c14', color: 'white' } : {}}>About Us</Link>
                  <Link to="/academics" onClick={() => setMobileOpen(false)} className="block font-semibold px-3 py-1.5 rounded" style={isActive('/academics') ? { backgroundColor: '#961c14', color: 'white' } : {}}>Academics</Link>
                  <Link to="/admissions" onClick={() => setMobileOpen(false)} className="block font-semibold px-3 py-1.5 rounded" style={isActive('/admissions') ? { backgroundColor: '#961c14', color: 'white' } : {}}>Admissions</Link>
                  {dynamicLinks.map((link) => (
                     <Link
                       key={link.id}
                       to={`/${link.id}`}
                       onClick={() => setMobileOpen(false)}
                       className="block font-semibold px-3 py-1.5 rounded"
                       style={isActive(`/${link.id}`) ? { backgroundColor: '#961c14', color: 'white' } : {}}
                     >
                       {link.title}
                     </Link>
                   ))}
                </div>
              </div>

              {/* Row 2: Contact Details & Login Button */}
              <div className="px-4 pb-3 pt-2 border-t border-slate-700/60 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-400 text-[11px]">Contact:</span>
                    {/* Principal */}
                    <div className="flex items-center justify-between">
                      <a href="tel:+917006912918" className="flex items-center gap-2 text-[13px] hover:text-teal-400 transition-colors">
                        <Phone size={14} className="text-teal-400"/> +91-7006912918 <span className="text-[10px] text-slate-400">(Principal)</span>
                      </a>
                      <div className="flex items-center gap-1">
                        <a href="mailto:ghssshangus74@gmail.com" onClick={(e) => handleEmailClick(e, 'ghssshangus74@gmail.com')} className="text-slate-400 hover:text-teal-400 p-1 transition-colors" title="Email Principal">
                          <Mail size={14} />
                        </a>
                      </div>
                    </div>
                    {/* Vice Principal */}
                    <a href="tel:+919682641216" className="flex items-center gap-2 text-[13px] hover:text-teal-400 transition-colors">
                      <Phone size={14} className="text-teal-400"/> +91-9682641216 <span className="text-[10px] text-slate-400">(Vice Principal)</span>
                    </a>
                    {/* Adms & Exams 1 */}
                    <div className="flex items-center justify-between">
                      <a href="tel:+917006034501" className="flex items-center gap-2 text-[13px] hover:text-teal-400 transition-colors">
                        <Phone size={14} className="text-teal-400"/> +91-7006034501 <span className="text-[10px] text-slate-400">(Adms & Exams)</span>
                      </a>
                      <div className="flex items-center gap-1">
                        <a href="https://wa.me/917006034501" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400 p-1 transition-transform hover:scale-110 flex items-center" title="Chat on WhatsApp">
                          <WhatsAppIcon size={16} className="fill-current" />
                        </a>
                        <a href="mailto:adm.exam.hss.shangus@gmail.com" onClick={(e) => handleEmailClick(e, 'adm.exam.hss.shangus@gmail.com')} className="text-slate-400 hover:text-teal-400 p-1 transition-colors" title="Email Adms & Exams">
                          <Mail size={14} />
                        </a>
                      </div>
                    </div>
                    {/* Adms & Exams 2 */}
                    <div className="flex items-center justify-between">
                      <a href="tel:+917006537425" className="flex items-center gap-2 text-[13px] hover:text-teal-400 transition-colors">
                        <Phone size={14} className="text-teal-400"/> +91-7006537425 <span className="text-[10px] text-slate-400">(Adms & Exams)</span>
                      </a>
                      <div className="flex items-center gap-1">
                        <a href="https://wa.me/917006537425" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400 p-1 transition-transform hover:scale-110 flex items-center" title="Chat on WhatsApp">
                          <WhatsAppIcon size={16} className="fill-current" />
                        </a>
                        <a href="mailto:adm.exam.hss.shangus@gmail.com" onClick={(e) => handleEmailClick(e, 'adm.exam.hss.shangus@gmail.com')} className="text-slate-400 hover:text-teal-400 p-1 transition-colors" title="Email Adms & Exams">
                          <Mail size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-3">
                  {currentUser ? (
                    <div className="rounded-xl border p-2.5 flex items-center justify-between gap-3 shadow-md" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                      <Link
                        to={getDashboardPath(currentUser.role)}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 overflow-hidden group"
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 shadow-xs" style={{ backgroundColor: '#14b8a6', color: '#fff' }}>
                          {(currentUser.name || currentUser.email || 'U')[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-black text-white group-hover:text-teal-300 transition-colors truncate">
                          {currentUser.name ? currentUser.name.split(' ')[0] : (currentUser.email || '').split('@')[0]}
                          <span className="text-[8px] font-extrabold text-teal-400 ml-1">
                            ({currentUser.role === 'SuperAdmin' ? 'Admin' : (currentUser.role || 'User')})
                          </span>
                        </span>
                      </Link>
                      <button
                        onClick={handleGlobalLogout}
                        className="px-2.5 py-1 text-[10px] font-black rounded-lg transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                        style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #cbd5e1' }}
                        title="Sign Out"
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = '#dc2626';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.borderColor = '#dc2626';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                          e.currentTarget.style.color = '#000000';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                      >
                        <LogOut size={11} className="stroke-[2.5]" />
                        <span>Logout</span>
                      </button>
                    </div>
                  ) : (
                    <Link 
                      to="/portal/login" 
                      onClick={() => setMobileOpen(false)} 
                      className="w-full px-4 py-2.5 rounded-xl font-black text-sm transition-all duration-200 flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#0f766e', color: '#fff', border: '1px solid #0d9488' }}
                      title="Student & Staff Login Portal"
                    >
                      <Lock size={14} className="stroke-[2.5]" />
                      Login
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Sleek Custom Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={executeGlobalLogout}
        title="Sign Out of Session"
        message="Are you sure you want to log out of your active workspace session?"
        confirmText="Sign Out"
        cancelText="Cancel"
        type="logout"
        loading={isLoggingOut}
      />
    </>
  );
}
