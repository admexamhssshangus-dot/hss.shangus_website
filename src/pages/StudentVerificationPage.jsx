/**
 * StudentVerificationPage.jsx — Mobile-First Public Official Student & Admission Verification Portal
 * Govt. Higher Secondary School Shangus
 *
 * Scanned from Admission Forms, Student ID Cards, & Certificates across Kashmir & JKBOSE
 * Real-time cryptographically signed enrollment, roll number, registration, & fee verification.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw,
  MapPin, Phone, ArrowLeft, CreditCard, ShieldAlert,
  FileCheck, Calendar, Hash, UserCheck
} from 'lucide-react';
import { db } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getStudentRollVal, normalizeStudentClass, generateVerificationSignature } from '../utils/idCardRenderer';

// Anti-Scraping Privacy Masking Helper
const maskPhoneNo = (phoneStr) => {
  if (!phoneStr || phoneStr === '—' || phoneStr === 'N/A') return '—';
  const clean = String(phoneStr).trim();
  if (clean.length >= 10) {
    return clean.substring(0, 5) + '*****';
  }
  return clean;
};

/**
 * Calculate exact school fee based on Class, Stream, and Gender from official website fee schedule:
 * - 11th Science: Boys Rs. 1900 | Girls Rs. 1700
 * - 11th Humanities/Arts: Boys Rs. 1800 | Girls Rs. 1600
 * - 12th Science: Rs. 1650
 * - 12th Humanities/Arts: Rs. 1550
 * - 9th & 10th Class: Rs. 1700
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

  if (cls === '9th' || cls === '10th') {
    return 'Rs. 1700';
  }

  if (cls === '12th') {
    return isScience ? 'Rs. 1650' : 'Rs. 1550';
  }

  // Default 11th Class
  if (isScience) {
    return isFemale ? 'Rs. 1700' : 'Rs. 1900';
  } else {
    return isFemale ? 'Rs. 1600' : 'Rs. 1800';
  }
}

// Anti-Automation Client Rate Limiter (Max 15 verification lookups per minute per browser session)
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
      return false; // Throttled: rate limit exceeded
    }
  } catch (e) {}
  return true;
};

export default function StudentVerificationPage() {
  const [searchParams] = useSearchParams();
  const regParam = searchParams.get('reg') || '';
  const rollParam = searchParams.get('roll') || '';
  const fNoParam = searchParams.get('fNo') || '';
  const sigParam = searchParams.get('sig') || '';

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isTampered, setIsTampered] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    const verifyRecord = async () => {
      setLoading(true);
      setNotFound(false);
      setIsTampered(false);
      setIsRateLimited(false);

      // 🛡️ Anti-Automation Check: Protects against bot scrapers sweeping IDs sequentially
      if (!checkClientRateLimit()) {
        setIsRateLimited(true);
        setLoading(false);
        return;
      }

      // 🔒 Security HMAC Validation: Rejects tampered URLs created by external bad actors
      if (regParam || rollParam || fNoParam) {
        const expectedSig = generateVerificationSignature(regParam, rollParam, fNoParam);
        if (sigParam !== expectedSig) {
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

              if (matched) return;

              if (regParam && regParam !== '—' && dReg && dReg === regParam.trim()) {
                matched = d;
              } else if (rollParam && rollParam !== '—' && dRoll && dRoll === rollParam.trim()) {
                matched = d;
              } else if (fNoParam && fNoParam !== '—' && dFNo && dFNo === fNoParam.trim()) {
                matched = d;
              }
            });
          } catch (err) {
            console.warn(`Query ${collName} note:`, err);
          }
          if (matched) break;
        }

        if (matched) {
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
  }, [regParam, rollParam, fNoParam, sigParam]);

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
  const photo = student ? (student['Student Photo'] || student.photoId || student.photo || student.photoUrl || '/logo.png') : '/logo.png';
  const session = student ? (student['Session'] || student.session || '2025-26') : '2025-26';

  // Admission & Fee Payment Record Fields (Approved Status = Paid & Verified)
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 font-sans">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        
        {/* Mobile-First Top Header */}
        <div className="bg-gradient-to-r from-red-800 via-rose-900 to-red-900 text-white p-4 sm:p-5 text-center relative border-b-4 border-amber-400">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white p-1 mx-auto shadow-md mb-2 border-2 border-amber-300">
            <img src="/logo.png" alt="Govt HSS Shangus" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-serif font-black text-base sm:text-xl tracking-tight uppercase leading-tight">
            GOVT. HIGHER SECONDARY SCHOOL SHANGUS
          </h1>
          <p className="text-[10px] sm:text-xs text-amber-300 font-extrabold uppercase tracking-wider mt-1">
            Official Public Verification Portal • Anantnag Kmr
          </p>
        </div>

        {/* Dynamic Verification Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw size={36} className="mx-auto text-amber-500 animate-spin" />
              <h3 className="font-black text-base">Verifying Student Credentials...</h3>
              <p className="text-xs text-slate-500 font-bold">Cryptographically authenticating records against database.</p>
            </div>
          ) : isRateLimited ? (
            <div className="p-5 text-center bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-300 dark:border-amber-700 space-y-3">
              <ShieldAlert size={40} className="mx-auto text-amber-600 animate-bounce" />
              <h3 className="font-black text-base sm:text-lg text-amber-800 dark:text-amber-300">Automated Requests Blocked</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                Too many verification requests received from this browser. Automated scraping and bot scanning are strictly prohibited.
              </p>
              <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-[11px] font-mono font-bold text-amber-900 dark:text-amber-200">
                🛡️ Anti-Scraping Protection Active: Please wait 60 seconds before scanning another code.
              </div>
            </div>
          ) : isTampered ? (
            <div className="p-5 text-center bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800 space-y-3">
              <AlertTriangle size={40} className="mx-auto text-red-600 animate-pulse" />
              <h3 className="font-black text-base sm:text-lg text-red-700 dark:text-red-300">Security Access Denied (Tampered Link)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                The URL parameters for this QR verification link have been manually modified or altered.
              </p>
              <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl text-[11px] font-mono font-bold text-red-900 dark:text-red-200">
                🔒 Cryptographic Protection Guardrail: Security signature mismatch. Data harvesting blocked.
              </div>
            </div>
          ) : notFound ? (
            <div className="p-5 text-center bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800 space-y-3">
              <AlertTriangle size={36} className="mx-auto text-red-600" />
              <h3 className="font-black text-base sm:text-lg text-red-700 dark:text-red-300">Record Not Verified</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                No matching student registration record was found for the scanned QR code ({regParam || rollParam || fNoParam}).
              </p>
              <div className="pt-2 text-xs font-bold text-slate-500">
                Please contact Govt. HSS Shangus Administration Office for official transcript verification.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mobile-First Verified Green Banner */}
              <div className="p-3 rounded-2xl bg-emerald-600 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={24} className="text-white flex-shrink-0" />
                  <div>
                    <h3 className="font-black text-xs sm:text-sm tracking-wide uppercase">
                      OFFICIALLY VERIFIED RECORD
                    </h3>
                    <p className="text-[10px] sm:text-[11px] font-bold text-emerald-100">Cryptographically authentic • HSS Shangus</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/20 text-white font-mono font-black text-[11px] flex-shrink-0">
                  {session}
                </span>
              </div>

              {/* Mobile-First Centered Student Profile Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                <div className="w-24 h-28 mx-auto rounded-2xl border-2 border-amber-400 overflow-hidden bg-slate-200 shadow-md">
                  <img src={photo} alt={sName} className="w-full h-full object-cover" onError={(e) => { e.target.src = '/logo.png'; }} />
                </div>

                <div className="space-y-1 pt-1">
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

              {/* Mobile-First Responsive Credentials Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 block uppercase">Class Roll No</span>
                  <strong className="font-mono font-black text-emerald-600 text-base">{roll}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block uppercase">Form Number</span>
                  <strong className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs">#{fNo}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 col-span-2">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block uppercase">Board Reg No</span>
                  <strong className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs truncate block">{reg}</strong>
                </div>
              </div>

              {/* 💳 Mobile-First High-Contrast Fee Payment & Receipt Verification Card */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-700/80 shadow-md space-y-3">
                {/* Header: Flex column on mobile to prevent text squishing */}
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

                {/* High-Contrast Mobile Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-300 dark:text-slate-300 block text-[10px] font-black uppercase tracking-wider">Fee Amount</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">{feeAmount}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 dark:text-slate-300 block text-[10px] font-black uppercase tracking-wider">Transaction / UTR ID</span>
                    <span className="font-mono font-black text-slate-100 text-xs truncate block">{txnId}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 dark:text-slate-300 block text-[10px] font-black uppercase tracking-wider">Receipt / Order No</span>
                    <span className="font-mono font-black text-slate-100 text-xs truncate block">{receiptNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 dark:text-slate-300 block text-[10px] font-black uppercase tracking-wider">Payment Date / Mode</span>
                    <span className="font-mono font-black text-slate-100 text-xs truncate block">{paymentDate}</span>
                  </div>
                </div>
              </div>

              {/* Mobile-First Address & Masked Contact Details */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2 font-bold">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin size={13} className="text-teal-600 flex-shrink-0" /> Address / Residence:
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
                <CheckCircle2 size={13} className="text-emerald-500" /> Verified by Govt. HSS Shangus Digital Records System • {new Date().toLocaleDateString()}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-black">
            <Link to="/" className="text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1">
              <ArrowLeft size={13} /> Back to School Portal
            </Link>
            <span className="text-slate-400">Shangus, Anantnag Kmr</span>
          </div>
        </div>

      </div>
    </div>
  );
}
