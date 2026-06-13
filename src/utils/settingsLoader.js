// Default settings fallback
const DEFAULT_TAX_CONFIG = {
  financialYearLabel: '2025-26',
  assessmentYearLabel: '2026-27',
  cessRate: 4,
  newRegime: {
    label: 'New Tax Regime',
    standardDeduction: 75000,
    rebateThreshold: 1200000,
    rebateMax: 60000,
    marginalReliefEnabled: true,
    includeSurcharge: true,
    slabs: [
      { label: 'Up to Rs 4 lakh', upto: 400000, rate: 0 },
      { label: 'Rs 4 lakh to Rs 8 lakh', upto: 800000, rate: 5 },
      { label: 'Rs 8 lakh to Rs 12 lakh', upto: 1200000, rate: 10 },
      { label: 'Rs 12 lakh to Rs 16 lakh', upto: 1600000, rate: 15 },
      { label: 'Rs 16 lakh to Rs 20 lakh', upto: 2000000, rate: 20 },
      { label: 'Rs 20 lakh to Rs 24 lakh', upto: 2400000, rate: 25 },
      { label: 'Above Rs 24 lakh', upto: null, rate: 30 }
    ],
    surchargeBrackets: [
      { label: 'Rs 50 lakh to Rs 1 crore', threshold: 5000000, rate: 10 },
      { label: 'Rs 1 crore to Rs 2 crore', threshold: 10000000, rate: 15 },
      { label: 'Above Rs 2 crore', threshold: 20000000, rate: 25 }
    ]
  },
  oldRegime: {
    label: 'Old Tax Regime',
    standardDeduction: 50000,
    rebateThreshold: 500000,
    rebateMax: 12500,
    marginalReliefEnabled: false,
    includeSurcharge: true,
    slabs: [
      { label: 'Up to Rs 2.5 lakh', upto: 250000, rate: 0 },
      { label: 'Rs 2.5 lakh to Rs 5 lakh', upto: 500000, rate: 5 },
      { label: 'Rs 5 lakh to Rs 10 lakh', upto: 1000000, rate: 20 },
      { label: 'Above Rs 10 lakh', upto: null, rate: 30 }
    ],
    surchargeBrackets: [
      { label: 'Rs 50 lakh to Rs 1 crore', threshold: 5000000, rate: 10 },
      { label: 'Rs 1 crore to Rs 2 crore', threshold: 10000000, rate: 15 },
      { label: 'Rs 2 crore to Rs 5 crore', threshold: 20000000, rate: 25 },
      { label: 'Above Rs 5 crore', threshold: 50000000, rate: 37 }
    ]
  }
};

export const DEFAULT_SETTINGS = {
  globalAdmissionsClosed: false,
  defaultNewNoticeDays: 7,
  admissionsClosed: {
    "9th": false,
    "10th": false,
    "11th": false,
    "12th": false
  },
  fees: {
    "11th_science_boys": 1900,
    "11th_science_girls": 1700,
    "11th_humanities_boys": 1800,
    "11th_humanities_girls": 1600,
    "12th_science_boys": 1650,
    "12th_science_girls": 1650,
    "12th_humanities_boys": 1550,
    "12th_humanities_girls": 1550,
    "9th": 1700,
    "10th": 1700
  },
  socialLinks: {
    facebook: 'https://www.facebook.com/p/Govt-Higher-Secondary-School-Shangus-100083269956258/',
    youtube: '#',
    twitter: '#',
    instagram: '#'
  },
  taxConfig: DEFAULT_TAX_CONFIG
};

