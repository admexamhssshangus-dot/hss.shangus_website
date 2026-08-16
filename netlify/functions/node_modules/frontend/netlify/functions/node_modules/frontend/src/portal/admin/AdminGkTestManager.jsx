import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, Trash2, Printer, ShieldAlert, CheckCircle2, UserCheck, FileText, Filter, AlertTriangle, Eye, X, Calendar, Clock, Save, Lock, Unlock } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { generateGkTestAdmitCardPdf } from '../../utils/pdfGenerator';

function PrintableAdmitCardModal({ registration, onClose }) {
  if (!registration) return null;

  const handleDirectPrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    generateGkTestAdmitCardPdf(registration);
  };

  const student = registration;
  const initial = (student.name || '?')[0].toUpperCase();

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 relative border border-slate-200 text-slate-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors print:hidden"
        >
          <X size={20} />
        </button>

        {/* Printable Card Area */}
        <div className="printable-admit-card bg-white p-6 rounded-2xl border-2 border-slate-900 space-y-4">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
            <h2 className="text-xl font-black uppercase tracking-wider text-teal-900">
              Govt. Higher Secondary School Shangus
            </h2>
            <p className="text-xs font-bold text-slate-600">Anantnag, Jammu & Kashmir — 192201</p>
            <div className="inline-block bg-teal-800 text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-widest mt-2">
              General Knowledge Quiz - 2026 Admit Card
            </div>
          </div>

          {/* Exam Roll Number Box */}
          <div className="bg-slate-50 border-2 border-dashed border-teal-800 rounded-xl p-4 text-center space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-800">Assigned Examination Roll Number</p>
            <p className="text-4xl font-black font-mono tracking-widest text-slate-900">
              {student.examNumber || student.id}
            </p>
          </div>

          {/* Student Info & Photo */}
          <div className="grid grid-cols-3 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Photo */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              {student.photoUrl && (student.photoUrl.startsWith('http') || student.photoUrl.startsWith('data:')) ? (
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="w-24 h-28 object-cover rounded-lg border-2 border-slate-800 shadow-sm"
                />
              ) : (
                <div className="w-24 h-28 rounded-lg bg-teal-100 border-2 border-teal-700 flex items-center justify-center text-teal-800 text-3xl font-black">
                  {initial}
                </div>
              )}
              <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Candidate Photograph</span>
            </div>

            {/* Details Table */}
            <div className="col-span-2 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Student Name</span>
                  <span className="font-bold text-slate-900 text-sm truncate block">{student.name || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Father's Name</span>
                  <span className="font-bold text-slate-800 text-xs truncate block">{student.fatherName || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Class</span>
                  <span className="font-bold text-slate-800">{student.className || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Class Roll No.</span>
                  <span className="font-bold text-slate-800">{student.classRollNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Board Reg. No. / Form No.</span>
                  <span className="font-bold font-mono text-slate-800">{student.boardRegNo || student.formNo || 'Manual Entry'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Academic Session</span>
                  <span className="font-bold text-slate-800">{student.session || '2025-26'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Exam Schedule & Venue */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs grid grid-cols-2 gap-2 text-teal-900 font-semibold">
            <div>📅 <strong>Date of Test:</strong> Monday, 10 August 2026</div>
            <div>⏰ <strong>Reporting Time:</strong> 09:00 AM</div>
            <div>📍 <strong>Venue:</strong> Main Hall, HSS Shangus</div>
            <div>📝 <strong>Format:</strong> 60 Questions (MCQ / OMR)</div>
          </div>

          {/* Instructions */}
          <div className="text-[10px] text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p className="font-bold text-slate-800 uppercase">Important Candidate Instructions:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Bring this Admit Card and your school Identity Card on the examination day.</li>
              <li>Use blue/black ballpoint pen only for filling OMR bubbles. Do not use gel pens.</li>
              <li>Carefully fill your 7-digit Exam Roll Number on the OMR answer sheet.</li>
              <li>Mobile phones and electronic gadgets are strictly prohibited inside the hall.</li>
            </ul>
          </div>

          {/* Signature Areas */}
          <div className="pt-6 grid grid-cols-3 gap-4 text-center text-[10px] font-bold text-slate-700">
            <div className="border-t border-slate-400 pt-1">Candidate's Signature</div>
            <div className="border-t border-slate-400 pt-1">Invigilator's Signature</div>
            <div className="border-t border-slate-400 pt-1">Convener / Principal Seal</div>
          </div>
        </div>

        {/* Modal Action Buttons: Print OR Download PDF */}
        <div className="flex gap-2.5 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all"
          >
            Close
          </button>
          <button
            onClick={handleDirectPrint}
            className="flex-1 py-2.5 rounded-xl border-2 border-teal-800 text-teal-800 hover:bg-teal-50 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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

export default function AdminGkTestManager() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedDocForPrint, setSelectedDocForPrint] = useState(null);
  const [revokingDoc, setRevokingDoc] = useState(null);
  const [revokeSuccessInfo, setRevokeSuccessInfo] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Settings State
  const [deadlineConfig, setDeadlineConfig] = useState({
    registrationDeadline: '2026-08-08T23:59',
    isOpen: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'gktest_settings', 'config'));
      if (snap.exists()) {
        const d = snap.data();
        setDeadlineConfig({
          registrationDeadline: d.registrationDeadline || '2026-08-08T23:59',
          isOpen: d.isOpen !== false,
        });
      }
    } catch (e) {
      console.warn('Failed to load gktest_settings:', e);
    }
  }, []);

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      await setDoc(doc(db, 'gktest_settings', 'config'), {
        registrationDeadline: deadlineConfig.registrationDeadline,
        isOpen: deadlineConfig.isOpen,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSettingsMsg('Registration deadline & status saved successfully!');
      setTimeout(() => setSettingsMsg(''), 4000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Fetch all registrations from Firestore
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'omr_registrations'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by submittedAt descending if available, or examNumber
      list.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        if (timeA && timeB) return timeB - timeA;
        return (a.examNumber || a.id).localeCompare(b.examNumber || b.id);
      });
      setRegistrations(list);
    } catch (err) {
      console.error('Failed to fetch OMR registrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setRegistrations(prev => prev.filter(r => r.id !== revokingDoc.id));
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

  // Filtered registrations
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter(r => {
      const matchesSearch = !q || (
        (r.name || '').toLowerCase().includes(q) ||
        (r.fatherName || '').toLowerCase().includes(q) ||
        (r.examNumber || r.id || '').toLowerCase().includes(q) ||
        (r.boardRegNo || '').toLowerCase().includes(q) ||
        (r.formNo || '').toLowerCase().includes(q) ||
        (r.className || '').toLowerCase().includes(q) ||
        (r.classRollNo || '').toLowerCase().includes(q)
      );

      const matchesClass = selectedClass === 'ALL' || (
        selectedClass === 'MANUAL' ? r.isManualEntry :
        (r.className || '').toLowerCase().includes(selectedClass.toLowerCase())
      );

      return matchesSearch && matchesClass;
    });
  }, [registrations, search, selectedClass]);

  // Stats calculation
  const totalCount = registrations.length;
  const manualCount = registrations.filter(r => r.isManualEntry).length;
  const matchedCount = totalCount - manualCount;

  // Deadline calculations
  const isDeadlinePassed = useMemo(() => {
    if (!deadlineConfig.registrationDeadline) return false;
    const dt = new Date(deadlineConfig.registrationDeadline);
    return !isNaN(dt.getTime()) && Date.now() > dt.getTime();
  }, [deadlineConfig.registrationDeadline]);

  const effectiveStatus = deadlineConfig.isOpen && !isDeadlinePassed;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-teal-500/20 backdrop-blur-md border border-teal-400/30 rounded-full px-3 py-1 text-xs font-bold text-teal-200 mb-2">
              <ShieldAlert size={14} className="text-yellow-400" />
              <span>Admin Management Panel</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              General Knowledge Quiz 2026 Registrations
            </h2>
            <p className="text-teal-200 text-xs sm:text-sm mt-1 max-w-xl">
              Manage student test registrations, set closing deadline, view & print admit cards, or revoke applications.
            </p>
          </div>

          <button
            onClick={fetchRegistrations}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Candidates</span>
          </button>
        </div>
      </div>

      {/* Registration Deadline & Portal Control Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Registration Deadline & Portal Control</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Set deadline date/time to show on student registration page and automatically close new registrations.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${effectiveStatus ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}>
              {effectiveStatus ? <Unlock size={13} /> : <Lock size={13} />}
              {effectiveStatus ? 'Portal OPEN' : isDeadlinePassed ? 'Closed (Deadline Passed)' : 'Portal CLOSED'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          {/* Status Toggle */}
          <div className="sm:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Registration Switch</label>
            <button
              type="button"
              onClick={() => setDeadlineConfig(prev => ({ ...prev, isOpen: !prev.isOpen }))}
              className={`w-full py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${deadlineConfig.isOpen ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300' : 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
            >
              {deadlineConfig.isOpen ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{deadlineConfig.isOpen ? 'Allow Registrations' : 'Force Close Portal'}</span>
            </button>
          </div>

          {/* Date Picker */}
          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Calendar size={13} /> Closing Date & Time (Deadline)
            </label>
            <input
              type="datetime-local"
              value={deadlineConfig.registrationDeadline}
              onChange={e => setDeadlineConfig(prev => ({ ...prev, registrationDeadline: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Save Button */}
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Save size={14} />
              <span>{savingSettings ? 'Saving...' : 'Save Deadline'}</span>
            </button>
          </div>
        </div>

        {settingsMsg && (
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
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
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Registered</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-black">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Database Matched</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{matchedCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center font-black">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Manual Entries</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{manualCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Name, Reg No, Exam Roll..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all placeholder-slate-400"
          />
        </div>

        {/* Filter by Class */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
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
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            ({filtered.length} shown)
          </span>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold">Loading OMR Test Candidates...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <p className="text-base font-bold text-slate-600 dark:text-slate-300">No Candidate Registrations Found</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or filter settings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-extrabold border-b border-slate-200 dark:border-slate-700">
                <tr>
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
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Exam Roll No */}
                    <td className="p-3">
                      <span className="font-mono font-black text-sm text-teal-800 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                        {r.examNumber || r.id}
                      </span>
                    </td>

                    {/* Candidate Details */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {r.photoUrl && (r.photoUrl.startsWith('http') || r.photoUrl.startsWith('data:')) ? (
                          <img src={r.photoUrl} alt={r.name} className="w-8 h-9 object-cover rounded border border-slate-300 dark:border-slate-700" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 flex items-center justify-center font-black text-xs">
                            {(r.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-xs">{r.name || '—'}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">S/O: {r.fatherName || '—'}</p>
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
                          onClick={() => setRevokingDoc(r)}
                          title="Revoke / Delete Registration"
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoke Confirm Dialog Modal */}
      {revokingDoc && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Revoke Candidate Registration?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You are about to revoke the test registration for:
              </p>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-left my-2 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <p><strong>Candidate:</strong> {revokingDoc.name}</p>
                <p><strong>Father's Name:</strong> {revokingDoc.fatherName}</p>
                <p><strong>Exam Roll No:</strong> <span className="font-mono font-bold text-teal-700 dark:text-teal-400">{revokingDoc.examNumber || revokingDoc.id}</span></p>
                <p><strong>Class:</strong> {revokingDoc.className}</p>
              </div>
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                ⚠️ Warning: This will permanently delete their application for the GK Test 2026. This candidate can register fresh afterwards.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRevokingDoc(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Revoking...</>
                ) : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Styled Revoke Success Dialog Modal */}
      {revokeSuccessInfo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Registration Revoked</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
          onClose={() => setSelectedDocForPrint(null)}
        />
      )}
    </div>
  );
}
