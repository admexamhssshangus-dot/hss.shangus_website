import React, { useState, useEffect } from 'react';
import { Search, Calendar, ExternalLink, ArrowLeft, RefreshCw, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function NoticeBoard() {
  const [notices, setNotices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const parseNoticeDate = (dateStr) => {
    if (!dateStr) return null;
    const cleaned = dateStr.trim();
    const currentYear = new Date().getFullYear();

    let parsed = Date.parse(`${cleaned}, ${currentYear}`);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      const now = new Date();
      if (d > now && (d - now) > 30 * 24 * 60 * 60 * 1000) {
        d.setFullYear(currentYear - 1);
      }
      return d;
    }

    parsed = Date.parse(cleaned);
    if (!isNaN(parsed)) return new Date(parsed);

    return null;
  };

  const isNoticeNew = (dateStr, customDays, defaultDays) => {
    const date = parseNoticeDate(dateStr);
    if (!date) return false;
    const days = customDays !== undefined && !isNaN(customDays) ? customDays : defaultDays;
    const diffTime = new Date() - date;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= days;
  };

  const formatDate = (dateStr) => {
    const date = parseNoticeDate(dateStr);
    if (!date) return dateStr;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    
    return `${day}-${month}-${year}`;
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
    import('../utils/settingsLoader').then(({ loadSiteSettings }) => {
      loadSiteSettings().then(setSettings);
    });
  }, []);

  useEffect(() => {
    let active = true;
    async function loadNotices() {
      // 1. Check local storage override first (for instant admin updates preview)
      const local = localStorage.getItem('site_notices');
      if (local) {
        const parsed = parseNotices(local);
        if (parsed.length > 0 && active) {
          setNotices(parsed);
          setLoading(false);
          return;
        }
      }

      // 2. Fetch from server
      try {
        const res = await fetch('/slides/notices.txt?t=' + Date.now(), { cache: 'no-cache' });
        if (!res.ok) throw new Error('Notices file not found');
        const text = await res.text();
        const parsed = parseNotices(text);
        if (active) {
          setNotices(parsed);
        }
      } catch (err) {
        console.error('Failed to load notices archives:', err);
        if (active) {
          setNotices([
            { date: 'Nov 23', title: 'JKBOSE Datesheet', link: '#' },
            { date: 'Nov 23', title: 'PreBoard Results', link: '#' },
            { date: 'Nov 23', title: 'Admit Cards', link: '#' }
          ]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadNotices();
    return () => { active = false; };
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

  const filteredNotices = notices.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.date.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full bg-gradient-to-b from-teal-50 to-white py-8 min-h-screen">
      <SEO title="Notice Board & Updates" description="Official Notice Board of Govt. Higher Secondary School Shangus. Stay updated with dynamic bulletins, board result declarations, exam schedules, and circulars." />

      <div className="max-w-4xl mx-auto px-4">

        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 hover:underline">
            <ArrowLeft size={14} />
            Back to Home
          </Link>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Archives & Bulletin</span>
        </div>

        {/* Hero Section */}
        <div className="bg-teal-800 text-white rounded-2xl p-6 md:p-8 shadow-lg mb-8 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 text-teal-700/30 opacity-40">
            <FileText size={240} />
          </div>
          <div className="relative z-10">
            <span className="px-2.5 py-1 rounded bg-teal-600 text-[10px] font-bold tracking-widest uppercase">Official Notice Board</span>
            <h2 className="text-2xl md:text-3xl font-bold mt-3 font-heading">Announcements & Archives</h2>
            <p className="opacity-90 text-xs md:text-sm mt-2 max-w-xl">
              Stay up-to-date with exam timetables, notifications, guidelines, and other circulars published by school administration.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 mb-6 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
          <Search size={18} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search notices by keyword, date, or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Notices list */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-teal-800 border-t-transparent animate-spin mx-auto mb-4" />
            Loading announcements...
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotices.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 italic shadow-sm">
                No announcements found matching "{searchQuery}".
              </div>
            ) : (
              filteredNotices.map((n, idx) => {
                const isNew = isNoticeNew(n.date, n.days, settings?.defaultNewNoticeDays !== undefined ? settings.defaultNewNoticeDays : 7);
                const isExternal = n.link && (n.link.startsWith('http') || n.link.startsWith('mailto:'));
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-teal-800/80 p-4 md:p-5 shadow-sm flex items-start gap-4 hover:border-teal-500 hover:border-l-teal-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                  >
                    {/* Calendar Badge */}
                    {(() => {
                      const formatted = formatDate(n.date);
                      const parts = formatted.split('-');
                      const day = parts[0] || n.date;
                      const month = (parts[1] || '').toUpperCase();
                      return (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-slate-200 bg-slate-50 flex flex-col overflow-hidden flex-shrink-0 shadow-sm transition-all group-hover:border-teal-500/50 group-hover:shadow">
                          {/* Calendar Month Header */}
                          <div className="bg-teal-800 text-[8px] sm:text-[9px] font-bold text-white py-0.5 uppercase tracking-widest text-center select-none">
                            {month || 'DATE'}
                          </div>
                          {/* Calendar Day Body */}
                          <div className="flex-grow flex items-center justify-center bg-white font-title text-base sm:text-lg font-bold text-slate-800 leading-none">
                            {day}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Announcement text & links */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm md:text-base leading-snug break-words line-clamp-2"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={n.title}>
                        {n.title}
                      </h4>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {n.link && n.link !== '#' ? (
                          isExternal ? (
                            <a
                              href={n.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 group-hover:underline"
                            >
                              <span>Official Document</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <Link
                              to={n.link}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 group-hover:underline"
                            >
                              <span>Internal Page</span>
                              <FileText size={12} />
                            </Link>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium italic">Standard Announcement</span>
                        )}

                        {isNew && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold badge-red-custom uppercase tracking-wider animate-pulse">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
