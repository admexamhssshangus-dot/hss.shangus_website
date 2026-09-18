import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Universal Global Tooltip System
 * 
 * Automatically intercepts any element with `title` or `data-tooltip` across ALL
 * modules, portals, and pages. Replaces the browser's native OS tooltip with a
 * modern, consistent, glassmorphic floating pill with viewport collision detection,
 * smooth animations, and high-contrast readability in both light & dark themes.
 */

// Helper to format keyboard shortcuts in tooltip text: e.g. "Save (Ctrl+S)" or "[Esc]"
function renderTooltipContent(rawText) {
  if (!rawText) return null;

  // Check for shortcut pattern at the end: (Ctrl+X), (Shift+Click), [Esc], etc.
  const shortcutRegex = /^(.*?)\s*(\((?:Ctrl|Cmd|Alt|Shift|Esc|Tab|Enter)[^)]*\)|\[(?:Ctrl|Cmd|Alt|Shift|Esc|Tab|Enter)[^\]]*\])$/i;
  const match = rawText.match(shortcutRegex);

  if (match) {
    const mainText = match[1].trim();
    const shortcut = match[2].replace(/[()[\]]/g, '').trim();

    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap" style={{ color: '#ffffff' }}>
        <span style={{ color: '#ffffff' }}>{mainText}</span>
        <kbd
          className="inline-flex items-center justify-center px-1.5 py-0.2 text-[9.5px] font-mono font-bold rounded shadow-2xs tracking-wider"
          style={{
            color: '#5eead4',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
          }}
        >
          {shortcut}
        </kbd>
      </span>
    );
  }

  // Check for multi-part descriptions: "Title :: Subtitle" or "Title\nSubtitle"
  if (rawText.includes('::') || rawText.includes('\n')) {
    const parts = rawText.includes('::') ? rawText.split('::') : rawText.split('\n');
    return (
      <span className="flex flex-col gap-0.5 text-left" style={{ color: '#ffffff' }}>
        <span className="font-bold" style={{ color: '#ffffff' }}>{parts[0].trim()}</span>
        {parts.slice(1).map((p, idx) => (
          <span key={idx} className="text-[10.5px] font-normal leading-normal" style={{ color: '#cbd5e1' }}>
            {p.trim()}
          </span>
        ))}
      </span>
    );
  }

  return <span style={{ color: '#ffffff' }}>{rawText}</span>;
}

