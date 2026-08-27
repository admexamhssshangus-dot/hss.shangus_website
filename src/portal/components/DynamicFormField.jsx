import React, { useId, useState, useMemo, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, Camera, X, Loader2, Calendar, ChevronDown, Plus, BookOpen, Layers, Sparkles, Lock, ShieldCheck } from 'lucide-react';
import StandardTooltip from '../../components/StandardTooltip';
import compressStudentPhoto, { formatPhotoDisplayUrl } from '../../utils/imageCompressor';
import { MIN_ADMISSION_AGE, isValidAadhaar, isPersonNameField, sanitizePersonName, validatePersonName } from '../../utils/admissionValidation';
import { validateSubjectSelection, normalizeSubjectTitle } from '../student/AdmissionForm';
import { DEFAULT_FEEDER_SCHOOLS, getCachedFeederSchools, loadFeederSchools } from '../../utils/feederSchoolsManager';

const PREVIOUS_SCHOOLS = DEFAULT_FEEDER_SCHOOLS;

// Dictionary of domain abbreviations and synonyms for Google-like smart search
const SCHOOL_SYNONYM_MAP = {
  hss: ['higher secondary school', 'hr sec school', 'hr sec', 'higher secondary', 'hss'],
  ghss: ['govt higher secondary school', 'govt hr sec school', 'girls higher secondary school', 'ghss'],
  gbhss: ['govt boys higher secondary school', 'govt boys hr sec school', 'gbhss'],
  gghss: ['govt girls higher secondary school', 'govt girls hr sec school', 'gghss'],
  hs: ['high school', 'high sch', 'hs'],
  ghs: ['govt high school', 'girls high school', 'govt girls high school', 'ghs'],
  bhs: ['boys high school', 'govt boys high school', 'bhs'],
  gbhs: ['govt boys high school', 'gbhs'],
  gghs: ['govt girls high school', 'gghs'],
  sec: ['secondary', 'sec'],
  higher: ['higher', 'hr'],
  secondary: ['secondary', 'sec'],
  hr: ['higher', 'hr'],
  school: ['school', 'sch', 'sc'],
  sch: ['school', 'sch', 'sc'],
  sc: ['school', 'sch', 'sc'],
  govt: ['government', 'govt', 'gvt'],
  gvt: ['government', 'govt'],
  inst: ['institute', 'institution', 'instt', 'inst'],
  instt: ['institute', 'institution', 'instt', 'inst'],
  jnv: ['jawahar navodaya vidyalaya', 'pm shri school jawahar navodaya vidyalaya', 'jnv'],
  nios: ['national institute of open schooling', 'nios'],
  mps: ['modern public school', 'mps'],
  smi: ['sheikhulalam memorial institute', 'smi'],
  hmi: ['hanfia memorial institute', 'hmi'],
  eps: ['elite public school', 'eps'],
  bps: ['badasgam public school', 'bps'],
  sps: ['shaheen public school', 'sps'],
  kie: ['kie hr sec school', 'kie'],
  kp: ['k p road', 'k.p. road', 'kp'],
};

function normalizeSchoolSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSchoolAcronyms(schoolName) {
  const norm = normalizeSchoolSearchText(schoolName);
  const words = norm.split(' ').filter(Boolean);
  if (!words.length) return [];

  const initials = words.map(w => w[0]).join('');
  const nonGovtWords = words.filter(w => w !== 'govt' && w !== 'government');
  const nonGovtInitials = nonGovtWords.map(w => w[0]).join('');

  const acronyms = [initials, nonGovtInitials];

  if (norm.includes('higher secondary') || norm.includes('hr sec')) {
    acronyms.push('hss', 'ghss', 'gbhss', 'gghss');
  }
  if (norm.includes('high school')) {
    acronyms.push('hs', 'ghs', 'bhs', 'gbhs', 'gghs');
  }
  if (norm.includes('jawahar navodaya')) acronyms.push('jnv');
  if (norm.includes('open schooling')) acronyms.push('nios');
  if (norm.includes('modern public')) acronyms.push('mps');
  if (norm.includes('sheikhulalam')) acronyms.push('smi');
  if (norm.includes('hanfia memorial')) acronyms.push('hmi');
  if (norm.includes('elite public')) acronyms.push('eps');
  if (norm.includes('shaheen public')) acronyms.push('sps');

  return [...new Set(acronyms.filter(Boolean))];
}

export function scoreSchoolMatch(schoolName, rawQuery) {
  if (!rawQuery || !rawQuery.trim()) return 1;

  const cleanQuery = normalizeSchoolSearchText(rawQuery);
  const cleanSchool = normalizeSchoolSearchText(schoolName);

  // Exact match
  if (cleanSchool === cleanQuery) return 1000;

  // Direct substring match
  if (cleanSchool.includes(cleanQuery)) {
    if (cleanSchool.startsWith(cleanQuery)) return 800;
    return 500;
  }

  // Canonicalized school text (expand "hr sec" -> "higher secondary hss hr sec", "instt" -> "institute", etc.)
  const expandedSchool = cleanSchool
    .replace(/\bhr\s+sec\b/g, 'higher secondary hss hr sec')
    .replace(/\bhigher\s+secondary\b/g, 'hr sec hss higher secondary')
    .replace(/\bhigh\s+school\b/g, 'hs high school')
    .replace(/\bgovt\b/g, 'government govt')
    .replace(/\binstt\b/g, 'institute');

  const queryTokens = cleanQuery.split(' ').filter(Boolean);
  const acronyms = getSchoolAcronyms(schoolName);

  let totalScore = 0;
  let allTokensMatched = true;

  for (const token of queryTokens) {
    let tokenMatched = false;

    // 1. Direct word substring match
    if (cleanSchool.includes(token) || expandedSchool.includes(token)) {
      tokenMatched = true;
      totalScore += 100;
    }

    // 2. Acronym match (e.g. token "hss", "ghss", "jnv", "nios", "mps")
    if (!tokenMatched) {
      if (acronyms.some(ac => ac.includes(token) || token.includes(ac))) {
        tokenMatched = true;
        totalScore += 90;
      }
    }

    // 3. Synonym dictionary expansion
    if (!tokenMatched && SCHOOL_SYNONYM_MAP[token]) {
      const syns = SCHOOL_SYNONYM_MAP[token];
      if (syns.some(syn => cleanSchool.includes(syn) || expandedSchool.includes(syn))) {
        tokenMatched = true;
        totalScore += 80;
      }
    }

    if (!tokenMatched) {
      allTokensMatched = false;
      break;
    }
  }

  if (!allTokensMatched) return 0;
  return totalScore;
}

const CURRENT_YEAR = new Date().getFullYear();
const SUGGESTED_PASSING_YEARS = Array.from({ length: 25 }, (_, i) => String(CURRENT_YEAR - i));
const QUICK_SELECT_YEARS = [
  String(CURRENT_YEAR),
  String(CURRENT_YEAR - 1),
  String(CURRENT_YEAR - 2),
  String(CURRENT_YEAR - 3),
  String(CURRENT_YEAR - 4),
  String(CURRENT_YEAR - 5)
];

const COMPLEX_HEAD_SUGGESTIONS = [
  'Govt. Higher Secondary School Shangus',
  'Govt. Boys Higher Secondary School Anantnag',
  'Govt. Girls Higher Secondary School Anantnag',
  'Govt. Higher Secondary School Achabal',
  'Govt. Higher Secondary School Utrasoo',
  'Govt. Higher Secondary School Chittergul',
  'Govt. Higher Secondary School Nowgam',
  'Govt. Higher Secondary School Ranipora',
  'Govt. Higher Secondary School Krad',
  'Govt. Higher Secondary School Brakpora',
  'Govt. Higher Secondary School Dialgam',
  'Govt. Higher Secondary School Mattan'
];

const BOARD_SUGGESTIONS = ['JKBOSE', 'CBSE', 'ICSE', 'DIET', 'NIOS', 'Other'];
const MAX_MARKS_PRESETS = ['500', '600', '700', '800', '1000', '1200'];

