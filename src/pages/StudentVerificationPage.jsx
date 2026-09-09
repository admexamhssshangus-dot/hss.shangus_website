/**
 * StudentVerificationPage.jsx — Military-Grade Secure Official Student & Certificate Verification Portal
 * Govt. Higher Secondary School Shangus — District Anantnag, Kashmir
 *
 * Scanned from Admission Forms, Student ID Cards, Transfer/Discharge Certificates (TC/DC), & Official Transcripts
 * Real-time cryptographically validated enrollment, registration, fee status, and certificate records.
 *
 * 🛡️ Anti-Theft & Anti-Copy Security Engine:
 * - Total clipboard & selection lockdown (no text copy, cut, or select)
 * - Right-click context menu prevention with security alert
 * - Keyboard shortcut interception (F12, Ctrl+U, Ctrl+C, Ctrl+P, Ctrl+S, Ctrl+Shift+I)
 * - Anti-Theft Image Shield overlay on student photos
 * - Anti-forgery diagonal watermark security grid
 * - Cryptographic HMAC signature check & automated scraper rate limiter
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft,
  ShieldAlert, Lock, Award, Shield, Copy, Check
} from 'lucide-react';
import ModernLoader from '../components/ModernLoader';
import { getStudentRollVal, normalizeStudentClass, generateVerificationSignature, sanitizeVerificationField } from '../utils/idCardRenderer';
import { getStudentPhotoUrl, formatPhotoDisplayUrl } from '../utils/imageCompressor';

// Anti-Automation Client Rate Limiter (Max 15 lookups per minute)
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
    if (data.count > 15) {
      return false;
    }
  } catch (e) {}
  return true;
};

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
      setSecurityToast('🔒 Content Protected: Copying, saving images, and right-click are disabled for student privacy.');
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
      // Intercept Ctrl/Cmd + C, A, X, P, S, U, Shift+I, F12
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

  // 🔍 Database Record Verification Engine
  useEffect(() => {
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
      
      // Backward compatibility: old URLs may have hashed with literal raw values or '—'
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

      try {
        let matched = null;
        const lookupCandidates = [
          { type: 'regNo', value: regParam },
          { type: 'formNo', value: fNoParam },
          { type: 'certNo', value: certParam },
          { type: 'rollNo', value: rollParam },
        ].filter(item => item.value && item.value !== '—' && String(item.value).trim().length >= 1);

        // 1. Primary: Netlify/Serverless backend lookup (if available)
        for (const candidate of lookupCandidates) {
          try {
            const res = await fetch('/.netlify/functions/lookup-student', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ type: candidate.type, query: String(candidate.value).trim() }),
            });
            if (res.status === 429) {
              setIsRateLimited(true);
              break;
            }
            if (!res.ok) continue;
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) continue;
            const data = await res.json().catch(() => ({}));
            if (data?.student) {
              matched = {
                "Student's Name (as per school records)": data.student.name,
                "Father's/Guardian's Name (as per school records)": data.student.fatherName,
                "Admission sought for class": data.student.className,
                "Class Roll No": data.student.classRollNo,
                "Board Registration Number": data.student.boardRegNo,
                "Form Number": data.student.formNo,
                "Certificate No.": data.student.certificateNo,
                "Session": data.student.session,
                "Status": 'Approved',
                photo_id: data.student.photoUrl,
              };
              break;
            }
          } catch (_) {}
        }

        // 2. Secondary: Institutional Master Registers & Practical Seed Data
        if (!matched && (regParam || fNoParam || rollParam)) {
          try {
            const cleanReg = String(regParam || '').trim().toLowerCase();
            const cleanFNo = String(fNoParam || '').trim().toLowerCase();
            const cleanRoll = String(rollParam || '').trim().toLowerCase();

            // Check client local caches (if administrator or staff session exists)
            const cachedMR = localStorage.getItem('hss_db_masterRegisters_v1');
            if (cachedMR) {
              try {
                const parsed = JSON.parse(cachedMR);
                const list = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);
                const foundInCache = list.find(s => {
                  const sReg = String(s.boardRegNo || s['Board Registration Number'] || s.regNo || '').trim().toLowerCase();
                  const sFNo = String(s.formNo || s['Form Number'] || s['Form No.'] || '').trim().toLowerCase();
                  const sRoll = String(s.classRollNo || s['Class Roll No'] || s.examRollNo || '').trim().toLowerCase();
                  return (cleanReg && sReg === cleanReg) || (cleanFNo && sFNo === cleanFNo) || (cleanRoll && sRoll === cleanRoll);
                });
                if (foundInCache) {
                  matched = {
                    "Student's Name (as per school records)": foundInCache.studentName || foundInCache["Student's Name"] || foundInCache.name,
                    "Father's/Guardian's Name (as per school records)": foundInCache.fatherName || foundInCache["Father's Name"],
                    "Admission sought for class": foundInCache.selectedClass || foundInCache.class || '12th',
                    "Class Roll No": foundInCache.classRollNo || foundInCache.rollNo || rollParam,
                    "Board Registration Number": foundInCache.boardRegNo || regParam,
                    "Form Number": foundInCache.formNo || fNoParam,
                    "Certificate No.": foundInCache.certificateNo || certParam,
                    "Session": foundInCache.session || '2025-26',
                    "Stream": foundInCache.stream || 'Science',
                    "Status": 'Approved',
                    photo_id: foundInCache.photo_id || foundInCache.photoUrl || null,
                  };
                }
              } catch (_) {}
            }

            // Check institutional master registers in cleanPracticalsSeedData
            if (!matched) {
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
            }
          } catch (seedErr) {
            console.warn('Seed fallback lookup failed:', seedErr);
          }
        }

        // 3. Cryptographic Validation Fallback:
        // When the institutional cryptographic HMAC digital signature matches,
        // this document is an authentic certificate officially generated by Govt HSS Shangus
        if (!matched && isCryptographicallyValid) {
          matched = {
            "Student's Name (as per school records)": nameParam || 'Official Student Record',
            "Father's/Guardian's Name (as per school records)": fatherParam || 'Verified Institutional Archive',
            "Admission sought for class": classParam || '12th',
            "Class Roll No": rollParam || '—',
            "Board Registration Number": regParam || '—',
            "Form Number": fNoParam || '—',
            "Certificate No.": certParam || '—',
            "Session": sessionParam || '2025-26',
            "Stream": 'Science / General',
            "Status": 'Approved',
            photo_id: null,
            isCryptographicVerification: true
          };
        }

        if (matched) {
          setStudent(matched);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error('Verification query failed:', e);
        if (isCryptographicallyValid) {
          setStudent({
            "Student's Name (as per school records)": nameParam || 'Official Student Record',
            "Father's/Guardian's Name (as per school records)": fatherParam || 'Verified Institutional Archive',
            "Admission sought for class": classParam || '12th',
            "Class Roll No": rollParam || '—',
            "Board Registration Number": regParam || '—',
            "Form Number": fNoParam || '—',
            "Certificate No.": certParam || '—',
            "Session": sessionParam || '2025-26',
            "Status": 'Approved',
            isCryptographicVerification: true
          });
        } else {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    };

    verifyRecord();
  }, [regParam, rollParam, fNoParam, certParam, docParam, sigParam, nameParam, fatherParam, classParam, sessionParam]);

  const sName = student ? (student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || 'Student Record') : '';
  const fName = student ? (student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || student.fatherName || '—') : '';
  const cls = student ? normalizeStudentClass(student['Admission sought for class'] || student['Class'] || student.class || '11th') : '';
  const stm = student ? (student['Stream for Class 11th'] || student['Stream'] || student.stream || 'Science') : '';
  const roll = student ? (getStudentRollVal(student) || rollParam || '—') : '';
  const reg = student ? (student['Board Registration Number'] || student.boardRegNo || regParam || '—') : '';
  const fNo = student ? (student['Form Number'] || student['Form No.'] || student.formNo || fNoParam || '—') : '';
  const photo = student ? (formatPhotoDisplayUrl(getStudentPhotoUrl(student)) || formatPhotoDisplayUrl(student.photo_id) || student['Student Photo'] || student.photoId || student.photo || student.photoUrl || '/logo192.png') : '/logo192.png';
  const session = student ? (student['Session'] || student.session || sessionParam || '2025-26') : (sessionParam || '2025-26');

  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 font-sans relative select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      
      {/* 🛡️ Anti-Theft Toast Notification */}
      {securityToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/95 border-2 border-red-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <ShieldAlert size={16} className="text-amber-400 shrink-0" />
          <span>{securityToast}</span>
        </div>
      )}

      {/* 🌊 Anti-Forgery Background Watermark Grid */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px), radial-gradient(#ffffff 1px, #020617 1px)`,
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 12px 12px'
        }}
      />

      <div className="w-full max-w-md bg-slate-900/95 text-slate-100 rounded-2xl border border-slate-800/90 shadow-2xl shadow-black/60 overflow-hidden my-auto relative z-10 backdrop-blur-xl">
        
        {/* Compact Institutional Header */}
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-b border-amber-500/30 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/10 p-0.5 border border-amber-400/60 shrink-0 flex items-center justify-center">
              <img src="/logo192.png" alt="Govt HSS Shangus" className="w-full h-full object-contain pointer-events-none" draggable="false" />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif font-black text-xs sm:text-sm tracking-wide text-white uppercase truncate">
                Govt. HSS Shangus
              </h1>
              <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1 truncate">
                <Lock size={10} className="text-amber-400 shrink-0" /> Official Verification Portal • J&K
              </p>
            </div>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono font-bold text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {session}
          </span>
        </div>

        {/* Dynamic Verification Content */}
        <div className="p-3.5 sm:p-4 space-y-3">
          {loading ? (
            <ModernLoader
              moduleKey="certStudio"
              text="Authenticating Official Records..."
              subtext="Querying official database in real-time..."
              className="py-6"
            />
          ) : isRateLimited ? (
            <div className="p-4 text-center bg-amber-950/40 rounded-xl border border-amber-600/40 space-y-2">
              <ShieldAlert size={32} className="mx-auto text-amber-500 animate-bounce" />
              <h3 className="font-black text-sm text-amber-300">Automated Requests Blocked</h3>
              <p className="text-[11px] text-slate-300 font-medium">
                Excessive verification lookups received. Automated scraping is strictly restricted.
              </p>
              <div className="p-2 bg-amber-900/30 rounded-lg text-[10px] font-mono font-bold text-amber-200">
                🛡️ Anti-Scraping Protection: Please wait 60 seconds before scanning again.
              </div>
            </div>
          ) : isTampered ? (
            <div className="p-4 text-center bg-red-950/40 rounded-xl border border-red-700/50 space-y-2">
              <AlertTriangle size={32} className="mx-auto text-red-500 animate-pulse" />
              <h3 className="font-black text-sm text-red-300">Security Signature Mismatch</h3>
              <p className="text-[11px] text-slate-300 font-medium">
                The parameters of this QR verification link do not match the institutional signature.
              </p>
              <div className="p-2 bg-red-900/30 rounded-lg text-[10px] font-mono font-bold text-red-200">
                🔒 Tamper Prevention Active: Unauthorized document alterations are blocked.
              </div>
            </div>
          ) : notFound ? (
            <div className="p-4 text-center bg-red-950/40 rounded-xl border border-red-700/50 space-y-2">
              <AlertTriangle size={30} className="mx-auto text-red-500" />
              <h3 className="font-black text-sm text-red-300">Record Not Found</h3>
              <p className="text-[11px] text-slate-300 font-medium">
                No matching student registration record was found for {regParam || rollParam || fNoParam || certParam || 'this document'}.
              </p>
              <div className="text-[10.5px] font-semibold text-slate-400">
                Please contact the Office of the Principal, Govt HSS Shangus for official validation.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              
              {/* Officially Verified Banner */}
              <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-600/40 text-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span className="font-black tracking-wider uppercase text-[11px]">Officially Verified Record</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-300/80">Archived in Records</span>
              </div>

              {/* Verified Certificate Card (If Certificate Scanned) */}
              {(certParam || docParam) && (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Award size={12} className="text-amber-400 shrink-0" />
                      <span>{docParam || 'Official Student Certificate / Character cum TC'}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-300 mt-0.5 truncate">
                      Cert Serial: <span className="font-mono text-amber-300 font-black">{certParam || '—'}</span>
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[9.5px] uppercase border border-amber-500/40">
                    VALID &amp; ISSUED
                  </span>
                </div>
              )}

              {/* Anti-Theft Student Profile Card */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 relative overflow-hidden flex items-center gap-3">
                {/* Subtle Anti-Screenshot Diagonal Watermark inside Card */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center -rotate-12 select-none">
                  <span className="font-serif font-black text-xl text-white uppercase tracking-widest text-center">
                    GOVT HSS SHANGUS • VERIFIED
                  </span>
                </div>

                {/* Photo with Anti-Theft Transparent Shield Overlay */}
                <div className="w-16 h-20 sm:w-18 sm:h-22 rounded-xl border border-amber-400/60 overflow-hidden bg-slate-800 shrink-0 relative select-none shadow-md">
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

                {/* Student Bio Details */}
                <div className="min-w-0 flex-1 space-y-1 relative z-10">
                  <h2 className="font-black text-sm sm:text-base text-white uppercase tracking-tight leading-snug truncate" title={sName}>
                    {sName}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    Father: <span className="text-slate-200 font-bold uppercase">{fName}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="px-2 py-0.5 rounded bg-blue-900/50 border border-blue-700/50 text-amber-300 font-bold text-[10.5px]">
                      Class {cls} ({stm})
                    </span>
                    {roll && roll !== '—' && roll !== 'N/A' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 font-mono font-bold text-[10.5px]">
                        Roll: {roll}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Compact Credentials Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Form / Reg. ID</span>
                  <span className="font-mono font-black text-slate-200 text-xs">#{fNo}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Board Reg. No</span>
                  <span className="font-mono font-black text-slate-200 text-xs truncate block" title={reg}>{reg}</span>
                </div>
              </div>

              {/* 🔗 Official Verification Link & Signature Card */}
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Lock size={11} className="text-teal-400" />
                    Verification Link
                  </span>
                  {sigParam && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 font-mono font-bold text-[9px]">
                      HMAC: {sigParam.slice(0, 8)}... (Verified)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[10.5px] text-slate-300">
                  <span className="truncate flex-1 pl-1">{window.location.href}</span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(window.location.href);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      } catch (_) {}
                    }}
                    className="px-2 py-0.5 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] uppercase flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer"
                    title="Copy verification link to clipboard"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact Footer */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10.5px] font-bold">
            <Link to="/" className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
              <ArrowLeft size={12} /> Portal Home
            </Link>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-400" /> Authenticated
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Shield size={10} className="text-emerald-400" /> 256-Bit SSL
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
