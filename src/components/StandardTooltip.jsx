import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Info, X, HelpCircle } from 'lucide-react';

/**
 * StandardTooltip — A touch-friendly, accessible floating info tooltip & popover
 * 
 * Supports:
 * - Click / Tap to toggle (essential for mobile screens)
 * - Desktop hover preview with click persist
 * - Outside click & Escape key dismissal
 * - Smart viewport-bounded positioning
 * - Clean glassmorphism design with zero text truncation
 */
export default function StandardTooltip({
  content,
  title,
  children,
  position = 'top', // 'top' | 'bottom' | 'left' | 'right'
  variant = 'info', // 'info' | 'help' | 'warning'
  size = 'md', // 'sm' | 'md'
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  // Dismiss on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleOpen = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  if (!content) return null;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-900 dark:border-t-slate-800 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-900 dark:border-b-slate-800 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-900 dark:border-l-slate-800 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-900 dark:border-r-slate-800 border-y-transparent border-l-transparent'
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => {
        // Only open on hover for non-touch devices
        if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
          setIsOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
          setIsOpen(false);
        }
      }}
    >
      {/* Trigger Button */}
      {children ? (
        <span
          onClick={toggleOpen}
          className="cursor-pointer inline-flex items-center"
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          aria-label={title || 'Information'}
        >
          {children}
        </span>
      ) : (
        <button
          type="button"
          onClick={toggleOpen}
          className="inline-flex items-center justify-center p-0.5 rounded-full text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/80 border border-teal-200 dark:border-teal-800/80 cursor-pointer shadow-2xs transition-all active:scale-90 focus:outline-none focus:ring-1 focus:ring-teal-500"
          title={title || 'Click for details'}
          aria-expanded={isOpen}
          aria-label={title || 'Information'}
        >
          {variant === 'help' ? <HelpCircle size={10.5} /> : <Info size={10.5} />}
        </button>
      )}

      {/* Floating Popover Tooltip */}
      {isOpen && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-50 pointer-events-auto animate-fadeIn w-max max-w-[260px] sm:max-w-xs p-2.5 rounded-xl shadow-xl bg-slate-900/95 dark:bg-slate-800/98 backdrop-blur-md text-white border border-slate-700/80 dark:border-slate-600/80 text-[11px] font-medium leading-relaxed ${positionClasses[position] || positionClasses.top}`}
        >
          {/* Header with Title & Dismiss Button */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 dark:border-slate-700/80 pb-1 mb-1.5">
            <div className="flex items-center gap-1 text-[10px] font-black text-teal-300 uppercase tracking-wider">
              <Info size={11} className="text-teal-400 flex-shrink-0" />
              <span className="truncate">{title || 'Guidance / Instructions'}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 cursor-pointer transition-colors flex-shrink-0"
              title="Close"
              aria-label="Close tooltip"
            >
              <X size={11} />
            </button>
          </div>

          {/* Body Content (Full text without truncation) */}
          <div className="text-slate-200 dark:text-slate-200 text-[10.5px] font-normal break-words leading-snug">
            {content}
          </div>

          {/* Pointer Triangle */}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position] || arrowClasses.top}`}
          />
        </div>
      )}
    </div>
  );
}