const MONTHS = [
  { val: '01', name: '01 - Jan' },
  { val: '02', name: '02 - Feb' },
  { val: '03', name: '03 - Mar' },
  { val: '04', name: '04 - Apr' },
  { val: '05', name: '05 - May' },
  { val: '06', name: '06 - Jun' },
  { val: '07', name: '07 - Jul' },
  { val: '08', name: '08 - Aug' },
  { val: '09', name: '09 - Sep' },
  { val: '10', name: '10 - Oct' },
  { val: '11', name: '11 - Nov' },
  { val: '12', name: '12 - Dec' },
];

/**
 * Separates the raw field label from qualifiers like "(as per school records)".
 */
function getLabelDisplay(name = '') {
  const match = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) {
    return {
      mainLabel: name,
      badge: null,
      cleanPlaceholder: `Enter ${name}`,
    };
  }

  const mainLabel = match[1].trim();
  const rawTag = match[2].trim();
  const lowerTag = rawTag.toLowerCase();

  let badge = null;
  if (lowerTag.includes('school record')) {
    badge = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 tracking-tight" title="Must match Class 10th / School marks card exactly">
        📋 as per school records
      </span>
    );
  } else if (lowerTag.includes('whatsapp') || lowerTag.includes('working')) {
    badge = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 tracking-tight" title="Must be an active working number">
        📱 WhatsApp active
      </span>
    );
  } else if (lowerTag.includes('udise')) {
    badge = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30 tracking-tight">
        🏫 UDISE portal
      </span>
    );
  } else if (lowerTag.includes('if any') || lowerTag.includes('optional') || lowerTag.includes('if available')) {
    badge = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 tracking-tight">
        optional
      </span>
    );
  } else {
    badge = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 tracking-tight">
        {rawTag}
      </span>
    );
  }

  return {
    mainLabel,
    badge,
    cleanPlaceholder: `Enter ${mainLabel}`,
  };
}

/**
 * Modern DD-MM-YYYY Date Component with live age preview & native calendar integration.
 */
