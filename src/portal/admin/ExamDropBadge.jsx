import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Ban, AlertTriangle, ShieldAlert, X, UserX, FileText } from 'lucide-react';
import { getStudentExamDropDetails } from '../../utils/studentApprovalStatus';

/**
 * ExamDropBadge: A compact, prominent visual indicator badge displayed beside
 * student records who have been dropped from regular JKBOSE examinations.
 *
 * Renders an ultra-clean, window-responsive floating portal tooltip with a dynamic
 * arrow pointer that cleanly adapts to table overflow containers, window edges,
 * and mobile screens without getting clipped by table cell boundaries.
 *
 * @param {Object} props
 * @param {Object} props.student - Student record object
 * @param {Object} [props.dropInfo] - Optional pre-calculated drop details
 * @param {string} [props.className] - Additional Tailwind classes
 * @param {boolean} [props.minimal] - If true, renders a micro-tag suitable for tight table cells
 */
export default function ExamDropBadge({
  student,
  dropInfo,
  className = '',
  minimal = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 300, placeAbove: true, arrowLeft: 24 });
  const badgeRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Extract drop details (authoritative institutional logic)
  const details = dropInfo || (student ? getStudentExamDropDetails(student) : null);

  // Dynamic window-responsive coordinate calculation (prevents clipping in table overflow containers)
  const updatePosition = useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;

    // Window-responsive width: caps at 320px or screen width minus margins
    const tooltipWidth = Math.min(320, Math.max(240, window.innerWidth - 24));
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 160;

    // Center tooltip horizontally over badge
    const badgeCenterX = rect.left + rect.width / 2;
    let left = badgeCenterX - tooltipWidth / 2;
    // Keep at least 12px from window edges
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    // Calculate caret arrow offset relative to the tooltip container
    const arrowLeft = Math.max(16, Math.min(badgeCenterX - left - 5, tooltipWidth - 24));

    // Vertical placement (prefer above if space exists; otherwise place below)
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceAbove >= tooltipHeight + 10 || spaceAbove > spaceBelow;

    let top;
    if (placeAbove) {
      top = Math.max(8, rect.top - tooltipHeight - 8);
    } else {
      top = Math.min(window.innerHeight - tooltipHeight - 8, rect.bottom + 8);
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

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  if (!details || !details.isDropped) {
    return null;
  }

  const handleMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
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

  // Render floating portal tooltip cleanly attached to document.body
  const renderTooltip = () => {
    if (!isOpen || typeof document === 'undefined') return null;

    let formattedDate = '';
    if (details.droppedAt) {
      try {
        const d = new Date(details.droppedAt);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        }
      } catch (_) {}
    }

    return createPortal(
      <div
        ref={tooltipRef}
        data-tooltip-ignore="true"
        data-exam-drop-popover="true"
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
        className="max-w-[calc(100vw-24px)] p-3 rounded-2xl bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border border-rose-200/90 dark:border-rose-900/80 shadow-2xl text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100 font-sans pointer-events-auto select-text text-left relative exam-drop-popover"
      >
        {/* Dynamic Pointer Caret */}
        <div
          style={{ left: `${coords.arrowLeft || 24}px` }}
          className={`absolute w-2.5 h-2.5 bg-white dark:bg-slate-900 border-rose-200/90 dark:border-rose-900/80 transform rotate-45 pointer-events-none ${
            coords.placeAbove
              ? '-bottom-[5.5px] border-b border-r'
              : '-top-[5.5px] border-t border-l'
          }`}
        />

        {/* Header Bar */}
        <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-rose-100 dark:border-rose-900/50">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span className="font-extrabold text-[11.5px] text-rose-700 dark:text-rose-400 shrink-0 flex items-center gap-1">
              <Ban size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
              Examinee Dropped
            </span>
            <span className="text-[10px] text-slate-400 font-bold truncate">
              • JKBOSE Regular
            </span>
          </div>
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Excluded
          </span>
        </div>

        {/* Student Demographics Snippet */}
        <div className="py-2 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-[12px] text-slate-900 dark:text-white truncate">
              {details.studentName}
            </span>
            <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
              {details.className} • Roll #{details.classRollNo}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-medium">
            {details.formNo && details.formNo !== '—' && (
              <span>Form: <strong className="font-mono text-slate-700 dark:text-slate-300">#{details.formNo}</strong></span>
            )}
            {details.boardRegNo && details.boardRegNo !== '—' && (
              <span>Reg: <strong className="font-mono text-slate-700 dark:text-slate-300">{details.boardRegNo}</strong></span>
            )}
          </div>
        </div>

        {/* Drop Details / Administrative Comment Callout */}
        <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/70 text-rose-900 dark:text-rose-200 space-y-1">
          <div className="flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
            <AlertTriangle size={11} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>Drop Comment &amp; Order Details:</span>
          </div>
          <p className="text-[11px] leading-relaxed font-semibold italic text-slate-800 dark:text-rose-100">
            "{details.reason}"
          </p>
        </div>

        {/* Institutional Regulatory Note */}
        <div className="pt-2 text-[9.5px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 mt-2">
          <span className="truncate">
            Authority: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{details.droppedBy}</strong>
          </span>
          {formattedDate && (
            <span className="shrink-0 font-mono text-[9px] text-slate-400">
              {formattedDate}
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
          data-tooltip-ignore="true"
          data-exam-drop-badge="true"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className={`exam-drop-badge inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[7.5px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 leading-none select-none cursor-pointer shadow-2xs hover:bg-rose-200 dark:hover:bg-rose-900 transition-all shrink-0 align-middle whitespace-nowrap ${className}`}
          title="Dropped from regular JKBOSE exams (Click or hover for full details)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-rose-300/70 dark:ring-rose-400/50 animate-pulse shrink-0" />
          <span>DROPPED</span>
        </span>
        {renderTooltip()}
      </>
    );
  }

  return (
    <>
      <span
        ref={badgeRef}
        data-tooltip-ignore="true"
        data-exam-drop-badge="true"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`exam-drop-badge inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-[4px] text-[7px] sm:text-[7.5px] md:text-[8px] font-black uppercase tracking-wider bg-rose-500/10 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300/90 dark:border-rose-800/90 leading-none select-none cursor-pointer shadow-2xs hover:bg-rose-500/20 dark:hover:bg-rose-900/60 hover:scale-105 active:scale-95 transition-all shrink-0 align-middle whitespace-nowrap ${className}`}
        aria-label="Dropped from Regular JKBOSE Exams"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-rose-300/70 dark:ring-rose-400/50 animate-pulse shrink-0" />
        <span>EXAM DROPPED</span>
      </span>
      {renderTooltip()}
    </>
  );
}
