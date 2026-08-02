import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { db, auth } from '../services/firebase';
import {
  collection, getDocs, doc, setDoc, getDoc, updateDoc, query, where, limit, serverTimestamp
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import SEO from '../components/SEO';
import { generateGkTestAdmitCardPdf } from '../utils/pdfGenerator';

const APPS_SCRIPT_URL = process.env.REACT_APP_APPS_SCRIPT_URL;
const DRIVE_FOLDER_ID = '15YOPlfh2WHmXn7HEAoZEpSJbRCNZYaOF';


// Ensure anonymous auth before any Firestore read/write
async function ensureAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateExamNumber() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

function normalizeInput(val) {
  return String(val || '').trim().toLowerCase();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ['Search', 'Verify', 'Confirm', 'Done'];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, idx) => {
        const num = idx + 1;
        const isActive = step === num;
        const isDone = step > num;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300
                  ${isDone ? 'bg-teal-600 text-white' : isActive ? 'bg-teal-800 text-white ring-4 ring-teal-200' : 'bg-slate-200 text-slate-400'}`}
              >
                {isDone ? '✓' : num}
              </div>
              <span className={`text-[10px] mt-1 font-bold uppercase tracking-wide
                ${isActive ? 'text-teal-800' : isDone ? 'text-teal-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-12 sm:w-16 h-0.5 mb-4 mx-1 transition-all duration-300
                ${step > num ? 'bg-teal-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function PhotoAvatar({ src, name }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?')[0].toUpperCase();
  const fallback = (
    <div className="w-24 h-28 rounded-xl bg-teal-100 border-2 border-teal-300 flex items-center justify-center text-teal-700 text-3xl font-black shadow-md select-none">
      {initial}
    </div>
  );
  if (!src || imgError || (!src.startsWith('http') && !src.startsWith('data:'))) {
    return fallback;
  }
  return (
    <img
      src={src}
      alt={name}
      className="w-24 h-28 object-cover rounded-xl border-2 border-teal-500 shadow-md"
      onError={() => setImgError(true)}
    />
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center text-xs py-0.5 border-b border-slate-100 last:border-b-0">
      <span className="text-slate-500 font-semibold">{label}</span>
      <span className="text-slate-800 font-bold font-mono">{value || '—'}</span>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function GkTestRegistration() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState('regNo');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [student, setStudent] = useState(null);
  const [isManual, setIsManual] = useState(false);
  const [manualData, setManualData] = useState({ name: '', fatherName: '', className: '', classRollNo: '' });
  const [submitting, setSubmitting] = useState(false);
  const [examNumber, setExamNumber] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  // Anti-scraping: rate limit searches per session
  const [rateLocked, setRateLocked] = useState(false);
  const [rateLockUntil, setRateLockUntil] = useState(0);

  // Registration Deadline Settings
  const [gkConfig, setGkConfig] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        await ensureAuth();
        const snap = await getDoc(doc(db, 'gktest_settings', 'config'));
        if (snap.exists()) {
          setGkConfig(snap.data());
        }
      } catch (e) {
        console.warn('Failed to load GK Test config:', e);
      }
    };
    loadConfig();
  }, []);

  const isRegistrationOpen = useMemo(() => {
    if (!gkConfig) return true;
    if (gkConfig.isOpen === false) return false;
    if (gkConfig.registrationDeadline) {
      const dt = new Date(gkConfig.registrationDeadline);
      if (!isNaN(dt.getTime()) && Date.now() > dt.getTime()) {
        return false;
      }
    }
    return true;
  }, [gkConfig]);

  const formattedDeadline = useMemo(() => {
    if (!gkConfig?.registrationDeadline) return '';
    try {
      const dt = new Date(gkConfig.registrationDeadline);
      if (isNaN(dt.getTime())) return '';
      return dt.toLocaleString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  }, [gkConfig]);

  // Invigilator Mode
  const [invMode, setInvMode] = useState(false);
  const [invExamNo, setInvExamNo] = useState('');
  const [invStudent, setInvStudent] = useState(null);
  const [invPhoto, setInvPhoto] = useState(null);   // data URL preview
  const [invUploading, setInvUploading] = useState(false);
  const [invError, setInvError] = useState('');
  const [invSuccess, setInvSuccess] = useState(false);
  const [invSecretCount, setInvSecretCount] = useState(0);
  const invFileRef = useRef(null);

  // Check and enforce search rate limit (max 5 per session)
  // Returns { allowed: bool, lockUntil: number }
  const checkRateLimit = useCallback(() => {
    const KEY = 'gk_search_count';
    const LOCK_KEY = 'gk_search_lock_until';
    const lockUntil = parseInt(sessionStorage.getItem(LOCK_KEY) || '0', 10);
    if (Date.now() < lockUntil) {
      setRateLocked(true);
      setRateLockUntil(lockUntil);
      return { allowed: false, lockUntil };
    }
    // Lock expired — clear it
    if (lockUntil && Date.now() >= lockUntil) {
      sessionStorage.removeItem(LOCK_KEY);
      sessionStorage.removeItem(KEY);
      setRateLocked(false);
      setRateLockUntil(0);
    }
    const count = parseInt(sessionStorage.getItem(KEY) || '0', 10) + 1;
    sessionStorage.setItem(KEY, count);
    if (count > 5) {
      const until = Date.now() + 30000; // 30-second lockout
      sessionStorage.setItem(LOCK_KEY, until);
      setRateLocked(true);
      setRateLockUntil(until);
      return { allowed: false, lockUntil: until };
    }
    setRateLocked(false);
    return { allowed: true, lockUntil: 0 };
  }, []);

  // Auto-unlock when rate lock expires
  React.useEffect(() => {
    if (!rateLocked || !rateLockUntil) return;
    const remaining = rateLockUntil - Date.now();
    if (remaining <= 0) { setRateLocked(false); setRateLockUntil(0); return; }
    const t = setTimeout(() => {
      setRateLocked(false);
      setRateLockUntil(0);
      sessionStorage.removeItem('gk_search_lock_until');
      sessionStorage.removeItem('gk_search_count');
    }, remaining);
    return () => clearTimeout(t);
  }, [rateLocked, rateLockUntil]);

  // Step 1: Search — direct Firestore lookup (anonymous auth)
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    const q = normalizeInput(input);
    if (!q) return;

    // Client-side rate limit check
    const rateResult = checkRateLimit();
    if (!rateResult.allowed) {
      const secsLeft = Math.max(1, Math.ceil((rateResult.lockUntil - Date.now()) / 1000));
      setFetchError(`Too many searches. Please wait ${secsLeft}s before trying again.`);
      return;
    }

    setFetching(true);
    setFetchError('');
    setStudent(null);
    setIsManual(false);

    // 1-second minimum delay to slow brute-force enumeration
    await new Promise(r => setTimeout(r, 1000));

    try {
      await ensureAuth();

      // Check if already registered — targeted queries by field value
      const existingSnap = await getDocs(
        query(collection(db, 'omr_registrations'), where('boardRegNo', '==', q.toUpperCase()), limit(1))
      );
      let existingReg = null;
      if (!existingSnap.empty) {
        const d = existingSnap.docs[0];
        existingReg = { id: d.id, ...d.data() };
      } else {
        const formSnap = await getDocs(
          query(collection(db, 'omr_registrations'), where('formNo', '==', q), limit(1))
        );
        if (!formSnap.empty) {
          const d = formSnap.docs[0];
          existingReg = { id: d.id, ...d.data() };
        }
      }

      if (existingReg) {
        setAlreadyRegistered(true);
        setExamNumber(existingReg.examNumber || existingReg.id);
        setStudent(existingReg);
        setStep(4);
        return;
      }

      // If portal/deadline is closed and student isn't already registered, block new registration
      if (!isRegistrationOpen) {
        setFetchError(
          formattedDeadline
            ? `New registrations for GK Test 2026 are CLOSED (Deadline was: ${formattedDeadline}).`
            : 'New registrations for GK Test 2026 are currently CLOSED by administrator.'
        );
        return;
      }

      // Search masterRegisters → registerdata → admissions
      let found = null;

      const resolvePhoto = (raw) => {
        if (!raw) return null;
        // Convert Google Drive URLs to thumbnail format (no CORS block)
        if (raw.includes('drive.google.com') || raw.includes('drive.usercontent.google.com')) {
          const m = raw.match(/[-\w]{25,}/);
          if (m) return `https://lh3.googleusercontent.com/d/${m[0]}=w400`;
        }
        if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
        return null;
      };

      const extractStudent = (st, docId) => {
        if (!st || found) return;
        const regNorm = normalizeInput(
          st.boardRegNo || st['Board Registration Number'] ||
          st['Board Registration No. (Class 10th)'] ||
          st['Board Registration No. (Class 11th)'] ||
          st['Board Reg. No.'] || st.regNo || ''
        );
        const formNorm = normalizeInput(
          st.formNo || st['Form Number'] || st['Form No.'] || st['FormNo'] || ''
        );
        const match = inputType === 'regNo' ? regNorm === q : formNorm === q;
        if (!match) return;

        const rawPhoto = st.photoUrl || st.photo_id || st['Student Photo'] ||
          st['Student Photograph'] || st['Photo'] || st['photo'] || st['photoId'] || null;
        const rollNo = st.classRollNo || st['Class Roll No'] || st['Class Roll No.'] ||
          st['Class R.No.'] || st['Class R.No'] || st['Roll No.'] || st['Roll No'] ||
          st['rollNo'] || st['roll_no'] || st['classRoll'] || '';
        const session = st.session || st['Session'] || st.Session || '';

        found = {
          id: docId,
          name: st.studentName || st["Student's Name"] || st["Student's Name (as per school records)"] || st['Student Name'] || st['Name'] || '',
          fatherName: st.fatherName || st["Father's Name"] || st["Father's/Guardian's Name (as per school records)"] || st['Father Name'] || '',
          className: st.class || st['Class'] || st['Current Class'] || '',
          classRollNo: rollNo,
          session: session || '2025-26',
          boardRegNo: st.boardRegNo || st['Board Registration Number'] || st['Board Registration No. (Class 10th)'] || st['Board Registration No. (Class 11th)'] || st['Board Reg. No.'] || st['Registration No.'] || st.regNo || '',
          formNo: st.formNo || st['Form Number'] || st['Form No.'] || st['FormNo'] || '',
          photoUrl: resolvePhoto(rawPhoto),
        };
      };

      const processSnap = (snap) => {
        snap.docs.forEach(d => {
          if (found) return;
          const data = d.data();
          const docSession = data.Session || data.session || data.groupKey?.split('_')[0] || '';
          const docClass = data.class || data.Class || data.groupKey?.split('_')[1] || '';
          const items = data.items || data.data || data.records || data.students;
          if (Array.isArray(items)) {
            items.forEach(st => extractStudent({ session: docSession, class: docClass, ...st }, d.id));
          } else {
            extractStudent(data, d.id);
          }
        });
      };

      const masterSnap = await getDocs(collection(db, 'masterRegisters'));
      processSnap(masterSnap);

      if (!found) {
        const regDataSnap = await getDocs(collection(db, 'registerdata'));
        processSnap(regDataSnap);
      }

      if (!found) {
        const admSnap = await getDocs(collection(db, 'admissions'));
        processSnap(admSnap);
      }

      if (found) {
        setStudent(found);
        setStep(2);
      } else {
        setFetchError(
          inputType === 'regNo'
            ? 'No record found for this Registration Number.'
            : 'No record found for this Form Number.'
        );
      }
    } catch (err) {
      console.error('Search error:', err);
      setFetchError('Connection error. Please check your internet and try again.');
    } finally {
      setFetching(false);
    }
  }, [input, inputType]);

  // Step 3: Submit
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await ensureAuth();
      let finalExamNo = generateExamNumber();
      // Ensure uniqueness
      let unique = false;
      while (!unique) {
        const snap = await getDocs(
          query(collection(db, 'omr_registrations'), where('examNumber', '==', finalExamNo), limit(1))
        );
        if (snap.empty) { unique = true; } else { finalExamNo = generateExamNumber(); }
      }

      const payload = isManual ? {
        examNumber: finalExamNo,
        boardRegNo: normalizeInput(input).toUpperCase(),
        formNo: '',
        name: manualData.name.trim(),
        fatherName: manualData.fatherName.trim(),
        className: manualData.className.trim(),
        classRollNo: manualData.classRollNo.trim(),
        session: '2025-26',
        photoUrl: null,
        isManualEntry: true,
        submittedAt: serverTimestamp(),
        status: 'registered',
      } : {
        examNumber: finalExamNo,
        boardRegNo: student.boardRegNo || '',
        formNo: student.formNo || '',
        name: student.name,
        fatherName: student.fatherName,
        className: student.className,
        classRollNo: student.classRollNo,
        session: student.session || '2025-26',
        photoUrl: student.photoUrl || null,
        isManualEntry: false,
        submittedAt: serverTimestamp(),
        status: 'registered',
      };

      await setDoc(doc(db, 'omr_registrations', finalExamNo), payload);
      setExamNumber(finalExamNo);
      setAlreadyRegistered(false);
      setStep(4);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [isManual, input, manualData, student]);

  // ── Invigilator Mode: look up exam number then upload OMR photo ──────────
  const handleInvLookup = useCallback(async () => {
    const no = invExamNo.trim();
    if (!no) return;
    setInvError('');
    setInvStudent(null);
    try {
      await ensureAuth();
      const snap = await getDoc(doc(db, 'omr_registrations', no));
      if (!snap.exists()) {
        setInvError('Exam number not found. Please check and re-enter.');
        return;
      }
      setInvStudent({ id: snap.id, ...snap.data() });
    } catch (e) {
      setInvError('Lookup failed. Check internet connection.');
    }
  }, [invExamNo]);

  const handleInvPhoto = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Compress to JPEG max 800px, quality 0.72 for upload
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const MAX = 1000;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setInvPhoto(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleInvUpload = useCallback(async () => {
    if (!invPhoto || !invStudent) return;
    setInvUploading(true);
    setInvError('');
    try {
      // Upload to Google Drive via Apps Script bridge
      const b64 = invPhoto.split(',')[1];
      const mimeType = 'image/jpeg';
      const fileName = `OMR_${invStudent.id}_${Date.now()}.jpg`;

      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'uploadFileToDrive',
          params: {
            fileName,
            mimeType,
            base64Data: b64,
            folderId: DRIVE_FOLDER_ID,
          },
        }),
        redirect: 'follow',
      });
      const result = await resp.json();
      const driveUrl = result?.data?.viewUrl || result?.viewUrl || result?.data?.url || null;

      // Store OMR photo URL in Firestore
      await updateDoc(doc(db, 'omr_registrations', invStudent.id), {
        omrPhotoUrl: driveUrl || invPhoto, // fallback: store base64 if Drive fails
        omrUploadedAt: serverTimestamp(),
        omrUploadedBy: 'invigilator',
      });
      setInvSuccess(true);
    } catch (e) {
      console.error('OMR upload error:', e);
      // Fallback: store base64 directly in Firestore if Drive upload fails
      try {
        await updateDoc(doc(db, 'omr_registrations', invStudent.id), {
          omrPhotoUrl: invPhoto,
          omrUploadedAt: serverTimestamp(),
          omrUploadedBy: 'invigilator',
        });
        setInvSuccess(true);
      } catch (e2) {
        setInvError('Upload failed. Please try again or check internet.');
      }
    } finally {
      setInvUploading(false);
    }
  }, [invPhoto, invStudent]);

  return (
    <div className="flex-1" style={{ background: 'linear-gradient(135deg, #0f4c3a 0%, #0f766e 40%, #134e4a 100%)' }}>
      <SEO
        title="GK Test Registration — Govt. HSS Shangus"
        description="Register for the General Knowledge Quiz to be held on 10 August 2026 at Govt. Hr. Sec. School Shangus."
      />

      {/* Header */}
      <div className="pt-6 pb-2 text-center px-4">
        {isRegistrationOpen ? (
          <>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 rounded-full px-4 py-1.5 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span className="text-emerald-200 text-xs font-black uppercase tracking-widest">Registration Open</span>
            </div>
            {formattedDeadline && (
              <div className="block max-w-md mx-auto">
                <span className="inline-block bg-amber-400/20 text-amber-200 backdrop-blur-sm text-xs font-bold px-3 py-1 rounded-xl border border-amber-400/30 mb-3">
                  ⏰ Closes On: <strong>{formattedDeadline}</strong>
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="max-w-md mx-auto mb-3 space-y-2">
            <div className="inline-flex items-center gap-2 bg-red-500/30 backdrop-blur-md border border-red-400/40 rounded-full px-4 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              <span className="text-red-100 text-xs font-black uppercase tracking-widest">Registration Closed</span>
            </div>
            <div className="bg-red-950/70 text-red-200 text-xs font-semibold p-3 rounded-2xl border border-red-500/30 leading-relaxed">
              ⛔ New registrations for GK Test 2026 are closed.
              {formattedDeadline && <div className="text-red-300 font-bold mt-0.5">Deadline was: {formattedDeadline}</div>}
              <div className="text-white/80 text-[11px] mt-1 font-normal">
                If you have already registered, enter your Registration/Form Number below to view or download your Admit Card.
              </div>
            </div>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-lg">
          General Knowledge Quiz
        </h1>
        <p className="text-teal-200 text-sm mt-1 font-medium">
          📅 10 August 2026 &nbsp;·&nbsp; Govt. Hr. Sec. School Shangus
        </p>
        <p className="text-white/60 text-xs mt-1">60 Questions · MCQ Format · All Classes</p>
      </div>

      {/* Card */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          <div className="bg-gradient-to-r from-teal-800 to-teal-700 px-6 pt-6 pb-4">
            <StepIndicator step={step} />
          </div>

          <div className="p-6 sm:p-8">

            {/* STEP 1 */}
            {step === 1 && (
              <form onSubmit={handleSearch} className="space-y-5">
                <div>
                  <h2 className="text-xl font-black text-slate-800 mb-1">
                    {isRegistrationOpen ? 'Find Your Record' : 'Search Registered Admit Card'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isRegistrationOpen
                      ? 'Enter your Registration Number or Form Number to fetch your details.'
                      : 'Enter your Registration Number or Form Number to fetch your existing Admit Card.'}
                  </p>
                </div>

                <div className="flex rounded-xl overflow-hidden border border-slate-200 text-sm font-bold">
                  <button type="button" onClick={() => setInputType('regNo')}
                    className={`flex-1 py-2.5 transition-all ${inputType === 'regNo' ? 'bg-teal-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                    Reg. Number
                  </button>
                  <button type="button" onClick={() => setInputType('formNo')}
                    className={`flex-1 py-2.5 transition-all ${inputType === 'formNo' ? 'bg-teal-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                    Form Number
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    {inputType === 'regNo' ? 'Board Registration Number' : 'Form Number'}
                  </label>
                  <input
                    type="text"
                    value={input}
                    onChange={e => { setInput(e.target.value); setFetchError(''); }}
                    placeholder={inputType === 'regNo' ? 'e.g. 250570' : 'e.g. 1234'}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all placeholder-slate-300"
                    required
                    autoFocus
                  />
                  {fetchError && <p className="mt-2 text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">{fetchError}</p>}
                </div>

                <button type="submit" disabled={fetching || !input.trim() || rateLocked}
                  className="w-full py-3 rounded-xl bg-teal-800 text-white font-bold text-sm tracking-wide hover:bg-teal-700 active:bg-teal-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {fetching ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Searching...</>
                  ) : rateLocked ? `Locked — wait ${Math.ceil((rateLockUntil - Date.now()) / 1000)}s` : 'Search Records'}
                </button>

                {/* Show Fill Manually only when registration is OPEN */}
                {isRegistrationOpen ? (
                  <button type="button"
                    onClick={() => { setIsManual(true); setStep(2); }}
                    className="w-full py-2.5 rounded-xl border border-teal-700/30 text-teal-800 text-xs font-bold hover:bg-teal-50 transition-all">
                    Don't have Reg/Form No? Fill manually →
                  </button>
                ) : (
                  <div className="text-center pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 italic">
                      Manual registration is disabled because registration is closed.
                    </span>
                  </div>
                )}
              </form>
            )}

            {/* STEP 2 – Verify */}
            {step === 2 && !isManual && student && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-black text-slate-800 mb-1">Verify Your Details</h2>
                  <p className="text-xs text-slate-500">Please confirm this is your information before proceeding.</p>
                </div>
                <div className="flex gap-4 items-start bg-teal-50 border border-teal-100 rounded-2xl p-4">
                  <PhotoAvatar src={student.photoUrl} name={student.name} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div>
                      <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Name</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{student.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Father's Name</p>
                      <p className="text-xs font-semibold text-slate-700 truncate">{student.fatherName || '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Class</p>
                        <p className="text-xs font-semibold text-slate-700">{student.className || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Roll No</p>
                        <p className="text-xs font-semibold text-slate-700">{student.classRollNo || '—'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Reg. No.</p>
                        <p className="text-xs font-mono text-slate-700">{student.boardRegNo || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Session</p>
                        <p className="text-xs font-semibold text-slate-700">{student.session || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setStep(1); setFetchError(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all">
                    ← Back
                  </button>
                  <button onClick={() => setStep(3)}
                    className="flex-1 py-2.5 rounded-xl bg-teal-800 text-white font-bold text-sm hover:bg-teal-700 transition-all">
                    Yes, This Is Me →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 – Manual */}
            {step === 2 && isManual && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-black text-slate-800 mb-1">Manual Registration</h2>
                  <p className="text-xs text-slate-500">Please fill in your details carefully.</p>
                </div>
                {[
                  { key: 'name', label: "Student's Full Name", placeholder: 'As per school records' },
                  { key: 'fatherName', label: "Father's Name", placeholder: 'As per school records' },
                  { key: 'className', label: 'Current Class', placeholder: 'e.g. 12th' },
                  { key: 'classRollNo', label: 'Class Roll No.', placeholder: 'e.g. 15' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">{label} *</label>
                    <input
                      type="text"
                      value={manualData[key]}
                      onChange={e => setManualData(d => ({ ...d, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all placeholder-slate-300"
                    />
                  </div>
                ))}
                <div className="flex gap-3">
                  <button onClick={() => { setIsManual(false); setStep(1); }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all">
                    ← Back
                  </button>
                  <button onClick={() => {
                    const { name, fatherName, className, classRollNo } = manualData;
                    if (!name.trim() || !fatherName.trim() || !className.trim() || !classRollNo.trim()) {
                      alert('Please fill in all fields.'); return;
                    }
                    setStep(3);
                  }}
                    className="flex-1 py-2.5 rounded-xl bg-teal-800 text-white font-bold text-sm hover:bg-teal-700 transition-all">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 – Confirm */}
            {step === 3 && (
              <div className="space-y-5 text-center">
                <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto border-2 border-teal-200">
                  <span className="text-3xl">✅</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 mb-1">Confirm Registration</h2>
                  <p className="text-sm text-slate-500">
                    You are registering for the <strong className="text-slate-700">General Knowledge Quiz</strong><br />
                    to be held on <strong className="text-teal-700">10 August 2026</strong>.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 text-left space-y-1">
                  {isManual ? (
                    <>
                      <Row label="Name" value={manualData.name} />
                      <Row label="Father's Name" value={manualData.fatherName} />
                      <Row label="Class" value={manualData.className} />
                      <Row label="Roll No." value={manualData.classRollNo} />
                      <Row label="Session" value="2025-26" />
                    </>
                  ) : (
                    <>
                      <Row label="Name" value={student?.name} />
                      <Row label="Father's Name" value={student?.fatherName} />
                      <Row label="Class" value={student?.className} />
                      <Row label="Roll No." value={student?.classRollNo} />
                      <Row label="Reg. No." value={student?.boardRegNo} />
                      <Row label="Session" value={student?.session} />
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} disabled={submitting}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
                    ← Back
                  </button>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-teal-800 text-white font-bold text-sm hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Registering...</>
                    ) : 'Confirm & Register'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 – Success & Printable Admit Card */}
            {step === 4 && (
              <div className="text-center space-y-6">
                <div className="relative print:hidden">
                  <div className="w-20 h-20 bg-teal-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-teal-200">
                    <span className="text-4xl">🎉</span>
                  </div>
                  {!alreadyRegistered && (
                    <span className="absolute top-0 right-8 text-2xl animate-bounce">⭐</span>
                  )}
                </div>

                <div className="print:hidden">
                  <h2 className="text-2xl font-black text-slate-800">
                    {alreadyRegistered ? 'Registration Record Found!' : 'Registration Successful!'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {alreadyRegistered
                      ? 'Your registration details have been fetched. Your assigned exam number is:'
                      : 'Your exam number has been generated. Keep it safe for test day.'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-teal-800 to-teal-900 rounded-2xl p-6 text-white shadow-xl print:hidden">
                  <p className="text-xs font-bold uppercase tracking-widest text-teal-300 mb-2">Your Examination Roll Number</p>
                  <p className="text-5xl font-black tracking-widest font-mono">{examNumber}</p>
                  <p className="text-teal-300 text-xs mt-3">Remember this number — it will be printed on your OMR sheet</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left print:hidden">
                  <p className="text-xs font-bold text-amber-800 mb-1">📋 Test Guidelines & Instructions</p>
                  <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                    <li>Report to your examination hall by 9:00 AM on 10 August 2026</li>
                    <li>Bring a <strong>blue or black ballpoint pen</strong> for filling OMR bubbles (Do NOT use pencil)</li>
                    <li>An OMR sheet with your credentials will be provided at the hall</li>
                    <li>Mobile phones and gadgets are strictly prohibited</li>
                  </ul>
                </div>

                <button
                  onClick={() => generateGkTestAdmitCardPdf(student || {
                    examNumber,
                    name: manualData.name,
                    fatherName: manualData.fatherName,
                    className: manualData.className,
                    classRollNo: manualData.classRollNo,
                    boardRegNo: input || 'Manual',
                    session: '2025-26'
                  })}
                  className="w-full py-3.5 rounded-xl bg-teal-800 text-white text-sm font-black hover:bg-teal-700 active:bg-teal-900 transition-all flex items-center justify-center gap-2 shadow-lg print:hidden cursor-pointer"
                >
                  ⬇️ Download Official Admit Card (PDF)
                </button>

                {/* Printable Admit Card (Visible during print / window.print()) */}
                <div className="printable-admit-card text-left bg-white p-6 rounded-2xl border-2 border-slate-900 space-y-4 font-sans text-slate-900">
                  <div className="text-center border-b-2 border-slate-900 pb-3 space-y-0.5">
                    <h2 className="text-xl font-black uppercase tracking-wider text-teal-900">
                      Govt. Higher Secondary School Shangus
                    </h2>
                    <p className="text-xs font-bold text-slate-600">Anantnag, Jammu & Kashmir — 192201</p>
                    <div className="inline-block bg-teal-800 text-white text-xs font-black px-4 py-0.5 rounded-full uppercase tracking-widest mt-1">
                      General Knowledge Quiz 2026 Admit Card
                    </div>
                  </div>

                  <div className="bg-slate-50 border-2 border-dashed border-teal-800 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-teal-800">Assigned Examination Roll Number</p>
                    <p className="text-4xl font-black font-mono tracking-widest text-slate-900">{examNumber}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="col-span-1 flex flex-col items-center justify-center">
                      <PhotoAvatar src={student?.photoUrl} name={student?.name} />
                      <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Candidate Photograph</span>
                    </div>

                    <div className="col-span-2 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Candidate Name</span>
                          <span className="font-bold text-slate-900 text-sm truncate block">{student?.name || (isManual ? manualData.name : '—')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Father's Name</span>
                          <span className="font-bold text-slate-800 text-xs truncate block">{student?.fatherName || (isManual ? manualData.fatherName : '—')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Class</span>
                          <span className="font-bold text-slate-800">{student?.className || (isManual ? manualData.className : '—')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Class Roll No.</span>
                          <span className="font-bold text-slate-800">{student?.classRollNo || (isManual ? manualData.classRollNo : '—')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Board Reg. / Form No.</span>
                          <span className="font-bold font-mono text-slate-800">{student?.boardRegNo || student?.formNo || 'Manual Entry'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Session</span>
                          <span className="font-bold text-slate-800">{student?.session || '2025-26'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs grid grid-cols-2 gap-2 text-teal-900 font-semibold">
                    <div>📅 <strong>Date of Test:</strong> Monday, 10 August 2026</div>
                    <div>⏰ <strong>Reporting Time:</strong> 09:00 AM</div>
                    <div>📍 <strong>Venue:</strong> Main Hall, HSS Shangus</div>
                    <div>📝 <strong>Format:</strong> 60 MCQs (OMR Format)</div>
                  </div>

                  <div className="text-[10px] text-slate-600 space-y-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <p className="font-bold text-slate-800 uppercase">Important Candidate Instructions:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Bring this Admit Card and your school Identity Card to the examination hall.</li>
                      <li>Bring a <strong>blue or black ballpoint pen</strong> for darkening OMR circles. Do NOT use pencil.</li>
                      <li>Fill your 7-digit Exam Roll Number carefully on your OMR sheet.</li>
                      <li>Mobile phones and gadgets are strictly forbidden inside the hall.</li>
                    </ul>
                  </div>

                  <div className="pt-6 grid grid-cols-3 gap-4 text-center text-[10px] font-bold text-slate-700">
                    <div className="border-t border-slate-400 pt-1">Candidate's Signature</div>
                    <div className="border-t border-slate-400 pt-1">Invigilator's Signature</div>
                    <div className="border-t border-slate-400 pt-1">Convener / Principal Seal</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
        <p
          className="text-center text-white/40 text-xs mt-6 pb-4 print:hidden cursor-default select-none"
          onClick={() => {
            const next = invSecretCount + 1;
            setInvSecretCount(next);
            if (next >= 5) { setInvMode(true); setInvSecretCount(0); }
          }}
        >
          Govt. Hr. Sec. School Shangus — GK Test 2026
        </p>

        {/* ── Invigilator Mode Overlay ─────────────────────────────────── */}
        {invMode && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto print:hidden" style={{paddingTop: '5vh', paddingBottom: '5vh'}}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-[10px] font-bold uppercase tracking-widest">Staff Only</p>
                    <h2 className="text-white text-lg font-black mt-0.5">📋 Invigilator Mode</h2>
                    <p className="text-amber-100/80 text-xs mt-0.5">Upload OMR sheet photo after exam</p>
                  </div>
                  <button
                    onClick={() => { setInvMode(false); setInvStudent(null); setInvPhoto(null); setInvError(''); setInvSuccess(false); setInvExamNo(''); }}
                    className="w-8 h-8 rounded-full bg-white/20 text-white text-lg flex items-center justify-center hover:bg-white/30 transition-all"
                  >×</button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {invSuccess ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto text-3xl">✅</div>
                    <p className="text-green-700 font-black text-lg">OMR Photo Uploaded!</p>
                    <p className="text-slate-500 text-sm">Photo saved for <span className="font-bold text-slate-700">{invStudent?.name}</span></p>
                    <button
                      onClick={() => { setInvStudent(null); setInvPhoto(null); setInvError(''); setInvSuccess(false); setInvExamNo(''); }}
                      className="mt-2 w-full py-3 rounded-xl bg-amber-600 text-white text-sm font-black hover:bg-amber-700 transition-all"
                    >Upload Another</button>
                  </div>
                ) : (
                  <>
                    {/* Step 1: Enter Exam Number */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-600 uppercase tracking-wide">7-Digit Exam Roll Number</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={7}
                          value={invExamNo}
                          onChange={e => { setInvExamNo(e.target.value.replace(/\D/g, '')); setInvStudent(null); setInvPhoto(null); setInvError(''); }}
                          placeholder="e.g. 3041827"
                          className="flex-1 border-2 border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm font-bold outline-none transition-all font-mono tracking-widest"
                        />
                        <button
                          onClick={handleInvLookup}
                          disabled={invExamNo.length < 7}
                          className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-black hover:bg-amber-700 disabled:opacity-40 transition-all"
                        >Find</button>
                      </div>
                    </div>

                    {/* Student Found */}
                    {invStudent && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          {invStudent.photoUrl && (invStudent.photoUrl.startsWith('http') || invStudent.photoUrl.startsWith('data:')) ? (
                            <img src={invStudent.photoUrl} alt={invStudent.name} className="w-14 h-16 object-cover rounded-xl border-2 border-amber-300 shadow" />
                          ) : (
                            <div className="w-14 h-16 rounded-xl bg-amber-200 border-2 border-amber-300 flex items-center justify-center text-amber-700 text-2xl font-black">
                              {(invStudent.name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-black text-slate-800">{invStudent.name}</p>
                            <p className="text-xs text-slate-500">{invStudent.className} · Roll {invStudent.classRollNo || '—'}</p>
                            <p className="text-xs font-mono text-amber-700 font-bold">#{invStudent.id}</p>
                            {invStudent.omrPhotoUrl && (
                              <p className="text-[10px] text-green-600 font-bold mt-0.5">✓ OMR already uploaded</p>
                            )}
                          </div>
                        </div>

                        {/* Step 2: Capture Photo */}
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-600 uppercase tracking-wide">OMR Sheet Photo</label>
                          <input
                            ref={invFileRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleInvPhoto}
                          />
                          <button
                            onClick={() => invFileRef.current?.click()}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-amber-400 text-amber-700 text-sm font-bold hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                          >
                            📷 {invPhoto ? 'Retake / Change Photo' : 'Capture OMR Sheet'}
                          </button>

                          {/* Preview */}
                          {invPhoto && (
                            <div className="relative rounded-xl overflow-hidden border-2 border-amber-400 shadow-md">
                              <img src={invPhoto} alt="OMR Preview" className="w-full object-contain max-h-52" />
                              <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">Preview</div>
                            </div>
                          )}
                        </div>

                        {/* Step 3: Upload */}
                        <button
                          onClick={handleInvUpload}
                          disabled={!invPhoto || invUploading}
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-black hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          {invUploading ? (
                            <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Uploading…</>
                          ) : '☁️ Upload to Server'}
                        </button>
                      </div>
                    )}

                    {invError && (
                      <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{invError}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}


        {/* Global Print Stylesheet to hide site layout when printing */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .printable-admit-card, .printable-admit-card * { visibility: visible !important; }
            .printable-admit-card {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 20px !important;
              background: white !important;
              border: 2px solid #0f766e !important;
              box-shadow: none !important;
            }
            nav, footer, .print\\:hidden { display: none !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
