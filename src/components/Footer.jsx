import React, { useState, useEffect } from 'react';
import { BookOpen, X, Mail, Lock, Unlock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadSiteSettings, DEFAULT_SETTINGS } from '../utils/settingsLoader';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

// Social Media Custom SVG Icons (since brand icons are not exported in this Lucide version)
function FacebookIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function YoutubeIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  );
}

function TwitterIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

function InstagramIcon({ size = 14, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// Smart email link handler (opens Gmail web on desktop, uses mailto on mobile)
function handleEmailClick(e, email, subject = '', body = '') {
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) {
    e.preventDefault();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}${subject ? `&su=${encodeURIComponent(subject)}` : ''}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
    window.open(gmailUrl, '_blank');
  }
}

export default function Footer() {
  // This state controls which popup is open ('privacy', 'terms', or null for closed)
  const [activeModal, setActiveModal] = useState(null);
  // Contact form state is handled by ContactForm component
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem('isAdminAuthenticated') === 'true');
    const interval = setInterval(() => {
      setIsAdmin(sessionStorage.getItem('isAdminAuthenticated') === 'true');
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSiteSettings().then(setSettings);

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

  return (
    <>
      <footer className="bg-slate-950 text-slate-300 pt-12 pb-16 md:pb-6 mt-10 border-t-[3px] footer-theme-border">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          {/* Brand */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center mb-4">
              <BookOpen className="text-teal-500 mr-2" size={24} />
              <h4 className="text-white font-bold text-lg tracking-wide font-title">Govt. H.S.S. Shangus</h4>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
              Since 1971, Govt HSS Shangus provides Science, Humanities and Secondary education with experienced faculty, well-equipped labs, a library and active sports programs.
              We emphasise leadership, critical thinking and community engagement to prepare students for higher education and civic life.
            </p>

            {/* Social Media Links */}
            {settings.socialLinks && (
              <div className="flex gap-3 mt-4 items-center justify-center md:justify-start flex-wrap">
                {settings.socialLinks.facebook && settings.socialLinks.facebook !== '#' && (
                  <a
                    href={settings.socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white hover:bg-[#961c14] border border-slate-800 transition-all duration-200 flex items-center justify-center"
                    title="Facebook"
                  >
                    <FacebookIcon size={14} />
                  </a>
                )}
                {settings.socialLinks.youtube && settings.socialLinks.youtube !== '#' && (
                  <a
                    href={settings.socialLinks.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white hover:bg-[#961c14] border border-slate-800 transition-all duration-200 flex items-center justify-center"
                    title="YouTube"
                  >
                    <YoutubeIcon size={14} />
                  </a>
                )}
                {settings.socialLinks.twitter && settings.socialLinks.twitter !== '#' && (
                  <a
                    href={settings.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white hover:bg-[#961c14] border border-slate-800 transition-all duration-200 flex items-center justify-center"
                    title="Twitter / X"
                  >
                    <TwitterIcon size={14} />
                  </a>
                )}
                {settings.socialLinks.instagram && settings.socialLinks.instagram !== '#' && (
                  <a
                    href={settings.socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white hover:bg-[#961c14] border border-slate-800 transition-all duration-200 flex items-center justify-center"
                    title="Instagram"
                  >
                    <InstagramIcon size={14} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="text-center">
            <h4 className="text-white font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm flex flex-col">
              <Link to="/" onClick={() => window.scrollTo(0, 0)} className="hover:text-teal-400 transition-colors">Home</Link>
              <Link to="/about" onClick={() => window.scrollTo(0, 0)} className="hover:text-teal-400 transition-colors">About Us</Link>
              <Link to="/academics" onClick={() => window.scrollTo(0, 0)} className="hover:text-teal-400 transition-colors">Academics</Link>
              <Link to="/admissions" onClick={() => window.scrollTo(0, 0)} className="hover:text-teal-400 transition-colors">Admissions</Link>
            </ul>
          </div>

          {/* Contact Us - With Real Google Maps & Custom Spacing */}
          <div className="flex flex-col items-center gap-0 text-center md:items-center md:text-center">
            {/* 1. Heading + quick contact button */}
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-white font-semibold text-[20px] mb-0 mt-0 leading-[1.2]">Contact Us</h2>
              <button
                onClick={() => setActiveModal('contactForm')}
                aria-label="Open contact form"
                className="btn-primary-custom rounded-md px-3 py-1 text-xs font-bold shadow-md flex items-center justify-center transition-all duration-200"
                style={{ boxShadow: '0 6px 18px rgba(16,185,129,0.12)' }}
              >
                <Mail size={14} />
              </button>
            </div>

            {/* 2. Map */}
            <div className="w-full rounded-xl overflow-hidden border-2 border-slate-800 leading-none m-0 mt-4 shadow-md hover:border-teal-500/50 transition-colors duration-300">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d651.5363008761467!2d75.28722872804701!3d33.697775316694695!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x38e20b9b41c3c13b%3A0xcf46d931eae137a!2sGovt%20Higher%20Secondry%20School%20Shangus!5e1!3m2!1sen!2sin!4v1776567033858!5m2!1sen!2sin"
                width="100%"
                height="110"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="School Location Map"
              />
            </div>

            {/* Line 1 */}
            <div className="w-[2px] h-[10px] bg-[#10b981] m-0 mt-3"></div>

            {/* 3. Address Box */}
            <div className="text-center w-full m-0 p-0 mt-2 md:mt-0">
              <div className="text-slate-400 text-[14px] leading-[1.4] m-0 p-0">
                Main Road, Shangus,<br />Anantnag, J&K - 192201
              </div>
            </div>
          </div>

          {/* Legal Menu (Clicking these buttons opens the Modal) */}
          <div className="text-center">
            <h4 className="text-white font-bold mb-4">Legal Menu</h4>
            <ul className="space-y-2 text-sm flex flex-col items-center">
              <button onClick={() => setActiveModal('privacy')} className="hover:text-teal-400 transition-colors focus:outline-none">
                Privacy Policy
              </button>
              <button onClick={() => setActiveModal('terms')} className="hover:text-teal-400 transition-colors focus:outline-none">
                Terms & Conditions
              </button>
            </ul>
          </div>

        </div>

        {/* Bottom Bar - Centered with Top Horizontal Line, White Text & Interactive Email Link */}
        <div className="max-w-7xl mx-auto px-4 pt-5 border-t border-slate-700 flex flex-col items-center justify-center text-center text-xs text-white">
          <p className="mb-2 leading-relaxed text-center flex flex-col sm:block items-center">
            <span>
              © 2023 Govt HSS Shangus <span className="mx-1">|</span> Developed by <span className="font-medium text-emerald-300">Sheikh Gulfam</span>,
            </span>
            <span className="mt-1 sm:mt-0 sm:ml-1 inline-flex items-center gap-1.5">
              <a href="https://nexliftech.netlify.app/" target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-400 hover:text-teal-300 transition-colors underline decoration-teal-400/50 hover:decoration-teal-300 underline-offset-4">Next Life Technologies</a>
              <a href="https://wa.me/919682547458" target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:text-[#20ba5a] transition-colors" title="Contact Developer on WhatsApp">
                <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.024-5.11-2.887-6.974C16.486 1.91 14.018.883 11.399.883c-5.438 0-9.863 4.42-9.866 9.861 0 1.764.496 3.488 1.443 5.074l-1.012 3.693 3.793-1.042L6.647 19.16zM17.15 13.9c-.282-.142-1.67-.824-1.929-.918-.258-.094-.447-.142-.635.142-.188.283-.729.918-.894 1.106-.165.188-.329.212-.612.071-.282-.141-1.192-.44-2.271-1.402-.84-.749-1.407-1.673-1.572-1.956-.165-.283-.018-.436.123-.576.127-.126.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.53-.87-2.094-.229-.553-.46-.477-.635-.486-.164-.008-.353-.01-.54-.01-.188 0-.494.07-.753.353-.258.282-.988.965-.988 2.353s1.011 2.73 1.152 2.918c.142.188 1.99 3.04 4.821 4.261.673.29 1.2.463 1.609.593.676.214 1.291.184 1.777.112.541-.08 1.67-.682 1.905-1.341.235-.659.235-1.223.165-1.341-.07-.118-.259-.188-.541-.33z" />
                </svg>
              </a>
              <a href="mailto:2nexlif@gmail.com" onClick={(e) => handleEmailClick(e, '2nexlif@gmail.com')} className="text-teal-400 hover:text-teal-300 transition-colors" title="Email Developer">
                <Mail size={16} />
              </a>
            </span>
          </p>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {/* Mobile-only Admin Lock Icon in Footer */}
            <Link
              to="/admin/portal"
              className="md:hidden transition-colors p-1 flex items-center justify-center mt-2"
              style={{ color: isAdmin ? '#34d399' : '#94a3b8' }}
              title={isAdmin ? "Admin Dashboard (Active Session)" : "Administrative Portal"}
              aria-label="Admin Portal"
            >
              {isAdmin ? (
                <Unlock size={18} className="stroke-[2.5] animate-pulse" />
              ) : (
                <Lock size={18} className="stroke-[2.5]" />
              )}
            </Link>
          </div>
        </div>
      </footer>

      {/* --- MODAL POPUPS --- */}
      {/* If activeModal is NOT null, draw this dark background overlay */}
      {activeModal && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-3"
          onClick={() => setActiveModal(null)}
        >

          {/* The white popup box */}
          <div
            className="bg-white text-slate-800 rounded-3xl border-t-[5px] border-[var(--teal-accent)] shadow-2xl max-w-xl w-full p-5 md:p-8 relative animate-in fade-in zoom-in duration-200 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Close Button */}
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors p-1"
              aria-label="Close Modal"
            >
              <X size={20} />
            </button>

            {/* Privacy Policy Content */}
            {activeModal === 'privacy' && (
              <div>
                <h2 className="text-xl font-bold font-title tracking-wider text-[var(--teal-accent)] border-b border-slate-100 pb-2.5 mb-2 uppercase">
                  Privacy Policy
                </h2>
                <p className="text-slate-400 text-[10px] uppercase font-mono tracking-wider mb-5">Last Updated: June 28, 2026</p>
                <div className="space-y-4 text-[12px] md:text-sm text-slate-650 leading-relaxed">
                  <p><strong className="text-slate-800">1. Data Scope & Collection:</strong> We collect personal identifiers (student name, parentage, contact info) and sensitive data (academic credentials, family income for fee structures, bank details for scholarship profiles) strictly for enrollment and official recordkeeping.</p>
                  <p><strong className="text-slate-800">2. Processing Purpose:</strong> All data is processed solely for Admission, examination, and other administrative purposes. We do not share or sell student data to third-party commercial marketing platforms.</p>
                  <p><strong className="text-slate-800">3. Data Security & Storage:</strong> Records are saved in encrypted cloud datastores with secure backend access guidelines. Data is retained only for active academic tenure or as specified by regional school board policies.</p>
                  <p><strong className="text-slate-800">4. Support & Modifications:</strong> To check your registered details or request immediate corrections, contact the admissions and exams department desk at <a href="mailto:adm.exam.hss.shangus@gmail.com" className="text-[var(--teal-accent)] hover:underline underline-offset-2">adm.exam.hss.shangus@gmail.com</a>.</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                  <button onClick={() => setActiveModal(null)} className="px-5 py-2 text-xs font-bold btn-primary-custom rounded-xl shadow-md active:scale-95 transition-all">
                    Acknowledge
                  </button>
                </div>
              </div>
            )}

            {/* Terms and Conditions Content */}
            {activeModal === 'terms' && (
              <div>
                <h2 className="text-xl font-bold font-title tracking-wider text-[var(--teal-accent)] border-b border-slate-100 pb-2.5 mb-4 uppercase">
                  Terms and Conditions
                </h2>
                <div className="space-y-4 text-[12px] md:text-sm text-slate-650 leading-relaxed">
                  <p><strong className="text-slate-800">1. Verification & Accuracy:</strong> Users (students and parents) must supply valid, verifiable information for admissions. Presenting falsified credentials will result in immediate cancellation of registration.</p>
                  <p><strong className="text-slate-800">2. Credentials Security:</strong> System operators (staff and faculty) are responsible for safeguarding console passwords. Sharing console access credentials or bypassing CAPTCHA/session validations is strictly prohibited.</p>
                  <p><strong className="text-slate-800">3. Appropriate Use:</strong> The ERP, including frontend and backend functionalities, must be accessed strictly for authorized school operations. Web-scraping or brute-force testing is forbidden.</p>
                  <p><strong className="text-slate-800">4. Proprietary Assets:</strong> All document templates, printable PDF registers, search logic, and logos are assets of Govt. HSS Shangus and Next Life Technologies, protected under intellectual property guidelines.</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                  <button onClick={() => setActiveModal(null)} className="px-5 py-2 text-xs font-bold btn-primary-custom rounded-xl shadow-md active:scale-95 transition-all">
                    Accept & Close
                  </button>
                </div>
              </div>
            )}

            {/* Contact Form Content */}
            {activeModal === 'contactForm' && (
              <div>
                <h2 className="text-xl font-bold font-title tracking-wider text-[var(--teal-accent)] border-b border-slate-100 pb-2.5 mb-5 uppercase">
                  Send Us a Message
                </h2>
                <ContactForm onClose={() => setActiveModal(null)} />
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}

function ContactForm({ onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  const subjects = [
    'Admissions',
    'Academics',
    'Examination',
    'Fees',
    'General Inquiry',
    'Feedback',
  ];

  // We rely purely on Firebase now; backend fallback removed to prevent 404 console errors.
  useEffect(() => {
    setBackendAvailable(false);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!name.trim() || !phone.trim() || !message.trim() || subject === '') {
      setFormError('Please fill required fields: Name, Phone, Subject, Message');
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      subject,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    // persist locally so admin can view even without backend
    try {
      const existing = JSON.parse(localStorage.getItem('site_messages') || '[]');
      existing.unshift(payload);
      localStorage.setItem('site_messages', JSON.stringify(existing));
    } catch (err) {
      // ignore localStorage errors
    }

    try {
      // 1. Try to save to Firestore first (Live Database)
      if (db) {
        await addDoc(collection(db, 'messages'), payload);
        setFormSuccess(true);
        return;
      }
      
      throw new Error('Database not configured');
    } catch (err) {
      console.error('Message submission failed:', err);
      setShowFallback(true);
    }
  }

  if (showFallback) {
    const to = 'adm.exam.hss.shangus@gmail.com';
    const mailSubject = encodeURIComponent(`${subject} - Website Contact`);
    const body = encodeURIComponent(
      `Name: ${name}\nPhone: ${phone}\nEmail: ${email || 'N/A'}\n\nMessage:\n${message}`
    );
    const wsBody = encodeURIComponent(
      `*Website Inquiry*\n*Name:* ${name}\n*Phone:* ${phone}\n*Email:* ${email || 'N/A'}\n*Subject:* ${subject}\n\n*Message:*\n${message}`
    );

    return (
      <div className="space-y-6 py-2">
        <div className="banner-teal-custom p-4 rounded-lg flex items-start gap-3 border text-xs">
          <div className="bg-emerald-500 text-white rounded-full p-1 mt-0.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-[15px]">Logged to Admin Messages Panel</h4>
            <p className="text-xs mt-1">
              Your inquiry has been successfully logged on this system's Admin Messages board.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium">
            Since the database server is currently offline, please choose a method below to deliver your message to the <strong>Admissions & Exams</strong> department:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <a
              href={`https://wa.me/917006034501?text=${wsBody}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="bg-[#25D366] text-white hover:bg-[#20ba5a] font-bold px-4 py-3.5 rounded-lg flex items-center justify-center gap-2.5 w-full transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-center text-sm"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.024-5.11-2.887-6.974C16.486 1.91 14.018.883 11.399.883c-5.438 0-9.863 4.42-9.866 9.861 0 1.764.496 3.488 1.443 5.074l-1.012 3.693 3.793-1.042L6.647 19.16zM17.15 13.9c-.282-.142-1.67-.824-1.929-.918-.258-.094-.447-.142-.635.142-.188.283-.729.918-.894 1.106-.165.188-.329.212-.612.071-.282-.141-1.192-.44-2.271-1.402-.84-.749-1.407-1.673-1.572-1.956-.165-.283-.018-.436.123-.576.127-.126.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.53-.87-2.094-.229-.553-.46-.477-.635-.486-.164-.008-.353-.01-.54-.01-.188 0-.494.07-.753.353-.258.282-.988.965-.988 2.353s1.011 2.73 1.152 2.918c.142.188 1.99 3.04 4.821 4.261.673.29 1.2.463 1.609.593.676.214 1.291.184 1.777.112.541-.08 1.67-.682 1.905-1.341.235-.659.235-1.223.165-1.341-.07-.118-.259-.188-.541-.33z" />
              </svg>
              WhatsApp
            </a>

            <a
              href={`mailto:${to}?subject=${mailSubject}&body=${body}`}
              onClick={(e) => {
                handleEmailClick(e, to, subject + ' - Website Contact', `Name: ${name}\nPhone: ${phone}\nEmail: ${email || 'N/A'}\n\nMessage:\n${message}`);
                onClose();
              }}
              className="bg-[#ea4335] text-white hover:bg-[#d93025] font-bold px-4 py-3.5 rounded-lg flex items-center justify-center gap-2.5 w-full transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-center text-sm"
            >
              <Mail size={18} />
              Email App
            </a>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold rounded-md transition-all text-sm btn-cancel-custom"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (formSuccess) {
    return (
      <div className="space-y-6 py-2">
        <div className="banner-teal-custom p-4 rounded-lg flex items-start gap-3 border text-xs">
          <div className="bg-emerald-500 text-white rounded-full p-1 mt-0.5 flex-shrink-0 animate-pulse">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-[15px]">Message Sent Successfully</h4>
            <p className="text-xs mt-1">
              Your inquiry has been successfully delivered and saved to the administration console.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-250 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold rounded-md transition-all text-sm btn-cancel-custom"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
      {formError && (
        <div className="banner-red-custom p-3 rounded-lg text-xs flex items-center gap-2 mb-3 border">
          <svg className="w-4 h-4 flex-shrink-0 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-semibold">{formError}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Your Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mohammad Aamir" className="w-full mt-1 p-2 border rounded-md text-sm" required />
        </div>
        <div>
          <label className="text-sm font-medium">Phone Number</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" className="w-full mt-1 p-2 border rounded-md text-sm" required />
        </div>
        <div>
          <label className="text-sm font-medium">Email Address (optional)</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. you@email.com" className="w-full mt-1 p-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Subject</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full mt-1 p-2 border rounded-md text-sm" required>
            <option value="" disabled>-- Select a subject --</option>
            {subjects.map((s, i) => (
              <option key={i} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Your Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message here..." rows={5} className="w-full mt-1 p-2 border rounded-md text-sm" required />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary-custom font-bold px-4 py-2 rounded w-full shadow-md transition-all duration-200">
          Send Message
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 border rounded w-32 btn-cancel-custom">
          Cancel
        </button>
      </div>
    </form>
  );
}

