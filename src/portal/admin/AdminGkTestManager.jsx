import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, Trash2, Printer, ShieldAlert, CheckCircle2, UserCheck, FileText,
  Filter, AlertTriangle, Eye, X, Calendar, Clock, Save, Lock, Unlock, Download, Award,
  BookOpen, Sparkles, Sliders, ChevronDown, ChevronUp, UserPlus, Users, Edit3, ExternalLink,
  Copy, Check, ArrowUpDown, CheckSquare, Square, Layers, UserX, School, Phone, CheckCircle
} from 'lucide-react';
import {
  deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { generateGkTestAdmitCardPdf, generateBatchGkTestAdmitCardsPdf } from '../../utils/pdfGenerator';
import { getStudentPhotoUrl, formatPhotoDisplayUrl } from '../../utils/imageCompressor';
import { getCachedCollectionSync, getCachedCollection, setCachedCollectionData } from '../../services/dbCache';
import ModernLoader from '../../components/ModernLoader';

const EXAM_PRESETS = [
  {
    id: 'gk',
    label: '🏆 General Knowledge & Talent Search',
    examTitle: 'All Kashmir GK Talent Search & Competitive Examination 2026',
    examType: 'General Knowledge & Talent Search',
    duration: '120 Minutes',
    maxMarks: 100,
    instructions: [
      'Candidates must produce this printed Admit Card along with a valid Identity Proof at the examination center.',
      'Reporting time at the examination center is 30 minutes prior to commencement of the test.',
      'Electronic devices including cell phones, smart watches, and calculators are strictly banned inside the hall.',
      'Use blue or black ballpoint pen only for writing responses on the answer sheet.'
    ]
  },
  {
    id: 'science',
    label: '🔬 Science Olympiad & Innovation Challenge',
    examTitle: 'Annual Science Olympiad & Innovation Challenge 2026',
    examType: 'Science Olympiad',
    duration: '90 Minutes',
    maxMarks: 100,
    instructions: [
      'Bring your printed Admit Card and school ID card to the examination venue.',
      'Test comprises Multiple Choice Questions (MCQ) covering Physics, Chemistry, Biology & Environmental Science.',
      'Rough work must be done only on the designated pages of the question booklet.',
      'Mobile phones, digital watches, and calculators are strictly prohibited.'
    ]
  },
  {
    id: 'math',
    label: '📐 Mathematics & Logical Reasoning Talent Search',
    examTitle: 'State Mathematics & Logical Reasoning Talent Search 2026',
    examType: 'Mathematics Talent Search',
    duration: '120 Minutes',
    maxMarks: 100,
    instructions: [
      'Admit Card and geometrical instruments box (without papers) are permitted.',
      'Questions evaluate conceptual clarity, numerical aptitude, and analytical reasoning.',
      'Use blue or black ballpoint pen only on the OMR sheet.',
      'Calculators and electronic communication devices are completely banned.'
    ]
  },
  {
    id: 'nmms',
    label: '🎓 National Means-cum-Merit Scholarship (NMMS)',
    examTitle: 'NMMS Mock & Scholarship Selection Examination 2026',
    examType: 'National Scholarship (NMMS)',
    duration: '180 Minutes',
    maxMarks: 180,
    instructions: [
      'Paper consists of MAT (Mental Ability Test) and SAT (Scholastic Aptitude Test).',
      'Candidate must be seated in the examination hall 30 minutes before the scheduled time.',
      'Fill OMR circles completely and firmly with blue/black ballpoint pen.',
      'No negative marking applies unless otherwise indicated on the question paper.'
    ]
  },
  {
    id: 'ntse',
    label: '🌟 National Talent Search Examination (NTSE)',
    examTitle: 'NTSE State Level Talent Search Mock Examination 2026',
    examType: 'National Talent Search (NTSE)',
    duration: '120 Minutes',
    maxMarks: 100,
    instructions: [
      'Admit Card and Identity Proof are strictly mandatory for entry.',
      'Follow all instructions given by the center superintendent and hall invigilators.',
      'Any malpractice or possession of prohibited gadgets will result in immediate disqualification.',
      'Ensure exam roll number is correctly shaded on the OMR sheet.'
    ]
  },
  {
    id: 'aptitude',
    label: '💼 Career Aptitude & Entrance Mock Test',
    examTitle: 'Higher Secondary Career Aptitude & Entrance Mock Test 2026',
    examType: 'Career Aptitude Test',
    duration: '120 Minutes',
    maxMarks: 100,
    instructions: [
      'Designed to assess student aptitude for higher education streams and competitive exams.',
      'Please bring this printed Admit Card and a valid school photo identity card.',
      'Report to the allotted room 30 minutes prior to exam commencement.'
    ]
  }
];

function generate7DigitExamNumber() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

// ─── Printable Admit Card Modal ──────────────────────────────────────────────
function PrintableAdmitCardModal({ registration, examConfig, onClose }) {
  if (!registration) return null;

  const handleDirectPrint = () => {
    generateGkTestAdmitCardPdf({
      ...registration,
      examTitle: examConfig.examTitle,
      examDate: examConfig.examDate,
      examTime: examConfig.examTime,
      examCenter: examConfig.examCenter,
      instructions: examConfig.instructions
    });
  };

  const handleDownloadPdf = () => {
    generateGkTestAdmitCardPdf({
      ...registration,
      examTitle: examConfig.examTitle,
      examDate: examConfig.examDate,
      examTime: examConfig.examTime,
      examCenter: examConfig.examCenter,
      instructions: examConfig.instructions
    });
  };

  const student = registration;
  const initial = (student.name || '?')[0].toUpperCase();

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 relative border border-slate-200 text-slate-800 my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors print:hidden"
        >
          <X size={20} />
        </button>

        {/* Printable Card Area */}
        <div className="printable-admit-card bg-white p-5 rounded-2xl border-2 border-teal-800 space-y-3.5">
          {/* Header */}
          <div className="text-center border-b-2 border-teal-800 pb-3 space-y-1">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-teal-900">
              Govt. Higher Secondary School Shangus
            </h2>
            <p className="text-[11px] font-bold text-slate-600">Anantnag, Jammu & Kashmir — 192201</p>
            <div className="inline-block bg-teal-800 text-white text-[10.5px] font-black px-4 py-1 rounded-full uppercase tracking-widest mt-1 shadow-sm">
              {examConfig.examTitle || 'Competitive Examination Admit Card'}
            </div>
          </div>

          {/* Exam Roll Number Box */}
          <div className="bg-teal-50/60 border-2 border-dashed border-teal-800 rounded-xl p-3 text-center space-y-0.5">
            <p className="text-[9.5px] font-black uppercase tracking-widest text-teal-800">Assigned Examination Roll Number</p>
            <p className="text-3xl font-black font-mono tracking-widest text-slate-900">
              {student.examNumber || student.id}
            </p>
          </div>

          {/* Student Info & Photo */}
          <div className="grid grid-cols-3 gap-3 items-center bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            {/* Photo */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              {(() => {
                const pUrl = formatPhotoDisplayUrl(student.photoUrl || getStudentPhotoUrl(student));
                if (pUrl && pUrl !== '/logo.png' && pUrl.length > 20) {
                  return (
                    <img
                      src={pUrl}
                      alt={student.name}
                      className="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-lg border-2 border-slate-800 shadow-sm"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  );
                }
                return (
                  <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-lg bg-teal-100 border-2 border-teal-700 flex items-center justify-center text-teal-800 text-2xl sm:text-3xl font-black">
                    {initial}
                  </div>
                );
              })()}
              <span className="text-[8.5px] font-bold text-slate-400 mt-1 uppercase">Candidate Photo</span>
            </div>

            {/* Details Table */}
            <div className="col-span-2 space-y-1.5 text-xs">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Candidate Name</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm truncate block">{student.name || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Father's Name</span>
                  <span className="font-bold text-slate-800 text-xs truncate block">{student.fatherName || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Class / Stream</span>
                  <span className="font-bold text-slate-800 text-xs">{student.className || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Class Roll No.</span>
                  <span className="font-bold text-slate-800 text-xs">{student.classRollNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Reg. No. / Form No.</span>
                  <span className="font-bold font-mono text-slate-800 text-xs">{student.boardRegNo || student.formNo || 'Manual Entry'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Contact / Mobile</span>
                  <span className="font-bold font-mono text-slate-800 text-xs">{student.mobile || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Exam Schedule & Venue */}
          <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-2.5 text-xs grid grid-cols-2 gap-2 text-teal-950 font-semibold">
            <div>📅 <strong>Test Date:</strong> {examConfig.examDate || 'Sunday, 30th August 2026'}</div>
            <div>⏰ <strong>Timing:</strong> {examConfig.examTime || '11:00 AM – 01:00 PM'}</div>
            <div>📍 <strong>Venue:</strong> {examConfig.examCenter || 'Govt. Higher Secondary School Shangus'}</div>
            <div>📝 <strong>Duration / Max:</strong> {examConfig.duration || '120 Min'} ({examConfig.maxMarks || 100} Marks)</div>
          </div>

          {/* Instructions */}
          <div className="text-[9.5px] text-slate-600 space-y-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <p className="font-bold text-slate-800 uppercase">Important Candidate Instructions:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {(examConfig.instructions || [
                'Candidates must produce this printed Admit Card along with a valid Identity Proof at the examination center.',
                'Reporting time at the examination center is 30 minutes prior to commencement of the test.',
                'Electronic devices including cell phones, smart watches, and calculators are strictly banned inside the hall.',
                'Use blue or black ballpoint pen only for writing responses on the answer sheet.'
              ]).map((inst, idx) => (
                <li key={idx}>{inst}</li>
              ))}
            </ul>
          </div>

          {/* Signature Areas */}
          <div className="pt-4 grid grid-cols-3 gap-3 text-center text-[9px] font-bold text-slate-700">
            <div className="border-t border-slate-400 pt-1">Candidate's Signature</div>
            <div className="border-t border-slate-400 pt-1">Invigilator's Signature</div>
            <div className="border-t border-slate-400 pt-1">Controller of Examinations</div>
          </div>
        </div>

        {/* Modal Action Buttons: Print OR Download PDF */}
        <div className="flex gap-2.5 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleDirectPrint}
            className="flex-1 py-2.5 rounded-xl border-2 border-teal-800 text-teal-800 hover:bg-teal-50 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer size={15} /> Print Direct
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex-1 py-2.5 rounded-xl bg-teal-800 text-white font-extrabold text-xs hover:bg-teal-700 active:bg-teal-900 transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
          >
            <FileText size={15} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Component ───────────────────────────────────────────────────
export default function AdminGkTestManager({ allStudents = [], onRefresh }) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedDocForPrint, setSelectedDocForPrint] = useState(null);
  const [revokingDoc, setRevokingDoc] = useState(null);
  const [revokeSuccessInfo, setRevokeSuccessInfo] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  // Selected candidates for bulk operations
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Default dynamic deadline (30 days from now)
  const defaultFutureDeadline = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    d.setHours(23, 59, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  // Generalized Competitive Exam Settings State
  const [examConfig, setExamConfig] = useState({
    examTitle: 'All Kashmir GK Talent Search & Competitive Examination 2026',
    examType: 'General Knowledge & Talent Search',
    academicSession: '2025-26',
    isOpen: true,
    registrationDeadline: defaultFutureDeadline,
    examDate: 'Sunday, 30th August 2026',
    examTime: '11:00 AM – 01:00 PM',
    reportingTime: '10:30 AM',
    examCenter: 'Govt. Higher Secondary School Shangus',
    eligibleClasses: ['9th', '10th', '11th', '12th'],
    maxMarks: 100,
    duration: '120 Minutes',
    instructions: [
      'Candidates must produce this printed Admit Card along with a valid Identity Proof at the examination center.',
      'Reporting time at the examination center is 30 minutes prior to commencement of the test.',
      'Electronic devices including cell phones, smart watches, and calculators are strictly banned inside the hall.',
      'Use blue or black ballpoint pen only for writing responses on the answer sheet.'
    ]
  });

  const [instructionsText, setInstructionsText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Hydrate local student directory pool from props or SWR Cache
  const [directoryStudents, setDirectoryStudents] = useState(() => {
    if (Array.isArray(allStudents) && allStudents.length > 0) return allStudents;
    return getCachedCollectionSync('admissions') || [];
  });

  useEffect(() => {
    if (Array.isArray(allStudents) && allStudents.length > 0) {
      setDirectoryStudents(allStudents);
    } else {
      getCachedCollection('admissions', false, 30 * 60 * 1000)
        .then((docs) => {
          if (Array.isArray(docs) && docs.length > 0) {
            setDirectoryStudents(docs);
          }
        })
        .catch(() => {});
    }
  }, [allStudents]);

  // Fetch Settings from Firestore
  const fetchSettings = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'gktest_settings', 'config'));
      if (snap.exists()) {
        const d = snap.data();
        const loaded = {
          examTitle: d.examTitle || 'All Kashmir GK Talent Search & Competitive Examination 2026',
          examType: d.examType || 'General Knowledge & Talent Search',
          academicSession: d.academicSession || '2025-26',
          isOpen: d.isOpen !== false,
          registrationDeadline: d.registrationDeadline || defaultFutureDeadline,
          examDate: d.examDate || 'Sunday, 30th August 2026',
          examTime: d.examTime || '11:00 AM – 01:00 PM',
          reportingTime: d.reportingTime || '10:30 AM',
          examCenter: d.examCenter || 'Govt. Higher Secondary School Shangus',
          eligibleClasses: Array.isArray(d.eligibleClasses) ? d.eligibleClasses : ['9th', '10th', '11th', '12th'],
          maxMarks: d.maxMarks || 100,
          duration: d.duration || '120 Minutes',
          instructions: Array.isArray(d.instructions) && d.instructions.length > 0 ? d.instructions : [
            'Candidates must produce this printed Admit Card along with a valid Identity Proof at the examination center.',
            'Reporting time at the examination center is 30 minutes prior to commencement of the test.',
            'Electronic devices including cell phones, smart watches, and calculators are strictly banned inside the hall.',
            'Use blue or black ballpoint pen only for writing responses on the answer sheet.'
          ]
        };
        setExamConfig(loaded);
        setInstructionsText(loaded.instructions.join('\n'));
      } else {
        setInstructionsText(examConfig.instructions.join('\n'));
      }
    } catch (e) {
      console.warn('Failed to load gktest_settings:', e);
    }
  }, [defaultFutureDeadline]);

  // Apply Preset
  const handleApplyPreset = (presetId) => {
    const preset = EXAM_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setExamConfig(prev => ({
      ...prev,
      examTitle: preset.examTitle,
      examType: preset.examType,
      duration: preset.duration,
      maxMarks: preset.maxMarks,
      instructions: preset.instructions
    }));
    setInstructionsText(preset.instructions.join('\n'));
  };

  // Quick Deadline Extension Helper
  const handleExtendDeadlineDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const dateStr = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setExamConfig(prev => ({ ...prev, registrationDeadline: dateStr, isOpen: true }));
  };

  // Save Settings
  const handleSaveSettings = async (customConfig = null) => {
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      const parsedInstructions = instructionsText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const targetConfig = customConfig || examConfig;

      const payload = {
        ...targetConfig,
        instructions: parsedInstructions.length > 0 ? parsedInstructions : targetConfig.instructions,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'gktest_settings', 'config'), payload, { merge: true });
      setExamConfig(payload);
      setSettingsMsg('Competitive exam configuration saved and published successfully!');
      setTimeout(() => setSettingsMsg(''), 4000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const updateRegistrations = useCallback((updater) => {
    setRegistrations((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      setCachedCollectionData('omr_registrations', next);
      return next;
    });
  }, []);

  // Firestore remains authoritative; the short-lived in-memory cache prevents
  // repeated full reads when switching between administrative modules.
  const fetchRegistrations = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const list = await getCachedCollection(
        'omr_registrations',
        forceRefresh === true,
        5 * 60 * 1000
      );
      list.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        if (timeA && timeB) return timeB - timeA;
        return (a.examNumber || a.id).localeCompare(b.examNumber || b.id);
      });
      updateRegistrations([...list]);
    } catch (err) {
      console.error('Failed to fetch OMR registrations:', err);
    } finally {
      setLoading(false);
    }
  }, [updateRegistrations]);

  useEffect(() => {
    fetchRegistrations();
    fetchSettings();
  }, [fetchRegistrations, fetchSettings]);

  // Handle Revoke / Delete Registration
  const handleConfirmRevoke = async () => {
    if (!revokingDoc) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'omr_registrations', revokingDoc.id));
      updateRegistrations(prev => prev.filter(r => r.id !== revokingDoc.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(revokingDoc.id);
        return next;
      });
      setRevokeSuccessInfo({
        name: revokingDoc.name || 'Student',
        examNumber: revokingDoc.examNumber || revokingDoc.id
      });
      setRevokingDoc(null);
    } catch (err) {
      console.error('Error revoking registration:', err);
      alert(`Failed to revoke registration: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (registrations.length === 0) {
      alert('No candidates to export.');
      return;
    }
    const headers = ['Exam Roll No', 'Candidate Name', "Father's Name", 'Class', 'Class Roll No', 'Reg / Form No', 'Mobile', 'Type', 'Registration Date'];
    const rows = registrations.map(r => [
      `"${r.examNumber || r.id}"`,
      `"${r.name || ''}"`,
      `"${r.fatherName || ''}"`,
      `"${r.className || ''}"`,
      `"${r.classRollNo || ''}"`,
      `"${r.boardRegNo || r.formNo || ''}"`,
      `"${r.mobile || ''}"`,
      `"${r.isManualEntry ? 'Manual' : 'Matched'}"`,
      `"${r.submittedAt?.seconds ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(examConfig.examType || 'Competitive_Exam').replace(/\s+/g, '_')}_Candidates_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered List
  const filtered = useMemo(() => {
    return registrations.filter(r => {
      const q = search.toLowerCase().trim();
      const matchQuery = !q ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.fatherName && r.fatherName.toLowerCase().includes(q)) ||
        (r.examNumber && String(r.examNumber).toLowerCase().includes(q)) ||
        (r.boardRegNo && String(r.boardRegNo).toLowerCase().includes(q)) ||
        (r.formNo && String(r.formNo).toLowerCase().includes(q)) ||
        (r.mobile && String(r.mobile).includes(q));

      let matchClass = true;
      if (selectedClass === 'MANUAL') {
        matchClass = !!r.isManualEntry;
      } else if (selectedClass !== 'ALL') {
        matchClass = (r.className || '').toLowerCase().includes(selectedClass.toLowerCase());
      }

      return matchQuery && matchClass;
    });
  }, [registrations, search, selectedClass]);

  // Multi-Select Logic
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const handleToggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch Print Admit Cards
  const handlePrintBatch = (useFilteredAll = false) => {
    const listToPrint = useFilteredAll
      ? filtered
      : filtered.filter(r => selectedIds.has(r.id));

    if (listToPrint.length === 0) {
      alert('Please select at least one candidate to print admit cards.');
      return;
    }
    generateBatchGkTestAdmitCardsPdf(listToPrint, examConfig);
  };

  // Copy Public Link Helper
  const handleCopyPublicLink = () => {
    const publicUrl = `${window.location.origin}/gk-test`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  // Counts
  const totalCount = registrations.length;
  const matchedCount = registrations.filter(r => !r.isManualEntry).length;
  const manualCount = registrations.filter(r => r.isManualEntry).length;

  const isDeadlinePassed = useMemo(() => {
    if (!examConfig.registrationDeadline) return false;
    const dt = new Date(examConfig.registrationDeadline);
    return !isNaN(dt.getTime()) && Date.now() > dt.getTime();
  }, [examConfig.registrationDeadline]);

  const effectiveStatus = examConfig.isOpen && !isDeadlinePassed;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden border border-teal-800/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-teal-500/20 backdrop-blur-md border border-teal-400/30 rounded-full px-3 py-1 text-xs font-bold text-teal-200">
              <Award size={14} className="text-amber-400" />
              <span>Competitive Exams & Talent Search Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0">
              {examConfig.examTitle}
            </h2>
            <p className="text-teal-200/90 text-xs sm:text-sm m-0 max-w-2xl leading-relaxed">
              Manage competitive tests, science/math olympiads, scholarship entrance exams, customize exam schedules, and issue admit cards.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Register Candidate</span>
            </button>
            <button
              onClick={() => setShowBulkImportModal(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Users size={15} />
              <span>Bulk Import</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={registrations.length === 0}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-900 text-teal-200 text-xs font-bold transition-all border border-teal-700/40 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
            <button
              onClick={() => fetchRegistrations(true)}
              disabled={loading}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-900 text-teal-200 text-xs font-bold transition-all border border-teal-700/40 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh candidate records"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Public Portal Shortcut Bar */}
        <div className="mt-5 pt-4 border-t border-teal-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-teal-200">
            <span className="font-bold">Public Portal:</span>
            <code className="bg-black/30 px-2 py-0.5 rounded-lg border border-teal-500/30 text-teal-300 font-mono text-[11px]">
              /gk-test
            </code>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPublicLink}
              className="px-3 py-1 rounded-lg bg-teal-800/80 hover:bg-teal-700 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border border-teal-600/40"
            >
              {copiedUrl ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
              <span>{copiedUrl ? 'Copied Link!' : 'Copy Portal Link'}</span>
            </button>
            <a
              href="/gk-test"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
            >
              <ExternalLink size={13} />
              <span>Open Public Page</span>
            </a>
          </div>
        </div>
      </div>

      {/* Comprehensive Exam Configuration Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 flex items-center justify-center font-black">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white m-0">Exam Parameters & Registration Settings</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">Configure exam title, type, date, venue, instructions, and registration deadline.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${
              effectiveStatus
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
            }`}>
              {effectiveStatus ? <Unlock size={13} /> : <Lock size={13} />}
              {effectiveStatus ? 'Portal OPEN' : isDeadlinePassed ? 'Closed (Deadline Passed)' : 'Portal CLOSED'}
            </span>
            <button
              onClick={() => setIsConfigExpanded(prev => !prev)}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Expand / Collapse settings"
            >
              {isConfigExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Quick Deadline Reopen Banner if Expired */}
        {!effectiveStatus && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Registration is currently closed.</strong> Candidates visiting the public registration page cannot register.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  handleExtendDeadlineDays(30);
                  handleSaveSettings({ ...examConfig, isOpen: true, registrationDeadline: defaultFutureDeadline });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>⚡ Reopen Portal (+30 Days)</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Exam Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles size={13} className="text-amber-500" /> Exam Templates:
          </span>
          {EXAM_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                examConfig.examType === preset.examType
                  ? 'bg-teal-50 border-teal-400 text-teal-800 dark:bg-teal-950 dark:border-teal-700 dark:text-teal-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Basic Fields Always Visible */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end pt-1">
          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Exam Title / Competition Name</label>
            <input
              type="text"
              value={examConfig.examTitle}
              onChange={e => setExamConfig(prev => ({ ...prev, examTitle: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          <div className="sm:col-span-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Calendar size={13} /> Registration Deadline
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleExtendDeadlineDays(7)}
                  className="text-[9px] font-black px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100"
                  title="Extend +7 days"
                >
                  +7d
                </button>
                <button
                  type="button"
                  onClick={() => handleExtendDeadlineDays(30)}
                  className="text-[9px] font-black px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100"
                  title="Extend +30 days"
                >
                  +30d
                </button>
              </div>
            </div>
            <input
              type="datetime-local"
              value={examConfig.registrationDeadline}
              onChange={e => setExamConfig(prev => ({ ...prev, registrationDeadline: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          <div className="sm:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Portal Open Switch</label>
            <button
              type="button"
              onClick={() => setExamConfig(prev => ({ ...prev, isOpen: !prev.isOpen }))}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                examConfig.isOpen
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              {examConfig.isOpen ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{examConfig.isOpen ? 'Allow Registrations' : 'Force Closed'}</span>
            </button>
          </div>
        </div>

        {/* Detailed Config Options (Expanded) */}
        {isConfigExpanded && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-4 animate-fadeIn">
            <div className="sm:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Exam Category / Type</label>
              <input
                type="text"
                value={examConfig.examType}
                onChange={e => setExamConfig(prev => ({ ...prev, examType: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Exam Date</label>
              <input
                type="text"
                value={examConfig.examDate}
                onChange={e => setExamConfig(prev => ({ ...prev, examDate: e.target.value }))}
                placeholder="e.g. Sunday, 30th August 2026"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Exam Timing</label>
              <input
                type="text"
                value={examConfig.examTime}
                onChange={e => setExamConfig(prev => ({ ...prev, examTime: e.target.value }))}
                placeholder="e.g. 11:00 AM – 01:00 PM"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            <div className="sm:col-span-6 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Exam Venue / Center</label>
              <input
                type="text"
                value={examConfig.examCenter}
                onChange={e => setExamConfig(prev => ({ ...prev, examCenter: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Duration</label>
              <input
                type="text"
                value={examConfig.duration}
                onChange={e => setExamConfig(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="e.g. 120 Minutes"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Max Marks</label>
              <input
                type="number"
                value={examConfig.maxMarks}
                onChange={e => setExamConfig(prev => ({ ...prev, maxMarks: parseInt(e.target.value, 10) || 100 }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            <div className="sm:col-span-12 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Candidate Instructions (1 per line)</label>
              <textarea
                rows={3}
                value={instructionsText}
                onChange={e => setInstructionsText(e.target.value)}
                placeholder="Enter bulleted instructions to print on student admit cards..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none resize-y"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => handleSaveSettings()}
            disabled={savingSettings}
            className="py-2.5 px-6 rounded-xl bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save size={14} />
            <span>{savingSettings ? 'Saving Settings...' : 'Save & Publish Exam Settings'}</span>
          </button>
        </div>

        {settingsMsg && (
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 animate-fadeIn">
            ✅ {settingsMsg}
          </p>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 flex items-center justify-center font-black">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide m-0">Total Registered</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white m-0">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-black">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide m-0">Database Matched</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white m-0">{matchedCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center font-black">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide m-0">Manual Entries</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white m-0">{manualCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Filter & Multi-Print */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Name, Reg No, Exam Roll..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all placeholder-slate-400"
          />
        </div>

        {/* Filter by Class & Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            >
              <option value="ALL">All Classes & Entries</option>
              <option value="9th">9th Class</option>
              <option value="10th">10th Class</option>
              <option value="11th">11th Class</option>
              <option value="12th">12th Class</option>
              <option value="MANUAL">Manual Entry Only</option>
            </select>
          </div>

          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            ({filtered.length} shown)
          </span>

          {filtered.length > 0 && (
            <button
              onClick={() => handlePrintBatch(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              title="Print all filtered admit cards in one batch"
            >
              <Printer size={14} />
              <span>Print All ({filtered.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Selection Sticky Action Bar */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-teal-900 text-white rounded-2xl shadow-lg flex items-center justify-between flex-wrap gap-3 animate-fadeIn border border-teal-700">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-teal-300" />
            <span className="text-xs font-black">
              {selectedIds.size} Candidate{selectedIds.size > 1 ? 's' : ''} Selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrintBatch(false)}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer size={13} />
              <span>Print Selected ({selectedIds.size})</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl bg-teal-950/70 hover:bg-teal-950 text-teal-200 font-bold text-xs cursor-pointer border border-teal-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Candidates Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <ModernLoader
            moduleKey="gkTest"
            text="Loading Test Candidates..."
            subtext="Fetching candidate registrations & hall ticket assignments..."
            className="py-12"
          />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <UserX size={24} />
            </div>
            <div>
              <p className="text-base font-bold text-slate-600 dark:text-slate-300 m-0">No Candidate Registrations Found</p>
              <p className="text-xs text-slate-400 m-0 mt-0.5">Click "Register Candidate" or "Bulk Import" to add candidates.</p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs cursor-pointer"
              >
                ➕ Register Candidate
              </button>
              <button
                onClick={() => setShowBulkImportModal(true)}
                className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs cursor-pointer"
              >
                📥 Bulk Import from Directory
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-extrabold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-400 hover:text-teal-600 cursor-pointer"
                    >
                      {selectedIds.size === filtered.length && filtered.length > 0 ? (
                        <CheckSquare size={16} className="text-teal-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="p-3">Exam Roll No</th>
                  <th className="p-3">Candidate Details</th>
                  <th className="p-3">Class & Roll No</th>
                  <th className="p-3">Reg. No / Form No</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Reg. Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filtered.map(r => {
                  const isChecked = selectedIds.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isChecked ? 'bg-teal-50/50 dark:bg-teal-950/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectOne(r.id)}
                          className="text-slate-400 hover:text-teal-600 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-teal-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Exam Roll No */}
                      <td className="p-3">
                        <span className="font-mono font-black text-sm text-teal-800 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                          {r.examNumber || r.id}
                        </span>
                      </td>

                      {/* Candidate Details */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {(() => {
                            const pUrl = formatPhotoDisplayUrl(r.photoUrl || getStudentPhotoUrl(r));
                            if (pUrl && pUrl !== '/logo.png' && pUrl.length > 20) {
                              return (
                                <img
                                  src={pUrl}
                                  alt={r.name}
                                  className="w-8 h-9 object-cover rounded border border-slate-300 dark:border-slate-700"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              );
                            }
                            return (
                              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 flex items-center justify-center font-black text-xs">
                                {(r.name || '?')[0].toUpperCase()}
                              </div>
                            );
                          })()}
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-xs m-0">{r.name || '—'}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 m-0">S/O: {r.fatherName || '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Class & Roll No */}
                      <td className="p-3 text-slate-800 dark:text-slate-200">
                        <span className="font-bold">{r.className || '—'}</span>
                        <span className="text-slate-400 ml-1.5">Roll: {r.classRollNo || '—'}</span>
                      </td>

                      {/* Reg. No / Form No */}
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                        {r.boardRegNo || r.formNo || 'Manual'}
                      </td>

                      {/* Type */}
                      <td className="p-3">
                        {r.isManualEntry ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Manual
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Matched
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {r.submittedAt?.seconds ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedDocForPrint(r)}
                            title="View / Print Admit Card"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-slate-600 dark:text-slate-300 hover:text-teal-800 dark:hover:text-teal-300 transition-colors cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            onClick={() => setEditingDoc(r)}
                            title="Edit Candidate Details"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-slate-600 dark:text-slate-300 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => setRevokingDoc(r)}
                            title="Revoke / Delete Registration"
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── ADD CANDIDATE MODAL ────────────────────────────────────────── */}
      {showAddModal && (
        <AddCandidateModal
          allStudents={directoryStudents}
          onClose={() => setShowAddModal(false)}
          onCandidateAdded={(newCandidate) => {
            updateRegistrations(prev => [newCandidate, ...prev]);
            setShowAddModal(false);
          }}
        />
      )}

      {/* ─── BULK IMPORT MODAL ─────────────────────────────────────────── */}
      {showBulkImportModal && (
        <BulkImportCandidatesModal
          allStudents={directoryStudents}
          existingRegistrations={registrations}
          onClose={() => setShowBulkImportModal(false)}
          onImportComplete={(importedList) => {
            updateRegistrations(prev => [...importedList, ...prev]);
            setShowBulkImportModal(false);
          }}
        />
      )}

      {/* ─── EDIT CANDIDATE MODAL ──────────────────────────────────────── */}
      {editingDoc && (
        <EditCandidateModal
          candidate={editingDoc}
          onClose={() => setEditingDoc(null)}
          onCandidateUpdated={(updatedCandidate) => {
            updateRegistrations(prev => prev.map(r => r.id === updatedCandidate.id ? updatedCandidate : r));
            setEditingDoc(null);
          }}
        />
      )}

      {/* Revoke Confirm Dialog Modal */}
      {revokingDoc && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white m-0">Revoke Candidate Registration?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                You are about to revoke the test registration for:
              </p>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-left my-2 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <p className="m-0"><strong>Candidate:</strong> {revokingDoc.name}</p>
                <p className="m-0"><strong>Father's Name:</strong> {revokingDoc.fatherName}</p>
                <p className="m-0"><strong>Exam Roll No:</strong> <span className="font-mono font-bold text-teal-700 dark:text-teal-400">{revokingDoc.examNumber || revokingDoc.id}</span></p>
                <p className="m-0"><strong>Class:</strong> {revokingDoc.className}</p>
              </div>
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 m-0">
                ⚠️ Warning: This will permanently delete their application. The candidate can register fresh afterwards.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRevokingDoc(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Revoking...</>
                ) : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Success Dialog Modal */}
      {revokeSuccessInfo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white m-0">Registration Revoked</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed m-0">
                Test registration for candidate <strong className="text-slate-800 dark:text-slate-200 font-bold">{revokeSuccessInfo.name}</strong> (Exam Roll No: <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{revokeSuccessInfo.examNumber}</span>) has been successfully revoked and deleted.
              </p>
            </div>
            <button
              onClick={() => setRevokeSuccessInfo(null)}
              className="w-full py-3 rounded-xl bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white font-extrabold text-xs transition-all shadow-md cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Printable Admit Card Modal */}
      {selectedDocForPrint && (
        <PrintableAdmitCardModal
          registration={selectedDocForPrint}
          examConfig={examConfig}
          onClose={() => setSelectedDocForPrint(null)}
        />
      )}
    </div>
  );
}

// ─── ADD CANDIDATE MODAL COMPONENT ──────────────────────────────────────────
function AddCandidateModal({ allStudents = [], onClose, onCandidateAdded }) {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'manual'
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    className: '11th',
    classRollNo: '',
    boardRegNo: '',
    formNo: '',
    mobile: '',
    session: '2025-26',
    photoUrl: '',
    customExamNumber: generate7DigitExamNumber()
  });

  const [submitting, setSubmitting] = useState(false);

  // Filter students from directory
  const filteredDirectory = useMemo(() => {
    if (!search.trim()) return (allStudents || []).slice(0, 10);
    const q = search.toLowerCase().trim();
    return (allStudents || []).filter(s => {
      const name = (s.name || s.studentName || s['Student Name'] || '').toLowerCase();
      const father = (s.fatherName || s.parentName || s["Father's Name"] || '').toLowerCase();
      const roll = String(s.rollNo || s.classRollNo || s['Class Roll No'] || '').toLowerCase();
      const reg = String(s.boardRegNo || s.regNo || s['Board Registration Number'] || '').toLowerCase();
      const form = String(s.formNo || s['Form Number'] || '').toLowerCase();
      return name.includes(q) || father.includes(q) || roll.includes(q) || reg.includes(q) || form.includes(q);
    }).slice(0, 15);
  }, [allStudents, search]);

  const handlePickStudent = (st) => {
    setSelectedStudent(st);
    setFormData(prev => ({
      ...prev,
      name: st.name || st.studentName || st['Student Name'] || '',
      fatherName: st.fatherName || st.parentName || st["Father's Name"] || '',
      className: st.className || st.class || st.classGrade || '11th',
      classRollNo: st.rollNo || st.classRollNo || st['Class Roll No'] || '',
      boardRegNo: st.boardRegNo || st.regNo || st['Board Registration Number'] || '',
      formNo: st.formNo || st['Form Number'] || '',
      mobile: st.mobile || st.phone || st['Mobile Number'] || '',
      session: st.session || '2025-26',
      photoUrl: st.photoUrl || getStudentPhotoUrl(st) || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please provide candidate name.');
      return;
    }

    setSubmitting(true);
    try {
      const finalExamNo = formData.customExamNumber.trim() || generate7DigitExamNumber();

      const payload = {
        examNumber: finalExamNo,
        name: formData.name.trim(),
        fatherName: formData.fatherName.trim(),
        className: formData.className.trim(),
        classRollNo: formData.classRollNo.trim(),
        boardRegNo: formData.boardRegNo.trim(),
        formNo: formData.formNo.trim(),
        mobile: formData.mobile.trim(),
        session: formData.session.trim() || '2025-26',
        photoUrl: formData.photoUrl.trim() || null,
        isManualEntry: activeTab === 'manual' || !selectedStudent,
        submittedAt: serverTimestamp(),
        status: 'registered'
      };

      await setDoc(doc(db, 'omr_registrations', finalExamNo), payload);
      onCandidateAdded({ id: finalExamNo, ...payload, submittedAt: { seconds: Math.floor(Date.now() / 1000) } });
    } catch (err) {
      console.error('Error adding candidate:', err);
      alert('Failed to add candidate: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white m-0">Register New Candidate</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">Enroll student from admissions or enter custom candidate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            🔍 Pick from School Directory
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('manual'); setSelectedStudent(null); }}
            className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            ✍️ Manual / External Candidate
          </button>
        </div>

        {/* Directory Search Box */}
        {activeTab === 'directory' && (
          <div className="space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search directory by name, father's name, roll no, reg no..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/40 text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            {/* Quick Results */}
            <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
              {filteredDirectory.map((st, i) => {
                const sName = st.name || st.studentName || st['Student Name'] || 'Unknown';
                const sFather = st.fatherName || st.parentName || st["Father's Name"] || '—';
                const sClass = st.className || st.class || st.classGrade || '11th';
                const sRoll = st.rollNo || st.classRollNo || st['Class Roll No'] || '—';
                const isSelected = selectedStudent && (selectedStudent.id === st.id || selectedStudent.formNo === st.formNo);

                return (
                  <div
                    key={st.id || i}
                    onClick={() => handlePickStudent(st)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-xs ${
                      isSelected
                        ? 'bg-teal-700 text-white font-bold shadow-xs'
                        : 'hover:bg-teal-100/60 dark:hover:bg-teal-950/80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{sName}</span>
                      <span className="text-[10.5px] opacity-80 ml-2">S/O {sFather}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-black/10 font-bold">{sClass}</span>
                      <span className="font-mono">Roll: {sRoll}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Candidate Details Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Candidate Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Father's Name</label>
              <input
                type="text"
                value={formData.fatherName}
                onChange={e => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Class / Grade</label>
              <input
                type="text"
                value={formData.className}
                onChange={e => setFormData(prev => ({ ...prev, className: e.target.value }))}
                placeholder="e.g. 11th / 12th"
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Class Roll No</label>
              <input
                type="text"
                value={formData.classRollNo}
                onChange={e => setFormData(prev => ({ ...prev, classRollNo: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Board Reg No / Form No</label>
              <input
                type="text"
                value={formData.boardRegNo || formData.formNo}
                onChange={e => setFormData(prev => ({ ...prev, boardRegNo: e.target.value, formNo: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Mobile No</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={e => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-[9.5px] font-black uppercase text-teal-700 dark:text-teal-300 mb-1">
                Assigned Exam Roll Number *
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  required
                  value={formData.customExamNumber}
                  onChange={e => setFormData(prev => ({ ...prev, customExamNumber: e.target.value }))}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-950/40 font-mono font-black text-xs text-teal-900 dark:text-teal-200"
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, customExamNumber: generate7DigitExamNumber() }))}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] hover:bg-slate-200"
                >
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Photo URL (Optional)</label>
              <input
                type="text"
                value={formData.photoUrl}
                onChange={e => setFormData(prev => ({ ...prev, photoUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle size={14} />
              <span>{submitting ? 'Enrolling Candidate...' : 'Enroll & Assign Hall Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── BULK IMPORT CANDIDATES MODAL COMPONENT ─────────────────────────────────
function BulkImportCandidatesModal({ allStudents = [], existingRegistrations = [], onClose, onImportComplete }) {
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedStreamFilter, setSelectedStreamFilter] = useState('ALL');
  const [selectedStudentKeys, setSelectedStudentKeys] = useState(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const existingRegMap = useMemo(() => {
    const map = new Set();
    existingRegistrations.forEach(r => {
      if (r.boardRegNo) map.add(String(r.boardRegNo).toUpperCase());
      if (r.formNo) map.add(String(r.formNo));
      if (r.classRollNo && r.className) map.add(`${r.className}_${r.classRollNo}`);
    });
    return map;
  }, [existingRegistrations]);

  // Candidates list from school directory
  const eligibleDirectoryList = useMemo(() => {
    return (allStudents || []).filter(st => {
      const sClass = (st.className || st.class || st.classGrade || '').toLowerCase();
      const sStream = (st.stream || st.subjectCombination || '').toLowerCase();

      let matchClass = true;
      if (selectedClassFilter !== 'ALL') {
        matchClass = sClass.includes(selectedClassFilter.toLowerCase());
      }

      let matchStream = true;
      if (selectedStreamFilter !== 'ALL') {
        matchStream = sStream.includes(selectedStreamFilter.toLowerCase());
      }

      return matchClass && matchStream;
    });
  }, [allStudents, selectedClassFilter, selectedStreamFilter]);

  const availableCount = eligibleDirectoryList.filter(st => {
    const reg = st.boardRegNo || st.regNo || st['Board Registration Number'];
    const form = st.formNo || st['Form Number'];
    return !existingRegMap.has(String(reg).toUpperCase()) && !existingRegMap.has(String(form));
  }).length;

  const handleSelectAllAvailable = () => {
    const newSet = new Set();
    eligibleDirectoryList.forEach(st => {
      const reg = st.boardRegNo || st.regNo || st['Board Registration Number'];
      const form = st.formNo || st['Form Number'];
      const isAlreadyReg = existingRegMap.has(String(reg).toUpperCase()) || existingRegMap.has(String(form));
      if (!isAlreadyReg) {
        newSet.add(st.id || form || reg);
      }
    });
    setSelectedStudentKeys(newSet);
  };

  const handleExecuteBulkImport = async () => {
    const studentsToImport = eligibleDirectoryList.filter(st => {
      const key = st.id || st.formNo || st['Form Number'] || st.boardRegNo || st.regNo;
      return selectedStudentKeys.has(key);
    });

    if (studentsToImport.length === 0) {
      alert('Please select at least one available student to enroll.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const importedDocs = [];
      const batchSize = 100;
      let processed = 0;

      for (let i = 0; i < studentsToImport.length; i += batchSize) {
        const chunk = studentsToImport.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach(st => {
          const finalExamNo = generate7DigitExamNumber();
          const payload = {
            examNumber: finalExamNo,
            name: (st.name || st.studentName || st['Student Name'] || '').trim(),
            fatherName: (st.fatherName || st.parentName || st["Father's Name"] || '').trim(),
            className: (st.className || st.class || st.classGrade || '11th').trim(),
            classRollNo: String(st.rollNo || st.classRollNo || st['Class Roll No'] || '').trim(),
            boardRegNo: String(st.boardRegNo || st.regNo || st['Board Registration Number'] || '').trim(),
            formNo: String(st.formNo || st['Form Number'] || '').trim(),
            mobile: String(st.mobile || st.phone || st['Mobile Number'] || '').trim(),
            session: st.session || '2025-26',
            photoUrl: st.photoUrl || getStudentPhotoUrl(st) || null,
            isManualEntry: false,
            submittedAt: serverTimestamp(),
            status: 'registered'
          };

          const ref = doc(db, 'omr_registrations', finalExamNo);
          batch.set(ref, payload);
          importedDocs.push({ id: finalExamNo, ...payload, submittedAt: { seconds: Math.floor(Date.now() / 1000) } });
        });

        await batch.commit();
        processed += chunk.length;
        setImportProgress(Math.round((processed / studentsToImport.length) * 100));
      }

      alert(`Successfully enrolled ${importedDocs.length} candidates from School Directory!`);
      onImportComplete(importedDocs);
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Bulk import failed: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white m-0">Bulk Import Candidates from School Directory</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">Enroll entire classes or cohorts with auto-assigned exam roll numbers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-500">Class:</label>
            <select
              value={selectedClassFilter}
              onChange={e => setSelectedClassFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
            >
              <option value="ALL">All Classes</option>
              <option value="11th">11th Class</option>
              <option value="12th">12th Class</option>
              <option value="10th">10th Class</option>
              <option value="9th">9th Class</option>
            </select>

            <label className="font-bold text-slate-500 ml-2">Stream:</label>
            <select
              value={selectedStreamFilter}
              onChange={e => setSelectedStreamFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
            >
              <option value="ALL">All Streams</option>
              <option value="Medical">Medical</option>
              <option value="Non-Medical">Non-Medical</option>
              <option value="Arts">Arts</option>
              <option value="Commerce">Commerce</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllAvailable}
              className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-black text-[11px] cursor-pointer"
            >
              Select All Available ({availableCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStudentKeys(new Set())}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[11px] cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Directory Student List with Status */}
        <div className="max-h-72 overflow-y-auto space-y-1 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
          {eligibleDirectoryList.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No students found matching current filters.</div>
          ) : (
            eligibleDirectoryList.map((st, i) => {
              const reg = st.boardRegNo || st.regNo || st['Board Registration Number'];
              const form = st.formNo || st['Form Number'];
              const isAlreadyReg = existingRegMap.has(String(reg).toUpperCase()) || existingRegMap.has(String(form));
              const key = st.id || form || reg || String(i);
              const isChecked = selectedStudentKeys.has(key);

              return (
                <div
                  key={key}
                  onClick={() => {
                    if (isAlreadyReg) return;
                    setSelectedStudentKeys(prev => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                    isAlreadyReg
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 opacity-60 cursor-not-allowed'
                      : isChecked
                      ? 'bg-indigo-700 text-white font-bold shadow-xs cursor-pointer'
                      : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-slate-700 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {!isAlreadyReg && (
                      <span>{isChecked ? <CheckSquare size={16} /> : <Square size={16} />}</span>
                    )}
                    <div>
                      <span className="font-bold">{st.name || st.studentName || st['Student Name']}</span>
                      <span className="text-[10px] opacity-80 ml-2">S/O {st.fatherName || st.parentName || st["Father's Name"]}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[10.5px]">
                    <span className="font-mono">Roll: {st.rollNo || st.classRollNo || st['Class Roll No'] || '—'}</span>
                    <span className="font-mono">Reg: {reg || form || '—'}</span>
                    {isAlreadyReg ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black text-[9.5px]">
                        Enrolled
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-bold text-[9.5px]">
                        Available
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Progress Bar */}
        {isImporting && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <span>Importing candidates...</span>
              <span>{importProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            {selectedStudentKeys.size} students selected for enrollment
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteBulkImport}
              disabled={selectedStudentKeys.size === 0 || isImporting}
              className="px-5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Users size={14} />
              <span>{isImporting ? 'Enrolling...' : `Enroll Selected (${selectedStudentKeys.size})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EDIT CANDIDATE MODAL COMPONENT ─────────────────────────────────────────
function EditCandidateModal({ candidate, onClose, onCandidateUpdated }) {
  const [formData, setFormData] = useState({
    name: candidate.name || '',
    fatherName: candidate.fatherName || '',
    className: candidate.className || '',
    classRollNo: candidate.classRollNo || '',
    boardRegNo: candidate.boardRegNo || '',
    formNo: candidate.formNo || '',
    mobile: candidate.mobile || '',
    examNumber: candidate.examNumber || candidate.id || '',
    photoUrl: candidate.photoUrl || ''
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        fatherName: formData.fatherName.trim(),
        className: formData.className.trim(),
        classRollNo: formData.classRollNo.trim(),
        boardRegNo: formData.boardRegNo.trim(),
        formNo: formData.formNo.trim(),
        mobile: formData.mobile.trim(),
        examNumber: formData.examNumber.trim(),
        photoUrl: formData.photoUrl.trim() || null
      };

      await updateDoc(doc(db, 'omr_registrations', candidate.id), payload);
      onCandidateUpdated({ ...candidate, ...payload });
    } catch (err) {
      console.error('Error updating candidate:', err);
      alert('Failed to update candidate: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              <Edit3 size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white m-0">Edit Candidate Details</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">Exam Roll No: {candidate.examNumber || candidate.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Candidate Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Father's Name</label>
              <input
                type="text"
                value={formData.fatherName}
                onChange={e => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Class / Grade</label>
              <input
                type="text"
                value={formData.className}
                onChange={e => setFormData(prev => ({ ...prev, className: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Class Roll No</label>
              <input
                type="text"
                value={formData.classRollNo}
                onChange={e => setFormData(prev => ({ ...prev, classRollNo: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Board Reg No</label>
              <input
                type="text"
                value={formData.boardRegNo}
                onChange={e => setFormData(prev => ({ ...prev, boardRegNo: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Mobile</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={e => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">Photo URL</label>
              <input
                type="text"
                value={formData.photoUrl}
                onChange={e => setFormData(prev => ({ ...prev, photoUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
