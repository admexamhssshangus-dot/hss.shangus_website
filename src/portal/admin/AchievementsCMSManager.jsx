import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trophy, Award, Star, Search, Plus, Edit3, Trash2, CheckCircle2,
  XCircle, Filter, Eye, RefreshCw, Upload, Camera, ExternalLink,
  ChevronDown, AlertTriangle, ShieldCheck, Sparkles, Building2,
  GraduationCap, Medal, User, FileText, Check, LayoutGrid, List,
  Hash, Calendar, RotateCcw, BarChart3, ArrowRight
} from 'lucide-react';
import {
  fetchAllAchievementsAdmin,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  lookupStudentForAchievement,
  seedDefaultAchievements,
  toggleAchievementPublished,
  toggleAchievementFeatured
} from '../../services/achievementsService';
import { getCurrentAcademicSession } from '../../services/dbCache';
import { compressImageFile } from '../../utils/imageCompressor';
import { showToast } from '../../components/common/GlobalToast';
import HonoreePhotoAvatar from '../../components/HonoreePhotoAvatar';
import ClassBoardResultsSection from '../../components/ClassBoardResultsSection';

export const CATEGORIES = [
  {
    id: 'jkbose',
    label: 'JKBOSE Board Positions',
    shortLabel: 'JKBOSE Positions',
    icon: Award,
    description: 'State & UT Board examination position holders, toppers, and distinction honorees (Classes 10th, 11th & 12th).',
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    pillColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
    accentBorder: 'from-indigo-600 via-blue-500 to-indigo-700'
  },
  {
    id: 'competitive',
    label: 'NEET / JEE & Competitive',
    shortLabel: 'NEET & JEE',
    icon: Trophy,
    description: 'National competitive entrance examination qualifiers (NTA NEET-UG, IIT-JEE Main & Advanced, AIIMS).',
    color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    pillColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
    accentBorder: 'from-amber-500 via-orange-400 to-amber-600'
  },
  {
    id: 'sports',
    label: 'Sports & Athletics',
    shortLabel: 'Sports Honors',
    icon: Medal,
    description: 'District, State & National level athletic tournaments, youth services championships, and sports honors.',
    color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    pillColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
    accentBorder: 'from-blue-600 via-cyan-500 to-blue-700'
  },
  {
    id: 'cocurricular',
    label: 'Co-Curricular & Arts',
    shortLabel: 'Arts & Debates',
    icon: Sparkles,
    description: 'Inter-school symposiums, youth parliament, debates, science exhibitions, and cultural laurels.',
    color: 'text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    pillColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200',
    accentBorder: 'from-purple-600 via-fuchsia-500 to-purple-700'
  },
  {
    id: 'institutional',
    label: 'Institutional Honors',
    shortLabel: 'School Honors',
    icon: Building2,
    description: 'Institutional excellence citations, alumni distinctions, and overall school-level recognition awards.',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    pillColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
    accentBorder: 'from-emerald-600 via-teal-500 to-emerald-700'
  }
];

