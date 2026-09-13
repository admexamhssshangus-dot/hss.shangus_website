import React from 'react';

/**
 * JkboseFieldBadge: A minute, ultra-compact visual indicator badge displayed beside
 * table column values or in field headers to clearly indicate that this student input
 * was overwritten/verified as per JKBOSE Board records.
 *
 * @param {Object} props
 * @param {Object} props.info - Status object from getJkboseFieldStatus()
 * @param {string} [props.className] - Additional Tailwind classes
 * @param {string} [props.customTitle] - Optional custom tooltip text
 * @param {boolean} [props.minimal] - If true, renders just the pulsing micro-dot with tooltip
 */
export default function JkboseFieldBadge({
  info,
  className = '',
  customTitle,
  minimal = false
}) {
  if (!info || !info.isUpdated) return null;

  const dateStr = info.timestamp ? new Date(info.timestamp).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) : '';

  const timeStr = info.timestamp ? new Date(info.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  let tooltip = customTitle;
  if (!tooltip) {
    tooltip = 'Changed as per JKBOSE Board data';
    if (info.oldValue !== undefined && info.newValue !== undefined && String(info.oldValue).trim() !== String(info.newValue).trim()) {
      const displayOld = String(info.oldValue).trim() || '(blank)';
      const displayNew = String(info.newValue).trim() || '(blank)';
      tooltip += `: "${displayOld}" → "${displayNew}"`;
    }
    if (info.source) {
      tooltip += ` (Source: ${info.source})`;
    }
    if (dateStr) {
      tooltip += ` • ${dateStr}${timeStr ? ` ${timeStr}` : ''}`;
    }
  }

  if (minimal) {
    return (
      <span
        className={`inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950 cursor-help select-none shrink-0 ${className}`}
        title={tooltip}
        aria-label="Updated as per JKBOSE record"
      >
        <span className="w-1 h-1 rounded-full bg-white dark:bg-slate-900 animate-pulse" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] text-[7.5px] font-black uppercase tracking-wider bg-emerald-50/95 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/80 leading-none select-none cursor-help shadow-2xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:scale-105 transition-all shrink-0 align-middle ${className}`}
      title={tooltip}
      aria-label="Updated as per JKBOSE data"
    >
      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
      JKBOSE
    </span>
  );
}