export function mergeSiteSettings(parsed = {}) {
  const parsedTax = parsed.taxConfig || {};
  
  // Migration logic: convert old flat schema to nested multi-regime schema
  let newRegimeParsed = parsedTax.newRegime || {};
  let oldRegimeParsed = parsedTax.oldRegime || {};

  if (!parsedTax.newRegime && (parsedTax.slabs || parsedTax.standardDeduction !== undefined)) {
    newRegimeParsed = {
      label: parsedTax.regimeLabel || DEFAULT_SETTINGS.taxConfig.newRegime.label,
      standardDeduction: parsedTax.standardDeduction,
      rebateThreshold: parsedTax.rebateThreshold,
      rebateMax: parsedTax.rebateMax,
      marginalReliefEnabled: parsedTax.marginalReliefEnabled,
      includeSurcharge: parsedTax.includeSurcharge,
      slabs: parsedTax.slabs,
      surchargeBrackets: parsedTax.surchargeBrackets
    };
  }

  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    admissionsClosed: { ...DEFAULT_SETTINGS.admissionsClosed, ...(parsed.admissionsClosed || {}) },
    fees: { ...DEFAULT_SETTINGS.fees, ...(parsed.fees || {}) },
    socialLinks: { ...DEFAULT_SETTINGS.socialLinks, ...(parsed.socialLinks || {}) },
    taxConfig: {
      financialYearLabel: parsedTax.financialYearLabel || DEFAULT_SETTINGS.taxConfig.financialYearLabel,
      assessmentYearLabel: parsedTax.assessmentYearLabel || DEFAULT_SETTINGS.taxConfig.assessmentYearLabel,
      cessRate: parsedTax.cessRate !== undefined ? parsedTax.cessRate : DEFAULT_SETTINGS.taxConfig.cessRate,
      newRegime: {
        ...DEFAULT_SETTINGS.taxConfig.newRegime,
        ...newRegimeParsed,
        slabs: Array.isArray(newRegimeParsed.slabs) && newRegimeParsed.slabs.length > 0
          ? newRegimeParsed.slabs.map((slab, index) => ({
              ...(DEFAULT_SETTINGS.taxConfig.newRegime.slabs[index] || {}),
              ...slab
            }))
          : DEFAULT_SETTINGS.taxConfig.newRegime.slabs,
        surchargeBrackets: Array.isArray(newRegimeParsed.surchargeBrackets) && newRegimeParsed.surchargeBrackets.length > 0
          ? newRegimeParsed.surchargeBrackets.map((bracket, index) => ({
              ...(DEFAULT_SETTINGS.taxConfig.newRegime.surchargeBrackets[index] || {}),
              ...bracket
            }))
          : DEFAULT_SETTINGS.taxConfig.newRegime.surchargeBrackets
      },
      oldRegime: {
        ...DEFAULT_SETTINGS.taxConfig.oldRegime,
        ...oldRegimeParsed,
        slabs: Array.isArray(oldRegimeParsed.slabs) && oldRegimeParsed.slabs.length > 0
          ? oldRegimeParsed.slabs.map((slab, index) => ({
              ...(DEFAULT_SETTINGS.taxConfig.oldRegime.slabs[index] || {}),
              ...slab
            }))
          : DEFAULT_SETTINGS.taxConfig.oldRegime.slabs,
        surchargeBrackets: Array.isArray(oldRegimeParsed.surchargeBrackets) && oldRegimeParsed.surchargeBrackets.length > 0
          ? oldRegimeParsed.surchargeBrackets.map((bracket, index) => ({
              ...(DEFAULT_SETTINGS.taxConfig.oldRegime.surchargeBrackets[index] || {}),
              ...bracket
            }))
          : DEFAULT_SETTINGS.taxConfig.oldRegime.surchargeBrackets
      }
    }
  };
}

export async function loadSiteSettings() {
  // 1. Check local storage override first (for admin instant testing)
  const local = localStorage.getItem('site_settings');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      return mergeSiteSettings(parsed);
    } catch (e) {
      console.error('Error parsing site_settings from localStorage', e);
    }
  }

  // 2. Fetch from server
  try {
    const res = await fetch('/slides/settings.json?t=' + Date.now(), { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      return mergeSiteSettings(data);
    }
  } catch (e) {
    console.warn('Could not load settings.json from server', e);
  }

  return DEFAULT_SETTINGS;
}
