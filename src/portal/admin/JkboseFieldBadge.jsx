import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

/**
 * JkboseFieldBadge: A compact, minimal visual indicator badge displayed beside
 * table column values or in field headers indicating that student data was
 * verified / overwritten as per official JKBOSE Board records.
 *
 * Renders an ultra-clean, window-responsive floating portal tooltip with a dynamic
 * arrow pointer that cleanly adapts to window edges, mobile screens, and scroll positions.
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
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 280, placeAbove: true, arrowLeft: 24 });
  const badgeRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Dynamic window-responsive coordinate calculation
  const updatePosition = useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;

    // Window-responsive width: caps at 280px or screen width minus margins
    const tooltipWidth = Math.min(280, Math.max(220, window.innerWidth - 24));
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 115;

    // Center tooltip horizontally over badge
    const badgeCenterX = rect.left + rect.width / 2;
    let left = badgeCenterX - tooltipWidth / 2;
    // Keep at least 12px from left and right window edges
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    // Calculate caret arrow offset relative to the tooltip box
    const arrowLeft = Math.max(14, Math.min(badgeCenterX - left - 5, tooltipWidth - 22));

    // Vertical placement (prefer above if space exists; otherwise place below)
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceAbove >= tooltipHeight + 10 || spaceAbove > spaceBelow;

    let top;
    if (placeAbove) {
      top = Math.max(8, rect.top - tooltipHeight - 7);
    } else {
      top = Math.min(window.innerHeight - tooltipHeight - 8, rect.bottom + 7);
    }

    setCoords({ top, left, width: tooltipWidth, placeAbove, arrowLeft });
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

  // Safe timestamp resolution
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

  // Render ultra-clean, minimal, window-responsive tooltip portal
  const renderTooltip = () => {
    if (!isOpen || typeof document === 'undefined') return null;

    const sourceFilename = info.source ? String(info.source).split(/[/\\]/).pop() : '';

    return createPortal(
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          zIndex: 999999,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[calc(100vw-24px)] p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-xl text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100 font-sans pointer-events-auto select-text text-left relative"
      >
        {/* Dynamic Pointer Caret */}
        <div
          style={{ left: `${coords.arrowLeft || 24}px` }}
          className={`absolute w-2.5 h-2.5 bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 transform rotate-45 pointer-events-none ${
            coords.placeAbove
              ? '-bottom-[5.5px] border-b border-r'
              : '-top-[5.5px] border-t border-l'
          }`}
        />

        {/* Minimal Header */}
        <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="font-extrabold text-[11px] text-slate-900 dark:text-white truncate">
              JKBOSE Verified
            </span>
            <span className="text-[10px] text-slate-400 font-medium truncate">
              • {fieldLabel}
            </span>
          </div>
          <span className="shrink-0 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
            Board Sync
          </span>
        </div>

        {/* Minimal Diff Section */}
        {hasDiff ? (
          <div className="py-1.5 space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Previous
              </span>
              <span className="font-mono text-rose-500/90 line-through truncate text-right font-medium max-w-[190px]" title={displayOld}>
                {displayOld}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-1">
                <CheckCircle2 size={10} /> Master
              </span>
              <span className="font-mono font-black text-slate-900 dark:text-white truncate text-right max-w-[190px]" title={displayNew}>
                {displayNew}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            {customTitle || 'Matched with official JKBOSE Board master records.'}
          </div>
        )}

        {/* Minimal Source & Timestamp Footer */}
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 font-medium gap-2">
          {sourceFilename ? (
            <span className="truncate max-w-[170px]" title={info.source}>
              📁 <span className="font-mono text-slate-700 dark:text-slate-300">{sourceFilename}</span>
            </span>
          ) : <span />}
          {dateStr && (
            <span className="shrink-0 text-slate-400">
              {dateStr}
            </span>
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