function ModernDateInput({ id, value, onChange, disabled, required, error, inputStyle, targetClass = '' }) {
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const yrs = [];
    for (let y = currentYear; y >= 1990; y--) {
      yrs.push(String(y));
    }
    return yrs;
  }, [currentYear]);

  const dateInputRef = useRef(null);

  // Helper to parse date values into {d, m, y}
  const parseVal = (val) => {
    if (!val) return { d: '', m: '', y: '' };
    const str = String(val).trim();
    if (!str) return { d: '', m: '', y: '' };

    const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

    // ISO format: YYYY-MM-DD or YYYY-3_Mar-DD
    const isoMatch = str.match(/^(\d{4})[-/](?:\d{1,2}_)?([a-zA-Z0-9]+)[-/](\d{1,2})$/);
    if (isoMatch) {
      const [, y, mStr, d] = isoMatch;
      const m = monthMap[mStr.toLowerCase()] || String(parseInt(mStr, 10) || '').padStart(2, '0');
      if (m && m.length === 2) {
        return {
          d: String(parseInt(d, 10)).padStart(2, '0'),
          m,
          y: String(parseInt(y, 10))
        };
      }
    }

    // DMY format: DD-MM-YYYY or DD-3_Mar-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](?:\d{1,2}_)?([a-zA-Z0-9]+)[-/](\d{4})$/);
    if (dmyMatch) {
      const [, d, mStr, y] = dmyMatch;
      const m = monthMap[mStr.toLowerCase()] || String(parseInt(mStr, 10) || '').padStart(2, '0');
      if (m && m.length === 2) {
        return {
          d: String(parseInt(d, 10)).padStart(2, '0'),
          m,
          y: String(parseInt(y, 10))
        };
      }
    }

    return { d: '', m: '', y: '' };
  };

  const initial = parseVal(value);
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(initial.y);

  // Sync state if value changes externally (e.g. initial load or form reset)
  useEffect(() => {
    const p = parseVal(value);
    setDay(p.d);
    setMonth(p.m);
    setYear(p.y);
  }, [value]);

  const emitDate = (d, m, y) => {
    if (d && m && y && /^\d{1,2}$/.test(d) && /^\d{1,2}$/.test(m) && /^\d{4}$/.test(y)) {
      const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      onChange(iso);
    } else if (!d && !m && !y) {
      onChange('');
    }
  };

  const handleDayChange = (e) => {
    const newD = e.target.value;
    setDay(newD);
    emitDate(newD, month, year);
  };

  const handleMonthChange = (e) => {
    const newM = e.target.value;
    setMonth(newM);
    emitDate(day, newM, year);
  };

  const handleYearChange = (e) => {
    const newY = e.target.value;
    setYear(newY);
    emitDate(day, month, newY);
  };

  const handleNativePickerChange = (e) => {
    const val = e.target.value;
    if (val) {
      const p = parseVal(val);
      setDay(p.d);
      setMonth(p.m);
      setYear(p.y);
      onChange(val);
    }
  };

  const openCalendar = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  const daysInMonth = useMemo(() => {
    if (!month || !year) return 31;
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if ([4, 6, 9, 11].includes(m)) return 30;
    if (m === 2) {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return isLeap ? 29 : 28;
    }
    return 31;
  }, [month, year]);

  const dayOptions = useMemo(() => {
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(String(d).padStart(2, '0'));
    }
    return days;
  }, [daysInMonth]);

  const formattedDisplay = (day && month && year) ? `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}` : '';

  const { ageText, ageYears } = useMemo(() => {
    if (!day || !month || !year) return { ageText: '', ageYears: null };
    const dt = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (isNaN(dt.getTime())) return { ageText: '', ageYears: null };
    const now = new Date();
    let yrs = now.getFullYear() - dt.getFullYear();
    let mos = now.getMonth() - dt.getMonth();
    if (mos < 0 || (mos === 0 && now.getDate() < dt.getDate())) {
      yrs--;
      mos = (mos + 12) % 12;
    }
    if (yrs >= 0 && yrs <= 100) {
      return { ageText: `${yrs} yrs${mos > 0 ? ` ${mos} mos` : ''}`, ageYears: yrs };
    }
    return { ageText: '', ageYears: null };
  }, [day, month, year]);

  const minRequiredAge = targetClass ? MIN_ADMISSION_AGE[targetClass] : null;
  const isUnderage = minRequiredAge && ageYears !== null && ageYears < minRequiredAge;
  const isoValue = (year && month && day) ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <div className="grid grid-cols-3 gap-1 flex-1">
          {/* Day Select */}
          <select
            value={day}
            onChange={handleDayChange}
            disabled={disabled}
            required={required}
            className={`w-full px-1.5 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer truncate bg-white dark:bg-slate-900 ${isUnderage ? 'border-red-500' : ''}`}
            style={inputStyle}
            aria-label="Day"
          >
            <option value="">Day</option>
            {dayOptions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Month Select */}
          <select
            value={month}
            onChange={handleMonthChange}
            disabled={disabled}
            required={required}
            className="w-full px-1.5 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer truncate bg-white dark:bg-slate-900"
            style={inputStyle}
            aria-label="Month"
          >
            <option value="">Month</option>
            {MONTHS.map(m => (
              <option key={m.val} value={m.val}>{m.name}</option>
            ))}
          </select>

          {/* Year Select */}
          <select
            value={year}
            onChange={handleYearChange}
            disabled={disabled}
            required={required}
            className="w-full px-1.5 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer truncate bg-white dark:bg-slate-900"
            style={inputStyle}
            aria-label="Year"
          >
            <option value="">Year</option>
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Quick Native Calendar Trigger Button */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={openCalendar}
            disabled={disabled}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-teal-600 hover:border-teal-500 transition-colors cursor-pointer flex-shrink-0"
            title="Open Calendar Date Picker"
          >
            <Calendar size={14} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={isoValue}
            onChange={handleNativePickerChange}
            disabled={disabled}
            className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Date Format Helper & Live Age Guardrail Preview */}
      {formattedDisplay && (
        <div className={`flex flex-wrap items-center justify-between gap-1 px-2 py-0.5 rounded-md border text-[10px] ${
          isUnderage
            ? 'bg-red-50 dark:bg-red-950/40 border-red-500/40 text-red-700 dark:text-red-300'
            : 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-500/20 text-teal-800 dark:text-teal-300'
        }`}>
          <span className="font-bold font-mono">
            🗓️ {formattedDisplay} <span className="font-sans font-normal opacity-70 text-[9px]">(DD-MM-YYYY)</span>
          </span>
          {ageText && (
            <span className={`font-black px-1.5 py-0.2 rounded text-[9px] ${
              isUnderage
                ? 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200'
                : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
            }`}>
              {isUnderage
                ? `⚠️ Underage (${ageText}) — Min. ${minRequiredAge} yrs for Class ${targetClass}`
                : `Age: ${ageText}${targetClass ? ` (Eligible for ${targetClass})` : ''}`
              }
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SearchableSchoolCombobox — Searchable dropdown with autocomplete and "Add New School" support.
 */
function SearchableSchoolCombobox({
  id,
  value = '',
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Search previous school or type new...',
  error = null,
  errorId = null,
  inputStyle = {},
  schools = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [liveSchools, setLiveSchools] = useState(() => getCachedFeederSchools());
  const containerRef = useRef(null);

  // Sync internal search input with external value
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Load latest schools dynamically from Firestore
  useEffect(() => {
    let isMounted = true;
    loadFeederSchools().then((data) => {
      if (isMounted && Array.isArray(data) && data.length > 0) {
        setLiveSchools(data);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const activeSchools = useMemo(() => {
    return Array.isArray(schools) && schools.length > 0 ? schools : liveSchools;
  }, [schools, liveSchools]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSchools = useMemo(() => {
    const term = (searchTerm || '').trim();
    if (!term) return activeSchools;

    const scored = activeSchools
      .map((school) => ({
        school,
        score: scoreSchoolMatch(school, term)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.school);

    return scored;
  }, [searchTerm, activeSchools]);

  const isExactMatch = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return false;
    return activeSchools.some(
      s => s.toLowerCase() === term || normalizeSchoolSearchText(s) === normalizeSchoolSearchText(term)
    );
  }, [searchTerm, activeSchools]);

  const handleSelect = (schoolName) => {
    onChange(schoolName);
    setSearchTerm(schoolName);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    onChange(val);
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          placeholder={placeholder}
          className="w-full pl-3 pr-16 py-1.5 rounded-lg sm:rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
          style={inputStyle}
          autoComplete="off"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {searchTerm && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setSearchTerm('');
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Clear"
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-0.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
            title="Toggle school list"
            tabIndex={-1}
          >
            <ChevronDown size={14} className={`transition-transform duration-150 ${isOpen ? 'rotate-180 text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Search Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 animate-fadeIn">
          {/* Header count indicator */}
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <span>{filteredSchools.length} school(s) found</span>
            {searchTerm && <span className="truncate max-w-[150px]">Filter: &quot;{searchTerm}&quot;</span>}
          </div>

          {/* School list */}
          <div className="py-1">
            {filteredSchools.map((school) => {
              const isSelected = school.toLowerCase() === (value || '').toLowerCase();
              return (
                <button
                  key={school}
                  type="button"
                  onClick={() => handleSelect(school)}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate pr-2">{school}</span>
                  {isSelected && <CheckCircle2 size={13} className="text-teal-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Add Custom / New School Option if not an exact match */}
          {searchTerm && !isExactMatch && (
            <div className="p-1.5 bg-teal-50/70 dark:bg-teal-950/40">
              <button
                type="button"
                onClick={() => handleSelect(searchTerm.trim())}
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Plus size={13} className="flex-shrink-0" />
                <span className="truncate">Use &quot;{searchTerm.trim()}&quot; as new school</span>
              </button>
            </div>
          )}

          {filteredSchools.length === 0 && !searchTerm && (
            <div className="px-3 py-3 text-center text-slate-400 text-xs">
              No schools available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DynamicFormField — Renders a compact, beautifully styled form input element based on field configuration.
 */
export default function DynamicFormField({
  config,
  value = '',
  onChange,
  disabled = false,
  error = null,
  subjectsConfig = null,
  selectedStream = '',
  formData = null,
  targetClass = '',
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const name = config.fieldName || config.name || config['Field Name'];
  const type = config.fieldType || config.type || config['Field Type'] || 'text';
  const MANDATORY_FIELD_NAMES = useMemo(() => new Set([
    "Student's Name (as per school records)", "DoB (as per school records)", "Gender",
    "Father's/Guardian's Name (as per school records)", "Father's/Guardian's Occupation", "Father's Occupation",
    "Mother's Name (as per school records)", "Mother's Occupation",
    "Mobile No. (with working WhatsApp)", "Parent's Mobile No. (must be working)",
    "Aadhar No.", "Father's Aadhar No.", "Name of your village", "District",
    "Block", "Tehsil", "State/UT", "PIN code",
    "Religion", "Social category", "Whether Any Disability",
    "Bank Account No.", "Name of Bank", "IFSC code",
    'Board Registration No. (Class 10th)', 'Board Registration No. (Class 11th)',
    'Board Registration No. (Class 9th)',
    'Name of Previous School (Class 10th)', 'Name of Previous School (Class 11th)',
    'Name of Previous School (Class 8th)', 'Name of Previous School (Class 9th)',
    'Board (Class 10th)', 'Board (Class 11th)',
    'Stream for Class 11th', 'Stream opted in Class 11th',
    'Subjects Studied in Class 10th', 'Subjects Studied in Class 11th',
    'Subjects to Reappear (Class 10th)', 'Subjects to Reappear (Class 11th)',
    'Subjects to be taken in Class 11th', 'Subjects to be taken in Class 10th', 'Subjects to be taken in Class 9th',
    'Year of Passing Class 8th', 'Student Photo', 'Declaration'
  ]), []);

  const reqVal = String(config.required || config['Is Required?'] || config['Is Required'] || config.isRequired || '').trim().toUpperCase();
  const isReqByConfig = reqVal === 'TRUE' || reqVal === 'YES' || reqVal === '1' || config.required === true;
  const isReqByName = MANDATORY_FIELD_NAMES.has(name);
  const required = isReqByConfig || isReqByName;
  const optionsRaw = config.options || config['Options / Range / Length'] || '';
  const rawPlaceholder = config.placeholder || config['Placeholder'] || '';
  const hint = config.helpText || config['Help Text'] || '';

  const { mainLabel, badge, cleanPlaceholder } = useMemo(() => getLabelDisplay(name), [name]);

  // Clean raw {{Template}} tags from placeholders
  const placeholder = (rawPlaceholder && rawPlaceholder.includes('{{')) ? cleanPlaceholder : (rawPlaceholder || cleanPlaceholder);

  // Process options based on type
  let options = [];
  let min = '', max = '', length = '';

  if (type === 'list') {
    options = optionsRaw.split(',').map(o => o.trim()).filter(Boolean);
  } else if (type === 'number_range') {
    const parts = optionsRaw.split('-');
    if (parts.length === 2) {
      min = parts[0];
      max = parts[1];
    }
  } else if (type === 'text_numeric' || type === 'text') {
    length = optionsRaw; // maxLength
  }

  // Calculate live percentage badge if this is a marks field
  let calcPercentageBadge = null;
  const lowerName = (name || '').toLowerCase();
  if (formData && (lowerName.includes('marks obtained') || lowerName.includes('max. marks'))) {
    const clsMatch = name.match(/Class \d+th|Class 8th|Class 9th|Class 10th|Class 11th|Class 12th/i);
    if (clsMatch) {
      const cls = clsMatch[0];
      const obt = parseFloat(formData[`Total Marks Obtained in ${cls}`]);
      const maxVal = parseFloat(formData[`Total Max. Marks in ${cls}`] || 500);
      if (!isNaN(obt) && !isNaN(maxVal) && maxVal > 0) {
        const pct = ((obt / maxVal) * 100).toFixed(2);
        calcPercentageBadge = `${pct}%`;
      }
    }
  }

  // ── Photo/file upload state & handler ──────────────────────────────────────
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ALLOWED_EXTS       = ['.jpg', '.jpeg', '.png', '.webp'];
  const MAX_FILE_SIZE_KB   = 200;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setPhotoError(null);

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTS.includes(ext)) {
      setPhotoError(
        `Invalid format "${file.type || ext}". Only JPEG, PNG, or WebP images are allowed.`
      );
      return;
    }

    const sizeKB = file.size / 1024;
    if (sizeKB > MAX_FILE_SIZE_KB) {
      const displaySize = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;
      setPhotoError(
        `File too large (${displaySize}). Maximum allowed photo size is ${MAX_FILE_SIZE_KB} KB.`
      );
      return;
    }

    setPhotoProcessing(true);
    try {
      const dataUrl = await compressStudentPhoto(file, 300, 360, 0.82);
      if (!dataUrl || !dataUrl.startsWith('data:image/')) throw new Error('Image compression failed');
      onChange(name, dataUrl);
    } catch (err) {
      console.error('Photo compression error:', err);
      setPhotoError(err.message || 'Failed to process image.');
    } finally {
      setPhotoProcessing(false);
    }
  };

  // Handle dynamic checkbox array for subjects
  const handleCheckboxArrayChange = (subject, checked, compulsoryList = []) => {
    let currentArray = [];
    if (value && typeof value === 'string') {
      currentArray = value.split(', ').map(s => normalizeSubjectTitle(s.trim())).filter(Boolean);
    } else if (Array.isArray(value)) {
      currentArray = value.map(s => normalizeSubjectTitle(String(s).trim())).filter(Boolean);
    }

    const normSubject = normalizeSubjectTitle(subject);
    const normCompulsory = (compulsoryList || []).map(normalizeSubjectTitle);

    if (normCompulsory && normCompulsory.length > 0) {
      currentArray = [...new Set([...normCompulsory, ...currentArray])];
    }

    if (checked) {
      currentArray = [...new Set([...currentArray, normSubject])];
    } else {
      currentArray = currentArray.filter(s => s !== normSubject && s !== subject);
    }
    onChange(name, currentArray.join(', '));
  };

  const inputStyle = {
    backgroundColor: 'var(--bg-input, #f8fafc)',
    borderColor: error ? '#ef4444' : 'var(--border-ui, #cbd5e1)',
    color: 'var(--text-main, #0f172a)',
  };

  // Skip rendering for autogen fields and redundant ID card photo field
  if (type.startsWith('autogen') || lowerName === 'id card photo' || rawPlaceholder === '{{PHOTO_IC}}') return null;

  const isDateField = type === 'date' || lowerName.includes('dob') || lowerName.includes('date of birth');

  return (
    <div className="min-w-0 space-y-1 text-xs" data-field-name={name}>
      {/* Field Label Header */}
      <label htmlFor={inputId} className="flex min-w-0 flex-wrap items-center justify-between gap-1 text-[10.5px] sm:text-[11px] font-bold" style={{ color: 'var(--text-main, #1e293b)' }}>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 leading-snug">
          <span className="break-words font-extrabold text-slate-800 dark:text-slate-100">{mainLabel} {required && <span className="text-red-500">*</span>}</span>
          {badge}
          {calcPercentageBadge && (
            <span className="px-1.5 py-0.2 rounded font-black text-[9px] bg-teal-500/10 text-teal-600 border border-teal-500/20">
              Score: {calcPercentageBadge}
            </span>
          )}
        </span>
        {hint && (
          <StandardTooltip content={hint} title={`${mainLabel} Instructions`} position="top">
            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[9.5px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50/90 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 px-1.5 py-0.5 rounded-md border border-teal-200/80 dark:border-teal-800/80 transition-colors shadow-2xs cursor-pointer">
              <Info size={9.5} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <span className="hidden sm:inline truncate max-w-[140px]">{hint}</span>
              <span className="sm:hidden font-extrabold">Help</span>
            </span>
          </StandardTooltip>
        )}
      </label>

      {/* Date Field — Modern Component */}
      {isDateField && (
        <ModernDateInput
          id={inputId}
          value={value}
          onChange={(newVal) => onChange(name, newVal)}
          disabled={disabled}
          required={required}
          error={error}
          inputStyle={inputStyle}
          targetClass={targetClass || formData?.['Admission sought for class'] || ''}
        />
      )}

      {/* Select Field with Dynamic 'Other' Custom Value Input */}
      {!isDateField && type === 'list' && (
        <div className="space-y-1.5">
          <select
            id={inputId}
            value={(() => {
              const otherMatch = options.find(opt => opt.trim().toLowerCase() === 'other' || opt.trim().toLowerCase() === 'others');
              if (otherMatch) {
                if (value === otherMatch || (value && !options.includes(value))) {
                  return otherMatch;
                }
              }
              return value;
            })()}
            onChange={(e) => {
              const chosen = e.target.value;
              onChange(name, chosen);
            }}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="w-full px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[11.5px] sm:text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer"
            style={inputStyle}
          >
            <option value="">-- Select {mainLabel} --</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* Conditional Custom Value Input when "Other" is selected */}
          {(() => {
            const otherMatch = options.find(opt => opt.trim().toLowerCase() === 'other' || opt.trim().toLowerCase() === 'others');
            const isOtherSelected = Boolean(otherMatch && value && (value === otherMatch || !options.includes(value)));
            if (!isOtherSelected) return null;

            const customValDisplay = (value === otherMatch || value.toLowerCase() === 'other' || value.toLowerCase() === 'others') ? '' : value;

            return (
              <div className="pt-0.5 space-y-1 animate-fadeIn">
                <input
                  type="text"
                  value={customValDisplay}
                  onChange={(e) => {
                    const text = e.target.value;
                    onChange(name, text ? text : otherMatch);
                  }}
                  disabled={disabled}
                  required={required}
                  placeholder={`Please enter your ${mainLabel.toLowerCase()}...`}
                  className="w-full px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[11.5px] sm:text-xs font-semibold border border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all bg-teal-50/50 dark:bg-teal-950/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-2xs"
                  autoFocus
                />
                <div className="flex items-center gap-1 text-[9.5px] font-bold text-teal-700 dark:text-teal-400">
                  <span>✏️ Please specify your custom {mainLabel.toLowerCase()} above</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Textarea Field */}
      {!isDateField && type === 'textarea' && (() => {
        const maxLen = length ? parseInt(length, 10) : 300;
        const currentLen = String(value || '').length;
        return (
          <div className="space-y-1">
            <textarea
              id={inputId}
              rows={2}
              value={value}
              onChange={(e) => {
                const val = e.target.value.slice(0, maxLen);
                onChange(name, val);
              }}
              disabled={disabled}
              required={required}
              maxLength={maxLen}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              placeholder={placeholder || `Enter ${mainLabel}...`}
              className="w-full px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[11.5px] sm:text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              style={inputStyle}
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold px-1">
              <span>Max {maxLen} characters</span>
              <span className={maxLen - currentLen < 30 ? 'text-amber-600 dark:text-amber-400 font-black' : ''}>
                {currentLen}/{maxLen}
              </span>
            </div>
          </div>
        );
      })()}

      {/* File Upload Field / Passport Photo */}
      {(type === 'image' || type === 'file' || lowerName.includes('photo')) && (
        <div className="space-y-1">
          {(() => {
            const formattedImgVal = value ? (formatPhotoDisplayUrl(value) || value) : '';
            const isValidImageValue = formattedImgVal && typeof formattedImgVal === 'string' && (
              formattedImgVal.startsWith('data:image/') || formattedImgVal.startsWith('http://') || formattedImgVal.startsWith('https://') || formattedImgVal.startsWith('blob:')
            );

            const errorToShow = photoError || error;

            return (
              <>
                {errorToShow && (
                  <div id={errorId} role="alert" className="flex items-start gap-1.5 p-2 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 animate-fadeIn">
                    <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 leading-snug flex-1">{errorToShow}</span>
                    <button
                      type="button"
                      onClick={() => setPhotoError(null)}
                      className="text-red-400 hover:text-red-600 flex-shrink-0 cursor-pointer"
                      title="Dismiss"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                {/* Uploaded Preview */}
                {isValidImageValue && !photoProcessing && (
                  <div className="flex flex-col items-center p-1.5 rounded-xl border bg-teal-500/5 border-teal-500/30 shadow-xs w-24">
                    <div className="w-20 h-24 rounded-lg border border-teal-500/40 overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm flex-shrink-0 relative group">
                      <img
                        src={formattedImgVal}
                        alt="Passport Preview"
                        className="w-full h-full object-cover"
                        onError={() => { onChange(name, ''); setPhotoError('Preview failed — please re-upload.'); }}
                      />
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => { onChange(name, ''); setPhotoError(null); }}
                          className="absolute inset-0 bg-black/60 text-white font-extrabold text-[9px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Replace Photo"
                        >
                          <Camera size={14} />
                          <span>Change</span>
                        </button>
                      )}
                    </div>
                    <div className="text-[9px] font-bold text-teal-700 dark:text-teal-400 mt-1 flex items-center gap-0.5">
                      <CheckCircle2 size={10} /> Photo Added
                    </div>
                  </div>
                )}

                {/* Processing Spinner */}
                {photoProcessing && (
                  <div className="flex flex-col items-center justify-center w-24 h-28 rounded-xl border border-dashed border-teal-400 bg-teal-50 dark:bg-teal-950/30">
                    <Loader2 size={18} className="animate-spin text-teal-500 mb-1" />
                    <span className="text-[8px] font-bold text-teal-600">Processing…</span>
                  </div>
                )}

                {/* Upload Placeholder */}
                {!isValidImageValue && !photoProcessing && (
                  <label
                    htmlFor={inputId}
                    className={`flex flex-col items-center justify-center w-24 h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all p-1.5 text-center shadow-xs ${
                      errorToShow
                        ? 'border-red-500 bg-red-500/10 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-2 ring-red-500/40 animate-pulse'
                        : 'hover:border-teal-500 bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-0.5 ${
                      errorToShow ? 'bg-red-500/20 text-red-600 dark:text-red-300' : 'bg-teal-500/10 text-teal-600'
                    }`}>
                      <Camera size={14} />
                    </div>
                    <span className={`text-[9px] font-black leading-tight ${errorToShow ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}>
                      Photo {required && <span className="text-red-500">*</span>}
                    </span>
                    <span className={`text-[7.5px] font-bold mt-0.5 uppercase ${errorToShow ? 'text-red-600 dark:text-red-300' : 'text-slate-400'}`}>
                      {errorToShow ? 'Upload Required!' : '35×45 mm'}
                    </span>
                    <input
                      id={inputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      disabled={disabled}
                      aria-invalid={Boolean(errorToShow)}
                      aria-describedby={errorToShow ? errorId : undefined}
                      className="hidden"
                    />
                  </label>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Year Field — Select Dropdown */}
      {!isDateField && type !== 'list' && (lowerName.includes('year of passing') || lowerName.includes('year of appearing') || lowerName.includes('passing year') || lowerName === 'prevyear' || lowerName.includes('passing_year')) && (
        <div className="space-y-1">
          <select
            id={inputId}
            value={value || ''}
            onChange={(e) => onChange(name, e.target.value)}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="w-full px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer"
            style={inputStyle}
          >
            <option value="">-- Select {mainLabel} --</option>
            {SUGGESTED_PASSING_YEARS.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Default Input (text, number, text_numeric) */}
      {!isDateField && !lowerName.includes('year of passing') && !lowerName.includes('year of appearing') && !lowerName.includes('passing year') && lowerName !== 'prevyear' && !lowerName.includes('passing_year') && (type === 'text' || type === 'number' || type === 'number_range' || type === 'text_numeric') && (
        <>
          {(() => {
            const isSchoolInput = (lowerName.includes('previous school') || lowerName.includes('name of previous school') || lowerName.includes('last school')) && !lowerName.includes('record');
            const isIfsc = lowerName.includes('ifsc');
            const isEmail = lowerName.includes('email');
            const isNameField = isPersonNameField(name) || (lowerName.includes('name') && !isSchoolInput && !lowerName.includes('bank') && !lowerName.includes('village') && !lowerName.includes('occupation') && !lowerName.includes('subject'));
            const isMaxMarksField = lowerName.includes('max. marks') || lowerName.includes('max marks') || (lowerName.includes('total max') && !lowerName.includes('percentage'));
            const isMarksObtainedField = lowerName.includes('marks obtained') || lowerName.includes('total marks obtained');
            const isComplexHead = lowerName.includes('complex head') || (lowerName.includes('complex') && !lowerName.includes('building'));
            const isBoardField = (lowerName.includes('board') || lowerName.includes('exam board')) && !lowerName.includes('registration') && !lowerName.includes('reg');

            let defaultMax = 80;
            if (type === 'text_numeric') {
              if (lowerName.includes('mobile')) defaultMax = 10;
              else if (lowerName.includes('aadhar')) defaultMax = 12;
              else if (lowerName.includes('pin')) defaultMax = 6;
              else if (lowerName.includes('account')) defaultMax = 18;
              else defaultMax = 25;
            } else if (isIfsc) {
              defaultMax = 11;
            } else if (isNameField) {
              defaultMax = 60;
            } else if (isEmail) {
              defaultMax = 80;
            }

            const effectiveMaxLength = length ? parseInt(length, 10) : defaultMax;

            // Numeric bounds
            let computedMin = (min !== '' && min !== undefined && !isNaN(Number(min))) ? Number(min) : undefined;
            let computedMax = (max !== '' && max !== undefined && !isNaN(Number(max))) ? Number(max) : undefined;

            if (type === 'number' || type === 'number_range') {
              if (lowerName.includes('height')) {
                computedMin = computedMin ?? 50;
                computedMax = computedMax ?? 250;
              } else if (lowerName.includes('weight')) {
                computedMin = computedMin ?? 15;
                computedMax = computedMax ?? 200;
              } else if (lowerName.includes('marks')) {
                computedMin = computedMin ?? 0;
                computedMax = computedMax ?? 2000;
              } else {
                computedMin = computedMin ?? 0;
                computedMax = computedMax ?? 999999;
              }
            }

            // Derive corresponding Max Marks if this is a Marks Obtained field
            let correspondingMaxMarks = 500;
            if (isMarksObtainedField && formData) {
              const clsMatch = name.match(/Class\s+(8th|9th|10th|11th|12th)/i);
              if (clsMatch) {
                const clsKey = clsMatch[0]; // e.g. "Class 9th"
                const foundMax = formData[`Total Max. Marks in ${clsKey}`] || formData[`Total Max Marks in ${clsKey}`] || formData[`Max Marks in ${clsKey}`];
                if (foundMax && !isNaN(parseFloat(foundMax)) && parseFloat(foundMax) > 0) {
                  correspondingMaxMarks = parseFloat(foundMax);
                }
              } else {
                const fallbackMax = formData['Total Max. Marks'] || formData['Total Max Marks'] || formData['Max Marks'] || formData['maxMarks'];
                if (fallbackMax && !isNaN(parseFloat(fallbackMax)) && parseFloat(fallbackMax) > 0) {
                  correspondingMaxMarks = parseFloat(fallbackMax);
                }
              }
            }

            if (isMarksObtainedField) {
              computedMax = correspondingMaxMarks;
            }

            const handleInputChange = (e) => {
              let raw = e.target.value;
              if (type === 'text_numeric') {
                raw = raw.replace(/\D/g, '').slice(0, effectiveMaxLength);
              } else if (isIfsc) {
                raw = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
              } else if (isNameField) {
                // Strictly disallow numbers and strange symbols from person name fields
                raw = sanitizePersonName(raw).slice(0, effectiveMaxLength);
              } else if (type === 'number' || type === 'number_range') {
                if (raw !== '') {
                  raw = raw.replace(/-/g, '');
                  const num = Number(raw);
                  if (isMarksObtainedField && !isNaN(num) && num > correspondingMaxMarks) {
                    raw = String(correspondingMaxMarks);
                  } else if (computedMax !== undefined && !isNaN(num) && num > computedMax) {
                    raw = String(computedMax);
                  }
                }
              } else {
                raw = raw.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, effectiveMaxLength);
              }
              onChange(name, raw);
            };

            const handleKeyDown = (e) => {
              if (isNameField) {
                // Allow control & navigation keys
                if (
                  e.key === 'Backspace' || e.key === 'Tab' || e.key === 'Enter' ||
                  e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                  e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Delete' ||
                  e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey || e.altKey
                ) {
                  return;
                }
                // Allow English letters, space, dot, hyphen, apostrophe
                if (/^[a-zA-Z\s.'-]$/.test(e.key)) {
                  return;
                }
                // Intercept and prevent numbers (0-9) and special characters
                e.preventDefault();
              }
            };

            const datalistId = isSchoolInput
              ? `${inputId}-schools`
              : isComplexHead
              ? `${inputId}-complex`
              : isBoardField
              ? `${inputId}-board`
              : undefined;

            return (
              <>
                {isMaxMarksField ? (
                  <div className="space-y-1.5">
                    <select
                      id={inputId}
                      value={MAX_MARKS_PRESETS.includes(String(value || '').trim()) ? String(value).trim() : (value ? 'custom' : '500')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== 'custom') {
                          onChange(name, val);
                        } else if (MAX_MARKS_PRESETS.includes(String(value || '').trim())) {
                          onChange(name, '');
                        }
                      }}
                      disabled={disabled}
                      required={required}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      className="w-full px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[11.5px] sm:text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer"
                      style={inputStyle}
                    >
                      <option value="500">500 (Standard Max Marks)</option>
                      <option value="600">600 Max Marks</option>
                      <option value="700">700 Max Marks</option>
                      <option value="800">800 Max Marks</option>
                      <option value="1000">1000 Max Marks</option>
                      <option value="1200">1200 Max Marks</option>
                      <option value="custom">Custom Maximum Marks...</option>
                    </select>

                    {(!MAX_MARKS_PRESETS.includes(String(value || '').trim())) && (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <input
                          type="number"
                          value={value}
                          onChange={handleInputChange}
                          disabled={disabled}
                          required={required}
                          min="1"
                          max="2000"
                          placeholder="Enter Custom Max Marks (e.g. 650)"
                          className="w-full px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[11.5px] sm:text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                          style={inputStyle}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                ) : isSchoolInput ? (
                  <div className="space-y-1">
                    <SearchableSchoolCombobox
                      id={inputId}
                      value={value}
                      onChange={(val) => onChange(name, val)}
                      disabled={disabled}
                      required={required}
                      placeholder={placeholder || 'Search previous school or enter new...'}
                      error={error}
                      errorId={errorId}
                      inputStyle={inputStyle}
                      schools={PREVIOUS_SCHOOLS}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      id={inputId}
                      type={type === 'text' ? (isEmail ? 'email' : 'text') : type === 'text_numeric' ? 'tel' : 'number'}
                      value={value}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      disabled={disabled}
                      required={required}
                      min={computedMin}
                      max={computedMax}
                      maxLength={effectiveMaxLength}
                      list={datalistId}
                      pattern={isNameField ? "^[a-zA-Z\\s.'-]+$" : undefined}
                      title={isNameField ? "Name must contain only English letters, spaces, and dots. Numbers and special characters are not allowed." : undefined}
                      autoComplete={lowerName.includes("student's name") || lowerName === 'name' ? 'name' : undefined}
                      inputMode={type === 'text_numeric' ? 'numeric' : (type === 'number' || type === 'number_range') ? 'decimal' : isNameField ? 'text' : undefined}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      placeholder={placeholder || (isMarksObtainedField ? 'e.g. 420' : (isNameField ? `Enter ${mainLabel} (Letters only)...` : ''))}
                      className="w-full px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[11.5px] sm:text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                      style={inputStyle}
                    />

                    {/* Live Person Name Helper */}
                    {isNameField && value && (
                      <div className="flex items-center justify-between text-[10px] px-1 pt-0.5 font-bold">
                        <span className="text-slate-400">
                          Letters &amp; dots only
                        </span>
                        {validatePersonName(value, mainLabel).valid ? (
                          <span className="text-emerald-700 dark:text-emerald-300 font-black flex items-center gap-1">
                            <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Valid Name</span>
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <AlertCircle size={11} className="flex-shrink-0" />
                            <span>{validatePersonName(value, mainLabel).error}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Real-time Warning if Marks Obtained exceeds Max Marks */}
                    {isMarksObtainedField && value !== '' && !isNaN(parseFloat(value)) && parseFloat(value) > correspondingMaxMarks && (
                      <div className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1 pt-0.5">
                        <AlertCircle size={12} className="flex-shrink-0" />
                        <span>Marks obtained cannot exceed Total Max Marks ({correspondingMaxMarks}).</span>
                      </div>
                    )}

                    {/* Live Aadhaar Helper */}
                    {lowerName.includes('aadhar') && value && (
                      <div className="flex items-center justify-between text-[10px] px-1 pt-0.5 font-bold">
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {value.length}/12 digits
                        </span>
                        {value.length === 12 && (
                          <span className={`flex items-center gap-1 font-black ${
                            isValidAadhaar(value) ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
                          }`}>
                            {isValidAadhaar(value) ? (
                              <>
                                <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                                <span>Verified Aadhaar</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={11} className="text-amber-600 dark:text-amber-400" />
                                <span>Invalid Checksum</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Live Mobile Helper */}
                    {lowerName.includes('mobile') && value && (
                      <div className="flex items-center justify-between text-[10px] px-1 pt-0.5 font-bold">
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {value.length}/10 digits
                        </span>
                        {value.length === 10 && /^[6-9]\d{9}$/.test(value) && (
                          <span className="text-emerald-700 dark:text-emerald-300 font-black flex items-center gap-1">
                            <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Valid Mobile Number</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Live IFSC Helper */}
                    {isIfsc && value && (
                      <div className="flex items-center justify-between text-[10px] px-1 pt-0.5 font-bold">
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {value.length}/11 chars
                        </span>
                        {value.length === 11 && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value) && (
                          <span className="text-emerald-700 dark:text-emerald-300 font-black flex items-center gap-1">
                            <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Valid IFSC Format</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Datalists for Autocomplete Suggestions */}
                    {isComplexHead && (
                      <datalist id={`${inputId}-complex`}>
                        {COMPLEX_HEAD_SUGGESTIONS.map((ch, i) => (
                          <option key={i} value={ch} />
                        ))}
                      </datalist>
                    )}
                    {isBoardField && (
                      <datalist id={`${inputId}-board`}>
                        {BOARD_SUGGESTIONS.map((b, i) => (
                          <option key={i} value={b} />
                        ))}
                      </datalist>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* Checkbox Dynamic (Subjects) — 5-column modern grid with pre-selected & locked compulsory subjects */}
      {type === 'checkbox_dynamic' && (
        <div className="space-y-4 mt-2">
          {(() => {
            const realConfig = (subjectsConfig && subjectsConfig.data) ? subjectsConfig.data : subjectsConfig;

            const cls11 = name.includes('11th');
            const cls12 = name.includes('12th');
            const cls10 = name.includes('10th');
            const cls9  = name.includes('9th');
            const cls8  = name.includes('8th');

            const targetCls = cls11 ? '11th' : cls12 ? '12th' : cls10 ? '10th' : cls9 ? '9th' : '8th';

            const strm = selectedStream ||
              (formData && (formData['Stream for Class 11th'] || formData['Stream opted in Class 11th'] || formData['Stream'])) ||
              'Science';

            const isReappearField = name.toLowerCase().includes('reappear');
            let groupA = [];
            let groupB = [];
            let groupC = [];

            if (isReappearField) {
              // 1. Resolve compulsory subjects of the previous class
              const prevCls = cls10 ? '10th' : cls11 ? '11th' : cls12 ? '12th' : cls9 ? '9th' : '8th';
              let prevCompulsory = [];
              if (prevCls === '10th' || prevCls === '9th' || prevCls === '8th') {
                prevCompulsory = ["English", "Mathematics", "Science", "Social Science"];
              } else if (prevCls === '11th' || prevCls === '12th') {
                const prevStream = (formData && (formData['Stream opted in Class 11th'] || formData['Stream for Class 11th'] || formData['Stream'])) || strm;
                if (prevStream === 'Humanities' || prevStream === 'Arts') {
                  prevCompulsory = ["General English"];
                } else {
                  prevCompulsory = ["General English", "Physics", "Chemistry"];
                }
              }

              if (realConfig && realConfig[prevCls]) {
                const prevStream = (formData && (formData['Stream opted in Class 11th'] || formData['Stream for Class 11th'] || formData['Stream'])) || strm;
                const cfg = realConfig[prevCls][prevStream] || realConfig[prevCls]['General'] || Object.values(realConfig[prevCls])[0];
                if (cfg && cfg.compulsory && Array.isArray(cfg.compulsory) && cfg.compulsory.length > 0) {
                  prevCompulsory = cfg.compulsory;
                }
              }

              // 2. Resolve optional subjects studied from formData
              const studiedKey = name.includes('10th')
                ? 'Subjects Studied in Class 10th'
                : name.includes('11th')
                ? 'Subjects Studied in Class 11th'
                : '';
              const rawStudied = studiedKey && formData ? formData[studiedKey] : '';
              const studiedArray = (typeof rawStudied === 'string' ? rawStudied.split(', ') : (rawStudied || []))
                .map(s => s.trim())
                .filter(Boolean);

              // In reappear mode: pool of previous subjects
              groupB = [...new Set([...prevCompulsory, ...studiedArray])];
              groupA = [];
              groupC = [];
            } else {
              // Exact available school subjects matching the Academics page
              if (cls9 || cls10 || cls8) {
                groupA = ["English", "Mathematics", "Science", "Social Science"];
                groupB = ["Urdu", "Arabic", "Hindi", "Kashmiri"];
                groupC = ["Healthcare", "IT and ITES"];
              } else if (cls11 || cls12) {
                if (strm === 'Humanities' || strm === 'Arts') {
                  groupA = ["General English"];
                  groupB = ["Urdu", "Education", "Economics", "History", "Political Science", "Mathematics"];
                  groupC = ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"];
                } else if (strm === 'Commerce') {
                  groupA = ["General English", "Accountancy", "Business Studies"];
                  groupB = ["Economics", "Entrepreneurship", "Mathematics"];
                  groupC = ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"];
                } else {
                  // Science Stream
                  groupA = ["General English", "Physics", "Chemistry"];
                  groupB = ["Biology", "Mathematics"];
                  groupC = ["Environmental Science", "Physical Education", "Healthcare", "IT and ITES"];
                }
              }

              // Dynamic overrides from subjectsConfig if configured by admin
              if (realConfig) {
                const classConfig = realConfig[targetCls];
                if (classConfig) {
                  const cfg = classConfig[strm] || classConfig['General'] || Object.values(classConfig)[0];
                  if (cfg) {
                    if (cfg.groupA || cfg.compulsory) {
                      const arr = cfg.groupA || cfg.compulsory;
                      if (Array.isArray(arr) && arr.length > 0) groupA = arr;
                    }
                    if (cfg.groupB || cfg.group1) {
                      const arr = cfg.groupB || cfg.group1;
                      if (Array.isArray(arr) && arr.length > 0) groupB = arr;
                    }
                    if (cfg.groupC || cfg.group2) {
                      const arr = cfg.groupC || cfg.group2;
                      if (Array.isArray(arr) && arr.length > 0) groupC = arr;
                    }
                  }
                }
              }
            }

            // Normalize subject titles using canonical synonyms
            groupA = [...new Set(groupA.map(normalizeSubjectTitle))];
            groupB = [...new Set(groupB.map(normalizeSubjectTitle).filter(s => !groupA.includes(s)))];
            groupC = [...new Set(groupC.map(normalizeSubjectTitle).filter(s => !groupA.includes(s) && !groupB.includes(s)))];

            const compulsorySubjects = groupA;
            const currentArray = (typeof value === 'string' ? value.split(', ') : (value || [])).map(s => normalizeSubjectTitle(s.trim())).filter(Boolean);
            const allSelectedSubjects = isReappearField ? currentArray : [...new Set([...compulsorySubjects, ...currentArray])];

            const selectedB = currentArray.filter(s => groupB.includes(s));
            const selectedC = currentArray.filter(s => groupC.includes(s));

            const isScience = strm.toLowerCase() === 'science' || strm.toLowerCase() === 'medical' || strm.toLowerCase() === 'non-medical';
            const isHumanities = strm.toLowerCase() === 'humanities' || strm.toLowerCase() === 'arts';
            const isSecondary = cls9 || cls10 || cls8;

            const subjectValidation = validateSubjectSelection(targetCls, strm, allSelectedSubjects, isReappearField);

            // Dynamic Group B target count badge text & status
            let groupBBadgeText = '';
            let groupBBadgeStatus = 'pending'; // 'pending' | 'success' | 'warn'

            if (isSecondary) {
              if (selectedB.length === 1) {
                groupBBadgeText = '1/1 Language ✓';
                groupBBadgeStatus = 'success';
              } else if (selectedB.length > 1) {
                groupBBadgeText = `${selectedB.length}/1 (Max 1)`;
                groupBBadgeStatus = 'warn';
              } else {
                groupBBadgeText = '0/1 Language Required';
                groupBBadgeStatus = 'pending';
              }
            } else if (isHumanities) {
              const targetB = selectedC.length > 0 ? 3 : 4;
              if (selectedB.length === targetB) {
                groupBBadgeText = `${selectedB.length}/${targetB} Core ✓`;
                groupBBadgeStatus = 'success';
              } else if (selectedB.length > 4 || (selectedC.length > 0 && selectedB.length > 3)) {
                groupBBadgeText = `${selectedB.length} Selected (Max ${targetB})`;
                groupBBadgeStatus = 'warn';
              } else {
                groupBBadgeText = `${selectedB.length}/${targetB} Core`;
                groupBBadgeStatus = selectedB.length >= 3 ? 'success' : 'pending';
              }
            } else if (isScience) {
              const isBothGroupB = selectedB.length === 2 && selectedC.length === 0;
              const isGroupBPlusC = selectedB.length === 1 && selectedC.length === 1;
              if (isBothGroupB) {
                groupBBadgeText = '2/2 Selected (Bio & Math) ✓';
                groupBBadgeStatus = 'success';
              } else if (isGroupBPlusC) {
                groupBBadgeText = '1/1 Core Selected ✓';
                groupBBadgeStatus = 'success';
              } else if (selectedB.length === 0 && selectedC.length > 0) {
                groupBBadgeText = '0/1 Required (Bio or Math)';
                groupBBadgeStatus = 'warn';
              } else if (selectedB.length > 2) {
                groupBBadgeText = `${selectedB.length}/2 (Max 2)`;
                groupBBadgeStatus = 'warn';
              } else {
                groupBBadgeText = `${selectedB.length} Selected`;
                groupBBadgeStatus = selectedB.length >= 1 ? 'success' : 'pending';
              }
            } else {
              groupBBadgeText = `${selectedB.length} Selected`;
              groupBBadgeStatus = selectedB.length >= 1 ? 'success' : 'pending';
            }

            // Dynamic Group C target count badge text & status
            let groupCBadgeText = '';
            let groupCBadgeStatus = 'pending';
            if (isSecondary) {
              if (selectedC.length === 1) {
                groupCBadgeText = '1/1 Vocational ✓';
                groupCBadgeStatus = 'success';
              } else if (selectedC.length > 1) {
                groupCBadgeText = `${selectedC.length}/1 (Max 1)`;
                groupCBadgeStatus = 'warn';
              } else {
                groupCBadgeText = 'Optional (0/1)';
                groupCBadgeStatus = 'pending';
              }
            } else if (isHumanities) {
              if (selectedC.length === 1) {
                groupCBadgeText = '1/1 Elective ✓';
                groupCBadgeStatus = 'success';
              } else if (selectedC.length > 1) {
                groupCBadgeText = `${selectedC.length}/1 (Max 1 Allowed)`;
                groupCBadgeStatus = 'warn';
              } else {
                groupCBadgeText = selectedB.length >= 4 ? '0/1 (Optional)' : 'Optional (0/1)';
                groupCBadgeStatus = 'pending';
              }
            } else if (isScience) {
              if (selectedC.length === 1 && selectedB.length === 1) {
                groupCBadgeText = '1/1 Elective ✓';
                groupCBadgeStatus = 'success';
              } else if (selectedC.length > 1) {
                groupCBadgeText = `${selectedC.length}/1 (Max 1 Allowed)`;
                groupCBadgeStatus = 'warn';
              } else {
                groupCBadgeText = selectedB.length >= 2 ? '0/1 (Optional)' : 'Optional (0/1)';
                groupCBadgeStatus = 'pending';
              }
            } else {
              if (selectedC.length === 1) {
                groupCBadgeText = '1/1 Elective ✓';
                groupCBadgeStatus = 'success';
              } else if (selectedC.length > 1) {
                groupCBadgeText = `${selectedC.length}/1 (Max 1)`;
                groupCBadgeStatus = 'warn';
              } else {
                groupCBadgeText = 'Optional (0/1)';
                groupCBadgeStatus = 'pending';
              }
            }

            return (
              <div className="space-y-4">
                {/* Combination Guidance Header */}
                {!isReappearField && (
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-teal-50/90 to-blue-50/90 dark:from-slate-800/90 dark:to-slate-800/60 border border-teal-200 dark:border-slate-700 text-xs leading-relaxed text-slate-700 dark:text-slate-300 shadow-xs">
                    <div className="font-black text-teal-900 dark:text-teal-200 mb-1 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Info size={14} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                        <span>Combination Rules ({strm} Stream — Class {targetCls}):</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-300/60 dark:border-teal-700">
                        {isSecondary ? '5 to 6 Subjects Total' : '5 Subjects Total'}
                      </span>
                    </div>
                    {isScience && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-slate-100">Compulsory (3):</strong> General English, Physics, Chemistry. Choose <strong className="text-teal-700 dark:text-teal-300 font-bold">2 more options</strong>: either both from Group B (Biology + Mathematics), or 1 from Group B and 1 from Group C (both cannot be from Group C).
                      </p>
                    )}
                    {isHumanities && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-slate-100">Compulsory (1):</strong> General English. Choose <strong className="text-teal-700 dark:text-teal-300 font-bold">3 from Group B</strong> and <strong className="text-teal-700 dark:text-teal-300 font-bold">1 from Group C</strong> (or 4 from Group B). Maximum 1 subject allowed from Group C.
                      </p>
                    )}
                    {!isScience && !isHumanities && isSecondary && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-slate-100">Compulsory (4):</strong> English, Mathematics, Science, Social Science. Choose <strong className="text-teal-700 dark:text-teal-300 font-bold">1 Language</strong> from Group B and optionally <strong className="text-teal-700 dark:text-teal-300 font-bold">1 Vocational subject</strong> from Group C.
                      </p>
                    )}
                  </div>
                )}

                {/* ── GROUP A: COMPULSORY CORE SUBJECTS ── */}
                {groupA.length > 0 && !isReappearField && (
                  <div className="p-3.5 rounded-2xl border border-teal-300/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-teal-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                          A
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                            Group A: Compulsory Core Subjects
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            Mandatory for all students in this stream (Auto-locked)
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-600/15 text-teal-800 dark:text-teal-300 border border-teal-500/30">
                        <Lock size={10} />
                        {groupA.length} {groupA.length === 1 ? 'Subject' : 'Subjects'} Compulsory
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {groupA.map(sub => (
                        <div
                          key={sub}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-teal-400/50 bg-white/90 dark:bg-slate-900/90 text-teal-950 dark:text-teal-100 shadow-2xs font-extrabold text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <CheckCircle2 size={15} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                            <span className="break-words leading-tight">{sub}</span>
                          </div>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex-shrink-0 ml-1.5">
                            Fixed
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── GROUP B: CORE ELECTIVES / LANGUAGES ── */}
                {groupB.length > 0 && (
                  <div className="p-3.5 rounded-2xl border border-amber-300/80 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-amber-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                          B
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                            {isSecondary ? 'Group B: Language Electives' : 'Group B: Core Stream Electives'}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {isSecondary
                              ? 'Choose exactly 1 language from the options below'
                              : isHumanities
                              ? 'Choose 3 core subjects (or 4 if taking no Group C elective)'
                              : isScience
                              ? 'Choose Biology, Mathematics, or both'
                              : 'Select core elective subjects'}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                        groupBBadgeStatus === 'success'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                          : groupBBadgeStatus === 'warn'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 animate-pulse'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300'
                      }`}>
                        {groupBBadgeText}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {groupB.map(sub => {
                        const isChecked = currentArray.includes(sub);
                        return (
                          <label
                            key={sub}
                            className={`flex min-w-0 items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                              isChecked
                                ? 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-500 text-amber-950 dark:text-amber-100 font-black shadow-xs ring-1 ring-amber-400'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-slate-800 font-semibold'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={disabled}
                                onChange={(e) => {
                                  handleCheckboxArrayChange(sub, e.target.checked, compulsorySubjects);
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                              />
                              <span className="break-words leading-tight">{sub}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── GROUP C: APPLIED / VOCATIONAL / INTERDISCIPLINARY ELECTIVES ── */}
                {groupC.length > 0 && !isReappearField && (
                  <div className="p-3.5 rounded-2xl border border-indigo-300/80 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                          C
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                            {isSecondary ? 'Group C: Vocational & Skill Courses' : 'Group C: Applied / Vocational / Minor Electives'}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {isSecondary
                              ? 'Optional 6th subject for vocational skill development'
                              : isHumanities
                              ? 'Choose maximum 1 elective from this group'
                              : isScience
                              ? 'Choose maximum 1 elective from this group (combined with Group B)'
                              : 'Choose maximum 1 elective'}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                        groupCBadgeStatus === 'success'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                          : groupCBadgeStatus === 'warn'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 animate-pulse'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300'
                      }`}>
                        {groupCBadgeText}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {groupC.map(sub => {
                        const isChecked = currentArray.includes(sub);
                        return (
                          <label
                            key={sub}
                            className={`flex min-w-0 items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-100/80 dark:bg-indigo-950/60 border-indigo-500 text-indigo-950 dark:text-indigo-100 font-black shadow-xs ring-1 ring-indigo-400'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-slate-800 font-semibold'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={disabled}
                                onChange={(e) => {
                                  handleCheckboxArrayChange(sub, e.target.checked, compulsorySubjects);
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                              />
                              <span className="break-words leading-tight">{sub}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── REAL-TIME VALIDATION & COMBINATION SUMMARY BANNER ── */}
                {!isReappearField && !subjectValidation.valid && (
                  <div className="p-3 rounded-2xl border border-red-400 dark:border-red-800 bg-red-50/90 dark:bg-red-950/70 text-red-700 dark:text-red-200 text-xs font-bold flex items-start gap-2.5 shadow-xs animate-shake">
                    <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 leading-snug">{subjectValidation.error}</div>
                  </div>
                )}

                {!isReappearField && subjectValidation.valid && (
                  <div className="p-3 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>Valid subject combination selected!</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-[11px] shadow-xs">
                      {allSelectedSubjects.length} Subjects Selected
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 font-semibold">
                  <span>
                    {isReappearField
                      ? 'Select only the specific subject(s) you need to reappear in.'
                      : 'Compulsory subjects are locked. Select options adhering to the group limits above.'}
                  </span>
                  <span className="font-extrabold text-teal-800 dark:text-teal-300">
                    Total: {allSelectedSubjects.length} subject(s)
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Checkbox Declaration */}
      {type === 'checkbox_declaration' && (
        <label className="flex items-start gap-2.5 p-3 rounded-xl border bg-teal-50/50 dark:bg-slate-900/50 cursor-pointer transition-colors border-teal-500/30">
          <input
            type="checkbox"
            required={required}
            checked={value === 'TRUE' || value === true}
            onChange={(e) => onChange(name, e.target.checked ? 'TRUE' : 'FALSE')}
            disabled={disabled}
            className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 mt-0.5"
          />
          <div className="text-[11px] leading-relaxed text-slate-800 dark:text-slate-200 flex-1 font-medium">
            {optionsRaw || hint || mainLabel}
          </div>
        </label>
      )}

      {/* Field-level error */}
      {!lowerName.includes('photo') && error && (
        <div id={errorId} role="alert" className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">
          <AlertCircle size={11} /> {error}
        </div>
      )}
    </div>
  );
}
