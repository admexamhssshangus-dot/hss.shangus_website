// Default settings fallback
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
  }
};

export async function loadSiteSettings() {
  // 1. Check local storage override first (for admin instant testing)
  const local = localStorage.getItem('site_settings');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        admissionsClosed: { ...DEFAULT_SETTINGS.admissionsClosed, ...parsed.admissionsClosed },
        fees: { ...DEFAULT_SETTINGS.fees, ...parsed.fees }
      };
    } catch (e) {
      console.error('Error parsing site_settings from localStorage', e);
    }
  }

  // 2. Fetch from server
  try {
    const res = await fetch('/slides/settings.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        admissionsClosed: { ...DEFAULT_SETTINGS.admissionsClosed, ...data.admissionsClosed },
        fees: { ...DEFAULT_SETTINGS.fees, ...data.fees }
      };
    }
  } catch (e) {
    console.warn('Could not load settings.json from server', e);
  }

  return DEFAULT_SETTINGS;
}
