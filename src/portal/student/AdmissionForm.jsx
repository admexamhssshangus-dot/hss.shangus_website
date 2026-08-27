import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Send, CheckCircle, CheckCircle2, AlertCircle, RefreshCw, Loader2, Info, HelpCircle, X, Eye, Edit3, Camera, ShieldCheck, Printer, ArrowUp } from 'lucide-react';
import SEO from '../../components/SEO';
import DynamicFormField from '../components/DynamicFormField';
import ModernLoader from '../../components/ModernLoader';
import StandardTooltip from '../../components/StandardTooltip';
import appsScriptApi from '../../services/appsScriptApi';
import { sessionManager } from '../../services/sessionManager';
import { generateStudentAdmissionPdf, generateProvisionalAdmissionPdf } from '../../utils/pdfGenerator';
import { saveAdmissionDraft } from '../../services/admissionWorkflowApi';
import { getNextAvailableFormNumber, consumeFormNumber } from '../../services/formNumberService';
import { isValidAadhaar, areAadhaarsDistinct, isStrictIsoDate, normalizeDobToIso, validateMinimumAge, MIN_ADMISSION_AGE, isPersonNameField, sanitizePersonName, validatePersonName } from '../../utils/admissionValidation';

export const SUBJECT_CANONICAL_SYNONYMS = {
  'social studies': 'Social Science',
  'social science': 'Social Science',
  'gen english': 'General English',
  'general english': 'General English',
  'it & ites': 'IT and ITES',
  'it and ites': 'IT and ITES',
  'it & ites (vocational)': 'IT and ITES',
  'health care': 'Healthcare',
  'healthcare': 'Healthcare',
  'maths': 'Mathematics',
  'mathematics': 'Mathematics',
};

export function normalizeSubjectTitle(subj) {
  if (!subj) return '';
  const trimmed = String(subj).trim();
  const lower = trimmed.toLowerCase();
  return SUBJECT_CANONICAL_SYNONYMS[lower] || trimmed;
}

export function getCompulsorySubjects(targetClass = '11th', stream = 'Science') {
  const cls = String(targetClass || '');
  const strm = String(stream || '');
  if (cls.includes('9') || cls.includes('10') || cls.includes('8')) {
    return ["English", "Mathematics", "Science", "Social Science"];
  }
  if (strm === 'Humanities' || strm === 'Arts') {
    return ["General English"];
  }
  if (strm === 'Commerce') {
    return ["General English", "Accountancy", "Business Studies"];
  }
  return ["General English", "Physics", "Chemistry"];
}

export function formatAllSubjects(rawSubjectsString = '', targetClass = '11th', stream = 'Science') {
  const compulsory = getCompulsorySubjects(targetClass, stream).map(normalizeSubjectTitle);
  const chosenArray = (typeof rawSubjectsString === 'string'
    ? rawSubjectsString.split(/[,+]/).map(s => s.trim()).filter(Boolean)
    : (Array.isArray(rawSubjectsString) ? rawSubjectsString : [])
  ).map(normalizeSubjectTitle);
  
  const allSubjects = [];
  [...compulsory, ...chosenArray].forEach(s => {
    if (s && !allSubjects.includes(s)) allSubjects.push(s);
  });
  return allSubjects.join(', ');
}

export function validateSubjectSelection(targetClass = '11th', stream = 'Science', rawSubjects = '', isReappear = false) {
  if (isReappear) return { valid: true, error: null, count: 0, min: 1, max: 10 };

  const compulsory = getCompulsorySubjects(targetClass, stream).map(normalizeSubjectTitle);
  const chosenArray = (typeof rawSubjects === 'string'
    ? rawSubjects.split(/[,+]/).map(s => s.trim()).filter(Boolean)
    : (Array.isArray(rawSubjects) ? rawSubjects : [])
  ).map(normalizeSubjectTitle);

  const allSubjects = [];
  [...compulsory, ...chosenArray].forEach(s => {
    if (s && !allSubjects.includes(s)) allSubjects.push(s);
  });
  const total = allSubjects.length;
  const cls = String(targetClass || '').toLowerCase();
  const strm = String(stream || 'Science').trim();

  if (cls.includes('9') || cls.includes('10') || cls.includes('8')) {
    if (total > 6) {
      return {
        valid: false,
        error: `Maximum 6 subjects allowed for Class 9th/10th (Currently ${total} selected). Please uncheck ${total - 6} subject(s).`,
        count: total,
        min: 5,
        max: 6
      };
    }
    if (total < 5) {
      return {
        valid: false,
        error: `Class 9th/10th requires at least 5 subjects (4 Compulsory + 1 Language). Currently ${total}/5 selected.`,
        count: total,
        min: 5,
        max: 6
      };
    }

    const groupBLanguages = ['urdu', 'arabic', 'hindi', 'kashmiri'];
    const optionals = allSubjects.filter(s => {
      const lower = s.toLowerCase();
      return !['english', 'mathematics', 'science', 'social science', 'social studies'].includes(lower);
    });
    const chosenLanguages = optionals.filter(s => groupBLanguages.some(l => s.toLowerCase().includes(l)));
    const chosenVocational = optionals.filter(s => !groupBLanguages.some(l => s.toLowerCase().includes(l)));

    if (chosenLanguages.length === 0) {
      return {
        valid: false,
        error: `Class 9th/10th Rule: Please select 1 language from Group B (Urdu, Arabic, Hindi, or Kashmiri).`,
        count: total,
        min: 5,
        max: 6
      };
    }
    if (chosenLanguages.length > 1) {
      return {
        valid: false,
        error: `Class 9th/10th Rule: Only 1 language allowed from Group B (Currently ${chosenLanguages.length} selected: ${chosenLanguages.join(', ')}).`,
        count: total,
        min: 5,
        max: 6
      };
    }
    if (chosenVocational.length > 1) {
      return {
        valid: false,
        error: `Class 9th/10th Rule: Only 1 vocational subject allowed from Group C (Currently ${chosenVocational.length} selected: ${chosenVocational.join(', ')}).`,
        count: total,
        min: 5,
        max: 6
      };
    }

    return { valid: true, error: null, count: total, min: 5, max: 6 };
  }

  const isScience = strm.toLowerCase() === 'science' || strm.toLowerCase() === 'medical' || strm.toLowerCase() === 'non-medical';
  const isHumanities = strm.toLowerCase() === 'humanities' || strm.toLowerCase() === 'arts';

  if (isScience) {
    if (total > 5) {
      return {
        valid: false,
        error: `Maximum 5 subjects allowed for Science Stream (3 Compulsory + 2 Options). Currently ${total} selected. Please uncheck ${total - 5} subject(s).`,
        count: total,
        min: 5,
        max: 5
      };
    }

    const groupB = ['biology', 'mathematics', 'maths'];
    const optionals = allSubjects.filter(s => {
      const lower = s.toLowerCase();
      return !['general english', 'english', 'physics', 'chemistry'].includes(lower);
    });

    const chosenGroupB = optionals.filter(s => groupB.some(b => s.toLowerCase().includes(b)));
    const chosenGroupC = optionals.filter(s => !groupB.some(b => s.toLowerCase().includes(b)));

    if (chosenGroupC.length >= 2 && chosenGroupB.length === 0) {
      return {
        valid: false,
        error: `Science Stream Rule: Both options cannot be from Group C (${chosenGroupC.join(', ')}). You must select at least 1 subject from Group B (Biology or Mathematics).`,
        count: total,
        min: 5,
        max: 5
      };
    }

    if (total < 5) {
      return {
        valid: false,
        error: `Science Stream requires exactly 5 subjects (3 Compulsory + 2 Options). Currently ${total}/5 selected.`,
        count: total,
        min: 5,
        max: 5
      };
    }

    return { valid: true, error: null, count: total, min: 5, max: 5 };
  }

  if (isHumanities) {
    if (total > 5) {
      return {
        valid: false,
        error: `Maximum 5 subjects allowed for Humanities Stream (1 Compulsory + 3 Group B + 1 Group C). Currently ${total} selected. Please uncheck ${total - 5} subject(s).`,
        count: total,
        min: 5,
        max: 5
      };
    }

    const groupC = ['environmental science', 'physical education', 'healthcare', 'it and ites', 'it & ites', 'computer science', 'public administration', 'psychology'];
    const optionals = allSubjects.filter(s => {
      const lower = s.toLowerCase();
      return !['general english', 'english'].includes(lower);
    });

    const chosenGroupC = optionals.filter(s => groupC.some(c => s.toLowerCase().includes(c)));
    if (chosenGroupC.length > 1) {
      return {
        valid: false,
        error: `Humanities Stream Rule: Only 1 subject allowed from Group C (${chosenGroupC.join(', ')}). Choose 3 from Group B and 1 from Group C.`,
        count: total,
        min: 5,
        max: 5
      };
    }

    if (total < 5) {
      return {
        valid: false,
        error: `Humanities Stream requires exactly 5 subjects (1 Compulsory + 3 Group B + 1 Group C). Currently ${total}/5 selected.`,
        count: total,
        min: 5,
        max: 5
      };
    }

    return { valid: true, error: null, count: total, min: 5, max: 5 };
  }

  if (total > 5) {
    return {
      valid: false,
      error: `Maximum 5 subjects allowed for ${strm} Stream. Currently ${total} selected. Please uncheck ${total - 5} subject(s).`,
      count: total,
      min: 5,
      max: 5
    };
  }
  if (total < 5) {
    return {
      valid: false,
      error: `Please select 5 subjects for ${strm} Stream (Currently ${total}/5 selected).`,
      count: total,
      min: 5,
      max: 5
    };
  }

  return { valid: true, error: null, count: total, min: 5, max: 5 };
}

