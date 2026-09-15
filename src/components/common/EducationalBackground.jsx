import React from 'react';

/**
 * EducationalBackground
 * A colorful, professional, and appealing educational background component.
 * Features:
 * - Ambient multi-tonal auroras (Teal, Amber, Sky, Indigo, Rose)
 * - Scholastic notebook / math grid texture
 * - Crisp educational vector watermarks (Graduation Cap, Book of Knowledge,
 *   Atom orbitals, Microscope, Drafting Compass, Quill, Globe, Award Trophy)
 * - Mathematical and scientific formula glyphs
 * - 100% responsive, non-blocking (pointer-events-none), and accessible
 */
export default function EducationalBackground({ variant = 'default', className = '' }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none overflow-hidden -z-10 isolate ${className}`}
      aria-hidden="true"
    >
      {/* ── Layer 1: Ambient Scholastic Color Glows (Aurora Mesh) ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-teal-50/80 via-white/40 to-amber-50/50 dark:opacity-0 transition-opacity duration-300" />

      {/* Top-Left: Emerald/Teal Wisdom Glow */}
      <div
        className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-teal-400/18 via-emerald-300/15 to-transparent blur-3xl animate-edu-pulse"
      />

      {/* Top-Right: Warm Golden Amber Creativity Glow */}
      <div
        className="absolute -top-28 -right-28 w-[32rem] h-[32rem] rounded-full bg-gradient-to-bl from-amber-400/18 via-orange-300/12 to-transparent blur-3xl animate-edu-float"
      />

      {/* Middle-Left: Intellectual Sky/Cyan Glow */}
      <div
        className="absolute top-[35%] -left-36 w-[26rem] h-[26rem] rounded-full bg-gradient-to-r from-cyan-400/14 via-sky-300/10 to-transparent blur-3xl animate-edu-float-delayed"
      />

      {/* Middle-Right: Royal Indigo/Violet Knowledge Glow */}
      <div
        className="absolute top-[48%] -right-32 w-[30rem] h-[30rem] rounded-full bg-gradient-to-l from-indigo-400/14 via-purple-300/10 to-transparent blur-3xl animate-edu-float"
      />

      {/* Bottom-Center / Right: Welcoming Rose/Emerald Fusion */}
      <div
        className="absolute -bottom-24 left-[20%] w-[36rem] h-[36rem] rounded-full bg-gradient-to-t from-teal-300/15 via-emerald-200/10 to-transparent blur-3xl animate-edu-pulse"
      />

      {/* ── Layer 2: Scholastic Math & Notebook Grid Texture ── */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.045] mix-blend-multiply dark:mix-blend-screen dark:opacity-[0.05]"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          {/* 48px Math / Engineering Graph Grid */}
          <pattern id="edu-math-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="#0f766e"
              strokeWidth="0.8"
            />
            {/* Soft intersection dot */}
            <circle cx="0" cy="0" r="1.5" fill="#0f766e" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#edu-math-grid)" />
      </svg>

      {/* ── Layer 3: Curated Educational Vector Watermarks & Floating Elements ── */}
      
      {/* 1. TOP-LEFT: Academic Graduation Cap (Mortarboard) with Tassel */}
      <div className="absolute top-8 left-4 sm:left-12 lg:left-20 opacity-20 hover:opacity-30 transition-opacity animate-edu-float">
        <svg
          width="110"
          height="90"
          viewBox="0 0 120 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-teal-700 drop-shadow-sm"
        >
          {/* Mortarboard Diamond Top */}
          <polygon
            points="60,15 112,38 60,60 8,38"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Skullcap underneath */}
          <path
            d="M30 47 V66 C30 76 90 76 90 66 V47"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Center Button */}
          <circle cx="60" cy="38" r="3.5" fill="currentColor" />
          {/* Tassel string and dangling tassel */}
          <path
            d="M60 38 Q82 45 92 62"
            fill="none"
            stroke="#d97706"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon
            points="90,62 94,62 96,78 88,78"
            fill="#d97706"
            stroke="#b45309"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* 2. TOP-RIGHT: Open Book of Knowledge with Radiant Rays */}
      <div className="absolute top-10 right-4 sm:right-12 lg:right-24 opacity-20 hover:opacity-30 transition-opacity animate-edu-float-delayed">
        <svg
          width="120"
          height="100"
          viewBox="0 0 120 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-amber-600 drop-shadow-sm"
        >
          {/* Radiant knowledge rays above */}
          <line x1="60" y1="12" x2="60" y2="4" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="42" y1="18" x2="36" y2="12" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          <line x1="78" y1="18" x2="84" y2="12" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          <line x1="28" y1="28" x2="20" y2="26" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          <line x1="92" y1="28" x2="100" y2="26" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />

          {/* Left Page */}
          <path
            d="M60 76 C45 68 25 68 12 73 V38 C25 33 45 33 60 41 Z"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          {/* Right Page */}
          <path
            d="M60 76 C75 68 95 68 108 73 V38 C95 33 75 33 60 41 Z"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          {/* Book Spine */}
          <line x1="60" y1="41" x2="60" y2="77" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          {/* Page lines left */}
          <line x1="22" y1="46" x2="50" y2="49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
          <line x1="22" y1="54" x2="48" y2="57" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
          <line x1="24" y1="62" x2="46" y2="65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
          {/* Page lines right */}
          <line x1="70" y1="49" x2="98" y2="46" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
          <line x1="72" y1="57" x2="98" y2="54" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
          <line x1="74" y1="65" x2="96" y2="62" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.4" />
        </svg>
      </div>

      {/* 3. MIDDLE-LEFT (DESKTOP): Science Atom & Molecule Orbitals (Physics/Chemistry) */}
      <div className="hidden md:block absolute top-[28%] left-6 lg:left-14 opacity-20 hover:opacity-30 transition-opacity">
        <svg
          width="130"
          height="130"
          viewBox="0 0 130 130"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-cyan-700 animate-edu-spin-slow"
        >
          {/* Central Nucleus */}
          <circle cx="65" cy="65" r="9" fill="#0891b2" fillOpacity="0.3" stroke="#0891b2" strokeWidth="2.5" />
          <circle cx="65" cy="65" r="4" fill="#0e7490" />
          {/* Orbit 1 - Horizontal */}
          <ellipse
            cx="65"
            cy="65"
            rx="56"
            ry="18"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeDasharray="4 2"
          />
          <circle cx="115" cy="65" r="4" fill="#0891b2" />
          {/* Orbit 2 - Tilted 60 deg */}
          <g transform="rotate(60 65 65)">
            <ellipse
              cx="65"
              cy="65"
              rx="56"
              ry="18"
              stroke="#0d9488"
              strokeWidth="2.2"
            />
            <circle cx="18" cy="65" r="4" fill="#0d9488" />
          </g>
          {/* Orbit 3 - Tilted 120 deg */}
          <g transform="rotate(120 65 65)">
            <ellipse
              cx="65"
              cy="65"
              rx="56"
              ry="18"
              stroke="#6366f1"
              strokeWidth="2.2"
            />
            <circle cx="112" cy="65" r="4" fill="#6366f1" />
          </g>
        </svg>
      </div>

      {/* 4. MIDDLE-RIGHT (DESKTOP): Laboratory Microscope & Erlenmeyer Flask */}
      <div className="hidden md:block absolute top-[32%] right-6 lg:right-16 opacity-20 hover:opacity-30 transition-opacity animate-edu-float">
        <svg
          width="110"
          height="120"
          viewBox="0 0 110 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-teal-700"
        >
          {/* Microscope Base */}
          <rect x="25" y="105" width="60" height="8" rx="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.5" />
          {/* Curved Arm */}
          <path
            d="M68 105 C75 90 85 65 72 45 C65 35 55 35 48 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Body Tube / Eyepiece */}
          <rect x="36" y="15" width="12" height="30" rx="3" transform="rotate(-30 36 15)" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5" />
          <line x1="38" y1="12" x2="52" y2="4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          {/* Objective Lens */}
          <polygon points="56,48 50,56 58,60 62,52" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
          {/* Stage */}
          <rect x="30" y="70" width="38" height="5" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="2" />
          {/* Specimen Slide */}
          <rect x="42" y="66" width="14" height="4" rx="1" fill="#06b6d4" />
          {/* Substage Mirror / Light */}
          <circle cx="50" cy="90" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* 5. LOWER-LEFT (DESKTOP): Drafting Compass & Set Square Triangle Ruler (Mathematics) */}
      <div className="hidden lg:block absolute top-[62%] left-10 opacity-20 hover:opacity-30 transition-opacity animate-edu-float-delayed">
        <svg
          width="115"
          height="115"
          viewBox="0 0 115 115"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-indigo-700"
        >
          {/* Triangle Ruler (Set Square) */}
          <polygon
            points="10,105 10,25 90,105"
            fill="currentColor"
            fillOpacity="0.1"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Triangle Ruler Inner Cutout */}
          <polygon
            points="24,95 24,52 67,95"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Ruler millimeter tick marks */}
          <line x1="10" y1="35" x2="16" y2="35" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="45" x2="20" y2="45" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="55" x2="16" y2="55" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="65" x2="20" y2="65" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="75" x2="16" y2="75" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="85" x2="20" y2="85" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="95" x2="16" y2="95" stroke="currentColor" strokeWidth="1.5" />

          {/* Drafting Compass Hinge and Legs */}
          <circle cx="70" cy="25" r="4.5" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
          <line x1="70" y1="25" x2="52" y2="75" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
          <line x1="70" y1="25" x2="95" y2="75" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
          {/* Arc Gauge between legs */}
          <path d="M58 60 Q72 68 87 60" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="2 2" />
        </svg>
      </div>

      {/* 6. LOWER-RIGHT (DESKTOP): Feather Quill & Parchment Scroll (Humanities / Arts) */}
      <div className="hidden lg:block absolute top-[65%] right-12 opacity-20 hover:opacity-30 transition-opacity animate-edu-float">
        <svg
          width="115"
          height="115"
          viewBox="0 0 115 115"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-amber-700"
        >
          {/* Rolled Diploma / Certificate Scroll */}
          <rect
            x="20"
            y="55"
            width="65"
            height="32"
            rx="4"
            transform="rotate(-15 20 55)"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          {/* Ribbon around scroll */}
          <path
            d="M52 42 L46 64 L56 62 Z"
            fill="#e11d48"
            stroke="#be123c"
            strokeWidth="1.5"
          />
          {/* Classical Feather Quill */}
          <path
            d="M92 15 C85 28 65 52 40 82 L35 88 L42 84 C62 65 82 45 92 15 Z"
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Quill spine vane */}
          <path
            d="M92 15 Q68 50 35 88"
            fill="none"
            stroke="#92400e"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Ink droplets */}
          <circle cx="30" cy="94" r="2.5" fill="#0f172a" fillOpacity="0.5" />
        </svg>
      </div>

      {/* 7. BOTTOM-LEFT: World Globe with Stand (Social Sciences, Broad Horizons) */}
      <div className="absolute bottom-12 left-4 sm:left-14 opacity-18 hover:opacity-25 transition-opacity">
        <svg
          width="95"
          height="110"
          viewBox="0 0 95 110"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-emerald-700"
        >
          {/* Globe Pedestal Stand */}
          <path d="M48 85 V98 M30 98 H66" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          {/* Semi-circular Support Arm */}
          <path
            d="M20 50 C20 68 34 82 52 82 C65 82 76 74 80 62"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Globe Sphere */}
          <circle cx="48" cy="46" r="28" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2.5" />
          {/* Equator & Latitude */}
          <ellipse cx="48" cy="46" rx="28" ry="10" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2" fill="none" />
          {/* Meridian Curve */}
          <ellipse cx="48" cy="46" rx="13" ry="28" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
      </div>

      {/* 8. BOTTOM-RIGHT: Academic Trophy / Gold Star of Merit (Excellence) */}
      <div className="absolute bottom-12 right-4 sm:right-16 opacity-18 hover:opacity-25 transition-opacity animate-edu-float-delayed">
        <svg
          width="95"
          height="105"
          viewBox="0 0 95 105"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-amber-600"
        >
          {/* Trophy Cup */}
          <path
            d="M30 18 H65 V42 C65 52 57 60 47.5 60 C38 60 30 52 30 42 Z"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Left Handle */}
          <path d="M30 24 H22 C17 24 17 38 23 42 H30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          {/* Right Handle */}
          <path d="M65 24 H73 C78 24 78 38 72 42 H65" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          {/* Stem & Pedestal Base */}
          <path d="M47.5 60 V78 M32 78 H63 V88 H32 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          {/* Star on Trophy Cup */}
          <polygon
            points="47.5,28 49.5,34 56,34 50.5,38 52.5,44 47.5,40 42.5,44 44.5,38 39,34 45.5,34"
            fill="#f59e0b"
            stroke="#d97706"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* ── Layer 4: Subtle Floating Formula & Learning Badges (Mobile & Desktop) ── */}
      <div className="hidden sm:flex absolute top-48 left-[15%] items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/75 backdrop-blur-xs border border-teal-200/60 text-teal-800 text-[11px] font-mono font-bold shadow-xs opacity-40">
        <span>∑ (n=1 to ∞)</span>
      </div>

      <div className="hidden sm:flex absolute top-52 right-[18%] items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/75 backdrop-blur-xs border border-amber-200/60 text-amber-800 text-[11px] font-mono font-bold shadow-xs opacity-40">
        <span>E = mc²</span>
      </div>

      <div className="hidden lg:flex absolute top-[75%] left-[22%] items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/75 backdrop-blur-xs border border-indigo-200/60 text-indigo-800 text-[11px] font-mono font-bold shadow-xs opacity-40">
        <span>π ≈ 3.14159</span>
      </div>

      <div className="hidden lg:flex absolute top-[78%] right-[24%] items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/75 backdrop-blur-xs border border-emerald-200/60 text-emerald-800 text-[11px] font-mono font-bold shadow-xs opacity-40">
        <span>∫ f(x) dx</span>
      </div>
    </div>
  );
}
