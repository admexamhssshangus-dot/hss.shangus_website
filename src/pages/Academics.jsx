import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle } from 'lucide-react';
import SEO from '../components/SEO';

export default function Academics() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalItems, setModalItems] = useState([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('science');
  const [tabAnimating, setTabAnimating] = useState(false);

  function switchTab(tab) {
    if (tab === activeTab) return;
    setTabAnimating(true);
    setActiveTab(tab);
    setTimeout(() => setTabAnimating(false), 200);
  }

  function combine(arr, k) {
    const res = [];
    function helper(start, combo) {
      if (combo.length === k) {
        res.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    }
    if (k <= 0) return [[]];
    helper(0, []);
    return res;
  }

  function showCombinations(stream, levelLabel) {
    let groupA = [];
    let groupB = [];
    // Group C varies by stream: exclude Environmental Science and Physical Education for secondary (9th & 10th)
    let groupC = ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'];

    if (stream === 'science') {
      groupA = ['General English', 'Physics', 'Chemistry'];
      groupB = ['Biology', 'Mathematics'];
    } else if (stream === 'humanities') {
      groupA = ['General English'];
      groupB = ['Urdu', 'Education', 'Economics', 'History', 'Political Science', 'Mathematics'];
    } else {
      groupA = ['English', 'Mathematics', 'Science', 'Social Studies'];
      groupB = ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'];
    }

    const base = [...groupA];
    const need = Math.max(0, 5 - base.length);
    // For secondary (9th & 10th) exclude some Group C subjects
    const effectiveGroupC = stream === 'secondary' ? ['Healthcare', 'IT and ITES'] : groupC;
    const options = [...groupB, ...effectiveGroupC];
    const chosen = combine(options, need);
    // enforce selection rules:
    // - humanities: require exactly 3 from groupB and 1 from groupC
    // - science: disallow choosing both options from Group C (must be either 2 from B or 1 from B + 1 from C)
    let valid = chosen;
    if (stream === 'humanities') {
      valid = chosen.filter(arr => {
        const countB = arr.filter(x => groupB.includes(x)).length;
        const countC = arr.filter(x => groupC.includes(x)).length;
        return countB === 3 && countC === 1;
      });
    } else if (stream === 'science') {
      valid = chosen.filter(arr => {
        const countB = arr.filter(x => groupB.includes(x)).length;
        const countC = arr.filter(x => groupC.includes(x)).length;
        // allowed patterns: (B=2,C=0) or (B=1,C=1)
        return (countB === 2 && countC === 0) || (countB === 1 && countC === 1);
      });
    }
    const combos = valid.map(arr => [...base, ...arr].join(' • '));
    const unique = Array.from(new Set(combos)).sort();

    setModalTitle(`${levelLabel} — ${stream.charAt(0).toUpperCase() + stream.slice(1)} (${unique.length})`);
    setModalItems(unique);
    setModalOpen(true);
  }

  function copyList() {
    const text = modalItems.join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(false);
    });
  }

  function downloadList() {
    const blob = new Blob([modalItems.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'combinations.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

    function CombinationsModal() {
    const overlayRef = useRef(null);
    const [entered, setEntered] = useState(false);

    useEffect(() => {
      function onKey(e) {
        if (e.key === 'Escape') setModalOpen(false);
      }
      document.addEventListener('keydown', onKey);
      setEntered(true);
      return () => document.removeEventListener('keydown', onKey);
    }, []);

    if (!modalOpen) return null;

    return (
      <div ref={overlayRef} onMouseDown={(e) => { if (e.target === overlayRef.current) setModalOpen(false); }} className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-3">
        <div onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={`bg-white rounded-lg max-w-2xl w-full p-3 shadow-lg transform transition-all duration-200 ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`} tabIndex={-1}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-800 font-semibold text-sm">{modalTitle}</div>
            <div className="flex items-center gap-2">
              <button onClick={copyList} className="text-xs px-2 py-1 bg-slate-100 rounded">Copy</button>
              <button onClick={downloadList} className="text-xs px-2 py-1 bg-slate-100 rounded">Download</button>
              <button onClick={() => setModalOpen(false)} className="text-xs px-2 py-1 bg-slate-50 rounded">Close</button>
            </div>
          </div>
          <div className="max-h-[60vh] sm:max-h-72 overflow-auto text-sm text-slate-700 p-1">
            {modalItems.map((it, idx) => (
              <div key={idx} className="py-1 border-b border-slate-100 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{it}</div>
            ))}
            {modalItems.length === 0 && <div className="text-slate-400">No combinations available.</div>}
          </div>
          {copied && <div className="text-xs text-teal-600 mt-2">Copied to clipboard</div>}
        </div>
      </div>
    );
  }

  // reduce whitespace above/below heading by ~40%: smaller paddings/margins
  return (
    <div className="w-full bg-gradient-to-b from-teal-50 to-white py-4 sm:py-6">
      <SEO title="Academic Streams & Combinations" description="Explore the school departments, subjects, and curriculum choices for secondary and higher secondary levels at Govt. Higher Secondary School Shangus." />
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="hidden">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Subject Combinations & Streams</h2>
          <div className="h-1 w-24 bg-gradient-to-r from-teal-500 to-teal-600 mx-auto mt-3 rounded"></div>
          <p className="text-sm text-slate-500 mt-3">Explore curated subject combinations for each stream with quick copy and download options.</p>
        </div>

          <div className="bg-white p-3 sm:p-3 rounded-lg shadow-sm border border-slate-200 mb-4">
          <h3 className="text-xl font-bold text-teal-800 mb-4">Our Departments</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-bold text-sm text-slate-600 mb-3 uppercase tracking-wider">Secondary (9th - 10th)</h4>
              <div className="flex flex-wrap gap-2">
                {['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies', 'IT & ITES', 'Healthcare'].map(sub => (
                  <span key={sub} className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-md font-medium border border-slate-200">{sub}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-600 mb-3 uppercase tracking-wider">Higher Secondary (11th - 12th)</h4>
              <div className="flex flex-wrap gap-2">
                {['General English', 'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Environmental Science', 'Physical Education', 'IT & ITES', 'Healthcare', 'Education', 'History', 'Political Science', 'Economics', 'Urdu'].map(sub => (
                  <span key={sub} className="bg-teal-50 text-teal-800 text-xs px-2 py-1 rounded-md font-medium border border-teal-100">{sub}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

          <div className="bg-white p-3 sm:p-5 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-teal-800 mb-2">Subject Combinations & Streams</h2>
          <p className="text-sm text-slate-500 mb-4">Explore curated subject combinations for each stream with quick copy and download options.</p>

          <CombinationsModal />

          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
              <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-3">
                <button onClick={() => switchTab('science')} className={`w-full text-center px-3 py-1 sm:py-2 rounded-md font-semibold text-sm ${activeTab === 'science' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-50 text-slate-700'}`}>Science</button>
                <button onClick={() => switchTab('humanities')} className={`w-full text-center px-3 py-1 sm:py-2 rounded-md font-semibold text-sm ${activeTab === 'humanities' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-50 text-slate-700'}`}>Humanities</button>
                <button onClick={() => switchTab('secondary')} className={`w-full text-center px-3 py-1 sm:py-2 rounded-md font-semibold text-sm ${activeTab === 'secondary' ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-50 text-slate-700'}`}>9th & 10th</button>
              </div>

            <div className={`grid md:grid-cols-3 gap-3 transition-all duration-200 ${tabAnimating ? 'opacity-60 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2">Group A</div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100 text-slate-800 font-medium text-sm">
                  {activeTab === 'science' && 'General English, Physics, Chemistry'}
                  {activeTab === 'humanities' && 'General English'}
                  {activeTab === 'secondary' && 'English, Mathematics, Science, Social Studies'}
                </div>
                <div className="text-xs text-slate-400 mt-2">Compulsory</div>
              </div>

              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2">Group B (Options)</div>
                <div className="bg-white p-2 rounded border border-slate-100">
                  <ul className="space-y-2">
                    {activeTab === 'science' && ['Biology', 'Mathematics'].map(s => (
                      <li key={s} className="text-slate-700 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{s}</li>
                    ))}
                    {activeTab === 'humanities' && ['Urdu', 'Education', 'Economics', 'History', 'Political Science', 'Mathematics'].map(s => (
                      <li key={s} className="text-slate-700 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{s}</li>
                    ))}
                    {activeTab === 'secondary' && ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'].map(s => (
                      <li key={s} className="text-slate-700 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-slate-500 font-semibold mb-2">Group C (Options)</div>
                <div className="bg-white p-2 rounded border border-slate-100">
                  <ul className="space-y-2">
                    {(activeTab === 'secondary' ? ['Healthcare', 'IT and ITES'] : ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES']).map(s => (
                      <li key={s} className="text-slate-700 text-sm flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={14} />{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                  <button onClick={() => showCombinations(activeTab === 'secondary' ? 'secondary' : activeTab, activeTab === 'secondary' ? '9th & 10th' : '11th & 12th')} className="w-full sm:w-auto btn-primary-custom px-3 py-2 rounded-lg font-semibold text-sm shadow transition-all duration-200">View List</button>
                  <div className="text-xs text-slate-500 mt-2 sm:mt-0">
                    {activeTab === 'science' && 'Compulsory (3). Choose 2 more: either both from Group B, or 1 from Group B and 1 from Group C (both from Group C not allowed).'}
                    {activeTab === 'humanities' && 'Compulsory (1). Choose 3 from Group B and 1 from Group C.'}
                    {activeTab === 'secondary' && 'Students have to take a maximum of 5 subjects (some may take 6 depending on choices).'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
