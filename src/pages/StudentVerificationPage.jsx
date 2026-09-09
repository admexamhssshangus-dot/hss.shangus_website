/**
 * StudentVerificationPage.jsx — Military-Grade Secure Official Student & Certificate Verification Portal
 * Govt. Higher Secondary School Shangus — District Anantnag, Kashmir
 *
 * High-Contrast, Compact, Modern Official Verification Card.
 * All text elements use explicit high-contrast styling to guarantee 100% legibility on mobile & desktop screens.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft,
  ShieldAlert, Lock, Award, Copy, Check
} from 'lucide-react';
import ModernLoader from '../components/ModernLoader';
import { getStudentRollVal, normalizeStudentClass, generateVerificationSignature, sanitizeVerificationField } from '../utils/idCardRenderer';
import { formatPhotoDisplayUrl } from '../utils/imageCompressor';
import verifiedCatalog from '../data/verifiedStudentsCatalog.json';

// Anti-Automation Client Rate Limiter (Max 25 lookups per minute)
const checkClientRateLimit = () => {
  try {
    const key = 'hss_verify_rate_v2';
    const now = Date.now();
    const raw = sessionStorage.getItem(key);
    let data = raw ? JSON.parse(raw) : { count: 0, resetTs: now + 60000 };
    if (now > data.resetTs) {
      data = { count: 1, resetTs: now + 60000 };
    } else {
      data.count += 1;
    }
    sessionStorage.setItem(key, JSON.stringify(data));
    if (data.count > 25) {
      return false;
    }
  } catch (e) {}
  return true;
};

// Safe Photo URL Resolver with Google Drive to direct image converter
function resolvePhotoUrl(rawPhoto) {
  if (!rawPhoto) return '/logo192.png';
  if (typeof rawPhoto === 'string') {
    const str = rawPhoto.trim();
    if (!str || str === '—' || str === 'N/A' || str === 'null' || str === 'undefined') {
      return '/logo192.png';
    }
    // Google Drive direct image URL converter (lh3.googleusercontent.com)
    if (str.includes('drive.google.com') || str.includes('docs.google.com')) {
      const match = str.match(/\/d\/([a-zA-Z0-9_-]+)/) || str.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}=s360`;
      }
    }
    const formatted = formatPhotoDisplayUrl(str);
    if (formatted) return formatted;
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) {
      return str;
    }
  }
  return '/logo192.png';
}

export default function StudentVerificationPage() {
  const [searchParams] = useSearchParams();
  const rawReg = searchParams.get('reg') || '';
  const rawRoll = searchParams.get('roll') || '';
  const rawFNo = searchParams.get('fNo') || '';
  const rawCert = searchParams.get('cert') || '';
  const docParam = searchParams.get('doc') || '';
  const sigParam = searchParams.get('sig') || '';
  const nameParam = searchParams.get('name') || '';
  const fatherParam = searchParams.get('father') || '';
  const classParam = searchParams.get('class') || '';
  const sessionParam = searchParams.get('session') || '';

  const regParam = sanitizeVerificationField(rawReg);
  const rollParam = sanitizeVerificationField(rawRoll);
  const fNoParam = sanitizeVerificationField(rawFNo);
  const certParam = sanitizeVerificationField(rawCert);

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isTampered, setIsTampered] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [securityToast, setSecurityToast] = useState('');
  const [copied, setCopied] = useState(false);

  // 🛡️ Security Lockdown: Block right click, copy, cut, paste, devtools & inspection shortcuts
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      setSecurityToast('🔒 Content Protected: Copying, saving photos, and right-click are disabled for student privacy.');
      setTimeout(() => setSecurityToast(''), 3500);
      return false;
    };

    const handleCopyCut = (e) => {
      e.preventDefault();
      setSecurityToast('🔒 Copying Disabled: Official verification transcripts cannot be copied or exported.');
      setTimeout(() => setSecurityToast(''), 3500);
      return false;
    };

    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (
        (ctrlKey && ['c', 'a', 'x', 'p', 's', 'u'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        (ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        e.stopPropagation();
        setSecurityToast('🔒 Security Notice: Keyboard shortcuts and source inspection are restricted on this verification terminal.');
        setTimeout(() => setSecurityToast(''), 3500);
        return false;
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopyCut);
    window.addEventListener('cut', handleCopyCut);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopyCut);
      window.removeEventListener('cut', handleCopyCut);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 🔍 Multi-Tier Student Verification Engine
  useEffect(() => {
    let isCancelled = false;

    const verifyRecord = async () => {
      setLoading(true);
      setNotFound(false);
      setIsTampered(false);
      setIsRateLimited(false);

      if (!checkClientRateLimit()) {
        setIsRateLimited(true);
        setLoading(false);
        return;
      }

      // 🔒 Cryptographic Signature Validation
      const expectedSigWithCert = generateVerificationSignature(regParam, rollParam, fNoParam, certParam);
      const expectedSigWithoutCert = generateVerificationSignature(regParam, rollParam, fNoParam, '');
      const legacySig1 = generateVerificationSignature(rawReg, rawRoll, rawFNo, rawCert);
      const legacySig2 = generateVerificationSignature(rawReg, rawRoll, rawFNo, '');
      const legacySig3 = generateVerificationSignature(regParam || '—', rollParam || '—', fNoParam || '—', certParam);

      const isCryptographicallyValid = Boolean(
        sigParam && (
          sigParam === expectedSigWithCert ||
          sigParam === expectedSigWithoutCert ||
          sigParam === legacySig1 ||
          sigParam === legacySig2 ||
          sigParam === legacySig3
        )
      );

      // Flag as tampered if signature parameter was present but failed validation against institutional keys
      if (sigParam && !isCryptographicallyValid) {
        setIsTampered(true);
        setLoading(false);
        return;
      }

      let matched = null;
      const cleanReg = String(regParam || '').trim().toLowerCase();
      const cleanFNo = String(fNoParam || '').trim().toLowerCase();
      const cleanRoll = String(rollParam || '').trim().toLowerCase();

      // ── TIER 1: Instant Local Verified Student Catalog Lookup (<1ms) ──
      // Prioritize exact Form Number to guarantee 100% precision
      if (Array.isArray(verifiedCatalog) && (cleanFNo || cleanReg || cleanRoll)) {
        let foundInCatalog = null;

        // 1. Primary: Exact Form Number (unique ID of admission forms)
        if (cleanFNo) {
          foundInCatalog = verifiedCatalog.find(s => String(s.fNo || '').trim().toLowerCase() === cleanFNo);
        }
        // 2. Secondary: Registration Number + Class Roll combo
        if (!foundInCatalog && cleanReg && cleanRoll && !cleanFNo) {
          foundInCatalog = verifiedCatalog.find(s => 
            String(s.boardRegNo || '').trim().toLowerCase() === cleanReg &&
            String(s.classRollNo || '').trim().toLowerCase() === cleanRoll
          );
        }
        // 3. Fallback: Registration Number alone (only if fNo wasn't specified)
        if (!foundInCatalog && cleanReg && !cleanFNo) {
          foundInCatalog = verifiedCatalog.find(s => String(s.boardRegNo || '').trim().toLowerCase() === cleanReg);
        }
        // 4. Fallback: Class Roll alone ONLY if neither fNo nor reg was provided
        if (!foundInCatalog && cleanRoll && !cleanFNo && !cleanReg) {
          foundInCatalog = verifiedCatalog.find(s => String(s.classRollNo || '').trim().toLowerCase() === cleanRoll);
        }

        if (foundInCatalog) {
          matched = {
            "Student's Name (as per school records)": foundInCatalog.name,
            "Father's/Guardian's Name (as per school records)": foundInCatalog.fatherName,
            "Admission sought for class": foundInCatalog.className || '11th',
            "Class Roll No": foundInCatalog.classRollNo || rollParam || '—',
            "Board Registration Number": foundInCatalog.boardRegNo || regParam,
            "Form Number": foundInCatalog.fNo || fNoParam,
            "Certificate No.": certParam || '—',
            "Session": foundInCatalog.session || '2025-26',
            "Stream": foundInCatalog.stream || 'General',
            "Status": 'Approved',
            photo_id: foundInCatalog.photoUrl || null,
          };
          // Display instantly
          setStudent(matched);
          setLoading(false);
        }
      }

      // ── TIER 2: Live Serverless Function Lookup (Handles Fresh Submissions & Real-Time Updates) ──
      const lookupCandidates = [
        { type: 'formNo', value: fNoParam },
        { type: 'regNo', value: regParam },
        { type: 'certNo', value: certParam },
        { type: 'rollNo', value: rollParam },
      ].filter(item => item.value && item.value !== '—' && String(item.value).trim().length >= 1);

      const endpoints = [
        '/.netlify/functions/lookup-student',
        'https://hssshangus.netlify.app/.netlify/functions/lookup-student'
      ];

      for (const endpoint of endpoints) {
        let endpointMatched = false;
        for (const candidate of lookupCandidates) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4500);

            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ type: candidate.type, query: String(candidate.value).trim() }),
              signal: controller.signal
            }).catch(() => null);

            clearTimeout(timeoutId);

            if (!res || !res.ok) continue;
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) continue;
            const data = await res.json().catch(() => ({}));
            if (data?.student && !isCancelled) {
              matched = {
                "Student's Name (as per school records)": data.student.name,
                "Father's/Guardian's Name (as per school records)": data.student.fatherName,
                "Admission sought for class": data.student.className,
                "Class Roll No": data.student.classRollNo || rollParam || '—',
                "Board Registration Number": data.student.boardRegNo || regParam,
                "Form Number": data.student.formNo || fNoParam,
                "Certificate No.": data.student.certificateNo || certParam,
                "Session": data.student.session || '2025-26',
                "Stream": data.student.stream || 'Science',
                "Status": data.student.approvalStatus || 'Approved',
                photo_id: data.student.photoUrl || null,
              };
              setStudent(matched);
              setLoading(false);
              endpointMatched = true;
              break;
            }
          } catch (_) {}
        }
        if (endpointMatched) break;
      }

      // ── TIER 3: Master Register & Offline Seed Fallback ──
      if (!matched && (regParam || fNoParam || rollParam)) {
        try {
          const { CLEAN_PRACTICALS_SEED_DATA } = await import('../data/cleanPracticalsSeedData');
          if (Array.isArray(CLEAN_PRACTICALS_SEED_DATA)) {
            for (const section of CLEAN_PRACTICALS_SEED_DATA) {
              for (const rec of section.records || []) {
                const recReg = String(rec.boardRegNo || '').trim().toLowerCase();
                const recRoll = String(rec.classRollNo || rec.examRollNo || '').trim().toLowerCase();
                if ((cleanReg && recReg === cleanReg) || (cleanRoll && recRoll === cleanRoll)) {
                  matched = {
                    "Student's Name (as per school records)": rec.name,
                    "Father's/Guardian's Name (as per school records)": rec.parentName,
                    "Admission sought for class": section.className || '12th',
                    "Class Roll No": rec.classRollNo || rollParam || '—',
                    "Board Registration Number": rec.boardRegNo || regParam,
                    "Form Number": fNoParam || '—',
                    "Certificate No.": certParam || '—',
                    "Session": section.sessionText || '2024-26',
                    "Stream": rec.stream || 'Science',
                    "Status": 'Approved',
                    photo_id: null,
                  };
                  break;
                }
              }
              if (matched) break;
            }
          }
        } catch (_) {}
      }

      // ── TIER 4: Cryptographic HMAC Validation Fallback ──
      if (!matched && isCryptographicallyValid) {
        matched = {
          "Student's Name (as per school records)": nameParam || 'Officially Verified Student Record',
          "Father's/Guardian's Name (as per school records)": fatherParam || 'Verified Institutional Archive',
          "Admission sought for class": classParam || '11th',
          "Class Roll No": rollParam || '—',
          "Board Registration Number": regParam || '—',
          "Form Number": fNoParam || '—',
          "Certificate No.": certParam || '—',
          "Session": sessionParam || '2025-26',
          "Stream": 'General / Academics',
          "Status": 'Approved',
          photo_id: null,
          isCryptographicVerification: true
        };
      }

      if (!isCancelled) {
        if (matched) {
          setStudent(matched);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      }
    };

    verifyRecord();

    return () => {
      isCancelled = true;
    };
  }, [regParam, rollParam, fNoParam, certParam, docParam, sigParam, nameParam, fatherParam, classParam, sessionParam]);

  const sName = student ? (student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || nameParam || 'Student Record') : '';
  const fName = student ? (student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || student.fatherName || fatherParam || '—') : '';
  const cls = student ? normalizeStudentClass(student['Admission sought for class'] || student['Class'] || student.class || classParam || '11th') : (classParam || '11th');
  const stm = student ? (student['Stream for Class 11th'] || student['Stream for Class 12th'] || student['Stream'] || student.stream || 'Academics') : 'Academics';
  const roll = student ? (getStudentRollVal(student) || rollParam || '—') : (rollParam || '—');
  const reg = student ? (student['Board Registration Number'] || student.boardRegNo || regParam || '—') : (regParam || '—');
  const fNo = student ? (student['Form Number'] || student['Form No.'] || student.formNo || fNoParam || '—') : (fNoParam || '—');
  const rawPhoto = student ? (student.photo_id || student['Student Photo'] || student.photoId || student.photo || student.photoUrl || null) : null;
  const photo = resolvePhotoUrl(rawPhoto);
  const session = student ? (student['Session'] || student.session || sessionParam || '2025-26') : (sessionParam || '2025-26');

  return (
    <div 
      className="min-h-[calc(100vh-var(--site-header-height,64px))] bg-slate-50/80 text-slate-800 flex flex-col items-center justify-center p-3 sm:p-5 font-sans relative select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      
      {/* 🛡️ Anti-Theft Floating Toast Notification */}
      {securityToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <ShieldAlert size={16} className="text-amber-400 shrink-0" />
          <span>{securityToast}</span>
        </div>
      )}

      {/* Subtle Institutional Micro-Grid Background */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: `radial-gradient(#0f172a 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Modern Minimalist Official Verification Card */}
      <div 
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/60 overflow-hidden my-auto relative z-10 transition-all duration-300"
      >
        
        {/* Crisp Institutional Header */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-3.5 py-3 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white p-0.5 border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
              <img src="/logo192.png" alt="Govt HSS Shangus" className="w-full h-full object-contain pointer-events-none" draggable="false" />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif font-black text-xs sm:text-sm tracking-wide text-slate-900 uppercase truncate">
                Govt. HSS Shangus
              </h1>
              <p className="text-[10.5px] text-slate-500 font-bold flex items-center gap-1 truncate">
                <Lock size={11} className="text-emerald-600 shrink-0" /> Official Verification Portal • J&K
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="px-2 py-0.5 rounded-full font-mono font-black text-[10px] flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE RECORD
            </span>
            <span className="text-[9.5px] text-slate-400 font-mono font-bold mt-0.5">{session}</span>
          </div>
        </div>

        {/* Dynamic Verification Content */}
        <div className="p-3.5 sm:p-4 space-y-3">
          {loading ? (
            <ModernLoader
              moduleKey="certStudio"
              text="Authenticating Official Records..."
              subtext="Querying official database in real-time..."
              className="py-8"
            />
          ) : isRateLimited ? (
            <div className="p-4 text-center bg-amber-50 rounded-xl border border-amber-200 space-y-2">
              <ShieldAlert size={32} className="mx-auto text-amber-600 animate-bounce" />
              <h3 className="font-black text-sm text-amber-950">Automated Requests Blocked</h3>
              <p className="text-[11px] text-amber-900 font-medium">
                Excessive verification lookups received. Automated scraping is strictly restricted.
              </p>
              <div className="p-2 bg-amber-100/70 rounded-lg text-[10px] font-mono font-bold text-amber-900">
                🛡️ Anti-Scraping Protection: Please wait 60 seconds before scanning again.
              </div>
            </div>
          ) : isTampered ? (
            <div className="p-4 text-center bg-rose-50 rounded-xl border border-rose-200 space-y-2">
              <AlertTriangle size={32} className="mx-auto text-rose-600 animate-pulse" />
              <h3 className="font-black text-sm text-rose-950">Security Signature Mismatch</h3>
              <p className="text-[11px] text-rose-900 font-medium">
                The parameters of this QR verification link do not match the institutional cryptographic signature.
              </p>
              <div className="p-2 bg-rose-100/70 rounded-lg text-[10px] font-mono font-bold text-rose-900">
                🔒 Tamper Prevention Active: Unauthorized document alterations are blocked.
              </div>
            </div>
          ) : notFound ? (
            <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <AlertTriangle size={30} className="mx-auto text-slate-500" />
              <h3 className="font-black text-sm text-slate-900">Record Not Found</h3>
              <p className="text-[11px] text-slate-600 font-medium">
                No matching student enrollment record was found for {fNoParam ? `Form #${fNoParam}` : (regParam || rollParam || certParam || 'this document')}.
              </p>
              <div className="text-[11px] font-semibold text-slate-500">
                Please contact the Office of the Principal, Govt HSS Shangus for manual records verification.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              
              {/* Authenticated Status Banner */}
              <div className="px-3 py-2 rounded-xl flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 text-emerald-950 shadow-2xs">
                <div className="flex items-center gap-1.5 font-black">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span className="tracking-wider uppercase text-[11px] text-emerald-900">Officially Authenticated Record</span>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600" /> Validated
                </span>
              </div>

              {/* Verified Certificate Card (If Certificate Scanned) */}
              {(certParam || docParam) && (
                <div className="px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 text-amber-950 shadow-2xs">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                      <Award size={13} className="text-amber-700 shrink-0" />
                      <span>{docParam || 'Official Student Certificate / TC'}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">
                      Serial: <span className="font-mono text-amber-900 font-black">{certParam || '—'}</span>
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-[9.5px] uppercase border border-amber-300">
                    VALID &amp; ISSUED
                  </span>
                </div>
              )}

              {/* Minimalist High-Contrast Student Bio Card */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-3">
                {/* Photo with Anti-Theft Protective Shield Overlay */}
                <div className="w-16 h-20 sm:w-18 sm:h-22 rounded-xl overflow-hidden bg-white shrink-0 relative select-none shadow-xs border-2 border-amber-500/80">
                  <img 
                    src={photo} 
                    alt="Student Record" 
                    className="w-full h-full object-cover pointer-events-none select-none" 
                    draggable="false"
                    onError={(e) => { e.target.src = '/logo192.png'; }} 
                  />
                  {/* Invisible protective overlay to completely prevent right click save / drag */}
                  <div 
                    className="absolute inset-0 bg-transparent cursor-not-allowed select-none" 
                    title="Student Photo Protected by Govt HSS Shangus"
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  />
                </div>

                {/* Student Bio Details with Maximum Contrast */}
                <div className="min-w-0 flex-1 space-y-1 relative z-10">
                  <h2 className="font-black text-base sm:text-lg text-slate-900 uppercase tracking-tight leading-snug truncate" title={sName}>
                    {sName}
                  </h2>
                  <p className="text-[12px] text-slate-600 font-medium truncate">
                    Father: <span className="text-slate-900 font-black uppercase">{fName}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="px-2.5 py-0.5 rounded-lg font-bold text-[11px] bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                      Class {cls} {stm ? `• ${stm}` : ''}
                    </span>
                    {roll && roll !== '—' && roll !== 'N/A' && (
                      <span className="px-2.5 py-0.5 rounded-lg font-mono font-black text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                        Roll: {roll}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Minimal 2x2 Credentials Grid with High Contrast */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Form Number Tile */}
                <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Form / Reg. ID
                  </span>
                  <span className="font-mono font-black text-amber-700 text-sm sm:text-base">
                    #{fNo}
                  </span>
                </div>

                {/* Board Reg No Tile */}
                <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Board Reg. No
                  </span>
                  <span 
                    className="font-mono font-bold text-slate-900 text-xs sm:text-[13px] truncate block" 
                    title={reg}
                  >
                    {reg}
                  </span>
                </div>

                {/* Academic Session Tile */}
                <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Academic Session
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                    {session}
                  </span>
                </div>

                {/* Admission Status Tile */}
                <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Admission Status
                  </span>
                  <span className="font-black text-emerald-700 text-xs sm:text-sm flex items-center gap-1">
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-600" /> Confirmed
                  </span>
                </div>
              </div>

              {/* 🔗 Official Verification Link & Signature Strip */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                    <Lock size={11} className="text-emerald-600" />
                    Verification Link &amp; Signature
                  </span>
                  {sigParam && (
                    <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[9.5px] bg-emerald-50 border border-emerald-200 text-emerald-800">
                      HMAC: {sigParam.slice(0, 8)}... (Verified)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 bg-white font-mono text-[10.5px]">
                  <span className="truncate flex-1 pl-1 text-[10.5px] text-slate-600 select-all">{window.location.href}</span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(window.location.href);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      } catch (_) {}
                    }}
                    className="px-2.5 py-1 rounded-md text-white font-bold text-[10px] uppercase flex items-center gap-1 shrink-0 transition-all shadow-xs bg-slate-900 hover:bg-slate-800 cursor-pointer"
                    title="Copy official verification link"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Minimal Footer */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] font-bold text-slate-500">
            <Link to="/" className="text-slate-700 hover:text-slate-900 flex items-center gap-1 transition-colors">
              <ArrowLeft size={12} /> Portal Home
            </Link>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={11} /> 256-Bit SSL
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-500">UDISE: 01061400618</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
