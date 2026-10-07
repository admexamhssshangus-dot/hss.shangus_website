import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Trophy, Award, Star, Medal, Sparkles, Building2, Search,
  GraduationCap, Calendar, User, CheckCircle2, ChevronRight,
  ExternalLink, X, Share2, Filter, Layers, ArrowUpRight
} from 'lucide-react';
import EducationalBackground from '../components/common/EducationalBackground';
import SEO from '../components/SEO';
import PublicPageSkeleton from '../components/PublicPageSkeleton';
import ClassBoardResultsSection from '../components/ClassBoardResultsSection';
import { fetchPublishedAchievements } from '../services/achievementsService';
import { getCurrentAcademicSession } from '../services/dbCache';

// Category color mappings & metadata
const CATEGORY_META = {
  jkbose: {
    label: 'JKBOSE Board Results',
    shortLabel: 'Board Results',
    icon: Award,
    badgeBg: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800',
    accentBorder: 'from-teal-500 via-emerald-400 to-teal-600',
    headerBadge: 'bg-teal-600 text-white'
  },
  competitive: {
    label: 'NEET / JEE / CUET',
    shortLabel: 'Competitive Exams',
    icon: Trophy,
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    accentBorder: 'from-amber-500 via-orange-400 to-amber-600',
    headerBadge: 'bg-amber-600 text-white'
  },
  sports: {
    label: 'Sports & Athletics',
    shortLabel: 'Athletics & Games',
    icon: Medal,
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    accentBorder: 'from-blue-500 via-indigo-400 to-cyan-500',
    headerBadge: 'bg-blue-600 text-white'
  },
  cocurricular: {
    label: 'Co-Curricular & Arts',
    shortLabel: 'Co-Curricular',
    icon: Sparkles,
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
    accentBorder: 'from-purple-500 via-pink-400 to-indigo-500',
    headerBadge: 'bg-purple-600 text-white'
  },
  institutional: {
    label: 'Institutional Honors',
    shortLabel: 'Institutional',
    icon: Building2,
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
    accentBorder: 'from-emerald-500 via-teal-400 to-emerald-600',
    headerBadge: 'bg-emerald-600 text-white'
  }
};

