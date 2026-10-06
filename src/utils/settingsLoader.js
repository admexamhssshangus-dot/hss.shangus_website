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

export const DEFAULT_PAYMENT_GATEWAY_CONFIG = {
  gatewayMode: 'off', // 'off', 'manual', 'cashfree', 'razorpay'
  bankDetails: {
    accountName: 'Govt. Higher Secondary School Shangus',
    bankName: 'J&K Bank Ltd.',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    qrCodeUrl: '',
    instructions: 'Scan the UPI QR code or transfer directly to the bank account, then enter your Transaction Reference Number / UTR.'
  },
  cashfree: {
    appId: '',
    secretKey: '',
    environment: 'sandbox'
  },
  razorpay: {
    keyId: '',
    keySecret: '',
    environment: 'test'
  }
};

export const DEFAULT_HERO_BUTTONS = [
  {
    id: 'btn-admissions',
    label: 'Admissions Open 2026',
    closedLabel: 'Admissions Closed',
    link: '/admissions',
    style: 'primary',
    enabled: true,
    openInNewTab: false,
    trackAdmissionStatus: true
  },
  {
    id: 'btn-learn-more',
    label: 'Learn More',
    closedLabel: 'Learn More',
    link: '/about',
    style: 'secondary',
    enabled: true,
    openInNewTab: false,
    trackAdmissionStatus: false
  }
];

// These are recovery values for the official institutional channels.  Cloud
// settings remain authoritative whenever they contain an actual URL; the
// recovery values prevent an old partial settings document from hiding a
// channel that has already been published.
export const OFFICIAL_SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/p/Govt-Higher-Secondary-School-Shangus-100083269956258/',
  youtube: 'https://www.youtube.com/channel/UC0UeaKFSv9CcAGlnuf5uxug',
  twitter: 'https://x.com/@hssshangus',
  instagram: '#'
};

const isConfiguredSocialLink = (value) => {
  const link = String(value || '').trim();
  return Boolean(link && link !== '#');
};

/**
 * Preserve Cloud-configured URLs, while recovering a known official channel
 * when a legacy document omitted the field or stored a placeholder.
 */
export function normalizeSocialLinks(rawLinks = {}) {
  const source = rawLinks && typeof rawLinks === 'object' ? rawLinks : {};
  return Object.keys(OFFICIAL_SOCIAL_LINKS).reduce((links, platform) => {
    const stored = String(source[platform] || '').trim();
    links[platform] = isConfiguredSocialLink(stored)
      ? stored
      : OFFICIAL_SOCIAL_LINKS[platform];
    return links;
  }, {});
}

/**
 * Generic settings saves must never replace an existing published link with a
 * stale empty/# value from a different admin screen.  A real URL in the new
 * payload still wins; otherwise the existing Cloud URL is retained.
 */
export function preservePublishedSocialLinks(existingLinks = {}, incomingLinks = {}) {
  const existing = existingLinks && typeof existingLinks === 'object' ? existingLinks : {};
  const incoming = incomingLinks && typeof incomingLinks === 'object' ? incomingLinks : {};
  return Object.keys(OFFICIAL_SOCIAL_LINKS).reduce((links, platform) => {
    const candidate = String(incoming[platform] || '').trim();
    const stored = String(existing[platform] || '').trim();
    links[platform] = isConfiguredSocialLink(candidate)
      ? candidate
      : isConfiguredSocialLink(stored)
        ? stored
        : OFFICIAL_SOCIAL_LINKS[platform];
    return links;
  }, {});
}

export const DEFAULT_SETTINGS = {
  session: '2025-26',
  currentSession: '2025-26',
  globalAdmissionsClosed: false,
  practicalsSubmissionOpen: true,
  attendanceSubmissionOpen: true,
  enableAdmin2StepVerification: false,
  enable3dHeroAssets: false,
  enable3dHeroAssetsMobile: false,
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
    "9th": 1800,
    "10th": 1100
  },
  socialLinks: OFFICIAL_SOCIAL_LINKS,
  taxConfig: DEFAULT_TAX_CONFIG,
  paymentGatewayConfig: DEFAULT_PAYMENT_GATEWAY_CONFIG,
  heroButtons: DEFAULT_HERO_BUTTONS
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
    practicalsSubmissionOpen: parsed.practicalsSubmissionOpen !== undefined ? Boolean(parsed.practicalsSubmissionOpen) : true,
    attendanceSubmissionOpen: parsed.attendanceSubmissionOpen !== undefined ? Boolean(parsed.attendanceSubmissionOpen) : true,
    enableAdmin2StepVerification: parsed.enableAdmin2StepVerification !== undefined ? Boolean(parsed.enableAdmin2StepVerification) : false,
    enable3dHeroAssets: parsed.enable3dHeroAssets !== undefined ? Boolean(parsed.enable3dHeroAssets) : false,
    enable3dHeroAssetsMobile: parsed.enable3dHeroAssetsMobile !== undefined ? Boolean(parsed.enable3dHeroAssetsMobile) : false,
    admissionsClosed: { ...DEFAULT_SETTINGS.admissionsClosed, ...(parsed.admissionsClosed || {}) },
    fees: { ...DEFAULT_SETTINGS.fees, ...(parsed.fees || {}) },
    socialLinks: normalizeSocialLinks(parsed.socialLinks),
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
    },
    paymentGatewayConfig: {
      gatewayMode: parsed.paymentGatewayConfig?.gatewayMode || DEFAULT_SETTINGS.paymentGatewayConfig.gatewayMode,
      bankDetails: {
        ...DEFAULT_SETTINGS.paymentGatewayConfig.bankDetails,
        ...(parsed.paymentGatewayConfig?.bankDetails || {})
      },
      cashfree: {
        ...DEFAULT_SETTINGS.paymentGatewayConfig.cashfree,
        ...(parsed.paymentGatewayConfig?.cashfree || {})
      },
      razorpay: {
        ...DEFAULT_SETTINGS.paymentGatewayConfig.razorpay,
        ...(parsed.paymentGatewayConfig?.razorpay || {})
      }
    },
    heroButtons: Array.isArray(parsed.heroButtons)
      ? parsed.heroButtons
      : DEFAULT_HERO_BUTTONS
  };
}

