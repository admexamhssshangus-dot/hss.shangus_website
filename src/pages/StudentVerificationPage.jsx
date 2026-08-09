/**
 * StudentVerificationPage.jsx — Public Official Student Verification Portal
 * Govt. Higher Secondary School Shangus
 *
 * Scanned from Student ID Card QR Codes across Kashmir & JKBOSE
 * Verifies student enrollment, roll number, registration, and admission status in real-time.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, GraduationCap, MapPin, Phone, Calendar, ArrowLeft } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getStudentRollVal, normalizeStudentClass, generateVerificationSignature } from '../utils/idCardRenderer';

// Anti-Scraping Phone Masking Helper (Protects Student Privacy)
const maskPhoneNo = (phoneStr) => {
  if (!phoneStr || phoneStr === '—') return '—';
  const clean = String(phoneStr).trim();
  if (clean.length >= 10) {
    return clean.substring(0, 5) + '*****';
  }
  return clean;
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

  useEffect(() => {
    const verifyRecord = async () => {
      setLoading(true);
      setNotFound(false);
      setIsTampered(false);

      // 🔒 Security HMAC Validation: Rejects tampered URLs created by hackers
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        
        {/* Top Institutional Header */}
        <div className="bg-gradient-to-r from-red-800 via-rose-900 to-red-900 text-white p-5 text-center relative border-b-4 border-amber-400">
          <div className="w-16 h-16 rounded-full bg-white p-1 mx-auto shadow-md mb-2 border-2 border-amber-300">
            <img src="/logo.png" alt="Govt HSS Shangus" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-serif font-black text-lg sm:text-xl tracking-tight uppercase">
            GOVT. HIGHER SECONDARY SCHOOL SHANGUS
          </h1>
          <p className="text-xs text-amber-300 font-extrabold uppercase tracking-widest mt-0.5">
            Official Public Verification Portal • Anantnag Kmr
          </p>
        </div>

        {/* Dynamic Verification Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {loading ? (
            <div className="p-10 text-center space-y-3">
              <RefreshCw size={36} className="mx-auto text-amber-500 animate-spin" />
              <h3 className="font-black text-base">Verifying Student Credentials...</h3>
              <p className="text-xs text-slate-500 font-bold">Cryptographically authenticating records against Firestore database.</p>
            </div>
          ) : isTampered ? (
            <div className="p-6 text-center bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800 space-y-3">
              <AlertTriangle size={44} className="mx-auto text-red-600 animate-pulse" />
              <h3 className="font-black text-lg text-red-700 dark:text-red-300">Security Access Denied (Tampered Link)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                The URL parameters for this QR verification link have been manually modified or altered.
              </p>
              <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl text-[11px] font-mono font-bold text-red-900 dark:text-red-200">
                🔒 Cryptographic HMAC Guardrail: Security signature mismatch. Data harvesting blocked.
              </div>
            </div>
          ) : notFound ? (
            <div className="p-6 text-center bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-800 space-y-3">
              <AlertTriangle size={40} className="mx-auto text-red-600" />
              <h3 className="font-black text-lg text-red-700 dark:text-red-300">Record Not Verified</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                No matching student registration record was found for the scanned QR code ({regParam || rollParam || fNoParam}).
              </p>
              <div className="pt-2 text-xs font-bold text-slate-500">
                Please contact Govt. HSS Shangus Administration Office for official transcript verification.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Verified Green Banner */}
              <div className="p-3 rounded-2xl bg-emerald-500 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={26} className="text-white flex-shrink-0" />
                  <div>
                    <h3 className="font-black text-sm tracking-wide uppercase">OFFICIALLY VERIFIED STUDENT</h3>
                    <p className="text-[11px] font-bold text-emerald-100">Cryptographically authentic record</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/20 text-white font-mono font-black text-xs">
                  Session {session}
                </span>
              </div>

              {/* Student Profile Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-24 h-28 rounded-xl border-2 border-amber-400 overflow-hidden bg-slate-200 flex-shrink-0 shadow-md">
                  <img src={photo} alt={sName} className="w-full h-full object-cover" onError={(e) => { e.target.src = '/logo.png'; }} />
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <h2 className="font-black text-base sm:text-lg text-slate-900 dark:text-white uppercase tracking-tight">
                    {sName}
                  </h2>
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-blue-900 text-amber-300 font-black text-xs uppercase">
                    Class {cls} ({stm})
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                    Father: <strong className="text-slate-900 dark:text-slate-100 uppercase">{fName}</strong>
                  </div>
                </div>
              </div>

              {/* Credentials Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 block">Class Roll No</span>
                  <strong className="font-mono font-black text-emerald-600 text-sm">{roll}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-500 block">Form Number</span>
                  <strong className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs">#{fNo}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-black text-slate-500 block">Board Reg No</span>
                  <strong className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs truncate block">{reg}</strong>
                </div>
              </div>

              {/* Details List (Masked Phone Number to Prevent Scraping) */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2 font-bold">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <MapPin size={13} className="text-teal-600" /> Address / Residence:
                  </span>
                  <span className="font-black text-slate-900 dark:text-slate-100">{vill}, {dist}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Phone size={13} className="text-purple-600" /> Phone (Privacy Masked):
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