export default function Achievements() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeViewTab, setActiveViewTab] = useState(() => {
    return searchParams.get('tab') === 'honors' ? 'honors' : 'board_results';
  });
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  // Default session set strictly to current academic session
  const [selectedSession, setSelectedSession] = useState(() => getCurrentAcademicSession() || '2025-26');
  const [utFilterOnly, setUtFilterOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleTabChange = (newTab) => {
    setActiveViewTab(newTab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    }, { replace: true });
  };

  // Load published achievements
  const loadData = async (force = false) => {
    try {
      setLoading(true);
      const items = await fetchPublishedAchievements(force);
      setAchievements(items || []);
    } catch (err) {
      console.error('[Achievements] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for live cross-tab mutations
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      try {
        const channel = new BroadcastChannel('hss_data_sync');
        channel.onmessage = (event) => {
          if (event.data?.type === 'ACHIEVEMENTS_MUTATION') {
            loadData(true);
          }
        };
        return () => {
          try { channel.close(); } catch (_) {}
        };
      } catch (_) {}
    }
  }, []);

  // Available sessions in dataset
  const availableSessions = useMemo(() => {
    const defaultSess = getCurrentAcademicSession() || '2025-26';
    const set = new Set([defaultSess, '2024-25', '2023-24']);
    achievements.forEach(item => {
      if (item.session) set.add(item.session);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [achievements]);

  // J&K UT Position Holders (Prominent Spotlight items)
  const utPositionHolders = useMemo(() => {
    return achievements.filter(item => Boolean(item.isUtPositionHolder));
  }, [achievements]);

  // Filtered items based on user criteria
  const filteredAchievements = useMemo(() => {
    return achievements.filter(item => {
      // UT filter toggle
      if (utFilterOnly && !item.isUtPositionHolder) return false;

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // Class filter
      if (selectedClass !== 'all' && item.className !== selectedClass) return false;

      // Session filter
      if (selectedSession !== 'all' && item.session !== selectedSession) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const title = (item.title || '').toLowerCase();
        const name = (item.studentName || '').toLowerCase();
        const father = (item.fatherName || '').toLowerCase();
        const regNo = (item.boardRegNo || '').toLowerCase();
        const rollNo = (item.examRollNo || '').toLowerCase();
        const exam = (item.examOrEvent || '').toLowerCase();
        const inst = (item.institutionOrAward || '').toLowerCase();
        const rank = (item.rankOrPosition || '').toLowerCase();
        const utRank = (item.utPositionOrRank || '').toLowerCase();

        return (
          title.includes(query) ||
          name.includes(query) ||
          father.includes(query) ||
          regNo.includes(query) ||
          rollNo.includes(query) ||
          exam.includes(query) ||
          inst.includes(query) ||
          rank.includes(query) ||
          utRank.includes(query)
        );
      }

      return true;
    });
  }, [achievements, utFilterOnly, selectedCategory, selectedClass, selectedSession, searchQuery]);

  // Overall key metrics
  const stats = useMemo(() => {
    const total = achievements.length;
    const utCount = achievements.filter(x => x.isUtPositionHolder).length;
    const boardCount = achievements.filter(x => x.category === 'jkbose').length;
    const competitiveCount = achievements.filter(x => x.category === 'competitive').length;
    const sportsCount = achievements.filter(x => x.category === 'sports').length;
    return { total, utCount, boardCount, competitiveCount, sportsCount };
  }, [achievements]);

  // Copy share citation
  const handleShare = (item) => {
    const text = `🏆 ${item.title} — ${item.studentName}${item.scoreOrMarks ? ` (${item.scoreOrMarks})` : ''} | Govt. Higher Secondary School Shangus Hall of Fame`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="public-page relative w-full min-h-screen py-6 sm:py-10 overflow-hidden isolate">
      <EducationalBackground variant="academics" />
      <SEO
        title="School Achievements & Hall of Fame"
        description="Explore the distinguished academic achievements, JKBOSE board toppers, J&K UT position holders, NEET/JEE qualifiers, and athletic accolades of Govt. Higher Secondary School Shangus."
      />

      <div className="max-w-6xl mx-auto px-3 sm:px-6 relative z-10 w-full min-w-0">
        
        {/* Header Section */}
        <header className="text-center mb-6 sm:mb-8 px-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/90 text-amber-800 border border-amber-200 shadow-xs mb-3 backdrop-blur-sm">
            <Trophy size={14} className="text-amber-600 animate-pulse" />
            <span className="tracking-wide uppercase text-[9.5px] sm:text-[11px] font-extrabold">
              Hall of Fame &amp; Scholastic Honors
            </span>
          </div>
          <h1 className="ui-page-title text-xl sm:text-3xl md:text-4xl text-slate-800 font-extrabold">
            School Achievements &amp; Merits
          </h1>
          <div className="h-1.5 w-24 sm:w-28 bg-gradient-to-r from-amber-500 via-teal-400 to-indigo-500 mx-auto mt-2.5 sm:mt-3 rounded-full shadow-xs" />
          <p className="text-xs sm:text-base text-slate-800 dark:text-slate-200 font-medium mt-2.5 sm:mt-3 max-w-2xl mx-auto leading-relaxed">
            Celebrating the stellar academic milestones, JKBOSE Board rank holders, J&amp;K UT position holders, competitive exam qualifiers, and sports champions of Govt. Higher Secondary School Shangus.
          </p>
        </header>

        {/* ── VIEW SWITCHER TABS (MINIMAL & COMPACT) ── */}
        <div className="flex items-center justify-center mb-6 px-2">
          <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-full overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => handleTabChange('board_results')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeViewTab === 'board_results'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={14} className={activeViewTab === 'board_results' ? 'text-teal-600' : 'text-slate-400'} />
              <span>Class 10th &amp; 11th Results</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('honors')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeViewTab === 'honors'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trophy size={14} className={activeViewTab === 'honors' ? 'text-amber-600' : 'text-slate-400'} />
              <span>Honors &amp; Hall of Fame</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {achievements.length}
              </span>
            </button>
          </div>
        </div>

        {activeViewTab === 'board_results' ? (
          <div className="space-y-4">
            <ClassBoardResultsSection />

            {/* Minimal & Compact Hall of Fame Teaser Link */}
            <div className="max-w-2xl mx-auto p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                Looking for student citations, state merits, and NEET/JEE qualifiers?
              </span>
              <button
                type="button"
                onClick={() => handleTabChange('honors')}
                className="font-bold text-teal-700 dark:text-teal-300 hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <span>View Hall of Fame</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Minimal banner linking to Class Board Results */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs mb-5">
              <span className="text-slate-600 dark:text-slate-400">
                Official Class 10th &amp; 11th Board evaluation tables and statistical summaries are available in the Results tab.
              </span>
              <button
                type="button"
                onClick={() => handleTabChange('board_results')}
                className="font-bold text-teal-700 dark:text-teal-300 hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <span>View Board Results</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {/* ── HIGHLIGHT: UT TOP POSITION HOLDERS SPOTLIGHT BANNER ── */}
        {utPositionHolders.length > 0 && (
          <div className="relative mb-8 rounded-3xl p-5 sm:p-7 overflow-hidden border-2 border-amber-400/80 bg-gradient-to-br from-amber-500/10 via-amber-50/70 to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-950 shadow-md">
            {/* Top decorative ribbon */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-600" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-5 border-b border-amber-200/60 dark:border-amber-900/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                  <Trophy size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-200 tracking-tight">
                      J&amp;K UT Position Holders &amp; Top Performers
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                      UT State Honors
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-amber-800/80 dark:text-amber-300/80 font-medium">
                    Students securing premier ranks and distinguished honors across Jammu &amp; Kashmir Union Territory.
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>{utPositionHolders.length} UT Merit Achievers</span>
              </div>
            </div>

            {/* UT Cards Showcase Carousel / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {utPositionHolders.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="group relative bg-white/95 dark:bg-slate-900/90 rounded-2xl p-4 border border-amber-300/80 dark:border-amber-800/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Student Photo Thumbnail */}
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-400 bg-amber-50 dark:bg-slate-800 flex items-center justify-center shadow-xs group-hover:border-amber-500 transition-colors">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={item.studentName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-white font-black text-lg">
                            {(item.studentName || 'HSS').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-full shadow-xs">
                        <Trophy size={10} className="stroke-[3]" />
                      </div>
                    </div>

                    {/* Student Basic Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          {item.utPositionOrRank || 'UT Rank Holder'}
                        </span>
                        {item.session && (
                          <span className="text-[9.5px] font-bold text-slate-500">
                            {item.session}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                        {item.studentName}
                      </h3>
                      {item.fatherName && (
                        <p className="text-[10.5px] text-slate-500 truncate">
                          S/o {item.fatherName}
                        </p>
                      )}
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                        Class {item.className} {item.stream ? `• ${item.stream}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Score / Admission Highlight */}
                  <div className="mt-3 pt-2.5 border-t border-amber-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    {item.scoreOrMarks ? (
                      <span className="font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200/70 dark:border-amber-900/60 text-[11px]">
                        {item.scoreOrMarks}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">{item.examOrEvent}</span>
                    )}

                    <span className="text-[10.5px] font-bold text-teal-700 dark:text-teal-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      <span>Citation</span>
                      <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistical Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-7">
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Total Accolades
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {stats.total}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">Verified</span>
            </div>
          </div>

          <div className="bg-amber-50/70 dark:bg-amber-950/40 p-3.5 sm:p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1">
              UT Position Holders
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-100">
                {stats.utCount}
              </span>
              <span className="text-[10px] text-amber-700 font-bold">State Merits</span>
            </div>
          </div>

          <div className="bg-teal-50/70 dark:bg-teal-950/40 p-3.5 sm:p-4 rounded-2xl border border-teal-200/80 dark:border-teal-900/50 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 block mb-1">
              JKBOSE Board Toppers
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-teal-900 dark:text-teal-100">
                {stats.boardCount}
              </span>
              <span className="text-[10px] text-teal-700 font-bold">Distinctions</span>
            </div>
          </div>

          <div className="bg-blue-50/70 dark:bg-blue-950/40 p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block mb-1">
              Competitive &amp; Sports
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-100">
                {stats.competitiveCount + stats.sportsCount}
              </span>
              <span className="text-[10px] text-blue-700 font-bold">NEET/JEE/Games</span>
            </div>
          </div>
        </div>

        {/* ── FILTER & SEARCH TOOLBAR ── */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm mb-7 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Live Search Input */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, registration number, examination, or selection..."
                className="w-full pl-9.5 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown Filters (Session & Class) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              {/* UT Toggle Pill */}
              <button
                type="button"
                onClick={() => setUtFilterOnly(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border ${
                  utFilterOnly
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                <Trophy size={13} className={utFilterOnly ? 'text-white' : 'text-amber-600'} />
                <span>UT Positions</span>
              </button>

              {/* Session Select (Defaulted to current session 2025-26) */}
              <div className="relative shrink-0">
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
                >
                  <option value="all">All Sessions</option>
                  {availableSessions.map(sess => (
                    <option key={sess} value={sess}>
                      Session {sess}
                    </option>
                  ))}
                </select>
                <Calendar size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Class Select */}
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="pl-3 pr-5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer shrink-0"
              >
                <option value="all">All Classes</option>
                <option value="12th">Class 12th</option>
                <option value="11th">Class 11th</option>
                <option value="10th">Class 10th</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Accolades ({achievements.length})
            </button>

            {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
              const count = achievements.filter(x => x.category === catKey).length;
              const IconComp = meta.icon;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSelectedCategory(catKey)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                    selectedCategory === catKey
                      ? `${meta.headerBadge} border-transparent shadow-xs`
                      : 'border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <IconComp size={12} />
                  <span>{meta.shortLabel}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── HONORS & ACHIEVEMENTS CARD GRID ── */}
        {loading ? (
          <div className="py-12">
            <PublicPageSkeleton />
          </div>
        ) : filteredAchievements.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-sm my-6 space-y-3">
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 mx-auto flex items-center justify-center">
              <Trophy size={26} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              No achievements matched your active filter
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try adjusting the session selector, clearing search keywords, or selecting "All Accolades" to view the complete institutional honor roll.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedClass('all');
                setSelectedSession('all');
                setUtFilterOnly(false);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAchievements.map((item) => {
              const meta = CATEGORY_META[item.category] || CATEGORY_META.jkbose;
              const IconComp = meta.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-hidden ${
                    item.isUtPositionHolder
                      ? 'border-amber-300/90 dark:border-amber-800/70 shadow-sm ring-1 ring-amber-400/20'
                      : 'border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-teal-500/70'
                  }`}
                >
                  {/* Top accent line */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${meta.accentBorder}`} />

                  {/* Card Content Top */}
                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.badgeBg}`}>
                        <IconComp size={10} />
                        <span>{meta.shortLabel}</span>
                      </span>

                      {item.isUtPositionHolder && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                          <Trophy size={10} />
                          <span>UT Rank</span>
                        </span>
                      )}
                    </div>

                    {/* Student Avatar + Demographic Block */}
                    <div className="flex items-start gap-3.5 mb-3.5">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0 flex items-center justify-center shadow-xs group-hover:border-teal-500 transition-colors">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={item.studentName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg">
                            {(item.studentName || 'HSS').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                          {item.studentName || 'Distinguished Scholar'}
                        </h3>
                        {item.fatherName && (
                          <p className="text-[11px] text-slate-500 truncate">
                            S/o {item.fatherName}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 mt-1">
                          <span>Class {item.className}</span>
                          {item.stream && <span>• {item.stream}</span>}
                          {item.session && <span>({item.session})</span>}
                        </div>
                      </div>
                    </div>

                    {/* Achievement Title */}
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-relaxed mb-2.5">
                      {item.title}
                    </h4>

                    {/* Score / Rank Highlight Pill */}
                    {(item.scoreOrMarks || item.utPositionOrRank || item.rankOrPosition) && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 mb-3 space-y-1">
                        {item.scoreOrMarks && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Score / Performance</span>
                            <span className="font-black text-teal-700 dark:text-teal-300">{item.scoreOrMarks}</span>
                          </div>
                        )}
                        {(item.utPositionOrRank || item.rankOrPosition) && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Official Position</span>
                            <span className="font-extrabold text-amber-700 dark:text-amber-400">{item.utPositionOrRank || item.rankOrPosition}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Allotted College / Selection */}
                    {item.institutionOrAward && (
                      <div className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 mb-2 font-medium">
                        <GraduationCap size={13} className="text-teal-600 shrink-0 mt-0.5" />
                        <span className="truncate">{item.institutionOrAward}</span>
                      </div>
                    )}

                    {/* Description Snippet */}
                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-normal">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-400">
                      {item.examOrEvent || 'Institutional Merit'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-teal-600 dark:text-teal-400 group-hover:translate-x-0.5 transition-transform">
                      <span>View Honors</span>
                      <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}

      </div>

      {/* ── DETAILED CITATION & HONORS POPUP MODAL ── */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative"
          >
            {/* Modal top ribbon */}
            <div className={`h-2 bg-gradient-to-r ${(CATEGORY_META[selectedItem.category] || CATEGORY_META.jkbose).accentBorder}`} />

            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${(CATEGORY_META[selectedItem.category] || CATEGORY_META.jkbose).badgeBg}`}>
                    {(CATEGORY_META[selectedItem.category] || CATEGORY_META.jkbose).label}
                  </span>
                  {selectedItem.isUtPositionHolder && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                      🏆 UT State Honor
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                  {selectedItem.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Student Demographics Banner */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-400/80 bg-white shrink-0 flex items-center justify-center shadow-xs">
                  {selectedItem.photoUrl ? (
                    <img
                      src={selectedItem.photoUrl}
                      alt={selectedItem.studentName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-white font-black text-2xl">
                      {(selectedItem.studentName || 'HSS').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                    {selectedItem.studentName}
                  </h3>
                  {selectedItem.fatherName && (
                    <p className="text-xs text-slate-500 font-medium">
                      Son/Daughter of {selectedItem.fatherName}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-600">
                      Class {selectedItem.className}
                    </span>
                    {selectedItem.stream && (
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-600">
                        {selectedItem.stream}
                      </span>
                    )}
                    {selectedItem.session && (
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-600">
                        Session {selectedItem.session}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Official Academic Verification Matrix */}
              <div className="grid grid-cols-2 gap-2.5">
                {selectedItem.boardRegNo && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Board Reg No</span>
                    <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-200">{selectedItem.boardRegNo}</span>
                  </div>
                )}
                {selectedItem.examRollNo && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Exam Roll No</span>
                    <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-200">{selectedItem.examRollNo}</span>
                  </div>
                )}
                {selectedItem.scoreOrMarks && (
                  <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-900/50">
                    <span className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400 block">Score / Marks</span>
                    <span className="text-xs font-black text-teal-900 dark:text-teal-200">{selectedItem.scoreOrMarks}</span>
                  </div>
                )}
                {(selectedItem.utPositionOrRank || selectedItem.rankOrPosition) && (
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50">
                    <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Rank / Position</span>
                    <span className="text-xs font-black text-amber-900 dark:text-amber-200">{selectedItem.utPositionOrRank || selectedItem.rankOrPosition}</span>
                  </div>
                )}
              </div>

              {/* Institution / College Selection */}
              {selectedItem.institutionOrAward && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50 flex items-start gap-2.5">
                  <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-500 block">Allotted Institution / Awarding Body</span>
                    <span className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200">{selectedItem.institutionOrAward}</span>
                  </div>
                </div>
              )}

              {/* Full Citation / Description */}
              {selectedItem.description && (
                <div className="space-y-1.5 pt-2">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Institutional Citation
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {/* Institutional Seal Watermark */}
              <div className="pt-2 text-center text-[10.5px] text-slate-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Authoritative Institutional Honor • Govt. Higher Secondary School Shangus</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleShare(selectedItem)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Share2 size={13} />
                <span>{copiedLink ? 'Copied Citation!' : 'Share Citation'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
