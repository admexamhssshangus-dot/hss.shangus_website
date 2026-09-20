import React, { useState, useEffect, useRef } from 'react';
import { Users, Award, BookOpen, GraduationCap, Megaphone, ArrowRight, Pause, Play, ShieldCheck, Quote, Sparkles, ChevronRight, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
// 1. IMPORT YOUR LOCAL BACKGROUND IMAGE (Make sure the file is renamed to logo.png)
import Slideshow from '../components/Slideshow';
import SEO from '../components/SEO';
import { formatTitleWithBrackets } from '../utils/textFormatting';
import { DEFAULT_HERO_BUTTONS, getCachedSiteSettings } from '../utils/settingsLoader';

const Hero3DExperience = React.lazy(() => import('../components/3d/Hero3DExperience'));

// Modern Counter Animation Component
const AnimatedCounter = ({ end, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);
  const elementRef = useRef(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    let animationFrameId = null;

    const startAnimation = () => {
      let startTime = null;
      const duration = 2000; // 2 seconds animation duration

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Smooth ease-out animation formula
        const easeOut = 1 - Math.pow(1 - progress, 4);
        
        setCount(Math.floor(easeOut * end));

        if (progress < 1) {
          animationFrameId = window.requestAnimationFrame(animate);
        }
      };

      animationFrameId = window.requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Reset count and start animation when it enters viewport
          setCount(0);
          if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
          }
          startAnimation();
        } else {
          // Reset count when it goes out of view, so it animates again next time
          setCount(0);
          if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => {
      observer.unobserve(el);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [end]);

  return <span ref={elementRef}>{prefix}{count}{suffix}</span>;
};

const parseNoticeDate = (dateStr) => {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();

  // Robust parser: match any of "Jun 9", "June 9", "9 Jun", "9 June", "Nov 25" etc.
  const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };
  // Matches: "Jun 9", "June 9", "9 Jun", "9 June" (with optional year)
  const re = /^([a-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$|^(\d{1,2})\s+([a-z]+)(?:\s*,?\s*(\d{4}))?$/i;
  const m = cleaned.match(re);
  if (m) {
    const monthStr = (m[1] || m[5]).toLowerCase();
    const day = parseInt(m[2] || m[4], 10);
    const yearStr = m[3] || m[6];
    const monthIdx = MONTHS[monthStr];
    if (monthIdx !== undefined && !isNaN(day)) {
      const currentYear = new Date().getFullYear();
      const year = yearStr ? parseInt(yearStr, 10) : currentYear;
      const d = new Date(year, monthIdx, day);
      if (!yearStr) {
        const now = new Date();
        if (d > now && (d - now) > 30 * 24 * 60 * 60 * 1000) {
          d.setFullYear(currentYear - 1);
        }
      }
      return d;
    }
  }

  // Fallback: Try ISO / fully-qualified dates (e.g. "2026-06-09")
  let parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) return new Date(parsed);

  return null;
};

const formatDate = (dateStr) => {
  const date = parseNoticeDate(dateStr);
  if (!date) return dateStr;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('default', { month: 'short' });
  const year = String(date.getFullYear()).slice(-2);
  
  return `${day}-${month}-${year}`;
};

const isNoticeNew = (dateStr, customDays, defaultDays) => {
  const date = parseNoticeDate(dateStr);
  if (!date) return false;
  const days = customDays !== undefined && !isNaN(customDays) ? customDays : defaultDays;
  const diffTime = new Date() - date;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
};

const parseNotices = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const firstComma = line.indexOf(',');
      if (firstComma === -1) return null;
      const date = line.substring(0, firstComma).trim();
      const rest = line.substring(firstComma + 1);
      
      const secondComma = rest.indexOf(',');
      if (secondComma === -1) {
        return { date, title: rest.trim(), link: '#' };
      }
      const title = rest.substring(0, secondComma).trim();
      const rest2 = rest.substring(secondComma + 1).trim();

      const thirdComma = rest2.indexOf(',');
      if (thirdComma === -1) {
        return { date, title, link: rest2 };
      }
      const link = rest2.substring(0, thirdComma).trim();
      const days = rest2.substring(thirdComma + 1).trim();
      return { date, title, link, days: days ? parseInt(days, 10) : undefined };
    })
    .filter(Boolean);
};

