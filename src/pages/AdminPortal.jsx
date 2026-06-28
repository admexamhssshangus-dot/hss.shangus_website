import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Lock, Unlock, Save, Download, Plus, Trash2, FileText, Users, AlertCircle, CheckCircle2, UserPlus, RefreshCw, FolderOpen, Edit2, Check, X, Calendar, Upload, ArrowUpCircle, Printer, FileSpreadsheet, BookOpen, Calculator, Settings, Image, ChevronDown, Loader2, XCircle, Clock, Circle, ArrowUp, ArrowDown, Eye, EyeOff, Layers, Mail } from 'lucide-react';
import { DEFAULT_SETTINGS, loadSiteSettings, mergeSiteSettings } from '../utils/settingsLoader';
import { db, storage, auth } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, signOut as firebaseSignOut, onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ==========================================
// IndexedDB Helpers for Storing Folder Handle
// ==========================================
const DB_NAME = 'HSS_Shangus_AdminDB';
const STORE_NAME = 'folder_handles';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveFolderHandle(handle) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(handle, 'slides_folder');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getFolderHandle() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get('slides_folder');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const ADMIN_PASSWORD_HASH = '337c3ede57bd0445487f19ce491960c04e86b801c2b26655e9241b9d539e7482';

// Default fallback admin. `hashAlgo` is explicit so the login routine
// can deterministically pick the proper verification method.
const DEFAULT_ADMINS = [
  {
    email: 'adm.exam.hss.shangus@gmail.com',
    passwordHash: '337c3ede57bd0445487f19ce491960c04e86b801c2b26655e9241b9d539e7482',
    hashAlgo: 'sha256',
    role: 'Super Admin',
    allowedTabs: ['admissions', 'notices', 'faculty', 'slideshow', 'tax', 'export', 'admins']
  }
];

async function hashPassword(plainText, saltHex = null) {
  if (saltHex) {
    try {
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(plainText);
      const saltBuffer = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      
      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        256
      );
      
      const hashArray = Array.from(new Uint8Array(derivedBits));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('PBKDF2 hashing failed, falling back to SHA-256:', e);
    }
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Firebase helpers
const uploadToFirebaseStorage = async (file, filename) => {
  if (!storage) throw new Error('Firebase storage not configured');
  const dest = `slides/photos/${filename}`;
  const storageRef = ref(storage, dest);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

const saveToFirebase = async ({ settings, noticesText, faculty, admins, slides }) => {
  if (!db) throw new Error('Firestore not configured');

  // Authorization: require authenticated admin
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required to save. Please sign in.');

  const isListedAdmin = Array.isArray(admins) && admins.some(a => (a.email || '').toLowerCase() === (user.email || '').toLowerCase());
  let isAdminClaim = false;

  // Skip calling getIdTokenResult if isListedAdmin is already true.
  // This bypasses the Google popup token refresh loop entirely for listed admins.
  if (!isListedAdmin) {
    try {
      const idToken = await getIdTokenResult(user, false);
      // Token claims checked — logging suppressed in production for security
      isAdminClaim = idToken?.claims?.admin === true;
    } catch (e) {
      console.warn('Failed to retrieve token claims:', e);
    }
  }

  if (!isAdminClaim && !isListedAdmin) {
    throw new Error('User is not authorized to perform this action.');
  }

  // Write core documents
  await setDoc(doc(db, 'site', 'settings'), settings || {});
  await setDoc(doc(db, 'site', 'notices'), { text: noticesText || '' });
  await setDoc(doc(db, 'site', 'faculty'), { items: (faculty || []).map(({ id, ...r }) => r) });
  await setDoc(doc(db, 'site', 'admins'), {
    items: admins || [],
    emails: (admins || []).map(a => (a.email || '').toLowerCase()).filter(Boolean)
  });
  if (slides) {
    await setDoc(doc(db, 'site', 'slideshow'), { items: slides });
  }
};

function generateRandomSaltHex() {
  const arr = new Uint8Array(16);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}


// ==========================================
// Date Formatting Helper (turns YYYY-MM-DD -> MMM DD)
// ==========================================
function formatDateToShort(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  return `${month} ${day}`;
}

// ==========================================
// Formatting Helpers for Employee Profiles
// ==========================================
function toTitleCase(str) {
  if (!str) return '';
  const val = String(str).trim();
  if (val.toUpperCase() === 'NA') return 'NA';

  const acronyms = new Set(['PG', 'MTS', 'HSS', 'B.ED', 'CPIS', 'DDO', 'HRMS', 'UDISE', 'JKBOSE', 'ICT', 'IT', 'CS', 'VT', 'ITES']);
  const romanNumerals = new Set(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
  const minorWords = new Set(['in', 'of', 'the', 'a', 'an', 'to', 'for', 'at', 'by', 'with', 'from', 'on']);

  const specificMapping = {
    'b.ed': 'B.Ed',
    'bed': 'B.Ed',
    'm.ed': 'M.Ed',
    'med': 'M.Ed',
    'b.sc': 'B.Sc',
    'bsc': 'B.Sc',
    'm.sc': 'M.Sc',
    'msc': 'M.Sc',
    'b.a': 'B.A',
    'ba': 'B.A',
    'm.a': 'M.A',
    'ma': 'M.A',
    'ph.d': 'Ph.D',
    'phd': 'Ph.D',
    'm.phil': 'M.Phil',
    'mphil': 'M.Phil',
    'b.tech': 'B.Tech',
    'btech': 'B.Tech',
    'm.tech': 'M.Tech',
    'mtech': 'M.Tech',
    'bca': 'BCA',
    'mca': 'MCA',
    'na': 'NA'
  };

  const lowerVal = val.toLowerCase();
  if (specificMapping[lowerVal]) {
    return specificMapping[lowerVal];
  }

  return val.split(/(\s+|[,\-\/()])/).map((word, idx, arr) => {
    if (!word || word.trim() === '') return word;
    if (/^[,\-\/()]+$/.test(word)) return word;

    const upperWord = word.toUpperCase();
    const lowerWord = word.toLowerCase();

    if (specificMapping[lowerWord]) {
      return specificMapping[lowerWord];
    }

    if (romanNumerals.has(upperWord)) {
      return upperWord;
    }

    if (acronyms.has(upperWord)) {
      return upperWord;
    }

    const isFirstWord = idx === 0 || arr.slice(0, idx).every(w => !w || w.trim() === '' || /^[,\-\/()]+$/.test(w));
    if (!isFirstWord && minorWords.has(lowerWord)) {
      return lowerWord;
    }

    if (lowerWord.includes('.')) {
      return word.split('.').map(seg => {
        if (!seg) return '';
        if (seg.toLowerCase() === 'ed') return 'Ed';
        if (seg.toLowerCase() === 'phil') return 'Phil';
        return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
      }).join('.');
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');
}

function formatUDISECode(val) {
  if (!val) return '';
  let str = String(val).trim();
  if (/^\d+$/.test(str) && str.length < 11) {
    str = str.padStart(11, '0');
  }
  return str;
}

function parseStayDate(str) {
  if (!str) return null;
  const cleaned = String(str).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const parts = cleaned.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) {
    const parts = cleaned.split('.');
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const parts = cleaned.split('-');
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }

  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) return new Date(parsed);

  return null;
}

function getCalculatedStayPeriod(stayPeriod) {
  if (!stayPeriod) return '-';
  const startDate = parseStayDate(stayPeriod);
  if (!startDate) return stayPeriod;

  const endDate = new Date();
  if (startDate > endDate) {
    return stayPeriod;
  }

  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);

  return `${stayPeriod} (${parts.join(', ')})`;
}

// Custom iOS-style Toggle Switch Component
function ToggleSwitch({ checked, onChange, disabled = false, labelLeft = '', labelRight = '' }) {
  return (
    <div className="flex items-center gap-1.5 select-none">
      {labelLeft && (
        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${!checked ? 'text-emerald-400' : 'text-slate-500'}`}>
          {labelLeft}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${checked ? 'bg-emerald-600' : 'bg-slate-700'}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
      {labelRight && (
        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${checked ? 'text-red-400' : 'text-slate-500'}`}>
          {labelRight}
        </span>
      )}
    </div>
  );
}

// ==========================================
// Full Employee Edit Panel Style Constants & Inputs
// ==========================================
const STANDARD_DEPTS = ['Administration', 'Science', 'Humanities', 'Science/Humanities', 'Secondary', 'MTS'];
const STANDARD_DESIGNATIONS = ['Principal', 'Vice Principal/Sr. Lecturer', 'Lecturer', 'I/C Lecturer', 'Master', 'Teacher', 'Teacher Grade II', 'Lab Assistant', 'Multi-tasking Staff'];
const STANDARD_SUBJECTS = ['Biology', 'Chemistry', 'Economics', 'Education', 'Environmental Science', 'General English', 'Healthcare', 'History', 'IT and ITES', 'Mathematics', 'Physical Education', 'Physics', 'Political Science', 'Urdu', 'Science', 'Social Studies', 'English'];
const panelInput = "w-full px-2.5 py-1.5 rounded text-xs font-medium focus:outline-none transition-colors";
const panelInputStyle = { background: 'var(--bg-page)', border: '1px solid var(--border-ui)', color: 'var(--text-main)' };
const panelInputFocusStyle = { borderColor: '#f97316' };
const panelLabel = "block text-[9px] font-extrabold uppercase tracking-wider mb-1";
const panelLabelStyle = { color: 'var(--text-muted)' };
const sectionHeader = "text-[10px] font-extrabold uppercase tracking-widest mb-3 flex items-center gap-3";
const divider = { borderTop: '1px solid var(--border-ui)', flex: 1 };
const sectionTitleStyle = { color: '#f97316' }; /* orange-400 */

function FInput({ field, label, data, onChange, type = 'text', mono = false, required = false }) {
  return (
    <div>
      <label className={panelLabel} style={panelLabelStyle}>
        {label}
        {required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      <input
        type={type}
        value={data[field] || ''}
        onChange={e => onChange(field, e.target.value)}
        className={panelInput + (mono ? ' font-mono' : '')}
        style={panelInputStyle}
        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
        onBlur={e => Object.assign(e.target.style, panelInputStyle)}
      />
    </div>
  );
}

// Hook into auth state at top-level of this module's component usage
// (we add a small wrapper inside the AdminPortal component below)

// ==========================================
// Firebase Auth UI helpers (Google Sign-In)
// ==========================================

function AuthControls({ user, onSignIn, onSignOut }) {
  return (
    <div className="flex items-center gap-3">
      {user ? (
        <>
          <div className="text-xs text-slate-300">Signed in: {user.email}</div>
          <button className="px-2 py-1 text-xs bg-slate-700 rounded" onClick={onSignOut}>Sign out</button>
        </>
      ) : (
        <button className="px-2 py-1 text-xs bg-emerald-600 rounded" onClick={onSignIn}>Sign in with Google</button>
      )}
    </div>
  );
}

// --- TAX CALCULATION LOGIC (Admin-configurable rules) ---
const sanitizeTaxConfig = (rawConfig) => {
  const defaults = DEFAULT_SETTINGS.taxConfig;
  const source = rawConfig || {};

  const sanitizeRegime = (regimeSource, regimeDefaults) => {
    const src = regimeSource || {};
    const slabsSource = Array.isArray(src.slabs) && src.slabs.length > 0 ? src.slabs : regimeDefaults.slabs;
    const surchargeSource = Array.isArray(src.surchargeBrackets) && src.surchargeBrackets.length > 0
      ? src.surchargeBrackets
      : regimeDefaults.surchargeBrackets;

    return {
      ...regimeDefaults,
      ...src,
      standardDeduction: Math.max(0, Number(src.standardDeduction ?? regimeDefaults.standardDeduction) || 0),
      rebateThreshold: Math.max(0, Number(src.rebateThreshold ?? regimeDefaults.rebateThreshold) || 0),
      rebateMax: Math.max(0, Number(src.rebateMax ?? regimeDefaults.rebateMax) || 0),
      marginalReliefEnabled: src.marginalReliefEnabled !== undefined ? !!src.marginalReliefEnabled : regimeDefaults.marginalReliefEnabled,
      includeSurcharge: src.includeSurcharge !== undefined ? !!src.includeSurcharge : regimeDefaults.includeSurcharge,
      slabs: slabsSource.map((slab, index) => ({
        ...(regimeDefaults.slabs[index] || {}),
        ...slab,
        label: slab?.label ?? regimeDefaults.slabs[index]?.label ?? `Slab ${index + 1}`,
        upto: slab?.upto === '' || slab?.upto === null || slab?.upto === undefined
          ? (regimeDefaults.slabs[index]?.upto ?? null)
          : Math.max(0, Number(slab.upto) || 0),
        rate: Math.max(0, Number(slab?.rate ?? regimeDefaults.slabs[index]?.rate) || 0)
      })),
      surchargeBrackets: surchargeSource.map((bracket, index) => ({
        ...(regimeDefaults.surchargeBrackets[index] || {}),
        ...bracket,
        label: bracket?.label ?? regimeDefaults.surchargeBrackets[index]?.label ?? `Surcharge ${index + 1}`,
        threshold: Math.max(0, Number(bracket?.threshold ?? regimeDefaults.surchargeBrackets[index]?.threshold) || 0),
        rate: Math.max(0, Number(bracket?.rate ?? regimeDefaults.surchargeBrackets[index]?.rate) || 0)
      })).sort((a, b) => a.threshold - b.threshold)
    };
  };

  // Migration for old flat structure
  let newSource = source.newRegime || {};
  let oldSource = source.oldRegime || {};
  if (!source.newRegime && (source.slabs || source.standardDeduction !== undefined)) {
    newSource = {
      label: source.regimeLabel || defaults.newRegime.label,
      standardDeduction: source.standardDeduction,
      rebateThreshold: source.rebateThreshold,
      rebateMax: source.rebateMax,
      marginalReliefEnabled: source.marginalReliefEnabled,
      includeSurcharge: source.includeSurcharge,
      slabs: source.slabs,
      surchargeBrackets: source.surchargeBrackets
    };
  }

  return {
    financialYearLabel: source.financialYearLabel || defaults.financialYearLabel,
    assessmentYearLabel: source.assessmentYearLabel || defaults.assessmentYearLabel,
    cessRate: Math.max(0, Number(source.cessRate ?? defaults.cessRate) || 0),
    newRegime: sanitizeRegime(newSource, defaults.newRegime),
    oldRegime: sanitizeRegime(oldSource, defaults.oldRegime)
  };
};

const calculateTaxFromTaxableIncome = (taxableIncomeInput, rawTaxConfig, regimeType = 'new') => {
  const fullTaxConfig = sanitizeTaxConfig(rawTaxConfig);
  const regimeConfig = regimeType === 'old' ? fullTaxConfig.oldRegime : fullTaxConfig.newRegime;
  const taxableIncome = Math.max(0, Number(taxableIncomeInput) || 0);
  const slabDetails = [];
  let lowerLimit = 0;
  let tax = 0;

  regimeConfig.slabs.forEach((slab) => {
    const upperLimit = slab.upto === null ? Number.POSITIVE_INFINITY : Math.max(lowerLimit, Number(slab.upto) || 0);
    const taxablePortion = Math.max(0, Math.min(taxableIncome, upperLimit) - lowerLimit);
    const taxAmount = taxablePortion * (slab.rate / 100);
    slabDetails.push({
      label: slab.label,
      rate: slab.rate,
      upto: slab.upto,
      lowerLimit,
      taxablePortion,
      tax: taxAmount
    });
    tax += taxAmount;
    lowerLimit = upperLimit;
  });

  const rebate = taxableIncome <= regimeConfig.rebateThreshold ? Math.min(tax, regimeConfig.rebateMax) : 0;
  const taxAfterRebate = Math.max(0, tax - rebate);

  // Marginal relief: compute based on tax (pre-rebate) to avoid mixing bases.
  // Relief = max(0, tax - (taxableIncome - rebateThreshold)) when income > threshold.
  const marginalRelief = regimeConfig.marginalReliefEnabled && taxableIncome > regimeConfig.rebateThreshold
    ? Math.max(0, tax - (taxableIncome - regimeConfig.rebateThreshold))
    : 0;

  // Apply marginal relief after rebate but cap at taxAfterRebate so we don't reduce below zero.
  const taxAfterRelief = Math.max(0, taxAfterRebate - Math.min(marginalRelief, taxAfterRebate));

  let surchargeRate = 0;
  let surcharge = 0;
  let surchargeMarginalRelief = 0;

  if (regimeConfig.includeSurcharge && taxAfterRelief > 0) {
    const applicableSurcharge = [...regimeConfig.surchargeBrackets]
      .filter((bracket) => taxableIncome > bracket.threshold)
      .pop();

    if (applicableSurcharge) {
      surchargeRate = applicableSurcharge.rate;
      const preliminarySurcharge = taxAfterRelief * (surchargeRate / 100);
      const preliminaryTaxWithSurcharge = taxAfterRelief + preliminarySurcharge;
      const thresholdSummary = calculateTaxFromTaxableIncome(applicableSurcharge.threshold, fullTaxConfig, regimeType);
      const maxTaxWithSurcharge = thresholdSummary.taxBeforeCess + (taxableIncome - applicableSurcharge.threshold);

      surchargeMarginalRelief = Math.max(0, preliminaryTaxWithSurcharge - maxTaxWithSurcharge);
      surcharge = Math.max(0, preliminarySurcharge - surchargeMarginalRelief);
    }
  }

  const taxBeforeCess = taxAfterRelief + surcharge;
  const cess = taxBeforeCess * (fullTaxConfig.cessRate / 100);

  return {
    taxConfig: fullTaxConfig,
    regimeConfig,
    regimeType,
    taxableIncome,
    standardDeduction: regimeConfig.standardDeduction,
    slabDetails,
    slabs: slabDetails.map((slab) => slab.tax),
    tax,
    rebate,
    marginalRelief,
    taxAfterRelief,
    surchargeRate,
    surcharge,
    surchargeMarginalRelief,
    taxBeforeCess,
    cess
  };
};

const calculateTax = (grossSalary, tdsUpToDate, rawTaxConfig, options = {}) => {
  const fullTaxConfig = sanitizeTaxConfig(rawTaxConfig);
  const regimeType = options.regime === 'old' ? 'old' : 'new';
  const regimeConfig = regimeType === 'old' ? fullTaxConfig.oldRegime : fullTaxConfig.newRegime;

  const gross = Math.max(0, Number(grossSalary) || 0);
  const tds = Math.max(0, Number(tdsUpToDate) || 0);

  // Deductions — regime-specific
  // 80C, 80D, HRA are only for old regime
  const deduction80C = regimeType === 'old' ? Math.min(150000, Math.max(0, Number(options.deduction80C) || 0)) : 0;
  const deduction80D = regimeType === 'old' ? Math.max(0, Number(options.deduction80D) || 0) : 0;
  const hraExemption = regimeType === 'old' ? Math.max(0, Number(options.hraExemption) || 0) : 0;
  // 80CCD(2) — NPS employer share — is allowed under BOTH old and new regime (not subject to 80C cap)
  const otherDeductions = Math.max(0, Number(options.otherDeductions) || 0);

  const totalDeductions = regimeConfig.standardDeduction + deduction80C + deduction80D + hraExemption + otherDeductions;
  const taxableIncome = Math.max(0, gross - totalDeductions);

  const calc = calculateTaxFromTaxableIncome(taxableIncome, fullTaxConfig, regimeType);
  const totalTax = Math.round(calc.taxBeforeCess + calc.cess);
  const taxPayableNow = Math.max(0, totalTax - tds);

  return {
    ...calc,
    grossSalary: gross,
    tds,
    deduction80C,
    deduction80D,
    hraExemption,
    otherDeductions,
    totalDeductions,
    totalTax,
    taxPayableNow
  };
};

const escapeCSVValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const TAX_CSV_DEFAULT_COLUMNS = [
  'page', 'name', 'designation', 'cpis_no', 'pan',
  'gross_salary', 'tax_regime', 'deduction_80c', 'deduction_80d', 'hra_exemption', 'other_deductions',
  'taxable_income', 'total_tax_payable', 'tds', 'tax_payable_now',
  'rebate', 'marginal_relief', 'cess'
];

const formatTaxCsvAmount = (amount) => {
  const value = Number(amount) || 0;
  return value > 0 ? value.toLocaleString('en-IN') : 'NIL';
};

const getEmployeePan = (emp) => {
  if (!emp) return '';
  return emp.pan || (emp.customFields && (emp.customFields.PAN || emp.customFields.pan)) || '';
};

const getEmployeeGross = (emp) => {
  if (!emp) return 0;
  const val = emp.grossSalary !== undefined ? emp.grossSalary : (emp.customFields && (emp.customFields['Gross Salary'] || emp.customFields.grossSalary));
  return val ? parseFloat(val) || 0 : 0;
};

const getEmployeeTds = (emp) => {
  if (!emp) return 0;
  const val = emp.tds !== undefined ? emp.tds : (emp.customFields && (emp.customFields.TDS || emp.customFields.tds || emp.customFields['TDS Paid'] || emp.customFields.TDS_Paid));
  return val ? parseFloat(val) || 0 : 0;
};

const getEmployeeRegime = (emp) => {
  if (!emp) return 'new';
  const val = emp.taxRegime !== undefined ? emp.taxRegime : (emp.customFields && (emp.customFields['Tax Regime'] || emp.customFields.taxRegime || emp.customFields.Regime || emp.customFields.regime));
  return val === 'old' ? 'old' : 'new';
};

const getEmployee80C = (emp) => {
  if (!emp) return 0;
  const val = emp.deduction80C !== undefined ? emp.deduction80C : (emp.customFields && (emp.customFields['80C Deductions'] || emp.customFields['80C'] || emp.customFields.deduction80C || emp.customFields.deduction_80c));
  return val ? parseFloat(val) || 0 : 0;
};

const getEmployee80D = (emp) => {
  if (!emp) return 0;
  const val = emp.deduction80D !== undefined ? emp.deduction80D : (emp.customFields && (emp.customFields['80D Deductions'] || emp.customFields['80D'] || emp.customFields.deduction80D || emp.customFields.deduction_80d));
  return val ? parseFloat(val) || 0 : 0;
};

const getEmployeeHra = (emp) => {
  if (!emp) return 0;
  const val = emp.hraExemption !== undefined ? emp.hraExemption : (emp.customFields && (emp.customFields['HRA Exemption'] || emp.customFields['HRA'] || emp.customFields.hraExemption || emp.customFields.hra_exemption));
  return val ? parseFloat(val) || 0 : 0;
};

const getEmployeeOtherDeductions = (emp) => {
  if (!emp) return 0;
  const val = emp.otherDeductions !== undefined ? emp.otherDeductions : (emp.customFields && (emp.customFields['Other Deductions'] || emp.customFields.otherDeductions || emp.customFields.other_deductions));
  return val ? parseFloat(val) || 0 : 0;
};

const getEmployeeTaxOptions = (emp) => {
  return {
    regime: getEmployeeRegime(emp),
    deduction80C: getEmployee80C(emp),
    deduction80D: getEmployee80D(emp),
    hraExemption: getEmployeeHra(emp),
    otherDeductions: getEmployeeOtherDeductions(emp)
  };
};

export default function AdminPortal() {
  const ALL_ADMIN_TABS = ['admissions', 'notices', 'faculty', 'slideshow', 'tax', 'export', 'admins', 'pages_cms'];

  const normalizeAdmin = (a) => {
    if (!a) return null;
    const copy = { ...a };
    copy.allowedTabs = Array.isArray(copy.allowedTabs) && copy.allowedTabs.length ? copy.allowedTabs : ALL_ADMIN_TABS.slice();
    return copy;
  };
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dynamic admin accounts list
  const [admins, setAdmins] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // Maintain a ref to currentUser to avoid infinite dependency loops in useEffects
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // New admin creation form states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('Admin');
  const [newAdminPermissions, setNewAdminPermissions] = useState(['admissions', 'notices', 'faculty', 'slideshow', 'tax', 'export', 'pages_cms']);

  // Tab states: 'admissions' | 'notices' | 'faculty' | 'export'
  const [activeTab, setActiveTab] = useState('admissions');
  const allowedTabs = currentUser?.email?.toLowerCase() === 'adm.exam.hss.shangus@gmail.com'
    ? ALL_ADMIN_TABS
    : (currentUser?.allowedTabs || []);

  // Configuration States
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [notices, setNotices] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');

  // File System Handle State
  const [folderHandle, setFolderHandle] = useState(null);

  // Page CMS States
  const [pagesList, setPagesList] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageBlocks, setPageBlocks] = useState([]);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [cmsSaving, setCmsSaving] = useState(false);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // Inline Editing States
  const [editingNoticeIdx, setEditingNoticeIdx] = useState(null);
  const [editNoticeData, setEditNoticeData] = useState({ date: '', title: '', link: '' });

  const [editingFacultyIdx, setEditingFacultyIdx] = useState(null);
  const [editFacultyData, setEditFacultyData] = useState({ name: '', designation: '', subject: '', email: '', mobile: '', department: 'Humanities', photo: '', profile: '', hidden: false, inactiveReason: '', if_deployed: 'No' });

  // Full Edit Modal States
  const [showFullEditModal, setShowFullEditModal] = useState(false);
  const [fullEditIndex, setFullEditIndex] = useState(null);
  const [fullEditData, setFullEditData] = useState(null);
  const [fullEditPhotoFile, setFullEditPhotoFile] = useState(null);
  const [fullEditPhotoName, setFullEditPhotoName] = useState('');
  const [fullEditPhotoExt, setFullEditPhotoExt] = useState('.jpg');

  // Bulk PDF Export States
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);
  const [bulkPrintSearch, setBulkPrintSearch] = useState('');
  const [bulkPrintDept, setBulkPrintDept] = useState('All');
  const [selectedBulkPrintNames, setSelectedBulkPrintNames] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState([]);

  // Photo Upload States
  const [newTeacherPhotoFile, setNewTeacherPhotoFile] = useState(null);
  const [newTeacherPhotoName, setNewTeacherPhotoName] = useState('');
  const [newTeacherPhotoExt, setNewTeacherPhotoExt] = useState('.jpg');

  const [editTeacherPhotoFile, setEditTeacherPhotoFile] = useState(null);
  const [editTeacherPhotoName, setEditTeacherPhotoName] = useState('');
  const [editTeacherPhotoExt, setEditTeacherPhotoExt] = useState('.jpg');

  // Slideshow States
  const [slides, setSlides] = useState([]);
  const [editingSlideIdx, setEditingSlideIdx] = useState(null);
  const [editSlideData, setEditSlideData] = useState({ image: '', title: '', caption: '' });
  const [newSlide, setNewSlide] = useState({ image: '', title: '', caption: '' });
  const [newSlidePhotoFile, setNewSlidePhotoFile] = useState(null);
  const [newSlidePhotoName, setNewSlidePhotoName] = useState('');
  const [newSlidePhotoExt, setNewSlidePhotoExt] = useState('.jpg');
  const [editSlidePhotoFile, setEditSlidePhotoFile] = useState(null);
  const [editSlidePhotoName, setEditSlidePhotoName] = useState('');
  const [editSlidePhotoExt, setEditSlidePhotoExt] = useState('.jpg');

  // CSV Import Preview and Validation States
  const [csvPreviewData, setCsvPreviewData] = useState(null);
  const [csvValidationErrors, setCsvValidationErrors] = useState(null);
  const [showCsvPreviewModal, setShowCsvPreviewModal] = useState(false);
  const [showCsvErrorModal, setShowCsvErrorModal] = useState(false);
  const [showCsvExportModal, setShowCsvExportModal] = useState(false);
  const [csvExportMode, setCsvExportMode] = useState('faculty');
  const [csvExportSearch, setCsvExportSearch] = useState('');
  const [csvExportDept, setCsvExportDept] = useState('All');
  const [selectedCsvEmployeeIndices, setSelectedCsvEmployeeIndices] = useState([]);
  const [selectedCsvColumns, setSelectedCsvColumns] = useState([]);

  const [editingTaxIdx, setEditingTaxIdx] = useState(null);
  const [editTaxData, setEditTaxData] = useState({
    pan: '',
    grossSalary: '',
    tds: '',
    regime: 'new',
    deduction80C: '',
    deduction80D: '',
    hraExemption: '',
    otherDeductions: ''
  });
  const [taxSearch, setTaxSearch] = useState('');
  const [selectedTaxCategories, setSelectedTaxCategories] = useState(['teaching_regular', 'non_teaching_regular']);
  const [isTaxFilterDropdownOpen, setIsTaxFilterDropdownOpen] = useState(false);
  const [selectedTaxEmployeeIndices, setSelectedTaxEmployeeIndices] = useState([]);

  const toggleEmployeeTaxSelection = (emp) => {
    const origIdx = faculty.indexOf(emp);
    if (selectedTaxEmployeeIndices.includes(origIdx)) {
      setSelectedTaxEmployeeIndices(selectedTaxEmployeeIndices.filter(idx => idx !== origIdx));
    } else {
      setSelectedTaxEmployeeIndices([...selectedTaxEmployeeIndices, origIdx]);
    }
  };

  const handleSelectAllTaxVisible = (visibleEmps) => {
    const visibleIndices = visibleEmps.map(emp => faculty.indexOf(emp));
    const allSelected = visibleIndices.every(idx => selectedTaxEmployeeIndices.includes(idx));

    if (allSelected) {
      setSelectedTaxEmployeeIndices(selectedTaxEmployeeIndices.filter(idx => !visibleIndices.includes(idx)));
    } else {
      const newSelection = new Set([...selectedTaxEmployeeIndices, ...visibleIndices]);
      setSelectedTaxEmployeeIndices(Array.from(newSelection));
    }
  };

  // Initialize selection with all visible employees by default
  useEffect(() => {
    if (faculty.length > 0 && selectedTaxEmployeeIndices.length === 0) {
      const defaultIndices = faculty
        .map((emp, index) => ({ emp, index }))
        .filter(({ emp }) => {
          const cat = getEmployeeTaxCategory(emp);
          return cat === 'teaching_regular' || cat === 'non_teaching_regular';
        })
        .map(({ index }) => index);
      setSelectedTaxEmployeeIndices(defaultIndices);
    }
  }, [faculty]);

  // Classify employee as Non-Teaching (MTS, Lab Asst, Peon, etc.)
  const isNonTeaching = (emp) => {
    const d = (emp.designation || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    return dept === 'mts' || d.includes('mts') || d.includes('lab assistant') ||
      d.includes('lab bearer') || d.includes('library bearer') ||
      d.includes('peon') || d.includes('chowkidar') || d.includes('safaiwalla') ||
      d.includes('class iv') || d.includes('driver') || d.includes('attendant');
  };

  const TAX_CATEGORIES = [
    { key: 'teaching_regular', label: 'Teaching (Active & Regular)', color: 'bg-blue-600 border-blue-500' },
    { key: 'non_teaching_regular', label: 'Non-Teaching (Active & Regular)', color: 'bg-violet-600 border-violet-600' },
    { key: 'deployed_in', label: 'Deployed In', color: 'bg-emerald-600 border-emerald-500' },
    { key: 'deployed_out', label: 'Deployed Out', color: 'bg-amber-600 border-amber-500' },
    { key: 'retired', label: 'Retired', color: 'bg-red-600 border-red-500' },
    { key: 'transferred', label: 'Transferred', color: 'bg-slate-600 border-slate-500' },
    { key: 'other_inactive', label: 'Drawing Pay / Other Inactive', color: 'bg-gray-600 border-gray-500' }
  ];

  const getEmployeeTaxCategory = (emp) => {
    const isNT = isNonTeaching(emp);
    const isDeployedIn = emp.if_deployed === 'in' || emp.if_deployed === 'Yes';
    const isDeployedOut = emp.if_deployed === 'out' || emp.inactiveReason === 'Deployed Out';
    const isRetired = emp.hidden && emp.inactiveReason === 'Retired';
    const isTransferred = emp.hidden && emp.inactiveReason === 'Transferred';
    const isOtherInactive = emp.hidden && emp.inactiveReason && 
      emp.inactiveReason !== 'Retired' && 
      emp.inactiveReason !== 'Transferred' && 
      emp.inactiveReason !== 'Deployed Out';

    if (isDeployedIn) return 'deployed_in';
    if (isDeployedOut) return 'deployed_out';
    if (isRetired) return 'retired';
    if (isTransferred) return 'transferred';
    if (isOtherInactive) return 'other_inactive';

    if (emp.hidden) return 'other_inactive';

    return isNT ? 'non_teaching_regular' : 'teaching_regular';
  };

  const [activeRegimeSettingsTab, setActiveRegimeSettingsTab] = useState('new');
  const [activeTaxPreviewRegime, setActiveTaxPreviewRegime] = useState('new');
  const [showTaxRules, setShowTaxRules] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(null);
  const [saveProgress, setSaveProgress] = useState(null); // null = idle, 0-100 = save running
  const [saveStages, setSaveStages] = useState([]); // array of stage objects
  const [savePopupResult, setSavePopupResult] = useState(null); // success/error popup content
  const [dataIssues, setDataIssues] = useState([]);
  const [showIssuesList, setShowIssuesList] = useState(false);
  // Map of faculty index => { severity: 'error'|'warning', messages: string[] }
  const [facultyIssueMap, setFacultyIssueMap] = useState({});

  // CAPTCHA and rate-limiting lockout states
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0, operation: '+', result: 0 });
  const [captchaInput, setCaptchaInput] = useState('');
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleValue, setShuffleValue] = useState('? + ?');
  const captchaIntervalRef = useRef(null);
  const taxConfig = sanitizeTaxConfig(settings.taxConfig);
  const previewRegimeConfig = activeTaxPreviewRegime === 'old' ? taxConfig.oldRegime : taxConfig.newRegime;
  const previewTaxFreeGross = previewRegimeConfig.standardDeduction + previewRegimeConfig.rebateThreshold;

  const getFilteredTaxFaculty = () => {
    return faculty.filter(emp => {
      const cat = getEmployeeTaxCategory(emp);
      if (!selectedTaxCategories.includes(cat)) {
        return false;
      }
      const term = taxSearch.toLowerCase();
      return !term ||
        emp.name.toLowerCase().includes(term) ||
        (emp.cpis_no || '').toLowerCase().includes(term) ||
        emp.designation.toLowerCase().includes(term);
    });
  };

  const getVisibleTaxFaculty = () => {
    return getFilteredTaxFaculty();
  };

  const getSelectedVisibleTaxFaculty = () => {
    return getVisibleTaxFaculty().filter(emp => {
      const origIdx = faculty.indexOf(emp);
      return selectedTaxEmployeeIndices.includes(origIdx);
    });
  };

  // Helper to generate a dynamic math challenge with a 1-second randomization animation
  const generateCaptcha = (shouldShuffle = true) => {
    if (captchaIntervalRef.current) {
      clearInterval(captchaIntervalRef.current);
      captchaIntervalRef.current = null;
    }
    setCaptchaInput('');

    const operations = ['+', '-'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    let n1, n2, res;
    if (op === '+') {
      n1 = Math.floor(Math.random() * 20) + 1;
      n2 = Math.floor(Math.random() * 20) + 1;
      res = n1 + n2;
    } else {
      n1 = Math.floor(Math.random() * 30) + 10;
      n2 = Math.floor(Math.random() * n1) + 1;
      res = n1 - n2;
    }

    if (!shouldShuffle) {
      setCaptcha({ num1: n1, num2: n2, operation: op, result: res });
      setIsShuffling(false);
      return;
    }

    setIsShuffling(true);
    let count = 0;
    const intervalId = setInterval(() => {
      const ops = ['+', '-'];
      const randomOp = ops[ops.length - 1 - Math.floor(Math.random() * ops.length)];
      const r1 = Math.floor(Math.random() * 40) + 1;
      const r2 = Math.floor(Math.random() * 30) + 1;
      setShuffleValue(`${r1} ${randomOp} ${r2}`);

      count += 100;
      if (count >= 1000) {
        clearInterval(intervalId);
        if (captchaIntervalRef.current === intervalId) {
          captchaIntervalRef.current = null;
        }
        setCaptcha({ num1: n1, num2: n2, operation: op, result: res });
        setIsShuffling(false);
      }
    }, 100);
    captchaIntervalRef.current = intervalId;
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (captchaIntervalRef.current) {
        clearInterval(captchaIntervalRef.current);
      }
    };
  }, []);

  // Firebase auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        // No firebase user — fall back to local admin session state
        setIsAuthenticated(!!currentUserRef.current);
        return;
      }

      // Verify that the signed-in Firebase user is authorized as an admin
      try {
        const idToken = await getIdTokenResult(user, false);
        const isAdminClaim = idToken?.claims?.admin === true;
        const userEmail = (user.email || '').toLowerCase();
        const listedAdmin = Array.isArray(admins) && admins.find(a => a.email.toLowerCase() === userEmail);
        // Also check hardcoded defaults as a fallback during initial load race
        const defaultAdmin = DEFAULT_ADMINS.find(a => a.email.toLowerCase() === userEmail);
        const isSuperAdmin = userEmail === 'adm.exam.hss.shangus@gmail.com';

        if (!user.emailVerified && !isAdminClaim) {
          setIsAuthenticated(false);
          setAuthError('Your email address has not been verified. Please verify your email before logging in as an administrator.');
        } else if (isAdminClaim || listedAdmin || defaultAdmin || isSuperAdmin) {
          // If we have a local admin entry, use it as the currentUser for permissions
          const matchedAdmin = listedAdmin || defaultAdmin;
          if (matchedAdmin) {
            setCurrentUser(prev => {
              if (prev && prev.email.toLowerCase() === matchedAdmin.email.toLowerCase()) {
                return prev;
              }
              return normalizeAdmin(matchedAdmin);
            });
          }
          setIsAuthenticated(true);
          setAuthError('');
        } else {
          // Signed in to Firebase but not authorized as admin locally
          setIsAuthenticated(false);
          setAuthError('Signed in with Google, but this account is not registered as an administrator. Use local admin login or ask a Super Admin to add you.');
        }
      } catch (err) {
        console.warn('Failed to verify Firebase ID token:', err);
        // Conservatively do not authenticate UI until verification completes
        setIsAuthenticated(false);
        setAuthError('Failed to validate Google sign-in. Please try again.');
      }
    });
    return () => unsub();
  }, [admins]);

  // Helper to log out (also sign out of Firebase if signed in)
  const handleLogout = async (reason) => {
    // Clear session/local storage and UI state
    sessionStorage.removeItem('isAdminAuthenticated');
    sessionStorage.removeItem('admin_session_id');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('activeAdminTab');
    setCurrentUser(null);
    setIsAuthenticated(false);
    generateCaptcha(false); // Generate fresh CAPTCHA on logout without shaking

    // Sign out of Firebase auth if present to avoid automatic re-login on refresh
    try {
      if (auth && auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch (err) {
      console.warn('Firebase sign-out failed:', err);
    }

    if (reason === 'logged_out_elsewhere') {
      setAuthError('You have been logged out because a new session was started in another tab.');
    } else if (reason === 'inactivity') {
      localStorage.removeItem('admin_active_session_id');
      localStorage.removeItem('admin_last_active');
      try {
        const channel = new BroadcastChannel('hss_admin_session');
        channel.postMessage({ type: 'LOGOUT', reason: 'inactivity' });
        channel.close();
      } catch (err) {
        // ignore
      }
      setAuthError('You have been logged out due to inactivity.');
    } else if (reason === 'sync_logout') {
      setAuthError('');
    } else {
      localStorage.removeItem('admin_active_session_id');
      localStorage.removeItem('admin_last_active');
      try {
        const channel = new BroadcastChannel('hss_admin_session');
        channel.postMessage({ type: 'LOGOUT', reason: 'sync_logout' });
        channel.close();
      } catch (err) {
        // ignore
      }
      setAuthError('');
    }
  };

  const showAlert = (message, title = 'Notification') => {
    setCustomPrompt({
      title,
      message,
      type: 'alert',
      confirmText: 'OK',
      confirmClass: 'btn-primary-custom shadow-md border-0',
      onConfirm: () => setCustomPrompt(null)
    });
  };

  // Login handler with hash comparison, CAPTCHA check, and lockout limit
  const handleLogin = async (e) => {
    e.preventDefault();

    // Check if lockout active
    const lockoutUntil = parseInt(localStorage.getItem('admin_lockout_until') || '0');
    if (lockoutUntil > Date.now()) {
      setAuthError('Console is locked due to too many failed attempts.');
      return;
    }

    // Verify CAPTCHA
    if (captchaInput.trim() !== captcha.result.toString()) {
      setAuthError('Incorrect CAPTCHA answer. Please verify and try again.');
      generateCaptcha();
      return;
    }

    // Look up admin by email
    const foundAdmin = admins.find(a => a.email.toLowerCase().trim() === email.toLowerCase().trim());

    // Hash password input using explicit algorithm when available.
    // Prefer `hashAlgo === 'pbkdf2'` or presence of `salt` for PBKDF2; otherwise use plain SHA-256.
    const usePBKDF2 = !!(foundAdmin && (foundAdmin.hashAlgo === 'pbkdf2' || foundAdmin.salt));
    const inputHash = usePBKDF2 ? await hashPassword(password, foundAdmin.salt) : await hashPassword(password);

    if (foundAdmin && inputHash === foundAdmin.passwordHash) {
      localStorage.removeItem('admin_failed_attempts');
      localStorage.removeItem('admin_last_failed_time');
      localStorage.removeItem('admin_lockout_until');

      // Set unique session token for this device/tab
      const newSessionId = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
      sessionStorage.setItem('admin_session_id', newSessionId);
      localStorage.setItem('admin_active_session_id', newSessionId);
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      sessionStorage.setItem('adminUser', JSON.stringify(foundAdmin));

      setCurrentUser(normalizeAdmin(foundAdmin));
      setIsAuthenticated(true);
      setAuthError('');
      setEmail('');
      setPassword('');
      setCaptchaInput('');

      // Auto-open first permitted tab (guard against missing allowedTabs)
      const allowed = Array.isArray(foundAdmin.allowedTabs) ? foundAdmin.allowedTabs : [];
      const firstTab = allowed.length ? allowed[0] : 'admissions';
      setActiveTab(firstTab);
      sessionStorage.setItem('activeAdminTab', firstTab);

      // Notify other tabs
      try {
        const channel = new BroadcastChannel('hss_admin_session');
        channel.postMessage({ type: 'LOGIN', sessionId: newSessionId });
        channel.close();
      } catch (err) {
        // ignore
      }
    } else {
      const now = Date.now();
      const lastFailedTime = parseInt(localStorage.getItem('admin_last_failed_time') || '0');
      let currentAttempts = parseInt(localStorage.getItem('admin_failed_attempts') || '0');

      // Reset count if last failed attempt was more than 15 minutes ago
      if (now - lastFailedTime > 15 * 60 * 1000) {
        currentAttempts = 0;
      }

      const attempts = currentAttempts + 1;
      localStorage.setItem('admin_failed_attempts', attempts.toString());
      localStorage.setItem('admin_last_failed_time', now.toString());

      if (attempts >= 6) {
        const lockoutUntilTime = now + 15 * 60 * 1000; // 15 mins
        localStorage.setItem('admin_lockout_until', lockoutUntilTime.toString());
        setAuthError('Too many failed attempts. Console locked for 15 minutes.');
      } else {
        setAuthError(`Incorrect credentials. Attempt ${attempts} of 5. Please try again.`);
      }
      generateCaptcha();
    }
  };

  // Firebase Google sign-in and sign-out handlers
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Try pop-up first to avoid page redirect and loss of local unsaved state
      try {
        await signInWithPopup(auth, provider);
      } catch (popupErr) {
        console.warn('Popup sign-in blocked or failed, falling back to redirect:', popupErr);
        await signInWithRedirect(auth, provider);
      }
    } catch (err) {
      console.error('Google sign-in failed', err);
      showAlert('Google sign-in failed: ' + (err.message || err));
    }
  };


  const handleGoogleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      setFirebaseUser(null);
      setIsAuthenticated(!!currentUser);
    } catch (err) {
      console.error('Sign-out failed', err);
      showAlert('Sign-out failed: ' + (err.message || err));
    }
  };

  // Handle redirect sign-in results (executes once on mount)
  useEffect(() => {
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          setFirebaseUser(result.user);
          // onAuthStateChanged handler will verify admin claim and update `isAuthenticated`
        }
      } catch (err) {
        // Ignore no-result cases or log unexpected errors
        if (err && err.code && err.code !== 'auth/no-auth-event') {
          console.error('getRedirectResult error:', err);
        }
      }
    })();
  }, []);

  // Check session, load folder handle on mount, start cross-tab listening
  useEffect(() => {
    // Helper to sync currentUser session with latest admins list
    const syncCurrentUserSession = (latestAdmins, currentSessionUser) => {
      if (!currentSessionUser) return;
      const match = latestAdmins.find(a => a.email.toLowerCase() === currentSessionUser.email.toLowerCase());
      if (match) {
        // Check if permissions or role changed
        const permissionsChanged = JSON.stringify(match.allowedTabs || []) !== JSON.stringify(currentSessionUser.allowedTabs || []);
        const roleChanged = match.role !== currentSessionUser.role;
        const passChanged = match.passwordHash !== currentSessionUser.passwordHash;

        if (passChanged) {
          handleLogout('logged_out_elsewhere');
          showAlert("Your password has been changed. Please log in again.", "Security Update");
        } else if (permissionsChanged || roleChanged) {
          sessionStorage.setItem('adminUser', JSON.stringify(match));
          setCurrentUser(normalizeAdmin(match));
          const savedTab = sessionStorage.getItem('activeAdminTab') || 'admissions';
          const matchAllowed = Array.isArray(match.allowedTabs) ? match.allowedTabs : [];
          if (!matchAllowed.includes(savedTab)) {
            const firstTab = matchAllowed.length ? matchAllowed[0] : 'admissions';
            setActiveTab(firstTab);
            sessionStorage.setItem('activeAdminTab', firstTab);
          }
        }
      } else {
        handleLogout('logged_out_elsewhere');
        showAlert("Your administrator account has been deleted.", "Account Deleted");
      }
    };

    // 1. Restore session info first to know current logged-in user
    const sessionUser = sessionStorage.getItem('adminUser');
    let currentSessionUser = null;
    if (sessionStorage.getItem('isAdminAuthenticated') === 'true' && sessionUser) {
      try {
        currentSessionUser = JSON.parse(sessionUser);
      } catch (e) { }
    }

    // 2. Always fetch latest admins — Firestore first, then server, then localStorage
    fetchAdminsFromServer(currentSessionUser);

    async function fetchAdminsFromServer(sessionUserObj) {
      // Try Firestore first
      try {
        const snap = await getDoc(doc(db, 'site', 'admins'));
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            setAdmins(data.items);
            localStorage.setItem('site_admins', JSON.stringify(data.items));
            if (sessionUserObj) {
              syncCurrentUserSession(data.items, sessionUserObj);
            }
            return;
          }
        }
      } catch (e) {
        console.warn('Firestore admins read failed, falling back:', e);
      }

      // Fallback: static file
      try {
        const r = await fetch('/slides/admins.json?t=' + Date.now(), { cache: 'no-cache' });
        if (!r.ok) throw new Error('Not found');
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          setAdmins(data);
          localStorage.setItem('site_admins', JSON.stringify(data));
          if (sessionUserObj) {
            syncCurrentUserSession(data, sessionUserObj);
          }
          return;
        }
      } catch (e) {
        // fall through
      }

      loadFallbackAdmins(sessionUserObj);
    }

    function loadFallbackAdmins(sessionUserObj) {
      const localAdmins = localStorage.getItem('site_admins');
      if (localAdmins) {
        try {
          const parsed = JSON.parse(localAdmins);
          setAdmins(parsed);
          if (sessionUserObj) {
            syncCurrentUserSession(parsed, sessionUserObj);
          }
          return;
        } catch (e) { }
      }
      setAdmins(DEFAULT_ADMINS);
      localStorage.setItem('site_admins', JSON.stringify(DEFAULT_ADMINS));
      if (sessionUserObj) {
        syncCurrentUserSession(DEFAULT_ADMINS, sessionUserObj);
      }
    }

    // 3. Restore session (tab redirection, etc.)
    const currentSessionId = sessionStorage.getItem('admin_session_id');
    const activeSessionId = localStorage.getItem('admin_active_session_id');

    // Restore session if present in sessionStorage (valid for the lifetime of this tab)
    if (sessionStorage.getItem('isAdminAuthenticated') === 'true' && sessionUser) {
      if (currentSessionId && activeSessionId && currentSessionId !== activeSessionId) {
        handleLogout('logged_out_elsewhere');
      } else {
        const parsedUser = JSON.parse(sessionUser);
        setCurrentUser(normalizeAdmin(parsedUser));
        setIsAuthenticated(true);
        const savedTab = sessionStorage.getItem('activeAdminTab');
        const parsedAllowed = Array.isArray(parsedUser.allowedTabs) ? parsedUser.allowedTabs : [];
        if (savedTab && parsedAllowed.includes(savedTab)) {
          setActiveTab(savedTab);
        } else {
          setActiveTab(parsedAllowed.length ? parsedAllowed[0] : 'admissions');
        }
      }
    } else {
      // clear any stale sessionStorage if persistence not allowed
      sessionStorage.removeItem('isAdminAuthenticated');
      sessionStorage.removeItem('admin_session_id');
      sessionStorage.removeItem('adminUser');
      sessionStorage.removeItem('activeAdminTab');
      generateCaptcha(false);
    }

    // Monitor local storage cross-tab session changes
    const handleStorageChange = (e) => {
      if (e.key === 'admin_active_session_id') {
        const newSessionId = e.newValue;
        const mySessionId = sessionStorage.getItem('admin_session_id');
        if (newSessionId && mySessionId && newSessionId !== mySessionId) {
          handleLogout('logged_out_elsewhere');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Monitor BroadcastChannel notifications
    let channel;
    try {
      channel = new BroadcastChannel('hss_admin_session');
      channel.onmessage = (event) => {
        const mySessionId = sessionStorage.getItem('admin_session_id');
        if (event.data.type === 'LOGIN' && event.data.sessionId !== mySessionId) {
          handleLogout('logged_out_elsewhere');
        } else if (event.data.type === 'LOGOUT') {
          handleLogout(event.data.reason);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.close();
      }
    };
  }, []);

  // Monitor lockout countdown
  useEffect(() => {
    const checkLockout = () => {
      const lockoutUntil = parseInt(localStorage.getItem('admin_lockout_until') || '0');
      const now = Date.now();
      if (lockoutUntil > now) {
        setLockoutTimeLeft(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        setLockoutTimeLeft(0);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  // Monitor inactivity auto-logout (15 minutes) - cross-tab synchronized
  useEffect(() => {
    if (!isAuthenticated) return;

    const INACTIVITY_LIMIT = 15 * 60 * 1000;

    const updateLastActive = () => {
      localStorage.setItem('admin_last_active', Date.now().toString());
    };

    // Set initial active time
    updateLastActive();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, updateLastActive);
    });

    const checkInterval = setInterval(() => {
      const lastActive = parseInt(localStorage.getItem('admin_last_active') || '0');
      if (Date.now() - lastActive >= INACTIVITY_LIMIT) {
        handleLogout('inactivity');
      }
    }, 5000);

    return () => {
      clearInterval(checkInterval);
      events.forEach(event => {
        window.removeEventListener(event, updateLastActive);
      });
    };
  }, [isAuthenticated]);

  // Validate existing faculty and notice data on changes
  useEffect(() => {
    const issues = [];
    const rowIssueMap = {}; // index -> { severity, messages[] }

    const addRowIssue = (index, type, msg) => {
      if (!rowIssueMap[index]) rowIssueMap[index] = { severity: type, messages: [] };
      if (type === 'error') rowIssueMap[index].severity = 'error';
      rowIssueMap[index].messages.push(msg);
    };

    // Build maps for fields that MUST be unique: CPIS No and Mobile No only.
    // Name, email, etc. are intentionally NOT flagged as duplicates.
    const cpisMap = new Map();
    const mobileMap = new Map();

    faculty.forEach((t, index) => {
      if (t.cpis_no && t.cpis_no.trim()) {
        const k = t.cpis_no.trim();
        cpisMap.set(k, [...(cpisMap.get(k) || []), index]);
      }
      if (t.mobile && t.mobile.trim()) {
        const k = t.mobile.replace(/[^0-9]/g, '');
        mobileMap.set(k, [...(mobileMap.get(k) || []), index]);
      }
    });

    faculty.forEach((t, index) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[0-9\s\-]{10,15}$/;

      // Duplicate CPIS No — must be unique (government identifier)
      if (t.cpis_no && t.cpis_no.trim()) {
        const dupeIndices = cpisMap.get(t.cpis_no.trim()) || [];
        if (dupeIndices.length > 1) {
          const msg = `Duplicate CPIS No "${t.cpis_no}". CPIS numbers must be unique across all employees.`;
          if (dupeIndices[0] === index) {
            issues.push({ type: 'error', category: 'Faculty Roster', message: `Duplicate CPIS No "${t.cpis_no}" found for "${t.name}". CPIS numbers must be unique.` });
          }
          addRowIssue(index, 'error', msg);
        }
      }

      // Duplicate Mobile No — should be unique per employee
      if (t.mobile && t.mobile.trim()) {
        const k = t.mobile.replace(/[^0-9]/g, '');
        const dupeIndices = mobileMap.get(k) || [];
        if (dupeIndices.length > 1) {
          const msg = `Duplicate mobile number "${t.mobile}". Two employees share this number.`;
          if (dupeIndices[0] === index) {
            issues.push({ type: 'warning', category: 'Faculty Roster', message: `Duplicate Contact Number "${t.mobile}" found for "${t.name}".` });
          }
          addRowIssue(index, 'warning', msg);
        }
      }

      // Invalid email format (format check only, duplicates are allowed)
      if (t.email && t.email.trim() !== '' && !emailRegex.test(t.email.trim())) {
        const msg = `Invalid email format: "${t.email}".`;
        issues.push({ type: 'error', category: 'Faculty Roster', message: `Employee "${t.name}" has an invalid email format: "${t.email}".` });
        addRowIssue(index, 'error', msg);
      }

      // Invalid phone format
      if (t.mobile && t.mobile.trim() !== '' && !phoneRegex.test(t.mobile.trim())) {
        const msg = `Invalid phone format: "${t.mobile}". Must be 10-15 digits.`;
        issues.push({ type: 'error', category: 'Faculty Roster', message: `Employee "${t.name}" has an invalid phone number format: "${t.mobile}".` });
        addRowIssue(index, 'error', msg);
      }
    });

    // Check notices issues
    const seenNoticeTitles = new Set();
    notices.forEach((n) => {
      if (n.title) {
        if (seenNoticeTitles.has(n.title.trim())) {
          issues.push({ type: 'warning', category: 'Notice Board', message: `Duplicate announcement title: "${n.title}".` });
        } else {
          seenNoticeTitles.add(n.title.trim());
        }
      }
      if (n.link && n.link.trim() !== '#' && !n.link.startsWith('http') && !n.link.startsWith('/')) {
        issues.push({ type: 'warning', category: 'Notice Board', message: `Notice "${n.title}" has a potentially broken local link: "${n.link}". It should start with http://, https://, or /.` });
      }
    });

    setDataIssues(issues);
    setFacultyIssueMap(rowIssueMap);
  }, [faculty, notices]);


  // Fetch configs and folder handle on login
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);

    // Retrieve folder handle from IndexedDB
    getFolderHandle().then((handle) => {
      if (handle) {
        // Query if permission is already granted
        handle.queryPermission({ mode: 'readwrite' }).then((status) => {
          if (status === 'granted') {
            setFolderHandle(handle);
          }
        }).catch(err => console.warn('Could not query handle permission:', err));
      }
    }).catch(err => console.warn('Could not retrieve folder handle from DB:', err));

    // 1. Load admissions settings — always go through loadSiteSettings()
    //    so that any migrations (e.g. marginalReliefEnabled fix) are applied.
    loadSiteSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
    });

    const loadPages = async () => {
      try {
        const snap = await getDoc(doc(db, 'site', 'pages'));
        if (snap.exists()) {
          setPagesList(snap.data().list || []);
        } else {
          const defaultPagesList = [
            { id: 'home', title: 'Home', isSystem: true, isActive: true, order: 0 },
            { id: 'about', title: 'About Us', isSystem: true, isActive: true, order: 1 },
            { id: 'academics', title: 'Academics', isSystem: true, isActive: true, order: 2 },
            { id: 'admissions', title: 'Admissions', isSystem: true, isActive: true, order: 3 }
          ];
          setPagesList(defaultPagesList);
          await setDoc(doc(db, 'site', 'pages'), { list: defaultPagesList });
        }
      } catch (err) {
        console.warn('Failed to load page registry on login:', err);
      }
    };
    loadPages();

    // 2. Load notices — Firestore first, then localStorage, then static file
    const parseNoticesText = (text) => {
      return (text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const firstComma = line.indexOf(',');
          if (firstComma === -1) return null;
          const date = line.substring(0, firstComma).trim();
          const rest = line.substring(firstComma + 1);

          const secondComma = rest.indexOf(',');
          if (secondComma === -1) {
            return { date, title: rest.trim(), link: '#' };
          }
          const title = rest.substring(0, secondComma).trim();
          const rest2 = rest.substring(secondComma + 1).trim();

          const thirdComma = rest2.indexOf(',');
          if (thirdComma === -1) {
            return { date, title, link: rest2 };
          }
          const link = rest2.substring(0, thirdComma).trim();
          const days = rest2.substring(thirdComma + 1).trim();
          return { date, title, link, days: days ? parseInt(days, 10) : undefined };
        })
        .filter(Boolean);
    };

    (async () => {
      // 1. Fallback/Preview: Check localStorage first so local changes aren't lost on redirect/reload
      const localNotices = localStorage.getItem('site_notices');
      if (localNotices) {
        const parsed = parseNoticesText(localNotices);
        if (parsed.length > 0) {
          setNotices(parsed);
          return;
        }
      }

      // 2. Try Firestore next (remote live data)
      try {
        const snap = await getDoc(doc(db, 'site', 'notices'));
        if (snap.exists()) {
          const data = snap.data();
          if (data && data.text !== undefined) {
            const parsed = parseNoticesText(data.text);
            if (parsed.length > 0) {
              setNotices(parsed);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Firestore notices read failed, falling back:', e);
      }

      // Fallback: static file
      try {
        const r = await fetch('/slides/notices.txt?t=' + Date.now(), { cache: 'no-cache' });
        const text = await r.text();
        const parsed = parseNoticesText(text);
        if (parsed.length > 0) {
          setNotices(parsed);
          return;
        }
      } catch (e) {
        // ignore
      }

      // Final fallback: hardcoded defaults
      setNotices([
        { date: 'Nov 23', title: 'JKBOSE Datesheet', link: 'https://jkbose.nic.in' },
        { date: 'Nov 23', title: 'PreBoard Results', link: '#' },
        { date: 'Nov 23', title: 'Admit Cards', link: '/admissions' }
      ]);
    })();

    // 2b. Load slideshow configuration
    (async () => {
      // Check localStorage first
      const local = localStorage.getItem('site_slides');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSlides(parsed);
            return;
          }
        } catch (e) {
          console.warn('Error reading site_slides from localStorage:', e);
        }
      }

      // Try Firestore next
      try {
        const snap = await getDoc(doc(db, 'site', 'slideshow'));
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.items)) {
            setSlides(data.items);
            localStorage.setItem('site_slides', JSON.stringify(data.items));
            return;
          }
        }
      } catch (e) {
        console.warn('Firestore slideshow read failed, falling back:', e);
      }

      // Fallback: static file
      try {
        const r = await fetch('/slides/slides.txt?t=' + Date.now(), { cache: 'no-cache' });
        if (r.ok) {
          const text = await r.text();
          const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          const mapped = lines.map((line, idx) => {
            const parts = line.split(',');
            if (parts[0] && parts[0].includes('.')) {
              const image = parts[0].trim();
              const title = (parts[1] || '').trim();
              const caption = (parts.slice(2).join(',') || '').trim();
              return { image: '/slides/' + image, title, caption };
            }
            const title = (parts[0] || '').trim();
            const caption = (parts.slice(1).join(',') || '').trim();
            const image = `/slides/${idx + 1}.jpg`;
            return { image, title, caption };
          });
          setSlides(mapped);
          localStorage.setItem('site_slides', JSON.stringify(mapped));
        }
      } catch (e) {
        console.warn('Failed to load slides.txt:', e);
      }
    })();

    // 3. Load faculty directory
    const localFaculty = localStorage.getItem('site_faculty');
    if (localFaculty) {
      try {
        const parsed = JSON.parse(localFaculty);
        if (Array.isArray(parsed)) {
          setFaculty(parsed);
          setLoading(false);
        } else {
          throw new Error('Not an array');
        }
      } catch (e) {
        console.warn('Error reading site_faculty from localStorage:', e);
        fetchFacultyFromServer();
      }
    } else {
      fetchFacultyFromServer();
    }

    function fetchFacultyFromServer() {
      (async () => {
        try {
          // Try Firestore first
          try {
            const snap = await getDoc(doc(db, 'site', 'faculty'));
            if (snap.exists()) {
              const data = snap.data();
              if (data && Array.isArray(data.items)) {
                setFaculty(data.items);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            // ignore and fallback to static fetch
          }

          const r = await fetch('/slides/faculty.json?t=' + Date.now(), { cache: 'no-cache' });
          const data = await r.json();
          if (Array.isArray(data)) setFaculty(data);
        } catch (err) {
          setFaculty([
            { name: "Mr. Aijaz Ahmad Wagay", designation: "Principal", subject: "Chemistry", email: "ghssshangus74@gmail.com", mobile: "+91-7006034501", photo: "/slides/Principal.jpg", department: "Administration" }
          ]);
        } finally {
          setLoading(false);
        }
      })();
    }

  }, [isAuthenticated]);

  // Request directory access picker
  const handleLinkFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        showAlert('Your browser does not support the File System Access API. Please use a modern version of Chrome, Edge, or Opera.', 'API Not Supported');
        return;
      }
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      // Verify write permission
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await saveFolderHandle(handle);
        setFolderHandle(handle);
        setSaveSuccess('Local slides folder linked and synced successfully!');
        setTimeout(() => setSaveSuccess(''), 4000);
      } else {
        showAlert('Write permission is required to automatically save changes to your files.', 'Permission Required');
      }
    } catch (e) {
      console.error('Error selecting directory:', e);
    }
  };

  // Helper function to write to linked local folder
  const writeLocalFile = async (handle, filename, content) => {
    try {
      const fileHandle = await handle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      console.error(`Error writing file ${filename} directly:`, e);
      return false;
    }
  };

  // Settings handlers
  const handleGlobalToggle = () => {
    setSettings((s) => ({ ...s, globalAdmissionsClosed: !s.globalAdmissionsClosed }));
  };

  const handleClassToggle = (cls) => {
    setSettings((s) => ({
      ...s,
      admissionsClosed: {
        ...s.admissionsClosed,
        [cls]: !s.admissionsClosed[cls]
      }
    }));
  };

  const handleFeeChange = (key, val) => {
    const num = parseInt(val) || 0;
    setSettings((s) => ({
      ...s,
      fees: {
        ...s.fees,
        [key]: num
      }
    }));
  };

  const handleTaxConfigFieldChange = (field, value, numeric = false) => {
    const isGlobal = ['financialYearLabel', 'assessmentYearLabel', 'cessRate'].includes(field);
    setSettings((s) => {
      const taxConfig = { ...(s.taxConfig || DEFAULT_SETTINGS.taxConfig) };
      if (isGlobal) {
        taxConfig[field] = numeric ? (value === '' ? '' : Math.max(0, Number(value) || 0)) : value;
      } else {
        const regimeKey = activeRegimeSettingsTab === 'old' ? 'oldRegime' : 'newRegime';
        taxConfig[regimeKey] = {
          ...taxConfig[regimeKey],
          [field]: numeric ? (value === '' ? '' : Math.max(0, Number(value) || 0)) : value
        };
      }
      return { ...s, taxConfig };
    });
  };

  const handleTaxConfigToggle = (field) => {
    setSettings((s) => {
      const taxConfig = { ...(s.taxConfig || DEFAULT_SETTINGS.taxConfig) };
      const regimeKey = activeRegimeSettingsTab === 'old' ? 'oldRegime' : 'newRegime';
      taxConfig[regimeKey] = {
        ...taxConfig[regimeKey],
        [field]: !taxConfig[regimeKey]?.[field]
      };
      return { ...s, taxConfig };
    });
  };

  const handleTaxSlabChange = (index, field, value) => {
    setSettings((s) => {
      const taxConfig = { ...(s.taxConfig || DEFAULT_SETTINGS.taxConfig) };
      const regimeKey = activeRegimeSettingsTab === 'old' ? 'oldRegime' : 'newRegime';
      const slabs = [...(taxConfig[regimeKey]?.slabs || DEFAULT_SETTINGS.taxConfig[regimeKey].slabs)];
      slabs[index] = {
        ...slabs[index],
        [field]: field === 'label'
          ? value
          : (value === '' ? '' : Math.max(0, Number(value) || 0))
      };
      taxConfig[regimeKey] = {
        ...taxConfig[regimeKey],
        slabs
      };
      return { ...s, taxConfig };
    });
  };

  const handleTaxSurchargeChange = (index, field, value) => {
    setSettings((s) => {
      const taxConfig = { ...(s.taxConfig || DEFAULT_SETTINGS.taxConfig) };
      const regimeKey = activeRegimeSettingsTab === 'old' ? 'oldRegime' : 'newRegime';
      const surchargeBrackets = [...(taxConfig[regimeKey]?.surchargeBrackets || DEFAULT_SETTINGS.taxConfig[regimeKey].surchargeBrackets)];
      surchargeBrackets[index] = {
        ...surchargeBrackets[index],
        [field]: field === 'label'
          ? value
          : (value === '' ? '' : Math.max(0, Number(value) || 0))
      };
      taxConfig[regimeKey] = {
        ...taxConfig[regimeKey],
        surchargeBrackets
      };
      return { ...s, taxConfig };
    });
  };

  // Notice Handlers
  const [newNotice, setNewNotice] = useState({ date: '', title: '', link: '', days: '' });

  const handleAddNotice = () => {
    if (!newNotice.date || !newNotice.title) return;
    const formattedNotice = {
      ...newNotice,
      days: newNotice.days ? parseInt(newNotice.days, 10) : undefined
    };
    setNotices((prev) => [...prev, formattedNotice]);
    setNewNotice({ date: '', title: '', link: '', days: '' });
  };

  const handleDeleteNotice = (idx) => {
    const notice = notices[idx];
    setCustomPrompt({
      title: 'Delete Announcement',
      message: `Are you sure you want to delete the notice: "${notice?.title || 'Untitled Notice'}"?`,
      type: 'confirm',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-md',
      onConfirm: () => {
        setNotices((prev) => prev.filter((_, i) => i !== idx));
        if (editingNoticeIdx === idx) setEditingNoticeIdx(null);
        setCustomPrompt(null);
      },
      onCancel: () => setCustomPrompt(null)
    });
  };

  const startEditNotice = (idx) => {
    setEditingNoticeIdx(idx);
    setEditNoticeData({ ...notices[idx] });
  };

  const saveNoticeEdit = (idx) => {
    setNotices((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...editNoticeData,
        days: editNoticeData.days ? parseInt(editNoticeData.days, 10) : undefined
      };
      return updated;
    });
    setEditingNoticeIdx(null);
  };

  const cancelNoticeEdit = () => {
    setEditingNoticeIdx(null);
  };

  // ==========================================
  // Page CMS & Content Management Handlers
  // ==========================================
  const handleLoadPageBlocks = async (pageId) => {
    setCmsLoading(true);
    try {
      const snap = await getDoc(doc(db, 'site', `page_${pageId}`));
      if (snap.exists()) {
        const data = snap.data();
        setPageBlocks(data.blocks || []);
        setSeoTitle(data.seoTitle || '');
        setSeoDescription(data.seoDescription || '');
      } else {
        setPageBlocks([]);
        setSeoTitle('');
        setSeoDescription('');
      }
    } catch (err) {
      console.error("Failed to load page blocks:", err);
      showAlert("Failed to load page content from database.", "Database Error");
    } finally {
      setCmsLoading(false);
    }
  };

  const handleSavePageContent = async () => {
    if (!selectedPage) return;
    setCmsSaving(true);
    try {
      const pageDocRef = doc(db, 'site', `page_${selectedPage.id}`);
      await setDoc(pageDocRef, {
        id: selectedPage.id,
        title: selectedPage.title,
        isActive: selectedPage.isActive,
        seoTitle: seoTitle,
        seoDescription: seoDescription,
        blocks: pageBlocks
      });

      const updatedList = pagesList.map(p => {
        if (p.id === selectedPage.id) {
          return {
            ...p,
            title: selectedPage.title,
            isActive: selectedPage.isActive
          };
        }
        return p;
      });
      setPagesList(updatedList);

      await setDoc(doc(db, 'site', 'pages'), { list: updatedList });

      // Broadcast sync
      try {
        const channel = new BroadcastChannel('hss_data_sync');
        channel.postMessage({ type: 'UPDATE_DATA' });
        channel.close();
      } catch (e) {
        // ignore
      }

      setSaveSuccess('Page content saved successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      console.error("Failed to save page content:", err);
      showAlert("Failed to save page content to database.", "Database Error");
    } finally {
      setCmsSaving(false);
    }
  };

  const handleCreatePage = async (e) => {
    if (e) e.preventDefault();
    const slug = newPageSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const title = newPageTitle.trim();

    if (!slug || !title) {
      showAlert("Both page title and slug are required.", "Validation Error");
      return;
    }

    const conflict = pagesList.some(p => p.id === slug) || 
                     ['admin', 'notices', 'messages', 'about', 'academics', 'admissions'].includes(slug);
    if (conflict) {
      showAlert("This page slug is already reserved or in use.", "Conflict");
      return;
    }

    setCmsSaving(true);
    try {
      const newPage = {
        id: slug,
        title: title,
        isSystem: false,
        isActive: true,
        order: pagesList.length
      };

      const defaultBlocks = [
        {
          type: 'hero',
          title: title,
          subtitle: 'Welcome to this page',
          bgImage: '/slides/aboutus.jpg',
          bgOpacity: 30,
          height: 'normal'
        }
      ];

      await setDoc(doc(db, 'site', `page_${slug}`), {
        id: slug,
        title: title,
        isActive: true,
        seoTitle: `${title} | Govt. HSS Shangus`,
        seoDescription: `Read about ${title} at Govt. Higher Secondary School Shangus.`,
        blocks: defaultBlocks
      });

      const updatedList = [...pagesList, newPage];
      setPagesList(updatedList);
      await setDoc(doc(db, 'site', 'pages'), { list: updatedList });

      // Broadcast sync
      try {
        const channel = new BroadcastChannel('hss_data_sync');
        channel.postMessage({ type: 'UPDATE_DATA' });
        channel.close();
      } catch (e) {
        // ignore
      }

      setSelectedPage(newPage);
      setPageBlocks(defaultBlocks);
      setSeoTitle(`${title} | Govt. HSS Shangus`);
      setSeoDescription(`Read about ${title} at Govt. Higher Secondary School Shangus.`);
      
      setNewPageTitle('');
      setNewPageSlug('');
      setShowAddPageModal(false);
    } catch (err) {
      console.error("Failed to create page:", err);
      showAlert("Failed to create page in database.", "Database Error");
    } finally {
      setCmsSaving(false);
    }
  };

  const handleDeletePage = async (pageId) => {
    if (!window.confirm("Are you sure you want to delete this entire page and all its contents? This action cannot be undone.")) return;

    setCmsSaving(true);
    try {
      const updatedList = pagesList.filter(p => p.id !== pageId);
      setPagesList(updatedList);
      await setDoc(doc(db, 'site', 'pages'), { list: updatedList });

      if (selectedPage && selectedPage.id === pageId) {
        setSelectedPage(null);
        setPageBlocks([]);
      }

      // Broadcast sync
      try {
        const channel = new BroadcastChannel('hss_data_sync');
        channel.postMessage({ type: 'UPDATE_DATA' });
        channel.close();
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error("Failed to delete page:", err);
      showAlert("Failed to delete page from database.", "Database Error");
    } finally {
      setCmsSaving(false);
    }
  };

  const handleTogglePageActive = async (pageId) => {
    const updatedList = pagesList.map(p => {
      if (p.id === pageId) {
        return { ...p, isActive: !p.isActive };
      }
      return p;
    });
    setPagesList(updatedList);
    
    try {
      await setDoc(doc(db, 'site', 'pages'), { list: updatedList });
      
      if (selectedPage && selectedPage.id === pageId) {
        setSelectedPage({ ...selectedPage, isActive: !selectedPage.isActive });
      }

      // Broadcast sync
      try {
        const channel = new BroadcastChannel('hss_data_sync');
        channel.postMessage({ type: 'UPDATE_DATA' });
        channel.close();
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error("Failed to toggle page active state:", err);
      showAlert("Failed to update page status in database.", "Database Error");
    }
  };

  const handleMoveBlock = (idx, direction) => {
    const updatedBlocks = [...pageBlocks];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    
    const temp = updatedBlocks[idx];
    updatedBlocks[idx] = updatedBlocks[targetIdx];
    updatedBlocks[targetIdx] = temp;
    
    setPageBlocks(updatedBlocks);
  };

  const handleDeleteBlock = (idx) => {
    if (!window.confirm("Are you sure you want to delete this block section?")) return;
    setPageBlocks(pageBlocks.filter((_, k) => k !== idx));
  };

  const handleUpdateBlockField = (blockIdx, field, value) => {
    const updatedBlocks = [...pageBlocks];
    updatedBlocks[blockIdx] = {
      ...updatedBlocks[blockIdx],
      [field]: value
    };
    setPageBlocks(updatedBlocks);
  };

  const handleBlockImageUpload = async (blockIdx, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      showAlert("Image file size must be 1MB or less.", "File Too Large");
      e.target.value = '';
      return;
    }

    setCmsSaving(true);
    try {
      const url = await uploadToFirebaseStorage(file, `cms_hero_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
      handleUpdateBlockField(blockIdx, 'bgImage', url);
      setSaveSuccess("Image uploaded successfully.");
      setTimeout(() => setSaveSuccess(''), 2000);
    } catch (err) {
      console.error("Failed to upload block image:", err);
      showAlert("Failed to upload image to Firebase Storage.", "Upload Error");
    } finally {
      setCmsSaving(false);
      e.target.value = '';
    }
  };

  const handleGalleryPhotoUpload = async (blockIdx, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      showAlert("Image file size must be 1MB or less.", "File Too Large");
      e.target.value = '';
      return;
    }

    setCmsSaving(true);
    try {
      const url = await uploadToFirebaseStorage(file, `cms_gal_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
      const newImg = { url, caption: file.name.substring(0, file.name.lastIndexOf('.')) || file.name };
      const block = pageBlocks[blockIdx];
      const updatedImages = [...(block.images || []), newImg];
      handleUpdateBlockField(blockIdx, 'images', updatedImages);
      setSaveSuccess("Gallery image uploaded successfully.");
      setTimeout(() => setSaveSuccess(''), 2000);
    } catch (err) {
      console.error("Failed to upload gallery image:", err);
      showAlert("Failed to upload image to Firebase Storage.", "Upload Error");
    } finally {
      setCmsSaving(false);
      e.target.value = '';
    }
  };

  // Slideshow Handlers
  const handleSlidePhotoFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 512000) {
      showAlert(`Image file size must be 500KB or less. The selected file is ${Math.round(file.size / 1024)}KB.`, 'File Too Large');
      e.target.value = '';
      return;
    }

    const ext = getMimeExtension(file.type, file.name);

    if (type === 'new') {
      setNewSlidePhotoFile(file);
      setNewSlidePhotoExt(ext);
      if (!newSlidePhotoName) {
        setNewSlidePhotoName(`slide_${Date.now()}`);
      }
    } else {
      setEditSlidePhotoFile(file);
      setEditSlidePhotoExt(ext);
      if (!editSlidePhotoName) {
        setEditSlidePhotoName(`slide_${Date.now()}`);
      }
    }
  };

  const handleAddSlide = async () => {
    let photoPath = newSlide.image.trim();
    const filename = `${newSlidePhotoName || `slide_${Date.now()}`}${newSlidePhotoExt}`;

    if (newSlidePhotoFile) {
      photoPath = `/slides/${filename}`;
      if (folderHandle) {
        await writeLocalFile(folderHandle, filename, newSlidePhotoFile);
      } else {
        try {
          const url = await uploadToFirebaseStorage(newSlidePhotoFile, filename);
          photoPath = url;
        } catch (err) {
          console.warn('Firebase upload failed, falling back to base64:', err);
          try {
            const base64Data = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(newSlidePhotoFile);
            });
            photoPath = base64Data;
          } catch (err2) {
            console.error('Failed to convert image to Data URL:', err2);
          }
        }
      }
    }

    if (!photoPath) {
      showAlert('Please upload an image or enter an image URL path.', 'Image Required');
      return;
    }

    const addedSlide = {
      image: photoPath,
      title: newSlide.title.trim(),
      caption: newSlide.caption.trim()
    };

    setSlides((prev) => [...prev, addedSlide]);
    setNewSlide({ image: '', title: '', caption: '' });
    setNewSlidePhotoFile(null);
    setNewSlidePhotoName('');
    setNewSlidePhotoExt('.jpg');
    setSaveSuccess('Slide added. Click "Apply & Save" to make changes permanent.');
    setTimeout(() => setSaveSuccess(''), 5000);
  };

  const handleDeleteSlide = (idx) => {
    const slide = slides[idx];
    setCustomPrompt({
      title: 'Delete Slideshow Slide',
      message: `Are you sure you want to delete slide #${idx + 1}: "${slide?.title || 'Untitled Slide'}"?`,
      type: 'confirm',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-md',
      onConfirm: () => {
        setSlides((prev) => prev.filter((_, i) => i !== idx));
        if (editingSlideIdx === idx) setEditingSlideIdx(null);
        setCustomPrompt(null);
        setSaveSuccess('Slide deleted. Click "Apply & Save" to make changes permanent.');
        setTimeout(() => setSaveSuccess(''), 5000);
      },
      onCancel: () => setCustomPrompt(null)
    });
  };

  const startEditSlide = (idx) => {
    setEditingSlideIdx(idx);
    setEditSlideData({ ...slides[idx] });
    setEditSlidePhotoFile(null);
    setEditSlidePhotoExt('.jpg');
    const slide = slides[idx];
    if (slide.image) {
      const match = slide.image.match(/\/slides\/([a-zA-Z0-9_]+)\.(\w+)$/);
      if (match) {
        setEditSlidePhotoName(match[1]);
        setEditSlidePhotoExt('.' + match[2]);
      } else {
        setEditSlidePhotoName(`slide_${Date.now()}`);
      }
    } else {
      setEditSlidePhotoName(`slide_${Date.now()}`);
    }
  };

  const saveSlideEdit = async (idx) => {
    let photoPath = editSlideData.image.trim();

    if (editSlidePhotoFile) {
      const filename = `${editSlidePhotoName || `slide_${Date.now()}`}${editSlidePhotoExt}`;
      photoPath = `/slides/${filename}`;
      if (folderHandle) {
        await writeLocalFile(folderHandle, filename, editSlidePhotoFile);
      } else {
        try {
          const url = await uploadToFirebaseStorage(editSlidePhotoFile, filename);
          photoPath = url;
        } catch (err) {
          console.warn('Firebase upload failed, falling back to base64:', err);
          try {
            const base64Data = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(editSlidePhotoFile);
            });
            photoPath = base64Data;
          } catch (err2) {
            console.error('Failed to convert image to Data URL:', err2);
          }
        }
      }
    }

    setSlides((prev) => {
      const updated = [...prev];
      updated[idx] = { ...editSlideData, image: photoPath };
      return updated;
    });
    setEditingSlideIdx(null);
    setEditSlidePhotoFile(null);
    setEditSlidePhotoName('');
    setEditSlidePhotoExt('.jpg');
    setSaveSuccess('Slide updated. Click "Apply & Save" to make changes permanent.');
    setTimeout(() => setSaveSuccess(''), 5000);
  };

  const cancelSlideEdit = () => {
    setEditingSlideIdx(null);
  };

  const moveSlideUp = (idx) => {
    if (idx === 0) return;
    setSlides((prev) => {
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx - 1];
      updated[idx - 1] = temp;
      return updated;
    });
  };

  const moveSlideDown = (idx) => {
    setSlides((prev) => {
      if (idx === prev.length - 1) return prev;
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx + 1];
      updated[idx + 1] = temp;
      return updated;
    });
  };

  // Faculty Handlers
  const [newTeacher, setNewTeacher] = useState({ name: '', designation: 'Lecturer', subject: '', email: '', mobile: '', department: 'Humanities', photo: '', profile: '', hidden: false, customFields: {}, inactiveReason: '', if_deployed: 'No' });

  // Helper: clean a designation string — strip "in <Subject>" suffix for Principal/Vice Principal/MTS
  const cleanDesignation = (desig) => {
    if (!desig) return desig;
    const desigLower = desig.toLowerCase();
    if (desigLower.includes('principal') || desigLower.includes('vice principal') || desigLower.includes('mts')) {
      return desig.replace(/\s+in\s+.+$/i, '').trim();
    }
    return desig;
  };

  // Helper: sanitize photo filename according to user's naming logic
  const sanitizePhotoFilename = (name) => {
    if (!name) return '';
    return name.trim().replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  };

  // Helper: get extension from mime type
  const getMimeExtension = (type, filename) => {
    if (type === 'image/png') return '.png';
    if (type === 'image/jpeg' || type === 'image/jpg') return '.jpg';
    if (type === 'image/webp') return '.webp';
    if (type === 'image/gif') return '.gif';
    if (filename) {
      const dot = filename.lastIndexOf('.');
      if (dot !== -1) return filename.substring(dot).toLowerCase();
    }
    return '.jpg';
  };

  // Handler: validate photo size (up to 100KB) and extract naming details
  const handlePhotoFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 102400) {
      showAlert(`Image file size must be 100KB or less. The selected file is ${Math.round(file.size / 1024)}KB.`, 'File Too Large');
      e.target.value = '';
      return;
    }

    const ext = getMimeExtension(file.type, file.name);

    if (type === 'new') {
      setNewTeacherPhotoFile(file);
      setNewTeacherPhotoExt(ext);
      // Auto-set filename if empty
      if (!newTeacherPhotoName) {
        const fallback = newTeacher.name ? sanitizePhotoFilename(newTeacher.name) : 'teacher_photo';
        setNewTeacherPhotoName(fallback);
      }
    } else {
      setEditTeacherPhotoFile(file);
      setEditTeacherPhotoExt(ext);
      if (!editTeacherPhotoName) {
        const fallback = editFacultyData.name ? sanitizePhotoFilename(editFacultyData.name) : 'teacher_photo';
        setEditTeacherPhotoName(fallback);
      }
    }
  };

  const handleAddTeacher = async () => {
    if (!newTeacher.name || !newTeacher.designation) return;

    let photoPath = newTeacher.photo.trim();
    const dept = newTeacher.department === 'MTS' ? 'MTS' : newTeacher.department;
    const cleanedDesig = cleanDesignation(newTeacher.designation);
    const cleanedSubj = (dept === 'Administration' || dept === 'MTS') ? '' : newTeacher.subject.trim();

    if (newTeacherPhotoFile) {
      const finalPhotoName = (newTeacherPhotoName && newTeacherPhotoName !== 'teacher_photo')
        ? newTeacherPhotoName
        : (newTeacher.name ? sanitizePhotoFilename(newTeacher.name) : 'teacher_photo');
      const sanitizedName = sanitizePhotoFilename(finalPhotoName);
      const filename = `${sanitizedName}${newTeacherPhotoExt}`;
      photoPath = `/slides/${filename}`;

      if (folderHandle) {
        await writeLocalFile(folderHandle, filename, newTeacherPhotoFile);
      } else {
        // Try uploading to Firebase Storage if configured
        try {
          const url = await uploadToFirebaseStorage(newTeacherPhotoFile, filename);
          photoPath = url;
        } catch (err) {
          console.warn('Firebase upload failed or not configured, falling back to Data URL:', err);
          try {
            const base64Data = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(newTeacherPhotoFile);
            });
            photoPath = base64Data;
          } catch (err2) {
            console.error('Failed to convert image to Data URL:', err2);
          }
        }
      }
    } else if (photoPath && !photoPath.startsWith('/') && !photoPath.startsWith('http') && !photoPath.startsWith('data:')) {
      photoPath = `/slides/${photoPath}`;
    }

    setFaculty((prev) => [...prev, { ...newTeacher, designation: cleanedDesig, subject: cleanedSubj, photo: photoPath, department: dept }]);
    setNewTeacher({ name: '', designation: 'Lecturer', subject: '', email: '', mobile: '', department: 'Humanities', photo: '', profile: '', hidden: false, customFields: {}, inactiveReason: '', if_deployed: 'No' });

    setNewTeacherPhotoFile(null);
    setNewTeacherPhotoName('');
    setNewTeacherPhotoExt('.jpg');
    setSaveSuccess('Employee record added. Click "Apply & Save" to make changes permanent.');
    setTimeout(() => setSaveSuccess(''), 5000);
  };

  const handleMoveFacultyUp = (idx) => {
    if (idx === 0) return;
    setFaculty((prev) => {
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx - 1];
      updated[idx - 1] = temp;
      return updated;
    });
    setSaveSuccess('Employee moved up. Click "Apply & Save" to make changes permanent.');
    setTimeout(() => setSaveSuccess(''), 5000);
  };

  const handleMoveFacultyDown = (idx) => {
    if (idx === faculty.length - 1) return;
    setFaculty((prev) => {
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx + 1];
      updated[idx + 1] = temp;
      return updated;
    });
    setSaveSuccess('Employee moved down. Click "Apply & Save" to make changes permanent.');
    setTimeout(() => setSaveSuccess(''), 5000);
  };

  const handleDeleteTeacher = (idx) => {
    const teacher = faculty[idx];
    setCustomPrompt({
      title: 'Delete Employee Record',
      message: `Are you sure you want to delete the employee record for: "${teacher?.name || 'this employee'}"?`,
      type: 'confirm',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-md',
      onConfirm: () => {
        setFaculty((prev) => prev.filter((_, i) => i !== idx));
        if (editingFacultyIdx === idx) setEditingFacultyIdx(null);
        setSelectedFaculty(prev => prev.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
        setCustomPrompt(null);
        setSaveSuccess('Employee record deleted. Click "Apply & Save" to make changes permanent.');
        setTimeout(() => setSaveSuccess(''), 5000);
      },
      onCancel: () => setCustomPrompt(null)
    });
  };

  const handleBulkDelete = () => {
    if (selectedFaculty.length === 0) return;
    setCustomPrompt({
      title: 'Bulk Delete Employee Records',
      message: `Are you sure you want to delete the ${selectedFaculty.length} selected employee record(s)?`,
      type: 'confirm',
      confirmText: 'Delete All',
      cancelText: 'Cancel',
      confirmClass: 'bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-md',
      onConfirm: () => {
        setFaculty((prev) => prev.filter((_, idx) => !selectedFaculty.includes(idx)));
        setSelectedFaculty([]);
        setCustomPrompt(null);
        setSaveSuccess('Selected employee records deleted. Click "Apply & Save" to make changes permanent.');
        setTimeout(() => setSaveSuccess(''), 5000);
      },
      onCancel: () => setCustomPrompt(null)
    });
  };

  const handleBulkPrint = () => {
    if (selectedFaculty.length === 0) return;
    const selected = faculty.filter((_, idx) => selectedFaculty.includes(idx));
    printBulkProfiles(selected);
  };

  const startEditFaculty = (idx) => {
    setEditingFacultyIdx(idx);
    setEditFacultyData({ ...faculty[idx] });
    setEditTeacherPhotoFile(null);
    setEditTeacherPhotoExt('.jpg');
    if (faculty[idx].photo) {
      const match = faculty[idx].photo.match(/\/slides\/([a-zA-Z0-9_]+)\.(\w+)$/);
      if (match) {
        setEditTeacherPhotoName(match[1]);
        setEditTeacherPhotoExt('.' + match[2]);
      } else {
        setEditTeacherPhotoName('');
      }
    } else {
      setEditTeacherPhotoName('');
    }
  };

  const saveFacultyEdit = async (idx) => {
    let photoPath = editFacultyData.photo.trim();
    const dept = editFacultyData.department;
    const cleanedDesig = cleanDesignation(editFacultyData.designation);
    const cleanedSubj = (dept === 'Administration' || dept === 'MTS') ? '' : editFacultyData.subject.trim();

    if (editTeacherPhotoFile && editTeacherPhotoName) {
      const sanitizedName = sanitizePhotoFilename(editTeacherPhotoName);
      const filename = `${sanitizedName}${editTeacherPhotoExt}`;
      photoPath = `/slides/${filename}`;

      if (folderHandle) {
        await writeLocalFile(folderHandle, filename, editTeacherPhotoFile);
      } else {
        try {
          const url = await uploadToFirebaseStorage(editTeacherPhotoFile, filename);
          photoPath = url;
        } catch (err) {
          console.warn('Firebase upload failed or not configured, falling back to Data URL:', err);
          try {
            const base64Data = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(editTeacherPhotoFile);
            });
            photoPath = base64Data;
          } catch (err2) {
            console.error('Failed to convert image to Data URL:', err2);
          }
        }
      }
    } else if (photoPath && !photoPath.startsWith('/') && !photoPath.startsWith('http') && !photoPath.startsWith('data:')) {
      photoPath = `/slides/${photoPath}`;
    }

    setFaculty((prev) => {
      const updated = [...prev];
      updated[idx] = { ...editFacultyData, designation: cleanedDesig, subject: cleanedSubj, photo: photoPath };
      return updated;
    });
    setEditingFacultyIdx(null);

    setEditTeacherPhotoFile(null);
    setEditTeacherPhotoName('');
    setEditTeacherPhotoExt('.jpg');
    setSaveSuccess('Employee record updated. Click "Apply & Save" to make changes permanent.');
    setTimeout(() => setSaveSuccess(''), 5000);
  };

  const cancelFacultyEdit = () => {
    setEditingFacultyIdx(null);
  };

  // ---- Full Edit Modal Handlers ----
  const openFullEdit = (index) => {
    const t = faculty[index];
    setFullEditIndex(index);
    setFullEditData({ ...t, postings: (t.postings || []).map(p => ({ ...p })) });
    setFullEditPhotoFile(null);
    setFullEditPhotoExt('.jpg');
    if (t.photo) {
      const match = t.photo.match(/\/slides\/([a-zA-Z0-9_]+)\.(\w+)$/);
      setFullEditPhotoName(match ? match[1] : '');
      if (match) setFullEditPhotoExt('.' + match[2]);
    } else {
      setFullEditPhotoName('');
    }
    setShowFullEditModal(true);
  };

  const closeFullEdit = () => {
    setShowFullEditModal(false);
    setFullEditIndex(null);
    setFullEditData(null);
    setFullEditPhotoFile(null);
    setFullEditPhotoName('');
    setFullEditPhotoExt('.jpg');
  };

  const saveFullEdit = async () => {
    if (!fullEditData) return;
    let photoPath = (fullEditData.photo || '').trim();
    const dept = fullEditData.department;
    const cleanedDesig = toTitleCase(cleanDesignation(fullEditData.designation));
    const cleanedSubj = (dept === 'Administration' || dept === 'MTS') ? '' : toTitleCase((fullEditData.subject || '').trim());

    if (fullEditPhotoFile && fullEditPhotoName) {
      const sanitizedName = sanitizePhotoFilename(fullEditPhotoName);
      const filename = `${sanitizedName}${fullEditPhotoExt}`;
      photoPath = `/slides/${filename}`;
      if (folderHandle) {
        await writeLocalFile(folderHandle, filename, fullEditPhotoFile);
      } else {
        try {
          const url = await uploadToFirebaseStorage(fullEditPhotoFile, filename);
          photoPath = url;
        } catch (err) {
          console.warn('Firebase upload failed, falling back to base64:', err);
          try {
            const base64Data = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(fullEditPhotoFile);
            });
            photoPath = base64Data;
          } catch (err2) {
            console.error('Failed to convert image to Data URL:', err2);
          }
        }
      }
    } else if (photoPath && !photoPath.startsWith('/') && !photoPath.startsWith('http') && !photoPath.startsWith('data:')) {
      photoPath = `/slides/${photoPath}`;
    }

    // Standardize inputs to proper case/casing on save
    const formattedData = {
      ...fullEditData,
      name: toTitleCase(fullEditData.name || ''),
      parentage: toTitleCase(fullEditData.parentage || ''),
      designation: cleanedDesig,
      subject: cleanedSubj,
      subject_pg: (dept === 'Administration' || dept === 'MTS') ? '' : toTitleCase(fullEditData.subject_pg || ''),
      parent_district: toTitleCase(fullEditData.parent_district || ''),
      present_district: toTitleCase(fullEditData.present_district || ''),
      present_place_of_posting: toTitleCase(fullEditData.present_place_of_posting || ''),
      qualification: toTitleCase(fullEditData.qualification || ''),
      permanent_address: toTitleCase(fullEditData.permanent_address || ''),
      present_address: toTitleCase(fullEditData.present_address || ''),
      zone_name: toTitleCase(fullEditData.zone_name || ''),
      ddo_code: formatUDISECode(fullEditData.ddo_code || ''),
      postings: (fullEditData.postings || []).map(p => ({
        ...p,
        office: toTitleCase(p.office || ''),
        designation: toTitleCase(p.designation || '')
      })),
      photo: photoPath
    };

    setFaculty((prev) => {
      const updated = [...prev];
      updated[fullEditIndex] = formattedData;
      return updated;
    });
    closeFullEdit();
    setSaveSuccess('Employee record updated. Click "Apply & Save" to make changes permanent.');
    setTimeout(() => setSaveSuccess(''), 5000);
  };

  const fullEditField = (key, value) => setFullEditData(d => ({ ...d, [key]: value }));

  const saveEmployeeTaxDetails = (index, pan, grossSalary, tds, regime, deduction80C, deduction80D, hraExemption, otherDeductions) => {
    // Build the updated employee object FIRST (pure, no side effects)
    let updatedFaculty = null;
    setFaculty(prev => {
      const updated = [...prev];
      const emp = { ...updated[index] };
      const cleanPan = (pan || '').toUpperCase().trim();
      const cleanGross = parseFloat(grossSalary) || 0;
      const cleanTds = parseFloat(tds) || 0;
      const cleanRegime = regime === 'old' ? 'old' : 'new';
      const clean80C = parseFloat(deduction80C) || 0;
      const clean80D = parseFloat(deduction80D) || 0;
      const cleanHra = parseFloat(hraExemption) || 0;
      const cleanOther = parseFloat(otherDeductions) || 0;

      emp.pan = cleanPan;
      emp.grossSalary = cleanGross;
      emp.tds = cleanTds;
      emp.taxRegime = cleanRegime;
      emp.deduction80C = clean80C;
      emp.deduction80D = clean80D;
      emp.hraExemption = cleanHra;
      emp.otherDeductions = cleanOther;

      emp.customFields = {
        ...(emp.customFields || {}),
        PAN: cleanPan,
        'Gross Salary': cleanGross.toString(),
        TDS: cleanTds.toString(),
        'Tax Regime': cleanRegime,
        '80C Deductions': clean80C.toString(),
        '80D Deductions': clean80D.toString(),
        'HRA Exemption': cleanHra.toString(),
        'Other Deductions': cleanOther.toString()
      };
      updated[index] = emp;
      updatedFaculty = updated; // capture for side effects below
      return updated;
    });

    // Side effects OUTSIDE the state updater (React StrictMode safe)
    // Use setTimeout(0) so state has committed before we read updatedFaculty
    setTimeout(() => {
      if (!updatedFaculty) return;
      // Persist to localStorage immediately
      localStorage.setItem('site_faculty', JSON.stringify(updatedFaculty));
      // Broadcast live update to other tabs
      try {
        const ch = new BroadcastChannel('hss_data_sync');
        ch.postMessage({ type: 'UPDATE_DATA' });
        ch.close();
      } catch (e) { /* ignore */ }
      // Write to file if running locally
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        fetch('/api/save-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faculty: updatedFaculty })
        }).catch(err => console.warn('Background file sync failed:', err));
      }
    }, 0);

    setSaveSuccess('✅ Tax details saved and persisted instantly.');
    setTimeout(() => setSaveSuccess(''), 4000);
  };

  const printTaxSheets = (emps) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showAlert('Pop-up blocker is enabled. Please allow pop-ups to print tax sheets.', 'Pop-up Blocked');
      return;
    }

    const formatSalary = (val) => {
      return Math.round(Number(val || 0)).toLocaleString('en-IN');
    };

    const formatSlab = (val) => {
      if (val === 0 || val === 'Nil' || val === undefined) return 'Nil';
      return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const formatTax = (val) => {
      return '₹ ' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatTotalTax = (val) => {
      return '₹ ' + Math.round(Number(val || 0)).toLocaleString('en-IN');
    };

    const sheetsHtml = emps.map((emp) => {
      const pan = getEmployeePan(emp);
      const gross = getEmployeeGross(emp);
      const tds = getEmployeeTds(emp);
      const options = getEmployeeTaxOptions(emp);
      const calc = calculateTax(gross, tds, taxConfig, options);

      // Slabs logic
      const slabRowsHtml = calc.slabDetails.map((slab) => {
        const slabTax = slab.tax;
        const detailsVal = slabTax > 0 ? formatSlab(slabTax) : 'Nil';
        const rightVal = slabTax > 0 ? formatSlab(slabTax) : '0';
        return `
          <tr>
            <td style="text-align: center;"></td>
            <td style="padding-left: 15px;">Slab ${slab.rate}% ${slab.label}</td>
            <td class="text-right">${detailsVal}</td>
            <td class="text-right">${rightVal}</td>
          </tr>
        `;
      }).join('');

      // Intermediate Gross Total Income calculation matching the spreadsheet flow
      const grossTotalIncome = Math.max(0, gross - calc.standardDeduction - calc.hraExemption - calc.deduction80D);

      // Tax Payable Now formatted
      const taxPayableNowVal = calc.taxPayableNow > 0
        ? `₹ ${formatSalary(calc.taxPayableNow)}`
        : 'NIL';
      const taxPayableNowClass = calc.taxPayableNow > 0
        ? 'text-red-600 font-bold text-lg'
        : 'text-green-600 font-bold text-lg';

      return `
        <div class="tax-sheet">
          <div class="tax-sheet-content">
            <!-- Header section -->
            <div class="header-top" style="text-align: center;">
              <h3 style="margin: 0; font-size: 11px; font-weight: bold; letter-spacing: 1.2px; text-transform: uppercase; color: #475569;">OFFICE OF THE PRINCIPAL</h3>
              <h1 style="margin: 2px 0; font-size: 18px; font-weight: 900; color: #000; letter-spacing: -0.2px; line-height: 1.1;">GOVT. HIGHER SECONDARY SCHOOL SHANGUS</h1>
              <h2 style="margin: 4px 0 3px 0; font-size: 14px; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px; text-transform: uppercase;">INCOME TAX CALCULATION SHEET</h2>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; font-size: 11px; font-weight: bold; color: #334155; padding: 0 4px; border-bottom: 1.5px solid black; padding-bottom: 3px; margin-bottom: 5px;">
                <span>Financial Year: ${calc.taxConfig.financialYearLabel}</span>
                <span>TAN No: <span style="color: #dc2626; font-family: monospace; font-size: 11.5px;">AMRG13179F</span></span>
                <span>Assessment Year: ${calc.taxConfig.assessmentYearLabel}</span>
              </div>
            </div>

            <!-- Employee Info Grid -->
            <table class="header-details-table">
              <tr>
                <td rowspan="2" class="regime-badge-container ${calc.regimeType === 'new' ? 'new-regime' : 'old-regime'}">
                  <div class="regime-badge-inner">${calc.regimeConfig.label}</div>
                </td>
                <td class="label-cell" style="width: 24%;">NAME OF THE OFFICIAL</td>
                <td class="value-cell" style="width: 26%;">${(emp.name || '').toUpperCase()}</td>
                <td class="label-cell" style="width: 18%;">DESIGNATION</td>
                <td class="value-cell" style="width: 32%;">${(emp.designation || '').toUpperCase()}</td>
              </tr>
              <tr>
                <td class="label-cell" style="width: 24%;">CPIS ID</td>
                <td class="value-cell" style="width: 26%; font-family: monospace;">${emp.cpis_no || '-'}</td>
                <td class="label-cell" style="width: 18%;">PAN NO</td>
                <td class="value-cell" style="width: 32%; font-family: monospace;">${pan || '-'}</td>
              </tr>
            </table>

            <!-- Main Calculation Table -->
            <table class="main-tax-table">
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center;">S.No.</th>
                  <th style="width: 65%; text-align: left;">PARTICULARS</th>
                  <th style="width: 15%; text-align: right;">Deductions</th>
                  <th style="width: 15%; text-align: right;">Gross income</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align: center;"></td>
                  <td class="font-bold">Gross Salary</td>
                  <td></td>
                  <td class="text-right font-bold text-red-600">₹ ${formatSalary(gross)}</td>
                </tr>
                <tr>
                  <td style="text-align: center;"></td>
                  <td>Add Pay Arrears</td>
                  <td></td>
                  <td class="text-right">0</td>
                </tr>
                <tr>
                  <td style="text-align: center;">1</td>
                  <td>Add perquisite in respect of reimbursement of Medical Expenses of in excess of Rs.</td>
                  <td></td>
                  <td class="text-right">0</td>
                </tr>
                <tr>
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">view of section 17(2)(v)</td>
                  <td></td>
                  <td class="text-right">0</td>
                </tr>
                <tr>
                  <td style="text-align: center;"></td>
                  <td>Add Employers Share</td>
                  <td></td>
                  <td class="text-right">0</td>
                </tr>
                <tr>
                  <td style="text-align: center;"></td>
                  <td class="font-bold">Total Salary Income</td>
                  <td></td>
                  <td class="text-right font-bold">₹ ${formatSalary(gross)}</td>
                </tr>
                <tr>
                  <td style="text-align: center;"></td>
                  <td class="font-bold text-red-600">Less Standard Deduction</td>
                  <td class="text-right font-bold">${formatSalary(calc.standardDeduction)}</td>
                  <td class="text-right"></td>
                </tr>
                <tr>
                  <td style="text-align: center;"></td>
                  <td class="font-bold text-red-600">Salary after deduction of St./ded</td>
                  <td></td>
                  <td class="text-right font-bold text-red-600">₹ ${formatSalary(Math.max(0, gross - calc.standardDeduction))}</td>
                </tr>
                
                <!-- HRA Row -->
                <tr class="compact-row">
                  <td style="text-align: center;">2</td>
                  <td>Less House Rent allowance exempt U/s 10(13A)</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">A. Actual amount of HRA Received</td>
                  <td class="text-right">${calc.hraExemption > 0 ? formatSalary(calc.hraExemption) : '0'}</td>
                  <td class="text-right">${calc.hraExemption > 0 ? formatSalary(calc.hraExemption) : '0'}</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">B. Expenditure on rent in excess of 10% Salary (including DA)</td>
                  <td class="text-right">0</td>
                  <td class="text-right">0</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">C. 40% of Salary (including DA)</td>
                  <td class="text-right">0</td>
                  <td class="text-right">0</td>
                </tr>

                <!-- HBA Row -->
                <tr class="compact-row">
                  <td style="text-align: center;">3</td>
                  <td>Less: Interest paid on HBA U/s 24(B), 80EE (Max up to 2.0lakh)</td>
                  <td class="text-right">0</td>
                  <td class="text-right">0</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td>Less: Interest paid on loan taken for higher education, U/s 80E</td>
                  <td class="text-right">0</td>
                  <td class="text-right">0</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td class="font-bold" style="font-size: 8.5px; font-style: italic;">Capital borrowed for repairs/renewal/reconstruction of house, maximum interest allowable Rs. 30000</td>
                  <td></td>
                  <td class="text-right">0</td>
                </tr>

                <!-- 80D Row -->
                <tr class="compact-row">
                  <td style="text-align: center;">4</td>
                  <td>Less Deduction U/s 80D (Health insurance- Self & Family Max up to 0.25 lakh)</td>
                  <td class="text-right">${calc.deduction80D > 0 ? formatSalary(calc.deduction80D) : '0'}</td>
                  <td class="text-right">${calc.deduction80D > 0 ? formatSalary(calc.deduction80D) : '0'}</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td>Less Deduction U/s 80DD, 80U (Max 1.25 lakh and min 0.75 Lakh)</td>
                  <td class="text-right">0</td>
                  <td class="text-right">0</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td>Less Deduction U/s 80DDB (Medical treatment of specified disease)</td>
                  <td class="text-right">0</td>
                  <td class="text-right">0</td>
                </tr>
                <tr class="text-red-600 compact-row">
                  <td style="text-align: center;"></td>
                  <td class="font-bold" style="font-size: 8.5px; font-style: italic;">No Deduction shall be allowed unless a new certificate is obtained from medical authority in the prescribed format.</td>
                  <td></td>
                  <td class="text-right">0</td>
                </tr>

                <!-- 80G Row -->
                <tr class="compact-row">
                  <td style="text-align: center;">5</td>
                  <td>Less: Deduction U/s 80G (M relief Fund, Red Cross Funds, Cancer Fund, etc.)</td>
                  <td class="text-right">0</td>
                  <td class="text-right">0</td>
                </tr>

                <!-- Gross Total Income -->
                <tr class="bg-orange-100 font-bold">
                  <td style="text-align: center;"></td>
                  <td>Gross Total Income</td>
                  <td></td>
                  <td class="text-right text-red-600" style="background-color: #fed7aa; color: #dc2626;">₹ ${formatSalary(grossTotalIncome)}</td>
                </tr>

                <!-- 80C Rows -->
                <tr class="compact-row">
                  <td style="text-align: center;">6</td>
                  <td class="font-bold">Less: Deduction U/s 80C, 80CCE, 80CCC, 80CCD</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">GPF/CPF</td>
                  <td class="text-right">0</td>
                  <td rowspan="${calc.regimeType === 'new' ? '5' : '6'}" class="text-center font-bold" style="background-color: #a7f3d0; vertical-align: middle;">${formatSalary(calc.deduction80C)}</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">SLI</td>
                  <td class="text-right">0</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">Repayment of HBA Loan</td>
                  <td class="text-right">0</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">Tuition fee (Restricted to two children)</td>
                  <td class="text-right">0</td>
                </tr>
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">LIC, Metlife, PLI, PPF, etc.</td>
                  <td class="text-right">0</td>
                </tr>
                ${calc.regimeType === 'old' ? `
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td style="padding-left: 15px;">Restricted to Rs 1,50,000</td>
                  <td class="text-right">${calc.deduction80C > 0 ? formatSalary(calc.deduction80C) : '0'}</td>
                </tr>` : ''}

                <!-- 80CCD(2) Row -->
                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td>Less: Deduction U/s 80CCD (2)</td>
                  <td class="text-right">${calc.otherDeductions > 0 ? formatSalary(calc.otherDeductions) : '0'}</td>
                  <td class="text-right">${calc.otherDeductions > 0 ? formatSalary(calc.otherDeductions) : '0'}</td>
                </tr>

                <!-- Taxable Income -->
                <tr style="background-color: #fef08a; font-weight: bold;">
                  <td style="text-align: center;"></td>
                  <td class="font-bold text-center">Total Tax Income</td>
                  <td></td>
                  <td class="text-right font-bold text-red-600" style="background-color: #fef08a; color: #dc2626;">₹ ${formatSalary(calc.taxableIncome)}</td>
                </tr>
                <tr style="background-color: #fef08a; font-weight: bold;">
                  <td style="text-align: center;"></td>
                  <td class="font-bold text-center">Total Tax Income (Rounded Off)</td>
                  <td></td>
                  <td class="text-right font-bold text-red-600" style="background-color: #fef08a; color: #dc2626;">₹ ${formatSalary(calc.taxableIncome)}</td>
                </tr>
                <tr>
                  <td style="text-align: center; font-weight: bold;">7</td>
                  <td class="font-bold text-center">Income Tax thereon/Payable</td>
                  <td></td>
                  <td></td>
                </tr>

                <!-- Slabs -->
                ${slabRowsHtml}

                <!-- Tax Calculation Details -->
                <tr style="background-color: #a7f3d0; font-weight: bold;">
                  <td style="text-align: center;">8</td>
                  <td class="text-center">Tax thereon</td>
                  <td></td>
                  <td class="text-right">${formatTax(calc.tax)}</td>
                </tr>
                <tr style="background-color: #a7f3d0; font-weight: bold;">
                  <td style="text-align: center;">9</td>
                  <td class="text-center">Tax Rebate U/s 87(A)</td>
                  <td></td>
                  <td class="text-right">${formatTax(calc.rebate)}</td>
                </tr>
                <tr style="background-color: #a7f3d0; font-weight: bold;">
                  <td style="text-align: center;"></td>
                  <td class="text-center">Marginal Relief</td>
                  <td></td>
                  <td class="text-right" style="color: #047857;">${formatTax(calc.marginalRelief)}</td>
                </tr>
                <tr style="background-color: #a7f3d0; font-weight: bold;">
                  <td style="text-align: center;"></td>
                  <td class="text-center">Total Tax</td>
                  <td></td>
                  <td class="text-right">${formatTax(calc.taxBeforeCess)}</td>
                </tr>
                <tr>
                  <td style="text-align: center;">10</td>
                  <td>Add: Health & Education Cess @${calc.taxConfig.cessRate}%</td>
                  <td></td>
                  <td class="text-right font-bold">${formatTax(calc.cess)}</td>
                </tr>
                <tr>
                  <td style="text-align: center;" class="text-red-600 font-bold">11</td>
                  <td class="font-bold text-red-600 text-center">Total Tax Payable</td>
                  <td></td>
                  <td class="text-right font-bold text-red-600">${formatTotalTax(calc.totalTax)}</td>
                </tr>
                <tr>
                  <td style="text-align: center;" class="text-red-600 font-bold">12</td>
                  <td class="font-bold text-red-600 text-center">TDS Up to Date</td>
                  <td></td>
                  <td class="text-right font-bold text-red-600">${formatTotalTax(tds)}</td>
                </tr>
                <tr>
                  <td style="text-align: center;" class="text-red-600 font-bold">13</td>
                  <td class="font-bold text-red-600 text-center">Tax Payable now</td>
                  <td></td>
                  <td class="text-right ${taxPayableNowClass}">${taxPayableNowVal}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer certification and signatures -->
          <div class="tax-sheet-footer">
            <div class="certification-box">
              I hereby certify that the information/Documents submitted are correct and genuine. If found false or tampered, I shall personally remain responsible for any action as warranted under rules. Additionally, the benefit availed shall be summarily withdrawn.
            </div>

            <table style="width: 100%; border-collapse: collapse; border: none; font-size: 11px; font-weight: bold; margin-top: 15px;">
              <tbody>
                <tr>
                  <td style="border: none; text-align: left; padding: 0; vertical-align: bottom;">Sig. of Employee</td>
                  <td style="border: none; text-align: right; padding: 0; vertical-align: bottom; width: 200px;">
                    <div style="border-top: 1px solid black; margin-bottom: 2px; width: 100%;"></div>
                    Sig. of DDO
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Income Tax Calculation Sheets</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 2mm;
            }
            @media print {
              body {
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                margin: 0;
                padding: 0;
                display: block;
              }
              .no-print {
                display: none !important;
              }
              .tax-sheet {
                width: 100% !important;
                max-width: 206mm !important;
                height: auto !important;
                min-height: auto !important;
                margin: 0 auto !important;
                box-shadow: none !important;
                border: none !important;
                outline: none !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
              }
              .tax-sheet:last-child {
                page-break-after: auto !important;
              }
            }
            body {
              font-family: system-ui, -apple-system, Arial, sans-serif;
              color: black;
              background: #f1f5f9;
              padding: 10px 0;
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .tax-sheet {
              width: 206mm;
              min-height: 293mm;
              padding: 6px 10px;
              margin: 0 auto 10px auto;
              box-sizing: border-box;
              position: relative;
              background: white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              border: 3px double black;
              outline: 1px solid black;
              outline-offset: -3px;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
            }
            .header-top {
              width: 100%;
              margin-bottom: 4px;
            }
            .header-details-table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid black;
              margin-bottom: 5px;
            }
            .header-details-table td {
              border: 1px solid black;
              padding: 4px 8px;
              font-size: 11px;
              vertical-align: middle;
            }
            .header-details-table .label-cell {
              font-weight: bold;
              background-color: #f8fafc;
              width: 15%;
              color: #1e293b;
            }
            .header-details-table .value-cell {
              color: #dc2626;
              font-weight: bold;
            }
            .regime-badge-container {
              width: 50px;
              color: white;
              text-align: center;
              font-weight: bold;
              padding: 6px 2px !important;
            }
            .regime-badge-container.new-regime {
              background-color: #0f766e !important;
            }
            .regime-badge-container.old-regime {
              background-color: #961c14 !important;
            }
            .regime-badge-inner {
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.5px;
              display: block;
              line-height: 1.15;
            }
            .main-tax-table {
              width: 100%;
              border-collapse: collapse;
              border: 1.5px solid black;
              font-size: 10.5px;
              line-height: 1.25;
            }
            .main-tax-table th, .main-tax-table td {
              border: 1px solid black;
              padding: 3px 5px;
              vertical-align: middle;
              white-space: normal;
              word-wrap: break-word;
              word-break: break-word;
            }
            .main-tax-table tr.compact-row td {
              padding-top: 0.5px;
              padding-bottom: 0.5px;
            }
            .main-tax-table th {
              font-weight: bold;
              background-color: #f1f5f9;
              text-transform: uppercase;
              font-size: 9.5px;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .font-bold {
              font-weight: bold;
            }
            .text-red-600 {
              color: #dc2626;
            }
            .text-green-600 {
              color: #16a34a;
            }
            .text-lg {
              font-size: 13px;
            }
            .bg-orange-100 {
              background-color: #ffedd5;
            }
            .bg-orange-200 {
              background-color: #fed7aa;
            }
            .certification-box {
              text-align: justify;
              font-size: 10.5px;
              border: 1px solid black;
              padding: 5px 8px;
              line-height: 1.25;
              margin-top: 8px;
              background-color: #fafafa;
            }
            .no-print-bar {
              background: #1e293b;
              color: white;
              padding: 10px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: sticky;
              top: 0;
              z-index: 100;
              margin-bottom: 20px;
              border-radius: 6px;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              max-width: 190mm;
              margin-left: auto;
              margin-right: auto;
            }
            .print-btn {
              background: #f97316;
              color: white;
              border: none;
              padding: 8px 16px;
              font-weight: bold;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              transition: all 0.2s;
            }
            .print-btn:hover {
              background: #ea580c;
              transform: scale(1.02);
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <span style="font-weight: bold; font-size: 14px;">Govt HSS Shangus — Income Tax Calculation Sheets</span>
            <button onclick="window.print()" class="print-btn">Print / Save as PDF</button>
          </div>
          ${sheetsHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const addPosting = () => setFullEditData(d => ({
    ...d, postings: [...(d.postings || []), { office: '', designation: '', from: '', to: '' }]
  }));

  const updatePosting = (idx, key, value) => setFullEditData(d => {
    const updated = [...(d.postings || [])];
    updated[idx] = { ...updated[idx], [key]: value };
    return { ...d, postings: updated };
  });

  const removePosting = (idx) => setFullEditData(d => ({
    ...d, postings: (d.postings || []).filter((_, i) => i !== idx)
  }));

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) {
      showAlert("Please enter a valid email address.", "Validation Error");
      return;
    }
    if (!newAdminEmail.includes('@') || !newAdminEmail.includes('.')) {
      showAlert("Please enter a valid email address.", "Validation Error");
      return;
    }
    if (!newAdminPassword || newAdminPassword.length < 6) {
      showAlert("Password must be at least 6 characters long.", "Validation Error");
      return;
    }
    if (newAdminPermissions.length === 0) {
      showAlert("Please select at least one tab permission.", "Validation Error");
      return;
    }

    const exists = admins.some(a => a.email.toLowerCase().trim() === newAdminEmail.toLowerCase().trim());
    if (exists) {
      showAlert("An admin account with this email address already exists.", "Account Conflict");
      return;
    }

    try {
      const salt = generateRandomSaltHex();
      const passwordHash = await hashPassword(newAdminPassword, salt);
      const newAdmin = {
        email: newAdminEmail.trim().toLowerCase(),
        salt,
        passwordHash,
        hashAlgo: 'pbkdf2',
        role: newAdminRole,
        allowedTabs: newAdminPermissions
      };

      const updatedAdmins = [...admins, newAdmin];
      setAdmins(updatedAdmins);

      // Clear fields
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminRole('Super Admin');
      setNewAdminPermissions(['admissions', 'notices', 'faculty', 'tax', 'export', 'admins']);

      // Automatically sync and save
      await handleSaveToLocalStorage(updatedAdmins);
      showAlert(`Administrative account for "${newAdmin.email}" created and saved successfully.`, "Account Created");
    } catch (e) {
      console.error(e);
      showAlert("Failed to create admin account due to hashing or write error.", "Execution Error");
    }
  };

  const handleDeleteAdmin = (emailToDelete) => {
    if (currentUser && emailToDelete.toLowerCase() === currentUser.email.toLowerCase()) {
      showAlert("You cannot delete your own admin account while logged in.", "Self-Deletion Guard");
      return;
    }
    setCustomPrompt({
      title: 'Delete Admin Account',
      message: `Are you sure you want to permanently delete the admin account for "${emailToDelete}"?`,
      type: 'confirm',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-md',
      onConfirm: async () => {
        const updated = admins.filter(a => a.email.toLowerCase() !== emailToDelete.toLowerCase());
        setAdmins(updated);
        setCustomPrompt(null);
        // Sync and save immediately
        await handleSaveToLocalStorage(updated);
      },
      onCancel: () => setCustomPrompt(null)
    });
  };

  // Central Save & Sync
  const handleSaveToLocalStorage = async (customAdminsList = null) => {
    const activeAdmins = customAdminsList || admins;
    const noticesText = notices.map(n => `${n.date},${n.title},${n.link || '#'}${n.days ? `,${n.days}` : ''}`).join('\n');
    const slidesText = slides.map(s => {
      let imgName = s.image;
      if (imgName.startsWith('/slides/')) {
        imgName = imgName.substring('/slides/'.length);
      }
      return `${imgName},${s.title || ''},${s.caption || ''}`;
    }).join('\n');

    // Initialize progress tracking UI
    setSaveProgress(5);
    setSaveStages([
      { id: 'auth', label: 'Verifying Admin Authority', status: 'loading', details: 'Verifying credentials...' },
      { id: 'firebase', label: 'Pushing changes live to Firebase', status: 'pending', details: '' },
      { id: 'local_storage', label: 'Updating local cache', status: 'pending', details: '' },
      { id: 'files', label: 'Syncing local config files', status: 'pending', details: '' },
      { id: 'netlify', label: 'Creating remote Netlify backups', status: 'pending', details: '' },
    ]);
    setSavePopupResult(null);

    const updateStage = (id, status, details = '', progress = null) => {
      setSaveStages(prev => prev.map(s => s.id === id ? { ...s, status, details } : s));
      if (progress !== null) {
        setSaveProgress(progress);
      }
    };

    let fileSyncStatus = '';
    let didDirectoryWrite = false;
    let fileWriteResults = [];

    try {
      // 1. Auth check stage
      await new Promise(resolve => setTimeout(resolve, 500)); // smooth visual pacing
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Authentication required to save. Please click the "Sign in with Google to Sync" button at the top first.');
      }
      const isListedAdmin = Array.isArray(activeAdmins) && activeAdmins.some(a => (a.email || '').toLowerCase() === (user.email || '').toLowerCase());
      let isAdminClaim = false;
      if (!isListedAdmin) {
        try {
          const idToken = await getIdTokenResult(user, false);
          isAdminClaim = idToken?.claims?.admin === true;
        } catch (e) {
          console.warn('Failed to retrieve token claims:', e);
        }
      }
      if (!isAdminClaim && !isListedAdmin) {
        throw new Error('Your Google account is not listed as an administrator. Please ask a Super Admin to add your email.');
      }

      updateStage('auth', 'success', `Authorized as ${user.email}`, 25);
      updateStage('firebase', 'loading', 'Uploading settings, notices, faculty, admins, and slideshow...', 35);
      await new Promise(resolve => setTimeout(resolve, 400));

      // 2. Firebase upload stage
      await saveToFirebase({ settings, noticesText, faculty, admins: activeAdmins, slides });
      fileSyncStatus = 'Saved to Firebase (live)';
      
      updateStage('firebase', 'success', 'All configuration collections pushed to Cloud Firestore.', 55);
      updateStage('local_storage', 'loading', 'Updating localStorage data preview...', 60);
      await new Promise(resolve => setTimeout(resolve, 300));

      // 3. Local Storage stage
      localStorage.setItem('site_settings', JSON.stringify(settings));
      localStorage.setItem('site_notices', noticesText);
      localStorage.setItem('site_faculty', JSON.stringify(faculty));
      localStorage.setItem('site_admins', JSON.stringify(activeAdmins));
      localStorage.setItem('site_slides', JSON.stringify(slides));

      try {
        const channel = new BroadcastChannel('hss_data_sync');
        channel.postMessage({ type: 'UPDATE_DATA' });
        channel.close();
      } catch (e) {
        console.warn('Sync broadcast not supported:', e);
      }

      updateStage('local_storage', 'success', 'Local preview state synchronized.', 70);
      updateStage('files', 'loading', 'Writing files to disk...', 75);
      await new Promise(resolve => setTimeout(resolve, 400));

      // 4. File system sync stage
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      if (isLocalhost) {
        try {
          const res = await fetch('/api/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              settings,
              noticesText,
              faculty,
              admins: activeAdmins,
              slidesText
            })
          });

          if (res.ok) {
            didDirectoryWrite = true;
            fileSyncStatus += ', and locally written to slides/';
            fileWriteResults.push('Saved to workspace configurations via Express Proxy API');
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn('Local proxy save failed:', errData);
            fileWriteResults.push('Proxy save rejected');
          }
        } catch (err) {
          console.warn('Local proxy server is not running or encountered an error:', err);
          fileWriteResults.push('Proxy server offline');
        }
      }

      if (folderHandle) {
        try {
          const perm = await folderHandle.requestPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            const cleanedFaculty = faculty.map(({ id, ...rest }) => rest);

            const ok1 = await writeLocalFile(folderHandle, 'settings.json', JSON.stringify(settings, null, 2));
            const ok2 = await writeLocalFile(folderHandle, 'notices.txt', noticesText);
            const ok3 = await writeLocalFile(folderHandle, 'faculty.json', JSON.stringify(cleanedFaculty, null, 2));
            const ok4 = await writeLocalFile(folderHandle, 'admins.json', JSON.stringify(activeAdmins, null, 2));
            const ok5 = await writeLocalFile(folderHandle, 'slides.txt', slidesText);

            if (ok1 && ok2 && ok3 && ok4 && ok5) {
              didDirectoryWrite = true;
              if (!fileSyncStatus.includes('slides/')) fileSyncStatus += ', and local folder updated';
              fileWriteResults.push('Saved to local directory via Web File System Access API');
            } else {
              console.warn('folderHandle write incomplete:', { ok1, ok2, ok3, ok4, ok5 });
              fileWriteResults.push('Folder write partial failure');
            }
          } else {
            console.warn('folderHandle permission denied');
            fileWriteResults.push('Folder write permission denied');
          }
        } catch (err) {
          console.error('Error during auto-sync writing (folderHandle):', err);
          fileWriteResults.push(`Folder write error: ${err.message || err}`);
        }
      }

      const fileResultStr = fileWriteResults.length > 0 ? fileWriteResults.join(', ') : 'No directory handles or local server active';
      updateStage('files', 'success', fileResultStr, 85);
      updateStage('netlify', 'loading', 'Updating remote deployment backup...', 90);
      await new Promise(resolve => setTimeout(resolve, 350));

      // 5. Netlify backup stage
      let netlifyStatus = 'Skipped (running on localhost)';
      if (!isLocalhost && !didDirectoryWrite) {
        try {
          const remoteRes = await fetch('/.netlify/functions/save-config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-save-secret': process.env.REACT_APP_SAVE_SECRET || ''
            },
            body: JSON.stringify({ settings, noticesText, faculty, admins: activeAdmins, slidesText })
          });
          if (remoteRes.ok) {
            fileSyncStatus += ', plus remote Netlify backup';
            netlifyStatus = 'Backup successfully saved on Netlify edge environment';
          } else {
            const errData = await remoteRes.json().catch(() => ({}));
            console.warn('Remote save failed:', errData);
            netlifyStatus = 'Netlify functions save failed';
          }
        } catch (err) {
          console.warn('Remote save error:', err);
          netlifyStatus = `Netlify error: ${err.message || err}`;
        }
      }

      updateStage('netlify', 'success', netlifyStatus, 100);
      await new Promise(resolve => setTimeout(resolve, 600)); // allow progress bar to finish animation

      setSavePopupResult({
        success: true,
        title: 'Synchronized Successfully!',
        message: `Cloud database is fully updated, local configs are cached, and all settings are active. Target sync result: ${fileSyncStatus}.`
      });
    } catch (err) {
      console.error('Save sync failed:', err);
      const errMsg = err && (err.message || err.error || String(err));
      
      // We need to find which stage is loading and mark it as error
      setSaveStages(prev => {
        const next = [...prev];
        const loadingStageIdx = next.findIndex(s => s.status === 'loading');
        if (loadingStageIdx !== -1) {
          next[loadingStageIdx] = { ...next[loadingStageIdx], status: 'error', details: errMsg };
        } else {
          // Fallback if none are loading
          const firstPending = next.find(s => s.status === 'pending');
          if (firstPending) {
            firstPending.status = 'error';
            firstPending.details = errMsg;
          }
        }
        return next;
      });

      setSavePopupResult({
        success: false,
        title: 'Synchronization Interrupted',
        message: errMsg
      });
    }
  };

  // Downloader utilities
  const downloadFile = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSettingsJson = () => {
    const content = JSON.stringify(settings, null, 2);
    downloadFile('settings.json', content, 'application/json');
  };

  const downloadNoticesTxt = () => {
    const content = notices.map(n => `${n.date},${n.title},${n.link || '#'}`).join('\n');
    downloadFile('notices.txt', content, 'text/plain');
  };

  const downloadFacultyJson = () => {
    const cleanedFaculty = faculty.map(({ id, ...rest }) => rest);
    const content = JSON.stringify(cleanedFaculty, null, 2);
    downloadFile('faculty.json', content, 'application/json');
  };

  const downloadFullBackup = () => {
    const backupData = {
      version: 1,
      timestamp: new Date().toISOString(),
      settings,
      notices,
      faculty,
      admins,
      slides
    };
    const content = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(`hss_full_backup_${dateStr}.json`, content, 'application/json');
  };

  const handleRestoreBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        
        if (!backupData || typeof backupData !== 'object') {
          throw new Error('Invalid file format. Backup must be a JSON object.');
        }

        const hasSettings = backupData.hasOwnProperty('settings');
        const hasFaculty = backupData.hasOwnProperty('faculty') && Array.isArray(backupData.faculty);
        const hasNotices = backupData.hasOwnProperty('notices') && Array.isArray(backupData.notices);
        const hasSlides = backupData.hasOwnProperty('slides') && Array.isArray(backupData.slides);
        const hasAdmins = backupData.hasOwnProperty('admins') && Array.isArray(backupData.admins);

        if (!hasSettings && !hasFaculty && !hasNotices && !hasSlides && !hasAdmins) {
          throw new Error('Invalid backup file: Could not find settings, faculty, notices, slideshow, or admin records.');
        }

        const confirmRestore = window.confirm(
          "WARNING: Restoring this backup will replace all configurations in your admin console.\n\n" +
          "This includes your site settings, notices, faculty members, admins, and slideshow configs.\n\n" +
          "Click OK to restore to console preview. You MUST click 'Apply & Save' in the top header afterwards to commit the restored data live to Firebase."
        );

        if (!confirmRestore) {
          e.target.value = '';
          return;
        }

        if (hasSettings) setSettings(backupData.settings);
        if (hasNotices) setNotices(backupData.notices);
        if (hasFaculty) setFaculty(backupData.faculty);
        if (hasAdmins) setAdmins(backupData.admins);
        if (hasSlides) setSlides(backupData.slides);

        setSaveSuccess('Backup successfully loaded into console preview. Click "Apply & Save" in the top header to push these changes live to Firebase (live) and local files.');
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } catch (err) {
        console.error('Failed to parse or restore backup:', err);
        alert(`Restore failed: ${err.message || err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // CSV Import/Export & Profile Printing Utilities
  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push('');
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.trim().replace(/^"|"$/g, ''));
    const records = [];

    for (let r = 1; r < lines.length; r++) {
      const values = lines[r];
      if (values.length < headers.length) continue;

      const record = {};
      headers.forEach((header, idx) => {
        record[header] = (values[idx] || '').trim();
      });

      // Skip row only if it is completely empty/whitespace
      const hasAnyData = Object.values(record).some(val => val.trim() !== '');
      if (!hasAnyData) continue;

      // Extract postings
      const postings = [];
      for (let i = 1; i <= 13; i++) {
        const office = record[`Posting Office-${i}`] || '';
        const designation = record[`Designation-${i}`] || '';
        const fromDate = record[`Posting From-${i}`] || '';
        const toDate = record[`Posting To-${i}`] || '';
        if (office || designation) {
          postings.push({
            office: toTitleCase(office),
            designation: toTitleCase(designation),
            from: fromDate,
            to: toDate
          });
        }
      }

      // Determine department
      const desig = record['Present Designation'] || '';
      const subj = record['Subject in PG'] || '';
      const subjTeaching = record['Subject/s teaching'] || '';
      let dept = record['Department'] || '';
      if (!dept || dept.trim() === '') {
        const desigLower = desig.toLowerCase();
        if (desigLower.includes('principal')) {
          dept = 'Administration';
        } else if (['mts', 'class iv', 'peon', 'safaiwalla', 'chowkidar', 'lab assistant', 'lab bearer', 'library bearer'].some(d => desigLower.includes(d))) {
          dept = 'MTS';
        } else if (['botany', 'zoology', 'chemistry', 'mathematics', 'biotechnology', 'physics'].includes((subjTeaching || subj).toLowerCase())) {
          dept = 'Science';
        } else if (['teacher', 'master'].some(d => desigLower.includes(d))) {
          dept = 'Secondary';
        } else {
          dept = 'Humanities';
        }
      }

      // Clean designations (strip trailing "in <Subject>" for administrative/MTS staff)
      const cleanedDesig = cleanDesignation(desig);

      // Display subject = what they teach (subjTeaching), fallback to Subject in PG
      const displaySubj = subjTeaching.toLowerCase() === 'na' ? (subj.toLowerCase() === 'na' ? '' : subj) : subjTeaching || subj;

      // Extract custom fields (any headers that aren't mapped standard fields or posting entries)
      const standardHeaders = [
        "S.No.", "Email address", "Parent District", "Present District", "Full Name", "Date of Birth", "Date of 1st Appointment",
        "Designation at First Appointment", "Present Designation", "Present Place of Posting", "Stay Period", "CPIS No", "Parentage",
        "Category", "Zone Name", "UDISE/DDO Code", "DDO Code HRMS", "Cadre", "Qualification", "Subject in PG", "Subject/s teaching", "Department", "B.ED",
        "Total Postings", "Health Issues/Security Grounds", "If Deployed", "Permanent Address", "Present Address", "Contact Number", "Govt. Mail ID",
        "Photo URL", "Profile Bio", "Hidden", "Inactive Reason", "PAN", "PAN No", "Gross Salary", "TDS",
        "Tax Regime", "80C Deductions", "80D Deductions", "HRA Exemption", "Other Deductions"
      ];
      const customFields = {};
      headers.forEach((header, hIdx) => {
        const isStandard = standardHeaders.includes(header) ||
          /^Posting Office-\d+$/.test(header) ||
          /^Designation-\d+$/.test(header) ||
          /^Posting From-\d+$/.test(header) ||
          /^Posting To-\d+$/.test(header);
        if (!isStandard && header.trim() !== '') {
          customFields[header] = (values[hIdx] || '').trim();
        }
      });

      const importedPan = record['PAN'] || record['PAN No'] || '';
      const importedGross = record['Gross Salary'] || '';
      const importedTds = record['TDS'] || '';
      const importedRegime = (record['Tax Regime'] || record['Regime'] || 'new').toLowerCase().trim() === 'old' ? 'old' : 'new';
      const imported80C = parseFloat(record['80C Deductions'] || record['80C'] || 0) || 0;
      const imported80D = parseFloat(record['80D Deductions'] || record['80D'] || 0) || 0;
      const importedHra = parseFloat(record['HRA Exemption'] || record['HRA'] || 0) || 0;
      const importedOther = parseFloat(record['Other Deductions'] || record['Other'] || 0) || 0;

      records.push({
        name: toTitleCase(record['Full Name']),
        designation: toTitleCase(cleanedDesig),
        subject: (dept === 'Administration' || dept === 'MTS') ? '' : toTitleCase(displaySubj),
        subject_pg: (dept === 'Administration' || dept === 'MTS') ? '' : (subj.toLowerCase() === 'na' ? '' : toTitleCase(subj)),
        email: record['Email address'] || '',
        mobile: record['Contact Number'] || '',
        photo: record['Photo URL'] !== undefined ? record['Photo URL'] : (record['Full Name'] === 'AIJAZ AHMAD WAGAY' ? '/slides/Principal.jpg' : (record['Full Name'] === 'SHEIKH GULFAM' ? '/slides/Gulfam.jpg' : '')),
        department: dept,
        profile: record['Profile Bio'] !== undefined ? record['Profile Bio'] : '',
        hidden: record['Hidden'] !== undefined ? (record['Hidden'].toLowerCase() === 'true' || record['Hidden'].toLowerCase() === 'yes') : undefined,
        inactiveReason: record['Inactive Reason'] !== undefined ? record['Inactive Reason'] : undefined,

        pan: importedPan,
        grossSalary: importedGross ? parseFloat(importedGross) || 0 : 0,
        tds: importedTds ? parseFloat(importedTds) || 0 : 0,
        taxRegime: importedRegime,
        deduction80C: imported80C,
        deduction80D: imported80D,
        hraExemption: importedHra,
        otherDeductions: importedOther,

        parent_district: toTitleCase(record['Parent District'] || ''),
        present_district: toTitleCase(record['Present District'] || ''),
        present_place_of_posting: toTitleCase(record['Present Place of Posting'] || ''),
        customFields: {
          ...customFields,
          PAN: importedPan,
          'Gross Salary': importedGross,
          TDS: importedTds,
          'Tax Regime': importedRegime,
          '80C Deductions': imported80C.toString(),
          '80D Deductions': imported80D.toString(),
          'HRA Exemption': importedHra.toString(),
          'Other Deductions': importedOther.toString()
        },

        // Custom fields preserved
        dob: record['Date of Birth'] || '',
        parentage: toTitleCase(record['Parentage'] || ''),
        category: record['Category'] || '',
        cpis_no: record['CPIS No'] || '',
        date_of_first_appointment: record['Date of 1st Appointment'] || '',
        designation_at_first_appointment: toTitleCase(record['Designation at First Appointment'] || ''),
        stay_period: record['Stay Period'] || '',
        qualification: toTitleCase(record['Qualification'] || ''),
        bed: record['B.ED'] || '',
        health_issues: record['Health Issues/Security Grounds'] || '',
        if_deployed: record['If Deployed'] || '',
        permanent_address: toTitleCase(record['Permanent Address'] || ''),
        present_address: toTitleCase(record['Present Address'] || ''),
        gov_mail_id: record['Govt. Mail ID'] || '',
        ddo_code: formatUDISECode(record['UDISE/DDO Code'] || ''),
        ddo_code_hrms: record['DDO Code HRMS'] || '',
        cadre: record['Cadre'] || '',
        zone_name: toTitleCase(record['Zone Name'] || ''),
        postings
      });
    }

    return records;
  };

  const validateCSVRecords = (records) => {
    const errors = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\s\-]{10,15}$/;

    records.forEach((r, idx) => {
      const rowNum = idx + 2; // Row 1 is header
      const name = r.name || 'Unknown Row';

      // 1. Name validation
      if (!r.name || r.name.trim() === '') {
        errors.push({ row: rowNum, name, message: 'Full Name is required but was empty.' });
      }

      // 2. Designation validation
      if (!r.designation || r.designation.trim() === '') {
        errors.push({ row: rowNum, name, message: 'Present Designation is required but was empty.' });
      }

      // 3. Email validation (if provided)
      if (r.email && r.email.trim() !== '') {
        if (!emailRegex.test(r.email.trim())) {
          errors.push({ row: rowNum, name, message: `Invalid Email address format: "${r.email}".` });
        }
      }

      // 4. Contact Number validation (if provided)
      if (r.mobile && r.mobile.trim() !== '') {
        if (!phoneRegex.test(r.mobile.trim())) {
          errors.push({ row: rowNum, name, message: `Invalid Contact Number format: "${r.mobile}". Must be 10-15 digits.` });
        }
      }
    });

    return errors;
  };

  const handleDownloadCSVTemplate = () => {
    const headers = [
      "S.No.", "Email address", "Parent District", "Present District", "Full Name", "Date of Birth", "Date of 1st Appointment",
      "Designation at First Appointment", "Present Designation", "Present Place of Posting", "Stay Period", "CPIS No", "Parentage",
      "Category", "Zone Name", "UDISE/DDO Code", "DDO Code HRMS", "Cadre", "Qualification", "Subject in PG", "Subject/s teaching", "Department", "B.ED",
      "Total Postings",
      "Posting Office-1", "Designation-1", "Posting From-1", "Posting To-1",
      "Posting Office-2", "Designation-2", "Posting From-2", "Posting To-2",
      "Posting Office-3", "Designation-3", "Posting From-3", "Posting To-3",
      "Posting Office-4", "Designation-4", "Posting From-4", "Posting To-4",
      "Posting Office-5", "Designation-5", "Posting From-5", "Posting To-5",
      "Posting Office-6", "Designation-6", "Posting From-6", "Posting To-6",
      "Posting Office-7", "Designation-7", "Posting From-7", "Posting To-7",
      "Posting Office-8", "Designation-8", "Posting From-8", "Posting To-8",
      "Posting Office-9", "Designation-9", "Posting From-9", "Posting To-9",
      "Posting Office-10", "Designation-10", "Posting From-10", "Posting To-10",
      "Posting Office-11", "Designation-11", "Posting From-11", "Posting To-11",
      "Posting Office-12", "Designation-12", "Posting From-12", "Posting To-12",
      "Posting Office-13", "Designation-13", "Posting From-13", "Posting To-13",
      "Health Issues/Security Grounds", "If Deployed", "Permanent Address", "Present Address", "Contact Number", "Govt. Mail ID",
      "Photo URL", "Profile Bio", "Hidden", "Inactive Reason",
      "PAN", "Gross Salary", "TDS", "Tax Regime", "80C Deductions", "80D Deductions", "HRA Exemption", "Other Deductions"
    ];

    const sampleRow = [
      "1", "sheikhgulfam@gmail.com", "Anantnag", "Anantnag", "Mr. Sheikh Gulfam", "12-05-1988", "01-04-2015",
      "Teacher", "Lecturer", "HSS Shangus", "2 Years", "CPIS12345", "Father Name",
      "General", "Shangus", "1061400618", "SHGEDU0022", "GAZETTED", "M.Sc, B.Ed", "Chemistry", "Chemistry", "Science", "Yes",
      "2",
      "HSS Shangus", "Teacher", "01-04-2015", "10-10-2020",
      "HSS Ranipora", "Lecturer", "11-10-2020", "Present",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "", "", "", "",
      "No", "No", "Shangus, Anantnag", "Shangus, Anantnag", "+91-7006123456", "gulfam.edu@jk.gov.in",
      "/slides/Gulfam.jpg", "Senior lecturer with 10+ years of teaching experience.", "false", "",
      "ABCDE1234F", "1250000", "75000", "old", "150000", "25000", "12000", "0"
    ];

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      sampleRow.map(v => `"${v}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "faculty_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      try {
        const parsed = parseCSV(text);
        if (parsed.length > 0) {
          const errors = validateCSVRecords(parsed);
          if (errors.length > 0) {
            setCsvValidationErrors(errors);
            setShowCsvErrorModal(true);
          } else {
            setCsvPreviewData(parsed);
            setShowCsvPreviewModal(true);
          }
        } else {
          showAlert('Could not find valid employee records in the CSV.', 'Empty CSV Roster');
        }
      } catch (err) {
        console.error(err);
        showAlert('Failed to parse CSV. Please ensure it is a valid format.', 'Parsing Failure');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const getCsvColumnOptions = () => {
    const columnOptions = [
      { key: 'page', label: 'Page', getValue: (_, rowIndex) => rowIndex + 1 },
      { key: 'serial', label: 'S.No.', getValue: (_, rowIndex) => rowIndex + 1 },
      { key: 'email', label: 'Email address', getValue: (emp) => emp.email || '' },
      { key: 'parent_district', label: 'Parent District', getValue: (emp) => emp.parent_district || 'Anantnag' },
      { key: 'present_district', label: 'Present District', getValue: (emp) => emp.present_district || 'Anantnag' },
      { key: 'name', label: 'Name', getValue: (emp) => emp.name || '' },
      { key: 'full_name', label: 'Full Name', getValue: (emp) => emp.name || '' },
      { key: 'dob', label: 'Date of Birth', getValue: (emp) => emp.dob || '' },
      { key: 'date_of_first_appointment', label: 'Date of 1st Appointment', getValue: (emp) => emp.date_of_first_appointment || '' },
      { key: 'designation_at_first_appointment', label: 'Designation at First Appointment', getValue: (emp) => emp.designation_at_first_appointment || '' },
      { key: 'designation', label: 'Designation', getValue: (emp) => emp.designation || '' },
      { key: 'present_designation', label: 'Present Designation', getValue: (emp) => emp.designation || '' },
      { key: 'present_place_of_posting', label: 'Present Place of Posting', getValue: (emp) => emp.present_place_of_posting || 'HSS Shangus' },
      { key: 'stay_period', label: 'Stay Period', getValue: (emp) => emp.stay_period || '' },
      { key: 'calculated_stay_period', label: 'Calculated Stay Period', getValue: (emp) => getCalculatedStayPeriod(emp.stay_period || '') },
      { key: 'cpis_no', label: 'CPIS ID', getValue: (emp) => emp.cpis_no || '' },
      { key: 'parentage', label: 'Parentage', getValue: (emp) => emp.parentage || '' },
      { key: 'category', label: 'Category', getValue: (emp) => emp.category || '' },
      { key: 'zone_name', label: 'Zone Name', getValue: (emp) => emp.zone_name || 'Shangus' },
      { key: 'ddo_code', label: 'UDISE/DDO Code', getValue: (emp) => emp.ddo_code || '1061400618' },
      { key: 'ddo_code_hrms', label: 'DDO Code HRMS', getValue: (emp) => emp.ddo_code_hrms || 'SHGEDU0022' },
      { key: 'cadre', label: 'Cadre', getValue: (emp) => emp.cadre || 'GAZETTED' },
      { key: 'qualification', label: 'Qualification', getValue: (emp) => emp.qualification || '' },
      { key: 'subject_pg', label: 'Subject in PG', getValue: (emp) => emp.subject_pg || emp.subject || '' },
      { key: 'subject', label: 'Subject/s teaching', getValue: (emp) => emp.subject || '' },
      { key: 'department', label: 'Department', getValue: (emp) => emp.department || '' },
      { key: 'bed', label: 'B.ED', getValue: (emp) => emp.bed || '' },
      { key: 'total_postings', label: 'Total Postings', getValue: (emp) => (emp.postings || []).length },
      { key: 'health_issues', label: 'Health Issues/Security Grounds', getValue: (emp) => emp.health_issues || 'No' },
      { key: 'if_deployed', label: 'If Deployed', getValue: (emp) => emp.if_deployed || 'No' },
      { key: 'permanent_address', label: 'Permanent Address', getValue: (emp) => emp.permanent_address || '' },
      { key: 'present_address', label: 'Present Address', getValue: (emp) => emp.present_address || '' },
      { key: 'mobile', label: 'Contact Number', getValue: (emp) => emp.mobile || '' },
      { key: 'gov_mail_id', label: 'Govt. Mail ID', getValue: (emp) => emp.gov_mail_id || '' },
      { key: 'photo', label: 'Photo URL', getValue: (emp) => emp.photo || '' },
      { key: 'profile', label: 'Profile Bio', getValue: (emp) => emp.profile || '' },
      { key: 'hidden', label: 'Hidden', getValue: (emp) => emp.hidden ? 'true' : 'false' },
      { key: 'inactiveReason', label: 'Inactive Reason', getValue: (emp) => emp.inactiveReason || '' },
      { key: 'pan', label: 'PAN', getValue: (emp) => getEmployeePan(emp) },
      { key: 'gross_salary', label: 'Gross Salary (Rs)', getValue: (emp) => getEmployeeGross(emp) },
      { key: 'tds', label: 'TDS Up to Date (Rs)', getValue: (emp) => getEmployeeTds(emp) },
      { key: 'tax_regime', label: 'Tax Regime', getValue: (emp) => getEmployeeRegime(emp) },
      { key: 'deduction_80c', label: '80C Deductions (Rs)', getValue: (emp) => getEmployee80C(emp) },
      { key: 'deduction_80d', label: '80D Deductions (Rs)', getValue: (emp) => getEmployee80D(emp) },
      { key: 'hra_exemption', label: 'HRA Exemption (Rs)', getValue: (emp) => getEmployeeHra(emp) },
      { key: 'other_deductions', label: 'Other Deductions (Rs)', getValue: (emp) => getEmployeeOtherDeductions(emp) },
      { key: 'taxable_income', label: 'Taxable Income (Rs)', getValue: (_, __, calc) => Math.round(calc.taxableIncome) },
      { key: 'tax_before_cess', label: 'Tax Before Cess (Rs)', getValue: (_, __, calc) => Math.round(calc.taxBeforeCess) },
      { key: 'rebate', label: 'Rebate U/s 87A (Rs)', getValue: (_, __, calc) => Math.round(calc.rebate) },
      { key: 'marginal_relief', label: 'Marginal Relief (Rs)', getValue: (_, __, calc) => Math.round(calc.marginalRelief) },
      { key: 'surcharge', label: 'Surcharge (Rs)', getValue: (_, __, calc) => Math.round(calc.surcharge) },
      { key: 'cess', label: 'Health & Education Cess (Rs)', getValue: (_, __, calc) => Math.round(calc.cess) },
      { key: 'total_tax_payable', label: 'Total Tax Payable (Rs)', getValue: (_, __, calc) => calc.totalTax },
      { key: 'tax_payable_now', label: 'Tax Payable Now (Rs)', getValue: (_, __, calc) => formatTaxCsvAmount(calc.taxPayableNow) }
    ];

    for (let i = 1; i <= 13; i++) {
      const postingIndex = i - 1;
      columnOptions.push(
        { key: `posting_office_${i}`, label: `Posting Office-${i}`, getValue: (emp) => emp.postings?.[postingIndex]?.office || '' },
        { key: `posting_designation_${i}`, label: `Designation-${i}`, getValue: (emp) => emp.postings?.[postingIndex]?.designation || '' },
        { key: `posting_from_${i}`, label: `Posting From-${i}`, getValue: (emp) => emp.postings?.[postingIndex]?.from || '' },
        { key: `posting_to_${i}`, label: `Posting To-${i}`, getValue: (emp) => emp.postings?.[postingIndex]?.to || '' }
      );
    }

    const excludedCustomKeys = new Set([
      'PAN', 'PAN No', 'pan', 'Gross Salary', 'Gross', 'gross_salary', 'TDS', 'tds', 'TDS Paid'
    ]);
    const customKeys = [];
    faculty.forEach((emp) => {
      Object.keys(emp.customFields || {}).forEach((key) => {
        if (!excludedCustomKeys.has(key) && !customKeys.includes(key)) {
          customKeys.push(key);
        }
      });
    });

    return [
      ...columnOptions,
      ...customKeys.map((key) => ({
        key: `custom:${key}`,
        label: key,
        getValue: (emp) => emp.customFields?.[key] || ''
      }))
    ];
  };

  const openCsvExportModal = (mode = 'faculty') => {
    if (faculty.length === 0) {
      showAlert('No faculty records to export.', 'Export Empty');
      return;
    }

    const columns = getCsvColumnOptions();
    const availableKeys = new Set(columns.map((column) => column.key));
    const defaultColumnKeys = mode === 'tax'
      ? TAX_CSV_DEFAULT_COLUMNS.filter((key) => availableKeys.has(key))
      : columns.map((column) => column.key);

    setCsvExportMode(mode);
    if (mode === 'tax') {
      setSelectedCsvEmployeeIndices(selectedTaxEmployeeIndices.length > 0 ? selectedTaxEmployeeIndices : getVisibleTaxFaculty().map(emp => faculty.indexOf(emp)));
    } else {
      setSelectedCsvEmployeeIndices(faculty.map((_, index) => index));
    }
    setSelectedCsvColumns(defaultColumnKeys);
    setCsvExportSearch('');
    setCsvExportDept('All');
    setShowCsvExportModal(true);
  };

  const handleCSVExport = () => openCsvExportModal('faculty');
  const handleTaxCSVExport = () => openCsvExportModal('tax');

  const downloadSelectedCSV = () => {
    const selectedEmployees = [...selectedCsvEmployeeIndices]
      .sort((a, b) => a - b)
      .map((index) => faculty[index])
      .filter(Boolean);
    const selectedColumnOptions = getCsvColumnOptions().filter((column) => selectedCsvColumns.includes(column.key));

    if (selectedEmployees.length === 0) {
      showAlert('Select at least one employee before downloading the CSV.', 'No Employees Selected');
      return;
    }

    if (selectedColumnOptions.length === 0) {
      showAlert('Select at least one column before downloading the CSV.', 'No Columns Selected');
      return;
    }

    const headerRow = selectedColumnOptions.map((column) => escapeCSVValue(column.label)).join(',');
    const rows = selectedEmployees.map((emp, rowIndex) => {
      const calc = calculateTax(getEmployeeGross(emp), getEmployeeTds(emp), taxConfig, getEmployeeTaxOptions(emp));
      return selectedColumnOptions
        .map((column) => escapeCSVValue(column.getValue(emp, rowIndex, calc)))
        .join(',');
    });

    const exportFileName = csvExportMode === 'tax'
      ? `tax_summary_${taxConfig.assessmentYearLabel || 'export'}.csv`
      : 'faculty_roster_custom.csv';
    downloadFile(exportFileName, [headerRow, ...rows].join('\n'), 'text/csv;charset=utf-8;');
    setShowCsvExportModal(false);
  };

  const toggleCsvEmployeeSelection = (index) => {
    setSelectedCsvEmployeeIndices((current) => (
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index]
    ));
  };

  const toggleCsvColumnSelection = (columnKey) => {
    setSelectedCsvColumns((current) => (
      current.includes(columnKey)
        ? current.filter((item) => item !== columnKey)
        : [...current, columnKey]
    ));
  };

  const csvColumnOptions = getCsvColumnOptions();
  const csvDepartmentOptions = ['All', ...Array.from(new Set(faculty.map((emp) => emp.department).filter(Boolean))).sort()];
  const filteredCsvEmployees = faculty
    .map((emp, index) => ({ emp, index }))
    .filter(({ emp }) => {
      const term = csvExportSearch.trim().toLowerCase();
      const matchesSearch = !term || [emp.name, emp.designation, emp.cpis_no, emp.department]
        .some((value) => (value || '').toLowerCase().includes(term));
      const matchesDept = csvExportDept === 'All' || (emp.department || '') === csvExportDept;
      return matchesSearch && matchesDept;
    });
  const activeRegimeConfig = activeRegimeSettingsTab === 'old' ? taxConfig.oldRegime : taxConfig.newRegime;
  const taxFreeGrossSalary = activeRegimeConfig.standardDeduction + activeRegimeConfig.rebateThreshold;

  const printEmployeeProfile = (t) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showAlert('Pop-up blocker is enabled. Please allow pop-ups to print profiles.', 'Pop-up Blocked');
      return;
    }

    const postings = t.postings || [];
    const postingsHtml = postings.map((p, i) => `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${i + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${p.office || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${p.designation || ''}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${p.from || ''}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${p.to || ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="5" style="text-align: center; border: 1px solid #cbd5e1; padding: 12px; color: #64748b;">No posting records available</td></tr>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Profile - ${t.name}</title>
          <style>
            @media print {
              body { font-family: 'Segoe UI', sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; }
              .no-print { display: none; }
            }
            body { font-family: 'Segoe UI', sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; background: #fff; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 3px double #0f766e; }
            .header-title { text-align: center; padding-bottom: 10px; }
            .header-title h1 { margin: 0; font-size: 20px; color: #961c14; text-transform: uppercase; font-family: 'Georgia', serif; }
            .header-title h2 { margin: 5px 0 0 0; font-size: 13px; color: #0f766e; letter-spacing: 1px; text-transform: uppercase; }
            
            .section-title { font-size: 13px; font-weight: bold; background: #f1f5f9; color: #0f766e; padding: 6px 12px; margin: 20px 0 10px 0; text-transform: uppercase; border-left: 4px solid #961c14; letter-spacing: 0.5px; }
            
            .profile-grid { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .profile-grid td { padding: 6px 10px; font-size: 12px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
            .label { font-weight: bold; color: #475569; width: 35%; }
            .value { color: #0f172a; }
            
            .photo-box { width: 130px; height: 160px; border: 2px dashed #cbd5e1; text-align: center; font-size: 10px; color: #94a3b8; display: flex; flex-direction: column; align-items: center; justify-content: center; float: right; margin-left: 20px; border-radius: 4px; overflow: hidden; background: #fafafa; }
            .photo-box img { width: 100%; height: 100%; object-fit: cover; }
            
            .posting-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            .posting-table th { background: #0f766e; color: white; padding: 8px; border: 1px solid #0f766e; text-align: left; text-transform: uppercase; font-size: 10px; }
            
            .footer-signatures { width: 100%; margin-top: 60px; border-collapse: collapse; }
            .footer-signatures td { font-size: 12px; font-weight: bold; width: 50%; padding-top: 50px; border: none; }
            
            .print-btn { display: inline-flex; align-items: center; background: #961c14; color: white; border: none; padding: 8px 16px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer; margin-bottom: 20px; transition: background 0.2s; }
            .print-btn:hover { background: #0f766e; }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: right;">
            <button onclick="window.print()" class="print-btn">Print Profile / Save PDF</button>
          </div>
          
          <table class="header-table">
            <tr>
              <td class="header-title">
                <h1>Government Higher Secondary School Shangus</h1>
                <h2>Institutional Employee Service Profile Sheet</h2>
              </td>
            </tr>
          </table>

          <div style="overflow: hidden; margin-bottom: 15px;">
            <div class="photo-box">
              ${t.photo ? `<img src="${t.photo}" alt="${t.name}" onerror="this.style.display='none'; this.parentElement.innerText='Affix Passport Photo'"/>` : 'Affix Passport Photo'}
            </div>
            
            <div style="margin-right: 160px;">
              <div class="section-title" style="margin-top: 0;">Personal Details</div>
              <table class="profile-grid">
                <tr>
                  <td class="label">Full Name:</td>
                  <td class="value" style="font-size: 14px; font-weight: bold; color: #961c14;">${t.name || ''}</td>
                </tr>
                <tr>
                  <td class="label">Parentage:</td>
                  <td class="value">${t.parentage || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Date of Birth:</td>
                  <td class="value">${t.dob || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Category:</td>
                  <td class="value">${t.category || 'OM'}</td>
                </tr>
                <tr>
                  <td class="label">Permanent Address:</td>
                  <td class="value">${t.permanent_address || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Present Address:</td>
                  <td class="value">${t.present_address || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Contact Number:</td>
                  <td class="value" style="font-family: monospace; font-weight: 600;">${t.mobile || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Email Address:</td>
                  <td class="value">${t.email || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Govt. Mail ID:</td>
                  <td class="value">${t.gov_mail_id || '-'}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="section-title">Service & Appointment Details</div>
          <table class="profile-grid">
            <tr>
              <td class="label">CPIS No:</td>
              <td class="value" style="font-family: monospace; font-weight: bold; color: #0f766e;">${t.cpis_no || '-'}</td>
              <td class="label" style="padding-left: 20px;">Present Place of Posting:</td>
              <td class="value">${t.present_place_of_posting || 'HSS Shangus'}</td>
            </tr>
            <tr>
              <td class="label">Date of 1st Appointment:</td>
              <td class="value">${t.date_of_first_appointment || '-'}</td>
              <td class="label" style="padding-left: 20px;">Stay from (Period):</td>
              <td class="value">${getCalculatedStayPeriod(t.stay_period)}</td>
            </tr>
            <tr>
              <td class="label">Designation at 1st Appt:</td>
              <td class="value">${t.designation_at_first_appointment || '-'}</td>
              <td class="label" style="padding-left: 20px;">Present Designation:</td>
              <td class="value">${t.designation || '-'}</td>
            </tr>
            <tr>
              <td class="label">Zone Name:</td>
              <td class="value">${t.zone_name || 'Shangus'}</td>
              <td class="label" style="padding-left: 20px;">UDISE Code:</td>
              <td class="value" style="font-family: monospace;">${t.ddo_code || '01061400618'}</td>
            </tr>
            <tr>
              <td class="label">DDO Code HRMS:</td>
              <td class="value" style="font-family: monospace;">${t.ddo_code_hrms || 'SHGEDU0022'}</td>
              <td class="label" style="padding-left: 20px;">Service Cadre:</td>
              <td class="value" style="text-transform: uppercase;">${t.cadre || 'GAZETTED'}</td>
            </tr>
          </table>

          <div class="section-title">Qualifications & Health Credentials</div>
          <table class="profile-grid">
            <tr>
              <td class="label">Qualifications:</td>
              <td class="value">${t.qualification || '-'}</td>
              <td class="label" style="padding-left: 20px;">Subject in PG:</td>
              <td class="value">${t.subject || 'NA'}</td>
            </tr>
            <tr>
              <td class="label">B.Ed Completed:</td>
              <td class="value">${t.bed || 'NO'}</td>
              <td class="label" style="padding-left: 20px;">Deployment Status:</td>
              <td class="value">${t.if_deployed === 'in' ? 'Deployed In (from another school)' : t.if_deployed === 'out' ? 'Deployed Out (sent to another school)' : t.if_deployed === 'Yes' ? 'On Deployment' : 'No'}</td>
            </tr>
            <tr>
              <td class="label">Health/Security Grounds:</td>
              <td class="value" colspan="3">${t.health_issues || 'No'}</td>
            </tr>
          </table>

          ${t.customFields && Object.keys(t.customFields).length > 0 ? `
            <div class="section-title">Additional Details</div>
            <table class="profile-grid">
              ${Object.entries(t.customFields).map(([key, val]) => `
                <tr>
                  <td class="label">${key}:</td>
                  <td class="value">${val || '-'}</td>
                </tr>
              `).join('')}
            </table>
          ` : ''}

          <div class="section-title">Historical Posting Profile</div>
          <table class="posting-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">S.No</th>
                <th style="width: 45%;">Posting Office / Institution</th>
                <th style="width: 25%;">Designation</th>
                <th style="width: 12.5%; text-align: center;">From Date</th>
                <th style="width: 12.5%; text-align: center;">To Date</th>
              </tr>
            </thead>
            <tbody>
              ${postingsHtml}
            </tbody>
          </table>

          <table class="footer-signatures">
            <tr>
              <td style="text-align: left; border-top: 1px solid #94a3b8; width: 40%;">Signature of Employee</td>
              <td style="width: 20%; border: none;"></td>
              <td style="text-align: right; border-top: 1px solid #94a3b8; width: 40%;">Counter Signature of Principal<br/><span style="font-size: 9px; font-weight: normal; color: #64748b;">(Govt. HSS Shangus)</span></td>
            </tr>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printBulkProfiles = (selectedFaculty) => {
    if (selectedFaculty.length === 0) {
      showAlert('Please select at least one employee.', 'No Selection');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showAlert('Pop-up blocker is enabled. Please allow pop-ups to print profiles.', 'Pop-up Blocked');
      return;
    }

    const profilesHtml = selectedFaculty.map((t) => {
      const postings = t.postings || [];
      const postingsHtml = postings.map((p, i) => `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${i + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px;">${p.office || ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px;">${p.designation || ''}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${p.from || ''}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${p.to || ''}</td>
        </tr>
      `).join('') || `<tr><td colspan="5" style="text-align: center; border: 1px solid #cbd5e1; padding: 12px; color: #64748b;">No posting records available</td></tr>`;

      return `
        <div class="profile-page">
          <table class="header-table">
            <tr>
              <td class="header-title">
                <h1>Government Higher Secondary School Shangus</h1>
                <h2>Institutional Employee Service Profile Sheet</h2>
              </td>
            </tr>
          </table>

          <div style="overflow: hidden; margin-bottom: 15px;">
            <div class="photo-box">
              ${t.photo ? `<img src="${t.photo}" alt="${t.name}" onerror="this.style.display='none'; this.parentElement.innerText='Affix Passport Photo'"/>` : (t.designation && t.designation.toLowerCase() === 'principal' ? `<img src="/slides/Principal.jpg" alt="${t.name}" onerror="this.style.display='none'; this.parentElement.innerText='Affix Passport Photo'"/>` : 'Affix Passport Photo')}
            </div>
            
            <div style="margin-right: 160px;">
              <div class="section-title" style="margin-top: 0;">Personal Details</div>
              <table class="profile-grid">
                <tr>
                  <td class="label">Full Name:</td>
                  <td class="value" style="font-size: 14px; font-weight: bold; color: #961c14;">${t.name || ''}</td>
                </tr>
                <tr>
                  <td class="label">Parentage:</td>
                  <td class="value">${t.parentage || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Date of Birth:</td>
                  <td class="value">${t.dob || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Category:</td>
                  <td class="value">${t.category || 'OM'}</td>
                </tr>
                <tr>
                  <td class="label">Permanent Address:</td>
                  <td class="value">${t.permanent_address || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Present Address:</td>
                  <td class="value">${t.present_address || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Contact Number:</td>
                  <td class="value" style="font-family: monospace; font-weight: 600;">${t.mobile || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Email Address:</td>
                  <td class="value">${t.email || '-'}</td>
                </tr>
                <tr>
                  <td class="label">Govt. Mail ID:</td>
                  <td class="value">${t.gov_mail_id || '-'}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="section-title">Service & Appointment Details</div>
          <table class="profile-grid">
            <tr>
              <td class="label">CPIS No:</td>
              <td class="value" style="font-family: monospace; font-weight: bold; color: #0f766e;">${t.cpis_no || '-'}</td>
              <td class="label" style="padding-left: 20px;">Present Place of Posting:</td>
              <td class="value">${t.present_place_of_posting || 'HSS Shangus'}</td>
            </tr>
            <tr>
              <td class="label">Date of 1st Appointment:</td>
              <td class="value">${t.date_of_first_appointment || '-'}</td>
              <td class="label" style="padding-left: 20px;">Stay from (Period):</td>
              <td class="value">${getCalculatedStayPeriod(t.stay_period)}</td>
            </tr>
            <tr>
              <td class="label">Designation at 1st Appt:</td>
              <td class="value">${t.designation_at_first_appointment || '-'}</td>
              <td class="label" style="padding-left: 20px;">Present Designation:</td>
              <td class="value">${t.designation || '-'}</td>
            </tr>
            <tr>
              <td class="label">Zone Name:</td>
              <td class="value">${t.zone_name || 'Shangus'}</td>
              <td class="label" style="padding-left: 20px;">UDISE Code:</td>
              <td class="value" style="font-family: monospace;">${t.ddo_code || '01061400618'}</td>
            </tr>
            <tr>
              <td class="label">DDO Code HRMS:</td>
              <td class="value" style="font-family: monospace;">${t.ddo_code_hrms || 'SHGEDU0022'}</td>
              <td class="label" style="padding-left: 20px;">Service Cadre:</td>
              <td class="value" style="text-transform: uppercase;">${t.cadre || 'GAZETTED'}</td>
            </tr>
          </table>

          <div class="section-title">Qualifications & Health Credentials</div>
          <table class="profile-grid">
            <tr>
              <td class="label">Qualifications:</td>
              <td class="value">${t.qualification || '-'}</td>
              <td class="label" style="padding-left: 20px;">Subject in PG:</td>
              <td class="value">${t.subject || 'NA'}</td>
            </tr>
            <tr>
              <td class="label">B.Ed Completed:</td>
              <td class="value">${t.bed || 'NO'}</td>
              <td class="label" style="padding-left: 20px;">Deployment Status:</td>
              <td class="value">${t.if_deployed === 'in' ? 'Deployed In (from another school)' : t.if_deployed === 'out' ? 'Deployed Out (sent to another school)' : t.if_deployed === 'Yes' ? 'On Deployment' : 'No'}</td>
            </tr>
            <tr>
              <td class="label">Health/Security Grounds:</td>
              <td class="value" colspan="3">${t.health_issues || 'No'}</td>
            </tr>
          </table>

          ${t.customFields && Object.keys(t.customFields).length > 0 ? `
            <div class="section-title">Additional Details</div>
            <table class="profile-grid">
              ${Object.entries(t.customFields).map(([key, val]) => `
                <tr>
                  <td class="label">${key}:</td>
                  <td class="value">${val || '-'}</td>
                </tr>
              `).join('')}
            </table>
          ` : ''}

          <div class="section-title">Historical Posting Profile</div>
          <table class="posting-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">S.No</th>
                <th style="width: 45%;">Posting Office / Institution</th>
                <th style="width: 25%;">Designation</th>
                <th style="width: 12.5%; text-align: center;">From Date</th>
                <th style="width: 12.5%; text-align: center;">To Date</th>
              </tr>
            </thead>
            <tbody>
              ${postingsHtml}
            </tbody>
          </table>

          <table class="footer-signatures" style="width: 100%; margin-top: 60px; border-collapse: collapse;">
            <tr>
              <td style="text-align: left; border-top: 1px solid #94a3b8; width: 40%; padding-top: 8px; font-weight: bold; border-bottom: none;">Signature of Employee</td>
              <td style="width: 20%; border: none;"></td>
              <td style="text-align: right; border-top: 1px solid #94a3b8; width: 40%; padding-top: 8px; font-weight: bold; border-bottom: none;">Counter Signature of Principal<br/><span style="font-size: 9px; font-weight: normal; color: #64748b;">(Govt. HSS Shangus)</span></td>
            </tr>
          </table>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <base href="${window.location.origin}" />
          <title>Bulk Profiles - Govt HSS Shangus</title>
          <style>
            @media print {
              body { font-family: 'Segoe UI', sans-serif; color: #1e293b; line-height: 1.5; padding: 0; margin: 0; }
              .no-print { display: none; }
              .profile-page { page-break-after: always; break-after: page; padding: 20px; }
              .profile-page:last-child { page-break-after: avoid; break-after: avoid; }
            }
            body { font-family: 'Segoe UI', sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; background: #fff; }
            .profile-page { border-bottom: 2px dashed #cbd5e1; padding-bottom: 40px; margin-bottom: 40px; }
            @media print {
              .profile-page { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
            }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 3px double #0f766e; }
            .header-title { text-align: center; padding-bottom: 10px; }
            .header-title h1 { margin: 0; font-size: 20px; color: #961c14; text-transform: uppercase; font-family: 'Georgia', serif; }
            .header-title h2 { margin: 5px 0 0 0; font-size: 13px; color: #0f766e; letter-spacing: 1px; text-transform: uppercase; }
            
            .section-title { font-size: 13px; font-weight: bold; background: #f1f5f9; color: #0f766e; padding: 6px 12px; margin: 20px 0 10px 0; text-transform: uppercase; border-left: 4px solid #961c14; letter-spacing: 0.5px; }
            
            .profile-grid { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .profile-grid td { padding: 6px 10px; font-size: 12px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
            .label { font-weight: bold; color: #475569; width: 35%; }
            .value { color: #0f172a; }
            
            .photo-box { width: 130px; height: 160px; border: 2px dashed #cbd5e1; text-align: center; font-size: 10px; color: #94a3b8; display: flex; flex-direction: column; align-items: center; justify-content: center; float: right; margin-left: 20px; border-radius: 4px; overflow: hidden; background: #fafafa; }
            .photo-box img { width: 100%; height: 100%; object-fit: cover; }
            
            .posting-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            .posting-table th { background: #0f766e; color: white; padding: 8px; border: 1px solid #0f766e; text-align: left; text-transform: uppercase; font-size: 10px; }
            
            .footer-signatures { width: 100%; margin-top: 60px; border-collapse: collapse; }
            .footer-signatures td { font-size: 12px; font-weight: bold; width: 50%; padding-top: 50px; border: none; }
            
            .print-btn { display: inline-flex; align-items: center; background: #961c14; color: white; border: none; padding: 8px 16px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer; margin-bottom: 20px; transition: background 0.2s; }
            .print-btn:hover { background: #0f766e; }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: right;">
            <button onclick="window.print()" class="print-btn">Print Roster / Save PDF</button>
          </div>
          ${profilesHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Glow Effects in Background */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--teal-accent)]/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10s]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#961c14]/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8s]" />

        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes captcha-shake {
            0%, 100% { transform: rotate(-2deg) scale(1); }
            20% { transform: rotate(2deg) scale(1.05) translate(1px, -1px); }
            40% { transform: rotate(-3deg) scale(0.95) translate(-1px, 1px); }
            60% { transform: rotate(3deg) scale(1.03) translate(1px, 1px); }
            80% { transform: rotate(-1deg) scale(0.98) translate(-1px, -1px); }
          }
          .captcha-animate-shuffle {
            animation: captcha-shake 0.3s ease-in-out infinite;
          }
          .refresh-spin-hover:hover svg {
            transform: rotate(180deg);
          }
          .refresh-spin-hover svg {
            transition: transform 0.4s ease-in-out;
          }
        `}} />

        <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-9 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative z-10">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4 flex justify-center">
              <div className="w-16 h-16 rounded-full theme-accent-badge border flex items-center justify-center text-[var(--teal-accent)] transition-all duration-500 hover:scale-105 relative group">
                <div className="absolute inset-[-4px] rounded-full border border-[var(--teal-accent)]/20 animate-ping opacity-75 group-hover:opacity-100" />
                <Lock size={26} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-center font-title tracking-wider text-[var(--teal-accent)] uppercase">
              Govt. HSS Shangus
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 text-center">
              Administrative Portal
            </p>
          </div>

          {lockoutTimeLeft > 0 ? (
            <div className="bg-red-950/40 border border-red-500/30 text-red-400 p-5 rounded-xl text-center space-y-3">
              <AlertCircle size={28} className="mx-auto text-red-500 animate-bounce" />
              <h3 className="font-bold text-sm">Security Lockout Active</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Too many failed password attempts. The administrative console has been locked for security. Please try again after the timer expires.
              </p>
              <div className="font-mono text-xl font-extrabold text-red-400 tracking-widest bg-slate-950/60 py-2 rounded-lg border border-slate-850">
                {Math.floor(lockoutTimeLeft / 60)}:{(lockoutTimeLeft % 60).toString().padStart(2, '0')}
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Administrative Email</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 group-focus-within:text-[var(--teal-accent)] transition-colors">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="Enter admin email..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-[var(--teal-accent)] focus:ring-1 focus:ring-[var(--teal-accent)] transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Administrative Password</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 group-focus-within:text-[var(--teal-accent)] transition-colors">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-[var(--teal-accent)] focus:ring-1 focus:ring-[var(--teal-accent)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-505 hover:text-[var(--teal-accent)] transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Security CAPTCHA</label>
                <div className="flex items-center gap-2">
                  <div className={`relative select-none pointer-events-none bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-center overflow-hidden h-[42px] w-28 sm:w-32 flex-shrink-0 transition-transform ${isShuffling ? 'captcha-animate-shuffle' : ''}`}>
                    <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="captcha-grid" width="6" height="6" patternUnits="userSpaceOnUse">
                          <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#475569" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#captcha-grid)" />
                      <path d="M 0 12 Q 25 2, 50 18 T 100 8 T 150 20" fill="none" stroke="var(--teal-accent)" strokeWidth="1.2" />
                      <path d="M 0 25 Q 35 30, 70 10 T 140 18" fill="none" stroke="#961c14" strokeWidth="1" />
                    </svg>
                    <span className="font-mono text-base font-black tracking-widest text-slate-100 relative z-10 select-none filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" style={{ transform: 'rotate(-2deg)' }}>
                      {isShuffling ? shuffleValue : `${captcha.num1} ${captcha.operation} ${captcha.num2}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-[var(--teal-accent)] transition-all border border-slate-800 flex items-center justify-center h-[42px] w-[42px] active:scale-90 refresh-spin-hover"
                    title="Refresh CAPTCHA challenge"
                  >
                    <RefreshCw size={16} className={isShuffling ? 'animate-spin' : ''} />
                  </button>
                  <input
                    type="text"
                    required
                    placeholder="Answer..."
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="flex-grow min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-[var(--teal-accent)] focus:ring-1 focus:ring-[var(--teal-accent)] font-mono text-sm h-[42px] transition-all"
                  />
                </div>
              </div>

              {authError && (
                <div className="bg-red-950/50 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5 mt-5">
                <button
                  type="submit"
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[var(--teal-accent)] to-[var(--teal-accent-hover)] hover:brightness-110 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.97] shadow-lg shadow-teal-950/20"
                >
                  <Unlock size={14} className="flex-shrink-0" />
                  <span className="truncate">Unlock Console</span>
                </button>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] shadow-sm hover:shadow"
                >
                  <svg className="w-4 h-4 mr-0.5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.74 1.64 15.06 1 12 1 7.22 1 3.2 3.78 1.3 7.82l3.88 3A7.001 7.001 0 0 1 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46a5.54 5.54 0 0 1-2.4 3.64l3.73 2.9c2.18-2.01 3.7-4.98 3.7-8.69z" />
                    <path fill="#FBBC05" d="M5.18 10.82a6.99 6.99 0 0 1 0-4.24L1.3 3.58A11.96 11.96 0 0 0 0 12c0 3.12.8 6.05 2.21 8.62l3.78-3.04a6.98 6.98 0 0 1-.81-6.76z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.9c-1.03.69-2.35 1.1-4.23 1.1a7.001 7.001 0 0 1-6.82-5.04l-3.88 3A11.98 11.98 0 0 0 12 23z" />
                  </svg>
                  <span className="truncate text-slate-700">Google Sign-In</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-4 admin-portal-container">
      <style dangerouslySetInnerHTML={{ __html: `
        /* Theme-Aware Contrast Enhancements for Inputs */
        /* Light Theme overrides */
        .theme-light .admin-portal-container input:not([type="checkbox"]):not([type="radio"]), 
        .theme-light .admin-portal-container select, 
        .theme-light .admin-portal-container textarea {
          border-color: #64748b !important; /* slate-500 border for high contrast */
          color: #0f172a !important; /* slate-900 text */
          background-color: #ffffff !important; /* white background */
        }
        .theme-light .admin-portal-container input::placeholder, 
        .theme-light .admin-portal-container textarea::placeholder {
          color: #64748b !important;
          opacity: 0.85 !important;
        }


        /* Dark Themes overrides (default console styles) */
        .theme-dark .admin-portal-container input:not([type="checkbox"]):not([type="radio"]), 
        .theme-dark .admin-portal-container select, 
        .theme-dark .admin-portal-container textarea,
        .theme-royal .admin-portal-container input:not([type="checkbox"]):not([type="radio"]), 
        .theme-royal .admin-portal-container select, 
        .theme-royal .admin-portal-container textarea,
        .theme-forest .admin-portal-container input:not([type="checkbox"]):not([type="radio"]), 
        .theme-forest .admin-portal-container select, 
        .theme-forest .admin-portal-container textarea,
        .theme-midnight .admin-portal-container input:not([type="checkbox"]):not([type="radio"]), 
        .theme-midnight .admin-portal-container select, 
        .theme-midnight .admin-portal-container textarea {
          border-color: #475569 !important; /* slate-600 border */
          color: #ffffff !important;
          background-color: #020617 !important; /* deep dark background */
        }

        /* Default fallback (Dark theme active by default in Admin Console wrapper) */
        .admin-portal-container input:not([type="checkbox"]):not([type="radio"]), 
        .admin-portal-container select, 
        .admin-portal-container textarea {
          border-color: #475569 !important;
          color: #ffffff !important;
          background-color: #020617 !important;
        }
        
        .admin-portal-container input:not([type="checkbox"]):not([type="radio"]):focus, 
        .admin-portal-container select:focus, 
        .admin-portal-container textarea:focus {
          border-color: #f97316 !important; /* orange-500 active */
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2) !important;
        }
        .admin-portal-container input::placeholder, 
        .admin-portal-container textarea::placeholder {
          color: #94a3b8 !important;
          opacity: 0.85 !important;
        }
        
        /* High Contrast Labels based on active Theme */
        .theme-light .admin-portal-container label {
          color: #0f172a !important; /* slate-900 for dark text in light theme */
          font-weight: 800 !important;
        }
        .theme-dark .admin-portal-container label,
        .theme-royal .admin-portal-container label,
        .theme-forest .admin-portal-container label,
        .theme-midnight .admin-portal-container label {
          color: #f1f5f9 !important; /* slate-100 for light text in dark themes */
          font-weight: 700 !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        /* Default label fallback */
        .admin-portal-container label {
          color: #cbd5e1 !important;
          font-weight: 700 !important;
        }

        /* Enhancing Table Header and Border Contrast */
        /* Light Theme Tables */
        .theme-light .admin-portal-container table {
          border: 1px solid #94a3b8 !important;
        }
        .theme-light .admin-portal-container th, 
        .theme-light .admin-portal-container td {
          border-color: #cbd5e1 !important; /* slate-300 */
          color: #0f172a !important; /* slate-900 */
        }
        .theme-light .admin-portal-container thead tr {
          background-color: #f1f5f9 !important; /* slate-100 */
          border-bottom: 2px solid #94a3b8 !important;
        }
        .theme-light .admin-portal-container thead th {
          color: #c2410c !important; /* high-contrast dark orange */
        }

        /* Dark Themes Tables */
        .admin-portal-container table {
          border: 1px solid #475569 !important;
        }
        .admin-portal-container th, 
        .admin-portal-container td {
          border-color: #334155 !important; /* slate-700 */
          color: #f1f5f9 !important;
        }
        .admin-portal-container thead tr {
          background-color: #0f172a !important;
          border-bottom: 2px solid #475569 !important;
        }
        .admin-portal-container thead th {
          color: #f97316 !important;
        }

        /* Button Contrast Enhancements */
        /* Secondary buttons and outline buttons in dark themes */
        .admin-portal-container button[class*="bg-slate-900"],
        .admin-portal-container button[class*="bg-slate-800"],
        .admin-portal-container button[class*="bg-red-950/30"],
        .admin-portal-container button[class*="border-slate-700"],
        .admin-portal-container button[class*="border-slate-800"] {
          border-color: #64748b !important; /* slate-500 */
          color: #f1f5f9 !important;
          background-color: #1e293b !important; /* base slate-800 */
        }
        .admin-portal-container button[class*="bg-slate-900"]:hover,
        .admin-portal-container button[class*="bg-slate-800"]:hover,
        .admin-portal-container button[class*="bg-red-950/30"]:hover {
          background-color: #334155 !important; /* hover slate-700 */
          border-color: #94a3b8 !important; /* hover slate-400 */
        }

        /* Secondary buttons and outline buttons in light theme */
        .theme-light .admin-portal-container button[class*="bg-slate-900"],
        .theme-light .admin-portal-container button[class*="bg-slate-800"],
        .theme-light .admin-portal-container button[class*="border-slate-700"],
        .theme-light .admin-portal-container button[class*="border-slate-800"] {
          border-color: #64748b !important;
          color: #0f172a !important;
          background-color: #f1f5f9 !important;
        }
        .theme-light .admin-portal-container button[class*="bg-slate-900"]:hover,
        .theme-light .admin-portal-container button[class*="bg-slate-800"]:hover {
          background-color: #e2e8f0 !important;
          border-color: #475569 !important;
        }

        /* Fix hover text visibility inside lists with solid dark hover backgrounds */
        .admin-portal-container .hover\:bg-slate-900:hover,
        .admin-portal-container .hover\:bg-slate-900:hover * {
          color: #ffffff !important;
        }
      `}} />
      <div className="max-w-6xl mx-auto px-4">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-2xl font-bold font-title tracking-wider text-orange-400">Admin Console</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">Govt. Higher Secondary School Shangus Control Center</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {firebaseUser ? (
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-900/40 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5" title={`Signed in to Firebase as ${firebaseUser.email}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sync Active
              </span>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 w-full sm:w-auto transition-colors"
              >
                Sign in with Google to Sync
              </button>
            )}
            {/* Direct filesystem sync trigger */}
            <button
              onClick={handleLinkFolder}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border w-full sm:w-auto ${folderHandle ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-900/10' : 'bg-slate-900 border-slate-700 hover:border-orange-500/50 hover:bg-slate-800 text-slate-200'}`}
              title="Select your public/slides/ folder on your computer to auto-write files directly."
            >
              <FolderOpen size={14} />
              {folderHandle ? 'Slides Linked' : 'Link slides/ folder'}
            </button>
            <button
              type="button"
              onClick={() => handleSaveToLocalStorage()}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 border border-emerald-400 transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
            >
              <Save size={14} className="stroke-[2.5px]" />
              Apply & Save
            </button>
            <button
              onClick={() => handleLogout()}
              className="px-3.5 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/50 border border-red-900/50 hover:border-red-800 text-red-400 text-xs font-bold w-full sm:w-auto flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Logout from Google Sync and Lock the Console"
            >
              <LogOut size={14} className="stroke-[2.5px]" />
              Logout
            </button>
          </div>
        </div>

        {/* Save & Sync Inline Bar */}
        {saveProgress !== null && (
          <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-3 mb-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 relative overflow-hidden">
            {/* Glowing top line indicating active process */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-500 via-yellow-500 to-emerald-500 animate-pulse" />
            
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
              {/* Left Side: status info & compact checklist dots */}
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <div className="flex items-center gap-2">
                  {!savePopupResult ? (
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin flex-shrink-0" />
                  ) : savePopupResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-100">
                    {!savePopupResult ? 'Saving Changes...' : savePopupResult.title}
                  </span>
                </div>
                
                <span className="text-[10px] text-slate-500 hidden sm:inline">|</span>
                
                {/* Slim Checklist inline */}
                <div className="flex flex-wrap items-center gap-2">
                  {saveStages.map((stage) => {
                    let color = "text-slate-500 border-slate-800 bg-slate-950/40";
                    let dotColor = "bg-slate-600";
                    if (stage.status === 'loading') {
                      color = "text-orange-400 border-orange-500/30 bg-orange-950/20 animate-pulse";
                      dotColor = "bg-orange-400 animate-ping";
                    } else if (stage.status === 'success') {
                      color = "text-emerald-400 border-emerald-500/30 bg-emerald-950/20";
                      dotColor = "bg-emerald-400";
                    } else if (stage.status === 'error') {
                      color = "text-red-400 border-red-500/30 bg-red-950/20 font-bold";
                      dotColor = "bg-red-400";
                    }
                    
                    return (
                      <span 
                        key={stage.id} 
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 transition-all ${color}`}
                        title={stage.label + (stage.details ? `: ${stage.details}` : '')}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <span>{stage.label.split(' ')[0]}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: Progress Bar & Dismiss/Retry */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <div className="flex-grow md:w-48">
                  <div className="w-full h-2 bg-slate-950 border border-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 via-yellow-500 to-emerald-500 transition-all duration-300 ease-out"
                      style={{ width: `${saveProgress}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-black text-slate-100 font-mono w-8 text-right">{saveProgress}%</span>
                
                {savePopupResult && (
                  <div className="flex items-center gap-1.5 ml-2">
                    {!savePopupResult.success && (
                      <button
                        onClick={() => {
                          setSaveProgress(null);
                          setSavePopupResult(null);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold transition-all"
                      >
                        Dismiss
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (savePopupResult.success) {
                          setSaveProgress(null);
                          setSavePopupResult(null);
                        } else {
                          handleSaveToLocalStorage();
                        }
                      }}
                      className={`px-3 py-1 rounded text-[10px] font-extrabold transition-all ${savePopupResult.success ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-400' : 'bg-red-600 hover:bg-red-500 text-white border border-red-500'}`}
                    >
                      {savePopupResult.success ? 'OK' : 'Retry'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Detailed message/error if present */}
            {savePopupResult && savePopupResult.message && (
              <div className="mt-2 text-[10px] text-slate-300 bg-slate-950/60 border border-slate-800 rounded p-2 font-medium leading-relaxed">
                {savePopupResult.message}
              </div>
            )}
          </div>
        )}

        {/* Global Notifications */}
        {saveSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-200 text-emerald-400 p-4 rounded-xl text-sm mb-4 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-3 duration-300">
            <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* Data Integrity Issues Notifications */}
        {dataIssues.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-500/40 text-amber-300 p-3 rounded-xl text-xs mb-4 animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex justify-between items-start gap-2 cursor-pointer" onClick={() => setShowIssuesList(!showIssuesList)}>
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400 flex-shrink-0 animate-pulse" />
                <div>
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-300">Data Consistency Alerts ({dataIssues.length})</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Issues found in your roster or notice board.
                    {Object.keys(facultyIssueMap).length > 0 && (
                      <span className="ml-1 text-amber-400/80">
                        Affected rows are <span className="font-bold">highlighted</span> in the Faculty Directory tab.
                      </span>
                    )}
                    {' '}Click to {showIssuesList ? 'collapse' : 'view details'}.
                  </p>
                </div>
              </div>
              <button type="button" className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline flex-shrink-0">
                {showIssuesList ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            {showIssuesList && (
              <div className="mt-2.5 space-y-1.5 border-t border-amber-500/20 pt-2.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {dataIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border flex-shrink-0 mt-0.5 ${issue.type === 'error' ? 'bg-red-950 text-red-400 border-red-900/40' : 'badge-status-update'}`}>
                      {issue.category}
                    </span>
                    <span className="text-slate-300 font-medium">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 mb-4 overflow-x-auto custom-scrollbar pb-1.5 gap-2">
          {[
            { id: 'admissions', label: 'Admissions & Fees', icon: FileText },
            { id: 'notices', label: 'Latest Notices', icon: RefreshCw },
            { id: 'faculty', label: 'Faculty Directory', icon: Users },
            { id: 'slideshow', label: 'Home Slideshow', icon: Image },
            { id: 'tax', label: 'Tax Calculator', icon: Calculator },
            { id: 'export', label: 'Export files', icon: Download },
            { id: 'pages_cms', label: 'Page CMS', icon: FolderOpen },
            { id: 'admins', label: 'Admin Management', icon: Settings }
          ].filter(tab => allowedTabs.includes(tab.id)).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  sessionStorage.setItem('activeAdminTab', tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all flex-shrink-0 ${active ? 'border-orange-500 text-orange-400 bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Console Body */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
            Loading configuration data...
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 md:p-5 shadow-xl">

            {/* TAB 1: ADMISSIONS AND FEES */}
            {activeTab === 'admissions' && allowedTabs.includes('admissions') && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Global admissions open/close */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Global Enrollment System</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Enable or disable registration online across all streams and classes.</p>
                  </div>
                  <ToggleSwitch
                    checked={settings.globalAdmissionsClosed}
                    onChange={handleGlobalToggle}
                    labelLeft="Open"
                    labelRight="Closed"
                  />
                </div>

                {/* Class admissions flags */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">Class-Wise Admission Flags</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['9th', '10th', '11th', '12th'].map((cls) => {
                      const isClosed = settings.globalAdmissionsClosed || settings.admissionsClosed[cls];
                      return (
                        <div key={cls} className="bg-slate-900/30 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-300 whitespace-nowrap">{cls} Class</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${isClosed ? 'bg-red-950 text-red-400 border border-red-900' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'}`}>
                              {isClosed ? 'Closed' : 'Open'}
                            </span>
                            <ToggleSwitch
                              checked={settings.admissionsClosed[cls]}
                              onChange={() => handleClassToggle(cls)}
                              disabled={settings.globalAdmissionsClosed}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Fee structure configuration */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">Fee Structure Configuration (INR)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Science Stream Card */}
                    <div className="bg-slate-900/30 p-3.5 rounded-xl border border-teal-500/20 shadow-sm relative overflow-hidden transition-all hover:border-teal-500/40">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="p-1 rounded-md bg-teal-500/10 text-teal-500">
                          <Users size={14} className="stroke-[2.5px]" />
                        </span>
                        <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">Science Stream</h4>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { key: '11th_science_boys', label: '11th Science (Boys)' },
                          { key: '11th_science_girls', label: '11th Science (Girls)' },
                          { key: '12th_science_boys', label: '12th Science (Boys)' },
                          { key: '12th_science_girls', label: '12th Science (Girls)' }
                        ].map((feeItem) => (
                          <div key={feeItem.key} className="flex justify-between items-center gap-3 text-xs">
                            <span className="text-slate-400 font-medium">{feeItem.label}</span>
                            <div className="flex items-center bg-slate-950 border border-teal-500/35 rounded px-2 w-28 transition-colors focus-within:border-teal-500">
                              <span className="text-[10px] text-teal-500/70 font-bold mr-1">Rs.</span>
                              <input
                                type="number"
                                value={settings.fees[feeItem.key] || 0}
                                onChange={(e) => handleFeeChange(feeItem.key, e.target.value)}
                                className="w-full bg-transparent border-none py-1 text-right text-xs font-mono text-white focus:outline-none focus:ring-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Humanities Stream Card */}
                    <div className="bg-slate-900/30 p-3.5 rounded-xl border border-amber-500/20 shadow-sm relative overflow-hidden transition-all hover:border-amber-500/40">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                          <BookOpen size={14} className="stroke-[2.5px]" />
                        </span>
                        <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">Humanities Stream</h4>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { key: '11th_humanities_boys', label: '11th Humanities (Boys)' },
                          { key: '11th_humanities_girls', label: '11th Humanities (Girls)' },
                          { key: '12th_humanities_boys', label: '12th Humanities (Boys)' },
                          { key: '12th_humanities_girls', label: '12th Humanities (Girls)' }
                        ].map((feeItem) => (
                          <div key={feeItem.key} className="flex justify-between items-center gap-3 text-xs">
                            <span className="text-slate-400 font-medium">{feeItem.label}</span>
                            <div className="flex items-center bg-slate-950 border border-amber-500/35 rounded px-2 w-28 transition-colors focus-within:border-amber-500">
                              <span className="text-[10px] text-amber-500/70 font-bold mr-1">Rs.</span>
                              <input
                                type="number"
                                value={settings.fees[feeItem.key] || 0}
                                onChange={(e) => handleFeeChange(feeItem.key, e.target.value)}
                                className="w-full bg-transparent border-none py-1 text-right text-xs font-mono text-white focus:outline-none focus:ring-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Secondary Classes Card */}
                    <div className="bg-slate-900/30 p-3.5 rounded-xl border border-indigo-500/20 shadow-sm relative overflow-hidden transition-all hover:border-indigo-500/40">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-500">
                          <Plus size={14} className="stroke-[2.5px]" />
                        </span>
                        <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">Secondary Classes</h4>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { key: '9th', label: '9th Class Subjects' },
                          { key: '10th', label: '10th Class Subjects' }
                        ].map((feeItem) => (
                          <div key={feeItem.key} className="flex justify-between items-center gap-3 text-xs">
                            <span className="text-slate-400 font-medium">{feeItem.label}</span>
                            <div className="flex items-center bg-slate-950 border border-indigo-500/35 rounded px-2 w-28 transition-colors focus-within:border-indigo-500">
                              <span className="text-[10px] text-indigo-500/70 font-bold mr-1">Rs.</span>
                              <input
                                type="number"
                                value={settings.fees[feeItem.key] || 0}
                                onChange={(e) => handleFeeChange(feeItem.key, e.target.value)}
                                className="w-full bg-transparent border-none py-1 text-right text-xs font-mono text-white focus:outline-none focus:ring-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Media Links Configuration */}
                <div className="bg-slate-900/30 p-3.5 rounded-xl border border-indigo-500/20 shadow-sm relative overflow-hidden transition-all hover:border-indigo-500/40">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-500">
                      <BookOpen size={14} className="stroke-[2.5px]" />
                    </span>
                    <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">Social Media Links</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {['facebook', 'youtube', 'twitter', 'instagram'].map((platform) => {
                      const value = (settings.socialLinks && settings.socialLinks[platform]) || '#';
                      return (
                        <div key={platform} className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {platform === 'twitter' ? 'Twitter / X Link' : `${platform.charAt(0).toUpperCase() + platform.slice(1)} Link`}
                          </label>
                          <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 transition-colors focus-within:border-indigo-500">
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings(s => ({
                                  ...s,
                                  socialLinks: {
                                    ...s.socialLinks,
                                    [platform]: val || '#'
                                  }
                                }));
                              }}
                              className="w-full bg-transparent border-none py-1.5 text-xs text-white focus:outline-none focus:ring-0"
                              placeholder="e.g. # or full URL"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>


              </div>
            )}

            {/* TAB 2: LATEST NOTICES */}
            {activeTab === 'notices' && allowedTabs.includes('notices') && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Latest Notices Configuration</h3>
                    <p className="text-[11px] text-slate-400">Add, edit, or delete items on the school's dynamic announcement board.</p>
                  </div>
                </div>

                {/* Global default new days setting card */}
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">Global Notice Expiry Settings</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Determine how many days a notice is considered "NEW" on the homepage and notice board.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-0.5">
                    <span className="text-[10px] text-slate-400 font-bold">Default Days:</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={settings.defaultNewNoticeDays !== undefined ? settings.defaultNewNoticeDays : 7}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setSettings(s => ({ ...s, defaultNewNoticeDays: isNaN(val) ? 7 : val }));
                      }}
                      className="w-12 bg-transparent border-none text-center text-xs font-mono text-white focus:outline-none focus:ring-0"
                    />
                  </div>
                </div>

                {/* Add new notice form */}
                <div className="bg-slate-900/30 p-1.5 rounded-lg border border-slate-800 flex flex-col md:flex-row gap-1.5 items-stretch md:items-end">
                  <div className="w-full md:w-32 flex-shrink-0">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Date</label>
                    <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded focus-within:border-teal-500 transition-colors w-full h-[28px]">
                      <input
                        type="text"
                        placeholder="e.g. Nov 23"
                        value={newNotice.date}
                        onChange={(e) => setNewNotice({ ...newNotice, date: e.target.value })}
                        className="w-full bg-transparent border-none px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const dateEl = e.currentTarget.parentElement.querySelector('input[type="date"]');
                          if (dateEl) dateEl.showPicker();
                        }}
                        className="p-1 text-slate-400 hover:text-orange-400 transition-colors mr-0.5"
                        title="Choose date"
                      >
                        <Calendar size={12} />
                      </button>
                      <input
                        type="date"
                        onChange={(e) => {
                          if (e.target.value) {
                            setNewNotice({ ...newNotice, date: formatDateToShort(e.target.value) });
                          }
                        }}
                        className="absolute w-0 h-0 opacity-0 pointer-events-none"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Title</label>
                    <input
                      type="text"
                      placeholder="Notice Title Description"
                      value={newNotice.title}
                      onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Link (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. /admissions, https://jkbose.nic.in, or #"
                      value={newNotice.link}
                      onChange={(e) => setNewNotice({ ...newNotice, link: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="w-full md:w-20 flex-shrink-0">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">New Days</label>
                    <input
                      type="number"
                      placeholder="Default"
                      value={newNotice.days || ''}
                      onChange={(e) => setNewNotice({ ...newNotice, days: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500 text-center"
                    />
                  </div>
                  <button
                    onClick={handleAddNotice}
                    className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1 w-full md:w-auto flex-shrink-0 border border-orange-400 transition-all hover:scale-[1.02] active:scale-[0.98] h-[28px]"
                  >
                    <Plus size={12} />
                    Add Notice
                  </button>
                </div>

                {/* Notice Preview Section */}
                <div className="bg-slate-900/30 p-2.5 rounded-lg border border-slate-800 space-y-2.5">
                  <h3 className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">Live Preview</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Home Page Sidebar Preview */}
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 mb-1.5">Home Page (Sidebar)</h4>
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2.5 w-full">
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] font-bold text-slate-400 mt-1 w-14 flex-shrink-0 whitespace-nowrap">
                            {newNotice.date || 'Jun 12'}
                          </span>
                          <div className="flex-1 min-w-0 relative">
                            {/* Single-line text with truncation */}
                            <span className="text-sm font-medium text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis block border-b border-dashed border-orange-500">
                              {newNotice.title || 'Your Notice Title Here'}
                            </span>
                          </div>
                        </div>
                        {/* Vertical Dotted Line Indicator */}
                        <div className="mt-1.5 text-[9px] text-orange-500 font-bold flex items-center gap-2">
                          <span>┃</span>
                          <span>← Text beyond this will wrap to a new line</span>
                        </div>
                      </div>
                    </div>

                    {/* Notice Board Page Preview */}
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 mb-1.5">Notice Board Page</h4>
                      <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded bg-teal-100/40 border border-teal-100 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-[8px] font-bold text-teal-800 uppercase tracking-tight text-center whitespace-nowrap">
                              {newNotice.date || 'Jun 12'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 relative">
                            {/* Single-line text with truncation */}
                            <h4 className="font-bold text-slate-800 text-sm leading-snug whitespace-nowrap overflow-hidden text-ellipsis block border-b border-dashed border-orange-500">
                              {newNotice.title || 'Your Notice Title Here'}
                            </h4>
                          </div>
                        </div>
                        {/* Vertical Dotted Line Indicator */}
                        <div className="mt-1.5 text-[9px] text-orange-500 font-bold flex items-center gap-2">
                          <span>┃</span>
                          <span>← Text beyond this will wrap to a new line</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    The dashed line shows the maximum text that fits on a single line.
                  </p>
                </div>

                {/* Notices List Table */}
                <div className="overflow-x-auto custom-scrollbar pb-1 border border-slate-800 rounded-lg min-w-0">
                  <table className="w-full text-xs text-left border-collapse" style={{ minWidth: '480px' }}>
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[9px] font-bold">
                        <th className="p-1 px-1.5 w-24">Date</th>
                        <th className="p-1 px-1.5">Notice Title</th>
                        <th className="p-1 px-1.5 w-48">Link</th>
                        <th className="p-1 px-1.5 w-20 text-center">New Days</th>
                        <th className="p-1 px-1.5 w-24 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {notices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-3 text-center text-slate-500 italic text-[11px]">No notices configured. Add some above.</td>
                        </tr>
                      ) : (
                        notices.map((n, i) => {
                          const isEditing = editingNoticeIdx === i;
                          return (
                            <tr key={i} className="hover:bg-slate-900/20">
                              {isEditing ? (
                                <>
                                  <td className="p-1 w-32">
                                    <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded focus-within:border-teal-500 transition-colors w-full h-[28px]">
                                      <input
                                        type="text"
                                        value={editNoticeData.date}
                                        onChange={(e) => setEditNoticeData({ ...editNoticeData, date: e.target.value })}
                                        className="w-full bg-transparent border-none px-1.5 py-1 text-xs text-slate-200 font-semibold focus:outline-none focus:ring-0"
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          const dateEl = e.currentTarget.parentElement.querySelector('input[type="date"]');
                                          if (dateEl) dateEl.showPicker();
                                        }}
                                        className="p-1 text-slate-400 hover:text-orange-400 transition-colors mr-0.5"
                                        title="Choose date"
                                      >
                                        <Calendar size={12} />
                                      </button>
                                      <input
                                        type="date"
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            setEditNoticeData({ ...editNoticeData, date: formatDateToShort(e.target.value) });
                                          }
                                        }}
                                        className="absolute w-0 h-0 opacity-0 pointer-events-none"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-1">
                                    <input
                                      type="text"
                                      value={editNoticeData.title}
                                      onChange={(e) => setEditNoticeData({ ...editNoticeData, title: e.target.value })}
                                      className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                    />
                                    {/* Small preview indicator */}
                                    <div className="mt-1 text-[9px] text-orange-500 font-mono truncate border-t border-dashed border-orange-500 pt-1">
                                      {editNoticeData.title || 'Preview...'}
                                    </div>
                                  </td>
                                  <td className="p-1">
                                    <input
                                      type="text"
                                      value={editNoticeData.link}
                                      onChange={(e) => setEditNoticeData({ ...editNoticeData, link: e.target.value })}
                                      className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-orange-500"
                                    />
                                  </td>
                                  <td className="p-1 w-20">
                                    <input
                                      type="number"
                                      value={editNoticeData.days || ''}
                                      onChange={(e) => setEditNoticeData({ ...editNoticeData, days: e.target.value })}
                                      placeholder="Default"
                                      className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 text-center focus:outline-none focus:border-orange-500"
                                    />
                                  </td>
                                  <td className="p-1 text-center flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => saveNoticeEdit(i)}
                                      className="p-1 rounded bg-emerald-950 text-emerald-400 hover:bg-emerald-900 transition-colors"
                                      title="Save"
                                    >
                                      <Check size={13} />
                                    </button>
                                    <button
                                      onClick={cancelNoticeEdit}
                                      className="p-1 rounded bg-slate-950 text-slate-400 hover:bg-slate-900 transition-colors"
                                      title="Cancel"
                                    >
                                      <X size={13} />
                                    </button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="p-1 px-1.5 font-semibold text-slate-200">{n.date}</td>
                                  <td className="p-1 px-1.5 text-slate-200">{n.title}</td>
                                  <td className="p-1 px-1.5 text-slate-500 truncate max-w-xs font-mono">{n.link || '#'}</td>
                                  <td className="p-1 px-1.5 text-center text-slate-400 font-mono">{n.days !== undefined && n.days !== '' ? `${n.days}d` : 'Default'}</td>
                                  <td className="p-1 px-1.5 text-center flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => startEditNotice(i)}
                                      className="p-1 rounded text-orange-400 hover:bg-orange-950/40 hover:text-orange-300 transition-colors"
                                      title="Edit inline"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteNotice(i)}
                                      className="p-1 rounded text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2b: HOME SLIDESHOW */}
            {activeTab === 'slideshow' && allowedTabs.includes('slideshow') && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Homepage Slideshow Editor</h3>
                  <p className="text-[11px] text-slate-400">Manage banner images, heading titles, and captions for the homepage slideshow.</p>
                </div>

                {/* Add new slide form */}
                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-800 space-y-1.5">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-orange-400">Add New Slide</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Slide Heading (Title)</label>
                      <input
                        type="text"
                        placeholder="e.g. Welcome to HSS Shangus"
                        value={newSlide.title}
                        onChange={(e) => setNewSlide({ ...newSlide, title: e.target.value })}
                        className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Slide Caption</label>
                      <input
                        type="text"
                        placeholder="e.g. Nurturing minds, shaping futures"
                        value={newSlide.caption}
                        onChange={(e) => setNewSlide({ ...newSlide, caption: e.target.value })}
                        className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Upload Image (Max 500KB)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handleSlidePhotoFileChange(e, 'new')}
                          className="w-full text-slate-400 file:bg-slate-950 file:border file:border-slate-800 file:text-[10px] file:text-slate-300 file:px-2 file:py-1 file:rounded file:hover:bg-slate-800 text-[11px]"
                        />
                      </div>
                      {newSlidePhotoFile && (
                        <div className="mt-1 text-[9px] text-slate-400 flex items-center justify-between">
                          <span>File: {newSlidePhotoFile.name} ({Math.round(newSlidePhotoFile.size / 1024)}KB)</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewSlidePhotoFile(null);
                              setNewSlidePhotoName('');
                            }}
                            className="text-red-400 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={handleAddSlide}
                      className="px-3 py-1.5 rounded bg-orange-500 hover:bg-orange-400 text-slate-950 font-extrabold text-xs flex items-center gap-1 border border-orange-400 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Plus size={12} />
                      Add Slide
                    </button>
                  </div>
                </div>

                {/* Slides List Table */}
                <div className="overflow-x-auto custom-scrollbar pb-1 border border-slate-800 rounded-lg min-w-0">
                  <table className="w-full text-xs text-left border-collapse" style={{ minWidth: '600px' }}>
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[9px] font-bold">
                        <th className="p-1.5 px-2.5 w-16 text-center">Order</th>
                        <th className="p-1.5 px-2.5 w-24">Image Preview</th>
                        <th className="p-1.5 px-2.5">Slide Title (Heading)</th>
                        <th className="p-1.5 px-2.5">Slide Caption</th>
                        <th className="p-1.5 px-2.5 w-32 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {slides.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-3 text-center text-slate-500 italic text-[11px]">No slides configured. Add some above or sync from site configuration.</td>
                        </tr>
                      ) : (
                        slides.map((s, idx) => {
                          const isEditing = editingSlideIdx === idx;
                          return (
                            <tr key={idx} className="hover:bg-slate-900/20">
                              <td className="p-1.5 px-2.5 text-center font-bold text-slate-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="p-1.5 px-2.5">
                                <div className="w-20 h-10 rounded border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center">
                                  {s.image ? (
                                    <img
                                      src={s.image}
                                      alt={`Preview slide ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <span className="text-[8px] text-slate-600 uppercase tracking-widest font-bold">No Image</span>
                                  )}
                                </div>
                              </td>
                              {isEditing ? (
                                <>
                                  <td className="p-1.5 px-2.5">
                                    <input
                                      type="text"
                                      value={editSlideData.title}
                                      onChange={(e) => setEditSlideData({ ...editSlideData, title: e.target.value })}
                                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                    />
                                  </td>
                                  <td className="p-1.5 px-2.5">
                                    <input
                                      type="text"
                                      value={editSlideData.caption}
                                      onChange={(e) => setEditSlideData({ ...editSlideData, caption: e.target.value })}
                                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                    />
                                    <div className="mt-1">
                                      <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Replace Image (Optional)</label>
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(e) => handleSlidePhotoFileChange(e, 'edit')}
                                        className="w-full text-slate-500 file:bg-slate-950 file:border file:border-slate-800 file:text-[9px] file:text-slate-400 file:px-1.5 file:py-0.5 file:rounded text-[10px]"
                                      />
                                      {editSlidePhotoFile && (
                                        <div className="text-[8px] text-slate-400 mt-0.5">
                                          Ready: {editSlidePhotoFile.name}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-1.5 px-2.5 text-center flex items-center justify-center gap-1.5 mt-2">
                                    <button
                                      type="button"
                                      onClick={() => saveSlideEdit(idx)}
                                      className="p-1 rounded bg-emerald-950 text-emerald-400 hover:bg-emerald-900 transition-colors"
                                      title="Save Changes"
                                    >
                                      <Check size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelSlideEdit}
                                      className="p-1 rounded bg-slate-950 text-slate-400 hover:bg-slate-900 transition-colors"
                                      title="Cancel"
                                    >
                                      <X size={13} />
                                    </button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="p-1.5 px-2.5 font-bold text-slate-200">
                                    {s.title || <span className="italic text-slate-600 text-[10px]">No Heading</span>}
                                  </td>
                                  <td className="p-1.5 px-2.5 text-slate-300">
                                    {s.caption || <span className="italic text-slate-600 text-[10px]">No Caption</span>}
                                  </td>
                                  <td className="p-1.5 px-2.5 text-center flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => moveSlideUp(idx)}
                                      disabled={idx === 0}
                                      className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 transition-colors"
                                      title="Move Up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveSlideDown(idx)}
                                      disabled={idx === slides.length - 1}
                                      className="p-1 rounded text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 transition-colors"
                                      title="Move Down"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEditSlide(idx)}
                                      className="p-1 rounded text-orange-400 hover:bg-orange-950/40 hover:text-orange-300 transition-colors"
                                      title="Edit Slide Text/Image"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSlide(idx)}
                                      className="p-1 rounded text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
                                      title="Delete Slide"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: FACULTY DIRECTORY */}
            {activeTab === 'faculty' && allowedTabs.includes('faculty') && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-1.5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Faculty & Staff Directory Editor</h3>
                    <p className="text-[11px] text-slate-400">Configure cards, department settings, and contacts inside the dynamic directory.</p>
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleDownloadCSVTemplate}
                      className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 border border-amber-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow w-full sm:w-auto"
                      title="Download the standard CSV template with headers and a sample row"
                    >
                      <FileSpreadsheet size={13} />
                      Get CSV Template
                    </button>
                    <button
                      onClick={() => document.getElementById('csv-import-input').click()}
                      className="px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 border border-blue-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow w-full sm:w-auto"
                      title="Upload a CSV roster of employees"
                    >
                      <Upload size={13} />
                      Import CSV
                    </button>
                    <input
                      id="csv-import-input"
                      type="file"
                      accept=".csv"
                      onChange={handleCSVImport}
                      className="hidden"
                    />
                    <button
                      onClick={handleCSVExport}
                      className="px-3 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 border border-teal-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow w-full sm:w-auto"
                      title="Choose employees and columns, then download a custom CSV roster"
                    >
                      <Download size={13} />
                      Export CSV
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBulkPrintNames(faculty.map(t => t.name));
                        setBulkPrintSearch('');
                        setBulkPrintDept('All');
                        setShowBulkPrintModal(true);
                      }}
                      className="px-3 py-1.5 rounded bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 border border-purple-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow w-full sm:w-auto"
                      title="Export multiple profile sheets as PDF at once"
                    >
                      <Printer size={13} />
                      Bulk PDF / Print
                    </button>
                  </div>
                </div>

                {/* Add new faculty form */}
                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Mr. Sheikh Gulfam"
                        value={newTeacher.name}
                        onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Designation</label>
                      <select
                        value={STANDARD_DESIGNATIONS.includes(newTeacher.designation) ? newTeacher.designation : 'Other'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewTeacher({ ...newTeacher, designation: val === 'Other' ? '' : val });
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                      >
                        <option value="">Select Designation</option>
                        {STANDARD_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        <option value="Other">Other...</option>
                      </select>
                      {!STANDARD_DESIGNATIONS.includes(newTeacher.designation) && (
                        <input
                          type="text"
                          placeholder="Custom Designation"
                          value={newTeacher.designation}
                          onChange={(e) => setNewTeacher({ ...newTeacher, designation: e.target.value })}
                          className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Subject</label>
                      <select
                        value={STANDARD_SUBJECTS.includes(newTeacher.subject) ? newTeacher.subject : (newTeacher.subject ? 'Other' : '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewTeacher({ ...newTeacher, subject: val === 'Other' ? ' ' : val });
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                      >
                        <option value="">Select Subject</option>
                        {STANDARD_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="Other">Other...</option>
                      </select>
                      {newTeacher.subject && !STANDARD_SUBJECTS.includes(newTeacher.subject) && (
                        <input
                          type="text"
                          placeholder="Custom Subject"
                          value={newTeacher.subject.trim()}
                          onChange={(e) => setNewTeacher({ ...newTeacher, subject: e.target.value })}
                          className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Department</label>
                      <select
                        value={STANDARD_DEPTS.includes(newTeacher.department) ? newTeacher.department : 'Other'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Other') {
                            setNewTeacher({ ...newTeacher, department: '' });
                          } else {
                            setNewTeacher({ ...newTeacher, department: val });
                          }
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                      >
                        <option value="Administration">Administration</option>
                        <option value="Science">Science</option>
                        <option value="Humanities">Humanities</option>
                        <option value="Science/Humanities">Science/Humanities</option>
                        <option value="Secondary">Secondary (9th-10th)</option>
                        <option value="MTS">MTS (Multi-Tasking Staff)</option>
                        <option value="Other">Other...</option>
                      </select>
                      {!STANDARD_DEPTS.includes(newTeacher.department) && (
                        <input
                          type="text"
                          placeholder="Enter department name..."
                          value={newTeacher.department}
                          onChange={(e) => setNewTeacher({ ...newTeacher, department: e.target.value })}
                          className="w-full mt-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Email Address</label>
                      <input
                        type="email"
                        placeholder="e.g. example@gmail.com"
                        value={newTeacher.email}
                        onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 gap-1.5 ${newTeacher.hidden ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Mobile No</label>
                      <input
                        type="text"
                        placeholder="e.g. +91-7006XXXXXX"
                        value={newTeacher.mobile}
                        onChange={(e) => setNewTeacher({ ...newTeacher, mobile: e.target.value })}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Photo Upload</label>
                      <div className="flex h-[23px] items-center">
                        <label className={`w-full h-full rounded text-slate-950 text-[9px] font-extrabold cursor-pointer transition-all flex items-center justify-center border whitespace-nowrap hover:scale-[1.02] active:scale-[0.98] ${newTeacherPhotoFile ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400' : 'bg-orange-500 hover:bg-orange-400 border-orange-400'}`}>
                          {newTeacherPhotoFile ? 'File Loaded' : 'Choose File'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handlePhotoFileChange(e, 'new')}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {newTeacherPhotoFile && (
                        <div className="text-[8.5px] text-emerald-400 mt-0.5 font-semibold truncate">
                          Selected: {newTeacherPhotoFile.name} ({Math.round(newTeacherPhotoFile.size / 1024)}KB)
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Visibility Status</label>
                      <select
                        value={newTeacher.hidden ? 'hidden' : 'visible'}
                        onChange={(e) => {
                          const isHidden = e.target.value === 'hidden';
                          setNewTeacher({
                            ...newTeacher,
                            hidden: isHidden,
                            inactiveReason: isHidden ? (newTeacher.inactiveReason || 'Transferred') : ''
                          });
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                      >
                        <option value="visible">Visible (Active on Frontend)</option>
                        <option value="hidden">Hidden (Inactive)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Deployment Status</label>
                      <select
                        value={newTeacher.if_deployed || 'No'}
                        onChange={(e) => setNewTeacher({ ...newTeacher, if_deployed: e.target.value })}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                      >
                        <option value="No">No Deployment</option>
                        <option value="in">Deployed In → (from another school, works here)</option>
                        <option value="out">Deployed Out ← (our employee, sent to another school)</option>
                      </select>
                    </div>
                    {newTeacher.hidden && (
                      <div className="animate-in fade-in duration-200">
                        <label className="block text-[8.5px] font-bold text-slate-400 uppercase mb-0.5">Reason for Inactive</label>
                        <select
                          value={['Transferred', 'Retired', 'Deployed Out'].includes(newTeacher.inactiveReason) ? newTeacher.inactiveReason : (newTeacher.inactiveReason ? 'Other' : 'Transferred')}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Other') {
                              const custom = window.prompt("Enter custom reason for inactive status:");
                              setNewTeacher({ ...newTeacher, inactiveReason: custom || 'Other' });
                            } else {
                              setNewTeacher({ ...newTeacher, inactiveReason: val });
                            }
                          }}
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                        >
                          <option value="Transferred">Transferred</option>
                          <option value="Retired">Retired</option>
                          <option value="Deployed Out">Deployed Out</option>
                          <option value="Other">Other...</option>
                        </select>
                        {newTeacher.inactiveReason && !['Transferred', 'Retired', 'Deployed Out'].includes(newTeacher.inactiveReason) && (
                          <input
                            type="text"
                            value={newTeacher.inactiveReason}
                            onChange={(e) => setNewTeacher({ ...newTeacher, inactiveReason: e.target.value })}
                            placeholder="Enter custom reason..."
                            className="w-full mt-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <button
                      onClick={handleAddTeacher}
                      className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 inline-flex border border-orange-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow"
                    >
                      <UserPlus size={12} />
                      Add Teacher
                    </button>
                  </div>
                </div>

                {/* Faculty list toolbar */}
                {selectedFaculty.length > 0 && (
                  <div className="mb-3 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between animate-in slide-in-from-top duration-200"
                    style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: '#334155' }}>
                    <span className="text-xs font-bold text-slate-300">
                      {selectedFaculty.length} employee(s) selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBulkPrint}
                        className="px-3.5 py-1.5 rounded bg-purple-500 hover:bg-purple-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 border border-purple-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow"
                      >
                        <Printer size={13} />
                        Print Selected
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="px-3.5 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center gap-1.5 border border-red-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow"
                      >
                        <Trash2 size={13} />
                        Delete Selected
                      </button>
                    </div>
                  </div>
                )}

                {/* Faculty list */}
                <div className="overflow-x-auto custom-scrollbar pb-1.5 border border-slate-800 rounded-lg min-w-0">
                  <table className="w-full text-xs text-left border-collapse" style={{ minWidth: '1100px' }}>
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[9px] font-bold">
                        <th className="p-1 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={faculty.length > 0 && selectedFaculty.length === faculty.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFaculty(faculty.map((_, idx) => idx));
                              } else {
                                setSelectedFaculty([]);
                              }
                            }}
                            className="rounded border-slate-800 text-orange-600 bg-slate-950 focus:ring-orange-500"
                          />
                        </th>
                        <th className="p-1 w-12 text-center">S.No</th>
                        <th className="p-1" style={{ minWidth: '185px' }}>Name</th>
                        <th className="p-1" style={{ minWidth: '150px' }}>Role / Subject</th>
                        <th className="p-1" style={{ minWidth: '110px' }}>Department</th>
                        <th className="p-1" style={{ minWidth: '180px' }}>Contact</th>
                        <th className="p-1 text-center" style={{ minWidth: '110px' }}>On Deployment</th>
                        <th className="p-1" style={{ minWidth: '130px' }}>Photo URL</th>
                        <th className="p-1 w-36 text-center" style={{ minWidth: '150px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {faculty.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-4 text-center text-slate-500 italic text-[11px]">No faculty members configured. Add some above.</td>
                        </tr>
                      ) : (
                        faculty.map((t, index) => {
                          const isEditing = editingFacultyIdx === index;
                          const rowIssue = facultyIssueMap[index];
                          const rowHasError = rowIssue?.severity === 'error';
                          const rowHasWarning = rowIssue && rowIssue.severity === 'warning';
                          return (
                            <React.Fragment key={t.name + index}>
                              <tr
                                className={`hover:bg-slate-900/20 transition-colors ${rowHasError
                                  ? 'bg-red-950/20 border-l-2 border-l-red-500'
                                  : rowHasWarning
                                    ? 'bg-amber-950/20 border-l-2 border-l-amber-500'
                                    : ''
                                  }`}
                              >
                                <td className="p-1 w-8 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedFaculty.includes(index)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedFaculty([...selectedFaculty, index]);
                                      } else {
                                        setSelectedFaculty(selectedFaculty.filter(idx => idx !== index));
                                      }
                                    }}
                                    className="rounded border-slate-800 text-orange-600 bg-slate-950 focus:ring-orange-500"
                                  />
                                </td>
                                <td className="p-1 w-12 text-center text-slate-400 font-mono">
                                  {index + 1}
                                </td>
                                {isEditing ? (
                                  <>
                                    <td className="p-1">
                                      <input
                                        type="text"
                                        value={editFacultyData.name}
                                        onChange={(e) => setEditFacultyData({ ...editFacultyData, name: e.target.value })}
                                        className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 font-semibold focus:outline-none focus:border-orange-500"
                                      />
                                    </td>
                                    <td className="p-1">
                                      <div className="space-y-1">
                                        <select
                                          value={STANDARD_DESIGNATIONS.includes(editFacultyData.designation) ? editFacultyData.designation : 'Other'}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setEditFacultyData({ ...editFacultyData, designation: val === 'Other' ? '' : val });
                                          }}
                                          className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                        >
                                          <option value="">Designation</option>
                                          {STANDARD_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                          <option value="Other">Other...</option>
                                        </select>
                                        {!STANDARD_DESIGNATIONS.includes(editFacultyData.designation) && (
                                          <input
                                            type="text"
                                            placeholder="Custom Designation"
                                            value={editFacultyData.designation}
                                            onChange={(e) => setEditFacultyData({ ...editFacultyData, designation: e.target.value })}
                                            className="w-full px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                          />
                                        )}
                                        <select
                                          value={STANDARD_SUBJECTS.includes(editFacultyData.subject) ? editFacultyData.subject : (editFacultyData.subject ? 'Other' : '')}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setEditFacultyData({ ...editFacultyData, subject: val === 'Other' ? ' ' : val });
                                          }}
                                          className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                        >
                                          <option value="">Subject</option>
                                          {STANDARD_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                          <option value="Other">Other...</option>
                                        </select>
                                        {editFacultyData.subject && !STANDARD_SUBJECTS.includes(editFacultyData.subject) && (
                                          <input
                                            type="text"
                                            placeholder="Custom Subject"
                                            value={editFacultyData.subject.trim()}
                                            onChange={(e) => setEditFacultyData({ ...editFacultyData, subject: e.target.value })}
                                            className="w-full px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                          />
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-1">
                                      <select
                                        value={STANDARD_DEPTS.includes(editFacultyData.department) ? editFacultyData.department : 'Other'}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === 'Other') {
                                            setEditFacultyData({ ...editFacultyData, department: '' });
                                          } else {
                                            setEditFacultyData({ ...editFacultyData, department: val });
                                          }
                                        }}
                                        className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-medium"
                                      >
                                        <option value="Administration">Administration</option>
                                        <option value="Science">Science</option>
                                        <option value="Humanities">Humanities</option>
                                        <option value="Science/Humanities">Science/Humanities</option>
                                        <option value="Secondary">Secondary (9th-10th)</option>
                                        <option value="MTS">MTS (Multi-Tasking Staff)</option>
                                        <option value="Other">Other...</option>
                                      </select>
                                      {!STANDARD_DEPTS.includes(editFacultyData.department) && (
                                        <input
                                          type="text"
                                          placeholder="Specify dept..."
                                          value={editFacultyData.department}
                                          onChange={(e) => setEditFacultyData({ ...editFacultyData, department: e.target.value })}
                                          className="w-full mt-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                                        />
                                      )}
                                    </td>
                                    <td className="p-1">
                                      <div className="space-y-1">
                                        <input
                                          type="email"
                                          placeholder="Email"
                                          value={editFacultyData.email}
                                          onChange={(e) => setEditFacultyData({ ...editFacultyData, email: e.target.value })}
                                          className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Mobile"
                                          value={editFacultyData.mobile}
                                          onChange={(e) => setEditFacultyData({ ...editFacultyData, mobile: e.target.value })}
                                          className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                        />
                                      </div>
                                    </td>
                                    <td className="p-1 text-center">
                                      <select
                                        value={editFacultyData.if_deployed || 'No'}
                                        onChange={(e) => setEditFacultyData({ ...editFacultyData, if_deployed: e.target.value })}
                                        className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-100 focus:outline-none focus:border-orange-400"
                                      >
                                        <option value="No">No</option>
                                        <option value="in">Deployed In (from another school)</option>
                                        <option value="out">Deployed Out (sent elsewhere)</option>
                                      </select>
                                    </td>
                                    <td className="p-1">
                                      <div className="flex flex-col gap-1 w-[130px]">
                                        <input
                                          type="text"
                                          placeholder="File name"
                                          value={editTeacherPhotoName}
                                          onChange={(e) => setEditTeacherPhotoName(sanitizePhotoFilename(e.target.value))}
                                          className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-200 focus:outline-none focus:border-orange-500"
                                          title="Sanitized custom photo filename"
                                        />
                                        <label className={`w-full py-1 px-1.5 rounded font-extrabold cursor-pointer transition-all text-center border text-[9px] block hover:scale-[1.02] active:scale-[0.98] ${editTeacherPhotoFile ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400' : 'bg-orange-500 hover:bg-orange-400 text-slate-950 border-orange-400'}`}>
                                          {editTeacherPhotoFile ? 'File Loaded' : 'Upload File'}
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handlePhotoFileChange(e, 'edit')}
                                            className="hidden"
                                          />
                                        </label>
                                        {editTeacherPhotoFile && (
                                          <div className="text-[8px] text-emerald-400 font-semibold truncate text-center">
                                            {editTeacherPhotoFile.name.substring(0, 15)}...
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-1 text-center flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => saveFacultyEdit(index)}
                                        className="p-1 rounded bg-emerald-950 text-emerald-400 hover:bg-emerald-900 transition-colors"
                                        title="Save"
                                      >
                                        <Check size={13} />
                                      </button>
                                      <button
                                        onClick={cancelFacultyEdit}
                                        className="p-1 rounded bg-slate-950 text-slate-400 hover:bg-slate-900 transition-colors"
                                        title="Cancel"
                                      >
                                        <X size={13} />
                                      </button>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-1 font-semibold text-slate-200">
                                      <div>
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <span>{t.name}</span>
                                          {t.hidden && (
                                            <span className="px-1.5 py-0.5 text-[8px] font-bold rounded badge-red-custom uppercase tracking-tight" title={`Reason: ${t.inactiveReason || 'Inactive'}`}>
                                              Hidden ({t.inactiveReason || 'Inactive'})
                                            </span>
                                          )}
                                          {rowIssue && (
                                            <span
                                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-tight border cursor-help ${rowHasError
                                                ? 'bg-red-950 text-red-400 border-red-800'
                                                : 'bg-amber-950 text-amber-400 border-amber-800'
                                                }`}
                                              title={rowIssue.messages.join('\n')}
                                            >
                                              <AlertCircle size={8} />
                                              {rowHasError ? 'Error' : 'Warning'}
                                            </span>
                                          )}
                                        </div>
                                        {faculty.filter(f => f.name && f.name.trim().toLowerCase() === t.name.trim().toLowerCase()).length > 1 && (
                                          <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                                            {t.cpis_no ? `CPIS: ${t.cpis_no}` : (t.mobile ? `Mobile: ${t.mobile}` : '')}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-1 text-slate-300">{t.designation}{(t.subject && !['Administration', 'MTS'].includes(t.department)) ? ` — ${t.subject}` : ''}</td>
                                    <td className="p-1">
                                      <span className="badge-theme">{t.department}</span>
                                    </td>
                                    <td className="p-1 text-slate-400">
                                      <div className="space-y-0.5">
                                        <div className="truncate max-w-[170px]">{t.email || '-'}</div>
                                        <div className="text-[10px] font-mono text-slate-500">{t.mobile || '-'}</div>
                                      </div>
                                    </td>
                                    <td className="p-1 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.if_deployed === 'in' ? 'bg-blue-950/60 text-blue-300 border border-blue-800/50' :
                                        t.if_deployed === 'out' ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50' :
                                          t.if_deployed === 'Yes' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' :
                                            'bg-slate-900/40 text-slate-400 border border-slate-800/30'
                                        }`}>
                                        {t.if_deployed === 'in' ? '→ Deployed In' : t.if_deployed === 'out' ? '← Deployed Out' : t.if_deployed === 'Yes' ? 'Deployed' : 'No'}
                                      </span>
                                    </td>
                                    <td className="p-1 font-mono text-slate-500 text-[10px] max-w-[120px] truncate">{t.photo || 'None'}</td>
                                    <td className="p-1 text-center flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => printEmployeeProfile(t)}
                                        className="p-1 rounded text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300 transition-colors"
                                        title="Print Profile / PDF"
                                      >
                                        <FileText size={13} />
                                      </button>
                                      <button
                                        onClick={() => openFullEdit(index)}
                                        className="p-1 rounded text-orange-400 hover:bg-orange-950/40 hover:text-orange-300 transition-colors"
                                        title="Edit all fields"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleMoveFacultyUp(index)}
                                        disabled={index === 0}
                                        className="p-1 rounded text-teal-400 hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                        title="Move Up"
                                      >
                                        <ArrowUp size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleMoveFacultyDown(index)}
                                        disabled={index === faculty.length - 1}
                                        className="p-1 rounded text-teal-400 hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                        title="Move Down"
                                      >
                                        <ArrowDown size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTeacher(index)}
                                        className="p-1 rounded text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </>
                                )}
                              </tr>
                              {isEditing && (
                                <tr className="bg-slate-900/30">
                                  <td colSpan={9} className="p-2 border-t border-slate-800/50">
                                    <div className="flex flex-col md:flex-row gap-2.5 items-start">
                                      <div className="flex-grow w-full md:w-auto">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Full Profile / Bio (Optional)</label>
                                        <textarea
                                          placeholder="Edit profile biography..."
                                          value={editFacultyData.profile || ''}
                                          onChange={(e) => setEditFacultyData({ ...editFacultyData, profile: e.target.value })}
                                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-855 text-xs text-slate-200 focus:outline-none focus:border-orange-500 h-16 resize-none"
                                        />
                                      </div>
                                      <div className="w-full md:w-48 flex-shrink-0">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Visibility Status</label>
                                        <select
                                          value={editFacultyData.hidden ? 'hidden' : 'visible'}
                                          onChange={(e) => {
                                            const isHidden = e.target.value === 'hidden';
                                            setEditFacultyData({
                                              ...editFacultyData,
                                              hidden: isHidden,
                                              inactiveReason: isHidden ? (editFacultyData.inactiveReason || 'Transferred') : ''
                                            });
                                          }}
                                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-855 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                        >
                                          <option value="visible">Visible (Active)</option>
                                          <option value="hidden">Hidden (Inactive)</option>
                                        </select>
                                      </div>
                                      {editFacultyData.hidden && (
                                        <div className="w-full md:w-48 flex-shrink-0 animate-in fade-in duration-200">
                                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Reason for Inactive</label>
                                          <select
                                            value={['Transferred', 'Retired', 'Deployed Out'].includes(editFacultyData.inactiveReason) ? editFacultyData.inactiveReason : (editFacultyData.inactiveReason ? 'Other' : 'Transferred')}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === 'Other') {
                                                const custom = window.prompt("Enter custom reason for inactive status:");
                                                setEditFacultyData({ ...editFacultyData, inactiveReason: custom || 'Other' });
                                              } else {
                                                setEditFacultyData({ ...editFacultyData, inactiveReason: val });
                                              }
                                            }}
                                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-855 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                                          >
                                            <option value="Transferred">Transferred</option>
                                            <option value="Retired">Retired</option>
                                            <option value="Deployed Out">Deployed Out</option>
                                            <option value="Other">Other...</option>
                                          </select>
                                          {editFacultyData.inactiveReason && !['Transferred', 'Retired', 'Deployed Out'].includes(editFacultyData.inactiveReason) && (
                                            <input
                                              type="text"
                                              value={editFacultyData.inactiveReason}
                                              onChange={(e) => setEditFacultyData({ ...editFacultyData, inactiveReason: e.target.value })}
                                              placeholder="Enter custom reason..."
                                              className="w-full mt-1.5 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-855 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                                            />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: INCOME TAX CALCULATOR */}
            {activeTab === 'tax' && allowedTabs.includes('tax') && (
              <div className="space-y-2.5 animate-in fade-in duration-200">
                {/* ── Row 1: Title bar + action buttons ── */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/50 px-4 py-2.5 rounded-xl border border-slate-700/60 shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calculator className="text-orange-400 shrink-0" size={15} />
                    <span className="font-bold text-slate-100 text-sm">Income Tax Auto-Generator</span>
                    <span className="hidden sm:inline text-slate-500 text-[11px] font-mono">FY {taxConfig.financialYearLabel} · AY {taxConfig.assessmentYearLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowTaxRules(!showTaxRules)}
                      className={`px-3 py-1.5 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1.5 border ${showTaxRules ? 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500' : 'bg-slate-700/80 hover:bg-slate-600 text-slate-200 border-slate-600'}`}
                    >
                      <Settings size={12} />
                      {showTaxRules ? 'Hide Rules' : 'Edit Tax Rules'}
                    </button>
                    <button
                      onClick={handleTaxCSVExport}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1.5 border border-sky-500"
                    >
                      <Download size={12} />
                      Export CSV
                    </button>
                    <button
                      onClick={() => printTaxSheets(getSelectedVisibleTaxFaculty())}
                      disabled={getSelectedVisibleTaxFaculty().length === 0}
                      className={`px-3 py-1.5 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1.5 border border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                        getSelectedVisibleTaxFaculty().length > 0
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      <Printer size={12} />
                      Print Selected ({getSelectedVisibleTaxFaculty().length})
                    </button>
                  </div>
                </div>

                {/* ── Row 2: Compact stats + regime toggle + search ── */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-900/30 px-3 py-2 rounded-xl border border-slate-800/50">
                  {/* Regime pills — hardcoded dark so visible in any theme */}
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setActiveTaxPreviewRegime('new')} style={activeTaxPreviewRegime === 'new' ? { background: '#f97316', color: '#0f172a', border: '1px solid #fb923c', fontWeight: 800 } : { background: '#334155', color: '#94a3b8', border: '1px solid #475569' }} className="px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-colors">New</button>
                    <button onClick={() => setActiveTaxPreviewRegime('old')} style={activeTaxPreviewRegime === 'old' ? { background: '#f97316', color: '#0f172a', border: '1px solid #fb923c', fontWeight: 800 } : { background: '#334155', color: '#94a3b8', border: '1px solid #475569' }} className="px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-colors">Old</button>
                  </div>
                  {/* Divider */}
                  <div className="w-px h-5 bg-slate-700 shrink-0" />
                  {/* Inline stats */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] flex-1 min-w-0">
                    <span className="text-slate-400 font-mono whitespace-nowrap">Nil-tax: <strong className="text-slate-200 font-extrabold">₹{previewTaxFreeGross.toLocaleString('en-IN')}</strong></span>
                    <span className="text-slate-400 font-mono whitespace-nowrap">87A Rebate: <strong className="text-slate-200 font-extrabold">₹{previewRegimeConfig.rebateMax.toLocaleString('en-IN')}</strong></span>
                    <span className="text-slate-400 font-mono whitespace-nowrap">Std. Deduction: <strong className="text-slate-200 font-extrabold">₹{previewRegimeConfig.standardDeduction.toLocaleString('en-IN')}</strong></span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${previewRegimeConfig.marginalReliefEnabled ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700/60' : 'bg-slate-800/60 text-slate-500 border-slate-700/60'}`}>
                      Marginal Relief {previewRegimeConfig.marginalReliefEnabled ? '✓ ON' : '✗ OFF'}
                    </span>
                  </div>
                  {/* Divider */}
                  <div className="w-px h-5 bg-slate-700 shrink-0 hidden sm:block" />
                  {/* Category filters Dropdown Checklist */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsTaxFilterDropdownOpen(!isTaxFilterDropdownOpen)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Filter Categories ({selectedTaxCategories.length})</span>
                      <ChevronDown size={10} className={`transition-transform duration-200 ${isTaxFilterDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isTaxFilterDropdownOpen && (
                      <>
                        {/* Overlay to close on click outside */}
                        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsTaxFilterDropdownOpen(false)} />
                        
                        {/* Dropdown panel */}
                        <div className="absolute right-0 mt-1.5 z-50 w-64 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl shadow-2xl p-3 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Categories</span>
                            <button
                              type="button"
                              onClick={() => setSelectedTaxCategories(['teaching_regular', 'non_teaching_regular'])}
                              className="text-[9px] text-orange-400 hover:text-orange-300 font-extrabold uppercase"
                            >
                              Reset Default
                            </button>
                          </div>
                          
                          <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                            {TAX_CATEGORIES.map((cat) => {
                              const isChecked = selectedTaxCategories.includes(cat.key);
                              return (
                                <label
                                  key={cat.key}
                                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors text-[11px] select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        if (selectedTaxCategories.length > 1) {
                                          setSelectedTaxCategories(selectedTaxCategories.filter(k => k !== cat.key));
                                        }
                                      } else {
                                        setSelectedTaxCategories([...selectedTaxCategories, cat.key]);
                                      }
                                    }}
                                    className="rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-950 w-3.5 h-3.5"
                                  />
                                  <div className="flex-1 flex items-center justify-between min-w-0">
                                    <span className="truncate font-semibold text-slate-200">{cat.label}</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${cat.color.split(' ')[0]}`} />
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Inline search */}
                  <input
                    type="text"
                    placeholder="Search employees…"
                    value={taxSearch}
                    onChange={(e) => setTaxSearch(e.target.value)}
                    className="flex-1 min-w-[110px] max-w-[220px] px-2.5 py-1 rounded-lg bg-slate-800/70 border border-slate-700 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>

                {showTaxRules && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    {/* Modal Card */}
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                      {/* Close button */}
                      <button
                        onClick={() => setShowTaxRules(false)}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
                        title="Close"
                      >
                        <X size={16} />
                      </button>
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-500"></div>
                      <div className="flex items-start justify-between gap-3 mb-4 pr-8">
                        <div>
                          <h4 className="font-extrabold text-slate-100 text-xs uppercase tracking-wider">Tax Calculator Rules</h4>
                          <p className="text-[11px] text-slate-300 mt-1">
                            Admin can update standard deduction, rebate u/s 87A, marginal relief, cess, slabs, and surcharge rules for both regimes.
                          </p>
                        </div>
                        <div className="px-2 py-1 rounded-lg bg-slate-950 border border-orange-500/30 text-[10px] font-bold text-orange-300 whitespace-nowrap">
                          Gross salary nil-tax band: Rs. {taxFreeGrossSalary.toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* New/Old Regime Tabs Selector */}
                      <div className="flex border-b border-slate-800 mb-4 gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveRegimeSettingsTab('new')}
                          className={`px-3 py-1.5 text-[11px] font-extrabold rounded-t-lg transition-all border-b-2 ${activeRegimeSettingsTab === 'new'
                            ? 'border-orange-500 bg-orange-950/20 text-orange-400 font-extrabold'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          New Tax Regime
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveRegimeSettingsTab('old')}
                          className={`px-3 py-1.5 text-[11px] font-extrabold rounded-t-lg transition-all border-b-2 ${activeRegimeSettingsTab === 'old'
                            ? 'border-orange-500 bg-orange-950/20 text-orange-400 font-extrabold'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          Old Tax Regime
                        </button>
                      </div>

                      {/* Global & Regime Settings Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Regime Label</label>
                          <input
                            type="text"
                            value={activeRegimeConfig.label}
                            onChange={(e) => handleTaxConfigFieldChange('label', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Financial Year</label>
                          <input
                            type="text"
                            value={taxConfig.financialYearLabel}
                            onChange={(e) => handleTaxConfigFieldChange('financialYearLabel', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Assessment Year</label>
                          <input
                            type="text"
                            value={taxConfig.assessmentYearLabel}
                            onChange={(e) => handleTaxConfigFieldChange('assessmentYearLabel', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
                        {[
                          { key: 'standardDeduction', label: 'Standard Deduction', isGlobal: false },
                          { key: 'rebateThreshold', label: '87A Threshold', isGlobal: false },
                          { key: 'rebateMax', label: '87A Max Rebate', isGlobal: false },
                          { key: 'cessRate', label: 'Cess %', isGlobal: true }
                        ].map((field) => (
                          <div key={field.key} className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">{field.label}</label>
                            <input
                              type="number"
                              value={field.isGlobal ? taxConfig[field.key] : activeRegimeConfig[field.key]}
                              onChange={(e) => handleTaxConfigFieldChange(field.key, e.target.value, true)}
                              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                            />
                          </div>
                        ))}
                        <div className="flex flex-col justify-end gap-2">
                          <div className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">87A Marginal Relief</span>
                            <ToggleSwitch checked={activeRegimeConfig.marginalReliefEnabled} onChange={() => handleTaxConfigToggle('marginalReliefEnabled')} />
                          </div>
                          <div className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Use Surcharge</span>
                            <ToggleSwitch checked={activeRegimeConfig.includeSurcharge} onChange={() => handleTaxConfigToggle('includeSurcharge')} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-[11px] font-extrabold text-orange-500 uppercase tracking-wide font-mono">Slab Rates</h5>
                            <span className="text-[10px] text-slate-400 font-semibold">Edit labels, upper limits, and rates</span>
                          </div>
                          <div className="space-y-2">
                            {activeRegimeConfig.slabs.map((slab, index) => (
                              <div key={`slab-${index}`} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_0.7fr] gap-2 items-center">
                                <input
                                  type="text"
                                  value={slab.label}
                                  onChange={(e) => handleTaxSlabChange(index, 'label', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                                />
                                <input
                                  type="number"
                                  value={slab.upto ?? ''}
                                  onChange={(e) => handleTaxSlabChange(index, 'upto', e.target.value)}
                                  placeholder={index === activeRegimeConfig.slabs.length - 1 ? 'Leave blank for final slab' : 'Upper limit'}
                                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                                />
                                <input
                                  type="number"
                                  value={slab.rate}
                                  onChange={(e) => handleTaxSlabChange(index, 'rate', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-[11px] font-extrabold text-orange-500 uppercase tracking-wide font-mono">Surcharge Rules</h5>
                            <span className="text-[10px] text-slate-400 font-semibold">Used only when surcharge toggle is on</span>
                          </div>
                          <div className="space-y-2">
                            {activeRegimeConfig.surchargeBrackets.map((bracket, index) => (
                              <div key={`surcharge-${index}`} className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_0.7fr] gap-2 items-center">
                                <input
                                  type="text"
                                  value={bracket.label}
                                  onChange={(e) => handleTaxSurchargeChange(index, 'label', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                                />
                                <input
                                  type="number"
                                  value={bracket.threshold}
                                  onChange={(e) => handleTaxSurchargeChange(index, 'threshold', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                                />
                                <input
                                  type="number"
                                  value={bracket.rate}
                                  onChange={(e) => handleTaxSurchargeChange(index, 'rate', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500 font-mono"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}



                {/* Database Table — with Teaching / Non-Teaching categories */}
                <div className="border border-slate-500/50 rounded-xl overflow-hidden bg-slate-900/40 shadow-sm ring-1 ring-slate-500/20">
                  <div className="overflow-x-auto custom-scrollbar pb-1.5">
                    {(() => {
                      // Show all non-hidden employees matching search, excluding inactive and deployed in by default
                      const allFiltered = getVisibleTaxFaculty();

                      const teachingEmps = [];
                      const nonTeachingEmps = [];
                      const deployedInEmps = [];
                      const deployedOutEmps = [];
                      const retiredEmps = [];
                      const otherInactiveEmps = [];
                      const transferredEmps = [];

                      allFiltered.forEach(emp => {
                        const cat = getEmployeeTaxCategory(emp);
                        if (cat === 'teaching_regular') {
                          teachingEmps.push(emp);
                        } else if (cat === 'non_teaching_regular') {
                          nonTeachingEmps.push(emp);
                        } else if (cat === 'deployed_in') {
                          deployedInEmps.push(emp);
                        } else if (cat === 'deployed_out') {
                          deployedOutEmps.push(emp);
                        } else if (cat === 'retired') {
                          retiredEmps.push(emp);
                        } else if (cat === 'transferred') {
                          transferredEmps.push(emp);
                        } else {
                          otherInactiveEmps.push(emp);
                        }
                      });

                      const renderEmployeeRow = (emp, catIndex) => {
                        const origIdx = faculty.indexOf(emp);
                        const isEditing = editingTaxIdx === origIdx;
                        const pan = getEmployeePan(emp);
                        const gross = getEmployeeGross(emp);
                        const tds = getEmployeeTds(emp);
                        const calc = calculateTax(gross, tds, taxConfig, getEmployeeTaxOptions(emp));

                        return (
                          <tr key={origIdx} className="border-b border-slate-700/40 hover:bg-slate-800/30 transition-colors">
                            <td className="p-3 text-center w-10">
                              <input
                                type="checkbox"
                                className="rounded bg-slate-950 border-slate-700 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4"
                                checked={selectedTaxEmployeeIndices.includes(origIdx)}
                                onChange={() => toggleEmployeeTaxSelection(emp)}
                              />
                            </td>
                            <td className="p-3 text-center w-10">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-teal-700 text-white text-[10px] font-bold shadow-sm select-none">{catIndex + 1}</span>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-100 font-mono">{emp.cpis_no || '-'}</div>
                              {isEditing ? (
                                <div className="flex flex-col gap-1.5 mt-1">
                                  <input type="text" value={editTaxData.pan} onChange={e => setEditTaxData({ ...editTaxData, pan: e.target.value.toUpperCase() })} placeholder="PAN NO" className="w-28 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[11px] text-slate-100 font-mono focus:outline-none focus:border-orange-400" />
                                  <select value={editTaxData.regime} onChange={e => setEditTaxData({ ...editTaxData, regime: e.target.value })} className="w-28 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-100 focus:outline-none focus:border-orange-400 font-bold">
                                    <option value="new">New Regime</option>
                                    <option value="old">Old Regime</option>
                                  </select>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-300 font-mono font-semibold">{pan || 'NO PAN'}</div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-100">{emp.name}</span>
                                {!isEditing && (
                                  <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase tracking-wider ${calc.regimeType === 'old' ? 'regime-badge-old' : 'regime-badge-new'}`}>{calc.regimeConfig.label}</span>
                                )}
                                {emp.hidden && (
                                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-extrabold badge-red-custom uppercase tracking-tight">
                                    {emp.inactiveReason || 'Inactive'}
                                  </span>
                                )}
                                {emp.if_deployed && (emp.if_deployed === 'in' || emp.if_deployed === 'out' || emp.if_deployed === 'Yes') && (
                                  <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase tracking-tight ${emp.if_deployed === 'in' || emp.if_deployed === 'Yes'
                                    ? 'badge-blue-custom'
                                    : 'badge-amber-custom'
                                    }`}>
                                    {emp.if_deployed === 'in' || emp.if_deployed === 'Yes' ? 'Dep. In' : 'Dep. Out'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-300 font-medium">{emp.designation}{emp.subject ? ` (${emp.subject})` : ''}</div>
                              {isEditing ? (
                                editTaxData.regime === 'old' ? (
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1.5 bg-slate-900/30 p-1.5 rounded border border-slate-700/60 w-[240px]">
                                    <div><div className="text-[9px] text-slate-400 font-bold">80C (Max 1.5L)</div><input type="number" value={editTaxData.deduction80C} onChange={e => setEditTaxData({ ...editTaxData, deduction80C: e.target.value })} className="w-full px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-100 font-mono text-right focus:outline-none focus:border-orange-400" /></div>
                                    <div><div className="text-[9px] text-slate-400 font-bold">80D (Health)</div><input type="number" value={editTaxData.deduction80D} onChange={e => setEditTaxData({ ...editTaxData, deduction80D: e.target.value })} className="w-full px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-100 font-mono text-right focus:outline-none focus:border-orange-400" /></div>
                                    <div><div className="text-[9px] text-slate-400 font-bold">HRA Exemption</div><input type="number" value={editTaxData.hraExemption} onChange={e => setEditTaxData({ ...editTaxData, hraExemption: e.target.value })} className="w-full px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-100 font-mono text-right focus:outline-none focus:border-orange-400" /></div>
                                    <div><div className="text-[9px] text-slate-400 font-bold">Other Deduct.</div><input type="number" value={editTaxData.otherDeductions} onChange={e => setEditTaxData({ ...editTaxData, otherDeductions: e.target.value })} className="w-full px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-100 font-mono text-right focus:outline-none focus:border-orange-400" /></div>
                                  </div>
                                ) : (
                                  <div className="mt-1.5 bg-slate-900/30 p-1.5 rounded border border-slate-700/60 w-[240px]">
                                    <div className="text-[9px] text-slate-400 font-bold mb-1">80CCD(2) — NPS Employer Share</div>
                                    <input type="number" value={editTaxData.otherDeductions} onChange={e => setEditTaxData({ ...editTaxData, otherDeductions: e.target.value })} className="w-full px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-slate-100 font-mono text-right focus:outline-none focus:border-orange-400" placeholder="Enter NPS employer contribution" />
                                    <div className="text-[8.5px] text-slate-500 mt-0.5">Allowed under new regime. Standard deduction ₹75,000 applied automatically.</div>
                                  </div>
                                )
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  {calc.regimeType === 'old' ? (
                                    <span className="text-[9.5px] text-slate-400 font-semibold font-mono cursor-help" title={`80C: ₹${calc.deduction80C.toLocaleString('en-IN')} | 80D: ₹${calc.deduction80D.toLocaleString('en-IN')} | HRA: ₹${calc.hraExemption.toLocaleString('en-IN')} | 80CCD(2): ₹${calc.otherDeductions.toLocaleString('en-IN')}`}>Deductions: ₹{(calc.deduction80C + calc.deduction80D + calc.hraExemption + calc.otherDeductions).toLocaleString('en-IN')}</span>
                                  ) : calc.otherDeductions > 0 ? (
                                    <span className="text-[9.5px] text-teal-400 font-semibold font-mono">80CCD(2): ₹{calc.otherDeductions.toLocaleString('en-IN')}</span>
                                  ) : null}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {isEditing ? (
                                <input type="number" value={editTaxData.grossSalary} onChange={e => setEditTaxData({ ...editTaxData, grossSalary: e.target.value })} className="w-28 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100 text-right focus:outline-none focus:border-orange-400 font-mono" />
                              ) : (
                                <span className="font-semibold text-slate-100 font-mono">₹{gross.toLocaleString('en-IN')}</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-semibold text-amber-200 tax-total-highlight font-mono">
                              {calc.totalTax > 0 ? `₹${calc.totalTax.toLocaleString('en-IN')}` : 'NIL'}
                            </td>
                            <td className="p-3 text-right">
                              {isEditing ? (
                                <input type="number" value={editTaxData.tds} onChange={e => setEditTaxData({ ...editTaxData, tds: e.target.value })} className="w-28 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100 text-right focus:outline-none focus:border-orange-400 font-mono" />
                              ) : (
                                <span className="font-semibold text-slate-100 font-mono">₹{tds.toLocaleString('en-IN')}</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono border ${calc.taxPayableNow > 0 ? 'bg-red-900/50 text-red-200 border-red-700/60' : 'bg-emerald-900/50 text-emerald-200 border-emerald-700/60'}`}>
                                {calc.taxPayableNow > 0 ? `₹${calc.taxPayableNow.toLocaleString('en-IN')}` : 'NIL'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {isEditing ? (
                                <div className="flex justify-center gap-1.5">
                                  <button onClick={() => { saveEmployeeTaxDetails(origIdx, editTaxData.pan, editTaxData.grossSalary, editTaxData.tds, editTaxData.regime, editTaxData.deduction80C, editTaxData.deduction80D, editTaxData.hraExemption, editTaxData.otherDeductions); setEditingTaxIdx(null); }} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors border border-emerald-500" title="Save Details"><Check size={12} /></button>
                                  <button onClick={() => setEditingTaxIdx(null)} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded transition-colors border border-slate-500" title="Cancel"><X size={12} /></button>
                                </div>
                              ) : (
                                <div className="flex justify-center gap-2">
                                  <button onClick={() => { setEditingTaxIdx(origIdx); setEditTaxData({ pan, grossSalary: gross.toString(), tds: tds.toString(), regime: getEmployeeRegime(emp), deduction80C: getEmployee80C(emp).toString(), deduction80D: getEmployee80D(emp).toString(), hraExemption: getEmployeeHra(emp).toString(), otherDeductions: getEmployeeOtherDeductions(emp).toString() }); }} className="px-2.5 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-[10px] font-bold uppercase tracking-wide transition-colors border border-slate-500">Edit</button>
                                  <button onClick={() => printTaxSheets([emp])} className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-1 border border-orange-500"><Printer size={10} />Print</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      };

                      const CategoryHeader = ({ label, count, accent }) => (
                        <tr>
                          <td colSpan="9" className="px-4 py-2.5 bg-slate-800 border-y border-slate-600">
                            <div className="flex items-center gap-2.5">
                              <span className={`px-3 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border ${accent}`}>{label}</span>
                              <span className="text-[10px] text-slate-400 font-mono font-semibold">{count} member{count !== 1 ? 's' : ''}</span>
                            </div>
                          </td>
                        </tr>
                      );

                      if (allFiltered.length === 0) {
                        return (
                          <div className="p-10 text-center text-slate-400 italic text-sm">
                            <div className="text-3xl mb-2">👤</div>
                            No employees found{taxSearch ? ' matching your search' : ''}.<br />
                            <span className="text-[11px] text-slate-500">Add faculty members in the Faculty Directory to see them here.</span>
                          </div>
                        );
                      }

                      return (
                        <table className="w-full text-left border-collapse tax-table">
                          <thead>
                            <tr style={{ background: '#1e293b', color: '#fff', borderBottom: '2px solid #475569' }} className="uppercase text-[9px] font-bold tracking-wide">
                              <th style={{ color: '#fff' }} className="p-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  className="rounded bg-slate-950 border-slate-700 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4"
                                  checked={allFiltered.length > 0 && allFiltered.every(emp => selectedTaxEmployeeIndices.includes(faculty.indexOf(emp)))}
                                  onChange={() => handleSelectAllTaxVisible(allFiltered)}
                                />
                              </th>
                              <th style={{ color: '#fff' }} className="p-3 w-10 text-center">#</th>
                              <th style={{ color: '#fff' }} className="p-3">CPIS / PAN</th>
                              <th style={{ color: '#fff' }} className="p-3">Name / Designation</th>
                              <th style={{ color: '#fff' }} className="p-3 text-right">Gross Salary (Annual)</th>
                              <th style={{ color: '#fff' }} className="p-3 text-right">Total Tax</th>
                              <th style={{ color: '#fff' }} className="p-3 text-right">TDS (Up-To-Date)</th>
                              <th style={{ color: '#fff' }} className="p-3 text-right">Tax Payable Now</th>
                              <th style={{ color: '#fff' }} className="p-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs">
                            {teachingEmps.length > 0 && (
                              <>
                                <CategoryHeader label="Teaching / Faculty" count={teachingEmps.length} accent="bg-blue-700 text-white border-blue-600" />
                                {teachingEmps.map((emp, i) => renderEmployeeRow(emp, i))}
                              </>
                            )}
                            {nonTeachingEmps.length > 0 && (
                              <>
                                <CategoryHeader label="Non-Teaching Staff" count={nonTeachingEmps.length} accent="bg-violet-700 text-white border-violet-600" />
                                {nonTeachingEmps.map((emp, i) => renderEmployeeRow(emp, i))}
                              </>
                            )}
                            {deployedInEmps.length > 0 && (
                              <>
                                <CategoryHeader label="Deployed In Staff" count={deployedInEmps.length} accent="bg-emerald-700 text-white border-emerald-600" />
                                {deployedInEmps.map((emp, i) => renderEmployeeRow(emp, i))}
                              </>
                            )}
                            {deployedOutEmps.length > 0 && (
                              <>
                                <CategoryHeader label="Deployed Out Staff" count={deployedOutEmps.length} accent="bg-amber-700 text-white border-amber-600" />
                                {deployedOutEmps.map((emp, i) => renderEmployeeRow(emp, i))}
                              </>
                            )}
                            {retiredEmps.length > 0 && (
                              <>
                                <CategoryHeader label="Retired Staff" count={retiredEmps.length} accent="bg-red-700 text-white border-red-600" />
                                {retiredEmps.map((emp, i) => renderEmployeeRow(emp, i))}
                              </>
                            )}
                            {otherInactiveEmps.length > 0 && (
                              <>
                                <CategoryHeader label="Drawing Pay / Other Inactive Staff" count={otherInactiveEmps.length} accent="bg-gray-700 text-white border-gray-600" />
                                {otherInactiveEmps.map((emp, i) => renderEmployeeRow(emp, i))}
                              </>
                            )}
                            {transferredEmps.length > 0 && (
                              <>
                                <CategoryHeader label="Transferred Staff" count={transferredEmps.length} accent="bg-slate-700 text-white border-slate-600" />
                                {transferredEmps.map((emp, i) => renderEmployeeRow(emp, i))}
                              </>
                            )}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: EXPORT FILES */}
            {activeTab === 'export' && allowedTabs.includes('export') && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Export & Update Public Slides Folder</h3>
                  <p className="text-xs text-slate-400 mt-1">Generate and download updated configuration files to copy into your repository/server.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* settings.json card */}
                  <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 flex flex-col justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={18} className="text-orange-400" />
                        <h4 className="font-bold text-slate-200 text-sm">settings.json</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Contains class-wise admission open/closed flags and the updated fee schedules. Place inside:
                      </p>
                      <code className="block text-[10.5px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300 mt-2 text-center select-all">
                        public/slides/settings.json
                      </code>
                    </div>
                    <button
                      onClick={downloadSettingsJson}
                      className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 font-extrabold text-xs rounded transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 border border-orange-400 shadow"
                    >
                      <Download size={14} />
                      Download settings.json
                    </button>
                  </div>

                  {/* notices.txt card */}
                  <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 flex flex-col justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw size={18} className="text-emerald-400" />
                        <h4 className="font-bold text-slate-200 text-sm">notices.txt</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Contains the comma-separated date, notice title, and link array. Place inside:
                      </p>
                      <code className="block text-[10.5px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300 mt-2 text-center select-all">
                        public/slides/notices.txt
                      </code>
                    </div>
                    <button
                      onClick={downloadNoticesTxt}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 border border-emerald-400 shadow"
                    >
                      <Download size={14} />
                      Download notices.txt
                    </button>
                  </div>

                  {/* faculty.json card */}
                  <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 flex flex-col justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-sky-400" />
                        <h4 className="font-bold text-slate-200 text-sm">faculty.json</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Contains the complete JSON database of faculty members. Place inside:
                      </p>
                      <code className="block text-[10.5px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800 text-slate-300 mt-2 text-center select-all">
                        public/slides/faculty.json
                      </code>
                    </div>
                    <button
                      onClick={downloadFacultyJson}
                      className="w-full py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs rounded transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 border border-sky-400 shadow"
                    >
                      <Download size={14} />
                      Download faculty.json
                    </button>
                  </div>

                </div>

                {/* Instructions banner */}
                <div className="bg-slate-900/20 border border-slate-800/80 p-4 rounded-lg text-xs leading-relaxed text-slate-400">
                  <h4 className="font-bold text-slate-300 mb-2 uppercase text-[10px] tracking-wider">How to Apply Changes Globally:</h4>
                  <ol className="list-decimal pl-4 space-y-2">
                    <li>Make modifications in the Admissions, Notices, and Faculty tabs.</li>
                    <li>Click <strong className="text-emerald-400">"Apply & Save"</strong> in the top header. This updates the local storage in your current browser immediately so you can verify the layout.</li>
                    <li>Click the respective download buttons above to download the updated configuration files.</li>
                    <li>Copy and replace these files inside your project's <code className="bg-slate-950 p-0.5 rounded px-1 font-mono text-slate-300">public/slides/</code> directory.</li>
                    <li>Commit/push the files to your repository or rebuild the Netlify site. Once deployed, the updates will be visible to all users globally!</li>
                  </ol>
                </div>

                {/* Full Database Backup & Restore Section */}
                <div className="border-t border-slate-800 pt-6 mt-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                      <Save className="text-orange-400" size={18} />
                      Full Database Backup & Restore
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Download a single unified backup JSON file containing all settings, notices, faculty members, admin accounts, and slideshow configurations. Restore it at any time to recover the full state of the website in Firebase.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {/* Backup Card */}
                    <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 flex flex-col justify-between items-start gap-3">
                      <div>
                        <h4 className="font-bold text-slate-200 text-sm">Download Full Backup</h4>
                        <p className="text-xs text-slate-400 leading-relaxed mt-1">
                          Creates a complete timestamped backup of the current database configuration.
                        </p>
                      </div>
                      <button
                        onClick={downloadFullBackup}
                        className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 font-extrabold text-xs rounded transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 border border-orange-400 shadow"
                      >
                        <Download size={14} />
                        Download Full Backup (.json)
                      </button>
                    </div>

                    {/* Restore Card */}
                    <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 flex flex-col justify-between items-start gap-3 w-full">
                      <div>
                        <h4 className="font-bold text-slate-200 text-sm">Restore from Backup</h4>
                        <p className="text-xs text-slate-400 leading-relaxed mt-1">
                          Upload a previously downloaded full backup JSON file. This will overwrite current console states (remember to click "Apply & Save" to push it live).
                        </p>
                      </div>
                      <div className="w-full flex items-center gap-2">
                        <label className="flex-1 py-2 bg-slate-850 hover:bg-slate-750 text-slate-200 font-extrabold text-xs rounded cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 border border-slate-700 shadow text-center">
                          <Upload size={14} />
                          Choose Backup File
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleRestoreBackup}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: ADMIN MANAGEMENT */}
            {activeTab === 'admins' && allowedTabs.includes('admins') && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Settings className="text-orange-400" size={18} />
                      Administrative Accounts Manager
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Create, delete, and configure differential console tab access permissions for administrative accounts.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left/Middle: Admins list */}
                  <div className="lg:col-span-2 space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Admin Accounts</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {admins.map((admin) => {
                        const isSelf = currentUser && admin.email.toLowerCase() === currentUser.email.toLowerCase();

                        // Custom styling for role badge
                        let roleBadgeClass = "bg-slate-800 text-slate-300 border-slate-700";
                        if (admin.role === 'Super Admin') {
                          roleBadgeClass = "bg-amber-950/60 text-amber-400 border-amber-500/30";
                        } else if (admin.role === 'Accounts Assistant') {
                          roleBadgeClass = "bg-blue-950/60 text-blue-400 border-blue-500/30";
                        } else if (admin.role === 'Admission Incharge') {
                          roleBadgeClass = "bg-purple-950/60 text-purple-400 border-purple-500/30";
                        } else if (admin.role === 'Notice Board Incharge') {
                          roleBadgeClass = "bg-emerald-950/60 text-emerald-400 border-emerald-500/30";
                        }

                        return (
                          <div
                            key={admin.email}
                            className={`p-4 rounded-xl border bg-slate-900/40 transition-all ${isSelf ? 'border-orange-500/40 shadow-sm shadow-orange-950/10' : 'border-slate-800 hover:border-slate-700'}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-200 truncate" title={admin.email}>{admin.email}</span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-orange-950/50 text-orange-400 border border-orange-500/30">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${roleBadgeClass}`}>
                                  {admin.role}
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleDeleteAdmin(admin.email)}
                                className={`p-1.5 rounded transition-colors ${isSelf ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-red-400 hover:bg-slate-800'}`}
                                title={isSelf ? "You cannot delete your own active session" : "Delete administrative account"}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-800/80">
                              <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">Tab Access Permissions:</span>
                              <div className="flex flex-wrap gap-1">
                                {(() => {
                                  const tabs = Array.isArray(admin.allowedTabs) ? admin.allowedTabs : [];
                                  if (tabs.length === 0) {
                                    return <span className="text-[10px] text-slate-500 italic">No access granted</span>;
                                  }
                                  return tabs.map(t => {
                                    let label = t;
                                    if (t === 'admissions') label = 'Admissions';
                                    if (t === 'notices') label = 'Notices';
                                    if (t === 'faculty') label = 'Faculty';
                                    if (t === 'tax') label = 'Tax';
                                    if (t === 'export') label = 'Export';
                                    if (t === 'admins') label = 'Admins';

                                    return (
                                      <span
                                        key={t}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-950 text-slate-400 border border-slate-850"
                                      >
                                        {label}
                                      </span>
                                    );
                                  })
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Add new account Form */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <UserPlus size={15} className="text-orange-400" />
                        Create Admin Account
                      </h4>

                      <div className="space-y-3 mt-3">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
                          <input
                            type="email"
                            placeholder="e.g. user@shangus.com"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200 placeholder-slate-650 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Password</label>
                          <input
                            type="password"
                            placeholder="At least 6 characters..."
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200 placeholder-slate-650 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Default Role Template</label>
                          <select
                            value={newAdminRole}
                            onChange={(e) => {
                              const role = e.target.value;
                              setNewAdminRole(role);
                              if (role === 'Super Admin') {
                                setNewAdminPermissions(['admissions', 'notices', 'faculty', 'slideshow', 'tax', 'export', 'admins', 'pages_cms']);
                              } else if (role === 'Accounts Assistant') {
                                setNewAdminPermissions(['tax', 'faculty']);
                              } else if (role === 'Admission Incharge') {
                                setNewAdminPermissions(['admissions']);
                              } else if (role === 'Notice Board Incharge') {
                                setNewAdminPermissions(['notices']);
                              }
                            }}
                            className="w-full px-2 py-2 rounded bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:border-orange-500"
                          >
                            <option value="Super Admin">Super Admin</option>
                            <option value="Accounts Assistant">Accounts Assistant</option>
                            <option value="Admission Incharge">Admission Incharge</option>
                            <option value="Notice Board Incharge">Notice Board Incharge</option>
                            <option value="Custom">Custom Permissions Only</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Configure Tab Permissions</label>
                          <div className="bg-slate-950 p-3 rounded border border-slate-850 space-y-2.5">
                            {[
                              { id: 'admissions', label: 'Admissions & Fees' },
                              { id: 'notices', label: 'Latest Notices' },
                              { id: 'faculty', label: 'Faculty Directory' },
                              { id: 'slideshow', label: 'Home Slideshow' },
                              { id: 'tax', label: 'Tax Calculator' },
                              { id: 'export', label: 'Export files' },
                              { id: 'pages_cms', label: 'Page CMS' },
                              { id: 'admins', label: 'Admin Management' }
                            ].map((perm) => {
                              const checked = newAdminPermissions.includes(perm.id);
                              return (
                                <label key={perm.id} className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      let updated;
                                      if (e.target.checked) {
                                        updated = [...newAdminPermissions, perm.id];
                                      } else {
                                        updated = newAdminPermissions.filter(p => p !== perm.id);
                                      }
                                      setNewAdminPermissions(updated);

                                      // Set role to custom if it no longer matches templates
                                      const matchSuper = updated.length === 8; // admissions, notices, faculty, slideshow, tax, export, admins, pages_cms
                                      const matchAccounts = updated.length === 2 && updated.includes('tax') && updated.includes('faculty');
                                      const matchAdmissions = updated.length === 1 && updated.includes('admissions');
                                      const matchNotices = updated.length === 1 && updated.includes('notices');

                                      if (matchSuper) {
                                        setNewAdminRole('Super Admin');
                                      } else if (matchAccounts) {
                                        setNewAdminRole('Accounts Assistant');
                                      } else if (matchAdmissions) {
                                        setNewAdminRole('Admission Incharge');
                                      } else if (matchNotices) {
                                        setNewAdminRole('Notice Board Incharge');
                                      } else {
                                        setNewAdminRole('Custom');
                                      }
                                    }}
                                    className="rounded border-slate-800 bg-slate-900 text-orange-600 focus:ring-orange-500 focus:ring-opacity-25 w-3.5 h-3.5"
                                  />
                                  <span className="text-xs font-semibold">{perm.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddAdmin}
                      className="w-full mt-4 py-2.5 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] border border-orange-500/20 shadow-md shadow-orange-950/20"
                    >
                      <Plus size={14} className="stroke-[2.5px]" />
                      Add Admin Account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: PAGE CMS */}
            {activeTab === 'pages_cms' && allowedTabs.includes('pages_cms') && (
              <div className="space-y-6 animate-in fade-in duration-200 text-slate-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <FolderOpen className="text-orange-400" size={18} />
                      Custom Page Manager & CMS
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Create new custom pages (like Facilities, Achievements) or edit dynamic blocks on existing system pages.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddPageModal(true)}
                    className="py-1.5 px-3 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 border border-orange-500/20 shadow-md animate-in duration-150"
                  >
                    <Plus size={14} className="stroke-[2.5px]" />
                    Create New Page
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                  {/* SIDEBAR: PAGE LIST */}
                  <div className="lg:col-span-1 bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-left">Page Registry</h4>
                    <div className="space-y-2">
                      {pagesList.map((page) => {
                        const isSelected = selectedPage?.id === page.id;
                        return (
                          <div
                            key={page.id}
                            className={`p-3 rounded-lg border transition-all text-left ${
                              isSelected 
                                ? 'border-orange-500 bg-slate-950/80 shadow-md' 
                                : 'border-slate-850 hover:border-slate-750 bg-slate-900/30'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <div className="min-w-0 flex-grow">
                                <h5 className="text-xs font-bold text-slate-200 truncate">{page.title}</h5>
                                <p className="text-[10px] text-slate-500 font-mono truncate">/{page.id}</p>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePageActive(page.id)}
                                  title={page.isActive ? "Deactivate Page" : "Activate Page"}
                                  className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                    page.isActive ? 'text-teal-400' : 'text-slate-500 hover:text-slate-400'
                                  }`}
                                >
                                  {page.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                                <button
                                  type="button"
                                  disabled={page.isSystem}
                                  onClick={() => handleDeletePage(page.id)}
                                  title={page.isSystem ? "System pages cannot be deleted" : "Delete Page"}
                                  className={`p-1 rounded transition-colors ${
                                    page.isSystem 
                                      ? 'text-slate-850 cursor-not-allowed opacity-20' 
                                      : 'text-slate-500 hover:text-red-400 hover:bg-slate-800'
                                  }`}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-2.5 flex justify-between items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                                page.isSystem 
                                  ? 'bg-blue-950/40 text-blue-400 border-blue-500/20' 
                                  : 'bg-teal-950/40 text-teal-400 border-teal-500/20'
                              }`}>
                                {page.isSystem ? 'System' : 'Custom'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPage(page);
                                  handleLoadPageBlocks(page.id);
                                }}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${
                                  isSelected 
                                    ? 'bg-orange-600 text-white shadow-sm' 
                                    : 'bg-slate-850 hover:bg-slate-750 text-slate-350'
                                }`}
                              >
                                Edit Content
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* MAIN EDITOR AREA */}
                  <div className="lg:col-span-3 bg-slate-900/40 p-5 rounded-xl border border-slate-800 space-y-6">
                    {!selectedPage ? (
                      <div className="py-20 text-center text-slate-500">
                        <FolderOpen size={48} className="mx-auto mb-4 text-slate-600 stroke-[1]" />
                        <h4 className="font-semibold text-sm text-slate-400">No Page Selected</h4>
                        <p className="text-xs mt-1 max-w-xs mx-auto">
                          Select a page from the registry sidebar or create a new one to begin editing its content blocks.
                        </p>
                      </div>
                    ) : cmsLoading ? (
                      <div className="py-20 text-center text-slate-500 text-xs">
                        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
                        Loading page blocks configuration...
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in fade-in duration-200 text-left">
                        {/* Page Header Info */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-850">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-200">{selectedPage.title}</h4>
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-850 text-slate-400 border border-slate-800">
                                /{selectedPage.id}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              Firestore Document ID: site/page_{selectedPage.id}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-300 select-none">
                              <input
                                type="checkbox"
                                checked={selectedPage.isActive}
                                onChange={(e) => setSelectedPage({ ...selectedPage, isActive: e.target.checked })}
                                className="rounded border-slate-800 bg-slate-950 text-orange-600 focus:ring-orange-500 focus:ring-opacity-25 w-3.5 h-3.5"
                              />
                              Visible in Navigation
                            </label>
                            
                            <button
                              type="button"
                              onClick={handleSavePageContent}
                              disabled={cmsSaving}
                              className="py-1.5 px-3 rounded bg-teal-600 hover:bg-teal-500 disabled:bg-slate-850 disabled:text-slate-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 border border-teal-500/20 shadow-md"
                            >
                              {cmsSaving ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save size={12} />
                                  Save Content
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Page Settings & SEO Info */}
                        <div className="bg-slate-950/20 p-4 rounded-xl border border-slate-850 space-y-4">
                          <h5 className="text-xs font-bold text-slate-350 uppercase tracking-wider">SEO Metadata & Title Settings</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            <div>
                              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Page Title (Display)</label>
                              <input
                                type="text"
                                value={selectedPage.title}
                                onChange={(e) => setSelectedPage({ ...selectedPage, title: e.target.value })}
                                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-850 text-xs font-medium text-slate-200 focus:outline-none focus:border-orange-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">SEO Title (Browser Tab)</label>
                              <input
                                type="text"
                                value={seoTitle}
                                placeholder={`${selectedPage.title} | Govt. HSS Shangus`}
                                onChange={(e) => setSeoTitle(e.target.value)}
                                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-850 text-xs font-medium text-slate-200 focus:outline-none focus:border-orange-500"
                              />
                            </div>
                          </div>
                          <div className="text-left">
                            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">SEO Meta Description</label>
                            <textarea
                              rows={2}
                              value={seoDescription}
                              placeholder="Brief summary of page content for search engines..."
                              onChange={(e) => setSeoDescription(e.target.value)}
                              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-850 text-xs font-medium text-slate-200 focus:outline-none focus:border-orange-500 resize-none font-sans"
                            />
                          </div>
                        </div>

                        {/* Blocks Section */}
                        <div className="space-y-4">
                          <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                            <span>Layout Blocks</span>
                            <span className="text-[10px] text-slate-500 font-normal normal-case">
                              Arrange and customize the sections on the page.
                            </span>
                          </h5>

                          {pageBlocks.length === 0 ? (
                            <div className="py-10 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                              This page has no blocks. Use the toolbar below to add sections.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {pageBlocks.map((block, idx) => (
                                <div 
                                  key={idx}
                                  className="border border-slate-800 bg-slate-955/40 rounded-xl p-4 space-y-4 relative bg-slate-900/60"
                                >
                                  {/* Block Header & Reorder controls */}
                                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/80">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-slate-850 text-[10px] font-bold text-slate-400 flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                                        {block.type} Block
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveBlock(idx, 'up')}
                                        className="p-1 rounded bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
                                        title="Move Up"
                                      >
                                        <ArrowUp size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === pageBlocks.length - 1}
                                        onClick={() => handleMoveBlock(idx, 'down')}
                                        className="p-1 rounded bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
                                        title="Move Down"
                                      >
                                        <ArrowDown size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBlock(idx)}
                                        className="p-1 rounded bg-slate-950 hover:bg-red-950 text-slate-400 hover:text-red-400 ml-1 flex items-center justify-center"
                                        title="Delete Block"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Block Editor Contents */}
                                  <div className="text-xs space-y-3">
                                    {block.type === 'hero' && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                                        <div className="space-y-3">
                                          <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Hero Title</label>
                                            <input
                                              type="text"
                                              value={block.title || ''}
                                              onChange={(e) => handleUpdateBlockField(idx, 'title', e.target.value)}
                                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Hero Subtitle</label>
                                            <input
                                              type="text"
                                              value={block.subtitle || ''}
                                              onChange={(e) => handleUpdateBlockField(idx, 'subtitle', e.target.value)}
                                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                                            />
                                          </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                          <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Background Image URL</label>
                                            <div className="flex gap-2">
                                              <input
                                                type="text"
                                                placeholder="/slides/aboutus.jpg"
                                                value={block.bgImage || ''}
                                                onChange={(e) => handleUpdateBlockField(idx, 'bgImage', e.target.value)}
                                                className="flex-grow px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[10px]"
                                              />
                                              <label className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-350 font-bold rounded cursor-pointer transition-colors flex items-center justify-center">
                                                Upload
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  onChange={(e) => handleBlockImageUpload(idx, e)}
                                                  className="hidden"
                                                />
                                              </label>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Image Opacity ({block.bgOpacity !== undefined ? block.bgOpacity : 30}%)</label>
                                              <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={block.bgOpacity !== undefined ? block.bgOpacity : 30}
                                                onChange={(e) => handleUpdateBlockField(idx, 'bgOpacity', parseInt(e.target.value))}
                                                className="w-full h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-orange-500 mt-2.5"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Height</label>
                                              <select
                                                value={block.height || 'normal'}
                                                onChange={(e) => handleUpdateBlockField(idx, 'height', e.target.value)}
                                                className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                                              >
                                                <option value="normal">Normal</option>
                                                <option value="large">Large</option>
                                              </select>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {block.type === 'text_section' && (
                                      <div className="space-y-3 text-left">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Section Heading</label>
                                            <input
                                              type="text"
                                              placeholder="e.g. Facilities Overview"
                                              value={block.heading || ''}
                                              onChange={(e) => handleUpdateBlockField(idx, 'heading', e.target.value)}
                                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Section Subheading</label>
                                            <input
                                              type="text"
                                              placeholder="e.g. Modern Infrastructure"
                                              value={block.subheading || ''}
                                              onChange={(e) => handleUpdateBlockField(idx, 'subheading', e.target.value)}
                                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Paragraph Content</label>
                                          <textarea
                                            rows={6}
                                            value={block.content || ''}
                                            onChange={(e) => handleUpdateBlockField(idx, 'content', e.target.value)}
                                            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 font-sans"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {block.type === 'photo_gallery' && (
                                      <div className="space-y-3 text-left">
                                        <div>
                                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Gallery Section Title</label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Laboratory Infrastructure Photos"
                                            value={block.title || ''}
                                            onChange={(e) => handleUpdateBlockField(idx, 'title', e.target.value)}
                                            className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                                          />
                                        </div>

                                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 space-y-3">
                                          <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gallery Images</span>
                                            <label className="py-1 px-2.5 bg-orange-600 hover:bg-orange-500 border border-orange-500/20 text-[10px] text-white font-extrabold rounded cursor-pointer transition-colors flex items-center justify-center gap-1">
                                              <Plus size={11} />
                                              Add Image to Gallery
                                              <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleGalleryPhotoUpload(idx, e)}
                                                className="hidden"
                                              />
                                            </label>
                                          </div>
                                          
                                          {(!block.images || block.images.length === 0) ? (
                                            <p className="text-[10px] text-slate-500 text-center py-4">No images in this gallery yet. Click above to upload!</p>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                              {block.images.map((img, imgIdx) => (
                                                <div key={imgIdx} className="bg-slate-900/60 p-2 rounded border border-slate-800 flex gap-2">
                                                  <img src={img.url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0 bg-slate-950 border border-slate-800" />
                                                  <div className="flex-grow space-y-1">
                                                    <input
                                                      type="text"
                                                      placeholder="Image caption..."
                                                      value={img.caption || ''}
                                                      onChange={(e) => {
                                                        const updatedImg = { ...img, caption: e.target.value };
                                                        const updatedImages = [...block.images];
                                                        updatedImages[imgIdx] = updatedImg;
                                                        handleUpdateBlockField(idx, 'images', updatedImages);
                                                      }}
                                                      className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10.5px] text-slate-200 focus:outline-none"
                                                    />
                                                    <div className="flex justify-between items-center text-[9px] text-slate-500">
                                                      <span className="truncate max-w-[120px] font-mono">{img.url}</span>
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          const updatedImages = block.images.filter((_, k) => k !== imgIdx);
                                                          handleUpdateBlockField(idx, 'images', updatedImages);
                                                        }}
                                                        className="text-red-400 hover:underline"
                                                      >
                                                        Delete
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {block.type === 'info_cards' && (
                                      <div className="space-y-3 text-left">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Cards Section Title</label>
                                            <input
                                              type="text"
                                              placeholder="e.g. Core Pillars"
                                              value={block.title || ''}
                                              onChange={(e) => handleUpdateBlockField(idx, 'title', e.target.value)}
                                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Columns Count</label>
                                            <select
                                              value={block.columns || 3}
                                              onChange={(e) => handleUpdateBlockField(idx, 'columns', parseInt(e.target.value))}
                                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none"
                                            >
                                              <option value={2}>2 Columns</option>
                                              <option value={3}>3 Columns</option>
                                              <option value={4}>4 Columns</option>
                                            </select>
                                          </div>
                                        </div>

                                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 space-y-3">
                                          <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Card Items</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newCard = { title: 'New Card', description: 'Description text...', iconName: 'BookOpen' };
                                                const updatedCards = [...(block.cards || []), newCard];
                                                handleUpdateBlockField(idx, 'cards', updatedCards);
                                              }}
                                              className="py-1 px-2 text-[10px] font-bold text-orange-400 border border-orange-500/20 bg-slate-900 rounded hover:bg-slate-850 flex items-center gap-1 transition-colors"
                                            >
                                              <Plus size={11} />
                                              Add Card
                                            </button>
                                          </div>
                                          
                                          {(!block.cards || block.cards.length === 0) ? (
                                            <p className="text-[10px] text-slate-500 text-center py-4">No cards defined. Add one above.</p>
                                          ) : (
                                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                              {block.cards.map((card, cIdx) => (
                                                <div key={cIdx} className="bg-slate-900/80 p-3 rounded border border-slate-800 flex flex-col gap-2 relative">
                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                    <div className="md:col-span-2">
                                                      <label className="block text-[8.5px] text-slate-400 mb-0.5">Card Heading</label>
                                                      <input
                                                        type="text"
                                                        value={card.title || ''}
                                                        onChange={(e) => {
                                                          const updatedCards = [...block.cards];
                                                          updatedCards[cIdx] = { ...card, title: e.target.value };
                                                          handleUpdateBlockField(idx, 'cards', updatedCards);
                                                        }}
                                                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10.5px] text-slate-200 focus:outline-none"
                                                      />
                                                    </div>
                                                    <div>
                                                      <label className="block text-[8.5px] text-slate-400 mb-0.5">Card Icon</label>
                                                      <select
                                                        value={card.iconName || 'BookOpen'}
                                                        onChange={(e) => {
                                                          const updatedCards = [...block.cards];
                                                          updatedCards[cIdx] = { ...card, iconName: e.target.value };
                                                          handleUpdateBlockField(idx, 'cards', updatedCards);
                                                        }}
                                                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10.5px] text-slate-200 focus:outline-none"
                                                      >
                                                        {['BookOpen', 'Users', 'Award', 'GraduationCap', 'Building', 'Calendar', 'MapPin', 'Activity', 'FileText', 'CheckCircle2', 'Image', 'Flame', 'Globe', 'Shield', 'Heart', 'Library', 'Layers', 'Lightbulb', 'Wrench'].map(ic => (
                                                          <option key={ic} value={ic}>{ic}</option>
                                                        ))}
                                                      </select>
                                                    </div>
                                                  </div>
                                                  
                                                  <div>
                                                    <label className="block text-[8.5px] text-slate-400 mb-0.5">Description Text</label>
                                                    <textarea
                                                      rows={2}
                                                      value={card.description || ''}
                                                      onChange={(e) => {
                                                        const updatedCards = [...block.cards];
                                                        updatedCards[cIdx] = { ...card, description: e.target.value };
                                                        handleUpdateBlockField(idx, 'cards', updatedCards);
                                                      }}
                                                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10.5px] text-slate-200 resize-none font-sans"
                                                    />
                                                  </div>

                                                  <div className="flex justify-end gap-1.5">
                                                    <button
                                                      type="button"
                                                      disabled={cIdx === 0}
                                                      onClick={() => {
                                                        const updatedCards = [...block.cards];
                                                        const temp = updatedCards[cIdx];
                                                        updatedCards[cIdx] = updatedCards[cIdx - 1];
                                                        updatedCards[cIdx - 1] = temp;
                                                        handleUpdateBlockField(idx, 'cards', updatedCards);
                                                      }}
                                                      className="text-[9px] text-slate-400 hover:text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 disabled:opacity-20"
                                                    >
                                                      Move Up
                                                    </button>
                                                    <button
                                                      type="button"
                                                      disabled={cIdx === block.cards.length - 1}
                                                      onClick={() => {
                                                        const updatedCards = [...block.cards];
                                                        const temp = updatedCards[cIdx];
                                                        updatedCards[cIdx] = updatedCards[cIdx + 1];
                                                        updatedCards[cIdx + 1] = temp;
                                                        handleUpdateBlockField(idx, 'cards', updatedCards);
                                                      }}
                                                      className="text-[9px] text-slate-400 hover:text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 disabled:opacity-20"
                                                    >
                                                      Move Down
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const updatedCards = block.cards.filter((_, k) => k !== cIdx);
                                                        handleUpdateBlockField(idx, 'cards', updatedCards);
                                                      }}
                                                      className="text-[9px] text-red-400 hover:underline bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800"
                                                    >
                                                      Delete
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {block.type === 'accordion' && (
                                      <div className="space-y-3 text-left">
                                        <div>
                                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5 font-sans">Accordion Section Title</label>
                                          <input
                                            type="text"
                                            value={block.title || ''}
                                            onChange={(e) => handleUpdateBlockField(idx, 'title', e.target.value)}
                                            className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500"
                                          />
                                        </div>

                                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 space-y-3">
                                          <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Accordion Items</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newItem = { title: 'New Item Title', content: 'Detailed content text...' };
                                                const updatedItems = [...(block.items || []), newItem];
                                                handleUpdateBlockField(idx, 'items', updatedItems);
                                              }}
                                              className="py-1 px-2 text-[10px] font-bold text-orange-400 border border-orange-500/20 bg-slate-900 rounded hover:bg-slate-850 flex items-center gap-1 transition-colors"
                                            >
                                              <Plus size={11} />
                                              Add Row
                                            </button>
                                          </div>
                                          
                                          {(!block.items || block.items.length === 0) ? (
                                            <p className="text-[10px] text-slate-500 text-center py-4">No accordion items defined.</p>
                                          ) : (
                                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                              {block.items.map((item, itemIdx) => (
                                                <div key={itemIdx} className="bg-slate-900 p-3 rounded border border-slate-800 flex flex-col gap-2 relative">
                                                  <div>
                                                    <label className="block text-[8.5px] text-slate-400 mb-0.5">Item Heading / Question</label>
                                                    <input
                                                      type="text"
                                                      value={item.title || ''}
                                                      onChange={(e) => {
                                                        const updatedItems = [...block.items];
                                                        updatedItems[itemIdx] = { ...item, title: e.target.value };
                                                        handleUpdateBlockField(idx, 'items', updatedItems);
                                                      }}
                                                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10.5px] text-slate-200 focus:outline-none"
                                                    />
                                                  </div>
                                                  
                                                  <div>
                                                    <label className="block text-[8.5px] text-slate-400 mb-0.5">Item Detailed Content / Answer</label>
                                                    <textarea
                                                      rows={3}
                                                      value={item.content || ''}
                                                      onChange={(e) => {
                                                        const updatedItems = [...block.items];
                                                        updatedItems[itemIdx] = { ...item, content: e.target.value };
                                                        handleUpdateBlockField(idx, 'items', updatedItems);
                                                      }}
                                                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10.5px] text-slate-200 resize-none font-sans"
                                                    />
                                                  </div>

                                                  <div className="flex justify-end gap-1.5">
                                                    <button
                                                      type="button"
                                                      disabled={itemIdx === 0}
                                                      onClick={() => {
                                                        const updatedItems = [...block.items];
                                                        const temp = updatedItems[itemIdx];
                                                        updatedItems[itemIdx] = updatedItems[itemIdx - 1];
                                                        updatedItems[itemIdx - 1] = temp;
                                                        handleUpdateBlockField(idx, 'items', updatedItems);
                                                      }}
                                                      className="text-[9px] text-slate-400 hover:text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 disabled:opacity-20"
                                                    >
                                                      Move Up
                                                    </button>
                                                    <button
                                                      type="button"
                                                      disabled={itemIdx === block.items.length - 1}
                                                      onClick={() => {
                                                        const updatedItems = [...block.items];
                                                        const temp = updatedItems[itemIdx];
                                                        updatedItems[itemIdx] = updatedItems[itemIdx + 1];
                                                        updatedItems[itemIdx + 1] = temp;
                                                        handleUpdateBlockField(idx, 'items', updatedItems);
                                                      }}
                                                      className="text-[9px] text-slate-400 hover:text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 disabled:opacity-20"
                                                    >
                                                      Move Down
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const updatedItems = block.items.filter((_, k) => k !== itemIdx);
                                                        handleUpdateBlockField(idx, 'items', updatedItems);
                                                      }}
                                                      className="text-[9px] text-red-400 hover:underline bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800"
                                                    >
                                                      Delete
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Add layout block */}
                        <div className="bg-slate-955/20 p-4 rounded-xl border border-slate-850 text-center">
                          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">Add Page Layout Section</span>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {[
                              { label: '+ Add Hero Banner', type: 'hero', default: { type: 'hero', title: selectedPage.title, subtitle: 'Welcome to our page', bgImage: '', bgOpacity: 30, height: 'normal' } },
                              { label: '+ Add Text Block', type: 'text_section', default: { type: 'text_section', heading: 'Section Title', subheading: 'Section Subtitle', content: 'Detailed paragraph text goes here...' } },
                              { label: '+ Add Photo Gallery', type: 'photo_gallery', default: { type: 'photo_gallery', title: 'Photo Gallery Title', images: [] } },
                              { label: '+ Add Info Cards', type: 'info_cards', default: { type: 'info_cards', title: 'Features & Info', columns: 3, cards: [] } },
                              { label: '+ Add Accordion FAQ', type: 'accordion', default: { type: 'accordion', title: 'Frequently Asked Questions', items: [] } }
                            ].map((bType) => (
                              <button
                                key={bType.type}
                                type="button"
                                onClick={() => setPageBlocks([...pageBlocks, bType.default])}
                                className="px-3 py-1.5 rounded bg-slate-850 hover:bg-slate-750 text-orange-400 hover:text-orange-300 font-bold text-xs border border-slate-800 transition-colors shadow"
                              >
                                {bType.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal to add custom page */}
                {showAddPageModal && (
                  <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
                    <form 
                      onSubmit={handleCreatePage}
                      className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-slate-200 text-left font-sans"
                    >
                      <div>
                        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                          <Plus size={16} className="text-orange-400" />
                          Create Custom Web Page
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal font-sans">
                          This will register a new page under the specified URL path slug and let you design it with the CMS blocks.
                        </p>
                      </div>

                      <div className="space-y-3.5 text-xs font-sans">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Page Title</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. School Facilities"
                            value={newPageTitle}
                            onChange={(e) => {
                              setNewPageTitle(e.target.value);
                              if (!newPageSlug) {
                                const generated = e.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9\s-]/g, '')
                                  .trim()
                                  .replace(/\s+/g, '-');
                                setNewPageSlug(generated);
                              }
                            }}
                            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-sans">URL Path Slug</label>
                          <div className="flex items-center rounded bg-slate-950 border border-slate-800 overflow-hidden focus-within:border-orange-500">
                            <span className="px-2.5 text-slate-550 border-r border-slate-850 select-none font-mono">/</span>
                            <input
                              type="text"
                              required
                              placeholder="facilities"
                              value={newPageSlug}
                              onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                              className="w-full px-2.5 py-2 bg-transparent text-slate-200 focus:outline-none font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-850 font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddPageModal(false);
                            setNewPageTitle('');
                            setNewPageSlug('');
                          }}
                          className="px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={cmsSaving}
                          className="px-3.5 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md border border-orange-500/20"
                        >
                          {cmsSaving ? "Saving..." : "Create Page"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* BULK PRINT SELECTION MODAL */}
        {showBulkPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col max-h-[85vh] text-slate-200">
              <div className="flex justify-between items-start border-b border-slate-800 pb-2.5 mb-3">
                <div>
                  <h3 className="text-base font-bold text-orange-400">Bulk Profile PDF Export</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Select employees to generate a unified printable PDF. Page breaks are added automatically.</p>
                </div>
                <button
                  onClick={() => setShowBulkPrintModal(false)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={bulkPrintSearch}
                    onChange={(e) => setBulkPrintSearch(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="w-full sm:w-40">
                  <select
                    value={bulkPrintDept}
                    onChange={(e) => setBulkPrintDept(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="All">All Departments</option>
                    {Array.from(new Set([...STANDARD_DEPTS, ...faculty.map(t => t.department).filter(Boolean)])).map(d => (
                      <option key={d} value={d}>{d === 'Secondary' ? 'Secondary (9th-10th)' : d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selection List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-800 rounded-lg bg-slate-950 p-2 space-y-0.5 mb-3 min-h-[200px]">
                {(() => {
                  const filtered = faculty.filter(t => {
                    const matchesSearch = t.name.toLowerCase().includes(bulkPrintSearch.toLowerCase());
                    const matchesDept = bulkPrintDept === 'All' || t.department === bulkPrintDept;
                    return matchesSearch && matchesDept;
                  });

                  if (filtered.length === 0) {
                    return <div className="text-center text-slate-600 italic text-xs py-10">No employees match filters.</div>;
                  }

                  const allFilteredSelected = filtered.every(t => selectedBulkPrintNames.includes(t.name));

                  const toggleAllFiltered = () => {
                    if (allFilteredSelected) {
                      const filteredNames = filtered.map(t => t.name);
                      setSelectedBulkPrintNames(selectedBulkPrintNames.filter(name => !filteredNames.includes(name)));
                    } else {
                      const newSelections = [...selectedBulkPrintNames];
                      filtered.forEach(t => {
                        if (!newSelections.includes(t.name)) {
                          newSelections.push(t.name);
                        }
                      });
                      setSelectedBulkPrintNames(newSelections);
                    }
                  };

                  return (
                    <>
                      <label className="flex items-center gap-2.5 px-2 py-1 hover:bg-slate-900/40 rounded cursor-pointer border-b border-slate-800/50 pb-2 mb-2">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleAllFiltered}
                          className="rounded border-slate-800 text-orange-600 bg-slate-950 focus:ring-orange-500"
                        />
                        <span className="text-xs font-bold text-slate-300">Select All Matching ({filtered.length})</span>
                      </label>

                      {filtered.map((t, idx) => {
                        const isChecked = selectedBulkPrintNames.includes(t.name);
                        const handleCheckChange = () => {
                          if (isChecked) {
                            setSelectedBulkPrintNames(selectedBulkPrintNames.filter(name => name !== t.name));
                          } else {
                            setSelectedBulkPrintNames([...selectedBulkPrintNames, t.name]);
                          }
                        };

                        return (
                          <label key={t.name + '_' + idx} className="flex items-center justify-between px-2 py-1 hover:bg-slate-900/60 rounded cursor-pointer transition-colors">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={handleCheckChange}
                                className="rounded border-slate-800 text-orange-600 bg-slate-950 focus:ring-orange-500"
                              />
                              <span className="text-xs font-semibold text-slate-200">{t.name}</span>
                              {t.hidden && (
                                <span className="px-1.5 py-0.5 text-[8px] font-bold rounded badge-red-custom uppercase tracking-tight">
                                  Hidden ({t.inactiveReason || 'Inactive'})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {t.designation} <span className="text-slate-600">•</span> {t.department}
                            </div>
                          </label>
                        );
                      })}
                    </>
                  );
                })()}
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between items-center border-t border-slate-800 pt-2.5">
                <div className="text-xs text-slate-400 font-semibold">
                  {selectedBulkPrintNames.length} of {faculty.length} selected
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBulkPrintModal(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const selected = faculty.filter(t => selectedBulkPrintNames.includes(t.name));
                      printBulkProfiles(selected);
                      setShowBulkPrintModal(false);
                    }}
                    disabled={selectedBulkPrintNames.length === 0}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 shadow border border-purple-400"
                  >
                    <Printer size={13} />
                    Generate PDF / Print
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CSV EXPORT MODAL */}
        {showCsvExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col max-h-[90vh] text-slate-100">
              <div className="flex justify-between items-start border-b border-slate-700 pb-2.5 mb-3">
                <div>
                  <h3 className="text-base font-bold text-orange-300">
                    {csvExportMode === 'tax' ? 'Custom Tax CSV Export' : 'Custom Faculty CSV Export'}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Choose which employees and columns to include. Useful for generating reports for higher authorities.
                  </p>
                </div>
                <button
                  onClick={() => setShowCsvExportModal(false)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-sky-300">Employees</h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCsvEmployeeIndices(filteredCsvEmployees.map(({ index }) => index))}
                        className="text-[10px] font-bold text-sky-300 hover:text-sky-200"
                      >
                        Select filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCsvEmployeeIndices([])}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Search by name, CPIS, designation..."
                      value={csvExportSearch}
                      onChange={(e) => setCsvExportSearch(e.target.value)}
                      className="flex-grow min-w-0 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <select
                      value={csvExportDept}
                      onChange={(e) => setCsvExportDept(e.target.value)}
                      className="w-full sm:w-40 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      {csvDepartmentOptions.map((dept) => (
                        <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-700 rounded-lg bg-slate-950 p-2 space-y-0.5 min-h-[220px]">
                    {filteredCsvEmployees.length === 0 ? (
                      <div className="text-center text-slate-500 italic text-xs py-10">No employees match filters.</div>
                    ) : (
                      filteredCsvEmployees.map(({ emp, index }) => {
                        const isSelected = selectedCsvEmployeeIndices.includes(index);
                        return (
                          <label
                            key={`csv-emp-${index}`}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${isSelected ? 'bg-sky-900/40 border border-sky-700/50' : 'hover:bg-slate-900 border border-transparent'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCsvEmployeeSelection(index)}
                              className="accent-sky-500"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">{emp.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{emp.designation}{emp.cpis_no ? ` · ${emp.cpis_no}` : ''}</div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold mt-2">
                    {selectedCsvEmployeeIndices.length} of {faculty.length} employees selected
                  </div>
                </div>

                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-emerald-300">Columns</h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const preset = csvExportMode === 'tax'
                            ? TAX_CSV_DEFAULT_COLUMNS.filter((key) => csvColumnOptions.some((column) => column.key === key))
                            : csvColumnOptions.map((column) => column.key);
                          setSelectedCsvColumns(preset);
                        }}
                        className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200"
                      >
                        {csvExportMode === 'tax' ? 'Tax preset' : 'Select all'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCsvColumns([])}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-700 rounded-lg bg-slate-950 p-2 min-h-[220px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {csvColumnOptions.map((column) => {
                        const isSelected = selectedCsvColumns.includes(column.key);
                        return (
                          <label
                            key={`csv-col-${column.key}`}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${isSelected ? 'bg-emerald-900/30 border border-emerald-700/40' : 'hover:bg-slate-900 border border-transparent'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCsvColumnSelection(column.key)}
                              className="accent-emerald-500"
                            />
                            <span className="text-[11px] text-slate-200">{column.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold mt-2">
                    {selectedCsvColumns.length} of {csvColumnOptions.length} columns selected
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-700 pt-3 mt-3">
                <p className="text-[11px] text-slate-400">
                  Tax figures use the active rules from Admissions settings ({taxConfig.regimeLabel}, AY {taxConfig.assessmentYearLabel}).
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCsvExportModal(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={downloadSelectedCSV}
                    disabled={selectedCsvEmployeeIndices.length === 0 || selectedCsvColumns.length === 0}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 shadow border border-teal-400"
                  >
                    <Download size={13} />
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CSV IMPORT PREVIEW MODAL */}
        {showCsvPreviewModal && csvPreviewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col max-h-[85vh] text-slate-200 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start border-b border-slate-800 pb-2.5 mb-3">
                <div>
                  <h3 className="text-base font-bold text-orange-400">CSV Import Preview</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Please review the employee records parsed from your CSV file below before confirming the import.</p>
                </div>
                <button
                  onClick={() => setShowCsvPreviewModal(false)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="banner-teal-custom p-2.5 rounded-lg text-xs mb-3 font-semibold flex items-start gap-2 border">
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                <span>Smart Merge: Existing records will be updated matching by CPIS No or Contact Number (preserving their uploaded photos and custom bios). New records will be appended to the list.</span>
              </div>

              {/* Preview List Table */}
              <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar border border-slate-800 rounded-lg bg-slate-950 p-0 mb-3 min-h-[250px]">
                <table className="w-full text-xs text-left border-collapse" style={{ minWidth: '580px' }}>
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[9px] font-bold">
                      <th className="p-2">Name</th>
                      <th className="p-2">Role / Subject</th>
                      <th className="p-2">Department</th>
                      <th className="p-2">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {csvPreviewData.map((t, idx) => {
                      let isUpdate = false;
                      const hasCpis = t.cpis_no && t.cpis_no.trim() !== '';
                      const hasMobile = t.mobile && t.mobile.trim() !== '';
                      if (hasCpis) {
                        isUpdate = faculty.some(f => f.cpis_no && f.cpis_no.trim() === t.cpis_no.trim());
                      }
                      if (!isUpdate && hasMobile) {
                        isUpdate = faculty.some(f => f.mobile && f.mobile.trim() === t.mobile.trim());
                      }
                      if (!isUpdate && !hasCpis && !hasMobile && t.name && t.name.trim() !== '') {
                        isUpdate = faculty.some(f => f.name && f.name.trim().toLowerCase() === t.name.trim().toLowerCase());
                      }

                      return (
                        <tr key={idx} className="hover:bg-slate-900/20">
                          <td className="p-2 font-semibold text-slate-200">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{t.name}</span>
                              <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-wider border ${isUpdate ? 'badge-status-update' : 'badge-status-new'}`}>
                                {isUpdate ? 'Update' : 'New'}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 text-slate-300">
                            {t.designation}
                            {t.subject ? ` — ${t.subject}` : ''}
                          </td>
                          <td className="p-2">
                            <span className="badge-theme">{t.department}</span>
                          </td>
                          <td className="p-2 text-slate-400">
                            <div className="text-[10px] truncate max-w-[150px]">{t.email || '-'}</div>
                            <div className="text-[9px] font-mono text-slate-500">{t.mobile || '-'}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between items-center border-t border-slate-800 pt-2.5">
                {(() => {
                  let updates = 0;
                  let news = 0;
                  csvPreviewData.forEach(t => {
                    let isUpdate = false;
                    const hasCpis = t.cpis_no && t.cpis_no.trim() !== '';
                    const hasMobile = t.mobile && t.mobile.trim() !== '';
                    if (hasCpis) {
                      isUpdate = faculty.some(f => f.cpis_no && f.cpis_no.trim() === t.cpis_no.trim());
                    }
                    if (!isUpdate && hasMobile) {
                      isUpdate = faculty.some(f => f.mobile && f.mobile.trim() === t.mobile.trim());
                    }
                    if (!isUpdate && !hasCpis && !hasMobile && t.name && t.name.trim() !== '') {
                      isUpdate = faculty.some(f => f.name && f.name.trim().toLowerCase() === t.name.trim().toLowerCase());
                    }
                    if (isUpdate) updates++;
                    else news++;
                  });

                  return (
                    <div className="text-xs text-slate-400 font-semibold">
                      {news} new, {updates} updates ready to merge
                    </div>
                  );
                })()}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCsvPreviewModal(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold btn-cancel-custom transition-colors border"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const mergedFaculty = [...faculty];
                      let updatedCount = 0;
                      let addedCount = 0;

                      csvPreviewData.forEach((imported) => {
                        let matchIdx = -1;
                        const hasCpis = imported.cpis_no && imported.cpis_no.trim() !== '';
                        const hasMobile = imported.mobile && imported.mobile.trim() !== '';

                        if (hasCpis) {
                          matchIdx = mergedFaculty.findIndex(f => f.cpis_no && f.cpis_no.trim() === imported.cpis_no.trim());
                        }
                        if (matchIdx === -1 && hasMobile) {
                          matchIdx = mergedFaculty.findIndex(f => f.mobile && f.mobile.trim() === imported.mobile.trim());
                        }
                        if (matchIdx === -1 && !hasCpis && !hasMobile && imported.name && imported.name.trim() !== '') {
                          matchIdx = mergedFaculty.findIndex(f => f.name && f.name.trim().toLowerCase() === imported.name.trim().toLowerCase());
                        }

                        if (matchIdx !== -1) {
                          const existing = mergedFaculty[matchIdx];
                          mergedFaculty[matchIdx] = {
                            ...existing,
                            ...imported,
                            photo: imported.photo ? imported.photo : existing.photo,
                            profile: imported.profile ? imported.profile : existing.profile,
                            hidden: imported.hidden !== undefined ? imported.hidden : existing.hidden,
                            inactiveReason: imported.inactiveReason !== undefined ? imported.inactiveReason : existing.inactiveReason
                          };
                          // Normalize undefined values
                          if (mergedFaculty[matchIdx].hidden === undefined) {
                            mergedFaculty[matchIdx].hidden = false;
                          }
                          if (mergedFaculty[matchIdx].inactiveReason === undefined) {
                            mergedFaculty[matchIdx].inactiveReason = '';
                          }
                          updatedCount++;
                        } else {
                          mergedFaculty.push({
                            ...imported,
                            hidden: imported.hidden !== undefined ? imported.hidden : false,
                            inactiveReason: imported.inactiveReason !== undefined ? imported.inactiveReason : ''
                          });
                          addedCount++;
                        }
                      });

                      setFaculty(mergedFaculty);
                      setSaveSuccess(`Smart merge complete: added ${addedCount} new, updated ${updatedCount} existing. Remember to click "Apply & Save".`);
                      setTimeout(() => setSaveSuccess(''), 6000);
                      setShowCsvPreviewModal(false);
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-extrabold bg-blue-500 hover:bg-blue-400 text-slate-950 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1 border border-blue-400 shadow-md shadow-blue-950/20"
                  >
                    <Check size={13} />
                    Confirm Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CSV VALIDATION ERRORS MODAL */}
        {showCsvErrorModal && csvValidationErrors && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col max-h-[80vh] text-slate-200 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start border-b border-slate-800 pb-2.5 mb-3">
                <div>
                  <h3 className="text-base font-bold text-red-400">CSV Import Failed</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Please fix the following validation errors in your CSV file and try again.</p>
                </div>
                <button
                  onClick={() => setShowCsvErrorModal(false)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Error banner */}
              <div className="banner-red-custom border p-2.5 rounded-lg text-xs mb-3 font-medium flex items-start gap-2 animate-in fade-in duration-200">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>The system found {csvValidationErrors.length} validation errors. Fix them to enable previewing and importing.</span>
              </div>

              {/* Scrollable Error List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-850 rounded-lg bg-slate-950 p-2.5 space-y-2 mb-3 min-h-[180px]">
                {csvValidationErrors.map((err, idx) => (
                  <div key={idx} className="text-xs border-b border-slate-900/50 pb-1.5 last:border-b-0">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                      <span className="font-bold badge-red-custom px-1.5 py-0.5 rounded border">Row {err.row}</span>
                      <span className="font-semibold">{err.name}</span>
                    </div>
                    <p className="text-slate-300 font-medium">{err.message}</p>
                  </div>
                ))}
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end border-t border-slate-800 pt-2.5">
                <button
                  onClick={() => setShowCsvErrorModal(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold btn-cancel-custom transition-colors border"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FULL EMPLOYEE EDIT MODAL — always dark regardless of active theme */}
        {showFullEditModal && fullEditData && (
          <div className="fixed inset-0 z-[90] flex items-stretch justify-end bg-black/70 backdrop-blur-sm">
            <div className="flex-1" onClick={closeFullEdit} />
            {/* Panel — theme-responsive */}
            <div
              className="employee-edit-modal w-full max-w-2xl flex flex-col shadow-2xl animate-in slide-in-from-right-8 duration-300 overflow-hidden border-l border-[var(--border-ui)] bg-[var(--bg-card)] text-[var(--text-main)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0 border-[var(--border-ui)] bg-[var(--bg-page)]/40">
                <div>
                  <h3 className="font-bold text-sm font-title tracking-wide text-orange-500">Edit Employee Record</h3>
                  <p className="text-[11px] mt-0.5 text-[var(--text-muted)]">{fullEditData.name || 'Unnamed'} — All fields editable below</p>
                </div>
                <button onClick={closeFullEdit} className="p-1.5 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-ui)]/40">
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6" style={{ scrollbarColor: 'var(--text-muted) transparent' }}>

                {/* Section: Basic Info */}
                <section>
                  <h4 className={sectionHeader}>
                    <span style={divider} />
                    <span style={sectionTitleStyle}>Basic Information</span>
                    <span style={divider} />
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FInput field="name" label="Full Name" data={fullEditData} onChange={fullEditField} required />
                    <div>
                      <label className={panelLabel} style={panelLabelStyle}>Present Designation <span className="text-orange-500">*</span></label>
                      <select
                        value={STANDARD_DESIGNATIONS.includes(fullEditData.designation) ? fullEditData.designation : 'Other'}
                        onChange={e => {
                          const val = e.target.value;
                          fullEditField('designation', val === 'Other' ? '' : val);
                        }}
                        className={panelInput}
                        style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                      >
                        <option value="">Select Designation</option>
                        {STANDARD_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        <option value="Other">Other...</option>
                      </select>
                      {!STANDARD_DESIGNATIONS.includes(fullEditData.designation) && (
                        <input
                          type="text"
                          placeholder="Enter custom designation..."
                          value={fullEditData.designation || ''}
                          onChange={e => fullEditField('designation', e.target.value)}
                          className={panelInput + " mt-1.5 font-semibold"}
                          style={panelInputStyle}
                          onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                        />
                      )}
                    </div>
                    <div>
                      <label className={panelLabel} style={panelLabelStyle}>Subject/s Teaching (shown on website)</label>
                      <select
                        value={STANDARD_SUBJECTS.includes(fullEditData.subject) ? fullEditData.subject : (fullEditData.subject ? 'Other' : '')}
                        onChange={e => {
                          const val = e.target.value;
                          fullEditField('subject', val === 'Other' ? ' ' : val);
                        }}
                        className={panelInput}
                        style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                      >
                        <option value="">Select Subject</option>
                        {STANDARD_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="Other">Other...</option>
                      </select>
                      {fullEditData.subject && !STANDARD_SUBJECTS.includes(fullEditData.subject) && (
                        <input
                          type="text"
                          placeholder="Enter custom subject..."
                          value={(fullEditData.subject || '').trim()}
                          onChange={e => fullEditField('subject', e.target.value)}
                          className={panelInput + " mt-1.5 font-semibold"}
                          style={panelInputStyle}
                          onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                        />
                      )}
                    </div>
                    <FInput field="subject_pg" label="Subject in PG (academic qualification)" data={fullEditData} onChange={fullEditField} />
                    <FInput field="email" label="Email Address" data={fullEditData} onChange={fullEditField} type="email" />
                    <FInput field="mobile" label="Contact Number" data={fullEditData} onChange={fullEditField} />
                    <FInput field="gov_mail_id" label="Govt. Mail ID" data={fullEditData} onChange={fullEditField} />
                    <div>
                      <label className={panelLabel} style={panelLabelStyle}>Department</label>
                      <select
                        value={STANDARD_DEPTS.includes(fullEditData.department) ? fullEditData.department : 'Other'}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Other') {
                            fullEditField('department', '');
                          } else {
                            fullEditField('department', val);
                          }
                        }}
                        className={panelInput}
                        style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                      >
                        <option value="Administration">Administration</option>
                        <option value="Science">Science</option>
                        <option value="Humanities">Humanities</option>
                        <option value="Secondary">Secondary (9th–10th)</option>
                        <option value="MTS">MTS (Multi-Tasking Staff)</option>
                        <option value="Other">Other...</option>
                      </select>
                      {!STANDARD_DEPTS.includes(fullEditData.department) && (
                        <input
                          type="text"
                          placeholder="Enter custom department..."
                          value={fullEditData.department || ''}
                          onChange={e => fullEditField('department', e.target.value)}
                          className={panelInput + " mt-1.5 font-semibold"}
                          style={panelInputStyle}
                          onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                        />
                      )}
                    </div>
                    <div>
                      <label className={panelLabel} style={panelLabelStyle}>Visibility Status</label>
                      <select value={fullEditData.hidden ? 'hidden' : 'visible'}
                        onChange={e => {
                          const isHidden = e.target.value === 'hidden';
                          fullEditField('hidden', isHidden);
                          if (isHidden && !fullEditData.inactiveReason) {
                            fullEditField('inactiveReason', 'Transferred');
                          }
                        }}
                        className={panelInput} style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)}>
                        <option value="visible">Visible (Active on Website)</option>
                        <option value="hidden">Hidden (Inactive)</option>
                      </select>
                    </div>
                    {fullEditData.hidden && (
                      <div className="animate-in fade-in duration-200">
                        <label className={panelLabel} style={panelLabelStyle}>Reason for Inactive</label>
                        <select
                          value={['Transferred', 'Retired', 'Deployed Out'].includes(fullEditData.inactiveReason) ? fullEditData.inactiveReason : (fullEditData.inactiveReason ? 'Other' : 'Transferred')}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === 'Other') {
                              const custom = window.prompt("Enter custom reason for inactive status:");
                              fullEditField('inactiveReason', custom || 'Other');
                            } else {
                              fullEditField('inactiveReason', val);
                            }
                          }}
                          className={panelInput} style={panelInputStyle}
                          onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                        >
                          <option value="Transferred">Transferred</option>
                          <option value="Retired">Retired</option>
                          <option value="Deployed Out">Deployed Out</option>
                          <option value="Other">Other...</option>
                        </select>
                        {fullEditData.inactiveReason && !['Transferred', 'Retired', 'Deployed Out'].includes(fullEditData.inactiveReason) && (
                          <input
                            type="text"
                            placeholder="Enter custom reason..."
                            value={fullEditData.inactiveReason || ''}
                            onChange={e => fullEditField('inactiveReason', e.target.value)}
                            className={panelInput + " mt-1.5 font-semibold"}
                            style={panelInputStyle}
                            onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                            onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* Section: Service Details */}
                <section>
                  <h4 className={sectionHeader}>
                    <span style={divider} />
                    <span style={sectionTitleStyle}>Service Details</span>
                    <span style={divider} />
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FInput field="cpis_no" label="CPIS No (Unique Govt ID)" data={fullEditData} onChange={fullEditField} mono />
                    <FInput field="date_of_first_appointment" label="Date of 1st Appointment" data={fullEditData} onChange={fullEditField} mono />
                    <FInput field="designation_at_first_appointment" label="Designation at 1st Appt" data={fullEditData} onChange={fullEditField} />
                    <FInput field="stay_period" label="Stay from (Period)" data={fullEditData} onChange={fullEditField} />
                    <FInput field="zone_name" label="Zone Name" data={fullEditData} onChange={fullEditField} />
                    <FInput field="ddo_code" label="UDISE Code" data={fullEditData} onChange={fullEditField} mono />
                    <FInput field="ddo_code_hrms" label="DDO Code HRMS" data={fullEditData} onChange={fullEditField} mono />
                    <FInput field="cadre" label="Service Cadre" data={fullEditData} onChange={fullEditField} />
                  </div>
                </section>

                {/* Section: Tax & Financial Details */}
                <section>
                  <h4 className={sectionHeader}>
                    <span style={divider} />
                    <span style={sectionTitleStyle}>Tax & Financial Details</span>
                    <span style={divider} />
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={panelLabel} style={panelLabelStyle}>PAN No</label>
                      <input
                        type="text"
                        value={fullEditData.pan || (fullEditData.customFields && (fullEditData.customFields.PAN || fullEditData.customFields.pan)) || ''}
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          setFullEditData(d => ({
                            ...d,
                            pan: val,
                            customFields: { ...(d.customFields || {}), PAN: val }
                          }));
                        }}
                        className={panelInput + ' font-mono'}
                        style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                      />
                    </div>
                    <div>
                      <label className={panelLabel} style={panelLabelStyle}>Gross Salary (Annual)</label>
                      <input
                        type="number"
                        value={fullEditData.grossSalary !== undefined ? fullEditData.grossSalary : (fullEditData.customFields && (fullEditData.customFields['Gross Salary'] || fullEditData.customFields.grossSalary)) || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFullEditData(d => ({
                            ...d,
                            grossSalary: val,
                            customFields: { ...(d.customFields || {}), 'Gross Salary': val }
                          }));
                        }}
                        className={panelInput}
                        style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                      />
                    </div>
                    <div>
                      <label className={panelLabel} style={panelLabelStyle}>TDS Paid (Up-To-Date)</label>
                      <input
                        type="number"
                        value={fullEditData.tds !== undefined ? fullEditData.tds : (fullEditData.customFields && (fullEditData.customFields.TDS || fullEditData.customFields.tds || fullEditData.customFields['TDS Paid'])) || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFullEditData(d => ({
                            ...d,
                            tds: val,
                            customFields: { ...(d.customFields || {}), TDS: val }
                          }));
                        }}
                        className={panelInput}
                        style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                      />
                    </div>
                  </div>
                </section>

                {/* Section: Personal Details */}
                <section>
                  <h4 className={sectionHeader}>
                    <span style={divider} />
                    <span style={sectionTitleStyle}>Personal Details</span>
                    <span style={divider} />
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FInput field="dob" label="Date of Birth" data={fullEditData} onChange={fullEditField} />
                    <FInput field="parentage" label="Parentage (Father's Name)" data={fullEditData} onChange={fullEditField} />
                    <FInput field="category" label="Category (OM / OBC / SC / ST)" data={fullEditData} onChange={fullEditField} />
                    <FInput field="qualification" label="Highest Qualification" data={fullEditData} onChange={fullEditField} />
                    <FInput field="bed" label="B.Ed Completed? (Yes / No)" data={fullEditData} onChange={fullEditField} />
                    <FInput field="health_issues" label="Health / Security Grounds" data={fullEditData} onChange={fullEditField} />
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Deployment Status</label>
                      <select
                        value={fullEditData.if_deployed || 'No'}
                        onChange={(e) => fullEditField('if_deployed', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-400"
                      >
                        <option value="No">No Deployment</option>
                        <option value="in">Deployed In → (from another school, works here)</option>
                        <option value="out">Deployed Out ← (our employee, sent to another school)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={panelLabel} style={panelLabelStyle}>Permanent Address</label>
                      <input type="text" value={fullEditData.permanent_address || ''} onChange={e => fullEditField('permanent_address', e.target.value)}
                        className={panelInput} style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={panelLabel} style={panelLabelStyle}>Present Address</label>
                      <input type="text" value={fullEditData.present_address || ''} onChange={e => fullEditField('present_address', e.target.value)}
                        className={panelInput} style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={panelLabel} style={panelLabelStyle}>Profile / Bio (Optional)</label>
                      <textarea value={fullEditData.profile || ''} onChange={e => fullEditField('profile', e.target.value)} rows={3}
                        className={panelInput + ' resize-none'} style={panelInputStyle}
                        onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, panelInputStyle)} />
                    </div>
                  </div>
                </section>

                {/* Section: Photo */}
                <section>
                  <h4 className={sectionHeader}>
                    <span style={divider} />
                    <span style={sectionTitleStyle}>Photo</span>
                    <span style={divider} />
                  </h4>
                  <div className="flex gap-4 items-start">
                    {fullEditData.photo && (
                      <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid #334155', background: '#020617' }}>
                        <img src={fullEditData.photo} alt="Preview" className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <div>
                        <label className={panelLabel} style={panelLabelStyle}>Photo URL / Path</label>
                        <input type="text" value={fullEditData.photo || ''} onChange={e => fullEditField('photo', e.target.value)}
                          placeholder="/slides/photo.jpg or https://..." className={panelInput + ' font-mono'} style={panelInputStyle}
                          onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, panelInputStyle)} />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className={panelLabel} style={panelLabelStyle}>Upload New Photo (Max 100KB)</label>
                          <input type="text" placeholder="Filename (e.g. sheikh_gulfam)" value={fullEditPhotoName}
                            onChange={e => setFullEditPhotoName(sanitizePhotoFilename(e.target.value))}
                            className={panelInput} style={panelInputStyle}
                            onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                            onBlur={e => Object.assign(e.target.style, panelInputStyle)} />
                        </div>
                        <label className="self-end px-3 py-1.5 rounded text-[10px] font-extrabold cursor-pointer transition-all border whitespace-nowrap hover:scale-[1.02]"
                          style={fullEditPhotoFile
                            ? { background: '#10b981', borderColor: '#34d399', color: '#020617' }
                            : { background: '#f97316', borderColor: '#fb923c', color: '#020617' }}>
                          {fullEditPhotoFile ? 'Loaded ✓' : 'Choose File'}
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files[0]; if (!file) return;
                            if (file.size > 102400) { showAlert(`File is ${Math.round(file.size / 1024)}KB — max is 100KB.`, 'File Too Large'); e.target.value = ''; return; }
                            setFullEditPhotoFile(file); setFullEditPhotoExt(getMimeExtension(file.type, file.name));
                            if (!fullEditPhotoName) setFullEditPhotoName(sanitizePhotoFilename(fullEditData.name || 'teacher_photo'));
                          }} />
                        </label>
                      </div>
                      {fullEditPhotoFile && <p className="text-[10px] font-semibold" style={{ color: '#34d399' }}>{fullEditPhotoFile.name} ({Math.round(fullEditPhotoFile.size / 1024)}KB)</p>}
                    </div>
                  </div>
                </section>

                {/* Section: Posting History */}
                <section>
                  <h4 className={sectionHeader}>
                    <span style={divider} />
                    <span style={sectionTitleStyle}>Historical Posting Profile</span>
                    <span style={divider} />
                  </h4>
                  <div className="space-y-2">
                    {(fullEditData.postings || []).map((p, pi) => (
                      <div key={pi} className="rounded-lg p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2"
                        style={{ background: '#1e293b', border: '1px solid #334155' }}>
                        <div className="sm:col-span-2">
                          <label className={panelLabel} style={panelLabelStyle}>Office / Institution</label>
                          <input type="text" value={p.office || ''} onChange={e => updatePosting(pi, 'office', e.target.value)}
                            className="w-full px-2 py-1 rounded text-[11px] focus:outline-none transition-colors"
                            style={{ background: '#020617', border: '1px solid #334155', color: '#f1f5f9' }}
                            onFocus={e => e.target.style.borderColor = '#f97316'}
                            onBlur={e => e.target.style.borderColor = '#334155'} />
                        </div>
                        <div>
                          <label className={panelLabel} style={panelLabelStyle}>Designation</label>
                          <input type="text" value={p.designation || ''} onChange={e => updatePosting(pi, 'designation', e.target.value)}
                            className="w-full px-2 py-1 rounded text-[11px] focus:outline-none transition-colors"
                            style={{ background: '#020617', border: '1px solid #334155', color: '#f1f5f9' }}
                            onFocus={e => e.target.style.borderColor = '#f97316'}
                            onBlur={e => e.target.style.borderColor = '#334155'} />
                        </div>
                        <div className="flex gap-1.5 items-end">
                          <div className="flex-1">
                            <label className={panelLabel} style={panelLabelStyle}>From</label>
                            <input type="text" value={p.from || ''} onChange={e => updatePosting(pi, 'from', e.target.value)}
                              className="w-full px-2 py-1 rounded text-[11px] focus:outline-none transition-colors"
                              style={{ background: '#020617', border: '1px solid #334155', color: '#f1f5f9' }}
                              onFocus={e => e.target.style.borderColor = '#f97316'}
                              onBlur={e => e.target.style.borderColor = '#334155'} />
                          </div>
                          <div className="flex-1">
                            <label className={panelLabel} style={panelLabelStyle}>To</label>
                            <input type="text" value={p.to || ''} onChange={e => updatePosting(pi, 'to', e.target.value)}
                              className="w-full px-2 py-1 rounded text-[11px] focus:outline-none transition-colors"
                              style={{ background: '#020617', border: '1px solid #334155', color: '#f1f5f9' }}
                              onFocus={e => e.target.style.borderColor = '#f97316'}
                              onBlur={e => e.target.style.borderColor = '#334155'} />
                          </div>
                          <button onClick={() => removePosting(pi)} className="mb-0.5 p-1.5 rounded transition-colors flex-shrink-0"
                            style={{ color: '#f87171' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title="Remove this posting">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button onClick={addPosting}
                      className="w-full py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      style={{ border: '1px dashed #475569', color: '#94a3b8' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#fb923c'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#94a3b8'; }}>
                      <Plus size={12} /> Add Posting Entry
                    </button>
                  </div>
                </section>

                {/* Section: Custom / Additional Fields */}
                <section>
                  <h4 className={sectionHeader}>
                    <span style={divider} />
                    <span style={sectionTitleStyle}>Additional / Custom Fields</span>
                    <span style={divider} />
                  </h4>
                  <div className="space-y-3">
                    {/* List existing custom fields */}
                    {Object.keys(fullEditData.customFields || {}).length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.keys(fullEditData.customFields || {}).map((key) => (
                          <div key={key}>
                            <label className={panelLabel} style={panelLabelStyle}>{key}</label>
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text"
                                value={fullEditData.customFields[key] || ''}
                                onChange={(e) => {
                                  const updatedCustom = { ...fullEditData.customFields, [key]: e.target.value };
                                  fullEditField('customFields', updatedCustom);
                                }}
                                className={panelInput}
                                style={panelInputStyle}
                                onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                                onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                              />
                              <button
                                onClick={() => {
                                  const updatedCustom = { ...fullEditData.customFields };
                                  delete updatedCustom[key];
                                  fullEditField('customFields', updatedCustom);
                                }}
                                className="p-1.5 rounded text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors flex-shrink-0"
                                style={{ border: '1px solid #334155' }}
                                title={`Remove field "${key}"`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add a new custom field inline builder */}
                    <div className="p-3 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 flex flex-col sm:flex-row gap-2.5 items-end">
                      <div className="flex-grow w-full">
                        <label className={panelLabel} style={panelLabelStyle}>New Field Name</label>
                        <input
                          id="new-custom-field-key"
                          type="text"
                          placeholder="e.g. PAN No, Aadhar No, Gender"
                          className={panelInput}
                          style={panelInputStyle}
                          onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                        />
                      </div>
                      <div className="flex-grow w-full">
                        <label className={panelLabel} style={panelLabelStyle}>Value</label>
                        <input
                          id="new-custom-field-val"
                          type="text"
                          placeholder="Enter value..."
                          className={panelInput}
                          style={panelInputStyle}
                          onFocus={e => Object.assign(e.target.style, panelInputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, panelInputStyle)}
                        />
                      </div>
                      <button
                        onClick={() => {
                          const keyInput = document.getElementById('new-custom-field-key');
                          const valInput = document.getElementById('new-custom-field-val');
                          const key = keyInput.value.trim();
                          const val = valInput.value.trim();
                          if (!key) {
                            showAlert('Please enter a name for the custom field.', 'Field Name Required');
                            return;
                          }
                          const updatedCustom = { ...(fullEditData.customFields || {}), [key]: val };
                          fullEditField('customFields', updatedCustom);
                          keyInput.value = '';
                          valInput.value = '';
                        }}
                        className="px-3.5 py-1.5 rounded font-extrabold text-xs transition-all border shrink-0 text-slate-950 hover:scale-[1.02] active:scale-[0.98]"
                        style={{ background: '#f97316', borderColor: '#fb923c' }}
                      >
                        Add Field
                      </button>
                    </div>
                  </div>
                </section>

              </div>{/* end scrollable body */}

              {/* Footer Actions */}
              <div className="flex justify-between items-center px-5 py-3 flex-shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
                <p className="text-[10px] hidden sm:block" style={{ color: '#64748b' }}>
                  Changes apply in memory. Click{' '}
                  <strong style={{ color: '#34d399' }}>Apply &amp; Save</strong> in the header to persist.
                </p>
                <div className="flex gap-2 ml-auto">
                  <button onClick={closeFullEdit}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    style={{ background: '#1e293b', border: '1px solid #475569', color: '#cbd5e1' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#cbd5e1'; }}>
                    Cancel
                  </button>
                  <button onClick={saveFullEdit}
                    className="px-4 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: '#f97316', border: '1px solid #fb923c', color: '#020617' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fb923c'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f97316'}>
                    <Check size={14} /> Save Record
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM PROMPT/ALERT MODAL */}
        {customPrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5 text-orange-400 font-bold border-b border-slate-800 pb-2 mb-3">
                <AlertCircle size={18} className="flex-shrink-0" />
                <h3 className="text-sm uppercase tracking-wider font-title">{customPrompt.title}</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">{customPrompt.message}</p>
              <div className="flex justify-end gap-2">
                {customPrompt.type === 'confirm' && (
                  <button
                    onClick={customPrompt.onCancel}
                    className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold btn-cancel-custom transition-colors border"
                  >
                    {customPrompt.cancelText || 'Cancel'}
                  </button>
                )}
                <button
                  onClick={customPrompt.onConfirm}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-extrabold transition-all hover:scale-[1.02] active:scale-[0.98] ${customPrompt.confirmClass || 'btn-primary-custom shadow-md'}`}
                >
                  {customPrompt.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
