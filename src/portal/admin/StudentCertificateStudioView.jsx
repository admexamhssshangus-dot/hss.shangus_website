// =================================================================
// HSS SHANGUS — Student Bonafides & Official Certificates Studio
// Dynamic Student Auto-Complete, DOB-to-Words Engine, Template Builder & Multi-Format Exports
// =================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Award, FileSpreadsheet, FileText, Printer, Download, Save,
  Search, Check, Sparkles, UserCheck, Sliders, RefreshCw, X,
  Plus, PlusCircle, ChevronDown, Edit3, Trash2, BookmarkPlus, Eye, Image as ImageIcon,
  User, CheckCircle2, History, RotateCcw, AlertCircle
} from 'lucide-react';
import {
  BUILTIN_CERTIFICATE_TEMPLATES,
  dobToWords,
  interpolateCertificateTemplate,
  printStudentCertificate,
  generateStudentCertificateDocx
} from '../../utils/certificateExportUtils';
import { getCachedCollectionSync, getCachedCollection, getPhotoUrlFromCache } from '../../services/dbCache';
import {
  extractStudentName,
  extractFatherName,
  extractMotherName,
  extractClass,
  extractStream,
  extractSession,
  extractDob,
  extractGender,
  extractBoardRegNo,
  getStudentRollNumber,
  extractAdmNo,
  extractFormNo,
  extractVillage,
  extractMobile
} from './CustomRosterDocumentBuilderView';
import { db } from '../../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  fetchCloudDocTemplates,
  saveCloudDocTemplate,
  setCloudDefaultTemplate,
  deleteCloudDocTemplate
} from '../../services/docTemplateService';

