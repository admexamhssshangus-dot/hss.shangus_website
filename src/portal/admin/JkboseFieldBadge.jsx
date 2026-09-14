import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, CheckCircle2, ArrowRight, FileSpreadsheet, Clock, X } from 'lucide-react';

/**
 * JkboseFieldBadge: A visual indicator badge displayed beside table column values
 * or in field headers indicating that student data was overwritten/verified as per
 * official JKBOSE Board records.
 *
 * Renders an interactive, floating portal tooltip on hover or mobile tap showing
 * full audit details, original student value, verified Board value, source sheet, and timestamp.
 *
 * @param {Object} props
 * @param {Object} [props.info] - Status object from getJkboseFieldStatus()
 * @param {string} [props.className] - Additional Tailwind classes
 * @param {string} [props.customTitle] - Optional custom tooltip text
 * @param {boolean} [props.minimal] - If true, renders just the pulsing micro-dot
 */
export default function JkboseFieldBadge({
  info,
  className = '',
  customTitle,
  minimal = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placeAbove: true });
  const badgeRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Dynamic viewport coordinate calculation
  const updatePosition = useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 300;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 160;

    // Horizontal centering with screen edge padding
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

    // Vertical placement (prefer above if space exists)
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceAbove >= tooltipHeight + 8 || spaceAbove > spaceBelow;

    let top;
    if (placeAbove) {
      top = Math.max(10, rect.top - tooltipHeight - 6);
    } else {
      top = Math.min(window.innerHeight - tooltipHeight - 10, rect.bottom + 6);
    }

    setCoords({ top, left, placeAbove });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    const handleOutsideClick = (e) => {
      if (
        badgeRef.current && !badgeRef.current.contains(e.target) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen, updatePosition]);

  // If no update or not active, render nothing (after all hooks have registered)
  if (!info || !info.isUpdated) {
    return null;
  }

  // Safe timestamp resolution (supports ISO string, timestamp number, or Firestore timestamp)
  let dateObj = null;
  if (info.timestamp) {
    if (typeof info.timestamp.toDate === 'function') {
      dateObj = info.timestamp.toDate();
    } else if (info.timestamp.seconds) {
      dateObj = new Date(info.timestamp.seconds * 1000);
    } else {
      dateObj = new Date(info.timestamp);
    }
  }

  const dateStr = dateObj && !isNaN(dateObj) ? dateObj.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) : '';

  const timeStr = dateObj && !isNaN(dateObj) ? dateObj.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  const displayOld = info.oldValue !== undefined && info.oldValue !== null ? String(info.oldValue).trim() || '(blank)' : '';
  const displayNew = info.newValue !== undefined && info.newValue !== null ? String(info.newValue).trim() || '(blank)' : '';
  const hasDiff = displayOld && displayNew && displayOld !== displayNew;

  const fieldLabel = info.label || info.key ? (
    String(info.label || info.key)
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  ) : 'Record';

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  // Render rich floating tooltip portal
  const renderTooltip = () => {
    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          zIndex: 999999,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
        className="w-[300px] max-w-[92vw] p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-500/30 dark:border-emerald-500/40 shadow-2xl text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100 font-sans pointer-events-auto select-text space-y-2 text-left"
      >
        {/* Tooltip Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={12} />
            </span>
            <span className="font-black text-xs text-slate-900 dark:text-white">
              JKBOSE Board Verification
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Master Record
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer sm:hidden ml-1"
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Diff Box (if changes present) */}
        {hasDiff ? (
          <div className="p-2 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>Field: <strong className="text-slate-700 dark:text-slate-300">{fieldLabel}</strong></span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-0.5">
                <CheckCircle2 size={10} /> Overwritten
              </span>
            </div>
            <div className="space-y-1 pt-0.5 font-mono text-xs">
              <div className="flex items-center justify-between gap-1.5 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded-lg border border-rose-200/70 dark:border-rose-900/50">
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wide shrink-0">Previous</span>
                <span className="line-through text-rose-700 dark:text-rose-300 font-semibold truncate text-right" title={displayOld}>
                  {displayOld}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-200/70 dark:border-emerald-800/50">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wide flex items-center gap-0.5 shrink-0">
                  <CheckCircle2 size={10} className="text-emerald-500" /> JKBOSE
                </span>
                <span className="text-emerald-800 dark:text-emerald-200 font-black truncate text-right" title={displayNew}>
                  {displayNew}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 py-0.5">
            {customTitle || 'Field verified directly against official JKBOSE Board master records.'}
          </div>
        )}

        {/* Source & Timestamp Footer */}
        <div className="space-y-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
          {info.source && (
            <div className="flex items-center gap-1.5 truncate" title={info.source}>
              <FileSpreadsheet size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate">
                Source: <strong className="font-mono text-slate-700 dark:text-slate-300">{info.source}</strong>
              </span>
            </div>
          )}
          {(dateStr || timeStr) && (
            <div className="flex items-center gap-1.5">
              <Clock size={11} className="text-slate-400 shrink-0" />
              <span>
                Synced: <strong className="text-slate-700 dark:text-slate-300">{dateStr}{timeStr ? ` • ${timeStr}` : ''}</strong>
              </span>
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  if (minimal) {
    return (
      <>
        <span
          ref={badgeRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className={`inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950 cursor-pointer select-none shrink-0 ${className}`}
          aria-label="Updated as per JKBOSE record"
        >
          <span className="w-1 h-1 rounded-full bg-white dark:bg-slate-900 animate-pulse" />
        </span>
        {renderTooltip()}
      </>
    );
  }

  return (
    <>
      <span
        ref={badgeRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] text-[7.5px] font-black uppercase tracking-wider bg-emerald-50/95 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/80 leading-none select-none cursor-pointer shadow-2xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:scale-105 transition-all shrink-0 align-middle ${className}`}
        aria-label="Updated as per JKBOSE data"
      >
        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
        JKBOSE
      </span>
      {renderTooltip()}
    </>
  );
}
