import React, { useState, useEffect, useRef } from 'react';
import { Users, Award, BookOpen, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

// 1. IMPORT YOUR LOCAL BACKGROUND IMAGE (Make sure the file is renamed to logo.png)
import Slideshow from '../components/Slideshow';
import SEO from '../components/SEO';

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

export default function Home() {
  const [notices, setNotices] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    import('../utils/settingsLoader').then(({ loadSiteSettings }) => {
      loadSiteSettings().then(setSettings);
    });
  }, []);

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
        // If no year given and date is in the future by >30 days, assume last year
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

  useEffect(() => {
    let active = true;
    async function loadNotices() {
      // 1. Check local storage override first (for admin instant testing)
      const local = localStorage.getItem('site_notices');
      if (local) {
        const parsed = parseNotices(local);
        if (parsed.length > 0 && active) {
          setNotices(parsed);
          return;
        }
      }

      // 2. Fetch from server
      try {
        const res = await fetch('/slides/notices.txt', { cache: 'no-cache' });
        if (!res.ok) throw new Error('Notices config file not found');
        const text = await res.text();
        const parsed = parseNotices(text);
        
        if (active) {
          setNotices(parsed);
        }
      } catch (err) {
        console.error('Failed to load notices configuration:', err);
        if (active) {
          setNotices([
            { date: 'Nov 23', title: 'JKBOSE Datesheet', link: '#' },
            { date: 'Nov 23', title: 'PreBoard Results', link: '#' },
            { date: 'Nov 23', title: 'Admit Cards', link: '#' }
          ]);
        }
      }
    }
    loadNotices();
    return () => {
      active = false;
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
        }
      };
      return () => channel.close();
    } catch (err) {
      // ignore
    }
  }, []);

  return (
    <div className="w-full">
      <SEO title="Home" description="Official website of Govt. Higher Secondary School Shangus. Explore latest notices, school admissions process, ERP portals, and details from Principal." />
      <div className="hero-container relative w-full bg-slate-900 flex items-center justify-center text-center overflow-hidden">
        
        {/* Background slideshow: using `public/slides/slides.txt` mapping file */}
        <Slideshow configUrl="/slides/slides.txt" imageFolder="/slides/" interval={6000} />
        
        <div className="relative z-20 px-4">
          <h2
            className="text-[15px] sm:text-[31px] md:text-[48px] font-semibold mb-3.5 sm:mb-6 italic tracking-wider leading-none sm:leading-snug font-slogan"
            style={{
              color: '#961c14',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.95), 0 0 20px rgba(255, 255, 255, 0.85), 0 0 35px rgba(255, 255, 255, 0.6), 0 2px 4px rgba(0, 0, 0, 0.5)'
            }}
          >
            nurturing minds, shaping futures
          </h2>
          <div className="flex flex-row justify-center items-center space-x-1.5">
            <Link to="/admissions" className="px-2 py-0.5 sm:px-5 sm:py-2 font-bold rounded-md transition-all shadow-lg inline-block text-[10px] sm:text-[14px] btn-hero-primary">
              {settings?.globalAdmissionsClosed ? 'Admissions Closed' : 'Admissions Open 2026'}
            </Link>
            <Link to="/about" className="px-1.5 py-0.5 sm:px-[14px] sm:py-[6px] font-bold rounded-md transition-all shadow-lg inline-block text-[9px] sm:text-[12px] btn-hero-secondary">
              Learn More
            </Link>
          </div>
        </div>
        
          {/* (Removed legacy bottom banner to avoid overlapping with slideshow captions) */}
      </div>

      {/* Main Content Area: Notices & Principal */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Notices Sidebar */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-teal-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Latest Notices</h3>
              <span className="bg-teal-600 text-xs px-2 py-1 rounded">UPDATES</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar px-4">
              <ul className="divide-y divide-slate-100">
                {notices.map((n, idx) => {
                  const isNew = isNoticeNew(n.date, n.days, settings?.defaultNewNoticeDays !== undefined ? settings.defaultNewNoticeDays : 7);
                  return (
                    <li key={idx} className="py-3 flex items-start">
                      <span className="text-[10px] font-bold text-slate-400 mr-4 mt-1 w-16 flex-shrink-0 whitespace-nowrap">{formatDate(n.date)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5 flex-wrap sm:flex-nowrap justify-between">
                          {n.link && n.link !== '#' ? (
                            n.link.startsWith('http') || n.link.startsWith('mailto:') ? (
                              <a href={n.link} target="_blank" rel="noopener noreferrer" 
                                 className="text-xs sm:text-sm font-medium text-slate-800 hover:text-teal-700 hover:underline line-clamp-2 flex-grow"
                                 style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                 title={n.title}>
                                {n.title}
                              </a>
                            ) : (
                              <Link to={n.link} 
                                    className="text-xs sm:text-sm font-medium text-slate-800 hover:text-teal-700 hover:underline line-clamp-2 flex-grow"
                                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                    title={n.title}>
                                {n.title}
                              </Link>
                            )
                          ) : (
                            <span className="text-xs sm:text-sm font-medium text-slate-700 line-clamp-2 flex-grow"
                                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                  title={n.title}>
                              {n.title}
                            </span>
                          )}
                          
                          {isNew && (
                            <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse uppercase tracking-wider flex-shrink-0 mt-0.5">
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
              <Link to="/notices" className="text-sm font-bold text-teal-800 hover:underline">
                View All Archives
              </Link>
            </div>
          </div>
        </div>

        {/* Principal Message & Stats */}
        <div className="col-span-1 md:col-span-2">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 md:border-l-4 md:border-teal-800 md:pl-4 mb-6">Principal's Message</h2>
            <div className="flex flex-col sm:flex-row bg-white p-6 rounded-lg shadow-lg border-2 border-teal-100 items-center">
              <div className="w-32 h-32 flex-shrink-0 rounded-md overflow-hidden mx-auto mb-4 sm:mb-0 shadow-md border-2 border-teal-500">
                <img src="/slides/Principal.jpg" alt="Principal Mr. Aijaz Ahmad Wagay" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 lg:border-l-2 lg:border-teal-100 lg:pl-4 pl-0">
                <div className="bg-white p-4 rounded shadow-sm border border-slate-100">
                  <p className="text-slate-700 italic text-sm leading-relaxed">
                    "Welcome to <strong className="text-slate-800">Govt HSS Shangus</strong>. Our mandate is to <strong>empower leaders</strong> defined by <strong>academic excellence and ethics</strong>. We offer a learning environment where <strong>cutting-edge resources</strong> in <strong>Science and Humanities</strong> meet <strong>value-based education</strong> — equipping you with the skills to thrive and the character to lead in a global society."
                  </p>
                  <p className="text-right text-xs text-slate-500 mt-4">Mr. Aijaz Ahmad Wagay<br/>Principal, HSS Shangus</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row - NOW FEATURING ANIMATED COUNTERS! */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, end: 700, suffix: "+", label: "STUDENTS" },
              { icon: Award, end: 25, suffix: "+", label: "TEACHERS" },
              { icon: BookOpen, end: 22, suffix: "+", label: "SUBJECTS" },
              { icon: GraduationCap, end: 90, suffix: "%+", label: "RESULT" }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 text-center flex flex-col items-center justify-center">
                <h4 className="text-3xl font-bold text-teal-700">
                  <AnimatedCounter end={stat.end} prefix={stat.prefix} suffix={stat.suffix} />
                </h4>
                <p className="text-xs font-bold text-slate-500 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