export default function AdmissionForm() {
  const navigate = useNavigate();
  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [formStructure, setFormStructure] = useState([]);
  const [subjectsConfig, setSubjectsConfig] = useState(null);
  const [formData, setFormData] = useState({});
  const [isBackSaving, setIsBackSaving] = useState(false);

  // UI Flow States
  const [showInstructions, setShowInstructions] = useState(true);
  const [hasConfirmedInstructions, setHasConfirmedInstructions] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSetupCollapsed, setIsSetupCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [draftSavedTime, setDraftSavedTime] = useState(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(true); // dismissible notice banner
  const [submittedSuccessData, setSubmittedSuccessData] = useState(null); // confirmation popup data
  const [applicationId, setApplicationId] = useState('');
  const [admissionAvailability, setAdmissionAvailability] = useState({ globalClosed: false, classesClosed: {} });
  const [draftState, setDraftState] = useState('idle');
  const applicationIdRef = useRef('');
  const submissionKeyRef = useRef('');
  const autosaveServiceUnavailableRef = useRef(false);
  const mobileCheckTimeoutRef = useRef(null);
  const [upgradeMode, setUpgradeMode] = useState(false);
  const [upgradeSourceFormNo, setUpgradeSourceFormNo] = useState(null);


  const currentUserRef = useRef(sessionManager.getUser());
  const currentUser = currentUserRef.current;
  const currentStatus = formData.Status || formData.status || '';
  const isSubmittedOrApproved = currentStatus === 'Submitted' || currentStatus === 'Approved';

  const timestampMillis = (value) => {
    if (!value) return 0;
    if (typeof value === 'object') return Number(value._seconds || value.seconds || 0) * 1000;
    return Date.parse(value) || 0;
  };
  const rejectedEditable = currentStatus === 'Rejected' && (timestampMillis(formData.editableUntil) > Date.now() || !formData.editableUntil || formData.isEditable === true);
  const isFormLocked = (isSubmittedOrApproved || currentStatus === 'Under Review' ||
    (currentStatus === 'Rejected' && !rejectedEditable)) && !upgradeMode;
  const availabilityClass = formData['Admission sought for class'] || '';
  const admissionsClosed = admissionAvailability.globalClosed ||
    Boolean(availabilityClass && admissionAvailability.classesClosed?.[availabilityClass]);

  // Upgrade mode: provisional → full conversion
  // Detect provisional flag on formData
  const isProvisionalForm =
    formData['Admission Type (Class 11th)'] === 'Provisional' ||
    formData['Admission Type (Class 12th)'] === 'Provisional' ||
    formData['Admission Type'] === 'Provisional' ||
    formData.isProvisional === true;

  // Fetch initial form data & structure
  const initForm = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const [structResult, subjCfgResult, appDataResult] = await Promise.allSettled([
        appsScriptApi.getFormStructure(),
        appsScriptApi.getSubjectsConfig(),
        appsScriptApi.getStudentApplication()
      ]);

      const structRes = structResult.status === 'fulfilled' ? structResult.value : null;
      const subjCfgRes = subjCfgResult.status === 'fulfilled' ? subjCfgResult.value : null;
      const appDataRes = appDataResult.status === 'fulfilled' ? appDataResult.value : null;

      if (structRes && structRes.data && Array.isArray(structRes.data) && structRes.data.length > 0) {
        setFormStructure(structRes.data);
      } else if (structRes && Array.isArray(structRes) && structRes.length > 0) {
        setFormStructure(structRes);
      } else {
        // Safe fallback to default form structure
        const defStruct = require('../../services/appsScriptApi').DEFAULT_FORM_STRUCTURE;
        if (Array.isArray(defStruct)) setFormStructure(defStruct);
      }

      if (subjCfgRes && subjCfgRes.data) setSubjectsConfig(subjCfgRes.data);
      else if (subjCfgRes) setSubjectsConfig(subjCfgRes);

      let existing = {};
      let historical = {};
      let requestedUpgradeFormNo = '';
      try { requestedUpgradeFormNo = JSON.parse(sessionStorage.getItem('hss_admission_upgrade') || '{}').formNo || ''; } catch (e) { }

      const isInactive = (item) => ['Withdrawn', 'Purged', 'Deleted', 'Wiped'].includes(item.Status || item.status) || item._deleted === true;

      if (appDataRes && appDataRes.data) {
        if (Array.isArray(appDataRes.data.applications) && appDataRes.data.applications.length > 0) {
          const active = appDataRes.data.applications.filter(item => !isInactive(item));
          if (active.length > 0) {
            existing = active.find(item => String(item['Form Number'] || item.FormNo || item.formNo || '') === String(requestedUpgradeFormNo)) || active[0];
          }
        }
        if (Array.isArray(appDataRes.data.historicalRecords) && appDataRes.data.historicalRecords.length > 0) {
          historical = appDataRes.data.historicalRecords[appDataRes.data.historicalRecords.length - 1];
        }
      } else if (appDataRes) {
        if (Array.isArray(appDataRes.applications) && appDataRes.applications.length > 0) {
          const active = appDataRes.applications.filter(item => !isInactive(item));
          if (active.length > 0) {
            existing = active.find(item => String(item['Form Number'] || item.FormNo || item.formNo || '') === String(requestedUpgradeFormNo)) || active[0];
          }
        }
        if (Array.isArray(appDataRes.historicalRecords) && appDataRes.historicalRecords.length > 0) {
          historical = appDataRes.historicalRecords[appDataRes.historicalRecords.length - 1];
        }
      }

      // If no active application exists, clear stale upgrade & draft mode so form opens fresh
      if (Object.keys(existing).length === 0) {
        try {
          sessionStorage.removeItem('hss_admission_upgrade');
          sessionStorage.removeItem('hss_admission_draft');
        } catch (e) {}
        setUpgradeMode(false);
        setUpgradeSourceFormNo(null);
      }

      setAdmissionAvailability(appDataRes?.data?.admissionAvailability || appDataRes?.admissionAvailability || { globalClosed: false, classesClosed: {} });
      const existingId = existing.docId || existing.applicationId || '';
      setApplicationId(existingId);
      applicationIdRef.current = existingId;
      // Retrieve local draft if student refreshed the page while drafting
      let localDraft = {};
      try {
        const uid = currentUser?.uid || 'guest';
        localStorage.removeItem(`hss_student_draft_${uid}`);
        localStorage.removeItem('hss_student_draft_guest');
        localStorage.removeItem('hss_student_draft_local');
        const rawDraft = sessionStorage.getItem(`hss_student_draft_${uid}`) ||
          sessionStorage.getItem('hss_student_draft_guest') ||
          sessionStorage.getItem('hss_student_draft_local');
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          const updatedAt = Date.parse(parsed?.updatedAt || '');
          const isFresh = Number.isFinite(updatedAt) && Date.now() - updatedAt <= 30 * 60 * 1000;
          if (isFresh && parsed && parsed.formData && typeof parsed.formData === 'object') {
            localDraft = parsed.formData;
          } else if (!isFresh) {
            sessionStorage.removeItem(`hss_student_draft_${uid}`);
          }
        }
      } catch (e) {
        console.warn('Local draft load note:', e);
      }

      // Pre-fill student photo from any available source (draft, existing, historical, or user profile)
      const preloadedPhoto =
        existing['Student Photo'] || existing['photo_id'] || existing['photoUrl'] || existing['photo'] ||
        localDraft['Student Photo'] || localDraft['photo_id'] || localDraft['photoUrl'] || localDraft['photo'] ||
        historical['Student Photo'] || historical['photo_id'] || historical['photoUrl'] || historical['photo'] ||
        currentUser?.['Student Photo'] || currentUser?.photo_id || currentUser?.photoUrl || currentUser?.photoURL || '';

      // Helper to strip placeholder/dummy form numbers
      const cleanFNoVal = (val) => {
        if (!val) return '';
        const s = String(val).replace(/^(N\/A|#N\/A|—|-|null|undefined)$/i, '').trim();
        if (s.startsWith('FORM_')) return ''; // Ignore temporary timestamp forms
        return s;
      };

      // Dynamically get next sequential Form Number if not already assigned in existing/draft
      const assignedFormNo = cleanFNoVal(
        existing['Form Number'] || existing['FormNo'] || existing['Form No.'] || existing['formNo']
      );

      // If filling a NEW form, merge historical student records for instant pre-fill
      const isExistingSubmitted = ['Submitted', 'Approved', 'Under Review'].includes(existing.Status || existing.status);
      const prefillSource = isExistingSubmitted ? existing : (Object.keys(localDraft).length > 0 ? { ...historical, ...localDraft } : (Object.keys(existing).length > 0 ? existing : historical));

      const defaultSession = (() => {
        const now = new Date();
        const calYear = now.getFullYear();
        const calMonth = now.getMonth() + 1;
        const calDay = now.getDate();
        const isPastCutoff = calMonth > 10 || (calMonth === 10 && calDay > 31);
        const sessionEndYear = isPastCutoff ? calYear + 1 : calYear;
        return `${sessionEndYear - 1}-${String(sessionEndYear).slice(-2)}`;
      })();

      const mergedData = {
        ...prefillSource,
        ...(isExistingSubmitted ? {} : localDraft),
        ...(assignedFormNo ? { 'Form Number': assignedFormNo, FormNo: assignedFormNo, formNo: assignedFormNo } : {}),
        Session: prefillSource.Session || prefillSource.session || appDataRes?.data?.activeSession || appDataRes?.activeSession || defaultSession,
        'Email Address': prefillSource['Email Address'] || currentUser?.email || '',
        'Student Photo': preloadedPhoto,
        'photoUrl': preloadedPhoto,
      };

      // Clear previous status if creating a fresh form from historical record or applying afresh
      if (Object.keys(existing).length === 0) {
        delete mergedData.Status;
        delete mergedData.status;
        delete mergedData.submittedAt;
        delete mergedData['Form Number'];
        delete mergedData['FormNo'];
        delete mergedData['formNo'];
      }

      if (Object.keys(localDraft).length > 0 && !isExistingSubmitted) {
        setHasConfirmedInstructions(true);
        setShowInstructions(false);
        setAlert({
          type: 'info',
          text: '✨ Restored your auto-saved draft! You can continue filling out your application form.'
        });
      } else if (Object.keys(existing).length > 0) {
        const exStat = existing.Status || existing.status;
        if (exStat === 'Submitted' || exStat === 'Approved' || exStat === 'Under Review') {
          setHasConfirmedInstructions(true);
          setShowInstructions(false);
          setAlert({
            type: 'info',
            text: `📄 Application Submitted (Form #${assignedFormNo || existing['Form Number'] || '—'}): Your application is locked for school verification. You can download or print your official PDF copy below.`
          });
        } else {
          setAlert({
            type: 'info',
            text: `✨ Welcome back! Your application (Form #${assignedFormNo}) & passport photo have been retrieved. You can update any fields or select your new class & subjects.`
          });
        }
      } else if (Object.keys(historical).length > 0) {
        setAlert({
          type: 'info',
          text: `✨ Smart Auto-Fill: Welcome back! Your previous school records & passport photo have been automatically retrieved. Simply choose your new class and subjects to submit for the new session!`
        });
      }

      setFormData(mergedData);
    } catch (err) {
      console.error('Failed to initialize admission form:', err);
      setAlert({ type: 'error', text: err.userMessage || 'Failed to load form configuration.' });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Detect upgrade mode from sessionStorage (set by StudentDashboard "Convert" button)
  useEffect(() => {
    try {
      const upgradeStr = sessionStorage.getItem('hss_admission_upgrade');
      if (upgradeStr) {
        const upgradeCtx = JSON.parse(upgradeStr);
        if (upgradeCtx && upgradeCtx.formNo && !upgradeMode) {
          setUpgradeMode(true);
          setUpgradeSourceFormNo(upgradeCtx.formNo || null);
          setAlert({
            type: 'info',
            text: `🔄 Upgrade Mode: Converting Provisional Form #${upgradeCtx.formNo || ''} to Full Admission. All your details are pre-filled. Update the Admission Type to "Regular" and fill in the remaining required fields (marks, board reg. no., year of passing, etc.).`,
          });
        }
      }
    } catch (e) {}
  }, []);

  // 60-Second Auto-Dismiss Timer for Notification Alert Toasts
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => {
      setAlert(null);
    }, 60000);
    return () => clearTimeout(timer);
  }, [alert]);

  // Ensure form always starts predictably at top on load / login / draft restore
  useEffect(() => {
    if (!loading) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [loading]);

  useEffect(() => {
    initForm();
  }, [initForm]);

  // Debounced, owner-scoped server draft. Sensitive identifiers and photos are
  // excluded by admissionWorkflowApi and never placed in browser storage.
  useEffect(() => {
    if (Object.keys(formData).length === 0 || isFormLocked || autosaveServiceUnavailableRef.current) return undefined;
    if (!formData['Admission sought for class'] && !formData["Student's Name (as per school records)"]) return undefined;
    const timer = setTimeout(async () => {
      setDraftState('saving');
      try {
        const result = await saveAdmissionDraft({ formData, applicationId: applicationIdRef.current });
        if (result.applicationId && !applicationIdRef.current) {
          applicationIdRef.current = result.applicationId;
          setApplicationId(result.applicationId);
        }
        setDraftSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setDraftState('saved');
        autosaveServiceUnavailableRef.current = false;
      } catch (error) {
        if (error.isServiceUnavailable) autosaveServiceUnavailableRef.current = true;
        else console.warn('Admission autosave failed:', error);
        setDraftState('error');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [formData, isFormLocked]);

  useEffect(() => {
    if (isFormLocked || Object.keys(formData).length === 0) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formData, isFormLocked]);

  // Auto-dismiss notification popup after 6 seconds for success/info
  useEffect(() => {
    if (alert && (alert.type === 'success' || alert.type === 'info')) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Preserve a useful screen across hot updates or old saved UI state after the
  // former Subjects tab was merged into Academics.
  useEffect(() => {
    if (activeTab === 'subjects') setActiveTab('academic');
  }, [activeTab]);

  const handleFieldChange = (fieldName, value) => {
    // Auto-collapse setup options as soon as student inputs data into form fields
    const isSetupField = fieldName === 'Admission sought for class' ||
      fieldName.includes('Admission Type') ||
      fieldName.includes('Stream for Class 11th') ||
      fieldName.includes('Reason for Provisional');
    if (!isSetupField && hasAdmissionStart) {
      setIsSetupCollapsed(true);
    }

    // Strip numbers and strange symbols from person names
    let cleanValue = value;
    if (isPersonNameField(fieldName) && typeof cleanValue === 'string') {
      cleanValue = sanitizePersonName(cleanValue);
    }

    setFormData((prev) => {
      const next = { ...prev, [fieldName]: cleanValue };

      // ── Dependent field auto-clearing ──

      // Disability
      if (fieldName === 'Whether Any Disability' && value === 'No') {
        next['Type of Disability'] = '';
      }

      // Scholarship
      if (fieldName === 'Whether scholarship received in previous academic year' && value === 'No') {
        next['Type of scholarship received'] = '';
        next['Amount received (INR)'] = '';
      }

      // Vocational
      if (fieldName === 'Vocational subject in previous class' && value === 'No') {
        next['Percentage Obtained in Vocational Subject'] = '';
      }

      // When stream is selected for 11th, keep Stream for Class 11th in sync
      // so 12th auto-inherits it from 'Stream opted in Class 11th'
      if (fieldName === 'Stream for Class 11th') {
        if (prev['Stream for Class 11th'] !== value) {
          next['Subjects to be taken in Class 11th'] = '';
        }
        next['Stream'] = value; // keep general Stream key in sync
      }
      if (fieldName === 'Stream opted in Class 11th') {
        next['Stream for Class 11th'] = value; // 12th carries 11th stream forward
        next['Stream'] = value;
        // A changed stream invalidates any subject choices made for the old stream.
        next['Subjects Studied in Class 11th'] = '';
        next['Stream & Subjects for Class 12th'] = '';
      }
      if (fieldName === 'Subjects Studied in Class 10th') {
        // Synchronize reappear subjects: keep only subjects that remain studied (compulsory + optional)
        const comp10 = ["English", "Mathematics", "Science", "Social Science"];
        const studiedArr = (typeof value === 'string' ? value.split(', ') : (value || [])).map(s => s.trim()).filter(Boolean);
        const allStudied10 = [...new Set([...comp10, ...studiedArr])];
        const currentReappear = String(next['Subjects to Reappear (Class 10th)'] || '').split(', ').map(s => s.trim()).filter(Boolean);
        const validReappear = currentReappear.filter(sub => allStudied10.includes(sub));
        next['Subjects to Reappear (Class 10th)'] = validReappear.join(', ');
      }
      if (fieldName === 'Subjects Studied in Class 11th') {
        // Class 12 continues the same subject combination. Keep the legacy/print
        // summary field synchronized without asking the student to type it again.
        next['Stream & Subjects for Class 12th'] = value;
        const stream11 = next['Stream opted in Class 11th'] || next['Stream for Class 11th'] || '';
        const comp11 = (stream11 === 'Humanities' || stream11 === 'Arts') ? ["General English"] : ["General English", "Physics", "Chemistry"];
        const studiedArr = (typeof value === 'string' ? value.split(', ') : (value || [])).map(s => s.trim()).filter(Boolean);
        const allStudied11 = [...new Set([...comp11, ...studiedArr])];
        const currentReappear = String(next['Subjects to Reappear (Class 11th)'] || '').split(', ').map(s => s.trim()).filter(Boolean);
        const validReappear = currentReappear.filter(sub => allStudied11.includes(sub));
        next['Subjects to Reappear (Class 11th)'] = validReappear.join(', ');
      }

      // Class 11th Admission Type changed
      if (fieldName === 'Admission Type (Class 11th)') {
        if (value !== 'Provisional') {
          // Switching to full — clear provisional-only fields
          next['Reason for Provisional (Class 11th)'] = '';
          next['Subjects to Reappear (Class 10th)'] = '';
          next['Year of Appearing (Class 10th)'] = '';
        } else {
          // Switching to provisional — clear full-admission marks fields
          next['Total Marks Obtained in Class 10th'] = '';
          next['Total Max. Marks in Class 10th'] = '';
          next['Year of Passing Class 10th'] = '';
        }
      }

      // Class 11th Reason for Provisional changed
      if (fieldName === 'Reason for Provisional (Class 11th)') {
        if (value !== 'Reappear Candidate') {
          next['Subjects to Reappear (Class 10th)'] = '';
        }
      }

      // Class 12th Admission Type changed
      if (fieldName === 'Admission Type (Class 12th)') {
        if (value !== 'Provisional') {
          next['Reason for Provisional (Class 12th)'] = '';
          next['Subjects to Reappear (Class 11th)'] = '';
          next['Year of Appearing (Class 11th)'] = '';
        } else {
          next['Total Marks Obtained in Class 11th'] = '';
          next['Total Max. Marks in Class 11th'] = '';
          next['Year of Passing Class 11th'] = '';
        }
      }

      // Class 12th Reason for Provisional changed
      if (fieldName === 'Reason for Provisional (Class 12th)') {
        if (value !== 'Reappear Candidate') {
          next['Subjects to Reappear (Class 11th)'] = '';
        }
      }

      // Class changed — clear admission-type and all dependent provisional fields
      if (fieldName === 'Admission sought for class') {
        next['Admission Type (Class 11th)'] = '';
        next['Admission Type (Class 12th)'] = '';
        next['Reason for Provisional (Class 11th)'] = '';
        next['Reason for Provisional (Class 12th)'] = '';
        next['Subjects to Reappear (Class 10th)'] = '';
        next['Subjects to Reappear (Class 11th)'] = '';
        next['Year of Appearing (Class 10th)'] = '';
        next['Year of Appearing (Class 11th)'] = '';
      }

      // ── Auto-calculate Percentage for 10th/11th/8th/9th marks ──
      ['Class 10th', 'Class 11th', 'Class 8th', 'Class 9th'].forEach(cls => {
        const obtKey = `Total Marks Obtained in ${cls}`;
        const maxKey = `Total Max. Marks in ${cls}`;
        const obt = parseFloat(next[obtKey]);
        const max = parseFloat(next[maxKey]);
        if (!isNaN(obt) && !isNaN(max) && max > 0) {
          const calcPct = ((obt / max) * 100).toFixed(2);
          next[`%age (${cls})`] = `${calcPct}%`;
          next[`Percentage (${cls})`] = `${calcPct}%`;
        }
      });

      return next;
    });

    // ── Real-time cross-field mobile duplicate check ──
    setFieldErrors((prev) => {
      const next = { ...prev };

      // Clear the current field's error first (normal clear-on-change)
      delete next[fieldName];

      // Determine the up-to-date values for both mobile fields
      const STUDENT_MOBILE_KEY = "Mobile No. (with working WhatsApp)";
      const PARENT_MOBILE_KEY  = "Parent's Mobile No. (must be working)";

      const studentRaw = fieldName === STUDENT_MOBILE_KEY
        ? String(value || '')
        : String(formData[STUDENT_MOBILE_KEY] || '');
      const parentRaw = fieldName === PARENT_MOBILE_KEY
        ? String(value || '')
        : String(formData[PARENT_MOBILE_KEY] || '');

      const studentDigits = studentRaw.replace(/[^0-9]/g, '');
      const parentDigits  = parentRaw.replace(/[^0-9]/g, '');

      const DUPE_MSG = "Student's and Parent's mobile numbers must be different";

      if (
        studentDigits.length === 10 &&
        parentDigits.length  === 10 &&
        studentDigits === parentDigits
      ) {
        next[PARENT_MOBILE_KEY] = DUPE_MSG;
      } else {
        // Clear dupe error on either field if numbers are now distinct
        if (next[PARENT_MOBILE_KEY] === DUPE_MSG) delete next[PARENT_MOBILE_KEY];
        if (next[STUDENT_MOBILE_KEY] === DUPE_MSG) delete next[STUDENT_MOBILE_KEY];
      }

      return next;
    });

    // ── Real-time Database Duplicate Mobile Guard (for same session) ──
    const STUDENT_MOBILE_KEY = "Mobile No. (with working WhatsApp)";
    const PARENT_MOBILE_KEY  = "Parent's Mobile No. (must be working)";

    if (fieldName === STUDENT_MOBILE_KEY || fieldName === PARENT_MOBILE_KEY) {
      const mobileDigits = String(cleanValue || '').replace(/[^0-9]/g, '');
      if (mobileDigits.length === 10) {
        if (mobileCheckTimeoutRef.current) clearTimeout(mobileCheckTimeoutRef.current);
        mobileCheckTimeoutRef.current = setTimeout(async () => {
          try {
            const res = await appsScriptApi.checkDuplicateMobileInSession({
              mobile: mobileDigits,
              session: formData.Session || formData.session,
              currentApplicationId: applicationIdRef.current || applicationId,
              currentFormNo: formData['Form Number'] || formData.FormNo || formData.formNo,
              currentOwnerUid: currentUser?.uid,
            });
            if (res.isDuplicate) {
              setFieldErrors((prev) => ({
                ...prev,
                [fieldName]: res.message,
              }));
            } else {
              setFieldErrors((prev) => {
                const next = { ...prev };
                if (next[fieldName]?.includes('already linked to Form No.')) {
                  delete next[fieldName];
                }
                return next;
              });
            }
          } catch (e) {
            console.warn('Real-time mobile duplicate check note:', e);
          }
        }, 350);
      }
    }

    setFieldErrors((prev) => {
      const next = { ...prev };

      // ── Real-time cross-field Aadhaar duplicate check ──
      const STUDENT_AADHAAR_KEY = "Aadhar No.";
      const FATHER_AADHAAR_KEY  = "Father's Aadhar No.";

      const studentAadhaarRaw = fieldName === STUDENT_AADHAAR_KEY
        ? String(value || '')
        : String(formData[STUDENT_AADHAAR_KEY] || '');
      const fatherAadhaarRaw = fieldName === FATHER_AADHAAR_KEY
        ? String(value || '')
        : String(formData[FATHER_AADHAAR_KEY] || '');

      const studentAadhaarDigits = studentAadhaarRaw.replace(/[^0-9]/g, '');
      const fatherAadhaarDigits  = fatherAadhaarRaw.replace(/[^0-9]/g, '');

      const AADHAAR_DUPE_MSG = "Student's and Father's Aadhaar numbers cannot be identical";

      if (
        studentAadhaarDigits.length === 12 &&
        fatherAadhaarDigits.length  === 12 &&
        studentAadhaarDigits === fatherAadhaarDigits
      ) {
        next[FATHER_AADHAAR_KEY] = AADHAAR_DUPE_MSG;
      } else {
        // Clear dupe error on either field if Aadhaar numbers are now distinct
        if (next[FATHER_AADHAAR_KEY] === AADHAAR_DUPE_MSG) delete next[FATHER_AADHAAR_KEY];
        if (next[STUDENT_AADHAAR_KEY] === AADHAAR_DUPE_MSG) delete next[STUDENT_AADHAAR_KEY];
      }

      return next;
    });
  };

  const handleSaveDraft = async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setIsSubmitting(true);
      setAlert(null);
    }
    try {
      const defaultSession = (() => {
        const now = new Date();
        const calYear = now.getFullYear();
        const calMonth = now.getMonth() + 1;
        const calDay = now.getDate();
        const isPastCutoff = calMonth > 10 || (calMonth === 10 && calDay > 31);
        const sessionEndYear = isPastCutoff ? calYear + 1 : calYear;
        return `${sessionEndYear - 1}-${String(sessionEndYear).slice(-2)}`;
      })();
      const draftPayload = {
        ...formData,
        Session: formData.Session || formData.session || defaultSession,
        'Email Address': formData['Email Address'] || currentUser?.email || '',
      };
      const res = await saveAdmissionDraft({ formData: draftPayload, applicationId: applicationIdRef.current, force: true });
      if (res.applicationId) {
        applicationIdRef.current = res.applicationId;
        setApplicationId(res.applicationId);
      }
      setDraftSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setDraftState('saved');
      autosaveServiceUnavailableRef.current = false;
      if (!silent) {
        setAlert({
          type: 'success',
          text: res?.localOnly
            ? 'Draft securely saved to your browser session. It will sync automatically upon final submission.'
            : 'Secure draft saved. Sensitive numbers and the photograph remain in this active form until final submission.'
        });
      }
      return res;
    } catch (err) {
      console.warn('Draft save error:', err);
      setDraftState('error');
      if (!silent) {
        setAlert({
          type: 'error',
          text: 'The draft could not be saved. Keep this page open and try again.'
        });
      }
      throw err;
    } finally {
      if (!silent) setIsSubmitting(false);
    }
  };

  const handleBackWithAutoSave = async (e) => {
    if (e) e.preventDefault();
    if (isFormLocked || isSubmitting) {
      navigate('/portal/student');
      return;
    }
    // Auto-save draft before navigating back
    if (hasAdmissionStart || Object.keys(formData).length > 0) {
      try {
        setIsBackSaving(true);
        await handleSaveDraft({ silent: true });
      } catch (err) {
        console.warn('Auto-save on back warning:', err);
      } finally {
        setIsBackSaving(false);
        navigate('/portal/student');
      }
    } else {
      navigate('/portal/student');
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    setAlert(null);
    try {
      const dataToPrint = submittedSuccessData || formData;
      if (isProvisionalForm) {
        generateProvisionalAdmissionPdf(dataToPrint);
      } else {
        generateStudentAdmissionPdf(dataToPrint);
      }
    } catch (err) {
      console.error('Manual PDF print error:', err);
      setAlert({ type: 'error', text: 'Could not generate the PDF right now. Please try again in a moment.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const selectedClass = formData['Admission sought for class'] || '';
  // 12th inherits stream from the "Stream opted in Class 11th" field;
  // 9th/10th is always General; 11th uses explicit selection.
  const selectedStream =
    selectedClass.includes('12')
      ? (formData['Stream opted in Class 11th'] || formData['Stream for Class 11th'] || formData['Stream'] || '')
      : (selectedClass.includes('9') || selectedClass === '10th')
      ? 'General'
      : (formData['Stream for Class 11th'] || formData['Stream'] || '');
  const maskSensitive = (value, visible = 4) => {
    const text = String(value || '').replace(/\s/g, '');
    if (!text) return 'N/A';
    return `${'•'.repeat(Math.max(4, text.length - visible))}${text.slice(-visible)}`;
  };
  const workflowSteps = [
    { id: 'personal', label: 'Student', mobileLabel: 'Student' },
    { id: 'contact', label: 'Contact', mobileLabel: 'Contact' },
    { id: 'academic', label: 'Academics & Subjects', mobileLabel: 'Academics' },
    { id: 'review', label: 'Review', mobileLabel: 'Review' },
  ];
  const admissionTypeField = selectedClass === '12th'
    ? 'Admission Type (Class 12th)'
    : selectedClass === '11th' ? 'Admission Type (Class 11th)' : 'Admission Type';
  const selectedAdmissionType = formData[admissionTypeField] || formData['Admission Type'] || '';
  const is11thClass = selectedClass === '11th';
  const hasStreamIf11th = !is11thClass || Boolean(formData['Stream for Class 11th'] || formData['Stream']);
  const hasReasonIfProvisional = selectedAdmissionType !== 'Provisional' || Boolean(
    formData['Reason for Provisional (Class 11th)'] ||
    formData['Reason for Provisional (Class 12th)'] ||
    formData['Reason for Provisional']
  );
  const hasAdmissionStart = Boolean(selectedClass && selectedAdmissionType && hasStreamIf11th && hasReasonIfProvisional);

  useEffect(() => {
    if (!hasAdmissionStart || typeof IntersectionObserver === 'undefined') return undefined;
    const sectionIds = ['personal', 'contact', 'academic', 'review'];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveTab(visible.target.id.replace('admission-section-', ''));
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0.05, 0.2, 0.5] });
    sectionIds.forEach(id => {
      const section = document.querySelector(`#admission-section-${id}`);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [hasAdmissionStart]);

  const goToWorkflowStep = (step) => {
    if (!hasAdmissionStart) {
      const msg = !selectedClass
        ? 'First select the target class for admission.'
        : !selectedAdmissionType
        ? 'Please select the admission type (Full or Provisional).'
        : is11thClass && !hasStreamIf11th
        ? 'Please select your stream (Science or Humanities) for Class 11th.'
        : 'Please select the reason for provisional admission.';
      setAlert({ type: 'error', text: msg });
      document.querySelector('#admission-start')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setActiveTab(step.id);
    document.querySelector(`#admission-section-${step.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sectionWorkflowStep = (sectionTitle) => {
    const section = String(sectionTitle || '').toLowerCase();
    if (section.includes('remark') || section.includes('review') || section.includes('declaration')) return 'review';
    if (section.includes('contact') || section.includes('address')) return 'contact';
    if (section.includes('stream') || section.includes('subject')) return 'academic';
    if (section.includes('admission') || section.includes('examination') || section.includes('scholarship') || section.includes('bank') || section.includes('vocational')) return 'academic';
    return 'personal';
  };

  const isVisible = (field) => {
    const fieldName = field.fieldName || field.name || field['Field Name'];

    // Class filter from field metadata
    const clsList = field.classes || field['Classes'] || '';
    if (clsList) {
      const allowed = clsList.split(',').map(c => c.trim()).filter(Boolean);
      const isAllowed = allowed.some(clsToken => selectedClass.includes(clsToken));
      if (!isAllowed) return false;
    }

    const admType11 = formData['Admission Type (Class 11th)'];
    const admType12 = formData['Admission Type (Class 12th)'];
    const reason11  = formData['Reason for Provisional (Class 11th)'];
    const reason12  = formData['Reason for Provisional (Class 12th)'];
    const disability   = formData['Whether Any Disability'];
    const scholarship  = formData['Whether scholarship received in previous academic year'];
    const vocational   = formData['Vocational subject in previous class'];

    const is11 = selectedClass.includes('11') && !selectedClass.includes('12');
    const is12 = selectedClass.includes('12');
    const is10 = selectedClass === '10th';
    const is9  = selectedClass === '9th';

    // ── Fields controlled by Step 1 card — never shown inside form body ──
    if (fieldName === 'Admission sought for class')   return false;
    if (fieldName === 'Admission Type (Class 11th)')  return false;
    if (fieldName === 'Admission Type (Class 12th)')  return false;
    if (fieldName === 'Admission Type')               return false;
    if (fieldName === 'Stream for Class 11th')        return false; // handled in Step 1 for 11th

    // ── Reason for Provisional — Handled in top admission options bar ──
    if (fieldName === 'Reason for Provisional (Class 11th)') return false;
    if (fieldName === 'Reason for Provisional (Class 12th)') return false;
    if (fieldName === 'Reason for Provisional') return false;

    // ── Reappear Subjects ──
    if (fieldName === 'Subjects to Reappear (Class 10th)')
      return is11 && admType11 === 'Provisional' && reason11 === 'Reappear Candidate';
    if (fieldName === 'Subjects to Reappear (Class 11th)')
      return is12 && admType12 === 'Provisional' && reason12 === 'Reappear Candidate';

    // ── Class 10th Examination Records — visible when applying for 11th ──
    if (fieldName === 'Board Registration No. (Class 10th)') return is11;
    if (fieldName === 'Exam Roll Number of Class 10th')       return is11;
    if (fieldName === 'Year of Passing Class 10th')
      return is11 && admType11 !== 'Provisional';
    if (fieldName === 'Year of Appearing (Class 10th)')
      return false; // Not relevant
    if (fieldName === 'Total Marks Obtained in Class 10th') return is11 && admType11 !== 'Provisional';
    if (fieldName === 'Total Max. Marks in Class 10th')     return is11 && admType11 !== 'Provisional';
    if (fieldName === 'Name of Previous School (Class 10th)') return is11;
    if (fieldName === 'Board (Class 10th)')                   return is11;
    // Subjects Studied in Class 10th lives in Class 10th Records section
    if (fieldName === 'Subjects Studied in Class 10th') return is11;

    // ── Class 11th Examination Records — visible when applying for 12th ──
    if (fieldName === 'Board Registration No. (Class 11th)') return is12;
    if (fieldName === 'Exam Roll Number of Class 11th')       return is12;
    if (fieldName === 'Year of Passing Class 11th')
      return is12 && admType12 !== 'Provisional';
    if (fieldName === 'Year of Appearing (Class 11th)')
      return false; // Not relevant
    if (fieldName === 'Total Marks Obtained in Class 11th') return is12 && admType12 !== 'Provisional';
    if (fieldName === 'Total Max. Marks in Class 11th')     return is12 && admType12 !== 'Provisional';
    if (fieldName === 'Name of Previous School (Class 11th)') return is12;
    if (fieldName === 'Board (Class 11th)')                   return is12;

    // ── Stream & Subject fields for 11th (stream chosen in Step 1) ──
    if (fieldName === 'Subjects to be taken in Class 11th') return is11;
    // For 12th: stream is asked as 'Stream opted in Class 11th' inside form body
    if (fieldName === 'Stream opted in Class 11th')     return is12;
    if (fieldName === 'Subjects Studied in Class 11th') return is12;
    // Derived from Subjects Studied in Class 11th. Keep it in saved data/PDFs,
    // but do not display a redundant input during Class 12 admission.
    if (fieldName === 'Stream & Subjects for Class 12th') return false;

    if (fieldName === 'Subjects to be taken in Class 10th') return is10;
    if (fieldName === 'Subjects Studied in Class 9th')      return is10;
    if (fieldName === 'Subjects to be taken in Class 9th')  return is9;
    if (fieldName === 'Subjects Studied in Class 8th')      return is9;

    // ── Class 8th / 9th Records — only for lower classes ──
    if (fieldName === 'DIET Registration No.')                return is9 || is10;
    if (fieldName === 'Year of Passing Class 8th')            return is9;
    if (fieldName === 'Name of Previous School (Class 8th)')  return is9;
    if (fieldName === 'Board (Class 8th)')                    return is9;
    if (fieldName === 'Total Marks Obtained in Class 8th')    return is9;
    if (fieldName === 'Total Max. Marks in Class 8th')        return is9;
    if (fieldName === 'Name of Previous Complex Head')        return is9 || is10;
    if (fieldName === 'Board Registration No. (Class 9th)')   return is10;
    if (fieldName === 'Year of Passing Class 9th')            return is10;
    if (fieldName === 'Name of Previous School (Class 9th)')  return is10;
    if (fieldName === 'Board (Class 9th)')                    return is10;
    if (fieldName === 'Total Max. Marks in Class 9th')        return is10;
    if (fieldName === 'Total Marks Obtained in Class 9th')    return is10;

    // ── Disability Dependent Fields ──
    if (fieldName === 'Type of Disability') return disability === 'Yes';

    // ── Scholarship Dependent Fields ──
    if (fieldName === 'Type of scholarship received' || fieldName === 'Amount received (INR)')
      return scholarship === 'Yes';

    // ── Vocational Dependent Fields ──
    if (fieldName === 'Percentage Obtained in Vocational Subject') return vocational === 'Yes';

    return true;
  };

  // This is the single authoritative field-to-section classification. Keeping one
  // map prevents tabs, validation and the PDF workflow from drifting apart.
  const fieldSectionMap = {
    // 1. Personal & Identity Sub-group
    "Student Photo": '👤 Identity & Parentage',
    "id card photo": '👤 Identity & Parentage',
    "Student's Name (as per school records)": '👤 Identity & Parentage',
    "DoB (as per school records)": '👤 Identity & Parentage',
    "Gender": '👤 Identity & Parentage',
    "Father's/Guardian's Name (as per school records)": '👤 Identity & Parentage',
    "Father's/Guardian's Occupation": '👤 Identity & Parentage',
    "Mother's Name (as per school records)": '👤 Identity & Parentage',
    "Aadhar No.": '👤 Identity & Parentage',
    "Father's Aadhar No.": '👤 Identity & Parentage',
    "Your Mother Tongue": '👤 Identity & Parentage',
    "Identification Mark (if any)": '👤 Identity & Parentage',

    // 2. Combined Contact & Residential Address
    "Mobile No. (with working WhatsApp)": '📱 Contact & Residential Address',
    "Parent's Mobile No. (must be working)": '📱 Contact & Residential Address',
    "Email Address": '📱 Contact & Residential Address',
    "E-mail ID": '📱 Contact & Residential Address',
    "House No.": '📱 Contact & Residential Address',
    "Name of your village": '📱 Contact & Residential Address',
    "Block": '📱 Contact & Residential Address',
    "Tehsil": '📱 Contact & Residential Address',
    "District": '📱 Contact & Residential Address',
    "State/UT": '📱 Contact & Residential Address',
    "PIN code": '📱 Contact & Residential Address',

    // 3. Physical & Social Category
    "Height (cm)": '🩺 Physical & Social Category',
    "Weight (kg)": '🩺 Physical & Social Category',
    "Blood Group": '🩺 Physical & Social Category',
    "Religion": '🩺 Physical & Social Category',
    "Social category": '🩺 Physical & Social Category',
    "Socio-economic category": '🩺 Physical & Social Category',
    "Whether Any Disability": '🩺 Physical & Social Category',
    "Type of Disability": '🩺 Physical & Social Category',

    // 4. National & Student Identifiers & Sports
    "PEN number (given by UDISE portal)": '🆔 National & Student Identifiers',
    "APAAR ID": '🆔 National & Student Identifiers',
    "Passport No. (if available)": '🆔 National & Student Identifiers',
    "Previous participation in sports (if any)": '⚽ Sports & Extracurricular',
    "Games to participate": '⚽ Sports & Extracurricular',

    // Academic Sub-groups
    "Admission sought for class": '🎓 Admission & Class Details',
    "Admission Type (Class 11th)": '🎓 Admission & Class Details',
    "Reason for Provisional (Class 11th)": '🎓 Admission & Class Details',
    "Admission Type (Class 12th)": '🎓 Admission & Class Details',
    "Reason for Provisional (Class 12th)": '🎓 Admission & Class Details',

    "Board Registration No. (Class 10th)": '🏫 Class 10th Examination Records',
    "Exam Roll Number of Class 10th": '🏫 Class 10th Examination Records',
    "Year of Passing Class 10th": '🏫 Class 10th Examination Records',
    "Year of Appearing (Class 10th)": '🏫 Class 10th Examination Records',
    "Total Marks Obtained in Class 10th": '🏫 Class 10th Examination Records',
    "Total Max. Marks in Class 10th": '🏫 Class 10th Examination Records',
    "Name of Previous School (Class 10th)": '🏫 Class 10th Examination Records',
    "Board (Class 10th)": '🏫 Class 10th Examination Records',

    "Board Registration No. (Class 11th)": '🏫 Class 11th Examination Records',
    "Exam Roll Number of Class 11th": '🏫 Class 11th Examination Records',
    "Year of Passing Class 11th": '🏫 Class 11th Examination Records',
    "Year of Appearing (Class 11th)": '🏫 Class 11th Examination Records',
    "Total Marks Obtained in Class 11th": '🏫 Class 11th Examination Records',
    "Total Max. Marks in Class 11th": '🏫 Class 11th Examination Records',
    "Name of Previous School (Class 11th)": '🏫 Class 11th Examination Records',
    "Board (Class 11th)": '🏫 Class 11th Examination Records',

    "DIET Registration No.": '🏫 Class 8th / 9th Examination Records',
    "Year of Passing Class 8th": '🏫 Class 8th / 9th Examination Records',
    "Name of Previous School (Class 8th)": '🏫 Class 8th / 9th Examination Records',
    "Board (Class 8th)": '🏫 Class 8th / 9th Examination Records',
    "Total Marks Obtained in Class 8th": '🏫 Class 8th / 9th Examination Records',
    "Total Max. Marks in Class 8th": '🏫 Class 8th / 9th Examination Records',
    "Name of Previous Complex Head": '🏫 Class 8th / 9th Examination Records',
    "Board Registration No. (Class 9th)": '🏫 Class 8th / 9th Examination Records',
    "Year of Passing Class 9th": '🏫 Class 8th / 9th Examination Records',
    "Name of Previous School (Class 9th)": '🏫 Class 8th / 9th Examination Records',
    "Board (Class 9th)": '🏫 Class 8th / 9th Examination Records',
    "Total Max. Marks in Class 9th": '🏫 Class 8th / 9th Examination Records',
    "Total Marks Obtained in Class 9th": '🏫 Class 8th / 9th Examination Records',

    "Whether scholarship received in previous academic year": '🎁 Scholarship Details',
    "Type of scholarship received": '🎁 Scholarship Details',
    "Amount received (INR)": '🎁 Scholarship Details',
    "Bank Account No.": '🏦 Bank Account Details',
    "Name of Bank": '🏦 Bank Account Details',
    "IFSC code": '🏦 Bank Account Details',
    "Vocational subject in previous class": '🛠️ Vocational Studies',
    "Percentage Obtained in Vocational Subject": '🛠️ Vocational Studies',

    // Subject Sub-groups
    "Stream for Class 11th": '📚 Stream & Subject Selection',
    "Stream opted in Class 11th": '📚 Stream & Subject Selection',
    "Stream & Subjects for Class 12th": '📚 Stream & Subject Selection',
    "Subjects Studied in Class 8th": '🏫 Class 8th / 9th Examination Records',
    "Subjects to be taken in Class 9th": '📖 Subject Combinations',
    "Subjects Studied in Class 9th": '🏫 Class 8th / 9th Examination Records',
    "Subjects to be taken in Class 10th": '📖 Subject Combinations',
    "Subjects Studied in Class 10th": '🏫 Class 10th Examination Records',
    "Subjects to Reappear (Class 10th)": '🏫 Class 10th Examination Records',
    "Subjects to be taken in Class 11th": '📖 Subject Combinations',
    "Subjects Studied in Class 11th": '🏫 Class 11th Examination Records',
    "Subjects to Reappear (Class 11th)": '🏫 Class 11th Examination Records',
    "Remarks/Feedback (if any)": '💬 Remarks & Final Review',
    "Declaration": '💬 Remarks & Final Review'
  };

  const FIELD_ORDER_LIST = [
    // 1. Identity & Parentage (Positioned First)
    "Student Photo",
    "Student's Name (as per school records)",
    "DoB (as per school records)",
    "Gender",
    "Father's/Guardian's Name (as per school records)",
    "Father's/Guardian's Occupation",
    "Mother's Name (as per school records)",
    "Aadhar No.",
    "Father's Aadhar No.",
    "Your Mother Tongue",
    "Identification Mark (if any)",

    // 2. Combined Contact & Residential Address
    "Mobile No. (with working WhatsApp)",
    "Parent's Mobile No. (must be working)",
    "Email Address",
    "E-mail ID",
    "House No.",
    "Name of your village",
    "Block",
    "Tehsil",
    "District",
    "State/UT",
    "PIN code",

    // 3. Physical & Social Category
    "Height (cm)",
    "Weight (kg)",
    "Blood Group",
    "Religion",
    "Social category",
    "Socio-economic category",
    "Whether Any Disability",
    "Type of Disability",

    // 4. National & Student Identifiers & Sports
    "PEN number (given by UDISE portal)",
    "APAAR ID",
    "Passport No. (if available)",
    "Previous participation in sports (if any)",
    "Games to participate",

    // 5. Academic & Class Details
    "Admission sought for class",
    "Admission Type (Class 11th)",
    "Reason for Provisional (Class 11th)",
    "Admission Type (Class 12th)",
    "Reason for Provisional (Class 12th)",

    // 6. Stream & Subject Selections
    "Stream for Class 11th",
    "Subjects to be taken in Class 11th",
    "Stream opted in Class 11th",
    "Stream & Subjects for Class 12th",
    "Subjects to be taken in Class 10th",
    "Subjects to be taken in Class 9th",

    // 7. Class 10th Examination Records
    "Board Registration No. (Class 10th)",
    "Exam Roll Number of Class 10th",
    "Year of Passing Class 10th",
    "Total Marks Obtained in Class 10th",
    "Total Max. Marks in Class 10th",
    "Name of Previous School (Class 10th)",
    "Board (Class 10th)",
    "Subjects Studied in Class 10th",
    "Subjects to Reappear (Class 10th)",

    // 8. Class 11th Examination Records
    "Board Registration No. (Class 11th)",
    "Exam Roll Number of Class 11th",
    "Year of Passing Class 11th",
    "Total Marks Obtained in Class 11th",
    "Total Max. Marks in Class 11th",
    "Name of Previous School (Class 11th)",
    "Board (Class 11th)",
    "Subjects Studied in Class 11th",
    "Subjects to Reappear (Class 11th)",

    // 9. Class 8th / 9th Records
    "DIET Registration No.",
    "Year of Passing Class 8th",
    "Name of Previous School (Class 8th)",
    "Board (Class 8th)",
    "Total Marks Obtained in Class 8th",
    "Total Max. Marks in Class 8th",
    "Name of Previous Complex Head",
    "Board Registration No. (Class 9th)",
    "Year of Passing Class 9th",
    "Name of Previous School (Class 9th)",
    "Board (Class 9th)",
    "Total Max. Marks in Class 9th",
    "Total Marks Obtained in Class 9th",

    // 10. Scholarship & Bank Details
    "Whether scholarship received in previous academic year",
    "Type of scholarship received",
    "Amount received (INR)",
    "Bank Account No.",
    "Name of Bank",
    "IFSC code",
    "Vocational subject in previous class",
    "Percentage Obtained in Vocational Subject",
    "id card photo",
    "Remarks/Feedback (if any)",
    "Declaration"
  ];

  const getFieldOrderIndex = (name) => {
    const idx = FIELD_ORDER_LIST.indexOf(name);
    return idx !== -1 ? idx : 999;
  };

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

  const isFieldRequired = (f) => {
    if (!f) return false;
    const name = f.fieldName || f.name || f['Field Name'];
    if (MANDATORY_FIELD_NAMES.has(name)) return true;
    if (f.required === true || f.required === 'TRUE' || f.required === 'true') return true;
    const val = String(f['Is Required?'] || f['Is Required'] || f.isRequired || f.required || '').toUpperCase().trim();
    return val === 'TRUE' || val === 'YES' || val === '1';
  };

  const activeFields = useMemo(() => {
    const seenNames = new Set();
    const list = formStructure.filter(field => {
      const type = field.fieldType || field.type || field['Field Type'] || '';
      if (type.startsWith('autogen')) return false;
      const name = field.fieldName || field.name || field['Field Name'];
      if (!name || name === 'Declaration') return false;

      const normKey = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenNames.has(normKey)) return false;
      seenNames.add(normKey);

      return isVisible(field);
    });
    list.sort((a, b) => {
      const nameA = a.fieldName || a.name || a['Field Name'];
      const nameB = b.fieldName || b.name || b['Field Name'];
      return getFieldOrderIndex(nameA) - getFieldOrderIndex(nameB);
    });
    return list;
  }, [formStructure, selectedClass, formData]);

  const requiredFields = useMemo(() => activeFields.filter(isFieldRequired), [activeFields]);

  const filledRequiredCount = useMemo(() => {
    return requiredFields.filter(f => {
      const name = f.fieldName || f.name || f['Field Name'];
      const val = formData[name];
      if (val === undefined || val === null) return false;
      const str = String(val).trim();
      if (!str) return false;
      if (str.toLowerCase() === 'other' || str.toLowerCase() === 'others') return false;
      return true;
    }).length;
  }, [requiredFields, formData]);

  const progressPercent = useMemo(() => {
    return requiredFields.length > 0 ? Math.round((filledRequiredCount / requiredFields.length) * 100) : 100;
  }, [filledRequiredCount, requiredFields]);

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (admissionsClosed) {
      setAlert({ type: 'error', text: `Admissions are currently closed${selectedClass ? ` for Class ${selectedClass}` : ''}. Your draft has not been lost.` });
      return;
    }
    if (!hasConfirmedInstructions) {
      setShowInstructions(true);
      setAlert({ type: 'error', text: 'Please read and confirm the admission instructions before reviewing your application.' });
      return;
    }

    const errors = {};
    let firstErrorField = null;

    const addError = (name, msg) => {
      if (!errors[name]) {
        errors[name] = msg;
        if (!firstErrorField) firstErrorField = name;
      }
    };

    // ── HARDCODED ESSENTIAL FIELD VALIDATION ──
    // These run regardless of formStructure availability.
    const cls = selectedClass;

    // Personal essentials
    const photoVal = formData['Student Photo'] || formData['photo_id'] || formData['photo'] || formData['photoUrl'] || formData['id card photo'];
    if (!photoVal)
      addError("Student Photo", "Recent passport-size photograph is required");

    const studentNameVal = String(formData["Student's Name (as per school records)"] || '').trim();
    if (!studentNameVal) {
      addError("Student's Name (as per school records)", "Student's full name is required");
    } else {
      const nameCheck = validatePersonName(studentNameVal, "Student's Name");
      if (!nameCheck.valid) {
        addError("Student's Name (as per school records)", nameCheck.error);
      }
    }

    const dobRaw = formData["DoB (as per school records)"] || formData["DoB"] || formData['dob'] || formData['date of birth'] || '';
    const dobIso = normalizeDobToIso(dobRaw);
    if (dobIso && dobIso !== formData["DoB (as per school records)"]) {
      formData["DoB (as per school records)"] = dobIso;
    }
    if (!dobRaw?.trim()) {
      addError("DoB (as per school records)", "Date of Birth is required");
    } else if (!isStrictIsoDate(dobIso)) {
      addError("DoB (as per school records)", "Enter a valid date of birth");
    } else {
      const ageCheck = validateMinimumAge(dobIso, cls);
      if (!ageCheck.valid) {
        addError("DoB (as per school records)", ageCheck.error);
      }
    }
    if (!formData["Gender"])
      addError("Gender", "Gender is required");

    const fatherNameVal = String(formData["Father's/Guardian's Name (as per school records)"] || '').trim();
    if (!fatherNameVal) {
      addError("Father's/Guardian's Name (as per school records)", "Father's / Guardian's name is required");
    } else {
      const fatherCheck = validatePersonName(fatherNameVal, "Father's / Guardian's Name");
      if (!fatherCheck.valid) {
        addError("Father's/Guardian's Name (as per school records)", fatherCheck.error);
      }
    }

    const motherNameVal = String(formData["Mother's Name (as per school records)"] || '').trim();
    if (!motherNameVal) {
      addError("Mother's Name (as per school records)", "Mother's name is required");
    } else {
      const motherCheck = validatePersonName(motherNameVal, "Mother's Name");
      if (!motherCheck.valid) {
        addError("Mother's Name (as per school records)", motherCheck.error);
      }
    }

    // Mobile validation
    const mobile = String(formData["Mobile No. (with working WhatsApp)"] || '').replace(/[^0-9]/g, '');
    if (!mobile) addError("Mobile No. (with working WhatsApp)", "WhatsApp mobile number is required");
    else if (mobile.length !== 10) addError("Mobile No. (with working WhatsApp)", "Mobile number must be exactly 10 digits");
    else if (['0','1','2','3','4','5'].includes(mobile[0]))
      addError("Mobile No. (with working WhatsApp)", "Mobile number must start with 6, 7, 8, or 9");

    const parentMobile = String(formData["Parent's Mobile No. (must be working)"] || '').replace(/[^0-9]/g, '');
    if (!parentMobile) addError("Parent's Mobile No. (must be working)", "Parent's mobile number is required");
    else if (parentMobile.length !== 10)
      addError("Parent's Mobile No. (must be working)", "Parent's mobile must be exactly 10 digits");
    else if (['0','1','2','3','4','5'].includes(parentMobile[0]))
      addError("Parent's Mobile No. (must be working)", "Parent's mobile must start with 6, 7, 8, or 9");
    else if (mobile.length === 10 && parentMobile === mobile)
      addError("Parent's Mobile No. (must be working)", "Student's and Parent's mobile numbers must be different");

    // ── Session-Scoped Duplicate Mobile Validation Against Live Database ──
    if (mobile.length === 10 && !errors["Mobile No. (with working WhatsApp)"]) {
      try {
        const studentDup = await appsScriptApi.checkDuplicateMobileInSession({
          mobile,
          session: formData.Session || formData.session,
          currentApplicationId: applicationIdRef.current || applicationId,
          currentFormNo: formData['Form Number'] || formData.FormNo || formData.formNo,
          currentOwnerUid: currentUser?.uid,
        });
        if (studentDup.isDuplicate) {
          addError("Mobile No. (with working WhatsApp)", studentDup.message);
        }
      } catch (dupErr) {
        console.warn('Student mobile duplicate validation check note:', dupErr);
      }
    }

    if (parentMobile.length === 10 && !errors["Parent's Mobile No. (must be working)"]) {
      try {
        const parentDup = await appsScriptApi.checkDuplicateMobileInSession({
          mobile: parentMobile,
          session: formData.Session || formData.session,
          currentApplicationId: applicationIdRef.current || applicationId,
          currentFormNo: formData['Form Number'] || formData.FormNo || formData.formNo,
          currentOwnerUid: currentUser?.uid,
        });
        if (parentDup.isDuplicate) {
          addError("Parent's Mobile No. (must be working)", parentDup.message);
        }
      } catch (dupErr) {
        console.warn('Parent mobile duplicate validation check note:', dupErr);
      }
    }

    // Aadhar
    const aadhar = String(formData["Aadhar No."] || '').replace(/[^0-9]/g, '');
    if (!aadhar) addError("Aadhar No.", "Aadhar number is required");
    else if (aadhar.length !== 12) addError("Aadhar No.", "Aadhar number must be exactly 12 digits");
    else if (!isValidAadhaar(aadhar)) addError("Aadhar No.", "Enter a valid Aadhaar number (checksum failed)");

    // Father's Aadhar (Mandatory)
    const fatherAadhar = String(formData["Father's Aadhar No."] || '').replace(/[^0-9]/g, '');
    if (!fatherAadhar) addError("Father's Aadhar No.", "Father's Aadhaar number is required");
    else if (fatherAadhar.length !== 12) addError("Father's Aadhar No.", "Father's Aadhaar number must be exactly 12 digits");
    else if (!isValidAadhaar(fatherAadhar)) addError("Father's Aadhar No.", "Enter a valid Father's Aadhaar number (checksum failed)");
    else if (aadhar.length === 12 && fatherAadhar.length === 12 && aadhar === fatherAadhar) {
      addError("Father's Aadhar No.", "Student's and Father's Aadhaar numbers cannot be identical");
    }

    // Occupations (Mandatory)
    const fatherOcc = String(formData["Father's/Guardian's Occupation"] || formData["Father's Occupation"] || '').trim();
    if (!fatherOcc) addError("Father's/Guardian's Occupation", "Father's / Guardian's occupation is required");

    const motherOcc = String(formData["Mother's Occupation"] || formData["Mother's/Guardian's Occupation"] || '').trim();
    if (formData["Mother's Occupation"] !== undefined && !motherOcc) {
      addError("Mother's Occupation", "Mother's occupation is required");
    }

    // Address
    if (!formData["Name of your village"]?.trim()) addError("Name of your village", "Village / locality name is required");
    if (!formData["District"]?.trim()) addError("District", "District is required");
    const pin = String(formData["PIN code"] || '').replace(/[^0-9]/g, '');
    if (pin && pin.length !== 6) addError("PIN code", "PIN code must be exactly 6 digits");

    // ── Academic essentials: class must be chosen ──
    if (!formData["Admission sought for class"])
      addError("Admission sought for class", "Please select the class for admission");
    const admissionTypeKey = cls === '12th' ? 'Admission Type (Class 12th)'
      : cls === '11th' ? 'Admission Type (Class 11th)' : 'Admission Type';
    if (!formData[admissionTypeKey] && !formData['Admission Type'])
      addError(admissionTypeKey, 'Please select Full or Provisional admission');

    const admType11 = formData['Admission Type (Class 11th)'];
    const admType12 = formData['Admission Type (Class 12th)'];
    const isProvisionalReappear11 = admType11 === 'Provisional' && formData['Reason for Provisional (Class 11th)'] === 'Reappear Candidate';
    const isProvisionalReappear12 = admType12 === 'Provisional' && formData['Reason for Provisional (Class 12th)'] === 'Reappear Candidate';

    const is11v = cls?.includes('11') && !cls?.includes('12');
    const is12v = cls?.includes('12');
    const is10v = cls === '10th';
    const is9v  = cls === '9th';

    // ── Class 11th specific required fields ──
    if (is11v) {
      if (!formData['Stream for Class 11th']?.trim())
        addError('Stream for Class 11th', 'Please select a stream for Class 11th');
      if (!isProvisionalReappear11 && !formData['Board Registration No. (Class 10th)']?.trim())
        addError('Board Registration No. (Class 10th)', 'Board Registration Number (Class 10th) is required');
      if (!formData['Name of Previous School (Class 10th)']?.trim())
        addError('Name of Previous School (Class 10th)', 'Name of previous school (Class 10th) is required');
      if (!formData['Board (Class 10th)']?.trim())
        addError('Board (Class 10th)', 'Board / Examination authority for Class 10th is required');
      const subjects10 = String(formData['Subjects Studied in Class 10th'] || '').trim();
      if (!subjects10)
        addError('Subjects Studied in Class 10th', 'Please select subjects studied in Class 10th');

      // Reappear subjects mandatory for Reappear Candidates
      if (isProvisionalReappear11) {
        const reopenSub10 = String(formData['Subjects to Reappear (Class 10th)'] || '').trim();
        if (!reopenSub10) addError('Subjects to Reappear (Class 10th)', 'Please select the subject(s) you need to reappear in');
      }
    }

    // ── Class 12th specific required fields ──
    if (is12v) {
      if (!formData['Stream opted in Class 11th']?.trim())
        addError('Stream opted in Class 11th', 'Please select the stream you studied in Class 11th');
      if (!isProvisionalReappear12 && !formData['Board Registration No. (Class 11th)']?.trim())
        addError('Board Registration No. (Class 11th)', 'Board Registration Number (Class 11th) is required');
      if (!formData['Name of Previous School (Class 11th)']?.trim())
        addError('Name of Previous School (Class 11th)', 'Name of previous school (Class 11th) is required');
      if (!formData['Board (Class 11th)']?.trim())
        addError('Board (Class 11th)', 'Board / Examination authority for Class 11th is required');
      const subjects11 = String(formData['Subjects Studied in Class 11th'] || '').trim();
      if (!subjects11)
        addError('Subjects Studied in Class 11th', 'Please select subjects studied in Class 11th');

      // Reappear subjects mandatory for Reappear Candidates
      if (isProvisionalReappear12) {
        const reopenSub11 = String(formData['Subjects to Reappear (Class 11th)'] || '').trim();
        if (!reopenSub11) addError('Subjects to Reappear (Class 11th)', 'Please select the subject(s) you need to reappear in');
      }
    }

    // ── Class 10th specific required fields ──
    if (is10v) {
      if (!formData['Board Registration No. (Class 9th)']?.trim())
        addError('Board Registration No. (Class 9th)', 'Board Registration Number (Class 9th) is required');
      if (!formData['Name of Previous School (Class 9th)']?.trim())
        addError('Name of Previous School (Class 9th)', 'Name of previous school (Class 9th) is required');
    }

    // ── Class 9th specific required fields ──
    if (is9v) {
      if (!formData['Name of Previous School (Class 8th)']?.trim())
        addError('Name of Previous School (Class 8th)', 'Name of previous school (Class 8th) is required');
      if (!formData['Year of Passing Class 8th']?.trim())
        addError('Year of Passing Class 8th', 'Year of passing Class 8th is required');
    }

    // ── Marks Validation (Mandatory for Full Admission) ──
    const effectiveAdmType = (cls === '11th' ? admType11 : cls === '12th' ? admType12 : formData['Admission Type']) || 'Full';
    const isFullAdmission = effectiveAdmType === 'Full' || effectiveAdmType === 'Regular';

    if (isFullAdmission) {
      const prevClassForMarks = is11v ? 'Class 10th' : is12v ? 'Class 11th' : is10v ? 'Class 9th' : is9v ? 'Class 8th' : '';
      if (prevClassForMarks) {
        const obtKey = `Total Marks Obtained in ${prevClassForMarks}`;
        const maxKey = `Total Max. Marks in ${prevClassForMarks}`;
        const obtVal = formData[obtKey];
        const maxVal = formData[maxKey];
        const obt = parseFloat(obtVal);
        const maxMarks = parseFloat(maxVal);

        if (obtVal === undefined || obtVal === null || String(obtVal).trim() === '' || isNaN(obt)) {
          addError(obtKey, `Total marks obtained in ${prevClassForMarks} is required for full admission`);
        }
        if (maxVal === undefined || maxVal === null || String(maxVal).trim() === '' || isNaN(maxMarks) || maxMarks <= 0) {
          addError(maxKey, `Maximum marks in ${prevClassForMarks} is required for full admission`);
        }
      }
    }

    // Marks cross-validation (obtained cannot exceed max)
    ['Class 10th', 'Class 11th', 'Class 8th', 'Class 9th'].forEach(clsLabel => {
      const obtainedRaw = formData[`Total Marks Obtained in ${clsLabel}`];
      const maximumRaw = formData[`Total Max. Marks in ${clsLabel}`];
      const obtained = parseFloat(obtainedRaw);
      const maxMarks = parseFloat(maximumRaw);
      if (String(obtainedRaw ?? '').trim() && (!String(maximumRaw ?? '').trim() || isNaN(maxMarks) || maxMarks <= 0 || maxMarks > 2000)) {
        addError(`Total Max. Marks in ${clsLabel}`, 'Enter valid maximum marks (1–2000)');
      } else if (!isNaN(obtained) && (obtained < 0 || (!isNaN(maxMarks) && maxMarks > 0 && obtained > maxMarks))) {
        addError(`Total Marks Obtained in ${clsLabel}`, `Marks Obtained (${obtained}) cannot exceed Max Marks (${maxMarks})`);
      }
    });

    // ── Subject Combinations Validation ──
    const subjectFieldNames = [
      'Subjects to be taken in Class 11th',
      'Subjects to be taken in Class 12th',
      'Subjects to be taken in Class 10th',
      'Subjects to be taken in Class 9th'
    ];

    subjectFieldNames.forEach(sField => {
      const fieldCls = sField.includes('11th') ? '11th' : sField.includes('12th') ? '12th' : sField.includes('10th') ? '10th' : '9th';
      const sStream = formData['Stream for Class 11th'] || formData['Stream opted in Class 11th'] || formData['Stream'] || 'Science';
      const rawVal = formData[sField];
      const soughtCls = formData['Admission sought for class'] || cls || '';
      if (rawVal !== undefined && (soughtCls.includes(fieldCls) || cls?.includes(fieldCls))) {
        const valRes = validateSubjectSelection(fieldCls, sStream, rawVal, false);
        if (!valRes.valid) {
          addError(sField, valRes.error);
        }
      }
    });

    // ── Bank Account & IFSC (Mandatory) ──
    const bankAccount = String(formData['Bank Account No.'] || '').replace(/\s/g, '');
    if (!bankAccount) {
      addError('Bank Account No.', 'Bank account number is required');
    } else if (!/^\d{9,18}$/.test(bankAccount)) {
      addError('Bank Account No.', 'Bank account number must contain 9–18 digits');
    }

    const ifsc = String(formData["IFSC code"] || '').trim().toUpperCase();
    if (!ifsc) {
      addError("IFSC code", "IFSC code is required");
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      addError("IFSC code", "Invalid IFSC code format (e.g. SBIN0001234)");
    }

    // ── Universal Field Length & Constraints Sweep from formStructure ──
    formStructure.forEach(field => {
      const name = field.fieldName || field.name || field['Field Name'];
      const lenStr = field['Options / Range / Length'] || field.length;
      if (lenStr && /^\d+$/.test(String(lenStr).trim())) {
        const maxLen = parseInt(lenStr, 10);
        const val = formData[name];
        if (val && typeof val === 'string' && val.length > maxLen) {
          addError(name, `Maximum length is ${maxLen} characters (currently ${val.length})`);
        }
      }
    });

    // ── Dynamic required-field sweep from formStructure ──
    // Skips fields already hard-checked above; also skips fields hidden by isVisible.
    const HARDCODED_FIELDS = new Set([
      "Student's Name (as per school records)", "DoB (as per school records)", "Gender",
      "Father's/Guardian's Name (as per school records)", "Mother's Name (as per school records)",
      "Father's/Guardian's Occupation", "Father's Occupation", "Mother's Occupation", "Mother's/Guardian's Occupation",
      "Mobile No. (with working WhatsApp)", "Parent's Mobile No. (must be working)",
      "Aadhar No.", "Father's Aadhar No.", "Name of your village", "District",
      "Bank Account No.", "IFSC code",
      'Board Registration No. (Class 10th)', 'Board Registration No. (Class 11th)',
      'Board Registration No. (Class 9th)',
      'Name of Previous School (Class 10th)', 'Name of Previous School (Class 11th)',
      'Name of Previous School (Class 8th)', 'Name of Previous School (Class 9th)',
      'Board (Class 10th)', 'Board (Class 11th)',
      'Stream for Class 11th', 'Stream opted in Class 11th',
      'Subjects Studied in Class 10th', 'Subjects Studied in Class 11th',
      'Subjects to Reappear (Class 10th)', 'Subjects to Reappear (Class 11th)',
      'Year of Passing Class 8th',
    ]);
    formStructure.forEach(field => {
      const name = field.fieldName || field.name || field['Field Name'];
      const required = field.required || field['Is Required?'] === 'TRUE';
      const type = field.fieldType || field.type || field['Field Type'] || '';
      if (type.startsWith('autogen')) return;
      if (name === 'Declaration') return;
      if (!isVisible(field)) return;
      const val = formData[name];
      if (typeof val === 'string' && (val.trim().toLowerCase() === 'other' || val.trim().toLowerCase() === 'others')) {
        addError(name, `Please specify your custom ${name}`);
        return;
      }
      if (isPersonNameField(name) && val && typeof val === 'string' && val.trim()) {
        const nameCheck = validatePersonName(val, name);
        if (!nameCheck.valid) {
          addError(name, nameCheck.error);
          return;
        }
      }
      if (!required) return;
      if (HARDCODED_FIELDS.has(name)) return; // already validated above
      if (errors[name]) return;
      if (val === undefined || val === null || val === '' || val === false || val === 'FALSE') {
        addError(name, 'This field is required');
      }
    });

    // Check all form data entries for any unspecified "Other"
    Object.keys(formData).forEach(key => {
      const val = formData[key];
      if (typeof val === 'string' && (val.trim().toLowerCase() === 'other' || val.trim().toLowerCase() === 'others')) {
        addError(key, `Please specify your custom ${key}`);
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const errorSection = fieldSectionMap[firstErrorField];
      if (errorSection) setActiveTab(sectionWorkflowStep(errorSection));
      setAlert({
        type: 'error',
        text: `Please fix ${Object.keys(errors).length} error(s) before submitting. First issue: "${firstErrorField}" — ${errors[firstErrorField]}`
      });
      // Scroll to first error field
      setTimeout(() => {
        const isStartError = firstErrorField === 'Admission sought for class' || String(firstErrorField).startsWith('Admission Type');
        const el = isStartError
          ? document.querySelector('#admission-start')
          : document.querySelector(`[data-field-name="${CSS.escape(firstErrorField)}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    setFieldErrors({});
    setShowPreviewModal(true);
  };

  const executeFinalSubmission = async () => {
    setShowPreviewModal(false);
    setIsSubmitting(true);
    try {
      if (!submissionKeyRef.current) {
        submissionKeyRef.current = window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }
      const res = await appsScriptApi.saveApplication({
        ...formData,
        applicationId: applicationIdRef.current || applicationId,
        submissionKey: submissionKeyRef.current,
        ...(upgradeMode ? { _upgradeMode: true, _provisionalFormNo: upgradeSourceFormNo || '' } : {}),
      });

      if (res && (res.error === 'duplicate' || res.error === 'duplicate_mobile')) {
        setAlert({
          type: 'error',
          text: res.message || 'Duplicate submission detected. Please check your mobile number and details.',
        });
        if (res.error === 'duplicate_mobile') {
          setFieldErrors((prev) => ({
            ...prev,
            "Mobile No. (with working WhatsApp)": res.message,
          }));
        }
        setIsSubmitting(false);
        return;
      }

      if (res && res.success !== false) {
        const formNo = res.formNumber;
        applicationIdRef.current = res.applicationId || applicationIdRef.current;
        setApplicationId(applicationIdRef.current);
        const submittedData = {
          ...formData,
          'Form Number': formNo,
          FormNo: formNo,
          formNo,
          Status: 'Submitted',
          status: 'Submitted',
          submittedAt: new Date().toISOString()
        };

        // Update local component state so all PDF generators & modals receive the official form number
        setFormData(submittedData);
        setSubmittedSuccessData(submittedData);

        // Advance / consume form number in counter
        consumeFormNumber(formNo).catch(e => console.warn('consumeFormNumber note:', e));

        try {
          const uid = currentUser?.uid || 'guest';
          localStorage.removeItem(`hss_student_draft_${uid}`);
          localStorage.removeItem('hss_student_draft_guest');
          localStorage.removeItem('hss_student_draft_local');
          sessionStorage.removeItem(`hss_student_draft_${uid}`);
          sessionStorage.removeItem('hss_student_draft_guest');
          sessionStorage.removeItem('hss_student_draft_local');
          sessionStorage.removeItem('hss_admission_upgrade');
          sessionStorage.removeItem('hss_admission_draft');
        } catch (e) { }
      } else {
        setAlert({ type: 'error', text: res?.error || res?.message || 'Submission failed.' });
      }
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setFieldErrors(err.fieldErrors);
        const firstServerField = Object.keys(err.fieldErrors)[0];
        const errorSection = fieldSectionMap[firstServerField];
        if (errorSection) setActiveTab(sectionWorkflowStep(errorSection));
        setTimeout(() => {
          const el = document.querySelector(`[data-field-name="${CSS.escape(firstServerField)}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
      setAlert({ type: 'error', text: err.userMessage || err.message || 'Submission failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[85vh] px-2 py-2.5 sm:px-5 sm:py-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Online Admission Application"
        description="Fill out the official online admission form for Govt HSS Shangus."
        path="/portal/student/application"
      />

      {/* Submission Progress & Animation Fullscreen Overlay */}
      {isSubmitting && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn pointer-events-auto"
        >
          <div className="w-full max-w-md rounded-3xl p-6 sm:p-8 border border-teal-500/30 bg-slate-900/95 text-white shadow-2xl space-y-6 text-center relative overflow-hidden">
            {/* Background ambient glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <ModernLoader
                moduleKey="student"
                title="Govt. Higher Secondary School Shangus"
                badge="Admission Submission"
                text="Securing & Submitting Application..."
                subtext="Encrypting student records, validating photos, and generating verified registration ID…"
                progress={88}
                className="py-2"
              />

              {/* Step checklist */}
              <div className="space-y-2 text-left pt-2 text-xs font-semibold text-slate-300 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                <div className="flex items-center gap-2.5 text-teal-400">
                  <CheckCircle2 size={15} className="flex-shrink-0" />
                  <span>Validating student profile &amp; subjects</span>
                </div>
                <div className="flex items-center gap-2.5 text-teal-300">
                  <Loader2 size={15} className="animate-spin flex-shrink-0" />
                  <span>Encrypting photos &amp; identity details</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-400">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-500 flex-shrink-0" />
                  <span>Generating cryptographic verification QR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal Overlay (Only shown when form is editable) */}
      {showInstructions && !isFormLocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admission-instructions-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xl rounded-3xl p-6 sm:p-8 border shadow-2xl space-y-5 animate-fadeIn" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                  <Info size={22} />
                </div>
                <div>
                  <h3 id="admission-instructions-title" className="font-extrabold text-lg" style={{ color: 'var(--text-main, #0f172a)' }}>
                    Instructions for Admission
                  </h3>
                  <p className="text-xs text-slate-400">Please read carefully before proceeding to the form</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (hasConfirmedInstructions) {
                    setShowInstructions(false);
                  } else {
                    navigate('/portal/student');
                  }
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={hasConfirmedInstructions ? "Close Instructions" : "Cancel & Return to Dashboard"}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed" style={{ color: 'var(--text-main, #334155)' }}>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <CheckCircle size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                <span>Ensure all personal details (Name, Parentage, DoB) match your official school records exactly.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <CheckCircle size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                <span>Active mobile number (with WhatsApp) and parent's contact are mandatory for all communications.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <CheckCircle size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                <span>Upload a clear, recent passport-size JPEG, PNG, or WebP photograph (Max 200 KB). It will be optimized and securely stored.</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasConfirmedInstructions}
                  onChange={(e) => setHasConfirmedInstructions(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                  I have read all instructions carefully and agree to follow the best practices for admission form submission.
                </span>
              </label>
            </div>

            <button
              disabled={!hasConfirmedInstructions}
              onClick={() => {
                setHasConfirmedInstructions(true);
                setShowInstructions(false);
              }}
              className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-sm text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <span>I Confirm and Proceed to Application Form</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Application Review & Confirmation Modal (Shown before final submit) */}
      {showPreviewModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="admission-review-title" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl p-5 sm:p-7 border shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto animate-fadeIn bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                  <Eye size={22} />
                </div>
                <div>
                  <h3 id="admission-review-title" className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    Application Summary & Final Verification
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verify your details carefully. Click <strong>Edit Details</strong> to make changes or <strong>Confirm & Submit</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Top Identity Card Header */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-slate-500/5 to-amber-500/10 border border-teal-500/20 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-28 rounded-2xl border-2 border-teal-500/40 overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-md flex-shrink-0">
                {(() => {
                  const photoSrc =
                    formData['Student Photo'] || formData['photo_id'] || formData['photoUrl'] || formData['photo'] || formData['id card photo'] ||
                    currentUser?.['Student Photo'] || currentUser?.photo_id || currentUser?.photoUrl || currentUser?.photoURL;
                  const isValidPhoto = photoSrc && typeof photoSrc === 'string' && (
                    photoSrc.startsWith('data:image/') || photoSrc.startsWith('http://') || photoSrc.startsWith('https://') || photoSrc.startsWith('blob:')
                  );

                  return isValidPhoto ? (
                    <img
                      src={photoSrc}
                      alt="Student Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-[10px] font-bold p-1 text-center bg-slate-100 dark:bg-slate-800">
                      <Camera size={22} className="text-teal-600 mb-1" />
                      <span>No Photo</span>
                    </div>
                  );
                })()}
              </div>
              <div className="flex-1 space-y-1 text-center sm:text-left">
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {formData["Student's Name (as per school records)"] || formData["Student's Name"] || 'N/A'}
                </div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Father: {formData["Father's/Guardian's Name (as per school records)"] || 'N/A'} | Mother: {formData["Mother's Name (as per school records)"] || 'N/A'}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/20 text-teal-600 border border-teal-500/30">
                    Class {formData["Admission sought for class"] || '11th'} ({formData["Stream for Class 11th"] || formData["Stream opted in Class 11th"] || 'General'})
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 border border-amber-500/30">
                    DoB: {formData["DoB (as per school records)"] || 'N/A'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-600 border border-purple-500/30">
                    Gender: {formData["Gender"] || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Application Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Contact & Address */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-extrabold text-slate-900 dark:text-white border-b pb-1.5 border-slate-200 dark:border-slate-700">
                  <span>📍 Contact & Address</span>
                  <button
                    type="button"
                    onClick={() => { setShowPreviewModal(false); setActiveTab('contact'); }}
                    className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Edit ✏️
                  </button>
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div><strong>Mobile:</strong> {formData["Mobile No. (with working WhatsApp)"] || 'N/A'}</div>
                  <div><strong>Parent Contact:</strong> {formData["Parent's Mobile No. (must be working)"] || 'N/A'}</div>
                  <div><strong>Email:</strong> {formData["Email Address"] || 'N/A'}</div>
                  <div><strong>Village:</strong> {formData["Name of your village"] || 'N/A'}, Block: {formData["Block"] || 'Shangus'}</div>
                  <div><strong>District/PIN:</strong> {formData["District"] || 'Anantnag'} - {formData["PIN code"] || '192201'}</div>
                </div>
              </div>

              {/* Academic Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-extrabold text-slate-900 dark:text-white border-b pb-1.5 border-slate-200 dark:border-slate-700">
                  <span>🎓 Examination & Marks</span>
                  <button
                    type="button"
                    onClick={() => { setShowPreviewModal(false); setActiveTab('academic'); }}
                    className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Edit ✏️
                  </button>
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div><strong>Prev. School:</strong> {formData[`Name of Previous School (Class ${selectedClass?.includes('12') ? '11th' : selectedClass?.includes('11') ? '10th' : selectedClass?.includes('10') ? '9th' : '8th'})`] || formData["Name of Previous School (Class 10th)"] || formData["Name of Previous School (Class 11th)"] || formData["Name of Previous School (Class 8th)"] || formData["Previous School"] || 'N/A'}</div>
                  <div><strong>Board / Reg No:</strong> {formData[`Board Registration No. (Class ${selectedClass?.includes('12') ? '11th' : selectedClass?.includes('11') ? '10th' : selectedClass?.includes('10') ? '9th' : '8th'})`] || formData["Board Registration No. (Class 10th)"] || formData["Board Registration No. (Class 11th)"] || formData["Board Registration No. (Class 8th)"] || 'N/A'}</div>
                  <div><strong>Exam Roll No:</strong> {formData[`Exam Roll Number of Class ${selectedClass?.includes('12') ? '11th' : selectedClass?.includes('11') ? '10th' : selectedClass?.includes('10') ? '9th' : '8th'})`] || formData["Exam Roll Number of Class 10th"] || formData["Exam Roll Number of Class 11th"] || formData["Exam Roll Number of Class 8th"] || 'N/A'}</div>
                  <div><strong>Marks Obtained:</strong> {formData[`Total Marks Obtained in Class ${selectedClass?.includes('12') ? '11th' : selectedClass?.includes('11') ? '10th' : selectedClass?.includes('10') ? '9th' : '8th'})`] || formData["Total Marks Obtained in Class 10th"] || formData["Total Marks Obtained in Class 11th"] || formData["Total Marks Obtained in Class 8th"] || 'N/A'} / {formData[`Total Max. Marks in Class ${selectedClass?.includes('12') ? '11th' : selectedClass?.includes('11') ? '10th' : selectedClass?.includes('10') ? '9th' : '8th'})`] || formData["Total Max. Marks in Class 10th"] || formData["Total Max. Marks in Class 11th"] || formData["Total Max. Marks in Class 8th"] || 500}</div>
                </div>
              </div>

              {/* Selected Subjects */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between font-extrabold text-slate-900 dark:text-white border-b pb-1.5 border-slate-200 dark:border-slate-700">
                  <span>📖 Chosen Subjects</span>
                  <button
                    type="button"
                    onClick={() => { setShowPreviewModal(false); setActiveTab('academic'); }}
                    className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Edit ✏️
                  </button>
                </div>
                <div className="text-teal-700 dark:text-teal-400 font-bold">
                  {formatAllSubjects(
                    formData["Stream & Subjects for Class 12th"] || formData["Subjects to be taken in Class 11th"] || formData["Subjects to be taken in Class 10th"] || formData["Subjects to be taken in Class 9th"] || '',
                    selectedClass,
                    formData["Stream for Class 11th"] || formData["Stream opted in Class 11th"] || formData["Stream"]
                  ) || 'None selected'}
                </div>
              </div>

              {/* Bank & Aadhaar Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between font-extrabold text-slate-900 dark:text-white border-b pb-1.5 border-slate-200 dark:border-slate-700">
                  <span>🏦 Bank Account & Identifiers</span>
                  <button
                    type="button"
                    onClick={() => { setShowPreviewModal(false); setActiveTab('academic'); }}
                    className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Edit ✏️
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-slate-600 dark:text-slate-300">
                  <div><strong>Student Aadhaar:</strong> {maskSensitive(formData["Aadhar No."])}</div>
                  <div><strong>Father's Aadhaar:</strong> {maskSensitive(formData["Father's Aadhar No."])}</div>
                  <div><strong>Bank Account:</strong> {maskSensitive(formData["Bank Account No."])}</div>
                  <div><strong>IFSC Code:</strong> {formData["IFSC code"] || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Declaration Block */}
            <div className="p-4 rounded-2xl border text-xs leading-relaxed" style={{ backgroundColor: 'rgba(13,148,136,0.06)', borderColor: 'rgba(13,148,136,0.25)', color: 'var(--text-main,#334155)' }}>
              <div className="font-extrabold text-sm mb-2 flex items-center gap-2" style={{ color: '#0d9488' }}>
                <CheckCircle size={16} /> Declaration
              </div>
              <p>
                I, <strong>{formData["Student's Name (as per school records)"] || 'the applicant'}</strong>, hereby declare that all information furnished in this admission application is true, complete, and correct to the best of my knowledge and belief. I understand that any false statement or misrepresentation may lead to cancellation of my admission. I agree to abide by the rules and regulations of Govt. Higher Secondary School Shangus and submit to the authority of the Principal in all matters relating to discipline and academic conduct.
              </p>
              <p className="mt-2 font-semibold">
                By clicking <strong>"Confirm &amp; Final Submit Application"</strong> below, I confirm the above declaration and authorise the school to process my admission application.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl font-extrabold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Edit3 size={16} /> Edit Details
              </button>

              <button
                type="button"
                onClick={executeFinalSubmission}
                disabled={isSubmitting || admissionsClosed}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl font-extrabold text-xs text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} /> Confirm & Final Submit Application →
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {submittedSuccessData && (
        <div role="dialog" aria-modal="true" aria-labelledby="admission-success-title" className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <CheckCircle size={34} aria-hidden="true" />
            </div>
            <h2 id="admission-success-title" className="mt-4 text-xl font-black text-slate-900 dark:text-white">Application submitted</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Your official form number is <strong className="text-emerald-700 dark:text-emerald-400">#{submittedSuccessData['Form Number']}</strong>. Keep it for future reference.
            </p>
            <p className="mt-2 text-xs text-slate-500">The application is now locked for verification. Its progress remains available on your dashboard.</p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-xs font-extrabold text-slate-700 dark:text-slate-200 disabled:opacity-50">
                {isDownloadingPdf ? 'Preparing PDF…' : 'Download PDF'}
              </button>
              <Link to="/portal/student" className="min-h-11 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white flex items-center justify-center">View dashboard</Link>
            </div>
          </div>
        </div>
      )}

      {/* Gated: Without accepting instructions, form and admission setup screen are completely hidden */}
      {!hasConfirmedInstructions && !isFormLocked ? (
        <div className="max-w-xl mx-auto py-16 px-4 text-center">
          <div className="p-8 sm:p-10 rounded-3xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-fadeIn">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
              <Info size={28} />
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Admission Instructions Required</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              You must read and confirm the official admission instructions and guidelines before accessing the admission form and setup.
            </p>
            <div className="pt-3 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => setShowInstructions(true)}
                className="py-2.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs shadow-md transition-all cursor-pointer"
              >
                Read &amp; Confirm Instructions
              </button>
              <button
                type="button"
                onClick={() => navigate('/portal/student')}
                className="py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Form Container Card */}
          <div className="portal-form-sans relative rounded-2xl border p-2 sm:p-4 md:p-5 shadow-sm space-y-2.5 sm:space-y-4 min-w-0 bg-slate-50/80 dark:bg-slate-950/90 border-slate-200 dark:border-slate-800">

          {/* School Logo Watermark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.05] select-none z-0 overflow-hidden rounded-2xl">
            <img src="/logo512.png" alt="" className="w-64 h-64 object-contain filter grayscale" />
          </div>

          <div className="relative z-10 space-y-3">
            {/* Upgrade Mode Banner — dismissible */}
            {upgradeMode && showInfoBanner && (
              <div className="p-3 rounded-2xl border flex items-start gap-2.5 animate-fadeIn" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderColor: '#f59e0b' }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f59e0b22' }}>
                  <ArrowUp size={14} style={{ color: '#d97706' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black" style={{ color: '#92400e' }}>🔄 Upgrade Mode — Converting Provisional → Full Admission</div>
                  <div className="text-xs mt-0.5" style={{ color: '#b45309' }}>Form #{upgradeSourceFormNo} is pre-filled. Change Admission Type to <strong>Regular</strong> and complete all required mark/board details before submitting.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInfoBanner(false)}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-amber-200/50 text-amber-600 hover:text-amber-800 transition-colors cursor-pointer"
                  title="Dismiss notice"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Provisional warning banner — dismissible */}
            {isProvisionalForm && !upgradeMode && !isFormLocked && showInfoBanner && (
              <div className="p-3 rounded-2xl border flex items-center gap-2 animate-fadeIn" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                <AlertCircle size={15} style={{ color: '#ea580c', flexShrink: 0 }} />
                <div className="flex-1 text-xs" style={{ color: '#9a3412' }}>
                  <strong>Provisional Form:</strong> A compact slip will be printed on submission. You can upgrade to Full Admission later from your dashboard.
                </div>
                <button
                  type="button"
                  onClick={() => setShowInfoBanner(false)}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-orange-200/50 text-orange-500 hover:text-orange-700 transition-colors cursor-pointer"
                  title="Dismiss notice"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Top Navigation & Live Progress Toolbar (Unified across Mobile & Desktop) */}
            <div
              className="sticky top-0 z-30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 sm:px-3.5 sm:py-2 rounded-2xl border bg-white/95 dark:bg-slate-950/95 shadow-md backdrop-blur-xl transition-all relative overflow-hidden border-slate-200 dark:border-slate-800"
            >
              {/* Row 1 / Left on Desktop: Back Button + Student Identity + Top Right Actions on Mobile */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={handleBackWithAutoSave}
                    disabled={isBackSaving}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-teal-600 shadow-2xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 text-xs font-bold flex-shrink-0"
                    title="Save draft & back to dashboard"
                  >
                    {isBackSaving ? <RefreshCw size={13} className="animate-spin text-teal-600" /> : <ArrowLeft size={13} />}
                    <span className="hidden sm:inline">Back</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5 font-sans">
                      <span className="truncate">
                        {formData["Student's Name (as per school records)"] || formData['Student Name'] || (upgradeMode ? 'Upgrade Admission' : isProvisionalForm ? 'Provisional Form' : 'Admission Form')}
                      </span>
                      {isProvisionalForm && !upgradeMode && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-400">PROV</span>
                      )}
                      {upgradeMode && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-400">UPGRADE</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-1">
                      <span>Form #{formData['Form Number'] || '—'}</span>
                      {selectedClass && (
                        <span className="text-teal-600 dark:text-teal-400 font-bold">
                          · Class {selectedClass} {selectedStream ? `(${selectedStream})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Quick Action Buttons (Save + Help) */}
                <div className="flex sm:hidden items-center gap-1.5 flex-shrink-0">
                  {!isFormLocked && (
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isSubmitting || !hasAdmissionStart}
                      className="p-1.5 rounded-xl border border-teal-600 bg-teal-600 text-white shadow-xs transition-all flex items-center gap-1 text-xs font-bold cursor-pointer disabled:opacity-50"
                      title="Save Draft"
                    >
                      {draftState === 'saving' ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    </button>
                  )}
                  {!isFormLocked && (
                    <button
                      type="button"
                      onClick={() => setShowInstructions(true)}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 hover:text-teal-600 transition-colors cursor-pointer"
                      title="Instructions & Help"
                    >
                      <HelpCircle size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Middle: 4 Step Navigation Tabs (Fitted 4-column Grid on Mobile, Flex on Desktop) */}
              {!isFormLocked && (
                <nav aria-label="Admission section shortcuts" className="grid grid-cols-4 sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
                  {workflowSteps.map((step, index) => {
                    const isActive = activeTab === step.id;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => goToWorkflowStep(step)}
                        disabled={!hasAdmissionStart}
                        className={`py-1.5 px-1 sm:px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 ${
                          isActive
                            ? 'bg-teal-600 text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-teal-600 hover:bg-white/50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                        title={step.label}
                      >
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="hidden md:inline text-xs">{step.label}</span>
                        <span className="md:hidden text-[10.5px] font-bold tracking-tight truncate">{step.mobileLabel}</span>
                      </button>
                    );
                  })}
                </nav>
              )}

              {/* Desktop Right: Progress & Action Controls */}
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                {!isFormLocked && hasAdmissionStart && (
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[11px] font-black text-teal-700 dark:text-teal-300">
                      {progressPercent}% <span className="text-[9px] font-normal text-slate-400">({filledRequiredCount}/{requiredFields.length})</span>
                    </span>
                    <span className="text-[8.5px] font-bold text-slate-400">
                      {draftState === 'saving' ? 'Saving…' : draftSavedTime ? `Saved ${draftSavedTime}` : 'Drafting'}
                    </span>
                  </div>
                )}
                {!isFormLocked && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting || !hasAdmissionStart}
                    className="py-1.5 px-3 rounded-xl border border-teal-600 bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer disabled:opacity-50"
                    title="Save Draft"
                  >
                    {draftState === 'saving' ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>{draftState === 'saving' ? 'Saving…' : 'Save Draft'}</span>
                  </button>
                )}
                {!isFormLocked && (
                  <button
                    type="button"
                    onClick={() => setShowInstructions(true)}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 hover:text-teal-600 transition-colors cursor-pointer"
                    title="Instructions & Help"
                  >
                    <HelpCircle size={15} />
                  </button>
                )}
              </div>

              {/* Bottom Progress Track */}
              {!isFormLocked && hasAdmissionStart && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-200/80 dark:bg-slate-800/80">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>

            {/* Main Application Form Body */}
            <div className="space-y-3">

            {/* Floating / Fixed Alert Toast Notification Popup — High Contrast Top-Right Position via Portal */}
            {alert && createPortal(
              <div
                role={alert.type === 'error' ? 'alert' : 'status'}
                aria-live="assertive"
                className="fixed top-24 right-4 sm:right-6 z-[99999999] w-[92vw] max-w-sm sm:max-w-md animate-fadeIn pointer-events-auto drop-shadow-2xl shadow-2xl"
              >
                <div
                  className={`relative overflow-hidden p-4 rounded-2xl text-xs font-semibold flex items-start justify-between gap-3 border-2 shadow-2xl transition-all ${
                    alert.type === 'error'
                      ? 'border-red-500 ring-4 ring-red-500/30'
                      : alert.type === 'success'
                        ? 'border-emerald-500 ring-4 ring-emerald-500/30'
                        : 'border-teal-500 ring-4 ring-teal-500/30'
                  }`}
                  style={{ backgroundColor: '#090d16', color: '#ffffff' }}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {alert.type === 'error' ? (
                      <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-red-500/40">
                        <AlertCircle size={22} className="stroke-[2.5]" />
                      </div>
                    ) : alert.type === 'success' ? (
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-emerald-500/40">
                        <CheckCircle size={22} className="stroke-[2.5]" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-teal-500/40">
                        <Info size={22} className="stroke-[2.5]" />
                      </div>
                    )}
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4
                        className="text-xs sm:text-sm font-black tracking-wider uppercase flex items-center justify-between"
                        style={{
                          color: alert.type === 'error' ? '#f87171' : alert.type === 'success' ? '#34d399' : '#2dd4bf'
                        }}
                      >
                        <span>{alert.type === 'error' ? 'Action Required' : alert.type === 'success' ? 'Saved Successfully' : 'Notice'}</span>
                      </h4>
                      <p
                        className="text-xs font-bold leading-relaxed break-words"
                        style={{ color: '#ffffff', opacity: 1 }}
                      >
                        {alert.text}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAlert(null)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs border border-white/20 transition-all cursor-pointer flex-shrink-0 hover:scale-105 active:scale-95 ml-1"
                    title="Dismiss Notification"
                  >
                    <X size={16} className="stroke-[2.5]" />
                  </button>

                  {/* 60-Second Auto-Dismiss Countdown Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-800">
                    <div
                      className={`h-full ${
                        alert.type === 'error' ? 'bg-red-500' : alert.type === 'success' ? 'bg-emerald-400' : 'bg-teal-400'
                      }`}
                      style={{
                        animation: 'shrink60s 60s linear forwards',
                      }}
                    />
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Locked Application Banner */}
            {isFormLocked && (
              <div className="mb-3 flex flex-col items-stretch gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 animate-fadeIn dark:text-amber-300 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:gap-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
                  <span>Your application has been submitted and locked for verification. Editing is disabled.</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-shrink-0 sm:items-center">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 text-white font-bold text-[11px] whitespace-nowrap hover:bg-teal-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isDownloadingPdf ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" /> Preparing...
                      </>
                    ) : (
                      <>
                        <Printer size={12} /> Print PDF
                      </>
                    )}
                  </button>
                  <Link
                    to="/portal/student"
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-[11px] whitespace-nowrap hover:bg-amber-600 transition-colors"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            )}

            {admissionsClosed && !isFormLocked && (
              <div role="alert" className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2">
                <ShieldCheck size={17} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-sm">Admissions are currently closed{selectedClass ? ` for Class ${selectedClass}` : ''}.</div>
                  <p className="mt-1 text-[11px]">Your draft remains available, but final submission is disabled until enrollment reopens.</p>
                </div>
              </div>
            )}

            {/* Rejection Alert Banner (Within 3 Days) */}
            {rejectedEditable && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold space-y-1 animate-fadeIn mb-4">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                  <span>⚠️ Application Returned for Correction (3-Day Edit Window Active)</span>
                </div>
                <p>Reason for rejection: <strong className="text-red-600">{formData.rejectionReason || formData['Rejection Reason'] || formData['Rejected Reason'] || 'Please correct specified details.'}</strong></p>
                <p className="text-[11px] text-slate-500">
                  You can edit and resubmit your details below. {formData['Payment Status'] === 'PAID & VERIFIED' ? '✅ Your online fee payment is retained — you will NOT be asked to pay fee again.' : ''}
                </p>
              </div>
            )}

            {/* Rejection Expired Banner */}
            {currentStatus === 'Rejected' && !rejectedEditable && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold space-y-1 animate-fadeIn mb-4">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                  <span>🚫 Correction Window Expired</span>
                </div>
                <p>The 3-day correction window for this rejected application has passed. Form editing is locked. Please contact the admission office to request unlock.</p>
              </div>
            )}

            {/* Main Form Fields */}
            {loading ? (
              <ModernLoader
                moduleKey="student"
                text="Initializing Admission Application"
                subtext="Loading dynamic form schema, streams, and your saved profile records..."
              />
            ) : (
              <form onSubmit={handleFinalSubmit} className="space-y-3">
                {(() => {

                  const isFullWidthField = (field, name) => {
                    const type = field.fieldType || field.type || field['Field Type'] || '';
                    const lower = String(name || '').toLowerCase();
                    return (
                      type === 'image' ||
                      type === 'file' ||
                      type === 'textarea' ||
                      type === 'checkbox_dynamic' ||
                      type === 'checkbox_declaration' ||
                      lower.includes('photo') ||
                      lower.includes('remarks') ||
                      lower.includes('feedback')
                    );
                  };

                  // Find global photo field to ensure it always lands in Identity & Parentage
                  const globalPhotoField = activeFields.find(field => {
                    const n = String(field.fieldName || field.name || field['Field Name'] || '').toLowerCase();
                    const t = String(field.fieldType || field.type || field['Field Type'] || '').toLowerCase();
                    return t.startsWith('image') || t.startsWith('file') || n.includes('photo');
                  });

                  const SECTION_ORDER = [
                    '👤 Identity & Parentage',
                    '📱 Contact & Residential Address',
                    '🩺 Physical & Social Category',
                    '🆔 National & Student Identifiers',
                    '⚽ Sports & Extracurricular',
                    '🎓 Admission & Class Details',
                    '🏫 Class 10th Examination Records',
                    '🏫 Class 11th Examination Records',
                    '🏫 Class 8th / 9th Examination Records',
                    '🎁 Scholarship Details',
                    '🏦 Bank Account Details',
                    '🛠️ Vocational Studies',
                    '📚 Stream & Subject Selection',
                    '📖 Subject Combinations',
                    '💬 Remarks & Final Review',
                  ];

                  const grouped = {};
                  activeFields.forEach(field => {
                    const name = field.fieldName || field.name || field['Field Name'];
                    let sec = (field === globalPhotoField) ? '👤 Identity & Parentage' : fieldSectionMap[name];
                    if (!sec) {
                      const lower = String(name || '').toLowerCase();
                      if (lower.includes('remark') || lower.includes('feedback')) sec = '💬 Remarks & Final Review';
                      else if (lower.includes('scholarship')) sec = '🎁 Scholarship Details';
                      else if (lower.includes('bank') || lower.includes('ifsc') || lower.includes('account')) sec = '🏦 Bank Account Details';
                      else if (lower.includes('subject') || lower.includes('stream')) sec = '📖 Subject Combinations';
                      else if (lower.includes('school') || lower.includes('board') || lower.includes('marks') || lower.includes('pass') || lower.includes('roll')) sec = '🏫 Class 10th Examination Records';
                      else sec = '👤 Identity & Parentage';
                    }
                    if (!grouped[sec]) grouped[sec] = [];
                    grouped[sec].push(field);
                  });

                  const sortedGroupedEntries = Object.entries(grouped).sort(([secA], [secB]) => {
                    const indexA = SECTION_ORDER.indexOf(secA);
                    const indexB = SECTION_ORDER.indexOf(secB);
                    const posA = indexA !== -1 ? indexA : 90;
                    const posB = indexB !== -1 ? indexB : 90;
                    return posA - posB;
                  });

                  return (
                    <div id="admission-workflow-content" className="space-y-3.5 scroll-mt-24">
                      {/* Select the admission context before showing class-specific fields — Mobile-First Responsive Layout */}
                      {!isFormLocked && (
                        hasAdmissionStart && isSetupCollapsed ? (
                          /* Ultra-Sleek Collapsed Setup Banner — Minimal 1-Line Strip */
                          <div className="flex items-center justify-between gap-2 p-2 sm:px-3 sm:py-2 rounded-xl bg-teal-500/10 dark:bg-teal-950/40 border border-teal-500/25 text-xs animate-fadeIn shadow-2xs">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                Setup:
                              </span>
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded text-[10.5px] font-black bg-teal-600 text-white shadow-2xs">
                                  Class {formData['Admission sought for class']}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                  {formData['Admission Type (Class 11th)'] || formData['Admission Type (Class 12th)'] || formData['Admission Type'] || 'Full'}
                                </span>
                                {selectedClass === '11th' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30">
                                    {formData['Stream for Class 11th'] || 'Science'}
                                  </span>
                                )}
                                {selectedAdmissionType === 'Provisional' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30 truncate max-w-[130px]">
                                    {formData['Reason for Provisional (Class 11th)'] || formData['Reason for Provisional (Class 12th)'] || formData['Reason for Provisional'] || 'Provisional'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsSetupCollapsed(false);
                                setTimeout(() => {
                                  document.querySelector('#admission-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 60);
                              }}
                              className="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition-all cursor-pointer flex-shrink-0 shadow-2xs"
                            >
                              Edit Setup ✎
                            </button>
                          </div>
                        ) : (
                          /* Clean, Proportionate Expanded Setup Card */
                          <div id="admission-start" className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border bg-white dark:bg-slate-900 border-teal-500/30 dark:border-teal-500/20 shadow-xs space-y-3 scroll-mt-24 transition-all">
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"></span>
                                <div>
                                  <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                    Admission Setup
                                  </h2>
                                  <p className="text-[10px] text-slate-400">
                                    Select class, type &amp; stream to configure your form
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap ${hasAdmissionStart ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'}`}>
                                  {hasAdmissionStart ? '✓ Ready' : 'Required'}
                                </span>

                                {hasAdmissionStart && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsSetupCollapsed(true);
                                      setTimeout(() => {
                                        document.querySelector('#admission-workflow-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }, 60);
                                    }}
                                    className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-all cursor-pointer shadow-2xs"
                                  >
                                    Done ▲
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Options Grid */}
                            <div className="space-y-3">
                              {/* 1. Target Class */}
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                  <span>1. Class applying for <span className="text-red-500">*</span></span>
                                </label>
                                <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  {['9th', '10th', '11th', '12th'].map(clsVal => {
                                    const isSel = String(formData['Admission sought for class'] || '') === clsVal;
                                    return (
                                      <button
                                        key={clsVal}
                                        type="button"
                                        onClick={() => handleFieldChange('Admission sought for class', clsVal)}
                                        className={`h-8 sm:h-9 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center justify-center ${
                                          isSel
                                            ? 'bg-teal-600 text-white shadow-xs'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                                        }`}
                                      >
                                        {clsVal}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 2. Admission Type & 3. Stream */}
                              <div className={`grid grid-cols-1 ${selectedClass === '11th' ? 'sm:grid-cols-2' : 'sm:grid-cols-2'} gap-2.5`}>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                    <span>2. Admission Type <span className="text-red-500">*</span></span>
                                  </label>
                                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    {[
                                      { key: 'Full', label: 'Full Admission' },
                                      { key: 'Provisional', label: 'Provisional' },
                                    ].map(cat => {
                                      const admTypeKey = selectedClass === '12th'
                                        ? 'Admission Type (Class 12th)'
                                        : selectedClass === '11th' ? 'Admission Type (Class 11th)' : 'Admission Type';
                                      const currentVal = formData[admTypeKey] || formData['Admission Type'] || '';
                                      const isSel = currentVal === cat.key;
                                      return (
                                        <button
                                          key={cat.key}
                                          type="button"
                                          onClick={() => {
                                            handleFieldChange(admTypeKey, cat.key);
                                            handleFieldChange('Admission Type', cat.key);
                                            handleFieldChange('isProvisional', cat.key === 'Provisional');
                                          }}
                                          className={`h-8 sm:h-9 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center text-center ${
                                            isSel
                                              ? cat.key === 'Provisional'
                                                ? 'bg-amber-500 text-white shadow-xs font-black'
                                                : 'bg-teal-600 text-white shadow-xs font-black'
                                              : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                                          }`}
                                        >
                                          {cat.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {selectedClass === '11th' && (
                                  <div className="space-y-1 animate-fadeIn">
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                      <span>3. Stream Selection <span className="text-red-500">*</span></span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                      {[
                                        { val: 'Science', label: 'Science' },
                                        { val: 'Humanities', label: 'Humanities' },
                                      ].map(st => {
                                        const isSel = selectedStream === st.val;
                                        return (
                                          <button
                                            key={st.val}
                                            type="button"
                                            onClick={() => handleFieldChange('Stream for Class 11th', st.val)}
                                            className={`h-8 sm:h-9 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center text-center ${
                                              isSel
                                                ? 'bg-teal-600 text-white shadow-xs font-black'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                                            }`}
                                          >
                                            {st.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Reason for Provisional */}
                              {selectedAdmissionType === 'Provisional' && (
                                <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 space-y-1.5 animate-fadeIn">
                                  <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                                    Reason for Provisional Admission <span className="text-red-500">*</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                    {[
                                      { val: 'Reappear Candidate', label: 'Reappear' },
                                      { val: 'Result Awaited', label: 'Result Awaited' },
                                      { val: 'Document Deficient', label: 'Doc Deficient' },
                                      { val: 'Other', label: 'Other Reason' },
                                    ].map(r => {
                                      const reasonKey = selectedClass === '12th'
                                        ? 'Reason for Provisional (Class 12th)'
                                        : selectedClass === '11th' ? 'Reason for Provisional (Class 11th)' : 'Reason for Provisional';
                                      const currentReason = formData[reasonKey] || formData['Reason for Provisional'] || '';
                                      const isSel = currentReason === r.val;
                                      return (
                                        <button
                                          key={r.val}
                                          type="button"
                                          onClick={() => {
                                            handleFieldChange(reasonKey, r.val);
                                            handleFieldChange('Reason for Provisional', r.val);
                                          }}
                                          className={`h-8 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center text-center ${
                                            isSel
                                              ? 'bg-amber-500 text-white shadow-xs font-black'
                                              : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-500/30 hover:bg-amber-500/15'
                                          }`}
                                        >
                                          {r.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}

                      {/* Gate notice if admission setup options are pending */}
                      {!hasAdmissionStart && !isFormLocked && (
                        <div className="rounded-xl sm:rounded-2xl border border-dashed border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/10 p-4 text-center space-y-1 animate-fadeIn">
                          <div className="font-bold text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                            {!selectedClass
                              ? '👉 Please select your Class above to get started'
                              : !selectedAdmissionType
                              ? '👉 Please choose Full or Provisional Admission'
                              : selectedAdmissionType === 'Provisional' && !hasReasonIfProvisional
                              ? '👉 Please select Reason for Provisional Admission'
                              : is11thClass && !hasStreamIf11th
                              ? '👉 Please select your Stream (Science or Humanities) for Class 11th'
                              : 'Select your admission options above to open the application form'}
                          </div>
                          <p className="text-[10.5px] text-slate-500">The application form will unlock automatically once your initial setup is selected.</p>
                        </div>
                      )}

                      {/* Single-page form: shortcuts above jump to these numbered groups. */}
                      {hasAdmissionStart && workflowSteps.map((workflowStep, workflowIndex) => {
                        const stepSections = sortedGroupedEntries.filter(
                          ([sectionTitle]) => sectionWorkflowStep(sectionTitle) === workflowStep.id
                        );

                        return (
                          <section
                            key={workflowStep.id}
                            id={`admission-section-${workflowStep.id}`}
                            className="scroll-mt-24 space-y-3"
                            onFocusCapture={() => {
                              setActiveTab(workflowStep.id);
                              if (hasAdmissionStart) setIsSetupCollapsed(true);
                            }}
                          >
                            {/* Workflow Step Divider/Header — Minimal & Crisp */}
                            <div className="flex items-center justify-between gap-2 pt-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-teal-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-2xs">
                                  {workflowIndex + 1}
                                </span>
                                <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                                  {workflowStep.label}
                                </h3>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                {stepSections.length} {stepSections.length === 1 ? 'group' : 'groups'}
                              </span>
                            </div>

                            <div className="space-y-3">
                              {stepSections.map(([sectionTitle, fields]) => {
                                const isIdentitySection = sectionTitle === '👤 Identity & Parentage';
                                const photoFieldInSec = isIdentitySection ? (fields.find(f => f === globalPhotoField) || globalPhotoField) : null;
                                const displayFields = photoFieldInSec ? fields.filter(f => f !== photoFieldInSec) : fields;
                                if (displayFields.length === 0 && !photoFieldInSec) return null;

                                return (
                                  <div
                                    key={sectionTitle}
                                    className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-sm space-y-3 transition-all hover:border-teal-500/40"
                                  >
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                                      <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"></span>
                                      <h4 className="tracking-wide uppercase text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-100 leading-tight">
                                        {sectionTitle}
                                      </h4>
                                    </div>

                                    {isIdentitySection ? (
                                      <div className="flex flex-col md:flex-row items-start gap-3.5">
                                        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                          {displayFields.map((field, idx) => {
                                            const name = field.fieldName || field.name || field['Field Name'];
                                            const hasError = Boolean(fieldErrors[name]);
                                            return (
                                              <div
                                                key={idx}
                                                data-field-name={name}
                                                className={`relative rounded-xl transition-all duration-200 ${
                                                  hasError ? 'ring-2 ring-red-500 bg-red-50/60 dark:bg-red-950/30 p-1 -m-1 shadow-sm animate-error-shake' : ''
                                                }`}
                                              >
                                                <DynamicFormField
                                                  config={field}
                                                  value={formData[name] || ''}
                                                  onChange={handleFieldChange}
                                                  subjectsConfig={subjectsConfig}
                                                  selectedStream={selectedStream}
                                                  disabled={isSubmitting || isFormLocked}
                                                  error={fieldErrors[name]}
                                                  formData={formData}
                                                  targetClass={selectedClass}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {photoFieldInSec && (
                                          <div
                                            data-field-name={photoFieldInSec.fieldName || photoFieldInSec.name || photoFieldInSec['Field Name']}
                                            className={`w-full md:w-auto flex flex-col items-center md:items-end flex-shrink-0 pt-0.5 rounded-xl transition-all duration-200 order-first md:order-last mb-1 md:mb-0 ${
                                              Boolean(fieldErrors[photoFieldInSec.fieldName || photoFieldInSec.name || photoFieldInSec['Field Name']])
                                                ? 'ring-2 ring-red-500 bg-red-50/60 dark:bg-red-950/30 p-1 shadow-sm animate-error-shake'
                                                : ''
                                            }`}
                                          >
                                            <DynamicFormField
                                              config={photoFieldInSec}
                                              value={formData[photoFieldInSec.fieldName || photoFieldInSec.name || photoFieldInSec['Field Name']] || ''}
                                              onChange={handleFieldChange}
                                              subjectsConfig={subjectsConfig}
                                              selectedStream={selectedStream}
                                              disabled={isSubmitting || isFormLocked}
                                              error={fieldErrors[photoFieldInSec.fieldName || photoFieldInSec.name || photoFieldInSec['Field Name']]}
                                              formData={formData}
                                              targetClass={selectedClass}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {displayFields.map((field, idx) => {
                                          const name = field.fieldName || field.name || field['Field Name'];
                                          const hasError = Boolean(fieldErrors[name]);
                                          return (
                                            <div
                                              key={idx}
                                              data-field-name={name}
                                              className={`${isFullWidthField(field, name) ? 'md:col-span-2 lg:col-span-3' : ''} relative rounded-xl transition-all duration-200 ${
                                                hasError ? 'ring-2 ring-red-500 bg-red-50/60 dark:bg-red-950/30 p-1 -m-1 shadow-sm animate-error-shake' : ''
                                              }`}
                                            >
                                              <DynamicFormField
                                                config={field}
                                                value={formData[name] || ''}
                                                onChange={handleFieldChange}
                                                subjectsConfig={subjectsConfig}
                                                selectedStream={selectedStream}
                                                disabled={isSubmitting || isFormLocked}
                                                error={fieldErrors[name]}
                                                formData={formData}
                                                targetClass={selectedClass}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {workflowStep.id === 'review' && (
                              <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3 flex items-center gap-2.5">
                                <ShieldCheck size={20} className="text-teal-600 flex-shrink-0" />
                                <div>
                                  <div className="font-black text-xs text-slate-800 dark:text-slate-100">Review before final submission</div>
                                  <p className="text-[10px] text-slate-500">Use Review &amp; Submit below. Any missing or invalid field will be shown in a popup and highlighted in place.</p>
                                </div>
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Bottom Actions Bar — Compact Sticky-Style */}
                <div id="admission-form-actions" className="sticky bottom-1 z-20 grid grid-cols-2 items-stretch gap-2 rounded-xl border bg-white/95 p-2 shadow-lg backdrop-blur-xl dark:bg-slate-950/95 sm:bottom-2 sm:flex sm:items-center sm:justify-between sm:rounded-2xl sm:p-2.5" style={{ borderColor: 'var(--border-ui, #e2e8f0)', paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
                  {isFormLocked ? (
                    <div className="col-span-2 w-full text-center text-[11px] font-bold text-slate-400 py-1.5 flex items-center justify-center gap-1.5 sm:col-auto">
                      <ShieldCheck size={14} className="text-teal-500" />
                      <span>Locked & submitted. View PDF on dashboard.</span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={isSubmitting || !hasAdmissionStart}
                        className="min-w-0 rounded-lg border px-2.5 py-2.5 font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all sm:rounded-xl sm:px-4 sm:text-xs"
                        style={{ borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #334155)' }}
                      >
                        <Save size={14} /> Save Draft
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmitting || admissionsClosed || !hasAdmissionStart}
                        className="min-w-0 rounded-lg px-2.5 py-2.5 font-black text-[11px] text-white shadow-md flex items-center justify-center gap-1 cursor-pointer transition-all sm:rounded-xl sm:px-5 sm:text-xs sm:gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.92'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        <Send size={14} />
                        <span>Review & Submit →</span>
                      </button>
                    </>
                  )}
                </div>
</form>
)}
</div>
</div>
</div>
</div>
)}
</div>
);
}
