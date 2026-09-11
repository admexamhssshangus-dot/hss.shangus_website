import { publicLookup } from '../services/backendEndpoint';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search, Printer, Download, Award, CheckCircle2, AlertCircle,
  HelpCircle, ArrowLeft, RefreshCw, School, UserCheck, Calendar, BookOpen,
  FileText, ShieldCheck, Sparkles, X, ChevronDown, Check
} from 'lucide-react';
import SEO from '../components/SEO';
import ModernLoader from '../components/ModernLoader';

export default function PublicResultLookup() {
  const [searchParams] = useSearchParams();
  const initialReg = searchParams.get('reg') || searchParams.get('roll') || '';
  const initialClass = searchParams.get('class') || '12th';
  const initialSession = searchParams.get('session') || '2025-26';

  const [queryInput, setQueryInput] = useState(initialReg);
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [selectedSession, setSelectedSession] = useState(initialSession);
  const [selectedEvalType, setSelectedEvalType] = useState('Pre-Board Test');
  
  const [evalOptions, setEvalOptions] = useState([]);
  const [availableSessions, setAvailableSessions] = useState(['2025-26', '2024-25']);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [studentResult, setStudentResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Load school assessment configuration
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const { evaluations } = await publicLookup('public-result', { action: 'config' });
        if (!isMounted) return;
        setEvalOptions(evaluations);
        setAvailableSessions([...new Set(evaluations.map(item => item.session))]);
        if (evaluations.length) {
          setSelectedEvalType(evaluations[0].evalType || evaluations[0].title);
          setSelectedSession(evaluations[0].session);
        } else setErrorMsg('No assessment results are currently published.');
      } catch (e) {
        console.warn('Failed to load assessment settings:', e);
        if (isMounted) setErrorMsg(e.message || 'Assessment settings are temporarily unavailable. Please reload and try again.');
      } finally {
        if (isMounted) setLoadingConfig(false);
      }
    }
    loadConfig();
    return () => { isMounted = false; };
  }, []);

  // 2. Lookup Handler
  const handleLookup = useCallback(async (e) => {
    if (e) e.preventDefault();
    const rawQuery = queryInput.trim().toUpperCase();
    if (!rawQuery) {
      setErrorMsg('Please enter your Registration Number, Roll Number, or Form Number.');
      return;
    }

    setSearching(true);
    setErrorMsg('');
    setStudentResult(null);
    setSearchAttempted(true);

    try {
      const response = await publicLookup('public-result', { query: rawQuery, className: selectedClass,
        session: selectedSession, evaluation: selectedEvalType });
      setStudentResult(response.result);
    } catch (err) {
      console.error('Error during student result lookup:', err);
      setErrorMsg(err.message || 'The results service is temporarily unavailable.');
    } finally {
      setSearching(false);
    }
  }, [queryInput, selectedClass, selectedSession, selectedEvalType]);

  const automaticLookupStarted = useRef(false);
  useEffect(() => {
    if (initialReg && !loadingConfig && !automaticLookupStarted.current && evalOptions.length) {
      automaticLookupStarted.current = true;
      handleLookup();
    }
  }, [initialReg, loadingConfig, handleLookup, evalOptions.length]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-3 sm:px-6">
      <SEO
        title="Student Assessment & Pre-Board Results | Govt. HSS Shangus"
        description="Official online student evaluation and examination results scorecard portal for Govt. Higher Secondary School Shangus."
      />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between gap-4 print:hidden">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to School Homepage</span>
          </Link>

          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Official Examination Verification Portal</span>
          </span>
        </div>

        {/* Institutional Card Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm relative overflow-hidden text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-800 dark:text-teal-300 shadow-xs">
            <School size={28} />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase m-0">
              Govt. Higher Secondary School Shangus
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 m-0">
              Anantnag, Jammu & Kashmir — 192201 • School Examination & Pre-Board Results
            </p>
          </div>
          <div className="inline-block px-3.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Current Academic Session: <span className="text-teal-700 dark:text-teal-300 font-extrabold">{selectedSession}</span>
          </div>
        </div>

        {/* Search & Filter Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 print:hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Search size={16} className="text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-black text-slate-900 dark:text-white m-0">
              Check Student Examination Results
            </h2>
          </div>

          <form onSubmit={handleLookup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Registration / Roll No Input */}
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Board Registration No. / Roll No. / Form No. <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="e.g. 216111002345 or Class Roll No."
                    className="w-full pl-3 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase transition-all"
                  />
                </div>
              </div>

              {/* Class Selection */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                >
                  <option value="12th">Class 12th</option>
                  <option value="11th">Class 11th</option>
                  <option value="10th">Class 10th</option>
                  <option value="9th">Class 9th</option>
                </select>
              </div>

              {/* Session Selection */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Session</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                >
                  {availableSessions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Assessment Type */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Evaluation</label>
                <select
                  value={selectedEvalType}
                  onChange={(e) => setSelectedEvalType(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all truncate"
                >
                  {!evalOptions.length && <option value="">No assessment available</option>}
                  {evalOptions.map(ev => (
                    <option key={ev.id || ev.evalType} value={ev.evalType || ev.title}>
                      {ev.evalType || ev.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Tip: Enter your 16-digit JKBOSE Registration Number or Class Roll Number to view your marks.
              </span>
              <button
                type="submit"
                disabled={searching || loadingConfig || !evalOptions.length || !selectedEvalType}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {searching ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Retrieving Marks...</span>
                  </>
                ) : (
                  <>
                    <Search size={15} />
                    <span>Search Result</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-fadeIn">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Scorecard Results View */}
        {studentResult && (
          <div className="bg-white dark:bg-slate-900 border-2 border-teal-800/80 rounded-3xl p-5 sm:p-8 shadow-xl space-y-6 animate-fadeIn">
            {/* Action Bar (Print / Share) */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 size={13} />
                  <span>Verified Evaluation Record</span>
                </span>
                <span className="text-xs text-slate-500 font-bold hidden sm:inline">
                  • {studentResult.evalTitle} ({studentResult.session})
                </span>
              </div>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-teal-700 dark:hover:bg-teal-600 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Scorecard</span>
              </button>
            </div>

            {/* Scorecard Header */}
            <div className="text-center space-y-1.5 border-b-2 border-teal-800 pb-4">
              <h2 className="text-lg sm:text-xl font-black text-teal-950 dark:text-teal-200 uppercase tracking-wider m-0">
                Govt. Higher Secondary School Shangus
              </h2>
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Official Student Academic Evaluation & Examination Scorecard
              </p>
              <div className="inline-block mt-1 px-4 py-1 rounded-full bg-teal-800 text-white text-xs font-black uppercase tracking-widest shadow-xs">
                {studentResult.evalTitle} — Session {studentResult.session}
              </div>
            </div>

            {/* Student Particulars Grid */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Candidate Name</span>
                <span className="text-sm font-black text-slate-900 dark:text-white block">{studentResult.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Father's Name</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">{studentResult.fatherName || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Class / Stream</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">{studentResult.className} ({studentResult.stream})</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Class Roll No.</span>
                <span className="text-sm font-black font-mono text-teal-800 dark:text-teal-300 block">{studentResult.classRollNo}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Board Registration Number</span>
                <span className="text-sm font-black font-mono text-slate-900 dark:text-white block">{studentResult.boardRegNo}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Evaluation Scheme</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">{studentResult.evalTitle}</span>
              </div>
            </div>

            {/* Subject Marks Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 m-0">
                Subject-wise Performance Record
              </h3>
              
              {studentResult.subjects.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs">
                  <BookOpen size={24} className="mx-auto text-slate-400 mb-2" />
                  <p className="font-bold">No subject marks have been submitted for this candidate yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Please check back once teachers complete the evaluation entry.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3 font-black text-center w-12">#</th>
                        <th className="py-2.5 px-3 font-black w-24">Code</th>
                        <th className="py-2.5 px-3 font-black">Subject Name</th>
                        <th className="py-2.5 px-3 font-black text-center w-24">Max Marks</th>
                        <th className="py-2.5 px-3 font-black text-center w-24">Min Pass</th>
                        <th className="py-2.5 px-3 font-black text-center w-28">Marks Obtained</th>
                        <th className="py-2.5 px-3 font-black text-center w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {studentResult.subjects.map((sub, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-teal-700 dark:text-teal-300">{sub.subjectCode}</td>
                          <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">{sub.subjectName}</td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-600 dark:text-slate-400">{sub.maxMarks}</td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-600 dark:text-slate-400">{sub.minMarks}</td>
                          <td className="py-2.5 px-3 text-center font-black font-mono text-sm">
                            {sub.isAbsent ? (
                              <span className="text-rose-600 dark:text-rose-400">AB</span>
                            ) : (
                              <span className={sub.isPass ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}>
                                {sub.marksObtained}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              sub.isAbsent
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : sub.isPass
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Overall Result & Performance Card */}
            {studentResult.hasMarks && (
              <div className="p-5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border-2 border-teal-700/40 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                <div className="sm:col-span-2 space-y-1">
                  <span className="text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider">Overall Assessment Result</span>
                  <div className="text-xl sm:text-2xl font-black text-teal-950 dark:text-white">
                    {studentResult.division}
                  </div>
                  <p className="text-xs text-teal-900/80 dark:text-teal-200/80 font-medium m-0">
                    Grand Total: <strong>{studentResult.totalObtained}</strong> / {studentResult.totalMax} Marks ({studentResult.percentage}%)
                  </p>
                </div>

                <div className="text-center p-3 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Percentage</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{studentResult.percentage}%</span>
                </div>

                <div className="text-center p-3 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Subjects Appraised</span>
                  <span className="text-2xl font-black text-teal-800 dark:text-teal-300 font-mono">{studentResult.subjects.length}</span>
                </div>
              </div>
            )}

            {/* Institutional Signatures & Watermark */}
            <div className="pt-8 grid grid-cols-3 gap-4 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
              <div>
                <div className="h-10"></div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-1">Evaluator / Teacher Incharge</div>
              </div>
              <div>
                <div className="h-10"></div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-1">Verified By (Office of Adms & Exams)</div>
              </div>
              <div>
                <div className="h-10"></div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-1">Principal / Head of Institution</div>
              </div>
            </div>

            <div className="text-center text-[9px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              Govt. HSS Shangus Academic Records • Computer-generated scorecard valid for institutional appraisal.
            </div>
          </div>
        )}

        {/* Empty Search Initial State */}
        {!studentResult && !searching && searchAttempted && !errorMsg && (
          <div className="p-10 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
            <HelpCircle size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No evaluation records found.</p>
            <p className="text-xs text-slate-400">Please verify your registration number and class selection.</p>
          </div>
        )}
      </div>
    </div>
  );
}
