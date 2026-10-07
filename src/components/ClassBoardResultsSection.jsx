import React, { useState, useMemo } from 'react';
import { BOARD_RESULTS_BY_CLASS, CLASS_10_BOARD_RESULTS } from '../data/classBoardResults';

export default function ClassBoardResultsSection({ className = '', defaultClass = '10th' }) {
  const [selectedClass, setSelectedClass] = useState(defaultClass);
  const classCohorts = useMemo(() => {
    return BOARD_RESULTS_BY_CLASS[selectedClass] || CLASS_10_BOARD_RESULTS;
  }, [selectedClass]);

  const [selectedCohortId, setSelectedCohortId] = useState(() => classCohorts[0]?.id || '10th-regular-2024-25-oct-nov');
  const [showFullRoster, setShowFullRoster] = useState(false);
  const [rosterFilter, setRosterFilter] = useState('');

  const cohort = useMemo(() => {
    return classCohorts.find(c => c.id === selectedCohortId) || classCohorts[0];
  }, [classCohorts, selectedCohortId]);

  const handleClassChange = (newClass) => {
    setSelectedClass(newClass);
    const newCohorts = BOARD_RESULTS_BY_CLASS[newClass] || CLASS_10_BOARD_RESULTS;
    setSelectedCohortId(newCohorts[0]?.id || '');
    setShowFullRoster(false);
    setRosterFilter('');
  };

  const filteredRoster = useMemo(() => {
    if (!cohort?.allCandidates) return [];
    if (!rosterFilter.trim()) return cohort.allCandidates;
    const q = rosterFilter.toLowerCase().trim();
    return cohort.allCandidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.rollNo.includes(q) ||
      (c.status && c.status.toLowerCase().includes(q)) ||
      (c.reappearSubjects && c.reappearSubjects.toLowerCase().includes(q))
    );
  }, [cohort, rosterFilter]);

  const hasStreamColumn = selectedClass === '11th' || selectedClass === '12th' || cohort?.class === '11th' || cohort?.class === '12th';

  return (
    <div className={`w-full max-w-2xl mx-auto font-sans ${className}`}>
      {/* Class Switcher — Minimal & Compact */}
      <div className="flex items-center justify-center mb-2.5">
        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => handleClassChange('10th')}
            className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
              selectedClass === '10th'
                ? 'bg-teal-700 text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Class 10th
          </button>
          <button
            type="button"
            onClick={() => handleClassChange('11th')}
            className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
              selectedClass === '11th'
                ? 'bg-teal-700 text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Class 11th
          </button>
          <button
            type="button"
            onClick={() => handleClassChange('12th')}
            className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
              selectedClass === '12th'
                ? 'bg-teal-700 text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Class 12th
          </button>
        </div>
      </div>

      {/* Session Switcher — Standardized Session Names */}
      <div className="flex items-center justify-center gap-1.5 mb-4 flex-wrap">
        {classCohorts.map((item) => {
          const isActive = item.id === cohort?.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedCohortId(item.id);
                setShowFullRoster(false);
                setRosterFilter('');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer border ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              {item.examPeriod}
            </button>
          );
        })}
      </div>

      {/* Official Table Card — Exactly matching official institutional image layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 sm:p-5 shadow-2xs">
        
        {/* Header Title Section */}
        <div className="text-center mb-3">
          <h3 className="text-sm sm:text-base font-bold text-red-600 dark:text-red-500 tracking-tight">
            {cohort.title}
          </h3>
          <div className="mt-1 inline-block bg-[#d1f2d9] dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-3 py-0.5 rounded">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-emerald-200">
              {cohort.schoolName}
            </h4>
          </div>
        </div>

        {/* Indicators Table (Compact, Minimal, Exact match) */}
        <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded mb-5">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                <th className="py-1.5 px-3 font-bold w-2/3">Category / Indicator</th>
                <th className="py-1.5 px-3 font-bold text-right w-1/3">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {cohort.indicators.map((ind, i) => {
                const isHighlight = ind.highlight;
                return (
                  <tr
                    key={ind.label}
                    className={
                      isHighlight
                        ? 'bg-[#d1f2d9] dark:bg-emerald-950/80 font-bold'
                        : i % 2 === 1
                        ? 'bg-[#f4faf5]/70 dark:bg-slate-800/40'
                        : 'bg-white dark:bg-slate-900'
                    }
                  >
                    <td className={`py-1.5 px-3 ${isHighlight ? 'font-bold text-slate-900 dark:text-white' : ''}`}>
                      {ind.label}
                    </td>
                    <td className={`py-1.5 px-3 text-right font-mono ${isHighlight ? 'font-black text-red-600 dark:text-red-400 text-sm' : 'font-semibold'}`}>
                      {ind.count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* School Toppers Subsection */}
        {cohort.toppers && cohort.toppers.length > 0 && (
          <div className="mb-3">
            <h4 className="text-center text-xs sm:text-sm font-bold text-red-600 dark:text-red-500 mb-2">
              School toppers
            </h4>

            <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#9ca3af] dark:bg-slate-700 text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-600 font-bold">
                    <th className="py-1.5 px-2.5">Exam Roll No.</th>
                    <th className="py-1.5 px-2.5">
                      {cohort.id === '11th-regular-2024-25-mar-apr' ? 'Name (Parentage)' : 'Name'}
                    </th>
                    {hasStreamColumn ? (
                      <>
                        <th className="py-1.5 px-2.5 text-center">Result / Marks Obt.</th>
                        <th className="py-1.5 px-2.5 text-center">Stream</th>
                      </>
                    ) : (
                      <>
                        <th className="py-1.5 px-2 text-center">Result</th>
                        <th className="py-1.5 px-2.5 text-right">Marks Obt.</th>
                        <th className="py-1.5 px-2 text-center">Grade</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {cohort.toppers.map((t, idx) => (
                    <tr
                      key={t.rollNo}
                      className={idx % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'}
                    >
                      <td className="py-1.5 px-2.5 font-mono font-medium">{t.rollNo}</td>
                      <td className="py-1.5 px-2.5 font-semibold">{t.name}</td>
                      {hasStreamColumn ? (
                        <>
                          <td className="py-1.5 px-2.5 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                            {t.resultMarksDisplay || `${t.result} / ${t.marksObt}`}
                          </td>
                          <td className="py-1.5 px-2.5 text-center font-medium text-slate-700 dark:text-slate-300">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                              {t.stream === 'Medical' ? 'Science' : t.stream}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5 px-2 text-center font-medium">{t.result}</td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold">{t.marksObt}</td>
                          <td className="py-1.5 px-2 text-center font-semibold">{t.grade}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Optional Gazette Roster Toggle (Compact & Minimal) */}
        {cohort.allCandidates && cohort.allCandidates.length > 0 && (
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFullRoster(!showFullRoster)}
                className="font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
              >
                {showFullRoster ? 'Hide all candidates' : `View all ${cohort.allCandidates.length} candidates roster`}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Print table
              </button>
            </div>

            {showFullRoster && (
              <div className="mt-2.5 space-y-2">
                <input
                  type="text"
                  value={rosterFilter}
                  onChange={(e) => setRosterFilter(e.target.value)}
                  placeholder="Filter by name, roll no, or reappear subjects..."
                  className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-500"
                />

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded max-h-72 overflow-y-auto">
                  <table className="w-full text-[11.5px] text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                      <tr>
                        <th className="py-1 px-2">#</th>
                        <th className="py-1 px-2">Roll No.</th>
                        <th className="py-1 px-2">Name</th>
                        <th className="py-1 px-2 text-center">Status</th>
                        <th className="py-1 px-2 text-right">Marks</th>
                        <th className="py-1 px-2 text-center">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {filteredRoster.map((c, i) => (
                        <tr key={c.rollNo} className={!c.status.startsWith('Qualified') ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                          <td className="py-1 px-2 text-slate-400">{i + 1}</td>
                          <td className="py-1 px-2 font-mono">{c.rollNo}</td>
                          <td className="py-1 px-2 font-medium">{c.name}</td>
                          <td className="py-1 px-2 text-center">{c.status}</td>
                          <td className="py-1 px-2 text-right font-mono">{c.marks ?? '—'}</td>
                          <td className="py-1 px-2 text-center text-[10.5px] text-slate-500">
                            {c.reappearSubjects ? `Reappear: ${c.reappearSubjects}` : c.division}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
