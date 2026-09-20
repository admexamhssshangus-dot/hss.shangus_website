import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, FileText, Printer, Download, Search, Edit3, 
  Check, X, ChevronDown, Sliders, RefreshCw, AlertCircle, 
  HelpCircle, Shield, Briefcase, Landmark, CheckSquare, 
  Square, ArrowUpRight, DollarSign, Wallet, FileSpreadsheet,
  TrendingUp, Users, Info, Settings, Sparkles
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_SETTINGS, loadSiteSettings } from '../../utils/settingsLoader';
import { toPublicFacultyList } from '../../utils/facultyPrivacy';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { showToast } from '../../components/common/GlobalToast';

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
  const [activeTab, setActiveTab] = useState('tax_calculator'); // 'tax_calculator' | 'salary_statements' | 'school_ledgers'
  const [loading, setLoading] = useState(true);
  const [savingTax, setSavingTax] = useState(false);
  const [faculty, setFaculty] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

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

  // Load Settings & Faculty Data
  const loadAccountsData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const loaded = await loadSiteSettings();
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

  // Save Individual Employee Tax Details to Firestore
  const saveEmployeeTaxDetails = async (index, pan, grossSalary, tds, regime, deduction80C, deduction80D, hraExemption, otherDeductions) => {
    setSavingTax(true);
    const updatedFaculty = [...faculty];
    const emp = { ...updatedFaculty[index] };
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
    updatedFaculty[index] = emp;
    setFaculty(updatedFaculty);

    try {
      // Save private faculty to Firestore
      await setDoc(doc(db, 'systemSettings', 'facultyPrivate'), {
        items: JSON.parse(JSON.stringify(updatedFaculty)),
        updatedAt: serverTimestamp(),
        privacyVersion: 2
      });

      // Update public sanitized cache
      localStorage.removeItem('site_faculty');
      localStorage.setItem('hss_public_faculty', JSON.stringify(toPublicFacultyList(updatedFaculty)));

      try {
        const ch = new BroadcastChannel('hss_data_sync');
        ch.postMessage({ type: 'UPDATE_DATA' });
        ch.close();
      } catch (_) {}

      showToast(`Tax details updated for ${emp.name || 'Official'}!`, 'success');
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Staff Tax Updated',
        details: `Updated income tax and salary record for ${emp.name} (${emp.designation || 'Staff'})`,
        metadata: { employeeName: emp.name, pan: emp.pan, regime: emp.regime }
      });
    } catch (err) {
      console.error('Error persisting employee tax details:', err);
      showToast(`Saved locally, but cloud sync encountered an issue: ${err.message}`, 'warning');
    } finally {
      setSavingTax(false);
    }
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-white via-amber-50/40 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
            <Calculator size={18} />
          </div>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
              School Accounts, Salaries & Staff Tax
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 shrink-0">
              Accounts Clerk Workspace
            </span>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 self-stretch sm:self-auto overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('tax_calculator')}
            className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'tax_calculator'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Calculator size={13} className="shrink-0" />
            <span className="sm:hidden">Staff Tax</span>
            <span className="hidden sm:inline">Staff Tax Calculator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('salary_statements')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'salary_statements'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Briefcase size={13} className="shrink-0" />
            <span className="sm:hidden">Salary Bills</span>
            <span className="hidden sm:inline">Salary & Pay Heads</span>
            <span className="px-1 py-0.2 rounded text-[8.5px] bg-slate-200 dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-extrabold">Upcoming</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('school_ledgers')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'school_ledgers'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Landmark size={13} className="shrink-0" />
            <span className="sm:hidden">Contingency</span>
            <span className="hidden sm:inline">School Contingency</span>
            <span className="px-1 py-0.2 rounded text-[8.5px] bg-slate-200 dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-extrabold">Upcoming</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: STAFF TAX CALCULATOR ─── */}
      {activeTab === 'tax_calculator' && (
        <div className="space-y-2 animate-fadeIn">
          {/* ─── CONSOLIDATED CONTROL BAR (Unified Grouping on Same Row) ─── */}
          <div className="bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800/80">
            {/* Row 1: Tax Scope & Regime Switcher + Key Threshold Pills + Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 px-3 py-2">
              {/* Left Group: Generator Title, Regime, Key Metrics */}
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Calculator className="text-amber-600 dark:text-amber-500" size={15} />
                  <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">Income Tax Auto-Generator</span>
                  <span className="text-slate-600 dark:text-slate-400 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    FY {taxConfig.financialYearLabel} • AY {taxConfig.assessmentYearLabel}
                  </span>
                </div>

                {/* Regime Toggle */}
                <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-950 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTaxPreviewRegime('new')}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-black transition-all cursor-pointer ${
                      activeTaxPreviewRegime === 'new' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    New Regime
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTaxPreviewRegime('old')}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-black transition-all cursor-pointer ${
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
              <div className="flex items-center gap-1.5 flex-wrap justify-start lg:justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => loadAccountsData(true)}
                  disabled={loading}
                  title="Reload Staff Records and Tax Data"
                  className="px-2 py-1.2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin text-amber-600' : 'text-slate-500 dark:text-slate-400'} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTaxRules(true)}
                  title="Configure Slabs, Rebates & Surcharge Brackets"
                  className="px-2 py-1.2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                >
                  <Settings size={12} className="text-amber-600 dark:text-amber-400" />
                  <span>Edit Tax Rules</span>
                </button>

                <button
                  type="button"
                  onClick={exportTaxSummaryCsv}
                  title="Export Current Tax Summary as CSV Spreadsheet"
                  className="px-2 py-1.2 bg-teal-600 hover:bg-teal-700 dark:bg-teal-800 dark:hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-teal-600 dark:border-teal-700 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                >
                  <Download size={12} />
                  <span>Export CSV</span>
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
                  className="px-2.5 py-1.2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-amber-600 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                >
                  <Printer size={12} />
                  <span>Print Selected ({selectedTaxEmployeeIndices.length || filteredFaculty.length})</span>
                </button>
              </div>
            </div>

            {/* Row 2: Filter Categories + Select All Filtered + Staff Count + Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Category Filter Multi-Select Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTaxFilterDropdownOpen(!isTaxFilterDropdownOpen)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                  >
                    <span>Filter Categories ({selectedTaxCategories.length})</span>
                    <ChevronDown size={12} className={`transition-transform ${isTaxFilterDropdownOpen ? 'rotate-180' : ''}`} />
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
                  className="px-2.5 py-1 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  {filteredFaculty.length > 0 && filteredFaculty.every(emp => selectedTaxEmployeeIndices.includes(faculty.indexOf(emp))) ? (
                    <CheckSquare size={12} className="text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Square size={12} className="text-slate-400 dark:text-slate-500" />
                  )}
                  <span>Select All Filtered</span>
                </button>

                {/* Staff Scope Count Badge */}
                <span className="px-2 py-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Total Staff in Scope: <strong className="text-slate-900 dark:text-white font-extrabold">{filteredFaculty.length}</strong>
                </span>
              </div>

              {/* Search Input */}
              <div className="relative flex-1 w-full sm:max-w-xs md:max-w-sm min-w-0">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={taxSearch}
                  onChange={(e) => setTaxSearch(e.target.value)}
                  placeholder="Search by name, designation, PAN or CPIS..."
                  className="w-full pl-7 pr-3 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
                />
                {taxSearch && (
                  <button
                    type="button"
                    onClick={() => setTaxSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={12} />
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
                    <th className="p-2.5">CPIS / PAN</th>
                    <th className="p-2.5">Name / Designation</th>
                    <th className="p-2.5 text-right">Gross Salary (Annual)</th>
                    <th className="p-2.5 text-right">Total Tax</th>
                    <th className="p-2.5 text-right">TDS (Up-to-Date)</th>
                    <th className="p-2.5 text-right">Tax Payable Now</th>
                    <th className="p-2.5 text-center">Actions</th>
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
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              ₹{gross.toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                              ₹{calc.totalTax.toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                              ₹{tds.toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold">
                              {calc.taxPayableNow > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-black">₹{calc.taxPayableNow.toLocaleString('en-IN')}</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-black">NIL</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
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
                                      onClick={async () => {
                                        await saveEmployeeTaxDetails(
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
                                        setEditingTaxIdx(null);
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

      {/* ─── TAB 2: SALARY & PAY HEADS (ROADMAP & UPCOMING) ─── */}
      {activeTab === 'salary_statements' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Staff Salary Registers & Monthly Bill Generator</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated monthly salary bills, basic pay bands, DA/HRA allowances, and J&K Bank disbursement ledgers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <TrendingUp size={13} />
                <span>Pay Heads Configuration</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Configure Level 1 to Level 13 Pay Bands, active Dearness Allowance rates (currently 50%+), HRA percentages (9%/18%), and Medical Allowance.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                <Wallet size={13} />
                <span>Deduction Schedules</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Auto-calculate 10% Employee NPS + 14% Government Contribution, SLI policy tiers, GPF subscriptions, and festive advance deductions.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                <FileSpreadsheet size={13} />
                <span>Bank Credit Statements</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Generate 1-click official monthly bank salary disbursement schedules in J&K Bank electronic format with account numbers and IFSC.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between flex-wrap gap-2">
            <span>✨ The Accounts Clerk workspace is being actively connected to CPIS and salary profiles.</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold">Planned Release: Phase 2</span>
          </div>
        </div>
      )}

      {/* ─── TAB 3: SCHOOL CONTINGENCY LEDGERS (UPCOMING) ─── */}
      {activeTab === 'school_ledgers' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Landmark size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">School Accounts, Contingency & Local Fund Ledgers</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional budget tracking, examination grants, practicals contingency, and school developmental funds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Local School Fund</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Audit trail and ledger entries for school local fund collections, developmental projects, and official expenditures.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400">Examination Contingency</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                JKBOSE centre superintendence allocations, question paper stationery grants, and invigilation remuneration logs.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-teal-700 dark:text-teal-400">Science Lab & IT Maintenance</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Reagent purchases, CAL / ICT lab electricity and broadband reimbursements, and asset register maintenance.
              </p>
            </div>
          </div>
        </div>
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
    </div>
  );
}
