import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { loadSiteSettings, DEFAULT_SETTINGS } from '../utils/settingsLoader';

export default function Admissions() {
  const [docOpen, setDocOpen] = useState(false);
  const docRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSiteSettings().then(setSettings);
  }, []);

  // Listen to cross-tab data sync broadcasts
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('hss_data_sync');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'UPDATE_DATA') {
          loadSiteSettings().then(setSettings);
        }
      };
      return () => channel.close();
    } catch (err) {
      // ignore
    }
  }, []);

  const isGlobalClosed = settings?.globalAdmissionsClosed;
  const isClassClosed = (cls) => isGlobalClosed || settings?.admissionsClosed?.[cls];

  const getFee = (key, fallback) => {
    return settings?.fees?.[key] !== undefined ? `Rs. ${settings.fees[key]}` : fallback;
  };

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setDocOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function openLoginWindow() {
    const LOGIN_URL = 'https://script.google.com/macros/s/AKfycbxklDr4jb25tAiDDrIoU2pjEBe9UXmJxkbXY-jp-BXLjkq9FppA1NlE2Or-gCpwjp8B1g/exec';
    try {
      const w = (typeof window !== 'undefined' && window.screen && window.screen.width) ? window.screen.width : (typeof window !== 'undefined' ? window.innerWidth : 1024);
      const h = (typeof window !== 'undefined' && window.screen && window.screen.height) ? window.screen.height : (typeof window !== 'undefined' ? window.innerHeight : 768);
      const features = `left=0,top=0,width=${w},height=${h},toolbar=no,location=no,menubar=no,resizable=yes,scrollbars=yes`;
      const newWin = window.open(LOGIN_URL, '_blank', features);
      if (newWin) newWin.focus(); else window.open(LOGIN_URL, '_blank');
    } catch (e) {
      window.open(LOGIN_URL, '_blank');
    }
  }

  function DocumentsModal() {
    const closeBtnRef = useRef(null);
    useEffect(() => {
      if (closeBtnRef.current) closeBtnRef.current.focus();
    }, []);
    if (!docOpen) return null;
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
            <button ref={closeBtnRef} onClick={() => setDocOpen(false)} className="px-4 py-2 btn-primary-custom rounded-md text-sm font-semibold shadow transition-all duration-200">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-teal-50 to-white py-6 sm:py-10">
      <SEO title="Admissions 2026" description="Learn about the step-by-step admissions process at Govt. Higher Secondary School Shangus. Register online, check required documents, and explore our session fee structure." />
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Admissions Status Warning Banner */}
        {isGlobalClosed && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-8 text-center text-sm font-semibold shadow-sm flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            Admissions for the 2026 Session are currently closed.
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4">Admission Process 2026</h2>
          <p className="text-slate-600">Follow these 4 simple steps to join our academic community.<br/>Applications are now open for the upcoming academic year.</p>
        </div>

        {/* Class-wise Admission Status Badge Row */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-10">
          <h4 className="text-center font-bold text-slate-800 mb-3 text-xs uppercase tracking-wider">Class-Wise Registration Status</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['9th', '10th', '11th', '12th'].map((cls) => {
              const closed = isClassClosed(cls);
              return (
                <div key={cls} className={`p-2 rounded-lg border text-center transition-all ${closed ? 'bg-red-50/50 border-red-100 text-red-700' : 'bg-emerald-50/50 border-emerald-100 text-emerald-700'}`}>
                  <div className="font-bold text-sm">{cls} Class</div>
                  <div className="text-[11px] font-semibold mt-0.5 flex items-center justify-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${closed ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    {closed ? 'Closed' : 'Open'}
                  </div>
                </div>
              );
            })}
          </div>
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
                {item.step === 1 && (
                  <div className="mt-2">
                    {isGlobalClosed ? (
                      <span className="inline-block bg-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-semibold shadow-inner">
                        Registration Closed
                      </span>
                    ) : (
                      <button onClick={openLoginWindow} className="btn-primary-custom px-4 py-1.5 rounded-full text-sm font-semibold shadow transition-all duration-200">Register to Apply Online</button>
                    )}
                  </div>
                )}
                {item.step === 2 && (
                  <button onClick={() => setDocOpen(true)} aria-expanded={docOpen} aria-controls="docs-title" className="btn-secondary-custom px-4 py-1.5 rounded-full text-sm font-semibold shadow transition-all duration-200">Documents Required</button>
                )}
            </div>
          ))}
        </div>

        {/* Render Documents modal when requested */}
        <DocumentsModal />

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
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('11th_science_boys', 'Rs. 1900')}</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('11th_science_girls', 'Rs. 1700')}</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('11th_humanities_boys', 'Rs. 1800')}</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('11th_humanities_girls', 'Rs. 1600')}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-3 font-bold border border-slate-200">12th</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('12th_science_boys', 'Rs. 1650')}</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('12th_science_girls', 'Rs. 1650')}</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('12th_humanities_boys', 'Rs. 1550')}</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('12th_humanities_girls', 'Rs. 1550')}</td>
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
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('9th', 'Rs. 1700')}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-3 font-bold border border-slate-200">10th</td>
                    <td className="p-3 border border-slate-200 text-slate-600">{getFee('10th', 'Rs. 1700')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards (visible < sm) */}
            <div className="sm:hidden">
              <h4 className="text-lg font-semibold text-slate-700 mb-3">Subject Combinations</h4>
              {[
                { label: '11th Science (Boys)', fee: getFee('11th_science_boys', 'Rs. 1900') },
                { label: '11th Science (Girls)', fee: getFee('11th_science_girls', 'Rs. 1700') },
                { label: '11th Humanities (Boys)', fee: getFee('11th_humanities_boys', 'Rs. 1800') },
                { label: '11th Humanities (Girls)', fee: getFee('11th_humanities_girls', 'Rs. 1600') },
                { label: '12th Science (Boys)', fee: getFee('12th_science_boys', 'Rs. 1650') },
                { label: '12th Science (Girls)', fee: getFee('12th_science_girls', 'Rs. 1650') },
                { label: '12th Humanities (Boys)', fee: getFee('12th_humanities_boys', 'Rs. 1550') },
                { label: '12th Humanities (Girls)', fee: getFee('12th_humanities_girls', 'Rs. 1550') }
              ].map(r => (
                <div key={r.label} className="bg-white p-3 rounded-lg mb-3 border border-slate-100 flex justify-between items-center">
                  <div className="font-bold text-slate-800">{r.label}</div>
                  <div className="text-slate-600">{r.fee}</div>
                </div>
              ))}
            </div>

            <div className="sm:hidden">
              <h4 className="text-lg font-semibold text-slate-700 mb-3">Secondary Subjects</h4>
              {[
                {cls: '9th', fee: getFee('9th', 'Rs. 1700')},
                {cls: '10th', fee: getFee('10th', 'Rs. 1700')}
              ].map(r => (
                <div key={r.cls} className="bg-white p-3 rounded-lg mb-3 border border-slate-100 flex justify-between items-center">
                  <div className="font-bold text-slate-800">{r.cls}</div>
                  <div className="text-slate-600">{r.fee}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link to="/academics" className="inline-block mt-5 -mb-4 relative z-20 btn-primary-custom px-6 py-2 rounded-full font-semibold shadow text-sm transition-all duration-200">
              View Subject Combinations
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

