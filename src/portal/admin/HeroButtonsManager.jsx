import React, { useState, useEffect } from 'react';
import {
  ExternalLink, Plus, Trash2, Edit2, ArrowUp, ArrowDown, Eye, EyeOff,
  Check, X, Sparkles, Copy, RotateCcw, AlertCircle, CheckCircle2,
  Save, Link2, Info, Compass, HelpCircle, Palette, RefreshCw
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { DEFAULT_HERO_BUTTONS } from '../../utils/settingsLoader';
import ConfirmModal from '../components/ConfirmModal';

const BUTTON_STYLES = [
  { id: 'primary', name: 'Brand Primary', desc: 'Teal/Cyan base, School Red on hover', previewColor: 'bg-teal-600 text-white' },
  { id: 'secondary', name: 'Dark Slate Glass', desc: 'Sleek dark translucent slate', previewColor: 'bg-slate-800 text-white border border-slate-600' },
  { id: 'amber', name: 'Vibrant Amber', desc: 'Warm golden yellow for high attention', previewColor: 'bg-amber-600 text-white' },
  { id: 'blue', name: 'Royal Blue', desc: 'Professional education blue', previewColor: 'bg-blue-600 text-white' },
  { id: 'purple', name: 'Imperial Purple', desc: 'Modern vibrant purple accent', previewColor: 'bg-purple-600 text-white' },
  { id: 'emerald', name: 'Emerald Green', desc: 'Verified / active success green', previewColor: 'bg-emerald-600 text-white' },
  { id: 'outline', name: 'Glassmorphic Outline', desc: 'Translucent frosted glass with border', previewColor: 'bg-slate-900/60 text-white border border-white/60' },
];

const COMMON_PAGE_PRESETS = [
  { label: 'Admissions Open 2026', link: '/admissions', style: 'primary', trackAdmissionStatus: true, closedLabel: 'Admissions Closed', openInNewTab: false },
  { label: 'Pre-board Results 2026', link: '/results', style: 'amber', trackAdmissionStatus: false, closedLabel: 'Results Announced', openInNewTab: false },
  { label: 'Learn More', link: '/about', style: 'secondary', trackAdmissionStatus: false, closedLabel: 'Learn More', openInNewTab: false },
  { label: 'Notice Board', link: '/notices', style: 'amber', trackAdmissionStatus: false, closedLabel: 'Notice Board', openInNewTab: false },
  { label: 'Fee Structure', link: '/fee', style: 'blue', trackAdmissionStatus: false, closedLabel: 'Fee Structure', openInNewTab: false },
  { label: 'Student Portal', link: '/portal/student', style: 'purple', trackAdmissionStatus: false, closedLabel: 'Student Portal', openInNewTab: false },
  { label: 'Staff Portal', link: '/portal/staff', style: 'emerald', trackAdmissionStatus: false, closedLabel: 'Staff Portal', openInNewTab: false },
  { label: 'Photo Gallery', link: '/gallery', style: 'outline', trackAdmissionStatus: false, closedLabel: 'Photo Gallery', openInNewTab: false },
  { label: 'Contact Us', link: '/contact', style: 'secondary', trackAdmissionStatus: false, closedLabel: 'Contact Us', openInNewTab: false },
];

const EMPTY_FORM = {
  id: '',
  label: '',
  closedLabel: 'Admissions Closed',
  link: '',
  style: 'primary',
  enabled: true,
  openInNewTab: false,
  trackAdmissionStatus: false,
};

export default function HeroButtonsManager({
  settings = {},
  onUpdateSettings = () => {},
  onSaveLive = null,
  embedded = false
}) {
  const initialButtons = Array.isArray(settings?.heroButtons) && settings.heroButtons.length > 0
    ? settings.heroButtons
    : DEFAULT_HERO_BUTTONS;

  const [buttons, setButtons] = useState(initialButtons);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [simulateClosed, setSimulateClosed] = useState(Boolean(settings?.globalAdmissionsClosed));
  const [feedback, setFeedback] = useState(null);
  const [savingLive, setSavingLive] = useState(false);
  const [testNotification, setTestNotification] = useState(null);

  // Synchronize when settings change externally
  useEffect(() => {
    if (Array.isArray(settings?.heroButtons)) {
      setButtons(settings.heroButtons);
    }
  }, [settings?.heroButtons]);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCommitButtons = (newButtonsList) => {
    setButtons(newButtonsList);
    onUpdateSettings({
      ...settings,
      heroButtons: newButtonsList
    });
  };

  // Direct 1-click cloud sync
  const handleSaveDirectToCloud = async () => {
    setSavingLive(true);
    try {
      if (onSaveLive) {
        await onSaveLive();
        showFeedback('success', 'Hero buttons saved and published live!');
      } else {
        const updatedSettings = {
          ...settings,
          heroButtons: buttons
        };
        await setDoc(doc(db, 'site', 'settings'), { heroButtons: buttons }, { merge: true });
        localStorage.setItem('site_settings', JSON.stringify(updatedSettings));
        try {
          const channel = new BroadcastChannel('hss_data_sync');
          channel.postMessage({ type: 'UPDATE_DATA' });
          channel.close();
        } catch (_) {}
        showFeedback('success', 'Hero action buttons saved live to Cloud Firestore!');
      }
    } catch (err) {
      console.error('Error saving hero buttons:', err);
      showFeedback('error', 'Failed to save to cloud: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingLive(false);
    }
  };

  // Open Edit Mode
  const handleStartEdit = (btn) => {
    setFormData({
      id: btn.id || `btn-${Date.now()}`,
      label: btn.label || '',
      closedLabel: btn.closedLabel || 'Admissions Closed',
      link: btn.link || '',
      style: btn.style || 'primary',
      enabled: btn.enabled !== false,
      openInNewTab: Boolean(btn.openInNewTab),
      trackAdmissionStatus: Boolean(btn.trackAdmissionStatus),
    });
    setEditingId(btn.id);
    setShowAddForm(false);
    setFormErrors({});
  };

  // Open Add Mode
  const handleStartAdd = () => {
    setFormData({
      ...EMPTY_FORM,
      id: `btn-${Date.now()}`,
    });
    setEditingId(null);
    setShowAddForm(true);
    setFormErrors({});
  };

  const handleCancelForm = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData(EMPTY_FORM);
    setFormErrors({});
  };

  // Validate and submit Add / Edit
  const handleSubmitForm = (e) => {
    if (e) e.preventDefault();
    const errors = {};
    if (!formData.label || !formData.label.trim()) {
      errors.label = 'Button label is required';
    }
    if (!formData.link || !formData.link.trim()) {
      errors.link = 'Button target link/URL is required';
    }
    if (formData.trackAdmissionStatus && (!formData.closedLabel || !formData.closedLabel.trim())) {
      errors.closedLabel = 'Please specify label when admissions are closed';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const sanitizedButton = {
      id: formData.id || `btn-${Date.now()}`,
      label: formData.label.trim(),
      closedLabel: formData.closedLabel?.trim() || 'Admissions Closed',
      link: formData.link.trim(),
      style: formData.style || 'primary',
      enabled: Boolean(formData.enabled),
      openInNewTab: Boolean(formData.openInNewTab),
      trackAdmissionStatus: Boolean(formData.trackAdmissionStatus),
    };

    let updatedList;
    if (editingId) {
      updatedList = buttons.map(b => b.id === editingId ? sanitizedButton : b);
      showFeedback('success', `Button "${sanitizedButton.label}" updated.`);
    } else {
      updatedList = [...buttons, sanitizedButton];
      showFeedback('success', `New button "${sanitizedButton.label}" added to homepage.`);
    }

    handleCommitButtons(updatedList);
    handleCancelForm();
  };

  // Delete button
  const handleDeleteButton = (btnId) => {
    const updatedList = buttons.filter(b => b.id !== btnId);
    handleCommitButtons(updatedList);
    setDeleteConfirmId(null);
    if (editingId === btnId) handleCancelForm();
    showFeedback('success', 'Button removed from homepage.');
  };

  // Toggle button visibility (Eye / EyeOff)
  const handleToggleEnabled = (btnId) => {
    const updatedList = buttons.map(b => {
      if (b.id === btnId) {
        return { ...b, enabled: b.enabled === false ? true : false };
      }
      return b;
    });
    handleCommitButtons(updatedList);
  };

  // Reorder buttons (Move Up / Move Down)
  const handleMoveButton = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= buttons.length) return;
    const newButtons = [...buttons];
    const temp = newButtons[index];
    newButtons[index] = newButtons[targetIndex];
    newButtons[targetIndex] = temp;
    handleCommitButtons(newButtons);
  };

  // Duplicate button
  const handleDuplicateButton = (btn) => {
    const duplicated = {
      ...btn,
      id: `btn-${Date.now()}`,
      label: `${btn.label} (Copy)`
    };
    const updatedList = [...buttons, duplicated];
    handleCommitButtons(updatedList);
    showFeedback('success', `Duplicated button "${btn.label}".`);
  };

  // Reset to default buttons
  const handleResetDefaults = () => {
    setShowResetConfirm(true);
  };

  const executeResetDefaults = () => {
    setShowResetConfirm(false);
    handleCommitButtons(DEFAULT_HERO_BUTTONS);
    handleCancelForm();
    showFeedback('success', 'Reset buttons to standard defaults.');
  };

  // Apply Preset
  const handleApplyPreset = (preset) => {
    setFormData(prev => ({
      ...prev,
      label: prev.label && prev.label.trim() ? prev.label : preset.label,
      link: preset.link,
      style: preset.style,
      trackAdmissionStatus: preset.trackAdmissionStatus,
      closedLabel: preset.closedLabel || prev.closedLabel,
      openInNewTab: preset.openInNewTab
    }));
    setFormErrors(prev => ({ ...prev, link: undefined, label: undefined }));
  };

  // Test Link Click
  const handleTestLink = (btn) => {
    const isAdmissionsClosed = Boolean(btn.trackAdmissionStatus && simulateClosed);
    const displayText = isAdmissionsClosed ? (btn.closedLabel || 'Admissions Closed') : btn.label;
    setTestNotification({
      title: displayText,
      link: btn.link,
      newTab: btn.openInNewTab
    });
    setTimeout(() => setTestNotification(null), 4000);
  };

  return (
    <div className={`space-y-4 ${embedded ? '' : 'p-3 bg-slate-900/30 rounded-xl border border-slate-800'}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Compass size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Homepage Hero Action Buttons (Call-to-Action)
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {buttons.filter(b => b.enabled !== false).length} Active on Home
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Manage titles, destination links, new tab redirection, colors, and order of buttons appearing under the hero banner slogan.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-2.5 py-1.5 text-[10.5px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Restore default 2 buttons"
          >
            <RotateCcw size={13} />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleStartAdd}
            disabled={showAddForm}
            className="px-3 py-1.5 text-[10.5px] font-bold rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add New Button
          </button>
          <button
            type="button"
            onClick={handleSaveDirectToCloud}
            disabled={savingLive}
            className="px-3.5 py-1.5 text-[10.5px] font-black rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Publish hero buttons directly to Cloud database"
          >
            {savingLive ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} strokeWidth={2.5} />}
            {savingLive ? 'Publishing...' : 'Save Live to Cloud'}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
          feedback.type === 'error'
            ? 'bg-rose-950/60 border border-rose-800 text-rose-300'
            : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
        }`}>
          {feedback.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Test Link Toast Notification */}
      {testNotification && (
        <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-700 text-blue-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2 truncate">
            <Link2 size={14} className="text-blue-400 shrink-0" />
            <span>
              <strong>Simulated Click:</strong> &quot;{testNotification.title}&quot; &rarr;{' '}
              <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono">{testNotification.link}</code>
              {testNotification.newTab && <span className="ml-1.5 text-[10px] px-1 py-0.5 bg-blue-900 text-blue-200 rounded">New Tab (_blank)</span>}
            </span>
          </div>
          <a
            href={testNotification.link}
            target={testNotification.newTab ? '_blank' : undefined}
            rel={testNotification.newTab ? 'noopener noreferrer' : undefined}
            className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded font-bold shrink-0 inline-flex items-center gap-1"
          >
            Visit URL <ExternalLink size={10} />
          </a>
        </div>
      )}

      {/* LIVE HOMEPAGE PREVIEW BANNER */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 relative overflow-hidden shadow-inner">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-slate-850">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              Live Homepage Hero Preview
            </span>
            <span className="text-[9px] text-slate-500 font-mono">(Simulated 1:1 Display)</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10.5px] text-slate-300 cursor-pointer select-none bg-slate-900 px-2 py-1 rounded border border-slate-800 hover:border-slate-700">
              <input
                type="checkbox"
                checked={simulateClosed}
                onChange={(e) => setSimulateClosed(e.target.checked)}
                className="rounded border-slate-700 text-orange-500 focus:ring-0 focus:ring-offset-0"
              />
              <span>Simulate Admissions Closed Mode</span>
            </label>
          </div>
        </div>

        {/* Hero canvas representation */}
        <div className="relative py-6 px-4 bg-gradient-to-b from-slate-900 via-slate-925 to-slate-950 rounded-lg border border-slate-800/80 text-center flex flex-col items-center justify-center min-h-[140px]">
          <h2
            className="text-[15.5px] sm:text-[24px] font-semibold mb-2 italic tracking-wider font-slogan"
            style={{
              color: '#961c14',
              textShadow: '0 0 8px rgba(255, 255, 255, 0.95), 0 0 16px rgba(255, 255, 255, 0.85), 0 0 25px rgba(255, 255, 255, 0.6)'
            }}
          >
            nurturing minds, shaping futures
          </h2>

          <div className="flex flex-row justify-center items-center gap-2 flex-wrap max-w-2xl">
            {buttons.filter(btn => btn && btn.enabled !== false).length === 0 ? (
              <span className="text-xs text-slate-500 italic py-2">
                (No active buttons enabled. Click &quot;Add New Button&quot; below to add one.)
              </span>
            ) : (
              buttons
                .filter(btn => btn && btn.enabled !== false)
                .map((btn, idx) => {
                  const isClosed = Boolean(btn.trackAdmissionStatus && simulateClosed);
                  const displayText = isClosed ? (btn.closedLabel || 'Admissions Closed') : btn.label;
                  const styleClassMap = {
                    primary: 'btn-hero-primary',
                    secondary: 'btn-hero-secondary',
                    amber: 'btn-hero-amber',
                    blue: 'btn-hero-blue',
                    purple: 'btn-hero-purple',
                    emerald: 'btn-hero-emerald',
                    outline: 'btn-hero-outline',
                  };
                  const styleClasses = styleClassMap[btn.style] || (idx === 0 ? 'btn-hero-primary' : 'btn-hero-secondary');

                  return (
                    <button
                      key={btn.id || idx}
                      type="button"
                      onClick={() => handleTestLink(btn)}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 font-bold rounded-lg transition-all shadow-md inline-flex items-center gap-1.5 text-xs sm:text-sm leading-tight cursor-pointer ${styleClasses}`}
                      title={`Click to test: redirects to "${btn.link}" (${btn.openInNewTab ? 'Opens in new tab' : 'Same tab'})`}
                    >
                      <span>{displayText}</span>
                      {btn.openInNewTab && <ExternalLink size={12} className="opacity-70" />}
                    </button>
                  );
                })
            )}
          </div>

          <div className="mt-3 text-[9px] text-slate-500 flex items-center gap-2">
            <span>💡 Click any button above to test its target destination link.</span>
          </div>
        </div>
      </div>

      {/* ADD OR EDIT BUTTON FORM MODAL / CARD */}
      {(showAddForm || editingId) && (
        <div className="bg-slate-900 p-4 rounded-xl border-2 border-orange-500/40 shadow-xl animate-in fade-in duration-150">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              {editingId ? <Edit2 size={13} /> : <Plus size={13} />}
              {editingId ? 'Edit Hero Button Configuration' : 'Add New Homepage Hero Button'}
            </h4>
            <button
              type="button"
              onClick={handleCancelForm}
              className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
            >
              <X size={15} />
            </button>
          </div>

          {/* Quick Preset Chips */}
          <div className="mb-3.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles size={11} className="text-amber-400" />
              Quick Page Presets (Click to autofill):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_PAGE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-orange-500/20 text-slate-300 hover:text-orange-300 border border-slate-750 hover:border-orange-500/40 text-[10px] font-medium transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Button Label */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Button Title / Label <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Admissions Open 2026, Learn More, Notice Board"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border ${
                    formErrors.label ? 'border-red-500' : 'border-slate-800 focus:border-orange-500'
                  } text-xs text-slate-100 outline-none`}
                />
                {formErrors.label && (
                  <span className="text-[10px] text-red-400 mt-0.5 block">{formErrors.label}</span>
                )}
              </div>

              {/* Destination Link */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Redirection Link / Target URL <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g., /admissions, /about, /fee, https://..."
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border ${
                      formErrors.link ? 'border-red-500' : 'border-slate-800 focus:border-orange-500'
                    } text-xs text-slate-100 outline-none font-mono`}
                  />
                  <div className="absolute right-2.5 top-2 text-[10px] text-slate-500">
                    {formData.link?.startsWith('http') ? 'External' : 'Internal Route'}
                  </div>
                </div>
                {formErrors.link ? (
                  <span className="text-[10px] text-red-400 mt-0.5 block">{formErrors.link}</span>
                ) : (
                  <span className="text-[9.5px] text-slate-500 mt-0.5 block">
                    Use <code className="text-slate-400 font-mono">/admissions</code>, <code className="text-slate-400 font-mono">/about</code>, <code className="text-slate-400 font-mono">/portal/student</code> or full <code className="text-slate-400 font-mono">https://</code> links.
                  </span>
                )}
              </div>
            </div>

            {/* Visual Style Palette */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Palette size={12} className="text-orange-400" />
                Button Visual Theme & Color
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {BUTTON_STYLES.map((styleItem) => {
                  const isSelected = formData.style === styleItem.id;
                  return (
                    <button
                      key={styleItem.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, style: styleItem.id })}
                      className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-950/20 ring-1 ring-orange-500'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10.5px] font-bold text-slate-200 truncate">{styleItem.name}</span>
                        {isSelected && <Check size={12} className="text-orange-400 shrink-0" />}
                      </div>
                      <div className={`px-2 py-1 rounded text-[9.5px] font-bold text-center truncate ${styleItem.previewColor}`}>
                        Preview
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggles and Behavior Options */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* Open in new tab toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.openInNewTab}
                    onChange={(e) => setFormData({ ...formData, openInNewTab: e.target.checked })}
                    className="rounded border-slate-700 text-orange-500 focus:ring-0"
                  />
                  <span className="flex items-center gap-1">
                    Open link in a new browser tab (<code className="text-[10px] text-slate-400 font-mono">target=&quot;_blank&quot;</code>)
                  </span>
                </label>

                {/* Visible on homepage toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="rounded border-slate-700 text-orange-500 focus:ring-0"
                  />
                  <span>Visible on Homepage (Enabled)</span>
                </label>
              </div>

              {/* Dynamic Admission status tracking */}
              <div className="pt-2 border-t border-slate-850">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 mb-1.5">
                  <input
                    type="checkbox"
                    checked={formData.trackAdmissionStatus}
                    onChange={(e) => setFormData({ ...formData, trackAdmissionStatus: e.target.checked })}
                    className="rounded border-slate-700 text-orange-500 focus:ring-0"
                  />
                  <span className="font-semibold text-amber-300">
                    Smart Dynamic Label: Track School Admission Status
                  </span>
                </label>
                {formData.trackAdmissionStatus && (
                  <div className="ml-5 pl-2 border-l-2 border-amber-500/40 mt-1">
                    <label className="block text-[9.5px] font-bold text-slate-400 uppercase mb-1">
                      Label When Global Admissions Are Closed:
                    </label>
                    <input
                      type="text"
                      placeholder="Admissions Closed"
                      value={formData.closedLabel}
                      onChange={(e) => setFormData({ ...formData, closedLabel: e.target.value })}
                      className="w-full max-w-sm px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 outline-none focus:border-amber-500"
                    />
                    <span className="text-[9.5px] text-slate-500 block mt-0.5">
                      When the principal closes admissions in settings, this button will automatically switch to this text.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check size={14} strokeWidth={2.5} />
                {editingId ? 'Save Button Changes' : 'Add Button to Homepage'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BUTTONS LIST TABLE / CARDS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
          <span>Configured Homepage Buttons ({buttons.length})</span>
          <span className="text-[9.5px] text-slate-500 font-normal">Use Up/Down arrows to reorder button sequence</span>
        </div>

        {buttons.length === 0 ? (
          <div className="bg-slate-950/60 p-6 rounded-xl border border-slate-850 text-center space-y-2">
            <Info size={24} className="mx-auto text-slate-500" />
            <p className="text-xs text-slate-400">No buttons currently defined for the homepage hero section.</p>
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500 text-slate-950 inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Add First Button
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {buttons.map((btn, index) => {
              const isEditingThis = editingId === btn.id;
              const isEnabled = btn.enabled !== false;
              const styleObj = BUTTON_STYLES.find(s => s.id === btn.style) || BUTTON_STYLES[0];

              return (
                <div
                  key={btn.id || index}
                  className={`p-2.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isEditingThis
                      ? 'bg-orange-950/20 border-orange-500/50'
                      : isEnabled
                      ? 'bg-slate-950 border-slate-800 hover:border-slate-750'
                      : 'bg-slate-950/50 border-slate-850 opacity-60'
                  }`}
                >
                  {/* Left Column: Reorder + Title + Badges */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Reorder Buttons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveButton(index, -1)}
                        disabled={index === 0}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveButton(index, 1)}
                        disabled={index === buttons.length - 1}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>

                    {/* Button Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${isEnabled ? 'text-slate-100' : 'text-slate-400 line-through'}`}>
                          {btn.label}
                        </span>

                        {/* Style Badge */}
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${styleObj.previewColor}`}>
                          {styleObj.name}
                        </span>

                        {/* New tab badge */}
                        {btn.openInNewTab && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 inline-flex items-center gap-0.5">
                            <ExternalLink size={9} /> _blank
                          </span>
                        )}

                        {/* Admission Status Tracker Badge */}
                        {btn.trackAdmissionStatus && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60" title={`Closed Label: "${btn.closedLabel || 'Admissions Closed'}"`}>
                            ⚡ Tracks Admissions
                          </span>
                        )}

                        {!isEnabled && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60">
                            Hidden / Disabled
                          </span>
                        )}
                      </div>

                      {/* URL / Path Display */}
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 truncate">
                        <Link2 size={11} className="text-slate-500 shrink-0" />
                        <span className="font-mono text-cyan-400 truncate">{btn.link}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    {/* Toggle Visibility (Eye) */}
                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(btn.id)}
                      className={`p-1.5 rounded transition-colors ${
                        isEnabled
                          ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900'
                          : 'text-rose-400 hover:text-slate-300 hover:bg-slate-900'
                      }`}
                      title={isEnabled ? 'Visible (Click to hide button)' : 'Hidden (Click to show on home)'}
                    >
                      {isEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={() => handleDuplicateButton(btn)}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
                      title="Duplicate button"
                    >
                      <Copy size={14} />
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(btn)}
                      className="p-1.5 rounded text-slate-400 hover:text-orange-400 hover:bg-slate-900 transition-colors"
                      title="Edit button settings"
                    >
                      <Edit2 size={14} />
                    </button>

                    {/* Delete */}
                    {deleteConfirmId === btn.id ? (
                      <div className="flex items-center gap-1 bg-red-950/80 p-0.5 rounded border border-red-800 animate-in fade-in">
                        <button
                          type="button"
                          onClick={() => handleDeleteButton(btn.id)}
                          className="px-2 py-0.5 text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white rounded"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1 text-slate-400 hover:text-slate-200"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(btn.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors"
                        title="Delete button"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={executeResetDefaults}
        type="warning"
        title="Reset Hero Action Buttons"
        message="Reset homepage hero action buttons back to the standard institutional defaults ('Admissions Open' and 'Learn More')?"
        consequence="Any custom action buttons, custom external links, or special styling presets will be replaced with the standard defaults."
        confirmText="Reset to Defaults"
      />
    </div>
  );
}
