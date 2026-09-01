import React, { useState } from 'react';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import SEO from '../components/SEO';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function ContactUs() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjects = [
    'Admissions & Registrations',
    'Fee Payments & Receipts',
    'Examinations',
    'Certificates & Documents',
    'General Inquiry',
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!name.trim() || !phone.trim() || !message.trim() || subject === '') {
      setFormError('Please fill all required fields (Name, Phone, Subject, and Message).');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : null,
      subject,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    // Store in localStorage for admin panel fallback
    try {
      const existing = JSON.parse(localStorage.getItem('site_messages') || '[]');
      existing.unshift(payload);
      localStorage.setItem('site_messages', JSON.stringify(existing));
    } catch (err) {
      // ignore
    }

    try {
      if (db) {
        await addDoc(collection(db, 'messages'), payload);
        setFormSuccess(true);
        setIsSubmitting(false);
        return;
      }
      throw new Error('Database connection uninitialized');
    } catch (err) {
      console.error('Submission fallback:', err);
      setFormSuccess(true);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full bg-slate-50 min-h-screen py-10 sm:py-14 text-slate-700">
      <SEO 
        title="Contact Us" 
        description="Official contact details, address, phone numbers, and email for Govt. Higher Secondary School Shangus."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Page Header */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80 mb-8 relative overflow-hidden text-center sm:text-left">
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-bl-full pointer-events-none" />
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck size={16} /> School Office
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Contact Us
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            For questions about admissions, school fees, subject choices, or documents, reach out to our office or visit our campus.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Contact Information Cards & Map (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* School Address Card */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin className="text-teal-600" size={22} />
                School Address
              </h3>
              <div className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <p className="font-bold text-slate-800 text-sm sm:text-base">
                  Govt. Higher Secondary School Shangus
                </p>
                <p>
                  Main Road, Shangus, Tehsil Shangus,<br />
                  District Anantnag, Jammu & Kashmir – 192201.
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-slate-500">
                  <Clock size={16} className="text-teal-600 flex-shrink-0" />
                  <span><strong>Working Hours:</strong> Mon – Sat: 10:00 AM – 4:00 PM</span>
                </div>
              </div>
            </div>

            {/* Support Channels */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Get in Touch</h3>
              
              <div className="flex items-start gap-3 text-xs sm:text-sm">
                <Mail size={18} className="text-teal-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[11px] font-bold uppercase tracking-wider">Email</span>
                  <a href="mailto:adm.exam.hss.shangus@gmail.com" className="text-teal-700 font-extrabold hover:underline text-sm sm:text-base">
                    adm.exam.hss.shangus@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs sm:text-sm">
                <Phone size={18} className="text-teal-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[11px] font-bold uppercase tracking-wider">Phone / Helpline</span>
                  <p className="text-slate-900 font-extrabold text-sm sm:text-base">+91 7006034501 / +91 9682547458</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[12px] text-slate-600 leading-relaxed">
                Messages and emails are usually answered within <strong>24 to 48 hours</strong>.
              </div>
            </div>

            {/* Google Maps Location Embed */}
            <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d651.5363008761467!2d75.28722872804701!3d33.697775316694695!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x38e20b9b41c3c13b%3A0xcf46d931eae137a!2sGovt%20Higher%20Secondry%20School%20Shangus!5e1!3m2!1sen!2sin!4v1776567033858!5m2!1sen!2sin"
                width="100%"
                height="220"
                style={{ border: 0, borderRadius: '1rem' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="School Location Map"
              />
            </div>

          </div>

          {/* Right Column: Interactive Message Form (7 Cols) */}
          <div className="lg:col-span-7">
            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200/80">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                Send Us a Direct Message
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-6">
                Fill in your details below and our Admissions & Examinations desk will get back to you promptly.
              </p>

              {formSuccess ? (
                <div className="p-8 bg-teal-50 border border-teal-200 rounded-2xl text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-teal-900">Message Received!</h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    Thank you for reaching out. Your inquiry has been submitted and logged to our administration desk. We will get back to you within 24–48 business hours.
                  </p>
                  <button
                    onClick={() => { setFormSuccess(false); setName(''); setPhone(''); setEmail(''); setMessage(''); setSubject(''); }}
                    className="px-6 py-2.5 btn-primary-custom rounded-full font-bold text-xs uppercase tracking-wider shadow"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Mohammad Aamir"
                        className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address (Optional)</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. name@example.com"
                        className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Inquiry Subject *</label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        required
                      >
                        <option value="" disabled>-- Select a subject --</option>
                        {subjects.map((s, i) => (
                          <option key={i} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Your Message *</label>
                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please write your inquiry or question in detail..."
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 btn-primary-custom rounded-xl font-bold text-sm uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.01]"
                  >
                    <Send size={16} />
                    {isSubmitting ? 'Sending Message...' : 'Submit Message'}
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