export default function GlobalTooltip() {
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    text: '',
    rect: null,
    position: 'top',
    arrowLeft: 0,
    top: 0,
    left: 0,
  });

  const tooltipRef = useRef(null);
  const activeTargetRef = useRef(null);
  const showTimerRef = useRef(null);
  const lastActiveTimestampRef = useRef(0);

  // Measure and compute ideal viewport position
  const computePosition = useCallback((targetEl, rawText) => {
    if (!targetEl || typeof window === 'undefined') return null;

    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    const preferredPosition = targetEl.getAttribute('data-tooltip-position') || 'auto';
    const tooltipEl = tooltipRef.current;

    // Estimated or measured dimensions
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : Math.min(260, Math.max(80, rawText.length * 7 + 24));
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 32;

    const gap = 6; // distance between target and tooltip
    const padding = 8; // min distance from viewport edges

    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;

    let finalPosition = 'top';
    let top = 0;
    let left = 0;
    let arrowLeft = 0;

    if (preferredPosition === 'left' && spaceLeft >= tooltipWidth + gap) {
      finalPosition = 'left';
      left = rect.left - tooltipWidth - gap;
      top = rect.top + (rect.height - tooltipHeight) / 2;
    } else if (preferredPosition === 'right' && spaceRight >= tooltipWidth + gap) {
      finalPosition = 'right';
      left = rect.right + gap;
      top = rect.top + (rect.height - tooltipHeight) / 2;
    } else if (preferredPosition === 'bottom') {
      finalPosition = (spaceBelow >= tooltipHeight + gap || spaceBelow > spaceAbove) ? 'bottom' : 'top';
    } else if (preferredPosition === 'top') {
      finalPosition = (spaceAbove >= tooltipHeight + gap || spaceAbove > spaceBelow) ? 'top' : 'bottom';
    } else {
      // Auto: prefer top, fallback to bottom if clipped
      finalPosition = spaceAbove >= tooltipHeight + gap + 4 ? 'top' : 'bottom';
    }

    if (finalPosition === 'top' || finalPosition === 'bottom') {
      if (finalPosition === 'top') {
        top = rect.top - tooltipHeight - gap;
      } else {
        top = rect.bottom + gap;
      }

      // Center horizontally over target
      const targetCenterX = rect.left + rect.width / 2;
      left = targetCenterX - tooltipWidth / 2;

      // Viewport edge containment
      const clampedLeft = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
      arrowLeft = Math.max(12, Math.min(targetCenterX - clampedLeft, tooltipWidth - 12));
      left = clampedLeft;
    } else {
      // Clamping for horizontal positions
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));
    }

    // Ensure within vertical viewport
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

    return {
      visible: true,
      text: rawText,
      rect,
      position: finalPosition,
      top,
      left,
      arrowLeft,
    };
  }, []);

  const hideTooltip = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    activeTargetRef.current = null;
    setTooltipState(prev => prev.visible ? { ...prev, visible: false } : prev);
    lastActiveTimestampRef.current = Date.now();
  }, []);

  const showTooltipForElement = useCallback((targetEl) => {
    if (!targetEl || typeof window === 'undefined') return;

    // Check for title or data-tooltip
    let text = targetEl.getAttribute('data-tooltip');

    // If element has title, migrate it immediately to data-tooltip & remove native title
    if (targetEl.hasAttribute('title')) {
      const rawTitle = targetEl.getAttribute('title');
      if (rawTitle && rawTitle.trim()) {
        text = rawTitle.trim();
        targetEl.setAttribute('data-tooltip', text);
      }
      targetEl.removeAttribute('title');
      if (!targetEl.getAttribute('aria-label') && text) {
        targetEl.setAttribute('aria-label', text);
      }
    }

    if (!text || !text.trim()) {
      hideTooltip();
      return;
    }

    activeTargetRef.current = targetEl;

    // If user recently hovered another tooltip (warm window of 350ms), show instantly
    const isWarm = (Date.now() - lastActiveTimestampRef.current) < 350;
    const delay = isWarm ? 0 : 150;

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
    }

    showTimerRef.current = setTimeout(() => {
      if (activeTargetRef.current !== targetEl) return;
      const computed = computePosition(targetEl, text);
      if (computed) {
        setTooltipState(computed);
      }
    }, delay);
  }, [computePosition, hideTooltip]);

  // Global event delegation & DOM observation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Convert existing elements with [title] on load to avoid any native popup delay
    const initialTitles = document.querySelectorAll('[title]:not(iframe):not(svg)');
    initialTitles.forEach(el => {
      const val = el.getAttribute('title');
      if (val && val.trim()) {
        el.setAttribute('data-tooltip', val.trim());
        el.removeAttribute('title');
        if (!el.getAttribute('aria-label')) {
          el.setAttribute('aria-label', val.trim());
        }
      }
    });

    // MutationObserver to convert any newly added elements with title attribute
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'title') {
          const el = m.target;
          if (el && el.hasAttribute && el.hasAttribute('title') && el.tagName !== 'IFRAME') {
            const val = el.getAttribute('title');
            if (val && val.trim()) {
              el.setAttribute('data-tooltip', val.trim());
              el.removeAttribute('title');
              if (!el.getAttribute('aria-label')) {
                el.setAttribute('aria-label', val.trim());
              }
            }
          }
        }
      }
    });

    try {
      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['title']
      });
    } catch {
      // Safe fallback if document.body isn't ready
    }

    // Pointer / mouseover handler
    const handleMouseOver = (e) => {
      // Don't activate on touch events
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

      const trigger = e.target?.closest?.('[data-tooltip], [title]');
      if (!trigger || trigger.tagName === 'IFRAME') {
        if (activeTargetRef.current && !activeTargetRef.current.contains(e.target)) {
          hideTooltip();
        }
        return;
      }

      if (activeTargetRef.current === trigger) return;
      showTooltipForElement(trigger);
    };

    const handleMouseOut = (e) => {
      if (!activeTargetRef.current) return;
      const related = e.relatedTarget;
      if (related && activeTargetRef.current.contains(related)) return;
      hideTooltip();
    };

    const handleFocusIn = (e) => {
      const trigger = e.target?.closest?.('[data-tooltip], [title]');
      if (trigger && trigger.tagName !== 'IFRAME') {
        showTooltipForElement(trigger);
      }
    };

    const handleFocusOut = () => {
      hideTooltip();
    };

    const handleDismissAction = () => {
      hideTooltip();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        hideTooltip();
      }
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('pointerdown', handleDismissAction, true);
    document.addEventListener('scroll', handleDismissAction, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('pointerdown', handleDismissAction, true);
      document.removeEventListener('scroll', handleDismissAction, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, [showTooltipForElement, hideTooltip]);

  // Re-measure on state update to ensure perfectly centered alignment
  useEffect(() => {
    if (tooltipState.visible && activeTargetRef.current && tooltipRef.current) {
      const computed = computePosition(activeTargetRef.current, tooltipState.text);
      if (
        computed &&
        (Math.abs(computed.top - tooltipState.top) > 1 ||
         Math.abs(computed.left - tooltipState.left) > 1 ||
         Math.abs(computed.arrowLeft - tooltipState.arrowLeft) > 1)
      ) {
        setTooltipState(computed);
      }
    }
  }, [tooltipState.visible, tooltipState.text, computePosition, tooltipState.top, tooltipState.left, tooltipState.arrowLeft]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      aria-hidden={!tooltipState.visible}
      className={`fixed z-[999999] pointer-events-none select-none transition-all duration-150 ease-out ${
        tooltipState.visible
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-95 pointer-events-none'
      }`}
      style={{
        top: `${tooltipState.top}px`,
        left: `${tooltipState.left}px`,
        maxWidth: 'calc(100vw - 20px)',
      }}
    >
      <div
        className="relative max-w-xs sm:max-w-sm px-2.5 py-1.5 rounded-lg text-[11px] sm:text-[11.5px] font-medium leading-tight tracking-normal break-words antialiased text-center"
        style={{
          backgroundColor: '#090d16',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.65), 0 4px 10px -2px rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        {/* Pointer Caret */}
        {tooltipState.position === 'top' && (
          <div
            className="absolute -bottom-[4.5px] -translate-x-1/2 w-2 h-2 rotate-45 border-b border-r"
            style={{
              left: `${tooltipState.arrowLeft || 16}px`,
              backgroundColor: '#090d16',
              borderColor: 'rgba(255, 255, 255, 0.22)',
            }}
          />
        )}
        {tooltipState.position === 'bottom' && (
          <div
            className="absolute -top-[4.5px] -translate-x-1/2 w-2 h-2 rotate-45 border-t border-l"
            style={{
              left: `${tooltipState.arrowLeft || 16}px`,
              backgroundColor: '#090d16',
              borderColor: 'rgba(255, 255, 255, 0.22)',
            }}
          />
        )}
        {tooltipState.position === 'left' && (
          <div
            className="absolute -right-[4.5px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 border-t border-r"
            style={{
              backgroundColor: '#090d16',
              borderColor: 'rgba(255, 255, 255, 0.22)',
            }}
          />
        )}
        {tooltipState.position === 'right' && (
          <div
            className="absolute -left-[4.5px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 border-b border-l"
            style={{
              backgroundColor: '#090d16',
              borderColor: 'rgba(255, 255, 255, 0.22)',
            }}
          />
        )}

        {/* Formatted Content */}
        {renderTooltipContent(tooltipState.text)}
      </div>
    </div>,
    document.body
  );
}

/**
 * Convenient React Wrapper: <Tooltip content="Browse archives" position="top"><button .../></Tooltip>
 */
export function Tooltip({ content, position = 'top', kbd, children, className = '' }) {
  if (!content) return children;

  return React.cloneElement(React.Children.only(children), {
    'data-tooltip': content,
    'data-tooltip-position': position,
    ...(kbd ? { 'data-tooltip-kbd': kbd } : {}),
    className: `${children.props.className || ''} ${className}`.trim(),
  });
}
