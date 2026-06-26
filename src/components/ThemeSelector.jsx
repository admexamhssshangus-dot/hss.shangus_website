import React, { useState, useEffect } from 'react';
import { Palette, Sun, Moon, Sparkles, Check, Download } from 'lucide-react';

const themes = [
  { id: 'light', name: 'Light Mode', icon: Sun, color: '#f8fafc', accent: '#0d9488' },
  { id: 'dark', name: 'Dark Slate', icon: Moon, color: '#0f172a', accent: '#38bdf8' },
  { id: 'royal', name: 'Royal Gold', icon: Sparkles, color: '#0a1128', accent: '#d4af37' },
  { id: 'forest', name: 'Forest Emerald', icon: Sparkles, color: '#062e1b', accent: '#34d399' },
  { id: 'midnight', name: 'Midnight Black', icon: Moon, color: '#000000', accent: '#a78bfa' }
];

export default function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // On mount, read from localStorage and apply theme + handle PWA
  useEffect(() => {
    // Theme setup
    const saved = localStorage.getItem('site-theme') || 'light';
    setCurrentTheme(saved);
    applyTheme(saved);

    // PWA Check
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const applyTheme = (themeId) => {
    const html = document.documentElement;
    // Remove all custom theme classes
    html.classList.remove('theme-light', 'theme-dark', 'theme-royal', 'theme-forest', 'theme-midnight');
    html.classList.add(`theme-${themeId}`);
  };

  const handleSelect = (themeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
    localStorage.setItem('site-theme', themeId);
    setIsOpen(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert("Please use your browser's menu (Add to Home Screen) to install the app.");
      return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsOpen(false);
      }
    } catch (err) {}
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-3 right-3 md:bottom-6 md:right-6 z-[9999] flex flex-col items-end">
      {/* Theme Options Card */}
      {isOpen && (
        <>
          {/* Transparent click overlay to close panel */}
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
          
          <div className="mb-3 z-50 bg-white border border-slate-200 text-slate-800 rounded-lg shadow-2xl p-3 w-52 animate-in fade-in slide-in-from-bottom-5 duration-200">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Select Theme</h4>
            <div className="space-y-1">
              {themes.map((t) => {
                const isActive = currentTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors text-left ${isActive ? 'bg-slate-100 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center border border-slate-300" style={{ backgroundColor: t.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.accent }} />
                      </span>
                      <span>{t.name}</span>
                    </div>
                    {isActive && <Check size={14} className="text-[#961c14]" />}
                  </button>
                );
              })}
            </div>

            {/* Unified Install App Section */}
            {!isInstalled && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Download size={14} className="text-[#0d9488]" />
                    Install App
                  </span>
                  <button
                    onClick={handleInstall}
                    className="bg-gradient-to-r from-teal-500 to-teal-700 hover:from-teal-600 hover:to-teal-800 text-white px-2.5 py-1 rounded text-[10px] font-bold transition-all shadow-sm active:scale-95"
                  >
                    Install
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 md:w-12 md:h-12 bg-[#961c14] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all focus:outline-none z-50 relative"
        title="Settings & Themes"
        aria-label="Settings and Themes Menu"
      >
        <Palette size={20} className={isOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
        {/* Notification dot if app is installable */}
        {!isInstalled && !isOpen && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-amber-500 border-2 border-[#961c14] animate-pulse" />
        )}
      </button>
    </div>
  );
}
