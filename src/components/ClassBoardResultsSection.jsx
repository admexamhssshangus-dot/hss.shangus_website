import React, { useState, useMemo } from 'react';
import { Printer } from 'lucide-react';
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

  const handlePrint = () => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('clean-print-mode', 'result-table-print-mode');
      window.print();
      setTimeout(() => {
        document.body.classList.remove('clean-print-mode', 'result-table-print-mode');
      }, 1200);
    }
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

  const [summaryLayout, setSummaryLayout] = useState('multicolumn'); // 'multicolumn' | 'horizontal'

  const multiColumnPairs = useMemo(() => {
    if (!cohort?.indicators) return [];
    const ind = cohort.indicators;

    const findInd = (pattern) => ind.find(i => pattern.test(i.label));

    const appeared = findInd(/appeared/i) || ind[0];
    const passed = findInd(/passed/i) || ind[2] || ind[1];
    const failed = findInd(/failed|reappear/i) || ind[1];
    const distinc = findInd(/distinc/i);
    const firstDiv = findInd(/1st div/i);
    const secondDiv = findInd(/2nd div/i);
    const thirdDiv = findInd(/3rd div/i);
    const overall = findInd(/result|pass percentage/i) || ind.find(i => i.highlight);

    if (appeared && distinc && firstDiv && secondDiv && overall) {
      return [
        { left: appeared, right: distinc },
        { left: passed, right: firstDiv },
        { left: failed, right: secondDiv },
        { left: thirdDiv || { label: 'total 3rd Div', count: '0' }, right: overall }
      ];
    }

    const half = Math.ceil(ind.length / 2);
    const rows = [];
    for (let i = 0; i < half; i++) {
      rows.push({
        left: ind[i],
        right: ind[i + half] || null
      });
    }
    return rows;
  }, [cohort]);

  const hasStreamColumn = selectedClass === '11th' || selectedClass === '12th' || cohort?.class === '11th' || cohort?.class === '12th';

  return (
    <div className={`w-full max-w-2xl mx-auto font-sans ${className}`}>
      {/* Class Switcher — Minimal & Compact */}
      <div className="flex items-center justify-center mb-2.5 print-hide">
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
      <div className="flex items-center justify-center gap-1.5 mb-4 flex-wrap print-hide">
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

      {/* Official Table Card — Exactly matching official institutional image layout & printable */}
      <div className="printable-result-sheet bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 sm:p-5 shadow-2xs">
        
        {/* Print-Only Official Letterhead Header */}
        <div className="print-only text-center mb-4 pb-2 border-b-2 border-slate-800">
          <h2 className="text-base font-extrabold tracking-tight uppercase text-black">
            Government Higher Secondary School Shangus, Anantnag
          </h2>
          <p className="text-[11px] font-semibold text-slate-700">
            Office of the Academic Examination Committee • Jammu &amp; Kashmir Board of School Education (JKBOSE)
          </p>
          <div className="mt-1.5 inline-block px-3 py-0.5 border border-black rounded text-[11px] font-bold text-black uppercase">
            Official Board Examination Performance Statement &amp; Gazette Summary
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-800 px-1">
            <span><strong>Class:</strong> {cohort.class}</span>
            <span><strong>Session / Cohort:</strong> {cohort.examPeriod}</span>
            <span><strong>Institution:</strong> {cohort.schoolName}</span>
            <span><strong>Date of Print:</strong> {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        {/* Action Header on Screen */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2 print-hide">
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Official Performance Gazette
            </span>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Class {cohort.class} • {cohort.examPeriod}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Multi-Column / Horizontal Layout Switcher */}
            <div className="inline-flex p-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setSummaryLayout('multicolumn')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  summaryLayout === 'multicolumn'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Multi-column structured table (2×4)"
              >
                Multi-Column
              </button>
              <button
                type="button"
                onClick={() => setSummaryLayout('horizontal')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  summaryLayout === 'horizontal'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Horizontal gazette summary"
              >
                Horizontal
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
              title="Print clean official result sheet"
            >
              <Printer size={13} />
              <span>Print Clean Statement</span>
            </button>
          </div>
        </div>

        {/* Header Title Section on Screen */}
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

        {/* Indicators Table (Multi-Column Structure or Horizontal Gazette) */}
        {summaryLayout === 'multicolumn' ? (
          <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded mb-4">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  <th className="py-1.5 px-3 font-bold w-[34%]">Category / Indicator</th>
                  <th className="py-1.5 px-3 font-bold text-right w-[16%]">Count</th>
                  <th className="py-1.5 px-3 font-bold w-[34%] border-l border-slate-300 dark:border-slate-700">Category / Indicator</th>
                  <th className="py-1.5 px-3 font-bold text-right w-[16%]">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {multiColumnPairs.map((pair, idx) => {
                  const leftHighlight = pair.left?.highlight;
                  const rightHighlight = pair.right?.highlight;
                  return (
                    <tr
                      key={idx}
                      className={idx % 2 === 1 ? 'bg-[#f4faf5]/70 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'}
                    >
                      {/* Left Column Pair */}
                      <td className={`py-1.5 px-3 ${leftHighlight ? 'font-bold text-slate-900 dark:text-white bg-[#d1f2d9] dark:bg-emerald-950/80' : ''}`}>
                        {pair.left?.label || '—'}
                      </td>
                      <td className={`py-1.5 px-3 text-right font-mono ${leftHighlight ? 'font-black text-red-600 dark:text-red-400 text-sm bg-[#d1f2d9] dark:bg-emerald-950/80' : 'font-semibold'}`}>
                        {pair.left?.count ?? '—'}
                      </td>

                      {/* Right Column Pair */}
                      <td className={`py-1.5 px-3 border-l border-slate-300 dark:border-slate-700 ${rightHighlight ? 'font-bold text-slate-900 dark:text-white bg-[#d1f2d9] dark:bg-emerald-950/80' : ''}`}>
                        {pair.right?.label || '—'}
                      </td>
                      <td className={`py-1.5 px-3 text-right font-mono ${rightHighlight ? 'font-black text-red-600 dark:text-red-400 text-sm bg-[#d1f2d9] dark:bg-emerald-950/80' : 'font-semibold'}`}>
                        {pair.right?.count ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded mb-4">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap">
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">Appeared</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">Passed</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">Reappear</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">Distinction</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">1st Div</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">2nd Div</th>
                  <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">3rd Div</th>
                  <th className="py-2 px-2 bg-[#d1f2d9] dark:bg-emerald-950/80 text-slate-900 dark:text-emerald-100 font-bold">Overall Result</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 dark:text-slate-200">
                <tr className="font-mono text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900">
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort.summaryStats.appeared}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-bold">{cohort.summaryStats.passed}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400">{cohort.summaryStats.failed}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort.summaryStats.distinction}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort.summaryStats.firstDiv}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort.summaryStats.secondDiv}</td>
                  <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-700">{cohort.summaryStats.thirdDiv}</td>
                  <td className="py-2 px-2 bg-[#d1f2d9] dark:bg-emerald-950/80 text-red-600 dark:text-red-400 font-black text-sm sm:text-base">
                    {cohort.summaryStats.overallPercent}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

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
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 text-xs print-hide">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFullRoster(!showFullRoster)}
                className="font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
              >
                {showFullRoster ? 'Hide all candidates' : `View all ${cohort.allCandidates.length} candidates roster`}
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

        {/* Print-Only Official Endorsement & Verification Signatures */}
        <div className="print-only mt-8 pt-4 border-t border-slate-400">
          <div className="flex justify-between items-end text-xs font-semibold text-black px-6 pt-10">
            <div className="text-center">
              <div className="w-36 border-t border-black mb-1"></div>
              <span>Incharge Examination</span>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 border border-dashed border-slate-400 rounded-full flex items-center justify-center text-[9px] text-slate-500 mb-2 mx-auto">
                Official Seal
              </div>
            </div>
            <div className="text-center">
              <div className="w-36 border-t border-black mb-1"></div>
              <span>Principal / Head of Institution</span>
            </div>
          </div>
          <p className="text-[9.5px] text-center text-slate-600 mt-4">
            Official Institutional Record • Govt. Higher Secondary School Shangus, Anantnag • Verified Against Official JKBOSE Gazette
          </p>
        </div>

      </div>
    </div>
  );
}
