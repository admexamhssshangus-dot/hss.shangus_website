import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Trophy, Award, Search, GraduationCap, X, Share2,
  ChevronRight, ArrowUpRight
} from 'lucide-react';
import EducationalBackground from '../components/common/EducationalBackground';
import SEO from '../components/SEO';
import PublicPageSkeleton from '../components/PublicPageSkeleton';
import ClassBoardResultsSection from '../components/ClassBoardResultsSection';
import HonoreePhotoAvatar from '../components/HonoreePhotoAvatar';
import { fetchPublishedAchievements, normalizeCanonicalAchievementSession } from '../services/achievementsService';

// Category color mappings & metadata
const CATEGORY_META = {
  jkbose: {
    label: 'JKBOSE Board Position Holders',
    shortLabel: 'JKBOSE Positions',
    icon: Award,
    badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800',
    accentBorder: 'from-indigo-600 via-blue-500 to-indigo-700',
    headerBadge: 'bg-indigo-600 text-white'
  },
  competitive: {
    label: 'National Competitive Exams (NEET / JEE)',
    shortLabel: 'NEET & JEE',
    icon: Trophy,
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    accentBorder: 'from-amber-500 via-orange-400 to-amber-600',
    headerBadge: 'bg-amber-600 text-white'
  },
  sports: {
    label: 'Sports & Athletics Honors',
    shortLabel: 'Sports Honors',
    icon: Award,
    badgeBg: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    accentBorder: 'from-blue-600 via-cyan-500 to-blue-700',
    headerBadge: 'bg-blue-600 text-white'
  },
  cocurricular: {
    label: 'Co-Curricular & Arts Distinctions',
    shortLabel: 'Arts & Debates',
    icon: Trophy,
    badgeBg: 'bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
    accentBorder: 'from-purple-600 via-fuchsia-500 to-purple-700',
    headerBadge: 'bg-purple-600 text-white'
  },
  institutional: {
    label: 'Institutional Excellence Honors',
    shortLabel: 'School Honors',
    icon: Award,
    badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
    accentBorder: 'from-emerald-600 via-teal-500 to-emerald-700',
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
  const [selectedSession, setSelectedSession] = useState('all');
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
    const set = new Set(['2025-26', '2024-25 (Oct-Nov)', '2024-25 (Mar-Apr)', '2023-24']);
    achievements.forEach(item => {
      const s = normalizeCanonicalAchievementSession(item.session, item.examOrEvent);
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [achievements]);

  // Filtered items based on user criteria
  const filteredAchievements = useMemo(() => {
    return achievements.filter(item => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // Class filter
      if (selectedClass !== 'all' && item.className !== selectedClass) return false;

      // Session filter
      if (selectedSession !== 'all') {
        const itemSess = normalizeCanonicalAchievementSession(item.session, item.examOrEvent);
        if (itemSess !== selectedSession && item.session !== selectedSession && !(selectedSession === '2024-25' && (itemSess.includes('2024-25') || (item.session || '').includes('2024-25')))) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const title = (item.title || '').toLowerCase();
        const name = (item.studentName || '').toLowerCase();
        const father = (item.fatherName || '').toLowerCase();
        const rollNo = (item.examRollNo || '').toLowerCase();
        const exam = (item.examOrEvent || '').toLowerCase();
        const rank = (item.rankOrPosition || '').toLowerCase();
        const utRank = (item.utPositionOrRank || '').toLowerCase();

        return (
          title.includes(query) ||
          name.includes(query) ||
          father.includes(query) ||
          rollNo.includes(query) ||
          exam.includes(query) ||
          rank.includes(query) ||
          utRank.includes(query)
        );
      }

      return true;
    });
  }, [achievements, selectedCategory, selectedClass, selectedSession, searchQuery]);

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
    <div className="public-page relative w-full min-h-screen pt-2.5 sm:pt-6 pb-6 sm:pb-10 overflow-hidden isolate">
      <EducationalBackground variant="academics" />
      <SEO
        title="School Achievements & Hall of Fame"
        description="Explore the distinguished academic achievements, JKBOSE board toppers, J&K UT position holders, and NEET/JEE national qualifiers of Govt. Higher Secondary School Shangus."
      />

      <div className="max-w-6xl mx-auto px-3 sm:px-6 relative z-10 w-full min-w-0">
        
        {/* Header Section — Compact & Space Efficient */}
        <header className="text-center mb-3 sm:mb-5 px-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-white/90 text-amber-800 border border-amber-200 shadow-xs mb-1.5 backdrop-blur-sm">
            <Trophy size={13} className="text-amber-600 animate-pulse" />
            <span className="tracking-wide uppercase font-extrabold">
              Hall of Fame &amp; Scholastic Honors
            </span>
          </div>
          <h1 className="ui-page-title text-xl sm:text-3xl md:text-4xl text-slate-800 dark:text-white font-extrabold">
            School Achievements &amp; Merits
          </h1>
          <div className="h-1 w-20 sm:w-28 bg-gradient-to-r from-amber-500 via-teal-400 to-indigo-500 mx-auto mt-1.5 sm:mt-2 rounded-full shadow-xs" />
          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium mt-1 max-w-lg mx-auto leading-snug">
            Honoring our national qualifiers (NEET/JEE) and JKBOSE board position holders.
          </p>
        </header>

        {/* ── VIEW SWITCHER TABS ── */}
        <div className="flex items-center justify-center mb-2.5 sm:mb-4 px-2">
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-full overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => handleTabChange('board_results')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeViewTab === 'board_results'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={13} className={activeViewTab === 'board_results' ? 'text-teal-600' : 'text-slate-400'} />
              <span>Class 10th, 11th &amp; 12th Results</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('honors')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeViewTab === 'honors'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trophy size={13} className={activeViewTab === 'honors' ? 'text-amber-600' : 'text-slate-400'} />
              <span>Honors &amp; Hall of Fame</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {achievements.length}
              </span>
            </button>
          </div>
        </div>

        {activeViewTab === 'board_results' ? (
          <div>
            <ClassBoardResultsSection />
          </div>
        ) : (
          <div>
            {/* ── FILTER & SEARCH TOOLBAR (STREAMLINED & PROFESSIONAL) ── */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs mb-5 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search honoree name, exam, rank..."
                    className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Dropdowns */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Sessions</option>
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>
                        Session {sess}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Classes</option>
                    <option value="12th">Class 12th</option>
                    <option value="11th">Class 11th</option>
                  </select>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  All Laureates ({achievements.length})
                </button>

                {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
                  const count = achievements.filter(x => x.category === catKey).length;
                  if (count === 0) return null;
                  const IconComp = meta.icon;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setSelectedCategory(catKey)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                        selectedCategory === catKey
                          ? `${meta.headerBadge} border-transparent shadow-2xs`
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <IconComp size={12} />
                      <span>{meta.shortLabel}</span>
                      <span className="text-[10px] opacity-80">({count})</span>
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
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-2xs my-4 space-y-2">
                <Trophy size={24} className="text-amber-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  No records match your active criteria
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try clearing search or filters to view all institutional honorees.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedClass('all');
                    setSelectedSession('all');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredAchievements.map((item) => {
                  const meta = CATEGORY_META[item.category] || CATEGORY_META.jkbose;
                  const isTopCompetitive = item.category === 'competitive';

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1 hover:shadow-xl ${
                        isTopCompetitive
                          ? 'border-amber-300/80 dark:border-amber-800/80 shadow-xs hover:border-amber-400 hover:shadow-amber-500/10'
                          : 'border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-400/80 hover:shadow-indigo-500/10'
                      }`}
                    >
                      <div>
                        {/* Top: Header Badge & Session */}
                        <div className="flex items-center justify-between gap-1.5 mb-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border ${
                            isTopCompetitive
                              ? 'bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800'
                              : meta.badgeBg
                          }`}>
                            <span>{item.badge || item.utPositionOrRank || 'Honoree'}</span>
                          </span>

                          {item.session && (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                              Session {item.session}
                            </span>
                          )}
                        </div>

                        {/* Hero Profile Row: Photo Avatar + Demographics */}
                        <div className="flex items-center gap-3.5 mb-3.5">
                          <HonoreePhotoAvatar item={item} size="md" />

                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-[17px] font-black text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors tracking-tight">
                              {item.studentName}
                            </h3>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                              Class {item.className} {item.stream ? `• ${item.stream}` : ''}
                            </p>
                            {item.boardRegNo && (
                              <p className="text-[10.5px] font-mono font-bold text-indigo-700 dark:text-indigo-300 truncate mt-0.5">
                                Reg No: {item.boardRegNo}
                              </p>
                            )}
                            {item.fatherName ? (
                              <p className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                S/D of {item.fatherName}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Minimal Key Metric Pill (Clean & Uncluttered) */}
                        <div className="space-y-1.5 mb-3">
                          {item.scoreOrMarks && (
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-900/40 text-xs">
                              <span className="text-[9.5px] uppercase font-black tracking-wider text-teal-700 dark:text-teal-400">
                                Score / Merit
                              </span>
                              <span className="font-black text-teal-950 dark:text-teal-200 text-xs truncate max-w-[65%] text-right font-mono">
                                {item.scoreOrMarks}
                              </span>
                            </div>
                          )}

                          {item.institutionOrAward && item.institutionOrAward !== 'Govt. Higher Secondary School Shangus' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/40 text-[11px] text-indigo-950 dark:text-indigo-200 font-semibold truncate">
                              <GraduationCap size={13} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                              <span className="truncate">{item.institutionOrAward.split('/')[0].trim()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Clean single line with click affordance */}
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-[60%]">
                          {item.examOrEvent?.split('(')[0]?.trim() || 'Merit Record'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
                          <span>View Details</span>
                          <ChevronRight size={13} />
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
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative"
          >
            {/* Modal top ribbon */}
            <div className={`h-2 bg-gradient-to-r ${(CATEGORY_META[selectedItem.category] || CATEGORY_META.jkbose).accentBorder}`} />

            {/* Modal Header */}
            <div className="p-4 sm:p-5 pb-3 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${(CATEGORY_META[selectedItem.category] || CATEGORY_META.jkbose).badgeBg}`}>
                    {(CATEGORY_META[selectedItem.category] || CATEGORY_META.jkbose).label}
                  </span>
                  {selectedItem.isUtPositionHolder && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                      🏆 UT State Honor
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {selectedItem.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Honoree Hero Profile Header */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <HonoreePhotoAvatar item={selectedItem} size="xl" />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-center sm:justify-between gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {selectedItem.studentName}
                    </h3>
                    {selectedItem.session && (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10.5px] font-bold border border-slate-200 dark:border-slate-600">
                        Session {normalizeCanonicalAchievementSession(selectedItem.session, selectedItem.examOrEvent)}
                      </span>
                    )}
                  </div>
                  {selectedItem.fatherName && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Son / Daughter of <strong className="text-slate-800 dark:text-slate-200">{selectedItem.fatherName}</strong>
                    </p>
                  )}
                  <div className="flex items-center justify-center sm:justify-start flex-wrap gap-1.5 pt-1.5">
                    <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-[11px] font-bold border border-teal-200 dark:border-teal-800">
                      Class {selectedItem.className} {selectedItem.stream ? `(${selectedItem.stream})` : ''}
                    </span>
                    {selectedItem.boardRegNo && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-mono text-[11px] font-bold border border-indigo-200 dark:border-indigo-800">
                        Reg No: {selectedItem.boardRegNo}
                      </span>
                    )}
                    {selectedItem.examRollNo && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                        Exam Roll: {selectedItem.examRollNo}
                      </span>
                    )}
                    {selectedItem.badge && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-black border border-amber-300 dark:border-amber-700">
                        {selectedItem.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Examination & Official Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedItem.examOrEvent && (
                  <div className="sm:col-span-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Examination / Qualifying Body</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedItem.examOrEvent}</span>
                  </div>
                )}
                {selectedItem.scoreOrMarks && (
                  <div className="p-2.5 rounded-lg bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-900/50">
                    <span className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400 block">Score / Merit</span>
                    <span className="text-xs font-black text-teal-900 dark:text-teal-200">{selectedItem.scoreOrMarks}</span>
                  </div>
                )}
                {(selectedItem.utPositionOrRank || selectedItem.rankOrPosition) && (
                  <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50">
                    <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Official Rank / Merit</span>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">{selectedItem.utPositionOrRank || selectedItem.rankOrPosition}</span>
                  </div>
                )}
              </div>

              {/* Selected Institution / Allotment */}
              {selectedItem.institutionOrAward && selectedItem.institutionOrAward !== 'Govt. Higher Secondary School Shangus' && (
                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50 flex items-start gap-2.5">
                  <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-500 block">Allotted Institution / Selection</span>
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 leading-snug">{selectedItem.institutionOrAward}</span>
                  </div>
                </div>
              )}

              {/* Official Citation */}
              {selectedItem.description && (
                <div className="space-y-1">
                  <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Official Citation &amp; Narrative
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 italic">
                    "{selectedItem.description}"
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleShare(selectedItem)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Share2 size={12} />
                <span>{copiedLink ? 'Copied Citation!' : 'Share Citation'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
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
