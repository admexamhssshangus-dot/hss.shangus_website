import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  BookOpen, FileSpreadsheet, CreditCard, Calendar, Printer,
  RefreshCw, Check, Search, ZoomIn, ZoomOut,
  Plus, Trash2, FileCheck, Sliders, Loader2, Columns, LayoutGrid
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import {
  updateCachedItem,
  getCachedCollectionSync,
  getCachedCollection,
  preloadStudentPhotosCache,
  fetchStudentPhotoOnDemand
} from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { getStudentPhotoUrl } from '../../utils/imageCompressor';

const SCHOOL_NAME = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS';
const SCHOOL_SUBTITLE = 'Nurturing Minds, Shaping Futures • District Anantnag';

// Convert date (DD-MM-YYYY or YYYY-MM-DD) to formal English words
export function formatDateToWords(dateStr) {
  if (!dateStr) return '—';
  try {
    let clean = String(dateStr).trim();
    let day = 0, month = 0, year = 0;
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
    } else if (clean.includes('/')) {
      const parts = clean.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
    if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) return clean;

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = months[month - 1] || '';

    const ones = [
      "", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
      "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
      "Twenty-First", "Twenty-Second", "Twenty-Third", "Twenty-Fourth", "Twenty-Fifth", "Twenty-Sixth", "Twenty-Seventh", "Twenty-Eighth", "Twenty-Ninth", "Thirtieth", "Thirty-First"
    ];

    const yOnes = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const yTens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function yearToWords(y) {
      if (y >= 2000 && y <= 2099) {
        const rem = y % 2000;
        if (rem === 0) return "Two Thousand";
        if (rem < 20) return "Two Thousand " + yOnes[rem];
        return "Two Thousand " + yTens[Math.floor(rem / 10)] + (rem % 10 > 0 ? " " + yOnes[rem % 10] : "");
      }
      if (y >= 1900 && y <= 1999) {
        const rem = y % 1900;
        let w = "Nineteen Hundred";
        if (rem > 0) {
          if (rem < 20) w += " " + yOnes[rem];
          else w += " " + yTens[Math.floor(rem / 10)] + (rem % 10 > 0 ? " " + yOnes[rem % 10] : "");
        }
        return w;
      }
      return String(y);
    }

    const dayWord = ones[day] || String(day);
    const yWord = yearToWords(year);
    return `${dayWord} of ${monthName} ${yWord}`;
  } catch (e) {
    return String(dateStr);
  }
}

// Clean helper values
function cleanStr(val) {
  if (!val || val === '—' || val === 'N/A' || val === 'undefined' || val === 'null' || val === '-') return '';
  return String(val).trim();
}

// Check if student has been assigned a Class Roll Number
export function hasAssignedClassRollNo(s) {
  const roll = cleanStr(s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo || s.roll_no || s['Roll No'] || s['Roll No.']);
  return roll !== '' && roll !== '—' && roll !== '-' && roll !== 'N/A' && roll !== 'null' && roll !== 'undefined' && roll !== '0';
}

// Business status evaluation: Approved strictly means those assigned a Class Roll Number
function resolveEffectiveStatus(s) {
  if (hasAssignedClassRollNo(s)) return 'Approved';

  const rawStat = cleanStr(s.status || s.Status || s.admissionStatus || s['Status'] || s['Admission Status'] || '').toLowerCase();
  if (rawStat.includes('reject') || rawStat.includes('rejt')) return 'Rejected';
  if (rawStat.includes('draft')) return 'Draft';
  if (rawStat.includes('provis')) return 'Provisional';
  return 'Submitted';
}

function matchesClassVal(selectedClasses, classVal) {
  if (!selectedClasses || selectedClasses === 'ALL') return true;
  const strVal = String(classVal ?? '').trim().toLowerCase();
  const cleanVal = strVal.replace(/class/gi, '').trim();
  const targetClean = String(selectedClasses).toLowerCase().replace(/class/gi, '').trim();
  if (cleanVal === targetClean) return true;
  const d1 = targetClean.match(/\d+/)?.[0];
  const d2 = cleanVal.match(/\d+/)?.[0];
  return !!(d1 && d2 && d1 === d2);
}

function formatBoardRegSplit(val) {
  const s = cleanStr(val);
  if (!s) return '—';
  if (s.length > 12) {
    return (
      <div className="leading-tight text-center font-mono">
        <span className="font-extrabold">{s.substring(0, 12)}</span>
        <br />
        <span className="font-bold text-slate-600 dark:text-slate-400">{s.substring(12)}</span>
      </div>
    );
  }
  return <span className="font-bold font-mono">{s}</span>;
}

