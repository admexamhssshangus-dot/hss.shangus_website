import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Admissions() {
  const [docOpen, setDocOpen] = useState(false);
  const docRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setDocOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function DocumentsModal() {
    if (!docOpen) return null;
    const closeBtnRef = useRef(null);
    useEffect(() => {
      if (closeBtnRef.current) closeBtnRef.current.focus();
    }, []);
    return (
      <div ref={docRef} onMouseDown={(e) => { if (e.target === docRef.current) setDocOpen(false); }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="docs-title" className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl max-h-[80vh] overflow-auto" tabIndex={-1}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-teal-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2 17.5 5.7z"/></svg>
            </div>
            <div className="flex-1">
              <h3 id="docs-title" className="text-lg font-bold text-teal-800 mb-1">Documents Required</h3>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={16}/> <span>Discharge and character certificates (originals).</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={16}/> <span>One photostat each of Marks card, Aadhar card, Ration card and Bank passbook.</span></li>
                <li className="flex items-start gap-2"><CheckCircle className="text-teal-500 mt-0.5 flex-shrink-0" size={16}/> <span>Category certificate (if any).</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-4 text-right">
            <button ref={closeBtnRef} onClick={() => setDocOpen(false)} className="px-4 py-2 bg-teal-600 text-white rounded-md">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-teal-50 to-white py-6 sm:py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4">Admission Process 2026</h2>
          <p className="text-slate-600">Follow these 4 simple steps to join our academic community.<br/>Applications are now open for the upcoming academic year.</p>
        </div>

        {/* Process Steps */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-6 left-12 right-12 h-0.5 bg-teal-200 z-0"></div>
          
          {[
            { step: 1, title: 'Register Online', desc: 'Create an account and fill out the admission form with your details.' },
            { step: 2, title: 'Document Verification', desc: 'Visit the school office with original documents for verification.' },
            { step: 3, title: 'Fee Payment', desc: 'Pay the admission fee at J&K Bank using the challan provided.' },
            { step: 4, title: 'Final Enrollment', desc: 'Receive your Roll Number and ID Card to complete enrollment.' }
          ].map((item) => (
            <div key={item.step} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-600 to-teal-500 shadow-md flex items-center justify-center mb-3 text-white font-bold text-base ring-2 ring-teal-200">
                  {item.step}
                </div>
                <h4 className="font-bold text-slate-800 mb-1 text-sm">{item.title}</h4>
                <p className="text-[13px] text-slate-500 leading-relaxed px-1">{item.desc}</p>
                {item.step === 2 && (
                  <button onClick={() => setDocOpen(true)} aria-expanded={docOpen} aria-controls="docs-title" className="mt-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg ring-1 ring-orange-100">Documents Required</button>
                )}
            </div>
          ))}
        </div>

        {/* Render Documents modal when requested */}
        <DocumentsModal />

        {/* Documents are shown only when requested via the Documents modal */}

        {/* Fee Structure Table */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 mb-10 relative">
          <h3 className="text-xl font-bold text-teal-800 mb-2 text-center">Fee Structure (Session 2026)</h3>
          <div className="h-1 w-16 bg-teal-500 mx-auto mb-8 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Desktop tables (visible sm+) */}
            <div className="hidden sm:block overflow-x-auto md:col-span-2">
              <h4 className="text-lg font-semibold text-slate-700 mb-3 text-center md:text-left">Subject Combinations</h4>
              <table className="w-full text-sm text-center border-collapse">
                <thead>
                  <tr>
                    <th className="bg-slate-900 text-white p-3 w-1/5 border border-slate-800" rowSpan={2}>Class</th>
                    <th className="bg-orange-500 text-white p-2 border border-orange-600" colSpan={2}>Science</th>
                    <th className="bg-blue-500 text-white p-2 border border-blue-600" colSpan={2}>Humanities</th>
                  </tr>
                  <tr className="bg-slate-100 text-slate-600 text-xs font-bold uppercase">
                    <th className="p-2 border border-slate-300">Boys</th>
                    <th className="p-2 border border-slate-300">Girls</th>
                    <th className="p-2 border border-slate-300">Boys</th>
                    <th className="p-2 border border-slate-300">Girls</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 font-bold border border-slate-200">11th</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1900</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1700</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1800</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1600</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-3 font-bold border border-slate-200">12th</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1650</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1650</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1550</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1550</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="hidden sm:block overflow-x-auto md:col-span-1">
              <h4 className="text-lg font-semibold text-slate-700 mb-3 text-center md:text-left">Secondary Subjects</h4>
              <table className="w-full text-sm text-center border-collapse">
                <thead>
                  <tr>
                    <th className="bg-slate-900 text-white p-3 border border-slate-800">Class</th>
                    <th className="bg-slate-500 text-white p-3 border border-slate-600">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 font-bold border border-slate-200">9th</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1700</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-3 font-bold border border-slate-200">10th</td>
                    <td className="p-3 border border-slate-200 text-slate-600">Rs. 1700</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards (visible < sm) */}
            <div className="sm:hidden">
              <h4 className="text-lg font-semibold text-slate-700 mb-3">Subject Combinations</h4>
              {[{
                cls: '11th', vals: ['Science Boys: Rs. 1900', 'Science Girls: Rs. 1700', 'Humanities Boys: Rs. 1800', 'Humanities Girls: Rs. 1600']
              },{
                cls: '12th', vals: ['Science Boys: Rs. 1650', 'Science Girls: Rs. 1650', 'Humanities Boys: Rs. 1550', 'Humanities Girls: Rs. 1550']
              }].map(row => (
                <div key={row.cls} className="bg-white p-3 rounded-lg mb-3 border border-slate-100">
                  <div className="font-bold text-slate-800 mb-2">{row.cls}</div>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {row.vals.map(v => <li key={v}>• {v}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className="sm:hidden">
              <h4 className="text-lg font-semibold text-slate-700 mb-3">Secondary Subjects</h4>
              {[{cls: '9th', fee: 'Rs. 1700'}, {cls: '10th', fee: 'Rs. 1700'}].map(r => (
                <div key={r.cls} className="bg-white p-3 rounded-lg mb-3 border border-slate-100 flex justify-between items-center">
                  <div className="font-bold text-slate-800">{r.cls}</div>
                  <div className="text-slate-600">{r.fee}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link to="/academics" className="inline-block mt-6 -mb-6 relative z-20 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white px-8 py-3 rounded-full font-semibold transition-colors shadow-xl text-sm">
              View Subject Combinations
            </Link>
          </div>
        </div>

        {/* Final CTA */}
          <div className="text-center pb-8">
          <button
            onClick={() => {
              const LOGIN_URL = 'https://script.google.com/macros/s/AKfycbxklDr4jb25tAiDDrIoU2pjEBe9UXmJxkbXY-jp-BXLjkq9FppA1NlE2Or-gCpwjp8B1g/exec';
              try {
                const w = window.screen.width || screen.width;
                const h = window.screen.height || screen.height;
                const features = `left=0,top=0,width=${w},height=${h},toolbar=no,location=no,menubar=no,resizable=yes,scrollbars=yes`;
                const newWin = window.open(LOGIN_URL, '_blank', features);
                if (newWin) newWin.focus(); else window.open(LOGIN_URL, '_blank');
              } catch (e) {
                window.open('https://script.google.com/macros/s/AKfycbxklDr4jb25tAiDDrIoU2pjEBe9UXmJxkbXY-jp-BXLjkq9FppA1NlE2Or-gCpwjp8B1g/exec', '_blank');
              }
            }}
            className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white text-sm px-5 py-2 rounded-full font-bold transition-colors shadow-md"
          >
            Register to Apply Online
          </button>
        </div>

      </div>
    </div>
  );
}