export default function AchievementsCMSManager({ user, userEmail = 'admin' }) {
  // Main Studio Tabs: 'honors' (CRUD Merits & Laureates) | 'board_table' (JKBOSE Board Results Table)
  const [activeStudioTab, setActiveStudioTab] = useState('honors');

  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // Default to compact table for rapid productivity
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [utOnly, setUtOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [seedingLoading, setSeedingLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'jkbose',
    studentName: '',
    fatherName: '',
    className: '12th',
    session: getCurrentAcademicSession() || '2025-26',
    stream: 'Science',
    boardRegNo: '',
    examRollNo: '',
    examOrEvent: '',
    scoreOrMarks: '',
    rankOrPosition: '',
    isUtPositionHolder: false,
    utPositionOrRank: '',
    institutionOrAward: '',
    badge: '',
    description: '',
    photoUrl: '',
    featured: false,
    published: true,
    order: 0,
    achievementDate: new Date().toISOString().split('T')[0]
  });

  // Fast-Lookup State in Modal
  const [lookupSession, setLookupSession] = useState(getCurrentAcademicSession() || '2025-26');
  const [lookupClass, setLookupClass] = useState('12th');
  const [lookupRegNo, setLookupRegNo] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState(null);

  // Load Data from Firestore
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllAchievementsAdmin();
      // Strictly deduplicate by ID to eliminate any duplicate entries
      const seenIds = new Set();
      const deduped = (data || []).filter(item => {
        if (!item?.id || seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });
      setAchievements(deduped);
    } catch (err) {
      console.error('Failed to load achievements:', err);
      showToast('Could not load achievements list.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Restore / Seed Defaults
  const handleSeedDefaults = async () => {
    if (!window.confirm('Initialize or restore the official school achievements templates into Firebase? Any existing records will be preserved or merged.')) {
      return;
    }
    setSeedingLoading(true);
    try {
      await seedDefaultAchievements(true);
      showToast('Official school achievements templates loaded successfully!', 'success');
      await loadData();
    } catch (err) {
      console.error('Seed error:', err);
      showToast('Failed to seed template records: ' + (err.message || 'error'), 'error');
    } finally {
      setSeedingLoading(false);
    }
  };

  // Handle Fast Lookup Trigger using Reg No, Class & Session
  const handleFastLookup = async () => {
    if (!lookupRegNo.trim()) {
      showToast('Please enter a Registration Number (or Roll No) to search.', 'warning');
      return;
    }
    setLookupLoading(true);
    setLookupFeedback(null);
    try {
      const res = await lookupStudentForAchievement({
        session: lookupSession,
        className: lookupClass,
        boardRegNo: lookupRegNo.trim(),
        rollNo: lookupRegNo.trim()
      });

      if (res.found && res.student) {
        const s = res.student;
        setFormData(prev => ({
          ...prev,
          studentName: s.studentName || prev.studentName,
          fatherName: s.fatherName || prev.fatherName,
          className: s.className || prev.className,
          session: s.session || prev.session,
          stream: s.stream || prev.stream,
          boardRegNo: s.boardRegNo || lookupRegNo.trim() || prev.boardRegNo,
          examRollNo: s.examRollNo || prev.examRollNo,
          photoUrl: s.photoUrl || prev.photoUrl
        }));
        setLookupFeedback({
          type: 'success',
          message: `Found student "${s.studentName}"! Reg No: ${s.boardRegNo || lookupRegNo.trim()}, demographics and photo loaded.`
        });
        showToast(`Auto-filled details for ${s.studentName}`, 'success');
      } else {
        setLookupFeedback({
          type: 'warn',
          message: res.message || 'No matching student record found. You can enter details manually below.'
        });
      }
    } catch (err) {
      setLookupFeedback({
        type: 'error',
        message: err.message || 'Database lookup failed.'
      });
    } finally {
      setLookupLoading(false);
    }
  };

  // Handle Custom Photo Upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file, 400, 480, 0.8);
      setFormData(prev => ({ ...prev, photoUrl: compressedDataUrl }));
      showToast('Student photograph processed & loaded.', 'success');
    } catch (err) {
      console.error('Photo upload error:', err);
      showToast('Could not compress photo.', 'error');
    }
  };

  // Open Create Modal
  const handleOpenCreate = (categoryPreset = 'jkbose') => {
    setEditingItem(null);
    setLookupFeedback(null);
    setLookupSession(getCurrentAcademicSession() || '2025-26');
    setLookupClass('12th');
    setLookupRegNo('');
    setFormData({
      title: '',
      category: categoryPreset || 'jkbose',
      studentName: '',
      fatherName: '',
      className: '12th',
      session: getCurrentAcademicSession() || '2025-26',
      stream: 'Science',
      boardRegNo: '',
      examRollNo: '',
      examOrEvent: categoryPreset === 'jkbose' ? 'JKBOSE Annual Regular' : '',
      scoreOrMarks: '',
      rankOrPosition: '',
      isUtPositionHolder: false,
      utPositionOrRank: '',
      institutionOrAward: '',
      badge: categoryPreset === 'jkbose' ? 'Board Distinction' : 'Honors',
      description: '',
      photoUrl: '',
      featured: false,
      published: true,
      order: 0,
      achievementDate: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setLookupFeedback(null);
    setLookupSession(item.session || getCurrentAcademicSession() || '2025-26');
    setLookupClass(item.className || '12th');
    setLookupRegNo(item.boardRegNo || item.examRollNo || '');
    setFormData({
      title: item.title || '',
      category: item.category || 'jkbose',
      studentName: item.studentName || '',
      fatherName: item.fatherName || '',
      className: item.className || '12th',
      session: item.session || getCurrentAcademicSession() || '2025-26',
      stream: item.stream || '',
      boardRegNo: item.boardRegNo || '',
      examRollNo: item.examRollNo || '',
      examOrEvent: item.examOrEvent || '',
      scoreOrMarks: item.scoreOrMarks || '',
      rankOrPosition: item.rankOrPosition || '',
      isUtPositionHolder: Boolean(item.isUtPositionHolder),
      utPositionOrRank: item.utPositionOrRank || '',
      institutionOrAward: item.institutionOrAward || '',
      badge: item.badge || '',
      description: item.description || '',
      photoUrl: item.photoUrl || '',
      featured: Boolean(item.featured),
      published: item.published !== false,
      order: Number(item.order) || 0,
      achievementDate: item.achievementDate || new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  // Quick 1-click toggle published status
  const handleTogglePublished = async (item) => {
    const nextState = !(item.published !== false);
    try {
      await toggleAchievementPublished(item.id, item.published !== false, userEmail);
      setAchievements(prev => prev.map(x => x.id === item.id ? { ...x, published: nextState } : x));
      showToast(nextState ? `"${item.studentName || item.title}" published live.` : `"${item.studentName || item.title}" moved to draft.`, 'info');
    } catch (err) {
      console.error('Toggle published error:', err);
      showToast('Could not update status.', 'error');
    }
  };

  // Quick 1-click toggle featured spotlight
  const handleToggleFeatured = async (item) => {
    const nextState = !Boolean(item.featured);
    try {
      await toggleAchievementFeatured(item.id, Boolean(item.featured), userEmail);
      setAchievements(prev => prev.map(x => x.id === item.id ? { ...x, featured: nextState } : x));
      showToast(nextState ? `Pinned "${item.studentName || item.title}" to Top Spotlight!` : `Unpinned from Top Spotlight.`, 'info');
    } catch (err) {
      console.error('Toggle featured error:', err);
      showToast('Could not update spotlight status.', 'error');
    }
  };

  // Handle Save
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Please enter an achievement title.', 'warning');
      return;
    }
    if (!formData.studentName.trim() && formData.category !== 'institutional') {
      showToast('Please enter the student name.', 'warning');
      return;
    }

    // Guard against creating duplicate achievements
    if (!editingItem) {
      const cleanName = (formData.studentName || '').trim().toLowerCase();
      const cleanTitle = (formData.title || '').trim().toLowerCase();
      const cleanReg = (formData.boardRegNo || '').trim().toLowerCase();

      const isDuplicate = achievements.some(a => {
        if (a.session !== formData.session) return false;
        if (cleanReg && a.boardRegNo && a.boardRegNo.trim().toLowerCase() === cleanReg && a.category === formData.category) {
          return true;
        }
        return a.studentName?.trim().toLowerCase() === cleanName && a.title?.trim().toLowerCase() === cleanTitle;
      });

      if (isDuplicate) {
        if (!window.confirm(`A similar achievement record for "${formData.studentName || formData.title}" (${formData.session}) already exists in the system. Do you want to continue creating this record?`)) {
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (editingItem) {
        await updateAchievement(editingItem.id, formData, userEmail);
        showToast('Achievement updated successfully in Firebase!', 'success');
      } else {
        await createAchievement(formData, userEmail);
        showToast('Achievement published successfully to Firebase!', 'success');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Save error:', err);
      showToast(err.message || 'Failed to save achievement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title || 'this achievement'}" from Firebase?`)) return;
    setDeletingId(id);
    try {
      await deleteAchievement(id, userEmail);
      showToast('Achievement removed permanently.', 'info');
      setAchievements(prev => prev.filter(x => x.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete achievement.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Available sessions in dataset
  const availableSessions = useMemo(() => {
    const set = new Set(['2025-26', '2024-25', '2023-24']);
    achievements.forEach(item => {
      if (item.session) set.add(item.session);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [achievements]);

  // Key metrics calculation
  const metrics = useMemo(() => {
    const total = achievements.length;
    const published = achievements.filter(x => x.published !== false).length;
    const utCount = achievements.filter(x => x.isUtPositionHolder).length;
    const featuredCount = achievements.filter(x => x.featured).length;

    const countByCategory = {};
    CATEGORIES.forEach(c => {
      countByCategory[c.id] = achievements.filter(x => x.category === c.id).length;
    });

    return { total, published, utCount, featuredCount, countByCategory };
  }, [achievements]);

  // Filtered List
  const filteredList = useMemo(() => {
    return achievements.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.studentName && item.studentName.toLowerCase().includes(q)) ||
        (item.fatherName && item.fatherName.toLowerCase().includes(q)) ||
        (item.boardRegNo && item.boardRegNo.toLowerCase().includes(q)) ||
        (item.examRollNo && item.examRollNo.toLowerCase().includes(q)) ||
        (item.examOrEvent && item.examOrEvent.toLowerCase().includes(q)) ||
        (item.institutionOrAward && item.institutionOrAward.toLowerCase().includes(q)) ||
        (item.rankOrPosition && item.rankOrPosition.toLowerCase().includes(q)) ||
        (item.utPositionOrRank && item.utPositionOrRank.toLowerCase().includes(q));

      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSession = sessionFilter === 'all' || item.session === sessionFilter;
      const matchesClass = classFilter === 'all' || item.className === classFilter;
      const matchesUt = !utOnly || Boolean(item.isUtPositionHolder);
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'published' && item.published !== false) ||
        (statusFilter === 'draft' && item.published === false);

      return matchesSearch && matchesCategory && matchesSession && matchesClass && matchesUt && matchesStatus;
    });
  }, [achievements, searchQuery, selectedCategory, sessionFilter, classFilter, utOnly, statusFilter]);

  // Grouped by Category for Classified View
  const classifiedSections = useMemo(() => {
    const categoriesToShow = selectedCategory === 'all'
      ? CATEGORIES
      : CATEGORIES.filter(c => c.id === selectedCategory);

    return categoriesToShow.map(cat => {
      const items = filteredList.filter(item => item.category === cat.id);
      return {
        category: cat,
        items
      };
    });
  }, [filteredList, selectedCategory]);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150 text-slate-800 dark:text-slate-100">
      {/* ── Sleek, Minimal, Space-Efficient Studio Command Bar ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Title & Micro-Metric Badges Inline */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Trophy size={14} />
              </span>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                School Achievements &amp; Merits Studio
              </h1>

              {/* Inline Micro Badges */}
              <div className="inline-flex items-center gap-1.5 ml-1 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {metrics.total} Honors
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  ⭐ {metrics.utCount} UT Positions
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                  🟢 {metrics.published} Live
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
              Classified management for JKBOSE Board Toppers, J&amp;K UT Position Holders, NEET/JEE Qualifiers, and Board Results.
            </p>
          </div>

          {/* Action Switcher Tabs & Primary Add Button */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end shrink-0 pt-1 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
            {/* Studio Navigation Tabs (Merits vs Board Results Table) */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveStudioTab('honors')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeStudioTab === 'honors'
                    ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Trophy size={13} />
                <span>Merits &amp; Honors ({metrics.total})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStudioTab('board_table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeStudioTab === 'board_table'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="View full JKBOSE Board Examination Results & Statistics Table"
              >
                <BarChart3 size={13} />
                <span>JKBOSE Results Table</span>
              </button>
            </div>

            {/* Primary Action Button */}
            {activeStudioTab === 'honors' && (
              <button
                type="button"
                onClick={() => handleOpenCreate('jkbose')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 active:scale-95 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Achievement</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TAB 1: Merits & Honors Studio (Classified CRUD) ── */}
      {activeStudioTab === 'honors' && (
        <div className="space-y-3">
          {/* ── Compact Category Pills Bar & View Switcher ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>All ({metrics.total})</span>
              </button>

              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const count = metrics.countByCategory?.[cat.id] || 0;
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Icon size={12} className={isSelected ? 'text-white' : 'text-slate-500'} />
                    <span>{cat.shortLabel}</span>
                    <span className={`px-1 rounded-full text-[9.5px] font-mono font-black ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <List size={13} />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('classified')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'classified'
                    ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
            </div>
          </div>

          {/* ── Compact Filter & Search Toolbar Strip ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate name, reg no, exam roll, rank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              >
                <option value="all">All Sessions</option>
                {availableSessions.map(s => (
                  <option key={s} value={s}>Session {s}</option>
                ))}
              </select>

              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              >
                <option value="all">All Classes</option>
                <option value="12th">Class 12th</option>
                <option value="11th">Class 11th</option>
                <option value="10th">Class 10th</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>

              <button
                type="button"
                onClick={() => setUtOnly(!utOnly)}
                className={`px-2 py-1 rounded-lg border font-black flex items-center gap-1 transition-all cursor-pointer text-xs ${
                  utOnly
                    ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                <Star size={11} className={utOnly ? 'fill-slate-950' : 'text-amber-500'} />
                <span>UT Positions</span>
              </button>
            </div>
          </div>

          {/* ── Content View: Compact Table vs Compact Cards ── */}
          {loading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400 space-y-2">
              <RefreshCw size={20} className="animate-spin mx-auto text-teal-600" />
              <p className="text-xs font-semibold">Loading achievements database from Firebase…</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
              <Trophy size={28} className="mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No achievements match your filters</p>
              <p className="text-xs text-slate-500">Click "+ Add Achievement" above or initialize default honors templates.</p>
              {achievements.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedDefaults}
                  disabled={seedingLoading}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  <span>Initialize Default Honors Templates</span>
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* ── COMPACT MASTER TABLE VIEW ── */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">Candidate &amp; Demographics</th>
                      <th className="py-2.5 px-3">Board Reg No</th>
                      <th className="py-2.5 px-3">Achievement Headline</th>
                      <th className="py-2.5 px-3">Score &amp; Position</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                    {filteredList.map((item, idx) => {
                      const catConfig = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
                      const CatIcon = catConfig.icon;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                        >
                          {/* S.No */}
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Candidate & Demographics */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2.5">
                              <HonoreePhotoAvatar item={item} size="sm" showBadge={false} />
                              <div className="min-w-0">
                                <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1 text-[12px] truncate">
                                  <span>{item.studentName || item.title}</span>
                                  {item.featured && (
                                    <Star size={10} className="fill-amber-500 text-amber-500 shrink-0" />
                                  )}
                                </div>
                                {item.fatherName && (
                                  <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                                    S/D of {item.fatherName}
                                  </div>
                                )}
                                <div className="text-[10px] text-teal-700 dark:text-teal-400 font-bold">
                                  Class {item.className} {item.stream ? `(${item.stream})` : ''} • Session {item.session}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Board Reg No */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            {item.boardRegNo ? (
                              <div className="font-mono font-extrabold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10.5px] inline-block">
                                {item.boardRegNo}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">—</span>
                            )}
                            {item.examRollNo && (
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                Roll: {item.examRollNo}
                              </div>
                            )}
                          </td>

                          {/* Headline & Category */}
                          <td className="py-2 px-3 max-w-xs">
                            <div className="font-black text-slate-900 dark:text-white line-clamp-1 text-[11.5px]">
                              {item.title}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                              <CatIcon size={10} className="text-slate-400" />
                              <span>{catConfig.shortLabel}</span>
                              {item.examOrEvent && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{item.examOrEvent}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Score / Rank */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            {item.scoreOrMarks && (
                              <div className="font-mono font-black text-slate-900 dark:text-white text-[11px]">
                                {item.scoreOrMarks}
                              </div>
                            )}
                            {(item.utPositionOrRank || item.rankOrPosition) && (
                              <div className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                <Trophy size={10} className="text-amber-600" />
                                <span>{item.utPositionOrRank || item.rankOrPosition}</span>
                              </div>
                            )}
                          </td>

                          {/* Status & Live Toggle */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleTogglePublished(item)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer transition-colors ${
                                item.published !== false
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300'
                              }`}
                              title="Click to toggle Live / Draft status"
                            >
                              {item.published !== false ? <CheckCircle2 size={10} /> : null}
                              <span>{item.published !== false ? 'Live' : 'Draft'}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleFeatured(item)}
                                className={`p-1 rounded-md border transition-colors cursor-pointer ${
                                  item.featured
                                    ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700'
                                    : 'text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                                title={item.featured ? 'Pinned in Spotlight' : 'Pin to Spotlight'}
                              >
                                <Star size={12} className={item.featured ? 'fill-amber-500' : ''} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                                title="Edit Achievement"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === item.id}
                                onClick={() => handleDelete(item.id, item.studentName || item.title)}
                                className="p-1 rounded-md border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 cursor-pointer disabled:opacity-40"
                                title="Delete Achievement"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── COMPACT CLASSIFIED CARDS VIEW ── */
            <div className="space-y-4">
              {classifiedSections.map(({ category, items }) => {
                if (items.length === 0) return null;
                const CatIcon = category.icon;

                return (
                  <div
                    key={category.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-2xs"
                  >
                    {/* Compact Category Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border ${category.color}`}>
                          <CatIcon size={14} />
                        </div>
                        <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                          {category.label}
                        </h2>
                        <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-black font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {items.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenCreate(category.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 hover:border-teal-400 transition-all flex flex-col justify-between space-y-2"
                        >
                          {/* Card Header & Controls */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              {item.session && (
                                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                  {item.session}
                                </span>
                              )}
                              {item.className && (
                                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                  {item.className}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleFeatured(item)}
                                className={`p-1 rounded cursor-pointer ${
                                  item.featured ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
                                }`}
                                title="Spotlight toggle"
                              >
                                <Star size={11} className={item.featured ? 'fill-amber-500' : ''} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTogglePublished(item)}
                                className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider border cursor-pointer ${
                                  item.published !== false
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-slate-100 text-slate-500 border-slate-300'
                                }`}
                              >
                                {item.published !== false ? 'Live' : 'Draft'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === item.id}
                                onClick={() => handleDelete(item.id, item.studentName || item.title)}
                                className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer disabled:opacity-40"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Identity & Reg No */}
                          <div className="flex items-center gap-2">
                            <HonoreePhotoAvatar item={item} size="sm" showBadge={false} />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {item.studentName || 'Honoree'}
                              </h3>
                              {item.boardRegNo && (
                                <span className="font-mono text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300">
                                  Reg: {item.boardRegNo}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title & Score */}
                          <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <h4 className="font-bold text-[11px] text-slate-800 dark:text-slate-200 line-clamp-1">
                              {item.title}
                            </h4>
                            <div className="flex items-center justify-between text-[10px] mt-1">
                              <span className="font-mono font-black text-slate-900 dark:text-white">
                                {item.scoreOrMarks || '—'}
                              </span>
                              {(item.utPositionOrRank || item.rankOrPosition) && (
                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                  🏆 {item.utPositionOrRank || item.rankOrPosition}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: JKBOSE Board Results & Examination Table ── */}
      {activeStudioTab === 'board_table' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <BarChart3 size={15} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    JKBOSE Class Board Examination Results Table
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Session-wise examination outcomes, overall school statistics, pass percentages, and toppers merit ledger.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveStudioTab('honors')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <span>Switch to Merits &amp; Honors</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {/* Embedded ClassBoardResultsSection */}
            <div className="pt-1">
              <ClassBoardResultsSection
                defaultClass="12th"
                isEditable={true}
                userEmail={userEmail || user?.email || 'admin'}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Achievement Modal with Student Database Auto-Lookup ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3.5 my-auto max-h-[92vh] overflow-y-auto text-xs text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <Trophy size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {editingItem ? 'Edit Achievement Record' : 'Add New School Achievement'}
                  </h3>
                  <p className="text-[10.5px] text-slate-400 font-medium">
                    Lookup student by Board Reg No &amp; Session, or enter details manually.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Student Database Auto-Lookup Box */}
            <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1">
                  <Search size={11} />
                  <span>Student Auto-Lookup from Database</span>
                </span>
                <span className="text-[9.5px] text-teal-600 dark:text-teal-400 font-bold">
                  Admissions &amp; Master Registers
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-3">
                  <select
                    value={lookupSession}
                    onChange={(e) => setLookupSession(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                  >
                    <option value="2025-26">2025-26</option>
                    <option value="2024-25">2024-25</option>
                    <option value="2023-24">2023-24</option>
                    <option value="all">Any Session</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={lookupClass}
                    onChange={(e) => setLookupClass(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                  >
                    <option value="12th">Class 12th</option>
                    <option value="11th">Class 11th</option>
                    <option value="10th">Class 10th</option>
                    <option value="all">Any Class</option>
                  </select>
                </div>

                <div className="sm:col-span-6 flex gap-1">
                  <input
                    type="text"
                    placeholder="Enter Board Reg No or Roll No"
                    value={lookupRegNo}
                    onChange={(e) => setLookupRegNo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFastLookup(); } }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                  />
                  <button
                    type="button"
                    disabled={lookupLoading}
                    onClick={handleFastLookup}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {lookupLoading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
                    <span>Fetch</span>
                  </button>
                </div>
              </div>

              {lookupFeedback && (
                <div className={`p-2 rounded-lg text-[10.5px] font-semibold border flex items-center gap-1.5 ${
                  lookupFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                    : lookupFeedback.type === 'warn'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 text-amber-800 dark:text-amber-300'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-800 dark:text-rose-300'
                }`}>
                  {lookupFeedback.type === 'success' ? <Check size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
                  <span>{lookupFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Achievement Form */}
            <form onSubmit={handleSave} className="space-y-3">
              {/* Photo & Candidate Identity Section */}
              <div className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                {/* Photo Preview & Custom Upload */}
                <div className="relative group w-20 h-24 rounded-xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden shrink-0 mx-auto sm:mx-0">
                  {formData.photoUrl && formData.photoUrl !== '/logo.png' && formData.photoUrl.length > 20 ? (
                    <img
                      src={formData.photoUrl}
                      alt="Student"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-slate-400 p-1">
                      <Camera size={18} className="mx-auto mb-0.5" />
                      <span className="text-[8.5px] font-bold block">No Photo</span>
                    </div>
                  )}

                  <label className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer text-center p-1 text-[9px] font-bold">
                    <Upload size={12} className="mb-0.5 text-teal-400" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Candidate Demographics Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Student's Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Candidate full name"
                      value={formData.studentName}
                      onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-extrabold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Father's Name</label>
                    <input
                      type="text"
                      placeholder="Parentage"
                      value={formData.fatherName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300 mb-0.5 flex items-center gap-0.5">
                      <Hash size={10} />
                      <span>Board Registration No. (Reg No)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2201010001160068"
                      value={formData.boardRegNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, boardRegNo: e.target.value }))}
                      className="w-full px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Exam Roll No / Class Roll</label>
                    <input
                      type="text"
                      placeholder="e.g. 301003054"
                      value={formData.examRollNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, examRollNo: e.target.value }))}
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Class</label>
                    <select
                      value={formData.className}
                      onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value }))}
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="12th">Class 12th</option>
                      <option value="11th">Class 11th</option>
                      <option value="10th">Class 10th</option>
                      <option value="Alumni">Alumni / Past Cohorts</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Academic Session</label>
                    <input
                      type="text"
                      placeholder="e.g. 2024-25"
                      value={formData.session}
                      onChange={(e) => setFormData(prev => ({ ...prev, session: e.target.value }))}
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Stream / Faculty</label>
                    <input
                      type="text"
                      placeholder="e.g. Science (Medical), Science (Non-Medical), Humanities"
                      value={formData.stream}
                      onChange={(e) => setFormData(prev => ({ ...prev, stream: e.target.value }))}
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Achievement Specification Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Achievement Headline *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JKBOSE Class 12th Science — J&K UT 8th Position"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-black text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Exam / Tournament / Event</label>
                  <input
                    type="text"
                    placeholder="e.g. JKBOSE Class 12th Regular (Oct-Nov) or NTA NEET-UG"
                    value={formData.examOrEvent}
                    onChange={(e) => setFormData(prev => ({ ...prev, examOrEvent: e.target.value }))}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Score / Percentage / Marks</label>
                  <input
                    type="text"
                    placeholder="e.g. 493 / 500 (98.6%) or 690 / 720"
                    value={formData.scoreOrMarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, scoreOrMarks: e.target.value }))}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">General Rank / Distinction</label>
                  <input
                    type="text"
                    placeholder="e.g. 8th Position in UT of J&K or AIR 124"
                    value={formData.rankOrPosition}
                    onChange={(e) => setFormData(prev => ({ ...prev, rankOrPosition: e.target.value }))}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {/* UT Position Highlight Box */}
                <div className="sm:col-span-2 p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 space-y-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isUtPositionHolder}
                      onChange={(e) => setFormData(prev => ({ ...prev, isUtPositionHolder: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-black text-amber-900 dark:text-amber-200 text-[10.5px] flex items-center gap-1">
                      <Star size={11} className="fill-amber-600 text-amber-600" />
                      Candidate holds a top rank or official merit position in Jammu &amp; Kashmir UT
                    </span>
                  </label>

                  {formData.isUtPositionHolder && (
                    <div>
                      <input
                        type="text"
                        placeholder="e.g. 8th Position in UT of J&K or UT Rank 1"
                        value={formData.utPositionOrRank}
                        onChange={(e) => setFormData(prev => ({ ...prev, utPositionOrRank: e.target.value }))}
                        className="w-full px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-black text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Selected College / Allotted Award</label>
                  <input
                    type="text"
                    placeholder="e.g. GMC Srinagar (MBBS) or Govt. HSS Shangus"
                    value={formData.institutionOrAward}
                    onChange={(e) => setFormData(prev => ({ ...prev, institutionOrAward: e.target.value }))}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Card Badge Ribbon</label>
                  <input
                    type="text"
                    placeholder="e.g. UT 8th Position, NEET Selection"
                    value={formData.badge}
                    onChange={(e) => setFormData(prev => ({ ...prev, badge: e.target.value }))}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-0.5">Story / Citation / Narrative</label>
                  <textarea
                    rows={2}
                    placeholder="Share the student's journey, words of inspiration, or institutional remarks..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                  />
                </div>

                {/* Toggles */}
                <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span>Pin to Top Spotlight</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.published}
                      onChange={(e) => setFormData(prev => ({ ...prev, published: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Published (Visible Live)</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-white font-black shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>{editingItem ? 'Update Record' : 'Save Record'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