export default function AdmissionRegisterSuite({
  students: propStudents,
  allHistory: propAllHistory,
  onClose: propOnClose,
  onDataUpdated,
  user: propUser,
  initialTab = 'adm_register'
}) {
  const navigate = useNavigate();
  const outletCtx = useOutletContext?.() || {};
  const user = propUser || outletCtx?.user;
  const onClose = propOnClose || (() => navigate('/portal/admin'));

  // Main Suite Tab: 'adm_register' | 'sentup' | 'assign_ids' | 'assign_dates'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sub-view Tab for Admission Register: 'all' | 'cover' | 'spreads' | 'summary' | 'notes'
  const [registerViewSection, setRegisterViewSection] = useState('all');

  // Spread Layout Mode on Screen: 'side_by_side' (Book View) | 'stacked'
  const [spreadLayoutMode, setSpreadLayoutMode] = useState('side_by_side');

  // Print & Layout Configuration (DEFAULT: 0.3 INCH DYNAMIC MARGINS ON LEGAL LANDSCAPE)
  const [printMargin, setPrintMargin] = useState(0.3); // 0.3 inch default
  const [showMarginControls, setShowMarginControls] = useState(false);

  // Global Filter States
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedStatus, setSelectedStatus] = useState('Approved'); // 'Approved' (Default) | 'Submitted' | 'Provisional' | 'ALL'
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [toast, setToast] = useState(null);

  // Loading States for Session Data
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // In-memory Session Storage Cache for instantaneous tab switching
  const sessionCacheRef = useRef({});

  // Clean Print Mode Body Attachment
  useEffect(() => {
    document.body.classList.add('admission-register-print-mode');
    document.body.classList.add('clean-print-mode');
    return () => {
      document.body.classList.remove('admission-register-print-mode');
      document.body.classList.remove('clean-print-mode');
    };
  }, []);

  // Centralized Loaded Datasets (admissions + master registers)
  const [dataset, setDataset] = useState(() => {
    if (Array.isArray(propStudents) && propStudents.length > 0) return propStudents;
    const cached = getCachedCollectionSync('admissions');
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });

  const [historyDataset, setHistoryDataset] = useState(() => {
    if (Array.isArray(propAllHistory) && propAllHistory.length > 0) return propAllHistory;
    const cached = getCachedCollectionSync('masterRegisters');
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });

  // 1. DYNAMICALLY FETCH ALL SESSIONS AVAILABLE IN DATABASE
  const [availableSessions, setAvailableSessions] = useState(['2025-26', '2024-25', '2023-24', '2022-23']);

  useEffect(() => {
    const sessionsFound = new Set(['2025-26', '2024-25', '2023-24', '2022-23']);
    (dataset || []).forEach(s => {
      const sess = cleanStr(s.session || s.Session || s['Academic Session']);
      if (sess) sessionsFound.add(sess);
    });
    (historyDataset || []).forEach(h => {
      const sess = cleanStr(h.session || h.Session || h['Academic Session']);
      if (sess) sessionsFound.add(sess);
      if (Array.isArray(h.items || h.students)) {
        (h.items || h.students).forEach(item => {
          const sItem = cleanStr(item.session || item.Session || item['Academic Session']);
          if (sItem) sessionsFound.add(sItem);
        });
      }
    });
    getDocs(collection(db, 'academicSessions')).then(snap => {
      snap.docs.forEach(d => {
        const sessName = cleanStr(d.data()?.name || d.data()?.session || d.id);
        if (sessName) sessionsFound.add(sessName);
      });
      setAvailableSessions(Array.from(sessionsFound).sort().reverse());
    }).catch(() => {
      setAvailableSessions(Array.from(sessionsFound).sort().reverse());
    });
  }, [dataset, historyDataset]);

  // 2. ON-DEMAND SESSION DATA FETCHER (Loads particular session dynamically from DB)
  useEffect(() => {
    if (!selectedSession) return;

    if (sessionCacheRef.current[selectedSession]) {
      setDataset(sessionCacheRef.current[selectedSession]);
      return;
    }

    if (selectedSession === '2025-26' && Array.isArray(propStudents) && propStudents.length > 0) {
      sessionCacheRef.current['2025-26'] = propStudents;
      setDataset(propStudents);
      return;
    }

    let isCancelled = false;
    setIsLoadingSession(true);

    const loadSessionData = async () => {
      try {
        let loadedRecords = [];

        const qSnap = await getDocs(query(collection(db, 'admissions'), where('session', '==', selectedSession)));
        if (!qSnap.empty) {
          loadedRecords = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (loadedRecords.length === 0) {
          const masterList = await getCachedCollection('masterRegisters');
          const flat = [];
          (masterList || []).forEach(docItem => {
            if (!docItem) return;
            const chunk = docItem.items || docItem.students || docItem.records || docItem.data;
            const pSess = cleanStr(docItem.session || docItem.Session || docItem['Academic Session'] || '');
            if (Array.isArray(chunk)) {
              chunk.forEach((item, i) => {
                const iSess = cleanStr(item.session || item.Session || item['Academic Session'] || pSess);
                if (iSess === selectedSession || selectedSession === 'ALL') {
                  flat.push({
                    ...item,
                    id: item.id || item['Form Number'] || `${docItem.id}_${i}`,
                    session: iSess,
                    Session: iSess
                  });
                }
              });
            } else if (pSess === selectedSession || selectedSession === 'ALL') {
              flat.push({ ...docItem, session: pSess, Session: pSess });
            }
          });
          loadedRecords = flat;
        }

        if (loadedRecords.length === 0 && selectedSession === '2025-26') {
          const admSnap = await getDocs(collection(db, 'admissions'));
          loadedRecords = admSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (!isCancelled) {
          sessionCacheRef.current[selectedSession] = loadedRecords;
          setDataset(loadedRecords);
        }
      } catch (err) {
        console.error(`Error loading session ${selectedSession}:`, err);
      } finally {
        if (!isCancelled) setIsLoadingSession(false);
      }
    };

    loadSessionData();

    return () => { isCancelled = true; };
  }, [selectedSession, propStudents]);

  // 3. REACTIVE ON-DEMAND PHOTO RESOLUTION MAP
  const [photosMap, setPhotosMap] = useState(() => {
    return typeof window !== 'undefined' && window._hss_central_photo_map
      ? { ...window._hss_central_photo_map }
      : {};
  });

  useEffect(() => {
    try {
      preloadStudentPhotosCache();
    } catch (_) {}
  }, []);

  // Normalized Student Object Mapper
  const normalizedStudents = useMemo(() => {
    return (dataset || []).map((s, idx) => {
      const cls = cleanStr(s.class || s.Class || s['Admission sought for class'] || '11th');
      const sess = cleanStr(s.session || s.Session || s['Academic Session'] || selectedSession);
      const formNo = cleanStr(s.formNo || s['Form Number'] || s['Form No.'] || s.FormNo);
      const admNo = cleanStr(s.admNo || s['Adm. No.'] || s['Admission No.'] || s.admissionNumber);
      const rollNo = cleanStr(s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo || s.roll_no);
      const boardReg = cleanStr(s.boardRegNo || s['Board Registration Number'] || s.boardReg || s['Board Reg. No.']);
      const name = cleanStr(s.studentName || s["Student's Name (as per school records)"] || s['Student Name'] || s.name);
      const father = cleanStr(s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || s.father);
      const mother = cleanStr(s.motherName || s["Mother's Name (as per school records)"] || s["Mother's Name"] || s.mother);
      const dob = cleanStr(s.dob || s['DoB (as per school records)'] || s['Date of Birth']);
      const gender = cleanStr(s.gender || s.Gender || 'Male');
      const stream = cleanStr(s.stream || s.Stream || 'General');
      const subs = cleanStr(s.subs || s.subjects || s.Subjects || s['Subjects Chosen'] || '');
      const aadhar = cleanStr(s.aadhar || s['Aadhar No.'] || s.aadhaar || s['Aadhaar No.']);
      const village = cleanStr(s.village || s['Name of your village'] || s['Village/Town']);
      const block = cleanStr(s.block || s.Block || s['Block/Zone'] || 'Shangus');
      const tehsil = cleanStr(s.tehsil || s.Tehsil || 'Shangus');
      const district = cleanStr(s.district || s.District || 'Anantnag');
      const mobile = cleanStr(s.mobile || s['Mobile No. (with working WhatsApp)'] || s['Student Mobile']);
      const parentMobile = cleanStr(s.parentContact || s["Father's Mobile No."] || s['Parent Mobile']);
      const category = cleanStr(s.category || s['Cat._JKBOSE'] || s['Social Category'] || 'OM');
      const socioEcon = cleanStr(s.socioEconomic || s['Socio-Economic Category'] || 'AAY/BPL');
      const blood = cleanStr(s.blood || s['Blood Group'] || s.bloodGroup || '—');
      const account = cleanStr(s.bankAccount || s['Bank Account No.'] || s.accountNo);
      const ifsc = cleanStr(s.ifsc || s['IFSC code'] || s.ifscCode);
      const pen = cleanStr(s.penNo || s['PEN No.'] || s.pen || 'NA');
      const prevSchool = cleanStr(s.prevSchool || s['Previous School'] || s['Name of Previous School']);
      const prevRoll = cleanStr(s.prevExamRollNo || s['Previous Exam Roll No'] || s.examRoll10th);
      const prevMarks = cleanStr(s.marksObt || s['Marks Obtained'] || s.marksObt10th);
      const maxMarks = cleanStr(s.maxMarks || s['Max Marks'] || '500');
      const prevResult = prevMarks ? `${prevMarks} / ${maxMarks}` : '—';
      const admDate = cleanStr(s.admDate || s['Adm. Date'] || s.admissionDate || s.submittedAt?.slice(0, 10) || '');
      const onlineStatus = cleanStr(s.onlineSubmDate || s.submittedAt?.slice(0, 10) || 'Submitted');
      const status = resolveEffectiveStatus(s);
      
      const docId = cleanStr(s.id || s.docId || (formNo ? `form_${formNo}` : `adm_${idx}`));
      const directPhoto = getStudentPhotoUrl(s, '');

      return {
        raw: s,
        id: docId,
        sno: idx + 1,
        formNo,
        admNo,
        rollNo,
        boardReg,
        name,
        father,
        mother,
        dobFigures: dob,
        dobWords: formatDateToWords(dob),
        gender,
        class: cls,
        session: sess,
        stream,
        subs,
        aadhar,
        village,
        block,
        tehsil,
        district,
        mobile,
        parentMobile,
        category,
        socioEcon,
        blood,
        account,
        ifsc,
        pen,
        prevSchool,
        prevRoll,
        prevResult,
        admDate,
        onlineStatus,
        status,
        directPhoto,
        prevCC: prevSchool.toLowerCase().includes('shangus') ? 'Internal (HSS Shangus)' : 'Vide TC/CC',
        withdrawal: '—',
        remarks: cleanStr(s.remarks || s.Remarks || '')
      };
    });
  }, [dataset, selectedSession]);

  // 4. DYNAMIC CLASSES TAILORED STRICTLY TO LOADED SESSION DATA
  const availableClasses = useMemo(() => {
    const set = new Set();
    normalizedStudents.forEach(s => {
      const cls = cleanStr(s.class);
      if (cls) {
        if (cls.includes('12')) set.add('12th');
        else if (cls.includes('11')) set.add('11th');
        else if (cls.includes('10')) set.add('10th');
        else if (cls.includes('9')) set.add('9th');
        else set.add(cls);
      }
    });
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ['11th', '12th', '10th', '9th'];
  }, [normalizedStudents]);

  // 5. DYNAMIC STREAMS TAILORED STRICTLY TO LOADED SESSION DATA
  const availableStreams = useMemo(() => {
    const set = new Set();
    normalizedStudents.forEach(s => {
      const str = cleanStr(s.stream);
      if (str && str !== '—') set.add(str);
    });
    return Array.from(set).sort();
  }, [normalizedStudents]);

  // Dynamic Status Counts (Approved, Submitted, Provisional, All)
  const statusCounts = useMemo(() => {
    let approved = 0, submitted = 0, provisional = 0;
    normalizedStudents.forEach(s => {
      if (selectedClass !== 'ALL' && !matchesClassVal(selectedClass, s.class)) return;
      if (s.status === 'Approved') approved++;
      if (s.status === 'Submitted') submitted++;
      if (s.status === 'Provisional') provisional++;
    });
    return { approved, submitted, provisional, total: normalizedStudents.length };
  }, [normalizedStudents, selectedClass]);

  // Filtered Students for Current View
  const filteredStudents = useMemo(() => {
    return normalizedStudents.filter(s => {
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'Approved') {
          if (s.status !== 'Approved') return false;
        } else if (selectedStatus === 'Submitted') {
          if (s.status !== 'Submitted' && s.status !== 'Approved') return false;
        } else if (selectedStatus === 'Provisional') {
          if (s.status !== 'Provisional') return false;
        } else if (s.status !== selectedStatus) {
          return false;
        }
      }

      if (selectedClass !== 'ALL') {
        if (!matchesClassVal(selectedClass, s.class)) return false;
      }

      if (selectedStream !== 'ALL') {
        if (s.stream !== selectedStream) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.father.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.admNo.toLowerCase().includes(q) ||
          s.formNo.toLowerCase().includes(q) ||
          s.boardReg.toLowerCase().includes(q) ||
          s.mobile.includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      const rA = parseInt(a.rollNo, 10) || 0;
      const rB = parseInt(b.rollNo, 10) || 0;
      if (rA !== rB && rA > 0 && rB > 0) return rA - rB;
      return a.name.localeCompare(b.name);
    });
  }, [normalizedStudents, selectedStatus, selectedClass, selectedStream, searchQuery]);

  // ASYNC PHOTO FETCHING FOR VISIBLE FILTERED STUDENTS
  useEffect(() => {
    if (!filteredStudents || filteredStudents.length === 0) return;
    let isMounted = true;

    const toFetch = filteredStudents.filter(st => {
      const existing = photosMap[st.id] || photosMap[st.formNo] || photosMap[st.boardReg] || st.directPhoto;
      return !existing || existing === '/logo.png';
    });

    if (toFetch.length === 0) return;

    const chunkArray = (arr, size) => {
      const res = [];
      for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
      return res;
    };

    const batches = chunkArray(toFetch, 15);

    (async () => {
      for (const batch of batches) {
        if (!isMounted) break;
        const results = await Promise.all(
          batch.map(async (st) => {
            try {
              const url = await fetchStudentPhotoOnDemand(st.raw || st);
              return { id: st.id, formNo: st.formNo, boardReg: st.boardReg, url };
            } catch (_) {
              return null;
            }
          })
        );

        if (isMounted) {
          setPhotosMap(prev => {
            const next = { ...prev };
            results.forEach(r => {
              if (r && r.url) {
                if (r.id) next[r.id] = r.url;
                if (r.formNo) next[r.formNo] = r.url;
                if (r.boardReg) next[r.boardReg] = r.url;
              }
            });
            return next;
          });
        }
      }
    })();

    return () => { isMounted = false; };
  }, [filteredStudents]);

  const getResolvedStudentPhoto = (s) => {
    return (
      photosMap[s.id] ||
      photosMap[s.formNo] ||
      photosMap[s.boardReg] ||
      s.directPhoto ||
      getStudentPhotoUrl(s.raw || s, '') ||
      ''
    );
  };

  // 10 Students Per Page Chunks for Legal Print Layout
  const STUDENTS_PER_PAGE = 10;
  const pageChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < filteredStudents.length; i += STUDENTS_PER_PAGE) {
      chunks.push(filteredStudents.slice(i, i + STUDENTS_PER_PAGE));
    }
    return chunks;
  }, [filteredStudents]);

  // Consolidated Summary Breakdown Stats
  const summaryStats = useMemo(() => {
    const map = {};
    filteredStudents.forEach(s => {
      const c = s.class || '11th';
      const str = s.stream || 'General';
      if (!map[c]) map[c] = {};
      if (!map[c][str]) map[c][str] = { male: 0, female: 0, total: 0 };
      const isFemale = s.gender.toLowerCase().startsWith('f');
      if (isFemale) map[c][str].female++;
      else map[c][str].male++;
      map[c][str].total++;
    });
    return map;
  }, [filteredStudents]);

  // Total Counts
  const overallSummaryTotals = useMemo(() => {
    let m = 0, f = 0, tot = 0;
    filteredStudents.forEach(s => {
      const isFemale = s.gender.toLowerCase().startsWith('f');
      if (isFemale) f++;
      else m++;
      tot++;
    });
    return { male: m, female: f, grandTotal: tot };
  }, [filteredStudents]);

  // Editable Register Notes Page State
  const [registerNotes, setRegisterNotes] = useState([
    {
      id: 1,
      text: "Details of columns with Yellow background in their header have been copied/adapted from students' response (Online Admission Form); remaining details have been verified from original records."
    },
    {
      id: 2,
      text: "The students with the comment 'Internal (HSS Shangus)' under the 'Admtd. Vide DC/CC' column studied their previous class at Govt Hr Sec School Shangus. Admission was granted based on mark sheets and internal promotion records."
    },
    {
      id: 3,
      text: "Abbreviations of Subjects used: BI (Biology), CH (Chemistry), EC (Economics), ED (Education), EN (General English), ES (Environmental Science), HT (History), HTC (Healthcare), ITE (IT & ITES), MA (Mathematics), PD (Physical Education), PH (Physics), PS (Political Science), and UR (Urdu)."
    },
    {
      id: 4,
      text: "Fresh admission numbers have been assigned to students re-joining after an academic gap or those readmitted due to non-appearance in prior exams. Previous admission numbers are recorded in brackets for historical auditing."
    }
  ]);

  const handleAddNote = () => {
    const newId = registerNotes.length > 0 ? Math.max(...registerNotes.map(n => n.id)) + 1 : 1;
    setRegisterNotes([...registerNotes, { id: newId, text: 'New verification note or institutional remark...' }]);
  };

  const handleRemoveNote = (id) => {
    setRegisterNotes(registerNotes.filter(n => n.id !== id));
  };

  const handleUpdateNote = (id, newText) => {
    setRegisterNotes(registerNotes.map(n => n.id === id ? { ...n, text: newText } : n));
  };

  // -------------------------------------------------------------
  // ASSIGN IDs ENGINE STATE & LOGIC
  // -------------------------------------------------------------
  const [assignStartId, setAssignStartId] = useState('5476');
  const [assigningIds, setAssigningIds] = useState(false);
  const [assignClasses, setAssignClasses] = useState(['9th', '11th']);
  const [assignSessionFilter, setAssignSessionFilter] = useState('2025-26');
  const [onlyMissingAdmNo, setOnlyMissingAdmNo] = useState(true);
  const [assignStrategies, setAssignStrategies] = useState({});

  const calculatedNextAdmNo = useMemo(() => {
    let maxId = 5000;
    normalizedStudents.forEach(s => {
      const num = parseInt(s.admNo, 10);
      if (!isNaN(num) && num > maxId && num < 99999) {
        maxId = num;
      }
    });
    return String(maxId + 1);
  }, [normalizedStudents]);

  useEffect(() => {
    if (calculatedNextAdmNo && (!assignStartId || assignStartId === '5476')) {
      setAssignStartId(calculatedNextAdmNo);
    }
  }, [calculatedNextAdmNo]);

  const candidateAssignStudents = useMemo(() => {
    return normalizedStudents.filter(st => {
      if (assignSessionFilter !== 'ALL' && st.session !== assignSessionFilter) return false;
      if (assignClasses.length > 0) {
        const match = assignClasses.some(c => matchesClassVal(c, st.class));
        if (!match) return false;
      }
      if (onlyMissingAdmNo) {
        if (st.admNo && st.admNo !== '—' && st.admNo !== 'N/A') return false;
      }
      return true;
    });
  }, [normalizedStudents, assignSessionFilter, assignClasses, onlyMissingAdmNo]);

  const candidateIdPreviewList = useMemo(() => {
    let seqCounter = parseInt(assignStartId, 10) || 5476;
    return candidateAssignStudents.map(st => {
      const reg = st.boardReg;
      let prevInfo = null;
      if (reg && reg.length > 5) {
        const histMatch = (historyDataset || []).find(h => {
          const hReg = cleanStr(h.boardRegNo || h['Board Registration Number']);
          const hAdm = cleanStr(h.admNo || h['Adm. No.']);
          return hReg === reg && hAdm && h.id !== st.id;
        });
        if (histMatch) {
          prevInfo = {
            admNo: cleanStr(histMatch.admNo || histMatch['Adm. No.']),
            class: cleanStr(histMatch.class || histMatch.Class || '10th'),
            session: cleanStr(histMatch.session || histMatch.Session || '')
          };
        }
      }

      const userStrat = assignStrategies[st.id];
      const strat = userStrat || (prevInfo ? 'inherit_prev' : 'assign_new');

      let proposed = '—';
      if (strat === 'assign_new') {
        proposed = String(seqCounter);
        seqCounter++;
      } else if (strat === 'inherit_prev' && prevInfo) {
        proposed = prevInfo.admNo;
      } else if (strat === 'skip') {
        proposed = st.admNo || '—';
      }

      return {
        student: st,
        currentAdm: st.admNo,
        prevInfo,
        strat,
        proposed
      };
    });
  }, [candidateAssignStudents, assignStartId, assignStrategies, historyDataset]);

  const handleRunAssignIds = async () => {
    if (candidateIdPreviewList.length === 0) {
      setToast({ message: '⚠️ No eligible students selected for assignment.', type: 'error' });
      return;
    }

    setAssigningIds(true);
    let count = 0;
    try {
      const batch = writeBatch(db);
      const todayDate = new Date().toISOString().split('T')[0];

      for (const item of candidateIdPreviewList) {
        const { student, proposed, strat } = item;
        if (!proposed || proposed === '—' || strat === 'skip') continue;

        const docRef = doc(db, 'admissions', student.id);
        const payload = {
          'Adm. No.': proposed,
          admNo: proposed,
          'Adm. Date': student.admDate || todayDate,
          updatedAt: new Date().toISOString(),
          lastEditedBy: `Admin (${user?.email || 'Assign IDs'})`
        };
        batch.set(docRef, payload, { merge: true });
        updateCachedItem('admissions', student.id, payload);
        count++;
      }

      await batch.commit();

      await logAdminActivity({
        actionType: 'batch_id_assign',
        actionTitle: 'Bulk Assigned Admission Numbers',
        details: `Assigned admission numbers to ${count} students in session ${assignSessionFilter}.`,
        metadata: { count, session: assignSessionFilter }
      });

      setToast({ message: `✨ Successfully assigned Admission Numbers to ${count} students!`, type: 'success' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Assign IDs batch error:', err);
      setToast({ message: `❌ Error assigning IDs: ${err.message}`, type: 'error' });
    } finally {
      setAssigningIds(false);
    }
  };

  // -------------------------------------------------------------
  // ASSIGN DATES ENGINE STATE & LOGIC
  // -------------------------------------------------------------
  const [assignDateValue, setAssignDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [assignDateField, setAssignDateField] = useState('admDate');
  const [assignDateSession, setAssignDateSession] = useState('2025-26');
  const [assignDateClass, setAssignDateClass] = useState('ALL');
  const [assigningDates, setAssigningDates] = useState(false);

  const dateTargetStudents = useMemo(() => {
    return normalizedStudents.filter(st => {
      if (assignDateSession !== 'ALL' && st.session !== assignDateSession) return false;
      if (assignDateClass !== 'ALL' && !matchesClassVal(assignDateClass, st.class)) return false;
      return true;
    });
  }, [normalizedStudents, assignDateSession, assignDateClass]);

  const handleRunAssignDates = async () => {
    if (dateTargetStudents.length === 0) {
      setToast({ message: '⚠️ No students match the selected session and class scope.', type: 'error' });
      return;
    }
    setAssigningDates(true);
    try {
      const batch = writeBatch(db);
      const fieldKey = assignDateField === 'admDate' ? 'Adm. Date' : 'Online Subm. Date';
      const aliasKey = assignDateField === 'admDate' ? 'admDate' : 'onlineSubmDate';

      for (const st of dateTargetStudents) {
        const docRef = doc(db, 'admissions', st.id);
        const payload = {
          [fieldKey]: assignDateValue,
          [aliasKey]: assignDateValue,
          updatedAt: new Date().toISOString(),
          lastEditedBy: `Admin (${user?.email || 'Assign Dates'})`
        };
        batch.set(docRef, payload, { merge: true });
        updateCachedItem('admissions', st.id, payload);
      }

      await batch.commit();

      await logAdminActivity({
        actionType: 'batch_date_assign',
        actionTitle: `Bulk Assigned ${assignDateField === 'admDate' ? 'Admission Date' : 'Submission Date'}`,
        details: `Assigned date ${assignDateValue} to ${dateTargetStudents.length} students.`,
        metadata: { date: assignDateValue, count: dateTargetStudents.length }
      });

      setToast({ message: `✨ Applied date (${assignDateValue}) to ${dateTargetStudents.length} records!`, type: 'success' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Assign Dates error:', err);
      setToast({ message: `❌ Failed to assign dates: ${err.message}`, type: 'error' });
    } finally {
      setAssigningDates(false);
    }
  };

  // Native Excel (.xlsx) Export for Admission Register and Sentup
  const handleExportExcel = () => {
    if (filteredStudents.length === 0) return;

    if (activeTab === 'adm_register') {
      const headers = [
        'S.No.', 'Class Roll No.', 'Form No.', 'Status', 'Online Subm.', 'Adm. Date', 'Adm. No.', 'Class', 'Board Reg. No.',
        "Student's Name", "Father's Name", "Mother's Name", 'DOB (Figures)', 'DOB (Words)', 'Gender',
        'Village/Town', 'Block', 'Tehsil', 'District', 'Student Mobile', 'Parent Mobile',
        'Stream', 'Chosen Subjects', 'Aadhaar No.', 'Social Category', 'Socio-Economic Category', 'Blood Group',
        'Bank Account No.', 'IFSC Code', 'PEN (UDISE)', 'Previous School', 'Prev Roll No', 'Prev Result',
        'Admtd. Vide DC/CC', 'Withdrawal Date', 'Remarks'
      ];

      const rows = filteredStudents.map(s => [
        s.sno,
        s.rollNo || '',
        s.formNo || '',
        s.status || '',
        s.onlineStatus || '',
        s.admDate || '',
        s.admNo || '',
        s.class || '',
        s.boardReg || '',
        s.name || '',
        s.father || '',
        s.mother || '',
        s.dobFigures || '',
        s.dobWords || '',
        s.gender || '',
        s.village || '',
        s.block || '',
        s.tehsil || '',
        s.district || '',
        s.mobile || '',
        s.parentMobile || '',
        s.stream || '',
        s.subs || '',
        s.aadhar || '',
        s.category || '',
        s.socioEcon || '',
        s.blood || '',
        s.account || '',
        s.ifsc || '',
        s.pen || '',
        s.prevSchool || '',
        s.prevRoll || '',
        s.prevResult || '',
        s.prevCC || '',
        s.withdrawal || '',
        s.remarks || ''
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Admission_Register');
      const filename = `HSS_Shangus_Official_Admission_Register_${selectedSession}_${selectedClass}_${selectedStatus}.xlsx`;
      XLSX.writeFile(wb, filename);
    } else {
      const headers = [
        'S.No.', 'Adm. No.', 'Class Roll No.', 'Status', 'Board Reg. No.', "Student's Name", "Father's Name", "Mother's Name",
        'Date of Birth', 'Class', 'Session', 'Stream', 'Subjects', 'Board Roll No.', 'Result'
      ];

      const rows = filteredStudents.map(s => [
        s.sno,
        s.admNo || '',
        s.rollNo || '',
        s.status || '',
        s.boardReg || '',
        s.name || '',
        s.father || '',
        s.mother || '',
        s.dobFigures || '',
        s.class || '',
        s.session || '',
        s.stream || '',
        s.subs || '',
        s.raw?.exam_r_no_current || '',
        s.raw?.result_current || ''
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'JKBOSE_Sentup');
      const filename = `HSS_Shangus_JKBOSE_Sentup_${selectedSession}_${selectedClass}_${selectedStatus}.xlsx`;
      XLSX.writeFile(wb, filename);
    }
  };

  return (
    <div className="admission-suite-root min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* ─── DYNAMIC PRINT CSS STYLESHEET (STRICT CLEAN LEGAL LANDSCAPE) ─── */}
      <style>{`
        @page {
          size: 355.6mm 215.9mm landscape !important;
          margin: ${printMargin}in !important;
        }
        @media print {
          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Suppress ALL injected header/footer watermarks and accessibility skip buttons */
          body::before, body::after, html::before, html::after, .ui-skip-link {
            display: none !important;
            content: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Strict Print Isolation: Hide all outer headers, portals, toolbars, buttons, ribbons */
          header, nav, footer, aside, .navbar, .portal-header, .admin-header, [role="navigation"], .no-print, button, select, input, .fixed, .sticky, .global-hud {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Ensure parent themes don't apply backgrounds or borders during print */
          .admin-dashboard-theme, .workspace-card, .admin-dashboard-theme > div {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .admission-suite-root {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            transform: none !important;
          }

          .spread-container {
            display: block !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .page-container {
            display: block !important;
            margin: 0 0 ${printMargin}in 0 !important;
            padding: ${printMargin}in !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            outline: none !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
          }

          /* Clean single 1px black borders without thick or duplicate outlines */
          table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1px solid #000000 !important;
          }

          th, td {
            border: 1px solid #111111 !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .h-yellow { background-color: #fef08a !important; }
          .h-grey { background-color: #e2e8f0 !important; }
          .h-green { background-color: #dcfce7 !important; color: #15803d !important; }
          .h-red { background-color: #fee2e2 !important; color: #b91c1c !important; }
        }
      `}</style>

      {/* ─── ULTRA-COMPACT UNIFIED 2-ROW MODERN TOOLBAR ─── */}
      <header className="no-print sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        {/* ROW 1: PRIMARY SUITE NAVIGATION & ACTIONS */}
        <div className="max-w-[1800px] mx-auto px-3 py-1.5 flex items-center justify-between gap-2.5 flex-wrap">
          {/* Left: School Logo & Title (Back button removed) */}
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="School Logo" className="w-5 h-5 object-contain" />
            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Admission Register & Sentup Suite</span>
              {isLoadingSession ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Loading Session...
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {selectedSession}
                </span>
              )}
            </div>
          </div>

          {/* Center: Modern Segmented Switcher */}
          <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-2xs">
            {[
              { id: 'adm_register', label: 'Admission Register', icon: BookOpen },
              { id: 'sentup', label: 'Sentup Export', icon: FileCheck },
              { id: 'assign_ids', label: 'Assign IDs', icon: CreditCard },
              { id: 'assign_dates', label: 'Assign Dates', icon: Calendar }
            ].map(t => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none text-xs ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-black shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <t.icon size={13} className={active ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {(activeTab === 'adm_register' || activeTab === 'sentup') && (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="Export Official Ledger to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={13} />
                  <span>Excel</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ROW 2: DYNAMIC DATABASE FILTERS & VIEW STRIP (SINGLE COMPACT ROW) */}
        {(activeTab === 'adm_register' || activeTab === 'sentup') && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 px-3 py-1 text-xs">
            <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-2 flex-wrap">
              {/* Left Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* 1. Academic Session */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-500">Session:</span>
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="py-0.5 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-black bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess} {sess === '2025-26' ? '(Live)' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Status Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-500">Status:</span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="py-0.5 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200"
                  >
                    <option value="Approved">Approved (Has Roll: {statusCounts.approved})</option>
                    <option value="Submitted">Submitted (Pending Roll: {statusCounts.submitted})</option>
                    <option value="Provisional">Provisional ({statusCounts.provisional})</option>
                    <option value="ALL">All Records ({statusCounts.total})</option>
                  </select>
                </div>

                {/* 3. Class Scope Selector */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-500">Class:</span>
                  <div className="inline-flex rounded-lg p-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    {['ALL', ...availableClasses].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedClass(c)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                          selectedClass === c
                            ? 'bg-indigo-600 text-white shadow-2xs font-extrabold'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Stream Filter */}
                {availableStreams.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-500">Stream:</span>
                    <select
                      value={selectedStream}
                      onChange={(e) => setSelectedStream(e.target.value)}
                      className="py-0.5 px-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      <option value="ALL">All Streams</option>
                      {availableStreams.map(str => (
                        <option key={str} value={str}>{str}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 5. Quick Search */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search name, roll, reg..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 pr-2 py-0.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-36 sm:w-44 shadow-2xs"
                  />
                </div>
              </div>

              {/* Right View Switcher & Margin Settings */}
              <div className="flex items-center gap-2">
                {/* Sub-view Section Switcher */}
                {activeTab === 'adm_register' && (
                  <div className="inline-flex p-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                    {[
                      { id: 'all', label: 'All Spreads' },
                      { id: 'cover', label: 'Cover' },
                      { id: 'spreads', label: 'Ledger' },
                      { id: 'summary', label: 'Summary' },
                      { id: 'notes', label: 'Notes' },
                    ].map(sec => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setRegisterViewSection(sec.id)}
                        className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all ${
                          registerViewSection === sec.id
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Side-by-Side Dual Spread View Mode Switcher */}
                {activeTab === 'adm_register' && (
                  <button
                    type="button"
                    onClick={() => setSpreadLayoutMode(prev => prev === 'side_by_side' ? 'stacked' : 'side_by_side')}
                    className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 shadow-2xs ${
                      spreadLayoutMode === 'side_by_side'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-700'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                    title="Toggle Side-by-Side Book View vs Stacked Pages"
                  >
                    <Columns size={12} />
                    <span>{spreadLayoutMode === 'side_by_side' ? 'Side-by-Side View' : 'Stacked View'}</span>
                  </button>
                )}

                {/* Dynamic Margins Button & Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMarginControls(prev => !prev)}
                    className="px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer hover:bg-slate-100 shadow-2xs"
                    title="Configure Print Margins (Default 0.3in on Legal)"
                  >
                    <Sliders size={11} className="text-indigo-600" />
                    <span>Margin: <strong>{printMargin}in</strong></span>
                  </button>

                  {showMarginControls && (
                    <div className="absolute right-0 mt-1 w-52 p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>Dynamic Margins:</span>
                        <span className="font-mono text-indigo-600">{printMargin} in</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.8"
                        step="0.05"
                        value={printMargin}
                        onChange={(e) => setPrintMargin(parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-indigo-600"
                      />
                      <div className="grid grid-cols-4 gap-1 pt-0.5">
                        {[0.2, 0.3, 0.4, 0.5].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPrintMargin(m)}
                            className={`py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              printMargin === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                            }`}
                          >
                            {m}" {m === 0.3 ? '★' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Zoom Controls */}
                <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-slate-900 px-1 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.max(0.6, Math.round((prev - 0.1) * 10) / 10))}
                    className="p-0.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut size={11} />
                  </button>
                  <span className="px-1 text-[10.5px] font-mono font-bold">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10))}
                    className="p-0.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn size={11} />
                  </button>
                </div>

                {/* Record count badge */}
                <div className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-black whitespace-nowrap shadow-2xs">
                  {filteredStudents.length} Students ({pageChunks.length} Spreads)
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─── TOAST NOTIFICATION ─── */}
      {toast && (
        <div className="no-print fixed top-14 right-4 z-50 animate-bounce">
          <div className={`px-3.5 py-2 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500'
          }`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="opacity-80 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        </div>
      )}

      {/* ─── MAIN PREVIEW CONTAINER ─── */}
      <main className="flex-1 p-2 sm:p-5 overflow-x-auto">
        <div className="max-w-full mx-auto">
          {/* ============================================================== */}
          {/* TAB 1: ADMISSION REGISTER (PRINT-READY DUAL SPREAD)            */}
          {/* ============================================================== */}
          {activeTab === 'adm_register' && (
            <div className="space-y-6" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
              {/* 1. COVER PAGE (FEATURING OFFICIAL SCHOOL LOGO) */}
              {(registerViewSection === 'all' || registerViewSection === 'cover') && (
                <div
                  className="page-container cover-page bg-white rounded-xl border border-slate-300 shadow-sm text-center flex flex-col items-center justify-center min-h-[215.9mm] max-w-[355.6mm] mx-auto page-break-after"
                  style={{ padding: `${printMargin}in` }}
                >
                  <img
                    src="/logo.png"
                    alt="Govt. HSS Shangus Logo"
                    className="w-24 h-24 object-contain mb-4 filter drop-shadow-md"
                  />
                  <h1 className="text-3xl sm:text-4xl font-black text-red-800 uppercase tracking-tight mb-2 font-serif">
                    Official Admission Register
                  </h1>
                  <h2 className="text-lg sm:text-xl font-bold text-emerald-800 mb-4 font-serif">
                    Classes 11th & 12th • Academic Session {selectedSession}
                  </h2>
                  <div className="w-36 h-1 bg-red-800 mb-5 rounded-full"></div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase">
                    {SCHOOL_NAME}
                  </h3>
                  <p className="text-xs font-bold text-slate-600 mt-1">
                    {SCHOOL_SUBTITLE}
                  </p>
                  <div className="mt-12 text-[11px] font-semibold text-slate-500 border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                    Total Enrolled Approved Candidates: <strong>{filteredStudents.length}</strong> • Formatted for Physical Legal Archives
                  </div>
                </div>
              )}

              {/* 2. DUAL-SPREAD REGISTER PAGES */}
              {(registerViewSection === 'all' || registerViewSection === 'spreads') && (
                pageChunks.map((chunk, chunkIdx) => {
                  const pageNum = chunkIdx + 1;
                  return (
                    <div
                      key={pageNum}
                      className={`spread-container page-break-after ${
                        spreadLayoutMode === 'side_by_side'
                          ? 'flex flex-col 2xl:flex-row gap-3 max-w-full mx-auto items-stretch'
                          : 'flex flex-col gap-4 max-w-[355.6mm] mx-auto'
                      }`}
                    >
                      {/* LEFT PAGE: PART 1 (Personal & Contact Details) */}
                      <div
                        className={`page-container bg-white rounded-xl border border-slate-300 shadow-sm ${
                          spreadLayoutMode === 'side_by_side' ? 'flex-1 min-w-[50%]' : 'w-full'
                        }`}
                        style={{ padding: `${printMargin}in` }}
                      >
                        <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-2">
                          <div className="text-[10px] font-bold text-slate-600">(Part 1 - Identification & Contact Details)</div>
                          <div className="text-center">
                            <h2 className="text-sm font-black text-red-800 uppercase leading-none">{SCHOOL_NAME}</h2>
                            <div className="text-[9px] font-bold text-emerald-800 mt-0.5">
                              Admission Register • Session {selectedSession} • {selectedStatus} Records
                            </div>
                          </div>
                          {/* Blank circle for manual hand-stamping of serial number */}
                          <div
                            className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-mono text-transparent select-none"
                            title="Manual Serial / Page Number Stamp Area"
                          >
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[8.5px] border-collapse border border-slate-900">
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 uppercase font-black text-center">
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-6 h-grey">S.No.</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-10 h-grey">Photo</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-8 h-grey">Class Roll</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-12 h-grey">Form No.</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-12 h-grey">Online Subm.</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-12 h-grey">Adm. Date</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-12 h-grey">Adm. No.</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-8 h-grey">Class</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-24 h-grey">Board Reg. No.</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-28 text-left pl-2 h-grey">Student's Name</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center h-grey">Parentage</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center h-grey">Date of Birth</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-10 h-grey">Gender</th>
                                <th colSpan="4" className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-200 text-slate-900 h-yellow">Residence</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-200 text-slate-900 h-yellow">Contact</th>
                              </tr>
                              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[7.5px]">
                                <th className="border border-slate-900 px-1 py-0.5 h-grey">Father's Name</th>
                                <th className="border border-slate-900 px-1 py-0.5 h-grey">Mother's Name</th>
                                <th className="border border-slate-900 px-1 py-0.5 w-14 h-grey">Figures</th>
                                <th className="border border-slate-900 px-1 py-0.5 w-24 h-grey">In Words</th>
                                <th className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">Village/Town</th>
                                <th className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">Block</th>
                                <th className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">Tehsil</th>
                                <th className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">District</th>
                                <th className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">Student Mobile</th>
                                <th className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">Parent Mobile</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-900">
                              {chunk.map((s) => {
                                const photoSrc = getResolvedStudentPhoto(s);
                                return (
                                  <tr key={s.id} className="h-11 hover:bg-slate-50">
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.sno}</td>
                                    <td className="border border-slate-900 p-0 text-center w-10 h-11 overflow-hidden bg-slate-50 print:bg-transparent">
                                      {photoSrc ? (
                                        <img
                                          src={photoSrc}
                                          alt={s.name}
                                          className="w-full h-full object-cover"
                                          loading="eager"
                                          crossOrigin="anonymous"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            if (e.currentTarget.nextElementSibling) {
                                              e.currentTarget.nextElementSibling.style.display = 'flex';
                                            }
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-full h-full items-center justify-center text-[7px] text-slate-400 font-bold ${photoSrc ? 'hidden' : 'flex'}`}>
                                        Photo
                                      </div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-indigo-700">{s.rollNo}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.formNo}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center text-[7.5px]">{s.onlineStatus}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-semibold">{s.admDate}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-emerald-800 text-[9.5px]">{s.admNo}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.class}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center">{formatBoardRegSplit(s.boardReg)}</td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left font-black uppercase">{s.name}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left uppercase text-[8px]">{s.father}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left uppercase text-[8px]">{s.mother}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-mono">{s.dobFigures}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px] leading-tight font-serif">{s.dobWords}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-semibold">{s.gender}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.village}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.block}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.tehsil}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.district}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-mono">{s.mobile}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-mono">{s.parentMobile}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Signatures */}
                        <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-300 text-[11px] font-black text-red-800">
                          <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Incharge Admissions</div>
                          <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Checked By</div>
                          <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Principal</div>
                        </div>
                      </div>

                      {/* RIGHT PAGE: PART 2 (Academic, Category & Receipt Ledger) */}
                      <div
                        className={`page-container bg-white rounded-xl border border-slate-300 shadow-sm ${
                          spreadLayoutMode === 'side_by_side' ? 'flex-1 min-w-[50%]' : 'w-full'
                        }`}
                        style={{ padding: `${printMargin}in` }}
                      >
                        <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-2">
                          <div className="text-[10px] font-bold text-slate-600">(Part 2 - Academic Details & Ledger)</div>
                          <div className="text-center">
                            <h2 className="text-sm font-black text-red-800 uppercase leading-none">{SCHOOL_NAME}</h2>
                            <div className="text-[9px] font-bold text-emerald-800 mt-0.5">
                              Admission Register • Session {selectedSession} • {selectedStatus} Records
                            </div>
                          </div>
                          {/* Blank circle for manual hand-stamping of serial number */}
                          <div
                            className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-mono text-transparent select-none"
                            title="Manual Serial / Page Number Stamp Area"
                          >
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[8.5px] border-collapse border border-slate-900">
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 uppercase font-black text-center">
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-12 h-grey">Stream</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-24 h-grey">Subjects</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-20 bg-yellow-200 text-slate-900 h-yellow">Aadhaar No.</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-8 bg-yellow-200 text-slate-900 h-yellow">Soc. Cat.</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-8 bg-yellow-200 text-slate-900 h-yellow">Socio-Econ</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-8 bg-yellow-200 text-slate-900 h-yellow">Blood</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-20 bg-yellow-200 text-slate-900 h-yellow">A/C No.</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-16 bg-yellow-200 text-slate-900 h-yellow">IFSC</th>
                                <th colSpan="3" className="border border-slate-900 px-1 py-0.5 text-center h-grey">Previous Academic Record</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-16 h-grey">PEN (UDISE)</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-16 text-emerald-800 bg-emerald-100 h-green">Admtd. Vide DC/CC</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-14 text-red-800 bg-red-100 h-red">Withdrawal</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-16 text-red-800 bg-red-100 h-red">Issued DC/CC</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-32 text-red-800 bg-red-100 h-red">Receipt</th>
                                <th rowSpan="2" className="border border-slate-900 px-1 py-1 w-20 h-grey">Remarks</th>
                              </tr>
                              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[7.5px]">
                                <th className="border border-slate-900 px-1 py-0.5 h-grey">Previous School</th>
                                <th className="border border-slate-900 px-1 py-0.5 w-12 h-grey">Prev Roll</th>
                                <th className="border border-slate-900 px-1 py-0.5 w-12 h-grey">Prev Result</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-900">
                              {chunk.map((s) => (
                                <tr key={s.id} className="h-11 hover:bg-slate-50">
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.stream}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px] leading-tight font-medium">{s.subs}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono bg-yellow-50">{s.aadhar}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-black">{s.category}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50">{s.socioEcon}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-bold">{s.blood}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[7.5px] bg-yellow-50">{s.account}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[7.5px] bg-yellow-50">{s.ifsc}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7.5px] leading-tight">{s.prevSchool}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono">{s.prevRoll}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.prevResult}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[7.5px]">{s.pen}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-emerald-800 font-bold text-[7px] bg-emerald-50">{s.prevCC}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-red-800 text-[7.5px] bg-red-50">{s.withdrawal}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[6.5px] bg-red-50 leading-tight">
                                    <div>C.No. _______</div>
                                    <div>Dt. _______</div>
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[6.5px] leading-tight bg-red-50">
                                    <div>Received DC/CC vide C. No. ___</div>
                                    <div>On _______ Sig. _______</div>
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px]">{s.remarks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Signatures */}
                        <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-300 text-[11px] font-black text-red-800">
                          <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Incharge Admissions</div>
                          <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Checked By</div>
                          <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Principal</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* 3. CONSOLIDATED SUMMARY PAGE */}
              {(registerViewSection === 'all' || registerViewSection === 'summary') && (
                <div
                  className="page-container bg-white rounded-xl border border-slate-300 shadow-sm max-w-[355.6mm] mx-auto page-break-after"
                  style={{ padding: `${printMargin}in` }}
                >
                  <div className="text-center border-b-2 border-red-800 pb-3 mb-4">
                    <h1 className="text-xl font-black text-red-800 uppercase tracking-wide">
                      Consolidated Admission Statement
                    </h1>
                    <h2 className="text-xs font-extrabold text-slate-700 mt-0.5">
                      Roll & Enrollment Statement for Session {selectedSession} • {SCHOOL_NAME}
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse border-2 border-red-800 text-xs">
                      <thead>
                        <tr className="bg-red-100 text-slate-900 font-black">
                          <th className="border-2 border-red-800 p-2">Class</th>
                          <th className="border-2 border-red-800 p-2 text-left pl-4">Stream</th>
                          <th className="border-2 border-red-800 p-2 w-20">Male</th>
                          <th className="border-2 border-red-800 p-2 w-20">Female</th>
                          <th className="border-2 border-red-800 p-2 w-20">Total</th>
                          <th className="border-2 border-red-800 p-2 w-28">Class Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-red-800 font-bold text-slate-900">
                        {Object.keys(summaryStats).sort().map(cls => {
                          const streams = Object.keys(summaryStats[cls]).sort();
                          const clsTotal = Object.values(summaryStats[cls]).reduce((acc, curr) => acc + curr.total, 0);
                          return streams.map((st, idx) => {
                            const item = summaryStats[cls][st];
                            return (
                              <tr key={`${cls}_${st}`} className="hover:bg-red-50/50">
                                {idx === 0 && (
                                  <td rowSpan={streams.length} className="border-2 border-red-800 p-1.5 font-black text-base bg-slate-50">
                                    {cls}
                                  </td>
                                )}
                                <td className="border-2 border-red-800 p-1.5 text-left pl-4 font-semibold">{st}</td>
                                <td className="border-2 border-red-800 p-1.5">{item.male}</td>
                                <td className="border-2 border-red-800 p-1.5">{item.female}</td>
                                <td className="border-2 border-red-800 p-1.5 font-black">{item.total}</td>
                                {idx === 0 && (
                                  <td rowSpan={streams.length} className="border-2 border-red-800 p-1.5 font-black text-lg text-red-800 bg-red-50/60">
                                    {clsTotal}
                                  </td>
                                )}
                              </tr>
                            );
                          });
                        })}
                        <tr className="bg-red-200 text-red-900 font-black text-sm">
                          <td colSpan="2" className="border-2 border-red-800 p-2 text-right pr-4">Overall Grand Total</td>
                          <td className="border-2 border-red-800 p-2">{overallSummaryTotals.male}</td>
                          <td className="border-2 border-red-800 p-2">{overallSummaryTotals.female}</td>
                          <td colSpan="2" className="border-2 border-red-800 p-2 text-base">{overallSummaryTotals.grandTotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Institutional Certification Paragraph */}
                  <div className="mt-5 p-3 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-serif leading-relaxed text-slate-800">
                    <p className="font-bold mb-0.5">Institutional Certification:</p>
                    <p>
                      Certified that the above-mentioned <strong>{overallSummaryTotals.grandTotal}</strong> students have been formally admitted to <strong>{SCHOOL_NAME}</strong> for the academic session <strong>{selectedSession}</strong>. Their credentials, eligibility, dates of birth, marks certificates, and categories as entered in this official ledger have been verified against original Board/School records and found correct in all respects.
                    </p>
                  </div>

                  {/* Footer Signatures */}
                  <div className="flex justify-between items-center mt-7 pt-3 border-t-2 border-red-800 text-[11px] font-black text-red-800">
                    <div className="text-center w-36 border-t-2 border-red-800 pt-1">Incharge Admissions</div>
                    <div className="text-center w-36 border-t-2 border-red-800 pt-1">Checked By</div>
                    <div className="text-center w-36 border-t-2 border-red-800 pt-1">Principal</div>
                  </div>
                </div>
              )}

              {/* 4. EDITABLE OFFICIAL NOTES PAGE */}
              {(registerViewSection === 'all' || registerViewSection === 'notes') && (
                <div
                  className="page-container bg-white rounded-xl border border-slate-300 shadow-sm max-w-[355.6mm] mx-auto"
                  style={{ padding: `${printMargin}in` }}
                >
                  <div className="flex items-center justify-between border-b-2 border-red-800 pb-2 mb-3">
                    <h1 className="text-lg font-black text-red-800 uppercase">
                      Official Explanatory Notes & Ledger Annexure
                    </h1>
                    <button
                      type="button"
                      onClick={handleAddNote}
                      className="no-print px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add Note</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-400 text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 font-black">
                          <th className="border border-slate-400 p-1.5 w-10 text-center">#</th>
                          <th className="border border-slate-400 p-1.5 text-left">Explanatory Note / Directive</th>
                          <th className="no-print border border-slate-400 p-1.5 w-10 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 text-slate-800">
                        {registerNotes.map((note, idx) => (
                          <tr key={note.id}>
                            <td className="border border-slate-400 p-1.5 text-center font-bold bg-slate-50">{idx + 1}</td>
                            <td className="border border-slate-400 p-1.5 font-medium">
                              <textarea
                                value={note.text}
                                onChange={(e) => handleUpdateNote(note.id, e.target.value)}
                                rows={2}
                                className="w-full p-1 border border-transparent hover:border-slate-300 focus:border-amber-500 rounded bg-transparent text-[11px] font-medium resize-y focus:bg-white"
                              />
                            </td>
                            <td className="no-print border border-slate-400 p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveNote(note.id)}
                                className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                                title="Delete Note"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Signatures */}
                  <div className="flex justify-between items-center mt-7 pt-3 border-t-2 border-red-800 text-[11px] font-black text-red-800">
                    <div className="text-center w-36 border-t-2 border-red-800 pt-1">Incharge Admissions</div>
                    <div className="text-center w-36 border-t-2 border-red-800 pt-1">Checked By</div>
                    <div className="text-center w-36 border-t-2 border-red-800 pt-1">Principal</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: SENTUP EXPORT (JKBOSE THEMED CANDIDATE ROLL SHEET)       */}
          {/* ============================================================== */}
          {activeTab === 'sentup' && (
            <div className="space-y-6" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
              {pageChunks.map((chunk, idx) => {
                const pageNum = idx + 1;
                const is12th = selectedClass.includes('12');
                const themeHeaderBg = is12th ? 'bg-rose-900 text-white' : 'bg-sky-800 text-white';

                return (
                  <div
                    key={pageNum}
                    className="page-container bg-white rounded-xl border border-slate-300 shadow-sm max-w-[355.6mm] mx-auto page-break-after"
                    style={{ padding: `${printMargin}in` }}
                  >
                    {/* Header */}
                    <div className="text-center border-b border-slate-900 pb-1 mb-2 relative">
                      <div className="absolute left-0 top-0 text-[10px] font-bold text-slate-500">Candidate Roll Sheet</div>
                      <h1 className="text-base font-black text-red-800 uppercase tracking-tight">{SCHOOL_NAME}</h1>
                      <div className="text-[9.5px] font-bold text-slate-800 mt-0.5">
                        JKBOSE Sentup Roll Sheet • Class {selectedClass} • Session {selectedSession} • {selectedStatus} Candidates
                      </div>
                      <div className="absolute right-0 top-0 w-5 h-5 rounded-full border border-slate-900 text-center text-[9px] font-black leading-4 text-transparent select-none">
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[9px] border-collapse border border-slate-900">
                        <thead>
                          <tr className={`${themeHeaderBg} uppercase font-black text-center text-[8.5px]`}>
                            <th className="border border-slate-900 px-1 py-1 w-10">S.No.<br /><span className="text-[7px] opacity-80">[Adm No.]</span></th>
                            <th className="border border-slate-900 px-1 py-1 w-10">Class<br />Roll No.</th>
                            <th className="border border-slate-900 px-1 py-1 w-10">Photo</th>
                            <th className="border border-slate-900 px-1 py-1 w-24">Board<br />Reg. No.</th>
                            <th className="border border-slate-900 px-1 py-1 w-32 text-left pl-2">Student's Name</th>
                            <th className="border border-slate-900 px-1 py-1 w-32 text-left pl-2">Parentage<br /><span className="text-[6.5px] opacity-80">(Father / Mother)</span></th>
                            <th className="border border-slate-900 px-1 py-1 w-16">Date of Birth</th>
                            <th className="border border-slate-900 px-1 py-1 w-16">Subjects</th>
                            <th className="border border-slate-900 px-1 py-1 w-16">Board<br />Roll No.</th>
                            <th className="border border-slate-900 px-1 py-1 w-12">Result</th>
                            <th className="border border-slate-900 px-1 py-1 w-14">Admit Card<br />Receipt</th>
                            <th className="border border-slate-900 px-1 py-1 w-36">Marks Card / Certificate Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 text-slate-900">
                          {chunk.map((s) => {
                            const photoSrc = getResolvedStudentPhoto(s);
                            return (
                              <tr key={s.id} className="h-12 hover:bg-slate-50">
                                <td className="border border-slate-900 px-1 py-0.5 text-center">
                                  <div className="font-black text-xs">{s.sno}</div>
                                  <div className="text-[7.5px] font-mono text-slate-500">[{s.admNo || '—'}]</div>
                                </td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-sm text-sky-800">{s.rollNo}</td>
                                <td className="border border-slate-900 p-0 text-center w-10 h-12 overflow-hidden bg-slate-50 print:bg-transparent">
                                  {photoSrc ? (
                                    <img
                                      src={photoSrc}
                                      alt={s.name}
                                      className="w-full h-full object-cover"
                                      loading="eager"
                                      crossOrigin="anonymous"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        if (e.currentTarget.nextElementSibling) {
                                          e.currentTarget.nextElementSibling.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full items-center justify-center text-[7px] text-slate-400 font-bold ${photoSrc ? 'hidden' : 'flex'}`}>
                                    Photo
                                  </div>
                                </td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center">{formatBoardRegSplit(s.boardReg)}</td>
                                <td className="border border-slate-900 px-2 py-0.5 text-left font-black uppercase text-[10px]">{s.name}</td>
                                <td className="border border-slate-900 px-2 py-0.5 text-left uppercase text-[8.5px] leading-tight">
                                  <div className="font-bold border-b border-slate-200 pb-0.5">{s.father}</div>
                                  <div className="text-slate-500 text-[7.5px] pt-0.5">{s.mother}</div>
                                </td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[8.5px]">{s.dobFigures}</td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center text-[7.5px] leading-tight font-medium">
                                  {s.subs ? s.subs.split(',').map((sub, i) => <div key={i}>{sub.trim()}</div>) : '—'}
                                </td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center font-mono font-bold text-xs">{s.raw?.exam_r_no_current || '—'}</td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center font-bold text-[8.5px]">{s.raw?.result_current || '—'}</td>
                                <td className="border border-slate-900 p-1 text-center align-bottom text-[7.5px]">
                                  <div className="border-t border-slate-900 pt-0.5">Signature</div>
                                </td>
                                <td className="border border-slate-900 p-1 text-[7.5px] leading-tight">
                                  <div className="flex justify-between gap-1 h-full">
                                    <div className="flex-1 border-r border-dashed border-slate-300 pr-1">
                                      <div className="font-bold text-[7px]">Marks Card Received</div>
                                      <div className="mt-1.5 text-[7px]">Sig. __________</div>
                                    </div>
                                    <div className="flex-1 pl-1">
                                      <div className="font-bold text-[7px]">Qual. Certificate</div>
                                      <div className="mt-1.5 text-[7px]">Sig. __________</div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Signatures */}
                    <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-300 text-[11px] font-black text-red-800">
                      <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Incharge</div>
                      <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Checked By</div>
                      <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Principal</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: ASSIGN IDs (BULK SEQUENTIAL + INHERITANCE ENGINE)        */}
          {/* ============================================================== */}
          {activeTab === 'assign_ids' && (
            <div className="space-y-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
              <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CreditCard size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Assign Admission Numbers in Bulk</span>
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    Sequential auto-numbering, inheritance via Board Reg No, and direct atomic Firestore commits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignStartId(calculatedNextAdmNo)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 flex items-center gap-1.5 cursor-pointer"
                  title="Auto-calculate next available Admission Number"
                >
                  <RefreshCw size={12} />
                  <span>Auto-Next ({calculatedNextAdmNo})</span>
                </button>
              </div>

              {/* Scope Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Session:</label>
                  <select
                    value={assignSessionFilter}
                    onChange={(e) => setAssignSessionFilter(e.target.value)}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess}</option>
                    ))}
                    <option value="ALL">All Sessions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Target Classes:</label>
                  <div className="flex items-center gap-1 flex-wrap">
                    {availableClasses.map(cls => {
                      const checked = assignClasses.includes(cls);
                      return (
                        <label
                          key={cls}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer border select-none transition-all ${
                            checked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setAssignClasses(prev => [...prev, cls]);
                              else setAssignClasses(prev => prev.filter(c => c !== cls));
                            }}
                            className="hidden"
                          />
                          <span>{cls}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Start Assigning From ID:</label>
                  <input
                    type="number"
                    value={assignStartId}
                    onChange={(e) => setAssignStartId(e.target.value)}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Scope Filter:</label>
                  <div className="flex items-center justify-between gap-1 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={onlyMissingAdmNo}
                        onChange={(e) => setOnlyMissingAdmNo(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Only Missing Adm No</span>
                    </label>
                    <span className="px-1.5 py-0.5 rounded font-bold text-[10.5px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950">
                      {candidateIdPreviewList.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Candidate Preview Table */}
              {candidateIdPreviewList.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-extrabold text-slate-700 dark:text-slate-300">
                        <tr>
                          <th className="p-2 w-10 text-center">#</th>
                          <th className="p-2">Student & Father's Name</th>
                          <th className="p-2">Class / Session</th>
                          <th className="p-2">Board Reg. No.</th>
                          <th className="p-2">Previous Adm. No. (Reg Key)</th>
                          <th className="p-2">Current Adm No</th>
                          <th className="p-2 text-center">Assignment Strategy</th>
                          <th className="p-2 text-right">Proposed ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                        {candidateIdPreviewList.map((item, idx) => {
                          const { student, currentAdm, prevInfo, strat, proposed } = item;
                          return (
                            <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-2 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-2 font-bold">
                                <div className="text-slate-900 dark:text-slate-100">{student.name}</div>
                                <div className="text-[10px] text-slate-500 font-normal">S/O: {student.father}</div>
                              </td>
                              <td className="p-2 font-bold text-indigo-600 dark:text-indigo-400">
                                {student.class} ({student.session})
                              </td>
                              <td className="p-2 font-mono text-[11px]">{student.boardReg || '—'}</td>
                              <td className="p-2 font-mono text-[11px]">
                                {prevInfo ? (
                                  <span className="px-1.5 py-0.5 rounded font-black text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800">
                                    {prevInfo.admNo} ({prevInfo.class})
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{currentAdm || '—'}</td>
                              <td className="p-2 text-center">
                                <div className="inline-flex rounded-md p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'assign_new' }))}
                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                                      strat === 'assign_new' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    Sequential
                                  </button>
                                  {prevInfo && (
                                    <button
                                      type="button"
                                      onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'inherit_prev' }))}
                                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                                        strat === 'inherit_prev' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      Inherit ({prevInfo.admNo})
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'skip' }))}
                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                                      strat === 'skip' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    Skip
                                  </button>
                                </div>
                              </td>
                              <td className="p-2 text-right font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm">
                                {proposed}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 font-semibold border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950">
                  No students match the selected class scope and missing admission number filter.
                </div>
              )}

              {/* Run Button */}
              <button
                type="button"
                onClick={handleRunAssignIds}
                disabled={assigningIds || candidateIdPreviewList.length === 0}
                className="w-full py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all text-xs"
              >
                {assigningIds ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Execute Admission ID Assignment ({candidateIdPreviewList.length} Students)</span>
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: ASSIGN DATES (BULK ADM & SUBMISSION DATE ASSIGNER)       */}
          {/* ============================================================== */}
          {activeTab === 'assign_dates' && (
            <div className="space-y-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Bulk Assign Admission & Submission Dates</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Apply a uniform Admission Date or Online Submission Date across target classes or sessions.
                </p>
              </div>

              {/* Scope & Date Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Target Date Field:</label>
                  <select
                    value={assignDateField}
                    onChange={(e) => setAssignDateField(e.target.value)}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  >
                    <option value="admDate">Admission Date (Adm. Date)</option>
                    <option value="onlineSubmDate">Online Submission Date</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Select Date:</label>
                  <input
                    type="date"
                    value={assignDateValue}
                    onChange={(e) => setAssignDateValue(e.target.value)}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Session Scope:</label>
                  <select
                    value={assignDateSession}
                    onChange={(e) => setAssignDateSession(e.target.value)}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess}</option>
                    ))}
                    <option value="ALL">All Sessions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Class Scope:</label>
                  <select
                    value={assignDateClass}
                    onChange={(e) => setAssignDateClass(e.target.value)}
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  >
                    <option value="ALL">All Classes</option>
                    {availableClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Summary Card */}
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-xs">Target Records: {dateTargetStudents.length} Students</div>
                  <div className="text-[10.5px] mt-0.5">
                    Will update <strong>{assignDateField === 'admDate' ? 'Admission Date' : 'Online Submission Date'}</strong> to <strong>{assignDateValue}</strong>.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRunAssignDates}
                  disabled={assigningDates || dateTargetStudents.length === 0}
                  className="px-4 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all text-xs"
                >
                  {assigningDates ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>Apply Date ({dateTargetStudents.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
