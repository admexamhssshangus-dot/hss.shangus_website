import React, { useState, useMemo, useCallback } from 'react';
import { 
  GitMerge, Search, Filter, Hash, CheckSquare, Square, RefreshCw, 
  AlertCircle, CheckCircle2, ArrowRight, UserCheck, ShieldCheck, 
  Trash2, Sparkles, Layers, Info, Check, X, ChevronDown, ChevronRight,
  Eye, Sliders, ArrowLeftRight, Database, Save, RotateCcw
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { moveToRecycleBin } from '../../services/recycleBinService';
import { updateCachedItem, invalidateCache, normalizeRegNoKey, resolveStudentPhoto, getCachedCollectionSync, getCachedCollection } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';

export default function ApplicationMergerStudio({ applications = [], onRefresh, onClose }) {
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedSession, setSelectedSession] = useState('All');
  const [selectedStream, setSelectedStream] = useState('All');
  const [selectedSource, setSelectedSource] = useState('All'); // 'All' | 'admin' | 'online'
  const [selectedStatus, setSelectedStatus] = useState('All'); // 'All' | 'Submitted' | 'Verified' | 'Provisional'
  const [viewMode, setViewMode] = useState('duplicates'); // 'duplicates' | 'all' | 'single'
  const [matchingCriteria, setMatchingCriteria] = useState('auto'); // 'auto' | 'boardRegNo' | 'nameParentage' | 'formNo'
  const [searchQuery, setSearchQuery] = useState('');
  const [defaultPrecedence, setDefaultPrecedence] = useState('admin'); // 'admin' | 'student'

  const [loadedApps, setLoadedApps] = useState(() => {
    return applications && applications.length > 0 ? applications : (getCachedCollectionSync('admissions') || []);
  });
  const [loadingDb, setLoadingDb] = useState(false);

  const [selectedGroupKeys, setSelectedGroupKeys] = useState(new Set());
  const [customFieldOverrides, setCustomFieldOverrides] = useState({}); // { groupKey: { fieldName: 'admin' | 'student' } }
  const [expandedGroupKeys, setExpandedGroupKeys] = useState(new Set());
  const [previewStudentModal, setPreviewStudentModal] = useState(null); // For inspecting single full record

  const [merging, setMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState('');
  const [alert, setAlert] = useState(null);

  // Sync loadedApps if applications prop changes or when database cache updates
  React.useEffect(() => {
    if (applications && applications.length > 0) {
      setLoadedApps(applications);
    }
  }, [applications]);

  // Real-time listener for database sync & collection updates
  React.useEffect(() => {
    const handleLiveUpdate = () => {
      const fresh = getCachedCollectionSync('admissions');
      if (fresh && fresh.length > 0) {
        setLoadedApps(fresh);
      }
    };
    window.addEventListener('hss-sync-complete', handleLiveUpdate);
    window.addEventListener('hss-db-cache-updated', handleLiveUpdate);
    window.addEventListener('hss-admissions-updated', handleLiveUpdate);
    return () => {
      window.removeEventListener('hss-sync-complete', handleLiveUpdate);
      window.removeEventListener('hss-db-cache-updated', handleLiveUpdate);
      window.removeEventListener('hss-admissions-updated', handleLiveUpdate);
    };
  }, []);

  // Direct fetch from live database
  const handleFetchFromDb = async () => {
    setLoadingDb(true);
    setAlert(null);
    try {
      const fresh = await getCachedCollection('admissions', true);
      if (fresh && Array.isArray(fresh)) {
        setLoadedApps(fresh);
        setAlert({ type: 'success', text: `⚡ Successfully fetched ${fresh.length} total applications from Firestore database!` });
      }
      if (onRefresh) onRefresh(true);
    } catch (e) {
      console.error('Error fetching database:', e);
      setAlert({ type: 'error', text: 'Error fetching database: ' + e.message });
    } finally {
      setLoadingDb(false);
    }
  };

  // Effective applications fallback
  const effectiveApps = useMemo(() => {
    if (loadedApps && loadedApps.length > 0) return loadedApps;
    if (applications && applications.length > 0) return applications;
    return getCachedCollectionSync('admissions') || [];
  }, [loadedApps, applications]);

  // Robust universal field extractors
  const extractRegNo = useCallback((st) => {
    if (!st) return '';
    const raw = st['Board Registration Number'] ||
      st['Board Registration No.'] ||
      st['Board Registration No. (Class 10th)'] ||
      st['Board Registration No. (Class 11th)'] ||
      st['Board Registration No. (Class 12th)'] ||
      st['Board Reg. No.'] ||
      st['Board Reg No'] ||
      st['REG. NO.'] ||
      st['Registration No.'] ||
      st['Registration No'] ||
      st['Reg No.'] ||
      st['Reg. No.'] ||
      st['Registration Number'] ||
      st.boardRegNo ||
      st.regNo ||
      st.boardRegistrationNumber ||
      st.registrationNo ||
      '';
    return normalizeRegNoKey(raw);
  }, []);

  const extractStudentName = useCallback((st) => {
    if (!st) return 'Student';
    return String(
      st["Student's Name (as per school records)"] ||
      st["Student's Name"] ||
      st['Student Name'] ||
      st['Account Name'] ||
      st['Name'] ||
      st.studentName ||
      st.name ||
      'Student'
    ).trim();
  }, []);

  const extractFatherName = useCallback((st) => {
    if (!st) return '—';
    return String(
      st["Father's/Guardian's Name (as per school records)"] ||
      st["Father's Name"] ||
      st["Father Name"] ||
      st['Father'] ||
      st.fatherName ||
      st.father ||
      '—'
    ).trim();
  }, []);

  const extractMotherName = useCallback((st) => {
    if (!st) return '—';
    return String(
      st["Mother's Name (as per school records)"] ||
      st["Mother's Name"] ||
      st["Mother Name"] ||
      st['Mother'] ||
      st.motherName ||
      st.mother ||
      '—'
    ).trim();
  }, []);

  const extractFormNo = useCallback((st) => {
    if (!st) return '—';
    const raw = String(st['Form Number'] || st['Form No.'] || st['Form No'] || st.formNo || st.id || st.docId || '—').replace(/^#/, '').trim();
    return raw || '—';
  }, []);

  const extractClassRoll = useCallback((st) => {
    if (!st) return '—';
    const raw = String(
      st['Class Roll No'] ||
      st['Class Roll No.'] ||
      st['RL. NO.'] ||
      st['RL. NO'] ||
      st['Class R.No.'] ||
      st['Roll No'] ||
      st['Roll No.'] ||
      st.classRollNo ||
      st.rollNo ||
      ''
    ).trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  const extractAdmNo = useCallback((st) => {
    if (!st) return '—';
    const raw = String(st['Admission Number'] || st['Admission No.'] || st['Adm. No.'] || st['Adm No'] || st.admNo || '').trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  const extractDob = useCallback((st) => {
    if (!st) return '—';
    const raw = String(
      st['Date of Birth (as per school records)'] ||
      st['Date of Birth'] ||
      st['DoB (as per school records)'] ||
      st['DoB (figures)'] ||
      st['DoB'] ||
      st['DOB'] ||
      st.dob ||
      ''
    ).trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  const extractVillage = useCallback((st) => {
    if (!st) return '—';
    const raw = String(
      st['Village / Town'] ||
      st['Village/Town'] ||
      st['Name of your village'] ||
      st['Village'] ||
      st['Residence (Village, District)'] ||
      st['Address'] ||
      st.village ||
      ''
    ).trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  const extractMobile = useCallback((st) => {
    if (!st) return '—';
    const raw = String(
      st['Mobile No. (with working WhatsApp)'] ||
      st['Mobile No.'] ||
      st["Student's Contact"] ||
      st['Account Mobile'] ||
      st['Mobile'] ||
      st['Phone'] ||
      st.mobile ||
      ''
    ).trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  const extractParentMobile = useCallback((st) => {
    if (!st) return '—';
    const raw = String(
      st["Parent's Contact"] ||
      st["Parent's Mobile No. (must be working)"] ||
      st["Parent's Mobile No."] ||
      st["Father's Mobile No."] ||
      st.parentContact ||
      st.parentMobile ||
      ''
    ).trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  const extractAadhaar = useCallback((st) => {
    if (!st) return '—';
    const raw = String(
      st['Aadhaar Number (12 Digits)'] ||
      st['Aadhaar Number'] ||
      st['Aadhar No.'] ||
      st['Aadhar'] ||
      st['Aadhaar'] ||
      st.aadhar ||
      st.aadhaar ||
      ''
    ).trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  const extractPen = useCallback((st) => {
    if (!st) return '—';
    const raw = String(
      st['Permanent Education Number (PEN)'] ||
      st['PEN No.'] ||
      st['PEN'] ||
      st.penNo ||
      st.pen ||
      ''
    ).trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  const extractSubjects = useCallback((st) => {
    if (!st) return '—';
    const raw = String(
      st['Subjects'] ||
      st['Subjects1'] ||
      st['Subject Choice'] ||
      st.subs ||
      st.subjects ||
      ''
    ).trim();
    return raw && raw !== 'N/A' && raw !== 'null' ? raw : '—';
  }, []);

  // Robust class matcher for flexible naming (e.g. '10', '10th', 'Class 10', 'Class 10th', 'X')
  const matchesClass = useCallback((st, targetClass) => {
    if (!targetClass || targetClass === 'All') return true;
    const cls = String(st['Admission sought for class'] || st['Class'] || st.class || st.className || '').trim().toLowerCase();
    const sel = String(targetClass).trim().toLowerCase();
    if (sel.includes('10')) return cls.includes('10') || cls === 'x' || cls === 'class x';
    if (sel.includes('11')) return cls.includes('11') || cls === 'xi' || cls === 'class xi';
    if (sel.includes('12')) return cls.includes('12') || cls === 'xii' || cls === 'class xii';
    if (sel.includes('9')) return cls.includes('9') || cls === 'ix' || cls === 'class ix';
    return cls.includes(sel);
  }, []);

  // Helper to extract clean Class
  const extractClass = useCallback((st) => {
    if (!st) return '10th';
    const raw = String(st['Admission sought for class'] || st['Class'] || st.class || st.className || '').trim().toLowerCase();
    if (raw.includes('10')) return '10th';
    if (raw.includes('11')) return '11th';
    if (raw.includes('12')) return '12th';
    if (raw.includes('9')) return '9th';
    return raw || '10th';
  }, []);

  // Helper to extract clean Session
  const extractSession = useCallback((st) => {
    if (!st) return '2025-26';
    const raw = String(st['Session'] || st['session'] || '').trim();
    if (!raw || raw === '—' || raw === 'N/A') return '2025-26';
    if (raw.includes('2025') && raw.includes('26')) return '2025-26';
    if (raw.includes('2024') && raw.includes('25')) return '2024-25';
    return raw;
  }, []);

  // Helper to extract Stream
  const extractStream = useCallback((st) => {
    if (!st) return 'General';
    const raw = String(st['Stream for Class 11th'] || st['Stream'] || st.stream || '').trim();
    if (!raw || raw === '—' || raw === 'N/A') return 'General';
    const lower = raw.toLowerCase();
    if (lower.includes('non-med') || lower.includes('non med') || lower.includes('nm')) return 'Non-Medical';
    if (lower.includes('med')) return 'Medical';
    if (lower.includes('art') || lower.includes('humanit')) return 'Arts';
    if (lower.includes('com')) return 'Commerce';
    return raw;
  }, []);

  // Helper to identify source (Online student portal form vs Admin bulk register import)
  const isOnlineSubmission = useCallback((st) => {
    if (!st) return false;
    const hasOwnerUid = Boolean(st.ownerUid || st.photo_id || st.submittedAt || st['Online Subm. Date'] || st.onlineSubmDate);
    const hasPhoto = Boolean(st['Student Photo'] && String(st['Student Photo']).length > 30);
    const hasRichStudentData = Boolean(
      (st['Date of Birth (as per school records)'] || st['DoB (as per school records)']) &&
      (st['Village / Town'] || st['Name of your village']) &&
      (st['Mobile No. (with working WhatsApp)'] || st['Mobile No.'])
    );
    const hasOnlineFormPrefix = String(st['Form Number'] || st.id || '').startsWith('2500') || String(st.id || '').startsWith('adm_2500');
    return hasOwnerUid || hasPhoto || hasRichStudentData || hasOnlineFormPrefix;
  }, []);

  // Dynamically extract all unique sessions from actual records with real-time counts
  const availableSessions = useMemo(() => {
    const counts = {};
    effectiveApps.forEach(st => {
      if (!st || st.Status === 'Deleted' || st.status === 'Deleted' || st._deleted === true) return;
      const s = extractSession(st);
      if (s) {
        counts[s] = (counts[s] || 0) + 1;
      }
    });
    const list = Object.entries(counts).map(([session, count]) => ({ session, count }));
    list.sort((a, b) => b.session.localeCompare(a.session));
    return list;
  }, [effectiveApps, extractSession]);

  // Dynamically extract available streams from database records
  const availableStreams = useMemo(() => {
    const streamCounts = {};
    effectiveApps.forEach(st => {
      if (!st || st.Status === 'Deleted' || st.status === 'Deleted' || st._deleted === true) return;
      if (selectedSession !== 'All' && extractSession(st) !== selectedSession) return;
      if (!matchesClass(st, selectedClass)) return;
      const stm = extractStream(st);
      if (stm) streamCounts[stm] = (streamCounts[stm] || 0) + 1;
    });
    return Object.entries(streamCounts).map(([stream, count]) => ({ stream, count }));
  }, [effectiveApps, selectedSession, selectedClass, extractSession, matchesClass, extractStream]);

  // Dynamically extract all available statuses directly from database records with live counts
  const availableStatuses = useMemo(() => {
    const counts = {};
    effectiveApps.forEach(st => {
      if (!st || st.Status === 'Deleted' || st.status === 'Deleted' || st._deleted === true) return;
      if (selectedSession !== 'All' && extractSession(st) !== selectedSession) return;
      if (!matchesClass(st, selectedClass)) return;
      const stat = String(st.Status || st.status || 'Submitted').trim();
      if (stat) counts[stat] = (counts[stat] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [effectiveApps, selectedSession, selectedClass, extractSession, matchesClass]);

  // Dynamically extract source counts from database records
  const sourceCounts = useMemo(() => {
    let admin = 0;
    let online = 0;
    effectiveApps.forEach(st => {
      if (!st || st.Status === 'Deleted' || st.status === 'Deleted' || st._deleted === true) return;
      if (selectedSession !== 'All' && extractSession(st) !== selectedSession) return;
      if (!matchesClass(st, selectedClass)) return;
      if (isOnlineSubmission(st)) online++;
      else admin++;
    });
    return { admin, online, total: admin + online };
  }, [effectiveApps, selectedSession, selectedClass, extractSession, matchesClass, isOnlineSubmission]);

  // Real-time Class Counts filtered by active selectedSession
  const availableClasses = useMemo(() => {
    const counts = {};
    effectiveApps.forEach(st => {
      if (!st || st.Status === 'Deleted' || st.status === 'Deleted' || st._deleted === true) return;
      const s = extractSession(st);
      if (selectedSession !== 'All' && s !== selectedSession) return;
      const c = extractClass(st);
      if (c) {
        counts[c] = (counts[c] || 0) + 1;
      }
    });
    const stdOrder = ['10th', '11th', '12th', '9th'];
    const keys = Object.keys(counts);
    const allKeys = Array.from(new Set([...stdOrder, ...keys]));
    const sorted = allKeys.sort((a, b) => {
      const idxA = stdOrder.indexOf(a);
      const idxB = stdOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return sorted.map(cls => ({ cls, count: counts[cls] || 0 }));
  }, [effectiveApps, selectedSession, extractClass, extractSession]);

  // Real-time total for active selectedSession
  const sessionFilteredTotal = useMemo(() => {
    return effectiveApps.filter(st => {
      if (!st || st.Status === 'Deleted' || st.status === 'Deleted' || st._deleted === true) return false;
      if (selectedSession !== 'All' && extractSession(st) !== selectedSession) return false;
      return true;
    }).length;
  }, [effectiveApps, selectedSession, extractSession]);

  // Name & parentage compatibility validator to prevent dummy/shared reg numbers from grouping different students
  const areNamesCompatible = useCallback((stA, stB) => {
    if (!stA || !stB) return false;
    const nameA = extractStudentName(stA).toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const nameB = extractStudentName(stB).toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    if (!nameA || !nameB || nameA === 'student' || nameB === 'student') return true;
    if (nameA === nameB) return true;

    const fatherA = extractFatherName(stA).toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const fatherB = extractFatherName(stB).toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    if (fatherA && fatherB && fatherA !== '—' && fatherB !== '—' && fatherA === fatherB) return true;

    const tokensA = nameA.split(/\s+/).filter(t => t.length >= 2);
    const tokensB = nameB.split(/\s+/).filter(t => t.length >= 2);
    if (tokensA.length > 0 && tokensB.length > 0) {
      return tokensA.some(t => tokensB.includes(t));
    }
    return true;
  }, [extractStudentName, extractFatherName]);

  // Union-Find / Multi-Key Connected Components Clustering Algorithm (Strictly Scoped by Session & Class)
  const buildDuplicateClusters = useCallback((recordsList, filterClass, filterSession) => {
    const validRecords = recordsList.filter(st => {
      if (!st || st.Status === 'Deleted' || st.status === 'Deleted' || st._deleted === true) return false;
      if (filterClass && filterClass !== 'All' && !matchesClass(st, filterClass)) return false;
      if (filterSession && filterSession !== 'All' && extractSession(st) !== filterSession) return false;
      return true;
    });

    const parent = new Map();
    const find = (id) => {
      if (!parent.has(id)) parent.set(id, id);
      if (parent.get(id) === id) return id;
      const root = find(parent.get(id));
      parent.set(id, root);
      return root;
    };
    const union = (idA, idB) => {
      const rootA = find(idA);
      const rootB = find(idB);
      if (rootA !== rootB) parent.set(rootA, rootB);
    };

    const keyToRecordIdx = new Map();

    validRecords.forEach((st, idx) => {
      const stClass = extractClass(st);
      const stSession = extractSession(st);
      const reg = extractRegNo(st);
      const name = extractStudentName(st).toLowerCase().replace(/[^a-z]/g, '');
      const father = extractFatherName(st).toLowerCase().replace(/[^a-z]/g, '');
      const fNo = extractFormNo(st);
      const aadhaar = extractAadhaar(st).replace(/[^0-9]/g, '');

      // Scope prefix: Class + Session to ensure previous academic years/classes are NEVER merged or modified
      const scopePrefix = `${stSession}_${stClass}`;

      const keys = [];
      if (matchingCriteria === 'boardRegNo') {
        if (reg && reg !== '—' && reg.length >= 5) keys.push(`reg_${scopePrefix}_${reg}`);
      } else if (matchingCriteria === 'nameParentage') {
        if (name && name.length >= 3) keys.push(`np_${scopePrefix}_${name}_${father.slice(0, 5)}`);
      } else if (matchingCriteria === 'formNo') {
        if (fNo && fNo !== '—' && fNo !== 'N/A') keys.push(`form_${scopePrefix}_${fNo}`);
      } else {
        // Smart Auto Match: Link on Board Reg No, Name + Father, Aadhaar, and Form Number strictly within same Class and Session
        if (reg && reg !== '—' && reg.length >= 5) keys.push(`reg_${scopePrefix}_${reg}`);
        if (name && name.length >= 3 && father && father.length >= 2) keys.push(`np_${scopePrefix}_${name}_${father.slice(0, 5)}`);
        if (aadhaar && aadhaar.length >= 10) keys.push(`adh_${scopePrefix}_${aadhaar}`);
        if (fNo && fNo !== '—' && fNo !== 'N/A' && fNo.length >= 4) keys.push(`form_${scopePrefix}_${fNo}`);
      }

      keys.forEach(k => {
        if (keyToRecordIdx.has(k)) {
          const existingIdx = keyToRecordIdx.get(k);
          const existingRecord = validRecords[existingIdx];
          // SAFETY GUARD: Verify name compatibility before grouping to prevent dummy/placeholder reg numbers from linking different students
          if (areNamesCompatible(st, existingRecord)) {
            union(idx, existingIdx);
          }
        } else {
          keyToRecordIdx.set(k, idx);
        }
      });
    });

    const clusterGroups = new Map();
    validRecords.forEach((st, idx) => {
      const root = find(idx);
      if (!clusterGroups.has(root)) clusterGroups.set(root, []);
      clusterGroups.get(root).push(st);
    });

    const clusters = [];
    clusterGroups.forEach((records, rootIdx) => {
      if (records.length >= 2) {
        // Verify all records in cluster have compatible names and share exact same class and session
        const allNamesMatch = records.every((r, i) => i === 0 || areNamesCompatible(records[0], r));
        if (!allNamesMatch) return; // Drop invalid groupings

        // Classify records into Online Student Submission vs Admin Bulk Upload
        const onlineApp = records.find(r => isOnlineSubmission(r)) || records[0];
        const adminApp = records.find(r => r !== onlineApp) || records[1] || records[0];
        const primaryStudentName = extractStudentName(adminApp) !== 'Student' ? extractStudentName(adminApp) : extractStudentName(onlineApp);
        const primaryRegNo = extractRegNo(adminApp) || extractRegNo(onlineApp) || '—';
        const primaryClass = extractClass(adminApp) || extractClass(onlineApp);
        const primarySession = extractSession(adminApp) || extractSession(onlineApp);
        const groupKey = `cluster_${rootIdx}_${extractFormNo(adminApp)}_${extractFormNo(onlineApp)}`;

        clusters.push({
          groupKey,
          records,
          onlineApp,
          adminApp,
          studentName: primaryStudentName,
          regNo: primaryRegNo,
          class: primaryClass,
          session: primarySession
        });
      }
    });

    return clusters;
  }, [matchingCriteria, matchesClass, extractClass, extractSession, extractRegNo, extractStudentName, extractFatherName, extractFormNo, extractAadhaar, isOnlineSubmission, areNamesCompatible]);

  // Real-time duplicate cluster counts per class for active session
  const duplicatesByClass = useMemo(() => {
    const dupCounts = {};
    const stdClasses = ['10th', '11th', '12th', '9th'];
    stdClasses.forEach(cls => {
      const clusters = buildDuplicateClusters(effectiveApps, cls, selectedSession);
      dupCounts[cls] = clusters.length;
    });
    return dupCounts;
  }, [effectiveApps, selectedSession, buildDuplicateClusters]);

  // Global Map of all detected duplicate record IDs
  const duplicateKeysSet = useMemo(() => {
    const set = new Set();
    const clusters = buildDuplicateClusters(effectiveApps, 'All', 'All');
    clusters.forEach(({ records }) => {
      records.forEach(r => {
        const id = r.id || r.docId || r['Form Number'] || r.formNo;
        if (id) set.add(String(id));
      });
    });
    return set;
  }, [effectiveApps, buildDuplicateClusters]);

  // Filtered list of ALL applications for the comprehensive "All Records" preview mode
  const filteredAllApps = useMemo(() => {
    return effectiveApps.filter(st => {
      if (!st || st.Status === 'Deleted' || st.status === 'Deleted' || st._deleted === true) return false;

      // Class Filter
      if (!matchesClass(st, selectedClass)) return false;

      // Session Filter
      if (selectedSession !== 'All' && extractSession(st) !== selectedSession) return false;

      // Stream Filter
      if (selectedStream !== 'All' && extractStream(st).toLowerCase() !== selectedStream.toLowerCase()) return false;

      // Source Filter
      if (selectedSource === 'admin' && isOnlineSubmission(st)) return false;
      if (selectedSource === 'online' && !isOnlineSubmission(st)) return false;

      // Status Filter
      if (selectedStatus !== 'All') {
        const stat = String(st.Status || st.status || 'Submitted').trim().toLowerCase();
        if (!stat.includes(selectedStatus.toLowerCase())) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sName = extractStudentName(st).toLowerCase();
        const sFather = extractFatherName(st).toLowerCase();
        const sMother = extractMotherName(st).toLowerCase();
        const sForm = extractFormNo(st).toLowerCase();
        const sRoll = extractClassRoll(st).toLowerCase();
        const sMobile = extractMobile(st).toLowerCase();
        const sReg = extractRegNo(st).toLowerCase();
        const sAdm = extractAdmNo(st).toLowerCase();
        const sVill = extractVillage(st).toLowerCase();
        const sAadhaar = extractAadhaar(st).toLowerCase();

        return (
          sName.includes(q) ||
          sFather.includes(q) ||
          sMother.includes(q) ||
          sForm.includes(q) ||
          sRoll.includes(q) ||
          sMobile.includes(q) ||
          sReg.includes(q) ||
          sAdm.includes(q) ||
          sVill.includes(q) ||
          sAadhaar.includes(q)
        );
      }

      return true;
    });
  }, [effectiveApps, selectedClass, selectedSession, selectedStream, selectedSource, selectedStatus, searchQuery, matchesClass, extractSession, extractStream, isOnlineSubmission, extractStudentName, extractFatherName, extractMotherName, extractFormNo, extractClassRoll, extractMobile, extractRegNo, extractAdmNo, extractVillage, extractAadhaar]);

  // Scan and Group Duplicate Applications for the current view
  const duplicateClusters = useMemo(() => {
    const rawClusters = buildDuplicateClusters(effectiveApps, selectedClass, selectedSession);

    if (!searchQuery.trim()) return rawClusters;

    const q = searchQuery.toLowerCase().trim();
    return rawClusters.filter(cluster => {
      return cluster.records.some(r => {
        const sName = extractStudentName(r).toLowerCase();
        const sFather = extractFatherName(r).toLowerCase();
        const sForm = extractFormNo(r).toLowerCase();
        const sReg = extractRegNo(r).toLowerCase();
        const sMobile = extractMobile(r).toLowerCase();
        return sName.includes(q) || sFather.includes(q) || sForm.includes(q) || sReg.includes(q) || sMobile.includes(q);
      });
    });
  }, [effectiveApps, selectedClass, selectedSession, searchQuery, buildDuplicateClusters, extractStudentName, extractFatherName, extractFormNo, extractRegNo, extractMobile]);

  // Auto-select all detected duplicate clusters by default
  const handleSelectAll = () => {
    if (selectedGroupKeys.size === duplicateClusters.length) {
      setSelectedGroupKeys(new Set());
    } else {
      setSelectedGroupKeys(new Set(duplicateClusters.map(c => c.groupKey)));
    }
  };

  const toggleSelectGroup = (key) => {
    const next = new Set(selectedGroupKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedGroupKeys(next);
  };

  const toggleExpandGroup = (key) => {
    const next = new Set(expandedGroupKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroupKeys(next);
  };

  // Toggle field-level source preference for a specific group
  const setFieldOverride = (groupKey, fieldKey, source) => {
    setCustomFieldOverrides(prev => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] || {}),
        [fieldKey]: source
      }
    }));
  };

  // Compute live preview of merged application for a group
  const getMergedPreview = useCallback((cluster) => {
    const { groupKey, onlineApp, adminApp, records } = cluster;
    const overrides = customFieldOverrides[groupKey] || {};

    // Base: start with online app
    const merged = { ...onlineApp };

    // Merge in all non-empty fields from all records in cluster
    records.forEach(r => {
      Object.keys(r).forEach(k => {
        const val = r[k];
        const isEmpty = val === undefined || val === null || val === '' || val === '—' || val === 'N/A' || val === 'null';
        const currVal = merged[k];
        const currIsEmpty = currVal === undefined || currVal === null || currVal === '' || currVal === '—' || currVal === 'N/A' || currVal === 'null';

        if (!isEmpty && currIsEmpty) {
          merged[k] = val;
        }
      });
    });

    // Apply Admin Verified fields by default (or custom precedence)
    const adminFields = [
      'Form Number', 'FormNo', 'formNo',
      'Class Roll No', 'Class Roll No.', 'classRollNo',
      'Admission Number', 'admNo',
      'Stream for Class 11th', 'Stream opted in Class 11th', 'Stream', 'stream',
      'Board Registration Number', 'Board Registration No.', 'Board Registration No. (Class 10th)',
      'Status', 'status'
    ];

    adminFields.forEach(fKey => {
      const fieldSource = overrides[fKey] || defaultPrecedence;
      const chosenRecord = fieldSource === 'admin' ? adminApp : onlineApp;
      const val = chosenRecord[fKey];
      if (val !== undefined && val !== null && val !== '' && val !== '—' && val !== 'N/A') {
        merged[fKey] = val;
      }
    });

    // Ensure photo is resolved properly
    const photo = resolveStudentPhoto(onlineApp) || resolveStudentPhoto(adminApp) || resolveStudentPhoto(merged);
    if (photo) {
      merged['Student Photo'] = photo;
      merged.photo_id = photo;
      merged.photoUrl = photo;
    }

    // Determine target primary docId & secondary docIds to remove
    const targetDocId = String(adminApp.id || adminApp.docId || adminApp['Form Number'] || onlineApp.id || onlineApp.docId || onlineApp['Form Number'] || '').trim();
    const secondaryRecords = records.filter(r => String(r.id || r.docId) !== targetDocId);

    return { merged, targetDocId, secondaryRecords };
  }, [customFieldOverrides, defaultPrecedence]);

  const cancelMergeRef = React.useRef(false);

  // Merge a Single Student Cluster Individually with Admin Confirmation
  const handleMergeSingleCluster = async (cluster) => {
    if (!cluster) return;
    setMerging(true);
    setMergeProgress(`Merging student ${cluster.studentName} in Class ${cluster.class} (${cluster.session})...`);
    setAlert(null);

    try {
      const { merged, targetDocId, secondaryRecords } = getMergedPreview(cluster);
      if (!targetDocId) throw new Error('Target document ID not found.');

      // 1. Write consolidated payload strictly for this class and session
      const cleanPayload = {
        ...merged,
        id: targetDocId,
        docId: targetDocId,
        _mergedAt: new Date().toISOString(),
        _mergedFrom: secondaryRecords.map(r => r.id || r.docId || r['Form Number']),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'admissions', targetDocId), cleanPayload, { merge: true });
      updateCachedItem('admissions', targetDocId, cleanPayload);

      // 2. Clean secondary duplicate records
      for (const sec of secondaryRecords) {
        const secId = String(sec.id || sec.docId || '').trim();
        if (secId && secId !== targetDocId) {
          await moveToRecycleBin(sec, 'admissions', 'Admin').catch(() => {});
          await deleteDoc(doc(db, 'admissions', secId)).catch(() => {});
          updateCachedItem('admissions', secId, null);
        }
      }

      await logAdminActivity({
        actionType: 'update',
        actionTitle: 'Consolidated Student Duplicate Application',
        details: `Successfully merged and consolidated applications for ${cluster.studentName} in Class ${cluster.class} (${cluster.session}).`,
        reasonCategory: 'Data Deduplication & Merge',
        metadata: { studentName: cluster.studentName, class: cluster.class, session: cluster.session, targetDocId }
      }).catch(() => {});

      invalidateCache('admissions');

      setAlert({
        type: 'success',
        text: `🎉 Successfully merged applications for ${cluster.studentName} (Class ${cluster.class} • ${cluster.session})!`
      });

      setSelectedGroupKeys(prev => {
        const next = new Set(prev);
        next.delete(cluster.groupKey);
        return next;
      });

      if (onRefresh) onRefresh(true);
    } catch (err) {
      console.error('Single merge error:', err);
      setAlert({ type: 'error', text: 'Merge failed: ' + err.message });
    } finally {
      setMerging(false);
      setMergeProgress('');
    }
  };

  // Execute Batch Database Merge with Cancellation Support
  const handleExecuteMerge = async () => {
    const clustersToMerge = duplicateClusters.filter(c => selectedGroupKeys.has(c.groupKey));

    if (clustersToMerge.length === 0) {
      setAlert({ type: 'error', text: 'Please select at least 1 student group to merge.' });
      return;
    }

    cancelMergeRef.current = false;
    setMerging(true);
    setMergeProgress(`Preparing database merge batch for ${clustersToMerge.length} group(s)...`);
    setAlert(null);

    try {
      let mergedCount = 0;
      let cleanedCount = 0;

      for (let i = 0; i < clustersToMerge.length; i++) {
        if (cancelMergeRef.current) {
          setAlert({
            type: 'info',
            text: `🛑 Database merge cancelled by user. (${mergedCount} merged, ${cleanedCount} cleaned before cancellation).`
          });
          break;
        }

        const cluster = clustersToMerge[i];
        setMergeProgress(`Merging student ${i + 1} of ${clustersToMerge.length}: ${cluster.studentName}...`);

        const { merged, targetDocId, secondaryRecords } = getMergedPreview(cluster);

        if (!targetDocId) continue;

        // 1. Write the consolidated merged application to Firestore admissions under primary targetDocId
        const cleanPayload = {
          ...merged,
          id: targetDocId,
          docId: targetDocId,
          _mergedAt: new Date().toISOString(),
          _mergedFrom: secondaryRecords.map(r => r.id || r.docId || r['Form Number']),
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'admissions', targetDocId), cleanPayload, { merge: true });
        updateCachedItem('admissions', targetDocId, cleanPayload);
        mergedCount++;

        // 2. Archive secondary duplicate records to Recycle Bin and remove from admissions
        for (const sec of secondaryRecords) {
          if (cancelMergeRef.current) break;
          const secId = String(sec.id || sec.docId || '').trim();
          if (secId && secId !== targetDocId) {
            await moveToRecycleBin(sec, 'admissions', 'Admin').catch(() => {});
            await deleteDoc(doc(db, 'admissions', secId)).catch(() => {});
            updateCachedItem('admissions', secId, null);
            cleanedCount++;
          }
        }
      }

      if (!cancelMergeRef.current) {
        setMergeProgress('Logging admin activity...');
        await logAdminActivity({
          actionType: 'update',
          actionTitle: 'Consolidated Duplicate Applications',
          details: `Successfully merged and consolidated ${mergedCount} student application groups (cleaned ${cleanedCount} duplicate records) in Class ${selectedClass} (${selectedSession}).`,
          reasonCategory: 'Data Deduplication & Merge',
          metadata: { mergedCount, cleanedCount, class: selectedClass, session: selectedSession }
        }).catch(() => {});

        invalidateCache('admissions');

        setAlert({
          type: 'success',
          text: `🎉 Successfully merged ${mergedCount} student group(s) and archived ${cleanedCount} duplicate records in Firestore database!`
        });

        // Clear selections and refresh admin data
        setSelectedGroupKeys(new Set());
        if (onRefresh) onRefresh(true);
      }
    } catch (err) {
      console.error('Merge execution error:', err);
      setAlert({ type: 'error', text: 'Merge failed: ' + err.message });
    } finally {
      setMerging(false);
      setMergeProgress('');
    }
  };

  const handleCancelMerge = () => {
    cancelMergeRef.current = true;
    setMergeProgress('Cancelling database merge...');
  };

  return (
    <div className="space-y-3 animate-fadeIn text-xs select-none">
      
      {/* Top Header Card with View Mode Switcher */}
      <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <GitMerge size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h2 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>Application Merger & Deduplication Studio</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono text-[10.5px]">
                {duplicateClusters.length} Duplicate Group(s) Found
              </span>
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Scan, preview side-by-side, and combine student-submitted rich data with admin-verified bulk uploads.
            </p>
          </div>
        </div>

        {/* View Mode Switcher (Duplicates vs All Records) */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black">
          <button
            type="button"
            onClick={() => setViewMode('duplicates')}
            className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'duplicates'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles size={13} />
            <span>Duplicate Groups ({duplicateClusters.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>All Applications Preview ({filteredAllApps.length})</span>
          </button>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black cursor-pointer transition-all ml-auto"
            title="Close Merger Studio"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Control & Condition Filter Bar */}
      <div className="p-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto whitespace-nowrap scrollbar-none flex-wrap">
        
        {/* Class Filter */}
        <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black shrink-0">
          {availableClasses.map(({ cls, count }) => {
            const dupCount = duplicatesByClass[cls] || 0;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  selectedClass === cls
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{cls}</span>
                <span className={`text-[9.5px] font-mono px-1 py-0.2 rounded ${selectedClass === cls ? 'bg-amber-700/60 text-amber-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {count}
                </span>
                {dupCount > 0 && (
                  <span
                    className="text-[8.5px] font-mono px-1 py-0.2 rounded-full bg-red-500 text-white font-black animate-pulse"
                    title={`${dupCount} duplicate cluster(s) detected in ${cls}`}
                  >
                    {dupCount} dup
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedClass('All')}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              selectedClass === 'All'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>All</span>
            <span className={`text-[9.5px] font-mono px-1 py-0.2 rounded ${selectedClass === 'All' ? 'bg-amber-700/60 text-amber-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              {sessionFilteredTotal}
            </span>
          </button>
        </div>

        {/* Session Filter */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10.5px] font-black text-slate-500 pl-1">Session:</span>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="px-2 py-0.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
          >
            <option value="All">All Sessions ({effectiveApps.length})</option>
            {availableSessions.map((s) => (
              <option key={s.session} value={s.session}>
                {s.session} ({s.count})
              </option>
            ))}
          </select>
        </div>

        {/* Stream Filter (Dynamically fetched from database) */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10.5px] font-black text-slate-500 pl-1">Stream:</span>
          <select
            value={selectedStream}
            onChange={(e) => setSelectedStream(e.target.value)}
            className="px-2 py-0.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
          >
            <option value="All">All Streams ({availableStreams.reduce((acc, s) => acc + s.count, 0)})</option>
            {availableStreams.map(({ stream, count }) => (
              <option key={stream} value={stream}>
                {stream} ({count})
              </option>
            ))}
          </select>
        </div>

        {/* Source Filter (Dynamically calculated from database) */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10.5px] font-black text-slate-500 pl-1">Source:</span>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-2 py-0.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
          >
            <option value="All">All Sources ({sourceCounts.total})</option>
            <option value="admin">Admin Bulk Uploads ({sourceCounts.admin})</option>
            <option value="online">Student Online Forms ({sourceCounts.online})</option>
          </select>
        </div>

        {/* Status Filter (Dynamically fetched from database) */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10.5px] font-black text-slate-500 pl-1">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2 py-0.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
          >
            <option value="All">All Status ({availableStatuses.reduce((acc, s) => acc + s.count, 0)})</option>
            {availableStatuses.map(({ status, count }) => (
              <option key={status} value={status}>
                {status} ({count})
              </option>
            ))}
          </select>
        </div>

        {/* Matching Identifier Condition */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10.5px] font-black text-slate-500 pl-1">Match By:</span>
          <select
            value={matchingCriteria}
            onChange={(e) => setMatchingCriteria(e.target.value)}
            className="px-2 py-0.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
          >
            <option value="auto">⚡ Smart Auto Match (Reg / Name / Form)</option>
            <option value="boardRegNo">Board Reg. No</option>
            <option value="nameParentage">Name + Parentage</option>
            <option value="formNo">Form Number</option>
          </select>
        </div>

        {/* Default Precedence */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10.5px] font-black text-slate-500 pl-1">Precedence:</span>
          <select
            value={defaultPrecedence}
            onChange={(e) => setDefaultPrecedence(e.target.value)}
            className="px-2 py-0.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs"
            title="Conflict resolution rule for verified fields"
          >
            <option value="admin">Admin Upload Takes Priority (Default)</option>
            <option value="student">Student Online Submission Takes Priority</option>
          </select>
        </div>

        {/* Search Filter */}
        <div className="relative min-w-[140px] max-w-[200px] flex-1 shrink-0">
          <Search size={11} className="absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student / reg no..."
            className="w-full pl-7 pr-5 py-0.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
        </div>

        {/* Load / Fetch from Live Database Button */}
        <button
          type="button"
          onClick={handleFetchFromDb}
          disabled={loadingDb}
          className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
          title="Force fresh scan directly from Firestore database"
        >
          <RefreshCw size={12} className={loadingDb ? 'animate-spin text-amber-600' : 'text-amber-600'} />
          <span>{loadingDb ? 'Loading Database...' : '⚡ Load from DB'}</span>
          <span className="px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/60 font-mono text-[9.5px]">
            {effectiveApps.length} records
          </span>
        </button>

        {/* Action Buttons (Visible in Duplicates Mode) */}
        {viewMode === 'duplicates' && (
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center gap-1 cursor-pointer transition-all"
            >
              {selectedGroupKeys.size === duplicateClusters.length && duplicateClusters.length > 0 ? (
                <CheckSquare size={13} className="text-amber-600" />
              ) : (
                <Square size={13} />
              )}
              <span>Select All ({duplicateClusters.length})</span>
            </button>

            <button
              type="button"
              onClick={handleExecuteMerge}
              disabled={merging || selectedGroupKeys.size === 0}
              className="px-3.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-40"
              title={`Merge ${selectedGroupKeys.size} selected student groups in ${selectedClass === 'All' ? 'All Classes' : `Class ${selectedClass}`}`}
            >
              {merging ? <RefreshCw size={12} className="animate-spin" /> : <GitMerge size={12} />}
              <span>Merge Selected ({selectedGroupKeys.size}) {selectedClass === 'All' ? '— All Classes' : `— ${selectedClass}`}</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress & Alert Messages with CANCEL Button */}
      {merging && (
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-950 dark:text-amber-200 font-bold text-xs flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <RefreshCw size={15} className="animate-spin text-amber-600 shrink-0" />
            <div>
              <div className="font-black text-xs text-amber-900 dark:text-amber-100">{mergeProgress}</div>
              <div className="text-[10.5px] text-amber-700 dark:text-amber-300 font-medium">Controlled consolidation in progress... You can stop at any time.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelMerge}
            className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-xs cursor-pointer transition-all flex items-center gap-1 shrink-0"
          >
            <X size={13} className="stroke-[3]" />
            <span>⛔ Cancel Merge Operation</span>
          </button>
        </div>
      )}

      {alert && (
        <div className={`p-2.5 rounded-xl text-xs font-black flex items-center justify-between gap-2 border ${
          alert.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800' 
            : alert.type === 'info'
            ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/60 dark:border-blue-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {alert.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} className="p-0.5 hover:opacity-70 cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {/* Main View Mode Content */}
      {viewMode === 'duplicates' ? (
        /* DUPLICATE CANDIDATES LIST */
        <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
          {duplicateClusters.map((cluster, idx) => {
            const isSelected = selectedGroupKeys.has(cluster.groupKey);
            const isExpanded = expandedGroupKeys.has(cluster.groupKey);
            const { merged, targetDocId, secondaryRecords } = getMergedPreview(cluster);
            const overrides = customFieldOverrides[cluster.groupKey] || {};

            return (
              <div
                key={cluster.groupKey}
                className={`p-3 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-amber-400 dark:border-amber-600 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs ring-2 ring-amber-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                {/* Cluster Summary Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelectGroup(cluster.groupKey)}
                      className="cursor-pointer text-slate-700 dark:text-slate-200 hover:text-amber-600"
                    >
                      {isSelected ? <CheckSquare size={16} className="text-amber-600" /> : <Square size={16} />}
                    </button>

                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-mono text-[11px] font-black text-slate-400">#{idx + 1}</span>
                      <span className="font-black text-xs text-slate-900 dark:text-white truncate">
                        {cluster.studentName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-black border border-amber-200 dark:border-amber-900">
                        Reg: {cluster.regNo}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        {cluster.class} • {cluster.session}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-black">
                        {cluster.records.length} applications
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMergeSingleCluster(cluster)}
                      disabled={merging}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-2xs disabled:opacity-40"
                      title={`Merge ${cluster.studentName} immediately`}
                    >
                      <GitMerge size={12} />
                      <span>⚡ Merge This Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleExpandGroup(cluster.groupKey)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'Review & Customize'}</span>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  </div>
                </div>

                {/* 3-Column Side-by-Side Comparison Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 mt-2.5">
                  
                  {/* Column 1: Admin Verified / Bulk Upload */}
                  <div className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white font-black text-[9.5px] uppercase">
                          Admin Bulk Upload
                        </span>
                        <span className="font-mono text-[10px] font-black text-blue-700 dark:text-blue-300">
                          Doc: {cluster.adminApp.id || cluster.adminApp.docId}
                        </span>
                      </div>

                      <div className="space-y-1 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                        <div><span className="text-slate-400">Form No:</span> <strong className="text-blue-700 dark:text-blue-300 font-mono">#{extractFormNo(cluster.adminApp)}</strong></div>
                        <div><span className="text-slate-400">Roll No:</span> <strong className="text-blue-700 dark:text-blue-300 font-mono">{extractClassRoll(cluster.adminApp)}</strong></div>
                        <div><span className="text-slate-400">Adm No:</span> <strong className="text-blue-700 dark:text-blue-300 font-mono">{extractAdmNo(cluster.adminApp)}</strong></div>
                        <div><span className="text-slate-400">Reg No:</span> <span className="font-mono">{extractRegNo(cluster.adminApp) || '—'}</span></div>
                        <div><span className="text-slate-400">Student:</span> <strong>{extractStudentName(cluster.adminApp)}</strong></div>
                        <div><span className="text-slate-400">Parentage:</span> {extractFatherName(cluster.adminApp)} {extractMotherName(cluster.adminApp) !== '—' && `• ${extractMotherName(cluster.adminApp)}`}</div>
                        <div><span className="text-slate-400">DoB & Village:</span> {extractDob(cluster.adminApp)} • {extractVillage(cluster.adminApp)}</div>
                        <div><span className="text-slate-400">Stream & Subs:</span> {extractStream(cluster.adminApp)} ({extractSubjects(cluster.adminApp)})</div>
                        <div><span className="text-slate-400">Mobile (S/P):</span> <span className="font-mono">{extractMobile(cluster.adminApp)} {extractParentMobile(cluster.adminApp) !== '—' && `/ ${extractParentMobile(cluster.adminApp)}`}</span></div>
                        <div><span className="text-slate-400">Aadhaar / PEN:</span> <span className="font-mono">{extractAadhaar(cluster.adminApp)} / {extractPen(cluster.adminApp)}</span></div>
                        <div><span className="text-slate-400">Status:</span> <span className="text-blue-600 font-black">{cluster.adminApp.Status || cluster.adminApp.status || 'Verified'}</span></div>
                      </div>
                    </div>
                    <div className="text-[9.5px] text-slate-400 font-semibold mt-2 pt-1 border-t border-blue-200/60 dark:border-blue-900/40">
                      Source: School Master Registers / Bulk Import
                    </div>
                  </div>

                  {/* Column 2: Student Online Submission */}
                  <div className="p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-black text-[9.5px] uppercase">
                          Student Online Submission
                        </span>
                        <span className="font-mono text-[10px] font-black text-indigo-700 dark:text-indigo-300">
                          Doc: {cluster.onlineApp.id || cluster.onlineApp.docId}
                        </span>
                      </div>

                      <div className="space-y-1 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                        <div><span className="text-slate-400">Form No:</span> <strong className="text-indigo-700 dark:text-indigo-300 font-mono">#{extractFormNo(cluster.onlineApp)}</strong></div>
                        <div><span className="text-slate-400">Reg No:</span> <span className="font-mono">{extractRegNo(cluster.onlineApp) || '—'}</span></div>
                        <div><span className="text-slate-400">Student:</span> <strong>{extractStudentName(cluster.onlineApp)}</strong></div>
                        <div><span className="text-slate-400">Parentage:</span> {extractFatherName(cluster.onlineApp)} {extractMotherName(cluster.onlineApp) !== '—' && `• ${extractMotherName(cluster.onlineApp)}`}</div>
                        <div><span className="text-slate-400">DoB:</span> <strong className="text-indigo-700 dark:text-indigo-300 font-mono">{extractDob(cluster.onlineApp)}</strong></div>
                        <div><span className="text-slate-400">Village / Town:</span> <strong>{extractVillage(cluster.onlineApp)}</strong></div>
                        <div><span className="text-slate-400">Mobile / WhatsApp:</span> <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{extractMobile(cluster.onlineApp)} {extractParentMobile(cluster.onlineApp) !== '—' && `/ ${extractParentMobile(cluster.onlineApp)}`}</strong></div>
                        <div><span className="text-slate-400">Aadhaar / PEN:</span> <span className="font-mono">{extractAadhaar(cluster.onlineApp)} / {extractPen(cluster.onlineApp)}</span></div>
                        <div><span className="text-slate-400">Stream & Subs:</span> {extractStream(cluster.onlineApp)} ({extractSubjects(cluster.onlineApp)})</div>
                        <div><span className="text-slate-400">Photo:</span> {resolveStudentPhoto(cluster.onlineApp) ? '✅ Attached' : '❌ None'}</div>
                      </div>
                    </div>
                    <div className="text-[9.5px] text-slate-400 font-semibold mt-2 pt-1 border-t border-indigo-200/60 dark:border-indigo-900/40">
                      Source: Student Portal Online Form
                    </div>
                  </div>

                  {/* Column 3: Proposed Merged Output */}
                  <div className="p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-black text-[9.5px] uppercase flex items-center gap-1">
                          <Sparkles size={10} />
                          <span>Proposed Merged Record</span>
                        </span>
                        <span className="font-mono text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                          Canonical: #{extractFormNo(merged)}
                        </span>
                      </div>

                      <div className="space-y-1 font-bold text-[11px] text-slate-800 dark:text-slate-200">
                        <div><span className="text-slate-400">Final Form No:</span> <strong className="text-emerald-700 dark:text-emerald-300 font-mono">#{extractFormNo(merged)}</strong></div>
                        <div><span className="text-slate-400">Final Roll No:</span> <strong className="text-emerald-700 dark:text-emerald-300 font-mono">{extractClassRoll(merged)}</strong></div>
                        <div><span className="text-slate-400">Final Adm No:</span> <strong className="text-emerald-700 dark:text-emerald-300 font-mono">{extractAdmNo(merged)}</strong></div>
                        <div><span className="text-slate-400">Final Reg No:</span> <strong className="font-mono text-emerald-700 dark:text-emerald-300">{extractRegNo(merged) || '—'}</strong></div>
                        <div><span className="text-slate-400">Student:</span> <strong>{extractStudentName(merged)}</strong></div>
                        <div><span className="text-slate-400">Parentage:</span> {extractFatherName(merged)} {extractMotherName(merged) !== '—' && `• ${extractMotherName(merged)}`}</div>
                        <div><span className="text-slate-400">DoB & Village:</span> {extractDob(merged)} • {extractVillage(merged)}</div>
                        <div><span className="text-slate-400">Mobile (S/P):</span> <strong className="font-mono text-emerald-700 dark:text-emerald-300">{extractMobile(merged)} {extractParentMobile(merged) !== '—' && `/ ${extractParentMobile(merged)}`}</strong></div>
                        <div><span className="text-slate-400">Aadhaar / PEN:</span> <span className="font-mono">{extractAadhaar(merged)} / {extractPen(merged)}</span></div>
                        <div><span className="text-slate-400">Stream & Subs:</span> {extractStream(merged)} ({extractSubjects(merged)})</div>
                      </div>
                    </div>
                    <div className="text-[9.5px] text-emerald-700 dark:text-emerald-300 font-black mt-2 pt-1 border-t border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
                      <span>Cleaned Duplicate: {secondaryRecords.map(r => `#${extractFormNo(r)}`).join(', ')}</span>
                      <span>Ready ✅</span>
                    </div>
                  </div>

                </div>

                {/* Expandable Field Override & Precedence Controls */}
                {isExpanded && (
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 animate-fadeIn">
                    <div className="font-black text-xs text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                      <Sliders size={13} className="text-amber-500" />
                      <span>Field Conflict Resolution Controls for {cluster.studentName}:</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { key: 'Form Number', label: 'Form Number', adminVal: extractFormNo(cluster.adminApp), studentVal: extractFormNo(cluster.onlineApp) },
                        { key: 'Class Roll No', label: 'Class Roll No', adminVal: extractClassRoll(cluster.adminApp), studentVal: extractClassRoll(cluster.onlineApp) },
                        { key: 'Admission Number', label: 'Admission Number', adminVal: extractAdmNo(cluster.adminApp), studentVal: extractAdmNo(cluster.onlineApp) },
                        { key: 'Stream for Class 11th', label: 'Stream', adminVal: extractStream(cluster.adminApp), studentVal: extractStream(cluster.onlineApp) },
                        { key: 'Student Name', label: 'Student Name', adminVal: extractStudentName(cluster.adminApp), studentVal: extractStudentName(cluster.onlineApp) },
                        { key: 'Board Registration Number', label: 'Board Reg No', adminVal: extractRegNo(cluster.adminApp), studentVal: extractRegNo(cluster.onlineApp) },
                        { key: 'Village / Town', label: 'Village / Address', adminVal: extractVillage(cluster.adminApp), studentVal: extractVillage(cluster.onlineApp) },
                        { key: 'Date of Birth', label: 'Date of Birth', adminVal: extractDob(cluster.adminApp), studentVal: extractDob(cluster.onlineApp) },
                      ].map(({ key, label, adminVal, studentVal }) => {
                        const currentChoice = overrides[key] || defaultPrecedence;
                        return (
                          <div key={key} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-1">
                            <span className="font-black text-[10.5px] text-slate-500">{label}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFieldOverride(cluster.groupKey, key, 'admin')}
                                className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all flex-1 text-center ${
                                  currentChoice === 'admin'
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                              >
                                Admin ({adminVal || '—'})
                              </button>
                              <button
                                type="button"
                                onClick={() => setFieldOverride(cluster.groupKey, key, 'student')}
                                className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all flex-1 text-center ${
                                  currentChoice === 'student'
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                              >
                                Student ({studentVal || '—'})
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            );
          })}

          {duplicateClusters.length === 0 && (
            <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-200">No Duplicate Applications Found</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                All student records in Class {selectedClass} ({selectedSession}) have unique registration numbers and applications.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ALL APPLICATIONS ROSTER PREVIEW */
        <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between gap-2 px-1 text-xs font-bold text-slate-500">
            <span>Showing {filteredAllApps.length} student application(s) matching current filters</span>
            <span>Class: {selectedClass} • Session: {selectedSession}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredAllApps.map((st, idx) => {
              const photo = resolveStudentPhoto(st);
              const isOnline = isOnlineSubmission(st);
              const formNo = extractFormNo(st);
              const name = extractStudentName(st);
              const father = extractFatherName(st);
              const mother = extractMotherName(st);
              const roll = extractClassRoll(st);
              const adm = extractAdmNo(st);
              const reg = extractRegNo(st);
              const dob = extractDob(st);
              const village = extractVillage(st);
              const mobile = extractMobile(st);
              const pMobile = extractParentMobile(st);
              const aadhaar = extractAadhaar(st);
              const pen = extractPen(st);
              const stm = extractStream(st);
              const subs = extractSubjects(st);
              const status = st.Status || st.status || (roll !== '—' ? 'Approved' : 'Submitted');
              const docId = st.id || st.docId || formNo;
              const isDuplicate = duplicateKeysSet.has(String(docId)) || duplicateKeysSet.has(String(formNo));

              return (
                <div
                  key={docId + '_' + idx}
                  className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                    isDuplicate
                      ? 'border-amber-400 dark:border-amber-600 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Card Top Row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {photo ? (
                          <img
                            src={photo}
                            alt={name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700 shrink-0">
                            No Pic
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-black text-xs text-slate-900 dark:text-white truncate">
                            {name}
                          </h4>
                          <p className="text-[10.5px] font-bold text-slate-500 truncate">
                            S/o: {father} {mother !== '—' && `• ${mother}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase ${
                          isOnline
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}>
                          {isOnline ? 'Online' : 'Bulk'}
                        </span>
                        {isDuplicate && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500 text-white font-mono text-[9px] font-black animate-pulse">
                            ⚠️ Duplicate
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Grid with ALL fields */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 py-1.5 border-y border-slate-100 dark:border-slate-800">
                      <div><span className="text-slate-400 text-[10px]">Form No:</span> <strong className="font-mono text-slate-900 dark:text-white">#{formNo}</strong></div>
                      <div><span className="text-slate-400 text-[10px]">Roll No:</span> <strong className="font-mono text-slate-900 dark:text-white">{roll}</strong></div>
                      <div><span className="text-slate-400 text-[10px]">Adm No:</span> <strong className="font-mono text-slate-900 dark:text-white">{adm}</strong></div>
                      <div><span className="text-slate-400 text-[10px]">Reg No:</span> <span className="font-mono">{reg || '—'}</span></div>
                      <div><span className="text-slate-400 text-[10px]">DoB:</span> <span className="font-mono">{dob}</span></div>
                      <div><span className="text-slate-400 text-[10px]">Village:</span> <span>{village}</span></div>
                      <div><span className="text-slate-400 text-[10px]">Stream:</span> <span>{stm}</span></div>
                      <div><span className="text-slate-400 text-[10px]">Status:</span> <span className="text-emerald-600 dark:text-emerald-400">{status}</span></div>
                      <div className="col-span-2"><span className="text-slate-400 text-[10px]">Mobile (S/P):</span> <span className="font-mono">{mobile} {pMobile !== '—' && `/ ${pMobile}`}</span></div>
                      <div className="col-span-2"><span className="text-slate-400 text-[10px]">Aadhaar / PEN:</span> <span className="font-mono">{aadhaar} / {pen}</span></div>
                      {subs !== '—' && <div className="col-span-2 truncate"><span className="text-slate-400 text-[10px]">Subs:</span> <span>{subs}</span></div>}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] font-mono text-slate-400">ID: {docId}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewStudentModal(st)}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-[10.5px] cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                    >
                      <Eye size={12} />
                      <span>Inspect Details</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredAllApps.length === 0 && (
            <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Search size={32} className="mx-auto text-slate-400 mb-2" />
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-200">No Student Applications Matched</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Try clearing or adjusting the search query, stream, or class filters.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Floating Execution Toolbar (Duplicates Mode Only) */}
      {viewMode === 'duplicates' && duplicateClusters.length > 0 && (
        <div className="p-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {selectedGroupKeys.size > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-black">
                ● {selectedGroupKeys.size} student group(s) selected for controlled database consolidation
              </span>
            ) : (
              'Select groups above to merge'
            )}
          </span>

          <div className="flex items-center gap-2">
            {merging ? (
              <button
                type="button"
                onClick={handleCancelMerge}
                className="px-4 py-1.5 rounded-xl font-black text-xs text-white bg-rose-600 hover:bg-rose-500 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <X size={13} className="stroke-[3]" />
                <span>Cancel Merge</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteMerge}
                disabled={selectedGroupKeys.size === 0}
                className="px-4 py-1.5 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <GitMerge size={13} />
                <span>Execute Database Merge ({selectedGroupKeys.size} Selected {selectedClass === 'All' ? 'Across All Classes' : `in Class ${selectedClass}`})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Single Student Full Record Details Modal */}
      {previewStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                {resolveStudentPhoto(previewStudentModal) ? (
                  <img
                    src={resolveStudentPhoto(previewStudentModal)}
                    alt={previewStudentModal.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black text-sm border border-amber-500/20">
                    ST
                  </div>
                )}
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {previewStudentModal["Student's Name (as per school records)"] || previewStudentModal["Student's Name"] || previewStudentModal.name || 'Student Record'}
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    Form #{previewStudentModal['Form Number'] || previewStudentModal.formNo || '—'} • Class {extractClass(previewStudentModal)} ({extractSession(previewStudentModal)})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewStudentModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black cursor-pointer transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body - Field Inspector */}
            <div className="p-4 overflow-y-auto space-y-3 max-h-[60vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                {Object.entries(previewStudentModal)
                  .filter(([k]) => !k.startsWith('_') && k !== 'Student Photo' && k !== 'photoUrl' && k !== 'photo_id')
                  .map(([key, val]) => (
                    <div key={key} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-black block truncate">{key}</span>
                      <span className="text-slate-900 dark:text-white font-mono break-words">{String(val || '—')}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/50">
              <span className="text-[11px] font-mono text-slate-400">Doc ID: {previewStudentModal.id || previewStudentModal.docId}</span>
              <button
                type="button"
                onClick={() => setPreviewStudentModal(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs cursor-pointer transition-all"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
