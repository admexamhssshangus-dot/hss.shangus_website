import React, { useState } from 'react';
import { Trophy, Award, GraduationCap, Medal, Sparkles } from 'lucide-react';

/**
 * HonoreePhotoAvatar Component
 * 
 * Renders an ultra-premium, animated student portrait badge with:
 * - Glowing dual-tone gradient rings (Gold/Amber for National Competitive & UT Toppers, Indigo/Blue for Board Positions)
 * - Shimmer skeleton loading state
 * - Smooth hover zoom micro-animation
 * - Floating corner achievement pin badge (Trophy / Medal / Graduation Cap)
 * - Royal Monogram Crest fallback with rich multi-stop gradients and subtle laurels
 * - Zero broken images: seamless graceful fallback
 */
export default function HonoreePhotoAvatar({
  item,
  size = 'md',
  className = '',
  showBadge = true
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!item) return null;

  const isCompetitive = item.category === 'competitive';
  const isUtPosition = Boolean(item.isUtPositionHolder);

  // Extract candidate initials (e.g. "Zaidan Wani" -> "ZW")
  const rawName = String(item.studentName || item.name || 'Honoree').trim();
  const initials = rawName
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase() || 'H';

  // Dimension presets
  const sizeClasses = {
    sm: 'w-11 h-11 rounded-xl',
    md: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl',
    lg: 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl',
    xl: 'w-24 h-24 sm:w-28 sm:h-28 rounded-3xl'
  };

  const ringClasses = isCompetitive
    ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 p-[2.5px] shadow-md shadow-amber-500/20 group-hover:shadow-amber-500/40 group-hover:ring-2 group-hover:ring-amber-300/60'
    : 'bg-gradient-to-tr from-indigo-500 via-blue-400 to-purple-600 p-[2.5px] shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 group-hover:ring-2 group-hover:ring-indigo-300/60';

  const badgeIcon = isUtPosition ? (
    <Trophy size={size === 'xl' ? 14 : 11} className="text-amber-900 fill-amber-500" />
  ) : isCompetitive ? (
    <GraduationCap size={size === 'xl' ? 14 : 11} className="text-amber-900" />
  ) : (
    <Medal size={size === 'xl' ? 14 : 11} className="text-indigo-900 fill-indigo-400" />
  );

  const badgeBg = isCompetitive
    ? 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 border-white dark:border-slate-900 text-amber-950 shadow-sm'
    : 'bg-gradient-to-br from-indigo-200 via-blue-300 to-indigo-400 border-white dark:border-slate-900 text-indigo-950 shadow-sm';

  const photoUrl = (item.photoUrl && typeof item.photoUrl === 'string' && item.photoUrl.trim() !== '' && item.photoUrl !== '/logo.png')
    ? item.photoUrl.trim()
    : null;

  const hasValidPhoto = photoUrl && !imageError;

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {/* Outer Glowing Gradient Frame with Hover Micro-Animation */}
      <div
        className={`${sizeClasses[size] || sizeClasses.md} ${ringClasses} transition-all duration-300 ease-out transform group-hover:scale-[1.04]`}
      >
        <div className="w-full h-full rounded-[inherit] overflow-hidden bg-white dark:bg-slate-900 relative flex items-center justify-center">
          {/* Active Photo State */}
          {hasValidPhoto ? (
            <>
              {/* Skeleton Pulse while loading */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
                  <Sparkles size={14} className="text-amber-400/60 animate-spin" />
                </div>
              )}
              <img
                src={photoUrl}
                alt={rawName}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-110 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </>
          ) : (
            /* Regal Monogram Crest Fallback */
            <div
              className={`w-full h-full flex flex-col items-center justify-center relative overflow-hidden ${
                isCompetitive
                  ? 'bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 text-white'
                  : 'bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 text-white'
              }`}
            >
              {/* Subtle decorative background ring */}
              <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border border-white/40 border-dashed animate-[spin_20s_linear_infinite]" />
              </div>

              {/* Monogram Initials */}
              <span
                className={`font-black tracking-wider leading-none drop-shadow-sm select-none z-10 ${
                  size === 'xl' ? 'text-2xl sm:text-3xl' : size === 'lg' ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
                }`}
              >
                {initials}
              </span>

              {/* Sub-label for large views */}
              {size === 'xl' && (
                <span className="text-[9px] uppercase tracking-widest font-extrabold opacity-80 mt-1 z-10">
                  Honoree
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Corner Achievement Pin Badge */}
      {showBadge && (
        <div
          className={`absolute -bottom-1 -right-1 rounded-full p-1 border-2 flex items-center justify-center ${badgeBg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}
          title={isUtPosition ? 'J&K UT State Position Holder' : item.badge || 'Honoree'}
        >
          {badgeIcon}
        </div>
      )}
    </div>
  );
}