export default function StudentCertificateStudioView({
  allStudents = [],
  onClose,
  activeSubTab = 'certStudio',
  onSwitchSubTab,
  onSwitchToRoster,
  onSwitchToLetter
}) {
  // ─── Data Sources: Active Admissions + Multi-Collection Master Registers ───
  const [liveStudentsList, setLiveStudentsList] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [activeCohortFilter, setActiveCohortFilter] = useState('ALL'); // 'ALL' | '12th' | '11th' | '10th' | '9th' | 'present' | 'past'

  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      setIsLoadingStudents(true);
      const rawRecords = [];

      // 1. Ingest allStudents prop from parent dashboard if present
      if (Array.isArray(allStudents) && allStudents.length > 0) {
        rawRecords.push(...allStudents.map(st => ({ ...st, _srcCollection: 'admissions' })));
      }

      // 2. Ingest in-memory singleton cache if available
      if (typeof window !== 'undefined' && window._hssMasterRegistersCache && Array.isArray(window._hssMasterRegistersCache)) {
        rawRecords.push(...window._hssMasterRegistersCache.map(st => ({ ...st, _srcCollection: 'masterRegisters' })));
      }

      // 3. Load from dbCache sync if available
      try {
        const cachedAdm = getCachedCollectionSync('admissions');
        if (Array.isArray(cachedAdm) && cachedAdm.length > 0) {
          rawRecords.push(...cachedAdm.map(st => ({ ...st, _srcCollection: 'admissions' })));
        }
        const cachedMaster = getCachedCollectionSync('masterRegisters');
        if (Array.isArray(cachedMaster) && cachedMaster.length > 0) {
          rawRecords.push(...cachedMaster.map(st => ({ ...st, _srcCollection: 'masterRegisters' })));
        }
      } catch (err) {
        console.warn('Cache sync read note:', err);
      }

      // 4. Query Firestore collections directly (admissions, students, masterRegisters, registerdata, legacyStudents)
      const colls = ['admissions', 'students', 'masterRegisters', 'registerdata', 'legacyStudents'];
      for (const collName of colls) {
        try {
          const snap = await getDocs(collection(db, collName));
          snap.forEach(d => {
            const data = d.data();
            const chunkItems = data.items || data.students || data.data || data.records;
            if (Array.isArray(chunkItems)) {
              // Unpack chunked archival documents from masterRegisters / registerdata
              chunkItems.forEach(item => {
                if (item && typeof item === 'object') {
                  rawRecords.push({
                    ...item,
                    id: item.id || item['Form Number'] || item['Form No.'] || item['Board Registration Number'] || `${d.id}_${Math.random()}`,
                    _srcCollection: collName
                  });
                }
              });
            } else {
              rawRecords.push({ id: d.id, ...data, _srcCollection: collName });
            }
          });
        } catch (err) {
          console.warn(`Firestore read ${collName} note:`, err);
        }
      }

      if (isMounted) {
        setLiveStudentsList(rawRecords);
        setIsLoadingStudents(false);
      }
    };

    fetchAllData();
    return () => { isMounted = false; };
  }, [allStudents]);

  // Combined searchable student directory with Canonical Database Field Extractors
  const unifiedStudentDirectory = useMemo(() => {
    const list = [];
    const seenKeys = new Set();

    liveStudentsList.forEach(st => {
      if (!st) return;
      const name = extractStudentName(st);
      if (!name || name === '—' || /^(null|undefined|—)$/i.test(name)) return;

      const father = extractFatherName(st);
      const mother = extractMotherName(st);
      const cls = extractClass(st) || '11th';
      const stream = extractStream(st) || 'Medical';
      const rollNo = getStudentRollNumber(st) || extractAdmNo(st) || '';
      const regNo = extractBoardRegNo(st) || '';
      const formNo = extractFormNo(st) || st.id || '';
      const session = extractSession(st) || '2026-27';
      const dob = extractDob(st) || '';
      const rawGender = extractGender(st);
      const gender = rawGender.toLowerCase().startsWith('f') ? 'F' : 'M';
      const village = extractVillage(st);
      const address = village && village !== '—' ? `${village}, Shangus, Anantnag (J&K)` : 'Shangus, Anantnag — 192201 (J&K)';
      const mobile = extractMobile(st);
      const photo = getPhotoUrlFromCache(regNo || formNo) || st['passport_photo'] || st['Student Photo'] || st['Photo'] || st['photoUrl'] || null;
      
      const sessionLower = (session || '').toLowerCase();
      const isPast = st._srcCollection === 'masterRegisters' ||
        st._srcCollection === 'registerdata' ||
        st._srcCollection === 'legacyStudents' ||
        sessionLower.includes('legacy') ||
        sessionLower.includes('arch') ||
        sessionLower.includes('2024') ||
        sessionLower.includes('2023') ||
        sessionLower.includes('2022') ||
        sessionLower.includes('2021') ||
        sessionLower.includes('2020') ||
        sessionLower.includes('2019') ||
        sessionLower.includes('2018') ||
        sessionLower.includes('ex-') ||
        sessionLower.includes('past');

      // ── Strict Filter: For present session students, only show assigned class roll nos / approved ones ──
      if (!isPast) {
        const hasAssignedRoll = Boolean(rollNo && rollNo !== '—' && !/^(n\/?a|none|null|undefined|—|-)$/i.test(String(rollNo).trim()));
        const isApproved = /^(approved|admitted|confirmed|upgrade|active)$/i.test(String(st.Status || st.status || '').trim()) ||
          String(st.Status || st.status || '').toLowerCase().includes('approv');

        if (!hasAssignedRoll && !isApproved) {
          return; // Skip unassigned / unapproved applicants from present session
        }
      }

      const dedupeKey = `${(regNo && regNo !== '—' ? regNo : '')}_${(rollNo && rollNo !== '—' ? rollNo : '')}_${(formNo && formNo !== '—' ? formNo : '')}_${name.toLowerCase()}_${father.toLowerCase()}`;
      
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        list.push({
          sourceType: isPast ? 'past' : 'present',
          sourceBadge: isPast ? 'Master Register' : 'Present Student',
          id: formNo || dedupeKey,
          name,
          father: father !== '—' ? father : '',
          mother: mother !== '—' ? mother : '',
          cls,
          stream,
          rollNo: rollNo !== '—' ? rollNo : '',
          regNo: regNo !== '—' ? regNo : '',
          formNo: formNo !== '—' ? formNo : '',
          session,
          dob: dob !== '—' ? dob : '',
          gender,
          address,
          mobile: mobile !== '—' ? mobile : '',
          photo,
          raw: st
        });
      }
    });

    return list;
  }, [liveStudentsList]);

  // ─── Student Search & Selection State ───
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Filtered search list with real cohort filters and multi-field matching
  const filteredStudents = useMemo(() => {
    let pool = unifiedStudentDirectory;

    // Apply Active Cohort Filter Chip
    if (activeCohortFilter === '12th') {
      pool = pool.filter(st => st.cls.toLowerCase().includes('12'));
    } else if (activeCohortFilter === '11th') {
      pool = pool.filter(st => st.cls.toLowerCase().includes('11'));
    } else if (activeCohortFilter === '10th') {
      pool = pool.filter(st => st.cls.toLowerCase().includes('10'));
    } else if (activeCohortFilter === '9th') {
      pool = pool.filter(st => st.cls.toLowerCase().includes('9'));
    } else if (activeCohortFilter === 'present') {
      pool = pool.filter(st => st.sourceType === 'present');
    } else if (activeCohortFilter === 'past') {
      pool = pool.filter(st => st.sourceType === 'past');
    }

    const q = studentSearchQuery.trim().toLowerCase();
    if (!q) return pool.slice(0, 30);

    return pool.filter(st => {
      return (
        st.name.toLowerCase().includes(q) ||
        st.father.toLowerCase().includes(q) ||
        st.mother.toLowerCase().includes(q) ||
        st.rollNo.toLowerCase().includes(q) ||
        st.regNo.toLowerCase().includes(q) ||
        st.formNo.toLowerCase().includes(q) ||
        st.mobile.toLowerCase().includes(q) ||
        st.cls.toLowerCase().includes(q) ||
        st.stream.toLowerCase().includes(q) ||
        st.address.toLowerCase().includes(q) ||
        st.session.toLowerCase().includes(q)
      );
    }).slice(0, 40);
  }, [unifiedStudentDirectory, studentSearchQuery, activeCohortFilter]);

  // ─── Active Certificate Form State (Auto-filled + Manual Overrides) ───
  const [studentName, setStudentName] = useState('MOHAMMAD TAHIR WANI');
  const [fatherName, setFatherName] = useState('GHULAM NABI WANI');
  const [motherName, setMotherName] = useState('FAHMEEDA AKHTER');
  const [className, setClassName] = useState('11th');
  const [stream, setStream] = useState('Medical');
  const [rollNo, setRollNo] = useState('1101');
  const [regNo, setRegNo] = useState('24SHG1101');
  const [dobRaw, setDobRaw] = useState('2007-08-15');
  const [session, setSession] = useState('2026-27');
  const [address, setAddress] = useState('Shangus, Anantnag — 192201 (J&K)');
  const [gender, setGender] = useState('M');
  const [studentPhotoUrl, setStudentPhotoUrl] = useState(null);

  // ─── Custom Dynamic Fields (Add/Remove/Edit values on the fly) ───
  const [customFields, setCustomFields] = useState([]);
  const [showFieldManagerModal, setShowFieldManagerModal] = useState(false);
  const [newCustomFieldName, setNewCustomFieldName] = useState('');
  const [newCustomFieldValue, setNewCustomFieldValue] = useState('');

  // Derived DOB in figures & words
  const parsedDob = useMemo(() => dobToWords(dobRaw), [dobRaw]);

  // Certificate Header & Options State
  const [officeTitle, setOfficeTitle] = useState('OFFICE OF THE PRINCIPAL');
  const [institutionName, setInstitutionName] = useState('GOVT. HIGHER SECONDARY SCHOOL SHANGUS');
  const [institutionAddress, setInstitutionAddress] = useState('District Anantnag, Kashmir — 192201 (J&K)');
  const [certificateTitle, setCertificateTitle] = useState('BONAFIDE CERTIFICATE');
  const [refNo, setRefNo] = useState('HSS/SHG/Bonafide/2026/01');
  const [dateStr, setDateStr] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [showPhoto, setShowPhoto] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [signatoryLeft, setSignatoryLeft] = useState('Incharge Admissions & Exam');
  const [signatoryRight, setSignatoryRight] = useState('Principal');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const signatories = useMemo(() => [signatoryLeft, signatoryRight].filter(Boolean), [signatoryLeft, signatoryRight]);

  // ─── Templates State (Built-in + Custom) ───
  const [defaultTemplateId, setDefaultTemplateId] = useState(() => {
    try {
      return localStorage.getItem('hss_default_cert_template_id') || 'bonafide_dob';
    } catch {
      return 'bonafide_dob';
    }
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    try {
      return localStorage.getItem('hss_default_cert_template_id') || 'bonafide_dob';
    } catch {
      return 'bonafide_dob';
    }
  });
  const [templateBody, setTemplateBody] = useState(BUILTIN_CERTIFICATE_TEMPLATES[0].bodyHtml);
  const [customCanvasHtml, setCustomCanvasHtml] = useState(null);
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_custom_certificate_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [templateFilterTab, setTemplateFilterTab] = useState('all'); // 'all' | 'builtin' | 'custom'
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [makeTemplateDefault, setMakeTemplateDefault] = useState(true);
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] = useState('Bonafide & Age Certificates');
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Initialize Certificate Templates from Firebase Cloud
  useEffect(() => {
    let isMounted = true;
    const initCloudCertTemplates = async () => {
      try {
        const { templates, defaultTemplateId: cloudDefaultId } = await fetchCloudDocTemplates('certificate');
        if (!isMounted) return;

        if (templates && templates.length > 0) {
          setCustomTemplates(templates);
        }

        const activeDefId = cloudDefaultId || defaultTemplateId || 'bonafide_dob';
        if (cloudDefaultId) setDefaultTemplateId(cloudDefaultId);

        const allTpls = [...(templates || []), ...BUILTIN_CERTIFICATE_TEMPLATES];
        const found = allTpls.find(t => t.id === activeDefId) || BUILTIN_CERTIFICATE_TEMPLATES[0];
        if (found) {
          setSelectedTemplateId(found.id);
          setTemplateBody(found.bodyHtml);
          if (found.certificateTitle) setCertificateTitle(found.certificateTitle);
          if (found.showPhoto !== undefined) setShowPhoto(found.showPhoto);
        }
      } catch (err) {
        console.warn('Note: Could not sync cloud certificate templates:', err);
      }
    };

    initCloudCertTemplates();
    return () => { isMounted = false; };
  }, []);

  // ─── Draggable Dual-Pane Splitter State ───
  const [leftSplitPct, setLeftSplitPct] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_cert_split_pct');
      return saved ? Math.max(22, Math.min(65, Number(saved))) : 36;
    } catch {
      return 36;
    }
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSplitterMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    const container = e.currentTarget.closest('.cert-split-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvt) => {
      moveEvt.preventDefault();
      const mouseX = moveEvt.clientX - rect.left;
      const pct = Math.max(22, Math.min(65, (mouseX / rect.width) * 100));
      const rounded = Math.round(pct * 10) / 10;
      setLeftSplitPct(rounded);
      try {
        localStorage.setItem('hss_cert_split_pct', String(rounded));
      } catch {}
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // ─── Select Student Handler (Auto-Fills Fields & Instantly Re-Interpolates Canvas) ───
  const handleSelectStudent = (st) => {
    setSelectedStudent(st);
    setIsSearchDropdownOpen(false);
    setStudentSearchQuery(`${st.name} (${st.rollNo || st.regNo || st.cls})`);

    // Reset canvas override so the new student data is cleanly interpolated from template tokens
    setCustomCanvasHtml(null);

    const activeTpl = [...customTemplates, ...BUILTIN_CERTIFICATE_TEMPLATES].find(t => t.id === selectedTemplateId) || BUILTIN_CERTIFICATE_TEMPLATES[0];
    setTemplateBody(activeTpl.bodyHtml);

    setStudentName(st.name || '');
    setFatherName(st.father || '');
    setMotherName(st.mother || '');
    setClassName(st.cls || '11th');
    setStream(st.stream || 'Medical');
    setRollNo(st.rollNo || '—');
    setRegNo(st.regNo || '—');
    setDobRaw(st.dob || '');
    setSession(st.session || '2026-27');
    setAddress(st.address || 'Shangus, Anantnag');
    setGender(st.gender || 'M');
    setStudentPhotoUrl(st.photo || null);

    // Auto-update Ref No
    const prefix = activeTpl.refPrefix || 'HSS/SHG/Bonafide';
    setRefNo(`${prefix}/${st.rollNo || st.regNo || '01'}/${new Date().getFullYear()}`);
  };

  // ─── Select Template Handler ───
  const handleSelectTemplate = (tpl) => {
    setSelectedTemplateId(tpl.id);
    setTemplateBody(tpl.bodyHtml);
    setCustomCanvasHtml(null);
    if (tpl.certificateTitle) setCertificateTitle(tpl.certificateTitle);
    if (tpl.showPhoto !== undefined) setShowPhoto(tpl.showPhoto);
    if (tpl.refPrefix) {
      setRefNo(`${tpl.refPrefix}/${rollNo || regNo || '01'}/${new Date().getFullYear()}`);
    }
  };

  // ─── Insert Placeholder Chip ───
  const insertToken = (token) => {
    setTemplateBody(prev => prev + ` ${token} `);
    setCustomCanvasHtml(null);
  };

  // ─── Live Interpolated Preview Content ───
  const interpolatedPreviewHtml = useMemo(() => {
    return interpolateCertificateTemplate(templateBody, {
      studentName,
      fatherName,
      motherName,
      className,
      stream,
      rollNo,
      regNo,
      dobFigures: parsedDob.figures,
      dobWords: parsedDob.words,
      session,
      address,
      gender,
      refNo,
      date: dateStr,
      customFields
    });
  }, [templateBody, studentName, fatherName, motherName, className, stream, rollNo, regNo, parsedDob, session, address, gender, refNo, dateStr, customFields]);

  // Active rendered HTML (Canvas override or cleanly interpolated preview)
  const activeDisplayHtml = customCanvasHtml !== null ? customCanvasHtml : interpolatedPreviewHtml;

  // ─── 1-Click Set as Default Template ───
  const handleSetDefaultTemplate = async (templateId, e) => {
    e?.stopPropagation();
    setDefaultTemplateId(templateId);
    try {
      await setCloudDefaultTemplate(templateId, 'certificate');
    } catch (err) {
      console.warn('Set default error:', err);
    }
  };

  // ─── Save Custom Template (Cloud Firestore + LocalStorage) ───
  const handleSaveCustomTemplate = async (e) => {
    e.preventDefault();
    if (!newTplName.trim()) return;

    const newTpl = {
      id: `custom_cert_${Date.now()}`,
      name: newTplName.trim(),
      category: newTplCategory || 'Custom Certificates',
      certificateTitle: certificateTitle || 'CERTIFICATE',
      bodyHtml: templateBody,
      showPhoto,
      watermark,
      isCustom: true
    };

    try {
      await saveCloudDocTemplate({
        type: 'certificate',
        template: newTpl,
        makeDefault: makeTemplateDefault
      });

      const updated = [newTpl, ...customTemplates.filter(t => t.id !== newTpl.id)];
      setCustomTemplates(updated);
      setSelectedTemplateId(newTpl.id);
      if (makeTemplateDefault) {
        setDefaultTemplateId(newTpl.id);
      }
      setShowSaveTemplateModal(false);
      setNewTplName('');
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Template saved locally (Cloud sync note: ' + err.message + ')');
    }
  };

  // ─── Delete Custom Template (Cloud Firestore + LocalStorage) ───
  const handleDeleteCustomTemplate = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this custom template?')) return;
    try {
      await deleteCloudDocTemplate(id, 'certificate');
    } catch (err) {
      console.warn(err);
    }
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    if (selectedTemplateId === id) {
      handleSelectTemplate(BUILTIN_CERTIFICATE_TEMPLATES[0]);
    }
    if (defaultTemplateId === id) {
      setDefaultTemplateId('bonafide_dob');
    }
  };

  // ─── Preset Firestore Student Fields & Auto-Pick Handlers ───
  const FIRESTORE_PRESET_FIELDS = [
    { label: 'Mobile No', keys: ['mobile', 'mobile_no', 'Mobile', 'Mobile Number', 'Phone', 'contact_no', 'phone'] },
    { label: 'Email Address', keys: ['email', 'Email', 'email_address'] },
    { label: 'Admission Form No', keys: ['formNo', 'form_no', 'Form No', 'Form Number', 'FormNumber', 'id'] },
    { label: 'Aadhaar Number', keys: ['aadhar', 'aadhar_no', 'Aadhar', 'Aadhaar', 'aadhaar_no', 'Aadhar Number', 'aadhaar'] },
    { label: 'Category', keys: ['category', 'Category', 'Social Category', 'social_category', 'reserved_category'] },
    { label: 'Blood Group', keys: ['blood_group', 'Blood Group', 'bloodGroup', 'BloodGroup', 'blood_grp'] },
    { label: 'PEN Number', keys: ['pen', 'pen_no', 'PEN', 'PEN No', 'PEN Number', 'pen_number', 'Permanent Education No'] },
    { label: 'Previous School', keys: ['prev_school', 'previous_school', 'Previous School', 'Institution Last Attended', 'school_last_attended'] },
    { label: 'Marks Percentage', keys: ['percentage', 'Percentage', 'marks_percentage', 'Marks %', 'percent', 'Percentage / GPA'] },
    { label: 'Subjects', keys: ['subjects', 'Subjects', 'subjects_offered', 'Subjects Offered', 'subject_combination', 'Subjects Selected'] },
    { label: 'Admission Date', keys: ['admission_date', 'Admission Date', 'adm_date', 'date_of_admission', 'Date of Admission'] },
    { label: 'Guardian Contact', keys: ['parent_mobile', 'guardian_mobile', 'Father Mobile', 'father_mobile', 'Parent Contact'] },
    { label: 'Village / Tehsil', keys: ['village', 'Village', 'tehsil', 'Tehsil', 'residence_village'] }
  ];

  const findValueInStudentRaw = (st, keys) => {
    if (!st) return '';
    for (const k of keys) {
      if (st[k] !== undefined && st[k] !== null && String(st[k]).trim() !== '' && String(st[k]).trim() !== '—') {
        return String(st[k]).trim();
      }
    }
    if (st.raw && typeof st.raw === 'object') {
      for (const k of keys) {
        if (st.raw[k] !== undefined && st.raw[k] !== null && String(st.raw[k]).trim() !== '' && String(st.raw[k]).trim() !== '—') {
          return String(st.raw[k]).trim();
        }
      }
    }
    return '';
  };

  // Extract all extra raw keys present in the selected student's Firestore document
  const availableRawFirestoreFields = useMemo(() => {
    if (!selectedStudent?.raw || typeof selectedStudent.raw !== 'object') return [];
    const ignoredKeys = new Set([
      '_srcCollection', 'id', 'photoUrl', 'passport_photo', 'Photo', 'Student Photo', 
      'createdAt', 'updatedAt', 'timestamp', 'raw', 'status', 'Status', 'formStatus',
      'searchKeywords', 'uid', 'studentPhoto', 'name', 'father', 'mother', 'gender'
    ]);
    
    const list = [];
    Object.entries(selectedStudent.raw).forEach(([k, v]) => {
      if (ignoredKeys.has(k)) return;
      if (typeof v === 'object' && v !== null) return;
      const strVal = String(v ?? '').trim();
      if (!strVal || strVal === '—' || strVal === 'null' || strVal === 'undefined') return;
      
      const formattedLabel = k
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b\w/g, l => l.toUpperCase());
      
      list.push({ key: k, label: formattedLabel, value: strVal });
    });
    return list;
  }, [selectedStudent]);

  const handlePickFirestoreField = (label, defaultValue = '') => {
    // Check if already in customFields
    const existing = customFields.find(f => f.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      if (defaultValue && !existing.value) {
        handleUpdateCustomField(existing.id, 'value', defaultValue);
      }
      return;
    }
    const newField = {
      id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim(),
      value: defaultValue
    };
    setCustomFields(prev => [...prev, newField]);
  };

  // ─── Custom Dynamic Fields Handlers (Temporary In-Memory Overrides) ───
  const handleAddCustomField = (e) => {
    e?.preventDefault();
    if (!newCustomFieldName.trim()) return;
    const newField = {
      id: `custom_field_${Date.now()}`,
      label: newCustomFieldName.trim(),
      value: newCustomFieldValue.trim()
    };
    setCustomFields(prev => [...prev, newField]);
    setNewCustomFieldName('');
    setNewCustomFieldValue('');
  };

  const handleUpdateCustomField = (id, fieldKey, val) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, [fieldKey]: val } : f));
  };

  const handleDeleteCustomField = (id) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleResetFieldsToStudent = () => {
    if (!selectedStudent) return;
    const st = selectedStudent;
    setStudentName(st.name || '');
    setFatherName(st.father || '');
    setMotherName(st.mother || '');
    setClassName(st.cls || '11th');
    setStream(st.stream || 'Arts');
    setRollNo(st.rollNo || '');
    setRegNo(st.regNo || '');
    setSession(st.session || '2026-27');
    setGender(st.gender || 'M');
    setDobRaw(st.dob || '');
    setAddress(st.address || '');
    setCustomCanvasHtml(null);

    // Also refresh values for any active custom Firestore fields
    setCustomFields(prev => prev.map(f => {
      const preset = FIRESTORE_PRESET_FIELDS.find(p => p.label.toLowerCase() === f.label.toLowerCase());
      if (preset) {
        const val = findValueInStudentRaw(st, preset.keys);
        if (val) return { ...f, value: val };
      }
      return f;
    }));
  };

  // ─── Direct In-Place Canvas Editor & Right-Click Context Menu State ───
  const editorRef = useRef(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [savedRange, setSavedRange] = useState(null);
  const [showInsertFieldDropdown, setShowInsertFieldDropdown] = useState(false);
  const insertFieldDropdownRef = useRef(null);

  // Sync interpolated content into editorRef whenever active content changes
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = activeDisplayHtml;
    }
  }, [activeDisplayHtml]);

  const handleEditorInput = () => {
    if (editorRef.current) {
      setCustomCanvasHtml(editorRef.current.innerHTML);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        setSavedRange(sel.getRangeAt(0));
      }
    }
    const menuWidth = 280;
    const menuHeight = 440;
    const x = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 10));
    const y = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 10));
    setContextMenuPos({ x, y });
    setShowContextMenu(true);
  };

  useEffect(() => {
    const handleGlobalClick = (e) => {
      setShowContextMenu(false);
      if (insertFieldDropdownRef.current && !insertFieldDropdownRef.current.contains(e.target)) {
        setShowInsertFieldDropdown(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowContextMenu(false);
        setShowInsertFieldDropdown(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleInsertPlaceholder = (textToInsert) => {
    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange && window.getSelection) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      document.execCommand('insertText', false, textToInsert);
      setCustomCanvasHtml(editorRef.current.innerHTML);
    }
    setShowContextMenu(false);
    setShowInsertFieldDropdown(false);
  };

  // ─── Export Handlers ───
  const handlePrint = () => {
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : activeDisplayHtml;
    printStudentCertificate({
      officeTitle,
      institutionName,
      institutionAddress,
      certificateTitle,
      refNo,
      dateStr,
      bodyHtml: currentHtml,
      studentPhotoUrl,
      showPhoto,
      watermark,
      signatories
    });
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      const currentHtml = editorRef.current ? editorRef.current.innerHTML : activeDisplayHtml;
      await generateStudentCertificateDocx({
        officeTitle,
        institutionName,
        institutionAddress,
        certificateTitle,
        refNo,
        dateStr,
        bodyHtml: currentHtml,
        signatories
      });
    } catch (err) {
      console.error('Word export error:', err);
      alert('Failed to generate Word document.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const allTemplatesList = [...customTemplates, ...BUILTIN_CERTIFICATE_TEMPLATES];
  const displayedTemplates = templateFilterTab === 'custom'
    ? customTemplates
    : templateFilterTab === 'builtin'
      ? BUILTIN_CERTIFICATE_TEMPLATES
      : allTemplatesList;

  return (
    <div className="space-y-2 animate-fadeIn text-slate-900 dark:text-slate-100">
      
      {/* ── UNIFIED MASTER ACTION & SUB-TAB TOOLBAR (ALL ON 1 ROW) ── */}
      <div className="bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        
        {/* Left Side: Active Tool Title & Indexed Count Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Award size={14} className="text-teal-600" />
            <span>Student Bonafides & Certificates Studio</span>
          </span>

          <span className="font-mono font-black text-[10px] px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 hidden sm:inline">
            {unifiedStudentDirectory.length} Students Indexed
          </span>
        </div>

        {/* Right Side: 1-Click Export Actions Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          
          {/* ── Insert Student Field Dropdown Button (Left of Letterhead & Setup) ── */}
          <div className="relative inline-block" ref={insertFieldDropdownRef}>
            <button
              type="button"
              onClick={() => setShowInsertFieldDropdown(!showInsertFieldDropdown)}
              className="px-2.5 py-1 rounded-lg border font-black text-[10.5px] flex items-center gap-1 cursor-pointer shadow-2xs transition-all bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-800 hover:bg-teal-100"
              title="Insert student database fields or tags at cursor"
            >
              <PlusCircle size={11} className="text-teal-600 dark:text-teal-400" />
              <span>Insert Field</span>
              <ChevronDown size={11} className="text-teal-600 dark:text-teal-400" />
            </button>

            {showInsertFieldDropdown && (
              <div className="absolute right-0 sm:left-0 top-full mt-1 w-72 bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-xl shadow-2xl z-[999999] p-1.5 space-y-1 text-xs animate-fadeIn divide-y divide-slate-100 dark:divide-slate-800 max-h-[75vh] overflow-y-auto">
                <div className="px-1.5 py-1 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider">
                    <PlusCircle size={10} className="text-teal-600" />
                    <span>Insert Student Field</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowInsertFieldDropdown(false); setShowFieldManagerModal(true); }}
                    className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 hover:bg-teal-100 text-[9px] font-extrabold border border-teal-200 dark:border-teal-800 flex items-center gap-1 cursor-pointer"
                    title="Edit or add temporary dynamic field values"
                  >
                    <Sliders size={9} />
                    <span>✏️ Edit Values</span>
                  </button>
                </div>

                {/* Group 1: Student & Parents */}
                <div className="pt-1 space-y-0.5">
                  <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Student & Parents</div>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(studentName ? studentName : '{STUDENT_NAME}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Student Name</span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{studentName || '{STUDENT_NAME}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(fatherName ? fatherName : '{FATHER_NAME}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Father's Name</span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{fatherName || '{FATHER_NAME}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(motherName ? motherName : '{MOTHER_NAME}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Mother's Name</span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{motherName || '{MOTHER_NAME}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(gender === 'F' ? 'Ms.' : 'Mr.')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Gender Title</span>
                    <span className="text-[9px] text-slate-400">{gender === 'F' ? 'Ms.' : 'Mr.'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(gender === 'F' ? 'daughter' : 'son')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Son / Daughter</span>
                    <span className="text-[9px] text-slate-400">{gender === 'F' ? 'daughter' : 'son'}</span>
                  </button>
                </div>

                {/* Group 2: Academic & Registration */}
                <div className="pt-1 space-y-0.5">
                  <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Class & Roll / Reg</div>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(className || '{CLASS}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Class</span>
                    <span className="text-[9px] text-slate-400">{className || '{CLASS}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(stream || '{STREAM}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Stream</span>
                    <span className="text-[9px] text-slate-400">{stream || '{STREAM}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(rollNo || '{ROLL_NO}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Class Roll No</span>
                    <span className="text-[9px] text-slate-400">{rollNo || '{ROLL_NO}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(regNo || '{REG_NO}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Registration No</span>
                    <span className="text-[9px] text-slate-400">{regNo || '{REG_NO}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(session || '{SESSION}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Academic Session</span>
                    <span className="text-[9px] text-slate-400">{session || '{SESSION}'}</span>
                  </button>
                </div>

                {/* Group 3: DOB & Address */}
                <div className="pt-1 space-y-0.5">
                  <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">DOB & Record Dates</div>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(parsedDob.figures || '{DOB_FIGURES}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>DOB (in Figures)</span>
                    <span className="text-[9px] text-slate-400">{parsedDob.figures || '{DOB_FIGURES}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(parsedDob.words || '{DOB_WORDS}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>DOB (in Words)</span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{parsedDob.words || '{DOB_WORDS}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(address || '{ADDRESS}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Permanent Address</span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{address || '{ADDRESS}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(dateStr || '{DATE}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Certificate Date</span>
                    <span className="text-[9px] text-slate-400">{dateStr || '{DATE}'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertPlaceholder(refNo || '{REF_NO}')}
                    className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>Reference No</span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{refNo || '{REF_NO}'}</span>
                  </button>
                </div>

                {/* Group 4: Firestore Database Fields */}
                <div className="pt-1 space-y-0.5">
                  <div className="px-2 text-[8.5px] font-bold text-teal-700 dark:text-teal-400 uppercase flex items-center justify-between">
                    <span>Firestore DB Fields</span>
                    <span className="text-[7.5px] text-slate-400 font-normal">From Record</span>
                  </div>
                  {FIRESTORE_PRESET_FIELDS.slice(0, 8).map((preset) => {
                    const studentVal = findValueInStudentRaw(selectedStudent, preset.keys);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleInsertPlaceholder(studentVal || `{${preset.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`)}
                        className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
                      >
                        <span className="truncate">{preset.label}</span>
                        <span className="text-[9px] text-slate-400 truncate max-w-[120px] font-mono">
                          {studentVal || `{${preset.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Group 5: Custom Dynamic Fields (Add / Remove) */}
                {customFields.length > 0 && (
                  <div className="pt-1 space-y-0.5">
                    <div className="px-2 text-[8.5px] font-bold text-amber-600 dark:text-amber-400 uppercase">Custom Added Fields</div>
                    {customFields.map((cf) => (
                      <div key={cf.id} className="flex items-center justify-between group px-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40">
                        <button
                          type="button"
                          onClick={() => handleInsertPlaceholder(cf.value || `{${cf.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`)}
                          className="flex-1 py-1 text-left font-bold flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">{cf.label}</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[100px] ml-1">{cf.value || '—'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomField(cf.id)}
                          className="text-slate-300 hover:text-rose-600 p-0.5 ml-1 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                          title="Delete this custom field"
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Quick Manager Link */}
                <div className="pt-1.5 pb-0.5">
                  <button
                    type="button"
                    onClick={() => { setShowInsertFieldDropdown(false); setShowFieldManagerModal(true); }}
                    className="w-full py-1 px-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[10px] flex items-center justify-center gap-1 cursor-pointer shadow-2xs transition-all"
                  >
                    <PlusCircle size={10} />
                    <span>➕ Manage / Edit Custom & DB Fields</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Certificate Letterhead & Setup Toggle */}
          <button
            type="button"
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className={`px-2.5 py-1 rounded-lg border font-extrabold text-[10.5px] flex items-center gap-1 cursor-pointer shadow-2xs transition-all ${
              showSettingsDrawer
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-700'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
            }`}
            title="Configure Official Letterhead, Ref No, Date & Signatories"
          >
            <Sliders size={11} className="text-amber-600 dark:text-amber-400" />
            <span>Letterhead & Setup</span>
          </button>

          {/* Student Photo Visibility Toggle Button */}
          <button
            type="button"
            onClick={() => setShowPhoto(!showPhoto)}
            className={`px-2.5 py-1 rounded-lg border font-black text-[10.5px] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all ${
              showPhoto
                ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border-teal-400 dark:border-teal-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Toggle Student Photo Box on Certificate (Disabled by default)"
          >
            <span>{showPhoto ? '📷 Photo Box: ON' : '📷 Photo Box: OFF'}</span>
          </button>

          {/* Save Template Button */}
          <button
            type="button"
            onClick={() => setShowSaveTemplateModal(true)}
            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-extrabold text-[10.5px] flex items-center gap-1 cursor-pointer shadow-2xs transition-all"
            title="Save current certificate format as reusable template"
          >
            <BookmarkPlus size={11} className="text-emerald-600 dark:text-emerald-400" />
            <span>Save Template</span>
          </button>

          {/* Word (.docx) Export */}
          <button
            type="button"
            disabled={isExportingDocx}
            onClick={handleExportDocx}
            className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-black text-[10.5px] flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
            title="Download editable Word Document (.docx)"
          >
            {isExportingDocx ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={11} />}
            <span>Word (.docx)</span>
          </button>

          {/* Print / Save PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1 rounded-lg bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 text-white font-black text-[10.5px] flex items-center gap-1 shadow-md cursor-pointer transition-all active:scale-95"
            title="Print or Save Certificate as PDF"
          >
            <Printer size={11} />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* ════════ COLLAPSIBLE CERTIFICATE HEADER & LAYOUT CONFIG DRAWER ════════ */}
      {showSettingsDrawer && (
        <div className="bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-900/60 rounded-xl p-3 shadow-sm space-y-2 animate-fadeIn text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
            <h3 className="font-black text-[11px] text-teal-900 dark:text-teal-200 uppercase tracking-wider flex items-center gap-1.5 m-0">
              <Sliders size={12} />
              <span>Certificate Letterhead & Institutional Setup</span>
            </h3>
            <span className="text-[9.5px] text-slate-500">Live preview & auto-applied on print/export</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {/* Office Title */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Office Header</label>
              <input
                type="text"
                value={officeTitle}
                onChange={(e) => setOfficeTitle(e.target.value)}
                placeholder="OFFICE OF THE PRINCIPAL"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-xs text-rose-800 dark:text-rose-300"
              />
            </div>

            {/* Institution Name */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Institution Name</label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="GOVT. HIGHER SECONDARY SCHOOL SHANGUS"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-blue-900 dark:text-blue-300"
              />
            </div>

            {/* Ref No */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Reference Number</label>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="HSS/SHG/Bonafide/2026/01"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Issue Date</label>
              <input
                type="text"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              />
            </div>

            {/* Certificate Title */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Certificate Title Banner</label>
              <input
                type="text"
                value={certificateTitle}
                onChange={(e) => setCertificateTitle(e.target.value)}
                placeholder="BONAFIDE CERTIFICATE"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-amber-900 dark:text-amber-200"
              />
            </div>

            {/* Signatory 1 (Left) */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Signatory 1 (Left)</label>
              <input
                type="text"
                value={signatoryLeft}
                onChange={(e) => setSignatoryLeft(e.target.value)}
                placeholder="Incharge Admissions & Exam"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
              />
            </div>

            {/* Signatory 2 (Right) */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Signatory 2 (Right)</label>
              <input
                type="text"
                value={signatoryRight}
                onChange={(e) => setSignatoryRight(e.target.value)}
                placeholder="Principal"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
              />
            </div>

            {/* Watermark Background & Options */}
            <div className="flex items-center gap-4 pt-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                <input
                  type="checkbox"
                  checked={watermark}
                  onChange={(e) => setWatermark(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <span>Seal Watermark</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                <input
                  type="checkbox"
                  checked={showPhoto}
                  onChange={(e) => setShowPhoto(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <span>Photo Box</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── 2-COLUMN DRAG-RESIZABLE SPLIT-SCREEN LAYOUT ── */}
      <div className="cert-split-container flex flex-col lg:flex-row gap-0 items-start w-full relative">
        
        {/* ════════ LEFT HALF: STUDENT SELECTOR & CERTIFICATE PALETTE ════════ */}
        <div
          style={{ width: isDesktop ? `${leftSplitPct}%` : '100%' }}
          className="w-full lg:w-auto shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-3 space-y-2 text-xs overflow-hidden"
        >
          
          {/* SECTION 1: INSTANT STUDENT AUTO-COMPLETE SEARCH BAR & COHORT FILTERS */}
          <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-slate-800 relative">
            <div className="flex items-center justify-between text-[9.5px] uppercase font-black tracking-wider text-slate-500">
              <span className="flex items-center gap-1">
                <Search size={11} className="text-teal-600 dark:text-teal-400" />
                <span>1. Search & Select Student</span>
              </span>
              <span className="text-[9px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                {isLoadingStudents && <RefreshCw size={9} className="animate-spin text-teal-600" />}
                <span>{unifiedStudentDirectory.length} Students Indexed</span>
              </span>
            </div>

            {/* Quick Cohort Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[9px]">
              {[
                { id: 'ALL', label: `All (${unifiedStudentDirectory.length})` },
                { id: '12th', label: `12th (${unifiedStudentDirectory.filter(s => s.cls.includes('12')).length})` },
                { id: '11th', label: `11th (${unifiedStudentDirectory.filter(s => s.cls.includes('11')).length})` },
                { id: '10th', label: `10th (${unifiedStudentDirectory.filter(s => s.cls.includes('10')).length})` },
                { id: '9th', label: `9th (${unifiedStudentDirectory.filter(s => s.cls.includes('9')).length})` },
                { id: 'past', label: `Master Reg (${unifiedStudentDirectory.filter(s => s.sourceType === 'past').length})` }
              ].map(chip => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveCohortFilter(chip.id)}
                  className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap cursor-pointer transition-all border ${
                    activeCohortFilter === chip.id
                      ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                value={studentSearchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setStudentSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                placeholder="Search by Name, Roll No, Reg No, Father, Mobile..."
                className="w-full pl-7 pr-7 py-1.5 rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50/40 dark:bg-teal-950/30 font-bold text-xs shadow-2xs focus:ring-1 focus:ring-teal-500 focus:outline-none placeholder:text-slate-400"
              />
              <Search size={12} className="absolute left-2 top-2.5 text-teal-600 dark:text-teal-400" />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearchQuery('');
                    setIsSearchDropdownOpen(false);
                  }}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Dropdown Auto-Complete Results */}
            {isSearchDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500 font-bold">
                    {isLoadingStudents ? 'Loading student database...' : 'No matching students found.'}
                  </div>
                ) : (
                  filteredStudents.map((st) => (
                    <button
                      key={st.id + st.sourceType + (st.rollNo || '')}
                      type="button"
                      onClick={() => handleSelectStudent(st)}
                      className="w-full p-2 text-left hover:bg-teal-50/60 dark:hover:bg-teal-950/40 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {st.photo ? (
                          <img src={st.photo} alt={st.name} className="w-8 h-8 rounded-full object-cover border border-slate-300 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center text-[10.5px] font-black shrink-0">
                            {st.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{st.name}</span>
                            <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold shrink-0 ${
                              st.sourceType === 'present'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {st.sourceType === 'present' ? 'Present' : 'Master Reg'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                            {st.father && <span>F: <strong className="text-slate-700 dark:text-slate-300">{st.father}</strong> | </span>}
                            <span>Class: <strong className="text-slate-700 dark:text-slate-300">{st.cls} ({st.stream})</strong></span>
                            {st.rollNo && <span> | Roll: <strong className="text-slate-700 dark:text-slate-300">{st.rollNo}</strong></span>}
                            {st.regNo && <span> | Reg: <strong className="text-slate-700 dark:text-slate-300">{st.regNo}</strong></span>}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9.5px] font-black shrink-0">
                        Select
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: TEMPLATE SELECTOR & PRESETS */}
          <div className="space-y-1 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[9.5px] uppercase font-black tracking-wider text-slate-500">
              <span className="flex items-center gap-1">
                <Sparkles size={11} className="text-amber-600" />
                <span>2. Certificate Template</span>
              </span>
              
              {/* Template Filter Pills */}
              <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[8.5px] font-bold">
                <button
                  type="button"
                  onClick={() => setTemplateFilterTab('all')}
                  className={`px-1.5 py-0.2 rounded cursor-pointer ${templateFilterTab === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black' : 'text-slate-500'}`}
                >
                  All ({allTemplatesList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateFilterTab('builtin')}
                  className={`px-1.5 py-0.2 rounded cursor-pointer ${templateFilterTab === 'builtin' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black' : 'text-slate-500'}`}
                >
                  Built-in ({BUILTIN_CERTIFICATE_TEMPLATES.length})
                </button>
                {customTemplates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTemplateFilterTab('custom')}
                    className={`px-1.5 py-0.2 rounded cursor-pointer ${templateFilterTab === 'custom' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black' : 'text-slate-500'}`}
                  >
                    Custom ({customTemplates.length})
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-36 overflow-y-auto p-0.5">
              {displayedTemplates.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                const isDefault = defaultTemplateId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all flex items-start justify-between gap-1 group ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 dark:border-teal-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-[10px] text-slate-900 dark:text-white truncate flex items-center gap-1">
                        {isSelected && <CheckCircle2 size={10} className="text-teal-600 dark:text-teal-400 shrink-0" />}
                        <span className="truncate">{tpl.name}</span>
                        {isDefault && (
                          <span className="px-1 py-0.2 rounded text-[7px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                            ⭐ Default
                          </span>
                        )}
                      </div>
                      <div className="text-[8.5px] text-slate-400 truncate mt-0.2">
                        {tpl.category}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={(e) => handleSetDefaultTemplate(tpl.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800 transition-opacity"
                          title="Set as default certificate template"
                        >
                          Set Default
                        </button>
                      )}
                      {tpl.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomTemplate(tpl.id, e)}
                          title="Delete custom template"
                          className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Direct In-Place Editing Helper Tip Card */}
          <div className="p-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-teal-950 dark:text-teal-200 text-xs space-y-1 mt-2">
            <div className="font-black text-[10.5px] flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
              <Sparkles size={12} className="text-teal-600 shrink-0" />
              <span>Direct In-Place Canvas Editing</span>
            </div>
            <p className="text-[9.5px] text-slate-600 dark:text-slate-400 leading-snug m-0">
              Click anywhere on the certificate canvas to edit the text directly in real-time. <strong>Right-click</strong> anywhere inside the body text to insert student details or placeholders at your cursor!
            </p>
          </div>

        </div>

        {/* ── DRAGGABLE VERTICAL SPLITTER HANDLE ── */}
        <div
          onMouseDown={handleSplitterMouseDown}
          title="Drag horizontally to adjust workspace split width (Double-click to reset)"
          onDoubleClick={() => {
            setLeftSplitPct(36);
            try { localStorage.setItem('hss_cert_split_pct', '36'); } catch {}
          }}
          className="hidden lg:flex flex-col items-center justify-center w-3.5 self-stretch cursor-col-resize hover:bg-teal-400/20 active:bg-teal-600/30 group transition-colors z-20 shrink-0 mx-0.5"
        >
          <div className={`w-1 rounded-full transition-all group-hover:w-1.5 group-hover:bg-teal-700 ${isDraggingSplitter ? 'bg-teal-700 w-1.5 h-full shadow-md' : 'bg-slate-300 dark:bg-slate-700 h-24'}`} />
        </div>

        {/* ════════ RIGHT HALF: STICKY LIVE A4 CERTIFICATE PREVIEW ════════ */}
        <div
          style={{ width: isDesktop ? `${100 - leftSplitPct}%` : '100%' }}
          className="w-full lg:flex-1 sticky top-3 self-start pl-0 lg:pl-1 min-w-0"
        >
          {/* Editor Mode Hint */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pb-1">
            <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
              <span>✍️ Click body text to edit directly • Right-click to insert student placeholders</span>
            </span>
            <span className="font-mono text-[9px] text-slate-400">A4 Portrait Standard</span>
          </div>

          {/* A4 Paper Sheet Canvas Container */}
          <div className="bg-white text-slate-900 border-2 border-[#800000] outline outline-1 outline-[#c5a059] rounded-xl p-4 sm:p-6 shadow-md max-h-[calc(100vh-95px)] overflow-y-auto relative flex flex-col justify-between min-h-[620px]">
            
            {/* Watermark Background */}
            {watermark && (
              <div
                className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center z-0"
                style={{
                  backgroundImage: `url('/logo192.png')`,
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '110px'
                }}
              />
            )}

            <div className="relative z-10 space-y-3">
              
              {/* Top Official Letterhead Header Banner (Matches Official Letterhead Writer) */}
              <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 p-4 sm:p-5 text-center bg-[#f0f8ff] border-b-[2.5px] border-[#800000] rounded-t-xl mb-3">
                <img
                  src="/logo192.png"
                  alt="School Seal"
                  style={{ width: '48px', height: '48px', maxWidth: '48px', maxHeight: '48px', objectFit: 'contain' }}
                  className="w-12 h-12 object-contain mx-auto mb-1.5 drop-shadow-xs"
                  onError={(e) => { e.target.src = '/logo.png'; e.target.onerror = null; }}
                />
                <h3 className="text-[11px] sm:text-xs font-black text-[#800000] uppercase tracking-[1.5px] m-0">
                  {officeTitle || 'OFFICE OF THE PRINCIPAL'}
                </h3>
                <h1 className="text-base sm:text-lg font-black text-[#0a192f] tracking-wide uppercase m-0 mt-0.5 font-serif">
                  {institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}
                </h1>
                <p className="text-[10px] text-slate-600 font-semibold m-0 mt-0.5">
                  {institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)'}
                </p>
              </div>

              {/* Ref & Date Row */}
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 border-b border-slate-300 pb-1 px-1">
                <div>Ref No: <span className="font-mono font-black">{refNo}</span></div>
                <div>Date: <span className="font-black">{dateStr}</span></div>
              </div>

              {/* Certificate Title Banner */}
              <div className="text-center py-1">
                <span className="inline-block font-serif text-xs sm:text-sm font-black uppercase text-[#800000] tracking-widest px-4 py-0.5 border-y-2 border-[#800000] bg-[#fff9f5]">
                  {certificateTitle}
                </span>
              </div>

              {/* Main Body with Direct Inline Editing & Context Menu */}
              <div className="flex items-start gap-4 relative">
                <div
                  ref={editorRef}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onInput={handleEditorInput}
                  onContextMenu={handleContextMenu}
                  className="flex-1 text-[11px] leading-relaxed text-justify font-serif text-slate-800 space-y-2 focus:outline-none p-1.5 rounded-lg border border-dashed border-teal-200 hover:border-teal-400 focus:border-teal-500 focus:bg-teal-50/15 transition-all cursor-text min-h-[140px]"
                  title="Click to edit text directly • Right-click anywhere to insert student details or placeholders"
                />

                {showPhoto && (
                  <div className="w-24 h-28 border border-[#800000] p-1 bg-white shadow-xs rounded flex flex-col items-center justify-center shrink-0 text-center">
                    {studentPhotoUrl ? (
                      <img src={studentPhotoUrl} alt={studentName} className="w-full h-full object-cover rounded" />
                    ) : (
                      <div className="text-[8px] font-bold text-slate-400 uppercase leading-tight">
                        Affix Student Photo
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Verification & Signatories */}
            <div className="relative z-10 pt-6 mt-4 border-t border-slate-200">
              <div className="flex items-end justify-between">
                
                {/* Signatory 1: Incharge Admissions */}
                <div className="w-36 text-center">
                  <div className="border-b-2 border-slate-800 mb-1"></div>
                  <div className="font-black text-[9.5px] uppercase tracking-tight">{signatories[0] || 'Incharge Admissions & Exam'}</div>
                  <div className="text-[8px] text-slate-500 font-bold">Govt. HSS Shangus</div>
                </div>

                {/* Signatory 2: Principal */}
                <div className="w-36 text-center">
                  <div className="border-b-2 border-slate-800 mb-1"></div>
                  <div className="font-black text-[9.5px] uppercase tracking-tight">{signatories[1] || 'Principal'}</div>
                  <div className="text-[8px] text-slate-500 font-bold">Govt. HSS Shangus</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ── Sleek Right-Click Placeholder & Formatting Context Menu ── */}
      {showContextMenu && (
        <div
          style={{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }}
          className="fixed z-[999999] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl p-1.5 w-64 space-y-1 text-xs animate-fadeIn divide-y divide-slate-100 dark:divide-slate-800 max-h-[72vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-2 py-1 flex items-center justify-between text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider">
            <span>Insert Student Field</span>
            <span className="text-[8.5px] text-slate-400 font-mono">1-Click</span>
          </div>

          {/* Group 1: Student & Parents */}
          <div className="pt-1 space-y-0.5">
            <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Student & Parents</div>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder(studentName ? studentName : '{STUDENT_NAME}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Student Name</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{studentName || '{STUDENT_NAME}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(fatherName ? fatherName : '{FATHER_NAME}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Father's Name</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{fatherName || '{FATHER_NAME}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(motherName ? motherName : '{MOTHER_NAME}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Mother's Name</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{motherName || '{MOTHER_NAME}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(gender === 'F' ? 'Ms.' : 'Mr.')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Gender Title</span>
              <span className="text-[9px] text-slate-400">{gender === 'F' ? 'Ms.' : 'Mr.'}</span>
            </button>
          </div>

          {/* Group 2: Academic & Registration */}
          <div className="pt-1 space-y-0.5">
            <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">Class & Roll / Reg</div>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder(className || '{CLASS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Class</span>
              <span className="text-[9px] text-slate-400">{className || '{CLASS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(stream || '{STREAM}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Stream</span>
              <span className="text-[9px] text-slate-400">{stream || '{STREAM}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(rollNo || '{ROLL_NO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Class Roll No</span>
              <span className="text-[9px] text-slate-400">{rollNo || '{ROLL_NO}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(regNo || '{REG_NO}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Registration No</span>
              <span className="text-[9px] text-slate-400">{regNo || '{REG_NO}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(session || '{SESSION}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Academic Session</span>
              <span className="text-[9px] text-slate-400">{session || '{SESSION}'}</span>
            </button>
          </div>

          {/* Group 3: DOB & Address */}
          <div className="pt-1 space-y-0.5">
            <div className="px-2 text-[8.5px] font-bold text-slate-400 uppercase">DOB & Record Dates</div>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder(parsedDob.figures || '{DOB_FIGURES}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>DOB (in Figures)</span>
              <span className="text-[9px] text-slate-400">{parsedDob.figures || '{DOB_FIGURES}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(parsedDob.words || '{DOB_WORDS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>DOB (in Words)</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{parsedDob.words || '{DOB_WORDS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(address || '{ADDRESS}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Permanent Address</span>
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{address || '{ADDRESS}'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInsertPlaceholder(dateStr || '{DATE}')}
              className="w-full px-2 py-1 rounded-md text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Certificate Date</span>
              <span className="text-[9px] text-slate-400">{dateStr || '{DATE}'}</span>
            </button>
          </div>

          {/* Group 4: Custom Dynamic Fields in Context Menu */}
          {customFields.length > 0 && (
            <div className="pt-1 space-y-0.5 border-t border-slate-100 dark:border-slate-800">
              <div className="px-2 text-[8.5px] font-bold text-amber-600 dark:text-amber-400 uppercase">Custom Fields</div>
              {customFields.map((cf) => (
                <button
                  key={cf.id}
                  type="button"
                  onClick={() => handleInsertPlaceholder(cf.value || `{${cf.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`)}
                  className="w-full px-2 py-1 rounded-md text-left hover:bg-amber-50 dark:hover:bg-amber-950/60 font-bold flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{cf.label}</span>
                  <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{cf.value || '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sub-Modal: Save Custom Template ── */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5 m-0">
                <BookmarkPlus size={15} className="text-emerald-600" />
                <span>Save Custom Certificate Template</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomTemplate} className="space-y-2 text-xs">
              <div>
                <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Template Name</label>
                <input
                  type="text"
                  required
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  placeholder="e.g. Merit Bonafide / Sports Character Certificate"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Category</label>
                <select
                  value={newTplCategory}
                  onChange={(e) => setNewTplCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                >
                  <option value="Bonafide & Age Certificates">Bonafide & Age Certificates</option>
                  <option value="Character & Conduct Certificates">Character & Conduct Certificates</option>
                  <option value="Admission & Enrollment">Admission & Enrollment</option>
                  <option value="Transfer & Migration">Transfer & Migration</option>
                  <option value="Sports & Extra-Curricular">Sports & Extra-Curricular</option>
                  <option value="Custom Certificates">Custom Certificates</option>
                </select>
              </div>

              {/* Set as Default Checkbox */}
              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={makeTemplateDefault}
                  onChange={(e) => setMakeTemplateDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer shrink-0"
                />
                <div className="text-xs">
                  <span className="font-black text-amber-950 dark:text-amber-200 block">⭐ Make Default Active Template</span>
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 block">Auto-loads on startup and saves directly to Firebase Cloud.</span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer shadow-md"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════ EDIT DYNAMIC FIELDS & TEMPORARY OVERRIDES MODAL ════════ */}
      {showFieldManagerModal && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[88vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black shrink-0">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2 m-0">
                    <span>Edit Dynamic Field Values</span>
                    <span className="text-[9.5px] px-2.5 py-0.5 rounded-full font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      Temporary Overrides
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">
                    Edits apply only to this certificate session. Database in Firebase will not be modified.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldManagerModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Standard Student Fields Grid */}
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                  <span>1. Standard Student Fields</span>
                </span>
                {selectedStudent && (
                  <button
                    type="button"
                    onClick={handleResetFieldsToStudent}
                    className="text-[9.5px] font-extrabold text-teal-600 hover:text-teal-800 dark:text-teal-400 flex items-center gap-1 cursor-pointer bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800"
                  >
                    <RefreshCw size={9} />
                    <span>Reset to Student Record</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Student Name</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => { setStudentName(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Father's Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => { setFatherName(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Mother's Name</label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => { setMotherName(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Class</label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => { setClassName(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Stream</label>
                  <input
                    type="text"
                    value={stream}
                    onChange={(e) => { setStream(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Class Roll No</label>
                  <input
                    type="text"
                    value={rollNo}
                    onChange={(e) => { setRollNo(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Registration No</label>
                  <input
                    type="text"
                    value={regNo}
                    onChange={(e) => { setRegNo(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={session}
                    onChange={(e) => { setSession(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => { setGender(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  >
                    <option value="M">Male (Mr. / He / Son)</option>
                    <option value="F">Female (Ms. / She / Daughter)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Date of Birth (DOB)</label>
                  <input
                    type="text"
                    value={dobRaw}
                    onChange={(e) => { setDobRaw(e.target.value); setCustomCanvasHtml(null); }}
                    placeholder="YYYY-MM-DD or DD/MM/YYYY"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Permanent Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setCustomCanvasHtml(null); }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-bold text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* DOB Words Live Result Pill */}
              <div className="p-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs flex items-center justify-between gap-2 mt-1.5">
                <span className="font-bold text-indigo-900 dark:text-indigo-200">
                  DOB in Words: <span className="font-black italic text-indigo-700 dark:text-indigo-300">{parsedDob.words}</span>
                </span>
                <span className="text-[10px] font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-700 font-bold shadow-2xs">
                  {parsedDob.figures}
                </span>
              </div>
            </div>

            {/* Custom Dynamic Fields Section (Add / Remove & Pick from Firestore) */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} />
                  <span>2. Custom & Firestore Database Fields</span>
                </div>
                <span className="text-[9.5px] font-bold text-slate-400">
                  {customFields.length} custom fields active
                </span>
              </div>

              {/* Firestore Standard Quick-Pick Badges */}
              <div className="p-3 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
                <div className="flex items-center justify-between text-[9px] font-black uppercase text-teal-800 dark:text-teal-300">
                  <span>Pick from Firestore Database Fields</span>
                  <span className="text-[8.5px] font-normal text-slate-500">Auto-filled from selected student record</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {FIRESTORE_PRESET_FIELDS.map((preset) => {
                    const studentVal = findValueInStudentRaw(selectedStudent, preset.keys);
                    const isAdded = customFields.some(f => f.label.toLowerCase() === preset.label.toLowerCase());

                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handlePickFirestoreField(preset.label, studentVal)}
                        className={`px-2.5 py-1 rounded-lg text-[9.5px] font-bold border flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                          isAdded
                            ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-teal-100/60 dark:hover:bg-teal-950/80 hover:border-teal-400'
                        }`}
                        title={studentVal ? `Value: ${studentVal}` : 'Click to add field'}
                      >
                        <span>{isAdded ? '✓' : '➕'} {preset.label}</span>
                        {studentVal && (
                          <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-mono truncate max-w-[90px] ${
                            isAdded ? 'bg-teal-800 text-teal-100' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {studentVal}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Extra Raw Firestore Fields Dropdown */}
                {availableRawFirestoreFields.length > 0 && (
                  <div className="pt-2 flex items-center gap-2 border-t border-teal-200/50 dark:border-teal-800/40">
                    <span className="text-[9px] font-extrabold text-slate-500 whitespace-nowrap">More from Firestore Doc:</span>
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const item = availableRawFirestoreFields.find(f => f.key === e.target.value);
                        if (item) handlePickFirestoreField(item.label, item.value);
                        e.target.value = '';
                      }}
                      defaultValue=""
                      className="flex-1 px-2.5 py-1 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 font-bold text-xs text-teal-900 dark:text-teal-200"
                    >
                      <option value="" disabled>-- Select raw Firestore attribute --</option>
                      {availableRawFirestoreFields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}: {f.value}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* List of Currently Active Custom Fields */}
              {customFields.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="px-1 text-[8.5px] font-black uppercase text-slate-400 tracking-wider">
                    Active Custom & Firestore Fields (Editable)
                  </div>
                  {customFields.map((cf) => {
                    const tokenName = `{${cf.label.toUpperCase().replace(/[^A-Z0-9]/g, '_')}}`;
                    return (
                      <div key={cf.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <div className="w-1/3">
                          <input
                            type="text"
                            value={cf.label}
                            onChange={(e) => handleUpdateCustomField(cf.id, 'label', e.target.value)}
                            placeholder="Field Label"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                          />
                          <span className="text-[8px] font-mono text-slate-400 block truncate mt-0.5">{tokenName}</span>
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={cf.value}
                            onChange={(e) => handleUpdateCustomField(cf.id, 'value', e.target.value)}
                            placeholder="Field Value (e.g. 1234567890)"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomField(cf.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                          title="Remove this custom field"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Manual Custom Field Entry Form */}
              <form onSubmit={handleAddCustomField} className="flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <input
                  type="text"
                  value={newCustomFieldName}
                  onChange={(e) => setNewCustomFieldName(e.target.value)}
                  placeholder="Or type custom field name (e.g. Conduct Grade, Sports)"
                  className="w-1/2 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={newCustomFieldValue}
                  onChange={(e) => setNewCustomFieldValue(e.target.value)}
                  placeholder="Value (e.g. Outstanding)"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!newCustomFieldName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-sm cursor-pointer disabled:opacity-50 shrink-0 transition-all"
                >
                  ➕ Add
                </button>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowFieldManagerModal(false)}
                className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-black text-xs cursor-pointer shadow-md transition-all"
              >
                ✓ Apply Overrides & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
