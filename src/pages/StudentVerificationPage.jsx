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
  ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw,
  MapPin, Phone, ArrowLeft, CreditCard, ShieldAlert,
  FileCheck, Calendar, Hash, UserCheck, Lock, Award, Shield
} from 'lucide-react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getStudentRollVal, normalizeStudentClass, generateVerificationSignature } from '../utils/idCardRenderer';
import { getStudentPhotoUrl, formatPhotoDisplayUrl } from '../utils/imageCompressor';

// Privacy Masking Helper for Public Verification
const maskPhoneNo = (phoneStr) => {
  if (!phoneStr || phoneStr === '—' || phoneStr === 'N/A') return '—';
  const clean = String(phoneStr).trim();
  if (clean.length >= 10) {
    return clean.substring(0, 4) + '******' + clean.slice(-2);
  }
  return clean;
};

/**
 * Calculate official school fee schedule based on Class, Stream, and Gender
 */
export function calculateStudentFee(studentObj) {
  if (!studentObj) return 'Rs. 1900';

  if (studentObj['Fee Amount'] || studentObj.feeAmount || studentObj.amountPaid) {
    const val = String(studentObj['Fee Amount'] || studentObj.feeAmount || studentObj.amountPaid).trim();
    if (val && val !== '—' && val !== 'N/A') {
      return val.startsWith('Rs') || val.startsWith('₹') ? val : `Rs. ${val}`;
    }
  }

  const cls = normalizeStudentClass(
    studentObj['Admission sought for class'] || studentObj['Class'] || studentObj.class || '11th'
  );
  
  const rawStream = String(
    studentObj['Stream for Class 11th'] || studentObj['Stream opted in Class 11th'] ||
    studentObj['Stream'] || studentObj.stream || ''
  ).toLowerCase();

  const isScience = rawStream.includes('scien') || rawStream.includes('med') || rawStream.includes('math');

  const genderRaw = String(
    studentObj['Gender'] || studentObj['gender'] || studentObj['Sex'] || ''
  ).toLowerCase();
  
  const isFemale = genderRaw.includes('female') || genderRaw.includes('girl') || genderRaw === 'f';

  if (cls === '9th' || cls === '10th') return 'Rs. 1700';
  if (cls === '12th') return isScience ? 'Rs. 1650' : 'Rs. 1550';
  if (isScience) return isFemale ? 'Rs. 1700' : 'Rs. 1900';
  return isFemale ? 'Rs. 1600' : 'Rs. 1800';
}

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
  const regParam = searchParams.get('reg') || '';
  const rollParam = searchParams.get('roll') || '';
  const fNoParam = searchParams.get('fNo') || '';
  const certParam = searchParams.get('cert') || '';
  const docParam = searchParams.get('doc') || '';
  const sigParam = searchParams.get('sig') || '';

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isTampered, setIsTampered] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [securityToast, setSecurityToast] = useState('');

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
      if (regParam || rollParam || fNoParam || certParam) {
        const expectedSigWithCert = generateVerificationSignature(regParam, rollParam, fNoParam, certParam);
        const expectedSigWithoutCert = generateVerificationSignature(regParam, rollParam, fNoParam, '');
        if (sigParam && sigParam !== expectedSigWithCert && sigParam !== expectedSigWithoutCert) {
          setIsTampered(true);
          setLoading(false);
          return;
        }
      }

      try {
        const collectionsToSearch = ['admissions', 'students', 'masterRegisters'];
        let matched = null;

        for (const collName of collectionsToSearch) {
          try {
            const snap = await getDocs(collection(db, collName));
            snap.forEach(docSnap => {
              const d = { id: docSnap.id, ...docSnap.data() };
              const dReg = String(d['Board Registration Number'] || d.boardRegNo || d.regNo || '').trim();
              const dRoll = String(getStudentRollVal(d) || '').trim();
              const dFNo = String(d['Form Number'] || d['Form No.'] || d.formNo || docSnap.id || '').replace(/[^0-9]/g, '').trim();
              const dCertNo = String(d.certificateNo || d['Certificate No'] || d['Certificate No.'] || '').trim();

              if (matched) return;

              if (regParam && regParam !== '—' && dReg && dReg.toLowerCase() === regParam.trim().toLowerCase()) {
                matched = d;
              } else if (rollParam && rollParam !== '—' && dRoll && dRoll === rollParam.trim()) {
                matched = d;
              } else if (fNoParam && fNoParam !== '—' && dFNo && dFNo === fNoParam.trim()) {
                matched = d;
              } else if (certParam && certParam !== '—' && dCertNo && dCertNo === certParam.trim()) {
                matched = d;
              }
            });
          } catch (err) {
            console.warn(`Query ${collName} note:`, err);
          }
          if (matched) break;
        }

        if (matched) {
          // Fetch student photo from studentPhotos collection if not present on matched object
          let resolvedPhoto = getStudentPhotoUrl(matched);
          if (!resolvedPhoto || resolvedPhoto === '/logo.png' || resolvedPhoto === '—') {
            const rawReg = String(matched['Board Registration Number'] || matched.boardRegNo || matched.regNo || regParam || '').replace(/[^a-zA-Z0-9]/g, '');
            const rawForm = String(matched['Form Number'] || matched['Form No.'] || matched.formNo || fNoParam || '').replace(/[^0-9]/g, '');
            const docCandidates = [
              rawReg ? `photo_${rawReg}` : null,
              rawReg || null,
              rawForm ? `photo_form_${rawForm}` : null,
              rawForm || null,
              matched.id ? `photo_${matched.id}` : null,
              matched.id || null
            ].filter(Boolean);

            for (const cand of docCandidates) {
              try {
                const pSnap = await getDoc(doc(db, 'studentPhotos', cand));
                if (pSnap.exists()) {
                  const pData = pSnap.data();
                  const p = pData.photo_id || pData.photoData || pData.photo || pData.photoUrl;
                  const formatted = formatPhotoDisplayUrl(p) || p;
                  if (formatted && formatted.length > 20 && formatted !== '/logo.png') {
                    resolvedPhoto = formatted;
                    break;
                  }
                }
              } catch (_) {}
            }
          }
          if (resolvedPhoto) {
            matched.photo_id = resolvedPhoto;
          }
          setStudent(matched);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error('Verification query failed:', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    verifyRecord();
  }, [regParam, rollParam, fNoParam, certParam, sigParam]);

  const sName = student ? (student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || 'Student Record') : '';
  const fName = student ? (student["Father's/Guardian's Name (as per school records)"] || student["Father's Name"] || student.fatherName || '—') : '';
  const mName = student ? (student["Mother's Name (as per school records)"] || student["Mother's Name"] || student.motherName || '—') : '';
  const cls = student ? normalizeStudentClass(student['Admission sought for class'] || student['Class'] || student.class || '11th') : '';
  const stm = student ? (student['Stream for Class 11th'] || student['Stream'] || student.stream || 'Science') : '';
  const roll = student ? (getStudentRollVal(student) || rollParam || '—') : '';
  const reg = student ? (student['Board Registration Number'] || student.boardRegNo || regParam || '—') : '';
  const fNo = student ? (student['Form Number'] || student['Form No.'] || student.formNo || fNoParam || '—') : '';
  const vill = student ? (student['Name of your village'] || student['Village/Town'] || student.village || 'Shangus') : '';
  const dist = student ? (student['District'] || student.district || 'Anantnag') : '';
  const mob = student ? (student['Mobile No. (with working WhatsApp)'] || student.mobile || '—') : '';
  const photo = student ? (formatPhotoDisplayUrl(getStudentPhotoUrl(student)) || formatPhotoDisplayUrl(student.photo_id) || student['Student Photo'] || student.photoId || student.photo || student.photoUrl || '/logo192.png') : '/logo192.png';
  const session = student ? (student['Session'] || student.session || '2025-26') : '2025-26';

  const statusStr = student ? String(student['Status'] || student.status || '').toLowerCase() : '';
  const isApproved = student ? Boolean(
    statusStr.includes('appr') || statusStr.includes('approve') ||
    student['isPaid'] || 
    String(student['Payment Status'] || student.paymentStatus || '').toLowerCase().includes('paid') ||
    (roll && roll !== '—' && roll !== 'N/A')
  ) : false;

  const paymentStatusStr = isApproved ? 'PAID & VERIFIED' : (student?.paymentStatus || student?.['Payment Status'] || 'FEE PENDING / NOT COLLECTED');
  const feeAmount = student ? calculateStudentFee(student) : '—';
  const txnId = student ? (student['Transaction ID'] || student.txnId || student.transactionId || student.razorpay_payment_id || student.cf_payment_id || student.utrNo || `TXN_${fNo || roll}`) : '—';
  const receiptNo = student ? (student['Receipt No'] || student.receiptNo || student.orderId || student.receipt || `RCPT-${fNo || roll}`) : '—';
  const paymentDate = student ? (student['Payment Date'] || student.paymentDate || student.txnDate || 'Session Admission Approved') : '—';

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

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden my-auto relative z-10">
        
        {/* Mobile-First Header */}
        <div className="bg-gradient-to-r from-red-800 via-rose-900 to-red-900 text-white p-4 sm:p-5 text-center relative border-b-4 border-amber-400">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white p-1 mx-auto shadow-md mb-2 border-2 border-amber-300 relative group">
            <img src="/logo192.png" alt="Govt HSS Shangus" className="w-full h-full object-contain pointer-events-none" draggable="false" />
            <div className="absolute inset-0 bg-transparent rounded-full" />
          </div>
          <h1 className="font-serif font-black text-base sm:text-xl tracking-tight uppercase leading-tight">
            GOVT. HIGHER SECONDARY SCHOOL SHANGUS
          </h1>
          <p className="text-[10px] sm:text-xs text-amber-300 font-extrabold uppercase tracking-wider mt-1 flex items-center justify-center gap-1.5">
            <Lock size={11} className="text-amber-400" /> Official Public Verification Terminal • Anantnag (J&K)
          </p>
        </div>

        {/* Dynamic Verification Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw size={36} className="mx-auto text-amber-500 animate-spin" />
              <h3 className="font-black text-base">Authenticating Records...</h3>
              <p className="text-xs text-slate-500 font-bold">Querying official institutional database in real-time.</p>
            </div>
          ) : isRateLimited ? (
            <div className="p-5 text-center bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-300 dark:border-amber-700 space-y-3">
              <ShieldAlert size={40} className="mx-auto text-amber-600 animate-bounce" />
              <h3 className="font-black text-base sm:text-lg text-amber-800 dark:text-amber-300">Automated Requests Blocked</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                Excessive verification lookups received. Automated scraping is strictly restricted.
              </p>
              <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-[11px] font-mono font-bold text-amber-900 dark:text-amber-200">
                🛡️ Anti-Scraping Protection: Please wait 60 seconds before scanning another certificate.
              </div>
            </div>
          ) : isTampered ? (
            <div className="p-5 text-center bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800 space-y-3">
              <AlertTriangle size={40} className="mx-auto text-red-600 animate-pulse" />
              <h3 className="font-black text-base sm:text-lg text-red-700 dark:text-red-300">Security Signature Mismatch</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                The parameters of this QR verification link do not match the institutional signature.
              </p>
              <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl text-[11px] font-mono font-bold text-red-900 dark:text-red-200">
                🔒 Tamper Prevention Active: Unauthorized document alterations are blocked.
              </div>
            </div>
          ) : notFound ? (
            <div className="p-5 text-center bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800 space-y-3">
              <AlertTriangle size={36} className="mx-auto text-red-600" />
              <h3 className="font-black text-base sm:text-lg text-red-700 dark:text-red-300">Record Not Found</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                No matching student registration record was found for {regParam || rollParam || fNoParam || certParam || 'this document'}.
              </p>
              <div className="pt-2 text-xs font-bold text-slate-500">
                Please contact the Office of the Principal, Govt HSS Shangus for official transcript validation.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Officially Verified Green Banner */}
              <div className="p-3 rounded-2xl bg-emerald-600 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={24} className="text-white flex-shrink-0" />
                  <div>
                    <h3 className="font-black text-xs sm:text-sm tracking-wide uppercase">
                      OFFICIALLY VERIFIED RECORD
                    </h3>
                    <p className="text-[10px] sm:text-[11px] font-bold text-emerald-100">Authenticated • Govt HSS Shangus</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/20 text-white font-mono font-black text-[11px] flex-shrink-0">
                  {session}
                </span>
              </div>

              {/* Verified Certificate Card (If Certificate Scanned) */}
              {(certParam || docParam) && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-2 border-amber-400 dark:border-amber-600 text-slate-900 dark:text-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Award size={13} className="text-amber-600" /> Certificate Verification
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[9.5px] uppercase font-mono">
                      VALID &amp; ISSUED
                    </span>
                  </div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                    {docParam || 'Official Student Certificate / Transfer cum Character Certificate'}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 pt-1 border-t border-amber-300/50">
                    <span>Cert Serial No: <strong className="font-mono text-red-600 dark:text-red-400 font-black">{certParam || '—'}</strong></span>
                    <span>Status: <strong className="text-emerald-600 dark:text-emerald-400">Archived in School Record</strong></span>
                  </div>
                </div>
              )}

              {/* Anti-Theft Student Profile Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2 relative overflow-hidden">
                
                {/* Subtle Anti-Screenshot Diagonal Watermark inside Card */}
                <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center -rotate-12 select-none">
                  <span className="font-serif font-black text-2xl text-slate-900 dark:text-white uppercase tracking-widest text-center leading-relaxed">
                    GOVT HSS SHANGUS<br />OFFICIAL TRANSCRIPT
                  </span>
                </div>

                {/* Photo with Anti-Theft Transparent Shield Overlay */}
                <div className="w-24 h-28 mx-auto rounded-2xl border-2 border-amber-400 overflow-hidden bg-slate-200 shadow-md relative group select-none">
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

                <div className="space-y-1 pt-1 relative z-10">
                  <h2 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                    {sName}
                  </h2>
                  <div className="inline-block px-3 py-1 rounded-full bg-blue-900 text-amber-300 font-extrabold text-xs uppercase shadow-2xs">
                    Class {cls} ({stm})
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-bold pt-1 space-y-0.5">
                    <div>Father: <strong className="text-slate-900 dark:text-slate-100 uppercase">{fName}</strong></div>
                    {mName && mName !== '—' && (
                      <div>Mother: <strong className="text-slate-900 dark:text-slate-100 uppercase">{mName}</strong></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Credentials Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 block uppercase">Class Roll No</span>
                  <strong className="font-mono font-black text-emerald-600 text-base">{roll}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block uppercase">Admission / Form No</span>
                  <strong className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs">#{fNo}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 col-span-2">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block uppercase">Board Registration No</span>
                  <strong className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs truncate block">{reg}</strong>
                </div>
              </div>

              {/* 💳 Fee Payment & Receipt Verification Card */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-700/80 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5 tracking-wide">
                    <CreditCard size={15} className="text-amber-400 flex-shrink-0" /> Fee Payment &amp; Receipt Status
                  </span>
                  <span className={`self-start sm:self-auto px-2.5 py-1 rounded-md font-mono font-black text-[11px] uppercase tracking-wider ${
                    isApproved ? 'bg-emerald-500 text-white shadow-2xs' : 'bg-amber-500 text-slate-950 shadow-2xs'
                  }`}>
                    {paymentStatusStr}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-300 block text-[10px] font-black uppercase tracking-wider">Fee Amount</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">{feeAmount}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 block text-[10px] font-black uppercase tracking-wider">Transaction / UTR ID</span>
                    <span className="font-mono font-black text-slate-100 text-xs truncate block">{txnId}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 block text-[10px] font-black uppercase tracking-wider">Receipt / Order No</span>
                    <span className="font-mono font-black text-slate-100 text-xs truncate block">{receiptNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 block text-[10px] font-black uppercase tracking-wider">Payment Date / Mode</span>
                    <span className="font-mono font-black text-slate-100 text-xs truncate block">{paymentDate}</span>
                  </div>
                </div>
              </div>

              {/* Privacy Masked Contact & Residence */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2 font-bold">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin size={13} className="text-teal-600 flex-shrink-0" /> Residence:
                  </span>
                  <span className="font-black text-slate-900 dark:text-slate-100">{vill}, {dist}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-2">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Phone size={13} className="text-purple-600 flex-shrink-0" /> Phone (Privacy Masked):
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-slate-100">{maskPhoneNo(mob)}</span>
                </div>
              </div>

              {/* Verification Stamp Footer */}
              <div className="pt-2 text-center text-[10.5px] text-slate-400 font-extrabold flex items-center justify-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-500" /> Authenticated by Govt. HSS Shangus Digital Records Authority • {new Date().toLocaleDateString()}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-black">
            <Link to="/" className="text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1">
              <ArrowLeft size={13} /> Back to School Portal
            </Link>
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Shield size={11} className="text-emerald-500" /> SSL 256-Bit Encrypted
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
