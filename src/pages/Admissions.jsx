import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { loadSiteSettings, DEFAULT_SETTINGS, getCachedSiteSettings, subscribeSiteSettings } from '../utils/settingsLoader';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import DynamicPageRenderer from '../components/DynamicPageRenderer';
import PublicPageSkeleton from '../components/PublicPageSkeleton';
import EducationalBackground from '../components/common/EducationalBackground';

export default function Admissions() {
  const [docOpen, setDocOpen] = useState(false);
  const docRef = useRef(null);
  const [settings, setSettings] = useState(() => getCachedSiteSettings());
  const [dynamicData, setDynamicData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const docPromise = getDoc(doc(db, 'site', 'page_admissions'));
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1800));
        const snap = await Promise.race([docPromise, timeoutPromise]);
        if (snap && snap.exists() && isMounted) {
          const data = snap.data();
          if (data.blocks && data.blocks.length > 0) {
            setDynamicData(data);
          }
        }
      } catch (e) {
        // Fallback gracefully to default interactive admissions layout
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Real-time live synchronization with Firebase Firestore settings
  useEffect(() => {
    const unsubscribe = subscribeSiteSettings((liveSettings) => {
      setSettings(liveSettings);
    });
    return () => unsubscribe();
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
    return <PublicPageSkeleton label="Loading admissions information…" />;
  }

  if (dynamicData) {
    return <DynamicPageRenderer pageData={dynamicData} pageId="admissions" />;
  }

  return (
    <div className="public-page relative w-full min-h-screen py-6 sm:py-12 overflow-hidden isolate">
      <EducationalBackground variant="admissions" />
      <SEO title="Admissions 2026" description="Learn about the step-by-step admissions process at Govt. Higher Secondary School Shangus. Register online, check required documents, and explore our session fee structure." />
      <div className="max-w-4xl mx-auto px-3 sm:px-6 relative z-10">
        
        {/* Admissions Status Warning Banner */}
        {isGlobalClosed && (
          <div className="banner-red-custom border px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl mb-6 sm:mb-8 text-center text-xs sm:text-sm font-semibold shadow-sm flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            Admissions for the 2026 Session are currently closed.
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/90 text-emerald-800 border border-emerald-200 shadow-xs mb-3 backdrop-blur-sm">
            <span className="text-sm">🏛️</span>
            <span className="tracking-wide uppercase text-[11px] font-extrabold">Admissions Open • Session 2026</span>
          </div>
          <h1 className="ui-page-title text-2xl sm:text-3xl md:text-4xl text-slate-800 font-extrabold mb-2.5 sm:mb-3">Admission Process 2026</h1>
          <div className="h-1.5 w-28 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500 mx-auto mb-3.5 rounded-full shadow-xs"></div>
          <p className="text-slate-600 max-w-xl mx-auto text-xs xs:text-sm sm:text-base leading-relaxed px-1">Follow these 4 simple steps to join our vibrant academic community.<br/><span className="text-teal-700 font-semibold">Online and in-person registration is open for the upcoming academic session.</span></p>
        </div>

        {/* Class-wise Admission Status Badge Row */}
        <div className="relative bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all mb-8 sm:mb-10 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xs">📊</span>
            <h4 className="text-center font-bold text-slate-700 text-xs uppercase tracking-wider">Class-Wise Registration Status</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {['9th', '10th', '11th', '12th'].map((cls) => {
              const closed = isClassClosed(cls);
              return (
                <div
                  key={cls}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
                    closed
                      ? 'bg-rose-50/90 text-rose-800 border-rose-200'
                      : 'bg-emerald-50/90 text-emerald-800 border-emerald-200/90 shadow-xs hover:border-emerald-300 hover:bg-emerald-100/70'
                  }`}
                >
                  <div className="font-extrabold text-xs sm:text-sm text-slate-800">{cls} Class</div>
                  <div className={`text-[10px] sm:text-[11px] font-bold mt-1 flex items-center justify-center gap-1.5 ${closed ? 'text-rose-700' : 'text-emerald-700'}`}>
                    <span className={`w-2 h-2 rounded-full ${closed ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                    {closed ? 'Closed' : 'Open'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Process Steps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-10 sm:mb-12 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-11 left-16 right-16 h-1 bg-gradient-to-r from-teal-400 via-blue-400 via-amber-400 to-emerald-400 rounded-full z-0 opacity-40"></div>
          
          {[
            { step: 1, title: 'Register Online', desc: 'Create an account and fill out the admission form with your details.', icon: '📝', color: 'from-teal-600 to-cyan-600', ring: 'ring-teal-100' },
            { step: 2, title: 'Document Verification', desc: 'Visit the school office with original documents for verification.', icon: '📑', color: 'from-blue-600 to-indigo-600', ring: 'ring-blue-100' },
            { step: 3, title: 'Fee Payment', desc: 'Pay fee online securely via Official Online Payment Gateway or Bank UPI.', icon: '💳', color: 'from-amber-500 to-orange-500', ring: 'ring-amber-100' },
            { step: 4, title: 'Final Enrollment', desc: 'Receive your Roll Number and ID Card to complete enrollment.', icon: '🎓', color: 'from-emerald-600 to-teal-600', ring: 'ring-emerald-100' }
          ].map((item) => (
            <div key={item.step} className="relative z-10 flex flex-col items-center text-center bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-teal-400/50 hover:-translate-y-1 transition-all duration-300 group">
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${item.color} shadow-md flex items-center justify-center mb-3 text-white font-extrabold text-base sm:text-lg ring-4 ${item.ring} transition-transform duration-300 group-hover:scale-105`}>
                  {item.step}
                </div>
                <div className="text-[10px] sm:text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">Step {item.step}</div>
                <h4 className="font-bold text-slate-900 mb-1.5 text-sm sm:text-base leading-snug">{item.title}</h4>
                <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed px-1 mb-3.5 flex-grow">{item.desc}</p>
                {item.step === 1 && (
                  <div className="mt-auto pt-2">
                    {isGlobalClosed ? (
                      <span className="inline-block bg-slate-100 text-slate-400 border border-slate-200 px-4 py-1.5 rounded-full text-xs font-semibold select-none shadow-inner">
                        Closed
                      </span>
                    ) : (
                      <Link to="/portal/login" className="btn-primary-custom px-4 py-2 rounded-full text-xs font-bold shadow transition-all duration-200 hover:-translate-y-0.5 tracking-wide uppercase inline-block no-underline">Register</Link>
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
        <div className="relative bg-white p-4 sm:p-8 rounded-2xl shadow-md border border-slate-200/80 mb-10 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-indigo-500 to-amber-500" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">🧾</span>
            <h3 className="text-xl font-bold text-teal-800 text-center font-heading">Fee Structure (Session 2026)</h3>
          </div>
          <div className="h-1 w-16 bg-teal-600 mx-auto mb-8 rounded"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Desktop tables (visible sm+) */}
            <div className="hidden sm:block overflow-x-auto md:col-span-2">
              <h4 className="text-sm font-extrabold text-slate-600 mb-3 text-center md:text-left uppercase tracking-wider">Subject Combinations</h4>
              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                <table className="w-full text-sm text-center border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-slate-900 text-white p-3 w-1/5 border-b border-r border-slate-800 font-semibold font-title tracking-wider" rowSpan={2}>Class</th>
                      <th className="bg-teal-700 text-white p-2 border-b border-r border-teal-800 font-semibold" colSpan={2}>Science</th>
                      <th className="bg-amber-600 text-white p-2 border-b border-amber-700 font-semibold" colSpan={2}>Humanities</th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
                      <th className="p-2 border-r border-slate-200">Boys</th>
                      <th className="p-2 border-r border-slate-200">Girls</th>
                      <th className="p-2 border-r border-slate-200">Boys</th>
                      <th className="p-2">Girls</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-extrabold border-t border-r border-slate-200 text-slate-900">11th</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-800 font-semibold">{getFee('11th_science_boys', 'Rs. 1900')}</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-800 font-semibold">{getFee('11th_science_girls', 'Rs. 1700')}</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-800 font-semibold">{getFee('11th_humanities_boys', 'Rs. 1800')}</td>
                      <td className="p-3 border-t border-slate-200 text-slate-800 font-semibold">{getFee('11th_humanities_girls', 'Rs. 1600')}</td>
                    </tr>
                    <tr className="bg-slate-50/30 hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-extrabold border-t border-r border-slate-200 text-slate-900">12th</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-800 font-semibold">{getFee('12th_science_boys', 'Rs. 1650')}</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-800 font-semibold">{getFee('12th_science_girls', 'Rs. 1650')}</td>
                      <td className="p-3 border-t border-r border-slate-200 text-slate-800 font-semibold">{getFee('12th_humanities_boys', 'Rs. 1550')}</td>
                      <td className="p-3 border-t border-slate-200 text-slate-800 font-semibold">{getFee('12th_humanities_girls', 'Rs. 1550')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="hidden sm:block overflow-x-auto md:col-span-1 mt-6 md:mt-0">
              <h4 className="text-sm font-extrabold text-slate-600 mb-3 text-center md:text-left uppercase tracking-wider">Secondary</h4>
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
                      <td className="p-3 font-extrabold border-r border-slate-200 text-slate-900">9th</td>
                      <td className="p-3 text-slate-800 font-semibold">{getFee('9th', 'Rs. 1700')}</td>
                    </tr>
                    <tr className="bg-slate-50/30 hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-extrabold border-t border-r border-slate-200 text-slate-900">10th</td>
                      <td className="p-3 border-t border-slate-200 text-slate-800 font-semibold">{getFee('10th', 'Rs. 1100')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile stacked blocks (visible < sm) */}
            <div className="sm:hidden flex flex-col gap-3.5 w-full">
              {/* Science Stream Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-teal-500"></div>
                <div className="p-3.5 pl-4.5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">Science Stream</h4>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: '11th Science (Boys)', fee: getFee('11th_science_boys', 'Rs. 1900') },
                      { label: '11th Science (Girls)', fee: getFee('11th_science_girls', 'Rs. 1700') },
                      { label: '12th Science (Boys)', fee: getFee('12th_science_boys', 'Rs. 1650') },
                      { label: '12th Science (Girls)', fee: getFee('12th_science_girls', 'Rs. 1650') }
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center text-xs xs:text-sm gap-2">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{r.label}</span>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 shrink-0">
                          <span className="text-teal-700 dark:text-teal-400 font-bold text-[10px]">Rs.</span>
                          <span className="text-slate-900 dark:text-white font-bold text-xs">{r.fee.replace('Rs. ', '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Humanities Stream Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-amber-500"></div>
                <div className="p-3.5 pl-4.5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">Humanities Stream</h4>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: '11th Humanities (Boys)', fee: getFee('11th_humanities_boys', 'Rs. 1800') },
                      { label: '11th Humanities (Girls)', fee: getFee('11th_humanities_girls', 'Rs. 1600') },
                      { label: '12th Humanities (Boys)', fee: getFee('12th_humanities_boys', 'Rs. 1550') },
                      { label: '12th Humanities (Girls)', fee: getFee('12th_humanities_girls', 'Rs. 1550') }
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center text-xs xs:text-sm gap-2">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{r.label}</span>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 shrink-0">
                          <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px]">Rs.</span>
                          <span className="text-slate-900 dark:text-white font-bold text-xs">{r.fee.replace('Rs. ', '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Secondary Classes Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-indigo-500"></div>
                <div className="p-3.5 pl-4.5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">Secondary Classes</h4>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: '9th Class Subjects', fee: getFee('9th', 'Rs. 1700') },
                      { label: '10th Class Subjects', fee: getFee('10th', 'Rs. 1100') }
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center text-xs xs:text-sm gap-2">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{r.label}</span>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 shrink-0">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">Rs.</span>
                          <span className="text-slate-900 dark:text-white font-bold text-xs">{r.fee.replace('Rs. ', '')}</span>
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
