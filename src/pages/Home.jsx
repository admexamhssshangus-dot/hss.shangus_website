import React, { useState, useEffect, useRef } from 'react';
import { Users, Award, BookOpen, GraduationCap, Megaphone, ArrowRight, Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

// 1. IMPORT YOUR LOCAL BACKGROUND IMAGE (Make sure the file is renamed to logo.png)
import Slideshow from '../components/Slideshow';
import SEO from '../components/SEO';
import { formatTitleWithBrackets } from '../utils/textFormatting';

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
      { date: 'Nov 23', title: 'JKBOSE Datesheet', link: '#' },
      { date: 'Nov 23', title: 'PreBoard Results', link: '#' },
      { date: 'Nov 23', title: 'Admit Cards', link: '#' }
    ];
  });
  const [settings, setSettings] = useState(null);
  const [tickerPaused, setTickerPaused] = useState(false);
  const [tickerHidden, setTickerHidden] = useState(false);
  const [principalName, setPrincipalName] = useState("Mr. Aijaz Ahmad Wagay");
  const [slides, setSlides] = useState(() => {
    try {
      const local = localStorage.getItem('site_slides');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [{ image: '/slides/1.jpg', title: 'Govt. HSS Shangus', caption: 'Nurturing Minds, Shaping Futures' }];
  });

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

  // Coordinate background synchronization tasks during idle time to guarantee 0ms main-thread contention
  useEffect(() => {
    let active = true;
    let timerId = null;
    let idleId = null;

    const runBackgroundSync = () => {
      if (!active) return;

      // 1. Site Settings
      import('../utils/settingsLoader').then(({ loadSiteSettings }) => {
        if (active) loadSiteSettings().then(setSettings);
      }).catch(() => {});

      // 2. Slideshow updates
      (async () => {
        try {
          const snap = await getDoc(doc(db, 'site', 'slideshow'));
          if (snap.exists() && active) {
            const data = snap.data();
            if (data && Array.isArray(data.items) && data.items.length > 0) {
              setSlides(data.items);
              localStorage.setItem('site_slides', JSON.stringify(data.items));
              return;
            }
          }
        } catch (err) {
          console.warn('Failed to load slides from Firestore:', err);
        }

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
                  return { image: '/slides/' + image, title, caption };
                }
                const title = (parts[0] || '').trim();
                const caption = (parts.slice(1).join(',') || '').trim();
                const image = `/slides/${idx + 1}.jpg`;
                return { image, title, caption };
              });
              setSlides(mapped);
              localStorage.setItem('site_slides', JSON.stringify(mapped));
            }
          }
        } catch (err) {
          console.warn('Failed to fetch slides.txt fallback:', err);
        }
      })();

      // 3. Faculty summary
      (async () => {
        try {
          const snapshot = await getDoc(doc(db, 'site', 'facultySummary'));
          const principal = snapshot.data()?.principalName;
          if (typeof principal === 'string' && principal.trim() && active) {
            setPrincipalName(principal.trim());
            return;
          }
        } catch (err) {
          console.warn('Failed to load faculty from Firestore:', err);
        }

        try {
          const res = await fetch('/slides/faculty.json?t=' + Date.now(), { cache: 'no-cache' });
          if (res.ok && active) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const principal = data.find(f => f.designation?.toLowerCase() === 'principal');
              if (principal) setPrincipalName(principal.name);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch faculty.json:', err);
        }
      })();

      // 4. Latest notices
      (async () => {
        try {
          const snap = await getDoc(doc(db, 'site', 'notices'));
          if (snap.exists() && active) {
            const data = snap.data();
            if (data && data.text) {
              const parsed = parseNotices(data.text);
              if (parsed.length > 0) {
                setNotices(parsed);
                localStorage.setItem('site_notices', data.text);
                return;
              }
            }
          }
        } catch (err) {
          console.warn('Firestore notices fetch failed, checking fallbacks:', err);
        }

        try {
          const res = await fetch('/slides/notices.txt?t=' + Date.now(), { cache: 'no-cache' });
          if (res.ok && active) {
            const text = await res.text();
            if (!text.trim().startsWith('<')) {
              const parsed = parseNotices(text);
              if (parsed.length > 0) {
                setNotices(parsed);
                localStorage.setItem('site_notices', text);
                return;
              }
            }
          }
        } catch (err) {
          console.warn('Server notices.txt fetch failed:', err);
        }

        const local = localStorage.getItem('site_notices');
        if (local && active) {
          const parsed = parseNotices(local);
          if (parsed.length > 0) {
            setNotices(parsed);
          }
        }
      })();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(runBackgroundSync, { timeout: 2000 });
    } else if (typeof window !== 'undefined') {
      timerId = setTimeout(runBackgroundSync, 150);
    }

    return () => {
      active = false;
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  // Listen to cross-tab data sync broadcasts
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('hss_data_sync');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'UPDATE_DATA') {
          import('../utils/settingsLoader').then(({ loadSiteSettings }) => {
            loadSiteSettings().then(setSettings);
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
                setSlides(parsed);
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
      <img src="/slides/searchtn.jpg" alt="Govt. Higher Secondary School Shangus Campus" className="sr-only" aria-hidden="true" />
      <div className="hero-container relative w-full bg-slate-900 flex items-center justify-center text-center overflow-hidden">
        
        {/* Background slideshow: using dynamic config with public fallback */}
        <Slideshow slides={slides} configUrl={slides.length === 0 ? "/slides/slides.txt" : null} imageFolder="/slides/" interval={6000} />
        
        <div className="relative z-20 px-4">
          <h1
            className="text-[19px] sm:text-[33px] md:text-[50px] font-semibold mb-3.5 sm:mb-6 italic tracking-wider leading-none sm:leading-snug font-slogan"
            style={{
              color: '#961c14',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.95), 0 0 20px rgba(255, 255, 255, 0.85), 0 0 35px rgba(255, 255, 255, 0.6), 0 2px 4px rgba(0, 0, 0, 0.5)'
            }}
          >
            nurturing minds, shaping futures
          </h1>
          <div className="flex flex-row justify-center items-center gap-1.5 sm:gap-2">
            <Link to="/admissions" className="px-2.5 py-1 sm:px-5 sm:py-2 font-bold rounded-md sm:rounded-lg transition-all shadow-md sm:shadow-lg inline-flex items-center text-[10.5px] sm:text-sm btn-hero-primary leading-tight">
              {settings?.globalAdmissionsClosed ? 'Admissions Closed' : 'Admissions Open 2026'}
            </Link>
            <Link to="/about" className="px-2.5 py-1 sm:px-3.5 sm:py-2 font-bold rounded-md transition-all shadow-md inline-flex items-center text-[10.5px] sm:text-xs btn-hero-secondary leading-tight">
              Learn More
            </Link>
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
              <Link to="/notices" className="hero-news-ticker__all">
                View all <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        )}
      </div>

      {/* Main Content Area: Notices & Principal */}
      <section id="home-briefing" className="home-briefing max-w-7xl mx-auto px-4 py-8 md:py-7 grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="School updates and Principal's message">
        
        {/* Notices Sidebar */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <div className="bg-teal-800 text-white px-4 py-3">
              <h2 className="font-bold text-lg font-heading tracking-wide">Latest Notices</h2>
            </div>
            <div className="max-h-[240px] overflow-y-auto custom-scrollbar px-4">
              <ul className="">
                {notices.map((n, idx) => {
                  const isNew = isNoticeNew(n.date, n.days, settings?.defaultNewNoticeDays !== undefined ? settings.defaultNewNoticeDays : 7);
                  return (
                    <li key={idx} className="py-2.5 flex items-center gap-3 transition-all duration-200 hover:bg-slate-50/70 -mx-4 px-4 border-l-2 border-l-transparent hover:border-l-teal-800 border-b border-slate-100 last:border-b-0 group">
                      {/* Mini Date Badge */}
                      {(() => {
                        const formatted = formatDate(n.date);
                        const parts = formatted.split('-');
                        const day = parts[0] || n.date;
                        const month = (parts[1] || '').toUpperCase();
                        return (
                          <div className="w-10 h-8 rounded-lg border border-slate-200 bg-slate-50 flex flex-col overflow-hidden flex-shrink-0 shadow-xs transition-all group-hover:border-teal-500/40">
                            <div className="bg-teal-700 text-[6.5px] font-black text-white py-0.5 uppercase tracking-wider text-center select-none leading-none">
                              {month || 'DATE'}
                            </div>
                            <div className="flex-grow flex items-center justify-center bg-white font-title text-[11px] font-black text-slate-800 leading-none">
                              {day}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2"
                             style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.link && n.link !== '#' ? (
                            n.link.startsWith('http') || n.link.startsWith('mailto:') ? (
                              <a href={n.link} target="_blank" rel="noopener noreferrer" 
                                 className="hover:text-teal-700 hover:underline"
                                 title={n.title}>
                                {formatTitleWithBrackets(n.title)}
                              </a>
                            ) : (
                              <Link to={n.link} 
                                    className="hover:text-teal-700 hover:underline"
                                    title={n.title}>
                                {formatTitleWithBrackets(n.title)}
                              </Link>
                            )
                          ) : (
                            <span className="text-slate-700" title={n.title}>
                              {formatTitleWithBrackets(n.title)}
                            </span>
                          )}

                          {isNew && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-extrabold badge-red-custom animate-pulse uppercase tracking-wider align-middle ml-1.5">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
              <Link to="/notices" className="ui-touch-target inline-flex items-center text-xs sm:text-sm font-bold text-teal-800 hover:text-teal-950 hover:underline tracking-wide uppercase">
                View All Archives
              </Link>
            </div>
          </div>
        </div>

        {/* Principal Message & Stats */}
        <div className="col-span-1 md:col-span-2">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 md:border-l-4 md:border-teal-800 md:pl-4 mb-3 font-heading">Principal's Message</h2>
            <div className="flex flex-col sm:flex-row bg-white p-4 rounded-2xl shadow-lg border border-slate-200/80 items-center hover:border-teal-500/30 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="w-28 h-28 flex-shrink-0 rounded-2xl overflow-hidden mx-auto mb-4 sm:mb-0 shadow-md border-2 border-teal-600/80 hover:scale-105 transition-transform duration-300">
                <img src="/slides/Principal.jpg" alt={`Principal ${principalName}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="flex-1 lg:border-l lg:border-slate-100 lg:pl-6 pl-0 relative min-w-0 w-full">
                {/* Stylized background quote icon */}
                <div className="absolute top-0 left-2 text-slate-100 select-none text-8xl font-serif leading-none pointer-events-none opacity-40">“</div>
                <div className="relative z-10 bg-slate-50/50 p-3 rounded-xl border border-slate-100/80">
                  <p className="text-slate-700 italic text-[13.5px] sm:text-sm leading-relaxed pl-2">
                    Welcome to <strong className="text-slate-800 font-bold">Govt HSS Shangus</strong>. Our mandate is to <strong>empower leaders</strong> defined by <strong>academic excellence and ethics</strong>. We offer a learning environment where <strong>cutting-edge resources</strong> in <strong>Science and Humanities</strong> meet <strong>value-based education</strong> — equipping you with the skills to thrive and the character to lead in a global society.
                  </p>
                  <p className="text-right text-xs text-teal-800 font-bold mt-2 pr-1">{principalName}<br/><span className="text-slate-400 font-normal">Principal, HSS Shangus</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row - NOW FEATURING ANIMATED COUNTERS & MODERN ICON CARDS! */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, end: 700, suffix: "+", label: "STUDENTS", colorClass: 'text-teal-600 bg-teal-50 border-teal-100 hover:shadow-teal-100/50' },
              { icon: Award, end: 25, suffix: "+", label: "TEACHERS", colorClass: 'text-amber-600 bg-amber-50 border-amber-100 hover:shadow-amber-100/50' },
              { icon: BookOpen, end: 22, suffix: "+", label: "SUBJECTS", colorClass: 'text-violet-600 bg-violet-50 border-violet-100 hover:shadow-violet-100/50' },
              { icon: GraduationCap, end: 90, suffix: "%+", label: "RESULT", colorClass: 'text-rose-600 bg-rose-50 border-rose-100 hover:shadow-rose-100/50' }
            ].map((stat, i) => {
              const IconComponent = stat.icon;
              return (
                <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 group">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border mb-3 transition-transform duration-300 group-hover:scale-110 ${stat.colorClass} shadow-sm`}>
                    <IconComponent size={20} className="stroke-[2.5]" />
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight leading-none font-slogan">
                    <AnimatedCounter end={stat.end} prefix={stat.prefix} suffix={stat.suffix} />
                  </h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2.5">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>

      </section>
    </div>
  );
}

