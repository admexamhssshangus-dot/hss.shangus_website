import React, { useState, useMemo } from 'react';
import {
  Award, Trophy, CheckCircle2, ChevronRight, FileText,
  Search, Users, Printer, ExternalLink, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import { CLASS_10_BOARD_RESULTS } from '../data/classBoardResults';

export default function ClassBoardResultsSection({ className = '' }) {
  const [selectedCohortId, setSelectedCohortId] = useState(CLASS_10_BOARD_RESULTS[0].id);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');

  const activeCohort = useMemo(() => {
    return CLASS_10_BOARD_RESULTS.find(c => c.id === selectedCohortId) || CLASS_10_BOARD_RESULTS[0];
  }, [selectedCohortId]);

  const filteredCandidates = useMemo(() => {
    if (!activeCohort.allCandidates) return [];
    if (!candidateSearch.trim()) return activeCohort.allCandidates;
    const q = candidateSearch.toLowerCase().trim();
    return activeCohort.allCandidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.rollNo.includes(q) ||
      c.status.toLowerCase().includes(q) ||
      (c.reappearSubjects && c.reappearSubjects.toLowerCase().includes(q))
    );
  }, [activeCohort, candidateSearch]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className={`w-full max-w-5xl mx-auto ${className}`}>
      {/* Session Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
            Official Board Evaluation Summaries
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            JKBOSE Class 10th Board Results
          </h2>
        </div>

        {/* Cohort Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          {CLASS_10_BOARD_RESULTS.map((cohort) => {
            const isSelected = cohort.id === selectedCohortId;
            return (
              <button
                key={cohort.id}
                type="button"
                onClick={() => {
                  setSelectedCohortId(cohort.id);
                  setShowAllCandidates(false);
                  setCandidateSearch('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs border border-teal-200 dark:border-teal-700/80'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cohort.examPeriod}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Results Card Styled Authentically */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-md overflow-hidden print:border-none print:shadow-none">
        {/* Institutional Banner matching prompt layout */}
        <div className="text-center py-4 px-4 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/40">
          <h3 className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-500 tracking-tight">
            {activeCohort.title}
          </h3>
          <div className="mt-1 inline-block bg-[#d9f2d9] dark:bg-emerald-900/60 px-4 py-1 rounded-md border border-emerald-300 dark:border-emerald-700">
            <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {activeCohort.schoolName}
            </h4>
          </div>
          <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mt-1">
            Session: {activeCohort.session} • Exam: {activeCohort.examPeriod} ({activeCohort.category})
          </p>
        </div>

        {/* Indicators Table */}
        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-4 font-black text-slate-700 dark:text-slate-200 w-2/3">
                    Category / Indicator
                  </th>
                  <th className="py-2.5 px-4 font-black text-slate-700 dark:text-slate-200 text-right w-1/3">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeCohort.indicators.map((ind, idx) => {
                  const isHighlight = ind.highlight;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={ind.label}
                      className={`transition-colors ${
                        isHighlight
                          ? 'bg-[#d9f2d9] dark:bg-emerald-950/60 font-black'
                          : isEven
                          ? 'bg-slate-50/60 dark:bg-slate-800/30'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <td className={`py-2 px-4 ${isHighlight ? 'text-emerald-950 dark:text-emerald-200 font-black text-base' : 'text-slate-700 dark:text-slate-300 font-semibold'}`}>
                        {ind.label}
                      </td>
                      <td className={`py-2 px-4 text-right font-mono ${isHighlight ? 'text-red-600 dark:text-red-400 font-black text-base sm:text-lg' : 'text-slate-900 dark:text-white font-bold'}`}>
                        {ind.count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* School Toppers Subsection */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-black text-red-600 dark:text-red-500 tracking-wide">
                School toppers
              </h4>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {activeCohort.toppers.length} Topper{activeCohort.toppers.length > 1 ? 's' : ''} listed
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-400 dark:bg-slate-700 text-slate-900 dark:text-white">
                    <th className="py-2.5 px-3.5 font-black text-xs uppercase tracking-wider">
                      Exam Roll No.
                    </th>
                    <th className="py-2.5 px-3.5 font-black text-xs uppercase tracking-wider">
                      Name
                    </th>
                    <th className="py-2.5 px-3.5 font-black text-xs uppercase tracking-wider text-center">
                      Result
                    </th>
                    <th className="py-2.5 px-3.5 font-black text-xs uppercase tracking-wider text-right">
                      Marks Obt.
                    </th>
                    <th className="py-2.5 px-3.5 font-black text-xs uppercase tracking-wider text-center">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeCohort.toppers.map((topper, tIdx) => (
                    <tr
                      key={topper.rollNo}
                      className={`hover:bg-amber-50/60 dark:hover:bg-amber-950/20 transition-colors ${
                        tIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                        {topper.rollNo}
                      </td>
                      <td className="py-2.5 px-3.5 font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5">
                          {tIdx === 0 && <Trophy size={14} className="text-amber-500 shrink-0" />}
                          <span>{topper.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {topper.result}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                        {topper.marksObt}
                        <span className="text-[10px] text-slate-400 block font-sans">
                          {topper.percentage}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        {topper.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Complete Candidate Gazette Expander (For cohorts with full roster data) */}
          {activeCohort.allCandidates && activeCohort.allCandidates.length > 0 && (
            <div className="mt-7 pt-5 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowAllCandidates(prev => !prev)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer w-fit"
                >
                  <Users size={15} />
                  <span>
                    {showAllCandidates ? 'Hide' : 'View'} Complete Gazette Roster ({activeCohort.allCandidates.length} Students)
                  </span>
                  {showAllCandidates ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print Gazette Summary</span>
                </button>
              </div>

              {showAllCandidates && (
                <div className="mt-4 space-y-3">
                  {/* Live Roster Search */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      placeholder="Search roll number, student name, or reappear subjects..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-200 dark:bg-slate-800 z-10">
                        <tr>
                          <th className="py-2 px-3 font-black text-slate-700 dark:text-slate-200">#</th>
                          <th className="py-2 px-3 font-black text-slate-700 dark:text-slate-200">Roll No.</th>
                          <th className="py-2 px-3 font-black text-slate-700 dark:text-slate-200">Student Name</th>
                          <th className="py-2 px-3 font-black text-slate-700 dark:text-slate-200 text-center">Status</th>
                          <th className="py-2 px-3 font-black text-slate-700 dark:text-slate-200 text-right">Marks</th>
                          <th className="py-2 px-3 font-black text-slate-700 dark:text-slate-200 text-center">Division / Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredCandidates.map((cand, idx) => {
                          const isPass = cand.status.startsWith('Qualified');
                          return (
                            <tr
                              key={cand.rollNo}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                                !isPass ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                              }`}
                            >
                              <td className="py-1.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-1.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {cand.rollNo}
                              </td>
                              <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-white">
                                {cand.name}
                              </td>
                              <td className="py-1.5 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                                  isPass
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                }`}>
                                  {cand.status}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {cand.marks ? `${cand.marks} / 500` : '—'}
                              </td>
                              <td className="py-1.5 px-3 text-center">
                                {isPass ? (
                                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                    {cand.division} ({cand.percentage})
                                  </span>
                                ) : (
                                  <span className="text-[10.5px] font-bold text-red-700 dark:text-red-400">
                                    Reappear: {cand.reappearSubjects}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
