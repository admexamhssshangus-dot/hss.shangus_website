import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trophy, Award, Star, Search, Plus, Edit3, Trash2, CheckCircle2,
  XCircle, Filter, Eye, RefreshCw, Upload, Camera, ExternalLink,
  ChevronDown, AlertTriangle, ShieldCheck, Sparkles, Building2,
  GraduationCap, Medal, User, FileText, Check, ArrowLeft
} from 'lucide-react';
import {
  fetchAllAchievementsAdmin,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  lookupStudentForAchievement
} from '../../services/achievementsService';
import { getCurrentAcademicSession } from '../../services/dbCache';
import { compressImageFile } from '../../utils/imageCompressor';
import { showToast } from '../../components/common/GlobalToast';

const CATEGORIES = [
  { id: 'jkbose', label: 'JKBOSE Board Results', icon: Award, color: 'text-teal-700 bg-teal-50 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300' },
  { id: 'competitive', label: 'NEET / JEE / Competitive', icon: Trophy, color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: 'sports', label: 'Sports & Athletics', icon: Medal, color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300' },
  { id: 'cocurricular', label: 'Co-Curricular & Arts', icon: Sparkles, color: 'text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300' },
  { id: 'institutional', label: 'Institutional Honors', icon: Building2, color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300' }
];

export default function AchievementsCMSManager({ user, userEmail = 'admin', onClose }) {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [utOnly, setUtOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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

  // Fast-Lookup State
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllAchievementsAdmin();
      setAchievements(data);
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

  // Handle Fast Lookup Trigger
  const handleFastLookup = async () => {
    setLookupLoading(true);
    setLookupFeedback(null);
    try {
      const res = await lookupStudentForAchievement({
        session: formData.session,
        className: formData.className,
        boardRegNo: formData.boardRegNo,
        rollNo: formData.examRollNo,
        studentName: formData.studentName
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
          boardRegNo: s.boardRegNo || prev.boardRegNo,
          photoUrl: s.photoUrl || prev.photoUrl
        }));
        setLookupFeedback({
          type: 'success',
          message: `Found record for ${s.studentName}! Demographics & photo auto-filled.`
        });
        showToast(`Auto-filled details for ${s.studentName}`, 'success');
      } else {
        setLookupFeedback({
          type: 'warn',
          message: res.message || 'No matching student record found. You can enter details manually.'
        });
      }
    } catch (err) {
      setLookupFeedback({
        type: 'error',
        message: err.message || 'Lookup failed.'
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
  const handleOpenCreate = () => {
    setEditingItem(null);
    setLookupFeedback(null);
    setFormData({
      title: '',
      category: 'jkbose',
      studentName: '',
      fatherName: '',
      className: '12th',
      session: getCurrentAcademicSession() || '2025-26',
      stream: 'Science',
      boardRegNo: '',
      examRollNo: '',
      examOrEvent: 'JKBOSE Annual Regular',
      scoreOrMarks: '',
      rankOrPosition: '',
      isUtPositionHolder: false,
      utPositionOrRank: '',
      institutionOrAward: '',
      badge: 'Board Distinction',
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

    setSaving(true);
    try {
      if (editingItem) {
        await updateAchievement(editingItem.id, formData, userEmail);
        showToast('Achievement updated successfully!', 'success');
      } else {
        await createAchievement(formData, userEmail);
        showToast('Achievement published successfully!', 'success');
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
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this achievement?')) return;
    setDeletingId(id);
    try {
      await deleteAchievement(id, userEmail);
      showToast('Achievement removed.', 'info');
      setAchievements(prev => prev.filter(x => x.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete achievement.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return achievements.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.studentName && item.studentName.toLowerCase().includes(q)) ||
        (item.boardRegNo && item.boardRegNo.toLowerCase().includes(q)) ||
        (item.examOrEvent && item.examOrEvent.toLowerCase().includes(q)) ||
        (item.institutionOrAward && item.institutionOrAward.toLowerCase().includes(q));

      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesUt = !utOnly || Boolean(item.isUtPositionHolder);
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'published' && item.published !== false) ||
        (statusFilter === 'draft' && item.published === false);

      return matchesSearch && matchesCategory && matchesUt && matchesStatus;
    });
  }, [achievements, searchQuery, selectedCategory, utOnly, statusFilter]);

  // Key metrics
  const metrics = useMemo(() => {
    const total = achievements.length;
    const published = achievements.filter(x => x.published !== false).length;
    const utCount = achievements.filter(x => x.isUtPositionHolder).length;
    const featuredCount = achievements.filter(x => x.featured).length;
    return { total, published, utCount, featuredCount };
  }, [achievements]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <Trophy size={11} className="text-amber-600 animate-pulse" />
              <span>Public Hall of Fame CMS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              School Achievements &amp; Merits Studio
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Manage JKBOSE Board Toppers, J&amp;K UT Position Holders, NEET/JEE Qualifiers, and Athletic Honors displayed at <span className="font-mono text-teal-600 dark:text-teal-400">/achievements</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to Records</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Achievement</span>
            </button>
          </div>
        </div>

        {/* Counter Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Achievements</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">{metrics.total}</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">🌟 UT Position Holders</span>
            <span className="text-xl font-black text-amber-900 dark:text-amber-200">{metrics.utCount}</span>
          </div>
          <div className="p-3 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 block">Live Published</span>
            <span className="text-xl font-black text-teal-900 dark:text-teal-200">{metrics.published}</span>
          </div>
          <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block">Spotlight Featured</span>
            <span className="text-xl font-black text-purple-900 dark:text-purple-200">{metrics.featuredCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate name, reg no, event, rank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published Only</option>
            <option value="draft">Drafts Only</option>
          </select>

          {/* UT Position Filter Button */}
          <button
            type="button"
            onClick={() => setUtOnly(!utOnly)}
            className={`px-3 py-2 rounded-xl border font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              utOnly
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <Star size={13} className={utOnly ? 'fill-slate-950' : 'text-amber-500'} />
            <span>UT Positions</span>
          </button>
        </div>
      </div>

      {/* Achievements Table List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <RefreshCw size={24} className="animate-spin mx-auto text-teal-600" />
            <p className="text-xs font-semibold">Loading achievements database…</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <Trophy size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No achievements match your filters</p>
            <p className="text-xs">Click "Add Achievement" above to create the first record.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">Candidate / Demographics</th>
                  <th className="py-3 px-4">Achievement Headline</th>
                  <th className="py-3 px-4">Event / Examination</th>
                  <th className="py-3 px-4">Score &amp; Position</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {filteredList.map((item, idx) => {
                  const catConfig = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
                  const CatIcon = catConfig.icon;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* S.No */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Candidate & Photo */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                            {item.photoUrl && item.photoUrl !== '/logo.png' && item.photoUrl.length > 20 ? (
                              <img
                                src={item.photoUrl}
                                alt={item.studentName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User size={16} className="text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                              <span>{item.studentName || 'Institutional'}</span>
                              {item.isUtPositionHolder && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5">
                                  <Star size={9} className="fill-amber-600 text-amber-600" />
                                  <span>UT POSITION</span>
                                </span>
                              )}
                              {item.featured && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                  FEATURED
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-500 font-medium truncate flex items-center gap-1.5 mt-0.5">
                              {item.className && <span>Class {item.className}</span>}
                              {item.session && <span>• {item.session}</span>}
                              {item.boardRegNo && <span className="font-mono text-slate-400">• Reg: {item.boardRegNo}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Headline & Category */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-800 dark:text-slate-200 leading-snug">
                          {item.title}
                        </div>
                        <div className="mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${catConfig.color}`}>
                            <CatIcon size={10} />
                            <span>{catConfig.label}</span>
                          </span>
                        </div>
                      </td>

                      {/* Event / Examination */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {item.examOrEvent || '—'}
                        </div>
                        {item.institutionOrAward && (
                          <div className="text-[10px] text-teal-600 dark:text-teal-400 font-bold truncate mt-0.5">
                            {item.institutionOrAward}
                          </div>
                        )}
                      </td>

                      {/* Score / Rank */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.scoreOrMarks && (
                          <div className="font-black text-slate-900 dark:text-white font-mono">
                            {item.scoreOrMarks}
                          </div>
                        )}
                        {(item.utPositionOrRank || item.rankOrPosition) && (
                          <div className="text-[10.5px] font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                            <Trophy size={11} className="text-amber-600" />
                            <span>{item.utPositionOrRank || item.rankOrPosition}</span>
                          </div>
                        )}
                      </td>

                      {/* Published State */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {item.published !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 size={10} />
                            <span>Live</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                            title="Edit Achievement"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 cursor-pointer transition-colors disabled:opacity-40"
                            title="Delete Achievement"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 space-y-5 my-auto max-h-[92vh] overflow-y-auto text-xs text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <Trophy size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingItem ? 'Edit Achievement Record' : 'Add New School Achievement'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Configure honors, auto-fetch student data by Board Registration No, and publish.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Fast-Lookup Box */}
            <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <Search size={12} />
                  <span>Student Auto-Lookup &amp; Photo Fetch</span>
                </span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                  Session: {formData.session}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Target Class</label>
                  <select
                    value={formData.className}
                    onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="12th">Class 12th</option>
                    <option value="11th">Class 11th</option>
                    <option value="10th">Class 10th</option>
                    <option value="Alumni">Alumni / Past Cohorts</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Board Registration No.</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. 21-2401-0084 or Roll No"
                      value={formData.boardRegNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, boardRegNo: e.target.value }))}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      disabled={lookupLoading}
                      onClick={handleFastLookup}
                      className="px-3 py-1.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {lookupLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                      <span>Fetch</span>
                    </button>
                  </div>
                </div>
              </div>

              {lookupFeedback && (
                <div className={`p-2.5 rounded-xl text-[11px] font-semibold border flex items-center gap-2 ${
                  lookupFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                    : lookupFeedback.type === 'warn'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 text-amber-800 dark:text-amber-300'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-800 dark:text-rose-300'
                }`}>
                  {lookupFeedback.type === 'success' ? <Check size={13} /> : <AlertTriangle size={13} />}
                  <span>{lookupFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Achievement Form */}
            <form onSubmit={handleSave} className="space-y-4">
              {/* Photo & Core Identity Grid */}
              <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                {/* Photo Preview & Custom Upload */}
                <div className="relative group w-24 h-28 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden shrink-0 mx-auto sm:mx-0">
                  {formData.photoUrl && formData.photoUrl !== '/logo.png' && formData.photoUrl.length > 20 ? (
                    <img
                      src={formData.photoUrl}
                      alt="Student"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-slate-400 p-2">
                      <Camera size={20} className="mx-auto mb-1" />
                      <span className="text-[9px] font-bold block">No Photo</span>
                    </div>
                  )}

                  <label className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer text-center p-1 text-[9.5px] font-bold">
                    <Upload size={14} className="mb-0.5 text-teal-400" />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Student's Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Candidate full name"
                      value={formData.studentName}
                      onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-extrabold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Father's Name</label>
                    <input
                      type="text"
                      placeholder="Parentage"
                      value={formData.fatherName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Stream / Cohort</label>
                    <input
                      type="text"
                      placeholder="e.g. Medical, Non-Medical, Arts"
                      value={formData.stream}
                      onChange={(e) => setFormData(prev => ({ ...prev, stream: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Academic Session</label>
                    <input
                      type="text"
                      placeholder="e.g. 2025-26"
                      value={formData.session}
                      onChange={(e) => setFormData(prev => ({ ...prev, session: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Achievement Specification Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Achievement Headline *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NEET-UG 2025 Qualifier — Selected for GMC Srinagar"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-black text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Exam / Tournament / Event</label>
                  <input
                    type="text"
                    placeholder="e.g. NEET UG 2025 or JKBOSE Class 12th"
                    value={formData.examOrEvent}
                    onChange={(e) => setFormData(prev => ({ ...prev, examOrEvent: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Score / Percentage / Marks</label>
                  <input
                    type="text"
                    placeholder="e.g. 645 / 720 or 488 / 500 (97.6%)"
                    value={formData.scoreOrMarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, scoreOrMarks: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">General Rank / Distinction</label>
                  <input
                    type="text"
                    placeholder="e.g. AIR 3,420 or District 1st Position"
                    value={formData.rankOrPosition}
                    onChange={(e) => setFormData(prev => ({ ...prev, rankOrPosition: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* UT Position Highlight Box */}
                <div className="sm:col-span-2 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isUtPositionHolder}
                      onChange={(e) => setFormData(prev => ({ ...prev, isUtPositionHolder: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-black text-amber-900 dark:text-amber-200 text-[11.5px] flex items-center gap-1">
                      <Star size={13} className="fill-amber-600 text-amber-600" />
                      Candidate holds a top performance / official position in Jammu &amp; Kashmir UT
                    </span>
                  </label>

                  {formData.isUtPositionHolder && (
                    <div className="pt-1">
                      <label className="block text-[10px] font-bold text-amber-800 dark:text-amber-300 mb-1">
                        Specific UT Position / State Rank
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1st Position in J&K UT or Top 10 in UT"
                        value={formData.utPositionOrRank}
                        onChange={(e) => setFormData(prev => ({ ...prev, utPositionOrRank: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-black text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Selected College / Allotted Award</label>
                  <input
                    type="text"
                    placeholder="e.g. GMC Srinagar (MBBS) or NIT Srinagar"
                    value={formData.institutionOrAward}
                    onChange={(e) => setFormData(prev => ({ ...prev, institutionOrAward: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Card Badge Ribbon</label>
                  <input
                    type="text"
                    placeholder="e.g. Board Topper, Gold Medalist, NEET Selection"
                    value={formData.badge}
                    onChange={(e) => setFormData(prev => ({ ...prev, badge: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Story / Citation / Narrative</label>
                  <textarea
                    rows={3}
                    placeholder="Share the student's journey, words of inspiration, or institutional remarks..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Toggles */}
                <div className="sm:col-span-2 flex flex-wrap items-center gap-6 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span>Pin to Top Spotlight (Hall of Fame)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.published}
                      onChange={(e) => setFormData(prev => ({ ...prev, published: e.target.checked }))}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Published (Visible on Public Website)</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-teal-800 hover:bg-teal-700 text-white font-black shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving Record...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>{editingItem ? 'Update Achievement' : 'Publish Achievement'}</span>
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