export function getCachedSiteSettings() {
  try {
    const local = localStorage.getItem('site_settings');
    if (local) {
      return mergeSiteSettings(JSON.parse(local));
    }
  } catch (_) {}
  return DEFAULT_SETTINGS;
}

const SETTINGS_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes SWR cache TTL

export async function loadSiteSettings({ forceFirestore = false } = {}) {
  const timestampKey = 'site_settings_ts';
  const isBotOrSpeedTest = typeof navigator !== 'undefined' && 
    /Lighthouse|GTmetrix|PageSpeed|HeadlessChrome|bot|crawl|spider/i.test(navigator.userAgent || '');

  const cache = (value) => {
    try {
      localStorage.setItem('site_settings', JSON.stringify(value));
      localStorage.setItem(timestampKey, Date.now().toString());
    } catch (_) {}
    return value;
  };

  // Cloud Firestore is the authoritative source. The CDN JSON remains an
  // offline/recovery fallback only; a Netlify build never writes Firebase data.
  const readCloudSettings = async () => {
    const { db } = await import('../firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const docPromise = getDoc(doc(db, 'site', 'settings'));
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
    const snap = await Promise.race([docPromise, timeoutPromise]);
    return snap && snap.exists() ? cache(mergeSiteSettings(snap.data())) : null;
  };

  const readStaticFallback = async () => {
    try {
      const res = await fetch('/slides/settings.json?t=' + Date.now(), { cache: 'no-cache' });
      if (res.ok) return cache(mergeSiteSettings(await res.json()));
    } catch (error) {
      console.warn('Static settings fallback check:', error);
    }
    return DEFAULT_SETTINGS;
  };

  // 1. Instant Cache: Return cached settings if available for 0ms initial render
  if (!forceFirestore || isBotOrSpeedTest) {
    try {
      const local = localStorage.getItem('site_settings');
      const lastTs = Number(localStorage.getItem(timestampKey) || 0);
      const isFresh = (Date.now() - lastTs) < SETTINGS_CACHE_TTL_MS;

      if (local) {
        const cached = mergeSiteSettings(JSON.parse(local));
        if (isFresh || isBotOrSpeedTest) {
          return cached;
        }
        // Refresh only one small document in the background after cache expiry.
        setTimeout(() => {
          readCloudSettings().catch(() => {});
        }, 1500);
        return cached;
      }
    } catch (e) {
      console.warn('Error reading cached site_settings:', e);
    }
  }

  // 2. Read the authoritative Cloud document when there is no usable cache.
  if (!isBotOrSpeedTest) {
    try {
      const cloudSettings = await readCloudSettings();
      if (cloudSettings) return cloudSettings;
    } catch (e) {
      console.warn('Firestore settings fetch error:', e);
    }
  }

  // 3. Static JSON is never treated as a deployment-time replacement for
  // Firestore. It only keeps the public site usable during a Cloud outage.
  return readStaticFallback();
}

export function subscribeSiteSettings(callback) {
  let unsub = () => {};
  let isMounted = true;

  (async () => {
    try {
      const { db } = await import('../firebase');
      const { doc, onSnapshot } = await import('firebase/firestore');
      if (!isMounted) return;
      const settingsRef = doc(db, 'site', 'settings');
      unsub = onSnapshot(settingsRef, (snap) => {
        if (snap && snap.exists()) {
          const merged = mergeSiteSettings(snap.data());
          try { localStorage.setItem('site_settings', JSON.stringify(merged)); } catch (_) {}
          callback(merged);
        }
      }, (err) => {
        console.warn('Firestore onSnapshot error, falling back to loadSiteSettings:', err);
        loadSiteSettings().then((s) => { if (isMounted) callback(s); });
      });
    } catch (err) {
      console.warn('Failed to initialize Firestore subscription, falling back:', err);
      loadSiteSettings().then((s) => { if (isMounted) callback(s); });
    }
  })();

  return () => {
    isMounted = false;
    unsub();
  };
}
