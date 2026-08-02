import React, { useState } from 'react';
import { Settings, Save, RefreshCw, CheckCircle2 } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';

export default function AppSettings() {
  const [session, setSession] = useState('2025-26');
  const [allow9th, setAllow9th] = useState(true);
  const [allow10th, setAllow10th] = useState(true);
  const [allow11th, setAllow11th] = useState(true);
  const [allow12th, setAllow12th] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const settings = {
        session,
        allow_9th: allow9th,
        allow_10th: allow10th,
        allow_11th: allow11th,
        allow_12th: allow12th,
      };

      const res = await appsScriptApi.call('saveAppSettings', { settings });
      if (res && res.success !== false) {
        setMessage('System settings saved successfully!');
      } else {
        alert('Failed to save system settings.');
      }
    } catch (err) {
      console.error('Save settings error:', err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveSettings} className="max-w-xl space-y-6 text-xs">
      {message && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}

      {/* Active Session */}
      <div className="p-6 rounded-3xl border space-y-3" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
        <div className="font-extrabold text-sm flex items-center gap-2" style={{ color: 'var(--text-main, #0f172a)' }}>
          <Settings size={18} className="text-amber-600" /> Academic Session Configuration
        </div>

        <div className="space-y-1">
          <label className="font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>Active Academic Session Year *</label>
          <select
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-amber-500"
            style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
          >
            <option value="2025-26">2025-26 Session</option>
            <option value="2026-27">2026-27 Session</option>
          </select>
        </div>
      </div>

      {/* Class Admission Toggles */}
      <div className="p-6 rounded-3xl border space-y-3" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
        <div className="font-extrabold text-sm" style={{ color: 'var(--text-main, #0f172a)' }}>
          Active Online Admission Classes
        </div>

        <div className="space-y-2">
          {[
            { label: 'Allow 12th Class Admissions', state: allow12th, set: setAllow12th },
            { label: 'Allow 11th Class Admissions', state: allow11th, set: setAllow11th },
            { label: 'Allow 10th Class Admissions', state: allow10th, set: setAllow10th },
            { label: 'Allow 9th Class Admissions', state: allow9th, set: setAllow9th },
          ].map((item, idx) => (
            <label key={idx} className="flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-slate-900 cursor-pointer font-bold" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
              <input
                type="checkbox"
                checked={item.state}
                onChange={(e) => item.set(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-3.5 rounded-2xl font-extrabold text-white bg-amber-600 hover:bg-amber-500 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
        <span>Save App Settings</span>
      </button>
    </form>
  );
}
