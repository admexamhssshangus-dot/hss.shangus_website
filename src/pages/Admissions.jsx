import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { loadSiteSettings, DEFAULT_SETTINGS } from '../utils/settingsLoader';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import DynamicPageRenderer from '../components/DynamicPageRenderer';

export default function Admissions() {
  const [docOpen, setDocOpen] = useState(false);
  const docRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dynamicData, setDynamicData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const snap = await getDoc(doc(db, 'site', 'page_admissions'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.blocks && data.blocks.length > 0) {
            setDynamicData(data);
          }
        }
      } catch (e) {
        console.warn("Failed to load dynamic page content", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-slate-500 py-20">
        <div className="w-10 h-10 rounded-full border-4 border-teal-600 border-t-transparent animate-spin mb-4" />
      </div>
    );
  }

  if (dynamicData) {
    return <DynamicPageRenderer pageData={dynamicData} pageId="admissions" />;
  }

  return (
    <div className="w-full bg-gradient-to-b from-teal-50 to-white py-6 sm:py-10">
      <SEO title="Admissions 2026" description="Learn about the step-by-step admissions process at Govt. Higher Secondary School Shangus. Register online, check required documents, and explore our session fee structure." />
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Admissions Status Warning Banner */}
        {isGlobalClosed && (
          <div className="banner-red-custom border px-4 py-3 rounded-lg mb-8 text-center text-sm font-semibold shadow-sm flex items-center justify-center gap-2">
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
                <div key={cls} className={`p-2 rounded-lg border text-center transition-all ${closed ? 'bg-red-950 text-red-400 border-red-900' : 'bg-emerald-950 text-emerald-400 border-emerald-900'}`}>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-16 right-16 h-0.5 bg-slate-200 z-0"></div>
          
          {[
            { step: 1, title: 'Register Online', desc: 'Create an account and fill out the admission form with your details.' },
            { step: 2, title: 'Document Verification', desc: 'Visit the school office with original documents for verification.' },
            { step: 3, title: 'Fee Payment', desc: 'Pay the admission fee at J&K Bank using the challan provided.' },
            { step: 4, title: 'Final Enrollment', desc: 'Receive your Roll Number and ID Card to complete enrollment.' }
          ].map((item) => (
            <div key={item.step} className="relative z-10 flex flex-col items-center text-center bg-white p-5 rounded-2xl border border-slate-200/65 shadow-sm hover:shadow-md hover:border-teal-500/35 transition-all duration-300 group">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-500 shadow-md flex items-center justify-center mb-4 text-white font-extrabold text-lg ring-4 ring-teal-50 transition-transform duration-300 group-hover:scale-105">
                  {item.step}
                </div>
                <h4 className="font-bold text-slate-800 mb-2 text-sm md:text-base leading-snug">{item.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed px-1 mb-4 flex-grow">{item.desc}</p>
                {item.step === 1 && (
                  <div className="mt-auto pt-2">
                    {isGlobalClosed ? (
                      <span className="inline-block bg-slate-100 text-slate-400 border border-slate-200 px-4 py-1.5 rounded-full text-xs font-semibold select-none shadow-inner">
                        Closed
                      </span>
                    ) : (
                      <button onClick={openLoginWindow} className="btn-primary-custom px-4 py-2 rounded-full text-xs font-bold shadow transition-all duration-200 hover:-translate-y-0.5 tracking-wide uppercase">Register</button>
                    )}
                  </div>
                )}
                {item.step === 2 && (
                  <div className="mt-auto pt-2">
                    <button onClick={() => setDocOpen(true)} aria-expanded={docOpen} aria-controls="docs-title" className="btn-secondary-custom px-4 py-2 rounded-full text-xs font-bold shadow transition-all duration-200 hover:-translate-y-0.5 tracking-wide uppercase">Documents</button>
                  </div>
                )}
            </div>
          ))}
        </div>

        {/* Render Documents modal when requested */}
        <DocumentsModal />

        {/* Fee Structure Table */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-slate-200 mb-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <h3 className="text-xl font-bold text-teal-800 mb-2 text-center font-heading">Fee Structure (Session 2026)</h3>
          <div className="h-1 w-16 bg-teal-600 mx-auto mb-8 rounded"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Desktop tables (visible sm+) */}
            <div className="hidden sm:block overflow-x-auto md:col-span-2">
              <h4 className="text-sm font-extrabold text-slate-400 mb-3 text-center md:text-left uppercase tracking-wider">Subject Combinations</h4>
              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                <table className="w-full text-sm text-center border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-slate-900 text-white p-3 w-1/5 border-b border-r border-slate-800 font-semibold font-title tracking-wider" rowSpan={2}>Class</th>
                      <th className="bg-teal-700 text-white p-2 border-b border-r border-teal-800 font-semibold" colSpan={2}>Science</th>
                      <th className="bg-amber-600 text-white p-2 border-b border-amber-700 font-semibold" colSpan={2}>Humanities</th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                      <th className="p-2 border-r border-slate-200">Boys</th>
                      <th className="p-2 border-r border-slate-200">Girls</th>
                      <th className="p-2 border-r border-slate-200">Boys</th>
                      <th className="p-2">Girls</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-extrabold border-t border-r border-slate-200 text-slate-800">11th</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-600 font-semibold">{getFee('11th_science_boys', 'Rs. 1900')}</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-600 font-semibold">{getFee('11th_science_girls', 'Rs. 1700')}</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-600 font-semibold">{getFee('11th_humanities_boys', 'Rs. 1800')}</td>
                      <td className="p-3 border-t border-slate-200 text-slate-600 font-semibold">{getFee('11th_humanities_girls', 'Rs. 1600')}</td>
                    </tr>
                    <tr className="bg-slate-50/30 hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-extrabold border-t border-r border-slate-200 text-slate-800">12th</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-600 font-semibold">{getFee('12th_science_boys', 'Rs. 1650')}</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-600 font-semibold">{getFee('12th_science_girls', 'Rs. 1650')}</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-600 font-semibold">{getFee('12th_humanities_boys', 'Rs. 1550')}</td>
                      <td className="p-3 border-t border-slate-200 text-slate-600 font-semibold">{getFee('12th_humanities_girls', 'Rs. 1550')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="hidden sm:block overflow-x-auto md:col-span-1 mt-6 md:mt-0">
              <h4 className="text-sm font-extrabold text-slate-400 mb-3 text-center md:text-left uppercase tracking-wider">Secondary</h4>
              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                <table className="w-full text-sm text-center border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-slate-900 text-white p-3 border-b border-r border-slate-800 font-semibold font-title tracking-wider">Class</th>
                      <th className="bg-violet-700 text-white p-3 border-b border-violet-850 font-semibold">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-extrabold border-r border-slate-200 text-slate-800">9th</td>
                      <td className="p-3 text-slate-600 font-semibold">{getFee('9th', 'Rs. 1700')}</td>
                    </tr>
                    <tr className="bg-slate-50/30 hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-extrabold border-t border-r border-slate-200 text-slate-800">10th</td>
                      <td className="p-3 border-t border-slate-200 text-slate-600 font-semibold">{getFee('10th', 'Rs. 1700')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile stacked blocks (visible < sm) */}
            <div className="sm:hidden flex flex-col gap-6 w-full">
              {/* Science Stream Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-teal-500"></div>
                <div className="p-5 pl-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Science Stream</h4>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: '11th Science (Boys)', fee: getFee('11th_science_boys', 'Rs. 1900') },
                      { label: '11th Science (Girls)', fee: getFee('11th_science_girls', 'Rs. 1700') },
                      { label: '12th Science (Boys)', fee: getFee('12th_science_boys', 'Rs. 1650') },
                      { label: '12th Science (Girls)', fee: getFee('12th_science_girls', 'Rs. 1650') }
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">{r.label}</span>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded px-2.5 py-1">
                          <span className="text-teal-600 font-bold text-[10px]">Rs.</span>
                          <span className="text-slate-800 font-bold">{r.fee.replace('Rs. ', '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Humanities Stream Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-amber-500"></div>
                <div className="p-5 pl-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Humanities Stream</h4>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: '11th Humanities (Boys)', fee: getFee('11th_humanities_boys', 'Rs. 1800') },
                      { label: '11th Humanities (Girls)', fee: getFee('11th_humanities_girls', 'Rs. 1600') },
                      { label: '12th Humanities (Boys)', fee: getFee('12th_humanities_boys', 'Rs. 1550') },
                      { label: '12th Humanities (Girls)', fee: getFee('12th_humanities_girls', 'Rs. 1550') }
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">{r.label}</span>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded px-2.5 py-1">
                          <span className="text-amber-500 font-bold text-[10px]">Rs.</span>
                          <span className="text-slate-800 font-bold">{r.fee.replace('Rs. ', '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Secondary Classes Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-indigo-500"></div>
                <div className="p-5 pl-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Secondary Classes</h4>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: '9th Class Subjects', fee: getFee('9th', 'Rs. 1700') },
                      { label: '10th Class Subjects', fee: getFee('10th', 'Rs. 1700') }
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">{r.label}</span>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded px-2.5 py-1">
                          <span className="text-indigo-500 font-bold text-[10px]">Rs.</span>
                          <span className="text-slate-800 font-bold">{r.fee.replace('Rs. ', '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center w-full">
            <Link to="/academics" className="inline-block mt-8 relative z-20 btn-primary-custom px-6 py-2.5 rounded-full font-bold shadow text-xs tracking-wider uppercase transition-all duration-200">
              View Subject Combinations
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