export default function Home() {
  const [notices, setNotices] = useState(() => {
    try {
      const local = localStorage.getItem('site_notices');
      if (local) {
        const parsed = parseNotices(local);
        if (parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      { date: 'Sep 12', title: 'Pre-Board Test_Result', link: '/results' },
      { date: 'Sep 7', title: 'Pre-board Test_Date Sheet', link: 'https://drive.google.com/file/d/1veMmA8UXhv8BulukIXAzDuqeHyPSitZZ/view?usp=drive_link' },
      { date: 'Jul 30', title: 'General Knowledge Quiz', link: '/gk-test' }
    ];
  });
  const [settings, setSettings] = useState(getCachedSiteSettings);
  const [tickerPaused, setTickerPaused] = useState(false);
  const [tickerHidden, setTickerHidden] = useState(false);
  const [principalName, setPrincipalName] = useState("Mr. Aijaz Ahmad Wagay");
  const [hoveredHeroAction, setHoveredHeroAction] = useState(null);
  const [slides, setSlides] = useState(() => {
    try {
      const local = localStorage.getItem('site_slides');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [{ image: '/slides/6.jpg', title: 'Infrastructure', caption: 'Spacious campus with open grounds' }];
  });

  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  // Update isMobile on viewport resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hide Latest Updates ticker on desktop when user scrolls down and Latest Notices / Briefing becomes visible
  useEffect(() => {
    const handleScroll = () => {
      const briefingEl = document.getElementById('home-briefing');
      if (briefingEl) {
        const rect = briefingEl.getBoundingClientRect();
        // Hide ticker as soon as the Latest Notices card enters within 100px of the viewport
        setTickerHidden(rect.top < window.innerHeight - 80);
      } else {
        setTickerHidden(window.scrollY > 120);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Real-time synchronization for site content directly from Firebase Firestore
  useEffect(() => {
    let active = true;
    let unsubscribeNotices = null;
    let unsubscribeSlides = null;

    // 1. Site Settings (reads fresh Firestore settings in background)
    import('../utils/settingsLoader').then(({ loadSiteSettings }) => {
      if (active) loadSiteSettings({ forceFirestore: true }).then(setSettings);
    }).catch(() => {});

    // Helper: Static notices fallback
    const fetchStaticNoticesFallback = async () => {
      try {
        const res = await fetch('/slides/notices.txt?t=' + Date.now(), { cache: 'no-cache' });
        if (res.ok && active) {
          const text = await res.text();
          if (!text.trim().startsWith('<')) {
            const parsed = parseNotices(text);
            if (parsed.length > 0) {
              setNotices(parsed);
              try { localStorage.setItem('site_notices', text); } catch (_) {}
            }
          }
        }
      } catch (e) {
        console.warn('Static notices fallback failed:', e);
      }
    };

    // Helper: Static slides fallback
    const fetchStaticSlidesFallback = async () => {
      try {
        const res = await fetch('/slides/slides.txt?t=' + Date.now(), { cache: 'no-cache' });
        if (res.ok && active) {
          const text = await res.text();
          if (!text.trim().startsWith('<')) {
            const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            const mapped = lines.map((line, idx) => {
              const parts = line.split(',');
              if (parts[0] && parts[0].includes('.')) {
                const image = parts[0].trim();
                const title = (parts[1] || '').trim();
                const caption = (parts.slice(2).join(',') || '').trim();
                return { image: '/slides/' + image, title, caption, fit: 'cover', animation: 'kenburns' };
              }
              const title = (parts[0] || '').trim();
              const caption = (parts.slice(1).join(',') || '').trim();
              const image = `/slides/${idx + 1}.jpg`;
              return { image, title, caption, fit: 'cover', animation: 'kenburns' };
            });
            if (mapped.length > 0) {
              setSlides(mapped);
              try { localStorage.setItem('site_slides', JSON.stringify(mapped)); } catch (_) {}
            }
          }
        }
      } catch (e) {
        console.warn('Static slides fallback failed:', e);
      }
    };

    // 2. Real-time Firebase Firestore listeners for Notices and Slideshow
    (async () => {
      try {
        const { db } = await import('../firebase');
        const { doc, onSnapshot, getDoc } = await import('firebase/firestore');

        // Faculty summary
        getDoc(doc(db, 'site', 'facultySummary')).then((snapshot) => {
          const principal = snapshot.data()?.principalName;
          if (typeof principal === 'string' && principal.trim() && active) {
            setPrincipalName(principal.trim());
          }
        }).catch(() => {
          fetch('/slides/faculty.json?t=' + Date.now(), { cache: 'no-cache' })
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data) && active) {
                const principal = data.find(f => f.designation?.toLowerCase() === 'principal');
                if (principal?.name) setPrincipalName(principal.name);
              }
            }).catch(() => {});
        });

        // Real-time listener: Notices
        unsubscribeNotices = onSnapshot(doc(db, 'site', 'notices'), (snap) => {
          if (!active) return;
          if (snap.exists()) {
            const data = snap.data();
            if (data && data.text) {
              const parsed = parseNotices(data.text);
              if (parsed.length > 0) {
                setNotices(parsed);
                try { localStorage.setItem('site_notices', data.text); } catch (_) {}
                return;
              }
            }
          }
          fetchStaticNoticesFallback();
        }, (err) => {
          console.warn('Real-time notices listener notice (fallback engaged):', err);
          fetchStaticNoticesFallback();
        });

        // Real-time listener: Slideshow
        unsubscribeSlides = onSnapshot(doc(db, 'site', 'slideshow'), (snap) => {
          if (!active) return;
          if (snap.exists()) {
            const data = snap.data();
            if (data && Array.isArray(data.items) && data.items.length > 0) {
              const normalized = data.items.map((item) => ({
                ...item,
                fit: item.fit || 'cover'
              }));
              setSlides(normalized);
              try { localStorage.setItem('site_slides', JSON.stringify(normalized)); } catch (_) {}
              return;
            }
          }
          fetchStaticSlidesFallback();
        }, (err) => {
          console.warn('Real-time slideshow listener notice (fallback engaged):', err);
          fetchStaticSlidesFallback();
        });

      } catch (err) {
        console.warn('Failed to attach Firebase listeners, using static fallback:', err);
        fetchStaticNoticesFallback();
        fetchStaticSlidesFallback();
      }
    })();

    return () => {
      active = false;
      if (typeof unsubscribeNotices === 'function') unsubscribeNotices();
      if (typeof unsubscribeSlides === 'function') unsubscribeSlides();
    };
  }, []);

  // Listen to cross-tab data sync broadcasts
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('hss_data_sync');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'UPDATE_DATA') {
          import('../utils/settingsLoader').then(({ loadSiteSettings }) => {
            loadSiteSettings({ forceFirestore: true }).then(setSettings);
          });
          const local = localStorage.getItem('site_notices');
          if (local) {
            setNotices(parseNotices(local));
          }
          const localFaculty = localStorage.getItem('hss_public_faculty');
          if (localFaculty) {
            try {
              const parsed = JSON.parse(localFaculty);
              if (Array.isArray(parsed)) {
                const principal = parsed.find(f => f.designation?.toLowerCase() === 'principal');
                if (principal) {
                  setPrincipalName(principal.name);
                }
              }
            } catch (err) {
              console.warn('Sync public faculty projection error:', err);
            }
          }
          const localSlides = localStorage.getItem('site_slides');
          if (localSlides) {
            try {
              const parsed = JSON.parse(localSlides);
              if (Array.isArray(parsed)) {
                setSlides(parsed.map(item => ({ ...item, fit: item.fit || 'cover' })));
              }
            } catch (err) {
              console.warn('Sync site_slides error:', err);
            }
          }
        }
      };
      return () => channel.close();
    } catch (err) {
      // ignore
    }
  }, []);

  return (
    <div className="public-page w-full">
      <SEO title="Home" description="Official website of Govt. Higher Secondary School Shangus. Explore latest notices, school admissions process, ERP portals, and details from Principal." image="/slides/searchtn.jpg" />
      {/* Hidden img tag to prompt search engine snippet crawlers to prioritize the school building image */}
      <img src="/slides/searchtn.jpg" alt="Govt. Higher Secondary School Shangus Campus" className="sr-only" aria-hidden="true" loading="lazy" decoding="async" />
      <div className="hero-container relative w-full bg-slate-900 flex items-center justify-center text-center overflow-hidden isolate">
        
        {/* Background slideshow: using dynamic config with public fallback */}
        <Slideshow slides={slides} configUrl={slides.length === 0 ? "/slides/slides.txt" : null} imageFolder="/slides/" interval={6000} />
        
        {/* Dynamic 3D Hero Experience (Lazy-loaded, strictly rendered only when enabled in CMS; hidden on mobile by default) */}
        {Boolean(settings?.enable3dHeroAssets) && (!isMobile || Boolean(settings?.enable3dHeroAssetsMobile)) && (
          <React.Suspense fallback={null}>
            <Hero3DExperience hoveredAction={hoveredHeroAction} />
          </React.Suspense>
        )}
        
        <div className="relative z-20 px-3 sm:px-4">
          <h1
            className="text-[15px] xs:text-[17.5px] sm:text-[35px] md:text-[52px] font-semibold mb-1 sm:mb-6 italic tracking-wider leading-none sm:leading-snug font-slogan"
            style={{
              color: '#961c14',
              textShadow: '0 0 8px rgba(255, 255, 255, 0.95), 0 0 16px rgba(255, 255, 255, 0.85), 0 0 25px rgba(255, 255, 255, 0.6), 0 2px 4px rgba(0, 0, 0, 0.5)'
            }}
          >
            nurturing minds, shaping futures
          </h1>
          <div className="flex flex-row justify-center items-center gap-1 sm:gap-2 flex-wrap">
            {(Array.isArray(settings?.heroButtons)
              ? settings.heroButtons
              : DEFAULT_HERO_BUTTONS
            )
              .filter((btn) => btn && btn.enabled !== false)
              .map((btn, idx) => {
                const isAdmissionsClosed = Boolean(btn.trackAdmissionStatus && settings?.globalAdmissionsClosed);
                const displayText = isAdmissionsClosed
                  ? (btn.closedLabel || 'Admissions Closed')
                  : (btn.label || 'Learn More');
                const isExternal = Boolean(
                  btn.link && (
                    btn.link.startsWith('http://') ||
                    btn.link.startsWith('https://') ||
                    btn.link.startsWith('mailto:') ||
                    btn.link.startsWith('tel:') ||
                    btn.openInNewTab
                  )
                );
                const isAdmissionsBtn = Boolean(
                  btn.trackAdmissionStatus ||
                  idx === 0 ||
                  (btn.label && btn.label.toLowerCase().includes('admission'))
                );

                const styleClassMap = {
                  primary: 'btn-hero-primary',
                  secondary: 'btn-hero-secondary',
                  amber: 'btn-hero-amber',
                  blue: 'btn-hero-blue',
                  purple: 'btn-hero-purple',
                  emerald: 'btn-hero-emerald',
                  outline: 'btn-hero-outline'
                };
                const styleClasses = styleClassMap[btn.style] || (idx === 0 ? 'btn-hero-primary' : 'btn-hero-secondary');
                const baseClasses = `px-2 py-0.5 sm:px-4 sm:py-2 font-bold rounded-md sm:rounded-lg transition-all shadow-xs sm:shadow-lg inline-flex items-center text-[9.5px] xs:text-[10.5px] sm:text-sm leading-tight ${styleClasses}`;

                if (isExternal) {
                  return (
                    <a
                      key={btn.id || `hero-btn-${idx}`}
                      href={btn.link || '#'}
                      target={btn.openInNewTab ? '_blank' : undefined}
                      rel={btn.openInNewTab ? 'noopener noreferrer' : undefined}
                      className={baseClasses}
                      onMouseEnter={isAdmissionsBtn ? () => setHoveredHeroAction('admissions') : undefined}
                      onMouseLeave={isAdmissionsBtn ? () => setHoveredHeroAction(null) : undefined}
                    >
                      {displayText}
                    </a>
                  );
                }

                return (
                  <Link
                    key={btn.id || `hero-btn-${idx}`}
                    to={btn.link || '/'}
                    className={baseClasses}
                    onMouseEnter={isAdmissionsBtn ? () => setHoveredHeroAction('admissions') : undefined}
                    onMouseLeave={isAdmissionsBtn ? () => setHoveredHeroAction(null) : undefined}
                  >
                    {displayText}
                  </Link>
                );
              })}
          </div>
        </div>

        {notices.length > 0 && (
          <aside className={`hero-news-ticker ${tickerPaused ? 'is-paused' : ''} ${tickerHidden ? 'is-scrolled-hidden' : ''}`} aria-label="Latest school updates">
            <div className="hero-news-ticker__label">
              <Megaphone size={17} aria-hidden="true" />
              <span>Latest Updates</span>
            </div>
            <div className="hero-news-ticker__viewport">
              <div className="hero-news-ticker__track">
                {[0, 1].map((copy) => (
                  <div key={copy} className="hero-news-ticker__set" aria-hidden={copy === 1 ? 'true' : undefined}>
                    {notices.slice(0, 6).map((notice, idx) => {
                      const external = notice.link && (notice.link.startsWith('http') || notice.link.startsWith('mailto:'));
                      const content = (
                        <>
                          <span className="hero-news-ticker__pulse" aria-hidden="true" />
                          <span>{formatTitleWithBrackets(notice.title)}</span>
                        </>
                      );
                      return notice.link && notice.link !== '#' ? (
                        external ? (
                          <a key={`${copy}-${idx}`} href={notice.link} target="_blank" rel="noopener noreferrer" className="hero-news-ticker__item" tabIndex={copy === 1 ? -1 : 0}>{content}</a>
                        ) : (
                          <Link key={`${copy}-${idx}`} to={notice.link} className="hero-news-ticker__item" tabIndex={copy === 1 ? -1 : 0}>{content}</Link>
                        )
                      ) : (
                        <span key={`${copy}-${idx}`} className="hero-news-ticker__item">{content}</span>
                      );
                    })}
                    <span className="hero-news-ticker__loop-break" aria-hidden="true">
                      <span>End</span>
                      <span className="hero-news-ticker__loop-line" />
                      <span>Beginning again</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hero-news-ticker__actions">
              <button
                type="button"
                className="hero-news-ticker__pause"
                onClick={() => setTickerPaused((paused) => !paused)}
                aria-pressed={tickerPaused}
                aria-label={tickerPaused ? 'Resume latest updates' : 'Pause latest updates'}
                title={tickerPaused ? 'Resume updates' : 'Pause updates'}
              >
                {tickerPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
              </button>
              <Link to="/notices" className="hero-news-ticker__all" title="View all notices and updates">
                <span className="hero-news-ticker__all-text">
                  <span>View</span>
                  <span>all</span>
                </span>
                <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
              </Link>
            </div>
          </aside>
        )}
      </div>

      {/* Main Content Area: Notices, Principal & Key Stats */}
      <section id="home-briefing" className="home-briefing max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-7 lg:gap-8 items-stretch" aria-label="School updates and Principal's message">
        
        {/* Notices Sidebar */}
        <div className="col-span-1 lg:col-span-4 xl:col-span-4 flex flex-col">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md hover:shadow-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col h-full transition-all duration-300">
            {/* Header: Rich Emerald-Teal Gradient with Live Pulsing Beacon */}
            <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-950 text-white px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between border-b border-teal-700/50 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <h2 className="font-extrabold text-sm sm:text-base font-heading tracking-tight flex items-center gap-1.5 m-0 truncate">
                  <Megaphone size={16} className="text-teal-300 shrink-0" />
                  <span>Latest Notices</span>
                </h2>
              </div>
              <span className="text-[9.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/15 dark:bg-white/10 border border-white/20 text-teal-100 shadow-2xs shrink-0">
                {notices.length} Updates
              </span>
            </div>

            {/* List - Interactive Cards with Micro-Calendar Date Badges */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-2.5 space-y-1.5 max-h-[400px] sm:max-h-[430px] lg:max-h-[460px]">
              <ul className="space-y-1.5 m-0 p-0 list-none">
                {notices.map((n, idx) => {
                  const isNew = isNoticeNew(n.date, n.days, settings?.defaultNewNoticeDays !== undefined ? settings.defaultNewNoticeDays : 7);
                  const formatted = formatDate(n.date);
                  const parts = (formatted || '').split('-');
                  const day = parts[0] || n.date;
                  const month = (parts[1] || '').toUpperCase();

                  const noticeContent = (
                    <>
                      {/* Mini-Calendar Date Badge */}
                      <div className="w-10 h-10 sm:w-10.5 sm:h-10.5 rounded-xl bg-white dark:bg-slate-950 border border-teal-200 dark:border-teal-800/70 shadow-2xs flex flex-col overflow-hidden shrink-0 group-hover/item:border-teal-500 group-hover/item:scale-105 transition-all duration-200">
                        <div className="bg-teal-700 dark:bg-teal-600 text-white font-black text-[7.5px] uppercase tracking-wider text-center py-0.5 select-none leading-none w-full">
                          {month || 'DATE'}
                        </div>
                        <div className="flex-1 flex items-center justify-center font-black text-xs sm:text-[13px] text-slate-800 dark:text-slate-100 font-mono leading-none">
                          {day}
                        </div>
                      </div>

                      {/* Notice Title & Badges */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-[12.5px] font-bold text-slate-800 dark:text-slate-200 group-hover/item:text-teal-700 dark:group-hover/item:text-teal-300 transition-colors leading-snug line-clamp-2">
                          <span>{formatTitleWithBrackets(n.title)}</span>
                          {isNew && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 shadow-2xs animate-pulse ml-1.5 align-middle">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                              NEW
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Hover Arrow Hint */}
                      <ChevronRight size={14} className="text-slate-400 group-hover/item:text-teal-600 dark:group-hover/item:text-teal-400 opacity-0 group-hover/item:opacity-100 -translate-x-1 group-hover/item:translate-x-0 transition-all duration-200 shrink-0 ml-auto hidden sm:block" />
                    </>
                  );

                  return (
                    <li key={idx} className="list-none">
                      {n.link && n.link !== '#' ? (
                        n.link.startsWith('http') || n.link.startsWith('mailto:') ? (
                          <a
                            href={n.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-teal-50/70 dark:hover:bg-teal-950/40 hover:border-teal-200 dark:hover:border-teal-800/80 hover:shadow-xs transition-all duration-200 flex items-center gap-2.5 sm:gap-3 group/item cursor-pointer"
                            title={n.title}
                          >
                            {noticeContent}
                          </a>
                        ) : (
                          <Link
                            to={n.link}
                            className="p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-teal-50/70 dark:hover:bg-teal-950/40 hover:border-teal-200 dark:hover:border-teal-800/80 hover:shadow-xs transition-all duration-200 flex items-center gap-2.5 sm:gap-3 group/item cursor-pointer"
                            title={n.title}
                          >
                            {noticeContent}
                          </Link>
                        )
                      ) : (
                        <div
                          className="p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-teal-50/70 dark:hover:bg-teal-950/40 hover:border-teal-200 dark:hover:border-teal-800/80 hover:shadow-xs transition-all duration-200 flex items-center gap-2.5 sm:gap-3 group/item"
                          title={n.title}
                        >
                          {noticeContent}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Footer: Full-Width Executive Action Button */}
            <div className="bg-slate-50/90 dark:bg-slate-900/90 p-2.5 sm:p-3 text-center border-t border-slate-100 dark:border-slate-800 mt-auto">
              <Link
                to="/notices"
                className="w-full py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100/90 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800/80 text-teal-800 dark:text-teal-300 hover:text-teal-950 dark:hover:text-teal-200 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs group/btn cursor-pointer"
              >
                <span>Browse Notice Archive</span>
                <ArrowRight size={14} className="transition-transform duration-200 group-hover/btn:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>

        {/* Principal Message & Stats Column */}
        <div className="col-span-1 lg:col-span-8 xl:col-span-8 flex flex-col justify-between gap-5 sm:gap-6">
          {/* Principal Card Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-teal-600 to-emerald-600" />
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
                  Principal's Message
                </h2>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 px-3 py-1 rounded-full shadow-2xs">
                <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400" />
                Leadership &amp; Vision
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md hover:shadow-xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-6 transition-all duration-300 hover:border-teal-500/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-teal-500/10 via-emerald-500/5 to-transparent rounded-bl-full pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5 sm:gap-6 relative z-10">
                {/* Principal Portrait Frame */}
                <div className="w-24 h-24 xs:w-28 xs:h-28 sm:w-36 sm:h-40 flex-shrink-0 rounded-2xl overflow-hidden shadow-md border-2 border-teal-600/50 group-hover:border-teal-600 transition-colors relative">
                  <img src="/slides/Principal.jpg" alt={`Principal ${principalName}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent pt-3 pb-1.5 px-2 text-center">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-teal-200">Principal</span>
                  </div>
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="relative">
                    <Quote size={24} className="text-teal-600/30 dark:text-teal-400/30 mb-1 rotate-180" />
                    <p className="text-slate-700 dark:text-slate-200 italic text-xs xs:text-[13.5px] sm:text-[14.5px] leading-relaxed font-normal">
                      Welcome to <strong className="text-slate-900 dark:text-white font-bold not-italic">Govt HSS Shangus</strong>. Our mandate is to <strong className="text-teal-800 dark:text-teal-300 font-semibold not-italic">empower leaders</strong> defined by academic excellence and ethics. We offer a learning environment where cutting-edge resources in Science and Humanities meet value-based education — equipping you with the skills to thrive and the character to lead in a global society.
                    </p>
                  </div>

                  {/* Principal Sign-off */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{principalName}</h4>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">Principal, Govt. Higher Secondary School Shangus</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2 sm:px-2.5 py-0.5 rounded-lg border border-teal-200 dark:border-teal-800/60">
                      <Sparkles size={11} className="text-teal-600 dark:text-teal-400" />
                      Official Note
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row - Responsive across Mobile, Tablet, and Desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[
              { icon: Users, end: 700, suffix: "+", label: "STUDENTS", subtext: "Enrolled Scholars", colorClass: 'text-teal-700 bg-teal-50 border-teal-200 hover:shadow-teal-100/50', accentBar: 'from-teal-500 to-emerald-500', glow: 'group-hover:border-teal-500/40' },
              { icon: Award, end: 25, suffix: "+", label: "TEACHERS", subtext: "Faculty Mentors", colorClass: 'text-amber-700 bg-amber-50 border-amber-200 hover:shadow-amber-100/50', accentBar: 'from-amber-500 to-orange-500', glow: 'group-hover:border-amber-500/40' },
              { icon: BookOpen, end: 22, suffix: "+", label: "SUBJECTS", subtext: "Academic Streams", colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:shadow-indigo-100/50', accentBar: 'from-indigo-500 to-blue-500', glow: 'group-hover:border-indigo-500/40' },
              { icon: GraduationCap, end: 90, suffix: "%+", label: "RESULT", subtext: "Board Pass Rate", colorClass: 'text-rose-700 bg-rose-50 border-rose-200 hover:shadow-rose-100/50', accentBar: 'from-rose-500 to-pink-500', glow: 'group-hover:border-rose-500/40' }
            ].map((stat, i) => {
              const IconComponent = stat.icon;
              return (
                <div key={i} className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200/90 dark:border-slate-800 transition-all duration-300 hover:-translate-y-1 group ${stat.glow}`}>
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.accentBar}`} />
                  {/* Adaptive layout: Executive spacious layout on mobile taking more vertical space, Centered vertical on sm/lg */}
                  <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center py-6 px-4 xs:px-5 sm:p-5 text-left sm:text-center gap-3 sm:gap-0 min-h-[92px] sm:min-h-0">
                    <div className="flex items-center gap-3.5 sm:flex-col sm:gap-0">
                      <div className={`w-13 h-13 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center border sm:mb-2.5 transition-transform duration-300 group-hover:scale-110 ${stat.colorClass} shadow-xs flex-shrink-0`}>
                        <IconComponent size={26} className="stroke-[2.5]" />
                      </div>
                      <div className="sm:text-center">
                        <p className="text-xs xs:text-[13px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider sm:tracking-widest sm:mt-1">{stat.label}</p>
                        <span className="sm:hidden text-[11.5px] xs:text-xs text-slate-500 dark:text-slate-400 font-medium block mt-0.5">{stat.subtext}</span>
                      </div>
                    </div>
                    <div className="text-right sm:text-center">
                      <h4 className="text-2xl xs:text-3xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none font-slogan">
                        <AnimatedCounter end={stat.end} prefix={stat.prefix} suffix={stat.suffix} />
                      </h4>
                      <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">{stat.subtext}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </section>
    </div>
  );
}

