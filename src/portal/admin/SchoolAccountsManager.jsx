import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, ChevronRight,
  Calculator, FileText, Printer, Download, Search, Edit3, 
  Check, X, ChevronDown, Sliders, RefreshCw, AlertCircle, 
  Shield, CheckSquare, Square, FileSpreadsheet,
  Users, Info, Settings, Sparkles, History,
  ShieldAlert, Lock, UserPlus, ArrowRight, CheckCircle2
} from 'lucide-react';
import { db, auth } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_SETTINGS, loadSiteSettings } from '../../utils/settingsLoader';
import { toPublicFacultyList } from '../../utils/facultyPrivacy';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { showToast } from '../../components/common/GlobalToast';
import ClerkStaffDocumentsWorkspace from './ClerkStaffDocumentsWorkspace';
import { fetchGeneratedDocHistory } from '../../services/docHistoryService';
import { getStaffPensionScheme, applyPensionSchemeToEmployee } from '../../utils/staffPensionHelper';

// --- TAX CALCULATION LOGIC (Admin & Accounts-configurable rules) ---
export const sanitizeTaxConfig = (rawConfig) => {
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

export const calculateTaxFromTaxableIncome = (taxableIncomeInput, rawTaxConfig, regimeType = 'new') => {
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

  const marginalRelief = regimeConfig.marginalReliefEnabled && taxableIncome > regimeConfig.rebateThreshold
    ? Math.max(0, tax - (taxableIncome - regimeConfig.rebateThreshold))
    : 0;

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

export const calculateTax = (grossSalary, tdsUpToDate, rawTaxConfig, options = {}) => {
  const fullTaxConfig = sanitizeTaxConfig(rawTaxConfig);
  const regimeType = options.regime === 'old' ? 'old' : 'new';
  const regimeConfig = regimeType === 'old' ? fullTaxConfig.oldRegime : fullTaxConfig.newRegime;

  const gross = Math.max(0, Number(grossSalary) || 0);
  const tds = Math.max(0, Number(tdsUpToDate) || 0);

  const deduction80C = regimeType === 'old' ? Math.min(150000, Math.max(0, Number(options.deduction80C) || 0)) : 0;
  const deduction80D = regimeType === 'old' ? Math.max(0, Number(options.deduction80D) || 0) : 0;
  const hraExemption = regimeType === 'old' ? Math.max(0, Number(options.hraExemption) || 0) : 0;
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

const TAX_CATEGORIES = [
  { key: 'teaching_regular', label: 'Teaching (Active & Regular)', color: 'bg-blue-600 border-blue-500' },
  { key: 'non_teaching_regular', label: 'Non-Teaching (Active & Regular)', color: 'bg-violet-600 border-violet-600' },
  { key: 'deployed_in', label: 'Deployed In', color: 'bg-emerald-600 border-emerald-500' },
  { key: 'deployed_out', label: 'Deployed Out', color: 'bg-amber-600 border-amber-500' },
  { key: 'retired', label: 'Retired', color: 'bg-red-600 border-red-500' },
  { key: 'transferred', label: 'Transferred', color: 'bg-slate-600 border-slate-500' },
  { key: 'other_inactive', label: 'Drawing Pay / Other Inactive', color: 'bg-gray-600 border-gray-500' }
];

export default function SchoolAccountsManager({ user }) {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const accTab = urlParams.get('accountTab');
      if (accTab && ['staff_directory', 'tax_calculator', 'staff_letterhead', 'staff_rosters', 'dispatch_history'].includes(accTab)) {
        return accTab;
      }
    } catch (_) {}
    return 'staff_directory'; // Staff Directory is the primary establishment view
  });
  const [loading, setLoading] = useState(true);
  const [savingTax, setSavingTax] = useState(false);
  const [faculty, setFaculty] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Staff Directory States
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryCategoryFilter, setDirectoryCategoryFilter] = useState('all'); // 'all' | 'teaching' | 'non_teaching' | 'nps' | 'gpf' | 'deployed'
  const [editingStaffMember, setEditingStaffMember] = useState(null);
  const [expandedStaffId, setExpandedStaffId] = useState(null);
  const [editingStaffIndex, setEditingStaffIndex] = useState(null);
  const [isNewStaffRecord, setIsNewStaffRecord] = useState(false);
  const [staffModalFormData, setStaffModalFormData] = useState({
    name: '',
    designation: '',
    department: '',
    cadre: 'Teaching',
    cpis_no: '',
    pan: '',
    phone: '',
    email: '',
    pension_scheme: 'NPS',
    grossSalary: '',
    tds: '0',
    regime: 'new',
    deduction80C: '0',
    deduction80D: '0',
    hraExemption: '0',
    otherDeductions: '0',
    if_deployed: 'No',
    inactiveReason: ''
  });

  // Clerk Permission & Security Confirmation Modal State
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [pendingCommitDetails, setPendingCommitDetails] = useState(null);
  const [isSavingCommit, setIsSavingCommit] = useState(false);

  // Tax States
  const [taxSearch, setTaxSearch] = useState('');
  const [selectedTaxCategories, setSelectedTaxCategories] = useState(['teaching_regular', 'non_teaching_regular']);
  const [isTaxFilterDropdownOpen, setIsTaxFilterDropdownOpen] = useState(false);
  const [selectedTaxEmployeeIndices, setSelectedTaxEmployeeIndices] = useState([]);
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

  const [activeRegimeSettingsTab, setActiveRegimeSettingsTab] = useState('new');
  const [activeTaxPreviewRegime, setActiveTaxPreviewRegime] = useState('new');
  const [showTaxRules, setShowTaxRules] = useState(false);
  const [clerkHistoryCount, setClerkHistoryCount] = useState(0);

  // Load live clerk history count for badge
  useEffect(() => {
    let isMounted = true;
    fetchGeneratedDocHistory({ docType: 'all', limitCount: 300 })
      .then((allDocs) => {
        if (!isMounted) return;
        const clerkOnly = (allDocs || []).filter(d => {
          const isClerkDocType = d.docType === 'clerk_staff_letter' || d.docType === 'clerk_staff_roster';
          const isClerkScope = d.extraData?.authorScope === 'accounts_clerk' || d.extraData?.authorRole === 'clerk';
          return isClerkDocType || isClerkScope;
        });
        setClerkHistoryCount(clerkOnly.length);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [activeTab]);

  // Load Settings & Faculty Data
  const loadAccountsData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const loaded = await loadSiteSettings({ forceFirestore: true });
      setSettings(loaded);

      let facultyList = [];

      // 1. Try systemSettings/facultyPrivate (Authoritative private staff records)
      try {
        const snap = await getDoc(doc(db, 'systemSettings', 'facultyPrivate'));
        if (snap.exists()) {
          const data = snap.data();
          const list = data?.items || data?.members || data?.faculty;
          if (Array.isArray(list) && list.length > 0) {
            facultyList = list;
          }
        }
      } catch (e) {
        console.warn('Could not load systemSettings/facultyPrivate:', e);
      }

      // 2. Try site/faculty fallback (Legacy private staff records)
      if (facultyList.length === 0) {
        try {
          const legacySnap = await getDoc(doc(db, 'site', 'faculty'));
          if (legacySnap.exists()) {
            const legacyData = legacySnap.data();
            const list = legacyData?.items || legacyData?.members || legacyData?.faculty;
            if (Array.isArray(list) && list.length > 0) {
              facultyList = list;
            }
          }
        } catch (e) {
          console.warn('Could not load site/faculty:', e);
        }
      }

      // 3. Try localStorage cache
      if (facultyList.length === 0) {
        try {
          const cached = localStorage.getItem('site_faculty');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              facultyList = parsed;
            }
          }
        } catch (e) {
          console.warn('Could not parse localStorage site_faculty:', e);
        }
      }

      // 4. Try /slides/faculty.json fallback
      if (facultyList.length === 0) {
        try {
          const r = await fetch('/slides/faculty.json?t=' + Date.now(), { cache: 'no-cache' });
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) {
            facultyList = data;
          }
        } catch (e) {
          console.warn('Could not load /slides/faculty.json:', e);
        }
      }

      setFaculty(facultyList);
      if (forceRefresh) {
        showToast(`Loaded ${facultyList.length} staff records successfully!`, 'success');
      }
    } catch (err) {
      console.error('Error loading school accounts data:', err);
      showToast('Could not load accounts data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountsData();
  }, []);

  const taxConfig = useMemo(() => sanitizeTaxConfig(settings.taxConfig), [settings.taxConfig]);
  const previewRegimeConfig = activeTaxPreviewRegime === 'old' ? taxConfig.oldRegime : taxConfig.newRegime;
  const activeRegimeConfig = activeRegimeSettingsTab === 'old' ? taxConfig.oldRegime : taxConfig.newRegime;

  // Helper Employee Getters
  const isNonTeaching = (emp) => {
    const d = (emp.designation || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    return dept === 'mts' || d.includes('mts') || d.includes('lab assistant') ||
      d.includes('lab bearer') || d.includes('library bearer') ||
      d.includes('peon') || d.includes('chowkidar') || d.includes('safaiwalla') ||
      d.includes('class iv') || d.includes('driver') || d.includes('attendant');
  };

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

  const getEmployeeGross = (emp) => {
    return parseFloat(emp.grossSalary) ||
      parseFloat(emp.customFields?.['Gross Salary']) ||
      parseFloat(emp.customFields?.grossSalary) || 0;
  };

  const getEmployeeTds = (emp) => {
    return parseFloat(emp.tds) ||
      parseFloat(emp.customFields?.TDS) ||
      parseFloat(emp.customFields?.tds) || 0;
  };

  const getEmployeePan = (emp) => {
    return emp.pan || emp.customFields?.PAN || emp.customFields?.pan || '';
  };

  const getEmployeeRegime = (emp) => {
    return emp.taxRegime || emp.customFields?.['Tax Regime'] || 'new';
  };

  const getEmployee80C = (emp) => {
    return parseFloat(emp.deduction80C) || parseFloat(emp.customFields?.['80C Deductions']) || 0;
  };

  const getEmployee80D = (emp) => {
    return parseFloat(emp.deduction80D) || parseFloat(emp.customFields?.['80D Deductions']) || 0;
  };

  const getEmployeeHra = (emp) => {
    return parseFloat(emp.hraExemption) || parseFloat(emp.customFields?.['HRA Exemption']) || 0;
  };

  const getEmployeeOtherDeductions = (emp) => {
    return parseFloat(emp.otherDeductions) || parseFloat(emp.customFields?.['Other Deductions']) || 0;
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

  // Initialize selection with active regular staff
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

  // Filtered employees for display
  const filteredFaculty = useMemo(() => {
    return faculty.filter((emp) => {
      const q = taxSearch.toLowerCase().trim();
      const matchSearch = !q ||
        (emp.name || '').toLowerCase().includes(q) ||
        (emp.designation || '').toLowerCase().includes(q) ||
        (emp.cpis_no || '').toLowerCase().includes(q) ||
        getEmployeePan(emp).toLowerCase().includes(q);

      const category = getEmployeeTaxCategory(emp);
      const matchCat = selectedTaxCategories.includes(category);

      return matchSearch && matchCat;
    });
  }, [faculty, taxSearch, selectedTaxCategories]);

  // Multi-select helpers
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

  // Staff Directory Filtering
  const filteredDirectoryFaculty = useMemo(() => {
    return faculty.filter((emp) => {
      const q = directorySearch.toLowerCase().trim();
      const matchSearch = !q ||
        (emp.name || '').toLowerCase().includes(q) ||
        (emp.designation || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q) ||
        (emp.cpis_no || emp.cpis || '').toLowerCase().includes(q) ||
        getEmployeePan(emp).toLowerCase().includes(q) ||
        (emp.phone || emp.mobile || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (directoryCategoryFilter === 'teaching') {
        return !isNonTeaching(emp) && !emp.hidden;
      }
      if (directoryCategoryFilter === 'non_teaching') {
        return isNonTeaching(emp) && !emp.hidden;
      }
      if (directoryCategoryFilter === 'nps') {
        return getStaffPensionScheme(emp) === 'NPS';
      }
      if (directoryCategoryFilter === 'gpf') {
        return getStaffPensionScheme(emp) === 'GPF';
      }
      if (directoryCategoryFilter === 'deployed') {
        return emp.if_deployed === 'in' || emp.if_deployed === 'out' || emp.if_deployed === 'Yes' || emp.hidden;
      }
      return true;
    });
  }, [faculty, directorySearch, directoryCategoryFilter]);

  // Directory Statistics
  const staffStats = useMemo(() => {
    const total = faculty.length;
    let teaching = 0;
    let nonTeaching = 0;
    let nps = 0;
    let gpf = 0;
    let deployed = 0;

    faculty.forEach((emp) => {
      if (isNonTeaching(emp)) nonTeaching++;
      else teaching++;

      if (getStaffPensionScheme(emp) === 'NPS') nps++;
      else gpf++;

      if (emp.if_deployed === 'in' || emp.if_deployed === 'out' || emp.if_deployed === 'Yes' || emp.hidden) {
        deployed++;
      }
    });

    return { total, teaching, nonTeaching, nps, gpf, deployed };
  }, [faculty]);

  // Reactive Tax calculations inside the Staff Record Modal
  const modalNewTaxCalc = useMemo(() => {
    const gross = parseFloat(staffModalFormData.grossSalary || 0);
    const tds = parseFloat(staffModalFormData.tds || 0);
    const other = parseFloat(staffModalFormData.otherDeductions || 0);
    return calculateTax(gross, tds, taxConfig, {
      regime: 'new',
      otherDeductions: other
    });
  }, [staffModalFormData.grossSalary, staffModalFormData.tds, staffModalFormData.otherDeductions, taxConfig]);

  const modalOldTaxCalc = useMemo(() => {
    const gross = parseFloat(staffModalFormData.grossSalary || 0);
    const tds = parseFloat(staffModalFormData.tds || 0);
    const ded80C = parseFloat(staffModalFormData.deduction80C || 0);
    const ded80D = parseFloat(staffModalFormData.deduction80D || 0);
    const hra = parseFloat(staffModalFormData.hraExemption || 0);
    const other = parseFloat(staffModalFormData.otherDeductions || 0);
    return calculateTax(gross, tds, taxConfig, {
      regime: 'old',
      deduction80C: ded80C,
      deduction80D: ded80D,
      hraExemption: hra,
      otherDeductions: other
    });
  }, [staffModalFormData.grossSalary, staffModalFormData.tds, staffModalFormData.deduction80C, staffModalFormData.deduction80D, staffModalFormData.hraExemption, staffModalFormData.otherDeductions, taxConfig]);

  // Centralized Firebase Save with Audit Logging and Realtime Sync
  const commitFacultyToFirebase = async (updatedFaculty, actionTitle, details, employeeName) => {
    setIsSavingCommit(true);
    try {
      await setDoc(doc(db, 'systemSettings', 'facultyPrivate'), {
        items: JSON.parse(JSON.stringify(updatedFaculty)),
        updatedAt: serverTimestamp(),
        privacyVersion: 2
      });

      localStorage.removeItem('site_faculty');
      localStorage.setItem('hss_public_faculty', JSON.stringify(toPublicFacultyList(updatedFaculty)));

      try {
        const ch = new BroadcastChannel('hss_data_sync');
        ch.postMessage({ type: 'UPDATE_DATA' });
        ch.close();
      } catch (_) {}

      setFaculty(updatedFaculty);

      logAdminActivity({
        actionType: 'update',
        actionTitle: actionTitle || 'Staff Establishment Record Updated',
        details: details || `Updated staff record for ${employeeName || 'Staff Member'}`,
        actorRole: 'Accounts Clerk',
        metadata: { employeeName }
      });

      showToast(`Official record for ${employeeName || 'Staff'} saved to Firebase!`, 'success');
      setShowPermissionModal(false);
      setEditingStaffMember(null);
      setEditingStaffIndex(null);
      setEditingTaxIdx(null);
    } catch (err) {
      console.error('Error committing official staff record to Firebase:', err);
      showToast(`Error saving to Firebase: ${err.message}`, 'error');
    } finally {
      setIsSavingCommit(false);
    }
  };

  // Request Save Tax Details with Clerk Authorization Modal
  const requestSaveEmployeeTaxDetails = (index, pan, grossSalary, tds, regime, deduction80C, deduction80D, hraExemption, otherDeductions) => {
    const original = faculty[index] || {};
    const cleanPan = (pan || '').toUpperCase().trim();
    const cleanGross = parseFloat(grossSalary) || 0;
    const cleanTds = parseFloat(tds) || 0;
    const cleanRegime = regime === 'old' ? 'old' : 'new';
    const clean80C = parseFloat(deduction80C) || 0;
    const clean80D = parseFloat(deduction80D) || 0;
    const cleanHra = parseFloat(hraExemption) || 0;
    const cleanOther = parseFloat(otherDeductions) || 0;

    const changes = [];
    if (cleanPan !== getEmployeePan(original)) changes.push({ label: 'PAN Card', oldVal: getEmployeePan(original) || '—', newVal: cleanPan });
    if (cleanGross !== getEmployeeGross(original)) changes.push({ label: 'Gross Salary', oldVal: `₹${getEmployeeGross(original).toLocaleString('en-IN')}`, newVal: `₹${cleanGross.toLocaleString('en-IN')}` });
    if (cleanTds !== getEmployeeTds(original)) changes.push({ label: 'TDS Deducted', oldVal: `₹${getEmployeeTds(original).toLocaleString('en-IN')}`, newVal: `₹${cleanTds.toLocaleString('en-IN')}` });
    if (cleanRegime !== getEmployeeRegime(original)) changes.push({ label: 'Tax Regime', oldVal: getEmployeeRegime(original).toUpperCase(), newVal: cleanRegime.toUpperCase() });
    if (clean80C !== getEmployee80C(original)) changes.push({ label: '80C Deductions', oldVal: `₹${getEmployee80C(original).toLocaleString('en-IN')}`, newVal: `₹${clean80C.toLocaleString('en-IN')}` });
    if (clean80D !== getEmployee80D(original)) changes.push({ label: '80D Deductions', oldVal: `₹${getEmployee80D(original).toLocaleString('en-IN')}`, newVal: `₹${clean80D.toLocaleString('en-IN')}` });
    if (cleanHra !== getEmployeeHra(original)) changes.push({ label: 'HRA Exemption', oldVal: `₹${getEmployeeHra(original).toLocaleString('en-IN')}`, newVal: `₹${cleanHra.toLocaleString('en-IN')}` });
    if (cleanOther !== getEmployeeOtherDeductions(original)) changes.push({ label: 'Other / 80CCD(2)', oldVal: `₹${getEmployeeOtherDeductions(original).toLocaleString('en-IN')}`, newVal: `₹${cleanOther.toLocaleString('en-IN')}` });

    const updatedFaculty = [...faculty];
    const emp = { ...updatedFaculty[index] };
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
    updatedFaculty[index] = emp;

    setPendingCommitDetails({
      title: 'Confirm Staff Tax & Salary Update',
      staffName: emp.name || 'Official',
      designation: emp.designation || 'Staff Member',
      cpis: emp.cpis_no || emp.cpis || '—',
      changes: changes.length > 0 ? changes : [{ label: 'Salary/Tax Data', oldVal: 'Current Values', newVal: 'Verified & Confirmed' }],
      onConfirm: async () => {
        await commitFacultyToFirebase(
          updatedFaculty,
          'Staff Tax & Salary Record Updated',
          `Updated tax and salary details for ${emp.name} (${emp.designation || 'Staff'}) [PAN: ${cleanPan}, Regime: ${cleanRegime}]`,
          emp.name
        );
      }
    });
    setShowPermissionModal(true);
  };

  // Staff Modal Management with Full Establishment Fields
  const handleOpenEditStaffModal = (emp, index) => {
    const robustIdx = faculty.findIndex(f => 
      (f.id && emp.id && f.id === emp.id) ||
      ((f.cpis_no || f.cpis) && (emp.cpis_no || emp.cpis) && (f.cpis_no || f.cpis) === (emp.cpis_no || emp.cpis)) ||
      f.name === emp.name
    );
    const targetIdx = robustIdx !== -1 ? robustIdx : index;

    setIsNewStaffRecord(false);
    setEditingStaffIndex(targetIdx);
    setEditingStaffMember(emp);
    setStaffModalFormData({
      name: emp.name || '',
      designation: emp.designation || '',
      department: emp.department || '',
      cadre: emp.cadre || (isNonTeaching(emp) ? 'Non-Teaching' : 'Teaching'),
      qualification: emp.qualification || emp.customFields?.Qualification || '',
      cpis_no: emp.cpis_no || emp.cpis || '',
      pan: getEmployeePan(emp),
      phone: emp.phone || emp.mobile || '',
      email: emp.email || '',
      pension_scheme: getStaffPensionScheme(emp),
      pran_gpf: emp.pran_gpf || emp.pran || emp.gpf_no || emp.customFields?.['PRAN / GPF No'] || '',
      doj: emp.doj || emp.joining_date || emp.appointment_date || emp.customFields?.['Date of Joining'] || '',
      dob: emp.dob || emp.birth_date || emp.customFields?.DOB || '',
      parentage: emp.parentage || emp.father_name || emp.customFields?.Parentage || '',
      bank_account: emp.bank_account || emp.account_no || emp.customFields?.['Bank Account No'] || '',
      ifsc: emp.ifsc || emp.customFields?.['IFSC Code'] || '',
      grossSalary: getEmployeeGross(emp).toString(),
      tds: getEmployeeTds(emp).toString(),
      regime: getEmployeeRegime(emp),
      deduction80C: getEmployee80C(emp).toString(),
      deduction80D: getEmployee80D(emp).toString(),
      hraExemption: getEmployeeHra(emp).toString(),
      otherDeductions: getEmployeeOtherDeductions(emp).toString(),
      if_deployed: emp.if_deployed || 'No',
      inactiveReason: emp.inactiveReason || ''
    });
  };

  const handleOpenAddStaffModal = () => {
    setIsNewStaffRecord(true);
    setEditingStaffIndex(null);
    setEditingStaffMember(null);
    setStaffModalFormData({
      name: '',
      designation: 'Teacher',
      department: 'General',
      cadre: 'Teaching',
      qualification: '',
      cpis_no: '',
      pan: '',
      phone: '',
      email: '',
      pension_scheme: 'NPS',
      pran_gpf: '',
      doj: '',
      dob: '',
      parentage: '',
      bank_account: '',
      ifsc: 'JAKA0...',
      grossSalary: '',
      tds: '0',
      regime: 'new',
      deduction80C: '0',
      deduction80D: '0',
      hraExemption: '0',
      otherDeductions: '0',
      if_deployed: 'No',
      inactiveReason: ''
    });
  };

  // Delete / Retire Staff Member with Security Authorization
  const handleDeleteStaffMember = (emp) => {
    const targetIdx = faculty.findIndex(f => 
      (f.id && emp.id && f.id === emp.id) ||
      ((f.cpis_no || f.cpis) && (emp.cpis_no || emp.cpis) && (f.cpis_no || f.cpis) === (emp.cpis_no || emp.cpis)) ||
      f.name === emp.name
    );
    if (targetIdx === -1) return;

    setPendingCommitDetails({
      title: 'Confirm Staff Removal / Retirement',
      staffName: emp.name,
      designation: emp.designation || 'Staff Member',
      cpis: emp.cpis_no || emp.cpis || '—',
      changes: [
        { label: 'Establishment Status', oldVal: 'Active Member', newVal: 'Removed from Establishment Records' }
      ],
      onConfirm: async () => {
        const updatedFaculty = faculty.filter((_, idx) => idx !== targetIdx);
        await commitFacultyToFirebase(
          updatedFaculty,
          'Staff Removed from Establishment',
          `Clerk removed ${emp.name} (${emp.designation}) from official staff records`,
          emp.name
        );
      }
    });
    setShowPermissionModal(true);
  };

  // Quick toggle pension scheme with security confirmation
  const handleTogglePensionWithConfirm = (emp) => {
    const currentScheme = getStaffPensionScheme(emp);
    const newScheme = currentScheme === 'NPS' ? 'GPF' : 'NPS';
    setPendingCommitDetails({
      title: 'Confirm Pension Scheme Update',
      staffName: emp.name,
      designation: emp.designation,
      cpis: emp.cpis_no || emp.cpis || '—',
      changes: [
        { label: 'Pension Scheme', oldVal: currentScheme, newVal: newScheme }
      ],
      onConfirm: async () => {
        const targetIdx = faculty.findIndex(f => 
          (f.id && emp.id && f.id === emp.id) ||
          ((f.cpis_no || f.cpis) && (emp.cpis_no || emp.cpis) && (f.cpis_no || f.cpis) === (emp.cpis_no || emp.cpis)) ||
          f.name === emp.name
        );
        if (targetIdx === -1) return;
        const updatedFaculty = [...faculty];
        const updatedEmp = applyPensionSchemeToEmployee(faculty[targetIdx], newScheme);
        updatedFaculty[targetIdx] = updatedEmp;
        await commitFacultyToFirebase(
          updatedFaculty,
          `Pension Scheme Updated: ${newScheme}`,
          `Changed pension scheme for ${emp.name} from ${currentScheme} to ${newScheme}`,
          emp.name
        );
      }
    });
    setShowPermissionModal(true);
  };

  // Submit full staff modal data with clerk authorization
  const requestSaveStaffModalRecord = () => {
    if (!staffModalFormData.name?.trim()) {
      showToast('Staff member name is required.', 'error');
      return;
    }

    const cleanGross = parseFloat(staffModalFormData.grossSalary || 0);
    const cleanTds = parseFloat(staffModalFormData.tds || 0);
    const clean80C = parseFloat(staffModalFormData.deduction80C || 0);
    const clean80D = parseFloat(staffModalFormData.deduction80D || 0);
    const cleanHra = parseFloat(staffModalFormData.hraExemption || 0);
    const cleanOther = parseFloat(staffModalFormData.otherDeductions || 0);
    const cleanPan = (staffModalFormData.pan || '').toUpperCase().trim();
    const cleanCpis = (staffModalFormData.cpis_no || '').trim();

    let updatedFaculty = [...faculty];
    const changes = [];

    if (isNewStaffRecord) {
      const newStaff = {
        id: `emp_${Date.now()}`,
        name: staffModalFormData.name.trim(),
        designation: staffModalFormData.designation.trim(),
        department: staffModalFormData.department.trim(),
        cadre: staffModalFormData.cadre || 'Teaching',
        qualification: staffModalFormData.qualification?.trim() || '',
        cpis_no: cleanCpis,
        cpis: cleanCpis,
        pan: cleanPan,
        phone: staffModalFormData.phone.trim(),
        email: staffModalFormData.email.trim(),
        pension_scheme: staffModalFormData.pension_scheme,
        pensionScheme: staffModalFormData.pension_scheme,
        pran_gpf: staffModalFormData.pran_gpf?.trim() || '',
        doj: staffModalFormData.doj?.trim() || '',
        dob: staffModalFormData.dob?.trim() || '',
        parentage: staffModalFormData.parentage?.trim() || '',
        bank_account: staffModalFormData.bank_account?.trim() || '',
        ifsc: staffModalFormData.ifsc?.trim() || '',
        grossSalary: cleanGross,
        tds: cleanTds,
        taxRegime: staffModalFormData.regime,
        deduction80C: clean80C,
        deduction80D: clean80D,
        hraExemption: cleanHra,
        otherDeductions: cleanOther,
        if_deployed: staffModalFormData.if_deployed,
        inactiveReason: staffModalFormData.inactiveReason,
        customFields: {
          PAN: cleanPan,
          Qualification: staffModalFormData.qualification?.trim() || '',
          'Date of Joining': staffModalFormData.doj?.trim() || '',
          DOB: staffModalFormData.dob?.trim() || '',
          Parentage: staffModalFormData.parentage?.trim() || '',
          'Bank Account No': staffModalFormData.bank_account?.trim() || '',
          'IFSC Code': staffModalFormData.ifsc?.trim() || '',
          'PRAN / GPF No': staffModalFormData.pran_gpf?.trim() || '',
          'Gross Salary': cleanGross.toString(),
          TDS: cleanTds.toString(),
          'Tax Regime': staffModalFormData.regime,
          'Pension Scheme': staffModalFormData.pension_scheme,
          '80C Deductions': clean80C.toString(),
          '80D Deductions': clean80D.toString(),
          'HRA Exemption': cleanHra.toString(),
          'Other Deductions': cleanOther.toString()
        }
      };
      updatedFaculty.push(newStaff);
      changes.push({ label: 'New Official', oldVal: 'None', newVal: `${newStaff.name} (${newStaff.designation})` });
    } else {
      let targetIndex = editingStaffIndex;
      if (editingStaffMember) {
        const foundIdx = faculty.findIndex(f => 
          (f.id && editingStaffMember.id && f.id === editingStaffMember.id) ||
          ((f.cpis_no || f.cpis) && (editingStaffMember.cpis_no || editingStaffMember.cpis) && (f.cpis_no || f.cpis) === (editingStaffMember.cpis_no || editingStaffMember.cpis)) ||
          f.name === editingStaffMember.name
        );
        if (foundIdx !== -1) targetIndex = foundIdx;
      }

      const original = faculty[targetIndex] || {};
      const updatedEmp = {
        ...original,
        name: staffModalFormData.name.trim(),
        designation: staffModalFormData.designation.trim(),
        department: staffModalFormData.department.trim(),
        cadre: staffModalFormData.cadre || (isNonTeaching(original) ? 'Non-Teaching' : 'Teaching'),
        qualification: staffModalFormData.qualification?.trim() || '',
        cpis_no: cleanCpis,
        cpis: cleanCpis,
        pan: cleanPan,
        phone: staffModalFormData.phone.trim(),
        email: staffModalFormData.email.trim(),
        pension_scheme: staffModalFormData.pension_scheme,
        pensionScheme: staffModalFormData.pension_scheme,
        pran_gpf: staffModalFormData.pran_gpf?.trim() || '',
        doj: staffModalFormData.doj?.trim() || '',
        dob: staffModalFormData.dob?.trim() || '',
        parentage: staffModalFormData.parentage?.trim() || '',
        bank_account: staffModalFormData.bank_account?.trim() || '',
        ifsc: staffModalFormData.ifsc?.trim() || '',
        grossSalary: cleanGross,
        tds: cleanTds,
        taxRegime: staffModalFormData.regime,
        deduction80C: clean80C,
        deduction80D: clean80D,
        hraExemption: cleanHra,
        otherDeductions: cleanOther,
        if_deployed: staffModalFormData.if_deployed,
        inactiveReason: staffModalFormData.inactiveReason,
        customFields: {
          ...(original.customFields || {}),
          PAN: cleanPan,
          Qualification: staffModalFormData.qualification?.trim() || '',
          'Date of Joining': staffModalFormData.doj?.trim() || '',
          DOB: staffModalFormData.dob?.trim() || '',
          Parentage: staffModalFormData.parentage?.trim() || '',
          'Bank Account No': staffModalFormData.bank_account?.trim() || '',
          'IFSC Code': staffModalFormData.ifsc?.trim() || '',
          'PRAN / GPF No': staffModalFormData.pran_gpf?.trim() || '',
          'Gross Salary': cleanGross.toString(),
          TDS: cleanTds.toString(),
          'Tax Regime': staffModalFormData.regime,
          'Pension Scheme': staffModalFormData.pension_scheme,
          '80C Deductions': clean80C.toString(),
          '80D Deductions': clean80D.toString(),
          'HRA Exemption': cleanHra.toString(),
          'Other Deductions': cleanOther.toString()
        }
      };
      updatedFaculty[targetIndex] = updatedEmp;

      if (updatedEmp.name !== original.name) changes.push({ label: 'Name', oldVal: original.name || '—', newVal: updatedEmp.name });
      if (updatedEmp.designation !== original.designation) changes.push({ label: 'Designation', oldVal: original.designation || '—', newVal: updatedEmp.designation });
      if (updatedEmp.cpis_no !== original.cpis_no) changes.push({ label: 'CPIS ID', oldVal: original.cpis_no || '—', newVal: updatedEmp.cpis_no });
      if (cleanPan !== getEmployeePan(original)) changes.push({ label: 'PAN', oldVal: getEmployeePan(original) || '—', newVal: cleanPan });
      if (staffModalFormData.pension_scheme !== getStaffPensionScheme(original)) changes.push({ label: 'Pension Scheme', oldVal: getStaffPensionScheme(original), newVal: staffModalFormData.pension_scheme });
      if (cleanGross !== getEmployeeGross(original)) changes.push({ label: 'Gross Salary', oldVal: `₹${getEmployeeGross(original).toLocaleString('en-IN')}`, newVal: `₹${cleanGross.toLocaleString('en-IN')}` });
      if (staffModalFormData.regime !== getEmployeeRegime(original)) changes.push({ label: 'Tax Regime', oldVal: getEmployeeRegime(original).toUpperCase(), newVal: staffModalFormData.regime.toUpperCase() });
      if (cleanTds !== getEmployeeTds(original)) changes.push({ label: 'TDS Deducted', oldVal: `₹${getEmployeeTds(original).toLocaleString('en-IN')}`, newVal: `₹${cleanTds.toLocaleString('en-IN')}` });
    }

    setPendingCommitDetails({
      title: isNewStaffRecord ? 'Confirm New Staff Enrollment' : 'Confirm Official Staff Record Update',
      staffName: staffModalFormData.name,
      designation: staffModalFormData.designation,
      cpis: cleanCpis || '—',
      changes: changes.length > 0 ? changes : [{ label: 'Establishment Details', oldVal: 'Current Values', newVal: 'Saved Verified Values' }],
      onConfirm: async () => {
        await commitFacultyToFirebase(
          updatedFaculty,
          isNewStaffRecord ? 'New Staff Member Enrolled' : 'Staff Establishment Record Modified',
          `Clerk updated establishment record for ${staffModalFormData.name} (${staffModalFormData.designation})`,
          staffModalFormData.name
        );
      }
    });
    setShowPermissionModal(true);
  };

  // Export Staff Directory to CSV
  const exportStaffDirectoryCsv = () => {
    const listToExport = filteredDirectoryFaculty.length > 0 ? filteredDirectoryFaculty : faculty;
    if (listToExport.length === 0) {
      showToast('No staff records found to export.', 'warning');
      return;
    }

    const headers = [
      'S.No', 'Name of Official', 'Designation', 'Department', 'Cadre',
      'CPIS ID', 'PAN Card', 'Phone / Mobile', 'Email Address',
      'Pension Scheme', 'Gross Salary (Annual)', 'Tax Regime',
      'New Regime Tax', 'Old Regime Tax', 'Recommended Regime',
      'TDS Deducted', '80C Deductions', '80D Deductions', 'HRA Exemption', '80CCD(2) Other'
    ];

    const rows = listToExport.map((emp, idx) => {
      const gross = getEmployeeGross(emp);
      const tds = getEmployeeTds(emp);
      const opts = getEmployeeTaxOptions(emp);
      const newCalc = calculateTax(gross, tds, taxConfig, { ...opts, regime: 'new' });
      const oldCalc = calculateTax(gross, tds, taxConfig, { ...opts, regime: 'old' });
      const rec = newCalc.totalTax < oldCalc.totalTax ? 'New Regime' : oldCalc.totalTax < newCalc.totalTax ? 'Old Regime' : 'Equal';

      return [
        idx + 1,
        `"${(emp.name || '').replace(/"/g, '""')}"`,
        `"${(emp.designation || '').replace(/"/g, '""')}"`,
        `"${(emp.department || '').replace(/"/g, '""')}"`,
        isNonTeaching(emp) ? 'Non-Teaching (MTS)' : 'Teaching',
        `"${emp.cpis_no || emp.cpis || ''}"`,
        `"${getEmployeePan(emp)}"`,
        `"${emp.phone || emp.mobile || ''}"`,
        `"${emp.email || ''}"`,
        getStaffPensionScheme(emp),
        gross,
        (getEmployeeRegime(emp) || 'new').toUpperCase(),
        newCalc.totalTax,
        oldCalc.totalTax,
        rec,
        tds,
        getEmployee80C(emp),
        getEmployee80D(emp),
        getEmployeeHra(emp),
        getEmployeeOtherDeductions(emp)
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GHSS_Shangus_Staff_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported directory of ${listToExport.length} staff members.`, 'success');
  };

  // Tax Configuration Field Handlers
  const handleTaxConfigFieldChange = (field, value, numeric = false) => {
    setSettings((s) => {
      const newTaxConfig = { ...(s.taxConfig || DEFAULT_SETTINGS.taxConfig) };
      if (['financialYearLabel', 'assessmentYearLabel', 'cessRate'].includes(field)) {
        newTaxConfig[field] = numeric ? (value === '' ? '' : Math.max(0, Number(value) || 0)) : value;
      } else {
        const regimeKey = activeRegimeSettingsTab === 'old' ? 'oldRegime' : 'newRegime';
        newTaxConfig[regimeKey] = {
          ...newTaxConfig[regimeKey],
          [field]: numeric ? (value === '' ? '' : Math.max(0, Number(value) || 0)) : value
        };
      }
      return { ...s, taxConfig: newTaxConfig };
    });
  };

  const handleSaveTaxRulesToCloud = async () => {
    try {
      setSavingTax(true);
      await setDoc(doc(db, 'site', 'settings'), {
        taxConfig
      }, { merge: true });
      setSettings((prev) => ({ ...prev, taxConfig }));
      try {
        const cached = JSON.parse(localStorage.getItem('site_settings') || '{}');
        localStorage.setItem('site_settings', JSON.stringify({ ...cached, taxConfig }));
      } catch (_) {}
      showToast('Income Tax Rules & FY/AY definitions saved to School Database!', 'success');
      setShowTaxRules(false);
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Tax Rules Updated',
        details: `Updated tax rules for FY ${taxConfig.financialYearLabel}, AY ${taxConfig.assessmentYearLabel}`,
        actorType: 'admin',
        actorEmail: user?.email || auth?.currentUser?.email || 'adm.exam.hss.shangus@gmail.com',
        actorName: user?.name || user?.displayName || auth?.currentUser?.displayName || 'Admin',
        actorRole: user?.role || 'Super Admin',
        metadata: {
          financialYearLabel: taxConfig.financialYearLabel,
          assessmentYearLabel: taxConfig.assessmentYearLabel,
          cessRate: taxConfig.cessRate
        }
      });
    } catch (err) {
      console.error('Error saving tax rules:', err);
      showToast(`Error saving tax rules: ${err.message}`, 'error');
    } finally {
      setSavingTax(false);
    }
  };

  // CSV Summary Export
  const exportTaxSummaryCsv = () => {
    const activeStaff = selectedTaxEmployeeIndices.length > 0
      ? selectedTaxEmployeeIndices.map(i => faculty[i]).filter(Boolean)
      : filteredFaculty;

    if (!activeStaff.length) {
      showToast('No staff selected for tax export.', 'warning');
      return;
    }

    const headers = [
      'S.No', 'CPIS ID', 'Name of Official', 'Designation', 'PAN',
      'Tax Regime', 'Gross Salary (Annual)', 'Standard Deduction',
      '80C Deductions', '80D Deductions', 'HRA Exemption', 'Other Deductions 80CCD(2)',
      'Total Deductions', 'Taxable Income', 'Tax Before Cess', 'Health & Edu Cess',
      'Total Tax Payable', 'TDS Deducted', 'Tax Payable Now'
    ];

    const rows = activeStaff.map((emp, idx) => {
      const gross = getEmployeeGross(emp);
      const tds = getEmployeeTds(emp);
      const opts = getEmployeeTaxOptions(emp);
      const c = calculateTax(gross, tds, taxConfig, opts);

      return [
        idx + 1,
        `"${emp.cpis_no || ''}"`,
        `"${emp.name || ''}"`,
        `"${emp.designation || ''}"`,
        `"${getEmployeePan(emp)}"`,
        `"${c.regimeConfig.label}"`,
        c.grossSalary,
        c.standardDeduction,
        c.deduction80C,
        c.deduction80D,
        c.hraExemption,
        c.otherDeductions,
        c.totalDeductions,
        c.taxableIncome,
        c.taxBeforeCess,
        c.cess,
        c.totalTax,
        c.tds,
        c.taxPayableNow
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GHSS_Shangus_Staff_Tax_Summary_FY_${taxConfig.financialYearLabel}_AY_${taxConfig.assessmentYearLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported tax summary for ${activeStaff.length} employees.`, 'success');
  };

  // Official Printable Tax Sheets
  const printTaxSheets = (emps) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Pop-up blocker is enabled. Please allow pop-ups to print tax sheets.', 'warning');
      return;
    }

    const formatSalary = (val) => Math.round(Number(val || 0)).toLocaleString('en-IN');
    const formatSlab = (val) => (val === 0 || val === 'Nil' || val === undefined) ? 'Nil' : Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const formatTax = (val) => '₹ ' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatTotalTax = (val) => '₹ ' + Math.round(Number(val || 0)).toLocaleString('en-IN');

    const sheetsHtml = emps.map((emp) => {
      const pan = getEmployeePan(emp);
      const gross = getEmployeeGross(emp);
      const tds = getEmployeeTds(emp);
      const options = getEmployeeTaxOptions(emp);
      const calc = calculateTax(gross, tds, taxConfig, options);

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

      const grossTotalIncome = Math.max(0, gross - calc.standardDeduction - calc.hraExemption - calc.deduction80D);
      const taxPayableNowVal = calc.taxPayableNow > 0 ? `₹ ${formatSalary(calc.taxPayableNow)}` : 'NIL';
      const taxPayableNowClass = calc.taxPayableNow > 0 ? 'text-red-600 font-bold text-lg' : 'text-green-600 font-bold text-lg';

      return `
        <div class="tax-sheet">
          <div class="tax-sheet-content">
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
                  <td class="font-bold" style="font-size: 8.5px; font-style: italic;">Capital borrowed for repairs/renewal/reconstruction of house, max interest allowable Rs. 30,000</td>
                  <td></td>
                  <td class="text-right">0</td>
                </tr>

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

                <tr class="compact-row">
                  <td style="text-align: center;">5</td>
                  <td>Less: Deduction U/s 80G (M relief Fund, Red Cross Funds, Cancer Fund, etc.)</td>
                  <td class="text-right">0</td>
                  <td class="text-right">0</td>
                </tr>

                <tr class="bg-orange-100 font-bold">
                  <td style="text-align: center;"></td>
                  <td>Gross Total Income</td>
                  <td></td>
                  <td class="text-right text-red-600" style="background-color: #fed7aa; color: #dc2626;">₹ ${formatSalary(grossTotalIncome)}</td>
                </tr>

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

                <tr class="compact-row">
                  <td style="text-align: center;"></td>
                  <td>Less: Deduction U/s 80CCD (2)</td>
                  <td class="text-right">${calc.otherDeductions > 0 ? formatSalary(calc.otherDeductions) : '0'}</td>
                  <td class="text-right">${calc.otherDeductions > 0 ? formatSalary(calc.otherDeductions) : '0'}</td>
                </tr>

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

                ${slabRowsHtml}

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
          <title>Income Tax Calculation Sheets - GHSS Shangus</title>
          <style>
            @page { size: A4 portrait; margin: 2mm; }
            @media print {
              body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
              .no-print { display: none !important; }
              .tax-sheet { width: 100% !important; max-width: 206mm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; outline: none !important; page-break-after: always !important; }
              .tax-sheet:last-child { page-break-after: auto !important; }
            }
            body { font-family: system-ui, -apple-system, Arial, sans-serif; color: black; background: #f1f5f9; padding: 10px 0; margin: 0; display: flex; flex-direction: column; align-items: center; }
            .tax-sheet { width: 206mm; min-height: 293mm; padding: 6px 10px; margin: 0 auto 10px auto; box-sizing: border-box; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 3px double black; outline: 1px solid black; outline-offset: -3px; display: flex; flex-direction: column; justify-content: flex-start; }
            .header-top { width: 100%; margin-bottom: 4px; }
            .header-details-table { width: 100%; border-collapse: collapse; border: 1px solid black; margin-bottom: 5px; }
            .header-details-table td { border: 1px solid black; padding: 4px 8px; font-size: 11px; vertical-align: middle; }
            .header-details-table .label-cell { font-weight: bold; background-color: #f8fafc; width: 15%; color: #1e293b; }
            .header-details-table .value-cell { color: #dc2626; font-weight: bold; }
            .regime-badge-container { width: 50px; color: white; text-align: center; font-weight: bold; padding: 6px 2px !important; }
            .regime-badge-container.new-regime { background-color: #0f766e !important; }
            .regime-badge-container.old-regime { background-color: #961c14 !important; }
            .regime-badge-inner { text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; display: block; line-height: 1.15; }
            .main-tax-table { width: 100%; border-collapse: collapse; border: 1.5px solid black; font-size: 10.5px; line-height: 1.25; }
            .main-tax-table th, .main-tax-table td { border: 1px solid black; padding: 3px 5px; vertical-align: middle; }
            .main-tax-table tr.compact-row td { padding-top: 0.5px; padding-bottom: 0.5px; }
            .main-tax-table th { font-weight: bold; background-color: #f1f5f9; text-transform: uppercase; font-size: 9.5px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .text-red-600 { color: #dc2626; }
            .text-green-600 { color: #16a34a; }
            .text-lg { font-size: 13px; }
            .bg-orange-100 { background-color: #ffedd5; }
            .certification-box { text-align: justify; font-size: 10.5px; border: 1px solid black; padding: 5px 8px; line-height: 1.25; margin-top: 8px; background-color: #fafafa; }
            .no-print-bar { background: #1e293b; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; margin-bottom: 20px; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="no-print-bar no-print" style="width: 206mm; box-sizing: border-box;">
            <div>
              <strong style="font-size: 14px;">Print Income Tax Statements (${emps.length} Employee${emps.length > 1 ? 's' : ''})</strong>
              <div style="font-size: 11px; opacity: 0.8;">Govt. Higher Secondary School Shangus</div>
            </div>
            <button onclick="window.print()" style="background: #ea580c; color: white; border: none; padding: 6px 14px; border-radius: 4px; font-weight: bold; cursor: pointer;">
              🖨️ Print Now
            </button>
          </div>
          ${sheetsHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-2 p-2 sm:p-3 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 min-h-screen rounded-2xl animate-fadeIn">
      {/* ─── TOP MODULE BANNER & ACCOUNTS SUITE TABS (Single Compact Row) ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2 p-2 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-white via-amber-50/40 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
            <Calculator size={14} className="sm:hidden" />
            <Calculator size={18} className="hidden sm:block" />
          </div>
          <div className="min-w-0 flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h1 className="text-xs sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              <span className="xs:hidden">Accounts & Staff Tax</span>
              <span className="hidden xs:inline">School Accounts, Salaries & Staff Tax</span>
            </h1>
            <span className="px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 shrink-0">
              Accounts Clerk
            </span>
          </div>
        </div>

        {/* Global Single-Row Minimal Tab Switcher (No Duplicates, No Upcomings) */}
        <div className="flex items-center gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 self-stretch sm:self-auto overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('staff_directory')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'staff_directory'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Users size={13} className="shrink-0" />
            <span>Staff Directory</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
              activeTab === 'staff_directory'
                ? 'bg-amber-800 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
            }`}>
              {faculty.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tax_calculator')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'tax_calculator'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Calculator size={13} className="shrink-0" />
            <span>Staff Tax Calculator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('staff_letterhead')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'staff_letterhead'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <FileText size={13} className="shrink-0" />
            <span>Official Letterhead &amp; Mail Merge</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('staff_rosters')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'staff_rosters'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet size={13} className="shrink-0" />
            <span>Custom Staff Registers &amp; Rosters</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dispatch_history')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'dispatch_history'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <History size={13} className="shrink-0" />
            <span>Dispatch History</span>
            {clerkHistoryCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                activeTab === 'dispatch_history'
                  ? 'bg-amber-800 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}>
                {clerkHistoryCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── TAB 0: FACULTY & STAFF ESTABLISHMENT DIRECTORY ─── */}
      {activeTab === 'staff_directory' && (
        <div className="space-y-2 animate-fadeIn">
          {/* Top Bar: Controls, Search, Filter Pills & Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs space-y-2">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
              {/* Left: Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Search staff by Name, CPIS, PAN, phone, designation..."
                  className="w-full pl-7 pr-7 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 font-medium"
                />
                {directorySearch && (
                  <button
                    type="button"
                    onClick={() => setDirectorySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Right: Actions (Export CSV, Add Staff Member) */}
              <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                <button
                  type="button"
                  onClick={exportStaffDirectoryCsv}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                  title="Export establishment staff directory as CSV"
                >
                  <Download size={12} className="text-amber-600" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddStaffModal}
                  className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-1 shadow-2xs cursor-pointer transition-transform active:scale-95"
                  title="Enroll a new staff member into establishment"
                >
                  <UserPlus size={12} />
                  <span>Add Staff Member</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Metric Counters Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { key: 'all', label: 'All Staff', count: staffStats.total },
                  { key: 'teaching', label: 'Teaching', count: staffStats.teaching },
                  { key: 'non_teaching', label: 'MTS / Non-Teaching', count: staffStats.nonTeaching },
                  { key: 'nps', label: 'NPS Scheme', count: staffStats.nps },
                  { key: 'gpf', label: 'GPF Scheme', count: staffStats.gpf },
                  { key: 'deployed', label: 'Inactive / Deployed', count: staffStats.deployed }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDirectoryCategoryFilter(tab.key)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      directoryCategoryFilter === tab.key
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1 py-0.2 rounded-full text-[8.5px] font-mono ${
                      directoryCategoryFilter === tab.key ? 'bg-amber-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-slate-500 font-mono">
                Showing {filteredDirectoryFaculty.length} of {faculty.length} Records
              </div>
            </div>
          </div>

          {/* Directory Master Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-950 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[9.5px] font-black border-b border-slate-200 dark:border-slate-800">
                    <th className="p-2 text-center w-10">#</th>
                    <th className="p-2">Official Name &amp; Designation</th>
                    <th className="p-2">CPIS ID</th>
                    <th className="p-2">PAN</th>
                    <th className="p-2 text-center">Pension Scheme</th>
                    <th className="p-2 text-right">Gross Salary (Annual)</th>
                    <th className="p-2 text-center">Tax Regime</th>
                    <th className="p-2 text-center">Live Tax (New vs Old)</th>
                    <th className="p-2 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {filteredDirectoryFaculty.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        <Users size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                        <div className="font-bold text-xs text-slate-700 dark:text-slate-300">No staff records match your filter</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Try searching with a different term or clear the filter</div>
                      </td>
                    </tr>
                  ) : (
                    filteredDirectoryFaculty.map((emp, idx) => {
                      const origIdx = faculty.indexOf(emp);
                      const gross = getEmployeeGross(emp);
                      const tds = getEmployeeTds(emp);
                      const pan = getEmployeePan(emp);
                      const regime = getEmployeeRegime(emp);
                      const scheme = getStaffPensionScheme(emp);
                      const opts = getEmployeeTaxOptions(emp);
                      const newCalc = calculateTax(gross, tds, taxConfig, { ...opts, regime: 'new' });
                      const oldCalc = calculateTax(gross, tds, taxConfig, { ...opts, regime: 'old' });
                      const isNewCheaper = newCalc.totalTax < oldCalc.totalTax;
                      const isOldCheaper = oldCalc.totalTax < newCalc.totalTax;

                      const empKey = emp.id || emp.cpis_no || emp.pan || `emp_${idx}`;
                      const isExpanded = expandedStaffId === empKey;
                      const qualification = emp.qualification || emp.customFields?.Qualification || '';
                      const doj = emp.doj || emp.joining_date || emp.appointment_date || emp.customFields?.['Date of Joining'] || '';
                      const bankAccount = emp.bank_account || emp.account_no || emp.customFields?.['Bank Account No'] || '';
                      const ifsc = emp.ifsc || emp.customFields?.['IFSC Code'] || '';
                      const pranGpf = emp.pran_gpf || emp.pran || emp.gpf_no || emp.customFields?.['PRAN / GPF No'] || '';
                      const cadre = emp.cadre || (isNonTeaching(emp) ? 'Non-Teaching' : 'Teaching');

                      return (
                        <React.Fragment key={empKey}>
                          <tr
                            className={`transition-colors ${isExpanded ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'hover:bg-amber-50/30 dark:hover:bg-slate-800/40'}`}
                          >
                            <td className="p-2 text-center font-mono text-slate-400 text-[10px]">
                              {idx + 1}
                            </td>
                            <td className="p-2">
                              <div
                                onClick={() => setExpandedStaffId(isExpanded ? null : empKey)}
                                className="flex items-center gap-2 cursor-pointer select-none group"
                                title="Click to view full establishment details"
                              >
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-black text-[9px] shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                  {(emp.name || 'S').charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1">
                                    <span className="group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{emp.name}</span>
                                    <ChevronRight size={10} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-amber-600' : ''}`} />
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                    <span>{emp.designation || 'Staff'}</span>
                                    {emp.department && (
                                      <>
                                        <span>•</span>
                                        <span className="text-slate-400">{emp.department}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-2 font-mono text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                              {emp.cpis_no || emp.cpis || '—'}
                            </td>
                            <td className="p-2 font-mono text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                              {pan || '—'}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleTogglePensionWithConfirm(emp)}
                                className={`px-2 py-0.5 rounded text-[9px] font-mono font-black border transition-transform hover:scale-105 cursor-pointer ${
                                  scheme === 'NPS'
                                    ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                }`}
                                title={`Pension Scheme: ${scheme}. Click to toggle NPS/GPF (asks clerk authorization).`}
                              >
                                {scheme} ⟳
                              </button>
                            </td>
                            <td className="p-2 text-right">
                              <div className="font-mono font-bold text-slate-900 dark:text-white">
                                ₹{gross.toLocaleString('en-IN')}
                              </div>
                              <div className="text-[9px] font-mono text-slate-400">
                                ≈ ₹{Math.round(gross / 12).toLocaleString('en-IN')}/mo
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider ${
                                regime === 'old'
                                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                  : 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800'
                              }`}>
                                {regime === 'old' ? 'OLD' : 'NEW'}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <div className="inline-flex items-center gap-1.5 text-[9.5px] font-mono">
                                <span className={isNewCheaper ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-500'}>
                                  New: ₹{newCalc.totalTax.toLocaleString('en-IN')}
                                </span>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <span className={isOldCheaper ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-500'}>
                                  Old: ₹{oldCalc.totalTax.toLocaleString('en-IN')}
                                </span>
                              </div>
                              {isNewCheaper && (
                                <div className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  Saves ₹{(oldCalc.totalTax - newCalc.totalTax).toLocaleString('en-IN')} in New
                                </div>
                              )}
                              {isOldCheaper && (
                                <div className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  Saves ₹{(newCalc.totalTax - oldCalc.totalTax).toLocaleString('en-IN')} in Old
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditStaffModal(emp, origIdx)}
                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                                  title="Edit full establishment & tax particulars"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => printTaxSheets([emp])}
                                  className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-2xs"
                                  title="Print individual tax calculation sheet"
                                >
                                  <Printer size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaffMember(emp)}
                                  className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900 cursor-pointer shadow-2xs"
                                  title="Remove / retire staff member (requires authorization)"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Quick Establishment Particulars Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-950/70 border-b border-amber-200 dark:border-amber-900/60 animate-fadeIn">
                              <td colSpan={9} className="p-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10.5px]">
                                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                                    <div className="font-bold text-slate-500 text-[9px] uppercase tracking-wider">Service Particulars</div>
                                    <div><strong>Cadre:</strong> {cadre}</div>
                                    <div><strong>Qualification:</strong> {qualification || '—'}</div>
                                    <div><strong>1st Appt. Date:</strong> {doj || '—'}</div>
                                    <div><strong>Status:</strong> {emp.if_deployed === 'in' ? 'Deployed In' : emp.if_deployed === 'out' ? 'Deployed Out' : 'Regular'}</div>
                                  </div>

                                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                                    <div className="font-bold text-slate-500 text-[9px] uppercase tracking-wider">Accounts & Banking</div>
                                    <div><strong>Bank Account:</strong> <span className="font-mono">{bankAccount || '—'}</span></div>
                                    <div><strong>IFSC Code:</strong> <span className="font-mono">{ifsc || '—'}</span></div>
                                    <div><strong>PRAN / GPF:</strong> <span className="font-mono">{pranGpf || '—'}</span></div>
                                    <div><strong>Pension Scheme:</strong> <span className="font-bold text-amber-600">{scheme}</span></div>
                                  </div>

                                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                                    <div className="font-bold text-slate-500 text-[9px] uppercase tracking-wider">Contact & Bio</div>
                                    <div><strong>Mobile:</strong> {emp.phone || emp.mobile || '—'}</div>
                                    <div><strong>Email:</strong> {emp.email || '—'}</div>
                                    <div><strong>Parentage:</strong> {emp.parentage || emp.father_name || '—'}</div>
                                    <div><strong>DOB:</strong> {emp.dob || '—'}</div>
                                  </div>

                                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                                    <div className="font-bold text-slate-500 text-[9px] uppercase tracking-wider">Tax & Deductions Summary</div>
                                    <div><strong>TDS Deducted:</strong> ₹{tds.toLocaleString('en-IN')}</div>
                                    <div><strong>80C Deductions:</strong> ₹{getEmployee80C(emp).toLocaleString('en-IN')}</div>
                                    <div><strong>80D / HRA:</strong> ₹{(getEmployee80D(emp) + getEmployeeHra(emp)).toLocaleString('en-IN')}</div>
                                    <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                                      Best Regime: {isNewCheaper ? 'New Regime' : isOldCheaper ? 'Old Regime' : 'Equal'}
                                    </div>
                                  </div>
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
        </div>
      )}

      {/* ─── TAB 1: STAFF TAX CALCULATOR ─── */}
      {activeTab === 'tax_calculator' && (
        <div className="space-y-1.5 sm:space-y-2 animate-fadeIn">
          {/* ─── CONSOLIDATED CONTROL BAR (Unified Grouping on Same Row) ─── */}
          <div className="bg-white dark:bg-slate-900/90 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800/80">
            {/* Row 1: Tax Scope & Regime Switcher + Key Threshold Pills + Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1.5 sm:gap-2 p-2 sm:px-3 sm:py-2">
              {/* Left Group: Generator Title, Regime, Key Metrics */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <Calculator className="text-amber-600 dark:text-amber-500 shrink-0" size={13} />
                  <span className="font-extrabold text-slate-900 dark:text-white text-[11px] sm:text-sm">Income Tax Auto-Generator</span>
                  <span className="text-slate-600 dark:text-slate-400 text-[8.5px] sm:text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    FY {taxConfig.financialYearLabel} • AY {taxConfig.assessmentYearLabel}
                  </span>
                </div>

                {/* Regime Toggle */}
                <div className="flex rounded-md sm:rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-950 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTaxPreviewRegime('new')}
                    className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[9.5px] sm:text-[10.5px] font-black transition-all cursor-pointer ${
                      activeTaxPreviewRegime === 'new' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    New Regime
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTaxPreviewRegime('old')}
                    className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[9.5px] sm:text-[10.5px] font-black transition-all cursor-pointer ${
                      activeTaxPreviewRegime === 'old' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Old Regime
                  </button>
                </div>

                {/* Compact Threshold Pills */}
                <div className="hidden sm:flex items-center gap-2 font-mono text-[10.5px] text-slate-600 dark:text-slate-300 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 whitespace-nowrap">
                    Nil-tax: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">₹{(previewRegimeConfig.rebateThreshold + previewRegimeConfig.standardDeduction).toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 whitespace-nowrap">
                    87A: <strong className="text-teal-700 dark:text-teal-400 font-bold">₹{previewRegimeConfig.rebateMax.toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="hidden xl:inline-block px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 whitespace-nowrap">
                    Std. Ded: <strong className="text-amber-700 dark:text-amber-400 font-bold">₹{previewRegimeConfig.standardDeduction.toLocaleString('en-IN')}</strong>
                  </span>
                  {previewRegimeConfig.marginalReliefEnabled && (
                    <span className="hidden 2xl:inline-block px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[9.5px] font-bold">
                      Marginal Relief ✓ ON
                    </span>
                  )}
                </div>
              </div>

              {/* Right Group: Action Buttons */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-start lg:justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => loadAccountsData(true)}
                  disabled={loading}
                  title="Reload Staff Records and Tax Data"
                  className="px-1.5 py-1 sm:px-2 sm:py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                >
                  <RefreshCw size={10} className={`sm:hidden ${loading ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
                  <RefreshCw size={12} className={`hidden sm:inline ${loading ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTaxRules(true)}
                  title="Configure Slabs, Rebates & Surcharge Brackets"
                  className="px-1.5 py-1 sm:px-2 sm:py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                >
                  <Settings size={10} className="sm:hidden text-amber-600" />
                  <Settings size={12} className="hidden sm:inline text-amber-600" />
                  <span className="sm:hidden">Rules</span>
                  <span className="hidden sm:inline">Edit Tax Rules</span>
                </button>

                <button
                  type="button"
                  onClick={exportTaxSummaryCsv}
                  title="Export Current Tax Summary as CSV Spreadsheet"
                  className="px-1.5 py-1 sm:px-2 sm:py-1 bg-teal-600 hover:bg-teal-700 dark:bg-teal-800 dark:hover:bg-teal-700 text-white rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1 border border-teal-600 dark:border-teal-700 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                >
                  <Download size={10} className="sm:hidden" />
                  <Download size={12} className="hidden sm:inline" />
                  <span className="sm:hidden">CSV</span>
                  <span className="hidden sm:inline">Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const toPrint = selectedTaxEmployeeIndices.length > 0
                      ? selectedTaxEmployeeIndices.map(i => faculty[i]).filter(Boolean)
                      : filteredFaculty;
                    if (!toPrint.length) {
                      showToast('No employees selected for print.', 'warning');
                      return;
                    }
                    printTaxSheets(toPrint);
                  }}
                  title="Print Official Income Tax Computation Statements"
                  className="px-2 py-1 sm:px-2.5 sm:py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1 border border-amber-600 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                >
                  <Printer size={10} className="sm:hidden" />
                  <Printer size={12} className="hidden sm:inline" />
                  <span className="sm:hidden">Print ({selectedTaxEmployeeIndices.length || filteredFaculty.length})</span>
                  <span className="hidden sm:inline">Print Selected ({selectedTaxEmployeeIndices.length || filteredFaculty.length})</span>
                </button>
              </div>
            </div>

            {/* Row 2: Filter Categories + Select All Filtered + Staff Count + Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2 p-2 sm:px-3 sm:py-1.5 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                {/* Category Filter Multi-Select Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTaxFilterDropdownOpen(!isTaxFilterDropdownOpen)}
                    className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                  >
                    <span className="sm:hidden">Categories ({selectedTaxCategories.length})</span>
                    <span className="hidden sm:inline">Filter Categories ({selectedTaxCategories.length})</span>
                    <ChevronDown size={10} className={`sm:hidden transition-transform ${isTaxFilterDropdownOpen ? 'rotate-180' : ''}`} />
                    <ChevronDown size={12} className={`hidden sm:inline transition-transform ${isTaxFilterDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isTaxFilterDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1 animate-fadeIn">
                      <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 pb-1 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <span>Staff Classification</span>
                        <button
                          type="button"
                          onClick={() => setSelectedTaxCategories(TAX_CATEGORIES.map(c => c.key))}
                          className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          All
                        </button>
                      </div>
                      {TAX_CATEGORIES.map((cat) => {
                        const isChecked = selectedTaxCategories.includes(cat.key);
                        return (
                          <label
                            key={cat.key}
                            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedTaxCategories(selectedTaxCategories.filter(c => c !== cat.key));
                                } else {
                                  setSelectedTaxCategories([...selectedTaxCategories, cat.key]);
                                }
                              }}
                              className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                            />
                            <span>{cat.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Select All Visible */}
                <button
                  type="button"
                  onClick={() => handleSelectAllTaxVisible(filteredFaculty)}
                  className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                >
                  {filteredFaculty.length > 0 && filteredFaculty.every(emp => selectedTaxEmployeeIndices.includes(faculty.indexOf(emp))) ? (
                    <CheckSquare size={11} className="text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Square size={11} className="text-slate-400 dark:text-slate-500" />
                  )}
                  <span className="sm:hidden">Select All</span>
                  <span className="hidden sm:inline">Select All Filtered</span>
                </button>

                {/* Staff Scope Count Badge */}
                <span className="px-1.5 py-0.5 rounded-md sm:rounded-lg bg-slate-200/60 dark:bg-slate-800 text-[9.5px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  <span className="sm:hidden">Scope: </span>
                  <span className="hidden sm:inline">Total Staff in Scope: </span>
                  <strong className="text-slate-900 dark:text-white font-extrabold">{filteredFaculty.length}</strong>
                </span>
              </div>

              {/* Search Input */}
              <div className="relative flex-1 w-full sm:max-w-xs md:max-w-sm min-w-0">
                <Search size={10} className="sm:hidden absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <Search size={12} className="hidden sm:inline absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={taxSearch}
                  onChange={(e) => setTaxSearch(e.target.value)}
                  placeholder="Search name, PAN, CPIS..."
                  className="w-full pl-6 sm:pl-7 pr-3 py-0.5 sm:py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
                />
                {taxSearch && (
                  <button
                    type="button"
                    onClick={() => setTaxSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── EMPLOYEES TAX DATA TABLE ─── */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[620px]">
              <table className="w-full min-w-[740px] text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 dark:bg-slate-950 text-[10.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 backdrop-blur-xs">
                  <tr>
                    <th className="p-2.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredFaculty.length > 0 && filteredFaculty.every(emp => selectedTaxEmployeeIndices.includes(faculty.indexOf(emp)))}
                        onChange={() => handleSelectAllTaxVisible(filteredFaculty)}
                        className="accent-amber-600 cursor-pointer rounded"
                      />
                    </th>
                    <th className="p-2.5 w-12 text-center">#</th>
                    <th className="p-2.5 whitespace-nowrap">CPIS / PAN</th>
                    <th className="p-2.5">Name / Designation</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Gross Salary (Annual)</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Total Tax</th>
                    <th className="p-2.5 text-right whitespace-nowrap">TDS (Up-to-Date)</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Tax Payable Now</th>
                    <th className="p-2.5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-slate-500 dark:text-slate-400">
                        <RefreshCw size={22} className="animate-spin mx-auto text-amber-600 dark:text-amber-500 mb-2.5" />
                        <span className="font-bold text-xs">Loading staff tax records and accounts directory...</span>
                      </td>
                    </tr>
                  ) : filteredFaculty.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                            <Users size={22} />
                          </div>
                          {faculty.length === 0 ? (
                            <>
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                No staff records loaded
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Staff members have not been loaded into the Accounts module yet. Click below to fetch from the master directory.
                              </p>
                              <button
                                type="button"
                                onClick={loadAccountsData}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw size={13} />
                                <span>Fetch Staff Directory</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                No staff matching current search or filters
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                We found {faculty.length} staff members, but none matched your search query or selected categories.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setTaxSearch('');
                                  setSelectedTaxCategories(TAX_CATEGORIES.map(c => c.key));
                                }}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <X size={13} />
                                <span>Reset Search & Filters</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFaculty.map((emp, idx) => {
                      const origIdx = faculty.indexOf(emp);
                      const isSelected = selectedTaxEmployeeIndices.includes(origIdx);
                      const isEditing = editingTaxIdx === origIdx;
                      const pan = getEmployeePan(emp);
                      const gross = getEmployeeGross(emp);
                      const tds = getEmployeeTds(emp);
                      const regime = getEmployeeRegime(emp);
                      const opts = getEmployeeTaxOptions(emp);
                      const calc = calculateTax(gross, tds, taxConfig, opts);

                      return (
                        <React.Fragment key={origIdx}>
                          <tr className={`hover:bg-amber-50/60 dark:hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-amber-100/50 dark:bg-amber-950/20' : ''}`}>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleEmployeeTaxSelection(emp)}
                                className="accent-amber-600 cursor-pointer rounded"
                              />
                            </td>
                            <td className="p-2.5 text-center font-mono text-[11px] text-slate-400 dark:text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="p-2.5">
                              <div className="font-mono text-slate-800 dark:text-slate-200 font-bold">{emp.cpis_no || '—'}</div>
                              <div className="font-mono text-[10.5px] text-amber-600 dark:text-amber-400 font-semibold">{pan || 'NO PAN'}</div>
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white text-[12px]">{emp.name}</span>
                                <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded ${
                                  regime === 'new' 
                                    ? 'bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300' 
                                    : 'bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                }`}>
                                  {regime === 'new' ? 'New Regime' : 'Old Regime'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">{emp.designation || 'Staff Member'}</div>
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              ₹{gross.toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              ₹{calc.totalTax.toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              ₹{tds.toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap">
                              {calc.taxPayableNow > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-black">₹{calc.taxPayableNow.toLocaleString('en-IN')}</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-black">NIL</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTaxIdx(origIdx);
                                    setEditTaxData({
                                      pan: pan,
                                      grossSalary: gross.toString(),
                                      tds: tds.toString(),
                                      regime: regime,
                                      deduction80C: getEmployee80C(emp).toString(),
                                      deduction80D: getEmployee80D(emp).toString(),
                                      hraExemption: getEmployeeHra(emp).toString(),
                                      otherDeductions: getEmployeeOtherDeductions(emp).toString()
                                    });
                                  }}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10.5px] font-bold transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => printTaxSheets([emp])}
                                  className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10.5px] font-bold transition-colors flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                >
                                  <Printer size={11} />
                                  <span>Print</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Inline Deduction & Tax Edit Form Drawer */}
                          {isEditing && (
                            <tr className="bg-amber-50/40 dark:bg-slate-950 border-y-2 border-amber-500/80 animate-fadeIn">
                              <td colSpan={9} className="p-3 sm:p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between border-b border-amber-200 dark:border-slate-800 pb-2">
                                    <div className="font-bold text-amber-700 dark:text-amber-400 text-xs flex items-center gap-1.5">
                                      <Edit3 size={14} />
                                      <span>Edit Salary, PAN & Tax Deductions for: <strong>{emp.name}</strong></span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setEditingTaxIdx(null)}
                                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                                    >
                                      <X size={15} />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                                    <div>
                                      <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">PAN Number:</label>
                                      <input
                                        type="text"
                                        value={editTaxData.pan}
                                        onChange={(e) => setEditTaxData({ ...editTaxData, pan: e.target.value.toUpperCase() })}
                                        placeholder="e.g. ABCDE1234F"
                                        className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono uppercase font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Tax Regime:</label>
                                      <select
                                        value={editTaxData.regime}
                                        onChange={(e) => setEditTaxData({ ...editTaxData, regime: e.target.value })}
                                        className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      >
                                        <option value="new">New Tax Regime</option>
                                        <option value="old">Old Tax Regime</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Gross Salary (Annual):</label>
                                      <input
                                        type="number"
                                        value={editTaxData.grossSalary}
                                        onChange={(e) => setEditTaxData({ ...editTaxData, grossSalary: e.target.value })}
                                        placeholder="e.g. 1250000"
                                        className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">TDS Deducted Up-to-Date:</label>
                                      <input
                                        type="number"
                                        value={editTaxData.tds}
                                        onChange={(e) => setEditTaxData({ ...editTaxData, tds: e.target.value })}
                                        placeholder="e.g. 50000"
                                        className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>
                                  </div>

                                  {/* Deductions Specific to Old vs New Regime */}
                                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-1.5">
                                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                      {editTaxData.regime === 'old' ? 'Old Regime Deductions (80C, 80D, HRA):' : 'New Regime Deductions (80CCD(2) Employer NPS Share):'}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                                      {editTaxData.regime === 'old' ? (
                                        <>
                                          <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">80C (Max ₹1.5 Lakh):</label>
                                            <input
                                              type="number"
                                              value={editTaxData.deduction80C}
                                              onChange={(e) => setEditTaxData({ ...editTaxData, deduction80C: e.target.value })}
                                              className="w-full p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">80D (Health Insurance):</label>
                                            <input
                                              type="number"
                                              value={editTaxData.deduction80D}
                                              onChange={(e) => setEditTaxData({ ...editTaxData, deduction80D: e.target.value })}
                                              className="w-full p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">HRA Exemption:</label>
                                            <input
                                              type="number"
                                              value={editTaxData.hraExemption}
                                              onChange={(e) => setEditTaxData({ ...editTaxData, hraExemption: e.target.value })}
                                              className="w-full p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                          </div>
                                        </>
                                      ) : null}
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">80CCD(2) (Employer NPS Contribution):</label>
                                        <input
                                          type="number"
                                          value={editTaxData.otherDeductions}
                                          onChange={(e) => setEditTaxData({ ...editTaxData, otherDeductions: e.target.value })}
                                          placeholder="e.g. NPS share"
                                          className="w-full p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200 dark:border-slate-800">
                                    <button
                                      type="button"
                                      onClick={() => setEditingTaxIdx(null)}
                                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingTax}
                                      onClick={() => {
                                        requestSaveEmployeeTaxDetails(
                                          origIdx,
                                          editTaxData.pan,
                                          editTaxData.grossSalary,
                                          editTaxData.tds,
                                          editTaxData.regime,
                                          editTaxData.deduction80C,
                                          editTaxData.deduction80D,
                                          editTaxData.hraExemption,
                                          editTaxData.otherDeductions
                                        );
                                      }}
                                      className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                                    >
                                      {savingTax ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                      <span>Save & Persist Details</span>
                                    </button>
                                  </div>
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
        </div>
      )}

      {/* ─── TAB 2: OFFICIAL LETTERHEAD & MAIL MERGE ─── */}
      {activeTab === 'staff_letterhead' && (
        <ClerkStaffDocumentsWorkspace
          faculty={faculty}
          user={user}
          settings={settings}
          initialSubTab="letterhead"
          onOpenHistory={() => setActiveTab('dispatch_history')}
        />
      )}

      {/* ─── TAB 3: CUSTOM STAFF REGISTERS & ROSTERS ─── */}
      {activeTab === 'staff_rosters' && (
        <ClerkStaffDocumentsWorkspace
          faculty={faculty}
          user={user}
          settings={settings}
          initialSubTab="roster"
          onOpenHistory={() => setActiveTab('dispatch_history')}
        />
      )}

      {/* ─── TAB 4: COMMON CLERK DISPATCH HISTORY & ARCHIVE ─── */}
      {activeTab === 'dispatch_history' && (
        <ClerkStaffDocumentsWorkspace
          faculty={faculty}
          user={user}
          settings={settings}
          initialSubTab="history"
          onBackToWorkspace={() => setActiveTab('staff_letterhead')}
        />
      )}

      {/* ─── MODAL: EDIT TAX RULES (ADMIN / ACCOUNTS CONFIG) ─── */}
      {showTaxRules && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-amber-600 dark:text-amber-500" />
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Edit Income Tax Slabs & Rules</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTaxRules(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Financial Year (FY):</label>
                <input
                  type="text"
                  value={taxConfig.financialYearLabel}
                  onChange={(e) => handleTaxConfigFieldChange('financialYearLabel', e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Assessment Year (AY):</label>
                <input
                  type="text"
                  value={taxConfig.assessmentYearLabel}
                  onChange={(e) => handleTaxConfigFieldChange('assessmentYearLabel', e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setActiveRegimeSettingsTab('new')}
                className={`flex-1 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  activeRegimeSettingsTab === 'new' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                New Regime Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveRegimeSettingsTab('old')}
                className={`flex-1 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  activeRegimeSettingsTab === 'old' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Old Regime Settings
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Standard Deduction (₹):</label>
                <input
                  type="number"
                  value={activeRegimeConfig.standardDeduction}
                  onChange={(e) => handleTaxConfigFieldChange('standardDeduction', e.target.value, true)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">87A Rebate Threshold (₹):</label>
                <input
                  type="number"
                  value={activeRegimeConfig.rebateThreshold}
                  onChange={(e) => handleTaxConfigFieldChange('rebateThreshold', e.target.value, true)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">87A Max Rebate (₹):</label>
                <input
                  type="number"
                  value={activeRegimeConfig.rebateMax}
                  onChange={(e) => handleTaxConfigFieldChange('rebateMax', e.target.value, true)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Health & Edu Cess Rate (%):</label>
                <input
                  type="number"
                  value={taxConfig.cessRate}
                  onChange={(e) => handleTaxConfigFieldChange('cessRate', e.target.value, true)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTaxRules(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTaxRulesToCloud}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Save Tax Rules</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: COMPREHENSIVE ESTABLISHMENT & TAX RECORD EDITOR ─── */}
      {(editingStaffMember !== null || isNewStaffRecord) && (
        <div className="fixed inset-0 z-[999998] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto space-y-4 animate-scaleUp">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Users size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {isNewStaffRecord ? 'Enroll New Staff Member' : `Edit Establishment Record: ${staffModalFormData.name || 'Official'}`}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Master establishment, payroll &amp; dynamic income tax record (Firebase Cloud sync)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingStaffMember(null);
                  setIsNewStaffRecord(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Sections */}
            <div className="space-y-3.5 text-xs">
              {/* Section 1: Official Particulars */}
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <span className="font-extrabold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider">
                  1. Official Particulars &amp; Identity
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Full Name *</label>
                    <input
                      type="text"
                      value={staffModalFormData.name}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, name: e.target.value })}
                      placeholder="e.g. Mohd Iqbal Lone"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Designation</label>
                    <input
                      type="text"
                      value={staffModalFormData.designation}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, designation: e.target.value })}
                      placeholder="e.g. Lecturer, Master, Teacher"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Department / Subject</label>
                    <input
                      type="text"
                      value={staffModalFormData.department}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, department: e.target.value })}
                      placeholder="e.g. Physics, Chemistry, MTS"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">CPIS ID</label>
                    <input
                      type="text"
                      value={staffModalFormData.cpis_no}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, cpis_no: e.target.value })}
                      placeholder="e.g. 1002345"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">PAN Card Number</label>
                    <input
                      type="text"
                      value={staffModalFormData.pan}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, pan: e.target.value.toUpperCase() })}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono uppercase font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Phone / Mobile</label>
                    <input
                      type="text"
                      value={staffModalFormData.phone}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Pension Scheme (NPS / GPF)</label>
                    <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setStaffModalFormData({ ...staffModalFormData, pension_scheme: 'NPS' })}
                        className={`flex-1 py-1 text-center rounded text-[10px] font-black cursor-pointer transition-all ${
                          staffModalFormData.pension_scheme === 'NPS'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        NPS
                      </button>
                      <button
                        type="button"
                        onClick={() => setStaffModalFormData({ ...staffModalFormData, pension_scheme: 'GPF' })}
                        className={`flex-1 py-1 text-center rounded text-[10px] font-black cursor-pointer transition-all ${
                          staffModalFormData.pension_scheme === 'GPF'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        GPF
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Deployment Status</label>
                    <select
                      value={staffModalFormData.if_deployed}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, if_deployed: e.target.value })}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="No">Regular / Station</option>
                      <option value="in">Deployed In (From other school)</option>
                      <option value="out">Deployed Out (To other station)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Service Cadre</label>
                    <select
                      value={staffModalFormData.cadre || 'Teaching'}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, cadre: e.target.value })}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="Teaching">Teaching (Lecturer/Master/Teacher)</option>
                      <option value="Ministerial">Ministerial / Office Staff</option>
                      <option value="Non-Teaching">MTS / Laboratory / Library</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Highest Qualification</label>
                    <input
                      type="text"
                      value={staffModalFormData.qualification || ''}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, qualification: e.target.value })}
                      placeholder="e.g. M.Sc, B.Ed, M.A, M.Phil"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">PRAN / GPF Account No.</label>
                    <input
                      type="text"
                      value={staffModalFormData.pran_gpf || ''}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, pran_gpf: e.target.value })}
                      placeholder="e.g. 110023456789"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Date of 1st Joining (Govt Service)</label>
                    <input
                      type="text"
                      value={staffModalFormData.doj || ''}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, doj: e.target.value })}
                      placeholder="e.g. 15-05-2012"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Bank Account No. (Salary)</label>
                    <input
                      type="text"
                      value={staffModalFormData.bank_account || ''}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, bank_account: e.target.value })}
                      placeholder="e.g. 0123040100001234"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Bank IFSC Code</label>
                    <input
                      type="text"
                      value={staffModalFormData.ifsc || ''}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, ifsc: e.target.value.toUpperCase() })}
                      placeholder="e.g. JAKA0SHANGU"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono uppercase font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Email Address</label>
                    <input
                      type="email"
                      value={staffModalFormData.email || ''}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, email: e.target.value })}
                      placeholder="e.g. official@jk.gov.in"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Payroll & Annual Gross */}
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <span className="font-extrabold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider">
                  2. Payroll &amp; Gross Salary
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Gross Salary (Annual) ₹</label>
                    <input
                      type="number"
                      value={staffModalFormData.grossSalary}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, grossSalary: e.target.value })}
                      placeholder="e.g. 1150000"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-black text-sm outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">
                      Monthly: ₹{Math.round(parseFloat(staffModalFormData.grossSalary || 0) / 12).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">TDS Deducted Up-to-Date ₹</label>
                    <input
                      type="number"
                      value={staffModalFormData.tds}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, tds: e.target.value })}
                      placeholder="e.g. 45000"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Active Tax Regime</label>
                    <select
                      value={staffModalFormData.regime}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, regime: e.target.value })}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="new">New Tax Regime (Sec 115BAC)</option>
                      <option value="old">Old Tax Regime (With Deductions)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Deductions */}
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider">
                    3. Deductions &amp; Exemptions
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {staffModalFormData.regime === 'old' ? 'Applicable under Old Regime' : 'Under New Regime, 80CCD(2) applies'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      80C Deductions (Max ₹1.5L)
                    </label>
                    <input
                      type="number"
                      value={staffModalFormData.deduction80C}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, deduction80C: e.target.value })}
                      disabled={staffModalFormData.regime === 'new'}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      80D Health Insurance
                    </label>
                    <input
                      type="number"
                      value={staffModalFormData.deduction80D}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, deduction80D: e.target.value })}
                      disabled={staffModalFormData.regime === 'new'}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      HRA Exemption
                    </label>
                    <input
                      type="number"
                      value={staffModalFormData.hraExemption}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, hraExemption: e.target.value })}
                      disabled={staffModalFormData.regime === 'new'}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      80CCD(2) Employer NPS
                    </label>
                    <input
                      type="number"
                      value={staffModalFormData.otherDeductions}
                      onChange={(e) => setStaffModalFormData({ ...staffModalFormData, otherDeductions: e.target.value })}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Live Side-by-Side Tax Comparison */}
              <div className="space-y-2">
                <span className="font-extrabold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator size={13} className="text-amber-500" />
                  <span>4. Side-by-Side Tax Comparison (Live Recomputing)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* New Regime Card */}
                  <div className={`p-2.5 rounded-xl border transition-all ${
                    staffModalFormData.regime === 'new'
                      ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-teal-600 text-white">NEW REGIME</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Sec 115BAC</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStaffModalFormData(prev => ({ ...prev, regime: 'new' }))}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                          staffModalFormData.regime === 'new'
                            ? 'bg-amber-600 text-white font-black'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {staffModalFormData.regime === 'new' ? '✓ Selected' : 'Choose New'}
                      </button>
                    </div>
                    <div className="space-y-1 text-[10.5px]">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Standard Deduction:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₹{modalNewTaxCalc.standardDeduction.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Taxable Income:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₹{modalNewTaxCalc.taxableIncome.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span>Total Annual Tax:</span>
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs">₹{modalNewTaxCalc.totalTax.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Tax Due (After TDS):</span>
                        <span className="font-mono font-bold">
                          {modalNewTaxCalc.taxPayableNow > 0 ? `₹${modalNewTaxCalc.taxPayableNow.toLocaleString('en-IN')}` : 'NIL'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Old Regime Card */}
                  <div className={`p-2.5 rounded-xl border transition-all ${
                    staffModalFormData.regime === 'old'
                      ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-700 text-white">OLD REGIME</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">With Deductions</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStaffModalFormData(prev => ({ ...prev, regime: 'old' }))}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                          staffModalFormData.regime === 'old'
                            ? 'bg-amber-600 text-white font-black'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {staffModalFormData.regime === 'old' ? '✓ Selected' : 'Choose Old'}
                      </button>
                    </div>
                    <div className="space-y-1 text-[10.5px]">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Total Deductions:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₹{modalOldTaxCalc.totalDeductions.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Taxable Income:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₹{modalOldTaxCalc.taxableIncome.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span>Total Annual Tax:</span>
                        <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs">₹{modalOldTaxCalc.totalTax.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Tax Due (After TDS):</span>
                        <span className="font-mono font-bold">
                          {modalOldTaxCalc.taxPayableNow > 0 ? `₹${modalOldTaxCalc.taxPayableNow.toLocaleString('en-IN')}` : 'NIL'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendation Banner */}
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-emerald-900 dark:text-emerald-200 font-bold">
                    {modalNewTaxCalc.totalTax < modalOldTaxCalc.totalTax ? (
                      <span>💡 <strong>New Regime Recommended:</strong> Saves ₹{(modalOldTaxCalc.totalTax - modalNewTaxCalc.totalTax).toLocaleString('en-IN')} annually compared to Old Regime.</span>
                    ) : modalOldTaxCalc.totalTax < modalNewTaxCalc.totalTax ? (
                      <span>💡 <strong>Old Regime Recommended:</strong> Saves ₹{(modalNewTaxCalc.totalTax - modalOldTaxCalc.totalTax).toLocaleString('en-IN')} annually due to deductions.</span>
                    ) : (
                      <span>⚖️ Both tax regimes result in identical tax of ₹{modalNewTaxCalc.totalTax.toLocaleString('en-IN')} for this salary.</span>
                    )}
                  </div>
                  {modalNewTaxCalc.totalTax !== modalOldTaxCalc.totalTax && (
                    <button
                      type="button"
                      onClick={() => {
                        const best = modalNewTaxCalc.totalTax < modalOldTaxCalc.totalTax ? 'new' : 'old';
                        setStaffModalFormData(prev => ({ ...prev, regime: best }));
                      }}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[9.5px] whitespace-nowrap cursor-pointer shadow-2xs"
                    >
                      Apply Cheaper Regime
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditingStaffMember(null);
                  setIsNewStaffRecord(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestSaveStaffModalRecord}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Save Establishment Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CLERK SECURITY & AUTHORIZATION CONFIRMATION ─── */}
      {showPermissionModal && pendingCommitDetails && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl p-4 sm:p-5 space-y-4 animate-scaleUp">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {pendingCommitDetails.title || 'Confirm Staff Record Update'}
                </h3>
                <p className="text-[10.5px] text-slate-500 leading-snug mt-0.5">
                  Clerk authorization required: verify before committing changes to master Firebase Cloud records.
                </p>
              </div>
            </div>

            {/* Official Summary Card */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Official Name:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{pendingCommitDetails.staffName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Designation / Role:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{pendingCommitDetails.designation}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">CPIS ID:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{pendingCommitDetails.cpis}</span>
              </div>
            </div>

            {/* Modifications Table */}
            {pendingCommitDetails.changes && pendingCommitDetails.changes.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Modified Values
                </span>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 text-[11px]">
                  {pendingCommitDetails.changes.map((c, i) => (
                    <div key={i} className="p-2 flex items-center justify-between gap-2 bg-white dark:bg-slate-900/60">
                      <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">{c.label}:</span>
                      <div className="flex items-center gap-1.5 text-right font-mono min-w-0 truncate">
                        <span className="text-slate-400 line-through text-[10px] truncate">{c.oldVal}</span>
                        <ArrowRight size={10} className="text-slate-400 shrink-0" />
                        <span className="text-amber-600 dark:text-amber-400 font-bold truncate">{c.newVal}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning Callout */}
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[10.5px] text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2">
              <Lock size={14} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong>Firebase Cloud Commit:</strong> This action immediately updates <code className="font-mono font-bold">systemSettings/facultyPrivate</code> and synchronizes across all clerk tools, tax calculation sheets, and school registers.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={isSavingCommit}
                onClick={() => setShowPermissionModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingCommit}
                onClick={() => pendingCommitDetails?.onConfirm()}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingCommit ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                <span>Authorize &amp; Commit to Cloud</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
