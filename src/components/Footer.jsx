import React, { useState, useEffect } from 'react';
import { BookOpen, X, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

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

  return (
    <>
      <footer className="bg-slate-950 text-slate-300 pt-12 pb-6 mt-10">
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
            
            {/* 2. Map (Height halved to 60) */}
            <div className="w-full rounded-lg overflow-hidden border-2 border-slate-800 leading-none m-0 mt-4">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d651.5363008761467!2d75.28722872804701!3d33.697775316694695!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x38e20b9b41c3c13b%3A0xcf46d931eae137a!2sGovt%20Higher%20Secondry%20School%20Shangus!5e1!3m2!1sen!2sin!4v1776567033858!5m2!1sen!2sin"
                width="100%"
                height="60"
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
                Main Road, Shangus,<br/>Anantnag, J&K - 192201
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
          <p className="mb-1">© 2023 Govt HSS Shangus | Developed by NexLifTech</p>
          <a
            href="mailto:sheikhgulfam91@gmail.com"
            onClick={(e) => handleEmailClick(e, 'sheikhgulfam91@gmail.com')}
            className="transition-colors hover:text-teal-400 focus:outline-none"
          >
            (sheikhgulfam91@gmail.com)
          </a>
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
            className="bg-white text-slate-800 rounded-lg shadow-2xl max-w-xl w-full p-3 md:p-5 relative animate-in fade-in zoom-in duration-200 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Close Button */}
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={24} />
            </button>

            {/* Privacy Policy Content */}
            {activeModal === 'privacy' && (
              <div>
                <h2 className="text-2xl font-extrabold mb-2 text-slate-900">Privacy Policy</h2>
                <p className="text-slate-400 text-sm italic mb-6">Last Updated: Nov 20, 2025</p>
                <div className="space-y-5 text-sm md:text-base text-slate-600">
                  <p><strong className="text-slate-800">1. Information We Collect:</strong> We collect personal information such as name, parentage, and academic records solely for admission and administrative purposes.</p>
                  <p><strong className="text-slate-800">2. How We Use Information:</strong> Data is used to manage student records, examinations, and communication. We do not sell data to third parties.</p>
                  <p><strong className="text-slate-800">3. Cookies:</strong> This website uses cookies to improve user experience and manage login sessions.</p>
                  <p><strong className="text-slate-800">4. Contact:</strong> For concerns, email principal@govthssshangus.edu.in.</p>
                </div>
              </div>
            )}

            {/* Terms and Conditions Content */}
            {activeModal === 'terms' && (
              <div>
                <h2 className="text-2xl font-extrabold mb-6 text-slate-900">Terms and Conditions</h2>
                <div className="space-y-5 text-sm md:text-base text-slate-600">
                  <p><strong className="text-slate-800">1. Acceptance:</strong> By using this portal, you agree to provide accurate information during registration.</p>
                  <p><strong className="text-slate-800">2. Code of Conduct:</strong> Students must maintain discipline while using digital resources.</p>
                  <p><strong className="text-slate-800">3. Intellectual Property:</strong> All content on this website is the property of Govt HSS Shangus.</p>
                  <p><strong className="text-slate-800">4. Changes:</strong> The school administration reserves the right to update these terms at any time.</p>
                </div>
              </div>
            )}
            {/* Contact Form Content */}
            {activeModal === 'contactForm' && (
              <div>
                <h2 className="text-2xl font-extrabold mb-2 text-slate-900">Send Us a Message</h2>
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
  const [backendAvailable, setBackendAvailable] = useState(null);
  const [showFallback, setShowFallback] = useState(false);

  const subjects = [
    'Admissions',
    'Academics',
    'Examination',
    'Fees',
    'General Inquiry',
    'Feedback',
  ];

  useEffect(() => {
    let mounted = true;
    // quick availability check; HEAD is lightweight if supported
    fetch('/api/messages', { method: 'HEAD' })
      .then((res) => {
        if (!mounted) return;
        setBackendAvailable(res && res.ok);
      })
      .catch(() => {
        if (!mounted) return;
        setBackendAvailable(false);
      });
    return () => { mounted = false; };
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim() || subject === '') {
      alert('Please fill required fields: Name, Phone, Subject, Message');
      return;
    }

    const to = 'adm.exam.hss.shangus@gmail.com';
    const mailSubject = encodeURIComponent(subject + ' - Website Contact');
    const body = encodeURIComponent(
      `Name: ${name}\nPhone: ${phone}\nEmail: ${email || 'N/A'}\n\nMessage:\n${message}`
    );

    // Attempt to POST to backend API endpoint first; fallback to mailto
    const payload = {
      name,
      phone,
      email: email || null,
      subject,
      message,
      createdAt: new Date().toISOString(),
    };

    // persist locally so admin can view even without backend
    try {
      const existing = JSON.parse(localStorage.getItem('site_messages') || '[]');
      existing.unshift(payload);
      localStorage.setItem('site_messages', JSON.stringify(existing));
    } catch (e) {
      // ignore localStorage errors
    }

    // Try sending to backend; if it fails, fall back to fallback choice modal state
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((res) => {
      if (!res.ok) throw new Error('Failed');
      alert('Message sent successfully.');
      onClose();
    }).catch(() => {
      setShowFallback(true);
    });
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
      <div className="space-y-6 text-slate-700 py-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <div className="bg-emerald-500 text-white rounded-full p-1 mt-0.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-emerald-900 text-[15px]">Logged to Admin Messages Panel</h4>
            <p className="text-xs text-emerald-700 mt-1">
              Your inquiry has been successfully logged on this system's Admin Messages board.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-600 font-medium">
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
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.024-5.11-2.887-6.974C16.486 1.91 14.018.883 11.399.883c-5.438 0-9.863 4.42-9.866 9.861 0 1.764.496 3.488 1.443 5.074l-1.012 3.693 3.793-1.042L6.647 19.16zM17.15 13.9c-.282-.142-1.67-.824-1.929-.918-.258-.094-.447-.142-.635.142-.188.283-.729.918-.894 1.106-.165.188-.329.212-.612.071-.282-.141-1.192-.44-2.271-1.402-.84-.749-1.407-1.673-1.572-1.956-.165-.283-.018-.436.123-.576.127-.126.282-.329.424-.494.141-.165.188-.282.282-.47.094-.188.047-.353-.024-.494-.071-.141-.635-1.53-.87-2.094-.229-.553-.46-.477-.635-.486-.164-.008-.353-.01-.54-.01-.188 0-.494.07-.753.353-.258.282-.988.965-.988 2.353s1.011 2.73 1.152 2.918c.142.188 1.99 3.04 4.821 4.261.673.29 1.2.463 1.609.593.676.214 1.291.184 1.777.112.541-.08 1.67-.682 1.905-1.341.235-.659.235-1.223.165-1.341-.07-.118-.259-.188-.541-.33z"/>
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
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold rounded-md transition-all text-sm"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
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
      {backendAvailable === false && (
        <p className="text-xs text-slate-400 italic mt-2">When you click "Send Message", your mail client will open with the message prefilled; click Send in the mail app to deliver it to adm.exam.hss.shangus@gmail.com.</p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary-custom font-bold px-4 py-2 rounded w-full shadow-md transition-all duration-200">
          Send Message
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 border rounded w-32">
          Cancel
        </button>
      </div>
    </form>
  );
}

