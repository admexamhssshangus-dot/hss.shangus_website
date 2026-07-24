import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Phone, Mail, X, Menu, Lock, Unlock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

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
  // State for smart scrolling
  const [isVisible, setIsVisible] = useState(true);
  // Mobile menu open
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dynamicLinks, setDynamicLinks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = () => {
      const isAuth = sessionStorage.getItem('isAdminAuthenticated') === 'true' || !!auth?.currentUser;
      setIsAdmin(isAuth);
    };
    checkAdmin();
    const unsub = auth?.onAuthStateChanged(() => checkAdmin());
    return () => { if (unsub) unsub(); };
  }, []);

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





  const location = useLocation();
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
      const h = Math.ceil(el.getBoundingClientRect().height - menuHeight);
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

            {/* Mobile top right actions: Hamburger Menu */}
            <div className="md:hidden flex items-center gap-2">
              <button
                aria-label="Toggle menu"
                onClick={() => setMobileOpen((s) => !s)}
                className="p-1.5 rounded-lg text-slate-800 bg-slate-100 border border-slate-200 shadow-sm"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
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
              </div>

              {/* Login Link Area (Desktop) - Standard <a> tag for Googlebot Sitelink extraction */}
              <div className="hidden md:flex ml-2 md:ml-4 pl-2 md:pl-4 md:border-l border-slate-600 flex items-center h-full py-0.5">
                <Link
                  to="/login"
                  className="px-3 py-1 text-xs font-bold btn-primary-custom rounded-md transition-all duration-200 inline-flex items-center justify-center"
                  title="Student & Staff Login Portal"
                >
                  Login
                </Link>
              </div>

              {/* Admin Lock Portal Button at Far Right Extreme (Desktop Only) */}
              <div className="hidden md:flex absolute right-0 items-center h-full py-0.5">
                <Link
                  to="/admin/portal"
                  onClick={() => window.scrollTo(0, 0)}
                  title={isAdmin ? "Admin Dashboard (Active Session)" : "Administrative Portal"}
                  className="p-1.5 rounded-md flex items-center justify-center transition-all duration-200 shadow-sm hover:scale-105 cursor-pointer text-slate-300 hover:text-teal-400 bg-slate-900/60 border border-slate-700 hover:border-teal-400"
                  aria-label="Admin Portal"
                >
                  {isAdmin ? (
                    <Unlock size={16} className="stroke-[2.5] text-emerald-400 animate-pulse" />
                  ) : (
                    <Lock size={16} className="stroke-[2.5] text-teal-400" />
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
                  <Link 
                    to="/login" 
                    onClick={() => setMobileOpen(false)} 
                    className="w-full px-3 py-1 btn-primary-custom rounded font-bold text-sm transition-all duration-200 block text-center"
                    title="Student & Staff Login Portal"
                  >
                    Login
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      
    </>
  );
}
