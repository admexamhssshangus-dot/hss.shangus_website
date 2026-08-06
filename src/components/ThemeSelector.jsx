import React, { useState, useEffect } from 'react';
import { Palette, Check, Download, X } from 'lucide-react';

const themes = [
  { id: 'light',    name: 'Light',    color: '#f8fafc', accent: '#0d9488' },
  { id: 'dark',     name: 'Dark',     color: '#0f172a', accent: '#38bdf8' },
  { id: 'royal',    name: 'Royal',    color: '#0a1128', accent: '#d4af37' },
  { id: 'forest',   name: 'Forest',   color: '#062e1b', accent: '#34d399' },
  { id: 'midnight', name: 'Midnight', color: '#000000', accent: '#a78bfa' },
];

export default function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installInfo, setInstallInfo] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('site-theme') || 'light';
    setCurrentTheme(saved);
    applyTheme(saved);

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    } else if (navigator.getInstalledRelatedApps) {
      navigator.getInstalledRelatedApps().then(apps => {
        if (apps && apps.length > 0) setIsInstalled(true);
      }).catch(() => {});
    }

    const handleBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setDeferredPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const applyTheme = (themeId) => {
    const html = document.documentElement;
    html.classList.remove('theme-light', 'theme-dark', 'theme-royal', 'theme-forest', 'theme-midnight', 'dark');
    html.classList.add(`theme-${themeId}`);
    if (themeId !== 'light') html.classList.add('dark');
  };

  const handleSelect = (themeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
    localStorage.setItem('site-theme', themeId);
    setIsOpen(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setInstallInfo('Already installed or available from the browser address bar.');
      setTimeout(() => setInstallInfo(''), 5000);
      return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setIsInstalled(true); setIsOpen(false); }
    } catch (_) {}
    setDeferredPrompt(null);
  };

  const active = themes.find(t => t.id === currentTheme) || themes[0];

  return (
    <div className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-[9999] flex flex-col items-end gap-2">
      {/* Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className="mb-1 z-50 rounded-2xl shadow-2xl border overflow-hidden w-48 animate-fadeIn"
            style={{
              backgroundColor: currentTheme === 'light' ? '#ffffff' : '#0f172a',
              borderColor: currentTheme === 'light' ? '#e2e8f0' : '#334155',
              color: currentTheme === 'light' ? '#0f172a' : '#f8fafc'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: currentTheme === 'light' ? '#e2e8f0' : '#334155' }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: currentTheme === 'light' ? '#64748b' : '#94a3b8' }}>
                Choose Theme
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="transition-colors cursor-pointer p-0.5"
                style={{ color: currentTheme === 'light' ? '#64748b' : '#94a3b8' }}
              >
                <X size={12} />
              </button>
            </div>

            {/* Theme list */}
            <div className="p-1.5 space-y-1">
              {themes.map((t) => {
                const isActive = currentTheme === t.id;
                const isLight = currentTheme === 'light';
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                      isActive 
                        ? (isLight ? 'bg-slate-100 shadow-xs border border-slate-200' : 'bg-slate-800 shadow-sm border border-slate-700') 
                        : (isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/60')
                    }`}
                    style={{ color: isActive ? (isLight ? '#0f172a' : '#ffffff') : (isLight ? '#475569' : '#e2e8f0') }}
                  >
                    {/* Color swatch */}
                    <span
                      className={`w-4 h-4 rounded-full flex-shrink-0 relative shadow-xs ${isLight ? 'border border-slate-200' : 'border border-white/30'}`}
                      style={{ backgroundColor: t.color }}
                    >
                      <span
                        className="absolute rounded-full"
                        style={{
                          width: '6px', height: '6px',
                          backgroundColor: t.accent,
                          top: '50%', left: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    </span>
                    <span
                      className="text-xs font-black flex-1"
                      style={{ color: isActive ? (isLight ? '#0f172a' : '#ffffff') : (isLight ? '#475569' : '#e2e8f0') }}
                    >
                      {t.name}
                    </span>
                    {isActive && <Check size={13} className={`${isLight ? 'text-teal-600' : 'text-teal-400'} flex-shrink-0 font-black`} />}
                  </button>
                );
              })}
            </div>

            {/* Install App */}
            {!isInstalled && (
              <div className="px-1.5 pb-1.5 pt-1">
                <button
                  onClick={handleInstall}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black text-white transition-all cursor-pointer hover:opacity-90 active:scale-95 shadow-md"
                  style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
                >
                  <Download size={13} /> Install App
                </button>
                {installInfo && (
                  <p className="mt-1 text-[9px] text-teal-400 text-center leading-snug px-1 font-bold">{installInfo}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating Toggle Button (Original circular design) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 md:w-11 md:h-11 bg-[#961c14] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all focus:outline-none z-50 relative cursor-pointer"
        title="Settings & Themes"
        aria-label="Settings and Themes Menu"
      >
        <Palette size={18} className={isOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
        {!isInstalled && !isOpen && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-amber-500 border-2 border-[#961c14] animate-pulse" />
        )}
      </button>
    </div>
  );
}
