import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { db, auth } from '../services/firebase';
import {
  collection, getDocs, doc, setDoc, getDoc, updateDoc, query, where, limit, serverTimestamp, deleteField
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

function normalizeMobile(val) {
  const digits = String(val || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

// CamScanner-style document image processing filter
function applyCamScannerFilter(imageSrc, filterType) {
  return new Promise((resolve) => {
    if (!imageSrc) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const MAX = 1000;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      if (filterType === 'normal') {
        resolve(canvas.toDataURL('image/jpeg', 0.75));
        return;
      }

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;

        if (filterType === 'magic') {
          // CamScanner Magic Color filter
          if (gray > 165) {
            gray = 255;
          } else if (gray < 95) {
            gray = Math.max(0, gray - 35);
          } else {
            gray = ((gray - 128) * 1.5) + 128;
            gray = Math.min(255, Math.max(0, gray));
          }
        } else if (filterType === 'contrast') {
          // High contrast grayscale
          gray = ((gray - 128) * 1.8) + 128;
          gray = Math.min(255, Math.max(0, gray));
        }

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ['Search', 'Verify', 'Confirm', 'Done'];
  return (
    <div className="flex items-center justify-center gap-0 mb-3">
      {steps.map((label, idx) => {
        const num = idx + 1;
        const isActive = step === num;
        const isDone = step > num;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black transition-all duration-300
                  ${isDone ? 'bg-teal-600 text-white' : isActive ? 'bg-teal-800 text-white ring-2 ring-teal-200' : 'bg-slate-200 text-slate-400'}`}
              >
                {isDone ? '✓' : num}
              </div>
              <span className={`text-[9px] sm:text-[10px] mt-0.5 font-bold uppercase tracking-wide
                ${isActive ? 'text-teal-800' : isDone ? 'text-teal-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mb-3 mx-1 transition-all duration-300
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
  const [invTab, setInvTab] = useState('scan'); // 'scan' | 'gallery'
  const [invScanMode, setInvScanMode] = useState('single'); // 'single' | 'batch'
  const [invFlashOn, setInvFlashOn] = useState(true);
  const [invFilter, setInvFilter] = useState('magic'); // 'magic' | 'contrast' | 'normal'
  const [invExamNo, setInvExamNo] = useState('');
  const [invStudent, setInvStudent] = useState(null);
  const [invRawPhoto, setInvRawPhoto] = useState(null); // un-filtered photo
  const [invPhoto, setInvPhoto] = useState(null);       // filtered data URL preview
  const [invUploading, setInvUploading] = useState(false);
  const [invError, setInvError] = useState('');
  const [invSuccess, setInvSuccess] = useState(false);
  const [invSecretCount, setInvSecretCount] = useState(0);
  const [invGalleryList, setInvGalleryList] = useState([]);
  const [invGalleryLoading, setInvGalleryLoading] = useState(false);
  const [invGalleryQuery, setInvGalleryQuery] = useState('');
  const [invDeletingId, setInvDeletingId] = useState(null);
  const [invPreviewUrl, setInvPreviewUrl] = useState(null);
  const [invLiveStream, setInvLiveStream] = useState(null);
  const invFileRef = useRef(null);
  const invVideoRef = useRef(null);

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
        } else {
          const qMobile = normalizeMobile(input);
          if (qMobile.length >= 10) {
            const mobileSnap = await getDocs(
              query(collection(db, 'omr_registrations'), where('mobile', '==', qMobile), limit(1))
            );
            if (!mobileSnap.empty) {
              const d = mobileSnap.docs[0];
              existingReg = { id: d.id, ...d.data() };
            }
          }
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
        if (!st) return;
        if (found && found.photoUrl) return; // Already have a complete match with photo

        const regNorm = normalizeInput(
          st.boardRegNo || st['Board Registration Number'] ||
          st['Board Registration No. (Class 10th)'] ||
          st['Board Registration No. (Class 11th)'] ||
          st['Board Reg. No.'] || st.regNo || ''
        );
        const formNorm = normalizeInput(
          st.formNo || st['Form Number'] || st['Form No.'] || st['FormNo'] || ''
        );
        const rawMobile = st.mobile || st.phone || st['Mobile No.'] || st['Mobile No'] ||
          st['Mobile Number'] || st['Mobile No. (with working WhatsApp)'] ||
          st['WhatsApp Number'] || st['Contact No.'] || st['Phone'] || st['Mobile'] ||
          st['contactNo'] || st['mobileNo'] || '';
        const mobileNorm = normalizeMobile(rawMobile);

        let match = false;
        if (inputType === 'regNo') {
          match = regNorm === q;
        } else if (inputType === 'formNo') {
          match = formNorm === q;
        } else if (inputType === 'mobile') {
          const qMobile = normalizeMobile(input);
          match = qMobile.length >= 10 && mobileNorm === qMobile;
        }

        if (!match) return;

        const rawPhoto = st.photoUrl || st.photo_id || st['Student Photo'] ||
          st['Student Photograph'] || st['Photo'] || st['photo'] || st['photoId'] || null;
        const photo = resolvePhoto(rawPhoto);
        const rollNo = st.classRollNo || st['Class Roll No'] || st['Class Roll No.'] ||
          st['Class R.No.'] || st['Class R.No'] || st['Roll No.'] || st['Roll No'] ||
          st['rollNo'] || st['roll_no'] || st['classRoll'] || '';
        const session = st.session || st['Session'] || st.Session || '';

        const candidate = {
          id: docId,
          name: st.studentName || st["Student's Name"] || st["Student's Name (as per school records)"] || st['Student Name'] || st['Name'] || '',
          fatherName: st.fatherName || st["Father's Name"] || st["Father's/Guardian's Name (as per school records)"] || st['Father Name'] || '',
          className: st.class || st['Class'] || st['Current Class'] || '',
          classRollNo: rollNo,
          session: session || '2025-26',
          boardRegNo: st.boardRegNo || st['Board Registration Number'] || st['Board Registration No. (Class 10th)'] || st['Board Registration No. (Class 11th)'] || st['Board Reg. No.'] || st['Registration No.'] || st.regNo || '',
          formNo: st.formNo || st['Form Number'] || st['Form No.'] || st['FormNo'] || '',
          mobile: mobileNorm,
          photoUrl: photo,
        };

        if (!found) {
          found = candidate;
        } else if (candidate.photoUrl) {
          // If previous match had no photo, upgrade to candidate with photo!
          found = {
            ...candidate,
            className: candidate.className || found.className,
            classRollNo: candidate.classRollNo || found.classRollNo,
            session: candidate.session || found.session,
          };
        }
      };

      const processSnap = (snap) => {
        snap.docs.forEach(d => {
          if (found && found.photoUrl) return;
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

      // Keep searching registerdata and admissions if we don't have a photo yet!
      if (!found || !found.photoUrl) {
        const regDataSnap = await getDocs(collection(db, 'registerdata'));
        processSnap(regDataSnap);
      }

      if (!found || !found.photoUrl) {
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
            : inputType === 'formNo'
            ? 'No record found for this Form Number.'
            : 'No record found for this Mobile Number.'
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
        mobile: normalizeMobile(input),
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
        mobile: normalizeMobile(student.mobile || (inputType === 'mobile' ? input : '')),
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

  // ── Invigilator Mode: look up candidate then upload OMR photo ──────────
  const handleInvLookup = useCallback(async () => {
    const q = invExamNo.trim();
    if (!q) return;
    setInvError('');
    setInvStudent(null);
    try {
      await ensureAuth();
      const qNorm = q.toLowerCase();
      let foundDoc = null;

      // 1. Direct doc lookup by Exam Roll Number
      const directSnap = await getDoc(doc(db, 'omr_registrations', q));
      if (directSnap.exists()) {
        foundDoc = { id: directSnap.id, ...directSnap.data() };
      } else {
        // 2. Search omr_registrations by examNumber, boardRegNo, formNo, or mobile
        const snapAll = await getDocs(collection(db, 'omr_registrations'));
        const qMobile = normalizeMobile(q);
        snapAll.docs.forEach(d => {
          if (foundDoc) return;
          const data = d.data();
          const eNo = (data.examNumber || d.id || '').toLowerCase();
          const rNo = (data.boardRegNo || '').toLowerCase();
          const fNo = (data.formNo || '').toLowerCase();
          const mNo = normalizeMobile(data.mobile || '');

          if (
            eNo === qNorm ||
            rNo === qNorm ||
            fNo === qNorm ||
            (qMobile.length >= 10 && mNo === qMobile)
          ) {
            foundDoc = { id: d.id, ...data };
          }
        });
      }

      if (!foundDoc) {
        setInvError('Registration not found. Enter valid Exam Roll No, Reg No, Form No, or Mobile No.');
        return;
      }
      setInvStudent(foundDoc);
    } catch (e) {
      console.error('Invigilator lookup error:', e);
      setInvError('Lookup failed. Check internet connection.');
    }
  }, [invExamNo]);

  const startInvLiveCamera = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        setInvLiveStream(stream);
        if (invVideoRef.current) {
          invVideoRef.current.srcObject = stream;
        }
      }
    } catch (e) {
      console.log('Live camera stream not supported or denied, fallback to file capture input:', e);
    }
  }, []);

  const stopInvLiveCamera = useCallback(() => {
    if (invLiveStream) {
      invLiveStream.getTracks().forEach(t => t.stop());
      setInvLiveStream(null);
    }
  }, [invLiveStream]);

  const snapInvPhoto = useCallback(async () => {
    if (invVideoRef.current && invLiveStream) {
      const vid = invVideoRef.current;
      const cvs = document.createElement('canvas');
      cvs.width = vid.videoWidth || 1280;
      cvs.height = vid.videoHeight || 720;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);
      const raw = cvs.toDataURL('image/jpeg', 0.92);
      setInvRawPhoto(raw);
      const filtered = await applyCamScannerFilter(raw, 'magic');
      setInvPhoto(filtered);
    } else {
      invFileRef.current?.click();
    }
  }, [invLiveStream]);

  const handleInvPhoto = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target.result;
      setInvRawPhoto(raw);
      const filtered = await applyCamScannerFilter(raw, 'magic');
      setInvPhoto(filtered);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFilterChange = useCallback(async (newFilter) => {
    setInvFilter(newFilter);
    if (invRawPhoto) {
      const filtered = await applyCamScannerFilter(invRawPhoto, newFilter);
      setInvPhoto(filtered);
    }
  }, [invRawPhoto]);

  const fetchInvGallery = useCallback(async () => {
    setInvGalleryLoading(true);
    try {
      await ensureAuth();
      const snap = await getDocs(collection(db, 'omr_registrations'));
      const list = [];
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.omrPhotoUrl) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => {
        const tA = a.omrUploadedAt?.toMillis ? a.omrUploadedAt.toMillis() : (a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0);
        const tB = b.omrUploadedAt?.toMillis ? b.omrUploadedAt.toMillis() : (b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0);
        return tB - tA;
      });
      setInvGalleryList(list);
    } catch (e) {
      console.error('Fetch invigilator gallery error:', e);
    } finally {
      setInvGalleryLoading(false);
    }
  }, []);

  const handleDeleteOmrPhoto = useCallback(async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to delete the scanned OMR photo for ${studentName || studentId}?`)) {
      return;
    }
    setInvDeletingId(studentId);
    try {
      await ensureAuth();
      await updateDoc(doc(db, 'omr_registrations', studentId), {
        omrPhotoUrl: deleteField(),
        omrUploadedAt: deleteField(),
        omrUploadedBy: deleteField(),
      });
      setInvGalleryList(prev => prev.filter(item => item.id !== studentId));
      if (invStudent?.id === studentId) {
        setInvStudent(prev => prev ? { ...prev, omrPhotoUrl: null } : null);
      }
    } catch (e) {
      console.error('Delete OMR error:', e);
      alert('Failed to delete OMR photo. Check internet connection.');
    } finally {
      setInvDeletingId(null);
    }
  }, [invStudent]);

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
    <div className="flex-1 min-h-[calc(100vh-var(--site-header-height,64px))] flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #0f4c3a 0%, #0f766e 40%, #134e4a 100%)' }}>
      <SEO
        title="GK Test Registration — Govt. HSS Shangus"
        description="Register for the General Knowledge Quiz to be held on 10 August 2026 at Govt. Hr. Sec. School Shangus."
      />

      {/* Header */}
      <div className="pt-4 pb-1 text-center px-3">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          {isRegistrationOpen ? (
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span className="text-emerald-200 text-[11px] font-black uppercase tracking-widest">Registration Open</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-red-500/30 backdrop-blur-md border border-red-400/40 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              <span className="text-red-100 text-[11px] font-black uppercase tracking-widest">Registration Closed</span>
            </div>
          )}
        </div>

        {formattedDeadline && isRegistrationOpen && (
          <div className="block max-w-md mx-auto">
            <span className="inline-block bg-amber-400/20 text-amber-200 backdrop-blur-sm text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-amber-400/30 mb-2">
              ⏰ Closes: <strong>{formattedDeadline}</strong>
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-md">
            General Knowledge Quiz
          </h1>

          {/* Compact Invigilator Mode Icon Button */}
          <button
            type="button"
            title="Staff / Invigilator OMR Scanner Mode"
            onClick={() => { setInvMode(true); setInvError(''); setInvSuccess(false); setInvStudent(null); setInvExamNo(''); setInvPhoto(null); setInvRawPhoto(null); }}
            className="inline-flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/40 active:bg-amber-500/60 text-amber-200 border border-amber-400/40 rounded-xl px-2 py-0.5 text-xs font-bold transition-all shadow-xs hover:scale-105 cursor-pointer"
          >
            <span className="text-sm">📸</span>
            <span className="hidden sm:inline text-[10px] font-black tracking-wider uppercase">Invigilator</span>
          </button>
        </div>

        <p className="text-teal-200 text-xs mt-0.5 font-medium">
          📅 10 August 2026 &nbsp;·&nbsp; Govt. Hr. Sec. School Shangus
        </p>
      </div>

      {/* Card */}
      <div className="max-w-md mx-auto px-3 py-3">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          <div className="bg-gradient-to-r from-teal-800 to-teal-700 px-4 pt-4 pb-2.5">
            <StepIndicator step={step} />
          </div>

          <div className="p-4 sm:p-5">

            {/* STEP 1 */}
            {step === 1 && (
              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 mb-0.5">
                    {isRegistrationOpen ? 'Find Your Record' : 'Search Registered Admit Card'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {isRegistrationOpen
                      ? 'Select search type and enter your details to fetch student record.'
                      : 'Enter your Reg No, Form No, or Mobile to fetch your Admit Card.'}
                  </p>
                </div>

                <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-bold bg-slate-50 p-1 gap-1">
                  <button type="button" onClick={() => { setInputType('regNo'); setFetchError(''); }}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${inputType === 'regNo' ? 'bg-teal-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    Reg. No.
                  </button>
                  <button type="button" onClick={() => { setInputType('formNo'); setFetchError(''); }}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${inputType === 'formNo' ? 'bg-teal-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    Form No.
                  </button>
                  <button type="button" onClick={() => { setInputType('mobile'); setFetchError(''); }}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${inputType === 'mobile' ? 'bg-teal-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    Mobile No.
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    {inputType === 'regNo' ? 'Board Registration Number' : inputType === 'formNo' ? 'Form Number' : 'Student / Parent Mobile Number'}
                  </label>
                  <input
                    type={inputType === 'mobile' ? 'tel' : 'text'}
                    value={input}
                    onChange={e => { setInput(e.target.value); setFetchError(''); }}
                    placeholder={
                      inputType === 'regNo' ? 'e.g. 250570' :
                      inputType === 'formNo' ? 'e.g. 1234' : 'e.g. 9906123456 (10-digit mobile)'
                    }
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all placeholder-slate-300"
                    required
                    autoFocus
                  />
                  {fetchError && <p className="mt-1.5 text-[11px] text-red-600 font-semibold bg-red-50 p-2 rounded-xl border border-red-200">{fetchError}</p>}
                </div>

                <button type="submit" disabled={fetching || !input.trim() || rateLocked}
                  className="w-full py-2.5 rounded-xl bg-teal-800 text-white font-bold text-xs tracking-wide hover:bg-teal-700 active:bg-teal-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md">
                  {fetching ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Searching...</>
                  ) : rateLocked ? `Locked — wait ${Math.ceil((rateLockUntil - Date.now()) / 1000)}s` : 'Search Records'}
                </button>

                {/* Show Fill Manually only when registration is OPEN */}
                {isRegistrationOpen ? (
                  <button type="button"
                    onClick={() => { setIsManual(true); setStep(2); }}
                    className="w-full py-2 rounded-xl border border-teal-700/30 text-teal-800 text-xs font-bold hover:bg-teal-50 transition-all">
                    Don't have Reg/Form/Mobile No? Fill manually →
                  </button>
                ) : (
                  <div className="text-center pt-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 italic">
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

        {/* ── Invigilator Mode Overlay (Authentic CamScanner OMR Suite) ───────── */}
        {invMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg overflow-y-auto print:hidden p-2 sm:p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100 flex flex-col max-h-[95vh]">
              
              {/* 1. CamScanner Top Control Bar (Clean & Focused) */}
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setInvMode(false); setInvStudent(null); setInvPhoto(null); setInvRawPhoto(null); setInvError(''); setInvSuccess(false); setInvExamNo(''); }}
                  className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
                  title="Close CamScanner"
                >
                  ✕
                </button>

                <h2 className="text-white text-sm font-black flex items-center gap-1.5">
                  <span>📸 CamScanner OMR Suite</span>
                </h2>

                {/* OMR List / Gallery Tab Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextTab = invTab === 'scan' ? 'gallery' : 'scan';
                    setInvTab(nextTab);
                    if (nextTab === 'gallery') fetchInvGallery();
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${invTab === 'gallery' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                >
                  {invTab === 'gallery' ? '📷 Scanner' : `📁 OMRs (${invGalleryList.length})`}
                </button>
              </div>

              {/* 2. Main Body Content */}
              <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">

                {/* SCANNER VIEW (TAB 1) */}
                {invTab === 'scan' && (
                  <div className="space-y-3">
                    
                    {/* Candidate Quick Search */}
                    <form onSubmit={(e) => { e.preventDefault(); handleInvLookup(); }} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-black text-amber-400 uppercase tracking-wide">Candidate Verification</span>
                        {invStudent && <span className="text-emerald-400 font-bold">✓ Student Verified</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={invExamNo}
                          onChange={e => { setInvExamNo(e.target.value); setInvStudent(null); setInvPhoto(null); setInvRawPhoto(null); setInvError(''); }}
                          placeholder="Enter Exam Roll No, Reg No, Form No, or Mobile"
                          className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100 outline-none transition-all placeholder-slate-600"
                          required
                        />
                        <button
                          type="submit"
                          disabled={!invExamNo.trim()}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black hover:bg-cyan-400 disabled:opacity-40 transition-all shadow-xs"
                        >
                          Find
                        </button>
                      </div>
                    </form>

                    {/* Candidate Badge */}
                    {invStudent && (
                      <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 p-2 rounded-xl">
                        {invStudent.photoUrl && (invStudent.photoUrl.startsWith('http') || invStudent.photoUrl.startsWith('data:')) ? (
                          <img src={invStudent.photoUrl} alt={invStudent.name} className="w-10 h-12 object-cover rounded-lg border border-slate-700" />
                        ) : (
                          <div className="w-10 h-12 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-base font-black">
                            {(invStudent.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="overflow-hidden text-xs">
                          <p className="font-bold text-white truncate">{invStudent.name}</p>
                          <p className="text-[11px] text-slate-400">{invStudent.className} · Roll {invStudent.classRollNo || '—'}</p>
                          <p className="text-[10px] font-mono text-cyan-400 font-bold">Exam Roll #{invStudent.id}</p>
                        </div>
                      </div>
                    )}

                    {/* CamScanner Authentic Viewfinder & Document Boundary Overlay */}
                    <div className="relative rounded-2xl overflow-hidden border-2 border-cyan-400/80 bg-slate-950 shadow-[0_0_20px_rgba(0,229,255,0.25)] flex flex-col items-center justify-center min-h-[220px]">
                      
                      {/* 3x3 Grid Overlay Lines */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20 border border-slate-400/30">
                        <div className="border-r border-b border-white"></div>
                        <div className="border-r border-b border-white"></div>
                        <div className="border-b border-white"></div>
                        <div className="border-r border-b border-white"></div>
                        <div className="border-r border-b border-white"></div>
                        <div className="border-b border-white"></div>
                        <div className="border-r border-white"></div>
                        <div className="border-r border-white"></div>
                        <div></div>
                      </div>

                      {/* Document Magnifier Loupe Circle at top-left corner */}
                      <div className="absolute top-2 left-2 z-10 w-10 h-10 rounded-full border-2 border-white bg-black/60 backdrop-blur-xs flex items-center justify-center shadow-lg">
                        <span className="text-[9px] font-black text-cyan-300">+</span>
                      </div>

                      {/* Single vs Batch Mode Switcher Pill inside bottom of Viewfinder */}
                      <div className="absolute bottom-2 z-10 bg-black/70 backdrop-blur-md rounded-full p-1 flex gap-1 border border-white/20 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setInvScanMode('single')}
                          className={`px-3 py-0.5 rounded-full transition-all ${invScanMode === 'single' ? 'bg-cyan-400 text-slate-950 font-black' : 'text-slate-300'}`}
                        >
                          Single
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvScanMode('batch')}
                          className={`px-3 py-0.5 rounded-full transition-all ${invScanMode === 'batch' ? 'bg-cyan-400 text-slate-950 font-black' : 'text-slate-300'}`}
                        >
                          Batch
                        </button>
                      </div>

                      <input
                        ref={invFileRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleInvPhoto}
                      />

                      {/* Preview Image vs Interactive Scan Trigger */}
                      {invPhoto ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
                          <img src={invPhoto} alt="CamScanner OMR Scan" className="max-h-52 object-contain rounded-lg border border-cyan-400/50" />
                          <div className="absolute top-2 right-2 bg-cyan-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            CamScanner {invFilter} Filter
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => invFileRef.current?.click()}
                          className="flex flex-col items-center justify-center p-6 text-center cursor-pointer group w-full h-full"
                        >
                          <div className="w-14 h-14 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/40 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
                            📄
                          </div>
                          <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Tap Shutter Button Below</span>
                          <span className="text-[10px] text-slate-400 mt-1">Align OMR Sheet inside Cyan Box</span>
                        </div>
                      )}
                    </div>



                    {/* OMR Scanner Status Bar */}
                    <div className="text-cyan-400 font-bold text-xs flex items-center justify-center gap-1.5 py-1 bg-slate-900/60 rounded-lg border border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> OMR Sheet Scanner Active
                    </div>

                    {/* Upload / Auto-Save Trigger */}
                    {invPhoto && (
                      <button
                        onClick={async () => {
                          await handleInvUpload();
                          if (invScanMode === 'batch') {
                            setInvStudent(null);
                            setInvPhoto(null);
                            setInvRawPhoto(null);
                            setInvExamNo('');
                          }
                        }}
                        disabled={!invStudent || invUploading}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 text-xs font-black hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg"
                      >
                        {invUploading ? (
                          <><span className="w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin inline-block" /> Uploading to Drive…</>
                        ) : '☁️ Save & Auto-Upload to Google Drive'}
                      </button>
                    )}

                    {invSuccess && (
                      <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-2.5 text-center text-xs font-bold text-emerald-300">
                        ✅ Upload Complete! Ready for next OMR sheet.
                      </div>
                    )}

                    {invError && (
                      <p className="text-red-400 text-xs font-bold bg-red-950/60 border border-red-500/40 rounded-xl p-2.5">{invError}</p>
                    )}
                  </div>
                )}


                {/* GALLERY VIEW (TAB 2: SCANNED OMRs LIST & DELETION) */}
                {invTab === 'gallery' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={invGalleryQuery}
                        onChange={e => setInvGalleryQuery(e.target.value)}
                        placeholder="Search uploaded OMRs by student name or roll no..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400 transition-all"
                      />
                      <button
                        type="button"
                        onClick={fetchInvGallery}
                        className="px-3 py-1.5 bg-slate-800 text-xs font-bold text-cyan-400 rounded-xl hover:bg-slate-700 transition-all"
                      >
                        🔄 Refresh
                      </button>
                    </div>

                    {invGalleryLoading ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                        Loading uploaded OMR photos...
                      </div>
                    ) : (
                      (() => {
                        const filtered = invGalleryList.filter(item => {
                          if (!invGalleryQuery.trim()) return true;
                          const q = invGalleryQuery.toLowerCase();
                          return (
                            (item.name || '').toLowerCase().includes(q) ||
                            (item.id || '').toLowerCase().includes(q) ||
                            (item.className || '').toLowerCase().includes(q)
                          );
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="py-10 text-center text-xs text-slate-500 bg-slate-950 rounded-2xl border border-slate-800 p-4">
                              {invGalleryList.length === 0 ? 'No OMR photos uploaded yet.' : 'No matching OMR photos found for this query.'}
                            </div>
                          );
                        }

                        return (
                          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                            {filtered.map(item => (
                              <div key={item.id} className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 flex items-center justify-between gap-3 transition-all">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  {item.omrPhotoUrl ? (
                                    <img
                                      src={item.omrPhotoUrl}
                                      alt="OMR Thumbnail"
                                      onClick={() => setInvPreviewUrl(item.omrPhotoUrl)}
                                      className="w-12 h-14 object-cover rounded-lg border border-slate-700 cursor-pointer hover:opacity-80 transition-opacity bg-black flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-12 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-xs flex-shrink-0">No Img</div>
                                  )}
                                  <div className="overflow-hidden text-xs">
                                    <p className="font-bold text-white truncate">{item.name || 'Student Record'}</p>
                                    <p className="text-[11px] text-slate-400">{item.className} · Roll {item.classRollNo || '—'}</p>
                                    <p className="text-[10px] font-mono text-cyan-400 font-bold">Exam Roll #{item.id}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setInvPreviewUrl(item.omrPhotoUrl)}
                                    className="px-2.5 py-1.5 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-[11px] font-semibold border border-slate-800 transition-all"
                                  >
                                    👁️ View
                                  </button>
                                  <button
                                    type="button"
                                    disabled={invDeletingId === item.id}
                                    onClick={() => handleDeleteOmrPhoto(item.id, item.name)}
                                    className="px-2.5 py-1.5 bg-red-950/60 text-red-300 hover:bg-red-900 hover:text-white rounded-lg text-[11px] font-semibold border border-red-800/40 transition-all disabled:opacity-40"
                                  >
                                    {invDeletingId === item.id ? 'Deleting...' : '🗑️ Delete'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

              </div>

              {/* 3. Bottom Shutter Action Control Row (Authentic CamScanner Bottom Bar) */}
              {invTab === 'scan' && (
                <div className="bg-slate-950 border-t border-slate-800 px-6 py-3 flex items-center justify-between">
                  {/* Left: OMR List Button */}
                  <button
                    type="button"
                    onClick={() => { setInvTab('gallery'); fetchInvGallery(); }}
                    className="flex flex-col items-center text-slate-400 hover:text-white text-[10px] font-bold cursor-pointer"
                  >
                    <span className="text-lg">:::</span>
                    <span>All Scans</span>
                  </button>

                  {/* Center: Large CamScanner Shutter Ring Button */}
                  <div
                    onClick={snapInvPhoto}
                    className="w-16 h-16 rounded-full border-4 border-cyan-400 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform shadow-[0_0_15px_rgba(0,229,255,0.4)] bg-slate-900"
                    title="Open Camera / Capture OMR Photo"
                  >
                    <div className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                      <span className="text-xl">📷</span>
                    </div>
                  </div>

                  {/* Right: Import Image File */}
                  <button
                    type="button"
                    onClick={() => invFileRef.current?.click()}
                    className="flex flex-col items-center text-slate-400 hover:text-white text-[10px] font-bold cursor-pointer"
                  >
                    <span className="text-lg">🖼️</span>
                    <span>Import</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Full-Screen Lightbox Preview Modal for Scanned OMR Photo */}
        {invPreviewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 print:hidden" onClick={() => setInvPreviewUrl(null)}>
            <div className="relative max-w-2xl w-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden p-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-400">📄 Scanned OMR Answer Sheet Preview</span>
                <button
                  onClick={() => setInvPreviewUrl(null)}
                  className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm hover:bg-slate-700"
                >×</button>
              </div>
              <img src={invPreviewUrl} alt="OMR Sheet Full Preview" className="max-h-[80vh] w-full object-contain mx-auto rounded-lg" />
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
